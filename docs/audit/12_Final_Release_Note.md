# 12 — Final Release Note

**Phiên bản:** 27/09/2026 · nền: `main` 1635f56 (UPDATE27092026, Cổng đăng nhập Gmail)
**File cần dán vào Apps Script:** `Code.gs`, `Config.gs`, `Index.html` (`appsscript.json` không đổi)

## Có gì mới

**Sửa lỗi nghiêm trọng**
- Trigger tính giá theo giờ chạy lại được (trước đó lỗi mọi lần chạy từ khi có Cổng đăng nhập).
- Khôi phục các bản sửa hiệu năng và chống kẹt dữ liệu đã bị ghi đè mất ở commit 26/09.
- "Chốt sổ năm" bị ngắt giữa chừng: bấm chốt sổ lại sẽ tự hết trùng, báo cáo không còn cộng đôi.

**Nhanh hơn** (100.000 phiếu, đếm lượt gọi Google Sheets)
- Mở trang: 31 → 14 lượt, đọc 1,7 triệu → 120.000 ô.
- Dashboard: 23 → 8 lượt, đọc Sheet 1 lần thay vì 2.
- Tính giá: 2.419 → 812 lượt. Import 500 phiếu (có re-import): 3.270 → 961 lượt.
- Báo cáo lớn trên trình duyệt: 100.000 dòng hiện ngay trong 0,15 giây (trước treo ~26 giây).

**Thay đổi bạn sẽ thấy trên giao diện**
- Báo cáo nhiều hơn 500 dòng: hiện 500 dòng đầu, cuối bảng có nút "Hiển thị thêm 500" / "Hiển thị thêm 5.000" (hoặc "Hiển thị tất cả" khi còn ≤ 5.000). Ô tổng cộng, dòng TỔNG CỘNG, Xuất Excel/PDF vẫn tính đủ mọi dòng.
- Kho Dăm khi hệ thống đang bận: thông báo tiếng Việt thay vì "Lock timeout".
- Cảnh báo lệch cột nay có cả sheet Báo giá và Kho Dăm (chỉ cảnh báo, không chặn lưu).

## Không đổi
Nghiệp vụ, công thức tính giá, tên Sheet, tên/thứ tự cột, API `API(maPhien, tenHam, thamSo)`, tên hàm công khai, Cổng đăng nhập, phân quyền 3 vai trò.

## Kiểm thử
215/215 test tự động đạt (bao gồm test Cổng đăng nhập, thu hồi quyền, Chỉ xem, khóa bị giữ, Sheets timeout giữa chừng, tải 100.000 phiếu, ảnh chụp golden re-import). Báo cáo lớn kiểm tra trên Chromium. **Chưa chạy trên Google thật** — xem mục "Ngay" trong 08_Roadmap.md.

## Còn mở (cần bạn quyết định)
- Mục tiêu 500.000 dòng: vượt giới hạn 10 triệu ô/file của Google Sheets với cấu trúc hiện tại → cần chốt sổ ra file riêng mỗi năm (09_Architecture.md).
- Vai trò Chỉ xem đang được gọi 2 hàm dựng lại sheet Báo giá (SEC-03).
- 2 người sửa cùng phiếu Kho Dăm (BUG-004).
- Tách các hàm Import dài (cần file Excel mẫu thật để kiểm thử).

## Tương thích / Quay lui
Không đổi dữ liệu hay cấu trúc Sheet → quay lại bản trước chỉ cần dán lại 3 file cũ và deploy phiên bản mới.
