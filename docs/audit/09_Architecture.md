# 09 — Architecture

## Kiến trúc hiện tại

```
Trình duyệt (Index.html, 1 trang)
   │  google.script.run.API(maPhien, tenHam, thamSo)      ← cổng duy nhất
   ▼
Webapp chính (Apps Script, chạy quyền Admin - USER_DEPLOYING)
   ├─ doGet(?cong=vé)  → xuLyVeCong_ → taoPhien_ (CacheService, 12 giờ)
   ├─ API()            → xacThucPhien_ (kiểm lại danh sách quyền mỗi lần)
   │                     → HAM_API_ whitelist → kiểm CHỈ XEM → hàm nghiệp vụ
   ├─ LockService (Script Lock, chờ tối đa 30 giây) cho mọi hàm ghi
   ├─ CacheService: phiên, danh sách kho, giá trị lọc năm lưu trữ
   └─ PropertiesService: danh sách quyền, liên kết dữ liệu, cấu hình vùng miền, khóa Cổng
   ▼
Google Sheets (4 file)                 Google Drive
 ├─ Phiếu cân: PhieuCan_DN,             ├─ thư mục file Excel đã import
 │   PhieuCan_DN_<năm> (lưu trữ),       ├─ file xuất Excel/PDF tạm
 │   Update_MiSa_PC, Draft, Nhật ký     └─ thư mục sao lưu hằng đêm
 ├─ Báo giá: Baogia_DN, Ma_BaoGia, Ma_KL, QL_BaoGia, _FINAL, _SAVE
 ├─ Xuất hàng: NL_PC_XH, NL_DH_XB
 └─ Kho Dăm: DATA_GIAODICH, SYS_CAUHINH, Nhapdokho, SYS_DANHMUCKHO

Cổng đăng nhập (dự án Apps Script riêng, USER_ACCESSING)
   đọc email Google → ký vé HMAC → chuyển về webapp chính
Trigger: TRIGGER_saoLuuHangDem (sao lưu hằng đêm), runCalculatePrice (nếu bạn cài theo giờ)
```

## Giới hạn quy mô — trả lời thẳng câu hỏi "500.000 dòng"

| Giới hạn của Google | Giá trị | Ảnh hưởng tới hệ thống này |
|---|---|---|
| Số ô tối đa / 1 file Google Sheet | **10.000.000 ô** | `PhieuCan_DN` rộng 27 cột, các sheet lưu trữ năm nằm **cùng file** → cả file chứa tối đa ≈ **370.000 phiếu** (10.000.000 ÷ 27), còn ít hơn vì có Update_MiSa_PC, Draft, Nhật ký. **500.000 phiếu không thể lưu được** trong cấu trúc hiện tại. |
| Thời gian 1 lượt thực thi | 6 phút | Báo cáo không lọc ngày đọc toàn lịch sử: ~2,7 triệu ô ở 100.000 phiếu; ở vài trăm nghìn phiếu có nguy cơ vượt thời gian/bộ nhớ. |
| CacheService | 100 KB / khóa, tối đa 6 giờ | Cache giá trị lọc tự bỏ qua nếu > 90 KB (đọc thẳng Sheet). |
| PropertiesService | 9 KB / giá trị, 500 KB tổng | Danh sách quyền lưu JSON — đủ cho vài trăm người dùng. |

**Kết luận:** các tối ưu trong đợt này làm chi phí mỗi thao tác **không còn tăng theo tổng lịch sử** (trừ báo cáo cố tình xem toàn bộ lịch sử), nhưng muốn vượt ~300.000 phiếu phải đổi nơi lưu trữ.

## Kiến trúc đề xuất để đạt 500.000+ dòng (cần bạn duyệt — đổi cấu trúc dữ liệu)

1. **Phiếu cân đã khóa sổ ra file riêng mỗi năm** thay vì sheet trong cùng file Phiếu Cân (hiện ĐNTT đặt `PhieuCan_DN_<năm>` cùng file). Cần đổi đồng thời ở ĐNTT (nơi khóa sổ) và `LT_docPhieuCanGopLuuTru_` ở webapp này.
2. **Bảng tổng hợp theo ngày** (`TongHop_Ngay`: ngày × khách hàng × số phiếu, tổng KL, tổng tiền) được cập nhật khi import. Dashboard và báo cáo nhiều năm đọc bảng nhỏ này thay vì hàng trăm nghìn dòng.
3. **Phân trang phía máy chủ** cho báo cáo chi tiết (`getBaoCaoTongHop(filters, trang, soDong)`), giữ hàm cũ để tương thích.
4. Nếu quy mô tiếp tục tăng (triệu dòng, nhiều người dùng đồng thời): chuyển dữ liệu giao dịch sang **BigQuery** hoặc **Cloud SQL** qua JDBC, giữ Google Sheet cho danh mục và báo cáo xem nhanh.

## Cập nhật 27/09/2026 — Bỏ "Chốt sổ năm" ở đây, đồng bộ với Khóa sổ năm của ĐNTT

- Đã gỡ chức năng Chốt sổ của webapp này (giao diện + `HT_chotSoNam`, `HT_layThongKeNamPhieuCan`, `LT_locDongChuaLuuTru_`). Khóa sổ năm chỉ làm ở ĐNTT (repo `HAK_WEBAPP_DNTT_DRAFT`, Hệ Thống › Khóa Sổ Năm).
- ĐNTT chuyển phiếu cân **đã thanh toán** sang `PhieuCan_DN_<năm cân>` trong cùng file Phiếu Cân, chép nguyên 28 cột. Webapp này vẫn đọc các sheet đó (báo cáo theo năm, kiểm tra trùng khi import, nhập tay, danh sách lọc, tra mã báo giá) — đã kiểm chứng bằng dữ liệu dựng đúng như ĐNTT tạo.
- Vì ĐNTT chuyển phiếu đã trả ra khỏi `PhieuCan_DN` mỗi năm, sheet chính **không** phình mãi; cảnh báo "import/tính giá chậm dần theo số năm" ở bản trước là không đúng.
- **CONCUR-01**: trước khi ghi theo số dòng (cập nhật khi import lại, tính giá), đọc lại cột A + V của đúng các dòng đích; lệch (ĐNTT vừa xóa dòng) thì không ghi gì và báo thực hiện lại.
- **CONCUR-02**: khi ĐNTT khóa sổ chạy thật, file Phiếu Cân mang cờ Developer Metadata `HAK_KHOA_SO_NAM_DANG_CHAY` (ĐNTT v2026.9.7); webapp này thấy cờ (< 10 phút) thì tạm dừng import / nhập tay / tính giá (kể cả trigger).
- Quy trình: khóa sổ ở ĐNTT vào đầu tháng 1, ngoài giờ nhập liệu.
