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
  yeuCauPhien_();
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
  yeuCauPhien_();
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
  yeuCauPhien_();
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
  yeuCauPhien_();
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
  yeuCauPhien_();
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
  yeuCauPhien_();
  const saved = PropertiesService.getScriptProperties().getProperty("MISA_DEFAULTS_JSON");
  if (!saved) return MISA_DEFAULTS_MAC_DINH;
  try {
    const parsed = JSON.parse(saved);
    return Object.assign({}, MISA_DEFAULTS_MAC_DINH, parsed); // gộp - phòng trường hợp sau này thêm trường mới mà cấu hình cũ chưa có
  } catch (e) { return MISA_DEFAULTS_MAC_DINH; }
}

function HT_layMisaDefaults() {
  yeuCauPhien_();
  try { yeuCauQuyenAdmin_(); return { status: "success", data: MISA_DEFAULTS() }; } catch (e) { return { status: "error", message: e.toString() }; }
}

function HT_luuMisaDefaults(data) {
  yeuCauPhien_();
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
  yeuCauPhien_();
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
  yeuCauPhien_();
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
function HT_chiaSeTaiNguyenChoDanhSachQuyen() {
  yeuCauPhien_();
  try {
    yeuCauQuyenAdmin_();
    const nguoiDung = DS_QUYEN_().map(function (u) {
      const email = String(u.email || "").trim().toLowerCase();
      const quyenDriveThoRaw = String(u.quyenDrive || "").toUpperCase();
      const quyenDrive = QUYEN_DRIVE_HOP_LE.indexOf(quyenDriveThoRaw) !== -1 ? quyenDriveThoRaw : "EDITOR";
      return { email: email, quyenDrive: quyenDrive };
    }).filter(function (u) { return u.email; });
    if (!nguoiDung.length) return { status: "error", message: "Danh sách quyền đang trống." };

    const taiNguyen = _layDanhSachTaiNguyenDaGopId_();
    const tenQuyenHienThi = { VIEWER: "Xem", COMMENTER: "Bình luận", EDITOR: "Chỉnh sửa" };

    const ketQua = [];
    taiNguyen.forEach(function (tn) {
      nguoiDung.forEach(function (nd) {
        try {
          const resource = tn.loai === "folder" ? DriveApp.getFolderById(tn.id) : DriveApp.getFileById(tn.id);
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
function HT_layTinhTrangChiaSeTaiNguyen() {
  yeuCauPhien_();
  try {
    yeuCauQuyenAdmin_();
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
function HT_thuHoiQuyenTaiNguyen(id, loai, email) {
  yeuCauPhien_();
  try {
    yeuCauQuyenAdmin_();
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
function HT_thuHoiToanBoQuyenDriveChoEmail(email) {
  yeuCauPhien_();
  try {
    yeuCauQuyenAdmin_();
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
//    thamSo): kiểm tra phiên + kiểm tra email VẪN còn trong danh sách quyền (thu
//    hồi có hiệu lực ngay lần gọi kế tiếp) + vai trò Chỉ xem chỉ được gọi các
//    hàm đọc, rồi mới chạy hàm nghiệp vụ.
//  - Mỗi hàm công khai (không kết thúc bằng "_") trong Code.gs/Config.gs đều
//    mở đầu bằng yeuCauPhien_(): gọi thẳng hàm đó qua google.script.run mà
//    không đi qua API (không có phiên hợp lệ) sẽ bị từ chối. KHI THÊM HÀM MỚI
//    cho giao diện gọi, BẮT BUỘC thêm dòng yeuCauPhien_() ở đầu hàm VÀ thêm tên
//    hàm vào HAM_API_ - API() chỉ cho gọi hàm thỏa CẢ 2 điều kiện. Nếu hàm mới
//    CHỈ ĐỌC dữ liệu và người Chỉ xem cũng cần dùng, thêm tên hàm vào
//    HAM_CHO_PHEP_CHI_XEM_ bên dưới.
//
// CÀI ĐẶT 1 LẦN (trang hướng dẫn tự hiện khi chưa cài): trong trình soạn thảo
// Apps Script chọn hàm CAI_DAT_CONG_DANG_NHAP → Chạy → sao chép mã nguồn Cổng
// trong "Nhật ký thực thi" → tạo dự án mới (script.new), dán vào, triển khai
// Web app (Execute as: User accessing the web app · Who has access: Anyone
// with Google account) → mở link Cổng bằng tài khoản Admin để đăng nhập → vào
// Hệ thống › Quản lý người dùng › Cổng đăng nhập, dán link Cổng rồi Lưu.
//
// 3 vai trò:
//  - ADMIN: toàn quyền, bao gồm cả Cấu hình hệ thống / Liên kết dữ liệu /
//    Cấu hình Misa mặc định / Quản lý người dùng / Cổng đăng nhập.
//  - NHANVIEN: dùng các chức năng nghiệp vụ hàng ngày nhưng KHÔNG vào được các
//    mục cấu hình toàn hệ thống nói trên.
//  - CHIXEM: chỉ xem Dashboard, báo cáo, danh sách và xuất file Excel/PDF;
//    KHÔNG nhập/sửa/xóa/import được gì (chặn cứng ở API(), không chỉ ẩn nút).
//
// Danh sách THẬT được lưu trong PropertiesService (đổi được ngay trên giao
// diện Hệ thống → Quản lý người dùng). Mảng dưới đây chỉ là giá trị KHỞI TẠO
// LẦN ĐẦU (dùng khi chưa từng lưu danh sách nào).
const DANH_SACH_QUYEN_MAC_DINH = [
  { email: "saoluucvhak@gmail.com", vaiTro: "ADMIN", quyenDrive: "EDITOR" }
];

function DS_QUYEN_() {
  const saved = PropertiesService.getScriptProperties().getProperty("DANH_SACH_QUYEN_JSON");
  if (!saved) return DANH_SACH_QUYEN_MAC_DINH;
  try {
    const parsed = JSON.parse(saved);
    return (Array.isArray(parsed) && parsed.length > 0) ? parsed : DANH_SACH_QUYEN_MAC_DINH;
  } catch (e) { return DANH_SACH_QUYEN_MAC_DINH; }
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

function timNguoiDungTheoEmail_(email) {
  email = String(email || "").trim().toLowerCase();
  const emailSoSanh = chuanHoaEmailSoSanh_(email);
  const found = email ? DS_QUYEN_().find(function (u) { return chuanHoaEmailSoSanh_(u.email) === emailSoSanh; }) : null;
  return {
    email: email,
    vaiTro: found ? found.vaiTro : null,
    coQuyen: !!found,
    laAdmin: !!found && found.vaiTro === "ADMIN",
    laChiXem: !!found && found.vaiTro === "CHIXEM"
  };
}

const VAI_TRO_HOP_LE_ = ["ADMIN", "NHANVIEN", "CHIXEM"];

// Vai trò CHIXEM chỉ được gọi các hàm CHỈ ĐỌC dưới đây (xem/lọc báo cáo, tải
// danh sách, xuất file Excel/PDF từ dữ liệu có sẵn). Mọi hàm khác - nhập, sửa,
// xóa, import, tạo phiếu, cấu hình - bị API() từ chối.
const HAM_CHO_PHEP_CHI_XEM_ = {
  HT_layThongTinNguoiDungHienTai: true, HT_layDashboard: true, HT_layCauHinhVungMien: true,
  getFilterOptions: true, getDataForGiaoDichForm: true,
  getBaoCaoTongHop: true, getBaoCaoMisa: true, getBaoCaoDonGia: true,
  exportBaoCaoTongHopExcel: true, exportBaoCaoTongHopPDF: true,
  exportBaoCaoMisaExcel: true, exportBaoCaoMisaPDF: true,
  exportBaoCaoDonGiaExcel: true, exportBaoCaoDonGiaPDF: true, exportPhieuCanPDF: true,
  XH_getBaoCaoXuatQuaCan: true, XH_getBaoCaoXuatMisa: true,
  XH_exportBaoCaoXuatQuaCanExcel: true, XH_exportBaoCaoXuatQuaCanPDF: true, XH_exportBaoCaoXuatMisaExcel: true,
  XH_getDonHangList: true, XH_getDonHangByRow: true, XH_getKhoXuatList: true, XH_tinhDoKhoNhaMay: true,
  BG_getQuoteList: true, BG_getQuoteListWithStatus: true, BG_getQuoteDetail: true, BG_showAllData: true,
  BG_getBaogiaRowByHash: true, BG_getMaBaoGiaList: true, BG_getMaKLList: true, BG_exportFileSmart: true,
  // BG_updateHieuLuc chỉ dựng lại bảng "Còn hiệu lực" (tự tính từ dữ liệu báo
  // giá gốc, không đổi dữ liệu nhập) - cần để xem báo giá đang hiệu lực.
  BG_updateHieuLuc: true,
  layBaoCaoTonKho: true, layDanhSachDanhMucKho: true, layDanhSachDoKhoTheoBoLoc: true, layDanhSachKyVetBai: true,
  processFormData: true
};
// processFormData gom nhiều thao tác - Chỉ xem chỉ được các thao tác báo cáo.
const HANH_DONG_CHO_PHEP_CHI_XEM_ = { Baocaotonkho: true, BaocaoKyVetBai: true };

function kiemTraQuyenChiXem_(nd, ten, thamSo) {
  if (!nd || !nd.laChiXem) return;
  const duocPhep = HAM_CHO_PHEP_CHI_XEM_[ten] === true &&
    (ten !== "processFormData" || HANH_DONG_CHO_PHEP_CHI_XEM_[String((thamSo || [])[0])] === true);
  if (!duocPhep) {
    throw new Error("Tài khoản " + nd.email + " chỉ có quyền XEM - không được thực hiện thao tác nhập/sửa/xóa này. Liên hệ Quản trị viên nếu cần được cấp quyền Nhân viên.");
  }
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
  return PHIEN_HIEN_TAI_ || { email: "", vaiTro: null, coQuyen: false, laAdmin: false };
}

// Dòng đầu tiên của MỌI hàm công khai (xem giải thích ở đầu mục này).
function yeuCauPhien_() {
  if (!PHIEN_HIEN_TAI_ || !PHIEN_HIEN_TAI_.coQuyen) {
    throw new Error(MA_LOI_PHIEN_ + "Chưa đăng nhập hoặc phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  }
  return PHIEN_HIEN_TAI_;
}

// Chặn cứng Ở SERVER cho các hàm CHỈ ADMIN được phép gọi.
function yeuCauQuyenAdmin_() {
  const nd = yeuCauPhien_();
  if (!nd.laAdmin) {
    const dsAdmin = DS_QUYEN_().filter(function (u) { return u.vaiTro === "ADMIN"; }).map(function (u) { return u.email; }).join(", ");
    throw new Error("Bạn không có quyền Quản trị để thực hiện thao tác này (tài khoản: " + nd.email + "). Liên hệ Quản trị viên (" + dsAdmin + ") nếu cần được cấp quyền.");
  }
  return nd;
}

function HT_layThongTinNguoiDungHienTai() {
  yeuCauPhien_();
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

// CHẠY TAY 1 LẦN TRONG TRÌNH SOẠN THẢO APPS SCRIPT (chọn hàm này → Chạy):
// tạo khóa bí mật (nếu chưa có) rồi in mã nguồn Cổng ra "Nhật ký thực thi".
// Hàm KHÔNG trả về gì và chỉ ghi vào nhật ký của chủ dự án, nên dù ai đó cố
// gọi thẳng từ trình duyệt cũng không lấy được khóa; API() cũng không cho gọi.
function CAI_DAT_CONG_DANG_NHAP() {
  const khoa = layKhoaCong_() || taoKhoaCongMoi_();
  const linkChinh = layLinkWebappChinh_();
  console.log(
    "=== CỔNG ĐĂNG NHẬP GMAIL - làm theo các bước ===\n" +
    "1. Mở script.new (tạo dự án Apps Script MỚI, đặt tên VD \"HAK - Cong dang nhap\").\n" +
    "2. Xóa hết nội dung Code.gs, dán TOÀN BỘ đoạn mã giữa 2 dòng ----- bên dưới, bấm Lưu.\n" +
    "3. Deploy > New deployment > Web app: Execute as = User accessing the web app;\n" +
    "   Who has access = Anyone with Google account > Deploy, sao chép link Web app (/exec).\n" +
    "4. Mở link đó bằng saoluucvhak@gmail.com, cấp quyền xem email, bấm \"Vào hệ thống\".\n" +
    "5. Trong webapp: Hệ thống > Quản lý người dùng > Cổng đăng nhập: dán link Cổng và Lưu.\n" +
    (laLinkWebAppHopLe_(linkChinh) ? "" :
      "!! Không tự nhận diện được URL /exec của webapp chính (" + (linkChinh || "trống") + "): đặt thuộc tính tập lệnh\n" +
      "   LINK_WEBAPP_CHINH = URL /exec của webapp chính rồi chạy lại hàm này.\n") +
    "-----\n" + taoMaNguonCong_(khoa, linkChinh) + "-----"
  );
}

/* ----- Phiên đăng nhập ----- */
function taoPhien_(email) {
  const ma = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "").toLowerCase();
  CacheService.getScriptCache().put("phien_" + ma, JSON.stringify({ email: email, taoLuc: Date.now() }), PHIEN_CACHE_GIAY_);
  return ma;
}

function xacThucPhien_(maPhien) {
  const ma = String(maPhien || "");
  if (!/^[a-f0-9]{64}$/.test(ma)) throw new Error(MA_LOI_PHIEN_ + "Chưa đăng nhập.");
  const cache = CacheService.getScriptCache();
  const raw = cache.get("phien_" + ma);
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
  if (!nd.coQuyen) {
    cache.remove("phien_" + ma);
    throw new Error(MA_LOI_PHIEN_ + "Tài khoản " + nd.email + " không còn trong danh sách được cấp quyền.");
  }
  cache.put("phien_" + ma, raw, PHIEN_CACHE_GIAY_); // gia hạn trượt khi còn thao tác
  return nd;
}

/* ----- Cổng gọi hàm duy nhất từ giao diện ----- */
// DANH SÁCH TƯỜNG MINH các hàm giao diện được phép gọi qua API(). Các hàm công
// khai còn lại (VD xuLySuaXoaGiaoDich, taoPhieuDieuChinhKho, sanitize...) là
// hàm NỘI BỘ: chỉ được gọi qua hàm điều phối có khóa LockService + ghi nhật ký
// (processFormData...), gọi thẳng sẽ bỏ qua khóa ghi đồng thời và nhật ký nên
// bị chặn. KHI THÊM CHỨC NĂNG MỚI CHO GIAO DIỆN: thêm tên hàm vào đây (hàm cũng
// phải mở đầu bằng yeuCauPhien_()); nếu chỉ đọc dữ liệu và vai trò Chỉ xem cần
// dùng thì thêm cả vào HAM_CHO_PHEP_CHI_XEM_.
const HAM_API_ = [
  // Hệ thống / phân quyền / cổng đăng nhập
  "HT_layThongTinNguoiDungHienTai", "HT_layDashboard", "HT_layThongKeNamPhieuCan", "HT_chotSoNam",
  "HT_layCauHinhVungMien", "HT_luuCauHinhVungMien", "HT_layLocaleThatCuaSheet", "HT_xacNhanCauTrucSheetHienTai",
  "HT_layLienKetDuLieu", "HT_luuLienKetDuLieu", "HT_layMisaDefaults", "HT_luuMisaDefaults",
  "HT_layDanhSachQuyen", "HT_luuDanhSachQuyen", "HT_chiaSeTaiNguyenChoDanhSachQuyen", "HT_layTinhTrangChiaSeTaiNguyen",
  "HT_thuHoiQuyenTaiNguyen", "HT_thuHoiToanBoQuyenDriveChoEmail",
  "HT_layCauHinhCong", "HT_layMaNguonCong", "HT_luuLinkCong", "HT_doiKhoaCong",
  "HT_layTinhTrangSaoLuu", "HT_luuCauHinhSaoLuu", "HT_saoLuuNgay", "HT_layNhatKy", "HT_xuatNhatKyExcel",
  // Import / nhập liệu phiếu cân nhập
  "step1_PreviewDraft", "step1_ConfirmImport", "addManualPhieuCan", "taoFileMauPhieuCan", "taoFileMauXuatHang",
  // Báo cáo nhập kho + Misa
  "getFilterOptions", "getBaoCaoTongHop", "getBaoCaoMisa", "getBaoCaoDonGia", "runCreateMisaData", "downloadMisaExcel",
  "exportBaoCaoTongHopExcel", "exportBaoCaoTongHopPDF", "exportBaoCaoMisaExcel", "exportBaoCaoMisaPDF",
  "exportBaoCaoDonGiaExcel", "exportBaoCaoDonGiaPDF", "exportPhieuCanPDF",
  // Báo giá
  "BG_getMaBaoGiaList", "BG_addMaBaoGia", "BG_deleteMaBaoGia", "BG_getMaKLList", "BG_addMaKL", "BG_deleteMaKL",
  "BG_getQuoteList", "BG_getQuoteListWithStatus", "BG_getQuoteDetail", "BG_createQuote", "BG_deleteQuote",
  "BG_getBaogiaRowByHash", "BG_updateBaogiaRow", "BG_deleteBaogiaRow", "BG_updateHieuLuc", "BG_showAllData", "BG_exportFileSmart",
  // Kho dăm (ghi dữ liệu đi qua processFormData để có khóa + nhật ký)
  "processFormData", "getDataForGiaoDichForm", "layBaoCaoTonKho", "layDanhSachDanhMucKho",
  "layDanhSachDoKhoTheoBoLoc", "layDanhSachKyVetBai", "xuLyNhapSanPhamSanXuat",
  // Xuất hàng + báo cáo xuất kho
  "XH_step1_PreviewDraft", "XH_step1_ConfirmImport", "XH_getKhoXuatList", "XH_tinhDoKhoNhaMay",
  "XH_saveDonHang", "XH_getDonHangList", "XH_getDonHangByRow", "XH_updateDonHang", "XH_deleteDonHang",
  "XH_getBaoCaoXuatQuaCan", "XH_getBaoCaoXuatMisa",
  "XH_exportBaoCaoXuatQuaCanExcel", "XH_exportBaoCaoXuatQuaCanPDF", "XH_exportBaoCaoXuatMisaExcel"
].reduce(function (m, ten) { m[ten] = true; return m; }, {});

function API(maPhien, tenHam, thamSo) {
  PHIEN_HIEN_TAI_ = xacThucPhien_(maPhien);
  const ten = String(tenHam || "");
  const fn = HAM_API_[ten] === true ? globalThis[ten] : null;
  // Chỉ cho gọi đúng các hàm trong HAM_API_ và vẫn phải có dòng yeuCauPhien_()
  // ở đầu (2 lớp: quên 1 trong 2 thì hàm bị chặn chứ không bị lộ).
  if (typeof fn !== "function" || String(fn).indexOf("yeuCauPhien_()") === -1) {
    throw new Error("Không được phép gọi hàm: " + ten);
  }
  kiemTraQuyenChiXem_(PHIEN_HIEN_TAI_, ten, thamSo);
  return chuyenLinkXuatThanhFile_(fn.apply(null, Array.isArray(thamSo) ? thamSo : []));
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
    const laPdf = /(^|&)format=pdf(&|$)/.test(m[2]);
    const res = UrlFetchApp.fetch(kq.url, {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) throw new Error("HTTP " + res.getResponseCode());
    let tenFile = "tai-ve";
    try { tenFile = DriveApp.getFileById(m[1]).getName(); } catch (e) { /* giữ tên mặc định */ }
    const out = {};
    for (const k in kq) out[k] = kq[k];
    out.fileBase64 = Utilities.base64Encode(res.getBlob().getBytes());
    out.fileName = tenFile + (laPdf ? ".pdf" : ".xlsx");
    out.mimeType = laPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return out;
  } catch (e) {
    logAudit_("XUAT_FILE", "ERROR", "Không tải được file xuất: " + e);
    return kq; // giao diện sẽ mở link như cũ (vẫn dùng được với tài khoản Admin)
  }
}

/* ----- Luồng đăng nhập qua Cổng (không cần phiên) ----- */
function DN_layLinkDangNhap() {
  try {
    if (!daCauHinhDangNhap_()) return { status: "error", message: "Hệ thống chưa cài đặt Cổng đăng nhập - liên hệ Quản trị viên." };
    const link = layLinkCong_();
    if (!link) {
      return { status: "error", message: "Chưa lưu link Cổng đăng nhập. Quản trị viên: mở trực tiếp link Cổng (Web app /exec của dự án Cổng) để đăng nhập, rồi dán link đó vào Hệ thống › Quản lý người dùng › Cổng đăng nhập." };
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

// Trang hướng dẫn cài đặt 1 lần (hiện khi chưa có khóa Cổng). Không chứa bí
// mật nào - chỉ hướng dẫn Admin tự lấy mã nguồn Cổng trong trình soạn thảo.
function trangHuongDanCauHinhDangNhap_() {
  return HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:40px auto;padding:28px;border:1px solid #DCE0D8;border-radius:12px;line-height:1.6;color:#1E211C;">' +
    '<h2 style="margin-top:0;color:#1B4332;">⚙️ Cần cài đặt Cổng đăng nhập Gmail (làm 1 lần)</h2>' +
    '<ol>' +
    '<li>Mở dự án Apps Script của webapp này bằng tài khoản <b>saoluucvhak@gmail.com</b>.</li>' +
    '<li>Trên thanh công cụ, chọn hàm <code>CAI_DAT_CONG_DANG_NHAP</code> rồi bấm <b>Chạy</b> (Run).</li>' +
    '<li>Trong <b>Nhật ký thực thi</b> (Execution log) hiện ra, sao chép toàn bộ mã nguồn Cổng nằm giữa 2 dòng <code>-----</code>.</li>' +
    '<li>Mở <b>script.new</b> (tạo dự án mới, VD đặt tên "HAK - Cong dang nhap"), xóa nội dung Code.gs, dán mã vừa sao chép, bấm Lưu.</li>' +
    '<li><b>Deploy › New deployment › Web app</b>: <i>Execute as</i> = <b>User accessing the web app</b>; <i>Who has access</i> = <b>Anyone with Google account</b> → Deploy, sao chép link Web app.</li>' +
    '<li>Mở link Cổng đó bằng saoluucvhak@gmail.com (cấp quyền xem email) → bấm <b>Vào hệ thống</b>.</li>' +
    '<li>Trong webapp: <b>Hệ thống › Quản lý người dùng › Cổng đăng nhập</b>: dán link Cổng và bấm Lưu, rồi thêm email nhân viên kèm vai trò.</li>' +
    '</ol>' +
    '<p style="font-size:13px;color:#5B6259;">Giữ bí mật mã nguồn Cổng (có chứa khóa ký vé). Không chia sẻ dự án Cổng cho ai.</p>' +
    '</div>'
  ).setTitle("Cài đặt Cổng đăng nhập");
}

/* ----- Quản trị Cổng đăng nhập (chỉ Admin) ----- */
function HT_layCauHinhCong() {
  yeuCauPhien_();
  try {
    yeuCauQuyenAdmin_();
    const linkChinh = layLinkWebappChinh_();
    return { status: "success", data: { linkCong: layLinkCong_(), linkWebappChinh: linkChinh, linkWebappHopLe: laLinkWebAppHopLe_(linkChinh) } };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function HT_layMaNguonCong() {
  yeuCauPhien_();
  try {
    yeuCauQuyenAdmin_();
    const linkChinh = layLinkWebappChinh_();
    if (!laLinkWebAppHopLe_(linkChinh)) throw new Error("Không tự nhận diện được URL /exec của webapp chính (" + (linkChinh || "trống") + "). Đặt thuộc tính tập lệnh LINK_WEBAPP_CHINH bằng đúng URL /exec rồi thử lại.");
    logAudit_("CONG_DANG_NHAP", "OK", "Xem mã nguồn Cổng");
    return { status: "success", data: taoMaNguonCong_(layKhoaCong_() || taoKhoaCongMoi_(), linkChinh) };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function HT_luuLinkCong(link) {
  yeuCauPhien_();
  try {
    yeuCauQuyenAdmin_();
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
function HT_doiKhoaCong() {
  yeuCauPhien_();
  try {
    yeuCauQuyenAdmin_();
    const linkChinh = layLinkWebappChinh_();
    if (!laLinkWebAppHopLe_(linkChinh)) throw new Error("Không tự nhận diện được URL /exec của webapp chính - đặt thuộc tính LINK_WEBAPP_CHINH trước.");
    const ma = taoMaNguonCong_(taoKhoaCongMoi_(), linkChinh);
    logAudit_("CONG_DANG_NHAP", "OK", "Đổi khóa Cổng");
    return { status: "success", data: ma, message: "✅ Đã đổi khóa. Dán mã nguồn mới vào dự án Cổng và triển khai lại phiên bản mới ngay." };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function HT_layDanhSachQuyen() {
  yeuCauPhien_();
  try {
    yeuCauQuyenAdmin_();
    return { status: "success", data: DS_QUYEN_() };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Quyền chia sẻ Google Drive (Xem/Bình luận/Chỉnh sửa) - ĐỘC LẬP với vaiTro
// (vaiTro là quyền TRONG webapp: ADMIN/NHANVIEN/CHIXEM; quyenDrive là quyền
// TRÊN chính Google Sheet/Drive khi HT_chiaSeTaiNguyenChoDanhSachQuyen() chạy).
// Webapp chạy bằng quyền Admin nên nhân viên KHÔNG cần quyền Drive nào để
// dùng webapp - chỉ chia sẻ khi CHỦ ĐỘNG muốn ai đó mở thẳng Sheet gốc.
const QUYEN_DRIVE_HOP_LE = ["VIEWER", "COMMENTER", "EDITOR"];

// danhSach = [{email, vaiTro, quyenDrive}, ...] - GHI ĐÈ TOÀN BỘ danh sách hiện tại.
function HT_luuDanhSachQuyen(danhSach) {
  yeuCauPhien_();
  try {
    yeuCauQuyenAdmin_();
    if (!Array.isArray(danhSach) || danhSach.length === 0) {
      throw new Error("Danh sách người dùng không được để trống.");
    }
    const clean = danhSach.map(function (u) {
      const email = String(u.email || "").trim().toLowerCase();
      const vaiTroTho = String(u.vaiTro || "").toUpperCase();
      const vaiTro = VAI_TRO_HOP_LE_.indexOf(vaiTroTho) !== -1 ? vaiTroTho : "NHANVIEN";
      const quyenDriveThoRaw = String(u.quyenDrive || "").toUpperCase();
      const quyenDrive = QUYEN_DRIVE_HOP_LE.indexOf(quyenDriveThoRaw) !== -1 ? quyenDriveThoRaw : "EDITOR";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Email '" + email + "' không hợp lệ.");
      }
      return { email: email, vaiTro: vaiTro, quyenDrive: quyenDrive };
    });
    // Loại email trùng (giữ lần xuất hiện đầu tiên)
    const seen = {}; const finalList = [];
    clean.forEach(function (u) {
      const key = chuanHoaEmailSoSanh_(u.email);
      if (!seen[key]) { seen[key] = true; finalList.push(u); }
    });
    if (!finalList.some(function (u) { return u.vaiTro === "ADMIN"; })) {
      throw new Error("Phải giữ lại ít nhất 1 tài khoản ADMIN, không thể xóa hết (nếu không sẽ không còn ai quản trị được hệ thống).");
    }

    PropertiesService.getScriptProperties().setProperty("DANH_SACH_QUYEN_JSON", JSON.stringify(finalList));
    logAudit_("CAUHINH_PHANQUYEN", "OK", JSON.stringify(finalList));
    return { status: "success", message: "✅ Đã lưu danh sách " + finalList.length + " người dùng." };
  } catch (e) { return { status: "error", message: e.toString() }; }
}
