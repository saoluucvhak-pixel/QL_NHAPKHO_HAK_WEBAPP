# HƯỚNG DẪN PHÂN QUYỀN CHI TIẾT (bản 2.1.0)

Người thực hiện: **Quản trị viên — tài khoản saoluucvhak@gmail.com**.
Thời gian: phần A ~15 phút (làm 1 lần) · phần B ~1 phút cho mỗi người dùng.

Bức tranh chung:

```
 Nhân viên ──bấm "Đăng nhập bằng Gmail"──► CỔNG ĐĂNG NHẬP (dự án Apps Script riêng)
                                               │  đọc email Google của nhân viên
                                               ▼
                                         WEBAPP CHÍNH ──► so với DANH SÁCH NGƯỜI DÙNG
                                               │            (Hệ thống › Quản lý người dùng)
                                   có tên + vai trò?  ──có──► vào hệ thống theo vai trò
                                               └──không──► báo "chưa được cấp quyền"
```

Có **2 dự án Apps Script**:
| Dự án | Là gì | Ai được mở |
|---|---|---|
| Webapp chính (đang dùng) | Toàn bộ hệ thống | Chỉ Admin |
| Cổng đăng nhập (tạo mới ở bước A2) | 1 file nhỏ, chỉ đọc email người đăng nhập | Chỉ Admin — **không chia sẻ cho ai** |

---

## PHẦN A — CÀI ĐẶT 1 LẦN

> Nên dùng **1 cửa sổ Chrome chỉ đăng nhập saoluucvhak@gmail.com** (cửa sổ ẩn danh hoặc hồ sơ Chrome riêng). Trình duyệt đăng nhập nhiều tài khoản Google cùng lúc hay làm Apps Script chọn nhầm tài khoản.

### A1. Cập nhật webapp chính

1. Vào **script.google.com** → mở dự án webapp quản lý nhập kho.
2. Cột trái, mục **Tệp**: lần lượt bấm từng file **Code.gs**, **Config.gs**, **Index.html**:
   - Bấm vào vùng code → **Ctrl + A** (chọn hết) → **Delete**.
   - Mở file text tương ứng đã nhận (`Code.gs.txt`…) → Ctrl + A → Ctrl + C → quay lại Apps Script → **Ctrl + V**.
3. File **appsscript.json**: nếu không thấy trong cột trái → bánh răng **⚙️ Cài đặt dự án** (cột trái ngoài cùng) → tích **"Hiển thị tệp kê khai appsscript.json trong trình chỉnh sửa"** → quay lại **<> Trình chỉnh sửa**, file sẽ hiện ra → dán đè như trên.
4. Bấm biểu tượng **💾 Lưu dự án** (hoặc Ctrl + S). Không được có dòng báo lỗi đỏ.

### A2. Cấp quyền cho webapp & lấy mã nguồn Cổng

1. Trên thanh công cụ phía trên vùng code có ô chọn tên hàm (cạnh nút **▷ Chạy**). Bấm vào ô đó → chọn **`CAI_DAT_CONG_DANG_NHAP`**.
   *(Ô này đang hiện hàm trong file đang mở — nếu không thấy, bấm mở file **Config.gs** trước.)*
2. Bấm **▷ Chạy**.
3. Lần đầu Google hiện hộp **"Cần cấp quyền"**:
   - Bấm **Xem lại quyền** → chọn **saoluucvhak@gmail.com**.
   - Nếu hiện **"Google chưa xác minh ứng dụng này"**: bấm **Nâng cao** → **Đi tới … (không an toàn)**. (Bình thường với dự án tự viết — đây là dự án của chính anh.)
   - Bấm **Cho phép**.
4. Phía dưới hiện **Nhật ký thực thi**, có đoạn:
   ```
   === CỔNG ĐĂNG NHẬP GMAIL - làm theo các bước ===
   ...
   -----
   /**
    * CỔNG ĐĂNG NHẬP GMAIL - HỆ THỐNG QUẢN LÝ HAKGROUP
   ...
   -----
   ```
5. Bôi đen **từ dòng `/**` đến hết dòng `}` cuối cùng** (tức là toàn bộ phần nằm GIỮA 2 dòng `-----`, không lấy 2 dòng `-----`) → **Ctrl + C**. Tạm dán vào Notepad để khỏi mất.
   - Nếu nhật ký có dòng **"!! Không tự nhận diện được URL /exec"**: làm bước A3 trước, sau đó vào ⚙️ Cài đặt dự án → **Thuộc tính tập lệnh** → **Thêm thuộc tính**: tên `LINK_WEBAPP_CHINH`, giá trị = link `/exec` của webapp → Lưu → chạy lại hàm ở bước 1–5.

