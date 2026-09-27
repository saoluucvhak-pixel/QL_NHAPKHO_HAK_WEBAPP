# 11 — Benchmark (Before / After)

- **Before** = nhánh `main` commit `1635f56` (UPDATE27092026).
- **After** = nhánh `claude/code-review-completion-tj3uml` (bản phát hành này).
- Máy chủ: môi trường giả lập Apps Script, đếm lượt gọi + ô đọc/ghi. Giao diện: Chromium headless.
- Chưa đo trên Google thật; thời gian ms của máy chủ trong môi trường giả lập không phản ánh Apps Script nên không đưa vào.

## Máy chủ — 10.000 phiếu (2.000 đang hoạt động + 2 năm lưu trữ)

| Luồng | Lượt gọi Before | After | Ô đọc Before | After |
|---|---:|---:|---:|---:|
| Mở trang: danh sách lọc (lần 1) | 25 | 16 | 170.000 | 120.000 |
| Mở trang: danh sách lọc (lần 2+) | 25 | 12 | 170.000 | 24.000 |
| Dashboard | 23 | 8 | 108.000 | 54.000 |
| Báo cáo chỉ nhập "Đến ngày" | 46 | 12 | 270.000 | 270.000 |
| Tính giá | 499 | 172 | 53.407 | 53.407 |
| Import 500 phiếu (250 cập nhật) | 704 | 235 | 117.931 | 117.931 |

## Máy chủ — 100.000 phiếu (10.000 đang hoạt động + 4 năm lưu trữ)

| Luồng | Lượt gọi Before | After | Thay đổi | Ô đọc Before | After |
|---|---:|---:|:-:|---:|---:|
| Mở trang: danh sách lọc (lần 1) | 31 | 22 | −29% | 1.700.000 | 1.200.000 |
| Mở trang: danh sách lọc (lần 2+) | 31 | 14 | −55% | 1.700.000 | **120.000** (−93%) |
| Dashboard | 23 | 8 | −65% | 540.000 | 270.000 |
| Báo cáo chỉ nhập "Đến ngày" | 50 | 18 | −64% | 2.700.000 | 2.700.000 |
| Tính giá | 2.419 | 812 | −66% | 261.407 | 261.407 |
| Import 500 phiếu (250 cập nhật) | 3.270 | 961 | −71% | 607.931 | 607.931 |

Ô ghi: không đổi, trừ Import +200 ô (ghi 1 khối liền B..S thay vì 6 mảnh).

## Giao diện — Báo cáo tổng hợp cân

| Số dòng | Thời gian Before | After | Phần tử DOM Before | After | Listener Before | After |
|---:|---:|---:|---:|---:|---:|---:|
| 10.000 | 2.463 ms | 129 ms | 141.516 | 8.521 | 10.000 | 1 |
| 100.000 | 25.715 ms | 150 ms | 1.401.515 | 8.521 | 100.000 | 1 |

## Mã nguồn

| Chỉ số | Before | After |
|---|---:|---:|
| Tổng dòng (Code + Config + Index) | 11.452 | 11.662 |
| Số hàm | 338 | 348 (thêm 10 helper nhỏ) |
| Hàm > 80 dòng | 11 | 11 |
| Hàm CC > 20 | 24 | 24 |
| Lệnh Sheets/Drive nằm trong vòng lặp | 85 | 55 (0 lệnh tăng theo số dòng) |
| Listener gắn cho từng dòng của bảng lớn | 2 vị trí (Tổng hợp, Misa) | 0 (1 listener ủy quyền) |
| Test tự động | 199 (viết cho mô hình đăng nhập cũ — 170 fail trên code main) | 215 (đạt 100%) |

Số hàm dài/phức tạp giữ nguyên (các hàm bị dài thêm do bản sửa đã được tách helper để không vượt ngưỡng); chưa giảm vì đợt này ưu tiên hiệu năng và an toàn dữ liệu mà không đổi kết quả (xem 05_Refactor_Report.md).
