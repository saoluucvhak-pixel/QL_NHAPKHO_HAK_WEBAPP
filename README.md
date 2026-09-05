# QL_NHAPKHO_HAK_WEBAPP
Created from gas-tools extension

Hệ thống quản lý nhập/xuất kho, cân hàng, báo giá và kho dăm gỗ cho HAK Group
(Google Apps Script: `Code.gs` + `Config.gs` + `Index.html`).

## Test tự động

Xem [`test/README.md`](test/README.md) - bộ test Jest cho phần logic thuần
(phân quyền, sanitize, parse ngày/số, luồng xác nhận import...), chạy cục bộ
bằng Node, không cần kết nối Google Sheets thật:

```bash
npm install
npm test
```
