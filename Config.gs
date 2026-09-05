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

function REGION_FORMAT() {
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
  const mien = REGION_FORMAT().MIEN;
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

/* ---------- CẤU HÌNH RIÊNG CHO BÁO CÁO / KẾT XUẤT MISA ---------- */
// TÁCH BIỆT HOÀN TOÀN với REGION_FORMAT ở trên - vì đây là FILE XUẤT/TẢI VỀ
// (Excel/PDF), KHÔNG PHẢI Sheet lưu trữ lâu dài, nên KHÔNG cần đồng bộ với
// Locale thật của bất kỳ Google Sheet nào. Đây chỉ đơn thuần là LỰA CHỌN hiển
// thị của người dùng khi mở file Misa đã xuất ra - đổi tùy ý, không ảnh hưởng
// gì đến việc ghi dữ liệu vào các Sheet khác của hệ thống (PhieuCan_DN, Kho
// Dăm...), và không cần khớp với bất kỳ cài đặt Locale thật nào cả.
const MISA_FORMAT_MAC_DINH = "VN";

function MISA_FORMAT() {
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
function HT_layCauHinhVungMien() {
  try {
    // FIX (phân quyền - phát hiện qua test tự động): hàm này bị BỎ SÓT khi gate
    // quyền Admin cho cả mục "Cấu hình hệ thống" - dù giá trị trả về (VN/US) ít
    // nhạy cảm, vẫn nên nhất quán với các hàm HT_lay*/HT_luu* còn lại trong cùng
    // mục cấu hình (đã chặn Admin-only), tránh 1 điểm hở dù nhỏ.
    yeuCauQuyenAdmin_();
    const rf = REGION_FORMAT();
    const mf = MISA_FORMAT();
    return { status: "success", mien: rf.MIEN, mienMisa: mf.MIEN };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Đọc LOCALE THẬT (Locale THẬT đang cài đặt sẵn trên chính từng Google Sheet,
// qua getSpreadsheetLocale() - KHÁC với "Locale hệ thống" chỉ là lựa chọn của
// webapp) của từng Sheet liên quan đến "Vùng miền chung", để anh đối chiếu
// xem có KHỚP với Locale hệ thống đang chọn hay không - đây chính là cách duy
// nhất để biết chắc có bị lệch hay không, thay vì đoán.
function HT_layLocaleThatCuaSheet() {
  try {
    yeuCauQuyenAdmin_();
    const dsSheet = [
      { ten: "PhieuCan_DN", id: CONFIG.SPREADSHEET_ID },
      { ten: "Update_MiSa_PC", id: CONFIG.MISA_DST_ID },
      { ten: "DATA_GIAODICH (Kho Dăm)", id: KHODAM_CONFIG.SPREADSHEET_ID },
      { ten: "NL_DH_XB (Xuất hàng)", id: XUATHANG_CONFIG.SPREADSHEET_ID }
    ];
    const mienDangChon = REGION_FORMAT().MIEN; // "VN" hoặc "US"
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
function HT_luuCauHinhVungMien(mien, mienMisa) {
  try {
    yeuCauQuyenAdmin_(); // FIX (phân quyền): đổi Locale toàn hệ thống ảnh hưởng mọi người dùng - chỉ Admin
    const props = PropertiesService.getScriptProperties();
    mien = (String(mien || "").toUpperCase() === "US") ? "US" : "VN";
    mienMisa = (String(mienMisa || "").toUpperCase() === "US") ? "US" : "VN";

    props.setProperty("REGION_FORMAT_MIEN", mien);
    props.setProperty("MISA_FORMAT_MIEN", mienMisa);

    logAudit_("CAUHINH_VUNGMIEN", "OK", "Locale hệ thống: " + mien + ", Locale Misa: " + mienMisa);
    return {
      status: "success",
      message: "✅ Đã lưu cấu hình: Hệ thống = " + (mien === "VN" ? "Việt Nam (dd/MM/yyyy)" : "United States (MM/dd/yyyy)") +
        ", Báo cáo Misa = " + (mienMisa === "VN" ? "Việt Nam" : "United States")
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

function MISA_DEFAULTS() {
  const saved = PropertiesService.getScriptProperties().getProperty("MISA_DEFAULTS_JSON");
  if (!saved) return MISA_DEFAULTS_MAC_DINH;
  try {
    const parsed = JSON.parse(saved);
    return Object.assign({}, MISA_DEFAULTS_MAC_DINH, parsed); // gộp - phòng trường hợp sau này thêm trường mới mà cấu hình cũ chưa có
  } catch (e) { return MISA_DEFAULTS_MAC_DINH; }
}

function HT_layMisaDefaults() {
  try { yeuCauQuyenAdmin_(); return { status: "success", data: MISA_DEFAULTS() }; } catch (e) { return { status: "error", message: e.toString() }; }
}

function HT_luuMisaDefaults(data) {
  try {
    yeuCauQuyenAdmin_(); // FIX (phân quyền): đổi giá trị mặc định báo cáo Misa (TK kế toán, mã hàng...) ảnh hưởng toàn công ty - chỉ Admin
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
  const props = PropertiesService.getScriptProperties();
  LIENKET_DANH_SACH.forEach(function (item) {
    const gtOverride = props.getProperty("LIENKET_" + item.key);
    if (gtOverride) {
      const obj = _layObjectTheoNhom_(item.nhom);
      if (obj) obj[item.truong] = gtOverride;
    }
  });
}
apDungOverrideLienKet_(); // chạy ngay khi project được nạp

function HT_layLienKetDuLieu() {
  try {
    yeuCauQuyenAdmin_(); // FIX (phân quyền): trước đây AI có link đăng nhập Google cũng xem/đổi được ID Spreadsheet/Thư mục toàn hệ thống
    const props = PropertiesService.getScriptProperties();
    const data = LIENKET_DANH_SACH.map(function (item) {
      const obj = _layObjectTheoNhom_(item.nhom);
      const giaTriHienTai = obj ? String(obj[item.truong] || "") : "";
      const daGhiDe = !!props.getProperty("LIENKET_" + item.key);
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
function HT_luuLienKetDuLieu(overrides) {
  try {
    // FIX (NGHIÊM TRỌNG - phân quyền): TRƯỚC ĐÂY hàm này không có bất kỳ kiểm
    // tra quyền nào - bất kỳ ai đăng nhập Google mở được webapp đều có thể đổi
    // ID Spreadsheet/Thư mục CHÍNH của toàn hệ thống, chuyển hướng dữ liệu công
    // ty sang nơi khác. Nay CHỈ ADMIN mới gọi được (chặn cứng ở server, không
    // chỉ ẩn nút trên giao diện).
    yeuCauQuyenAdmin_();
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

/* ---------- PHÂN QUYỀN NGƯỜI DÙNG (chống truy cập trái phép) ---------- */
// TRƯỚC ĐÂY webapp không có BẤT KỲ rào chắn nào ngoài việc appsscript.json đặt
// access:"ANYONE" (yêu cầu đăng nhập bằng 1 tài khoản Google BẤT KỲ, nhưng
// KHÔNG giới hạn tài khoản nào) - nghĩa là ai có link, đăng nhập bằng bất kỳ
// Gmail nào, cũng dùng được MỌI chức năng, kể cả xóa dữ liệu và đổi cấu hình
// toàn hệ thống. Nay bổ sung 1 lớp allowlist tối thiểu: chỉ những email được
// liệt kê dưới đây (hoặc đã được ADMIN thêm qua giao diện Hệ thống → Quản lý
// người dùng) mới mở được webapp. Nhân viên dùng Gmail cá nhân (không có
// domain công ty riêng để giới hạn theo tên miền) nên bắt buộc dùng danh sách
// email cụ thể thay vì giới hạn theo domain.
//
// 2 vai trò:
//  - ADMIN: toàn quyền, bao gồm cả Cấu hình hệ thống / Liên kết dữ liệu /
//    Cấu hình Misa mặc định / Quản lý người dùng (những mục có thể ảnh hưởng
//    TOÀN BỘ hệ thống và mọi người dùng khác nếu chỉnh sai).
//  - NHANVIEN: dùng các chức năng nghiệp vụ hàng ngày (import phiếu cân, nhập
//    liệu, báo cáo, báo giá, kho dăm, xuất hàng...) nhưng KHÔNG vào được các
//    mục cấu hình toàn hệ thống nói trên.
//
// Danh sách THẬT được lưu trong PropertiesService (đổi được ngay trên giao
// diện Hệ thống → Quản lý người dùng, không cần sửa code/deploy lại). Mảng
// dưới đây chỉ là giá trị KHỞI TẠO LẦN ĐẦU (dùng khi chưa từng lưu danh sách
// nào) - Admin đầu tiên do người triển khai hệ thống xác nhận.
const DANH_SACH_QUYEN_MAC_DINH = [
  { email: "phuthuy.apple@gmail.com", vaiTro: "ADMIN" }
];

function DS_QUYEN_() {
  const saved = PropertiesService.getScriptProperties().getProperty("DANH_SACH_QUYEN_JSON");
  if (!saved) return DANH_SACH_QUYEN_MAC_DINH;
  try {
    const parsed = JSON.parse(saved);
    return (Array.isArray(parsed) && parsed.length > 0) ? parsed : DANH_SACH_QUYEN_MAC_DINH;
  } catch (e) { return DANH_SACH_QUYEN_MAC_DINH; }
}

// Lấy thông tin quyền của người đang mở webapp, dựa vào email tài khoản Google
// đang đăng nhập (Session.getActiveUser() chỉ đọc được email khi web app yêu
// cầu đăng nhập - đúng cấu hình access:"ANYONE" hiện tại của appsscript.json;
// nếu sau này đổi sang "ANYONE_ANONYMOUS" hàm này sẽ luôn trả về rỗng và KHÔNG
// AI vào được - phải giữ nguyên "ANYONE", không đổi sang "ANYONE_ANONYMOUS").
function layThongTinNguoiDungHienTai_() {
  let email = "";
  try { email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase(); } catch (e) { email = ""; }
  const ds = DS_QUYEN_();
  const found = ds.find(function (u) { return String(u.email || "").trim().toLowerCase() === email; });
  return {
    email: email,
    vaiTro: found ? found.vaiTro : null,
    coQuyen: !!found,
    laAdmin: !!found && found.vaiTro === "ADMIN"
  };
}

// Chặn cứng Ở SERVER (không chỉ ẩn nút trên giao diện - người dùng vẫn có thể
// tự gọi hàm qua Console trình duyệt) cho các hàm CHỈ ADMIN được phép gọi.
// Gọi hàm này ở NGAY ĐẦU mỗi hàm loại đó, ném lỗi rõ ràng nếu không đủ quyền.
function yeuCauQuyenAdmin_() {
  const nd = layThongTinNguoiDungHienTai_();
  if (!nd.laAdmin) {
    const dsAdmin = DS_QUYEN_().filter(function (u) { return u.vaiTro === "ADMIN"; }).map(function (u) { return u.email; }).join(", ");
    throw new Error("Bạn không có quyền Quản trị để thực hiện thao tác này" + (nd.email ? " (tài khoản: " + nd.email + ")" : "") + ". Liên hệ Quản trị viên (" + dsAdmin + ") nếu cần được cấp quyền.");
  }
  return nd;
}

// Chặn cứng cho các hàm CẦN ĐĂNG NHẬP HỢP LỆ (bất kỳ vai trò nào trong danh
// sách) - phòng trường hợp 1 hàm bị gọi trực tiếp ngoài luồng bình thường của
// giao diện (doGet() đã chặn chính, đây là lớp phòng thủ thứ 2).
function yeuCauDangNhap_() {
  const nd = layThongTinNguoiDungHienTai_();
  if (!nd.coQuyen) {
    throw new Error("Tài khoản " + (nd.email || "(chưa xác định)") + " chưa được cấp quyền sử dụng hệ thống này. Liên hệ Quản trị viên để được thêm vào danh sách truy cập.");
  }
  return nd;
}

// Cho giao diện gọi để tự nhận biết đang đăng nhập là ai / có quyền gì (ẩn
// hiện đúng menu, hiện đúng thông báo) - KHÔNG dùng để CHẶN (chặn thật luôn ở
// server qua yeuCauQuyenAdmin_()/yeuCauDangNhap_() và ở doGet() - xem Code.gs).
function HT_layThongTinNguoiDungHienTai() {
  try { return { status: "success", data: layThongTinNguoiDungHienTai_() }; } catch (e) { return { status: "error", message: e.toString() }; }
}

function HT_layDanhSachQuyen() {
  try {
    yeuCauQuyenAdmin_();
    return { status: "success", data: DS_QUYEN_() };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// danhSach = [{email, vaiTro}, ...] - GHI ĐÈ TOÀN BỘ danh sách hiện tại.
function HT_luuDanhSachQuyen(danhSach) {
  try {
    yeuCauQuyenAdmin_();
    if (!Array.isArray(danhSach) || danhSach.length === 0) {
      throw new Error("Danh sách người dùng không được để trống.");
    }
    const clean = danhSach.map(function (u) {
      const email = String(u.email || "").trim().toLowerCase();
      const vaiTro = (String(u.vaiTro || "").toUpperCase() === "ADMIN") ? "ADMIN" : "NHANVIEN";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Email '" + email + "' không hợp lệ.");
      }
      return { email: email, vaiTro: vaiTro };
    });
    // Loại email trùng (giữ lần xuất hiện đầu tiên)
    const seen = {}; const finalList = [];
    clean.forEach(function (u) { if (!seen[u.email]) { seen[u.email] = true; finalList.push(u); } });
    if (!finalList.some(function (u) { return u.vaiTro === "ADMIN"; })) {
      throw new Error("Phải giữ lại ít nhất 1 tài khoản ADMIN, không thể xóa hết (nếu không sẽ không còn ai quản trị được hệ thống).");
    }

    PropertiesService.getScriptProperties().setProperty("DANH_SACH_QUYEN_JSON", JSON.stringify(finalList));
    logAudit_("CAUHINH_PHANQUYEN", "OK", JSON.stringify(finalList));
    return { status: "success", message: "✅ Đã lưu danh sách " + finalList.length + " người dùng." };
  } catch (e) { return { status: "error", message: e.toString() }; }
}
