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

## Cập nhật 27/09/2026 — DRAFT-01 (bản sao phiếu chưa thanh toán của ĐNTT)
- Ô "Đồng thời lưu… vào Draft Chưa Thanh Toán" khi import ghi phiếu mới vào sheet `PhieuCan_DN_CHUA_TT_DRAFT` trong **File Nháp của ĐNTT** (địa chỉ đặt ở Liên kết dữ liệu) — đây là bản sao ĐNTT dùng để chọn phiếu thanh toán.
- **Lỗi (High):** trước đây phiếu được ghi vào bản sao **trước** khi tính giá và chỉ cột A..W → không có Đơn giá/Thành tiền; ĐNTT bỏ qua phiếu có Thành tiền ≤ 0 nên phiếu mới không chọn được cho tới lần làm mới bản sao 7:30/13:00. Số phiếu dạng "0123" còn bị mất số 0 đầu.
- **Đã sửa:** ghi sau khi tính giá, đọc lại đúng các dòng vừa thêm (A..Z, kèm X Đơn giá, Y Trạng thái, Z Thành tiền); Số phiếu (A) và Số CT (W) giữ dạng chữ giống cách ĐNTT ghi. Test `draftChuaTT.test.js` (DRAFT-01).


## BUG-BG-01 — Báo giá mới/sửa/xóa không được áp dụng khi tính giá (đã sửa)
- Hiện tượng: tạo báo giá mới (hoặc sửa/xóa) xong, import/tính giá phiếu cân vẫn ra đơn giá cũ cho tới khi có người bấm "Xem toàn bộ lịch sử" ở tab Hiệu lực báo giá.
- Nguyên nhân: engine tính giá đọc `Baogia_DN_SAVE`; sheet này chỉ được ghi trong `BG_showAllData_`.
- Sửa: `BG_createQuote_`, `BG_updateBaogiaRow_`, `BG_deleteBaogiaRow_`, `BG_deleteQuote_` tự làm mới SAVE (`BG_lamMoiSave_`). Test: `test/baoGiaToiUu.test.js`.

## BUG-BG-02 — Danh sách báo giá và nút Xóa lệch nhau ở đúng mốc kết thúc hiệu lực (đã sửa)
- `BG_getQuoteListWithStatus_` dùng `ts <= đến`, kiểm tra xóa thật dùng `ts < đến` → nay dùng chung `_tsTrongKhoangHieuLuc_`.

## BUG-BG-03 — Sửa dòng báo giá có thể đổi giá phiếu cân đang dùng báo giá khác (đã chặn)
- Trước đây chỉ kiểm tra "đã có phiếu cân áp dụng" theo mã và khoảng hiệu lực CŨ. Thêm mã mới, dời ngày hiệu lực sớm hơn hoặc đổi mã khối lượng có thể làm dòng báo giá phủ lên phiếu cân đang tính theo báo giá khác.
- Sửa: `BG_kiemTraSauKhiSua_` xem trước hiệu lực SAU KHI SỬA (`BG_coreLogicProcessor_` trên dữ liệu giả lập), có phiếu cân (mọi năm, kể cả lưu trữ) trong khoảng mới -> không cho sửa, báo mã + số phiếu + ngày cân. Test: `test/baoGiaToiUu.test.js`.

## GIO-01 — Giờ cân hiển thị lệch vài phút ở Báo cáo / In phiếu / Tra cứu (đã sửa)
- Ô "chỉ có giờ" là Date ngày 30/12/1899; năm đó Asia/Ho_Chi_Minh còn giờ địa phương cũ (+7:06:xx) nên định dạng "GMT+7" cố định lệch vài phút (08:30:15 -> 08:23:45).
- Sửa: `gioCuaO_` lấy giờ/phút/giây theo múi giờ script (như engine tính giá và `toTimeOnly_`). Test: `test/sheetsApiVaGio.test.js` (Jest chạy theo `Asia/Ho_Chi_Minh` - `jest.config.js`).

## DRAFT-02 — Draft Chưa TT có thể thiếu giá khi giá ghi qua Sheets API (đã chặn)
- Giá ghi gộp qua `Sheets.Spreadsheets.Values.batchUpdate` (PERF-TG-02); bản sao Draft đọc lại dòng bằng SpreadsheetApp ngay sau đó. Nay ghép thẳng kết quả vừa tính (`ghepKetQuaGia_`, `TC_dongBoDraftChuaTT_`) - không phụ thuộc việc đọc lại.

## SCOPE-01 — Thiếu quyền userinfo.email (đã sửa)
- `appsscript.json` liệt kê cố định oauthScopes nhưng thiếu `userinfo.email` -> `Session.getActiveUser/getEffectiveUser` không trả email, chủ script không "vào thẳng" được. Đã thêm.
