# HƯỚNG DẪN TRIỂN KHAI

## A. Cập nhật phiên bản (đã có hệ thống đang chạy)

1. Mở dự án Apps Script của webapp bằng tài khoản Admin (chủ dự án).
2. Thay **toàn bộ** nội dung 4 file bằng bản mới: `Code.gs`, `Config.gs`, `Index.html`, `appsscript.json`.
   Không dán thư mục `tests/`, `docs/`, `package.json` vào Apps Script.
3. Bấm **Lưu**. **Nếu bản mới có thêm quyền** (bản 2.1.0 thêm quyền "chạy theo lịch" cho sao lưu tự động): trên thanh công cụ chọn hàm `CAI_DAT_CONG_DANG_NHAP` → **Chạy** → **Xem lại quyền** → chọn tài khoản Admin → **Cho phép**. (Hàm này chỉ in lại mã Cổng ra nhật ký, không thay đổi gì.)
4. **Deploy › Manage deployments › (bản đang dùng) › Edit › Version: New version › Deploy**.
   Giữ nguyên link `/exec` (không tạo deployment mới, nếu không Portal & Cổng phải đổi link).
5. Mở webapp, đăng nhập, kiểm tra nhanh: Dashboard, 1 báo cáo, xuất 1 file Excel.

> Bản 2.x không cần sửa dự án Cổng đăng nhập hay Portal MAIN_HAK.

## B. Cài mới từ đầu

### B1. Dữ liệu
1. Chuẩn bị 5 Google Spreadsheet (Phiếu cân, Báo giá, Xuất hàng, Kho dăm, Misa/DNTT) và 2 thư mục Drive (file đã xử lý, sao lưu báo giá) — **tài khoản Admin phải có quyền Chỉnh sửa tất cả**.
2. Điền ID vào `Config.gs` (CONFIG, BAOGIA_CONFIG, XUATHANG_CONFIG, KHODAM_CONFIG) hoặc sau khi đăng nhập vào **Hệ thống › Cấu hình hệ thống › Liên kết dữ liệu**.
3. Sửa `COMPANY_NAME` và email Admin trong `DANH_SACH_QUYEN_MAC_DINH` (`Config.gs`).

### B2. Webapp chính
1. script.new → tạo 4 file, dán mã → Lưu.
2. **Deploy › New deployment › Web app**: Execute as = **Me**; Who has access = **Anyone with Google account** → Deploy → cấp quyền (Sheets, Drive, gọi URL ngoài).
3. Sao chép link `/exec`.

### B3. Cổng đăng nhập
> Hướng dẫn từng thao tác (kèm xử lý lỗi): [HUONG_DAN_PHAN_QUYEN.md](HUONG_DAN_PHAN_QUYEN.md)

1. Trong dự án webapp chọn hàm **`CAI_DAT_CONG_DANG_NHAP`** → **Chạy** → mở **Nhật ký thực thi**, sao chép mã giữa 2 dòng `-----`.
   (Nếu nhật ký báo không nhận diện được URL: thêm thuộc tính tập lệnh `LINK_WEBAPP_CHINH` = link `/exec` rồi chạy lại.)
2. script.new (dự án RIÊNG, VD "HAK - Cong dang nhap") → dán vào Code.gs → Lưu.
3. **Deploy › New deployment › Web app**: Execute as = **User accessing the web app**; Who has access = **Anyone with Google account**.
4. Mở link Cổng bằng tài khoản Admin → cho phép xem email → **Vào hệ thống**.
5. Trong webapp: **Hệ thống › Quản lý người dùng › Cổng đăng nhập Gmail** → dán link Cổng → **Lưu link Cổng**.
6. Thêm người dùng (email Gmail + vai trò Quản trị / Nhân viên / Chỉ xem) → **Lưu danh sách**.

### B4. Nhúng vào Portal MAIN_HAK
Trong Portal: **Quản trị** → mục "Kho gỗ keo" (`URL_KHO`) → dán link `/exec` của webapp → Lưu. Trình duyệt cần cho phép cửa sổ bật lên từ script.google.com.

### B5. Sau khi cài
- **Thu hồi quyền Sheet trực tiếp** của nhân viên (Hệ thống › Quản lý người dùng › Tình trạng chia sẻ): webapp không cần, còn giữ thì họ sửa được Sheet ngoài hệ thống.
- Không chia sẻ **dự án Cổng** cho ai (chứa khóa bí mật). Nghi lộ: **Đổi khóa bí mật** → dán mã mới vào Cổng → triển khai phiên bản mới.
- Bật **Sao lưu tự động** (Hệ thống › Lưu trữ & Sao lưu → tích "Tự động sao lưu hằng đêm" → Lưu cài đặt) rồi bấm **Sao lưu ngay** 1 lần để kiểm tra.
- Định kỳ **Chốt sổ năm** (Hệ thống › Lưu trữ & Sao lưu) để sheet chính luôn nhẹ.
- Định kỳ xem **Nhật ký hoạt động** (lọc Trạng thái = TU_CHOI / ERROR) để phát hiện truy cập bất thường.

## C. Khôi phục sự cố

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| "Vé đăng nhập sai chữ ký" | Cổng dùng mã/khóa cũ | Lấy lại mã nguồn Cổng, dán, triển khai phiên bản mới |
| "Chưa lưu link Cổng" | Chưa bước B3.5 | Mở thẳng link Cổng để đăng nhập, rồi lưu link |
| "Tài khoản … chưa được cấp quyền" | Email chưa có trong danh sách | Admin thêm đúng email hiển thị trong thông báo |
| Đăng nhập trong Portal không phản hồi | Trình duyệt chặn cửa sổ bật lên | Cho phép pop-up cho script.google.com |
| "Hệ thống đang bận" | Người khác đang ghi dữ liệu | Thử lại sau vài giây |
| Dữ liệu sai do thao tác nhầm | — | Xem **Nhật ký hoạt động** để biết ai làm gì, lúc nào; khôi phục từ **bản sao lưu** (dán ID bản sao vào Liên kết dữ liệu) hoặc Google Sheets › Tệp › Lịch sử phiên bản |
| Sao lưu báo lỗi 1 file "Không có quyền" | Tài khoản Admin không xem được file đó | Chia sẻ file cho tài khoản Admin (ít nhất quyền Xem) |
| Lỗi "cần cấp quyền" sau khi cập nhật | Bản mới có thêm quyền | Làm bước A3 (chạy 1 hàm trong trình soạn thảo, Cho phép) |
