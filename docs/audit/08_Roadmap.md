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
| 8 | ARCH-01: phiếu cân đã khóa sổ (ĐNTT) ra **file Google Sheet riêng** mỗi năm (hiện cùng file Phiếu Cân → trần 10 triệu ô cho cả file) | Cần bạn — sửa ở cả ĐNTT và webapp này |
| 9 | ARCH-02: phân trang phía máy chủ cho báo cáo chi tiết (API mới, giữ API cũ) | Cần bạn |
| 10 | Bảng tổng hợp theo ngày cho Dashboard / báo cáo nhiều năm | Kỹ thuật |

## Dài hạn

| # | Việc |
|---|---|
| 11 | Chuyển dữ liệu giao dịch sang BigQuery / Cloud SQL khi vượt vài triệu dòng hoặc cần nhiều người ghi đồng thời |
| 12 | Tách `Index.html` thành nhiều file `include()` theo module; bảng hằng chỉ số cột (`COT_PC.MA_CT`…) |
| 13 | UX: chế độ tối, `aria-label`, phím tắt cho thao tác lặp (Lọc, Xuất Excel) |

## Cập nhật 27/09/2026 — Bỏ "Chốt sổ năm" ở đây, đồng bộ với Khóa sổ năm của ĐNTT

- Đã gỡ chức năng Chốt sổ của webapp này (giao diện + `HT_chotSoNam`, `HT_layThongKeNamPhieuCan`, `LT_locDongChuaLuuTru_`). Khóa sổ năm chỉ làm ở ĐNTT (repo `HAK_WEBAPP_DNTT_DRAFT`, Hệ Thống › Khóa Sổ Năm).
- ĐNTT chuyển phiếu cân **đã thanh toán** sang `PhieuCan_DN_<năm cân>` trong cùng file Phiếu Cân, chép nguyên 28 cột. Webapp này vẫn đọc các sheet đó (báo cáo theo năm, kiểm tra trùng khi import, nhập tay, danh sách lọc, tra mã báo giá) — đã kiểm chứng bằng dữ liệu dựng đúng như ĐNTT tạo.
- Vì ĐNTT chuyển phiếu đã trả ra khỏi `PhieuCan_DN` mỗi năm, sheet chính **không** phình mãi; cảnh báo "import/tính giá chậm dần theo số năm" ở bản trước là không đúng.
- **CONCUR-01**: trước khi ghi theo số dòng (cập nhật khi import lại, tính giá), đọc lại cột A + V của đúng các dòng đích; lệch (ĐNTT vừa xóa dòng) thì không ghi gì và báo thực hiện lại.
- **CONCUR-02**: khi ĐNTT khóa sổ chạy thật, file Phiếu Cân mang cờ Developer Metadata `HAK_KHOA_SO_NAM_DANG_CHAY` (ĐNTT v2026.9.7); webapp này thấy cờ (< 10 phút) thì tạm dừng import / nhập tay / tính giá (kể cả trigger).
- Quy trình: khóa sổ ở ĐNTT vào đầu tháng 1, ngoài giờ nhập liệu.