### A3. Triển khai phiên bản mới của webapp chính

1. Góc trên bên phải bấm **Triển khai (Deploy)** → **Quản lý các lần triển khai (Manage deployments)**.
2. Chọn dòng triển khai **đang hoạt động** (Active) → bấm biểu tượng **✏️ (Chỉnh sửa)**.
3. Ô **Phiên bản (Version)** → chọn **Phiên bản mới (New version)**.
4. Kiểm tra: **Thực thi dưới dạng (Execute as)** = **Tôi (saoluucvhak@gmail.com)**; **Người có quyền truy cập (Who has access)** = **Bất kỳ ai có Tài khoản Google (Anyone with Google account)**.
5. Bấm **Triển khai (Deploy)** → **Xong**.

> ⚠️ Luôn **sửa** lần triển khai cũ, **không** bấm "Triển khai mới (New deployment)" cho webapp chính — nếu tạo mới, link `/exec` đổi, Portal MAIN_HAK và Cổng phải cập nhật lại link.

### A4. Tạo dự án Cổng đăng nhập

1. Mở tab mới, gõ **script.new** → Enter (tạo dự án Apps Script trống).
2. Bấm chữ **"Dự án không có tiêu đề"** ở góc trên → đặt tên **HAK - Cong dang nhap** → Đổi tên.
3. Trong file **Code.gs**: Ctrl + A → Delete → dán đoạn mã đã sao chép ở A2 → **💾 Lưu**.
   - Kiểm tra dòng đầu có `const LINK_WEBAPP_CHINH = "https://script.google.com/macros/s/..../exec";` và `const KHOA_BI_MAT = "...64 ký tự...";`.
4. Bấm **Triển khai** → **Triển khai mới (New deployment)**.
5. Cạnh chữ **Chọn loại (Select type)** bấm biểu tượng **⚙️** → chọn **Ứng dụng web (Web app)**.
6. Điền:
   - Mô tả: `Cong dang nhap`
   - **Thực thi dưới dạng: Người dùng truy cập ứng dụng web (User accessing the web app)** ← QUAN TRỌNG
   - **Người có quyền truy cập: Bất kỳ ai có Tài khoản Google (Anyone with Google account)**
7. Bấm **Triển khai**. Nếu hỏi cấp quyền → làm như A2 bước 3.
8. Màn hình hiện **URL ứng dụng web** dạng `https://script.google.com/macros/s/AKfy...../exec` → bấm **Sao chép**. Đây là **LINK CỔNG** — dán vào Notepad.

> ❗ Nếu chọn sai "Thực thi dưới dạng: Tôi", Cổng sẽ luôn đọc ra email Admin → ai đăng nhập cũng thành Admin. Phải là **Người dùng truy cập ứng dụng web**.

### A5. Đăng nhập lần đầu bằng tài khoản Admin

1. Dán **LINK CỔNG** vào thanh địa chỉ → Enter.
2. Lần đầu hiện hộp cấp quyền: chọn **saoluucvhak@gmail.com** → (nếu có cảnh báo chưa xác minh: Nâng cao → Đi tới…) → **Cho phép** ("Xem địa chỉ email chính của bạn").
3. Trang Cổng hiện: **"Xin chào saoluucvhak@gmail.com"** và nút **➡️ Vào hệ thống HAKGROUP** → bấm nút.
4. Webapp mở ra, đã đăng nhập. Góc dưới thanh bên trái hiện `👤 saoluucvhak@gmail.com · Quản trị`.

### A6. Lưu link Cổng vào webapp

1. Thanh bên trái: **Hệ thống** → **Quản lý người dùng**.
2. Khung đầu tiên **🔐 Cổng đăng nhập Gmail** → ô **Link Cổng đăng nhập** → dán **LINK CỔNG**.
3. Bấm **💾 Lưu link Cổng** → hiện thông báo xanh "✅ Đã lưu link Cổng đăng nhập", dòng trạng thái đổi thành "✅ Đã lưu link Cổng".
   - Báo "Link Cổng không hợp lệ" → kiểm tra link phải bắt đầu `https://script.google.com/` và kết thúc `/exec`.
   - Báo "Đây là link của CHÍNH webapp quản lý" → anh đang dán nhầm link webapp chính, hãy dán link của dự án Cổng.

Từ giờ nút **"Đăng nhập bằng Gmail"** trên webapp và Portal sẽ trỏ tới Cổng. ✅ Xong phần cài đặt.

---

## PHẦN B — THÊM / SỬA / XÓA NGƯỜI DÙNG

### B1. Thêm người dùng

