# 07 — Test Report (Phase 11)

Chạy: `npm test` (Jest). Môi trường: toàn bộ `Config.gs` + `Code.gs` nạp vào Node `vm`, mỗi lời gọi là 1 lượt thực thi mới (đúng mô hình Apps Script); SpreadsheetApp, DriveApp, CacheService, PropertiesService, LockService, ScriptApp, Utilities, HtmlService được giả lập có trạng thái. Hàm công khai được gọi **qua `API()` với phiên đăng nhập thật** như giao diện.

**Kết quả: 19 bộ test · 215 test · 215 đạt · 0 lỗi** (thời gian ~6 giây).

| Loại | Bộ test | Nội dung chính |
|---|---|---|
| Smoke | `smoke.test.js` | Nạp script không lỗi; các hàm cốt lõi tồn tại |
| Unit | `pureUtils.test.js` | `sanitize`, ngày/giờ, số theo vùng miền, cấu hình Misa |
| Security | `permission.test.js` (mới viết lại) | Vé HMAC hợp lệ / giả mạo / sửa nội dung / hết hạn / dùng lại; email Gmail dấu chấm & `+`; `doGet` chưa cài Cổng; chặn `</script>`; `API()` sai phiên, hàm ngoài whitelist, gọi vòng qua `google.script.run`; CHỈ XEM bị chặn 5 thao tác ghi; 13 hàm Admin-only; không lộ khóa Cổng |
| Security | `revocationRealtime.test.js` (viết lại) | 15 hàm ghi: người bị thu hồi bị chặn ngay, không chiếm khóa |
| Integration | `importConfirm`, `importBatch` (mới), `draftChuaTT` (mới), `priceEngine`, `archiving`, `reportArchiving`, `oldYearLookups`, `dashboard`, `priceStats`, `shareResources`, `optimizations`, `headerDriftAndLienKet`, `headerDriftModules` | Luồng nghiệp vụ đầu-cuối trên Sheet giả lập |
| Regression (golden) | `importBatch.test.js` | Re-import: mọi ô + mọi định dạng trùng ảnh chụp từ code trước tối ưu |
| Regression | `priceEngine.test.js` | Tính giá: giá trị + định dạng từng ô; trigger thật / giả |
| Stress / Fault | `stuckFlow.test.js` | Khóa bị giữ lâu (19 hàm trả "đang bận", không ghi, chờ ≤ 30 giây); Sheets timeout giữa lúc ghi (import, tính giá, chốt sổ, Kho Dăm): báo lỗi, luôn trả khóa, chạy lại cho kết quả đúng không trùng |
| Load / Performance | `loadPerformance.test.js` | 100.000 phiếu: ngưỡng ô đọc & lượt gọi cho danh sách lọc, Dashboard, báo cáo, tính giá (khóa kết quả tối ưu, chống thoái lui) |
| UI | Playwright + Chromium (script trong phiên kiểm tra, không nằm trong `npm test`) | Báo cáo 10.000 / 100.000 dòng: thời gian vẽ, số DOM, nút tải thêm, nút In phiếu qua listener ủy quyền |

## Kiểm chứng test có giá trị

Các test mới được chạy trên **code cũ** trước khi sửa để chắc chắn chúng bắt được lỗi:
- `draftChuaTT`: code cũ cho cùng dữ liệu nhưng 12 lệnh định dạng (test đòi 4) → fail đúng chỗ.
- `importBatch` (golden): đạt trên code cũ (vì golden tạo từ code cũ), phần đếm lệnh fail → chứng minh tối ưu giữ nguyên kết quả.
- `stuckFlow`, `loadPerformance`, `headerDriftModules`: 9 test fail trên code trước sửa.

## Giới hạn

- Không có test runtime trên Google thật (không có quyền chạy trên dự án Apps Script của bạn).
- Luồng đọc file Excel (chuyển đổi qua Drive API) chưa mô phỏng được.
- Giao diện: đã kiểm tra các báo cáo lớn; chưa có bộ test giao diện tự động cho toàn bộ màn hình.
