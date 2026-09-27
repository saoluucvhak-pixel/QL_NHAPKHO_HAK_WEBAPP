# 08 — Roadmap

Sắp theo mức rủi ro nếu không làm. "Cần bạn" = cần quyết định nghiệp vụ / phân quyền / dữ liệu trước khi code.

## Ngay (tuần này)

| # | Việc | Ai quyết | Ghi chú |
|---|---|---|---|
| 1 | Dán `Code.gs`, `Config.gs`, `Index.html` mới vào Apps Script, **Deploy → Manage deployments → Edit → New version** | Bạn | `appsscript.json` không đổi |
| 2 | Kiểm tra trigger tính giá theo giờ (Triggers ở menu trái Apps Script): nếu có trigger gọi `runCalculatePrice`, xem "Executions" để xác nhận từ nay chạy thành công | Bạn | TRIGGER-01 |
| 3 | Chạy thử 1 lần import thật + re-import file đã sửa, đối chiếu 3–5 phiếu | Bạn | Xác nhận PERF-05 trên dữ liệu thật |

## Ngắn hạn (1–4 tuần)

| # | Việc | Ai quyết |
|---|---|---|
| 4 | SEC-03: tách "xem báo giá đang hiệu lực" (chỉ đọc) khỏi "dựng lại sheet FINAL/SAVE" (ghi, chiếm khóa); vai trò Chỉ xem chỉ được phần đọc | Cần bạn |
| 5 | BUG-004: kiểm tra phiên bản khi sửa phiếu Kho Dăm (báo "phiếu đã bị người khác sửa, tải lại") | Cần bạn |
| 6 | Tách `step1_PreviewDraft` / `XH_step1_PreviewDraft` thành các bước nhỏ + bộ test với 5–10 file Excel mẫu thật | Cần file mẫu |
| 7 | Viết test nghiệp vụ Kho Dăm (tồn kho, kỳ vét bãi) rồi tách `layBaoCaoTonKho`, `xuLySuaXoaGiaoDich` | Kỹ thuật |

## Trung hạn (1–3 tháng) — để vượt ~300.000 phiếu

| # | Việc | Ai quyết |
|---|---|---|
| 8 | ARCH-01: chốt sổ năm ra **file Google Sheet riêng** mỗi năm (hiện cùng file → trần 10 triệu ô) | Cần bạn (đổi nơi lưu dữ liệu) |
| 9 | ARCH-02: phân trang phía máy chủ cho báo cáo chi tiết (API mới, giữ API cũ) | Cần bạn |
| 10 | Bảng tổng hợp theo ngày cho Dashboard / báo cáo nhiều năm | Kỹ thuật |

## Dài hạn

| # | Việc |
|---|---|
| 11 | Chuyển dữ liệu giao dịch sang BigQuery / Cloud SQL khi vượt vài triệu dòng hoặc cần nhiều người ghi đồng thời |
| 12 | Tách `Index.html` thành nhiều file `include()` theo module; bảng hằng chỉ số cột (`COT_PC.MA_CT`…) |
| 13 | UX: chế độ tối, `aria-label`, phím tắt cho thao tác lặp (Lọc, Xuất Excel) |
