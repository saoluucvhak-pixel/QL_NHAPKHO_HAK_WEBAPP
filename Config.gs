/*********************************************************
 * FILE CẤU HÌNH TRUNG TÂM - HỆ THỐNG QUẢN LÝ HAKGROUP
 *
 * Mục đích: gom toàn bộ ID Spreadsheet/Folder, tên Sheet, hằng số dùng chung
 * vào MỘT NƠI DUY NHẤT, để khi cần đổi (ví dụ đổi ID Google Sheet, đổi tên
 * Sheet, đổi thư mục Drive...) chỉ cần sửa ở đây, không phải tìm rải rác
 * khắp các file Code.gs / Index.html.
 *
 * LƯU Ý: Apps Script gộp TẤT CẢ các file .gs trong project vào chung 1 phạm
 * vi toàn cục (global scope), nên các hàm trong Code.gs vẫn gọi được
 * CONFIG.xxx / BAOGIA_CONFIG.xxx bình thường mà không cần "import" gì thêm.
 * Thứ tự các file trong project (Config.gs, Code.gs, Index.html) không ảnh
 * hưởng gì, vì mọi hàm chỉ thực sự chạy SAU KHI toàn bộ project đã được nạp.
 *********************************************************/

/* ---------- CẤU HÌNH HỆ THỐNG CÂN HÀNG & THANH TOÁN (PhieuCan_DN) ---------- */
const CONFIG = {
  // Thư mục Drive lưu file đã xử lý xong (file gốc đã import + các file export)
  FOLDER_DONE: "1bAp97Lwrpq6N8z4-2oXSaieszSL2roca",

  // Google Sheet chính chứa dữ liệu phiếu cân
  SPREADSHEET_ID: "1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g",
  DATA_SHEET: "PhieuCan_DN",
  // Sheet Draft xem trước (cùng Spreadsheet với PhieuCan_DN) - mỗi lần bấm
  // "Tải lên & Xem trước" sẽ XÓA nội dung cũ rồi ghi lại dữ liệu mới, giống
  // đúng cơ chế NL_PC_XH_Draft bên Xuất hàng. KHÔNG tạo file Spreadsheet mới
  // mỗi lần (khác bản cũ trước đây) - giữ tốc độ nhanh, không tốn Drive API.
  PREVIEW_DRAFT_SHEET: "PhieuCan_DN_Draft",

  // LƯU Ý (đã sửa lỗi đồng bộ): giá trị này KHÔNG còn được engine tính giá
  // (runCalculatePrice_core) dùng nữa - trước đây hàm đó mở thẳng URL cố định
  // này, tách rời khỏi BAOGIA_CONFIG.SPREADSHEET_ID (có thể đổi qua giao diện
  // Liên kết dữ liệu), gây nguy cơ tính giá theo sheet Báo giá SAI/CŨ nếu admin
  // từng đổi liên kết. Nay engine tính giá dùng BG_ss_() (mở theo
  // BAOGIA_CONFIG.SPREADSHEET_ID) để chỉ có 1 nguồn sự thật duy nhất. Giữ lại
  // hằng số này chỉ để tham khảo/tương thích ngược, không dùng để mở Sheet ở
  // bất kỳ đâu trong code nữa.
  URL_BAO_GIA: "https://docs.google.com/spreadsheets/d/1SIhfjP5-6ouRPDj265lAMmI5yWs1XcnedjqpzDwaIC0/edit",
  SHEET_BAO_GIA: "Baogia_DN_SAVE",

  // Sheet tham chiếu dùng khi trích xuất dữ liệu hạch toán MISA (copyDataWithFinalLookup)
  SRC_FILE_ID: "1cv11ORWuAF3Sit4f-kA0xrP6-ab4SF-7LEdkCvGi_gI",
  // Spreadsheet đích chứa dữ liệu đã map sẵn theo đúng cấu trúc import MISA
  MISA_DST_ID: "1vkeu2YxME6fsp9ed8DokdtV1jxla5pA-H7heHBt-BRs",
  MISA_DST_SHEET: "Update_MiSa_PC",
  // GHI CHÚ QUAN TRỌNG (làm rõ phạm vi, không phải lỗi): Spreadsheet ĐNTT này
  // là 1 hệ thống NGOÀI, KHÔNG do webapp này quản lý. Toàn bộ chỗ dùng
  // DNTT_FILE_ID/DNTT_SHEET trong Code.gs (copyDataWithFinalLookup,
  // buildDNTTStatusMap_) CHỈ ĐỌC (map số hợp đồng cho MISA, hiển thị "Đã/Chưa
  // lập ĐNTT") - webapp này KHÔNG có chức năng TẠO/SỬA/XÓA Đề Nghị Thanh Toán.
  // Việc lập ĐNTT vẫn phải thực hiện trực tiếp trên Spreadsheet ĐNTT gốc (hoặc
  // quy trình hiện có của kế toán) - nếu cần đưa việc lập ĐNTT vào webapp này,
  // đó là 1 TÍNH NĂNG MỚI cần thiết kế riêng (form nhập, quy tắc duyệt...),
  // không phải một lỗi cần sửa trong phạm vi các bản vá hiện tại.
  DNTT_FILE_ID: "1oUm87_gbDbnuPc_We0dyZ_e4kHXBHXs95AQAxp5okYo",
  DNTT_SHEET: "DNTT_GK_DN_CT",

  // Timeout chờ khóa LockService dùng chung (ms) - chống ghi đè dữ liệu khi nhiều người dùng cùng lúc
  LOCK_TIMEOUT_MS: 30000,

  // Sheet DRAFT theo dõi các phiếu cân CHƯA THANH TOÁN - tùy chọn bật/tắt khi
  // Import (checkbox "Đồng thời lưu vào Draft Chưa Thanh Toán"), giúp kế toán
  // nhanh chóng thấy phiếu nào cần lập ĐNTT mà không phải lọc lại cả
  // PhieuCan_DN. Mặc định nằm CÙNG Spreadsheet PhieuCan_DN, nhưng địa chỉ có
  // thể đổi qua Hệ thống → Cấu hình hệ thống → Liên kết dữ liệu để dùng cho
  // đơn vị/công ty khác (không hard-code, không phụ thuộc Sheet hiện hành).
  DRAFT_CHUATT_SPREADSHEET_ID: "1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g",
  DRAFT_CHUATT_SHEET: "PhieuCan_DN_CHUA_TT_DRAFT",

  // Tên sheet log audit (Timestamp, Action, Status, Message) - đã có sẵn trong hệ thống
  AUDIT_SHEET: "Audit"
};

/* ---------- CẤU HÌNH HỆ THỐNG QUẢN LÝ BÁO GIÁ (Baogia_DN...) ---------- */
// Đây là 1 spreadsheet RIÊNG (khác với CONFIG.SPREADSHEET_ID ở trên), nhưng
// CHÍNH LÀ spreadsheet mà CONFIG.URL_BAO_GIA / CONFIG.SHEET_BAO_GIA trỏ tới -
// vì vậy SAVE_SHEET bên dưới lấy trực tiếp từ CONFIG để tránh khai báo lệch
// tên sheet ở 2 nơi khác nhau gây tra sai dữ liệu giá.
const BAOGIA_CONFIG = {
  SPREADSHEET_ID: "1SIhfjP5-6ouRPDj265lAMmI5yWs1XcnedjqpzDwaIC0",
  // Thư mục Drive lưu các file báo giá export ra (Excel/PDF)
  BACKUP_FOLDER_ID: "1N9qkwh0qBcdYaU4vJI307Eh5pSnL7zRA",

  SRC_SHEET: "Baogia_DN",         // Log các nhóm giá đã nhập (mỗi dòng = 1 nhóm mã dùng chung 1 giá)
  QL_SHEET: "QL_BaoGia",          // Đầu phiếu báo giá (Số báo giá, ngày, hiệu lực, sao chép từ đâu)
  DST_SHEET: "Baogia_DN_FINAL",   // Chỉ chứa các mã đang "Còn hiệu lực" (dùng để tính giá)
  SAVE_SHEET: CONFIG.SHEET_BAO_GIA, // "Baogia_DN_SAVE" - toàn bộ lịch sử (còn/chưa/hết hiệu lực)
  MA_SHEET: "Ma_BaoGia",          // Danh mục mã báo giá (Đại lý_Nguồn gốc_Hình ảnh)
  MAKL_SHEET: "Ma_KL"             // Danh mục mã khối lượng (dải Tấn áp dụng giá)
};

/* ---------- HẰNG SỐ DÙNG CHUNG KHÁC ---------- */
// Tên công ty hiển thị trên các phiếu in (Phiếu nhập kho, bảng báo giá xuất Excel...)
const COMPANY_NAME = "CÔNG TY TNHH HOÀNG ANH KHÔI";

/* ---------- CẤU HÌNH HỆ THỐNG XUẤT HÀNG (NL_PC_XH / NL_DH_XB) ---------- */
// Spreadsheet RIÊNG cho phiếu cân xuất hàng (dăm gỗ xuất bán/xuất khẩu) và đơn
// hàng xuất bán - khác với CONFIG (PhieuCan_DN nhập gỗ), BAOGIA_CONFIG và
// KHODAM_CONFIG ở trên.
const XUATHANG_CONFIG = {
  SPREADSHEET_ID: "1ZZ2iUwkkKe8wXdztA7mL-v9j6fmgY5c5rlDdI1sNoAk",
  SHEET_NLPCXH: "NL_PC_XH",             // Dữ liệu phiếu cân xuất hàng CHÍNH THỨC (sau khi duyệt)
  SHEET_NLPCXH_DRAFT: "NL_PC_XH_Draft", // Sheet tạm để xem trước/đối soát trước khi duyệt
  SHEET_DHXB: "NL_DH_XB"                // Đơn hàng xuất bán (nhập liệu tay theo lô/tàu)
};

/* ---------- CẤU HÌNH HỆ THỐNG QUẢN LÝ TỒN KHO DĂM GỖ ---------- */
// Spreadsheet RIÊNG cho module Kho Dăm (khác với CONFIG.SPREADSHEET_ID và
// BAOGIA_CONFIG.SPREADSHEET_ID ở trên) - đã xác nhận với người dùng đây là
// Sheet ĐANG CHẠY THẬT, chứa dữ liệu Nhập/Xuất/Tồn kho dăm gỗ.
// Tên các sheet giữ NGUYÊN như hệ thống gốc để không phải di chuyển dữ liệu.
const KHODAM_CONFIG = {
  SPREADSHEET_ID: "1MQ6eCOKgJyd4t1J84nA24hvkjSTufdH8jhJX-EJTWQU",
  SHEET_GIAODICH: "DATA_GIAODICH",     // Log tất cả phiếu Nhập/Xuất kho
  SHEET_CAUHINH: "SYS_CAUHINH",        // Cấu hình Kỳ Vét Bãi (thời gian hiệu lực + tỷ lệ tiêu hao)
  SHEET_NHAPDOKHO: "Nhapdokho",         // Độ khô/độ ẩm theo ngày, dùng tham chiếu khi nhập Dăm sản xuất
  SHEET_DANHMUCKHO: "SYS_DANHMUCKHO"   // Danh mục Nhà máy / Kho hàng
};

/* ---------- CẤU HÌNH ĐỊNH DẠNG NGÀY/GIỜ/SỐ THEO VÙNG LÃNH THỔ ---------- */
// 1 ĐIỂM CẤU HÌNH DUY NHẤT cho cách HIỂN THỊ ngày/giờ/số khi ghi xuống Google
// Sheet (KHÔNG ảnh hưởng giá trị Date/Number thật bên trong ô - luôn ghi đúng,
// đây chỉ là "lớp áo" hiển thị). Đổi giá trị "MIEN" khi đổi Locale của Sheet
// đích để toàn hệ thống hiển thị nhất quán, không phải sửa rải rác nhiều nơi.
// "VN" = Việt Nam (dd/MM/yyyy). "US" = Hoa Kỳ (MM/dd/yyyy).
// LƯU Ý: token "AM/PM" trong DATETIME_FMT/TIME_FMT được Google Sheets TỰ DỊCH
// theo Locale thật của chính Sheet (Vietnam -> SA/CH, United States -> AM/PM) -
// không phụ thuộc vào giá trị MIEN dưới đây (2 thứ độc lập: MIEN quyết định thứ
// tự ngày/tháng, Locale của Sheet quyết định chữ AM/PM dịch ra gì).
//
// GIỚI HẠN KỸ THUẬT QUAN TRỌNG VỀ SỐ (cần hiểu rõ để không kỳ vọng sai): dấu
// phân cách thập phân/hàng nghìn hiển thị ("." hay ",") do CHÍNH LOCALE của
// từng Google Sheet quyết định - KHÔNG THỂ ép cứng qua mã định dạng như ngày
// tháng, vì Google Sheets tự dịch lại ký tự phân cách trong mọi mẫu định dạng
// số theo Locale, dù mã nguồn viết "#,##0.00" hay kiểu gì khác. Vì vậy phần
// cấu hình số dưới đây chỉ kiểm soát được: (a) SỐ CHỮ SỐ THẬP PHÂN hiển thị,
// (b) có hiển thị dấu phân cách hàng nghìn hay không - còn KÝ TỰ phân cách cụ
// thể vẫn luôn theo đúng Locale thật của Sheet. Để đồng bộ triệt để, cách chắc
// chắn nhất vẫn là đặt đúng Locale (Vietnam/United States) cho từng Sheet đích.
//
// NÂNG CẤP: đổi từ hằng số CỐ ĐỊNH (phải sửa code + deploy lại) sang đọc động
// từ PropertiesService (Cấu hình Script) - cho phép đổi NGAY trên giao diện
// web (menu Hệ thống → Cấu hình hệ thống), áp dụng tức thì, không cần deploy.
// "REGION_FORMAT" giờ là 1 HÀM (gọi kèm dấu ngoặc: REGION_FORMAT()) thay vì 1
// object tĩnh - đã cập nhật toàn bộ nơi sử dụng trong Code.gs.
//
// LƯU Ý: "Số chữ số thập phân" TRƯỚC ĐÂY từng được đưa vào đây như 1 mục cấu
// hình riêng - đã BỎ, vì không thuộc về khái niệm Locale thật (Locale thật chỉ
// quyết định thứ tự ngày/tháng và ký tự phân cách, mà ký tự phân cách thì
// Google Sheets tự dịch theo Locale của chính Sheet, không thể cấu hình qua
// đây được). Số thập phân giờ CỐ ĐỊNH ở mức hợp lý (2 số lẻ), không còn là
// lựa chọn tách rời gắn nhầm vào khái niệm Locale.
const REGION_FORMAT_MAC_DINH = "VN"; // Giá trị mặc định nếu CHƯA từng cấu hình qua giao diện
const SO_THAP_PHAN_CO_DINH = 2;      // Cố định 2 số lẻ cho khối lượng - không cấu hình được, không liên quan Locale

