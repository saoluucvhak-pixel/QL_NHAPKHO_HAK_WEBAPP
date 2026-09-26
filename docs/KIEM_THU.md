# KẾ HOẠCH & DANH SÁCH KIỂM THỬ

## 1. Kiểm thử tự động (đã có — PASS 100%)
| Bộ | Lệnh | Số ca |
|---|---|---|
| Máy chủ / bảo mật / API / dữ liệu | `npm test` | 68 |
| Giao diện / vai trò / nhúng Portal | `npm run test:ui` | 38 |

Chi tiết từng ca: xem tên ca trong `tests/*.test.js` (mỗi `check('…')` là 1 ca).

## 2. Kiểm thử thủ công trên Google thật (chạy sau mỗi lần triển khai)

### Smoke (5 phút)
- [ ] Mở webapp → thấy màn đăng nhập, không thấy dữ liệu
- [ ] Đăng nhập Admin qua Cổng (cửa sổ bật lên tự đóng)
- [ ] Dashboard hiện số liệu
- [ ] 1 báo cáo tổng hợp → Xuất Excel → file tự tải về, mở được
- [ ] Đăng xuất → quay về màn đăng nhập

### Phân quyền
- [ ] Email không có trong danh sách → báo "chưa được cấp quyền", không vào được
- [ ] Nhân viên: không thấy Cấu hình/Người dùng/Lưu trữ
- [ ] Chỉ xem: không thấy Import, Nhập liệu, Nhập báo giá; xuất file được
- [ ] Xóa 1 nhân viên đang đăng nhập → thao tác kế tiếp của họ bị chặn ngay
- [ ] Mở lại link `?cong=…` cũ (đã dùng) → báo "đã được dùng"

### Nghiệp vụ (Positive / Negative / Boundary)
- [ ] Import 2 file phiếu cân cùng lúc → xem trước đủ 2 file; file lỗi báo riêng
- [ ] Import lại phiếu đã có → báo trùng, không nhân đôi
- [ ] Nhập tay: bỏ trống Số phiếu/Số xe → báo lỗi
- [ ] Đơn hàng xuất bán: KL = 0 hoặc độ khô = 0 → báo lỗi
- [ ] **Đồng thời**: 2 người mở danh sách đơn hàng; người A xóa đơn trên cùng; người B xóa đơn thứ 2 (chưa tải lại) → xóa ĐÚNG đơn B chọn
- [ ] Thêm đơn mới sau khi xóa 1 đơn ở giữa → STT không trùng
- [ ] Kỳ vét bãi: chỉ nút xóa kỳ mới nhất hoạt động
- [ ] Tên khách hàng `=1+1` → lưu & xuất Excel hiển thị đúng chữ `=1+1`
- [ ] Phiếu thuộc kỳ vét bãi cũ → không sửa/xóa được

### Trình duyệt / thiết bị
- [ ] Chrome, Edge (Windows); Safari (macOS); Chrome & Safari (Android/iOS)
- [ ] Nhúng trong Portal MAIN_HAK: đăng nhập không làm Portal chuyển trang
- [ ] Màn hình ≤ 820px: menu & bảng dùng được

### Hiệu năng (ghi lại thời gian)
- [ ] Báo cáo tổng hợp 1 tháng / 1 năm
- [ ] Import file 1.000 dòng
- [ ] Dashboard khi sheet chính > 10.000 dòng
