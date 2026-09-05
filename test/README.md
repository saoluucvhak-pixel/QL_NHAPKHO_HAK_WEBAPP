# Bộ test tự động (Jest) cho QL_NHAPKHO_HAK_WEBAPP

## Chạy test

```bash
npm install   # 1 lần duy nhất
npm test      # chạy toàn bộ test
```

## Cách hoạt động

Đây là project Google Apps Script (`Code.gs` + `Config.gs` + `Index.html`), không
có kết nối Google Sheets/Drive thật trong môi trường này. Để test được các hàm
phía server mà không cần deploy lên Google, thư mục này:

1. **Mock tối giản các dịch vụ Google** (`gasMocks.js`): PropertiesService,
   SpreadsheetApp/Sheet/Range (bộ nhớ trong, dùng mảng 2 chiều), DriveApp,
   Utilities, LockService, Session, CacheService, HtmlService.
2. **Nạp `Config.gs` + `Code.gs` vào 1 vm context** (`gasEnv.js`), giống hệt
   cách Apps Script gộp mọi file `.gs` vào chung 1 global scope.
3. **Mỗi lần gọi 1 hàm (`env.call(...)`) sẽ nạp lại TOÀN BỘ script từ đầu** -
   đúng mô hình thực thi thật của Apps Script (mỗi request/`google.script.run`
   là 1 lần thực thi script mới hoàn toàn, biến `const`/`let` top-level không
   giữ state giữa các lần gọi). Chỉ `PropertiesService`/`SpreadsheetApp`/
   `Session` được giữ NGUYÊN xuyên suốt 1 `env` (đại diện cho các dịch vụ NGOÀI
   script, tồn tại thật sự giữa các lần gọi).

## Phạm vi đã test

- **Hàm logic thuần** (`pureUtils.test.js`): `sanitize`, `parseSoTheoLocale_`,
  `REGION_FORMAT`/`MISA_FORMAT`/`MISA_DEFAULTS`, `combineDateTime_`,
  `toDateOnly_`/`toTimeOnly_`/`toDateObj`/`parseDate`, `_tsTrongKhoangHieuLuc_`.
- **Hệ thống phân quyền** (`permission.test.js`): allowlist mặc định, chặn
  cứng ở server (`yeuCauQuyenAdmin_`/`yeuCauDangNhap_`), `doGet()` chặn trang,
  validate danh sách người dùng, toàn bộ các hàm cấu hình admin-only.
- **Cảnh báo lệch cấu trúc cột + Liên kết dữ liệu** (`headerDriftAndLienKet.test.js`).
- **Luồng xác nhận import phiếu cân** (`importConfirm.test.js`): phiếu mới,
  phiếu cập nhật (bao gồm đúng bug đã sửa: cập nhật cả khối lượng/ngày giờ khi
  re-import, không chỉ mã khách hàng), phiếu đã khóa "OK" bị bỏ qua.
- **Tối ưu hiệu năng không đổi hành vi** (`optimizations.test.js`): gộp nhiều
  lệnh `getRange().setValue()` rời rạc thành ít lệnh `setValues()`/
  `setNumberFormats()` hơn, verify giá trị ghi ra vẫn đúng 100% như trước.

## KHÔNG (chưa) test

Các hàm đọc/ghi trực tiếp nhiều sheet nghiệp vụ phức tạp (báo cáo tổng hợp,
xuất Excel/PDF, toàn bộ module Kho Dăm, Xuất hàng...) **chưa** có test tự động
- viết mock đủ trung thực cho toàn bộ ~150 hàm còn lại tốn nhiều công sức hơn
lợi ích mà không có Google Sheet thật để đối chiếu kết quả. Khi sửa các hàm đó,
nên kiểm thử thủ công trực tiếp trên bản deploy thử (dùng đúng dữ liệu mẫu),
không chỉ dựa vào bộ test này.

## KHÔNG deploy lên Apps Script

`package.json`, `node_modules/`, thư mục `test/` KHÔNG được đẩy lên Apps
Script khi dùng `clasp push` (xem `.claspignore`). Nếu deploy bằng cách
copy-paste thủ công, chỉ copy đúng `Code.gs`, `Config.gs`, `Index.html`,
`appsscript.json` - không copy các file trong thư mục này.
