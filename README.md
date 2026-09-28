# QL_NHAPKHO_HAK_WEBAPP
Created from gas-tools extension

## Triển khai
Dán `Code.gs`, `Config.gs`, `Index.html` (và `appsscript.json` nếu đổi) vào dự án Apps Script → Deploy › Manage deployments › Edit › New version. Thư mục `test/`, `docs/`, `.github/`, `package.json` KHÔNG đưa lên Apps Script (`.claspignore`).

## Kiểm thử tự động
```
npm test
```
- `test/nghiepVu.test.js`: nạp nguyên `Config.gs` + `Code.gs` vào môi trường giả lập Apps Script (`test/gasEnv.js`) - tính giá, khóa kỳ, chống trùng, chặn người lưu sau, định dạng kết xuất...
- `test/ui/giaoDien.test.js`: mở `Index.html` trên Chromium (Playwright) - ô nhập số theo Locale, ngày, bảng xem trước, di động, bàn phím. Máy không có Playwright thì tự bỏ qua.
- GitHub Actions chạy tự động mỗi lần push (`.github/workflows/test.yml`).

Báo cáo kiểm toán + lịch sử sửa: `docs/audit/13_Enterprise_Audit_2026-09-28.md`.