function REGION_FORMAT_() {
  const mien = PropertiesService.getScriptProperties().getProperty("REGION_FORMAT_MIEN") || REGION_FORMAT_MAC_DINH;
  const dateFmt = mien === "VN" ? "dd/MM/yyyy" : "MM/dd/yyyy";
  return {
    MIEN: mien,
    DATE_FMT: dateFmt,
    DATETIME_FMT: dateFmt + " hh:mm:ss AM/PM",
    TIME_FMT: "hh:mm:ss AM/PM",
    SO_NGUYEN_FMT: "#,##0",                                    // số nguyên, có phân cách hàng nghìn (VD: KL Hàng, Cân lần 1/2)
    SO_THAP_PHAN_FMT: "#,##0." + "0".repeat(SO_THAP_PHAN_CO_DINH) // số thập phân cố định 2 số lẻ (VD: Khối lượng Tấn)
  };
}

// Phân tích 1 giá trị số THÔ (có thể là số thật từ ô Excel, hoặc chuỗi text)
// theo ĐÚNG quy ước phân cách của Locale hệ thống đang cấu hình (REGION_FORMAT)
// - đây chính là chỗ QUAN TRỌNG để tránh: (a) hiểu sai giá trị khi ô đến dưới
// dạng text có dấu phân cách hàng nghìn (VD "17.990" kiểu VN nghĩa là 17990,
// nhưng parseFloat thường sẽ hiểu nhầm thành 17.99), và (b) tránh phải regex
// tách số một cách "mù" không biết quy ước nào đang áp dụng.
function parseSoTheoLocale_(rawValue) {
  if (typeof rawValue === "number") return rawValue; // Đã là số thật (ô Excel kiểu Number) - dùng luôn, an toàn tuyệt đối, không phụ thuộc Locale
  let str = String(rawValue == null ? "" : rawValue).trim();
  if (!str) return NaN;
  const mien = REGION_FORMAT_().MIEN;
  if (mien === "VN") {
    // Việt Nam: "." là phân cách hàng nghìn (bỏ đi), "," là dấu thập phân (đổi thành ".")
    str = str.replace(/\./g, "").replace(",", ".");
  } else {
    // United States: "," là phân cách hàng nghìn (bỏ đi), "." là dấu thập phân (giữ nguyên)
    str = str.replace(/,/g, "");
  }
  str = str.replace(/[^0-9.\-]/g, ""); // dọn sạch ký tự lạ còn sót (đơn vị đo, khoảng trắng...)
  return parseFloat(str);
}

/* ---------- ĐỊNH DẠNG HIỂN THỊ TRÊN WEBAPP + MÚI GIỜ HIỂN THỊ (29/09/2026) ----------
 * Tách khỏi "Ghi Google Sheet" (REGION_FORMAT_): webapp chọn VN/US riêng. Chưa từng
 * chọn -> dùng đúng như trước (theo REGION_FORMAT_) nên không đổi gì với hệ thống cũ.
 * MÚI GIỜ chỉ dùng để HIỂN THỊ giờ (webapp + file Excel/PDF xuất ra) - dữ liệu gốc,
 * lọc ngày, kỳ vét bãi, tính giá theo hiệu lực báo giá VẪN theo giờ Việt Nam (GMT+7).
 * Ngày không kèm giờ (VD Ngày cân) không đổi theo múi giờ (tránh nhảy ngày). */
const MUI_GIO_MAC_DINH = "Asia/Ho_Chi_Minh";
const MUI_GIO_CHO_PHEP = [
  { id: "Asia/Ho_Chi_Minh", ten: "(GMT+07:00) Việt Nam - Hồ Chí Minh / Hà Nội" },
  { id: "Asia/Bangkok", ten: "(GMT+07:00) Bangkok" },
  { id: "Asia/Singapore", ten: "(GMT+08:00) Singapore" },
  { id: "Asia/Shanghai", ten: "(GMT+08:00) Trung Quốc" },
  { id: "Asia/Taipei", ten: "(GMT+08:00) Đài Loan" },
  { id: "Asia/Tokyo", ten: "(GMT+09:00) Nhật Bản" },
  { id: "Asia/Seoul", ten: "(GMT+09:00) Hàn Quốc" },
  { id: "Australia/Sydney", ten: "(GMT+10/+11) Sydney" },
  { id: "Asia/Kolkata", ten: "(GMT+05:30) Ấn Độ" },
  { id: "Asia/Dubai", ten: "(GMT+04:00) Dubai" },
  { id: "Europe/London", ten: "(GMT+00/+01) London" },
  { id: "Europe/Paris", ten: "(GMT+01/+02) Paris / Berlin" },
  { id: "America/New_York", ten: "(GMT-05/-04) New York" },
  { id: "America/Chicago", ten: "(GMT-06/-05) Chicago" },
  { id: "America/Los_Angeles", ten: "(GMT-08/-07) Los Angeles" },
  { id: "UTC", ten: "(GMT+00:00) UTC" }
];
function WEBAPP_FORMAT_() {
  const mien = PropertiesService.getScriptProperties().getProperty("WEBAPP_FORMAT_MIEN") || REGION_FORMAT_().MIEN;
  const dateFmt = mien === "US" ? "MM/dd/yyyy" : "dd/MM/yyyy";
  return { MIEN: mien === "US" ? "US" : "VN", DATE_FMT: dateFmt };
}
function MUI_GIO_HIEN_THI_() {
  const tz = PropertiesService.getScriptProperties().getProperty("MUI_GIO_HIEN_THI") || MUI_GIO_MAC_DINH;
  return MUI_GIO_CHO_PHEP.some(function (m) { return m.id === tz; }) ? tz : MUI_GIO_MAC_DINH;
}

/* ---------- CẤU HÌNH RIÊNG CHO BÁO CÁO / KẾT XUẤT MISA ---------- */
// (Giao diện gọi là "Định dạng kết xuất dữ liệu & báo cáo (Excel / PDF / MISA)".)
// TÁCH BIỆT HOÀN TOÀN với REGION_FORMAT ở trên - vì đây là FILE XUẤT/TẢI VỀ
// (Excel/PDF), KHÔNG PHẢI Sheet lưu trữ lâu dài, nên KHÔNG cần đồng bộ với
// Locale thật của bất kỳ Google Sheet nào. Đây chỉ đơn thuần là LỰA CHỌN hiển
// thị của người dùng khi mở file Misa đã xuất ra - đổi tùy ý, không ảnh hưởng
// gì đến việc ghi dữ liệu vào các Sheet khác của hệ thống (PhieuCan_DN, Kho
// Dăm...), và không cần khớp với bất kỳ cài đặt Locale thật nào cả.
const MISA_FORMAT_MAC_DINH = "VN";

function MISA_FORMAT_() {
  const mien = PropertiesService.getScriptProperties().getProperty("MISA_FORMAT_MIEN") || MISA_FORMAT_MAC_DINH;
  const dateFmt = mien === "VN" ? "dd/MM/yyyy" : "MM/dd/yyyy";
  return {
    MIEN: mien,
    DATE_FMT: dateFmt,
    DATETIME_FMT: dateFmt + " hh:mm:ss AM/PM",
    TIME_FMT: "hh:mm:ss AM/PM"
  };
}

