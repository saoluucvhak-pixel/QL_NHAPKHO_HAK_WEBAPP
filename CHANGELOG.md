# CHANGELOG

## 2.2.0 — 27/09/2026

### Thay đổi
- **Gỡ chức năng "Chốt sổ năm"** của webapp kho. Lưu trữ phiếu cân năm cũ nay do **webapp ĐNTT › Hệ Thống › Khóa Sổ Năm** đảm nhận (chuyển phiếu **đã trả** theo hồ sơ thanh toán; phiếu chưa trả ở lại làm công nợ). Lý do: 2 công cụ cùng chuyển dòng trên 1 sheet `PhieuCan_DN` theo 2 tiêu chí khác nhau ("OK" và "đã trả") — phiếu "OK" nhưng thanh toán năm sau bị webapp kho chuyển sớm thì báo cáo năm đang mở của ĐNTT không còn thấy phiếu đó.
- Webapp kho **vẫn đọc** các sheet `PhieuCan_DN_<năm>` (cùng tên, cùng thứ tự cột với ĐNTT) cho báo cáo và chặn nhập trùng phiếu đã lưu trữ.
- Tab "Lưu trữ & Sao lưu" đổi tên thành **"Sao lưu dữ liệu"**, kèm ghi chú về Khóa Sổ Năm bên ĐNTT.

### An toàn dữ liệu khi chạy song song với ĐNTT
- **Import phiếu cân**: trước khi cập nhật 1 phiếu đã có, xác định lại đúng dòng theo Mã chứng từ; phiếu vừa được chuyển sang lưu trữ hoặc vừa khóa "OK" thì bỏ qua, không ghi đè.
- **Tính giá**: nếu vị trí dòng thay đổi trong lúc tính (VD ĐNTT đang Khóa sổ năm) thì dừng, không ghi giá/trạng thái sang phiếu khác, báo người dùng chạy lại.

### Kiểm thử
- 100 ca máy chủ + 46 ca giao diện, PASS 100%.

## 2.1.0 — 26/09/2026

### Tính năng mới (chỉ Quản trị)
- **Sao lưu tự động** (Hệ thống › Lưu trữ & Sao lưu): sao chép nguyên bản mọi Google Sheet của hệ thống vào thư mục "HAK - Sao lưu dữ liệu hệ thống" hằng đêm 1–2 giờ sáng hoặc bấm "Sao lưu ngay"; giữ N bản gần nhất (mặc định 30), bản cũ vào Thùng rác Drive; hiện kết quả lần gần nhất & lỗi từng file; hướng dẫn khôi phục qua Liên kết dữ liệu.
- **Nhật ký hoạt động** (Hệ thống › Nhật ký hoạt động): lọc theo khoảng ngày, người thực hiện, hành động, trạng thái, từ khóa; phân trang 50 dòng; xuất Excel. Đọc sheet Audit từ dưới lên theo khối nên nhanh cả khi nhật ký rất lớn.

### Cải tiến
- Sheet "Audit" tự tạo nếu chưa có (trước đây thiếu sheet thì không ghi nhật ký gì).
- Thêm quyền `script.scriptapp` (tạo lịch chạy tự động) — **Admin cần cấp quyền lại 1 lần** khi cập nhật (xem Hướng dẫn triển khai).

### Kiểm thử
- 90 ca máy chủ + 46 ca giao diện, PASS 100%.

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