1. **Hệ thống › Quản lý người dùng** → khung **Danh sách người dùng được cấp quyền truy cập**.
2. Bấm **➕ Thêm người dùng** → xuất hiện 1 dòng trống.
3. Cột **Email**: gõ đúng Gmail nhân viên dùng (VD `nguyenvana@gmail.com`).
   - Dấu chấm và phần `+...` trong Gmail không quan trọng: `nguyen.van.a@gmail.com` = `nguyenvana@gmail.com`.
   - Email công ty (Google Workspace) cũng dùng được, gõ đúng địa chỉ.
4. Cột **Vai trò**: chọn
   | Chọn | Dùng cho | Thấy / làm được |
   |---|---|---|
   | **Quản trị** | Giám đốc, kế toán trưởng, IT | Tất cả, kể cả Cấu hình hệ thống, Quản lý người dùng, Lưu trữ & Sao lưu, Nhật ký hoạt động |
   | **Nhân viên** | Nhân viên cân, thủ kho, kế toán | Dashboard, Import, Nhập liệu, Báo cáo, Báo giá, xuất Excel/PDF. Không thấy mục cấu hình/người dùng/sao lưu/nhật ký |
   | **Chỉ xem** | Ban lãnh đạo, kiểm soát, đối tác | Dashboard, Báo cáo, danh sách báo giá, xuất Excel/PDF. **Không** thấy Import, Nhập liệu, Nhập báo giá; không có nút sửa/xóa; mọi thao tác ghi bị máy chủ chặn |
5. Cột **Quyền Drive**: **bỏ qua** (chỉ dùng cho nút chia sẻ Sheet thủ công, không liên quan việc đăng nhập).
6. Thêm nhiều người: bấm ➕ tiếp cho từng người.
7. Bấm **💾 Lưu danh sách** → xác nhận **OK** → thông báo "✅ Đã lưu danh sách N người dùng."

> Nhân viên **không cần** được chia sẻ Google Sheet hay thư mục Drive nào. Chỉ cần có tên trong danh sách này.

### B2. Đổi vai trò
Chọn lại vai trò ở dòng người đó → **💾 Lưu danh sách**. Có hiệu lực từ thao tác kế tiếp của họ. Menu trên màn hình của họ cập nhật khi họ tải lại trang hoặc đăng nhập lại.

### B3. Xóa người dùng (nghỉ việc…)
1. Bấm **🗑️** cuối dòng người đó → **💾 Lưu danh sách**. Người đó bị chặn **ngay lập tức** (kể cả đang mở webapp).
2. Nếu trước đây người đó từng được chia sẻ Google Sheet: làm tiếp **D1** để thu hồi.

### B4. Các quy tắc hệ thống tự kiểm tra
- Phải còn **ít nhất 1 Quản trị** — không lưu được nếu xóa hết.
- Email sai định dạng → báo lỗi, không lưu.
- Email trùng → chỉ giữ dòng đầu tiên.
- ⚠️ **Đừng xóa hoặc hạ quyền chính email anh đang dùng** — bấm Lưu xong anh mất quyền Quản trị ngay.

---

## PHẦN C — NHÂN VIÊN ĐĂNG NHẬP (gửi phần này cho nhân viên)

1. Mở webapp **hoặc** Portal MAIN_HAK → mục **Kho gỗ keo**.
2. Màn hình hiện **"Đăng nhập bằng Gmail"** → bấm nút.
3. Một **cửa sổ nhỏ** bật lên (trang Cổng):
   - **Lần đầu**: chọn tài khoản Gmail → **Cho phép** ("Xem địa chỉ email chính của bạn"). Nếu có cảnh báo "Google chưa xác minh ứng dụng": **Nâng cao** → **Đi tới…** → Cho phép.
   - Trang hiện "Xin chào <email>" → (tự chuyển hoặc) bấm **➡️ Vào hệ thống HAKGROUP**.
4. Cửa sổ nhỏ **tự đóng**, trang chính tự vào hệ thống. Góc dưới trái hiện email + vai trò.
5. Phiên đăng nhập giữ **tối đa 12 giờ**, không thao tác **6 giờ** thì hết — khi đó chỉ cần bấm đăng nhập lại.
6. **Đăng xuất**: chữ **Đăng xuất** ở góc dưới thanh bên trái.

Mẹo cho nhân viên:
- Có thể **lưu LINK CỔNG làm dấu trang** để vào thẳng.
- Bấm đăng nhập mà **không thấy cửa sổ**: trình duyệt chặn pop-up → biểu tượng chặn ở cuối thanh địa chỉ → chọn **"Luôn cho phép cửa sổ bật lên từ script.google.com"** → bấm lại.
- Muốn **đổi tài khoản**: đăng xuất Google hoặc dùng cửa sổ ẩn danh (Ctrl + Shift + N).