// Lấy TOÀN BỘ cấu hình hiện tại (Locale hệ thống + Locale Misa riêng) - dùng
// cho giao diện Cấu hình hệ thống hiển thị đúng trạng thái đang áp dụng.
function HT_layCauHinhVungMien_() {
  try {
    // FIX (phân quyền - phát hiện qua test tự động): hàm này bị BỎ SÓT khi gate
    // quyền Admin cho cả mục "Cấu hình hệ thống" - dù giá trị trả về (VN/US) ít
    // nhạy cảm, vẫn nên nhất quán với các hàm HT_lay*/HT_luu* còn lại trong cùng
    // mục cấu hình (đã chặn Admin-only), tránh 1 điểm hở dù nhỏ.
    const rf = REGION_FORMAT_();
    const mf = MISA_FORMAT_();
    return { status: "success", mien: rf.MIEN, mienMisa: mf.MIEN,
      mienWeb: WEBAPP_FORMAT_().MIEN, muiGio: MUI_GIO_HIEN_THI_(), dsMuiGio: MUI_GIO_CHO_PHEP };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Đọc LOCALE THẬT (Locale THẬT đang cài đặt sẵn trên chính từng Google Sheet,
// qua getSpreadsheetLocale() - KHÁC với "Locale hệ thống" chỉ là lựa chọn của
// webapp) của từng Sheet liên quan đến "Vùng miền chung", để anh đối chiếu
// xem có KHỚP với Locale hệ thống đang chọn hay không - đây chính là cách duy
// nhất để biết chắc có bị lệch hay không, thay vì đoán.
function HT_layLocaleThatCuaSheet_() {
  try {
    const dsSheet = [
      { ten: "PhieuCan_DN", id: CONFIG.SPREADSHEET_ID },
      { ten: "Update_MiSa_PC", id: CONFIG.MISA_DST_ID },
      { ten: "DATA_GIAODICH (Kho Dăm)", id: KHODAM_CONFIG.SPREADSHEET_ID },
      { ten: "NL_DH_XB (Xuất hàng)", id: XUATHANG_CONFIG.SPREADSHEET_ID }
    ];
    const mienDangChon = REGION_FORMAT_().MIEN; // "VN" hoặc "US"
    const ketQua = dsSheet.map(function (sheetInfo) {
      let localeThat = "";
      let loi = "";
      try {
        localeThat = SpreadsheetApp.openById(sheetInfo.id).getSpreadsheetLocale();
      } catch (e) {
        loi = "Không mở được Sheet để kiểm tra: " + e.toString();
      }
      // Quy đổi locale thật (VD "vi_VN", "vi", "en_US", "en_GB"...) về "VN"/"US"/"KHAC"
      // để so sánh với lựa chọn đang chọn trên giao diện.
      let mienThat = "KHAC";
      if (/^vi/i.test(localeThat)) mienThat = "VN";
      else if (/^en_US$/i.test(localeThat) || /^en$/i.test(localeThat)) mienThat = "US";

      const khop = !loi && mienThat === mienDangChon;
      return {
        ten: sheetInfo.ten,
        link: "https://docs.google.com/spreadsheets/d/" + sheetInfo.id + "/edit",
        localeThat: localeThat || "(không xác định)",
        mienThat: mienThat,
        khop: khop,
        loi: loi
      };
    });
    return { status: "success", mienDangChon: mienDangChon, data: ketQua };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Lưu TOÀN BỘ cấu hình mới - áp dụng NGAY LẬP TỨC cho mọi lần ghi Sheet tiếp theo
// mienWeb, muiGio (tùy chọn, 29/09/2026): client cũ không gửi -> giữ nguyên giá trị đang có.
function HT_luuCauHinhVungMien_(mien, mienMisa, mienWeb, muiGio) {
  try {
    const props = PropertiesService.getScriptProperties();
    mien = (String(mien || "").toUpperCase() === "US") ? "US" : "VN";
    mienMisa = (String(mienMisa || "").toUpperCase() === "US") ? "US" : "VN";
    // Kiểm tra TRƯỚC khi ghi: múi giờ sai -> không lưu gì (không lưu dở dang)
    const coMuiGio = muiGio !== undefined && muiGio !== null && muiGio !== "";
    if (coMuiGio && !MUI_GIO_CHO_PHEP.some(function (m) { return m.id === String(muiGio); })) throw new Error("Múi giờ không hợp lệ: " + muiGio);

    props.setProperty("REGION_FORMAT_MIEN", mien);
    props.setProperty("MISA_FORMAT_MIEN", mienMisa);
    if (mienWeb !== undefined && mienWeb !== null && mienWeb !== "") {
      props.setProperty("WEBAPP_FORMAT_MIEN", String(mienWeb).toUpperCase() === "US" ? "US" : "VN");
    }
    if (coMuiGio) props.setProperty("MUI_GIO_HIEN_THI", String(muiGio));
    const ten = function (m) { return m === "VN" ? "Việt Nam (dd/MM/yyyy)" : "United States (MM/dd/yyyy)"; };
    const web = WEBAPP_FORMAT_().MIEN, tz = MUI_GIO_HIEN_THI_();

    logAudit_("CAUHINH_VUNGMIEN", "OK", "Webapp: " + web + ", Múi giờ hiển thị: " + tz + ", Ghi Google Sheet: " + mien + ", Kết xuất Excel/PDF/MISA: " + mienMisa);
    return {
      status: "success",
      message: "✅ Đã lưu cấu hình: Webapp = " + ten(web) + ", Múi giờ hiển thị = " + tz +
        ", Ghi Google Sheet = " + ten(mien) + ", Kết xuất Excel/PDF/MISA = " + ten(mienMisa) +
        ". Tải lại trang (F5) để webapp hiển thị theo cấu hình mới."
    };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

/* ---------- CẤU HÌNH GIÁ TRỊ MẶC ĐỊNH CHO BÁO CÁO MISA NHẬP (Update_MiSa_PC) ---------- */
// TRƯỚC ĐÂY các giá trị này bị HARD-CODE thẳng trong copyDataWithFinalLookup -
// mỗi lần công ty đổi tài khoản kế toán, đơn vị tính, tên hàng hóa mặc định...
// đều phải sửa code + deploy lại. Nay đưa hết vào đây, chỉnh trực tiếp trên
// giao diện Hệ thống → Cấu hình hệ thống, áp dụng ngay từ lần chạy "Tạo dữ
// liệu Misa" tiếp theo, không cần deploy lại.
const MISA_DEFAULTS_MAC_DINH = {
  loaiChungTu: "2",                        // Cột Q (index 16) - mã loại chứng từ Misa
  donViTienTe: "VND",                      // Cột V (index 21) - đơn vị tiền tệ
  maHang: "621A.001",                      // Cột X (index 23) - Mã hàng (*)
  tenHangHoaMacDinh: "Gỗ tròn keo lai CW",  // Cột Y (index 24) - tên hàng hóa mặc định
  taiKhoanChiPhi: "621",                   // Cột AA (index 26) - TK chi phí (đã xác nhận đúng)
  tkCongNoTien: "33111",                   // Cột AB (index 27) - TK công nợ/TK tiền (*)
  donViTinh: "Tấn",                        // Cột AC (index 28) - đơn vị tính
  kmcp: "62111",                           // Cột AD (index 29) - KMCP (Khoản mục chi phí)
  doiTuongTHCP: "155A.001",                // Cột AE (index 30) - Đối tượng THCP (Đối tượng tập hợp chi phí)
  ngayDenHanMacDinh: "31/12/2050"           // Cột I (index 8) - hạn thanh toán mặc định khi CHƯA xác định được từ ĐNTT
};

function MISA_DEFAULTS_() {
  const saved = PropertiesService.getScriptProperties().getProperty("MISA_DEFAULTS_JSON");
  if (!saved) return MISA_DEFAULTS_MAC_DINH;
  try {
    const parsed = JSON.parse(saved);
    return Object.assign({}, MISA_DEFAULTS_MAC_DINH, parsed); // gộp - phòng trường hợp sau này thêm trường mới mà cấu hình cũ chưa có
  } catch (e) { return MISA_DEFAULTS_MAC_DINH; }
}

function HT_layMisaDefaults_() {
  try { return { status: "success", data: MISA_DEFAULTS_() }; } catch (e) { return { status: "error", message: e.toString() }; }
}

function HT_luuMisaDefaults_(data) {
  try {
    data = data || {};
    const d = MISA_DEFAULTS_MAC_DINH;
    const clean = {
      loaiChungTu: String(data.loaiChungTu || d.loaiChungTu).trim(),
      donViTienTe: String(data.donViTienTe || d.donViTienTe).trim(),
      maHang: String(data.maHang || d.maHang).trim(),
      tenHangHoaMacDinh: String(data.tenHangHoaMacDinh || d.tenHangHoaMacDinh).trim(),
      taiKhoanChiPhi: String(data.taiKhoanChiPhi || d.taiKhoanChiPhi).trim(),
      tkCongNoTien: String(data.tkCongNoTien || d.tkCongNoTien).trim(),
      donViTinh: String(data.donViTinh || d.donViTinh).trim(),
      kmcp: String(data.kmcp || d.kmcp).trim(),
      doiTuongTHCP: String(data.doiTuongTHCP || d.doiTuongTHCP).trim(),
      ngayDenHanMacDinh: String(data.ngayDenHanMacDinh || d.ngayDenHanMacDinh).trim()
    };
    PropertiesService.getScriptProperties().setProperty("MISA_DEFAULTS_JSON", JSON.stringify(clean));
    logAudit_("CAUHINH_MISA_DEFAULTS", "OK", JSON.stringify(clean));
    return { status: "success", message: "✅ Đã lưu cấu hình giá trị mặc định Báo cáo Misa. Áp dụng từ lần chạy \'Tạo dữ liệu Misa\' tiếp theo." };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

/* ---------- LIÊN KẾT DỮ LIỆU: ID Spreadsheet/Thư mục có thể đổi qua giao diện ---------- */
// TRƯỚC ĐÂY toàn bộ ID Spreadsheet/Thư mục (CONFIG, BAOGIA_CONFIG,
// KHODAM_CONFIG, XUATHANG_CONFIG ở trên) là hằng số CỐ ĐỊNH - muốn áp dụng dữ
// liệu khác (VD đổi sang Spreadsheet năm tài chính mới, đổi thư mục lưu báo
// cáo...) phải sửa code + deploy lại. Nay có thể GHI ĐÈ trực tiếp trên giao
// diện web (Hệ thống → Cấu hình hệ thống → Liên kết dữ liệu), áp dụng NGAY,
// không cần deploy. Nếu để trống ô ghi đè, hệ thống tự dùng lại giá trị GỐC
// đã khai báo trong code (không bị mất, luôn có thể khôi phục).
const LIENKET_DANH_SACH = [
  { key: "CONFIG_SPREADSHEET_ID", nhom: "CONFIG", truong: "SPREADSHEET_ID", ten: "Spreadsheet Phiếu Cân (PhieuCan_DN)", loai: "sheet" },
  { key: "CONFIG_FOLDER_DONE", nhom: "CONFIG", truong: "FOLDER_DONE", ten: "Thư mục Done (file đã xử lý + báo cáo tự xuất ra)", loai: "folder" },
  { key: "CONFIG_SRC_FILE_ID", nhom: "CONFIG", truong: "SRC_FILE_ID", ten: "Spreadsheet tham chiếu (DM_NG, DM_KH, HD_NCC)", loai: "sheet" },
  { key: "CONFIG_MISA_DST_ID", nhom: "CONFIG", truong: "MISA_DST_ID", ten: "Spreadsheet đích Update_MiSa_PC", loai: "sheet" },
  { key: "CONFIG_DNTT_FILE_ID", nhom: "CONFIG", truong: "DNTT_FILE_ID", ten: "Spreadsheet Đề Nghị Thanh Toán (ĐNTT)", loai: "sheet" },
  { key: "CONFIG_DRAFT_CHUATT_SPREADSHEET_ID", nhom: "CONFIG", truong: "DRAFT_CHUATT_SPREADSHEET_ID", ten: "Spreadsheet Draft Chưa Thanh Toán (PhieuCan_DN_CHUA_TT_DRAFT)", loai: "sheet" },
  { key: "BAOGIA_SPREADSHEET_ID", nhom: "BAOGIA_CONFIG", truong: "SPREADSHEET_ID", ten: "Spreadsheet Báo giá", loai: "sheet" },
  { key: "BAOGIA_BACKUP_FOLDER_ID", nhom: "BAOGIA_CONFIG", truong: "BACKUP_FOLDER_ID", ten: "Thư mục lưu file báo giá xuất ra", loai: "folder" },
  { key: "KHODAM_SPREADSHEET_ID", nhom: "KHODAM_CONFIG", truong: "SPREADSHEET_ID", ten: "Spreadsheet Kho Dăm", loai: "sheet" },
  { key: "XUATHANG_SPREADSHEET_ID", nhom: "XUATHANG_CONFIG", truong: "SPREADSHEET_ID", ten: "Spreadsheet Xuất Hàng (NL_PC_XH, NL_DH_XB)", loai: "sheet" }
];

// Lưu lại giá trị GỐC (trong code) của từng liên kết trước khi có ghi đè - dùng
// để hiển thị "mặc định gốc" và cho phép khôi phục về đúng giá trị này.
const LIENKET_GOC_ = {};
LIENKET_DANH_SACH.forEach(function (item) {
  const obj = item.nhom === "CONFIG" ? CONFIG : item.nhom === "BAOGIA_CONFIG" ? BAOGIA_CONFIG : item.nhom === "KHODAM_CONFIG" ? KHODAM_CONFIG : XUATHANG_CONFIG;
  LIENKET_GOC_[item.key] = obj[item.truong];
});

function _layObjectTheoNhom_(nhom) {
  if (nhom === "CONFIG") return CONFIG;
  if (nhom === "BAOGIA_CONFIG") return BAOGIA_CONFIG;
  if (nhom === "KHODAM_CONFIG") return KHODAM_CONFIG;
  if (nhom === "XUATHANG_CONFIG") return XUATHANG_CONFIG;
  return null;
}

// Áp dụng các ID đã được ghi đè qua giao diện lên đúng object cấu hình tương
// ứng - gọi hàm này ngay khi script được nạp (global scope, cuối file) VÀ gọi
// lại ở đầu doGet() để đảm bảo luôn dùng đúng giá trị mới nhất.
function apDungOverrideLienKet_() {
  // PERF-07: đọc TẤT CẢ thuộc tính 1 lần (hàm này chạy ở MỌI lượt gọi máy chủ) thay vì 10 lần getProperty.
  const tatCa = PropertiesService.getScriptProperties().getProperties() || {};
  LIENKET_DANH_SACH.forEach(function (item) {
    const gtOverride = tatCa["LIENKET_" + item.key];
    if (gtOverride) {
      const obj = _layObjectTheoNhom_(item.nhom);
      if (obj) obj[item.truong] = gtOverride;
    }
  });
}
apDungOverrideLienKet_(); // chạy ngay khi project được nạp

function HT_layLienKetDuLieu_() {
  try {
    const tatCa = PropertiesService.getScriptProperties().getProperties() || {};
    const data = LIENKET_DANH_SACH.map(function (item) {
      const obj = _layObjectTheoNhom_(item.nhom);
      const giaTriHienTai = obj ? String(obj[item.truong] || "") : "";
      const daGhiDe = !!tatCa["LIENKET_" + item.key];
      const link = item.loai === "sheet"
        ? "https://docs.google.com/spreadsheets/d/" + giaTriHienTai + "/edit"
        : "https://drive.google.com/drive/folders/" + giaTriHienTai;
      return { key: item.key, ten: item.ten, loai: item.loai, giaTri: giaTriHienTai, giaTriGoc: LIENKET_GOC_[item.key], daGhiDe: daGhiDe, link: link };
    });
    return { status: "success", data: data };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// overrides = { CONFIG_SPREADSHEET_ID: "...", ... } - để trống 1 trường nghĩa
// là khôi phục lại giá trị GỐC trong code cho đúng trường đó.
function HT_luuLienKetDuLieu_(overrides) {
  try {
    // FIX (NGHIÊM TRỌNG - phân quyền): TRƯỚC ĐÂY hàm này không có bất kỳ kiểm
    // tra quyền nào - bất kỳ ai đăng nhập Google mở được webapp đều có thể đổi
    // ID Spreadsheet/Thư mục CHÍNH của toàn hệ thống, chuyển hướng dữ liệu công
    // ty sang nơi khác. Nay CHỈ ADMIN mới gọi được (chặn cứng ở server, không
    // chỉ ẩn nút trên giao diện).
    overrides = overrides || {};
    const props = PropertiesService.getScriptProperties();
    LIENKET_DANH_SACH.forEach(function (item) {
      const val = String(overrides[item.key] || "").trim();
      // Kiểm tra thô định dạng ID Google (chữ/số/gạch ngang/gạch dưới, đủ dài) -
      // tránh lưu nhầm 1 chuỗi rõ ràng không phải ID hợp lệ (VD dán nhầm cả URL).
      if (val && !/^[a-zA-Z0-9_-]{15,60}$/.test(val)) {
        throw new Error("Giá trị '" + val + "' cho '" + item.ten + "' không giống ID Google hợp lệ (chỉ dán đúng phần ID, không dán cả link đầy đủ).");
      }
      if (val) props.setProperty("LIENKET_" + item.key, val);
      else props.deleteProperty("LIENKET_" + item.key);
    });
    apDungOverrideLienKet_(); // áp dụng ngay trong phiên hiện tại, không cần deploy lại
    logAudit_("CAUHINH_LIENKET", "OK", JSON.stringify(overrides));
    return { status: "success", message: "✅ Đã lưu liên kết dữ liệu, áp dụng ngay lập tức." };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Chia sẻ (Share) quyền Chỉnh sửa TỰ ĐỘNG toàn bộ Spreadsheet/Thư mục Drive
// mà webapp dùng tới (đúng danh sách LIENKET_DANH_SACH ở trên, đã áp dụng
// override nếu có) cho TẤT CẢ tài khoản đang có trong danh sách quyền -
// tránh phải vào Google Drive chia sẻ tay từng file x từng người (dễ sót).
//
// LƯU Ý QUAN TRỌNG: hàm này chỉ chia sẻ được file nào mà người BẤM NÚT (hoặc
// người CHẠY hàm này) đang có quyền "Quản lý chia sẻ" (thường là chủ sở hữu
// - Owner). Nếu các Spreadsheet/Thư mục này do 1 tài khoản KHÁC tạo ra
// (không phải tài khoản Admin đang dùng webapp), cần đăng nhập bằng đúng tài
// khoản chủ sở hữu đó để chạy hàm này (qua nút trên giao diện, hoặc mở thẳng
// trong trình soạn thảo Apps Script rồi bấm Run) - nếu không sẽ thấy lỗi ở
// từng dòng kết quả tương ứng, KHÔNG dừng cả quá trình.
function HT_chiaSeTaiNguyenChoDanhSachQuyen_() {
  try {
    // Người dùng đang Hoạt động (bỏ qua người bị Khóa). Chưa lưu danh sách nào
    // thì dùng Quản trị cố định (như danh sách mặc định trước đây).
    let nguoiDung = DS_QUYEN_().filter(function (u) { return u.email && u.trangThai !== TRANG_THAI_ND.KHOA; })
      .map(function (u) { return { email: u.email, quyenDrive: ND_chuanQuyenDrive_(u.quyenDrive) }; });
    if (!nguoiDung.length) nguoiDung = QUAN_TRI_CO_DINH.map(function (e) { return { email: String(e).toLowerCase(), quyenDrive: "EDITOR" }; });
    if (!nguoiDung.length) return { status: "error", message: "Danh sách quyền đang trống." };

    const taiNguyen = _layDanhSachTaiNguyenDaGopId_();
    const tenQuyenHienThi = { VIEWER: "Xem", COMMENTER: "Bình luận", EDITOR: "Chỉnh sửa" };

    const ketQua = [];
    taiNguyen.forEach(function (tn) {
      // M-14: lấy tài nguyên 1 lần / tài nguyên (trước đây 1 lần / tài nguyên × người dùng).
      let resource = null, loiLay = "";
      try { resource = tn.loai === "folder" ? DriveApp.getFolderById(tn.id) : DriveApp.getFileById(tn.id); } catch (e) { loiLay = e.toString(); }
      nguoiDung.forEach(function (nd) {
        try {
          if (!resource) throw new Error(loiLay);
          if (nd.quyenDrive === "VIEWER") resource.addViewer(nd.email);
          else if (nd.quyenDrive === "COMMENTER") resource.addCommenter(nd.email);
          else resource.addEditor(nd.email);
          ketQua.push({ tenTaiNguyen: tn.ten, email: nd.email, quyenDrive: tenQuyenHienThi[nd.quyenDrive], ok: true });
        } catch (e) {
          ketQua.push({ tenTaiNguyen: tn.ten, email: nd.email, quyenDrive: tenQuyenHienThi[nd.quyenDrive], ok: false, loi: e.toString() });
        }
      });
    });

    const soLoi = ketQua.filter(function (r) { return !r.ok; }).length;
    logAudit_("CHIASE_TAINGUYEN", soLoi === 0 ? "OK" : "MOT_PHAN", JSON.stringify({ soTaiNguyen: taiNguyen.length, soNguoiDung: nguoiDung.length, soLoi: soLoi }));
    return { status: "success", data: ketQua };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Lấy danh sách RÕ RÀNG các tài nguyên đã liệt kê ở trên (Config, deduped bởi ID).
function _layDanhSachTaiNguyenDaGopId_() {
  const taiNguyen = LIENKET_DANH_SACH.map(function (item) {
    const obj = _layObjectTheoNhom_(item.nhom);
    return { ten: item.ten, id: obj ? String(obj[item.truong] || "") : "", loai: item.loai };
  }).filter(function (r) { return r.id; });
  const idDaXuLy = {};
  return taiNguyen.filter(function (tn) {
    if (idDaXuLy[tn.id]) return false;
    idDaXuLy[tn.id] = true;
    return true;
  });
}

// Xem CHÍNH XÁC email nào hiện đang có quyền gì (Chỉnh sửa / Xem-Bình luận)
// trên từng Sheet/Thư mục Drive mà webapp dùng - dùng để rà soát định kỳ (VD
// phát hiện người đã được share tay ngoài ý muốn, hoặc người đã nghỉ việc
// nhưng chưa bị thu hồi quyền). GHI CHÚ: Google Apps Script (DriveApp cơ bản)
// KHÔNG tách riêng được "Xem" và "Bình luận" khi ĐỌC lại quyền hiện có
// (getViewers() gộp chung cả 2 nhóm) - đây là giới hạn của chính API, không
// phải lỗi code.
function HT_layTinhTrangChiaSeTaiNguyen_() {
  try {
    const ketQua = [];
    _layDanhSachTaiNguyenDaGopId_().forEach(function (tn) {
      try {
        const resource = tn.loai === "folder" ? DriveApp.getFolderById(tn.id) : DriveApp.getFileById(tn.id);
        resource.getEditors().forEach(function (u) {
          ketQua.push({ tenTaiNguyen: tn.ten, id: tn.id, loai: tn.loai, email: u.getEmail(), quyen: "Chỉnh sửa", ok: true });
        });
        resource.getViewers().forEach(function (u) {
          ketQua.push({ tenTaiNguyen: tn.ten, id: tn.id, loai: tn.loai, email: u.getEmail(), quyen: "Xem/Bình luận", ok: true });
        });
      } catch (e) {
        ketQua.push({ tenTaiNguyen: tn.ten, id: tn.id, loai: tn.loai, email: "", quyen: "", ok: false, loi: e.toString() });
      }
    });
    return { status: "success", data: ketQua };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Thu hồi quyền Drive của 1 email trên ĐÚNG 1 tài nguyên cụ thể (id/loai lấy
// từ chính dòng do HT_layTinhTrangChiaSeTaiNguyen() trả về).
function HT_thuHoiQuyenTaiNguyen_(id, loai, email) {
  try {
    email = String(email || "").trim().toLowerCase();
    if (!email) return { status: "error", message: "Thiếu email cần thu hồi." };
    const resource = loai === "folder" ? DriveApp.getFolderById(id) : DriveApp.getFileById(id);
    resource.removeEditor(email);
    resource.removeViewer(email); // removeViewer() cũng gỡ luôn quyền Bình luận (DriveApp gộp chung 2 nhóm này)
    logAudit_("THUHOI_QUYEN_TAINGUYEN", "OK", JSON.stringify({ id: id, email: email }));
    return { status: "success", message: "✅ Đã thu hồi quyền của " + email + " trên tài nguyên này." };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Thu hồi TOÀN BỘ quyền Drive của 1 email trên MỌI Sheet/Thư mục webapp dùng
// (dùng khi nhân viên nghỉ việc) - KHÔNG tự động xoá khỏi danh sách quyền
// webapp (làm việc đó ở "Danh sách người dùng được cấp quyền truy cập" phía
// trên + bấm Lưu danh sách) - 2 việc này ĐỘC LẬP: xoá khỏi danh sách quyền
// chỉ chặn đăng nhập webapp, KHÔNG tự thu hồi quyền họ đã có trực tiếp trên
// Google Sheet (họ vẫn mở/sửa được Sheet nếu vào thẳng Google Drive).
function HT_thuHoiToanBoQuyenDriveChoEmail_(email) {
  try {
    email = String(email || "").trim().toLowerCase();
    if (!email) return { status: "error", message: "Thiếu email cần thu hồi." };

    const ketQua = [];
    _layDanhSachTaiNguyenDaGopId_().forEach(function (tn) {
      try {
        const resource = tn.loai === "folder" ? DriveApp.getFolderById(tn.id) : DriveApp.getFileById(tn.id);
        resource.removeEditor(email);
        resource.removeViewer(email);
        ketQua.push({ tenTaiNguyen: tn.ten, ok: true });
      } catch (e) {
        ketQua.push({ tenTaiNguyen: tn.ten, ok: false, loi: e.toString() });
      }
    });
    const soLoi = ketQua.filter(function (r) { return !r.ok; }).length;
    logAudit_("THUHOI_QUYEN_TOANBO", soLoi === 0 ? "OK" : "MOT_PHAN", JSON.stringify({ email: email, soLoi: soLoi }));
    return { status: "success", data: ketQua };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

/* ---------- PHÂN QUYỀN NGƯỜI DÙNG: CỔNG ĐĂNG NHẬP GMAIL ---------- */
// CƠ CHẾ (thay cho cách cũ "chạy dưới tài khoản người dùng" - USER_ACCESSING):
//  - Webapp chạy bằng quyền của tài khoản triển khai (Admin) - appsscript.json
//    executeAs:"USER_DEPLOYING". Nhân viên KHÔNG cần được chia sẻ Google Sheet/
//    Thư mục nào, KHÔNG phải cấp quyền Drive cho script, nên cũng không thể mở
//    thẳng Sheet gốc để sửa/xóa dữ liệu ngoài webapp.
//  - Danh tính người dùng lấy từ "CỔNG ĐĂNG NHẬP": 1 dự án Apps Script RIÊNG,
//    rất nhỏ, triển khai "Execute as: User accessing the web app" - chỉ xin
//    quyền XEM ĐỊA CHỈ EMAIL của người mở cổng (không đụng Sheet/Drive/Gmail).
//    Cổng đọc email Google của người đang mở rồi chuyển về webapp chính kèm
//    "vé" ?cong=... có chữ ký HMAC-SHA256 bằng khóa bí mật chung (chỉ Admin
//    biết), vé hết hạn sau 5 phút và chỉ dùng được 1 lần. Webapp chính kiểm tra
//    chữ ký + hạn + đối chiếu danh sách quyền rồi cấp 1 "mã phiên" (lưu ở
//    CacheService, hết hạn tối đa PHIEN_TOI_DA_MS_).
//  - MỌI lời gọi từ giao diện đều đi qua 1 cổng duy nhất API(maPhien, tenHam,
//    thamSo): kiểm tra phiên + kiểm tra email VẪN còn quyền (thu hồi/khóa có
//    hiệu lực ngay lần gọi kế tiếp) + mức quyền của chức năng theo bảng
//    API_ROUTES (taoApiRoutes_), rồi mới chạy hàm nghiệp vụ.
//  - Hàm nghiệp vụ đều là hàm NỘI BỘ (tên kết thúc "_") nên không gọi thẳng
//    được bằng google.script.run. KHI THÊM CHỨC NĂNG MỚI cho giao diện: viết
//    hàm tenHam_(...) rồi thêm 1 dòng vào taoApiRoutes_ kèm mức quyền.
//
// CÀI ĐẶT 1 LẦN - làm hết trên giao diện, không cần mở trình soạn thảo: chủ
// script mở webapp là vào thẳng (Google cho biết email chủ script), vào Hệ thống
// › Quản lý người dùng › Cổng đăng nhập: bấm "Sao chép mã nguồn" (khóa bí mật tự
// tạo và nằm sẵn trong mã, không ai phải nhớ) → dán vào dự án mới ở script.new →
// Deploy Web app (Execute as: User accessing the web app · Who has access:
// Anyone with Google account) → dán link Web app của Cổng vào ô và Lưu.
//
// 4 vai trò (xem VAI_TRO / QUYEN_THEO_VAI_TRO bên dưới): Quản trị (toàn quyền),
// Tổng hợp (nghiệp vụ + Sao lưu, Nhật ký), Nhân viên (nghiệp vụ hằng ngày), Chỉ
// xem (Dashboard, báo cáo, danh sách, xuất Excel/PDF - chặn cứng ở API()).

// ---- VAI TRÒ & QUYỀN (cùng khuôn với hệ thống ĐNTT) ----
// Vai trò = tổ hợp các MỨC QUYỀN. Mỗi chức năng giao diện gọi được khai báo
// DUY NHẤT 1 lần trong bảng API_ROUTES (taoApiRoutes_) kèm mức quyền cần có.
//  - XEM: Dashboard, báo cáo, danh sách, xuất Excel/PDF.
//  - NGHIEP_VU: import, nhập tay, báo giá, xuất hàng, Kho Dăm.
//  - HE_THONG: Sao lưu dữ liệu, Nhật ký hoạt động.
//  - QUAN_TRI: Cấu hình hệ thống, Liên kết dữ liệu, Người dùng, Chia sẻ Drive, Cổng đăng nhập.
const VAI_TRO = { ADMIN: "ADMIN", TONG_HOP: "TONG_HOP", NHANVIEN: "NHANVIEN", CHIXEM: "CHIXEM" };
const VAI_TRO_NHAN = { ADMIN: "Quản trị", TONG_HOP: "Tổng hợp", NHANVIEN: "Nhân viên", CHIXEM: "Chỉ xem" };
const QUYEN = { XEM: "XEM", NGHIEP_VU: "NGHIEP_VU", HE_THONG: "HE_THONG", QUAN_TRI: "QUAN_TRI" };
const QUYEN_THEO_VAI_TRO = {
  ADMIN: [QUYEN.XEM, QUYEN.NGHIEP_VU, QUYEN.HE_THONG, QUYEN.QUAN_TRI],
  TONG_HOP: [QUYEN.XEM, QUYEN.NGHIEP_VU, QUYEN.HE_THONG],
  NHANVIEN: [QUYEN.XEM, QUYEN.NGHIEP_VU],
  CHIXEM: [QUYEN.XEM]
};
// Quản trị cố định (cùng với CHỦ SCRIPT): LUÔN là Quản trị, không khóa/đổi được
// từ webapp (tránh tự khóa nhầm mình ra ngoài). Thêm/bớt email trực tiếp tại đây.
const QUAN_TRI_CO_DINH = ["saoluucvhak@gmail.com", "phuthuy.apple@gmail.com"];
const TRANG_THAI_ND = { HOAT_DONG: "Hoạt động", KHOA: "Khóa" };

// ---- DANH SÁCH NGƯỜI DÙNG: sheet SYS_NguoiDung trong FILE CHỨA SCRIPT ----
// (file Google Sheet mà dự án Apps Script này gắn vào). Admin sửa trên giao
// diện Hệ thống › Quản lý người dùng (có hiệu lực ngay) hoặc sửa thẳng trên
// sheet (có hiệu lực trong <= 60 giây). Lần đầu tự chuyển danh sách cũ đang
// lưu ở Script Properties (DANH_SACH_QUYEN_JSON) sang sheet.
const ND_SHEET_ = "SYS_NguoiDung";
const ND_HEADERS_ = ["Email", "Họ tên", "Vai trò", "Trạng thái", "Quyền Drive", "Cập nhật lúc", "Cập nhật bởi"];
const ND_CACHE_KEY_ = "sys_nguoi_dung_v1";
const ND_CACHE_GIAY_ = 60;
const ND_PROP_DA_CHUYEN_ = "ND_DA_CHUYEN_SANG_SHEET";

function ND_fileChuaScript_() {
  return SpreadsheetApp.getActive();
}

function ND_sheet_(chiDoc) {
  const ss = ND_fileChuaScript_();
  if (!ss) throw new Error("Không mở được file chứa script (dự án Apps Script chưa gắn vào Google Sheet) - không đọc được danh sách người dùng.");
  let sh = ss.getSheetByName(ND_SHEET_);
  if (!sh && chiDoc) return null;
  if (!sh) {
    sh = ss.insertSheet(ND_SHEET_);
    sh.getRange(1, 1, 1, ND_HEADERS_.length).setValues([ND_HEADERS_]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function ND_chuanVaiTro_(v) {
  const x = String(v || "").trim().toUpperCase();
  return QUYEN_THEO_VAI_TRO[x] ? x : VAI_TRO.NHANVIEN;
}
function ND_chuanTrangThai_(v) {
  return String(v || "").trim() === TRANG_THAI_ND.KHOA ? TRANG_THAI_ND.KHOA : TRANG_THAI_ND.HOAT_DONG;
}
function ND_chuanQuyenDrive_(v) {
  const x = String(v || "").trim().toUpperCase();
  return QUYEN_DRIVE_HOP_LE.indexOf(x) !== -1 ? x : "EDITOR";
}

// Chuyển 1 lần danh sách cũ (Script Properties) sang sheet nếu sheet còn trống.
function ND_chuyenDanhSachCu_(sh) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(ND_PROP_DA_CHUYEN_)) return;
  let cu = [];
  try { cu = JSON.parse(props.getProperty("DANH_SACH_QUYEN_JSON") || "[]"); } catch (e) { cu = []; }
  if (Array.isArray(cu) && cu.length > 0 && sh.getLastRow() <= 1) {
    const now = new Date();
    const dong = cu.filter(function (u) { return u && String(u.email || "").trim(); }).map(function (u) {
      return [String(u.email).trim().toLowerCase(), "", ND_chuanVaiTro_(u.vaiTro), TRANG_THAI_ND.HOAT_DONG, ND_chuanQuyenDrive_(u.quyenDrive), now, "Chuyển từ danh sách cũ"];
    });
    if (dong.length) sh.getRange(2, 1, dong.length, ND_HEADERS_.length).setValues(dong);
  }
  props.setProperty(ND_PROP_DA_CHUYEN_, "1");
}

/** Toàn bộ người dùng trong sheet (kể cả đã Khóa): [{email, hoTen, vaiTro, trangThai, quyenDrive}]. */
// PERF-API-01: xacThucPhien_ đọc sẵn bản cache danh sách người dùng cùng lượt với
// phiên (1 lệnh CacheService.getAll thay vì 2 lệnh get) và để ở đây cho DS_QUYEN_.
let ND_CACHE_DOC_SAN_ = null;
function DS_QUYEN_() {
  if (ND_CACHE_DOC_SAN_) {
    const docSan = ND_CACHE_DOC_SAN_; ND_CACHE_DOC_SAN_ = null;
    try { return JSON.parse(docSan); } catch (e) { /* đọc lại bình thường */ }
  }
  const cache = CacheService.getScriptCache();
  try { const raw = cache.get(ND_CACHE_KEY_); if (raw) return JSON.parse(raw); } catch (e) { /* đọc lại sheet */ }
  // Chỉ ĐỌC: chưa có sheet thì không tạo (trừ khi cần chuyển danh sách cũ sang).
  let sh = ND_sheet_(true);
  if (!sh && !PropertiesService.getScriptProperties().getProperty(ND_PROP_DA_CHUYEN_) &&
      PropertiesService.getScriptProperties().getProperty("DANH_SACH_QUYEN_JSON")) sh = ND_sheet_();
  if (sh) ND_chuyenDanhSachCu_(sh);
  const lr = sh ? sh.getLastRow() : 0;
  const ds = lr > 1 ? sh.getRange(2, 1, lr - 1, ND_HEADERS_.length).getValues().map(function (r) {
    return {
      email: String(r[0] || "").trim().toLowerCase(),
      hoTen: String(r[1] || "").trim(),
      vaiTro: ND_chuanVaiTro_(r[2]),
      trangThai: ND_chuanTrangThai_(r[3]),
      quyenDrive: ND_chuanQuyenDrive_(r[4])
    };
  }).filter(function (u) { return u.email; }) : [];
  try { cache.put(ND_CACHE_KEY_, JSON.stringify(ds), ND_CACHE_GIAY_); } catch (e) { /* bỏ qua */ }
  return ds;
}
function ND_xoaCache_() {
  try { CacheService.getScriptCache().remove(ND_CACHE_KEY_); } catch (e) { /* bỏ qua */ }
}

// Gmail bỏ qua dấu "." và phần "+..." ở tên đăng nhập (nguyen.van.a@gmail.com,
// nguyenvana@gmail.com, NguyenVanA+hak@gmail.com là CÙNG 1 tài khoản) - Admin gõ
// email vào danh sách theo dạng nào cũng phải khớp.
function chuanHoaEmailSoSanh_(email) {
  const e = String(email || "").trim().toLowerCase();
  const m = e.match(/^([^@]+)@(gmail\.com|googlemail\.com)$/);
  if (!m) return e;
  return m[1].split("+")[0].replace(/\./g, "") + "@gmail.com";
}

/** Email chủ script (tài khoản triển khai webapp) - luôn là Quản trị. */
function emailChuScript_() {
  try { return String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase(); } catch (e) { return ""; }
}
function danhSachQuanTriCoDinh_() {
  const ds = QUAN_TRI_CO_DINH.map(function (x) { return String(x).toLowerCase(); });
  const chu = emailChuScript_();
  if (chu && !ds.some(function (x) { return chuanHoaEmailSoSanh_(x) === chuanHoaEmailSoSanh_(chu); })) ds.unshift(chu);
  return ds;
}
function laQuanTriCoDinh_(email) {
  const e = chuanHoaEmailSoSanh_(email);
  return !!e && danhSachQuanTriCoDinh_().some(function (x) { return chuanHoaEmailSoSanh_(x) === e; });
}

/** Người mở webapp mà Google cho biết thẳng email (chủ script; người cùng tên miền
 * Workspace) và có quyền -> được cấp phiên ngay, không cần qua Cổng. Người khác
 * Google không cho biết email (trả rỗng) -> phải đăng nhập qua Cổng. */
function DN_nhanDienTrucTiep_() {
  let email = "";
  try { email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase(); } catch (e) { email = ""; }
  if (!email) return null;
  const nd = timNguoiDungTheoEmail_(email);
  return nd.coQuyen ? nd : null;
}

/** Người dùng + vai trò HIỆU LỰC (null nếu chưa được cấp quyền hoặc đang bị Khóa). */
function timNguoiDungTheoEmail_(email) {
  email = String(email || "").trim().toLowerCase();
  const soSanh = chuanHoaEmailSoSanh_(email);
  const found = email ? DS_QUYEN_().find(function (u) { return chuanHoaEmailSoSanh_(u.email) === soSanh; }) : null;
  let vaiTro = null;
  if (email && laQuanTriCoDinh_(email)) vaiTro = VAI_TRO.ADMIN;
  else if (found && found.trangThai === TRANG_THAI_ND.HOAT_DONG) vaiTro = found.vaiTro;
  return {
    email: email,
    hoTen: found ? found.hoTen : "",
    vaiTro: vaiTro,
    vaiTroNhan: vaiTro ? VAI_TRO_NHAN[vaiTro] : "",
    quyen: vaiTro ? QUYEN_THEO_VAI_TRO[vaiTro].slice() : [],
    coQuyen: !!vaiTro,
    laAdmin: vaiTro === VAI_TRO.ADMIN,
    laChiXem: vaiTro === VAI_TRO.CHIXEM,
    biKhoa: !vaiTro && !!found && found.trangThai === TRANG_THAI_ND.KHOA
  };
}

// Người dùng của lượt thực thi hiện tại - CHỈ được gán bởi API() sau khi đã
// xác thực phiên. Mỗi lời gọi google.script.run là 1 lượt thực thi mới, biến
// toàn cục luôn bắt đầu là null, nên gọi thẳng 1 hàm (không qua API) sẽ không
// có người dùng hợp lệ.
var PHIEN_HIEN_TAI_ = null;

const MA_LOI_PHIEN_ = "PHIEN_HET_HAN: ";
const PHIEN_TOI_DA_MS_ = 12 * 60 * 60 * 1000;   // tối đa 12 giờ kể từ lúc đăng nhập
const PHIEN_CACHE_GIAY_ = 6 * 60 * 60;          // không thao tác 6 giờ thì hết phiên (giới hạn tối đa của CacheService)

function layThongTinNguoiDungHienTai_() {
  return PHIEN_HIEN_TAI_ || { email: "", vaiTro: null, vaiTroNhan: "", quyen: [], coQuyen: false, laAdmin: false, laChiXem: false };
}

// Dòng đầu tiên của MỌI hàm công khai (xem giải thích ở đầu mục này).
function yeuCauPhien_() {
  if (!PHIEN_HIEN_TAI_ || !PHIEN_HIEN_TAI_.coQuyen) {
    throw new Error(MA_LOI_PHIEN_ + "Chưa đăng nhập hoặc phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  }
  return PHIEN_HIEN_TAI_;
}

// Lỗi thiếu quyền: giao diện chỉ báo lỗi, KHÔNG đưa về màn đăng nhập (khác MA_LOI_PHIEN_).
const MA_LOI_QUYEN_ = "[QUYEN] ";
/** Chặn nếu người thao tác không có mức quyền `quyen` (QUYEN.*). */
function yeuCauQuyen_(quyen) {
  const nd = yeuCauPhien_();
  if (!nd.quyen || nd.quyen.indexOf(quyen) === -1) {
    throw new Error(MA_LOI_QUYEN_ + "Tài khoản " + nd.email + " (" + (nd.vaiTroNhan || "chưa có vai trò") + ") không có quyền thực hiện thao tác này.");
  }
  return nd;
}

function HT_layThongTinNguoiDungHienTai_() {
  try { return { status: "success", data: layThongTinNguoiDungHienTai_() }; } catch (e) { return { status: "error", message: e.toString() }; }
}

/* ----- Cấu hình Cổng đăng nhập ----- */
const KHOA_CONG_PROP_ = "CONG_DN_KHOA_BI_MAT";   // khóa ký vé, chung giữa Cổng và webapp chính
const LINK_CONG_PROP_ = "CONG_DN_LINK";          // link /exec của Cổng (nút "Đăng nhập" trỏ tới)
const VE_CONG_HIEU_LUC_MS_ = 5 * 60 * 1000;

function layKhoaCong_() {
  return String(PropertiesService.getScriptProperties().getProperty(KHOA_CONG_PROP_) || "");
}

function taoKhoaCongMoi_() {
  const khoa = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "").toLowerCase();
  PropertiesService.getScriptProperties().setProperty(KHOA_CONG_PROP_, khoa);
  return khoa;
}

function layLinkCong_() {
  return String(PropertiesService.getScriptProperties().getProperty(LINK_CONG_PROP_) || "").trim();
}

function daCauHinhDangNhap_() { return !!layKhoaCong_(); }

// URL /exec của CHÍNH webapp này - Cổng chỉ chuyển vé về đúng địa chỉ này.
// Nếu tự nhận diện sai (VD ra link /dev), đặt thuộc tính tập lệnh
// LINK_WEBAPP_CHINH bằng đúng URL /exec rồi lấy lại mã nguồn Cổng.
function layLinkWebappChinh_() {
  const ghiDe = String(PropertiesService.getScriptProperties().getProperty("LINK_WEBAPP_CHINH") || "").trim();
  if (ghiDe) return ghiDe;
  try { return ScriptApp.getService().getUrl() || ""; } catch (e) { return ""; }
}

function laLinkWebAppHopLe_(url) {
  return /^https:\/\/script\.google\.com\/(macros|a\/macros\/[^\/\s?#]+)\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(url || ""));
}

// Mã nguồn đầy đủ của dự án Cổng (dán nguyên vào Code.gs của dự án mới).
function taoMaNguonCong_(khoa, linkChinh) {
  return [
    '/**',
    ' * CỔNG ĐĂNG NHẬP GMAIL - HỆ THỐNG QUẢN LÝ HAKGROUP',
    ' * Dự án Apps Script RIÊNG, chỉ làm 1 việc: đọc email Google của người đang',
    ' * mở cổng rồi chuyển vào webapp chính kèm "vé" có chữ ký (hết hạn sau 5',
    ' * phút, dùng 1 lần). KHÔNG đọc/ghi Sheet, Drive hay Gmail nào.',
    ' *',
    ' * Triển khai: Deploy > New deployment > Web app',
    ' *   - Execute as:      User accessing the web app',
    ' *   - Who has access:  Anyone with Google account',
    ' * GIỮ BÍ MẬT mã này (có KHOA_BI_MAT): không gửi cho ai, không chia sẻ dự án.',
    ' * Ai có KHOA_BI_MAT đều giả mạo được đăng nhập của bất kỳ email nào.',
    ' */',
    'const LINK_WEBAPP_CHINH = ' + JSON.stringify(linkChinh) + ';',
    'const KHOA_BI_MAT = ' + JSON.stringify(khoa) + ';',
    '',
    'function doGet() {',
    '  const email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();',
    '  if (!email) {',
    '    return trang_("Không đọc được email Google", "Hãy đăng nhập Google rồi mở lại link này. Nếu trình duyệt đang đăng nhập NHIỀU tài khoản Google, hãy dùng cửa sổ ẩn danh (hoặc 1 hồ sơ Chrome riêng) chỉ đăng nhập đúng tài khoản được cấp quyền.", "");',
    '  }',
    '  const than = Utilities.base64EncodeWebSafe(JSON.stringify({ v: 1, e: email, x: Date.now() + 5 * 60 * 1000, n: Utilities.getUuid() }));',
    '  const chuKy = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(than, KHOA_BI_MAT));',
    '  const link = LINK_WEBAPP_CHINH + "?cong=" + encodeURIComponent(than + "." + chuKy);',
    '  return trang_("Xin chào " + email, "Bấm nút dưới đây để vào hệ thống (liên kết có hiệu lực 5 phút).", link);',
    '}',
    '',
    'function trang_(tieuDe, noiDung, link) {',
    '  const esc = function (x) { return String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };',
    '  let html = \'<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:60px auto;padding:28px;border:1px solid #DCE0D8;border-radius:12px;text-align:center;color:#1E211C;">\' +',
    '    \'<h2 style="color:#1B4332;margin-top:0;">\' + esc(tieuDe) + \'</h2><p>\' + esc(noiDung) + \'</p>\';',
    '  if (link) {',
    '    html += \'<a href="\' + esc(link) + \'" target="_top" style="display:inline-block;margin-top:10px;padding:12px 26px;background:#1B4332;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">➡️ Vào hệ thống HAKGROUP</a>\' +',
    '      \'<script>try { window.top.location.href = \' + JSON.stringify(link).replace(/</g, "\\\\u003c") + \'; } catch (e) {}<\\/script>\';',
    '  }',
    '  html += \'<p style="font-size:12px;color:#5B6259;margin-top:18px;">Muốn đăng nhập bằng tài khoản khác: đăng xuất Google hoặc mở link Cổng trong cửa sổ ẩn danh.</p></div>\';',
    '  return HtmlService.createHtmlOutput(html).setTitle("Đăng nhập HAKGROUP");',
    '}',
    ''
  ].join("\n");
}

/* ----- Phiên đăng nhập ----- */
function taoPhien_(email) {
  const ma = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "").toLowerCase();
  CacheService.getScriptCache().put("phien_" + ma, JSON.stringify({ email: email, taoLuc: Date.now() }), PHIEN_CACHE_GIAY_);
  return ma;
}

const PHIEN_GIA_HAN_SAU_MS_ = 10 * 60 * 1000;    // gia hạn trượt tối đa 1 lần / 10 phút
function xacThucPhien_(maPhien) {
  const ma = String(maPhien || "");
  if (!/^[a-f0-9]{64}$/.test(ma)) throw new Error(MA_LOI_PHIEN_ + "Chưa đăng nhập.");
  const cache = CacheService.getScriptCache();
  let raw = null;
  try {
    const got = cache.getAll(["phien_" + ma, ND_CACHE_KEY_]) || {};
    raw = got["phien_" + ma] || null;
    ND_CACHE_DOC_SAN_ = got[ND_CACHE_KEY_] || null;
  } catch (e) { raw = cache.get("phien_" + ma); }
  if (!raw) throw new Error(MA_LOI_PHIEN_ + "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  let phien;
  try { phien = JSON.parse(raw); } catch (e) { cache.remove("phien_" + ma); throw new Error(MA_LOI_PHIEN_ + "Phiên đăng nhập không hợp lệ."); }
  if (Date.now() - Number(phien.taoLuc || 0) > PHIEN_TOI_DA_MS_) {
    cache.remove("phien_" + ma);
    throw new Error(MA_LOI_PHIEN_ + "Phiên đăng nhập đã hết hạn (quá 12 giờ), vui lòng đăng nhập lại.");
  }
  // Kiểm tra lại danh sách quyền MỖI lần gọi: Admin xóa ai khỏi danh sách thì
  // người đó bị chặn ngay từ thao tác kế tiếp, không phải chờ phiên hết hạn.
  const nd = timNguoiDungTheoEmail_(phien.email);
  ND_CACHE_DOC_SAN_ = null; // chỉ dùng cho đúng lần tra cứu trên
  if (!nd.coQuyen) {
    cache.remove("phien_" + ma);
    throw new Error(MA_LOI_PHIEN_ + "Tài khoản " + nd.email + (nd.biKhoa ? " đã bị khóa." : " không còn trong danh sách được cấp quyền."));
  }
  // Gia hạn trượt khi còn thao tác. PERF-API-01: chỉ ghi lại cache khi lần gia hạn
  // trước đã quá 10 phút (hết hạn khi không thao tác: 5 giờ 50 phút - 6 giờ,
  // thay vì đúng 6 giờ) - bớt 1 lệnh CacheService ở hầu hết các lời gọi.
  const giaHanLuc = Number(phien.giaHanLuc || phien.taoLuc || 0);
  if (Date.now() - giaHanLuc > PHIEN_GIA_HAN_SAU_MS_) {
    phien.giaHanLuc = Date.now();
    cache.put("phien_" + ma, JSON.stringify(phien), PHIEN_CACHE_GIAY_);
  }
  return nd;
}

// ============================================================
// BẢNG PHÂN QUYỀN DUY NHẤT (taoApiRoutes_): tên chức năng (giao diện gọi qua API) -> hàm nội
// bộ + mức quyền cần có. Chức năng KHÔNG có trong bảng thì KHÔNG gọi được từ
// giao diện. Hàm nghiệp vụ đều là hàm nội bộ (tên kết thúc "_") nên trình
// duyệt cũng không gọi thẳng được bằng google.script.run.
// Thêm chức năng mới: viết hàm tenHam_(...) rồi thêm 1 dòng vào bảng này.
// ============================================================
// Dựng bảng ở lần gọi đầu tiên (không dựng lúc nạp file): Config.gs được nạp
// TRƯỚC Code.gs nên lúc đó các hàm nghiệp vụ trong Code.gs chưa tồn tại.
let _API_ROUTES_CACHE_ = null;
function API_ROUTES_() {
  if (!_API_ROUTES_CACHE_) _API_ROUTES_CACHE_ = taoApiRoutes_();
  return _API_ROUTES_CACHE_;
}
function taoApiRoutes_() {
  const X = QUYEN.XEM, N = QUYEN.NGHIEP_VU, H = QUYEN.HE_THONG, Q = QUYEN.QUAN_TRI;
  const r = function (fn, quyen) { return { fn: fn, quyen: quyen }; };
  // M-08: thao tác TẠO MỚI - chống tạo trùng khi bấm lại / mất mạng (xem API()).
  const rTao = function (fn, quyen) { return { fn: fn, quyen: quyen, chongTrung: true }; };
  // Mỗi thao tác của processFormData (Kho Dăm) 1 mức quyền riêng.
  const rTheoThaoTac = function (fn, quyenTheoThaoTac) { return { fn: fn, quyenTheoThaoTac: quyenTheoThaoTac, chongTrung: true }; };
  return {
    // --- Chung: người dùng, Dashboard ---
    HT_layThongTinNguoiDungHienTai: r(HT_layThongTinNguoiDungHienTai_, X),
    HT_layDashboard: r(HT_layDashboard_, X),

    // --- Báo cáo nhập kho + Misa (xem, xuất file) ---
    getFilterOptions: r(getFilterOptions_, X),
    // ARCH-02: bản cho giao diện - tổng cộng đủ, chỉ gửi tối đa BC_TOI_DA_DONG_WEB_ dòng
    // mới nhất (Xuất Excel/PDF và Dashboard vẫn dùng bản đầy đủ).
    getBaoCaoTongHop: r(function (f) { return BC_gioiHanDongWeb_(getBaoCaoTongHop_(f), "ngayCan1"); }, X),
    getBaoCaoMisa: r(function (f) { return BC_gioiHanDongWeb_(getBaoCaoMisa_(f), "ngay"); }, X),
    getBaoCaoDonGia: r(function (f) { return BC_gioiHanDongWeb_(getBaoCaoDonGia_(f), "ngayCan1"); }, X),
    exportBaoCaoTongHopExcel: r(exportBaoCaoTongHopExcel_, X),
    exportBaoCaoTongHopPDF: r(exportBaoCaoTongHopPDF_, X),
    exportBaoCaoMisaExcel: r(exportBaoCaoMisaExcel_, X),
    exportBaoCaoMisaPDF: r(exportBaoCaoMisaPDF_, X),
    exportBaoCaoDonGiaExcel: r(exportBaoCaoDonGiaExcel_, X),
    exportBaoCaoDonGiaPDF: r(exportBaoCaoDonGiaPDF_, X),
    exportPhieuCanPDF: r(exportPhieuCanPDF_, X),

    // --- Tra cứu phiếu cân nhập/xuất + chi tiết (chỉ đọc) ---
    TC_traCuuPhieuNhap: r(TC_traCuuPhieuNhap_, X),
    TC_chiTietPhieuNhap: r(TC_chiTietPhieuNhap_, X),
    TC_traCuuPhieuXuat: r(TC_traCuuPhieuXuat_, X),
    TC_chiTietPhieuXuat: r(TC_chiTietPhieuXuat_, X),
    // Sửa Khách hàng/Đại lý/Nguồn gốc + tính lại giá phiếu chưa "OK" (nghiệp vụ)
    TC_suaPhieuNhap: r(TC_suaPhieuNhap_, N),
    TC_tinhLaiGiaPhieu: r(TC_tinhLaiGiaPhieu_, N),
    TC_tinhLaiGiaTheoBoLoc: r(TC_tinhLaiGiaTheoBoLoc_, N),
    TC_tinhLaiGiaCacPhieu: r(TC_tinhLaiGiaCacPhieu_, N),

    // --- Báo cáo xuất hàng (xem, xuất file) ---
    XH_getBaoCaoXuatQuaCan: r(XH_getBaoCaoXuatQuaCan_, X),
    XH_getBaoCaoXuatMisa: r(XH_getBaoCaoXuatMisa_, X),
    XH_exportBaoCaoXuatQuaCanExcel: r(XH_exportBaoCaoXuatQuaCanExcel_, X),
    XH_exportBaoCaoXuatQuaCanPDF: r(XH_exportBaoCaoXuatQuaCanPDF_, X),
    XH_exportBaoCaoXuatMisaExcel: r(XH_exportBaoCaoXuatMisaExcel_, X),
    XH_getDonHangList: r(XH_getDonHangList_, X),
    XH_getDonHangByRow: r(XH_getDonHangByRow_, X),
    XH_getKhoXuatList: r(XH_getKhoXuatList_, X),
    XH_tinhDoKhoNhaMay: r(XH_tinhDoKhoNhaMay_, X),

    // --- Báo giá: xem ---
    BG_getMaBaoGiaList: r(BG_getMaBaoGiaList_, X),
    BG_getMaKLList: r(BG_getMaKLList_, X),
    BG_getQuoteList: r(BG_getQuoteList_, X),
    BG_getQuoteListWithStatus: r(BG_getQuoteListWithStatus_, X),
    BG_getQuoteDetail: r(BG_getQuoteDetail_, X),
    BG_getBaogiaRowByHash: r(BG_getBaogiaRowByHash_, X),
    BG_exportFileSmart: r(BG_exportFileSmart_, X),
    // Dựng lại bảng "Còn hiệu lực"/"Toàn bộ" từ dữ liệu báo giá gốc để XEM (không đổi dữ liệu nhập).
    BG_updateHieuLuc: r(BG_updateHieuLuc_, X),
    BG_showAllData: r(BG_showAllData_, X),

    // --- Kho Dăm: xem ---
    getDataForGiaoDichForm: r(getDataForGiaoDichForm_, X),
    layBaoCaoTonKho: r(layBaoCaoTonKho_, X),
    layDanhSachDanhMucKho: r(layDanhSachDanhMucKho_, X),
    layDanhSachDoKhoTheoBoLoc: r(layDanhSachDoKhoTheoBoLoc_, X),
    layDanhSachKyVetBai: r(layDanhSachKyVetBai_, X),
    // M-09: báo cáo chỉ đọc - gọi thẳng, KHÔNG qua processFormData (vốn giữ khóa toàn hệ thống).
    layBaoCaoTheoKyVetBai: r(layBaoCaoTheoKyVetBai_, X),

    // --- Nhập liệu phiếu cân (nghiệp vụ) ---
    step1_PreviewDraft: r(step1_PreviewDraft_, N),
    step1_ConfirmImport: rTao(step1_ConfirmImport_, N),
    addManualPhieuCan: rTao(addManualPhieuCan_, N),
    taoFileMauPhieuCan: r(taoFileMauPhieuCan_, N),
    taoFileMauXuatHang: r(taoFileMauXuatHang_, N),
    runCreateMisaData: r(runCreateMisaData_, N),
    downloadMisaExcel: r(downloadMisaExcel_, N),

    // --- Báo giá: nhập/sửa/xóa (nghiệp vụ) ---
    BG_addMaBaoGia: rTao(BG_addMaBaoGia_, N),
    BG_deleteMaBaoGia: r(BG_deleteMaBaoGia_, N),
    BG_addMaKL: rTao(BG_addMaKL_, N),
    BG_deleteMaKL: r(BG_deleteMaKL_, N),
    BG_createQuote: rTao(BG_createQuote_, N),
    BG_deleteQuote: r(BG_deleteQuote_, N),
    BG_updateBaogiaRow: r(BG_updateBaogiaRow_, N),
    BG_deleteBaogiaRow: r(BG_deleteBaogiaRow_, N),

    // --- Xuất hàng: nhập/sửa/xóa (nghiệp vụ) ---
    XH_step1_PreviewDraft: r(XH_step1_PreviewDraft_, N),
    XH_step1_ConfirmImport: rTao(XH_step1_ConfirmImport_, N),
    XH_saveDonHang: rTao(XH_saveDonHang_, N),
    XH_updateDonHang: r(XH_updateDonHang_, N),
    XH_deleteDonHang: r(XH_deleteDonHang_, N),

    // --- Kho Dăm: ghi dữ liệu (có khóa + nhật ký) ---
    xuLyNhapSanPhamSanXuat: r(xuLyNhapSanPhamSanXuat_, N),
    processFormData: rTheoThaoTac(processFormData_, {
      Danhmuckho: N, Thongsokho: N, Nhapdokho: N, Nhapkho: N, Xuatkho: N,
      Hoanthanhdonhang: N, HoanthanhTuDong: N,
      Baocaotonkho: X, BaocaoKyVetBai: X
    }),

    // --- Hệ thống: Sao lưu, Nhật ký hoạt động (Quản trị + Tổng hợp) ---
    HT_layTinhTrangSaoLuu: r(HT_layTinhTrangSaoLuu_, H),
    HT_layGiamSat: r(HT_layGiamSat_, H), // Giám sát lỗi 24h + sao lưu trên Dashboard
    HT_luuCauHinhSaoLuu: r(HT_luuCauHinhSaoLuu_, H),
    HT_saoLuuNgay: r(HT_saoLuuNgay_, H),
    HT_guiEmailThu: r(HT_guiEmailThu_, H),   // Đợt sửa 4 (tiếp 4)
    HT_layNhatKy: r(HT_layNhatKy_, H),
    HT_xuatNhatKyExcel: r(HT_xuatNhatKyExcel_, H),

    // --- Cấu hình hệ thống (Quản trị) ---
    HT_layCauHinhVungMien: r(HT_layCauHinhVungMien_, Q),
    HT_luuCauHinhVungMien: r(HT_luuCauHinhVungMien_, Q),
    HT_layLocaleThatCuaSheet: r(HT_layLocaleThatCuaSheet_, Q),
    HT_xacNhanCauTrucSheetHienTai: r(HT_xacNhanCauTrucSheetHienTai_, Q),
    HT_layLienKetDuLieu: r(HT_layLienKetDuLieu_, Q),
    HT_luuLienKetDuLieu: r(HT_luuLienKetDuLieu_, Q),
    HT_layMisaDefaults: r(HT_layMisaDefaults_, Q),
    HT_luuMisaDefaults: r(HT_luuMisaDefaults_, Q),

    // --- Người dùng, Chia sẻ Drive, Cổng đăng nhập (Quản trị) ---
    HT_layDanhSachQuyen: r(HT_layDanhSachQuyen_, Q),
    HT_luuDanhSachQuyen: r(HT_luuDanhSachQuyen_, Q),
    HT_chiaSeTaiNguyenChoDanhSachQuyen: r(HT_chiaSeTaiNguyenChoDanhSachQuyen_, Q),
    HT_layTinhTrangChiaSeTaiNguyen: r(HT_layTinhTrangChiaSeTaiNguyen_, Q),
    HT_thuHoiQuyenTaiNguyen: r(HT_thuHoiQuyenTaiNguyen_, Q),
    HT_thuHoiToanBoQuyenDriveChoEmail: r(HT_thuHoiToanBoQuyenDriveChoEmail_, Q),
    HT_layCauHinhCong: r(HT_layCauHinhCong_, Q),
    HT_layMaNguonCong: r(HT_layMaNguonCong_, Q),
    HT_luuLinkCong: r(HT_luuLinkCong_, Q),
    HT_doiKhoaCong: r(HT_doiKhoaCong_, Q)
  };
}

/** CỬA VÀO DUY NHẤT cho giao diện: kiểm tra phiên + quyền theo API_ROUTES rồi
 * gọi đúng hàm nội bộ đã đăng ký.
 * maYeuCau (tùy chọn, M-08): mã do trình duyệt sinh cho 1 lần bấm; gửi lại CÙNG mã
 * khi bấm lại cùng dữ liệu (sau mất mạng / bấm 2 lần) -> không chạy lần 2. */
function API(maPhien, tenHam, thamSo, maYeuCau) {
  const ten = String(tenHam || "");
  const routes = API_ROUTES_();
  const route = Object.prototype.hasOwnProperty.call(routes, ten) ? routes[ten] : null;
  if (!route) throw new Error("Chức năng không tồn tại: " + ten);
  const args = Array.isArray(thamSo) ? thamSo : [];
  PHIEN_HIEN_TAI_ = xacThucPhien_(maPhien);
  const quyen = route.quyenTheoThaoTac
    ? (Object.prototype.hasOwnProperty.call(route.quyenTheoThaoTac, String(args[0])) ? route.quyenTheoThaoTac[String(args[0])] : null)
    : route.quyen;
  if (!quyen) throw new Error("Thao tác không tồn tại: " + ten + " / " + String(args[0]));
  yeuCauQuyen_(quyen);
  // Đợt sửa 4 (tiếp 5) - GIÁM SÁT HIỆU NĂNG: đo thời gian từng lượt gọi; chậm quá
  // API_CHAM_MS_ thì ghi Nhật ký "API_CHAM" = WARNING (tự hiện ở khung Giám sát
  // 24 giờ trên Dashboard). Chỉ ghi khi chậm -> không thêm lượt ghi sheet cho
  // lượt gọi bình thường. Không đổi kết quả / lỗi trả về.
  const batDau = Date.now();
  try {
    if (route.chongTrung && /^[A-Za-z0-9-]{16,64}$/.test(String(maYeuCau || ""))) {
      return chayChongTrung_(PHIEN_HIEN_TAI_.email, ten, String(maYeuCau), function () { return route.fn.apply(null, args); });
    }
    return chuyenLinkXuatThanhFile_(route.fn.apply(null, args));
  } finally {
    ghiNhanApiCham_(ten, Date.now() - batDau);
  }
}

const API_CHAM_MS_ = 30000;
// Chức năng vốn chạy lâu theo thiết kế (sao lưu toàn bộ 1–3 phút) - không tính là chậm.
const API_CHAM_BO_QUA_ = { HT_saoLuuNgay: true };
function ghiNhanApiCham_(tenHam, ms) {
  if (!(ms >= API_CHAM_MS_) || API_CHAM_BO_QUA_[tenHam]) return false;
  try { logAudit_("API_CHAM", "WARNING", tenHam + " chạy " + Math.round(ms / 100) / 10 + " giây (ngưỡng " + API_CHAM_MS_ / 1000 + " giây)"); } catch (e) { /* bỏ qua */ }
  return true;
}

// M-08 - CHỐNG TẠO TRÙNG: đánh dấu "đang xử lý" theo (người dùng + mã yêu cầu) trước
// khi chạy; chạy THÀNH CÔNG thì lưu kết quả 10 phút. Cùng mã gửi lại: đang chạy -> báo
// chờ; đã xong -> trả lại kết quả cũ (không ghi thêm). Chạy lỗi -> xóa dấu để thử lại được.
const YC_DANG_XU_LY_ = "__DANG_XU_LY__";
function laKetQuaThanhCong_(kq) {
  if (typeof kq === "string") return kq.indexOf("❌") !== 0 && kq.indexOf("⚠️TRUNG_LAP_TP::") !== 0;
  return !!kq && kq.status === "success";
}
function chayChongTrung_(email, tenHam, maYeuCau, viec) {
  const cache = CacheService.getScriptCache();
  const khoa = "yc_" + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, email + "|" + tenHam + "|" + maYeuCau));
  const daCo = cache.get(khoa);
  if (daCo === YC_DANG_XU_LY_) {
    const tb = "Yêu cầu này đang được xử lý (có thể vừa bấm 2 lần) - vui lòng chờ kết quả, không cần bấm lại.";
    return tenHam === "processFormData" ? "❌ " + tb : { status: "error", message: tb };
  }
  if (daCo) {
    try {
      const cu = JSON.parse(daCo);
      const note = " (Yêu cầu này đã được lưu trước đó - không lưu lần 2.)";
      if (typeof cu === "string") return cu + note;
      if (cu && typeof cu.message === "string") cu.message += note;
      return cu;
    } catch (e) { /* hỏng -> chạy lại bình thường */ }
  }
  cache.put(khoa, YC_DANG_XU_LY_, 600);
  let kq;
  try { kq = viec(); }
  catch (e) { cache.remove(khoa); throw e; }
  if (laKetQuaThanhCong_(kq)) {
    try { const json = JSON.stringify(kq); if (json.length < 90000) cache.put(khoa, json, 600); else cache.remove(khoa); } catch (e) { cache.remove(khoa); }
  } else cache.remove(khoa);
  return chuyenLinkXuatThanhFile_(kq);
}

// Các chức năng Xuất Excel/PDF trả về link docs.google.com/.../export của file
// tạm vừa tạo. File đó nằm trong Drive của tài khoản Admin (webapp chạy bằng
// quyền Admin), nhân viên mở link sẽ bị Google báo "cần quyền truy cập". Máy
// chủ tải sẵn nội dung file (bằng quyền Admin) rồi gửi kèm trong kết quả để
// trình duyệt tự tải xuống - không phải chia sẻ file cho ai. Chỉ áp dụng cho
// link do chính các hàm xuất của hệ thống trả về (không nhận link từ giao diện).
function chuyenLinkXuatThanhFile_(kq) {
  if (!kq || typeof kq !== "object" || typeof kq.url !== "string") return kq;
  const m = kq.url.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)\/export\?(.*)$/);
  if (!m) return kq;
  try {
    // FIX (file xuất TRỐNG): Apps Script gom các lệnh ghi SpreadsheetApp lại, chưa ghi
    // thật vào file. Tải qua link export NGAY sau khi ghi có thể nhận bản CHƯA có dữ
    // liệu (file Excel/PDF trống trơn, rõ nhất ở file MISA nhiều cột). Ép ghi xong
    // mọi thay đổi đang chờ trước khi tải.
    SpreadsheetApp.flush();
    const laPdf = /(^|&)format=pdf(&|$)/.test(m[2]);
    const res = UrlFetchApp.fetch(kq.url, {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) throw new Error("HTTP " + res.getResponseCode());
    let tenFile = "tai-ve";
    let fileTam = null;
    try { fileTam = DriveApp.getFileById(m[1]); tenFile = fileTam.getName(); } catch (e) { /* giữ tên mặc định */ }
    const out = {};
    for (const k in kq) out[k] = kq[k];
    out.fileBase64 = Utilities.base64Encode(res.getBlob().getBytes());
    out.fileName = tenFile + (laPdf ? ".pdf" : ".xlsx");
    out.mimeType = laPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    // FIX M-01: file Google Sheet TẠM (tạo trong thư mục Done chỉ để xuất) - đã tải về
    // thành công thì chuyển vào Thùng rác (khôi phục được 30 ngày). File báo giá xuất
    // vào thư mục lưu báo giá (BACKUP_FOLDER_ID) là bản lưu có chủ đích -> giữ nguyên.
    // Tải lỗi -> không tới đây, file được giữ để giao diện mở link như cũ.
    try { if (fileTam && laFileTamXuat_(fileTam)) fileTam.setTrashed(true); } catch (e) { /* không làm hỏng việc tải */ }
    return out;
  } catch (e) {
    logAudit_("XUAT_FILE", "ERROR", "Không tải được file xuất: " + e);
    return kq; // giao diện sẽ mở link như cũ (vẫn dùng được với tài khoản Admin)
  }
}

// File tạm của chức năng xuất: Google Sheet nằm trong thư mục Done, tên theo mẫu
// các hàm xuất tạo ra (không đụng file Excel gốc đã import cũng nằm ở Done).
const TIEN_TO_FILE_TAM_XUAT_ = ["BaoCao_", "PhieuNhapKho_", "Misa_Export_", "Mau_Import_", "NhatKy_HoatDong_"];
function laTenFileTamXuat_(ten) {
  ten = String(ten || "");
  return TIEN_TO_FILE_TAM_XUAT_.some(function (p) { return ten.indexOf(p) === 0; });
}
function laFileTamXuat_(file) {
  if (file.getMimeType() !== MimeType.GOOGLE_SHEETS || !laTenFileTamXuat_(file.getName())) return false;
  const it = file.getParents();
  while (it.hasNext()) { if (it.next().getId() === CONFIG.FOLDER_DONE) return true; }
  return false;
}

/* ----- Luồng đăng nhập qua Cổng (không cần phiên) ----- */
function DN_layLinkDangNhap() {
  try {
    if (!daCauHinhDangNhap_()) return { status: "error", message: "Hệ thống chưa cài Cổng đăng nhập. Quản trị viên: mở webapp bằng tài khoản chủ webapp (vào thẳng, không cần đăng nhập) rồi cài ở Hệ thống › Quản lý người dùng › Cổng đăng nhập." };
    const link = layLinkCong_();
    if (!link) {
      return { status: "error", message: "Chưa lưu link Cổng đăng nhập. Quản trị viên: mở webapp bằng tài khoản chủ webapp (vào thẳng), dán link Cổng vào Hệ thống › Quản lý người dùng › Cổng đăng nhập." };
    }
    return { status: "success", url: link };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function DN_kiemTraPhien(maPhien) {
  try {
    return { status: "success", data: xacThucPhien_(maPhien) };
  } catch (e) {
    return { status: "het_han", message: String(e.message || e).replace(MA_LOI_PHIEN_, "") };
  }
}

function DN_dangXuat(maPhien) {
  const ma = String(maPhien || "");
  if (/^[a-f0-9]{64}$/.test(ma)) CacheService.getScriptCache().remove("phien_" + ma);
  return { status: "success" };
}

// So sánh chữ ký không phụ thuộc thời gian (tránh dò chữ ký theo độ trễ).
function soSanhChuoiAnToan_(a, b) {
  a = String(a); b = String(b);
  let khac = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) khac |= a.charCodeAt(i) ^ b.charCodeAt(i % (b.length || 1));
  return khac === 0;
}

// Cổng chuyển người dùng về doGet(e) kèm ?cong=<thân>.<chữ ký>. Trả về
// { phien } nếu vé hợp lệ và email có trong danh sách quyền, ngược lại { thongBao }.
function xuLyVeCong_(ve) {
  const khoa = layKhoaCong_();
  const phan = String(ve || "").split(".");
  const loiVe = "Vé đăng nhập không hợp lệ. Vui lòng bấm Đăng nhập lại.";
  if (!khoa || phan.length !== 2 || !phan[0] || !phan[1] || phan[0].length > 2000) return { thongBao: loiVe };

  const chuKyDung = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(phan[0], khoa));
  if (!soSanhChuoiAnToan_(chuKyDung, phan[1])) {
    logAudit_("DANG_NHAP", "TU_CHOI", "Vé Cổng sai chữ ký (Cổng đang dùng mã nguồn/khóa cũ?).");
    return { thongBao: "Vé đăng nhập sai chữ ký - Cổng đăng nhập đang dùng mã nguồn cũ. Quản trị viên cần lấy lại mã nguồn Cổng (Hệ thống › Quản lý người dùng › Cổng đăng nhập) và triển khai lại." };
  }

  let noiDung;
  try { noiDung = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(phan[0])).getDataAsString("UTF-8")); } catch (e) { return { thongBao: loiVe }; }
  const bayGio = Date.now();
  const hetHan = Number(noiDung && noiDung.x);
  const nonce = String((noiDung && noiDung.n) || "");
  if (!noiDung || !noiDung.e || !/^[A-Za-z0-9-]{8,64}$/.test(nonce)) return { thongBao: loiVe };
  if (!(hetHan > bayGio) || hetHan > bayGio + VE_CONG_HIEU_LUC_MS_ + 60000) {
    return { thongBao: "Liên kết đăng nhập đã hết hạn (quá 5 phút). Vui lòng bấm Đăng nhập lại." };
  }
  // Mỗi vé chỉ dùng 1 lần (chặn dùng lại link cũ còn trong lịch sử trình duyệt).
  const cache = CacheService.getScriptCache();
  if (cache.get("cong_ve_" + nonce)) return { thongBao: "Liên kết đăng nhập này đã được dùng. Vui lòng bấm Đăng nhập lại." };
  cache.put("cong_ve_" + nonce, "1", Math.ceil((VE_CONG_HIEU_LUC_MS_ + 120000) / 1000));

  const nd = timNguoiDungTheoEmail_(noiDung.e);
  PHIEN_HIEN_TAI_ = nd; // để logAudit_ ghi đúng người
  if (!nd.coQuyen) {
    logAudit_("DANG_NHAP", "TU_CHOI", nd.email + " không có trong danh sách quyền.");
    return { thongBao: "Tài khoản " + nd.email + " chưa được cấp quyền sử dụng hệ thống. Gửi đúng email này cho Quản trị viên để được thêm vào danh sách, hoặc đăng nhập bằng tài khoản Google khác." };
  }
  logAudit_("DANG_NHAP", "OK", nd.email + " (" + nd.vaiTro + ")");
  return { phien: taoPhien_(nd.email) };
}

/* ----- Quản trị Cổng đăng nhập (chỉ Admin) ----- */
function HT_layCauHinhCong_() {
  try {
    const linkChinh = layLinkWebappChinh_();
    return { status: "success", data: { linkCong: layLinkCong_(), linkWebappChinh: linkChinh, linkWebappHopLe: laLinkWebAppHopLe_(linkChinh) } };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function HT_layMaNguonCong_() {
  try {
    const linkChinh = layLinkWebappChinh_();
    if (!laLinkWebAppHopLe_(linkChinh)) throw new Error("Không tự nhận diện được URL /exec của webapp chính (" + (linkChinh || "trống") + "). Đặt thuộc tính tập lệnh LINK_WEBAPP_CHINH bằng đúng URL /exec rồi thử lại.");
    logAudit_("CONG_DANG_NHAP", "OK", "Xem mã nguồn Cổng");
    return { status: "success", data: taoMaNguonCong_(layKhoaCong_() || taoKhoaCongMoi_(), linkChinh) };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function HT_luuLinkCong_(link) {
  try {
    link = String(link || "").trim();
    if (!laLinkWebAppHopLe_(link)) throw new Error("Link Cổng không hợp lệ - phải là link Web app dạng https://script.google.com/macros/s/.../exec");
    if (link === layLinkWebappChinh_()) throw new Error("Đây là link của CHÍNH webapp quản lý, không phải link dự án Cổng đăng nhập.");
    PropertiesService.getScriptProperties().setProperty(LINK_CONG_PROP_, link);
    logAudit_("CONG_DANG_NHAP", "OK", "Lưu link Cổng: " + link);
    return { status: "success", message: "✅ Đã lưu link Cổng đăng nhập." };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Đổi khóa khi nghi mã nguồn Cổng bị lộ: Cổng cũ ngừng hoạt động ngay (các
// phiên đang đăng nhập vẫn giữ nguyên) cho tới khi dán mã nguồn mới vào Cổng
// và triển khai lại (Manage deployments › Edit › New version).
function HT_doiKhoaCong_() {
  try {
    const linkChinh = layLinkWebappChinh_();
    if (!laLinkWebAppHopLe_(linkChinh)) throw new Error("Không tự nhận diện được URL /exec của webapp chính - đặt thuộc tính LINK_WEBAPP_CHINH trước.");
    const ma = taoMaNguonCong_(taoKhoaCongMoi_(), linkChinh);
    logAudit_("CONG_DANG_NHAP", "OK", "Đổi khóa Cổng");
    return { status: "success", data: ma, message: "✅ Đã đổi khóa. Dán mã nguồn mới vào dự án Cổng và triển khai lại phiên bản mới ngay." };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function HT_layDanhSachQuyen_() {
  try {
    return {
      status: "success",
      data: DS_QUYEN_(),
      quanTriCoDinh: danhSachQuanTriCoDinh_(),
      vaiTro: Object.keys(VAI_TRO_NHAN).map(function (ma) { return { ma: ma, nhan: VAI_TRO_NHAN[ma] }; })
    };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Quyền chia sẻ Google Drive (Xem/Bình luận/Chỉnh sửa) - ĐỘC LẬP với vaiTro
// (vaiTro là quyền TRONG webapp: ADMIN/NHANVIEN/CHIXEM; quyenDrive là quyền
// TRÊN chính Google Sheet/Drive khi HT_chiaSeTaiNguyenChoDanhSachQuyen() chạy).
// Webapp chạy bằng quyền Admin nên nhân viên KHÔNG cần quyền Drive nào để
// dùng webapp - chỉ chia sẻ khi CHỦ ĐỘNG muốn ai đó mở thẳng Sheet gốc.
const QUYEN_DRIVE_HOP_LE = ["VIEWER", "COMMENTER", "EDITOR"];

// danhSach = [{email, hoTen, vaiTro, trangThai, quyenDrive}, ...] - GHI ĐÈ TOÀN BỘ
// sheet SYS_NguoiDung. Dòng không đổi giữ nguyên "Cập nhật lúc/bởi" cũ.
function HT_luuDanhSachQuyen_(danhSach) {
  // L-04: 2 Quản trị lưu cùng lúc -> người lưu sau không ghi đè lẫn lộn bảng người dùng.
  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); } catch (e) { return { status: "error", message: "Hệ thống đang bận, vui lòng thử lại sau ít giây." }; }
  try { return HT_luuDanhSachQuyenTrongKhoa_(danhSach); } finally { lock.releaseLock(); }
}
function HT_luuDanhSachQuyenTrongKhoa_(danhSach) {
  try {
    if (!Array.isArray(danhSach) || danhSach.length === 0) {
      throw new Error("Danh sách người dùng không được để trống.");
    }
    const seen = {}; const finalList = [];
    danhSach.forEach(function (u) {
      const email = String((u && u.email) || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email '" + email + "' không hợp lệ.");
      const key = chuanHoaEmailSoSanh_(email);
      if (seen[key]) return; // loại email trùng, giữ lần xuất hiện đầu tiên
      seen[key] = true;
      finalList.push({
        email: email,
        hoTen: String(u.hoTen || "").trim(),
        vaiTro: ND_chuanVaiTro_(u.vaiTro),
        trangThai: ND_chuanTrangThai_(u.trangThai),
        quyenDrive: ND_chuanQuyenDrive_(u.quyenDrive)
      });
    });
    if (!finalList.some(function (u) { return u.vaiTro === VAI_TRO.ADMIN && u.trangThai === TRANG_THAI_ND.HOAT_DONG; })) {
      throw new Error("Phải giữ lại ít nhất 1 tài khoản Quản trị đang hoạt động trong danh sách.");
    }

    const sh = ND_sheet_();
    ND_chuyenDanhSachCu_(sh);
    const lr = sh.getLastRow();
    const cu = {};
    if (lr > 1) sh.getRange(2, 1, lr - 1, ND_HEADERS_.length).getValues().forEach(function (r) {
      const k = chuanHoaEmailSoSanh_(r[0]);
      if (k) cu[k] = r;
    });
    const now = new Date();
    const nguoiSua = layThongTinNguoiDungHienTai_().email || "";
    const thayDoi = [];
    const dong = finalList.map(function (u) {
      const r = cu[chuanHoaEmailSoSanh_(u.email)];
      const giuNguyen = r && String(r[1] || "").trim() === u.hoTen && ND_chuanVaiTro_(r[2]) === u.vaiTro &&
        ND_chuanTrangThai_(r[3]) === u.trangThai && ND_chuanQuyenDrive_(r[4]) === u.quyenDrive;
      if (!giuNguyen) thayDoi.push(u.email + ": " + VAI_TRO_NHAN[u.vaiTro] + ", " + u.trangThai);
      return [u.email, u.hoTen, u.vaiTro, u.trangThai, u.quyenDrive, giuNguyen ? r[5] : now, giuNguyen ? r[6] : nguoiSua];
    });
    Object.keys(cu).forEach(function (k) { if (!seen[k]) thayDoi.push("Xóa " + cu[k][0]); });
    if (lr > 1) sh.getRange(2, 1, lr - 1, ND_HEADERS_.length).clearContent();
    sh.getRange(2, 1, dong.length, ND_HEADERS_.length).setValues(dong);
    ND_xoaCache_();
    logAudit_("CAUHINH_PHANQUYEN", "OK", thayDoi.join("; ") || "Không có thay đổi");
    return { status: "success", message: "✅ Đã lưu danh sách " + finalList.length + " người dùng." };
  } catch (e) { return { status: "error", message: e.toString() }; }
}
