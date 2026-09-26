# HƯỚNG DẪN LẬP TRÌNH (Developer Manual)

## 1. Kiến trúc tóm tắt
- **Config.gs**: hằng số cấu hình, liên kết dữ liệu, chia sẻ Drive, **phân quyền + Cổng + `API()`**.
- **Code.gs**: nghiệp vụ theo PHẦN 1–8 (xem mục lục ở `docs/BAO_CAO_DANH_GIA.md` §1.1).
- **Index.html**: toàn bộ giao diện; JS client gọi máy chủ qua `runServer(tenHam, ...thamSo)` (Promise) hoặc `apiRun().tenHam(...)` (module Kho dăm cũ). Cả 2 đều đi qua `API(PHIEN, tenHam, thamSo)`.

## 2. Quy tắc bắt buộc khi thêm chức năng mới

1. Hàm máy chủ gọi từ giao diện:
   ```js
   function XX_tenChucNang(thamSo) {
     yeuCauPhien_();                       // DÒNG ĐẦU TIÊN - bắt buộc
     try {
       // yeuCauQuyenAdmin_();             // nếu chỉ Admin được dùng
       ...
       return { status: "success", data: ... };
     } catch (e) { return { status: "error", message: e.toString() }; }
   }
   ```
2. Thêm tên hàm vào **`HAM_API_`** (Config.gs). Thiếu 1 trong 2 bước → `API()` chặn ("Không được phép gọi hàm").
3. Hàm **chỉ đọc** mà vai trò Chỉ xem cần → thêm vào **`HAM_CHO_PHEP_CHI_XEM_`**.
4. Hàm nội bộ (không cho giao diện gọi) → đặt tên kết thúc bằng `_`.
5. **Ghi dữ liệu**: bọc `LockService.getScriptLock()` + `waitLock(CONFIG.LOCK_TIMEOUT_MS)` + `finally releaseLock()`; ghi theo lô `setValues`; chữ do người dùng nhập đi qua `sanitize()`; ghi `logAudit_(HANH_DONG, "OK"/"ERROR", moTa)`.
6. **Xuất file**: dữ liệu ghi sang file tạm phải qua `chongCongThucBang_()`; trả `{ status, url }` với `url` là link `docs.google.com/spreadsheets/d/<id>/export?...` — `API()` tự tải nội dung và trả base64, giao diện gọi `moFileXuat(res)`.
7. **Sửa/Xóa theo dòng**: không tin số dòng từ giao diện — xác định lại bằng khóa (mã phiếu, STT...) như `XH_timDongDonHang_`.
8. **Xóa nhiều dòng**: dùng `xoaCacDong_(sheet, dsDong)`.
9. **Giao diện**: mọi dữ liệu chèn vào HTML dùng `escapeHtml()`; tham số trong `onclick` dùng `jsAttr()`; thông báo dùng `toast()`; thao tác dài dùng `showOverlay()/hideOverlay()`.

## 3. Kiểm thử

```bash
npm install            # cài Playwright (chỉ cần cho test giao diện)
npm test               # 90 ca máy chủ (Node, giả lập Apps Script)
npm run test:ui        # 46 ca giao diện (Chromium). Dùng Chrome có sẵn: CHROME_PATH=/duong/dan/chrome npm run test:ui
```
- `tests/server.test.js` nạp `Config.gs + Code.gs` vào `vm` với các dịch vụ giả (PropertiesService, CacheService, Utilities (HMAC thật), UrlFetchApp, SpreadsheetApp, HtmlService...), đồng thời **chạy chính mã nguồn Cổng** do `taoMaNguonCong_` sinh ra để kiểm tra đăng nhập đầu–cuối.
- `tests/ui.test.js` mở `Index.html` thật trong Chromium, thay `google.script.run` bằng bản giả.
- Thêm chức năng → thêm ca kiểm thử tương ứng; chạy cả 2 bộ trước khi đẩy code.

## 4. Quy trình phát hành
1. Nhánh tính năng → chạy `npm test && npm run test:ui` → PR → review → merge `main`.
2. Cập nhật `CHANGELOG.md` + `version` trong `package.json`.
3. Triển khai theo `docs/HUONG_DAN_TRIEN_KHAI.md` mục A (luôn **Edit** deployment cũ → New version, không tạo deployment mới).
4. Khuyến nghị (GĐ1): dùng `clasp push` (đã có `.claspignore`) + GitHub Actions để tự động hóa bước 3.

## 5. Thuộc tính tập lệnh (Script Properties) hệ thống dùng
| Khóa | Ý nghĩa |
|---|---|
| `DANH_SACH_QUYEN_JSON` | Danh sách người dùng & vai trò |
| `CONG_DN_KHOA_BI_MAT` | Khóa ký vé Cổng — **bí mật** |
| `CONG_DN_LINK` | Link `/exec` của Cổng |
| `LINK_WEBAPP_CHINH` | (tùy chọn) Link `/exec` webapp nếu tự nhận diện sai |
| `SAO_LUU_THU_MUC_ID` | Thư mục gốc chứa các bản sao lưu (tự tạo lần đầu) |
| `SAO_LUU_GIU_LAI` | Số bản sao lưu giữ lại (1–365, mặc định 30) |
| `SAO_LUU_KET_QUA_CUOI` | Kết quả lần sao lưu gần nhất (JSON) |
| Các khóa liên kết dữ liệu / vùng miền / Misa mặc định | Ghi đè cấu hình trong Config.gs (trang Cấu hình hệ thống) |

## 6. Lịch chạy tự động (trigger)
- Duy nhất 1 trigger: `TRIGGER_saoLuuHangDem` (hằng ngày 1–2 giờ sáng), bật/tắt ở trang Lưu trữ & Sao lưu — không tạo tay trong trình soạn thảo.
- Hàm trigger là hàm công khai (trigger không gọi được hàm có `_` cuối) nên tự kiểm tra `e.triggerUid` khớp trigger đã cài; không nằm trong `HAM_API_`.
- Khi thêm trigger mới: làm theo đúng mẫu này, và nhớ quyền `script.scriptapp` đã có trong `appsscript.json`.