---

## PHẦN D — VIỆC NÊN LÀM SAU KHI PHÂN QUYỀN

### D1. Thu hồi quyền chia sẻ Sheet cũ của nhân viên (rất nên làm)
Trước đây (cơ chế cũ) nhân viên phải được chia sẻ Google Sheet → họ vẫn **mở và sửa thẳng Sheet** ngoài webapp, không qua kiểm soát, không để lại nhật ký.
1. **Hệ thống › Quản lý người dùng** → khung **Tình trạng chia sẻ Google Sheet/Drive hiện tại & Thu hồi quyền**.
2. Bấm **🔄 Xem tình trạng chia sẻ** → bảng liệt kê từng Sheet/Thư mục, email nào đang có quyền gì.
3. Với email nhân viên: bấm **🚫 Thu hồi** trên từng dòng; **hoặc** gõ email vào ô cuối khung → **🚫 Thu hồi toàn bộ quyền Drive của email này**.
4. **Không** thu hồi email Admin (saoluucvhak@gmail.com) — webapp chạy bằng quyền tài khoản này.

### D2. Bảo vệ Cổng
- Không chia sẻ dự án **HAK - Cong dang nhap** cho ai, không gửi mã nguồn Cổng qua Zalo/email (trong đó có **khóa bí mật** — ai có khóa có thể giả đăng nhập bất kỳ email nào).
- Nghi bị lộ: **Quản lý người dùng › 🔁 Đổi khóa bí mật** → mã mới hiện trong ô bên dưới (thường đã tự sao chép; nếu không: bấm vào ô, Ctrl + A, Ctrl + C) → mở dự án Cổng → dán đè Code.gs → Lưu → **Triển khai › Quản lý các lần triển khai › ✏️ › Phiên bản mới › Triển khai**. Trong lúc chưa làm xong, không ai đăng nhập mới được (người đang đăng nhập vẫn dùng bình thường).

### D3. Theo dõi
- **Hệ thống › Nhật ký hoạt động** → Hành động = **DANG_NHAP**, Trạng thái = **TU_CHOI** → xem ai đang cố đăng nhập mà chưa được cấp quyền.
- Định kỳ rà danh sách người dùng, xóa người đã nghỉ.

---

## PHẦN E — XỬ LÝ LỖI THƯỜNG GẶP

| Thông báo / hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| "Tài khoản xxx@gmail.com chưa được cấp quyền…" | Email chưa có trong danh sách, hoặc gõ sai | Admin thêm **đúng email trong thông báo** (B1) |
| "Chưa lưu link Cổng đăng nhập…" | Chưa làm A6 | Admin mở thẳng LINK CỔNG để vào, rồi làm A6 |
| "Vé đăng nhập sai chữ ký…" | Dự án Cổng đang dùng mã cũ (sau khi Đổi khóa, hoặc dán nhầm) | Quản lý người dùng › **📋 Sao chép mã nguồn** → dán đè vào dự án Cổng → Triển khai phiên bản mới |
| "Liên kết đăng nhập đã hết hạn / đã được dùng" | Vé chỉ dùng 1 lần trong 5 phút | Bấm Đăng nhập lại |
| Cổng báo "Không đọc được email Google" | Trình duyệt đăng nhập nhiều tài khoản / chưa đăng nhập Google | Dùng cửa sổ ẩn danh, chỉ đăng nhập 1 tài khoản |
| Ai đăng nhập cũng thành Admin | Cổng triển khai sai "Thực thi dưới dạng: Tôi" | Dự án Cổng › Quản lý các lần triển khai › ✏️ → **Người dùng truy cập ứng dụng web** → Phiên bản mới |
| Bấm đăng nhập không có gì xảy ra | Trình duyệt chặn pop-up | Cho phép pop-up cho script.google.com |
| Nhân viên thấy menu cũ sau khi đổi vai trò | Trang chưa tải lại | Tải lại trang (F5) |
| "Bạn không có quyền Quản trị…" | Tài khoản không phải Quản trị | Admin đổi vai trò nếu cần |
| "Tài khoản … chỉ có quyền XEM…" | Tài khoản vai trò Chỉ xem bấm thao tác ghi | Đúng thiết kế; đổi vai trò Nhân viên nếu cần |
| Admin lỡ tự xóa quyền mình | — | Apps Script › ⚙️ Cài đặt dự án › Thuộc tính tập lệnh → **xóa** thuộc tính `DANH_SACH_QUYEN_JSON` → hệ thống quay về danh sách mặc định (saoluucvhak@gmail.com là Quản trị) → đăng nhập, thêm lại người dùng |
