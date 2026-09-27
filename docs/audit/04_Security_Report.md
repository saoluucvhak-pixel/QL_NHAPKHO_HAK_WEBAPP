# 04 — Security Report (Phase 8)

Mô hình hiện tại (main 1635f56): webapp chạy bằng quyền Admin (`USER_DEPLOYING`); danh tính người dùng lấy qua **Cổng đăng nhập Gmail** (dự án riêng, `USER_ACCESSING`) ký vé HMAC‑SHA256; mọi lời gọi từ giao diện đi qua `API(maPhien, tenHam, thamSo)`.

## Kết quả kiểm tra

| Hạng mục | Kết quả | Bằng chứng |
|---|---|---|
| Authentication | ✅ Tốt | Vé HMAC-SHA256, hết hạn 5 phút, dùng 1 lần (nonce trong CacheService), so sánh chữ ký thời gian hằng. Test: vé giả mạo, vé sửa nội dung, vé hết hạn, dùng lại vé đều bị từ chối. |
| Authorization | ✅ Tốt | `API()` chỉ gọi hàm trong `HAM_API_` **và** có `yeuCauPhien_()`; CHỈ XEM bị chặn ở máy chủ; Admin-only qua `yeuCauQuyenAdmin_()`. 13 hàm cấu hình có test Nhân viên bị từ chối. |
| Privilege escalation | ✅ | Nhân viên không tự sửa được danh sách quyền (test). Gọi thẳng hàm công khai bằng `google.script.run` bỏ qua `API()` → bị chặn (test). |
| Thu hồi quyền | ✅ Tức thì | `xacThucPhien_` kiểm tra lại danh sách quyền ở MỖI lời gọi, trước khi chiếm khóa (15 hàm ghi có test). |
| Replay | ✅ | Nonce vé dùng 1 lần; phiên tối đa 12 giờ, trượt 6 giờ. |
| Trigger giả mạo | ✅ (mới) | `runCalculatePrice(e)` chỉ bỏ qua đăng nhập khi `triggerUid` khớp trigger thật của dự án (test giả mạo bị chặn). |
| XSS / HTML Injection | ✅ | `escapeHtml()` cho dữ liệu, `jsAttr()` cho `onclick`. Rà 65 phép gán `innerHTML` bằng cây cú pháp: giá trị không escape còn lại đều là số hoặc ID nội bộ (`q.soNhom`, `item.nam`, `g.id`). Mã phiên/thông báo nhúng vào trang chặn `</script>` (test). |
| CSV / Formula Injection | ✅ | `sanitize()` thêm `'` trước `= + - @` cho mọi chuỗi từ file Excel và form nhập tay. |
| `eval` / `new Function` / `document.write` | ✅ Không có | |
| Secrets | ✅ | Không có khóa/mật khẩu trong mã nguồn. Khóa Cổng lưu ở Script Properties, chỉ in ra nhật ký của chủ dự án; `HT_layMaNguonCong` chặn Nhân viên (test không lộ khóa). |
| CSRF | ✅ Không áp dụng | `google.script.run` không nhận yêu cầu từ trang khác; mọi thao tác cần mã phiên. |
| CORS | ✅ Không áp dụng | Không có endpoint `doPost` công khai. |
| Clickjacking | ⚠️ Medium — chấp nhận | `ALLOWALL` là **bắt buộc** để nhúng vào Portal MAIN_HAK. Giảm thiểu: mọi thao tác đều cần phiên đăng nhập; không có hành động 1 cú nhấp nguy hiểm không xác nhận. |
| Token lưu ở `localStorage` | ⚠️ Low | Mã phiên 256 bit trong `localStorage` — chỉ lộ nếu có XSS (đã rà ở trên). Không thể dùng cookie HttpOnly trong Apps Script. |
| CSP / Nonce | ℹ️ Không khả thi | HtmlService không cho đặt header CSP; nội dung đã chạy trong sandbox iframe của Google (`*.googleusercontent.com`). |
| Chỉ xem gọi hàm có ghi | ⚠️ Medium (SEC-03) | `BG_updateHieuLuc`, `BG_showAllData` nằm trong danh sách cho phép Chỉ xem nhưng xóa + ghi lại sheet dẫn xuất và chiếm khóa. Không đổi dữ liệu gốc. Đề xuất: tách phần "đọc để xem" khỏi phần "dựng lại sheet" — **cần bạn xác nhận** vì đây là quyết định phân quyền. |
| Sensitive data | ✅ | Nhân viên không có quyền mở Sheet gốc (webapp chạy quyền Admin); file xuất Excel/PDF được máy chủ tải về và gửi dạng base64, không chia sẻ link Drive. |

## Không còn lỗi bảo mật mức High

Các mục ⚠️ ở trên là Medium/Low có lý do chấp nhận hoặc cần quyết định phân quyền.

## Cập nhật 27/09/2026 — Phân quyền theo khuôn ĐNTT
- **Một bảng duy nhất `API_ROUTES`** (`taoApiRoutes_` trong Config.gs): tên chức năng → hàm nội bộ + mức quyền. Chức năng không có trong bảng thì không gọi được. Thay cho 3 nơi rải rác trước đây (`HAM_API_`, danh sách Chỉ xem, `yeuCauQuyenAdmin_()` trong từng hàm) và mẹo dò mã nguồn hàm.
- **4 mức quyền** XEM / NGHIEP_VU / HE_THONG / QUAN_TRI; **4 vai trò** Quản trị / Tổng hợp / Nhân viên / Chỉ xem. Mức quyền từng chức năng giữ đúng như trước; thay đổi duy nhất: Sao lưu + Nhật ký mở cho vai trò Tổng hợp.
- **Hàm nghiệp vụ là hàm nội bộ** (116 hàm đổi sang tên kết thúc `_`): trình duyệt chỉ gọi thẳng được `doGet`, `API`, 3 hàm đăng nhập `DN_*` và 2 hàm trigger (có test khóa danh sách này).
- **Cài Cổng đăng nhập làm hết trên giao diện** (giống ĐNTT): chủ script (`Session.getEffectiveUser`) luôn là Quản trị và mở webapp là vào thẳng (Google trả email chủ script qua `getActiveUser`); người cùng tên miền Workspace có trong danh sách cũng vào thẳng đúng vai trò. Khóa bí mật tự tạo khi bấm "Sao chép mã nguồn" - không phải chạy hàm trong trình soạn thảo, không phải nhớ khóa. Đã bỏ hàm `CAI_DAT_CONG_DANG_NHAP` và trang hướng dẫn cài đặt.
- **Người dùng ở sheet `SYS_NguoiDung` trong file chứa script**: Email, Họ tên, Vai trò, Trạng thái (Hoạt động/Khóa), Quyền Drive, Cập nhật lúc/bởi. Tự chuyển danh sách cũ ở Script Properties sang ở lần đọc đầu. Quản trị cố định (`QUAN_TRI_CO_DINH`) không khóa được từ webapp.
- Lỗi thiếu quyền có tiền tố `[QUYEN]` (chỉ báo lỗi), khác lỗi phiên `PHIEN_HET_HAN` (đưa về màn đăng nhập).
- Test: ma trận 4 vai trò × mọi chức năng (kể cả từng thao tác Kho Dăm), tài khoản Khóa, Quản trị cố định, chuyển dữ liệu cũ — tổng 553 test đạt.
