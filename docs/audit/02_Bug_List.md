# 02 — Bug List

Trạng thái: ✅ Đã sửa + có test · ⏸ Chưa sửa (cần quyết định nghiệp vụ / thay đổi kiến trúc) · ℹ️ Chấp nhận có chủ đích

| ID | Mức | Loại | Mô tả | Trạng thái |
|---|:-:|---|---|:-:|
| TRIGGER-01 | **Critical** | Logic | `runCalculatePrice()` và `runCalculatePrice_core()` gọi `yeuCauPhien_()` ngay dòng đầu. Trigger theo giờ (code ghi rõ hàm này dùng cho "trigger theo giờ") **không bao giờ có phiên đăng nhập**, nên mọi lần chạy đều lỗi `PHIEN_HET_HAN` và giá không được tính tự động. Phát hiện bằng phân tích đồ thị lời gọi từ các điểm vào không có phiên (`doGet`, trigger). | ✅ |
| REGRESS-01 | **Critical** | Quy trình | Commit `7c4ae3b` (26/09) ghi đè `Code.gs` bằng bản cũ, làm mất toàn bộ bản sửa PERF-01..04, STUCK-01/02, BUG-002 đã đưa lên main ở `64a3add`. | ✅ Áp lại |
| STUCK-01 | **Critical** | Toàn vẹn dữ liệu | "Chốt sổ năm" bị ngắt giữa chừng (timeout Sheets / quá 6 phút) → phiếu nằm ở CẢ sheet chính lẫn sheet lưu trữ → báo cáo cộng trùng; chạy lại còn chép trùng thêm. (Mất do REGRESS-01.) | ✅ → sau đó bỏ hẳn chức năng |
| PERF-05 | High | Hiệu năng | Re-import: mỗi phiếu cập nhật tốn 16 lệnh Sheets (8 `getRange` + 8 ghi) → file 300 phiếu sửa = 4.800 lệnh, dễ vượt 6 phút khi đang giữ khóa. | ✅ |
| PERF-01 | High | Hiệu năng | `getFilterOptions()` (mỗi lần mở trang) đọc 17 cột toàn bộ lịch sử: 1,7 triệu ô với 100.000 phiếu. | ✅ |
| PERF-08 | High | Giao diện | 5 báo cáo vẽ toàn bộ dòng vào DOM: 100.000 dòng → tab treo 25,7 giây, 1,4 triệu phần tử DOM, 100.000 listener. | ✅ |
| PERF-04 | Medium | Hiệu năng | Tính giá: 12 lệnh cho mỗi khối dòng chờ tính giá. | ✅ |
| PERF-02 | Medium | Hiệu năng | Dashboard đọc sheet phiếu cân 2 lần. | ✅ |
| PERF-03 | Medium | Hiệu năng | Báo cáo chỉ nhập "Đến ngày" dò `getSheetByName` từng năm từ 2000. | ✅ |
| PERF-06 | Low | Hiệu năng | Draft "Chưa thanh toán": 4 lệnh định dạng/dòng ghi đè. | ✅ |
| PERF-07 | Low | Hiệu năng | `apDungOverrideLienKet_()` chạy ở MỌI lượt gọi máy chủ, đọc 10 thuộc tính riêng lẻ. | ✅ |
| STUCK-02 | Low | UX | Kho Dăm khi khóa bị giữ hiện lỗi tiếng Anh "Lock timeout…". | ✅ |
| BUG-002 | Medium | Toàn vẹn dữ liệu | Cảnh báo lệch cột chưa có cho sheet Báo giá & Kho Dăm. | ✅ |
| ARCH-01 | **Critical (với mục tiêu 500.000 dòng)** | Kiến trúc | Google Sheets giới hạn **10 triệu ô / 1 file**. `PhieuCan_DN` 27 cột, và các sheet lưu trữ năm nằm **cùng file** → trần lý thuyết ~370.000 phiếu cho cả file (chưa tính sheet khác). 500.000 dòng **không thể** lưu trong cấu trúc hiện tại. | ⏸ Cần đổi nơi lưu trữ (xem 09_Architecture.md) |
| ARCH-02 | High | Hiệu năng | Báo cáo tổng hợp không lọc ngày trả về toàn bộ lịch sử (~34 MB JSON với 100.000 phiếu). Giao diện đã hết treo (PERF-08) nhưng máy chủ vẫn phải đọc + gửi hết; ở quy mô 500.000 có nguy cơ vượt giới hạn bộ nhớ/thời gian Apps Script. Sửa triệt để cần đổi API (phân trang) — ngoài phạm vi "không đổi API". | ⏸ |
| SEC-03 | Medium | Phân quyền | Vai trò CHỈ XEM được phép gọi `BG_updateHieuLuc` / `BG_showAllData`. Hai hàm này **xóa và ghi lại** sheet dẫn xuất (`Baogia_DN_FINAL`, `Baogia_DN_SAVE`) và chiếm Script Lock. Dữ liệu gốc không đổi, nhưng người Chỉ xem có thể làm người khác phải chờ khóa. | ⏸ Theo thiết kế của bạn — cần xác nhận |
| BUG-004 | Medium | Đồng thời | 2 người sửa cùng 1 phiếu Kho Dăm: người lưu sau ghi đè người trước (không kiểm tra phiên bản). | ⏸ Chờ xác nhận nghiệp vụ |
| SEC-01 | Medium | Clickjacking | `XFrameOptionsMode.ALLOWALL` cho phép mọi trang nhúng webapp. | ℹ️ Cần cho Portal MAIN_HAK |

