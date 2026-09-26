# CHANGELOG

## 2.0.0 — 26/09/2026

### Bảo mật & phân quyền
- Cổng đăng nhập Gmail (dự án Apps Script riêng) thay đăng nhập OAuth: vé HMAC-SHA256, hạn 5 phút, dùng 1 lần; phiên 12 giờ; thu hồi quyền có hiệu lực ngay.
- Webapp chạy bằng quyền Admin (`USER_DEPLOYING`): nhân viên không cần quyền Sheet/Drive.
- Vai trò mới **Chỉ xem** (chặn ở máy chủ + ẩn giao diện).
- `API()` chỉ cho gọi các hàm trong danh sách tường minh `HAM_API_` — chặn gọi thẳng hàm nội bộ để bỏ qua khóa ghi/nhật ký.
- Chống Formula/CSV Injection khi xuất Excel/PDF và khi ghi nhật ký.
- Vá XSS ở các bảng hiển thị.
- Trang quản trị Cổng: lưu link, sao chép mã nguồn, đổi khóa bí mật.

### Sửa lỗi dữ liệu
- Sửa/Xóa đơn hàng xuất bán xác định đúng đơn theo STT (trước đây có thể xóa nhầm khi người khác vừa xóa đơn phía trên).
- STT đơn hàng mới không còn bị trùng sau khi xóa.
- Chỉ xóa được kỳ vét bãi mới nhất, không thể xóa nhầm dòng tiêu đề / kỳ đã khóa sổ.
- Nhật ký Audit ghi nguyên tử (không mất dòng khi 2 người thao tác cùng lúc), cắt nội dung quá dài.
- Import nhiều file cùng lúc xử lý đủ tất cả file.
- Sửa phiếu kho dăm đã bị xóa không còn âm thầm tạo phiếu trùng.

### Tính năng & trải nghiệm
- Đăng nhập bằng cửa sổ bật lên — dùng được khi nhúng trong Portal MAIN_HAK.
- Xuất Excel/PDF tải thẳng về máy (không cần quyền Drive).
- Ghi email người thực hiện vào nhật ký.

### Hiệu năng
- Xóa báo giá gom các dòng liền nhau thành 1 lệnh (tiện ích dùng chung `xoaCacDong_`).

### Kỹ thuật
- Bộ kiểm thử tự động: 68 ca máy chủ + 38 ca giao diện (`npm test`, `npm run test:ui`).
- Tài liệu: báo cáo đánh giá, hướng dẫn triển khai / sử dụng / lập trình, kế hoạch kiểm thử.
- Xóa mã chết.
