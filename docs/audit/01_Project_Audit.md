# 01 — Project Audit (Phase 1–2: Cấu trúc & Chất lượng code)

Phạm vi: **toàn bộ** mã nguồn triển khai trên nhánh `main` tại commit `1635f56` (UPDATE27092026), sau khi gộp vào nhánh `claude/code-review-completion-tj3uml`.

| File | Dòng | Hàm | Vai trò |
|---|---:|---:|---|
| `Code.gs` | 5.402 | 158 | Nghiệp vụ: Import phiếu cân, Tính giá, Báo cáo, Báo giá, Xuất hàng, Kho Dăm, Lưu trữ năm, Sao lưu |
| `Config.gs` | 1.141 | 50 | Cấu hình, Liên kết dữ liệu, Phân quyền, **Cổng đăng nhập Gmail**, cổng `API()` |
| `Index.html` | 5.119 | 140 | Toàn bộ giao diện (HTML + CSS + JS một trang) |
| `appsscript.json` | 24 | – | `executeAs: USER_DEPLOYING`, `access: ANYONE`, V8 |

Cách đo: công cụ phân tích cú pháp `tools/audit.js` (dựng cây cú pháp bằng `@babel/parser`, không dùng regex) + đọc code thủ công. **STATIC ANALYSIS — số liệu thời gian chạy thật trên Google chưa đo.**

## Phase 1 — Đánh giá cấu trúc (thang 10)

| Mục | Điểm | Nhận xét |
|---|:-:|---|
| Cấu trúc thư mục | 6 | Apps Script chỉ cho file phẳng; đã tách `Config.gs`. Bộ test + công cụ nằm ngoài phần triển khai (`test/`, `tools/`). |
| Phân chia module | 6 | Tiền tố nhất quán theo module (`BG_`, `XH_`, `LT_`, `HT_`, `SL_`, `NK_`, `KD_`, `DN_`), nhưng toàn bộ nghiệp vụ dồn trong 1 file `Code.gs` 5.400 dòng. |
| Naming | 7 | Tiếng Việt không dấu, nhất quán; hậu tố `_` = hàm nội bộ (không gọi được từ trình duyệt) đúng quy ước Apps Script. |
| Reusable / Utility / Helper | 6 | Có helper dùng chung (`sanitize`, `toDateObj`, `REGION_FORMAT`, `LT_docPhieuCanGopLuuTru_`, `escapeHtml`, `jsAttr`). Còn lặp logic giữa 2 luồng Import. |
| Dead code | 8 | Không tìm thấy hàm chết đáng kể (đối chiếu `HAM_API_` + lời gọi nội bộ). |
| Duplicate code | 5 | `step1_PreviewDraft` ↔ `XH_step1_PreviewDraft`, `step1_ConfirmImport` ↔ `XH_step1_ConfirmImport` cùng khung xử lý, khác cột. |
| Circular dependency | 9 | Không có (một không gian tên toàn cục của Apps Script; không có vòng gọi gây đệ quy). |
| Global variables | 7 | Hằng cấu hình `const`; `PHIEN_HIEN_TAI_` là `var` có chủ đích, **luôn được gán lại mỗi lượt thực thi** — an toàn trong mô hình Apps Script. |
| Constants / Config | 8 | ID Sheet/Thư mục tập trung trong `Config.gs`, đổi được qua giao diện (Liên kết dữ liệu). |
| Magic number | 6 | Còn chỉ số cột dạng số (`row[21]`, `getRange(r, 22)`) — bắt buộc vì Sheet đọc theo vị trí; đã có cảnh báo lệch cột (`kiemTraLechHeaderSheet_`). |
| Architecture | 7 | Mô hình mới (Cổng đăng nhập + `API()` duy nhất + chạy quyền Admin) là thiết kế tốt. Giới hạn lớn nhất là **dung lượng Google Sheet** (xem 09_Architecture.md). |

## Phase 2 — Chất lượng code

### Hàm dài / phức tạp (độ phức tạp chu trình CC; > 20 là cao)

| Hàm | Dòng | CC | Mức | Ghi chú |
|---|---:|---:|:-:|---|
| `XH_step1_PreviewDraft` | 159 | 76 | Cao | Đọc Excel xuất hàng + đối soát; nhiều nhánh định dạng ngày/số |
| `step1_PreviewDraft` | 201 | 55 | Cao | Tương tự cho phiếu cân nhập |
| `getBaoCaoDonGia` | 87 | 51 | Cao | Lọc + dò dải khối lượng |
| `layBaoCaoTonKho` | 141 | 51 | Cao | Tổng hợp tồn kho Kho Dăm |
| `xuLySuaXoaGiaoDich` | 138 | 49 | Cao | Sửa/xóa phiếu Kho Dăm |
| `getBaoCaoTongHop` | 82 | 47 | TB | Chuỗi điều kiện lọc tuyến tính, dễ đọc |
| `step1_ConfirmImport` | 186 | 38 | TB | Đã tách phần ghi sang `ghiCapNhatPhieuCanGop_` |
| 16 hàm khác | – | 21–36 | TB | Xem `node tools/audit.js` |

Giao diện: chỉ 3 hàm vượt ngưỡng (`luuGiaoDichForm` CC 30, `moFormGiaoDich` CC 25, `renderBaoCaoTonKho` 84 dòng).

### Mùi code (code smell) theo mức độ

- **Critical** (sai kết quả / mất dữ liệu / bảo mật): **0 còn lại** — 3 lỗi mức này tìm thấy trong đợt kiểm tra đã được sửa (xem 02_Bug_List.md).
- **High** (khó bảo trì): 5 hàm CC > 45 ở trên; trùng khung xử lý giữa 2 luồng Import. **Chưa refactor** — lý do và kế hoạch ở 05_Refactor_Report.md.
- **Medium**: magic index cột; chuỗi thông báo lặp; `if` dài trong hàm lọc báo cáo.
- **Low**: comment rất dài ở đầu các hàm (lịch sử sửa lỗi) — hữu ích cho người bảo trì hiện tại, nhưng nên chuyển dần sang lịch sử git.

### SOLID / DRY / KISS / YAGNI
- **SRP**: vi phạm ở các hàm Import (đọc file + chuẩn hóa + đối soát + ghi).
- **DRY**: vi phạm vừa phải (2 luồng Import; khối xác định `badgeClass` lặp ở 3 bảng giao diện).
- **KISS / YAGNI**: tốt — không có lớp trừu tượng thừa, không có tính năng "để dành".
- Callback hell: không — giao diện dùng `async/await` qua `runServer()`.
- Deep nesting: tối đa 5 cấp trong `XH_step1_PreviewDraft`.

## Điểm tổng quan

| Hạng mục | Trước đợt này | Sau đợt này |
|---|:-:|:-:|
| Kiến trúc | 7 | 7 |
| Bảo mật | 8 | 8,5 |
| Hiệu năng máy chủ | 5 | 8 |
| Hiệu năng giao diện (dữ liệu lớn) | 3 | 8 |
| Độ tin cậy khi sự cố (lock / timeout) | 6 | 8,5 |
| Khả năng bảo trì | 6 | 6,5 |
| Kiểm thử tự động | 7 (bộ test lỗi thời với mô hình đăng nhập mới) | 9 (215 test, đúng mô hình mới) |
