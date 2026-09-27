# 10 — Optimization Report (Phase 4–7, 9)

## Phase 4 — Bộ nhớ

| Kiểm tra | Kết quả |
|---|---|
| Memory leak / Event leak | Không có. Listener ở cấp ngoài chạy 1 lần khi tải trang. Listener trong hàm render gắn vào phần tử **vừa tạo** (phần tử cũ bị `innerHTML` thay thế và được thu gom). Các bảng lớn nay dùng 1 listener ủy quyền. |
| Detached DOM | Không thấy tham chiếu giữ phần tử đã bị gỡ. |
| Large array | Máy chủ: `getBaoCaoTongHop` dựng mảng đối tượng cho toàn bộ kết quả lọc (không đổi được nếu không đổi API — ARCH-02). Giao diện: vẫn giữ mảng dữ liệu trong bộ nhớ, nhưng DOM giảm từ 1,4 triệu còn 8.500 phần tử ở 100.000 dòng. |
| Closure / GC pressure | 100.000 closure listener/lần vẽ → 0 (ủy quyền). |
| Global cache | `PHIEN_HIEN_TAI_` gán lại mỗi lượt thực thi; không có cache toàn cục sống lâu phía máy chủ (Apps Script khởi tạo lại mỗi lượt). |

## Phase 5 — Google Apps Script

| Dịch vụ | Đánh giá / Đã làm |
|---|---|
| SpreadsheetApp / Range | Đọc theo khối (`getValues` 1 lần), ghi theo khối liền nhau; định dạng số gom bằng `getRangeList` |
| LockService | Script Lock, chờ tối đa 30 giây, luôn `releaseLock` trong `finally`; kiểm tra quyền **trước** khi chờ khóa |
| CacheService | Phiên đăng nhập, danh sách kho (5 phút), giá trị lọc năm lưu trữ (6 giờ, khóa theo số dòng) |
| PropertiesService | Đọc 1 lần/lượt (`getProperties`) |
| Drive / UrlFetch | Theo số file (có giới hạn) |
| Utilities / Session | Hợp lệ |
| Logger / console.log | Chỉ ở hàm cài đặt Cổng chạy tay |
| Trigger | Sao lưu hằng đêm (xác thực `triggerUid`); tính giá theo giờ đã sửa (TRIGGER-01) |
| Execution timeout | Luồng dài nhất còn lại: báo cáo không lọc ngày (ARCH-02), chốt sổ năm lớn (nay chạy lại an toàn nếu bị ngắt) |
| Hash Map / Lookup table | Import dùng `Map` theo Mã chứng từ (O(1)); tính giá lọc báo giá theo mã. |

## Phase 6 — Google Sheet như cơ sở dữ liệu

| Mục | Hiện trạng |
|---|---|
| Primary key | Mã chứng từ (cột V) — duy nhất, kiểm tra trùng cả trong sheet chính lẫn lưu trữ khi import |
| Index | Không có index thật; dựng `Map` trong bộ nhớ mỗi lượt import (đủ nhanh tới vài trăm nghìn dòng) |
| Phân vùng dữ liệu | Theo năm (Chốt sổ). Đề xuất tách ra file riêng (09_Architecture.md) |
| Toàn vẹn | Khóa ghi, cảnh báo lệch cột (5 module), chốt sổ chạy lại an toàn, `sanitize()` chống công thức |
| Chuẩn hóa | Danh mục mã báo giá / mã KL / kho tách sheet riêng — hợp lý |
| Trùng lặp | Chặn theo Mã chứng từ; Draft "Chưa thanh toán" ghi đè theo mã |

## Phase 7 — Giao diện

| Mục | Đã làm / Nhận xét |
|---|---|
| Bảng lớn | Vẽ theo lô 500 dòng + nút tải thêm (5 báo cáo). Kho Dăm có phân trang sẵn. |
| Event delegation | 1 listener cho mọi bảng lớn + nút In phiếu |
| Document fragment / template | Dùng chuỗi HTML + `insertAdjacentHTML` 1 lần/lô (tương đương fragment) |
| Loading / Toast / Overlay | Có sẵn, nhất quán |
| Virtual table / Infinite scroll | Không cần sau khi giới hạn DOM ~500–6.000 dòng; có thể thêm sau nếu muốn cuộn vô hạn |

## Phase 9 — UX (nhận xét, không sửa trong đợt này)

- Luồng công việc rõ theo menu nghiệp vụ; nút có biểu tượng + chữ.
- Có overlay "Đang xử lý…" và toast báo lỗi/thành công ở mọi thao tác máy chủ.
- Chưa có chế độ tối (Dark mode) và phím tắt.
- Khả năng tiếp cận: nhiều nút chỉ có biểu tượng + chữ ngắn, chưa có `aria-label`; bảng lớn nên có tiêu đề cột cố định khi cuộn (đã có với dòng TỔNG CỘNG).
- Di động: có `viewport`; bảng rộng cuộn ngang được. Chưa kiểm tra kỹ trên màn hình điện thoại.
