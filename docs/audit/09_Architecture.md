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

1. **Lưu trữ mỗi năm ra 1 file Google Sheet riêng** (`PhieuCan_2024`, `PhieuCan_2025`…) thay vì sheet trong cùng file. Mỗi file tối đa ~370.000 phiếu/năm. `LT_docPhieuCanGopLuuTru_` là điểm duy nhất cần đổi để mở file thay vì sheet — các báo cáo khác không phải sửa.
2. **Bảng tổng hợp theo ngày** (`TongHop_Ngay`: ngày × khách hàng × số phiếu, tổng KL, tổng tiền) được cập nhật khi import. Dashboard và báo cáo nhiều năm đọc bảng nhỏ này thay vì hàng trăm nghìn dòng.
3. **Phân trang phía máy chủ** cho báo cáo chi tiết (`getBaoCaoTongHop(filters, trang, soDong)`), giữ hàm cũ để tương thích.
4. Nếu quy mô tiếp tục tăng (triệu dòng, nhiều người dùng đồng thời): chuyển dữ liệu giao dịch sang **BigQuery** hoặc **Cloud SQL** qua JDBC, giữ Google Sheet cho danh mục và báo cáo xem nhanh.

## Cập nhật 27/09/2026 — Bỏ chức năng "Chốt sổ năm" (theo yêu cầu)

- Đã gỡ: nút/bảng "Lưu trữ phiếu cân theo năm (Chốt sổ)" trong Hệ thống › Lưu trữ & Sao lưu; hàm máy chủ `HT_chotSoNam`, `HT_layThongKeNamPhieuCan`, `LT_locDongChuaLuuTru_` và 2 mục tương ứng trong `HAM_API_`. Phần Sao lưu tự động giữ nguyên.
- Giữ lại phần **đọc** sheet `PhieuCan_DN_<năm>` nếu trước đây từng tạo, để báo cáo / kiểm tra trùng khi import / tra cứu vẫn thấy dữ liệu đó. Không có sheet nào như vậy thì chỉ tốn 1 lệnh `getSheets()`.
- STUCK-01 không còn áp dụng (chức năng liên quan đã bỏ).
- Hệ quả cần biết: toàn bộ lịch sử phiếu cân nằm mãi trong `PhieuCan_DN`. Import (kiểm tra trùng) và Tính giá đọc toàn bộ sheet này, nên thời gian các thao tác đó sẽ tăng dần theo số năm dữ liệu; trần 10 triệu ô/file (~370.000 phiếu với 27 cột) áp dụng trực tiếp cho sheet này.
- Test: 204/204 đạt (bỏ 11 test của chức năng đã gỡ).
