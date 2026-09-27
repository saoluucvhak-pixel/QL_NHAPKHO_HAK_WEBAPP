# 05 — Refactor Report

Nguyên tắc đợt này: **không đổi nghiệp vụ, kết quả, cấu trúc Sheet, API hay tên hàm công khai**. Mỗi thay đổi đều có test chứng minh kết quả y hệt trước khi sửa.

## Đã refactor

| Mã | Hàm | Thay đổi | Chứng minh không đổi kết quả |
|---|---|---|---|
| PERF-05 | `step1_ConfirmImport` | Tách phần ghi phiếu cập nhật sang helper mới `ghiCapNhatPhieuCanGop_` (gom khối dòng liền nhau + RangeList định dạng). Vòng lặp chính chỉ còn gom dữ liệu. | Ảnh chụp golden `test/importBatch.golden.json` (mọi ô + mọi định dạng số) tạo từ code cũ |
| PERF-06 | `ghiVaoDraftChuaTT_` | Định dạng Ngày/Giờ gom vào 2 RangeList | Test chạy trên code cũ và mới: cùng dữ liệu, cùng định dạng, chỉ khác số lệnh (12 → 4) |
| PERF-04 | `runCalculatePrice_core` | Ghi X..Z chung 1 lệnh, định dạng gom RangeList | Test giá trị + định dạng từng ô |
| PERF-01 | `getFilterOptions` | Tách `FO_gomGiaTriLoc_`, `FO_giaTriLocNamLuuTru_` (đọc 12 cột, cache năm lưu trữ) | Test: dropdown y hệt giữa lần đọc Sheet và lần lấy từ cache |
| PERF-02 | `HT_layDashboard` | Lọc "Hôm nay" từ dữ liệu tháng đã đọc | Test Dashboard hiện có |
| PERF-07 | `apDungOverrideLienKet_`, `HT_layLienKetDuLieu` | 1 lần `getProperties()` | Test Liên kết dữ liệu hiện có |
| PERF-08 | 5 hàm render báo cáo (giao diện) | Helper chung `veBangTheoLo` + 1 listener ủy quyền | Chromium: nội dung dòng, tổng cộng, nút In phiếu hoạt động (dòng thứ 6.000 in đúng mã) |
| TRIGGER-01 | `runCalculatePrice` | Thêm `laLuotChayTriggerThat_`, `PHIEN_HE_THONG_TRIGGER_` | Test trigger thật chạy được / trigger giả bị chặn |

## Chưa refactor (có chủ đích) — đề xuất cho đợt sau

| Hạng mục | Đề xuất | Vì sao chưa làm ngay |
|---|---|---|
| `step1_PreviewDraft` (201 dòng, CC 55) & `XH_step1_PreviewDraft` (159 dòng, CC 76) | Tách: `docFileExcel_` (chuyển đổi Drive) → `chuanHoaDong_` (ngày/số theo vùng miền) → `doiSoatTrung_` → `taoBanXemTruoc_`; gộp phần chung của 2 luồng Import thành 1 bộ khung nhận "bản đồ cột" | Hai hàm phụ thuộc chuyển đổi file Excel qua Drive API — môi trường test cục bộ không mô phỏng được. Tách lớn mà không có test runtime trên file Excel thật là rủi ro sai số liệu. Cần bộ file Excel mẫu thật từ bạn. |
| `layBaoCaoTonKho`, `xuLySuaXoaGiaoDich` (CC ~50) | Tách tính toán thuần (tồn đầu/nhập/xuất/tồn cuối) khỏi phần đọc Sheet | Module Kho Dăm chưa có test nghiệp vụ; cần viết test trước khi tách |
| Chỉ số cột dạng số (`row[21]`) | Bảng hằng `COT_PC = { SO_PHIEU:0, NGAY_CAN1:1, …, MA_CT:21 }` | Thay hàng trăm vị trí — nên làm theo từng module kèm test |
| Chuỗi thông báo lặp ("Hệ thống đang bận…") | Hằng `TB_DANG_BAN_` | Thấp ưu tiên |
| `badgeClass` lặp ở 3 bảng giao diện | Hàm `lopTrangThai_(tt)` | Thấp ưu tiên |
