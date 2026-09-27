# 06 — AutoFix Report (Phase 10)

Ràng buộc tuân thủ: không đổi nghiệp vụ · không đổi kết quả · không đổi cấu trúc Sheet / tên Sheet / tên cột · không đổi API `API(maPhien, tenHam, thamSo)` · không đổi tên hàm công khai · giữ tương thích với giao diện hiện có.

## Danh sách sửa

| # | Mã | File | Trước | Sau |
|---:|---|---|---|---|
| 1 | TRIGGER-01 | Code.gs | Trigger theo giờ tính giá lỗi mọi lần chạy (`PHIEN_HET_HAN`) | Trigger thật của dự án chạy được; gọi từ trình duyệt vẫn bắt buộc đăng nhập |
| 2 | REGRESS-01 | Code.gs | Bản sửa hiệu năng/chống kẹt bị ghi đè mất ở main | Áp lại lên code mới, giữ nguyên Cổng đăng nhập |
| 3 | STUCK-01 | Code.gs | Chốt sổ bị ngắt → trùng dữ liệu, báo cáo cộng đôi | Chạy lại tự hết trùng |
| 4 | STUCK-02 | Code.gs | Kho Dăm báo "Lock timeout" tiếng Anh | "Hệ thống đang bận…" |
| 5 | BUG-002 | Code.gs | Không cảnh báo lệch cột sheet Báo giá, Kho Dăm | Cảnh báo kèm thông báo thành công (không chặn); Admin xác nhận chuẩn mới được |
| 6 | PERF-01 | Code.gs | Mở trang đọc 17 cột toàn lịch sử | 12 cột + cache năm lưu trữ |
| 7 | PERF-02 | Code.gs | Dashboard đọc Sheet 2 lần | 1 lần |
| 8 | PERF-03 | Code.gs | Dò từng năm từ 2000 | Chỉ năm có sheet lưu trữ |
| 9 | PERF-04 | Code.gs | Tính giá 12 lệnh / khối | 4 lệnh / khối + 2 lệnh định dạng tổng |
| 10 | PERF-05 | Code.gs | Re-import 16 lệnh / phiếu | 2 lệnh / khối dòng + 3 lệnh định dạng tổng |
| 11 | PERF-06 | Code.gs | Draft 4 lệnh định dạng / dòng | 2 lệnh tổng |
| 12 | PERF-07 | Config.gs | 10 `getProperty` / mỗi lượt gọi máy chủ | 1 `getProperties` |
| 13 | PERF-08 | Index.html | Vẽ toàn bộ dòng + 1 listener / dòng | Vẽ 500 dòng + nút tải thêm; 1 listener ủy quyền |

## Thay đổi giao diện nhỏ (bắt buộc để hết treo)

Báo cáo nhiều hơn 500 dòng sẽ có một dòng cuối bảng:
`Đang hiển thị 500 / 100.000 dòng · [Hiển thị thêm 500] [Hiển thị thêm 5.000] · Muốn xem đầy đủ 100.000 dòng: dùng nút Xuất Excel`.
Khi còn ≤ 5.000 dòng, nút thứ hai đổi thành "Hiển thị tất cả". Ô tổng cộng, dòng TỔNG CỘNG cuối bảng, Xuất Excel/PDF không đổi.

## Không tự sửa (vi phạm ràng buộc hoặc cần quyết định)

| Mã | Lý do |
|---|---|
| ARCH-01 (trần 10 triệu ô/file) | Phải đổi nơi lưu dữ liệu lưu trữ → "không thay đổi database" |
| ARCH-02 (báo cáo không lọc ngày trả hết lịch sử) | Cần phân trang phía máy chủ → đổi API |
| SEC-03 (Chỉ xem gọi hàm dựng lại sheet) | Quyết định phân quyền của bạn |
| BUG-004 (2 người sửa cùng phiếu Kho Dăm) | Quyết định nghiệp vụ |
| Tách các hàm Import dài | Cần file Excel thật để test runtime (xem 05) |