## Chi tiết cách sửa các lỗi Critical

**TRIGGER-01** — `runCalculatePrice(e)` nhận diện lượt chạy do trigger THẬT của dự án: `e.triggerUid` phải khớp một trigger trong `ScriptApp.getProjectTriggers()` (đúng cơ chế `TRIGGER_saoLuuHangDem` đang dùng). Khi đó hàm chạy với phiên hệ thống `trigger-tu-dong`. Trình duyệt tự bịa `triggerUid` vẫn bị chặn (có test).

**STUCK-01** — Trước khi chép sang sheet lưu trữ, bỏ qua phiếu có Mã chứng từ (cột V) đã có sẵn trong lưu trữ, nhưng vẫn xóa khỏi sheet chính. Chạy lại "Chốt sổ" sau sự cố sẽ tự hết trùng (có test mô phỏng lỗi ở lần `deleteRows` thứ 3).

## Cập nhật 27/09/2026 — Bỏ "Chốt sổ năm" ở đây, đồng bộ với Khóa sổ năm của ĐNTT

- Đã gỡ chức năng Chốt sổ của webapp này (giao diện + `HT_chotSoNam`, `HT_layThongKeNamPhieuCan`, `LT_locDongChuaLuuTru_`). Khóa sổ năm chỉ làm ở ĐNTT (repo `HAK_WEBAPP_DNTT_DRAFT`, Hệ Thống › Khóa Sổ Năm).
- ĐNTT chuyển phiếu cân **đã thanh toán** sang `PhieuCan_DN_<năm cân>` trong cùng file Phiếu Cân, chép nguyên 28 cột. Webapp này vẫn đọc các sheet đó (báo cáo theo năm, kiểm tra trùng khi import, nhập tay, danh sách lọc, tra mã báo giá) — đã kiểm chứng bằng dữ liệu dựng đúng như ĐNTT tạo.
- Vì ĐNTT chuyển phiếu đã trả ra khỏi `PhieuCan_DN` mỗi năm, sheet chính **không** phình mãi; cảnh báo "import/tính giá chậm dần theo số năm" ở bản trước là không đúng.
- **CONCUR-01**: trước khi ghi theo số dòng (cập nhật khi import lại, tính giá), đọc lại cột A + V của đúng các dòng đích; lệch (ĐNTT vừa xóa dòng) thì không ghi gì và báo thực hiện lại.
- **CONCUR-02**: khi ĐNTT khóa sổ chạy thật, file Phiếu Cân mang cờ Developer Metadata `HAK_KHOA_SO_NAM_DANG_CHAY` (ĐNTT v2026.9.7); webapp này thấy cờ (< 10 phút) thì tạm dừng import / nhập tay / tính giá (kể cả trigger).
- Quy trình: khóa sổ ở ĐNTT vào đầu tháng 1, ngoài giờ nhập liệu.
