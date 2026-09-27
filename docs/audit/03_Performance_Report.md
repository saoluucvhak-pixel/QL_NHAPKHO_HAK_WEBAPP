# 03 — Performance Report (Phase 3)

## Cách đo

Trên Apps Script, thứ làm webapp chậm là **số lượt gọi dịch vụ Google** (mỗi lượt là một vòng mạng tới máy chủ Sheets/Drive) và **số ô đọc/ghi**, không phải CPU. Vì vậy:

- **Máy chủ**: chạy nguyên `Config.gs` + `Code.gs` trong môi trường giả lập (`test/gasEnv.js`), đếm từng lượt gọi `getRange / getValues / setValues / setNumberFormat / getSheetByName / openById / getProperty…` và số ô. Dữ liệu giả lập: 10.000 và 100.000 phiếu (sheet đang hoạt động + 2–4 năm lưu trữ), 2% phiếu chờ tính giá rải rác.
- **Giao diện**: mở `Index.html` thật trong Chromium headless (Playwright), giả lập máy chủ trả 10.000 / 100.000 dòng báo cáo, đo thời gian từ lúc bấm "Lọc" đến khi vẽ xong khung hình, và số phần tử DOM.
- **Chưa đo trên Google thật** — thời gian tuyệt đối trên Apps Script phụ thuộc hạ tầng Google. Tỉ lệ giảm lượt gọi là thước đo đáng tin.

## Kết quả máy chủ — 100.000 phiếu (trước = `main` 1635f56, sau = bản này)

| Luồng | Lượt gọi Sheets | Ô đọc | Ô ghi |
|---|---|---|---|
| Mở trang: danh sách lọc (lần đầu) | 31 → **22** | 1.700.000 → **1.200.000** | – |
| Mở trang: danh sách lọc (từ lần 2) | 31 → **14** | 1.700.000 → **120.000** (−93%) | – |
| Dashboard | 23 → **8** | 540.000 → **270.000** | – |
| Báo cáo chỉ nhập "Đến ngày" | 50 → **18** | 2.700.000 (không đổi — đúng phạm vi yêu cầu) | – |
| Tính giá (200 phiếu chờ rải rác) | 2.419 → **812** (−66%) | 261.407 | 800 |
| Import 500 phiếu (250 cập nhật + 250 mới) | 3.270 → **961** (−71%) | 607.931 | 8.260 → 8.460 |

Kết quả 10.000 phiếu có cùng xu hướng (Import: 704 → 235 lượt; Tính giá: 499 → 172). Import ghi thêm ~200 ô vì mỗi phiếu cập nhật ghi 1 khối liền B..S (gồm 4 ô G, M, P, R được ghi lại đúng giá trị vừa đọc) thay vì 6 mảnh rời.

## Kết quả giao diện — Báo cáo tổng hợp cân (Chromium)

| Số dòng | Trước | Sau |
|---|---|---|
| 10.000 | 2.463 ms · 141.516 phần tử DOM | **129 ms** · 8.521 phần tử |
| 100.000 | **25.715 ms (treo tab)** · 1.401.515 phần tử | **150 ms** · 8.521 phần tử |
| + "Hiển thị thêm 5.000" | – | 1.371 ms |

Tổng cộng / Xuất Excel / Xuất PDF vẫn tính trên toàn bộ dữ liệu.

## Checklist Phase 3

| Câu hỏi | Kết quả |
|---|---|
| Đọc Sheet nhiều lần? | Đã bỏ: Dashboard (2→1), danh sách lọc (cache năm lưu trữ). |
| Ghi từng dòng? / `setValue` trong loop? | Đã bỏ ở luồng dữ liệu lớn (Import, Tính giá, Draft). Còn lại đều có giới hạn cố định — xem bảng dưới. |
| `getRange` / `appendRow` trong loop? | `appendRow` trong loop: 0. `getRange` trong loop: chỉ còn loại có giới hạn. |
| `SpreadsheetApp.flush` dư? | 1 lần duy nhất, ở luồng xuất PDF (bắt buộc trước khi xuất) — hợp lệ. |
| `UrlFetch` nhiều lần? | 1 lần / lượt xuất file (tải file tạm để gửi về trình duyệt). |
| `DriveApp` nhiều lần? | Theo số tài nguyên được chia sẻ/sao lưu (≈10) — hợp lệ. |
| JSON parse/stringify dư? | Không đáng kể (chỉ phiên đăng nhập, danh sách quyền). |
| Query DOM nhiều lần / listener lặp? | Đã thay listener từng dòng bằng 1 listener ủy quyền cho các bảng lớn. |
| Render toàn bộ bảng / virtual scroll / pagination? | Đã có vẽ theo lô 500 dòng + nút tải thêm (5 báo cáo lớn). Kho Dăm đã có phân trang sẵn. |
| Cache / memoization? | CacheService: danh sách kho (5 phút), giá trị lọc năm lưu trữ (6 giờ), phiên đăng nhập. |
| Debounce / throttle? | Ô lọc mã báo giá lọc trên dữ liệu đã tải (không gọi máy chủ) — không cần debounce. |

## Lệnh Sheets còn nằm trong vòng lặp (tất cả đều có giới hạn)

| Hàm | Vì sao chấp nhận |
|---|---|
| `step1_PreviewDraft`, `XH_step1_PreviewDraft` | 1 lượt / file Excel người dùng tải lên |
| `LT_docPhieuCanGopLuuTru_`, `LT_bosungMaChungTuDaLuuTru_`, `getFilterOptions` | 1 lượt / năm đã lưu trữ |
| `ghiCapNhatPhieuCanGop_`, `runCalculatePrice_core` | 1 lượt / **khối dòng liền nhau** (không phải / dòng) |
| `ghiVaoDraftChuaTT_` | 1 lượt / dòng Draft trùng mã (hiếm; định dạng đã gom) |
| `xoaCacDong_` | 1 lượt / khối dòng cần xóa |
| `NK_loc_` | Đọc Nhật ký theo khối từ cuối lên, dừng sớm — mẫu tối ưu có chủ đích |
| `exportPhieuCanPDF` | 4 dòng thông tin cố định trên phiếu PDF |
| `BG_deleteMaBaoGia`, `BG_deleteMaKL`, `xuLyDanhMucKho` | Tìm thấy → xóa/sửa 1 lần → thoát |
| `SL_thucHienSaoLuu_`, các hàm chia sẻ Drive (`Config.gs`) | 1 lượt / tài nguyên (~10) |

Số lệnh I/O nằm trong vòng lặp (so với main): **85 → 55**, và 0 lệnh còn lại tăng theo số dòng dữ liệu.
