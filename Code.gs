/** * HỆ THỐNG QUẢN LÝ HAKGROUP - PHÂN TÁCH BIỆT LẬP IMPORT & CÁC CHỨC NĂNG BÁO CÁO (2026)
 *  - ĐÃ FIX LỖI TRÙNG BATCH
 *  - ĐÃ FIX #1: Ghi Date object thật thay vì chuỗi format sẵn (tránh lệch ngày/tháng do locale)
 *  - ĐÃ FIX #2: Bổ sung LockService cho các hàm ghi dữ liệu (chống race condition đa người dùng)
 *  - ĐÃ FIX #4: Sửa lỗi ngày bị sai lệch khi Xác nhận Import (do google.script.run tự
 *    chuyển Date thành chuỗi ISO khi đi qua lại giữa client/server)
 *
 *  LƯU Ý: Toàn bộ hằng số cấu hình (CONFIG, BAOGIA_CONFIG, COMPANY_NAME...) đã
 *  được chuyển sang file Config.gs riêng để dễ bảo trì - xem file đó nếu cần
 *  đổi ID Spreadsheet/Folder hoặc tên Sheet.
 */

function doGet(e) {
  apDungOverrideLienKet_(); // đảm bảo luôn dùng đúng ID Spreadsheet/Thư mục mới nhất đã cấu hình (Config.gs)

  // PHÂN QUYỀN (xem mục "CỔNG ĐĂNG NHẬP GMAIL" trong Config.gs): trang giao diện
  // KHÔNG chứa dữ liệu - mọi dữ liệu chỉ lấy được qua API() khi đã có phiên đăng
  // nhập hợp lệ. doGet() cấp phiên khi: (1) nhận "vé" Cổng đăng nhập (?cong=...),
  // hoặc (2) Google cho biết thẳng email người mở (chủ script, người cùng tên miền
  // Google Workspace) - nhờ vậy chủ script vào được ngay cả khi CHƯA cài Cổng, rồi
  // cài Cổng ngay trên giao diện (Hệ thống › Quản lý người dùng), không cần mở
  // trình soạn thảo Apps Script.
  const p = (e && e.parameter) || {};
  let phienMoi = "";
  let thongBao = "";
  if (p.cong) {
    try {
      const kq = xuLyVeCong_(p.cong);
      phienMoi = kq.phien || "";
      thongBao = kq.thongBao || "";
    } catch (err) {
      thongBao = "Lỗi khi đăng nhập: " + err;
    }
  } else {
    const nd = DN_nhanDienTrucTiep_();
    if (nd) phienMoi = taoPhien_(nd.email);
  }

  const t = HtmlService.createTemplateFromFile('Index');
  // Nhúng sẵn dạng JSON an toàn (chặn "</script>") để Index đọc thẳng vào biến JS.
  t.phienMoiJson = JSON.stringify(phienMoi).replace(/</g, '\\u003c');
  t.thongBaoDangNhapJson = JSON.stringify(thongBao).replace(/</g, '\\u003c');
  return t.evaluate()
    .setTitle('HỆ THỐNG QUẢN LÝ CÂN HAKGROUP')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// PERF-FMT-01: định dạng ngày giờ theo múi giờ CỐ ĐỊNH GMT+7 bằng số học thuần
// JavaScript - kết quả giống hệt Utilities.formatDate(d, "GMT+7", mau) cho các mẫu
// yyyy MM dd HH mm ss (+ ký tự phân cách, chữ trong ngoặc đơn như 'T') nhưng
// KHÔNG phải gọi sang dịch vụ Utilities. Báo cáo tổng hợp cả năm từng gọi
// formatDate ~400.000 lần (4 lần/phiếu). Mẫu khác / ngày không hợp lệ / không
// phải Date -> dùng Utilities.formatDate như cũ (giữ nguyên cách báo lỗi).
// CHỈ dùng cho "GMT+7" (không có giờ mùa hè, không đổi theo lịch sử) - KHÔNG
// dùng thay cho Session.getScriptTimeZone() (Asia/Ho_Chi_Minh năm 1899 lệch
// +7:06:40, là mốc của ô chỉ có giờ trong Sheets).
const DD_GMT7_MAU_ = {};
function dinhDangGMT7_(d, mau) {
  let phan = DD_GMT7_MAU_[mau];
  if (phan === undefined) {
    phan = [];
    const re = /yyyy|MM|dd|HH|mm|ss|'([^']*)'|[A-Za-z]|[^A-Za-z']+/g;
    let m;
    while ((m = re.exec(mau)) !== null) {
      const t = m[0];
      if (/^(yyyy|MM|dd|HH|mm|ss)$/.test(t)) phan.push({ k: t });
      else if (m[1] !== undefined) phan.push({ c: m[1] });
      else if (/^[A-Za-z]$/.test(t)) { phan = null; break; }   // mẫu chưa hỗ trợ
      else phan.push({ c: t });
    }
    DD_GMT7_MAU_[mau] = phan;
  }
  if (!phan || !(d instanceof Date)) return Utilities.formatDate(d, "GMT+7", mau);
  const t = d.getTime();
  if (isNaN(t)) return Utilities.formatDate(d, "GMT+7", mau);
  const x = new Date(t + 7 * 3600000);
  const nam = x.getUTCFullYear();
  if (nam < 1000 || nam > 9999) return Utilities.formatDate(d, "GMT+7", mau);
  const hai = function (v) { return v < 10 ? "0" + v : String(v); };
  let kq = "";
  for (let i = 0; i < phan.length; i++) {
    const p = phan[i];
    if (p.c !== undefined) { kq += p.c; continue; }
    switch (p.k) {
      case "yyyy": kq += nam; break;
      case "MM": kq += hai(x.getUTCMonth() + 1); break;
      case "dd": kq += hai(x.getUTCDate()); break;
      case "HH": kq += hai(x.getUTCHours()); break;
      case "mm": kq += hai(x.getUTCMinutes()); break;
      case "ss": kq += hai(x.getUTCSeconds()); break;
    }
  }
  return kq;
}

// FIX (GIO-01): ô "chỉ có giờ" (Giờ cân 1/2) trong Sheets là Date ngày 30/12/1899.
// Năm đó múi giờ Asia/Ho_Chi_Minh còn là giờ địa phương cũ (lệch +7:06:xx), nên
// định dạng bằng "GMT+7" cố định (dinhDangGMT7_/Utilities.formatDate "GMT+7") bị
// lệch vài phút so với ô trên sheet (VD 08:30:15 hiện thành 08:23:45). Lấy giờ/
// phút/giây theo MÚI GIỜ CỦA SCRIPT (getHours...) - đúng cách toTimeOnly_ ghi ô và
// engine tính giá (TG_tinhGiaDong_) đọc giờ -> khớp giờ hiển thị trên sheet.
function gioCuaO_(d) {
  const hai = function (v) { return v < 10 ? "0" + v : String(v); };
  return hai(d.getHours()) + ":" + hai(d.getMinutes()) + ":" + hai(d.getSeconds());
}

/*********************************************************
 * PHẦN 1: TIẾN TRÌNH IMPORT & ĐỐI SOÁT KIỂM TRA DATA FILE
 *********************************************************/

// FIX #25 (NGHIÊM TRỌNG): TRƯỚC ĐÂY hàm này chỉ nhận ĐÚNG 1 file (fileData),
// còn phía client (btnPreview) vẫn lặp gọi hàm này 1 LẦN CHO MỖI FILE đã chọn
// rồi chỉ giữ lại kết quả của LẦN GỌI CUỐI CÙNG (lastResult) — nếu người dùng
// chọn nhiều file cùng lúc, dữ liệu xem trước của MỌI FILE TRƯỚC ĐÓ bị ÂM THẦM
// MẤT, chỉ còn đúng file cuối cùng được đưa vào bảng xem trước/import (dù file
// gốc của các file trước đó vẫn đã lưu vào Done). Đây là hệ quả của việc bỏ cơ
// chế "quét cả thư mục Input" (vốn tự nhiên gộp nhiều file) mà chưa cập nhật lại
// đúng hợp đồng nhiều-file giữa client<->server. Nay hàm nhận MỘT MẢNG file
// (fileDataList) và xử lý gộp tất cả trong 1 lần gọi, khôi phục đúng khả năng
// import nhiều file cùng lúc (và cả việc phát hiện trùng Số Chứng Từ GIỮA các
// file trong cùng lượt, đúng như comment "seenInThisBatch" bên dưới mô tả).
function step1_PreviewDraft_(fileDataList) {
  try {
    const danhSachFile = (Array.isArray(fileDataList) ? fileDataList : [fileDataList]).filter(f => f && f.base64);
    if (danhSachFile.length === 0) return { status: "error", message: "Không có file để xử lý." };

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const dataSheet = ss.getSheetByName(CONFIG.DATA_SHEET);
    const lastRow = dataSheet.getLastRow();

    const duplicateMap = new Map();
    if (lastRow > 1) {
      // FIX: phải đọc tối thiểu 25 cột (không phải 23) vì trạng thái "OK" nằm ở cột 25 (chỉ số 24).
      // Đọc thiếu cột khiến row[24] luôn undefined -> status luôn rỗng -> không bao giờ
      // nhận diện đúng dòng "Đã khóa OK" ở bước xem trước.
      const existingData = dataSheet.getRange(2, 1, lastRow - 1, 25).getValues();
      existingData.forEach((row, index) => {
        const keyMaCT = String(row[21] || "").trim();
        if (keyMaCT) duplicateMap.set(keyMaCT, { rowNum: index + 2, status: String(row[24] || "").trim() });
      });
    }
    // FIX (an toàn Lưu trữ theo năm - PHẦN 1C): 1 phiếu đã "chốt sổ" chuyển
    // sang sheet lưu trữ sẽ KHÔNG còn nằm trong existingData ở trên - nếu
    // không bổ sung ở đây, tải lại đúng file gốc của phiếu đó sẽ bị hiểu nhầm
    // là "Mới" ngay ở bước xem trước.
    LT_bosungMaChungTuDaLuuTru_(duplicateMap);

    let previewRows = [];
    // FIX: theo dõi các key đã xuất hiện TRONG CHÍNH lượt xem trước này (GỘP CẢ
    // NHIỀU FILE trong 1 lượt, khai báo 1 LẦN NGOÀI vòng lặp file), để cảnh báo
    // sớm nếu có phiếu trùng số giữa các file/dòng cùng batch, tránh lỗi khi Xác nhận.
    const seenInThisBatch = new Set();
    // Các file bị bỏ qua hoàn toàn (lỗi convert riêng file đó / thiếu tiêu đề) -
    // không làm hỏng việc xử lý các file còn lại trong cùng lượt.
    const fileLoi = [];

    danhSachFile.forEach(fileData => {
      try {
        // FIX #23: Lưu file gốc THẲNG vào thư mục Done ngay khi tải lên (đơn giản
        // hóa - bỏ hẳn thư mục Input trung gian, không quét lại cả thư mục, không
        // cần "Dọn dẹp" thủ công, không cần di chuyển file ở bước Xác nhận nữa).
        // File gốc được lưu trữ làm bằng chứng NGAY LẬP TỨC, không phụ thuộc việc
        // sau đó người dùng có bấm Xác nhận hay không - đơn giản và an toàn hơn.
        const blob = Utilities.newBlob(Utilities.base64Decode(fileData.base64), fileData.mimeType, fileData.name);
        DriveApp.getFolderById(CONFIG.FOLDER_DONE).createFile(blob);

        // Convert TẠM đúng file vừa tải lên để đọc dữ liệu - đọc xong xóa NGAY bản
        // convert tạm (không đụng gì đến file gốc đã lưu trong Done ở trên).
        const tempFile = convertXlsxToTempSheet_(blob, "TMP_" + fileData.name);
        try {
          const values = SpreadsheetApp.openById(tempFile.id).getSheets()[0].getDataRange().getValues();

          let hIdx = values.findIndex(r => r.some(c => String(c).toLowerCase().includes("số phiếu")));
          if (hIdx === -1) { fileLoi.push({ name: fileData.name, reason: "Không tìm thấy dòng tiêu đề (cột 'Số phiếu')" }); return; }

          const rowsToProcess = values.slice(hIdx + 1);

          for (let r of rowsToProcess) {
            const spRaw = String(r[0] || "").trim();
            if (!spRaw || spRaw.toLowerCase().includes("ngày") || spRaw.toLowerCase().includes("tổng") || spRaw.length > 20) continue;

            const valA_Dich = String(r[1] || "").trim();
            const valF_Dich = String(r[4] || "").trim();

            let hGocValue = parseSoTheoLocale_(r[7]);
            if (!r[7] || isNaN(hGocValue) || hGocValue === 0) continue;

            let dateC = toDateObj_(r[2]);
            let dateD = toDateObj_(r[3]);

            let now = new Date();
            let nam = (dateC) ? dateC.getFullYear() : now.getFullYear();
            let currentMaChungTu = valA_Dich + "/" + nam + "/NK";

            // Logic khối lượng độc lập từng cột (< 70 nhân 1000)
            // FIX #16: dùng parseSoTheoLocale_() (Config.gs) thay vì regex "mù"
            // replace(/[^0-9.]/g,'') - regex cũ XÓA MẤT dấu phẩy mà không biết đó
            // là dấu thập phân hay dấu phân cách hàng nghìn, có thể làm SAI GIÁ
            // TRỊ nếu ô đến dưới dạng chữ (VD "17.990" kiểu VN = 17990, nhưng
            // parseFloat hiểu nhầm 17.99 nếu không biết quy ước). Nếu ô là số
            // Excel thật (trường hợp phổ biến nhất) thì parseSoTheoLocale_ dùng
            // thẳng, không đổi hành vi.
            let rawCan1 = parseSoTheoLocale_(r[5]) || 0;
            let rawCan2 = parseSoTheoLocale_(r[6]) || 0;
            let rawHang = parseSoTheoLocale_(r[7]) || 0;

            let previewCan1 = rawCan1 < 70 ? rawCan1 * 1000 : rawCan1;
            let previewCan2 = rawCan2 < 70 ? rawCan2 * 1000 : rawCan2;
            let previewHang = rawHang < 70 ? rawHang * 1000 : rawHang;

            let isError = false; let errorMsg = "";
            if (!dateC || !(dateC instanceof Date) || isNaN(dateC.getTime())) { isError = true; errorMsg += "Lỗi Ngày Cân 1. "; }
            if (!dateD || !(dateD instanceof Date) || isNaN(dateD.getTime())) { isError = true; errorMsg += "Lỗi Ngày Cân 2. "; }

            // FIX: đánh dấu lỗi nếu số chứng từ đã xuất hiện trong chính lượt xem trước này
            if (seenInThisBatch.has(currentMaChungTu)) {
              isError = true;
              errorMsg += "Trùng Số Chứng Từ ngay trong dữ liệu đang nạp (" + currentMaChungTu + "). ";
            } else {
              seenInThisBatch.add(currentMaChungTu);
            }

            let typeImport = "Mới";
            if (duplicateMap.has(currentMaChungTu)) {
              const info = duplicateMap.get(currentMaChungTu);
              typeImport = (info.status === "OK") ? "Bỏ qua (Đã khóa OK)" : "Cập nhật dòng cũ";
            }

            previewRows.push({
              isError: isError, errorMsg: errorMsg.trim(), typeImport: typeImport, uniqueKey: currentMaChungTu,
              soPhieu: valA_Dich,
              // Lưu ý: các chuỗi ngày/giờ dưới đây CHỈ dùng để HIỂN THỊ trong bảng xem trước
              // (draft sheet) cho người dùng đọc. Dữ liệu ghi thật vào PhieuCan_DN ở bước
              // Xác nhận (step1_ConfirmImport) dùng Date object gốc (dateC/dateD), không
              // dùng các chuỗi này, nên KHÔNG bị ảnh hưởng bởi lỗi định dạng ở đây.
              // FIX #6: đổi dd/MM/yyyy (kiểu Việt Nam) thay vì MM/dd/yyyy (kiểu Mỹ) — bản
              // cũ khiến ngày 05/01/2026 (5 tháng 1) hiển thị thành "01/05/2026", làm
              // người dùng tưởng nhầm là ngày 1 tháng 5 (bị đảo ngày/tháng), dù dữ liệu
              // gốc ghi vào PhieuCan_DN vẫn luôn đúng.
              ngayCan1: dateC ? dinhDangGMT7_(dateC, "dd/MM/yyyy") : "Lỗi định dạng ngày",
              gioCan1: dateC ? dinhDangGMT7_(dateC, "HH:mm:ss") : "",
              ngayCan2: dateD ? dinhDangGMT7_(dateD, "dd/MM/yyyy") : "Lỗi định dạng ngày",
              gioCan2: dateD ? dinhDangGMT7_(dateD, "HH:mm:ss") : "",
              soXe: valF_Dich, klCan1: previewCan1, klCan2: previewCan2, klHangGoc: previewHang,
              // FIX #21: TRƯỚC ĐÂY gửi nguyên "rawRowData: r" (CẢ DÒNG THÔ từ file
              // Excel) qua lại giữa client<->server - nếu BẤT KỲ ô nào trong dòng
              // (có thể có hàng chục cột) chứa nội dung không tuần tự hóa được
              // (VD lỗi công thức #REF!/#N/A, giá trị lạ do file nguồn sinh ra),
              // TOÀN BỘ phản hồi có thể hỏng thành null - đúng triệu chứng "Không
              // nhận được phản hồi hợp lệ" dù server đã chạy xong rất nhanh. Nay
              // chỉ trích xuất ĐÚNG 3 giá trị chuỗi thực sự cần dùng lại ở bước
              // Xác nhận (Khách hàng, Đại lý, Nguồn gốc), loại bỏ hoàn toàn phần
              // dữ liệu thô không kiểm soát được.
              khGoc: String(r[9] || "").trim(), dlGoc: String(r[13] || "").trim(), ngGoc: String(r[12] || "").trim(),
              // Ngày/Giờ cân dạng ISO string AN TOÀN (không phải Date object thật,
              // không phải mảng thô) để step1_ConfirmImport tái tạo lại đúng Date
              // khi ghi vào PhieuCan_DN - thay thế hoàn toàn cho "rawRowData" cũ.
              rawDateC: dateC ? dateC.toISOString() : "", rawDateD: dateD ? dateD.toISOString() : ""
            });
          }
        } finally {
          // FIX: dùng try/finally để đảm bảo file tạm luôn bị xóa dù có lỗi xảy ra
          // trong lúc đọc (tránh rò rỉ file rác trong Drive khi 1 file lỗi làm hỏng vòng lặp)
          Drive.Files.remove(tempFile.id);
        }
      } catch (eFile) {
        // FIX #24: Nếu là lỗi tạm thời từ Google (Internal Error khi convert file)
        // đã thử lại 3 lần vẫn thất bại - ghi rõ đây là lỗi PHÍA GOOGLE cho riêng
        // file này, KHÔNG làm hỏng việc xử lý các file còn lại trong cùng lượt.
        const thongBaoLoiFile = eFile.toString();
        const laLoiTamThoiGoogle = /internal error|backend error/i.test(thongBaoLoiFile);
        fileLoi.push({
          name: fileData.name,
          reason: laLoiTamThoiGoogle
            ? "Google gặp sự cố tạm thời khi chuyển đổi file (đã tự thử lại 3 lần) - vui lòng thử tải lại riêng file này sau ít phút."
            : thongBaoLoiFile
        });
      }
    });

    // FIX #19 (đã thay bằng FIX #20): TRƯỚC ĐÂY tại đây tạo cả 1 Google Sheet
    // MỚI (SpreadsheetApp.create) mỗi lần bấm "Xem trước", rồi di chuyển giữa
    // các thư mục Drive - ~10 lệnh gọi Drive/Sheets API tuần tự, cộng dồn tới
    // hàng chục giây với file nhiều dòng, có thể khiến phản hồi không kịp về
    // client dù server đã chạy xong. Từng bị xóa hẳn (FIX #19), nay theo yêu
    // cầu chuyển sang cơ chế GIỐNG HỆT NL_PC_XH_Draft bên Xuất hàng: dùng 1
    // Sheet CỐ ĐỊNH có sẵn (CONFIG.PREVIEW_DRAFT_SHEET, cùng Spreadsheet với
    // PhieuCan_DN) - mỗi lần Xem trước XÓA nội dung cũ rồi ghi đè dữ liệu mới
    // của TOÀN BỘ các file trong lượt này (previewRows đã gộp sẵn ở trên),
    // KHÔNG tạo file mới, KHÔNG di chuyển file - chỉ còn 3-4 lệnh setValues/
    // setNumberFormat, nhanh hơn nhiều so với bản cũ.
    if (previewRows.length > 0) {
      let draftSheet = ss.getSheetByName(CONFIG.PREVIEW_DRAFT_SHEET);
      if (!draftSheet) draftSheet = ss.insertSheet(CONFIG.PREVIEW_DRAFT_SHEET);
      const draftHeaders = ["Trạng Thái", "Số Chứng Từ", "Số Phiếu", "Số Xe", "Ngày Cân 1", "Giờ Cân 1", "Ngày Cân 2", "Giờ Cân 2", "KL Cân 1", "KL Cân 2", "KL Hàng (Kg)", "Ghi Chú Lỗi"];
      if (draftSheet.getLastRow() > 1) draftSheet.getRange(2, 1, draftSheet.getLastRow() - 1, draftHeaders.length).clearContent();
      draftSheet.getRange(1, 1, 1, draftHeaders.length).setValues([draftHeaders]).setFontWeight("bold").setBackground("#cfe2ff");
      const draftValues = previewRows.map(row => [
        row.typeImport, row.uniqueKey, row.soPhieu, row.soXe, row.ngayCan1, row.gioCan1, row.ngayCan2, row.gioCan2, row.klCan1, row.klCan2, row.klHangGoc, row.isError ? "❌ " + row.errorMsg : "✔️ Hợp lệ"
      ]);
      // Ép định dạng Text (@) cột B..H TRƯỚC KHI ghi giá trị - tránh Google
      // Sheets tự "đoán" và chuyển chuỗi ngày dd/MM/yyyy thành Date thật theo
      // Locale mặc định của Sheet, khiến ngày bị đảo lần nữa (giống FIX #6).
      draftSheet.getRange(2, 2, previewRows.length, 7).setNumberFormat("@");
      draftSheet.getRange(2, 1, draftValues.length, draftHeaders.length).setValues(draftValues);
      draftSheet.getRange(2, 9, draftValues.length, 3).setNumberFormat("#,##0");
    }

    if (previewRows.length === 0 && fileLoi.length > 0) {
      return { status: "error", message: "Không đọc được dữ liệu từ file nào: " + fileLoi.map(f => f.name + " (" + f.reason + ")").join("; ") };
    }

    let canhBao = "";
    if (fileLoi.length > 0) {
      canhBao = "⚠️ " + fileLoi.length + " file bị bỏ qua: " + fileLoi.map(f => f.name + " - " + f.reason).join("; ");
    }
    return { status: "success", data: previewRows, canhBao: canhBao };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

// Ghi (hoặc GHI ĐÈ nếu trùng Mã chứng từ) các phiếu cân MỚI vào Sheet Draft
// theo dõi "Chưa thanh toán" - CHỈ nhận rowsMoiNK (đã được lọc sẵn ở
// step1_ConfirmImport, chỉ gồm những dòng THẬT SỰ MỚI trong lần import này,
// không bao gồm các dòng cập nhật/trùng với PhieuCan_DN). Không làm hỏng luồng
// import chính nếu Sheet Draft lỗi/không mở được (chỉ ghi log, không throw).
function ghiVaoDraftChuaTT_(rowsMoiNK) {
  if (!rowsMoiNK || rowsMoiNK.length === 0) return;
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DRAFT_CHUATT_SPREADSHEET_ID);
    let sheet = ss.getSheetByName(CONFIG.DRAFT_CHUATT_SHEET);
    const HEADERS = ["Số phiếu", "Ngày cân 1", "Giờ cân 1", "Ngày cân 2", "Giờ cân 2", "Biển số 1", "Biển số 2",
      "Cân lần 1", "Cân lần 2", "KL Hàng (KG)", "Nguồn gốc", "Khách hàng", "Mã hàng", "ĐL", "NG", "Hình ảnh",
      "Mã ĐG", "Giảm giá", "Timestamp", "ĐG_AD", "Picture", "ID_PC (Mã chứng từ)", "Số CT"];
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.DRAFT_CHUATT_SHEET);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold").setBackground("#1B4332").setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }

    // Gom sẵn Mã chứng từ (cột V, index 21 - 0-based -> cột 22, 1-based) đã có
    // trong Draft -> số dòng thật, để biết dòng nào cần GHI ĐÈ thay vì thêm mới.
    const lastRow = sheet.getLastRow();
    const mapDongCu = new Map();
    if (lastRow > 1) {
      const existingKeys = sheet.getRange(2, 22, lastRow - 1, 1).getValues();
      existingKeys.forEach((r, idx) => {
        const key = String(r[0] || "").trim();
        if (key) mapDongCu.set(key, idx + 2);
      });
    }

    const _rf = REGION_FORMAT_();
    const rowsThemMoi = [];
    const dongGhiDe = [];
    // Giữ dạng chữ cho Số phiếu (A) và Số CT (W) giống cách ĐNTT ghi bản sao
    // (không mất số 0 đầu khi Sheets tự đổi "0123" thành số 123).
    const giuChu = function (v) { return typeof v === "string" && v !== "" ? "'" + v.replace(/^'+/, "") : v; };
    rowsMoiNK = rowsMoiNK.map(function (r) { const x = r.slice(); x[0] = giuChu(x[0]); if (x.length > 22) x[22] = giuChu(x[22]); return x; });

    rowsMoiNK.forEach(row => {
      const key = String(row[21] || "").trim();
      if (!key) return;
      if (mapDongCu.has(key)) {
        // TRÙNG Mã chứng từ đã có sẵn trong Draft -> GHI ĐÈ đúng dòng đó (không tạo dòng trùng)
        const dongThat = mapDongCu.get(key);
        sheet.getRange(dongThat, 1, 1, row.length).setValues([row]);
        dongGhiDe.push(dongThat);
      } else {
        rowsThemMoi.push(row);
      }
    });
    // PERF-06: định dạng Ngày/Giờ các dòng ghi đè gom vào 2 lệnh RangeList (trước: 4 lệnh/dòng).
    if (dongGhiDe.length > 0) {
      sheet.getRangeList([].concat.apply([], dongGhiDe.map(function (r) { return ["B" + r, "D" + r]; }))).setNumberFormat(_rf.DATE_FMT);
      sheet.getRangeList([].concat.apply([], dongGhiDe.map(function (r) { return ["C" + r, "E" + r]; }))).setNumberFormat(_rf.TIME_FMT);
    }

    if (rowsThemMoi.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsThemMoi.length, rowsThemMoi[0].length).setValues(rowsThemMoi);
      sheet.getRange(startRow, 2, rowsThemMoi.length, 1).setNumberFormat(_rf.DATE_FMT);
      sheet.getRange(startRow, 3, rowsThemMoi.length, 1).setNumberFormat(_rf.TIME_FMT);
      sheet.getRange(startRow, 4, rowsThemMoi.length, 1).setNumberFormat(_rf.DATE_FMT);
      sheet.getRange(startRow, 5, rowsThemMoi.length, 1).setNumberFormat(_rf.TIME_FMT);
    }
    logAudit_('DRAFT_CHUATT', 'OK', 'Ghi ' + rowsMoiNK.length + ' phiếu vào Draft Chưa Thanh Toán (' + rowsThemMoi.length + ' mới, ' + (rowsMoiNK.length - rowsThemMoi.length) + ' ghi đè).');
  } catch (e) {
    logAudit_('DRAFT_CHUATT', 'ERROR', e.toString());
  }
}

// CONCUR-02: cờ "ĐNTT đang Khóa sổ năm" - ĐNTT (repo HAK_WEBAPP_DNTT_DRAFT) gắn
// Developer Metadata khóa CO_KHOA_SO_DNTT_KEY_ (hiển thị DOCUMENT, để dự án này
// đọc được) lên file Phiếu Cân trong lúc Khóa sổ chạy, gỡ khi xong. Thấy cờ còn
// mới (< 10 phút) thì tạm dừng mọi thao tác ghi PhieuCan_DN. Cờ cũ hơn = ĐNTT bị
// dừng đột ngột, bỏ qua để không kẹt mãi (lớp CONCUR-01 vẫn bảo vệ). Đổi khóa
// hoặc định dạng giá trị thì phải đổi đồng thời ở cả 2 repo.
const CO_KHOA_SO_DNTT_KEY_ = "HAK_KHOA_SO_NAM_DANG_CHAY";
const CO_KHOA_SO_HET_HAN_MS_ = 10 * 60 * 1000;
function KS_thongBaoDNTTDangKhoaSo_() {
  try {
    const ds = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).createDeveloperMetadataFinder().withKey(CO_KHOA_SO_DNTT_KEY_).find();
    for (let i = 0; i < ds.length; i++) {
      let co = {};
      try { co = JSON.parse(ds[i].getValue() || "{}"); } catch (e) { co = {}; }
      const batDau = Number(co.batDau) || 0;
      if (Date.now() - batDau < CO_KHOA_SO_HET_HAN_MS_) {
        return "⏳ ĐNTT đang Khóa sổ năm " + (co.nam || "") + " (bắt đầu lúc " + dinhDangGMT7_(new Date(batDau), "HH:mm")
          + ") - tạm dừng ghi phiếu cân để tránh ghi nhầm dòng. Vui lòng thử lại sau vài phút.";
      }
    }
  } catch (e) { /* không đọc được cờ -> không chặn; CONCUR-01 vẫn kiểm tra dòng trước khi ghi */ }
  return "";
}

// CONCUR-01: ĐNTT (dự án Apps Script KHÁC, khóa hệ thống riêng - LockService
// không chặn chéo giữa 2 dự án) XÓA dòng khỏi PhieuCan_DN khi Khóa sổ năm. Mọi
// chỗ GHI THEO SỐ DÒNG đã đọc từ trước phải đọc lại cột A (Số phiếu) + V (Mã
// chứng từ) của đúng các dòng đích ngay trước khi ghi: lệch -> KHÔNG ghi gì.
const TB_PHIEU_CAN_DA_DOI_ = "Dữ liệu phiếu cân vừa thay đổi vị trí dòng (có thể ĐNTT đang Khóa sổ năm) - chưa ghi gì, vui lòng thực hiện lại sau ít phút.";
function PC_chuKy_(soPhieu, maCT) {
  return String(soPhieu == null ? "" : soPhieu).trim() + "|" + String(maCT == null ? "" : maCT).trim();
}
function PC_chuKyDong_(row) { return PC_chuKy_(row[0], row[21]); }
function PC_kiemTraDongConDung_(sheet, mongDoi) {
  if (!mongDoi || mongDoi.size === 0) return;
  let tu = Infinity, den = 0;
  mongDoi.forEach(function (ck, r) { if (r < tu) tu = r; if (r > den) den = r; });
  if (den > sheet.getLastRow()) throw new Error(TB_PHIEU_CAN_DA_DOI_);
  const cotA = sheet.getRange(tu, 1, den - tu + 1, 1).getValues();
  const cotV = sheet.getRange(tu, 22, den - tu + 1, 1).getValues();
  mongDoi.forEach(function (ck, r) {
    const i = r - tu;
    if (PC_chuKy_(cotA[i][0], cotV[i][0]) !== ck) throw new Error(TB_PHIEU_CAN_DA_DOI_);
  });
}

// Chia danh sách số dòng (tăng dần, không trùng) thành các cụm [tu, den] - 2
// dòng cách nhau <= khoangCach thì chung 1 cụm. Dùng để ĐỌC đúng vùng cần thay
// vì cả đoạn từ dòng nhỏ nhất tới dòng lớn nhất (phiếu rải rác khắp sheet).
function nhomDongTheoCum_(dsDongTang, khoangCach) {
  const cum = [];
  dsDongTang.forEach(function (r) {
    const cuoi = cum[cum.length - 1];
    if (cuoi && r - cuoi[1] <= khoangCach) cuoi[1] = r; else cum.push([r, r]);
  });
  return cum;
}

// Đọc cột [cot..cot+soCot-1] của các dòng trong dsDong -> Map(dòng -> mảng giá trị).
// Ít cụm thì đọc từng cụm; quá nhiều cụm (phiếu rải đều khắp sheet) thì 1 lệnh
// đọc cả đoạn cho đỡ số lượt gọi.
function docCacDong_(sheet, dsDong, cot, soCot) {
  const kq = new Map();
  if (!dsDong.length) return kq;
  const tang = Array.from(new Set(dsDong)).sort(function (a, b) { return a - b; });
  let cum = nhomDongTheoCum_(tang, 300);
  if (cum.length > 25) cum = [[tang[0], tang[tang.length - 1]]];
  cum.forEach(function (c) {
    const gt = sheet.getRange(c[0], cot, c[1] - c[0] + 1, soCot).getValues();
    for (let r = c[0]; r <= c[1]; r++) kq.set(r, gt[r - c[0]]);
  });
  return kq;
}

// PERF-TG-02: ghi NHIỀU vùng rời rạc của 1 sheet bằng 1 lệnh Sheets API
// (values.batchUpdate, RAW = không hiểu thành công thức) khi dịch vụ nâng cao
// "Sheets" đã bật trong appsscript.json. Tính giá 2.000 phiếu rải rác trước đây
// là ~4.000 lệnh setValues. Chỉ dùng cho giá trị SỐ/CHỮ (không có Date). Không
// có dịch vụ / API lỗi -> ghi từng vùng bằng SpreadsheetApp như cũ.
// vung = [{hang, cot, giaTri: [[...], ...]}]
function a1Cot_(n) { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function ghiNhieuVung_(ss, sheet, vung) {
  if (!vung.length) return;
  if (vung.length > 3 && typeof Sheets !== "undefined" && Sheets && Sheets.Spreadsheets && Sheets.Spreadsheets.Values) {
    try {
      const tien = "'" + sheet.getName().replace(/'/g, "''") + "'!";
      const data = vung.map(function (v) {
        const soDong = v.giaTri.length, soCot = v.giaTri[0].length;
        return { range: tien + a1Cot_(v.cot) + v.hang + ":" + a1Cot_(v.cot + soCot - 1) + (v.hang + soDong - 1), values: v.giaTri };
      });
      SpreadsheetApp.flush(); // ghi xong mọi lệnh SpreadsheetApp đang chờ trước khi gọi API trực tiếp
      Sheets.Spreadsheets.Values.batchUpdate({ valueInputOption: "RAW", data: data }, ss.getId());
      return;
    } catch (e) { /* dùng cách ghi từng vùng bên dưới */ }
  }
  vung.forEach(function (v) { sheet.getRange(v.hang, v.cot, v.giaTri.length, v.giaTri[0].length).setValues(v.giaTri); });
}

// DRAFT-02: ghép kết quả tính giá (T, X, Y, Z) vào các dòng A..Z bắt đầu ở dòng
// sheet "dongDau" (dsDong[i] = dòng dongDau + i). ketQua = [{rowNum, gia, hieuSo, trangThai, thanhTien}].
function ghepKetQuaGia_(dsDong, dongDau, ketQua) {
  if (!ketQua || !ketQua.length) return;
  const theoDong = new Map();
  ketQua.forEach(function (k) { if (k.hieuSo !== undefined) theoDong.set(k.rowNum, k); });
  dsDong.forEach(function (r, i) {
    const k = theoDong.get(dongDau + i);
    if (!k) return;
    while (r.length < 26) r.push("");
    r[19] = k.gia; r[23] = k.hieuSo; r[24] = k.trangThai; r[25] = k.thanhTien;
  });
}

// PERF-05: ghi các phiếu cập nhật khi re-import - mỗi khối dòng liền nhau 1 lệnh
// setValues (cột B..S) + định dạng Ngày/Giờ/Số gom vào 3 lệnh RangeList cho cả
// lượt import (trước đây 8 lệnh ghi riêng lẻ cho MỖI phiếu).
function ghiCapNhatPhieuCanGop_(sheet, capNhatTheoDong, rf, chuKyMongDoi) {
  if (capNhatTheoDong.size === 0) return;
  PC_kiemTraDongConDung_(sheet, chuKyMongDoi);
  const dongs = Array.from(capNhatTheoDong.keys()).sort(function (a, b) { return a - b; });
  const vungNgay = [], vungGio = [], vungSo = [];
  let i = 0;
  while (i < dongs.length) {
    let j = i;
    while (j + 1 < dongs.length && dongs[j + 1] === dongs[j] + 1) j++;
    const tu = dongs[i], den = dongs[j];
    sheet.getRange(tu, 2, den - tu + 1, 18).setValues(dongs.slice(i, j + 1).map(function (r) { return capNhatTheoDong.get(r); }));
    vungNgay.push("B" + tu + ":B" + den, "D" + tu + ":D" + den);
    vungGio.push("C" + tu + ":C" + den, "E" + tu + ":E" + den);
    vungSo.push("H" + tu + ":J" + den);
    i = j + 1;
  }
  sheet.getRangeList(vungNgay).setNumberFormat(rf.DATE_FMT);
  sheet.getRangeList(vungGio).setNumberFormat(rf.TIME_FMT);
  sheet.getRangeList(vungSo).setNumberFormat("#,##0");
}

function step1_ConfirmImport_(confirmedDataList, luuDraftChuaTT) {
  // FIX #2: khóa toàn bộ quá trình xác nhận ghi dữ liệu. Nếu 2 người dùng bấm
  // "Xác nhận" gần như đồng thời, nếu không khóa thì cả hai sẽ đọc cùng
  // getLastRow() và ghi đè lên CÙNG một dải hàng, làm mất dữ liệu của một bên.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", message: "Hệ thống đang bận xử lý một yêu cầu khác, vui lòng thử lại sau ít giây." };
  }

  try {
    const _dnttKhoaSo = KS_thongBaoDNTTDangKhoaSo_();
    if (_dnttKhoaSo) return { status: "error", message: _dnttKhoaSo };
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const dataSheet = ss.getSheetByName(CONFIG.DATA_SHEET);
    const lastRow = dataSheet.getLastRow();
    const NUM_COLUMNS = 23; const now = new Date();
    // FIX (bảo vệ chống lệch cột - xem kiemTraLechHeaderSheet_ ở PHẦN 1): chỉ
    // CẢNH BÁO (không chặn) nếu tiêu đề Sheet PhieuCan_DN đã đổi khác so với
    // lần kiểm tra gần nhất, vì hệ thống ghi/đọc theo VỊ TRÍ cột cố định.
    const _canhBaoHeader = kiemTraLechHeaderSheet_(dataSheet, "PhieuCan_DN", NUM_COLUMNS);

    const duplicateMap = new Map();
    if (lastRow > 1) {
      const existingData = dataSheet.getRange(2, 1, lastRow - 1, 25).getValues();
      existingData.forEach((row, index) => {
        const keyMaCT = String(row[21] || "").trim();
        if (keyMaCT) duplicateMap.set(keyMaCT, { rowNum: index + 2, status: String(row[24] || "").trim(), row: row });
      });
    }
    // FIX (an toàn Lưu trữ theo năm - PHẦN 1C): xem giải thích ở step1_PreviewDraft.
    LT_bosungMaChungTuDaLuuTru_(duplicateMap);

    let countNew = 0, countUpdate = 0, countSkip = 0; const batchNew = [];
    const capNhatTheoDong = new Map(); // PERF-05: rowNum -> 18 giá trị cột B..S, ghi gộp sau vòng lặp
    const chuKyDongCapNhat = new Map(); // CONCUR-01: rowNum -> Số phiếu|Mã CT lúc đọc
    // Đọc REGION_FORMAT() 1 lần trước vòng lặp (dùng cho cả nhánh cập nhật dòng
    // đã tồn tại lẫn nhánh ghi dòng mới bên dưới), tránh gọi PropertiesService lặp lại.
    const _rfLoop = REGION_FORMAT_();

    // FIX H-04: không tin dữ liệu trình duyệt gửi lên - tự tính lại Mã chứng từ từ
    // Số phiếu + năm Ngày cân 1 (đúng quy tắc step1_PreviewDraft), bắt buộc ngày
    // hợp lệ và khối lượng là số hữu hạn >= 0. Dòng sai bị bỏ qua (đếm riêng).
    const soHuuHan_ = function (v) { const n = typeof v === "number" ? v : Number(v); return isFinite(n) && n >= 0 ? n : null; };
    let countKhongHopLe = 0;
    for (let item of confirmedDataList) {
      if (!item || item.isError) continue;
      const _dC = item.rawDateC ? new Date(item.rawDateC) : null;
      const _dD = item.rawDateD ? new Date(item.rawDateD) : null;
      const _kl1 = soHuuHan_(item.klCan1), _kl2 = soHuuHan_(item.klCan2), _klH = soHuuHan_(item.klHangGoc);
      const _soPhieu = String(item.soPhieu == null ? "" : item.soPhieu).trim();
      if (!_soPhieu || !_dC || isNaN(_dC.getTime()) || !_dD || isNaN(_dD.getTime()) || _kl1 === null || _kl2 === null || !_klH) { countKhongHopLe++; continue; }
      item.uniqueKey = _soPhieu + "/" + _dC.getFullYear() + "/NK";
      item.klCan1 = _kl1; item.klCan2 = _kl2; item.klHangGoc = _klH;
      // FIX (Sanitize): áp dụng sanitize() (chống Formula/CSV Injection - xem
      // định nghĩa ở PHẦN 6) cho MỌI chuỗi văn bản tự do đến từ file Excel tải
      // lên (Số phiếu, Số xe, Khách hàng, Đại lý, Nguồn gốc) - TRƯỚC ĐÂY chỉ áp
      // dụng cho module Kho Dăm, khiến 1 ô bắt đầu bằng "=" trong file gốc có
      // thể trở thành công thức sống ngay trong sổ sách PhieuCan_DN.
      const valA_Dich = sanitize_(item.soPhieu); const valF_Dich = sanitize_(item.soXe); const uniqueKeyMaCT = item.uniqueKey;
      let valL_Dich = sanitize_(item.khGoc); let valN_Dich = sanitize_(String(item.dlGoc || "").toUpperCase()); let valO_Dich = sanitize_(String(item.ngGoc || "").toUpperCase());
      let valK_Dich = valN_Dich + "_" + valO_Dich; let valQ_Dich = valN_Dich + "_" + valO_Dich + "_Y";

      // FIX #22: TRƯỚC ĐÂY dùng "toDateObj(r[2])"/"toDateObj(r[3])" - biến "r"
      // KHÔNG TỒN TẠI trong hàm này (đó là biến của step1_PreviewDraft, đã bị
      // xóa cùng "rawRowData" ở FIX #21) - gây lỗi "ReferenceError: r is not
      // defined" ngay khi có phiếu MỚI cần ghi. Nay tái tạo đúng Date object từ
      // "item.rawDateC"/"item.rawDateD" (chuỗi ISO an toàn, được step1_PreviewDraft
      // gửi kèm mỗi dòng xem trước) - khớp đúng cấu trúc mới. Tính TRƯỚC nhánh
      // cập nhật/mới để dùng chung được cho cả 2 nhánh bên dưới.
      let dateC = item.rawDateC ? new Date(item.rawDateC) : null;
      let dateD = item.rawDateD ? new Date(item.rawDateD) : null;

      if (duplicateMap.has(uniqueKeyMaCT)) {
        const info = duplicateMap.get(uniqueKeyMaCT);

        if (info.status === "OK") { countSkip++; continue; }

        // ---- FIX QUAN TRỌNG (giống lỗi ở bản DH) ----
        // Đây là lớp bảo vệ dự phòng: về lý thuyết step1_PreviewDraft() đã đánh dấu
        // isError=true cho mọi dòng trùng mã chứng từ NGAY TRONG CÙNG batch
        // (xem seenInThisBatch ở trên), nên các dòng như vậy thường đã bị "continue"
        // ở đầu vòng lặp này rồi. Nhánh dưới đây chỉ kích hoạt nếu client gọi thẳng
        // Confirm mà bỏ qua bước Preview, hoặc gửi sai cờ isError — khi đó phải
        // cập nhật thẳng vào mảng batchNew đang ở RAM, KHÔNG được gọi getRange lên
        // sheet bằng info.rowNum (lúc đó info.rowNum sẽ là undefined -> lỗi
        // "Tham số (null,number)...").
        // FIX (cập nhật thiếu khối lượng/ngày giờ khi re-import): TRƯỚC ĐÂY nhánh
        // "Cập nhật dòng cũ" chỉ ghi lại mã Khách hàng/Đại lý/Nguồn gốc, KHÔNG bao
        // giờ cập nhật lại Cân lần 1/2, KL Hàng hay Ngày/Giờ cân - nếu file gốc lần
        // đầu nhập sai khối lượng, tải lại file đã sửa (khi phiếu CHƯA bị khóa "OK")
        // vẫn âm thầm giữ nguyên số liệu SAI cũ. Nay cập nhật đầy đủ luôn cả các cột
        // này, đúng đúng ý nghĩa "re-import file đã sửa để thay thế dữ liệu cũ".
        if (info.rowNum === undefined && info.batchIndex !== undefined) {
          const row = batchNew[info.batchIndex];
          row[1] = dateC ? toDateOnly_(dateC) : row[1];
          row[2] = dateC ? toTimeOnly_(dateC) : row[2];
          row[3] = dateD ? toDateOnly_(dateD) : row[3];
          row[4] = dateD ? toTimeOnly_(dateD) : row[4];
          row[5] = valF_Dich;
          row[7] = item.klCan1 !== undefined ? item.klCan1 : row[7];
          row[8] = item.klCan2 !== undefined ? item.klCan2 : row[8];
          row[9] = item.klHangGoc !== undefined ? item.klHangGoc : row[9];
          row[10] = valK_Dich;
          row[11] = valL_Dich;
          row[13] = valN_Dich;
          row[14] = valO_Dich;
          row[16] = valQ_Dich;
          row[18] = now;
          countUpdate++;
          continue;
        }

        // TỐI ƯU: gộp các lệnh getRange/setValue(s)/setNumberFormat(s) liền cột
        // thành ít lệnh nhất có thể (giảm số lượt gọi Sheets API cho mỗi dòng
        // cập nhật - từ 13 lệnh xuống còn 7 lệnh) - GIỮ NGUYÊN 100% giá trị và
        // định dạng ghi vào từng cột, chỉ đổi CÁCH gộp lệnh gọi.
        // Cột B..F (Ngày/Giờ cân 1, Ngày/Giờ cân 2, Số xe) - 1 lệnh ghi giá trị duy nhất.
        // PERF-05: chỉ GOM giá trị (ghi 1 lần sau vòng lặp). Các cột G, M, P, R
        // KHÔNG thuộc diện cập nhật được ghi lại đúng giá trị vừa đọc (trong khóa).
        const cu = info.row;
        chuKyDongCapNhat.set(info.rowNum, PC_chuKyDong_(cu));
        capNhatTheoDong.set(info.rowNum, [
          dateC ? toDateOnly_(dateC) : "", dateC ? toTimeOnly_(dateC) : "",
          dateD ? toDateOnly_(dateD) : "", dateD ? toTimeOnly_(dateD) : "",
          valF_Dich, cu[6], item.klCan1, item.klCan2, item.klHangGoc,
          valK_Dich, valL_Dich, cu[12], valN_Dich, valO_Dich, cu[15], valQ_Dich, cu[17], now
        ]);
        countUpdate++; continue;
      }

      let newRow = new Array(NUM_COLUMNS).fill("");
      newRow[0] = valA_Dich;

      // FIX #3: Ghi đúng Ngày THUẦN vào cột "Ngày cân X" và Giờ THUẦN vào cột
      // "Giờ cân X", khớp với đúng quy ước dữ liệu thật đang có trong hệ thống
      // (thay vì ghi 1 datetime đầy đủ vào cả 2 cột như trước — vẫn hiển thị
      // đúng nhưng giá trị gốc lưu trong ô bị lệch chuẩn kiểu dữ liệu).
      newRow[1] = dateC ? toDateOnly_(dateC) : "";
      newRow[2] = dateC ? toTimeOnly_(dateC) : "";
      newRow[3] = dateD ? toDateOnly_(dateD) : "";
      newRow[4] = dateD ? toTimeOnly_(dateD) : "";

      newRow[5] = valF_Dich; newRow[7] = item.klCan1; newRow[8] = item.klCan2; newRow[9] = item.klHangGoc;
      newRow[10] = valK_Dich; newRow[11] = valL_Dich; newRow[12] = "GK"; newRow[13] = valN_Dich; newRow[14] = valO_Dich;
      newRow[15] = "Y"; newRow[16] = valQ_Dich; newRow[17] = 0; newRow[18] = now; newRow[21] = sanitize_(uniqueKeyMaCT); newRow[22] = sanitize_(uniqueKeyMaCT); // H-04: Mã CT cũng chặn công thức
      batchNew.push(newRow);
      // FIX: lưu batchIndex thay vì object rỗng, để nếu gặp trùng lặp ngay trong
      // cùng batch (dòng chưa ghi lên sheet) thì cập nhật đúng dòng RAM, không undefined.
      duplicateMap.set(uniqueKeyMaCT, { status: "", batchIndex: batchNew.length - 1 });
      countNew++;
    }

    ghiCapNhatPhieuCanGop_(dataSheet, capNhatTheoDong, _rfLoop, chuKyDongCapNhat);

    let startRowMoi = 0;
    if (batchNew.length > 0) {
      const startRow = dataSheet.getLastRow() + 1;
      startRowMoi = startRow;
      dataSheet.getRange(startRow, 1, batchNew.length, NUM_COLUMNS).setValues(batchNew);

      // FIX #15: REGION_FORMAT giờ là HÀM đọc động từ PropertiesService (có thể
      // đổi ngay trên giao diện Hệ thống → Cấu hình hệ thống, không cần deploy
      // lại) - gọi 1 LẦN rồi tái sử dụng, tránh đọc PropertiesService lặp lại
      // không cần thiết cho mỗi setNumberFormat.
      const _rf = REGION_FORMAT_();
      dataSheet.getRange(startRow, 2, batchNew.length, 1).setNumberFormat(_rf.DATE_FMT); // Ngày Cân 1
      dataSheet.getRange(startRow, 3, batchNew.length, 1).setNumberFormat(_rf.TIME_FMT); // Giờ Cân 1
      dataSheet.getRange(startRow, 4, batchNew.length, 1).setNumberFormat(_rf.DATE_FMT); // Ngày Cân 2
      dataSheet.getRange(startRow, 5, batchNew.length, 1).setNumberFormat(_rf.TIME_FMT); // Giờ Cân 2

    }

    // FIX #23: TRƯỚC ĐÂY tại đây quét thư mục Input, di chuyển từng file gốc
    // sang Done - không còn cần nữa vì step1_PreviewDraft giờ lưu file gốc
    // THẲNG vào Done ngay từ bước Xem trước (đơn giản hóa, không cần thư mục
    // Input trung gian nữa).

    let priceMsg = "";
    let priceResult = null;
    if (countNew > 0 || countUpdate > 0) {
      // FIX #2: gọi thẳng bản "_core" KHÔNG khóa, vì ta đang giữ khóa của
      // step1_ConfirmImport rồi. Nếu gọi runCalculatePrice() (bản có khóa)
      // ở đây sẽ bị TREO VĨNH VIỄN (deadlock) vì cùng 1 lượt thực thi lại tự
      // chờ khóa mà chính nó đang giữ.
      priceResult = runCalculatePrice_core_(undefined, true); // FIX H-02: luôn lấy ketQua để đồng bộ Draft Chưa TT
      priceMsg = " | " + priceResult.message;
    }

    // Tùy chọn: đồng thời lưu (ghi đè nếu trùng) các phiếu MỚI vào sheet
    // PhieuCan_DN_CHUA_TT_DRAFT (bản sao "phiếu cân chưa thanh toán" trong File
    // Nháp của ĐNTT - địa chỉ đặt ở Liên kết dữ liệu) - CHỈ nhận phiếu mới.
    // DRAFT-01: ghi SAU khi tính giá, đọc lại đúng các dòng vừa thêm để kèm Đơn
    // giá / Trạng thái / Thành tiền (X..Z): ĐNTT bỏ qua phiếu có Thành tiền <= 0
    // khi chọn phiếu thanh toán, nên ghi trước lúc tính giá thì phiếu không hiện
    // bên ĐNTT cho tới lần làm mới bản sao 7:30/13:00.
    // FIX H-02: phiếu ĐÃ CÓ trong Draft Chưa TT (ĐNTT) được cập nhật theo KL/ngày/
    // giá mới sau khi import lại + tính giá (chỉ cập nhật, không thêm mới) - trước
    // đây chỉ phiếu MỚI được ghi, ĐNTT thấy số liệu cũ tới lần làm mới 7:30/13:00.
    if (priceResult && priceResult.ketQua && priceResult.ketQua.length) TC_dongBoDraftChuaTT_(dataSheet, priceResult.ketQua);
    if (luuDraftChuaTT && batchNew.length > 0) {
      const docLai = dataSheet.getRange(startRowMoi, 1, batchNew.length, 26).getValues();
      const dungDong = docLai.every(function (r, i) { return String(r[21] || "").trim() === String(batchNew[i][21] || "").trim(); });
      const dongDraft = dungDong ? docLai : batchNew;
      // DRAFT-02: giá có thể vừa ghi qua Sheets API (ghiNhieuVung_) - không trông vào
      // việc đọc lại bằng SpreadsheetApp thấy ngay; ghép thẳng kết quả vừa tính vào.
      ghepKetQuaGia_(dongDraft, startRowMoi, priceResult && priceResult.ketQua);
      ghiVaoDraftChuaTT_(dongDraft);
    }
    const draftMsg = luuDraftChuaTT ? ` | Đã lưu ${batchNew.length} phiếu vào Draft Chưa Thanh Toán` : "";
    const khongHopLeMsg = countKhongHopLe ? `, Dữ liệu không hợp lệ (bỏ qua): ${countKhongHopLe}` : "";
    const finalMsg = `Mới: ${countNew}, Cập nhật: ${countUpdate}, Bỏ qua: ${countSkip}${khongHopLeMsg}${priceMsg}${draftMsg}`;
    logAudit_('IMPORT_PHIEUCAN', 'OK', finalMsg);
    return { status: "success", message: finalMsg + (_canhBaoHeader ? " | " + _canhBaoHeader : "") };
  } catch (e) {
    logAudit_('IMPORT_PHIEUCAN', 'ERROR', e.toString());
    return { status: "error", message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/*********************************************************
 * PHẦN 1B: NHẬP LIỆU THỦ CÔNG PHIẾU CÂN (MENU 1 - TAB "NHẬP TAY")
 *********************************************************/

// fields: {soPhieu, soXe, soXe2, ngayCan1, gioCan1, ngayCan2, gioCan2, klCan1, klCan2, klHang, khachHang, maKH, maNG}
// LƯU Ý QUAN TRỌNG: "maKH" ở đây thực chất là Mã ĐẠI LÝ (ghi vào cột N "ĐL" của
// PhieuCan_DN), KHÔNG PHẢI Mã Khách Hàng — tên biến giữ nguyên theo code gốc để
// khỏi phải đổi cả chuỗi logic valK_Dich/valQ_Dich, nhưng nhãn hiển thị trên
// giao diện đã sửa thành "Mã Đại Lý - ĐL" để tránh nhầm lẫn khi nhập liệu thật.
// "maNG" là Mã Nguồn Gốc (cột O "NG"), tên gọi khớp đúng ý nghĩa.
function addManualPhieuCan_(fields) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", message: "Hệ thống đang bận xử lý một yêu cầu khác, vui lòng thử lại sau ít giây." };
  }

  try {
    const _dnttKhoaSo = KS_thongBaoDNTTDangKhoaSo_();
    if (_dnttKhoaSo) return { status: "error", message: _dnttKhoaSo };
    if (!fields || !String(fields.soPhieu || "").trim()) return { status: "error", message: "Vui lòng nhập Số phiếu." };
    if (!String(fields.soXe || "").trim()) return { status: "error", message: "Vui lòng nhập Số xe." };

    const dateC = combineDateTime_(fields.ngayCan1, fields.gioCan1);
    const dateD = combineDateTime_(fields.ngayCan2, fields.gioCan2);
    if (!dateC) return { status: "error", message: "Ngày/giờ cân 1 không hợp lệ." };
    if (!dateD) return { status: "error", message: "Ngày/giờ cân 2 không hợp lệ." };

    const rawCan1 = parseFloat(fields.klCan1) || 0;
    const rawCan2 = parseFloat(fields.klCan2) || 0;
    const rawHang = parseFloat(fields.klHang) || 0;
    if (rawHang <= 0) return { status: "error", message: "Khối lượng hàng phải lớn hơn 0." };

    // Đồng bộ quy ước với step1_PreviewDraft: nếu số nhập vào < 70 thì hiểu là đơn vị Tấn -> quy đổi ra Kg
    const klCan1 = rawCan1 < 70 ? rawCan1 * 1000 : rawCan1;
    const klCan2 = rawCan2 < 70 ? rawCan2 * 1000 : rawCan2;
    const klHang = rawHang < 70 ? rawHang * 1000 : rawHang;

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const dataSheet = ss.getSheetByName(CONFIG.DATA_SHEET);
    const lastRow = dataSheet.getLastRow();
    const nam = dateC.getFullYear();
    const uniqueKeyMaCT = String(fields.soPhieu).trim() + "/" + nam + "/NK";

    if (lastRow > 1) {
      // Chỉ cần đọc cột V (22) để so trùng Mã Chứng Từ, không cần load cả 25 cột
      const existingKeys = dataSheet.getRange(2, 22, lastRow - 1, 1).getValues();
      for (let row of existingKeys) {
        if (String(row[0] || "").trim() === uniqueKeyMaCT) {
          return { status: "error", message: "Số chứng từ " + uniqueKeyMaCT + " đã tồn tại. Vui lòng kiểm tra lại Số phiếu / năm." };
        }
      }
    }
    // FIX (an toàn Lưu trữ theo năm - PHẦN 1C): năm "nam" ở trên có thể đã được
    // Admin "chốt sổ" (chuyển sang sheet lưu trữ) - kiểm tra thêm đúng sheet năm
    // đó để không nhập trùng 1 Mã Chứng Từ đã có trong dữ liệu lưu trữ.
    if (LT_trungMaChungTuTrongNamLuuTru_(nam, uniqueKeyMaCT)) {
      return { status: "error", message: "Số chứng từ " + uniqueKeyMaCT + " đã tồn tại trong dữ liệu LƯU TRỮ (năm " + nam + " đã chốt sổ). Vui lòng kiểm tra lại Số phiếu / năm." };
    }

    const NUM_COLUMNS = 23; const now = new Date();
    let newRow = new Array(NUM_COLUMNS).fill("");
    const maKH = String(fields.maKH || "").toUpperCase().trim();
    const maNG = String(fields.maNG || "").toUpperCase().trim();
    const valK_Dich = maKH + "_" + maNG;
    const valQ_Dich = maKH + "_" + maNG + "_Y";

    // FIX (Sanitize): áp dụng sanitize() (chống Formula/CSV Injection - định
    // nghĩa ở PHẦN 6) cho các trường văn bản tự do gõ tay - TRƯỚC ĐÂY chỉ áp
    // dụng ở module Kho Dăm, khiến ai đó gõ nhầm/cố ý 1 ô bắt đầu bằng "="
    // (VD số điện thoại dạng "=SDT...") có thể trở thành công thức sống.
    newRow[0] = sanitize_(String(fields.soPhieu).trim());
    // FIX #3: Ghi đúng Ngày THUẦN vào cột "Ngày cân X" và Giờ THUẦN vào cột
    // "Giờ cân X", khớp đúng quy ước dữ liệu thật (xem toDateOnly_/toTimeOnly_).
    newRow[1] = toDateOnly_(dateC); newRow[2] = toTimeOnly_(dateC);
    newRow[3] = toDateOnly_(dateD); newRow[4] = toTimeOnly_(dateD);
    newRow[5] = sanitize_(String(fields.soXe).trim());
    newRow[6] = sanitize_(String(fields.soXe2 || "").trim()); // Cột G - Biển số 2 (tùy chọn, cho xe kéo/rơ-moóc)
    newRow[7] = klCan1; newRow[8] = klCan2; newRow[9] = klHang;
    newRow[10] = valK_Dich;
    newRow[11] = sanitize_(String(fields.khachHang || "").trim()); // Cột L - Khách hàng
    newRow[12] = "GK"; newRow[13] = maKH; newRow[14] = maNG;
    newRow[15] = "Y"; newRow[16] = valQ_Dich; newRow[17] = 0; newRow[18] = now;
    newRow[21] = uniqueKeyMaCT; newRow[22] = uniqueKeyMaCT;

    const startRow = dataSheet.getLastRow() + 1;
    dataSheet.getRange(startRow, 1, 1, NUM_COLUMNS).setValues([newRow]);
    // FIX #14: đồng bộ với step1_ConfirmImport - dùng chung REGION_FORMAT (Config.gs)
    // FIX #15: REGION_FORMAT là hàm đọc động (Config.gs)
    const _rf2 = REGION_FORMAT_();
    dataSheet.getRange(startRow, 2, 1, 1).setNumberFormat(_rf2.DATE_FMT);
    dataSheet.getRange(startRow, 3, 1, 1).setNumberFormat(_rf2.TIME_FMT);
    dataSheet.getRange(startRow, 4, 1, 1).setNumberFormat(_rf2.DATE_FMT);
    dataSheet.getRange(startRow, 5, 1, 1).setNumberFormat(_rf2.TIME_FMT);

    // Gọi bản _core (không khóa) vì đang giữ khóa của addManualPhieuCan rồi
    const priceResult = runCalculatePrice_core_();
    const finalMsg = "Đã thêm phiếu cân " + uniqueKeyMaCT + " | " + priceResult.message;
    logAudit_('MANUAL_ENTRY', 'OK', finalMsg);
    return { status: "success", message: finalMsg };
  } catch (e) {
    logAudit_('MANUAL_ENTRY', 'ERROR', e.toString());
    return { status: "error", message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function combineDateTime_(dateStr, timeStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T" + (timeStr || "00:00") + ":00");
  if (isNaN(d.getTime())) return null;
  return d;
}

/*********************************************************
 * PHẦN 1C: ĐỌC DỮ LIỆU LƯU TRỮ THEO NĂM (NẾU CÓ)
 * Chức năng "Chốt sổ năm" ĐÃ BỎ (27/09/2026). Các hàm dưới đây chỉ còn ĐỌC các
 * sheet "PhieuCan_DN_<năm>" nếu trước đây từng được tạo - để báo cáo, kiểm tra
 * trùng khi import và tra cứu vẫn thấy dữ liệu đó. Không có sheet lưu trữ nào
 * thì chỉ tốn 1 lệnh getSheets() và mọi thứ chạy trên PhieuCan_DN như bình thường.
 *********************************************************/

// A..AA - đủ mọi cột PhieuCan_DN đang dùng (kể cả AA=ID_DNTT) - archive KHÔNG
// được làm mất cột nào so với sheet gốc.
const LT_SO_COT_DAY_DU = 27;

// Xóa nhiều dòng (số dòng thật trên sheet) an toàn + nhanh: xóa TỪ DƯỚI LÊN để
// xóa dòng phía trên không làm lệch số dòng của các dòng còn chờ xóa, và gom
// các dòng liền nhau thành 1 lệnh deleteRows() (mỗi lệnh là 1 lượt gọi Sheets
// API chậm - xóa 200 dòng liền nhau: 1 lượt thay vì 200). Trả về số dòng đã xóa.
function xoaCacDong_(sheet, dsDong) {
  const giam = dsDong.filter(function (r, i, a) { return r >= 2 && a.indexOf(r) === i; })
    .sort(function (a, b) { return b - a; });
  let i = 0;
  while (i < giam.length) {
    let j = i;
    while (j + 1 < giam.length && giam[j + 1] === giam[j] - 1) j++;
    sheet.deleteRows(giam[j], j - i + 1); // giam[j] = dòng NHỎ NHẤT của khối
    i = j + 1;
  }
  return giam.length;
}

function LT_tenSheetLuuTru_(nam) {
  return CONFIG.DATA_SHEET + "_" + nam;
}

// Liệt kê TẤT CẢ các năm đã từng "chốt sổ" (tồn tại sheet PhieuCan_DN_<năm>) -
// quét theo TÊN sheet, không cần nhớ trước danh sách năm nào.
function LT_layDanhSachNamDaLuuTru_(ss) {
  const prefix = CONFIG.DATA_SHEET + "_";
  const nams = [];
  ss.getSheets().forEach(function (sh) {
    const ten = sh.getName();
    if (ten.indexOf(prefix) === 0) {
      const phanNam = ten.substring(prefix.length);
      if (/^\d{4}$/.test(phanNam)) nams.push(parseInt(phanNam, 10));
    }
  });
  return nams;
}

// Danh sách năm CẦN kiểm tra sheet lưu trữ cho 1 khoảng lọc ngày (fromDate/
// toDate dạng "yyyy-MM-dd" hoặc rỗng). Nếu KHÔNG lọc ngày (cả 2 đều rỗng), trả
// về TOÀN BỘ các năm đã từng lưu trữ - an toàn, không bỏ sót năm nào khi người
// dùng không giới hạn ngày (đồng nghĩa muốn xem/kiểm tra hết lịch sử).
// PERF-03: chỉ trả về năm THỰC SỰ có sheet lưu trữ (1 lần getSheets()) thay vì
// dò getSheetByName từng năm từ 2000 khi "Từ ngày" để trống - kết quả đọc y hệt.
function LT_capNamCanDoc_(ss, fromDate, toDate) {
  const namDaLuuTru = LT_layDanhSachNamDaLuuTru_(ss);
  if (!fromDate && !toDate) return namDaLuuTru;
  const namTu = fromDate ? new Date(fromDate).getFullYear() : 2000;
  const namDen = toDate ? new Date(toDate).getFullYear() : new Date().getFullYear();
  return namDaLuuTru.filter(function (n) { return n >= namTu && n <= namDen; })
    .sort(function (a, b) { return a - b; });
}

// Đọc dữ liệu PhieuCan_DN GỘP CẢ sheet đang hoạt động LẪN các sheet lưu trữ
// theo năm CÓ LIÊN QUAN tới khoảng ngày lọc (xem LT_capNamCanDoc_ ở trên).
// Trả về mảng các dòng đủ soCot cột (KHÔNG kèm dòng tiêu đề) - dùng thay cho
// sheet.getRange(2,1,lastRow-1,soCot).getValues() ở các hàm báo cáo cần nhìn
// xuyên cả dữ liệu đã lưu trữ.
function LT_docPhieuCanGopLuuTru_(fromDate, toDate, soCot) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheetChinh = ss.getSheetByName(CONFIG.DATA_SHEET);
  const lastRowChinh = sheetChinh.getLastRow();
  let rows = lastRowChinh > 1 ? sheetChinh.getRange(2, 1, lastRowChinh - 1, soCot).getValues() : [];

  LT_capNamCanDoc_(ss, fromDate, toDate).forEach(function (nam) {
    const sheetNam = ss.getSheetByName(LT_tenSheetLuuTru_(nam));
    if (sheetNam && sheetNam.getLastRow() > 1) {
      rows = rows.concat(sheetNam.getRange(2, 1, sheetNam.getLastRow() - 1, soCot).getValues());
    }
  });
  return rows;
}

// Kiểm tra 1 Mã Chứng Từ có trùng với dữ liệu ĐÃ LƯU TRỮ của ĐÚNG 1 năm cụ thể
// hay không - dùng khi đã biết trước năm cần kiểm tra (VD nhập tay 1 phiếu),
// nhanh hơn quét tất cả các năm đã lưu trữ vì chỉ mở đúng 1 sheet năm đó.
function LT_trungMaChungTuTrongNamLuuTru_(nam, maChungTu) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheetNam = ss.getSheetByName(LT_tenSheetLuuTru_(nam));
  if (!sheetNam || sheetNam.getLastRow() <= 1) return false;
  const keys = sheetNam.getRange(2, 22, sheetNam.getLastRow() - 1, 1).getValues(); // Cột V
  return keys.some(function (row) { return String(row[0] || "").trim() === maChungTu; });
}

// QUAN TRỌNG (an toàn khi có Lưu trữ theo năm): bổ sung TOÀN BỘ Mã Chứng Từ
// đang có trong MỌI sheet lưu trữ vào 1 duplicateMap đã dựng sẵn từ sheet đang
// hoạt động (dùng trong step1_PreviewDraft/step1_ConfirmImport - xử lý cả LÔ
// nhiều phiếu, có thể thuộc nhiều năm khác nhau, nên quét hết các năm đã lưu
// trữ 1 lần thay vì đoán trước năm nào). KHÔNG GHI ĐÈ nếu key đã có sẵn trong
// map (ưu tiên dữ liệu ở sheet đang hoạt động, dù về lý thuyết 1 Mã Chứng Từ
// không thể vừa ở sheet chính vừa ở sheet lưu trữ). status LUÔN là "OK" (chỉ
// phiếu đã "OK" mới từng được chuyển sang lưu trữ) để luồng import tự động
// "Bỏ qua (Đã khóa OK)" đúng như với 1 dòng OK còn nằm ở sheet chính, không
// bao giờ cố ghi đè 1 dòng đã lưu trữ (rowNum để undefined - không dùng tới,
// vì nhánh "OK" luôn bị bỏ qua trước khi cần đến rowNum).
function LT_bosungMaChungTuDaLuuTru_(duplicateMap) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  LT_layDanhSachNamDaLuuTru_(ss).forEach(function (nam) {
    const sheetNam = ss.getSheetByName(LT_tenSheetLuuTru_(nam));
    const lastRowNam = sheetNam ? sheetNam.getLastRow() : 0;
    if (lastRowNam > 1) {
      sheetNam.getRange(2, 22, lastRowNam - 1, 1).getValues().forEach(function (row) {
        const key = String(row[0] || "").trim();
        if (key && !duplicateMap.has(key)) duplicateMap.set(key, { rowNum: undefined, status: "OK" });
      });
    }
  });
}


/*********************************************************
 * PHẦN 2: BIỆT LẬP CÁC CHỨC NĂNG XUẤT BÁO CÁO (CHẠY ĐỘC LẬP)
 *********************************************************/

// FIX H-06: thông tin bản dữ liệu Misa đang nằm trong Update_MiSa_PC (Script Properties).
const MISA_BAN_PROP_ = "MISA_BAN_HIEN_TAI_JSON";
function MISA_luuThongTinBan_(start, end, soDong) {
  const tt = {
    tuNgay: dinhDangGMT7_(start, "yyyy-MM-dd"), denNgay: dinhDangGMT7_(end, "yyyy-MM-dd"),
    soDong: soDong, email: layThongTinNguoiDungHienTai_().email || "", luc: dinhDangGMT7_(new Date(), "dd/MM/yyyy HH:mm:ss")
  };
  PropertiesService.getScriptProperties().setProperty(MISA_BAN_PROP_, JSON.stringify(tt));
  return tt;
}
function MISA_docThongTinBan_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(MISA_BAN_PROP_) || "null"); } catch (e) { return null; }
}
function MISA_moTaBan_(tt) {
  if (!tt) return "";
  const d = function (s) { const p = String(s).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : s; };
  return "khoảng " + d(tt.tuNgay) + " – " + d(tt.denNgay) + ", " + tt.soDong + " dòng, tạo bởi " + (tt.email || "?") + " lúc " + tt.luc;
}

function runCreateMisaData_(fromDate, toDate) {
  try {
    const res = copyDataWithFinalLookup_(fromDate, toDate);
    if(res.status === "success") {
      return { status: "success", message: "Đã xử lý trích xuất dữ liệu hạch toán MISA thành công (" + MISA_moTaBan_(res.thongTin) + ")." };
    } else {
      return res;
    }
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// tuNgay/denNgay (tùy chọn, yyyy-MM-dd): khoảng người dùng đang chọn trên giao diện.
// FIX H-06: nếu bản dữ liệu Misa hiện có là KHOẢNG KHÁC (VD người khác vừa trích
// xuất kỳ khác) thì KHÔNG tải, báo rõ bản hiện có để bấm "Chạy trích xuất" lại.
function downloadMisaExcel_(tuNgay, denNgay) {
  try {
    const ssMisa = SpreadsheetApp.openById(CONFIG.MISA_DST_ID);
    const sheet = ssMisa.getSheetByName(CONFIG.MISA_DST_SHEET);
    const lastRow = sheet.getLastRow();
    const ban = MISA_docThongTinBan_();
    if (tuNgay && denNgay && ban && (ban.tuNgay !== String(tuNgay) || ban.denNgay !== String(denNgay))) {
      return { status: "error", message: "Dữ liệu Misa hiện có KHÔNG khớp khoảng ngày đang chọn - bản hiện có: " + MISA_moTaBan_(ban) + ". Bấm \"Chạy trích xuất dữ liệu Misa\" cho đúng khoảng rồi tải lại." };
    }
    if (lastRow <= 1) return { status: "error", message: "Bảng dữ liệu MISA trống! Vui lòng bấm tạo data trước." + (ban ? " (Bản gần nhất: " + MISA_moTaBan_(ban) + ")" : "") };

    const data = sheet.getRange(1, 1, lastRow, 31).getValues();
    const tempSS = SpreadsheetApp.create("Misa_Export_" + (ban ? ban.tuNgay + "_den_" + ban.denNgay + "_" : "") + dinhDangGMT7_(new Date(), "ddMM_HHmm"));
    const tempSheet = tempSS.getSheets()[0];

    tempSheet.getRange(1, 10, data.length, 2).setNumberFormat("@");
    tempSheet.getRange(1, 1, data.length, 31).setValues(chongCongThucBang_(data));
    tempSheet.getRange(1, 1, 1, 31).setBackground("#B7B7B7").setFontWeight("bold").setHorizontalAlignment("center");

    const tempFile = DriveApp.getFileById(tempSS.getId());
    DriveApp.getFolderById(CONFIG.FOLDER_DONE).addFile(tempFile);
    DriveApp.getRootFolder().removeFile(tempFile);

    return { status: "success", url: "https://docs.google.com/spreadsheets/d/" + tempSS.getId() + "/export?format=xlsx" };
  } catch (e) { return { status: "error", message: "Lỗi tạo file tải: " + e.toString() }; }
}

/*********************************************************
 * PHẦN KỸ THUẬT NGẦM CHỐNG TREO & SỬA LỖI ĐỊNH DẠNG NGÀY
 *********************************************************/
function copyDataWithFinalLookup_(fromDate, toDate) {
  // FIX #2: khóa vì hàm này CLEAR + GHI ĐÈ toàn bộ sheet Update_MiSa_PC.
  // Nếu 2 người cùng bấm "Tạo data Misa" cùng lúc, không khóa có thể dẫn tới
  // xung đột đọc/ghi hoặc một phiên xóa dữ liệu ngay khi phiên kia đang đọc.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", message: "Hệ thống đang bận xử lý một yêu cầu khác, vui lòng thử lại sau ít giây." };
  }

  try {
    const ssTarget   = SpreadsheetApp.openById(CONFIG.MISA_DST_ID).getSheetByName(CONFIG.MISA_DST_SHEET);
    const ssRef      = SpreadsheetApp.openById(CONFIG.SRC_FILE_ID);
    const ssDNTT     = SpreadsheetApp.openById(CONFIG.DNTT_FILE_ID);
    let start = fromDate ? new Date(fromDate + "T00:00:00+07:00") : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    let end = toDate ? new Date(toDate + "T23:59:59+07:00") : new Date();
    const mapNG = createSimpleMap_(ssRef.getSheetByName('DM_NG'), 1, 3);
    const dataKH = ssRef.getSheetByName('DM_KH').getDataRange().getValues();
    let mapKH = {}; for (let i = 1; i < dataKH.length; i++) { let k = String(dataKH[i][1]).trim(); if (k) mapKH[k] = { colC: dataKH[i][2], colD: dataKH[i][3], colE: dataKH[i][4] }; }
    const dataHDNCC = ssRef.getSheetByName('HD_NCC').getDataRange().getValues();
    let mapHDNCC = {}; for (let i = 1; i < dataHDNCC.length; i++) { let k = String(dataHDNCC[i][2]).trim(); if (k) mapHDNCC[k] = { colG: dataHDNCC[i][6], colE: dataHDNCC[i][4] }; }
    const dataDNTT = ssDNTT.getSheetByName(CONFIG.DNTT_SHEET).getDataRange().getValues();
    let mapDNTT = {}; for (let i = 1; i < dataDNTT.length; i++) { let k = String(dataDNTT[i][11] || "").trim(); if (k) mapDNTT[k] = { colT: dataDNTT[i][19], colV: dataDNTT[i][21] }; }
    // TỐI ƯU LƯU TRỮ: TRƯỚC ĐÂY đọc NGUYÊN sheet PhieuCan_DN (getDataRange())
    // dù chỉ cần đúng khoảng [start, end] - nay dùng LT_docPhieuCanGopLuuTru_
    // để chỉ mở thêm sheet lưu trữ năm nào thật sự nằm trong khoảng lọc, đồng
    // thời không còn phải bỏ qua dòng tiêu đề (hàm này không trả kèm tiêu đề).
    const sourceData = LT_docPhieuCanGopLuuTru_(fromDate, toDate, LT_SO_COT_DAY_DU); let targetData = [];
    const _misaDf = MISA_DEFAULTS_(); // đọc 1 lần trước vòng lặp, tránh gọi PropertiesService lặp lại mỗi dòng
    for (let i = 0; i < sourceData.length; i++) {
      // FIX H-06: dòng KHÔNG có Ngày cân 1 hợp lệ trước đây lọt vào MỌI kỳ Misa (điều kiện chỉ
      // loại khi có ngày) -> hạch toán lặp. Nay bắt buộc có ngày và nằm trong khoảng.
      let row = sourceData[i]; let ngayPhieu = parseDate_(row[1]); if (!ngayPhieu || isNaN(ngayPhieu.getTime()) || ngayPhieu < start || ngayPhieu > end) continue;
      let newRow = new Array(33).fill(""); let soHopDongGoc = String(row[22] || "").trim(); let khoiLuong = (parseFloat(row[9]) || 0) / 1000; let donGia = parseFloat(row[23]) || 0; let thanhTienTuCotZ = parseFloat(row[25]) || 0;
      newRow[0] = row[1]; newRow[1] = row[1]; newRow[2] = soHopDongGoc; newRow[3] = row[5]; newRow[4] = khoiLuong; newRow[5] = donGia; newRow[6] = thanhTienTuCotZ;
      let soHopDongMoi = ""; if (soHopDongGoc && mapDNTT[soHopDongGoc]) { soHopDongMoi = String(mapDNTT[soHopDongGoc].colT).trim(); newRow[9] = '="' + soHopDongMoi + '"'; newRow[8] = mapDNTT[soHopDongGoc].colV || _misaDf.ngayDenHanMacDinh; } else { newRow[8] = _misaDf.ngayDenHanMacDinh; }
      // FIX #18: các giá trị này TRƯỚC ĐÂY hard-code cứng (tài khoản kế toán,
      // đơn vị tính, tên hàng hóa mặc định...) - nay đọc từ MISA_DEFAULTS()
      // (Config.gs), chỉnh được trực tiếp ở Hệ thống → Cấu hình hệ thống,
      // không cần sửa code/deploy lại khi công ty đổi tài khoản/quy ước.
      newRow[16] = _misaDf.loaiChungTu; newRow[21] = _misaDf.donViTienTe; newRow[23] = _misaDf.maHang;
      newRow[24] = _misaDf.tenHangHoaMacDinh; newRow[26] = _misaDf.taiKhoanChiPhi; newRow[27] = _misaDf.tkCongNoTien;
      newRow[28] = _misaDf.donViTinh; newRow[29] = _misaDf.kmcp; newRow[30] = _misaDf.doiTuongTHCP;
      newRow[31] = row[13]; newRow[32] = row[14]; newRow[12] = mapNG[String(row[14]).trim()] || ""; newRow[7] = mapKH[String(row[13]).trim()] ? mapKH[String(row[13]).trim()].colE : "";
      // FIX: bỏ gán lồng String(maNCC = String(...)) thừa, giữ đúng logic gán 1 lần
      let maNCC = ""; let tenNCC = ""; if (soHopDongMoi && mapHDNCC[soHopDongMoi]) { maNCC = String(mapHDNCC[soHopDongMoi].colG).trim(); tenNCC = mapHDNCC[soHopDongMoi].colE; }
      if (!maNCC) { let keyKH = String(row[13]).trim(); if (mapKH[keyKH]) { maNCC = String(mapKH[keyKH].colC).trim(); tenNCC = mapKH[keyKH].colD; } }
      newRow[10] = maNCC ? '="' + maNCC + '"' : ""; newRow[11] = tenNCC; targetData.push(newRow);
    }
    if (ssTarget.getLastRow() > 1) ssTarget.getRange(2, 1, ssTarget.getLastRow(), 33).clearContent();
    if (targetData.length > 0) { const _rf5 = REGION_FORMAT_(); ssTarget.getRange(2, 10, targetData.length, 2).setNumberFormat("@"); ssTarget.getRange(2, 1, targetData.length, 33).setValues(targetData); ssTarget.getRange(2, 1, targetData.length, 2).setNumberFormat(_rf5.DATE_FMT); ssTarget.getRange(2, 9, targetData.length, 1).setNumberFormat(_rf5.DATE_FMT); }
    // FIX H-06: Update_MiSa_PC là 1 bản dùng chung cho mọi người - ghi lại bản hiện có
    // là khoảng ngày nào, ai tạo, lúc nào để hiển thị và kiểm tra trước khi tải file MISA.
    const thongTin = MISA_luuThongTinBan_(start, end, targetData.length);
    return { status: "success", thongTin: thongTin };
  } catch (e) {
    return { status: "error", message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// FIX #2: bản CÓ KHÓA — dùng khi gọi ĐỘC LẬP (menu thủ công, trigger theo giờ...).
// FIX (TRIGGER-01): trigger theo giờ gọi hàm này KHÔNG có phiên đăng nhập -> trước
// đây yeuCauPhien_() làm trigger lỗi mọi lần chạy. Nay nhận diện đúng lượt chạy
// của trigger THẬT của dự án (triggerUid khớp ScriptApp.getProjectTriggers(),
// giống TRIGGER_saoLuuHangDem) - gọi từ trình duyệt vẫn bắt buộc đăng nhập.
function runCalculatePrice(e) {
  if (laLuotChayTriggerThat_(e)) PHIEN_HIEN_TAI_ = PHIEN_HE_THONG_TRIGGER_();
  yeuCauPhien_();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", message: "Hệ thống đang bận xử lý một yêu cầu khác, vui lòng thử lại sau ít giây." };
  }
  try {
    const _dnttKhoaSo = KS_thongBaoDNTTDangKhoaSo_();
    if (_dnttKhoaSo) return { status: "error", message: _dnttKhoaSo };
    return runCalculatePrice_core_();
  } finally {
    lock.releaseLock();
  }
}

// FIX (lệch ranh giới hiệu lực): quy ước DUY NHẤT về "1 mốc thời gian ts có
// nằm trong khoảng hiệu lực [tuTS, denTS) hay không" - ĐẦU khoảng bao gồm
// (>=), CUỐI khoảng KHÔNG bao gồm (<, giống nửa-khoảng toán học), khớp đúng
// cách BG_coreLogicProcessor_ tạo các khoảng hiệu lực NỐI TIẾP nhau (điểm kết
// thúc báo giá cũ = điểm bắt đầu báo giá mới, trừ đi 1 giây). TRƯỚC ĐÂY
// runCalculatePrice_core dùng "< end" (cuối khoảng KHÔNG bao gồm) trong khi
// BG_checkRowEditable_/BG_annotateApplied_ lại dùng "<= end" (cuối khoảng CÓ
// bao gồm) - 2 quy ước khác nhau cho CÙNG 1 khái niệm khiến 1 phiếu cân đúng
// ngay mốc ranh giới (tới từng mili-giây) có thể được TÍNH GIÁ theo báo giá A
// nhưng lại bị hệ thống báo "ĐÃ ÁP DỤNG" nhầm sang báo giá B liền kề. Nay gom
// về 1 hàm DUY NHẤT, mọi nơi so khớp khoảng hiệu lực đều gọi hàm này để không
// thể lệch nhau lần nữa.
function _tsTrongKhoangHieuLuc_(ts, tuTS, denTS) {
  return ts >= tuTS && ts < denTS;
}

// FIX #2: bản LÕI, KHÔNG khóa — dùng khi được gọi từ bên trong một hàm khác
// (như step1_ConfirmImport) mà đã tự khóa từ trước. Gọi runCalculatePrice()
// (bản có khóa) từ trong 1 hàm đang giữ khóa sẽ gây deadlock (tự chờ chính mình).
// TỐI ƯU LƯU TRỮ (QUAN TRỌNG - ảnh hưởng trực tiếp tới tốc độ theo thời gian):
// TRƯỚC ĐÂY hàm này, dù chỉ TÍNH LẠI giá cho các dòng CHƯA "OK", vẫn GHI ĐÈ LẠI
// một dải DUY NHẤT phủ từ dòng 2 đến hết toàn bộ lịch sử (getRange(2, 20,
// resT.length, 1)...) mỗi lần gọi - kể cả với các dòng đã "OK" (giá trị ghi lại
// giống hệt cũ, không đổi gì). Hàm này chạy SAU MỖI LẦN IMPORT/NHẬP TAY 1 phiếu
// cân - nghĩa là càng nhiều năm dữ liệu tích lũy (càng nhiều dòng đã "OK"), mỗi
// lần nhập 1 phiếu MỚI lại càng phải đọc + ghi lại toàn bộ khối lịch sử ngày
// càng lớn đó - đây chính là nguyên nhân trực tiếp khiến thao tác hàng ngày
// (nhập phiếu cân) chậm dần theo thời gian, không phải do PhieuCan_DN "nặng"
// một cách mơ hồ chung chung.
// Nay CHỈ ghi lại đúng những dòng THỰC SỰ cần tính (chưa "OK") - dòng nào đã
// chốt "OK" thì bỏ qua hoàn toàn, không đọc lại giá trị cũ để ghi lại vô ích.
// Các dòng cần ghi được gom thành từng khối LIÊN TIẾP (thường chỉ 1-2 khối vì
// các phiếu chưa chốt luôn nằm ở cuối sheet, mới nhập gần đây) để tối thiểu số
// lượt gọi Sheets API. Phần ĐỌC (sheet.getDataRange()) vẫn phải quét toàn bộ
// để biết dòng nào đã "OK" - đây là giới hạn cố hữu khi dùng Google Sheets làm
// nơi lưu dữ liệu kiêm nơi tính toán; muốn giảm tiếp cả bước ĐỌC này cần một
// giải pháp lưu trữ khác (VD tách riêng sheet "đang chờ tính giá" khỏi sheet
// lịch sử đã chốt - xem đề xuất kiến trúc lưu trữ đã trao đổi).
// Bảng báo giá (Baogia_DN_SAVE) dạng dùng cho tính giá - mở theo BG_ss_() (xem
// ghi chú đồng bộ Liên kết dữ liệu trong runCalculatePrice_core_).
function TG_docBaoGia_() {
  const ssBG = BG_ss_(); const sheetBG = ssBG.getSheetByName(CONFIG.SHEET_BAO_GIA); const rawDataBG = sheetBG.getDataRange().getValues();
  return rawDataBG.slice(1).map(bg => { return { start: new Date(bg[1]).getTime(), end: new Date(bg[2]).getTime(), keyQ: String(bg[3] || "").trim().toUpperCase(), minKl: parseFloat(bg[4]) || 0, maxKl: parseFloat(bg[5]) || 0, price: parseFloat(bg[6]) || 0 }; });
}

// PERF-TG-01: nhóm báo giá theo Mã ĐG 1 lần (giữ nguyên thứ tự dòng trong mỗi
// nhóm) - trước đây MỖI phiếu lọc lại toàn bộ bảng báo giá (phiếu × dòng báo giá).
function TG_baoGiaTheoMa_(dataBG) {
  if (!dataBG.__theoMa) {
    const m = new Map();
    dataBG.forEach(function (bg) { let l = m.get(bg.keyQ); if (!l) { l = []; m.set(bg.keyQ, l); } l.push(bg); });
    Object.defineProperty(dataBG, "__theoMa", { value: m, enumerable: false });
  }
  return dataBG.__theoMa;
}

// Giá của 1 phiếu (dòng A..Z) theo báo giá: DUY NHẤT 1 công thức, dùng chung cho
// engine tính giá và cho "Sửa phiếu" ở Tra cứu (tính giá TRƯỚC khi quyết định lưu).
function TG_tinhGiaDong_(r, dataBG) {
  const valQ = String(r[16] || "").trim().toUpperCase(); const rVal = parseFloat(r[17]) || 0; const klJ = parseFloat(r[9]) || 0; const klSoSanh = klJ / 1000;
  const dt = new Date(r[1]); if (r[2]) { let t = r[2]; let h = (t instanceof Date) ? t.getHours() : parseInt(String(t).split(":")[0]) || 0; let m = (t instanceof Date) ? t.getMinutes() : parseInt(String(t).split(":")[1]) || 0; dt.setHours(h, m, 0, 0); }
  const ts = dt.getTime(); let giaFound = 0;
  // FIX H-01 ("báo giá mới nhất thắng"): cùng 1 Mã ĐG có thể có nhiều dải KL còn hiệu
  // lực chồng lên nhau (báo giá mới đổi dải KL không kết thúc dải cũ). Trước đây lấy
  // dòng khớp ĐẦU TIÊN theo thứ tự sheet -> thường là báo giá CŨ. Nay chọn dòng khớp
  // có thời điểm hiệu lực MUỘN NHẤT; hòa nhau thì giữ dòng đứng trước như cũ.
  if (valQ !== "" && klSoSanh > 0) {
    const listCungMa = TG_baoGiaTheoMa_(dataBG).get(valQ) || [];
    let bgChon = null;
    for (const bg of listCungMa) {
      if (_tsTrongKhoangHieuLuc_(ts, bg.start, bg.end) && klSoSanh > bg.minKl && klSoSanh <= bg.maxKl && (!bgChon || bg.start > bgChon.start)) bgChon = bg;
    }
    if (bgChon) giaFound = bgChon.price;
  }
  const hieuSo = Math.round(giaFound + rVal);
  const thanhTienRaw = Math.round(klSoSanh * hieuSo);
  const thanhTienLamTron = Math.floor(thanhTienRaw / 1000) * 1000;
  const trangThai = (giaFound > 0 && thanhTienLamTron > 0) ? "Test giá" : "Lỗi ĐK/Báo giá";
  return { gia: giaFound, hieuSo: hieuSo, trangThai: trangThai, thanhTien: thanhTienLamTron };
}

// chonDong (tùy chọn): hàm (dòng A..Z) -> true/false để CHỈ tính lại một phần các
// phiếu chưa "OK" (Tra cứu: 1 phiếu vừa sửa, hoặc các phiếu khớp bộ lọc). Không
// truyền = tính mọi phiếu chưa "OK" như trước. Phiếu "OK" luôn được bỏ qua.
// traKetQua: trả kèm danh sách kết quả tính (ketQua) cả khi không truyền chonDong
// - để luồng import ghép giá vào bản sao Draft Chưa TT (xem DRAFT-02).
function runCalculatePrice_core_(chonDong, traKetQua) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); const sheet = ss.getSheetByName(CONFIG.DATA_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { status: "success", message: "Không có phiếu nào cần tính giá." };
    const data = sheet.getRange(2, 1, lastRow - 1, 26).getValues();
    // FIX (đồng bộ Liên kết dữ liệu): TRƯỚC ĐÂY dùng thẳng CONFIG.URL_BAO_GIA
    // (URL cố định, KHÔNG nằm trong LIENKET_DANH_SACH nên không đổi được qua
    // Hệ thống → Cấu hình → Liên kết dữ liệu). Nếu admin từng dùng tính năng đó
    // để đổi "Spreadsheet Báo giá" (BAOGIA_SPREADSHEET_ID) sang 1 sheet khác
    // (VD sang năm tài chính mới), mọi nơi khác trong hệ thống (quản lý báo
    // giá...) đã chuyển đúng, nhưng RIÊNG engine tính giá này vẫn âm thầm đọc
    // sheet CŨ - sai giá cho mọi phiếu cân mới mà không ai biết. Nay dùng
    // BG_ss_() (mở theo BAOGIA_CONFIG.SPREADSHEET_ID, ĐÃ nằm trong danh sách
    // Liên kết dữ liệu) để luôn đồng bộ với đúng 1 nguồn cấu hình duy nhất.
    const dataBG = TG_docBaoGia_();

    // Chỉ gom danh sách các DÒNG THỰC SỰ CẦN GHI LẠI (chưa "OK") - dòng đã "OK"
    // bỏ qua hoàn toàn, không đưa vào đây (khác bản cũ luôn đẩy cả dòng "OK" vào
    // mảng kết quả chỉ để giữ đúng vị trí khi ghi đè nguyên dải).
    const capNhat = [];
    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      const currentStatusY = String(r[24] || "").trim();
      if (currentStatusY === "OK") continue;
      if (chonDong && !chonDong(r)) continue;

      const g = TG_tinhGiaDong_(r, dataBG);
      capNhat.push({ rowNum: i + 2, maCT: String(r[21] || "").trim(), gia: g.gia, hieuSo: g.hieuSo, trangThai: g.trangThai, thanhTien: g.thanhTien });
    }

    // Gom các dòng cần ghi thành từng KHỐI LIÊN TIẾP (rowNum liền nhau) - ghi 1
    // lượt setValues() cho cả khối thay vì từng dòng riêng lẻ.
    // PERF-04: X,Y,Z liền nhau -> ghi chung 1 lệnh; định dạng "#,##0" của cột X/Z
    // gom vào 1 RangeList duy nhất sau vòng lặp. Cùng ô, cùng giá trị, cùng định
    // dạng như trước - chỉ giảm từ 6 xuống 2 lệnh ghi cho mỗi khối dòng.
    // CONCUR-01: dòng đích vẫn đúng phiếu đã đọc lúc đầu (xem PC_kiemTraDongConDung_).
    const chuKyMongDoi = new Map();
    capNhat.forEach(function (c) { chuKyMongDoi.set(c.rowNum, PC_chuKyDong_(data[c.rowNum - 2])); });
    PC_kiemTraDongConDung_(sheet, chuKyMongDoi);
    // BUG-TG-01: cột Y đọc từ ĐẦU lượt; trong lúc đọc báo giá + tính toán, ĐNTT (dự
    // án khác, khóa riêng) có thể vừa đóng thanh toán phiếu (ghi "OK"). Ghi tiếp sẽ
    // đè "OK" thành "Test giá" -> phiếu đã thanh toán bị mở lại. Đọc lại cột Y ngay
    // trước khi ghi và bỏ qua phiếu vừa thành "OK".
    const yHienTai = docCacDong_(sheet, capNhat.map(function (c) { return c.rowNum; }), 25, 1);
    const truocLoc = capNhat.length;
    for (let k = capNhat.length - 1; k >= 0; k--) {
      const y = yHienTai.get(capNhat[k].rowNum);
      if (y && String(y[0] || "").trim() === "OK") capNhat.splice(k, 1);
    }
    const soVuaOK = truocLoc - capNhat.length;
    const vungGhi = [];
    const vungDinhDang = [];
    let idx = 0;
    while (idx < capNhat.length) {
      let end = idx;
      while (end + 1 < capNhat.length && capNhat[end + 1].rowNum === capNhat[end].rowNum + 1) end++;
      const startRow = capNhat[idx].rowNum;
      const soDong = end - idx + 1;
      const cotT = []; const cotXYZ = [];
      for (let k = idx; k <= end; k++) {
        cotT.push([capNhat[k].gia]); cotXYZ.push([capNhat[k].hieuSo, capNhat[k].trangThai, capNhat[k].thanhTien]);
      }
      vungGhi.push({ hang: startRow, cot: 20, giaTri: cotT }, { hang: startRow, cot: 24, giaTri: cotXYZ });
      const endRow = startRow + soDong - 1;
      vungDinhDang.push("X" + startRow + ":X" + endRow, "Z" + startRow + ":Z" + endRow);
      idx = end + 1;
    }
    ghiNhieuVung_(ss, sheet, vungGhi);
    if (vungDinhDang.length > 0) sheet.getRangeList(vungDinhDang).setNumberFormat("#,##0");

    return {
      status: "success",
      message: capNhat.length > 0
        ? "Đã tính giá cho " + capNhat.length + " phiếu chưa chốt."
          + (soVuaOK ? " Bỏ qua " + soVuaOK + " phiếu vừa được đóng thanh toán (OK) trong lúc tính." : "")
        : "Không có phiếu nào cần tính lại giá (tất cả đã chốt OK).",
      soPhieu: capNhat.length,
      soLoiBaoGia: capNhat.filter(function (c) { return c.trangThai !== "Test giá"; }).length,
      ketQua: (chonDong || traKetQua) ? capNhat : undefined
    };
  } catch (e) { return { status: "error", message: "Lỗi: " + e.toString() }; }
}

/*********************************************************
 * PHẦN 4: BÁO CÁO TỔNG HỢP CÂN & BÁO CÁO MISA (MENU 2)
 * - Bộ lọc dùng chung: fromDate, toDate, xe, khachHang, trangThai ('', 'da', 'chua')
 * - trangThai đối chiếu cột AA (ID_DNTT) trong PhieuCan_DN: rỗng = "Chưa lập ĐNTT"
 *********************************************************/

// Trả về danh sách xe / khách hàng / NCC để đổ vào dropdown filter phía client
// FIX (an toàn Lưu trữ theo năm - PHẦN 1C): TRƯỚC ĐÂY chỉ đọc sheet đang hoạt
// động - 1 xe/khách hàng/đại lý CHỈ xuất hiện trong dữ liệu ĐÃ lưu trữ sẽ
// không hiện trong dropdown lọc, khiến người dùng tưởng không lọc được dù báo
// cáo (đã tự gộp lưu trữ) thực ra vẫn tìm thấy nếu gõ đúng. Hàm này chỉ chạy 1
// lần mỗi lần tải trang (không phải hot path) nên chấp nhận quét thêm tất cả
// năm đã lưu trữ để danh sách luôn đầy đủ.
// PERF-01: đọc đúng cột F..Q (12 cột, thay vì A..Q) - chỉ số trong mỗi dòng:
// 0=F Số xe, 6=L Khách hàng, 8=N Đại lý, 9=O Nguồn gốc, 11=Q Mã ĐG.
function FO_gomGiaTriLoc_(rows) {
  const kq = { xe: new Set(), kh: new Set(), dl: new Set(), ng: new Set(), madg: new Set() };
  rows.forEach(function (row) {
    const xe = String(row[0] || "").trim(); if (xe) kq.xe.add(xe);
    const kh = String(row[6] || "").trim(); if (kh) kq.kh.add(kh);
    const dl = String(row[8] || "").trim(); if (dl) kq.dl.add(dl);
    const ng = String(row[9] || "").trim(); if (ng) kq.ng.add(ng);
    const madg = String(row[11] || "").trim(); if (madg) kq.madg.add(madg);
  });
  return { xe: Array.from(kq.xe), kh: Array.from(kq.kh), dl: Array.from(kq.dl), ng: Array.from(kq.ng), madg: Array.from(kq.madg) };
}

// PERF-01: sheet lưu trữ năm đã chốt sổ gần như không đổi, nên cache danh sách
// giá trị lọc của từng năm. Khóa cache gồm cả số dòng (getLastRow) - chốt sổ
// thêm phiếu vào năm đó làm đổi số dòng -> tự đọc lại. Riêng trường hợp sửa tay
// trực tiếp 1 ô trong sheet lưu trữ (không đổi số dòng) sẽ cập nhật chậm tối đa
// 6 giờ (thời hạn cache). Lỗi CacheService -> tự đọc thẳng Sheet như cũ.
function FO_giaTriLocNamLuuTru_(sheetNam, nam) {
  const lastRow = sheetNam.getLastRow();
  if (lastRow <= 1) return null;
  const key = "FO_LUUTRU_" + nam + "_" + lastRow;
  let cache = null;
  try {
    cache = CacheService.getScriptCache();
    const daLuu = cache.get(key);
    if (daLuu) return JSON.parse(daLuu);
  } catch (e) { cache = null; }
  const kq = FO_gomGiaTriLoc_(sheetNam.getRange(2, 6, lastRow - 1, 12).getValues());
  if (cache) {
    try {
      const json = JSON.stringify(kq);
      if (json.length < 90000) cache.put(key, json, 21600);
    } catch (e) { /* vượt giới hạn cache - lần sau đọc lại Sheet */ }
  }
  return kq;
}

function getFilterOptions_() {
  try {
    let xeSet = new Set(); let khSet = new Set(); let daiLySet = new Set(); let nguonGocSet = new Set(); let maDonGiaSet = new Set();
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheetChinh = ss.getSheetByName(CONFIG.DATA_SHEET);
    const lastRowChinh = sheetChinh.getLastRow();
    const cacNguon = [];
    if (lastRowChinh > 1) cacNguon.push(FO_gomGiaTriLoc_(sheetChinh.getRange(2, 6, lastRowChinh - 1, 12).getValues()));
    // Gộp cả lưu trữ - xem ghi chú FIX PHẦN 1C ở trên
    LT_layDanhSachNamDaLuuTru_(ss).forEach(function (nam) {
      const sheetNam = ss.getSheetByName(LT_tenSheetLuuTru_(nam));
      const kq = sheetNam ? FO_giaTriLocNamLuuTru_(sheetNam, nam) : null;
      if (kq) cacNguon.push(kq);
    });
    cacNguon.forEach(function (g) {
      g.xe.forEach(function (v) { xeSet.add(v); });
      g.kh.forEach(function (v) { khSet.add(v); });
      g.dl.forEach(function (v) { daiLySet.add(v); });
      g.ng.forEach(function (v) { nguonGocSet.add(v); });
      g.madg.forEach(function (v) { maDonGiaSet.add(v); });
    });
    let ncSet = new Set();
    try {
      const ssMisa = SpreadsheetApp.openById(CONFIG.MISA_DST_ID);
      const sheetMisa = ssMisa.getSheetByName(CONFIG.MISA_DST_SHEET);
      const lastRowMisa = sheetMisa.getLastRow();
      if (lastRowMisa > 1) {
        const dataMisa = sheetMisa.getRange(2, 12, lastRowMisa - 1, 1).getValues(); // Cột L (Tên NCC)
        dataMisa.forEach(row => { const nc = String(row[0] || "").trim(); if (nc) ncSet.add(nc); });
      }
    } catch (e) { /* bỏ qua nếu sheet Misa chưa có dữ liệu / chưa tồn tại */ }

    // Mã khối lượng lấy từ danh mục Ma_KL bên hệ thống Báo giá (không lưu trực tiếp
    // trên từng dòng PhieuCan_DN, mà được suy ra bằng cách so khớp KL hàng thực tế
    // với dải Min-Max của từng mã tại thời điểm xem báo cáo).
    let maKLList = [];
    try {
      const sheetKL = BG_ss_().getSheetByName(BAOGIA_CONFIG.MAKL_SHEET);
      const lastRowKL = sheetKL.getLastRow();
      if (lastRowKL > 1) {
        const dataKL = sheetKL.getRange(2, 2, lastRowKL - 1, 1).getValues(); // Cột B - Mã khối lượng
        maKLList = dataKL.map(r => String(r[0] || "").trim()).filter(Boolean).sort();
      }
    } catch (e) { /* bỏ qua nếu chưa có dữ liệu Ma_KL */ }

    return {
      status: "success",
      xeList: Array.from(xeSet).sort(),
      khachHangList: Array.from(khSet).sort(),
      ncList: Array.from(ncSet).sort(),
      daiLyList: Array.from(daiLySet).sort(),
      nguonGocList: Array.from(nguonGocSet).sort(),
      maDonGiaList: Array.from(maDonGiaSet).sort(),
      maKLList: maKLList
    };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Map: Mã Chứng Từ (cột V) -> đã lập ĐNTT hay chưa (dựa vào cột AA - ID_DNTT có rỗng hay không)
// FIX (an toàn Lưu trữ theo năm - PHẦN 1C): TRƯỚC ĐÂY chỉ đọc sheet đang hoạt
// động - báo cáo Misa xem lại 1 năm ĐÃ chốt sổ sẽ hiển thị SAI "Chưa lập ĐNTT"
// cho những phiếu thật ra đã có ĐNTT từ trước khi lưu trữ. Nay nhận thêm
// fromDate/toDate (CÙNG bộ lọc getBaoCaoMisa đang dùng) để tự gộp thêm đúng
// (các) sheet lưu trữ năm liên quan, giống hệt các hàm báo cáo khác.
function buildDNTTStatusMap_(fromDate, toDate) {
  const map = {};
  // Cột V(22)..AA(27): đọc từ cột A cho đủ offset chuẩn với LT_docPhieuCanGopLuuTru_,
  // idx21=V(Mã CT) ... idx26=AA(ID_DNTT).
  const data = LT_docPhieuCanGopLuuTru_(fromDate, toDate, 27);
  data.forEach(row => {
    const key = String(row[21] || "").trim();
    const idDntt = String(row[26] || "").trim();
    if (key) map[key] = !!idDntt; // true = Đã lập ĐNTT, false = Chưa lập ĐNTT
  });
  return map;
}

// filters = {fromDate, toDate, xe, khachHang, trangThai}
function getBaoCaoTongHop_(filters) {
  try {
    filters = filters || {};
    // TỐI ƯU LƯU TRỮ: TRƯỚC ĐÂY luôn đọc NGUYÊN sheet PhieuCan_DN (chỉ chứa dữ
    // liệu "đang hoạt động" từ khi có tính năng Lưu trữ theo năm - PHẦN 1C).
    // Nay dùng LT_docPhieuCanGopLuuTru_ để TỰ ĐỘNG gộp thêm đúng (các) sheet lưu
    // trữ năm mà bộ lọc ngày yêu cầu - báo cáo "tháng này/quý này" (đa số nhu
    // cầu hàng ngày) không đụng sheet lưu trữ nào nên vẫn nhanh như cũ; chỉ báo
    // cáo cố tình xem lại năm đã chốt sổ mới cần mở thêm sheet đó.
    const data = LT_docPhieuCanGopLuuTru_(filters.fromDate, filters.toDate, 27); // A..AA
    if (data.length === 0) return { status: "success", data: [], summary: { soLuong: 0, tongKL: 0, tongTien: 0 } };

    const start = filters.fromDate ? new Date(filters.fromDate + "T00:00:00+07:00") : null;
    const end = filters.toDate ? new Date(filters.toDate + "T23:59:59+07:00") : null;
    const xeFilter = String(filters.xe || "").trim();
    const khFilter = String(filters.khachHang || "").trim();
    const daiLyFilter = String(filters.daiLy || "").trim();
    const nguonGocFilter = String(filters.nguonGoc || "").trim();
    const trangThaiFilter = String(filters.trangThai || "").trim(); // '', 'da', 'chua'

    let result = []; let tongKL = 0; let tongTien = 0;

    data.forEach(row => {
      const ngayCan1 = row[1]; // Cột B - đã là Date object thật nhờ FIX #1
      if (!(ngayCan1 instanceof Date) || isNaN(ngayCan1.getTime())) return;
      if (start && ngayCan1 < start) return;
      if (end && ngayCan1 > end) return;

      const xe = String(row[5] || "").trim();
      if (xeFilter && xe !== xeFilter) return;

      const khachHang = String(row[11] || "").trim(); // Cột L
      if (khFilter && khachHang !== khFilter) return;

      const daiLy = String(row[13] || "").trim(); // Cột N - ĐL (Đại lý)
      if (daiLyFilter && daiLy !== daiLyFilter) return;

      const nguonGoc = String(row[14] || "").trim(); // Cột O - NG (Nguồn gốc)
      if (nguonGocFilter && nguonGoc !== nguonGocFilter) return;

      const idDntt = String(row[26] || "").trim(); // Cột AA
      const daLap = !!idDntt;
      if (trangThaiFilter === "da" && !daLap) return;
      if (trangThaiFilter === "chua" && daLap) return;

      const klHang = parseFloat(row[9]) || 0;
      const donGia = parseFloat(row[23]) || 0; // Cột X
      const thanhTien = parseFloat(row[25]) || 0; // Cột Z
      const trangThaiGia = String(row[24] || "").trim(); // Cột Y

      tongKL += klHang; tongTien += thanhTien;

      result.push({
        maChungTu: String(row[21] || "").trim(),
        soPhieu: row[0],
        ngayCan1: dinhDangGMT7_(ngayCan1, "dd/MM/yyyy"),
        gioCan1: (row[2] instanceof Date) ? gioCuaO_(row[2]) : "",
        ngayCan2: (row[3] instanceof Date) ? dinhDangGMT7_(row[3], "dd/MM/yyyy") : "",
        gioCan2: (row[4] instanceof Date) ? gioCuaO_(row[4]) : "",
        soXe: xe,
        soXe2: String(row[6] || "").trim(), // Cột G - Biển số 2 (xe kéo/rơ-moóc, nếu có)
        khachHang: khachHang,
        daiLy: daiLy,
        nguonGoc: nguonGoc,
        klCan1: parseFloat(row[7]) || 0,
        klCan2: parseFloat(row[8]) || 0,
        klHang: klHang,
        donGia: donGia,
        thanhTien: thanhTien,
        trangThaiGia: trangThaiGia,
        idDntt: idDntt, // Giá trị thô của cột AA (ID_DNTT), vd: "Đóng TT", hoặc rỗng
        // Hiển thị đúng nội dung thật trong cột AA khi có (vd "Đóng TT") thay vì
        // chỉ ghi chung chung "Đã lập ĐNTT", giúp thấy rõ tình trạng thanh toán thực tế.
        trangThaiThanhToan: daLap ? idDntt : "Chưa lập ĐNTT"
      });
    });

    result.sort((a, b) => (a.maChungTu > b.maChungTu ? 1 : -1));
    return { status: "success", data: result, summary: { soLuong: result.length, tongKL: tongKL, tongTien: tongTien } };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

/* ---------- DASHBOARD: Tổng quan Phiếu cân nhập + Báo giá/Doanh số mua ---------- */
// Tổng hợp nhanh cho trang Dashboard - TÁI DÙNG getBaoCaoTongHop() (đã có sẵn,
// đã tự động gộp sheet lưu trữ theo năm nếu bộ lọc ngày chạm tới) thay vì viết
// lại logic đọc/lọc phiếu cân từ đầu - dữ liệu "Hôm nay"/"Tháng này" luôn khớp
// 100% với báo cáo tổng hợp thật (không có 2 nguồn tính khác nhau). KHÔNG giới
// hạn Admin - đây chỉ là xem số liệu tổng hợp, giống các báo cáo khác.
// PERF-02: tổng "Hôm nay" lọc từ dữ liệu tháng đã đọc (ngày dạng yyyy-MM-dd, giờ GMT+7).
function DB_tongHopMotNgay_(dataThang, ngayStr) {
  const ngayHienThi = dinhDangGMT7_(new Date(ngayStr + "T12:00:00+07:00"), "dd/MM/yyyy");
  const tong = { soLuong: 0, tongKL: 0, tongTien: 0 };
  dataThang.forEach(function (r) {
    if (r.ngayCan1 !== ngayHienThi) return;
    tong.soLuong += 1; tong.tongKL += r.klHang; tong.tongTien += r.thanhTien;
  });
  return tong;
}

function HT_layDashboard_() {
  try {
    const homNayStr = dinhDangGMT7_(new Date(), "yyyy-MM-dd");
    const d = new Date();
    const dauThangStr = dinhDangGMT7_(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd");

    // PERF-02: chỉ đọc Sheet 1 lần (tháng này) rồi lọc ra "Hôm nay" trong bộ nhớ,
    // thay vì gọi getBaoCaoTongHop 2 lần (đọc trọn sheet đang hoạt động 2 lần).
    const bcThangNay = getBaoCaoTongHop_({ fromDate: dauThangStr, toDate: homNayStr });
    if (bcThangNay.status !== "success") throw new Error(bcThangNay.message);

    const dataThang = bcThangNay.data;
    const bcHomNay = { summary: DB_tongHopMotNgay_(dataThang, homNayStr) };

    // Top 5 khách hàng theo doanh số mua (thành tiền) tháng này - gộp trong bộ
    // nhớ tạm từ dữ liệu đã đọc ở trên, KHÔNG đọc lại Sheet lần nữa.
    const theoKhachHang = {};
    dataThang.forEach(function (r) {
      const key = r.khachHang || "(Không rõ)";
      if (!theoKhachHang[key]) theoKhachHang[key] = { khachHang: key, soPhieu: 0, tongKL: 0, tongTien: 0 };
      theoKhachHang[key].soPhieu += 1;
      theoKhachHang[key].tongKL += r.klHang;
      theoKhachHang[key].tongTien += r.thanhTien;
    });
    const topKhachHang = Object.keys(theoKhachHang).map(function (k) { return theoKhachHang[k]; })
      .sort(function (a, b) { return b.tongTien - a.tongTien; }).slice(0, 5);

    // Doanh số mua/khối lượng theo từng ngày trong tháng (cho biểu đồ cột) - sort
    // đúng thứ tự thời gian (chuyển dd/MM/yyyy -> yyyyMMdd để so sánh chuỗi).
    const theoNgay = {};
    dataThang.forEach(function (r) {
      if (!theoNgay[r.ngayCan1]) theoNgay[r.ngayCan1] = { ngay: r.ngayCan1, soPhieu: 0, tongKL: 0, tongTien: 0 };
      theoNgay[r.ngayCan1].soPhieu += 1;
      theoNgay[r.ngayCan1].tongKL += r.klHang;
      theoNgay[r.ngayCan1].tongTien += r.thanhTien;
    });
    const bieuDoTheoNgay = Object.keys(theoNgay).map(function (k) { return theoNgay[k]; })
      .sort(function (a, b) {
        const toKey = function (s) { const p = s.split('/'); return p[2] + p[1] + p[0]; };
        return toKey(a.ngay) < toKey(b.ngay) ? -1 : 1;
      });

    // Phiếu CẦN CHÚ Ý trong tháng: chưa tính giá xong (trạng thái khác OK/Test giá)
    const canChuY = dataThang.filter(function (r) {
      const tt = String(r.trangThaiGia || "").trim();
      return tt !== "OK" && tt !== "Test giá" && tt !== "Test Giá";
    }).length;
    const chuaLapDntt = dataThang.filter(function (r) { return !r.idDntt; }).length;

    // Thống kê đơn giá đang hiệu lực - TÁCH try/catch riêng để 1 sự cố ở
    // Spreadsheet Báo giá (VD thiếu sheet Ma_BaoGia) không làm hỏng luôn cả
    // phần thống kê phiếu cân ở trên, vốn không phụ thuộc gì tới Báo giá.
    let thongKeGia;
    try {
      thongKeGia = BG_layThongKeGiaHieuLuc_();
    } catch (e) {
      thongKeGia = { soLuong: 0, giaCaoNhat: 0, giaThapNhat: 0, giaTrungBinh: 0, khuVucGiaCaoNhat: "", khuVucGiaThapNhat: "", loi: e.toString() };
    }

    return {
      status: "success",
      data: {
        homNay: bcHomNay.summary,
        thangNay: bcThangNay.summary,
        topKhachHang: topKhachHang,
        bieuDoTheoNgay: bieuDoTheoNgay,
        canChuY: canChuY,
        chuaLapDntt: chuaLapDntt,
        thongKeGia: thongKeGia,
        capNhatLuc: dinhDangGMT7_(new Date(), "dd/MM/yyyy HH:mm:ss")
      }
    };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

/* ---------- Bảng tổng hợp cân THEO BÁO GIÁ (xem đơn giá áp dụng thế nào) ---------- */

// Map: Mã Báo Giá (vd "DT_ĐL_Y") -> Nội dung diễn giải (từ danh mục Ma_BaoGia)
function getMaBaoGiaLookup_() {
  const map = {};
  try {
    const sheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.MA_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const data = sheet.getRange(2, 2, lastRow - 1, 5).getValues(); // B..F: maBaoGia, daiLy, nguonGoc, hinhAnh, noiDung
      data.forEach(row => {
        const ma = String(row[0] || "").trim();
        if (ma) map[ma] = String(row[4] || "").trim(); // Cột F - Nội dung
      });
    }
  } catch (e) { /* bỏ qua nếu chưa có dữ liệu Ma_BaoGia */ }
  return map;
}

// Danh sách dải khối lượng (Tấn) từ danh mục Ma_KL, dùng để suy ra "Mã KL" phù hợp
// với KL hàng thực tế của từng phiếu cân (PhieuCan_DN không lưu trực tiếp mã này).
function getMaKLBands_() {
  const bands = [];
  try {
    const sheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.MAKL_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
      data.forEach(row => {
        const maKL = String(row[1] || "").trim();
        if (!maKL) return;
        bands.push({ maKL: maKL, minTan: (parseFloat(row[2]) || 0) / 1000, maxTan: (parseFloat(row[3]) || 0) / 1000 });
      });
    }
  } catch (e) { /* bỏ qua nếu chưa có dữ liệu Ma_KL */ }
  return bands;
}

// Khớp đúng quy ước đang dùng trong runCalculatePrice_core: min < KL <= max
function findMaKLForTan_(bands, klTan) {
  for (let i = 0; i < bands.length; i++) {
    if (klTan > bands[i].minTan && klTan <= bands[i].maxTan) return bands[i].maKL;
  }
  return "";
}

// filters = {fromDate, toDate, xe, khachHang, daiLy, nguonGoc, trangThai, maDonGia, maKL}
function getBaoCaoDonGia_(filters) {
  try {
    filters = filters || {};
    // TỐI ƯU LƯU TRỮ: xem giải thích ở getBaoCaoTongHop (PHẦN 4) - gộp thêm
    // đúng (các) sheet lưu trữ năm mà bộ lọc ngày yêu cầu, thay vì luôn đọc
    // nguyên sheet PhieuCan_DN.
    const data = LT_docPhieuCanGopLuuTru_(filters.fromDate, filters.toDate, 27); // A..AA
    if (data.length === 0) return { status: "success", data: [], summary: { soLuong: 0, tongTien: 0 } };

    const start = filters.fromDate ? new Date(filters.fromDate + "T00:00:00+07:00") : null;
    const end = filters.toDate ? new Date(filters.toDate + "T23:59:59+07:00") : null;
    const xeFilter = String(filters.xe || "").trim();
    const khFilter = String(filters.khachHang || "").trim();
    const daiLyFilter = String(filters.daiLy || "").trim();
    const nguonGocFilter = String(filters.nguonGoc || "").trim();
    const trangThaiFilter = String(filters.trangThai || "").trim();
    const maDonGiaFilter = String(filters.maDonGia || "").trim();
    const maKLFilter = String(filters.maKL || "").trim();

    const noiDungMap = getMaBaoGiaLookup_();
    const klBands = getMaKLBands_();

    let result = []; let tongTien = 0;

    data.forEach(row => {
      const ngayCan1 = row[1];
      if (!(ngayCan1 instanceof Date) || isNaN(ngayCan1.getTime())) return;
      if (start && ngayCan1 < start) return;
      if (end && ngayCan1 > end) return;

      const xe = String(row[5] || "").trim();
      if (xeFilter && xe !== xeFilter) return;

      const khachHang = String(row[11] || "").trim();
      if (khFilter && khachHang !== khFilter) return;

      const daiLy = String(row[13] || "").trim();
      if (daiLyFilter && daiLy !== daiLyFilter) return;

      const nguonGoc = String(row[14] || "").trim();
      if (nguonGocFilter && nguonGoc !== nguonGocFilter) return;

      const idDntt = String(row[26] || "").trim();
      const daLap = !!idDntt;
      if (trangThaiFilter === "da" && !daLap) return;
      if (trangThaiFilter === "chua" && daLap) return;

      const maDonGia = String(row[16] || "").trim(); // Cột Q - Mã ĐG
      if (maDonGiaFilter && maDonGia !== maDonGiaFilter) return;

      const klHang = parseFloat(row[9]) || 0;
      const klTan = klHang / 1000;
      const maKLMatched = findMaKLForTan_(klBands, klTan);
      if (maKLFilter && maKLMatched !== maKLFilter) return;

      const giaGoc = parseFloat(row[19]) || 0;        // Cột T - ĐG_AD (giá gốc tìm được từ bảng báo giá)
      const dieuChinh = parseFloat(row[17]) || 0;      // Cột R - Giảm giá / điều chỉnh
      const donGiaApDung = parseFloat(row[23]) || 0;   // Cột X - Đơn giá_TC (giá cuối cùng áp dụng)
      const thanhTien = parseFloat(row[25]) || 0;      // Cột Z
      const trangThaiGia = String(row[24] || "").trim(); // Cột Y

      tongTien += thanhTien;

      result.push({
        maChungTu: String(row[21] || "").trim(),
        ngayCan1: dinhDangGMT7_(ngayCan1, "dd/MM/yyyy"),
        soXe: xe,
        khachHang: khachHang,
        daiLy: daiLy,
        nguonGoc: nguonGoc,
        maDonGia: maDonGia,
        maKL: maKLMatched,
        klHang: klHang,
        giaGoc: giaGoc,
        dieuChinh: dieuChinh,
        donGiaApDung: donGiaApDung,
        dienGiai: noiDungMap[maDonGia] || (maDonGia ? "(Không tìm thấy trong danh mục Mã Báo Giá)" : ""),
        trangThaiGia: trangThaiGia,
        thanhTien: thanhTien
      });
    });

    result.sort((a, b) => (a.maChungTu > b.maChungTu ? 1 : -1));
    return { status: "success", data: result, summary: { soLuong: result.length, tongTien: tongTien } };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function exportBaoCaoDonGiaExcel_(filters) {
  try {
    const rep = getBaoCaoDonGia_(filters);
    if (rep.status !== "success") return rep;
    if (rep.data.length === 0) return { status: "error", message: "Không có dữ liệu phù hợp bộ lọc để xuất." };
    const headers = ["Mã Chứng Từ", "Ngày Cân", "Số Xe", "Khách Hàng", "Đại Lý", "Nguồn Gốc", "Mã Đơn Giá", "Mã KL", "KL Hàng (kg)", "Giá Gốc (ĐG_AD)", "Điều Chỉnh", "Đơn Giá Áp Dụng", "Diễn Giải Đơn Giá", "Trạng Thái Giá", "Thành Tiền"];
    const rows = rep.data.map(r => [r.maChungTu, r.ngayCan1, r.soXe, r.khachHang, r.daiLy, r.nguonGoc, r.maDonGia, r.maKL, r.klHang, r.giaGoc, r.dieuChinh, r.donGiaApDung, r.dienGiai, r.trangThaiGia, r.thanhTien]);
    const tempSS = createTempSheetForExport_("BaoCao_DonGia_" + dinhDangGMT7_(new Date(), "ddMM_HHmm"), headers, rows, [9, 10, 11, 12, 15]);
    logAudit_('EXPORT_EXCEL', 'OK', 'Xuất báo cáo tổng hợp cân theo báo giá, ' + rep.data.length + ' dòng.');
    return { status: "success", url: getExportUrl_(tempSS, "xlsx") };
  } catch (e) { logAudit_('EXPORT_EXCEL', 'ERROR', e.toString()); return { status: "error", message: e.toString() }; }
}

function exportBaoCaoDonGiaPDF_(filters) {
  try {
    const rep = getBaoCaoDonGia_(filters);
    if (rep.status !== "success") return rep;
    if (rep.data.length === 0) return { status: "error", message: "Không có dữ liệu phù hợp bộ lọc để xuất." };
    const headers = ["Mã Chứng Từ", "Ngày Cân", "Số Xe", "Khách Hàng", "Đại Lý", "Nguồn Gốc", "Mã ĐG", "Mã KL", "Giá Gốc", "Điều Chỉnh", "Đơn Giá AD", "Diễn Giải", "Trạng Thái", "Thành Tiền"];
    const rows = rep.data.map(r => [r.maChungTu, r.ngayCan1, r.soXe, r.khachHang, r.daiLy, r.nguonGoc, r.maDonGia, r.maKL, r.giaGoc, r.dieuChinh, r.donGiaApDung, r.dienGiai, r.trangThaiGia, r.thanhTien]);
    const tempSS = createTempSheetForExport_("BaoCao_DonGia_PDF_" + dinhDangGMT7_(new Date(), "ddMM_HHmm"), headers, rows, [8, 9, 10, 13]);
    logAudit_('EXPORT_PDF', 'OK', 'Xuất PDF báo cáo tổng hợp cân theo báo giá, ' + rep.data.length + ' dòng.');
    return { status: "success", url: getExportUrl_(tempSS, "pdf", false) };
  } catch (e) { logAudit_('EXPORT_PDF', 'ERROR', e.toString()); return { status: "error", message: e.toString() }; }
}

// filters = {fromDate, toDate, xe, khachHang, trangThai}
function getBaoCaoMisa_(filters) {
  try {
    filters = filters || {};
    const ss = SpreadsheetApp.openById(CONFIG.MISA_DST_ID);
    const sheet = ss.getSheetByName(CONFIG.MISA_DST_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { status: "success", data: [], summary: { soLuong: 0, tongKL: 0, tongTien: 0 } };

    const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues(); // A..L
    const dntt = buildDNTTStatusMap_(filters.fromDate, filters.toDate);

    const start = filters.fromDate ? new Date(filters.fromDate + "T00:00:00+07:00") : null;
    const end = filters.toDate ? new Date(filters.toDate + "T23:59:59+07:00") : null;
    const xeFilter = String(filters.xe || "").trim();
    const khFilter = String(filters.khachHang || "").trim();
    const trangThaiFilter = String(filters.trangThai || "").trim();

    let result = []; let tongKL = 0; let tongTien = 0;

    data.forEach(row => {
      const ngay = parseDate_(row[0]); // Cột A
      if (!ngay) return;
      if (start && ngay < start) return;
      if (end && ngay > end) return;

      const xe = String(row[3] || "").trim(); // Cột D
      if (xeFilter && xe !== xeFilter) return;

      const tenNCC = String(row[11] || "").trim(); // Cột L
      if (khFilter && tenNCC !== khFilter) return;

      const maChungTu = String(row[2] || "").trim(); // Cột C (chính là Mã Chứng Từ dùng chung với PhieuCan_DN)
      const daLap = dntt.hasOwnProperty(maChungTu) ? dntt[maChungTu] : false;
      if (trangThaiFilter === "da" && !daLap) return;
      if (trangThaiFilter === "chua" && daLap) return;

      const khoiLuong = parseFloat(row[4]) || 0; // Cột E (Tấn)
      const donGia = parseFloat(row[5]) || 0; // Cột F
      const thanhTien = parseFloat(row[6]) || 0; // Cột G

      tongKL += khoiLuong; tongTien += thanhTien;

      result.push({
        maChungTu: maChungTu,
        ngay: dinhDangGMT7_(ngay, "dd/MM/yyyy"),
        ngayRaw: ngay.toISOString(), // dùng khi xuất Excel/PDF để ghi Date thật + áp MISA_FORMAT
        soXe: xe,
        khoiLuong: khoiLuong,
        donGia: donGia,
        thanhTien: thanhTien,
        tenNCC: tenNCC,
        trangThaiThanhToan: daLap ? "Đã lập ĐNTT" : "Chưa lập ĐNTT"
      });
    });

    result.sort((a, b) => (a.maChungTu > b.maChungTu ? 1 : -1));
    return { status: "success", data: result, summary: { soLuong: result.length, tongKL: tongKL, tongTien: tongTien } };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// ---- Helper dùng chung để tạo file tạm phục vụ xuất Excel / PDF ----
// Ô chữ bắt đầu bằng = + - @ bị Sheets/Excel hiểu là CÔNG THỨC. Dữ liệu gốc đã
// được sanitize() khi nhập (lưu dạng chữ), nhưng đọc ra rồi ghi sang file xuất
// thì Sheets sẽ tính lại thành công thức (Formula/CSV Injection trong file Excel
// gửi cho khách/kế toán) - nên mọi dữ liệu ghi vào file xuất phải qua hàm này.
function chongCongThuc_(v) {
  return (typeof v === "string" && /^[=+\-@]/.test(v)) ? "'" + v : v;
}
function chongCongThucBang_(rows) {
  return rows.map(function (r) { return r.map(chongCongThuc_); });
}

function createTempSheetForExport_(title, headers, rows, numberFormatCols) {
  const tempSS = SpreadsheetApp.create(title);
  const tempSheet = tempSS.getSheets()[0];
  tempSheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight("bold").setBackground("#1B4332").setFontColor("#FFFFFF").setHorizontalAlignment("center");
  if (rows.length > 0) {
    tempSheet.getRange(2, 1, rows.length, headers.length).setValues(chongCongThucBang_(rows));
    (numberFormatCols || []).forEach(c => tempSheet.getRange(2, c, rows.length, 1).setNumberFormat("#,##0"));
  }
  tempSheet.autoResizeColumns(1, headers.length);
  tempSheet.setFrozenRows(1);
  const tempFile = DriveApp.getFileById(tempSS.getId());
  DriveApp.getFolderById(CONFIG.FOLDER_DONE).addFile(tempFile);
  DriveApp.getRootFolder().removeFile(tempFile);
  return tempSS;
}

function getExportUrl_(tempSS, format, opt_portrait) {
  const gid = tempSS.getSheets()[0].getSheetId();
  const base = "https://docs.google.com/spreadsheets/d/" + tempSS.getId() + "/export";
  if (format === "pdf") {
    const portrait = opt_portrait === true;
    return base + "?format=pdf&gid=" + gid + "&size=A4&portrait=" + portrait +
      "&fitw=true&gridlines=false&printtitle=false&sheetnames=false&pagenumbers=true" +
      "&top_margin=0.4&bottom_margin=0.4&left_margin=0.4&right_margin=0.4";
  }
  return base + "?format=xlsx";
}

function exportBaoCaoTongHopExcel_(filters) {
  try {
    const rep = getBaoCaoTongHop_(filters);
    if (rep.status !== "success") return rep;
    if (rep.data.length === 0) return { status: "error", message: "Không có dữ liệu phù hợp bộ lọc để xuất." };
    const headers = ["Mã Chứng Từ", "Số Phiếu", "Ngày Cân 1", "Giờ Cân 1", "Ngày Cân 2", "Giờ Cân 2", "Số Xe", "Biển Số 2", "Khách Hàng", "KL Cân 1 (kg)", "KL Cân 2 (kg)", "KL Hàng (kg)", "Đơn Giá", "Thành Tiền", "Trạng Thái Giá", "Trạng Thái Thanh Toán"];
    const rows = rep.data.map(r => [r.maChungTu, r.soPhieu, r.ngayCan1, r.gioCan1, r.ngayCan2, r.gioCan2, r.soXe, r.soXe2, r.khachHang, r.klCan1, r.klCan2, r.klHang, r.donGia, r.thanhTien, r.trangThaiGia, r.trangThaiThanhToan]);
    const tempSS = createTempSheetForExport_("BaoCao_TongHopCan_" + dinhDangGMT7_(new Date(), "ddMM_HHmm"), headers, rows, [10, 11, 12, 13, 14]);
    logAudit_('EXPORT_EXCEL', 'OK', 'Xuất báo cáo tổng hợp cân, ' + rep.data.length + ' dòng.');
    return { status: "success", url: getExportUrl_(tempSS, "xlsx") };
  } catch (e) { logAudit_('EXPORT_EXCEL', 'ERROR', e.toString()); return { status: "error", message: e.toString() }; }
}

function exportBaoCaoTongHopPDF_(filters) {
  try {
    const rep = getBaoCaoTongHop_(filters);
    if (rep.status !== "success") return rep;
    if (rep.data.length === 0) return { status: "error", message: "Không có dữ liệu phù hợp bộ lọc để xuất." };
    const headers = ["Mã Chứng Từ", "Số Phiếu", "Ngày Cân 1", "Giờ Cân 1", "Ngày Cân 2", "Giờ Cân 2", "Số Xe", "Biển Số 2", "Khách Hàng", "KL Cân1(kg)", "KL Cân2(kg)", "KL Hàng(kg)", "Đơn Giá", "Thành Tiền", "Trạng Thái TT"];
    const rows = rep.data.map(r => [r.maChungTu, r.soPhieu, r.ngayCan1, r.gioCan1, r.ngayCan2, r.gioCan2, r.soXe, r.soXe2, r.khachHang, r.klCan1, r.klCan2, r.klHang, r.donGia, r.thanhTien, r.trangThaiThanhToan]);
    const tempSS = createTempSheetForExport_("BaoCao_TongHopCan_PDF_" + dinhDangGMT7_(new Date(), "ddMM_HHmm"), headers, rows, [10, 11, 12, 13, 14]);
    logAudit_('EXPORT_PDF', 'OK', 'Xuất PDF báo cáo tổng hợp cân, ' + rep.data.length + ' dòng.');
    return { status: "success", url: getExportUrl_(tempSS, "pdf", false) }; // landscape cho bảng nhiều cột
  } catch (e) { logAudit_('EXPORT_PDF', 'ERROR', e.toString()); return { status: "error", message: e.toString() }; }
}

function exportBaoCaoMisaExcel_(filters) {
  try {
    const rep = getBaoCaoMisa_(filters);
    if (rep.status !== "success") return rep;
    if (rep.data.length === 0) return { status: "error", message: "Không có dữ liệu phù hợp bộ lọc để xuất." };
    const headers = ["Mã Chứng Từ", "Ngày", "Số Xe", "Khối Lượng (Tấn)", "Đơn Giá", "Thành Tiền", "Tên NCC", "Trạng Thái Thanh Toán"];
    // Ghi Date object THẬT (không phải chuỗi "dd/MM/yyyy" đã format sẵn cho UI)
    // để cột Ngày trong file xuất KHÔNG bị Google Sheets để dạng Text tùy Locale.
    const rows = rep.data.map(r => [r.maChungTu, new Date(r.ngayRaw), r.soXe, r.khoiLuong, r.donGia, r.thanhTien, r.tenNCC, r.trangThaiThanhToan]);
    const tempSS = createTempSheetForExport_("BaoCao_Misa_" + dinhDangGMT7_(new Date(), "ddMM_HHmm"), headers, rows, [4, 5, 6]);
    tempSS.getSheets()[0].getRange(2, 2, rows.length, 1).setNumberFormat(MISA_FORMAT_().DATE_FMT);
    logAudit_('EXPORT_EXCEL', 'OK', 'Xuất báo cáo Misa, ' + rep.data.length + ' dòng.');
    return { status: "success", url: getExportUrl_(tempSS, "xlsx") };
  } catch (e) { logAudit_('EXPORT_EXCEL', 'ERROR', e.toString()); return { status: "error", message: e.toString() }; }
}

function exportBaoCaoMisaPDF_(filters) {
  try {
    const rep = getBaoCaoMisa_(filters);
    if (rep.status !== "success") return rep;
    if (rep.data.length === 0) return { status: "error", message: "Không có dữ liệu phù hợp bộ lọc để xuất." };
    const headers = ["Mã Chứng Từ", "Ngày", "Số Xe", "KL(Tấn)", "Đơn Giá", "Thành Tiền", "Tên NCC", "Trạng Thái TT"];
    const rows = rep.data.map(r => [r.maChungTu, new Date(r.ngayRaw), r.soXe, r.khoiLuong, r.donGia, r.thanhTien, r.tenNCC, r.trangThaiThanhToan]);
    const tempSS = createTempSheetForExport_("BaoCao_Misa_PDF_" + dinhDangGMT7_(new Date(), "ddMM_HHmm"), headers, rows, [4, 5, 6]);
    tempSS.getSheets()[0].getRange(2, 2, rows.length, 1).setNumberFormat(MISA_FORMAT_().DATE_FMT);
    logAudit_('EXPORT_PDF', 'OK', 'Xuất PDF báo cáo Misa, ' + rep.data.length + ' dòng.');
    return { status: "success", url: getExportUrl_(tempSS, "pdf", true) };
  } catch (e) { logAudit_('EXPORT_PDF', 'ERROR', e.toString()); return { status: "error", message: e.toString() }; }
}

// In một phiếu cân riêng lẻ ra PDF (khổ A5), tra theo Mã Chứng Từ
// Chuyển số thành chữ tiếng Việt (dùng cho dòng "Số tiền bằng chữ" trên phiếu nhập kho)
function soThanhChu_(so) {
  so = Math.round(Math.abs(so || 0));
  if (so === 0) return "Không đồng";
  const chuSo = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const donVi = ["", "nghìn", "triệu", "tỷ"];

  function docBaSo(n, coTramDauKhong) {
    const tram = Math.floor(n / 100);
    const chuc = Math.floor((n % 100) / 10);
    const donvi = n % 10;
    let s = "";
    if (tram > 0 || coTramDauKhong) s += chuSo[tram] + " trăm ";
    if (chuc === 0) { if (donvi > 0 && (tram > 0 || coTramDauKhong)) s += "lẻ "; }
    else if (chuc === 1) s += "mười ";
    else s += chuSo[chuc] + " mươi ";
    if (donvi === 1 && chuc >= 2) s += "mốt";
    else if (donvi === 5 && chuc >= 1) s += "lăm";
    else if (donvi > 0) s += chuSo[donvi];
    return s.trim();
  }

  const nhom = [];
  let n = so;
  while (n > 0) { nhom.push(n % 1000); n = Math.floor(n / 1000); }

  let ketQua = "";
  for (let i = nhom.length - 1; i >= 0; i--) {
    if (nhom[i] === 0) continue;
    const coTramDauKhong = i < nhom.length - 1; // các nhóm sau nhóm đầu tiên luôn đọc đủ hàng trăm
    ketQua += docBaSo(nhom[i], coTramDauKhong) + " " + donVi[i] + " ";
  }
  ketQua = ketQua.replace(/\s+/g, " ").trim();
  return ketQua.charAt(0).toUpperCase() + ketQua.slice(1) + " đồng";
}

// In "PHIẾU NHẬP KHO" theo đúng bố cục chứng từ nhập kho thực tế (khác với báo
// cáo/bảng dữ liệu thô): có tiêu đề công ty, bảng hàng hóa, số tiền bằng chữ,
// và 4 cột chữ ký (Người giao hàng / Thủ kho / Kế toán / Người lập phiếu).
function exportPhieuCanPDF_(maChungTu) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.DATA_SHEET);
    const lastRow = sheet.getLastRow();
    const key = String(maChungTu || "").trim();
    let found = null;
    if (lastRow > 1) {
      const data = sheet.getRange(2, 1, lastRow - 1, 27).getValues();
      found = data.find(row => String(row[21] || "").trim() === key) || null;
    }
    // FIX (an toàn Lưu trữ theo năm - PHẦN 1C): phiếu đã "chốt sổ" không còn ở
    // sheet chính - Mã Chứng Từ có dạng "<Số phiếu>/<Năm>/NK" nên tách được
    // đúng năm cần tìm, chỉ cần mở ĐÚNG 1 sheet lưu trữ năm đó (không cần quét
    // mọi năm đã lưu trữ) để "In phiếu" vẫn hoạt động với phiếu cũ đã lưu trữ.
    if (!found) {
      const namTrongKey = key.match(/\/(\d{4})\/NK$/);
      if (namTrongKey) {
        const sheetNam = ss.getSheetByName(LT_tenSheetLuuTru_(parseInt(namTrongKey[1], 10)));
        if (sheetNam && sheetNam.getLastRow() > 1) {
          const dataNam = sheetNam.getRange(2, 1, sheetNam.getLastRow() - 1, 27).getValues();
          found = dataNam.find(row => String(row[21] || "").trim() === key) || null;
        }
      }
    }
    if (!found) return { status: "error", message: "Không tìm thấy phiếu cân " + maChungTu };

    const tempSS = SpreadsheetApp.create("PhieuNhapKho_" + String(maChungTu).replace(/\//g, "_"));
    const sh = tempSS.getSheets()[0];
    const NUM_COLS = 6;
    sh.setColumnWidths(1, NUM_COLS, 100);
    sh.setColumnWidth(2, 150);

    const ngayCan1 = found[1] instanceof Date ? found[1] : null;
    const ngayCan2 = found[3] instanceof Date ? found[3] : null;
    const gioCan1 = found[2] instanceof Date ? gioCuaO_(found[2]) : "";
    const gioCan2 = found[4] instanceof Date ? gioCuaO_(found[4]) : "";
    const soXe2 = String(found[6] || "").trim();
    const idDntt = String(found[26] || "").trim();
    const klHang = parseFloat(found[9]) || 0;
    const donGia = parseFloat(found[23]) || 0;
    const thanhTien = parseFloat(found[25]) || 0;
    const ngayLap = ngayCan2 || ngayCan1 || new Date();

    let r = 1;
    sh.getRange(r, 1, 1, NUM_COLS).merge().setValue(COMPANY_NAME).setFontWeight("bold").setFontSize(12); r++;
    sh.getRange(r, 1, 1, NUM_COLS).merge().setValue("Địa chỉ: ................................................................").setFontSize(9).setFontColor("#5B6259"); r += 2;

    sh.getRange(r, 1, 1, NUM_COLS).merge().setValue("PHIẾU NHẬP KHO").setFontWeight("bold").setFontSize(16).setHorizontalAlignment("center"); r++;
    sh.getRange(r, 1, 1, NUM_COLS).merge()
      .setValue("Ngày " + dinhDangGMT7_(ngayLap, "dd") + " tháng " + dinhDangGMT7_(ngayLap, "MM") + " năm " + dinhDangGMT7_(ngayLap, "yyyy"))
      .setFontStyle("italic").setHorizontalAlignment("center"); r += 2;

    const thongTin = [
      ["Số phiếu cân", found[0], "Mã chứng từ", maChungTu],
      ["Khách hàng giao hàng", found[11], "Số xe", found[5] + (soXe2 ? " / " + soXe2 : "")],
      ["Thời gian cân lần 1", (ngayCan1 ? dinhDangGMT7_(ngayCan1, "dd/MM/yyyy") : "") + " " + gioCan1, "Thời gian cân lần 2", (ngayCan2 ? dinhDangGMT7_(ngayCan2, "dd/MM/yyyy") : "") + " " + gioCan2],
      ["Nhập tại kho", "Kho nguyên liệu " + COMPANY_NAME, "Trạng thái ĐNTT", idDntt || "Chưa lập ĐNTT"]
    ];
    thongTin.forEach(row => {
      sh.getRange(r, 1).setValue(row[0]).setFontWeight("bold");
      // FIX M-06: ô lưu dạng chữ '=... đọc ra thành "=..." - ghi lại phải chặn công thức.
      sh.getRange(r, 2, 1, 2).merge().setValue(chongCongThuc_(row[1]));
      sh.getRange(r, 4).setValue(row[2]).setFontWeight("bold");
      sh.getRange(r, 5, 1, 2).merge().setValue(chongCongThuc_(row[3]));
      r++;
    });
    r++;

    const headerRow = r;
    sh.getRange(r, 1, 1, NUM_COLS).setValues([["STT", "Tên hàng hóa", "ĐVT", "Khối lượng", "Đơn giá", "Thành tiền"]])
      .setFontWeight("bold").setBackground("#1B4332").setFontColor("#FFFFFF").setHorizontalAlignment("center")
      .setBorder(true, true, true, true, true, true);
    r++;
    const goodsRow = r;
    sh.getRange(r, 1, 1, NUM_COLS).setValues([[1, "Gỗ nguyên liệu (Nguồn gốc: " + (found[10] || "") + ")", "Kg", klHang, donGia, thanhTien]])
      .setBorder(true, true, true, true, true, true);
    sh.getRange(r, 4, 1, 3).setNumberFormat("#,##0");
    r++;
    sh.getRange(r, 1, 1, 3).merge().setValue("CỘNG").setFontWeight("bold").setHorizontalAlignment("center").setBorder(true, true, true, true, true, true);
    sh.getRange(r, 4).setValue(klHang).setFontWeight("bold").setNumberFormat("#,##0").setBorder(true, true, true, true, true, true);
    sh.getRange(r, 5).setBorder(true, true, true, true, true, true);
    sh.getRange(r, 6).setValue(thanhTien).setFontWeight("bold").setNumberFormat("#,##0").setBorder(true, true, true, true, true, true);
    r += 2;

    sh.getRange(r, 1, 1, NUM_COLS).merge().setValue("Số tiền bằng chữ: " + soThanhChu_(thanhTien)).setFontStyle("italic");
    r += 2;

    const chuKy = ["Người giao hàng", "Thủ kho", "Kế toán", "Người lập phiếu"];
    // Chia 4 mục ký tên trên NUM_COLS=6 cột: (1-2)=Người giao hàng, (3)=Thủ kho, (4)=Kế toán, (5-6)=Người lập phiếu
    sh.getRange(r, 1, 1, 2).merge().setValue(chuKy[0]).setFontWeight("bold").setHorizontalAlignment("center");
    sh.getRange(r, 3, 1, 1).merge().setValue(chuKy[1]).setFontWeight("bold").setHorizontalAlignment("center");
    sh.getRange(r, 4, 1, 1).merge().setValue(chuKy[2]).setFontWeight("bold").setHorizontalAlignment("center");
    sh.getRange(r, 5, 1, 2).merge().setValue(chuKy[3]).setFontWeight("bold").setHorizontalAlignment("center");
    r++;
    sh.getRange(r, 1, 1, 2).merge().setValue("(Ký, họ tên)").setFontStyle("italic").setFontSize(9).setHorizontalAlignment("center");
    sh.getRange(r, 3, 1, 1).merge().setValue("(Ký, họ tên)").setFontStyle("italic").setFontSize(9).setHorizontalAlignment("center");
    sh.getRange(r, 4, 1, 1).merge().setValue("(Ký, họ tên)").setFontStyle("italic").setFontSize(9).setHorizontalAlignment("center");
    sh.getRange(r, 5, 1, 2).merge().setValue("(Ký, họ tên)").setFontStyle("italic").setFontSize(9).setHorizontalAlignment("center");
    r += 5; // chừa khoảng trống để ký tay

    const tempFile = DriveApp.getFileById(tempSS.getId());
    DriveApp.getFolderById(CONFIG.FOLDER_DONE).addFile(tempFile);
    DriveApp.getRootFolder().removeFile(tempFile);

    const gid = sh.getSheetId();
    const url = "https://docs.google.com/spreadsheets/d/" + tempSS.getId() + "/export?format=pdf&gid=" + gid +
      "&size=A4&portrait=true&fitw=true&gridlines=false&printtitle=false&sheetnames=false&pagenumbers=false" +
      "&top_margin=0.5&bottom_margin=0.5&left_margin=0.5&right_margin=0.5";
    return { status: "success", url: url };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function parseDate_(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400 * 1000));
  if (typeof v === "string") {
    // Nhánh này chỉ còn phục vụ dữ liệu CŨ đã tồn tại trước khi áp dụng FIX #1/#3
    // (được ghi dưới dạng chuỗi). Dữ liệu mới ghi từ nay là Date object thật
    // nên sẽ luôn rơi vào nhánh "v instanceof Date" ở trên, không đi qua đây.
    // FIX #10: đồng bộ với toDateObj - mặc định DD/MM/YYYY (đã chứng minh đúng
    // bằng số học), tự sửa nếu phần "tháng" > 12 mà phần "ngày" ≤ 12.
    let p = v.includes("-") ? v.split("-") : v.split("/");
    if (p.length === 3) {
      if (p[0].length === 4) return new Date(p[0], p[1] - 1, p[2]); // yyyy-MM-dd, không mơ hồ
      let ngay = parseInt(p[0], 10);
      let thang = parseInt(p[1], 10);
      if (thang > 12 && ngay <= 12) { const tmp = ngay; ngay = thang; thang = tmp; }
      return new Date(p[2], thang - 1, ngay);
    }
  }
  return null;
}

// FIX #24: Chuyển đổi 1 Blob .xlsx sang Google Sheet TẠM để đọc dữ liệu - có
// THỬ LẠI (retry) tự động vì Drive.Files.insert(..., {convert:true}) là API
// v2 CŨ, được cộng đồng Apps Script Community và Google Issue Tracker xác
// nhận từ lâu là hay gặp lỗi "Internal Error" TẠM THỜI phía server Google khi
// convert file - không phải lỗi logic code. Thử lại vài lần với độ trễ tăng
// dần (1s, 2s) thường sẽ thành công ở lần 2 hoặc 3. Nếu lỗi KHÔNG PHẢI dạng
// tạm thời (VD sai định dạng file, hết quyền truy cập) thì dừng ngay, không
// retry vô ích - dùng chung cho cả step1_PreviewDraft và XH_step1_PreviewDraft.
function convertXlsxToTempSheet_(blob, title) {
  const SO_LAN_THU_TOI_DA = 3;
  let loiCuoi = null;
  for (let lan = 1; lan <= SO_LAN_THU_TOI_DA; lan++) {
    try {
      return Drive.Files.insert({ title: title }, blob, { convert: true });
    } catch (e) {
      loiCuoi = e;
      const thongBaoLoi = String((e && e.message) || e);
      const laLoiTamThoi = /internal error|backend error|rate limit|try again|timeout|temporarily/i.test(thongBaoLoi);
      if (!laLoiTamThoi || lan === SO_LAN_THU_TOI_DA) throw e;
      Utilities.sleep(1000 * lan); // 1 giây, rồi 2 giây trước khi thử lại
    }
  }
  throw loiCuoi;
}

// FIX #4 CỰC KỲ QUAN TRỌNG (round-trip qua client-server Apps Script): Khi
// step1_PreviewDraft trả Date object thật về client, Apps Script serialize
// thành chuỗi ISO ("2026-07-25T00:00:00.000Z") để gửi qua JSON - KHÔNG PHẢI
// object thật) cho trình duyệt; khi người dùng bấm "Xác nhận", trình duyệt gửi
// NGUYÊN rawRowData đó về step1_ConfirmImport — nhưng lúc này Date đã bị
// Apps Script tự chuyển thành chuỗi ISO. Bản toDateObj cũ chỉ biết phân tích
// chuỗi kiểu "DD/MM/YYYY..." (dành cho dữ liệu text thật từ file nguồn), nên
// khi gặp chuỗi ISO sẽ đọc SAI HOÀN TOÀN vị trí ngày/tháng/năm (đã kiểm chứng:
// có thể lệch tới hàng chục năm). Fix: nhận diện chuỗi ISO trước và dùng
// new Date() phân giải chuẩn, chỉ dùng regex thủ công cho các chuỗi không phải ISO.
function toDateObj_(val) {
  if (val instanceof Date) return val;
  if (typeof val === 'string' && val.trim() !== "") {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }
    // FIX #10 (THAY THẾ FIX #5 - FIX #5 ĐÃ SAI HƯỚNG): Đã có bằng chứng số học rõ
    // ràng: chuỗi "25/07/2026" (ngày thật 25/7) bị FIX #5 (giả định MM/DD/YYYY)
    // đọc nhầm "25" thành THÁNG -> tháng tự tràn thành tháng 1/2028, ra đúng lỗi
    // "07/01/2028" người dùng gặp phải. Vì "25" không thể là tháng, xác nhận file
    // gốc dùng DD/MM/YYYY (kiểu Việt Nam) chứ không phải MM/DD/YYYY.
    // Để tránh phụ thuộc cứng vào 1 giả định cố định (đã sai 1 lần), nay dùng cơ
    // chế TỰ SỬA: mặc định đọc theo DD/MM/YYYY (parts[0]=ngày, parts[1]=tháng),
    // nhưng nếu phần "tháng" > 12 (chắc chắn vô lý) trong khi phần "ngày" ≤ 12,
    // thì tự hoán đổi lại thành MM/DD/YYYY cho đúng dữ liệu. Cách này không bao
    // giờ tạo ra tháng > 12 (không còn hiện tượng tràn năm/tháng như lỗi vừa gặp).
    const parts = trimmed.match(/(\d+)/g);
    if (parts && parts.length >= 3) {
      let ngay = parseInt(parts[0], 10);
      let thang = parseInt(parts[1], 10);
      if (thang > 12 && ngay <= 12) { const tmp = ngay; ngay = thang; thang = tmp; }
      // FIX M-03: năm 2 chữ số ("25/07/26") trước đây thành 1926 - hiểu là 20xx (như chuanHoaNgay_).
      let nam = parseInt(parts[2], 10);
      if (nam < 100) nam += 2000;
      return new Date(nam, thang - 1, ngay, parts[3] || 0, parts[4] || 0, parts[5] || 0);
    }
  }
  return null;
}

// FIX #3: Dữ liệu thật cho thấy "Ngày cân X" luôn là NGÀY THUẦN (giờ=00:00:00)
// và "Giờ cân X" luôn là GIỜ THUẦN (Sheets lưu Time dựa trên mốc gốc 30/12/1899).
// Trước đây step1_ConfirmImport/addManualPhieuCan ghi CHUNG 1 datetime đầy đủ vào
// cả 2 cột rồi chỉ đổi định dạng hiển thị — vẫn hiển thị đúng, nhưng giá trị GỐC
// lưu trong ô bị lệch chuẩn (cột "Ngày" vẫn mang theo giờ:phút:giây bên trong),
// có thể gây sai lệch nếu có công thức/pivot/QUERY khác dựa vào đúng kiểu dữ liệu.
// 2 helper dưới đây tách rõ ràng để khớp đúng quy ước dữ liệu thật.
function toDateOnly_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function toTimeOnly_(d) { return new Date(1899, 11, 30, d.getHours(), d.getMinutes(), d.getSeconds()); }

// Ghi log vào sheet "Audit" (Thời gian, Hành động, Trạng thái, Nội dung, Người
// thực hiện) trong Spreadsheet Phiếu cân. Xem lại ở Hệ thống › Nhật ký hoạt động.
function logAudit_(action, status, message) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(CONFIG.AUDIT_SHEET);
    if (!sheet) {
      // TRƯỚC ĐÂY thiếu sheet Audit thì âm thầm KHÔNG ghi gì (mất toàn bộ vết
      // kiểm soát, VD khi cài cho doanh nghiệp mới) - nay tự tạo.
      sheet = ss.insertSheet(CONFIG.AUDIT_SHEET);
      sheet.appendRow(NK_TIEU_DE_);
      sheet.setFrozenRows(1);
    }
    // Cột E = người thực hiện: webapp chạy bằng tài khoản Admin (USER_DEPLOYING)
    // nên phải ghi rõ email người đăng nhập, nếu không mọi dòng log đều như Admin làm.
    if (!sheet.getRange(1, 5).getValue()) sheet.getRange(1, 5).setValue("Người thực hiện");
    // appendRow() là thao tác nguyên tử của Sheets: 2 người ghi log cùng lúc
    // không ghi đè lên cùng 1 dòng (khác với tự tính getLastRow()+1 như trước).
    // Cắt bớt nội dung quá dài (1 ô tối đa 50.000 ký tự - vượt là lỗi, mất log)
    // và chặn nội dung bị hiểu thành công thức.
    const noiDung = String(message == null ? "" : message);
    sheet.appendRow([new Date(), action, status,
      chongCongThuc_(noiDung.length > 45000 ? noiDung.slice(0, 45000) + "…(đã cắt bớt)" : noiDung),
      layThongTinNguoiDungHienTai_().email || ""]);
  } catch (e) { /* Không để lỗi ghi log làm hỏng thao tác chính */ }
}
function createSimpleMap_(s,k,v) { const d=s.getDataRange().getValues(); let m={}; for(let i=1;i<d.length;i++){ let key=String(d[i][k]).trim(); if(key) m[key]=d[i][v]; } return m; }

// FIX (bảo vệ chống lệch cột): Toàn bộ hệ thống ghi/đọc theo VỊ TRÍ CỘT CỐ ĐỊNH
// (VD row[21], getRange(...,22,...)...) trên các Sheet mà nhân viên vẫn có thể
// mở và sửa trực tiếp (chèn/xóa/đổi thứ tự cột) - TRƯỚC ĐÂY không có bất kỳ
// cảnh báo nào, nên 1 cột bị chèn/xóa nhầm sẽ làm dữ liệu SAI LỆCH ÂM THẦM.
// Vì code không biết chắc "tiêu đề ĐÚNG" phải là chữ gì trên từng Sheet thật
// (không có quyền đọc trước dữ liệu thật để đối chiếu), hàm này dùng cách AN
// TOÀN hơn: TỰ CHỤP LẠI tiêu đề dòng 1 làm "chuẩn tin cậy" (lưu PropertiesService)
// ngay LẦN ĐẦU chạy sau khi triển khai bản vá này, rồi từ đó về sau CHỈ CẢNH BÁO
// (không chặn thao tác) nếu phát hiện tiêu đề đã đổi khác so với chuẩn đã lưu.
// Nếu thay đổi cột là CHỦ Ý (admin thêm/sửa cột hợp lệ), gọi
// HT_datLaiChuanHeaderSheet_ (bên dưới) để "chốt lại" chuẩn mới, tắt cảnh báo.
// Nối các cảnh báo (bỏ chuỗi rỗng) vào sau thông báo thành công: "msg | cảnh báo 1 | cảnh báo 2".
function noiCanhBao_(thongBao, dsCanhBao) {
  const ds = [].concat(dsCanhBao || []).filter(Boolean);
  return ds.length ? thongBao + " | " + ds.join(" | ") : thongBao;
}

function kiemTraLechHeaderSheet_(sheet, tenGoiSheet, soCotCanTheoDoi) {
  try {
    if (!sheet || sheet.getLastRow() < 1) return "";
    const soCotDoc = Math.min(soCotCanTheoDoi, Math.max(sheet.getLastColumn(), 1));
    const headerThat = sheet.getRange(1, 1, 1, soCotDoc).getValues()[0].map(v => String(v || "").trim());
    const key = "HEADER_BASELINE_" + tenGoiSheet;
    const props = PropertiesService.getScriptProperties();
    const daLuu = props.getProperty(key);
    if (!daLuu) {
      props.setProperty(key, JSON.stringify(headerThat)); // Lần đầu: chụp làm chuẩn, chưa có gì để so sánh
      return "";
    }
    let baseline = [];
    try { baseline = JSON.parse(daLuu); } catch (e) { baseline = []; }
    const saiLech = [];
    for (let i = 0; i < Math.max(baseline.length, headerThat.length); i++) {
      const cu = baseline[i] || ""; const moi = headerThat[i] || "";
      if (cu !== moi) saiLech.push('Cột ' + (i + 1) + ': "' + cu + '" → "' + moi + '"');
    }
    if (saiLech.length > 0) {
      const canhBao = "⚠️ CẢNH BÁO cấu trúc Sheet \"" + tenGoiSheet + "\" đã đổi khác so với lần kiểm tra gần nhất (có thể do chèn/xóa/đổi thứ tự cột thủ công) - hệ thống đọc/ghi theo VỊ TRÍ cột cố định nên có nguy cơ SAI LỆCH DỮ LIỆU: " + saiLech.join("; ") + ". Nếu đây là thay đổi hợp lệ, vào Hệ thống → Cấu hình hệ thống để xác nhận lại chuẩn.";
      logAudit_("CANH_BAO_LECH_HEADER", "WARNING", canhBao);
      return canhBao;
    }
    return "";
  } catch (e) { return ""; } // Không để lỗi kiểm tra làm hỏng luồng chính
}

// Admin xác nhận cấu trúc cột HIỆN TẠI là đúng/hợp lệ (VD sau khi chủ động
// thêm cột mới) - chụp lại làm chuẩn mới, tắt cảnh báo từ lần sau.
function HT_datLaiChuanHeaderSheet_(tenGoiSheet, sheet) {
  try {
    if (!sheet || sheet.getLastRow() < 1) return;
    const header = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(v => String(v || "").trim());
    PropertiesService.getScriptProperties().setProperty("HEADER_BASELINE_" + tenGoiSheet, JSON.stringify(header));
  } catch (e) { /* bỏ qua */ }
}

function HT_xacNhanCauTrucSheetHienTai_() {
  try {
    const ssPC = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    HT_datLaiChuanHeaderSheet_("PhieuCan_DN", ssPC.getSheetByName(CONFIG.DATA_SHEET));
    const ssXH = XH_ss_();
    HT_datLaiChuanHeaderSheet_("NL_PC_XH", ssXH.getSheetByName(XUATHANG_CONFIG.SHEET_NLPCXH));
    HT_datLaiChuanHeaderSheet_("NL_DH_XB", ssXH.getSheetByName(XUATHANG_CONFIG.SHEET_DHXB));
    const ssBG = BG_ss_();
    HT_datLaiChuanHeaderSheet_("Baogia_DN", ssBG.getSheetByName(BAOGIA_CONFIG.SRC_SHEET));
    HT_datLaiChuanHeaderSheet_("QL_BaoGia", ssBG.getSheetByName(BAOGIA_CONFIG.QL_SHEET));
    HT_datLaiChuanHeaderSheet_("Ma_BaoGia", ssBG.getSheetByName(BAOGIA_CONFIG.MA_SHEET));
    HT_datLaiChuanHeaderSheet_("Ma_KL", ssBG.getSheetByName(BAOGIA_CONFIG.MAKL_SHEET));
    const ssKD = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
    ["SHEET_GIAODICH", "SHEET_CAUHINH", "SHEET_NHAPDOKHO", "SHEET_DANHMUCKHO"].forEach(function (k) {
      HT_datLaiChuanHeaderSheet_(KHODAM_CONFIG[k], ssKD.getSheetByName(KHODAM_CONFIG[k]));
    });
    logAudit_("CAUHINH_XACNHAN_HEADER", "OK", "Admin đã xác nhận lại chuẩn cấu trúc cột hiện tại.");
    return { status: "success", message: "✅ Đã xác nhận cấu trúc cột hiện tại làm chuẩn mới. Cảnh báo lệch cột sẽ tắt cho đến lần thay đổi tiếp theo." };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

/* ---------- File mẫu tải về cho 2 loại Import (không đụng dữ liệu thật) ---------- */

// Mẫu Phiếu cân NHẬP (PhieuCan_DN) - đúng theo tiêu đề đã XÁC NHẬN từ file thật
// "BÁO CÁO XE ĐÃ CÂN" của phần mềm trạm cân (kiểu cân = Nhập).
function taoFileMauPhieuCan_() {
  try {
    const headers = ["STT", "Số phiếu", "Ngày giờ cân 1", "Ngày giờ cân 2", "Biển số 1", "Cân lần 1", "Cân lần 2", "KL Hàng (KG)", "quy cách", "Khách hàng", "Người cân 1", "Đại lý", "Nguồn gốc", "ĐL"];
    const vd = [1, 7107, "25/07/2026 02:06:28", "25/07/2026 02:59:58", "92A-54957", 27020, 9030, 17990, "Tọa độ 15.762805, 108.150135, Xã Duy Xuyên, TP Đà Nẵng", "NGUYỄN VĂN HOÀNG", "Phạm Đình Giao", "NGÔ DUY THỨC", "ĐL"];
    const ghiChu = "Lưu ý: Cột 'Ngày giờ cân 1/2' PHẢI theo định dạng DD/MM/YYYY HH:mm:ss (ví dụ: 25/07/2026 02:06:28). Xóa dòng ví dụ này và điền dữ liệu thật của bạn từ dòng 3 trở xuống, giữ nguyên dòng tiêu đề (dòng 2).";
    return taoFileMau_("Mau_Import_PhieuCan_Nhap", headers, vd, ghiChu);
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Mẫu phiếu cân XUẤT HÀNG (NL_PC_XH) - GHÉP từ tiêu đề THẬT của NL_PC_XH cho các
// cột lõi (chắc chắn đúng), cộng thêm các cột đặc thù xuất hàng theo suy đoán
// tốt nhất (Đơn vị vận chuyển/Tên tài xế) vì CHƯA có file mẫu thật kiểu "Xuất"
// để đối chiếu — nếu tên cột thực tế trên trạm cân khác đi, chỉ cần đổi lại
// đúng tên tiêu đề trong file bạn tải lên cho khớp là hệ thống vẫn đọc được
// (import tìm cột theo TÊN, không theo vị trí cố định).
function taoFileMauXuatHang_() {
  try {
    const headers = ["STT", "Số phiếu", "Ngày giờ cân 1", "Ngày giờ cân 2", "Biển số 1", "Cân lần 1", "Cân lần 2", "KL Hàng (KG)", "Đơn vị vận chuyển", "Tên tài xế", "NGƯỜI CÂN", "Kho xuất", "Kho nhập"];
    const vd = [1, "01", "22/01/2025 07:36:52", "22/01/2025 08:02:32", "92C-08727", 14160, 36080, 21920, "Công Ty TNHH Dịch Vụ Và Vận Tải Hùng Hoàng Hoa", "Mr Tâm", "Trần Thị Phương", "Kho Tiên Sa", "Kho Xuất Bán"];
    const ghiChu = "⚠️ Mẫu này là suy đoán tốt nhất dựa trên cấu trúc sheet NL_PC_XH thật, CHƯA có file mẫu thật từ trạm cân kiểu 'Xuất' để đối chiếu. Cột 'Ngày giờ cân 1/2' PHẢI theo định dạng DD/MM/YYYY HH:mm:ss. Cột 'Kho xuất'/'Kho nhập' là TÙY CHỌN - nếu trạm cân không xuất ra 2 cột này, có thể để trống trong file và chọn giá trị áp dụng chung cho cả lô ngay trên giao diện Import. Hệ thống tìm cột theo ĐÚNG TÊN TIÊU ĐỀ (không theo vị trí), nên nếu tên cột thật trên trạm cân khác đi, chỉ cần sửa lại đúng tên cho khớp là vẫn import được.";
    return taoFileMau_("Mau_Import_XuatHang", headers, vd, ghiChu);
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Helper dùng chung: tạo 1 Google Sheet mẫu (dòng 1 = ghi chú, dòng 2 = tiêu đề,
// dòng 3 = ví dụ), lưu vào FOLDER_DONE, trả về link tải xuống dạng .xlsx.
function taoFileMau_(tenFile, headers, dongViDu, ghiChu) {
  const tempSS = SpreadsheetApp.create(tenFile + "_" + dinhDangGMT7_(new Date(), "ddMM_HHmm"));
  const sh = tempSS.getSheets()[0];
  sh.getRange(1, 1, 1, headers.length).merge().setValue(ghiChu).setWrap(true).setFontStyle("italic").setFontColor("#B3261E");
  sh.getRange(2, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#1B4332").setFontColor("#FFFFFF");
  sh.getRange(3, 1, 1, dongViDu.length).setValues([dongViDu]);
  sh.getRange(3, 1, 1, dongViDu.length).setNumberFormat("@"); // ép Text để không bị Sheets tự đoán lại định dạng ngày
  sh.autoResizeColumns(1, headers.length);
  sh.setRowHeight(1, 50);

  const tempFile = DriveApp.getFileById(tempSS.getId());
  DriveApp.getFolderById(CONFIG.FOLDER_DONE).addFile(tempFile);
  DriveApp.getRootFolder().removeFile(tempFile);

  return { status: "success", url: "https://docs.google.com/spreadsheets/d/" + tempSS.getId() + "/export?format=xlsx" };
}

/*********************************************************
 * PHẦN 5: QUẢN LÝ BÁO GIÁ (MENU 3)
 * - Cùng spreadsheet với CONFIG.URL_BAO_GIA / CONFIG.SHEET_BAO_GIA đã dùng
 *   trong runCalculatePrice_core để tra giá cân hàng — giữ NGUYÊN cấu trúc
 *   sheet gốc: Baogia_DN (log nhập), QL_BaoGia (đầu phiếu báo giá),
 *   Baogia_DN_FINAL (chỉ dòng còn hiệu lực), Baogia_DN_SAVE (toàn bộ lịch sử),
 *   Ma_BaoGia (danh mục mã báo giá), Ma_KL (danh mục mã khối lượng).
 * - Toàn bộ logic tính "Còn/Chưa/Hết hiệu lực" (BG_coreLogicProcessor_) được
 *   giữ NGUYÊN VẸN như code gốc để không thay đổi cách tính giá đang chạy.
 * - Cấu hình BAOGIA_CONFIG nằm trong file Config.gs.
 *********************************************************/

function BG_ss_() { return SpreadsheetApp.openById(BAOGIA_CONFIG.SPREADSHEET_ID); }

/* ---------- 5.1 Danh mục mã báo giá (Ma_BaoGia) ---------- */
function BG_getMaBaoGiaList_() {
  try {
    const sheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.MA_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { status: "success", data: [] };
    const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    const result = data
      .map(r => ({ stt: r[0], maBaoGia: r[1], daiLy: r[2], nguonGoc: r[3], hinhAnh: r[4], noiDung: r[5], maDLNG: r[6] }))
      .filter(r => String(r.maBaoGia || "").trim() !== "");
    return { status: "success", data: result };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// fields: {daiLyMa, daiLyTen, nguonGocMa, nguonGocTen, hinhAnh:'Y'|'N'}
function BG_addMaBaoGia_(fields) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); } catch (e) {
    return { status: "error", message: "Hệ thống đang bận, vui lòng thử lại." };
  }
  try {
    const daiLyMa = String(fields.daiLyMa || "").trim().toUpperCase();
    const daiLyTen = String(fields.daiLyTen || "").trim();
    const nguonGocMa = String(fields.nguonGocMa || "").trim().toUpperCase();
    const nguonGocTen = String(fields.nguonGocTen || "").trim();
    const hinhAnh = String(fields.hinhAnh || "Y").trim().toUpperCase() === "N" ? "N" : "Y";
    if (!daiLyMa || !daiLyTen) return { status: "error", message: "Vui lòng nhập Mã và Tên đầy đủ Đại lý." };
    if (!nguonGocMa || !nguonGocTen) return { status: "error", message: "Vui lòng nhập Mã và Tên đầy đủ Nguồn gốc." };

    const maBaoGia = daiLyMa + "_" + nguonGocMa + "_" + hinhAnh;
    const maDLNG = daiLyMa + "_" + nguonGocMa;
    const noiDung = "Đại lý " + daiLyTen + " Nguồn gốc " + nguonGocTen + ", " + (hinhAnh === "Y" ? "có" : "không") + " hình ảnh";

    const sheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.MA_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const existing = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); // Cột B - Mã Báo giá
      for (let row of existing) {
        if (String(row[0] || "").trim().toUpperCase() === maBaoGia) {
          return { status: "error", message: "Mã báo giá " + maBaoGia + " đã tồn tại trong danh mục." };
        }
      }
    }

    const stt = BG_nextMaBaoGiaCode_(sheet, lastRow);
    sheet.getRange(lastRow + 1, 1, 1, 7).setValues([[stt, maBaoGia, daiLyMa, nguonGocMa, hinhAnh, noiDung, maDLNG]]);
    const _canhBaoHeader = kiemTraLechHeaderSheet_(sheet, "Ma_BaoGia", 7); // BUG-002
    return { status: "success", message: "Đã thêm mã báo giá " + maBaoGia + " vào danh mục." + (_canhBaoHeader ? " | " + _canhBaoHeader : ""), maBaoGia: maBaoGia };
  } catch (e) { return { status: "error", message: e.toString() }; }
  finally { lock.releaseLock(); }
}

function BG_nextMaBaoGiaCode_(sheet, lastRow) {
  const yy = String(new Date().getFullYear()).slice(-2);
  const prefix = "BG" + yy + "-";
  let maxSeq = 0;
  if (lastRow > 1) {
    const existing = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    existing.forEach(row => {
      const v = String(row[0] || "").trim();
      if (v.indexOf(prefix) === 0) {
        const seq = parseInt(v.substring(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });
  }
  return prefix + String(maxSeq + 1).padStart(3, "0");
}

function BG_deleteMaBaoGia_(maBaoGia) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); } catch (e) {
    return { status: "error", message: "Hệ thống đang bận, vui lòng thử lại." };
  }
  try {
    const sheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.MA_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { status: "error", message: "Danh mục trống." };
    const data = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); // Cột B
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0] || "").trim() === String(maBaoGia || "").trim()) {
        sheet.deleteRow(i + 2);
        return { status: "success", message: "Đã xóa mã báo giá " + maBaoGia + " khỏi danh mục." };
      }
    }
    return { status: "error", message: "Không tìm thấy mã báo giá " + maBaoGia };
  } catch (e) { return { status: "error", message: e.toString() }; }
  finally { lock.releaseLock(); }
}

/* ---------- 5.2 Danh mục mã khối lượng (Ma_KL) ---------- */
function BG_getMaKLList_() {
  try {
    const sheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.MAKL_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { status: "success", data: [] };
    const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    const result = data
      .map(r => ({
        timestamp: (r[0] instanceof Date) ? dinhDangGMT7_(r[0], "dd/MM/yyyy HH:mm") : "",
        maKL: r[1], klMinKg: parseFloat(r[2]) || 0, klMaxKg: parseFloat(r[3]) || 0
      }))
      .filter(r => String(r.maKL || "").trim() !== "");
    return { status: "success", data: result };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// fields: {klMinTan, klMaxTan} - nhập theo đơn vị TẤN cho thân thiện
function BG_addMaKL_(fields) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); } catch (e) {
    return { status: "error", message: "Hệ thống đang bận, vui lòng thử lại." };
  }
  try {
    const klMinTan = parseFloat(fields.klMinTan);
    const klMaxTan = parseFloat(fields.klMaxTan);
    if (isNaN(klMinTan) || isNaN(klMaxTan) || klMaxTan <= klMinTan || klMinTan < 0) {
      return { status: "error", message: "Khoảng khối lượng không hợp lệ (Max phải lớn hơn Min, Min ≥ 0)." };
    }
    // Mã khối lượng ghép trực tiếp theo đơn vị TẤN (vd "0_45"), khớp đúng cách
    // BG_coreLogicProcessor_ tách chuỗi mã (split "_") để tính KL_MIN/KL_MAX khi
    // xác định hiệu lực báo giá — không được đổi quy ước này.
    const maKL = String(klMinTan) + "_" + String(klMaxTan);
    const sheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.MAKL_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const existing = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      for (let row of existing) {
        if (String(row[0] || "").trim() === maKL) {
          return { status: "error", message: "Mã khối lượng " + maKL + " đã tồn tại." };
        }
      }
    }
    // Lưu KL_Min/KL_Max theo đúng quy ước hiện có trong sheet Ma_KL: đơn vị Kg
    sheet.getRange(lastRow + 1, 1, 1, 4).setValues([[new Date(), maKL, klMinTan * 1000, klMaxTan * 1000]]);
    const _canhBaoHeader = kiemTraLechHeaderSheet_(sheet, "Ma_KL", 4); // BUG-002
    // FIX H-01 (cảnh báo, không chặn): dải mới chồng lên dải KL đã có trong danh mục.
    const chong = [];
    if (lastRow > 1) {
      sheet.getRange(2, 2, lastRow - 1, 1).getValues().forEach(function (row) {
        const p = String(row[0] || "").trim().split("_");
        const a = parseFloat(p[0]), b = parseFloat(p[1]);
        if (!isNaN(a) && !isNaN(b) && a < klMaxTan && klMinTan < b) chong.push(String(row[0]).trim());
      });
    }
    const _canhBaoChong = chong.length ? "⚠️ CẢNH BÁO: dải " + maKL + " chồng lên dải đã có (" + chong.join(", ") + ") - nếu cùng 1 Mã ĐG dùng cả 2 dải, phiếu cân sẽ tính theo báo giá có hiệu lực MUỘN NHẤT." : "";
    return { status: "success", message: noiCanhBao_("Đã thêm mã khối lượng " + maKL, [_canhBaoHeader, _canhBaoChong]), maKL: maKL };
  } catch (e) { return { status: "error", message: e.toString() }; }
  finally { lock.releaseLock(); }
}

function BG_deleteMaKL_(maKL) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); } catch (e) {
    return { status: "error", message: "Hệ thống đang bận, vui lòng thử lại." };
  }
  try {
    const sheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.MAKL_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { status: "error", message: "Danh mục trống." };
    const data = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0] || "").trim() === String(maKL || "").trim()) {
        sheet.deleteRow(i + 2);
        return { status: "success", message: "Đã xóa mã khối lượng " + maKL };
      }
    }
    return { status: "error", message: "Không tìm thấy mã khối lượng " + maKL };
  } catch (e) { return { status: "error", message: e.toString() }; }
  finally { lock.releaseLock(); }
}

/* ---------- 5.3 Danh sách phiếu báo giá (QL_BaoGia) — phục vụ Sao chép ---------- */
function BG_getQuoteList_() {
  try {
    const sheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.QL_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { status: "success", data: [] };
    const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    const result = data
      .map(r => ({
        ngayBaoGia: (r[0] instanceof Date) ? dinhDangGMT7_(r[0], "dd/MM/yyyy") : "",
        soBaoGia: r[1],
        hieuLuc: (r[3] instanceof Date) ? dinhDangGMT7_(r[3], "dd/MM/yyyy HH:mm") : "",
        idTam: r[4] || ""
      }))
      .filter(r => String(r.soBaoGia || "").trim() !== "");
    result.sort((a, b) => (a.soBaoGia < b.soBaoGia ? 1 : -1));
    return { status: "success", data: result };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Lấy các "nhóm giá" của 1 phiếu báo giá cũ để làm dữ liệu mồi cho chức năng SAO CHÉP
function BG_getQuoteDetail_(soBaoGia) {
  try {
    const sheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.SRC_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { status: "success", data: [] };
    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    const groups = data
      .filter(r => String(r[7] || "").trim() === String(soBaoGia || "").trim())
      .map(r => ({
        maList: String(r[2] || "").split(",").map(s => s.trim()).filter(Boolean),
        klCode: String(r[3] || "").trim(),
        gia: parseFloat(r[4]) || 0
      }));
    return { status: "success", data: groups };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

/* ---------- 5.3B Sửa / Xóa báo giá (chỉ cho phép khi CHƯA có phiếu cân áp dụng VÀ CHƯA hết hiệu lực) ---------- */

// Đọc PhieuCan_DN 1 lần, gom theo Mã ĐG -> danh sách timestamp Ngày cân 1, dùng
// chung cho cả kiểm tra 1 dòng (BG_checkRowEditable_) lẫn tính hàng loạt cho cả
// bảng (BG_annotateApplied_) - tránh phải đọc lại PhieuCan_DN nhiều lần.
// QUAN TRỌNG (an toàn khi có Lưu trữ theo năm - PHẦN 1C): hàm này quyết định 1
// mã báo giá đã TỪNG được dùng để tính tiền cho phiếu cân nào hay chưa, để
// khóa Sửa/Xóa - phải quét TOÀN BỘ lịch sử (kể cả các năm ĐÃ chốt sổ/lưu trữ),
// KHÔNG được giới hạn theo khoảng ngày như các hàm báo cáo khác. Nếu bỏ sót dữ
// liệu đã lưu trữ ở đây, 1 mã giá cũ đã dùng thật (nhưng nằm ở năm đã archive)
// có thể bị tưởng nhầm "chưa dùng" và cho phép sửa/xóa, làm sai lệch số liệu
// lịch sử đã tính tiền - do đó gọi LT_docPhieuCanGopLuuTru_(null, null, ...)
// (không truyền khoảng ngày) để luôn gộp TẤT CẢ các năm đã lưu trữ.
// PERF-BG-01: chỉ đọc 2 cột cần dùng (B Ngày cân 1, Q Mã ĐG) thay vì 17 cột A..Q,
// và khi biết mốc hiệu lực sớm nhất cần xét (tuTS) thì chỉ mở các sheet lưu trữ
// từ năm đó trở đi (lùi thêm 1 ngày cho an toàn ranh giới năm) - phiếu cân năm Y
// chỉ có thể nằm ở PhieuCan_DN hoặc PhieuCan_DN_Y (khóa sổ theo năm cân), nên
// năm cũ hơn không thể "áp dụng" 1 báo giá hiệu lực từ tuTS. Không truyền tuTS
// = quét TOÀN BỘ lịch sử như trước. Danh sách mốc thời gian mỗi mã được SẮP XẾP
// để BG_daApDung_ tìm nhị phân.
function BG_getPhieuCanByMaDG_(tuTS) {
  const byMa = {};
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const dsSheet = [ss.getSheetByName(CONFIG.DATA_SHEET)];
  const namTu = (typeof tuTS === "number" && isFinite(tuTS))
    ? parseInt(dinhDangGMT7_(new Date(tuTS - 86400000), "yyyy"), 10) : -Infinity;
  LT_layDanhSachNamDaLuuTru_(ss).forEach(function (nam) {
    if (nam >= namTu) dsSheet.push(ss.getSheetByName(LT_tenSheetLuuTru_(nam)));
  });
  dsSheet.forEach(function (sh) {
    const lastRow = sh ? sh.getLastRow() : 0;
    if (lastRow <= 1) return;
    const cotB = sh.getRange(2, 2, lastRow - 1, 1).getValues();
    const cotQ = sh.getRange(2, 17, lastRow - 1, 1).getValues();
    for (let i = 0; i < cotB.length; i++) {
      const ngayCan1 = cotB[i][0];
      const ma = String(cotQ[i][0] || "").trim();
      if (!ma || !(ngayCan1 instanceof Date) || isNaN(ngayCan1.getTime())) continue;
      (byMa[ma] || (byMa[ma] = [])).push(ngayCan1.getTime());
    }
  });
  for (const ma in byMa) byMa[ma].sort(function (x, y) { return x - y; });
  return byMa;
}

// Có phiếu cân nào dùng mã "ma" với Ngày cân 1 trong [tuTS, denTS) không - cùng quy
// ước ranh giới _tsTrongKhoangHieuLuc_. Tìm nhị phân trên danh sách đã sắp xếp.
function BG_daApDung_(byMa, ma, tuTS, denTS) {
  const ds = byMa[ma];
  if (!ds || !ds.length) return false;
  let lo = 0, hi = ds.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (ds[mid] < tuTS) lo = mid + 1; else hi = mid; }
  return lo < ds.length && _tsTrongKhoangHieuLuc_(ds[lo], tuTS, denTS);
}

// Kiểm tra 1 nhóm giá (idBgct, gồm các mã trong maList) có được phép Sửa/Xóa không.
// KHÔNG cho phép nếu: (a) bất kỳ mã nào trong nhóm đã "Hết hiệu lực" (bảo toàn lịch sử),
// HOẶC (b) bất kỳ mã nào trong nhóm đã có phiếu cân dùng đúng mã đó trong đúng
// khoảng thời gian hiệu lực tương ứng (bảo toàn tính đúng đắn của số liệu đã tính tiền).
// Đây là hàm KIỂM TRA CUỐI CÙNG ngay trước khi ghi (defense in depth) - luôn đọc
// dữ liệu MỚI NHẤT tại thời điểm gọi, không phụ thuộc dữ liệu đã tải sẵn ở client.
function BG_checkRowEditable_(idBgct, maList) {
  const kq = BG_kiemTraSuaXoaNhieuNhom_([{ idBgct: idBgct, maList: maList }]);
  return { editable: kq.editable, reason: kq.reason };
}

// PERF-BG-02: kiểm tra NHIỀU nhóm giá cùng lúc - chạy BG_coreLogicProcessor_ và đọc
// phiếu cân đúng 1 lần cho cả danh sách (trước đây mỗi nhóm đọc lại toàn bộ phiếu
// cân: xóa 1 phiếu báo giá 10 nhóm = 10 lần quét). Quy tắc và thứ tự báo lỗi giữ
// nguyên như kiểm tra từng nhóm: theo thứ tự nhóm, trong mỗi nhóm xét "Hết hiệu lực"
// trước rồi mới tới "đã có phiếu cân áp dụng". Trả thêm viTri = chỉ số nhóm lỗi.
function BG_kiemTraSuaXoaNhieuNhom_(dsNhom) {
  const result = BG_coreLogicProcessor_(new Set());
  const cacNhom = dsNhom.map(function (n) {
    const id = String(n.idBgct || "").trim(); // FIX: chuẩn hóa để so khớp đúng dù caller có lỡ không trim
    const maList = n.maList || [];
    // Dùng finalRows (có Date object thật) thay vì displayData (chuỗi đã format) để so khớp chính xác
    return result.finalRows.filter(function (row) { return String(row[0] || "").trim() === id && maList.indexOf(row[3]) !== -1; });
  });
  let byMa = null;
  for (let k = 0; k < cacNhom.length; k++) {
    const relevantRows = cacNhom[k];
    for (const row of relevantRows) {
      if (row[13] === "Hết hiệu lực") {
        return { editable: false, viTri: k, reason: "Mã \"" + row[3] + "\" đã HẾT HIỆU LỰC — không thể sửa/xóa để bảo toàn lịch sử báo giá." };
      }
    }
    if (relevantRows.length === 0) continue;
    if (!byMa) {
      // Đọc phiếu cân 1 lần, từ mốc hiệu lực sớm nhất của mọi nhóm cần xét.
      let tuSomNhat = Infinity;
      cacNhom.forEach(function (rows) { rows.forEach(function (r) { tuSomNhat = Math.min(tuSomNhat, r[1].getTime()); }); });
      byMa = BG_getPhieuCanByMaDG_(tuSomNhat);
    }
    for (const row of relevantRows) {
      if (BG_daApDung_(byMa, row[3], row[1].getTime(), row[2].getTime())) {
        return { editable: false, viTri: k, reason: "Mã \"" + row[3] + "\" ĐÃ CÓ PHIẾU CÂN ÁP DỤNG trong khoảng hiệu lực này — không thể sửa/xóa để không làm sai lệch số liệu đã tính tiền." };
      }
    }
  }
  return { editable: true, viTri: -1, reason: "" };
}

// Tính hàng loạt "editable/reason/daApDung" cho TOÀN BỘ displayData cùng lúc
// (chỉ đọc PhieuCan_DN 1 lần), dùng để hiển thị NGAY trên bảng Hiệu lực báo giá
// (mờ/khóa nút Sửa-Xóa cho các dòng không đủ điều kiện) thay vì phải bấm thử mới biết.
function BG_annotateApplied_(finalRows, displayData) {
  let tuSomNhat = Infinity;
  finalRows.forEach(function (r) { tuSomNhat = Math.min(tuSomNhat, r[1].getTime()); });
  const byMa = displayData.length ? BG_getPhieuCanByMaDG_(tuSomNhat) : {};
  return displayData.map((d, idx) => {
    const finalRow = finalRows[idx]; // finalRows và displayData luôn cùng thứ tự (push song song trong BG_coreLogicProcessor_)
    const tuTS = finalRow[1].getTime();
    const denTS = finalRow[2].getTime();
    const daApDung = BG_daApDung_(byMa, d.ma, tuTS, denTS);
    const hetHieuLuc = d.trangThai === "Hết hiệu lực";
    let reason = "";
    if (hetHieuLuc) reason = "Đã hết hiệu lực, không thể sửa/xóa.";
    else if (daApDung) reason = "Đã có phiếu cân áp dụng, không thể sửa/xóa.";
    const out = {};
    for (const k in d) out[k] = d[k];
    out.editable = !hetHieuLuc && !daApDung;
    out.daApDung = daApDung;
    out.reason = reason;
    return out;
  });
}

// Lấy chi tiết 1 dòng báo giá theo ID_BGCT (mã băm), kèm trạng thái có được sửa/xóa hay không
function BG_getBaogiaRowByHash_(idBgct) {
  try {
    const sheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.SRC_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { status: "error", message: "Không có dữ liệu báo giá." };
    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    let found = null;
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][6] || "").trim() === String(idBgct || "").trim()) { found = data[i]; break; }
    }
    if (!found) return { status: "error", message: "Không tìm thấy báo giá " + idBgct };

    const maList = String(found[2] || "").split(",").map(s => s.trim()).filter(Boolean);
    const klCode = String(found[3] || "").trim();
    const gia = parseFloat(found[4]) || 0;
    const hieuLuc = found[1];
    const editCheck = BG_checkRowEditable_(idBgct, maList);

    return {
      status: "success",
      idBgct: idBgct,
      maList: maList,
      klCode: klCode,
      gia: gia,
      hieuLuc: (hieuLuc instanceof Date) ? dinhDangGMT7_(hieuLuc, "yyyy-MM-dd'T'HH:mm") : "",
      soBaoGia: String(found[7] || "").trim(),
      editable: editCheck.editable,
      reason: editCheck.reason
    };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// payload = { idBgct, maList:[...], klCode, gia, hieuLuc:'yyyy-MM-ddTHH:mm' }
function BG_updateBaogiaRow_(payload) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); } catch (e) {
    return { status: "error", message: "Hệ thống đang bận, vui lòng thử lại." };
  }
  try {
    const idBgct = String(payload.idBgct || "").trim();
    const maList = (payload.maList || []).map(s => String(s).trim()).filter(Boolean);
    const klCode = String(payload.klCode || "").trim();
    const gia = parseFloat(payload.gia);
    if (!idBgct) return { status: "error", message: "Thiếu mã định danh dòng báo giá." };
    if (maList.length === 0) return { status: "error", message: "Vui lòng chọn ít nhất 1 mã báo giá." };
    if (!klCode) return { status: "error", message: "Vui lòng chọn mã khối lượng." };
    if (isNaN(gia) || gia <= 0) return { status: "error", message: "Đơn giá phải lớn hơn 0." };
    if (!payload.hieuLuc) return { status: "error", message: "Vui lòng chọn thời điểm hiệu lực." };
    const hieuLucDate = new Date(payload.hieuLuc + ":00+07:00");
    if (isNaN(hieuLucDate.getTime())) return { status: "error", message: "Thời điểm hiệu lực không hợp lệ." };

    const sheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.SRC_SHEET);
    const lastRow = sheet.getLastRow();
    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    let rowIndex = -1; let oldMaList = [];
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][6] || "").trim() === idBgct) { rowIndex = i; oldMaList = String(data[i][2] || "").split(",").map(s => s.trim()).filter(Boolean); break; }
    }
    if (rowIndex === -1) return { status: "error", message: "Không tìm thấy báo giá " + idBgct + " (có thể đã bị người khác xóa)." };

    // Kiểm tra lại NGAY TRƯỚC KHI GHI (phòng trường hợp có phiếu cân mới phát sinh
    // giữa lúc mở form sửa và lúc bấm Lưu) — kiểm tra cả danh sách mã CŨ lẫn MỚI
    const checkOld = BG_checkRowEditable_(idBgct, oldMaList);
    if (!checkOld.editable) return { status: "error", message: "Không thể sửa: " + checkOld.reason };
    // Kiểm tra cả SAU KHI SỬA: mã thêm mới, dời ngày hiệu lực sớm hơn, đổi mã khối
    // lượng... có thể làm dòng này "phủ" lên phiếu cân đang dùng báo giá khác -> chặn.
    const checkMoi = BG_kiemTraSauKhiSua_(sheet, rowIndex, idBgct, [hieuLucDate, maList.join(" , "), klCode, gia]);
    if (!checkMoi.editable) return { status: "error", message: "Không thể sửa: " + checkMoi.reason };

    const sheetRow = rowIndex + 2;
    // TỐI ƯU: gộp 4 lệnh setValue riêng lẻ (cột B/C/D/E liền nhau, cùng 1 dòng)
    // thành 1 lệnh setValues() duy nhất - giảm 4 lượt gọi Sheets API xuống 1,
    // không đổi giá trị/kết quả ghi.
    sheet.getRange(sheetRow, 2, 1, 4).setValues([[
      hieuLucDate,             // Cột B - Thời điểm hiệu lực
      maList.join(" , "),      // Cột C - Mã đơn giá
      klCode,                  // Cột D - Khối lượng_Tấn
      gia                      // Cột E - Đơn giá
    ]]);

    const _canhBaoHeader = kiemTraLechHeaderSheet_(sheet, "Baogia_DN", 8); // BUG-002
    return { status: "success", message: BG_lamMoiSaveSauGhi_("Đã cập nhật báo giá " + idBgct + "." + (_canhBaoHeader ? " | " + _canhBaoHeader : ""), [idBgct]) };
  } catch (e) { return { status: "error", message: e.toString() }; }
  finally { lock.releaseLock(); }
}

// Xem trước hiệu lực của dòng idBgct SAU KHI SỬA (giaTriMoi = cột B..E mới) bằng
// BG_coreLogicProcessor_ trên dữ liệu giả lập, rồi đếm phiếu cân (mọi năm, kể cả
// lưu trữ) có Mã ĐG thuộc dòng và Ngày cân 1 trong khoảng hiệu lực MỚI [từ, đến).
// Có phiếu -> không cho sửa (cùng quy tắc "đã có phiếu cân áp dụng" như mã cũ).
function BG_kiemTraSauKhiSua_(sheet, rowIndex, idBgct, giaTriMoi) {
  const srcGiaLap = sheet.getDataRange().getValues();
  const dong = srcGiaLap[rowIndex + 1].slice();
  for (let c = 0; c < 4; c++) dong[1 + c] = giaTriMoi[c];
  srcGiaLap[rowIndex + 1] = dong;
  const cacDong = BG_coreLogicProcessor_(new Set(), srcGiaLap).finalRows
    .filter(function (r) { return String(r[0] || "").trim() === idBgct; });
  if (!cacDong.length) return { editable: true, reason: "" };
  let tuSomNhat = Infinity;
  cacDong.forEach(function (r) { tuSomNhat = Math.min(tuSomNhat, r[1].getTime()); });
  const byMa = BG_getPhieuCanByMaDG_(tuSomNhat);
  const canDuoi = function (ds, x) { let lo = 0, hi = ds.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ds[m] < x) lo = m + 1; else hi = m; } return lo; };
  const ngay = function (ts) { return dinhDangGMT7_(new Date(ts), "dd/MM/yyyy"); };
  for (const r of cacDong) {
    const ds = byMa[r[3]] || [];
    const tu = canDuoi(ds, r[1].getTime()), den = canDuoi(ds, r[2].getTime());
    if (den > tu) {
      return {
        editable: false,
        reason: "sau khi sửa, mã \"" + r[3] + "\" (hiệu lực từ " + ngay(r[1].getTime()) + ") sẽ áp dụng cho " + (den - tu)
          + " phiếu cân đã có (ngày cân " + ngay(ds[tu]) + (den - tu > 1 ? " – " + ngay(ds[den - 1]) : "")
          + ") đang tính theo báo giá khác. Không cho sửa để không làm thay đổi giá các phiếu đó - hãy lập báo giá mới với ngày hiệu lực sau các phiếu này."
      };
    }
  }
  return { editable: true, reason: "" };
}

function BG_deleteBaogiaRow_(idBgct) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); } catch (e) {
    return { status: "error", message: "Hệ thống đang bận, vui lòng thử lại." };
  }
  try {
    idBgct = String(idBgct || "").trim();
    const sheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.SRC_SHEET);
    const lastRow = sheet.getLastRow();
    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    let rowIndex = -1; let maList = [];
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][6] || "").trim() === idBgct) { rowIndex = i; maList = String(data[i][2] || "").split(",").map(s => s.trim()).filter(Boolean); break; }
    }
    if (rowIndex === -1) return { status: "error", message: "Không tìm thấy báo giá " + idBgct + " (có thể đã bị xóa trước đó)." };

    const editCheck = BG_checkRowEditable_(idBgct, maList);
    if (!editCheck.editable) return { status: "error", message: "Không thể xóa: " + editCheck.reason };

    sheet.deleteRow(rowIndex + 2);
    return { status: "success", message: BG_lamMoiSaveSauGhi_("Đã xóa báo giá " + idBgct + ".") };
  } catch (e) { return { status: "error", message: e.toString() }; }
  finally { lock.releaseLock(); }
}

/* ---------- 5.3C Xóa TOÀN BỘ 1 phiếu báo giá (QL_BaoGia + mọi nhóm giá liên quan) ---------- */

// Kiểm tra 1 PHIẾU BÁO GIÁ (soBaoGia) có được xóa TOÀN BỘ hay không: chỉ cho phép
// khi TẤT CẢ nhóm giá (dòng Baogia_DN) thuộc phiếu này đều editable (chưa hết
// hiệu lực và chưa có phiếu cân áp dụng) - dùng lại đúng quy tắc như xóa từng dòng.
function BG_checkQuoteDeletable_(soBaoGia) {
  soBaoGia = String(soBaoGia || "").trim();
  const sheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.SRC_SHEET);
  const lastRow = sheet.getLastRow();
  const rows = [];
  if (lastRow > 1) {
    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    data.forEach(r => {
      if (String(r[7] || "").trim() === soBaoGia) {
        rows.push({ idBgct: String(r[6] || "").trim(), maList: String(r[2] || "").split(",").map(s => s.trim()).filter(Boolean) });
      }
    });
  }
  if (rows.length === 0) return { deletable: false, reason: "Không tìm thấy nhóm giá nào thuộc báo giá này (có thể đã bị xóa).", rows: rows };

  const check = BG_kiemTraSuaXoaNhieuNhom_(rows);
  if (!check.editable) {
    return { deletable: false, reason: "Nhóm mã \"" + rows[check.viTri].maList.join(", ") + "\": " + check.reason, rows: rows };
  }
  return { deletable: true, reason: "", rows: rows };
}

// Trả danh sách TOÀN BỘ phiếu báo giá (đầu phiếu QL_BaoGia) kèm số nhóm giá và
// trạng thái có được xóa cả phiếu hay không - phục vụ bảng "Danh sách báo giá đã lập".
function BG_getQuoteListWithStatus_() {
  try {
    const sheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.QL_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { status: "success", data: [] };
    const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

    const srcSheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.SRC_SHEET);
    const lastRowSrc = srcSheet.getLastRow();
    const srcData = lastRowSrc > 1 ? srcSheet.getRange(2, 1, lastRowSrc - 1, 8).getValues() : [];

    // Gom nhóm giá theo Số báo giá 1 lần, tránh quét lại Baogia_DN cho từng phiếu
    const bySoBaoGia = {};
    srcData.forEach(r => {
      const so = String(r[7] || "").trim();
      if (!so) return;
      if (!bySoBaoGia[so]) bySoBaoGia[so] = [];
      bySoBaoGia[so].push({ idBgct: String(r[6] || "").trim(), maList: String(r[2] || "").split(",").map(s => s.trim()).filter(Boolean) });
    });

    // Tính sẵn trạng thái hiệu lực + đã áp dụng cho TẤT CẢ (id, mã) chỉ 1 lần.
    // PERF-BG-01: dòng "Hết hiệu lực" không cần xét phiếu cân -> chỉ đọc phiếu cân
    // từ mốc hiệu lực sớm nhất của các dòng CHƯA hết hiệu lực.
    const coreResult = BG_coreLogicProcessor_(new Set());
    const statusMap = {}; // key = idBgct + "|" + ma -> {trangThai, tuTS, denTS}
    let tuSomNhat = Infinity;
    coreResult.finalRows.forEach(row => {
      statusMap[row[0] + "|" + row[3]] = { trangThai: row[13], tuTS: row[1].getTime(), denTS: row[2].getTime() };
      if (row[13] !== "Hết hiệu lực") tuSomNhat = Math.min(tuSomNhat, row[1].getTime());
    });
    const byMa = tuSomNhat < Infinity ? BG_getPhieuCanByMaDG_(tuSomNhat) : {};

    const result = data.map(r => {
      const soBaoGia = String(r[1] || "").trim();
      const groups = bySoBaoGia[soBaoGia] || [];
      let deletable = groups.length > 0;
      let reason = groups.length === 0 ? "Không tìm thấy nhóm giá thuộc phiếu này." : "";
      outer:
      for (const g of groups) {
        for (const ma of g.maList) {
          const st = statusMap[g.idBgct + "|" + ma];
          if (!st) continue;
          if (st.trangThai === "Hết hiệu lực") { deletable = false; reason = "Mã \"" + ma + "\" đã hết hiệu lực."; break outer; }
          // FIX: dùng chung quy ước ranh giới [tuTS, denTS) với kiểm tra xóa thật
          // (trước đây "<= denTS" - lệch với BG_checkRowEditable_ ở đúng mốc kết thúc).
          const daApDung = BG_daApDung_(byMa, ma, st.tuTS, st.denTS);
          if (daApDung) { deletable = false; reason = "Mã \"" + ma + "\" đã có phiếu cân áp dụng."; break outer; }
        }
      }
      return {
        soBaoGia: soBaoGia,
        ngayBaoGia: (r[0] instanceof Date) ? dinhDangGMT7_(r[0], "dd/MM/yyyy") : "",
        hieuLuc: (r[3] instanceof Date) ? dinhDangGMT7_(r[3], "dd/MM/yyyy HH:mm") : "",
        idTam: r[4] || "",
        soNhom: groups.length,
        deletable: deletable,
        reason: reason
      };
    }).filter(r => r.soBaoGia !== "");

    result.sort((a, b) => (a.soBaoGia < b.soBaoGia ? 1 : -1));
    return { status: "success", data: result };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Xóa TOÀN BỘ 1 phiếu báo giá: xóa hết các dòng nhóm giá thuộc phiếu trong
// Baogia_DN, VÀ xóa luôn dòng đầu phiếu trong QL_BaoGia. Chỉ cho phép khi
// TẤT CẢ nhóm giá thuộc phiếu đều editable (BG_checkQuoteDeletable_) - kiểm
// tra lại ngay trước khi xóa (defense in depth), không tin dữ liệu đã tải sẵn ở client.
function BG_deleteQuote_(soBaoGia) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); } catch (e) {
    return { status: "error", message: "Hệ thống đang bận, vui lòng thử lại." };
  }
  try {
    soBaoGia = String(soBaoGia || "").trim();
    if (!soBaoGia) return { status: "error", message: "Thiếu số báo giá cần xóa." };

    const check = BG_checkQuoteDeletable_(soBaoGia);
    if (!check.deletable) return { status: "error", message: "Không thể xóa báo giá " + soBaoGia + ": " + check.reason };

    const srcSheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.SRC_SHEET);
    const lastRowSrc = srcSheet.getLastRow();
    let soDongXoa = 0;
    if (lastRowSrc > 1) {
      const data = srcSheet.getRange(2, 1, lastRowSrc - 1, 8).getValues();
      const dsDong = [];
      data.forEach(function (r, i) { if (String(r[7] || "").trim() === soBaoGia) dsDong.push(i + 2); });
      soDongXoa = xoaCacDong_(srcSheet, dsDong);
    }

    const qlSheet = BG_ss_().getSheetByName(BAOGIA_CONFIG.QL_SHEET);
    const lastRowQL = qlSheet.getLastRow();
    if (lastRowQL > 1) {
      const dataQL = qlSheet.getRange(2, 1, lastRowQL - 1, 5).getValues();
      const dsDongQL = [];
      dataQL.forEach(function (r, i) { if (String(r[1] || "").trim() === soBaoGia) dsDongQL.push(i + 2); });
      xoaCacDong_(qlSheet, dsDongQL);
    }

    return { status: "success", message: BG_lamMoiSaveSauGhi_("Đã xóa toàn bộ báo giá " + soBaoGia + " (" + soDongXoa + " nhóm giá).") };
  } catch (e) { return { status: "error", message: e.toString() }; }
  finally { lock.releaseLock(); }
}

/* ---------- 5.4 Tạo phiếu báo giá mới (Nhập mới / Sao chép / Tách nhóm) ---------- */
// Ghi chú: "Tách báo giá" xử lý hoàn toàn ở phía giao diện (client tách 1 nhóm
// nhiều mã thành nhiều nhóm 1 mã trước khi gửi) - không cần hàm backend riêng.
// payload = { ngayBaoGia:'yyyy-MM-dd', hieuLuc:'yyyy-MM-ddTHH:mm', idTam:'', groups:[{maList:[...], klCode, gia}] }
function BG_createQuote_(payload) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); } catch (e) {
    return { status: "error", message: "Hệ thống đang bận xử lý một yêu cầu khác, vui lòng thử lại sau ít giây." };
  }
  try {
    if (!payload || !payload.ngayBaoGia) return { status: "error", message: "Vui lòng chọn ngày báo giá." };
    if (!payload.hieuLuc) return { status: "error", message: "Vui lòng chọn thời điểm hiệu lực." };
    const groups = (payload.groups || []).filter(g => g.maList && g.maList.length > 0 && g.klCode && parseFloat(g.gia) > 0);
    if (groups.length === 0) return { status: "error", message: "Vui lòng thêm ít nhất 1 nhóm giá hợp lệ (có mã báo giá, mã khối lượng và đơn giá > 0)." };

    const ngayBaoGiaDate = new Date(payload.ngayBaoGia + "T00:00:00+07:00");
    const hieuLucDate = new Date(payload.hieuLuc + ":00+07:00");
    if (isNaN(ngayBaoGiaDate.getTime()) || isNaN(hieuLucDate.getTime())) {
      return { status: "error", message: "Ngày báo giá hoặc thời điểm hiệu lực không hợp lệ." };
    }

    const ss = BG_ss_();
    const qlSheet = ss.getSheetByName(BAOGIA_CONFIG.QL_SHEET);
    const srcSheet = ss.getSheetByName(BAOGIA_CONFIG.SRC_SHEET);

    // Sinh Số báo giá dạng YYYYMMDD-NNN, NNN tăng dần riêng theo từng ngày
    const datePrefix = dinhDangGMT7_(ngayBaoGiaDate, "yyyyMMdd");
    const qlLastRow = qlSheet.getLastRow();
    let maxSeq = 0;
    if (qlLastRow > 1) {
      const existingSo = qlSheet.getRange(2, 2, qlLastRow - 1, 1).getValues();
      existingSo.forEach(row => {
        const v = String(row[0] || "").trim();
        if (v.indexOf(datePrefix + "-") === 0) {
          const seq = parseInt(v.substring(datePrefix.length + 1), 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      });
    }
    const soBaoGiaMoi = datePrefix + "-" + String(maxSeq + 1).padStart(3, "0");
    const now = new Date();
    let userEmail = "";
    userEmail = layThongTinNguoiDungHienTai_().email || "";

    qlSheet.getRange(qlLastRow + 1, 1, 1, 5).setValues([[ngayBaoGiaDate, soBaoGiaMoi, now, hieuLucDate, payload.idTam || ""]]);

    const rowsToAppend = groups.map(g => {
      const hash = Utilities.getUuid().replace(/-/g, "").substring(0, 8);
      return [now, hieuLucDate, g.maList.join(" , "), g.klCode, parseFloat(g.gia), userEmail, hash, soBaoGiaMoi];
    });
    srcSheet.getRange(srcSheet.getLastRow() + 1, 1, rowsToAppend.length, 8).setValues(rowsToAppend);

    const _canhBaoHeader = [kiemTraLechHeaderSheet_(qlSheet, "QL_BaoGia", 5), kiemTraLechHeaderSheet_(srcSheet, "Baogia_DN", 8)]; // BUG-002
    return { status: "success", message: BG_lamMoiSaveSauGhi_(noiCanhBao_("Đã lưu báo giá " + soBaoGiaMoi + " với " + groups.length + " nhóm giá.", _canhBaoHeader), rowsToAppend.map(function (r) { return r[6]; })), soBaoGia: soBaoGiaMoi };
  } catch (e) { return { status: "error", message: e.toString() }; }
  finally { lock.releaseLock(); }
}

/* ---------- 5.5 Xử lý hiệu lực & Xem dữ liệu (port nguyên vẹn từ hệ thống Báo giá gốc) ---------- */
function BG_updateHieuLuc_() {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); } catch (e) {
    return { status: "error", message: "Hệ thống đang bận, vui lòng thử lại." };
  }
  try {
    const ss = BG_ss_();
    const dst = ss.getSheetByName(BAOGIA_CONFIG.DST_SHEET);
    const dstData = dst.getDataRange().getValues();
    const blockedIDs = new Set();
    if (dstData.length > 1) {
      for (let i = 1; i < dstData.length; i++) {
        if (dstData[i][13] === "Hết hiệu lực" && dstData[i][0]) blockedIDs.add(dstData[i][0].toString().trim());
      }
    }
    const result = BG_coreLogicProcessor_(blockedIDs);
    const activeRows = result.finalRows.filter(row => row[13] === "Còn hiệu lực");
    if (dst.getLastRow() > 1) dst.getRange(2, 1, dst.getLastRow() - 1, 14).clearContent();
    if (activeRows.length > 0) dst.getRange(2, 1, activeRows.length, 14).setValues(activeRows);
    // PERF-BG-03: chỉ gắn editable/reason cho các dòng CÒN hiệu lực (đúng những dòng
    // trả về) - lọc finalRows và displayData theo CÙNG chỉ số để giữ khớp vị trí.
    const chiSo = [];
    result.displayData.forEach(function (d, i) { if (d.trangThai === "Còn hiệu lực") chiSo.push(i); });
    const annotated = BG_annotateApplied_(chiSo.map(function (i) { return result.finalRows[i]; }), chiSo.map(function (i) { return result.displayData[i]; }));
    return { status: "success", data: annotated, viewType: "FINAL" };
  } catch (e) { return { status: "error", message: e.toString() }; }
  finally { lock.releaseLock(); }
}

// Dựng lại Baogia_DN_SAVE (toàn bộ lịch sử hiệu lực) từ Baogia_DN - đây là sheet
// ENGINE TÍNH GIÁ đọc (CONFIG.SHEET_BAO_GIA). Gọi trong khóa.
function BG_lamMoiSave_() {
  const save = BG_ss_().getSheetByName(BAOGIA_CONFIG.SAVE_SHEET);
  const result = BG_coreLogicProcessor_(new Set());
  if (save.getLastRow() > 1) save.getRange(2, 1, save.getLastRow() - 1, 14).clearContent();
  if (result.finalRows.length > 0) save.getRange(2, 1, result.finalRows.length, 14).setValues(result.finalRows);
  return result;
}
// FIX (BUG-BG-01 - giá mới không được áp dụng): trước đây Baogia_DN_SAVE CHỈ được
// ghi lại khi có người bấm "Xem toàn bộ lịch sử" - tạo/sửa/xóa báo giá xong, tính
// giá phiếu cân vẫn dùng bảng giá CŨ cho tới lúc đó. Nay mọi thao tác ghi Baogia_DN
// tự làm mới SAVE ngay trong cùng khóa. Lỗi làm mới không làm hỏng thao tác chính,
// chỉ báo kèm để người dùng bấm "Xem toàn bộ lịch sử".
// idsMoi (tùy chọn): ID_BGCT vừa tạo/sửa -> nối thêm cảnh báo chồng dải KL (H-01).
function BG_lamMoiSaveSauGhi_(thongBao, idsMoi) {
  try {
    const result = BG_lamMoiSave_();
    const canhBao = idsMoi && idsMoi.length ? BG_canhBaoChongDai_(result.finalRows, idsMoi) : "";
    return canhBao ? thongBao + " | " + canhBao : thongBao;
  }
  catch (e) { return thongBao + " | ⚠️ Chưa cập nhật được bảng giá dùng để tính giá (" + e.toString() + ") - bấm \"Xem toàn bộ lịch sử\" để cập nhật."; }
}

// FIX H-01 (cảnh báo, KHÔNG chặn lưu): dòng báo giá vừa lưu (idsMoi) có cùng Mã ĐG
// với 1 dòng khác đang/sẽ hiệu lực cùng lúc mà DẢI KL CHỒNG NHAU -> phiếu cân khớp
// cả 2 dòng sẽ được tính theo báo giá có thời điểm hiệu lực MUỘN NHẤT (TG_tinhGiaDong_).
function BG_canhBaoChongDai_(finalRows, idsMoi) {
  const moi = new Set(idsMoi.map(function (x) { return String(x || "").trim(); }));
  const hieuLuc = function (r) { return r[13] !== "Hết hiệu lực" && r[1] instanceof Date && r[2] instanceof Date; };
  const ngay = function (d) { return dinhDangGMT7_(d, "dd/MM/yyyy"); };
  const dsMoi = finalRows.filter(function (r) { return moi.has(String(r[0] || "").trim()) && hieuLuc(r); });
  const cap = []; const daCo = {};
  dsMoi.forEach(function (r) {
    finalRows.forEach(function (o) {
      if (o === r || o[3] !== r[3] || !hieuLuc(o)) return;
      if (String(o[4]) === String(r[4]) && String(o[5]) === String(r[5])) return; // cùng dải = nối tiếp, không chồng
      if (!(o[1].getTime() < r[2].getTime() && r[1].getTime() < o[2].getTime())) return; // không trùng thời gian
      if (!(Number(o[4]) < Number(r[5]) && Number(r[4]) < Number(o[5]))) return;       // dải KL không chồng
      const k = [r[3], r[0], r[4], r[5], o[0], o[4], o[5]].join("|");
      const kNguoc = [r[3], o[0], o[4], o[5], r[0], r[4], r[5]].join("|");
      if (daCo[k] || daCo[kNguoc]) return;
      daCo[k] = true;
      cap.push("mã " + r[3] + ": dải " + r[4] + "_" + r[5] + " tấn (từ " + ngay(r[1]) + ", giá " + Number(r[6]).toLocaleString("vi-VN")
        + ") chồng dải " + o[4] + "_" + o[5] + " tấn (từ " + ngay(o[1]) + ", giá " + Number(o[6]).toLocaleString("vi-VN") + ")");
    });
  });
  if (!cap.length) return "";
  return "⚠️ CẢNH BÁO chồng dải khối lượng - " + cap.slice(0, 5).join("; ") + (cap.length > 5 ? "; và " + (cap.length - 5) + " cặp khác" : "")
    + ". Phiếu cân khớp cả 2 dải sẽ tính theo báo giá có hiệu lực MUỘN NHẤT.";
}

function BG_showAllData_() {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); } catch (e) {
    return { status: "error", message: "Hệ thống đang bận, vui lòng thử lại." };
  }
  try {
    const result = BG_lamMoiSave_();
    const annotated = BG_annotateApplied_(result.finalRows, result.displayData);
    return { status: "success", data: annotated, viewType: "SAVE" };
  } catch (e) { return { status: "error", message: e.toString() }; }
  finally { lock.releaseLock(); }
}

// Giữ NGUYÊN VẸN logic gốc (chỉ đổi tên hàm + trỏ về BAOGIA_CONFIG) để không
// làm thay đổi cách xác định "Còn/Chưa/Hết hiệu lực" đang vận hành thực tế.
// srcDataGiaLap (tùy chọn): dữ liệu Baogia_DN (kèm dòng tiêu đề) dùng THAY cho sheet
// - để xem trước kết quả hiệu lực của 1 thao tác sửa TRƯỚC khi ghi thật.
function BG_coreLogicProcessor_(blockedIDs, srcDataGiaLap) {
  const ss = BG_ss_();
  const srcData = srcDataGiaLap || ss.getSheetByName(BAOGIA_CONFIG.SRC_SHEET).getDataRange().getValues();
  const maData = ss.getSheetByName(BAOGIA_CONFIG.MA_SHEET).getDataRange().getValues();
  const now = new Date();
  const currentTS = now.getTime();
  const maLookup = new Map();

  for (let i = 1; i < maData.length; i++) {
    if (maData[i][1]) maLookup.set(maData[i][1].toString().trim(), maData[i][5]);
  }

  const rawRecords = [];
  for (let i = 1; i < srcData.length; i++) {
    const id_bg = srcData[i][0]?.toString().trim() || "";
    const id_goc = srcData[i][6]?.toString().trim() || "";
    if (blockedIDs.has(id_bg) || blockedIDs.has(id_goc)) continue;

    if (id_goc && srcData[i][1] instanceof Date && srcData[i][2]) {
      srcData[i][2].toString().split(",").forEach(m => {
        let kl = (srcData[i][3] || "0_999999").toString().split("_");
        rawRecords.push({
          id: id_goc, tuNgay: srcData[i][1], ma: m.trim(),
          pE: kl[0] || "0", pF: kl[1] || "999999", gia: srcData[i][4]
        });
      });
    }
  }

  const groups = {};
  rawRecords.forEach(r => {
    let groupKey = r.ma + "_MIN" + r.pE + "_MAX" + r.pF;
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(r);
  });

  const finalRows = [];
  const displayData = [];

  for (let key in groups) {
    const sorted = groups[key].sort((a, b) => a.tuNgay.getTime() - b.tuNgay.getTime());
    for (let j = 0; j < sorted.length; j++) {
      let tN = sorted[j].tuNgay.getTime();
      let dN = (j < sorted.length - 1) ? Math.max(tN, sorted[j + 1].tuNgay.getTime() - 1000) : new Date("2050-12-31").getTime();
      let status = (currentTS >= tN && currentTS <= dN) ? "Còn hiệu lực" : (currentTS < tN ? "Chưa đến hạn" : "Hết hiệu lực");

      const row = [
        sorted[j].id, sorted[j].tuNgay, new Date(dN), sorted[j].ma, sorted[j].pE, sorted[j].pF,
        sorted[j].gia, "", now, "", "", sorted[j].id + "_" + sorted[j].ma,
        maLookup.get(sorted[j].ma) || "", status
      ];

      finalRows.push(row);
      displayData.push({
        id: row[0], ma: row[3], gia: row[6], dienGiai: row[12],
        klMin: row[4], klMax: row[5],
        tuNgay: dinhDangGMT7_(row[1], "dd/MM/yyyy"),
        denNgay: dinhDangGMT7_(row[2], "dd/MM/yyyy"),
        ngayTS: tN, trangThai: status
      });
    }
  }
  return { finalRows, displayData };
}

// Thống kê nhanh đơn giá nhập keo đang CÓ HIỆU LỰC ngay tại thời điểm gọi -
// dùng cho Dashboard. Tính TRỰC TIẾP từ Baogia_DN (nguồn dữ liệu gốc) qua
// BG_coreLogicProcessor_ (đúng logic BG_updateHieuLuc() dùng để xác định
// "Còn hiệu lực"), KHÔNG đọc lại Baogia_DN_FINAL - vì sheet đó chỉ được ghi
// mới mỗi khi có người bấm "Cập nhật hiệu lực" ở tab Báo giá, có thể đang cũ
// nếu lâu rồi chưa ai mở tab đó, trong khi Dashboard cần đúng NGAY LÚC XEM.
// "Khu vực" = trường Nguồn gốc trong danh mục Ma_BaoGia (Đại lý_Nguồn gốc_Hình ảnh).
function BG_layThongKeGiaHieuLuc_() {
  const ss = BG_ss_();
  const maData = ss.getSheetByName(BAOGIA_CONFIG.MA_SHEET).getDataRange().getValues();
  const nguonGocLookup = new Map(); // Mã Báo Giá -> Nguồn gốc
  for (let i = 1; i < maData.length; i++) {
    if (maData[i][1]) nguonGocLookup.set(maData[i][1].toString().trim(), String(maData[i][3] || "").trim());
  }

  const result = BG_coreLogicProcessor_(new Set());
  const dangHieuLuc = result.displayData.filter(function (r) { return r.trangThai === "Còn hiệu lực"; });

  if (dangHieuLuc.length === 0) {
    return { soLuong: 0, giaCaoNhat: 0, giaThapNhat: 0, giaTrungBinh: 0, khuVucGiaCaoNhat: "", khuVucGiaThapNhat: "" };
  }

  let tong = 0, caoNhat = null, thapNhat = null;
  dangHieuLuc.forEach(function (r) {
    const gia = parseFloat(r.gia) || 0;
    tong += gia;
    if (!caoNhat || gia > caoNhat.gia) caoNhat = { gia: gia, ma: r.ma };
    if (!thapNhat || gia < thapNhat.gia) thapNhat = { gia: gia, ma: r.ma };
  });

  return {
    soLuong: dangHieuLuc.length,
    giaCaoNhat: caoNhat.gia,
    giaThapNhat: thapNhat.gia,
    giaTrungBinh: Math.round(tong / dangHieuLuc.length),
    khuVucGiaCaoNhat: nguonGocLookup.get(caoNhat.ma) || "(Không rõ)",
    khuVucGiaThapNhat: nguonGocLookup.get(thapNhat.ma) || "(Không rõ)"
  };
}

function BG_exportFileSmart_(dateStr, currentView, filteredIds) {
  try {
    const ss = BG_ss_();
    const dataSheet = ss.getSheetByName(currentView === "FINAL" ? BAOGIA_CONFIG.DST_SHEET : BAOGIA_CONFIG.SAVE_SHEET);
    const values = dataSheet.getDataRange().getValues().slice(1);
    const filterTS = new Date(dateStr + "T23:59:59+07:00").getTime();

    const filteredRaw = values.filter(r => {
      const rDate = new Date(r[1]).getTime();
      return rDate <= filterTS && filteredIds.includes(r[0].toString());
    });

    if (filteredRaw.length === 0) return { status: "error", message: "Không có dữ liệu phù hợp!" };

    const newSS = SpreadsheetApp.create("Bao_Gia_HAK_" + dateStr);
    const sheet = newSS.getSheets()[0];

    sheet.getRange("A1").setValue(COMPANY_NAME).setFontWeight("bold");
    sheet.getRange("A3:G3").merge().setValue("BẢNG BÁO GIÁ").setFontSize(16).setFontWeight("bold").setHorizontalAlignment("center");
    sheet.getRange("A4:G4").merge().setValue("Ngày xuất: " + dateStr).setHorizontalAlignment("center").setFontStyle("italic");

    const headers = ["STT", "MÃ", "DIỄN GIẢI", "ĐƠN GIÁ", "HIỆU LỰC TỪ", "HIỆU LỰC ĐẾN", "STATUS"];
    sheet.getRange(6, 1, 1, 7).setValues([headers]).setFontWeight("bold").setBackground("#B7B7B7").setHorizontalAlignment("center").setBorder(true, true, true, true, true, true);

    const exportData = filteredRaw.map((r, index) => [index + 1, r[3], r[12], Number(r[6]) || 0, r[1], r[2], r[13]]);
    sheet.getRange(7, 1, exportData.length, 7).setValues(chongCongThucBang_(exportData)).setBorder(true, true, true, true, true, true);

    sheet.getRange(7, 4, exportData.length, 1).setNumberFormat("#,##0");
    sheet.getRange(7, 5, exportData.length, 2).setNumberFormat(REGION_FORMAT_().DATE_FMT);
    sheet.getRange(7, 3, exportData.length, 1).setWrap(true);
    sheet.setColumnWidth(2, 100); sheet.setColumnWidth(3, 300); sheet.setColumnWidth(4, 110);

    SpreadsheetApp.flush();
    const folder = DriveApp.getFolderById(BAOGIA_CONFIG.BACKUP_FOLDER_ID);
    folder.addFile(DriveApp.getFileById(newSS.getId()));
    DriveApp.getRootFolder().removeFile(DriveApp.getFileById(newSS.getId()));

    return { status: "success", url: "https://docs.google.com/spreadsheets/d/" + newSS.getId() + "/export?format=xlsx" };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

/*********************************************************
 * PHẦN 6: QUẢN LÝ TỒN KHO DĂM GỖ (MENU 4)
 * - Spreadsheet RIÊNG: KHODAM_CONFIG.SPREADSHEET_ID (xem Config.gs) - sheet
 *   ĐANG CHẠY THẬT, không dùng chung với PhieuCan_DN hay Báo giá.
 * - Nguồn gốc: sáp nhập từ hệ thống "Hệ Thống Quản Lý Kho Dăm - Hòa Nhơn"
 *   (project Apps Script riêng trước đây), giữ NGUYÊN VẸN toàn bộ logic
 *   nghiệp vụ gốc (Nhập/Xuất kho, Kỳ Vét Bãi, Độ khô, Tồn kho, Đối soát
 *   hoàn thành đơn hàng xuất bán) để không thay đổi hành vi đã được kiểm
 *   chứng bằng dữ liệu thật. Các thay đổi so với bản gốc:
 *   1) SpreadsheetApp.getActiveSpreadsheet() -> openById(KHODAM_CONFIG.SPREADSHEET_ID)
 *      (bắt buộc vì web app hợp nhất không còn "bound" trực tiếp vào sheet này nữa)
 *   2) Tên sheet hard-code -> tham chiếu KHODAM_CONFIG.SHEET_xxx (Config.gs)
 *   3) Timeout khóa 10s -> dùng chung CONFIG.LOCK_TIMEOUT_MS (30s)
 *   4) Thêm ghi log vào sheet Audit qua logAudit_() cho các hành động ghi dữ liệu
 *   5) Bỏ doGet() trùng lặp (đã có doGet() ở đầu Code.gs phục vụ chung cho cả web app)
 *   Hàm sanitize() dùng để tránh CSV/Formula Injection khi ghi text tự do
 *   vào sheet (đã có sẵn từ bản gốc, giữ nguyên).
 *********************************************************/

// ==========================================
// HÀM BẢO MẬT: Chống chèn mã độc (Injection)
// ==========================================
function sanitize_(val) {
  if (typeof val !== 'string') return val;
  var str = val.trim();
  if (/^[=\+\-@]/.test(str)) {
    return "'" + str; 
  }
  return str;
}

function kiemTraVaTaoTieuDeSheets_() {
  var cache = CacheService.getScriptCache();
  if (cache.get('sheets_ready_v5') === '1') return;

  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheetGD = ss.getSheetByName(KHODAM_CONFIG.SHEET_GIAODICH) || ss.insertSheet(KHODAM_CONFIG.SHEET_GIAODICH);
  if (sheetGD.getLastRow() === 0) {
    sheetGD.appendRow(["Mã phiếu", "Thời gian", "Loại", "Hình thức N/X", "Đợt vét bãi", "Kho xuất", "Kho nhập", "Khối lượng ướt (MT)", "Độ khô", "Tỷ lệ tiêu hao", "Khối lượng khô (BDMT)", "Trạng thái", "Mã phiếu gốc", "Diễn giải độ khô"]);
    sheetGD.getRange(1, 1, 1, 14).setFontWeight("bold").setBackground("#006b5a").setFontColor("#ffffff");
  } else if (sheetGD.getLastColumn() < 14) {
    sheetGD.getRange(1, 14).setValue("Diễn giải độ khô").setFontWeight("bold").setBackground("#006b5a").setFontColor("#ffffff");
  }

  var sheetCfg = ss.getSheetByName(KHODAM_CONFIG.SHEET_CAUHINH) || ss.insertSheet(KHODAM_CONFIG.SHEET_CAUHINH);
  if (sheetCfg.getLastRow() === 0) {
    sheetCfg.appendRow(["Loại cấu hình", "Kỳ Vét Bãi", "Khoảng Thời Gian", "Mức Tiêu Hao"]);
    sheetCfg.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#0056b3").setFontColor("#ffffff");
  }

  var sheetDK = ss.getSheetByName(KHODAM_CONFIG.SHEET_NHAPDOKHO) || ss.insertSheet(KHODAM_CONFIG.SHEET_NHAPDOKHO);
  if (sheetDK.getLastRow() === 0) {
    sheetDK.appendRow(["Ngày nhập", "Hình thức", "Độ Khô", "Độ Ấm", "Trạng thái"]);
    sheetDK.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#d9822b").setFontColor("#ffffff");
  } else if (sheetDK.getLastColumn() < 5) {
    sheetDK.getRange(1, 5).setValue("Trạng thái").setFontWeight("bold").setBackground("#d9822b").setFontColor("#ffffff");
  }

  var sheetDM = ss.getSheetByName(KHODAM_CONFIG.SHEET_DANHMUCKHO) || ss.insertSheet(KHODAM_CONFIG.SHEET_DANHMUCKHO);
  if (sheetDM.getLastRow() === 0) {
    sheetDM.appendRow(["Mã kho", "Tên Nhà Máy", "Tên Kho Hàng", "Ngày Khởi Tạo", "Trạng thái"]);
    sheetDM.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#20c997").setFontColor("#ffffff");
  }

  cache.put('sheets_ready_v5', '1', 21600);
}

function taiDanhSachKyVetBaiCache_() {
  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheetCfg = ss.getSheetByName(KHODAM_CONFIG.SHEET_CAUHINH);
  var arrKy = [];
  if (!sheetCfg || sheetCfg.getLastRow() <= 1) return arrKy;
  var data = sheetCfg.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var loaiCfg = String(data[i][0]).trim().toLowerCase();
    if (loaiCfg === "thông số kho" || loaiCfg === "thong so kho") {
      var tenKy = String(data[i][1]).trim();
      var rawTimeStr = String(data[i][2]);
      var parts = rawTimeStr.split(" - ");
      var tieuHaoVal = 0.0315;
      var m = String(data[i][3]).match(/[\d.]+/);
      if (m) tieuHaoVal = parseFloat(m[0]) / 100;

      if (parts.length === 2) {
        var tuStr = parts[0].replace("Từ:", "").replace("Từ", "").trim();
        var denStr = parts[1].replace("Đến:", "").replace("Đến", "").trim();
        var tuTime = new Date(tuStr).setHours(0,0,0,0);
        var denTime = new Date(denStr).setHours(23,59,59,999);

        if (!isNaN(tuTime) && !isNaN(denTime)) {
          arrKy.push({ tenKy: tenKy, tu: tuTime, den: denTime, tieuHao: tieuHaoVal, isLocked: false });
        }
      }
    }
  }

  arrKy.sort(function(a, b) { return a.tu - b.tu; });
  for (var j = 0; j < arrKy.length; j++) arrKy[j].isLocked = (j < arrKy.length - 1);
  return arrKy;
}

// FIX H-03: ngày chuyển kỳ thuộc CẢ kỳ cũ (đã khóa, "Đến" làm tròn 23:59) lẫn kỳ
// mới (mở, "Từ" làm tròn 00:00) - trước đây duyệt từ kỳ cũ nhất nên ngày đó bị
// khóa nhầm. Duyệt từ kỳ MỚI NHẤT, khớp cách layThongSoVaTieuHaoCache_ chọn kỳ.
function kiemTraKhoaKyVetBaiPure_(ngayTime, arrKyCache) {
  var t = new Date(ngayTime).setHours(0,0,0,0);
  for (var i = arrKyCache.length - 1; i >= 0; i--) {
    if (t >= arrKyCache[i].tu && t <= arrKyCache[i].den) return arrKyCache[i].isLocked;
  }
  return false;
}

function layThongSoVaTieuHaoCache_(ngay, arrKyCache) {
  var t = new Date(ngay).setHours(0,0,0,0);
  var kq = { dotVetBai: "Mặc định", tieuHao: 0.0315 };

  var matchedKys = [];
  for (var i = 0; i < arrKyCache.length; i++) {
    if (t >= arrKyCache[i].tu && t <= arrKyCache[i].den) matchedKys.push(arrKyCache[i]);
  }

  if (matchedKys.length > 0) {
    matchedKys.sort(function(a, b) { return b.tu - a.tu; });
    kq.dotVetBai = matchedKys[0].tenKy;
    kq.tieuHao = matchedKys[0].tieuHao;
    return kq;
  }

  if (arrKyCache.length > 0) {
    var latestKy = arrKyCache[arrKyCache.length - 1];
    kq.dotVetBai = latestKy.tenKy;
    kq.tieuHao = latestKy.tieuHao;
  }
  return kq;
}

function chuanHoaNgay_(val) {
  if (!val) return "";
  if (val instanceof Date) return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  if (typeof val === 'number') {
    var d = new Date((val - (25567 + 2)) * 86400 * 1000);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  var s = String(val).trim();
  var parts = s.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return parts[0] + "-" + parts[1].padStart(2, '0') + "-" + parts[2].padStart(2, '0');
    else {
      var p1 = parseInt(parts[0], 10), p2 = parseInt(parts[1], 10), p3 = parts[2].length === 2 ? "20" + parts[2] : parts[2];
      if (p1 > 12) return p3 + "-" + String(p2).padStart(2, '0') + "-" + String(p1).padStart(2, '0');
      else return p3 + "-" + String(p1).padStart(2, '0') + "-" + String(p2).padStart(2, '0');
    }
  }
  return s;
}

// ==========================================
// HẰNG SỐ & TIỆN ÍCH DÙNG CHUNG: mặc định khoảng thời gian 3 tháng gần nhất + phân trang 20/lần
// ==========================================
var KICH_THUOC_TRANG = 20;

/** Mốc thời gian (ms, 00:00:00) của đúng ngày này 3 tháng trước — dùng làm mặc định "Từ ngày" khi tải danh sách. */
function layThoiDiem3ThangTruoc_() {
  var d = new Date();
  d.setMonth(d.getMonth() - 3);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Chuỗi "yyyy-MM-dd" của đúng ngày này 3 tháng trước — dùng làm giá trị mặc định hiển thị trên input date. */
function layNgay3ThangTruocStr_() {
  var d = new Date();
  d.setMonth(d.getMonth() - 3);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function tinhDoKhoTrungBinhTheoKho_(khoName, ngay) {
  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheetGD = ss.getSheetByName(KHODAM_CONFIG.SHEET_GIAODICH);
  if (!sheetGD || sheetGD.getLastRow() <= 1) return 0.45;
  var data = sheetGD.getDataRange().getValues();
  var dtCheck = new Date(ngay);
  var m = dtCheck.getMonth(), y = dtCheck.getFullYear();
  var tTuoi = 0, tKho = 0, count = 0;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][11]).trim() === "Đã hủy") continue;
    var dt = new Date(data[i][1]);
    var kN = String(data[i][6]).trim();
    if (data[i][2] === "NHẬP" && kN === khoName && dt.getMonth() === m && dt.getFullYear() === y) {
      var uot = parseFloat(data[i][7]) || 0;
      var kho = parseFloat(data[i][10]) || 0;
      if (uot > 0 && kho > 0) {
        tTuoi += uot; tKho += kho; count++;
      }
    }
  }
  return (tTuoi > 0 && tKho > 0) ? (tKho / tTuoi) : 0.45;
}

function xuLyXacDinhDoKho_(loaiPhieu, hinhThuc, khoLienQuan, ngay, doKhoInput, optionChon) {
  // FIX #8: trước đây điều kiện "val > 0" khiến độ khô=0 bị coi giống hệt "để
  // trống", nên luôn bị ghi đè bằng độ khô tham chiếu/trung bình kho ở phía dưới.
  // Điều này sai với phiếu điều chỉnh Tươi (MT) thuần túy — vốn CHỦ ĐỘNG cần độ
  // khô = 0% để BDMT = MT × 0 = 0, không ảnh hưởng số Khô đã cân bằng ở Bước 1.
  // Nay phân biệt rõ: chỉ coi là "để trống" khi input thực sự rỗng/null/undefined;
  // nếu có giá trị hợp lệ (kể cả đúng 0) thì tôn trọng đúng giá trị đó.
  if (doKhoInput !== "" && doKhoInput !== null && doKhoInput !== undefined) {
    var valNhap = parseFloat(doKhoInput);
    if (!isNaN(valNhap) && valNhap >= 0) {
      if (valNhap > 1) valNhap = valNhap / 100;
      return {
        doKho: valNhap,
        dienGiai: valNhap === 0 ? "Điều chỉnh Tươi thuần túy (Độ khô = 0%)" : "Tự điền độ khô (" + (valNhap * 100).toFixed(2) + "%)"
      };
    }
  }

  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var targetDateStr = chuanHoaNgay_(ngay);

  if (loaiPhieu === "NHẬP" && hinhThuc === "TP") {
    var sheetDK = ss.getSheetByName(KHODAM_CONFIG.SHEET_NHAPDOKHO);
    var foundVal = null;
    if (sheetDK && sheetDK.getLastRow() > 1) {
      var dataDK = sheetDK.getDataRange().getValues();
      for (var i = dataDK.length - 1; i >= 1; i--) {
        if (String(dataDK[i][4]).trim() === "Đã hủy") continue; 
        if (dataDK[i][0] && chuanHoaNgay_(dataDK[i][0]) === targetDateStr) {
          var v = parseFloat(dataDK[i][2]);
          if (!isNaN(v) && v > 0) {
            foundVal = v > 1 ? v / 100 : v;
            break;
          }
        }
      }
    }

    if (foundVal !== null) {
      return { doKho: foundVal, dienGiai: "Tham chiếu Nhapdokho ngày " + targetDateStr };
    } else {
      if (optionChon === "1") {
        if (sheetDK && sheetDK.getLastRow() > 1) {
          var dataDK = sheetDK.getDataRange().getValues();
          var targetTime = new Date(ngay).getTime();
          var closestVal = 0.45, closestDate = "", minDiff = Infinity;
          for (var i = 1; i < dataDK.length; i++) {
            if (String(dataDK[i][4]).trim() === "Đã hủy") continue; 
            if (dataDK[i][0]) {
              var dTime = new Date(dataDK[i][0]).getTime();
              var diff = targetTime - dTime;
              if (diff > 0 && diff < minDiff) {
                minDiff = diff;
                var v = parseFloat(dataDK[i][2]);
                closestVal = v > 1 ? v / 100 : v;
                closestDate = chuanHoaNgay_(dataDK[i][0]);
              }
            }
          }
          return { doKho: closestVal, dienGiai: "Lấy độ khô ngày trước đó (" + closestDate + ")" };
        }
      } else if (optionChon === "2") {
        var tb = tinhDoKhoTrungBinhTheoKho_(khoLienQuan, ngay);
        return { doKho: tb, dienGiai: "Độ khô trung bình tháng (" + (tb * 100).toFixed(2) + "%)" };
      }
      return { doKho: 0.45, dienGiai: "Mặc định 45% (Chưa có dữ liệu độ khô ngày " + targetDateStr + ")" };
    }
  }

  if (loaiPhieu === "XUẤT" || hinhThuc.indexOf("MUON") === 0 || hinhThuc === "DC" || hinhThuc === "Khác" || hinhThuc === "XB" || hinhThuc === "TC") {
    var tbKhoXuat = tinhDoKhoTrungBinhTheoKho_(khoLienQuan, ngay);
    return { doKho: tbKhoXuat, dienGiai: "Độ khô trung bình kho xuất [" + khoLienQuan + "] (" + (tbKhoXuat * 100).toFixed(2) + "%)" };
  }

  return { doKho: 0.45, dienGiai: "Mặc định 45%" };
}

function xuLyNhapSanPhamSanXuat_(ngayNhap, optionChon) {
  try {
    // FIX: TRƯỚC ĐÂY hard-code thẳng ID Spreadsheet Phiếu Cân ở đây (trùng với
    // CONFIG.SPREADSHEET_ID nhưng KHÔNG tham chiếu qua CONFIG) - khiến tính năng
    // "Liên kết dữ liệu" (Hệ thống → Cấu hình hệ thống, ghi đè CONFIG.SPREADSHEET_ID
    // qua PropertiesService) không có tác dụng ở đúng chỗ này: nếu đổi sang
    // Spreadsheet Phiếu Cân khác (VD sang năm tài chính mới), riêng "Nhập TP dăm"
    // (quét dữ liệu phiếu cân để tính khối lượng gỗ keo) vẫn âm thầm đọc SAI từ
    // Spreadsheet CŨ trong khi mọi chức năng khác đã chuyển sang Spreadsheet mới.
    // Nay dùng chung CONFIG.SPREADSHEET_ID / CONFIG.DATA_SHEET như toàn bộ hệ thống.
    var ssCan = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheetCan = ssCan.getSheetByName(CONFIG.DATA_SHEET) || ssCan.getSheets()[0];

    if (!sheetCan) return { status: "error", message: "Không tìm thấy sheet PhieuCan_DN trong file trạm cân!" };

    var dataCan = sheetCan.getDataRange().getValues();
    if (dataCan.length <= 1) return { status: "success", tongKhoiLuongUot: 0, doKho: 0.45, dotVetBai: "Mặc định", tongGoKeo: 0, dienGiaiDoKho: "Mặc định 45%" };

    var targetDateStr = chuanHoaNgay_(ngayNhap);
    var arrKyCache = taiDanhSachKyVetBaiCache_();
    var thongSo = layThongSoVaTieuHaoCache_(ngayNhap, arrKyCache);

    var tongKhoiLuongGoKeo = 0, colDateIdx = 1, colWeightIdx = 9;

    for (var i = 1; i < dataCan.length; i++) {
      var row = dataCan[i];
      if (row[colDateIdx] !== undefined && row[colDateIdx] !== "") {
        if (chuanHoaNgay_(row[colDateIdx]) === targetDateStr) {
          tongKhoiLuongGoKeo += parseFloat(row[colWeightIdx]) || 0;
        }
      }
    }

    var khoiLuongDamTuoi = (tongKhoiLuongGoKeo - (tongKhoiLuongGoKeo * thongSo.tieuHao)) / 1000;
    var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
    var sheetDK = ss.getSheetByName(KHODAM_CONFIG.SHEET_NHAPDOKHO);
    var hasExactDateDK = false;
    
    if (sheetDK && sheetDK.getLastRow() > 1) {
      var dataDK = sheetDK.getDataRange().getValues();
      for (var i = 1; i < dataDK.length; i++) {
        if (String(dataDK[i][4]).trim() === "Đã hủy") continue;
        if (dataDK[i][0] && chuanHoaNgay_(dataDK[i][0]) === targetDateStr) {
          hasExactDateDK = true; break;
        }
      }
    }

    if (!hasExactDateDK && !optionChon) {
      return {
        status: "need_dokho_choice",
        message: "⚠️ Chưa có độ khô ngày " + targetDateStr + " trong sheet Nhapdokho!",
        ngayNhap: ngayNhap, dotVetBai: thongSo.dotVetBai, tieuHao: thongSo.tieuHao,
        tongGoKeo: tongKhoiLuongGoKeo, tongKhoiLuongUot: khoiLuongDamTuoi
      };
    }

    var refDK = xuLyXacDinhDoKho_("NHẬP", "TP", "", ngayNhap, 0, optionChon);
    return {
      status: "success", ngayNhap: ngayNhap, dotVetBai: thongSo.dotVetBai, tieuHao: thongSo.tieuHao,
      tongGoKeo: tongKhoiLuongGoKeo, tongKhoiLuongUot: khoiLuongDamTuoi, doKho: refDK.doKho,
      dienGiaiDoKho: refDK.dienGiai, bdmt: (khoiLuongDamTuoi * refDK.doKho)
    };
  } catch (err) {
    return { status: "error", message: "Lỗi: " + err.toString() };
  }
}

function layDanhSachTenKho_() {
  var cache = CacheService.getScriptCache();
  var cachedKho = cache.get('danh_sach_ten_kho');
  if (cachedKho) { try { return JSON.parse(cachedKho); } catch(e) {} }

  kiemTraVaTaoTieuDeSheets_();
  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheetDM = ss.getSheetByName(KHODAM_CONFIG.SHEET_DANHMUCKHO);
  var khoList = [];
  if (sheetDM && sheetDM.getLastRow() > 1) {
    var data = sheetDM.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][4]).trim() === "Đã hủy") continue;
      if (data[i][2] && khoList.indexOf(data[i][2]) === -1) khoList.push(data[i][2]);
    }
  }
  cache.put('danh_sach_ten_kho', JSON.stringify(khoList), 300);
  return khoList;
}

function xoaCacheKho_() { CacheService.getScriptCache().remove('danh_sach_ten_kho'); }

function getDataForGiaoDichForm_(loai, tab, tuNgayStr, denNgayStr, trang) {
  var khoList = layDanhSachTenKho_();
  var ketQuaPhieu = layDanhSachGiaoDichTheoBoLoc_(loai, tab, tuNgayStr, denNgayStr, trang);
  return {
    khoList: khoList,
    danhSach: ketQuaPhieu.list,
    trang: ketQuaPhieu.trang,
    tongSoTrang: ketQuaPhieu.tongSoTrang,
    tongSoPhieu: ketQuaPhieu.tongSoPhieu,
    tuNgay: ketQuaPhieu.tuNgay,
    denNgay: ketQuaPhieu.denNgay
  };
}

/**
 * Lấy danh sách phiếu theo bộ lọc, có PHÂN TRANG (20 phiếu/trang) để tránh tải quá nhiều dữ liệu 1 lần.
 * Mặc định khoảng thời gian: 3 tháng gần nhất tính từ hiện tại (nếu không truyền tuNgay/denNgay).
 * @param {number} [trang] - Số trang cần lấy (bắt đầu từ 1). Mặc định: 1.
 */
function layDanhSachGiaoDichTheoBoLoc_(loaiPhieu, tabPhieu, tuNgay, denNgay, trang) {
  kiemTraVaTaoTieuDeSheets_();
  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheetGD = ss.getSheetByName(KHODAM_CONFIG.SHEET_GIAODICH);

  var tuNgayStr = tuNgay || layNgay3ThangTruocStr_();
  var denNgayStr = denNgay || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var soTrang = parseInt(trang, 10);
  if (isNaN(soTrang) || soTrang < 1) soTrang = 1;

  if (!sheetGD || sheetGD.getLastRow() <= 1) {
    return { list: [], trang: 1, tongSoTrang: 1, tongSoPhieu: 0, tuNgay: tuNgayStr, denNgay: denNgayStr };
  }

  var data = sheetGD.getDataRange().getValues();
  var tuDate = tuNgay ? new Date(tuNgay).setHours(0, 0, 0, 0) : layThoiDiem3ThangTruoc_();
  var denDate = new Date(denNgayStr).setHours(23, 59, 59, 999);
  var arrKyCache = taiDanhSachKyVetBaiCache_();

  // Bước 1: lọc ra chỉ số dòng phù hợp bộ lọc (không dựng object ngay để đỡ tốn công cho các phiếu không thuộc trang cần lấy)
  var matchedRowIdx = [];
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][11]).trim() === "Đã hủy") continue;

    var loaiVal = data[i][2];
    var hinhThucVal = data[i][3];
    var matchTab = false;

    if (loaiPhieu === "NHẬP") {
      if (tabPhieu === "Dăm sản xuất" && hinhThucVal === "TP") matchTab = true;
      if (tabPhieu === "Nhập khác" && hinhThucVal !== "TP") matchTab = true;
    } else {
      if (tabPhieu === "Xuất bán" && hinhThucVal === "TT") matchTab = true;
      if (tabPhieu === "Xuất khác" && hinhThucVal !== "TT" && hinhThucVal !== "TC") matchTab = true;
      if (tabPhieu === "Xuất trung chuyển" && hinhThucVal === "TC") matchTab = true;
    }

    if (loaiVal === loaiPhieu && matchTab && data[i][1]) {
      var dTimeOnly = new Date(new Date(data[i][1])).setHours(0, 0, 0, 0);
      if (tuDate && dTimeOnly < tuDate) continue;
      if (denDate && dTimeOnly > denDate) continue;
      matchedRowIdx.push(i);
    }
  }

  var tongSoPhieu = matchedRowIdx.length;
  var tongSoTrang = Math.max(1, Math.ceil(tongSoPhieu / KICH_THUOC_TRANG));
  if (soTrang > tongSoTrang) soTrang = tongSoTrang;
  var batDau = (soTrang - 1) * KICH_THUOC_TRANG;
  var trangRowIdx = matchedRowIdx.slice(batDau, batDau + KICH_THUOC_TRANG);

  var list = trangRowIdx.map(function(i) {
    var dObj = new Date(data[i][1]); // không mutate: giữ nguyên giờ phút để hiển thị đúng
    return {
      maPhieu: data[i][0],
      ngay: Utilities.formatDate(dObj, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"),
      hinhThuc: data[i][3],
      dotVetBai: data[i][4],
      khoXuat: data[i][5],
      khoNhap: data[i][6],
      mt: parseFloat(data[i][7]) || 0,
      doKho: parseFloat(data[i][8]) || 0,
      bdmt: parseFloat(data[i][10]) || 0,
      nguonDK: data[i][13] || "Mặc định/Thủ công",
      isLocked: kiemTraKhoaKyVetBaiPure_(dObj, arrKyCache)
    };
  });

  return {
    list: list,
    trang: soTrang,
    tongSoTrang: tongSoTrang,
    tongSoPhieu: tongSoPhieu,
    tuNgay: tuNgayStr,
    denNgay: denNgayStr
  };
}

function taoMaPhieuMoi_(prefix) {
  var tsp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  var randSuffix = Math.floor(Math.random() * 9000) + 1000;
  return prefix + tsp + "_" + randSuffix;
}

function xuLySuaXoaGiaoDich_(dataEdit) {
  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(KHODAM_CONFIG.SHEET_GIAODICH);
  var data = sheet.getDataRange().getValues();
  var rowIdx = -1;

  if (dataEdit.maPhieu) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(dataEdit.maPhieu).trim()) { rowIdx = i + 1; break; }
    }
  }

  var ngayCheck = dataEdit.ngay || (rowIdx > -1 ? data[rowIdx-1][1] : new Date());
  var arrKyCache = taiDanhSachKyVetBaiCache_();
  // FIX H-05: kiểm tra cả NGÀY GỐC của phiếu đang sửa/xóa (trước đây chỉ kiểm tra
  // ngày gửi lên - lời gọi API tự dựng kèm ngày thuộc kỳ mở sửa được phiếu kỳ đã khóa).
  if (rowIdx > -1 && kiemTraKhoaKyVetBaiPure_(data[rowIdx - 1][1], arrKyCache)) return "❌ Khóa bảo mật: Phiếu thuộc kỳ cũ!";
  if (kiemTraKhoaKyVetBaiPure_(ngayCheck, arrKyCache)) return "❌ Khóa bảo mật: Phiếu thuộc kỳ cũ!";

  if (dataEdit.hanhDong === "XOA") {
    if (rowIdx > -1) { 
      sheet.getRange(rowIdx, 12).setValue("Đã hủy"); 
      return "🗑️ Đã xóa phiếu (cập nhật trạng thái 'Đã hủy')."; 
    }
    return "❌ Không tìm thấy.";
  } else {
    // FIX: nếu client gửi hanhDong="SUA" (đang sửa 1 phiếu có sẵn) nhưng không còn
    // tìm thấy đúng maPhieu đó trên sheet (VD: người khác vừa xóa phiếu này ở giữa
    // lúc mở form sửa và lúc bấm Lưu), TRƯỚC ĐÂY sẽ rơi thẳng xuống nhánh tạo phiếu
    // MỚI bên dưới (vì chỉ nhánh "rowIdx > -1 && hanhDong === SUA" mới đi vào update,
    // còn lại đều bị coi là "thêm mới") — âm thầm tạo ra 1 phiếu trùng thay vì báo
    // lỗi rõ ràng cho người dùng biết phiếu gốc đã không còn.
    if (dataEdit.hanhDong === "SUA" && rowIdx === -1) {
      return "❌ Không tìm thấy phiếu " + dataEdit.maPhieu + " để cập nhật (có thể đã bị xóa). Vui lòng tải lại danh sách và thử lại.";
    }
    var ngay = new Date(dataEdit.ngay);
    var thongSo = layThongSoVaTieuHaoCache_(ngay, arrKyCache);
    var mt = parseFloat(dataEdit.khoiLuongMT) || 0;
    
    var dienGiaiDK = sanitize_(dataEdit.dienGiaiDoKho || "");
    var hinhThucVal = sanitize_(dataEdit.hinhThuc);

    if (dataEdit.loai === "NHẬP" && hinhThucVal !== "TP" && hinhThucVal !== "DC") {
      var dCheck = parseFloat(dataEdit.doKho);
      if (isNaN(dCheck) || dCheck <= 0) {
        return "❌ Lỗi: Nhập hình thức [" + hinhThucVal + "] bắt buộc phải điền độ khô, không được để trống!";
      }
    }

    if (hinhThucVal === "TP" && mt === 0) {
      var kqScan = xuLyNhapSanPhamSanXuat_(dataEdit.ngay, dataEdit.optionChon);
      if (kqScan.status === "error") return "❌ " + kqScan.message;
      mt = kqScan.tongKhoiLuongUot;
      if (!dienGiaiDK) dienGiaiDK = kqScan.dienGiaiDoKho;
    }

    var khoXuatValRaw = "Không có", khoNhapValRaw = "Không có";
    if (dataEdit.loai === "NHẬP") {
      khoNhapValRaw = dataEdit.khoNhap || "Không có";
      if (hinhThucVal !== "TP" && hinhThucVal !== "Nhập khác") khoXuatValRaw = dataEdit.khoXuat || "Không có";
    } else {
      khoXuatValRaw = dataEdit.khoXuat || "Không có";
      if (hinhThucVal === "TC") khoNhapValRaw = dataEdit.khoNhap || "Không có";
    }

    var khoXuatVal = sanitize_(khoXuatValRaw);
    var khoNhapVal = sanitize_(khoNhapValRaw);
    var khoLienQuan = (dataEdit.loai === "NHẬP") ? khoNhapVal : khoXuatVal;

    var refDK = xuLyXacDinhDoKho_(dataEdit.loai, hinhThucVal, khoLienQuan, ngay, dataEdit.doKho, dataEdit.optionChon);
    var doKho = refDK.doKho;
    if (!dienGiaiDK) dienGiaiDK = refDK.dienGiai;

    var tyLeTieuHao = thongSo.tieuHao || 0.0315;
    var dotVetBai = thongSo.dotVetBai;
    var bdmt = mt * doKho;
    // FIX #13: TRƯỚC ĐÂY ghi "ngayFormatted" (CHUỖI TEXT do Utilities.formatDate
    // tạo ra) trực tiếp vào ô Thời gian - Google Sheets phải tự đoán chuỗi này có
    // phải ngày hay không tùy theo Locale của Sheet, và có thể để nguyên dạng
    // TEXT nếu không nhận diện được (đúng như lỗi người dùng báo). Nay ghi
    // THẲNG "ngay" (Date object THẬT, luôn đúng 100% không phụ thuộc Locale),
    // rồi áp định dạng hiển thị RIÊNG qua setNumberFormat (xem bên dưới, sau
    // khi ghi) theo đúng REGION_FORMAT() (Config.gs, hàm đọc động từ
    // PropertiesService - đổi ngay trên giao diện Hệ thống → Cấu hình hệ
    // thống, không phải sửa rải rác nhiều hàm hay deploy lại).
    var _rfKD = REGION_FORMAT_();

    if (rowIdx > -1 && dataEdit.hanhDong === "SUA") {
      sheet.getRange(rowIdx, 2, 1, 11).setValues([[
        ngay, dataEdit.loai, hinhThucVal, dotVetBai,
        khoXuatVal, khoNhapVal, mt, doKho, tyLeTieuHao, bdmt, "Hợp lệ"
      ]]);
      sheet.getRange(rowIdx, 2).setNumberFormat(_rfKD.DATETIME_FMT);
      // Khối lượng tươi (H) / Khối lượng khô (K) theo đúng số chữ số thập phân
      // đã cấu hình (Hệ thống → Cấu hình hệ thống); Độ khô (I) luôn 4 số lẻ vì
      // là tỷ lệ kỹ thuật (0-1), không phải số lượng người dùng thường xem.
      sheet.getRange(rowIdx, 8).setNumberFormat(_rfKD.SO_THAP_PHAN_FMT);
      sheet.getRange(rowIdx, 9).setNumberFormat("0.0000");
      sheet.getRange(rowIdx, 11).setNumberFormat(_rfKD.SO_THAP_PHAN_FMT);
      sheet.getRange(rowIdx, 14).setValue(dienGiaiDK);
      return "✏️ Đã cập nhật phiếu thành công.";
    } else {
      if (hinhThucVal === "TP" && !dataEdit.boQuaTrung) {
        var ngayKiemTra = Utilities.formatDate(ngay, Session.getScriptTimeZone(), "yyyy-MM-dd");
        var maTrungLap = [];
        for (var r = 1; r < data.length; r++) {
          if (String(data[r][11]).trim() === "Đã hủy") continue;
          if (String(data[r][2]).trim() === "NHẬP" && String(data[r][3]).trim() === "TP" && String(data[r][6]).trim() === khoNhapVal) {
            var dRow = new Date(data[r][1]);
            if (!isNaN(dRow.getTime()) && Utilities.formatDate(dRow, Session.getScriptTimeZone(), "yyyy-MM-dd") === ngayKiemTra) {
              maTrungLap.push(String(data[r][0]));
            }
          }
        }
        if (maTrungLap.length > 0) {
          return "⚠️TRUNG_LAP_TP::Đã có " + maTrungLap.length + " phiếu Nhập Dăm sản xuất (TP) ngày " + ngayKiemTra +
                 " tại kho [" + khoNhapVal + "] (Mã: " + maTrungLap.join(", ") + "). Bạn có chắc muốn tạo thêm?";
        }
      }

      var prefix = dataEdit.loai === "NHẬP" ? "NK_" : "XK_";
      var maPhieuChinh = taoMaPhieuMoi_(prefix);
      var rowMoi = sheet.getLastRow() + 1;

      sheet.appendRow([
        maPhieuChinh, ngay, dataEdit.loai, hinhThucVal, dotVetBai,
        khoXuatVal, khoNhapVal, mt, doKho, tyLeTieuHao, bdmt, "Hợp lệ", "", dienGiaiDK
      ]);
      sheet.getRange(rowMoi, 2).setNumberFormat(_rfKD.DATETIME_FMT);
      sheet.getRange(rowMoi, 8).setNumberFormat(_rfKD.SO_THAP_PHAN_FMT);
      sheet.getRange(rowMoi, 9).setNumberFormat("0.0000");
      sheet.getRange(rowMoi, 11).setNumberFormat(_rfKD.SO_THAP_PHAN_FMT);

      if (dataEdit.loai === "XUẤT" && hinhThucVal === "TC" && khoNhapVal !== "Không có") {
        return "✅ Xuất trung chuyển sang [" + khoNhapVal + "] thành công!";
      }
      return "✅ Đã tạo mới phiếu " + dataEdit.loai + " thành công.";
    }
  }
}

// ==========================================
// HOÀN THÀNH ĐƠN HÀNG XUẤT BÁN (Đối soát Khô/Tươi)
// ==========================================

/**
 * Tổng hợp số liệu Nhập/Xuất liên quan đến 1 kho xuất bán trong khoảng thời gian.
 * Tách riêng để dùng chung cho cả 2 bước đối soát (Khô BDMT & Tươi MT).
 *
 * LƯU Ý QUAN TRỌNG: Mọi phiếu Trung chuyển (hình thức "TC") trong hệ thống — kể cả phiếu điều
 * chỉnh 1 chiều do chính chức năng này tạo ra — đều được lưu với Loại = "XUẤT" (vì được lập từ
 * màn hình "Xuất kho > Xuất trung chuyển"). Vì vậy KHÔNG được lọc theo Loại="NHẬP" để tìm phiếu
 * nhập trung chuyển; phải xét độc lập cột Kho Xuất / Kho Nhập của các phiếu hình thức TC, bất kể Loại.
 */
function tongHopSoLieuKhoXuatBan_(khoXuatBan, tuTime, denTime) {
  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheetGD = ss.getSheetByName(KHODAM_CONFIG.SHEET_GIAODICH);
  var kq = {
    nhapTC_BDMT: 0, nhapTC_MT: 0,     // Nhập trung chuyển VÀO kho này (gồm cả phiếu điều chỉnh TC 1 chiều)
    xuatBan_BDMT: 0, xuatBan_MT: 0,   // Xuất bán (TT) TỪ kho này
    xuatKhac_BDMT: 0, xuatKhac_MT: 0  // Xuất trung chuyển RA khỏi kho + các xuất khác (ĐC, mượn...) TỪ kho này
  };
  if (!sheetGD || sheetGD.getLastRow() <= 1) return kq;

  var data = sheetGD.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][11]).trim() === "Đã hủy") continue;
    var dt = new Date(data[i][1]).getTime();
    if (dt < tuTime || dt > denTime) continue;

    var loai = data[i][2], hinhThuc = String(data[i][3]).trim();
    var kX = String(data[i][5]).trim(), kN = String(data[i][6]).trim();
    var mt = parseFloat(data[i][7]) || 0, bdmt = parseFloat(data[i][10]) || 0;

    if (hinhThuc === "TC") {
      // Xét độc lập 2 chiều theo đúng cột Kho Xuất / Kho Nhập, KHÔNG phụ thuộc "Loại"
      if (kN === khoXuatBan) { kq.nhapTC_BDMT += bdmt; kq.nhapTC_MT += mt; }
      if (kX === khoXuatBan) { kq.xuatKhac_BDMT += bdmt; kq.xuatKhac_MT += mt; }
    } else if (loai === "XUẤT" && kX === khoXuatBan) {
      if (hinhThuc === "TT") { kq.xuatBan_BDMT += bdmt; kq.xuatBan_MT += mt; }
      else { kq.xuatKhac_BDMT += bdmt; kq.xuatKhac_MT += mt; }
    }
  }
  return kq;
}

/** Tìm kho đã "Xuất trung chuyển" (TC) nhiều BDMT nhất VÀO khoXuatBan trong khoảng thời gian — dùng làm gợi ý mặc định cho Nút 1. */
function timKhoNguonTCLonNhat_(khoXuatBan, tuTime, denTime) {
  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheetGD = ss.getSheetByName(KHODAM_CONFIG.SHEET_GIAODICH);
  if (!sheetGD || sheetGD.getLastRow() <= 1) return null;
  var data = sheetGD.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][11]).trim() === "Đã hủy") continue;
    var dt = new Date(data[i][1]).getTime();
    if (dt < tuTime || dt > denTime) continue;
    if (String(data[i][3]).trim() !== "TC") continue;

    var kX = String(data[i][5]).trim();
    var kN = String(data[i][6]).trim();
    if (kN !== khoXuatBan) continue;
    if (!kX || kX === "Không có") continue;

    var bdmt = parseFloat(data[i][10]) || 0;
    map[kX] = (map[kX] || 0) + bdmt;
  }
  var best = null, bestVal = -Infinity;
  for (var k in map) { if (map[k] > bestVal) { bestVal = map[k]; best = k; } }
  return best;
}

/** Bước 1 (nút 1): Đối soát chênh lệch KHÔ (BDMT) giữa Nhập trung chuyển và Xuất bán. */
function taoPhieuDieuChinhKho_(khoXuatBan, tuTime, denTime, denNgayGoc) {
  var sl = tongHopSoLieuKhoXuatBan_(khoXuatBan, tuTime, denTime);
  var bdmtKhaDung = sl.nhapTC_BDMT - sl.xuatKhac_BDMT;
  // Guard chia cho 0: nếu không có phiếu nhập trung chuyển nào trong kỳ thì lấy độ khô mặc định 45%
  var doKhoTB = sl.nhapTC_MT > 0 ? (sl.nhapTC_BDMT / sl.nhapTC_MT) : 0.45;
  var chenhLechBDMT = sl.xuatBan_BDMT - bdmtKhaDung;
  var mt = doKhoTB > 0 ? Math.abs(chenhLechBDMT) / doKhoTB : 0;
  // Gợi ý mặc định: kho đã trung chuyển vào kho xuất bán nhiều nhất trong kỳ (người dùng vẫn có thể đổi kho khác)
  var khoNguonTC = timKhoNguonTCLonNhat_(khoXuatBan, tuTime, denTime);

  return "DATA_STEP1::" + JSON.stringify({
    chenhLechKho: chenhLechBDMT,
    doKho: doKhoTB,
    mt: mt,
    denNgay: denNgayGoc,
    khoXuatBan: khoXuatBan,
    khoNguonTC: khoNguonTC || null
  });
}

/**
 * Bước 2 (nút 2): Đối soát chênh lệch TƯƠI (MT) do hao hụt ẩm, sau khi Khô đã khớp.
 * BẮT BUỘC Bước 1 (Khô/BDMT) phải cân bằng trước — nếu người dùng vừa lưu phiếu điều
 * chỉnh Khô ở Bước 1 thì tongHopSoLieuKhoXuatBan() sẽ tự động lấy dữ liệu MỚI NHẤT từ
 * sheet (bao gồm cả phiếu Bước 1 vừa tạo) vì hàm luôn đọc lại dữ liệu tại thời điểm gọi.
 */
function taoPhieuDieuChinhTuoi_(khoXuatBan, tuTime, denTime, tuNgayGoc, denNgayGoc) {
  var sl = tongHopSoLieuKhoXuatBan_(khoXuatBan, tuTime, denTime);
  var bdmtKhaDung = sl.nhapTC_BDMT - sl.xuatKhac_BDMT;
  var mtKhaDung = sl.nhapTC_MT - sl.xuatKhac_MT;
  var chenhLechMT = mtKhaDung - sl.xuatBan_MT;
  var chenhLechBDMT = bdmtKhaDung - sl.xuatBan_BDMT;

  // GUARD: Bước 1 (Khô/BDMT) phải cân bằng trước khi được phép tính Bước 2 (Tươi/MT).
  // Nếu còn chênh lệch BDMT nghĩa là người dùng chưa lưu phiếu điều chỉnh Khô ở Bước 1.
  // FIX #7: ngưỡng "coi như cân bằng" đổi từ 0.001 -> 0.01 để KHỚP với 2 chữ số thập
  // phân đang hiển thị (.toFixed(2)). Ngưỡng cũ 0.001 quá nhỏ so với độ chính xác hiển
  // thị: một chênh lệch thực tế như -0.0015 vẫn > 0.001 nên bị chặn, nhưng khi hiển thị
  // ra màn hình lại làm tròn thành "-0.00" (trông như đã bằng 0) khiến người dùng bối
  // rối không hiểu vì sao hệ thống vẫn báo còn chênh lệch. 0.01 BDMT/MT (~10kg) là sai
  // số dấu phẩy động/làm tròn không đáng kể so với quy mô tấn của kho dăm, không phải
  // chênh lệch nghiệp vụ thật.
  if (Math.abs(chenhLechBDMT) > 0.01) {
    return "❌ Chưa thể thực hiện Bước 2 (Tươi): Lượng Khô (BDMT) tại kho [" + khoXuatBan +
      "] vẫn còn chênh lệch " + chenhLechBDMT.toFixed(2) +
      " BDMT. Vui lòng bấm nút 1️⃣ để tạo VÀ LƯU phiếu điều chỉnh Khô trước, sau đó mới quay lại bấm nút 2️⃣!";
  }

  var tuStr = tuNgayGoc.split(" ")[0];
  var denStr = denNgayGoc.split(" ")[0];

  var msg = "Hiện tại kho Xuất bán (" + khoXuatBan + ") từ ngày " + tuStr + " đến ngày " + denStr +
    " có tổng lượng nhập là " + mtKhaDung.toFixed(2) + " MT, " + bdmtKhaDung.toFixed(2) + " BDMT, " +
    "tổng lượng xuất bán thực tế là " + sl.xuatBan_MT.toFixed(2) + " MT, " + sl.xuatBan_BDMT.toFixed(2) + " BDMT. " +
    "Chênh lệch " + Math.abs(chenhLechMT).toFixed(2) + " MT, " + Math.abs(chenhLechBDMT).toFixed(2) + " BDMT. " +
    (Math.abs(chenhLechMT) <= 0.01 ? "Chênh lệch bằng 0, có thể hoàn thành." : "Khác 0, cần tạo phiếu điều chỉnh tươi!");

  return "DATA_STEP2::" + JSON.stringify({
    chenhLechMT: chenhLechMT,
    denNgay: denNgayGoc,
    khoXuatBan: khoXuatBan,
    msg: msg
  });
}

/** Hàm điều phối chính — gọi từ processFormData('Hoanthanhdonhang', ...) */
function xuLyHoanThanhDonHangXuatBan_(dataParam) {
  var khoXuatBan = String((dataParam && dataParam.khoXuatBan) || "").trim();
  if (!khoXuatBan || khoXuatBan === "Không có") return "❌ Vui lòng chọn Kho Xuất Bán hợp lệ!";
  if (!dataParam.tuNgay || !dataParam.denNgay) return "❌ Vui lòng chọn đầy đủ khoảng thời gian!";

  var tuTime = new Date(dataParam.tuNgay).getTime();
  var denTime = new Date(dataParam.denNgay).getTime();
  if (isNaN(tuTime) || isNaN(denTime)) return "❌ Định dạng ngày không hợp lệ!";
  if (tuTime > denTime) return "❌ 'Từ ngày' phải trước 'Đến ngày'!";

  if (dataParam.cheDo === "BDMT") return taoPhieuDieuChinhKho_(khoXuatBan, tuTime, denTime, dataParam.denNgay);
  if (dataParam.cheDo === "MT") return taoPhieuDieuChinhTuoi_(khoXuatBan, tuTime, denTime, dataParam.tuNgay, dataParam.denNgay);
  return "❌ Chế độ không hợp lệ.";
}

/**
 * FIX #9: Tạo VÀ LƯU TRỰC TIẾP phiếu điều chỉnh từ panel "Hoàn thành đơn hàng",
 * không cần điều hướng qua form Nhập/Xuất kho thủ công rồi tự quay lại tab Xuất
 * bán. Tái sử dụng nguyên vẹn xuLySuaXoaGiaoDich() để giữ đúng toàn bộ logic
 * tính kỳ vét bãi/tiêu hao/khóa kỳ/chống trùng đã có, tránh viết trùng lặp.
 *
 * payload.buoc = 'BDMT': tạo phiếu Xuất trung chuyển (TC).
 *   { buoc:'BDMT', khoXuatBan, ngay:'yyyy-MM-dd', khoXuat, khoNhap, mt, doKho }
 * payload.buoc = 'MT': tạo phiếu Xuất khác (dư tươi) hoặc Nhập khác (thiếu tươi),
 *   hình thức "DC", độ khô CỐ ĐỊNH = 0 (điều chỉnh Tươi thuần túy, không đụng Khô).
 *   { buoc:'MT', khoXuatBan, ngay:'yyyy-MM-dd', chenhLechMT }
 */
function KD_taoPhieuDieuChinhTuDong_(payload) {
  payload = payload || {};
  var khoXuatBan = String(payload.khoXuatBan || "").trim();
  if (!khoXuatBan) return "❌ Thiếu thông tin Kho Xuất Bán.";

  if (payload.buoc === "BDMT") {
    var khoXuat = String(payload.khoXuat || "").trim();
    var khoNhap = String(payload.khoNhap || "").trim();
    if (!khoXuat || !khoNhap) return "❌ Vui lòng xác định đủ Kho Xuất và Kho Nhập cho phiếu điều chỉnh Khô.";
    if (khoXuat === khoNhap) return "❌ Kho Xuất và Kho Nhập không được trùng nhau.";

    var dataEditBDMT = {
      loai: "XUẤT", tab: "Xuất trung chuyển", maPhieu: "",
      ngay: payload.ngay, hinhThuc: "TC",
      khoXuat: khoXuat, khoNhap: khoNhap,
      khoiLuongMT: payload.mt, doKho: payload.doKho,
      dienGiaiDoKho: "Tự động điều chỉnh Khô (BDMT) - Hoàn thành đơn hàng xuất bán [" + khoXuatBan + "]",
      hanhDong: "THEM", boQuaTrung: true
    };
    return xuLySuaXoaGiaoDich_(dataEditBDMT);
  }

  if (payload.buoc === "MT") {
    var chenhLechMT = parseFloat(payload.chenhLechMT) || 0;
    if (Math.abs(chenhLechMT) <= 0.01) return "❌ Không có chênh lệch Tươi (MT) đáng kể để tạo phiếu.";
    var loaiTarget = chenhLechMT > 0 ? "XUẤT" : "NHẬP";
    var tabTarget = chenhLechMT > 0 ? "Xuất khác" : "Nhập khác";

    var dataEditMT = {
      loai: loaiTarget, tab: tabTarget, maPhieu: "",
      ngay: payload.ngay, hinhThuc: "DC",
      khoXuat: loaiTarget === "XUẤT" ? khoXuatBan : "Không có",
      khoNhap: loaiTarget === "NHẬP" ? khoXuatBan : "Không có",
      khoiLuongMT: Math.abs(chenhLechMT), doKho: 0,
      dienGiaiDoKho: "Tự động điều chỉnh Tươi (MT) do hao hụt ẩm - Hoàn thành đơn hàng xuất bán [" + khoXuatBan + "]",
      hanhDong: "THEM"
    };
    return xuLySuaXoaGiaoDich_(dataEditMT);
  }

  return "❌ Bước điều chỉnh không hợp lệ.";
}

function layDanhSachDanhMucKho_() {
  kiemTraVaTaoTieuDeSheets_();
  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheetDM = ss.getSheetByName(KHODAM_CONFIG.SHEET_DANHMUCKHO);
  if (!sheetDM || sheetDM.getLastRow() <= 1) return [];
  var data = sheetDM.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][4]).trim() === "Đã hủy") continue;
    list.push({ maKho: data[i][0], tenNhaMay: data[i][1], tenKho: data[i][2], ngayKhoiTao: Utilities.formatDate(new Date(data[i][3]), Session.getScriptTimeZone(), "yyyy-MM-dd") });
  }
  return list;
}

function xuLyDanhMucKho_(dataDM) {
  kiemTraVaTaoTieuDeSheets_();
  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheetDM = ss.getSheetByName(KHODAM_CONFIG.SHEET_DANHMUCKHO);
  if (dataDM.hanhDong === "XOA") {
    var data = sheetDM.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(dataDM.maKho).trim()) { 
        sheetDM.getRange(i + 1, 5).setValue("Đã hủy"); 
        xoaCacheKho_(); return "🗑️ Đã xóa kho."; 
      }
    }
  } else if (dataDM.hanhDong === "THEM") {
    sheetDM.appendRow(["KHO_" + new Date().getTime(), sanitize_(dataDM.tenNhaMay), sanitize_(dataDM.tenKho), new Date(dataDM.ngayKhoiTao), "Hoạt động"]);
    xoaCacheKho_();
    return "✅ Đã thêm kho.";
  }
  return "❌ Lỗi.";
}

function layDanhSachKyVetBai_() {
  kiemTraVaTaoTieuDeSheets_();
  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheetCfg = ss.getSheetByName(KHODAM_CONFIG.SHEET_CAUHINH);
  if (!sheetCfg || sheetCfg.getLastRow() <= 1) return [];
  var data = sheetCfg.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var loaiCfg = String(data[i][0]).trim().toLowerCase();
    if (loaiCfg === "thông số kho" || loaiCfg === "thong so kho") {
      list.push({ rowIndex: i + 1, kyVetBai: data[i][1], thoiGian: data[i][2], tieuHao: data[i][3] });
    }
  }
  for (var j = 0; j < list.length; j++) { list[j].isLocked = (j < list.length - 1); }
  return list.reverse();
}

function xuLyKyVetBai_(dataEdit) {
  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheetCfg = ss.getSheetByName(KHODAM_CONFIG.SHEET_CAUHINH);
  if (dataEdit.hanhDong === "XOA") {
    // TRƯỚC ĐÂY xóa thẳng dòng theo số dòng client gửi lên: gửi sai số (hoặc
    // danh sách đã cũ) là xóa nhầm dòng bất kỳ của sheet cấu hình, kể cả dòng
    // tiêu đề. Nay chỉ cho xóa đúng dòng "Thông số kho" MỚI NHẤT - khớp quy tắc
    // giao diện (các kỳ cũ đã khóa sổ, không được xóa).
    var dsCfg = sheetCfg.getDataRange().getValues();
    var dongKyMoiNhat = -1;
    for (var k = 1; k < dsCfg.length; k++) {
      var loai = String(dsCfg[k][0]).trim().toLowerCase();
      if (loai === "thông số kho" || loai === "thong so kho") dongKyMoiNhat = k + 1;
    }
    var dongXoa = parseInt(dataEdit.rowIndex, 10);
    if (dongKyMoiNhat === -1 || dongXoa !== dongKyMoiNhat) {
      return "❌ Chỉ xóa được kỳ vét bãi MỚI NHẤT (các kỳ cũ đã khóa sổ). Danh sách có thể đã thay đổi - hãy tải lại.";
    }
    sheetCfg.deleteRow(dongXoa); return "🗑️ Đã xóa kỳ.";
  } else if (dataEdit.hanhDong === "THEM") {
    if (!dataEdit.tuNgay) return "❌ Lỗi: Bạn chưa chọn Ngày và Giờ bắt đầu cho kỳ mới!";
    var tuMoi = new Date(dataEdit.tuNgay);
    var denMoi = new Date(tuMoi.getTime() + (730 * 24 * 60 * 60 * 1000));
    var data = sheetCfg.getDataRange().getValues();
    var lastKyRowIdx = -1, lastKyOldStr = "";

    for (var i = 1; i < data.length; i++) {
      var loaiCfg = String(data[i][0]).trim().toLowerCase();
      if (loaiCfg === "thông số kho" || loaiCfg === "thong so kho") {
         lastKyRowIdx = i + 1; lastKyOldStr = String(data[i][2]);
      }
    }

    if (lastKyRowIdx > -1) {
        var parts = lastKyOldStr.split(" - ");
        if (parts.length > 0) {
            sheetCfg.getRange(lastKyRowIdx, 3).setValue(parts[0].trim() + " - Đến: " + Utilities.formatDate(tuMoi, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"));
        }
    }

    var strTuMoi = "Từ: " + Utilities.formatDate(tuMoi, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
    var strDenMoi = "Đến: " + Utilities.formatDate(denMoi, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
    sheetCfg.appendRow(["Thông Số Kho", sanitize_(dataEdit.kyVetBai), strTuMoi + " - " + strDenMoi, "Tiêu hao: " + dataEdit.tieuHao + "%"]);
    return "✅ Đã tạo kỳ mới thành công!";
  }
  return "❌ Lỗi.";
}

/** Lấy danh sách độ khô theo bộ lọc, có phân trang (20/trang). Mặc định 3 tháng gần nhất. */
function layDanhSachDoKhoTheoBoLoc_(tuNgay, denNgay, trang) {
  kiemTraVaTaoTieuDeSheets_();
  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheetDK = ss.getSheetByName(KHODAM_CONFIG.SHEET_NHAPDOKHO);

  var tuNgayStr = tuNgay || layNgay3ThangTruocStr_();
  var denNgayStr = denNgay || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var soTrang = parseInt(trang, 10);
  if (isNaN(soTrang) || soTrang < 1) soTrang = 1;

  if (!sheetDK || sheetDK.getLastRow() <= 1) {
    return { list: [], trang: 1, tongSoTrang: 1, tongSoPhieu: 0, tuNgay: tuNgayStr, denNgay: denNgayStr };
  }

  var data = sheetDK.getDataRange().getValues();
  var tuDate = tuNgay ? new Date(tuNgay).setHours(0, 0, 0, 0) : layThoiDiem3ThangTruoc_();
  var denDate = new Date(denNgayStr).setHours(23, 59, 59, 999);
  var arrKyCache = taiDanhSachKyVetBaiCache_();

  var matchedRowIdx = [];
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][4]).trim() === "Đã hủy") continue;
    if (!data[i][0]) continue;
    var dTimeOnly = new Date(new Date(data[i][0])).setHours(0, 0, 0, 0);
    if (tuDate && dTimeOnly < tuDate) continue;
    if (denDate && dTimeOnly > denDate) continue;
    matchedRowIdx.push(i);
  }

  var tongSoPhieu = matchedRowIdx.length;
  var tongSoTrang = Math.max(1, Math.ceil(tongSoPhieu / KICH_THUOC_TRANG));
  if (soTrang > tongSoTrang) soTrang = tongSoTrang;
  var batDau = (soTrang - 1) * KICH_THUOC_TRANG;
  var trangRowIdx = matchedRowIdx.slice(batDau, batDau + KICH_THUOC_TRANG);

  var list = trangRowIdx.map(function(i) {
    var dObj = new Date(data[i][0]);
    return {
      ngay: Utilities.formatDate(dObj, Session.getScriptTimeZone(), "yyyy-MM-dd"),
      hinhThuc: data[i][1] || "NKSX",
      doKho: parseFloat(data[i][2]) || 0,
      doAm: parseFloat(data[i][3]) || 0,
      isLocked: kiemTraKhoaKyVetBaiPure_(dObj, arrKyCache)
    };
  });

  return {
    list: list,
    trang: soTrang,
    tongSoTrang: tongSoTrang,
    tongSoPhieu: tongSoPhieu,
    tuNgay: tuNgayStr,
    denNgay: denNgayStr
  };
}

function xuLySuaXoaDoKho_(dataEdit) {
  var target = String(dataEdit.ngay).trim();
  var arrKyCache = taiDanhSachKyVetBaiCache_();
  if (kiemTraKhoaKyVetBaiPure_(target, arrKyCache)) return "❌ Khóa bảo mật: Ngày thuộc kỳ cũ!";
  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(KHODAM_CONFIG.SHEET_NHAPDOKHO);
  var data = sheet.getDataRange().getValues();
  var rowIdx = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && Utilities.formatDate(new Date(data[i][0]), Session.getScriptTimeZone(), "yyyy-MM-dd") === target) { rowIdx = i + 1; break; }
  }

  if (dataEdit.hanhDong === "XOA") {
    if (rowIdx > -1) { 
      sheet.getRange(rowIdx, 5).setValue("Đã hủy");
      return "🗑️ Đã xóa độ khô (cập nhật trạng thái 'Đã hủy').";
    }
    // FIX L-02: trước đây không thấy dòng thì trả undefined (nhật ký vẫn ghi OK).
    return "❌ Không tìm thấy độ khô ngày " + target + " để xóa.";
  } else {
    var hinhThucSanitized = sanitize_(dataEdit.hinhThuc || "NKSX");
    var dk = parseFloat(dataEdit.doKho) || 0, da = parseFloat(dataEdit.doAm) || 0;
    if (dk > 1) dk = dk / 100; if (da > 1) da = da / 100;
    
    if (rowIdx > -1) {
      // TỐI ƯU: gộp 4 lệnh getRange(...).setValue(...) riêng lẻ (4 lượt gọi API
      // Sheets) thành 1 lệnh setValues() duy nhất trên cả dải 4 cột liền nhau -
      // giảm số lượt gọi Sheets API, phản hồi nhanh hơn, không đổi hành vi/kết quả.
      sheet.getRange(rowIdx, 2, 1, 4).setValues([[hinhThucSanitized, dk, da, "Hợp lệ"]]);
      return "✏️ Đã cập nhật.";
    } else {
      sheet.appendRow([new Date(target), hinhThucSanitized, dk, da, "Hợp lệ"]);
      return "✅ Đã thêm.";
    }
  }
}

// ==========================================
// BÁO CÁO TỒN KHO
// ==========================================

/** Tên hiển thị đầy đủ cho mã hình thức nhập/xuất, dùng để nhóm báo cáo theo hình thức. */
function tenHienThiHinhThuc_(code) {
  var map = {
    "TP": "TP - Dăm sản xuất",
    "TT": "TT - Xuất bán",
    "TC": "TC - Trung chuyển",
    "DC": "DC - Điều chuyển nội bộ",
    "XB": "XB - Xuất bán khác",
    "MUON_DH": "MUON_DH - Mượn Đại Hiệp",
    "MUON_QC": "MUON_QC - Mượn HAK_QN",
    "MUON_QS": "MUON_QS - Mượn CNHAK",
    "Khác": "Khác"
  };
  return map[code] || code || "(Không xác định)";
}

function layDanhSachTenNhaMay_() {
  var arr = [];
  layDanhSachDanhMucKho_().forEach(function(k) {
    if (arr.indexOf(k.tenNhaMay) === -1) arr.push(k.tenNhaMay);
  });
  return arr;
}

/** Chuyển map {hinhThuc: {mt, bdmt}} thành mảng đã sắp xếp giảm dần theo BDMT, có tên hiển thị. */
function _chuyenHinhThucThanhMang_(mapHinhThuc) {
  var arr = [];
  for (var k in mapHinhThuc) {
    arr.push({ hinhThuc: k, ten: tenHienThiHinhThuc_(k), mt: mapHinhThuc[k].mt, bdmt: mapHinhThuc[k].bdmt });
  }
  arr.sort(function(a, b) { return b.bdmt - a.bdmt; });
  return arr;
}

/**
 * Báo cáo tồn kho đầy đủ: Tồn đầu kỳ / Nhập-Xuất trong kỳ (theo hình thức) / Tồn cuối kỳ.
 * Tính cho cả MT (tươi) và BDMT (khô), kèm % độ khô bình quân của số tồn.
 * Hỗ trợ lọc theo khoảng ngày, theo kho, và theo nhà máy.
 *
 * @param {Object} [params]
 * @param {string} [params.tuNgay]     - Đầu kỳ báo cáo (yyyy-MM-dd). Mặc định: đầu tháng hiện tại.
 * @param {string} [params.denNgay]    - Cuối kỳ báo cáo (yyyy-MM-dd). Mặc định: hôm nay.
 * @param {string} [params.tenKho]     - Chỉ lọc 1 kho cụ thể. "Tất cả" hoặc bỏ trống = không lọc.
 * @param {string} [params.tenNhaMay]  - Chỉ lọc 1 nhà máy cụ thể. "Tất cả" hoặc bỏ trống = không lọc.
 */
function layBaoCaoTonKho_(params) {
  kiemTraVaTaoTieuDeSheets_();
  params = params || {};

  var todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var tuNgayStr = params.tuNgay || layNgay3ThangTruocStr_();
  var denNgayStr = params.denNgay || todayStr;
  var tenKhoLoc = (params.tenKho && params.tenKho !== "Tất cả") ? params.tenKho : null;
  var tenNhaMayLoc = (params.tenNhaMay && params.tenNhaMay !== "Tất cả") ? params.tenNhaMay : null;

  var tuTime = new Date(tuNgayStr).setHours(0,0,0,0);
  var denTime = new Date(denNgayStr).setHours(23,59,59,999);

  function taoKhoiRong(tenKho, tenNhaMay) {
    return {
      tenKho: tenKho, tenNhaMay: tenNhaMay,
      tonDauMT: 0, tonDauBDMT: 0,
      nhapKyMT: 0, nhapKyBDMT: 0,
      xuatKyMT: 0, xuatKyBDMT: 0,
      nhapTheoHinhThuc: {}, xuatTheoHinhThuc: {}
    };
  }

  // Khởi tạo từ danh mục kho trước (đã lọc theo kho/nhà máy), để kho chưa có giao dịch vẫn hiện tồn = 0
  var map = {};
  layDanhSachDanhMucKho_().forEach(function(k) {
    if (tenKhoLoc && k.tenKho !== tenKhoLoc) return;
    if (tenNhaMayLoc && k.tenNhaMay !== tenNhaMayLoc) return;
    map[k.tenKho] = taoKhoiRong(k.tenKho, k.tenNhaMay);
  });

  function layOrTaoKho(tenKho) {
    if (map[tenKho]) return map[tenKho];
    if (tenKhoLoc && tenKho !== tenKhoLoc) return null;
    if (tenNhaMayLoc) return null; // kho ngoài danh mục: không xác định được nhà máy nên loại khi đang lọc theo nhà máy
    map[tenKho] = taoKhoiRong(tenKho, "(Ngoài danh mục)");
    return map[tenKho];
  }

  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheetGD = ss.getSheetByName(KHODAM_CONFIG.SHEET_GIAODICH);
  if (sheetGD && sheetGD.getLastRow() > 1) {
    var data = sheetGD.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][11]).trim() === "Đã hủy") continue;
      var dt = new Date(data[i][1]).getTime();
      if (dt > denTime) continue; // phát sinh sau kỳ báo cáo thì bỏ qua hoàn toàn

      var loaiPhieu = String(data[i][2]).trim();
      var hinhThuc = String(data[i][3]).trim();
      var kX = String(data[i][5]).trim();
      var kN = String(data[i][6]).trim();
      var mt = parseFloat(data[i][7]) || 0;
      var bdmt = parseFloat(data[i][10]) || 0;
      var laTonDau = dt < tuTime;
      var laTrongKy = dt >= tuTime && dt <= denTime;

      // QUAN TRỌNG: dùng cột "Loại" (NHẬP/XUẤT) làm căn cứ chính, không chỉ dựa vào cột nào có giá trị.
      // - Loại = NHẬP: chỉ tính là NHẬP cho Kho Nhập (kN). Bỏ qua kX kể cả khi có giá trị (phòng dữ liệu chỉnh tay sai).
      // - Loại = XUẤT: luôn tính là XUẤT cho Kho Xuất (kX). Nếu là Trung chuyển (TC) và có Kho Nhập hợp lệ
      //   thì CỘNG THÊM phần NHẬP cho kho đó (vì trung chuyển vừa là xuất khỏi kho này vừa là nhập vào kho kia).
      if (loaiPhieu === "NHẬP") {
        if (kN && kN !== "Không có") {
          var khoNhanNhap = layOrTaoKho(kN);
          if (khoNhanNhap) {
            if (laTonDau) { khoNhanNhap.tonDauMT += mt; khoNhanNhap.tonDauBDMT += bdmt; }
            if (laTrongKy) {
              khoNhanNhap.nhapKyMT += mt; khoNhanNhap.nhapKyBDMT += bdmt;
              if (!khoNhanNhap.nhapTheoHinhThuc[hinhThuc]) khoNhanNhap.nhapTheoHinhThuc[hinhThuc] = { mt: 0, bdmt: 0 };
              khoNhanNhap.nhapTheoHinhThuc[hinhThuc].mt += mt;
              khoNhanNhap.nhapTheoHinhThuc[hinhThuc].bdmt += bdmt;
            }
          }
        }
      } else if (loaiPhieu === "XUẤT") {
        if (kX && kX !== "Không có") {
          var khoGuiXuat = layOrTaoKho(kX);
          if (khoGuiXuat) {
            if (laTonDau) { khoGuiXuat.tonDauMT -= mt; khoGuiXuat.tonDauBDMT -= bdmt; }
            if (laTrongKy) {
              khoGuiXuat.xuatKyMT += mt; khoGuiXuat.xuatKyBDMT += bdmt;
              if (!khoGuiXuat.xuatTheoHinhThuc[hinhThuc]) khoGuiXuat.xuatTheoHinhThuc[hinhThuc] = { mt: 0, bdmt: 0 };
              khoGuiXuat.xuatTheoHinhThuc[hinhThuc].mt += mt;
              khoGuiXuat.xuatTheoHinhThuc[hinhThuc].bdmt += bdmt;
            }
          }
        }
        if (hinhThuc === "TC" && kN && kN !== "Không có") {
          var khoNhanTC = layOrTaoKho(kN);
          if (khoNhanTC) {
            if (laTonDau) { khoNhanTC.tonDauMT += mt; khoNhanTC.tonDauBDMT += bdmt; }
            if (laTrongKy) {
              khoNhanTC.nhapKyMT += mt; khoNhanTC.nhapKyBDMT += bdmt;
              if (!khoNhanTC.nhapTheoHinhThuc[hinhThuc]) khoNhanTC.nhapTheoHinhThuc[hinhThuc] = { mt: 0, bdmt: 0 };
              khoNhanTC.nhapTheoHinhThuc[hinhThuc].mt += mt;
              khoNhanTC.nhapTheoHinhThuc[hinhThuc].bdmt += bdmt;
            }
          }
        }
      }
    }
  }

  var ketQua = [];
  for (var key in map) {
    var it = map[key];
    var tonCuoiMT = it.tonDauMT + it.nhapKyMT - it.xuatKyMT;
    var tonCuoiBDMT = it.tonDauBDMT + it.nhapKyBDMT - it.xuatKyBDMT;
    ketQua.push({
      tenKho: it.tenKho,
      tenNhaMay: it.tenNhaMay,
      tonDauMT: it.tonDauMT,
      tonDauBDMT: it.tonDauBDMT,
      tonDauDoKho: it.tonDauMT > 0.0001 ? (it.tonDauBDMT / it.tonDauMT) : null,
      nhapKyMT: it.nhapKyMT,
      nhapKyBDMT: it.nhapKyBDMT,
      xuatKyMT: it.xuatKyMT,
      xuatKyBDMT: it.xuatKyBDMT,
      tonCuoiMT: tonCuoiMT,
      tonCuoiBDMT: tonCuoiBDMT,
      tonCuoiDoKho: tonCuoiMT > 0.0001 ? (tonCuoiBDMT / tonCuoiMT) : null,
      nhapTheoHinhThuc: _chuyenHinhThucThanhMang_(it.nhapTheoHinhThuc),
      xuatTheoHinhThuc: _chuyenHinhThucThanhMang_(it.xuatTheoHinhThuc)
    });
  }
  ketQua.sort(function(a, b) {
    if (a.tenNhaMay !== b.tenNhaMay) return a.tenNhaMay.localeCompare(b.tenNhaMay, 'vi');
    return a.tenKho.localeCompare(b.tenKho, 'vi');
  });

  return {
    tuNgay: tuNgayStr,
    denNgay: denNgayStr,
    tenKhoLoc: tenKhoLoc || "Tất cả",
    tenNhaMayLoc: tenNhaMayLoc || "Tất cả",
    khoList: layDanhSachTenKho_(),
    nhaMayList: layDanhSachTenNhaMay_(),
    chiTiet: ketQua
  };
}

// ==========================================
// BÁO CÁO THEO KỲ VÉT BÃI
// ==========================================

/**
 * Báo cáo tổng hợp Nhập/Xuất theo từng Kỳ Vét Bãi (cột "Đợt vét bãi" trong DATA_GIAODICH).
 * Mặc định khoảng thời gian: 3 tháng gần nhất. Có thể lọc theo 1 kho cụ thể.
 * @param {Object} [params]
 * @param {string} [params.tuNgay]
 * @param {string} [params.denNgay]
 * @param {string} [params.tenKho] - "Tất cả" hoặc bỏ trống = không lọc theo kho.
 */
function layBaoCaoTheoKyVetBai_(params) {
  kiemTraVaTaoTieuDeSheets_();
  params = params || {};
  var tuNgayStr = params.tuNgay || layNgay3ThangTruocStr_();
  var denNgayStr = params.denNgay || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var tenKhoLoc = (params.tenKho && params.tenKho !== "Tất cả") ? params.tenKho : null;

  var tuTime = new Date(tuNgayStr).setHours(0, 0, 0, 0);
  var denTime = new Date(denNgayStr).setHours(23, 59, 59, 999);

  var map = {};
  function layOrTaoKy(tenKy) {
    if (!map[tenKy]) map[tenKy] = { tenKy: tenKy, nhapMT: 0, nhapBDMT: 0, xuatMT: 0, xuatBDMT: 0, soPhieuNhap: 0, soPhieuXuat: 0 };
    return map[tenKy];
  }

  var ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
  var sheetGD = ss.getSheetByName(KHODAM_CONFIG.SHEET_GIAODICH);
  if (sheetGD && sheetGD.getLastRow() > 1) {
    var data = sheetGD.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][11]).trim() === "Đã hủy") continue;
      var dt = new Date(data[i][1]).getTime();
      if (dt < tuTime || dt > denTime) continue;

      var loaiVal = String(data[i][2]).trim();
      var kX = String(data[i][5]).trim();
      var kN = String(data[i][6]).trim();
      var tenKy = String(data[i][4]).trim() || "Mặc định";
      var mt = parseFloat(data[i][7]) || 0;
      var bdmt = parseFloat(data[i][10]) || 0;

      if (loaiVal === "NHẬP") {
        if (tenKhoLoc && kN !== tenKhoLoc) continue;
        var kyN = layOrTaoKy(tenKy);
        kyN.nhapMT += mt; kyN.nhapBDMT += bdmt; kyN.soPhieuNhap++;
      } else if (loaiVal === "XUẤT") {
        if (tenKhoLoc && kX !== tenKhoLoc) continue;
        var kyX = layOrTaoKy(tenKy);
        kyX.xuatMT += mt; kyX.xuatBDMT += bdmt; kyX.soPhieuXuat++;
      }
    }
  }

  // Sắp xếp theo đúng thứ tự thời gian thực tế của kỳ vét bãi; kỳ không xác định được xếp cuối
  var arrKyCache = taiDanhSachKyVetBaiCache_();
  var thuTu = {};
  arrKyCache.forEach(function(k, idx) { thuTu[k.tenKy] = idx; });

  var ketQua = [];
  for (var key in map) {
    var it = map[key];
    ketQua.push({
      tenKy: it.tenKy,
      nhapMT: it.nhapMT, nhapBDMT: it.nhapBDMT,
      xuatMT: it.xuatMT, xuatBDMT: it.xuatBDMT,
      chenhLechMT: it.nhapMT - it.xuatMT,
      chenhLechBDMT: it.nhapBDMT - it.xuatBDMT,
      soPhieuNhap: it.soPhieuNhap, soPhieuXuat: it.soPhieuXuat
    });
  }
  ketQua.sort(function(a, b) {
    var ia = (thuTu[a.tenKy] !== undefined) ? thuTu[a.tenKy] : 9999;
    var ib = (thuTu[b.tenKy] !== undefined) ? thuTu[b.tenKy] : 9999;
    return ia - ib;
  });

  return {
    tuNgay: tuNgayStr,
    denNgay: denNgayStr,
    tenKhoLoc: tenKhoLoc || "Tất cả",
    khoList: layDanhSachTenKho_(),
    chiTiet: ketQua
  };
}

// GHI CHÚ (đã đánh giá, CHỦ Ý giữ nguyên): processFormData và các hàm nó gọi
// (xuLyDanhMucKho, xuLyKyVetBai, xuLySuaXoaDoKho, xuLySuaXoaGiaoDich,
// KD_taoPhieuDieuChinhTuDong...) trả về CHUỖI có tiền tố emoji ("✅ ...",
// "❌ ...") thay vì object {status, message} như quy ước mọi module khác
// trong hệ thống. ĐÃ CÂN NHẮC đổi lại cho đồng bộ, nhưng KHÔNG thực hiện vì
// rủi ro cao hơn lợi ích: toàn bộ ~20 điểm gọi ở phía Index.html (module Kho
// Dăm) đang dùng google.script.run.withSuccessHandler(res => alert(res)...)
// - đọc res NHƯ 1 CHUỖI trực tiếp - nên đổi định dạng trả về ở đây bắt buộc
// phải sửa ĐỒNG THỜI toàn bộ các điểm gọi đó, và không thể kiểm thử trực tiếp
// trên Google Sheet thật đang chạy để xác nhận không bỏ sót. Vì hàm hiện tại
// KHÔNG có lỗi hành vi (chỉ là quy ước khác), giữ nguyên để tránh rủi ro làm
// hỏng module Kho Dăm đang chạy thật - chỉ mới nơi nào MỚI thêm/sửa (VD
// PHẦN 6 dùng sanitize()) mới cần tuân theo quy ước {status,message}.
function processFormData_(action, data) {
  kiemTraVaTaoTieuDeSheets_();
  var lock = LockService.getScriptLock();
  // STUCK-02: khóa bị người khác giữ quá lâu -> báo "đang bận" dễ hiểu (trước đây
  // hiện nguyên văn lỗi tiếng Anh "Lock timeout...") như mọi hàm ghi khác.
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); } catch (e) {
    return "❌ Hệ thống đang bận xử lý một yêu cầu khác, vui lòng thử lại sau ít giây.";
  }
  try {
    var ketQua;
    if (action === "Danhmuckho") ketQua = xuLyDanhMucKho_(data);
    else if (action === "Thongsokho") ketQua = xuLyKyVetBai_(data);
    else if (action === "Nhapdokho") ketQua = xuLySuaXoaDoKho_(data);
    else if (action === "Nhapkho" || action === "Xuatkho") ketQua = xuLySuaXoaGiaoDich_(data);
    else if (action === "Hoanthanhdonhang") ketQua = xuLyHoanThanhDonHangXuatBan_(data);
    else if (action === "HoanthanhTuDong") ketQua = KD_taoPhieuDieuChinhTuDong_(data);
    else if (action === "Baocaotonkho") ketQua = layBaoCaoTonKho_(data);
    else if (action === "BaocaoKyVetBai") ketQua = layBaoCaoTheoKyVetBai_(data);
    // BUG-002: chỉ CẢNH BÁO (không chặn) nếu cột sheet Kho Dăm bị chèn/xóa/đổi thủ công
    if (typeof ketQua === "string" && ketQua.indexOf("❌") !== 0) {
      var canhBaoHeaderKD = KD_canhBaoLechHeader_(action);
      if (canhBaoHeaderKD) ketQua += " | " + canhBaoHeaderKD;
    }
    // Ghi audit cho các hành động THAY ĐỔI dữ liệu (bỏ qua các hành động chỉ ĐỌC báo cáo)
    if (["Danhmuckho","Thongsokho","Nhapdokho","Nhapkho","Xuatkho","Hoanthanhdonhang","HoanthanhTuDong"].indexOf(action) !== -1) {
      var thanhCong = !(typeof ketQua === "string" && ketQua.indexOf("❌") === 0);
      logAudit_("KHODAM_" + action.toUpperCase(), thanhCong ? "OK" : "ERROR", typeof ketQua === "string" ? ketQua : JSON.stringify(data));
    }
    return ketQua;
  } catch (e) {
    logAudit_("KHODAM_" + String(action).toUpperCase(), "ERROR", e.toString());
    return "❌ Lỗi: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}

// BUG-002: sheet Kho Dăm mà mỗi hành động ghi vào, kèm số cột hệ thống dùng theo vị trí.
var KD_SHEET_THEO_HANH_DONG_ = {
  Danhmuckho: ["SHEET_DANHMUCKHO", 5], Thongsokho: ["SHEET_CAUHINH", 4], Nhapdokho: ["SHEET_NHAPDOKHO", 5],
  Nhapkho: ["SHEET_GIAODICH", 14], Xuatkho: ["SHEET_GIAODICH", 14],
  Hoanthanhdonhang: ["SHEET_GIAODICH", 14], HoanthanhTuDong: ["SHEET_GIAODICH", 14]
};
function KD_canhBaoLechHeader_(action) {
  var m = KD_SHEET_THEO_HANH_DONG_[action];
  if (!m) return "";
  try {
    var ten = KHODAM_CONFIG[m[0]];
    return kiemTraLechHeaderSheet_(SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID).getSheetByName(ten), ten, m[1]);
  } catch (e) { return ""; }
}

/*********************************************************
 * PHẦN 7: XUẤT HÀNG - IMPORT PHIẾU CÂN XUẤT (NL_PC_XH) &
 *         NHẬP LIỆU ĐƠN HÀNG XUẤT BÁN (NL_DH_XB) (MENU 1)
 * - Spreadsheet RIÊNG: XUATHANG_CONFIG.SPREADSHEET_ID (xem Config.gs).
 * - Luồng Import giống hệt "Import phiếu cân" (PhieuCan_DN): Xem trước ->
 *   XUATHANG_CONFIG.SHEET_NLPCXH_DRAFT (sheet tạm để đối soát) -> chọn dòng ->
 *   Xác nhận -> ghi vào XUATHANG_CONFIG.SHEET_NLPCXH (chính thức).
 * - LƯU Ý: File import phải theo ĐÚNG cấu trúc 16 cột của XUATHANG_CONFIG.
 *   SHEET_NLPCXH (Số phiếu, Ngày giờ cân 1, Ngày giờ cân 2, Biển số 1, Cân lần
 *   1, Cân lần 2, KL Hàng (KG), Đơn vị vận chuyển, Tên tài xế, Khối lượng
 *   (Tấn), Ngày xuất, Số BKLS, Khối lượng (M3), NGƯỜI CÂN, SỐ TKHQ, TÀU XUẤT) -
 *   không còn đoán mò định dạng "kiểu cân Xuất" của trạm cân nữa. Có file mẫu
 *   tải sẵn qua hàm taiFileMauImport('XUATHANG') / nút "Tải file mẫu" trên
 *   giao diện, để người chuẩn bị dữ liệu biết chính xác cột nào cần điền.
 *   Đọc cột vẫn tìm THEO TÊN TIÊU ĐỀ (không theo vị trí cố định) để chấp
 *   nhận sai khác nhỏ về thứ tự cột, miễn tên tiêu đề đúng như trên.
 *********************************************************/

function XH_ss_() { return SpreadsheetApp.openById(XUATHANG_CONFIG.SPREADSHEET_ID); }

// Đảm bảo sheet NL_DH_XB có đủ cột "Kho xuất" (cột P, mới thêm theo yêu cầu) -
// sheet gốc người dùng cung cấp chỉ có 15 cột (A..O), gọi hàm này 1 lần trước
// khi ghi/đọc để tự bổ sung header cột 16 nếu còn thiếu, không cần chỉnh tay.
function XH_dambaoHeaderDonHang_() {
  const sheet = XH_ss_().getSheetByName(XUATHANG_CONFIG.SHEET_DHXB);
  if (!sheet) return;
  const hienTai = sheet.getRange(1, 16).getValue();
  if (!hienTai) sheet.getRange(1, 16).setValue("Kho xuất").setFontWeight("bold");
}

// Đảm bảo sheet NL_PC_XH có đúng cấu trúc cột MỚI: cột P đổi tên từ "TÀU XUẤT"
// (chưa từng có dữ liệu, đã xác nhận an toàn) thành "Kho xuất", và thêm cột Q
// mới "Kho nhập". Cột O (SỐ TKHQ) giữ NGUYÊN, không đụng tới. Idempotent - gọi
// nhiều lần không sao, chỉ đổi khi tiêu đề còn là "TÀU XUẤT"/rỗng.
function XH_dambaoHeaderPhieuCanXuat_() {
  const sheet = XH_ss_().getSheetByName(XUATHANG_CONFIG.SHEET_NLPCXH);
  if (!sheet) return;
  const headerP = String(sheet.getRange(1, 16).getValue() || "").trim();
  if (headerP === "" || headerP.toUpperCase() === "TÀU XUẤT") {
    sheet.getRange(1, 16).setValue("Kho xuất").setFontWeight("bold");
  }
  const headerQ = String(sheet.getRange(1, 17).getValue() || "").trim();
  if (headerQ === "") {
    sheet.getRange(1, 17).setValue("Kho nhập").setFontWeight("bold");
  }
}

// Tên tiêu đề CÓ THỂ gặp cho từng trường (ưu tiên khớp đúng tên NL_PC_XH trước)
const XH_HEADER_ALIASES_ = {
  soPhieu: ["Số phiếu"],
  ngayCan1: ["Ngày giờ cân 1"],
  ngayCan2: ["Ngày giờ cân 2"],
  bienSo: ["Biển số 1"],
  canLan1: ["Cân lần 1"],
  canLan2: ["Cân lần 2"],
  klHang: ["KL Hàng (KG)", "KL Hàng(KG)", "KL Hàng"],
  donViVanChuyen: ["Đơn vị vận chuyển"],
  tenTaiXe: ["Tên tài xế"],
  khoiLuongTan: ["Khối lượng (Tấn)", "Khối lượng(Tấn)"],
  ngayXuat: ["Ngày xuất"],
  soBKLS: ["Số BKLS"],
  khoiLuongM3: ["Khối lượng (M3)", "Khối lượng(M3)"],
  nguoiCan: ["NGƯỜI CÂN", "Người cân 1", "Người cân"],
  soTKHQ: ["SỐ TKHQ", "Số TKHQ"],
  khoXuat: ["Kho xuất", "KHO XUẤT"],
  khoNhap: ["Kho nhập", "KHO NHẬP"]
};

function XH_timCotTheoTen_(headerRow) {
  const map = {};
  headerRow.forEach((cell, idx) => {
    const ten = String(cell || "").trim();
    if (!ten) return;
    for (const key in XH_HEADER_ALIASES_) {
      if (map[key] !== undefined) continue; // đã tìm thấy rồi thì thôi, ưu tiên cột xuất hiện trước
      if (XH_HEADER_ALIASES_[key].some(alias => alias.toLowerCase() === ten.toLowerCase())) {
        map[key] = idx;
      }
    }
  });
  return map;
}

// FIX #25 (NGHIÊM TRỌNG): cùng lỗi mất dữ liệu multi-file như step1_PreviewDraft
// (xem comment ở đó) - nay cũng nhận MỘT MẢNG file (fileDataList) và gộp kết
// quả tất cả các file trong 1 lần gọi, thay vì chỉ xử lý đúng 1 file.
function XH_step1_PreviewDraft_(fileDataList, khoXuatMacDinh, khoNhapMacDinh) {
  try {
    const danhSachFile = (Array.isArray(fileDataList) ? fileDataList : [fileDataList]).filter(f => f && f.base64);
    if (danhSachFile.length === 0) return { status: "error", message: "Không có file để xử lý." };

    const ss = XH_ss_();
    const dataSheet = ss.getSheetByName(XUATHANG_CONFIG.SHEET_NLPCXH);
    const lastRow = dataSheet.getLastRow();
    const duplicateMap = new Map();
    if (lastRow > 0) {
      const existingData = dataSheet.getRange(1, 1, lastRow, 1).getValues();
      existingData.forEach(row => {
        const key = String(row[0] || "").trim();
        if (key) duplicateMap.set(key, true);
      });
    }

    let previewRows = [];
    const seenInThisBatch = new Set();
    const fileLoi = [];

    danhSachFile.forEach(fileData => {
      try {
        // FIX #23: Lưu file gốc THẲNG vào thư mục Done ngay khi tải lên (đơn giản
        // hóa - bỏ hẳn thư mục Input trung gian, không quét lại cả thư mục, không
        // cần "Dọn dẹp" thủ công, không cần di chuyển file ở bước Xác nhận nữa).
        // File gốc được lưu trữ làm bằng chứng NGAY LẬP TỨC, không phụ thuộc việc
        // sau đó người dùng có bấm Xác nhận hay không - đơn giản và an toàn hơn.
        const blob = Utilities.newBlob(Utilities.base64Decode(fileData.base64), fileData.mimeType, fileData.name);
        DriveApp.getFolderById(CONFIG.FOLDER_DONE).createFile(blob);

        // Convert TẠM đúng file vừa tải lên để đọc dữ liệu - đọc xong xóa NGAY bản
        // convert tạm (không đụng gì đến file gốc đã lưu trong Done ở trên).
        const tempFile = convertXlsxToTempSheet_(blob, "TMP_XH_" + fileData.name);
        try {
          const values = SpreadsheetApp.openById(tempFile.id).getSheets()[0].getDataRange().getValues();
          let hIdx = values.findIndex(r => r.some(c => String(c).toLowerCase().includes("số phiếu")));
          if (hIdx === -1) { fileLoi.push({ name: fileData.name, reason: "Không tìm thấy dòng tiêu đề (cột 'Số phiếu')" }); return; }

          const cotMap = XH_timCotTheoTen_(values[hIdx]);
          if (cotMap.soPhieu === undefined || cotMap.ngayCan1 === undefined) {
            fileLoi.push({ name: fileData.name, reason: "Thiếu cột bắt buộc (Số phiếu / Ngày giờ cân 1)" });
            return;
          }

          const rowsToProcess = values.slice(hIdx + 1);
          for (let r of rowsToProcess) {
            const spRaw = String(r[cotMap.soPhieu] || "").trim();
            if (!spRaw || spRaw.toLowerCase().includes("ngày") || spRaw.toLowerCase().includes("tổng") || spRaw.length > 20) continue;

            const klHangRaw = cotMap.klHang !== undefined ? r[cotMap.klHang] : null;
            // FIX #16: dùng parseSoTheoLocale_() (Config.gs) thay vì regex "mù"
            let klHang = parseSoTheoLocale_(klHangRaw);
            if (!klHangRaw || isNaN(klHang) || klHang === 0) continue;
            // FIX M-15 (thống nhất đơn vị Kg với Import phiếu cân nhập): số < 70 hiểu là
            // Tấn -> quy ra Kg; Cân lần 1/2 đọc theo Locale (trước đây parseFloat thường,
            // "27.020" kiểu VN bị hiểu thành 27,02).
            const quyRaKg_ = function (v) { return v < 70 ? v * 1000 : v; };
            klHang = quyRaKg_(klHang);
            const canLan1Kg = cotMap.canLan1 !== undefined ? quyRaKg_(parseSoTheoLocale_(r[cotMap.canLan1]) || 0) : 0;
            const canLan2Kg = cotMap.canLan2 !== undefined ? quyRaKg_(parseSoTheoLocale_(r[cotMap.canLan2]) || 0) : 0;

            let dateC = toDateObj_(r[cotMap.ngayCan1]);
            let dateD = cotMap.ngayCan2 !== undefined ? toDateObj_(r[cotMap.ngayCan2]) : null;

            let now = new Date();
            let nam = dateC ? dateC.getFullYear() : now.getFullYear();
            let currentMaChungTu = spRaw + "/" + nam + "/XK";

            let isError = false; let errorMsg = "";
            if (!dateC || isNaN(dateC.getTime())) { isError = true; errorMsg += "Lỗi Ngày Cân 1. "; }
            if (cotMap.ngayCan2 !== undefined && (!dateD || isNaN(dateD.getTime()))) { isError = true; errorMsg += "Lỗi Ngày Cân 2. "; }

            if (seenInThisBatch.has(currentMaChungTu)) {
              isError = true;
              errorMsg += "Trùng Số Chứng Từ ngay trong dữ liệu đang nạp (" + currentMaChungTu + "). ";
            } else {
              seenInThisBatch.add(currentMaChungTu);
            }

            let typeImport = duplicateMap.has(currentMaChungTu) ? "Bỏ qua (Đã tồn tại)" : "Mới";

            let ngayXuat = null;
            if (cotMap.ngayXuat !== undefined) ngayXuat = toDateObj_(r[cotMap.ngayXuat]);

            // Kho xuất/Kho nhập: ưu tiên lấy TỪ FILE nếu người chuẩn bị dữ liệu đã
            // điền theo đúng cột (Kho xuất/Kho nhập); nếu file không có 2 cột này,
            // dùng giá trị mặc định áp dụng cho CẢ LÔ do người dùng chọn trước khi tải lên.
            const khoXuatRow = cotMap.khoXuat !== undefined ? String(r[cotMap.khoXuat] || "").trim() : "";
            const khoNhapRow = cotMap.khoNhap !== undefined ? String(r[cotMap.khoNhap] || "").trim() : "";

            previewRows.push({
              isError: isError, errorMsg: errorMsg.trim(), typeImport: typeImport, uniqueKey: currentMaChungTu,
              soPhieu: spRaw,
              ngayCan1: dateC ? dinhDangGMT7_(dateC, "dd/MM/yyyy") : "Lỗi định dạng ngày",
              gioCan1: dateC ? dinhDangGMT7_(dateC, "HH:mm:ss") : "",
              ngayCan2: dateD ? dinhDangGMT7_(dateD, "dd/MM/yyyy") : (cotMap.ngayCan2 !== undefined ? "Lỗi định dạng ngày" : ""),
              gioCan2: dateD ? dinhDangGMT7_(dateD, "HH:mm:ss") : "",
              bienSo: cotMap.bienSo !== undefined ? String(r[cotMap.bienSo] || "").trim() : "",
              canLan1: canLan1Kg,
              canLan2: canLan2Kg,
              klHang: klHang,
              donViVanChuyen: cotMap.donViVanChuyen !== undefined ? String(r[cotMap.donViVanChuyen] || "").trim() : "",
              tenTaiXe: cotMap.tenTaiXe !== undefined ? String(r[cotMap.tenTaiXe] || "").trim() : "",
              nguoiCan: cotMap.nguoiCan !== undefined ? String(r[cotMap.nguoiCan] || "").trim() : "",
              // Các cột đặc thù NL_PC_XH - có gì lấy nấy, không có thì để trống (điền bổ sung sau khi đối chiếu đơn hàng)
              khoiLuongTan: cotMap.khoiLuongTan !== undefined ? (parseFloat(r[cotMap.khoiLuongTan]) || (klHang / 1000)) : (klHang / 1000),
              soBKLS: cotMap.soBKLS !== undefined ? String(r[cotMap.soBKLS] || "").trim() : "",
              khoiLuongM3: cotMap.khoiLuongM3 !== undefined ? (parseFloat(r[cotMap.khoiLuongM3]) || "") : "",
              soTKHQ: cotMap.soTKHQ !== undefined ? String(r[cotMap.soTKHQ] || "").trim() : "",
              khoXuat: khoXuatRow || String(khoXuatMacDinh || "").trim(),
              khoNhap: khoNhapRow || String(khoNhapMacDinh || "").trim(),
              rawDateC: dateC ? dateC.toISOString() : "", rawDateD: dateD ? dateD.toISOString() : "",
              rawNgayXuat: ngayXuat ? ngayXuat.toISOString() : ""
            });
          }
        } finally {
          Drive.Files.remove(tempFile.id);
        }
      } catch (eFile) {
        // FIX #24: Nếu là lỗi tạm thời từ Google (Internal Error khi convert file)
        // đã thử lại 3 lần vẫn thất bại - ghi rõ đây là lỗi PHÍA GOOGLE cho riêng
        // file này, KHÔNG làm hỏng việc xử lý các file còn lại trong cùng lượt.
        const thongBaoLoiFile = eFile.toString();
        const laLoiTamThoiGoogle = /internal error|backend error/i.test(thongBaoLoiFile);
        fileLoi.push({
          name: fileData.name,
          reason: laLoiTamThoiGoogle
            ? "Google gặp sự cố tạm thời khi chuyển đổi file (đã tự thử lại 3 lần) - vui lòng thử tải lại riêng file này sau ít phút."
            : thongBaoLoiFile
        });
      }
    });

    // Sheet Draft để đối soát (ghi cùng lúc, tách biệt hoàn toàn với PhieuCan_DN) - xóa cũ ghi mới, không tạo file
    if (previewRows.length > 0) {
      const draftSheet = ss.getSheetByName(XUATHANG_CONFIG.SHEET_NLPCXH_DRAFT);
      if (draftSheet) {
        if (draftSheet.getLastRow() > 1) draftSheet.getRange(2, 1, draftSheet.getLastRow() - 1, 16).clearContent();
        const draftHeaders = ["Trạng Thái", "Mã Chứng Từ", "Số Phiếu", "Số Xe", "Ngày Cân 1", "Giờ Cân 1", "Ngày Cân 2", "Giờ Cân 2", "Cân Lần 1", "Cân Lần 2", "KL Hàng (Kg)", "Đơn Vị Vận Chuyển", "Tên Tài Xế", "Số TKHQ", "Kho Xuất", "Kho Nhập"];
        draftSheet.getRange(1, 1, 1, draftHeaders.length).setValues([draftHeaders]).setFontWeight("bold").setBackground("#cfe2ff");
        draftSheet.getRange(2, 2, previewRows.length, 7).setNumberFormat("@"); // ép Text cột B..H (Mã CT..Giờ Cân 2), tránh Sheets tự đoán lại theo Locale
        const draftValues = previewRows.map(row => [
          row.isError ? "❌ " + row.errorMsg : "✔️ " + row.typeImport, row.uniqueKey, row.soPhieu, row.bienSo,
          row.ngayCan1, row.gioCan1, row.ngayCan2, row.gioCan2, row.canLan1, row.canLan2, row.klHang, row.donViVanChuyen, row.tenTaiXe,
          row.soTKHQ, row.khoXuat, row.khoNhap
        ]);
        draftSheet.getRange(2, 1, draftValues.length, draftHeaders.length).setValues(draftValues);
        draftSheet.getRange(2, 9, draftValues.length, 3).setNumberFormat("#,##0");
      }
    }

    if (previewRows.length === 0 && fileLoi.length > 0) {
      return { status: "error", message: "Không đọc được dữ liệu từ file nào: " + fileLoi.map(f => f.name + " (" + f.reason + ")").join("; ") };
    }

    let canhBao = "";
    if (fileLoi.length > 0) {
      canhBao = "⚠️ " + fileLoi.length + " file bị bỏ qua: " + fileLoi.map(f => f.name + " - " + f.reason).join("; ");
    }
    return { status: "success", data: previewRows, canhBao: canhBao };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function XH_step1_ConfirmImport_(confirmedDataList) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", message: "Hệ thống đang bận xử lý một yêu cầu khác, vui lòng thử lại sau ít giây." };
  }
  try {
    XH_dambaoHeaderPhieuCanXuat_();
    const ss = XH_ss_();
    const dataSheet = ss.getSheetByName(XUATHANG_CONFIG.SHEET_NLPCXH);
    const lastRow = dataSheet.getLastRow();
    // FIX (bảo vệ chống lệch cột): xem giải thích ở step1_ConfirmImport (PHẦN 1)
    const _canhBaoHeaderXH = kiemTraLechHeaderSheet_(dataSheet, "NL_PC_XH", 17);

    const existingKeys = new Set();
    if (lastRow > 0) {
      dataSheet.getRange(1, 1, lastRow, 1).getValues().forEach(row => {
        const k = String(row[0] || "").trim();
        if (k) existingKeys.add(k);
      });
    }

    let countNew = 0, countSkip = 0; const batchNew = []; const seenThisBatch = new Set();

    for (let item of confirmedDataList) {
      if (item.isError) continue;
      if (existingKeys.has(item.uniqueKey) || seenThisBatch.has(item.uniqueKey)) { countSkip++; continue; }
      seenThisBatch.add(item.uniqueKey);

      const dateC = item.rawDateC ? new Date(item.rawDateC) : null;
      const dateD = item.rawDateD ? new Date(item.rawDateD) : null;
      const ngayXuat = item.rawNgayXuat ? new Date(item.rawNgayXuat) : null;
      const ngayCan1Str = dateC ? dinhDangGMT7_(dateC, "dd/MM/yyyy HH:mm:ss") : "";
      const ngayCan2Str = dateD ? dinhDangGMT7_(dateD, "dd/MM/yyyy HH:mm:ss") : "";
      const klTan = parseFloat(item.khoiLuongTan) || ((parseFloat(item.klHang) || 0) / 1000);

      // Khớp đúng 17 cột của NL_PC_XH (A..Q): cột O = Số TKHQ (không đổi), cột P
      // = Kho xuất (thay cho "TÀU XUẤT" cũ - đã xác nhận chưa từng có dữ liệu
      // nên an toàn để tái sử dụng), cột Q = Kho nhập (cột MỚI thêm).
      // FIX (Sanitize): áp dụng sanitize() cho toàn bộ trường văn bản đến từ
      // file Excel tải lên (chống Formula/CSV Injection) - sanitize() không ảnh
      // hưởng các giá trị số (trả nguyên giá trị nếu không phải chuỗi), nên an
      // toàn kết hợp với setNumberFormat("@") của Số TKHQ/Số BKLS bên dưới.
      batchNew.push([
        item.uniqueKey, ngayCan1Str, ngayCan2Str, sanitize_(item.bienSo || ""),
        parseFloat(item.canLan1) || 0, parseFloat(item.canLan2) || 0, parseFloat(item.klHang) || 0,
        sanitize_(item.donViVanChuyen || ""), sanitize_(item.tenTaiXe || ""), klTan,
        ngayXuat || "", sanitize_(item.soBKLS || ""), sanitize_(item.khoiLuongM3 || ""), sanitize_(item.nguoiCan || ""),
        sanitize_(item.soTKHQ || ""), sanitize_(item.khoXuat || ""), sanitize_(item.khoNhap || "")
      ]);
      countNew++;
    }

    if (batchNew.length > 0) {
      const startRowXH = dataSheet.getLastRow() + 1;
      // FIX #17: Khóa Text cho các cột MÃ dạng chuỗi số dài (Số TKHQ - cột O,
      // Số BKLS - cột L) TRƯỚC KHI ghi giá trị - nếu để Google Sheets tự nhận
      // diện lúc ghi, các mã này có thể bị CHUYỂN THÀNH SỐ và hiển thị dạng
      // khoa học (VD "1.02345E+11") hoặc mất số 0 đứng đầu, làm sai lệch khi
      // đối chiếu với chứng từ hải quan. Đặt định dạng SAU khi ghi sẽ QUÁ TRỄ
      // vì Sheets có thể đã tự chuyển đổi giá trị ngay tại thời điểm ghi.
      dataSheet.getRange(startRowXH, 15, batchNew.length, 1).setNumberFormat("@"); // Số TKHQ
      dataSheet.getRange(startRowXH, 12, batchNew.length, 1).setNumberFormat("@"); // Số BKLS
      dataSheet.getRange(startRowXH, 1, batchNew.length, 17).setValues(batchNew);
    }

    // FIX #23: không còn cần quét thư mục Input di chuyển file nữa - file gốc
    // đã được XH_step1_PreviewDraft lưu thẳng vào Done ngay từ bước Xem trước.

    const finalMsg = `Mới: ${countNew}, Bỏ qua (đã tồn tại/trùng): ${countSkip}`;
    logAudit_("IMPORT_XUATHANG", "OK", finalMsg);
    return { status: "success", message: finalMsg + (_canhBaoHeaderXH ? " | " + _canhBaoHeaderXH : "") };
  } catch (e) {
    logAudit_("IMPORT_XUATHANG", "ERROR", e.toString());
    return { status: "error", message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Nhập liệu Đơn Hàng Xuất Bán (NL_DH_XB) ---------- */

// Danh sách Kho xuất - tái sử dụng danh mục kho của module Kho Dăm
function XH_getKhoXuatList_() {
  try { return { status: "success", data: layDanhSachTenKho_() }; }
  catch (e) { return { status: "error", message: e.toString() }; }
}

// Độ khô nhà máy = độ khô TRUNG BÌNH của "hàng nhập sản xuất" (sheet Nhapdokho
// của module Kho Dăm) trong khoảng [tuNgay, denNgay]. Chỉ tính các dòng "Hợp lệ".
function XH_tinhDoKhoNhaMay_(tuNgay, denNgay) {
  try {
    if (!tuNgay || !denNgay) return { status: "error", message: "Vui lòng chọn đủ Từ ngày và Đến ngày." };
    const ss = SpreadsheetApp.openById(KHODAM_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(KHODAM_CONFIG.SHEET_NHAPDOKHO);
    if (!sheet || sheet.getLastRow() <= 1) return { status: "success", doKho: null, soNgay: 0, message: "Chưa có dữ liệu độ khô." };

    const data = sheet.getDataRange().getValues();
    const tuDate = new Date(tuNgay + "T00:00:00");
    const denDate = new Date(denNgay + "T23:59:59");
    let tong = 0, dem = 0;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][4] || "").trim() === "Đã hủy") continue;
      const ngayRow = data[i][0];
      if (!(ngayRow instanceof Date) || isNaN(ngayRow.getTime())) continue;
      if (ngayRow < tuDate || ngayRow > denDate) continue;
      const dk = parseFloat(data[i][2]);
      if (isNaN(dk)) continue;
      tong += dk; dem++;
    }

    if (dem === 0) return { status: "success", doKho: null, soNgay: 0, message: "Không có dữ liệu độ khô trong khoảng ngày đã chọn." };
    return { status: "success", doKho: tong / dem, soNgay: dem, message: "Trung bình " + dem + " ngày có ghi nhận độ khô." };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// payload: {ngayDonHang, soTKHQ, tau, khachHang, diaChiKH, tenHangHoa, donGiaUSD,
//           klMT, klBDMT, khoXuat, tuNgay, denNgay, doKhoNhaMay, loaiXe}
function XH_saveDonHang_(payload) {
  XH_dambaoHeaderDonHang_();
  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); } catch (e) {
    return { status: "error", message: "Hệ thống đang bận, vui lòng thử lại." };
  }
  try {
    payload = payload || {};
    if (!payload.ngayDonHang) return { status: "error", message: "Vui lòng chọn Ngày đơn hàng." };
    if (!String(payload.khachHang || "").trim()) return { status: "error", message: "Vui lòng nhập Khách hàng." };
    const klMT = parseFloat(payload.klMT) || 0;
    if (klMT <= 0) return { status: "error", message: "KL_MT phải lớn hơn 0." };
    // FIX: KL_BDMT không còn nhập tay - tự tính = KL_MT × Độ khô (theo đúng công
    // thức nghiệp vụ KL_MT × ĐỘ KHÔ = KL_BDMT). "Độ khô" ở đây là độ khô THỰC TẾ
    // áp dụng cho riêng lô hàng này (payload.doKho, dạng %), KHÁC với "Độ khô
    // nhà máy" (chỉ là số tham chiếu trung bình, không dùng để tính KL_BDMT).
    let doKho = parseFloat(payload.doKho) || 0;
    if (doKho > 1) doKho = doKho / 100; // cho phép nhập 39.45 hoặc 0.3945 đều ra đúng tỷ lệ
    if (doKho <= 0) return { status: "error", message: "Vui lòng nhập Độ khô > 0 để tính KL_BDMT." };
    const klBDMT = klMT * doKho;
    const doKhoTinh = doKho;

    const sheet = XH_ss_().getSheetByName(XUATHANG_CONFIG.SHEET_DHXB);
    const lastRow = sheet.getLastRow();
    // STT = STT lớn nhất hiện có + 1. TRƯỚC ĐÂY dùng số dòng (lastRow) nên sau
    // khi xóa 1 đơn ở giữa, đơn mới bị TRÙNG STT với đơn cuối - mà STT là khóa
    // để Sửa/Xóa đúng đơn (xem XH_timDongDonHang_).
    let stt = 1;
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function (r) {
        const n = parseInt(r[0], 10);
        if (!isNaN(n) && n >= stt) stt = n + 1;
      });
    }
    // FIX (bảo vệ chống lệch cột): xem giải thích ở step1_ConfirmImport (PHẦN 1)
    const _canhBaoHeaderDH = kiemTraLechHeaderSheet_(sheet, "NL_DH_XB", 16);

    const loaiXe = String(payload.loaiXe || "Y").toUpperCase() === "N" ? "N" : "Y";

    // FIX #17: Khóa Text cột Số TKHQ (cột C) TRƯỚC KHI ghi - tránh Google
    // Sheets tự chuyển thành số (mất số 0 đầu / hiển thị dạng khoa học nếu là
    // chuỗi số dài). Phải tính trước đúng dòng đích vì appendRow() không cho
    // biết trước dòng sẽ ghi vào.
    const targetRowDH = sheet.getLastRow() + 1;
    sheet.getRange(targetRowDH, 3, 1, 1).setNumberFormat("@");

    // FIX (Sanitize): áp dụng sanitize() cho toàn bộ trường văn bản tự do (chống
    // Formula/CSV Injection - TRƯỚC ĐÂY module Xuất hàng không dùng sanitize()
    // dù ghi thẳng text người dùng nhập vào sổ sách, khác với module Kho Dăm).
    sheet.appendRow([
      stt, new Date(payload.ngayDonHang), sanitize_(String(payload.soTKHQ || "").trim()), sanitize_(String(payload.tau || "").trim()),
      sanitize_(String(payload.khachHang || "").trim()), sanitize_(String(payload.diaChiKH || "").trim()), sanitize_(String(payload.tenHangHoa || "").trim()),
      parseFloat(payload.donGiaUSD) || 0, klMT, klBDMT, doKhoTinh,
      parseFloat(payload.doKhoNhaMay) || 0, sanitize_(String(payload.tuNgay || "")), sanitize_(String(payload.denNgay || "")), loaiXe, // FIX M-05: chống công thức
      sanitize_(String(payload.khoXuat || "").trim())
    ]);
    sheet.getRange(sheet.getLastRow(), 2).setNumberFormat(REGION_FORMAT_().DATE_FMT);

    logAudit_("XUATHANG_DONHANG", "OK", "Thêm đơn hàng xuất bán: " + payload.khachHang + " - " + payload.tau);
    return { status: "success", message: "✅ Đã lưu đơn hàng xuất bán." + (_canhBaoHeaderDH ? " | " + _canhBaoHeaderDH : "") };
  } catch (e) {
    logAudit_("XUATHANG_DONHANG", "ERROR", e.toString());
    return { status: "error", message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function XH_getDonHangList_() {
  try {
    XH_dambaoHeaderDonHang_();
    const sheet = XH_ss_().getSheetByName(XUATHANG_CONFIG.SHEET_DHXB);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { status: "success", data: [] };
    const data = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
    // FIX: định dạng đúng NL_Từ ngày/NL_Đến ngày dù ô đang lưu dạng Date object
    // thật (Sheets có thể tự auto-detect chuỗi "yyyy-MM-dd" thành Date) hay vẫn
    // là chuỗi text thuần - trước đây 2 cột này được lấy về đúng nhưng KHÔNG
    // được hiển thị ở bảng danh sách, gây cảm giác "biến mất".
    const layNgayHienThi = v => (v instanceof Date && !isNaN(v.getTime())) ? dinhDangGMT7_(v, "dd/MM/yyyy") : String(v || "").trim();
    const result = data.map((r, idx) => ({
      rowIndex: idx + 2, // dòng thật trên sheet, dùng để Sửa/Xóa chính xác
      stt: r[0],
      ngayDonHang: (r[1] instanceof Date) ? dinhDangGMT7_(r[1], "dd/MM/yyyy") : "",
      soTKHQ: r[2], tau: r[3], khachHang: r[4], diaChiKH: r[5], tenHangHoa: r[6],
      donGiaUSD: parseFloat(r[7]) || 0, klMT: parseFloat(r[8]) || 0, klBDMT: parseFloat(r[9]) || 0,
      doKho: parseFloat(r[10]) || 0, doKhoNhaMay: parseFloat(r[11]) || 0,
      tuNgay: layNgayHienThi(r[12]), denNgay: layNgayHienThi(r[13]), loaiXe: r[14], khoXuat: r[15]
    })).filter(r => r.khachHang).reverse();
    return { status: "success", data: result };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Xác định ĐÚNG dòng của đơn hàng trước khi đọc/sửa/xóa. Danh sách trên giao
// diện ghi nhớ số dòng lúc tải; nếu trong lúc đó người khác xóa 1 đơn phía
// trên, số dòng bị lệch và TRƯỚC ĐÂY sẽ sửa/xóa NHẦM đơn khác. Nay giao diện gửi
// kèm STT của đơn: dòng đó phải đúng STT, nếu lệch thì tìm lại theo STT; không
// thấy hoặc STT bị trùng (dữ liệu cũ) thì báo lỗi, KHÔNG thao tác bừa.
function XH_timDongDonHang_(sheet, rowIndex, sttKyVong) {
  const r = parseInt(rowIndex, 10);
  const lastRow = sheet.getLastRow();
  if (sttKyVong === undefined || sttKyVong === null || sttKyVong === "") {
    if (isNaN(r) || r < 2 || r > lastRow) throw new Error("Không tìm thấy đơn hàng (có thể đã bị xóa) - hãy tải lại danh sách.");
    return r;
  }
  const stt = String(sttKyVong).trim();
  if (!isNaN(r) && r >= 2 && r <= lastRow && String(sheet.getRange(r, 1).getValue()).trim() === stt) return r;
  const dsStt = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
  const trung = [];
  dsStt.forEach(function (row, i) { if (String(row[0]).trim() === stt) trung.push(i + 2); });
  if (trung.length === 1) return trung[0];
  throw new Error(trung.length === 0
    ? "Đơn hàng STT " + stt + " không còn tồn tại (có thể người khác vừa xóa) - hãy tải lại danh sách."
    : "Có " + trung.length + " đơn cùng STT " + stt + " - hãy tải lại danh sách rồi thao tác lại.");
}

// Lấy chi tiết 1 đơn hàng để nạp vào form Sửa
function XH_getDonHangByRow_(rowIndex, sttKyVong) {
  try {
    const sheet = XH_ss_().getSheetByName(XUATHANG_CONFIG.SHEET_DHXB);
    const r = XH_timDongDonHang_(sheet, rowIndex, sttKyVong);
    const row = sheet.getRange(r, 1, 1, 16).getValues()[0];
    const layNgayInput = v => (v instanceof Date && !isNaN(v.getTime())) ? dinhDangGMT7_(v, "yyyy-MM-dd") : String(v || "").trim();
    return {
      status: "success", rowIndex: r, stt: row[0],
      ngayDonHang: (row[1] instanceof Date) ? dinhDangGMT7_(row[1], "yyyy-MM-dd") : "",
      soTKHQ: row[2], tau: row[3], khachHang: row[4], diaChiKH: row[5], tenHangHoa: row[6],
      donGiaUSD: parseFloat(row[7]) || 0, klMT: parseFloat(row[8]) || 0,
      doKho: (parseFloat(row[10]) || 0) * 100, // trả về dạng % cho khớp ô nhập
      doKhoNhaMay: parseFloat(row[11]) || 0,
      tuNgay: layNgayInput(row[12]), denNgay: layNgayInput(row[13]),
      loaiXe: row[14] || "Y", khoXuat: row[15] || ""
    };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Cập nhật 1 đơn hàng đã có, theo đúng dòng thật (rowIndex) - ghi đè toàn bộ dữ liệu
function XH_updateDonHang_(rowIndex, payload, sttKyVong) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); } catch (e) {
    return { status: "error", message: "Hệ thống đang bận, vui lòng thử lại." };
  }
  try {
    payload = payload || {};
    const sheet = XH_ss_().getSheetByName(XUATHANG_CONFIG.SHEET_DHXB);
    const r = XH_timDongDonHang_(sheet, rowIndex, sttKyVong);
    if (!payload.ngayDonHang) return { status: "error", message: "Vui lòng chọn Ngày đơn hàng." };
    if (!String(payload.khachHang || "").trim()) return { status: "error", message: "Vui lòng nhập Khách hàng." };
    const klMT = parseFloat(payload.klMT) || 0;
    if (klMT <= 0) return { status: "error", message: "KL_MT phải lớn hơn 0." };
    let doKho = parseFloat(payload.doKho) || 0;
    if (doKho > 1) doKho = doKho / 100;
    if (doKho <= 0) return { status: "error", message: "Vui lòng nhập Độ khô > 0 để tính KL_BDMT." };
    const klBDMT = klMT * doKho;
    const loaiXe = String(payload.loaiXe || "Y").toUpperCase() === "N" ? "N" : "Y";
    const sttCu = sheet.getRange(r, 1).getValue();

    // FIX #17: Khóa Text cột Số TKHQ (cột C) TRƯỚC KHI ghi
    sheet.getRange(r, 3, 1, 1).setNumberFormat("@");
    // FIX (Sanitize): xem giải thích ở XH_saveDonHang phía trên.
    sheet.getRange(r, 1, 1, 16).setValues([[
      sttCu, new Date(payload.ngayDonHang), sanitize_(String(payload.soTKHQ || "").trim()), sanitize_(String(payload.tau || "").trim()),
      sanitize_(String(payload.khachHang || "").trim()), sanitize_(String(payload.diaChiKH || "").trim()), sanitize_(String(payload.tenHangHoa || "").trim()),
      parseFloat(payload.donGiaUSD) || 0, klMT, klBDMT, doKho,
      parseFloat(payload.doKhoNhaMay) || 0, sanitize_(String(payload.tuNgay || "")), sanitize_(String(payload.denNgay || "")), loaiXe, // FIX M-05: chống công thức
      sanitize_(String(payload.khoXuat || "").trim())
    ]]);
    sheet.getRange(r, 2).setNumberFormat(REGION_FORMAT_().DATE_FMT);

    logAudit_("XUATHANG_DONHANG", "OK", "Sửa đơn hàng xuất bán dòng " + r + ": " + payload.khachHang);
    return { status: "success", message: "✏️ Đã cập nhật đơn hàng." };
  } catch (e) {
    logAudit_("XUATHANG_DONHANG", "ERROR", e.toString());
    return { status: "error", message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function XH_deleteDonHang_(rowIndex, sttKyVong) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.LOCK_TIMEOUT_MS); } catch (e) {
    return { status: "error", message: "Hệ thống đang bận, vui lòng thử lại." };
  }
  try {
    const sheet = XH_ss_().getSheetByName(XUATHANG_CONFIG.SHEET_DHXB);
    const r = XH_timDongDonHang_(sheet, rowIndex, sttKyVong);
    const thongTin = sheet.getRange(r, 1, 1, 5).getValues()[0];
    sheet.deleteRow(r);
    logAudit_("XUATHANG_DONHANG", "OK", "Đã xóa đơn hàng xuất bán STT " + thongTin[0] + " (" + thongTin[4] + "), dòng " + r);
    return { status: "success", message: "🗑️ Đã xóa đơn hàng." };
  } catch (e) {
    logAudit_("XUATHANG_DONHANG", "ERROR", e.toString());
    return { status: "error", message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/*********************************************************
 * PHẦN 8: BÁO CÁO TỔNG HỢP XUẤT KHO (MENU 5)
 * - Song song với "Báo cáo tổng hợp nhập kho": gồm "Báo cáo xuất qua cân"
 *   (đọc NL_PC_XH, lọc + phân trang 20 dòng/trang) và "Báo cáo xuất kết xuất
 *   Misa" (đọc NL_DH_XB - đơn hàng xuất bán, tính thành tiền theo KL_BDMT x
 *   Đơn giá USD, tương tự cách "Báo cáo nhập kết xuất Misa" phục vụ hạch toán).
 *********************************************************/

// Helper dùng chung: lọc + sắp xếp toàn bộ NL_PC_XH theo bộ lọc, KHÔNG phân
// trang - dùng cả cho hiển thị (phân trang ở lớp gọi) lẫn xuất Excel/PDF (toàn bộ).
function XH_locBaoCaoXuatQuaCan_(filters) {
  const sheet = XH_ss_().getSheetByName(XUATHANG_CONFIG.SHEET_NLPCXH);
  const lastRow = sheet.getLastRow();
  const ketQua = { matched: [], dsDonViVanChuyen: [], dsSoXe: [] };
  if (lastRow <= 1) return ketQua;

  const data = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
  const donViVanChuyenFilter = String(filters.donViVanChuyen || "").trim();
  const soXeFilter = String(filters.soXe || "").trim();
  const soTKHQFilter = String(filters.soTKHQ || "").trim();
  const tuNgay = filters.tuNgay ? new Date(filters.tuNgay + "T00:00:00+07:00") : null;
  const denNgay = filters.denNgay ? new Date(filters.denNgay + "T23:59:59+07:00") : null;

  const dsDVVCSet = new Set(); const dsXeSet = new Set();

  data.forEach(row => {
    const donViVanChuyen = String(row[7] || "").trim();
    const soXe = String(row[3] || "").trim();
    if (donViVanChuyen) dsDVVCSet.add(donViVanChuyen);
    if (soXe) dsXeSet.add(soXe);

    // "Ngày giờ cân 1" lưu dạng chuỗi text "dd/MM/yyyy HH:mm:ss" trong NL_PC_XH
    // (không phải kiểu Date thật) - tái sử dụng toDateObj() để phân tích đúng.
    const ngayCanObj = toDateObj_(row[1]);
    if (!ngayCanObj || isNaN(ngayCanObj.getTime())) return;
    if (tuNgay && ngayCanObj < tuNgay) return;
    if (denNgay && ngayCanObj > denNgay) return;
    if (donViVanChuyenFilter && donViVanChuyen !== donViVanChuyenFilter) return;
    if (soXeFilter && soXe !== soXeFilter) return;
    const soTKHQ = String(row[14] || "").trim();
    if (soTKHQFilter && soTKHQ !== soTKHQFilter) return;

    ketQua.matched.push({
      soPhieu: row[0],
      ngayGioCan1: dinhDangGMT7_(ngayCanObj, "dd/MM/yyyy HH:mm:ss"),
      bienSo: soXe,
      canLan1: parseFloat(row[4]) || 0,
      canLan2: parseFloat(row[5]) || 0,
      klHang: parseFloat(row[6]) || 0,
      donViVanChuyen: donViVanChuyen,
      tenTaiXe: row[8] || "",
      khoiLuongTan: parseFloat(row[9]) || 0,
      soTKHQ: soTKHQ,
      khoXuat: row[15] || "",
      khoNhap: row[16] || "",
      ngayTS: ngayCanObj.getTime()
    });
  });

  ketQua.matched.sort((a, b) => b.ngayTS - a.ngayTS); // mới nhất lên trước
  ketQua.dsDonViVanChuyen = Array.from(dsDVVCSet).sort();
  ketQua.dsSoXe = Array.from(dsXeSet).sort();
  return ketQua;
}

// filters = {donViVanChuyen, soXe, soTKHQ, tuNgay, denNgay, trang} - trả về ĐÚNG
// 20 dòng/trang theo yêu cầu, kèm danh mục lọc và tổng số liệu TOÀN BỘ (không
// chỉ trang hiện tại).
function XH_getBaoCaoXuatQuaCan_(filters) {
  try {
    filters = filters || {};
    const loc = XH_locBaoCaoXuatQuaCan_(filters);
    const KICH_THUOC_TRANG_XH = 20;
    const tongSoDong = loc.matched.length;
    const tongSoTrang = Math.max(1, Math.ceil(tongSoDong / KICH_THUOC_TRANG_XH));
    let trang = parseInt(filters.trang, 10); if (isNaN(trang) || trang < 1) trang = 1;
    if (trang > tongSoTrang) trang = tongSoTrang;
    const batDau = (trang - 1) * KICH_THUOC_TRANG_XH;
    const trangHienTai = loc.matched.slice(batDau, batDau + KICH_THUOC_TRANG_XH);

    let tongKLHang = 0, tongTan = 0;
    loc.matched.forEach(m => { tongKLHang += m.klHang; tongTan += m.khoiLuongTan; });

    return {
      status: "success", data: trangHienTai, trang: trang, tongSoTrang: tongSoTrang, tongSoDong: tongSoDong,
      summary: { soLuong: tongSoDong, tongKLHang: tongKLHang, tongTan: tongTan },
      dsDonViVanChuyen: loc.dsDonViVanChuyen, dsSoXe: loc.dsSoXe
    };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function XH_exportBaoCaoXuatQuaCanExcel_(filters) {
  try {
    const loc = XH_locBaoCaoXuatQuaCan_(filters || {});
    if (loc.matched.length === 0) return { status: "error", message: "Không có dữ liệu phù hợp bộ lọc để xuất." };
    const headers = ["Số Phiếu", "Ngày Giờ Cân 1", "Số Xe", "KL Hàng (Kg)", "Khối Lượng (Tấn)", "Đơn Vị Vận Chuyển", "Tên Tài Xế", "Số TKHQ", "Kho Xuất", "Kho Nhập"];
    const rows = loc.matched.map(r => [r.soPhieu, r.ngayGioCan1, r.bienSo, r.klHang, r.khoiLuongTan, r.donViVanChuyen, r.tenTaiXe, r.soTKHQ, r.khoXuat, r.khoNhap]);
    const tempSS = createTempSheetForExport_("BaoCao_XuatQuaCan_" + dinhDangGMT7_(new Date(), "ddMM_HHmm"), headers, rows, [4, 5]);
    logAudit_('EXPORT_EXCEL', 'OK', 'Xuất báo cáo xuất qua cân, ' + loc.matched.length + ' dòng.');
    return { status: "success", url: getExportUrl_(tempSS, "xlsx") };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function XH_exportBaoCaoXuatQuaCanPDF_(filters) {
  try {
    const loc = XH_locBaoCaoXuatQuaCan_(filters || {});
    if (loc.matched.length === 0) return { status: "error", message: "Không có dữ liệu phù hợp bộ lọc để xuất." };
    const headers = ["Số Phiếu", "Ngày Giờ Cân 1", "Số Xe", "KL Hàng(Kg)", "KL(Tấn)", "Đơn Vị Vận Chuyển", "Tên Tài Xế", "Số TKHQ", "Kho Xuất", "Kho Nhập"];
    const rows = loc.matched.map(r => [r.soPhieu, r.ngayGioCan1, r.bienSo, r.klHang, r.khoiLuongTan, r.donViVanChuyen, r.tenTaiXe, r.soTKHQ, r.khoXuat, r.khoNhap]);
    const tempSS = createTempSheetForExport_("BaoCao_XuatQuaCan_PDF_" + dinhDangGMT7_(new Date(), "ddMM_HHmm"), headers, rows, [4, 5]);
    logAudit_('EXPORT_PDF', 'OK', 'Xuất PDF báo cáo xuất qua cân, ' + loc.matched.length + ' dòng.');
    return { status: "success", url: getExportUrl_(tempSS, "pdf", false) };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// ---------- Báo cáo xuất kết xuất Misa (từ NL_DH_XB - đơn hàng xuất bán) ----------
// Thành tiền tính theo KL_BDMT × Đơn giá (USD) - khớp đúng cách dữ liệu mẫu gốc
// NL_DH_XB đã thể hiện (đơn giá áp cho tấn khô, không phải tấn tươi).
function XH_locBaoCaoXuatMisa_(filters) {
  const sheet = XH_ss_().getSheetByName(XUATHANG_CONFIG.SHEET_DHXB);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
  const tuNgay = filters.tuNgay ? new Date(filters.tuNgay + "T00:00:00+07:00") : null;
  const denNgay = filters.denNgay ? new Date(filters.denNgay + "T23:59:59+07:00") : null;

  const result = [];
  data.forEach(row => {
    if (!row[4]) return; // bỏ dòng trống (chưa có khách hàng)
    const ngay = row[1];
    if (!(ngay instanceof Date) || isNaN(ngay.getTime())) return;
    if (tuNgay && ngay < tuNgay) return;
    if (denNgay && ngay > denNgay) return;

    const klMT = parseFloat(row[8]) || 0;
    const klBDMT = parseFloat(row[9]) || 0;
    const donGia = parseFloat(row[7]) || 0;
    const thanhTienUSD = klBDMT * donGia;

    result.push({
      ngayDonHang: dinhDangGMT7_(ngay, "dd/MM/yyyy"), ngayTS: ngay.getTime(), ngayRaw: ngay.toISOString(),
      soTKHQ: row[2], tau: row[3], khachHang: row[4], tenHangHoa: row[6],
      donGiaUSD: donGia, klMT: klMT, klBDMT: klBDMT, thanhTienUSD: thanhTienUSD, khoXuat: row[15] || ""
    });
  });
  result.sort((a, b) => b.ngayTS - a.ngayTS);
  return result;
}

function XH_getBaoCaoXuatMisa_(filters) {
  try {
    const list = XH_locBaoCaoXuatMisa_(filters || {});
    let tongKLMT = 0, tongKLBDMT = 0, tongThanhTienUSD = 0;
    list.forEach(r => { tongKLMT += r.klMT; tongKLBDMT += r.klBDMT; tongThanhTienUSD += r.thanhTienUSD; });
    return { status: "success", data: list, summary: { soLuong: list.length, tongKLMT: tongKLMT, tongKLBDMT: tongKLBDMT, tongThanhTienUSD: tongThanhTienUSD } };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function XH_exportBaoCaoXuatMisaExcel_(filters) {
  try {
    const list = XH_locBaoCaoXuatMisa_(filters || {});
    if (list.length === 0) return { status: "error", message: "Không có dữ liệu phù hợp bộ lọc để xuất." };
    const headers = ["Ngày Đơn Hàng", "Số TKHQ", "Tàu", "Khách Hàng", "Tên Hàng Hóa", "Đơn Giá (USD)", "KL_MT", "KL_BDMT", "Thành Tiền (USD)", "Kho Xuất"];
    const rows = list.map(r => [new Date(r.ngayRaw), r.soTKHQ, r.tau, r.khachHang, r.tenHangHoa, r.donGiaUSD, r.klMT, r.klBDMT, r.thanhTienUSD, r.khoXuat]);
    const tempSS = createTempSheetForExport_("BaoCao_XuatMisa_" + dinhDangGMT7_(new Date(), "ddMM_HHmm"), headers, rows, [6, 7, 8, 9]);
    tempSS.getSheets()[0].getRange(2, 1, rows.length, 1).setNumberFormat(MISA_FORMAT_().DATE_FMT);
    logAudit_('EXPORT_EXCEL', 'OK', 'Xuất báo cáo xuất kết xuất Misa, ' + list.length + ' dòng.');
    return { status: "success", url: getExportUrl_(tempSS, "xlsx") };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

/*********************************************************
 * PHẦN 9: SAO LƯU DỮ LIỆU TỰ ĐỘNG & NHẬT KÝ HOẠT ĐỘNG (CHỈ ADMIN)
 *********************************************************/

/* ---------- 9A. SAO LƯU ----------
 * Mỗi lần sao lưu tạo 1 thư mục "SaoLuu_yyyy-MM-dd_HHmm" trong thư mục gốc
 * "HAK - Sao lưu dữ liệu hệ thống" (Drive của Admin) và sao chép NGUYÊN BẢN
 * mọi Spreadsheet trong Liên kết dữ liệu vào đó. Chỉ giữ N bản gần nhất, bản
 * cũ hơn chuyển vào Thùng rác Drive (khôi phục được trong 30 ngày).
 * KHÔI PHỤC: mở bản sao cần dùng, lấy ID của nó rồi dán vào Hệ thống › Cấu
 * hình hệ thống › Liên kết dữ liệu (thay ID Spreadsheet đang lỗi) - hệ thống
 * dùng ngay bản sao đó; hoặc sao chép từng sheet về file gốc. */
const SL_PROP_THU_MUC_ = "SAO_LUU_THU_MUC_ID";
const SL_PROP_GIU_LAI_ = "SAO_LUU_GIU_LAI";
const SL_PROP_KET_QUA_ = "SAO_LUU_KET_QUA_CUOI";
const SL_HAM_TRIGGER_ = "TRIGGER_saoLuuHangDem";
const SL_TIEN_TO_THU_MUC_ = "SaoLuu_";
const SL_GIO_CHAY_ = 1;          // chạy trong khoảng 1-2 giờ sáng (múi giờ của dự án)
const SL_GIU_LAI_MAC_DINH_ = 30; // bản

function SL_layThuMucGoc_(taoNeuChuaCo) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(SL_PROP_THU_MUC_);
  if (id) {
    try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* thư mục đã bị xóa -> tạo lại */ }
  }
  if (!taoNeuChuaCo) return null;
  const moi = DriveApp.createFolder("HAK - Sao lưu dữ liệu hệ thống");
  props.setProperty(SL_PROP_THU_MUC_, moi.getId());
  return moi;
}

function SL_soBanGiuLai_() {
  const n = parseInt(PropertiesService.getScriptProperties().getProperty(SL_PROP_GIU_LAI_), 10);
  return (n >= 1 && n <= 365) ? n : SL_GIU_LAI_MAC_DINH_;
}

function SL_timTrigger_() {
  return ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === SL_HAM_TRIGGER_; });
}

// Danh sách các thư mục bản sao lưu, MỚI NHẤT trước (tên có dạng ngày giờ nên
// sắp theo tên là đúng thứ tự thời gian).
function SL_dsBanSaoLuu_(goc) {
  const ds = [];
  const it = goc.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().indexOf(SL_TIEN_TO_THU_MUC_) === 0) ds.push(f);
  }
  return ds.sort(function (a, b) { return a.getName() < b.getName() ? 1 : -1; });
}

function SL_thucHienSaoLuu_(nguon) {
  // Không cho 2 lượt sao lưu chạy chồng nhau (VD bấm "Sao lưu ngay" đúng lúc
  // lịch tự động đang chạy). KHÔNG dùng LockService vì sẽ chặn người dùng ghi
  // dữ liệu suốt thời gian sao chép.
  const cache = CacheService.getScriptCache();
  if (cache.get("sao_luu_dang_chay")) throw new Error("Đang có 1 lượt sao lưu chạy, vui lòng đợi vài phút.");
  cache.put("sao_luu_dang_chay", "1", 1800);
  try {
    const batDau = Date.now();
    const nhan = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HHmm");
    const goc = SL_layThuMucGoc_(true);
    const thuMuc = goc.createFolder(SL_TIEN_TO_THU_MUC_ + nhan);
    const loi = [];
    let soFile = 0;
    _layDanhSachTaiNguyenDaGopId_().filter(function (tn) { return tn.loai === "sheet"; }).forEach(function (tn) {
      try {
        const f = DriveApp.getFileById(tn.id);
        f.makeCopy(f.getName() + " (" + nhan + ")", thuMuc);
        soFile++;
      } catch (e) {
        loi.push(tn.ten + ": " + (e.message || e));
      }
    });
    const dsBan = SL_dsBanSaoLuu_(goc);
    let soBanDaXoa = 0;
    dsBan.slice(SL_soBanGiuLai_()).forEach(function (f) { f.setTrashed(true); soBanDaXoa++; });
    let soFileTamDaDon = 0;
    try { soFileTamDaDon = SL_donFileTamCu_(); } catch (e) { loi.push("Dọn file tạm: " + (e.message || e)); }

    const tomTat = {
      thoiGian: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
      nguon: nguon, thuMuc: thuMuc.getName(), thuMucUrl: thuMuc.getUrl(),
      soFile: soFile, loi: loi, soBanDaXoa: soBanDaXoa, soFileTamDaDon: soFileTamDaDon, giay: Math.round((Date.now() - batDau) / 1000)
    };
    PropertiesService.getScriptProperties().setProperty(SL_PROP_KET_QUA_, JSON.stringify(tomTat));
    logAudit_("SAO_LUU", loi.length ? (soFile ? "MOT_PHAN" : "ERROR") : "OK",
      nguon + ": " + soFile + " file → " + thuMuc.getName() + (loi.length ? " | Lỗi: " + loi.join("; ") : "") + (soBanDaXoa ? " | Đã dọn " + soBanDaXoa + " bản cũ" : "") + (soFileTamDaDon ? " | Đã dọn " + soFileTamDaDon + " file tạm xuất báo cáo" : ""));
    return tomTat;
  } finally {
    cache.remove("sao_luu_dang_chay");
  }
}

// FIX M-01: dọn file tạm xuất Excel/PDF/in phiếu còn sót trong thư mục Done (tạo
// trước bản vá, hoặc tải về bị lỗi) - chỉ Google Sheet đúng mẫu tên file tạm
// (laTenFileTamXuat_), cũ hơn 1 ngày. Chuyển vào Thùng rác (khôi phục được 30
// ngày). Tối đa 500 file/lần để không vượt thời gian chạy; chạy cùng lượt sao lưu.
function SL_donFileTamCu_() {
  const moc = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const it = DriveApp.getFolderById(CONFIG.FOLDER_DONE).searchFiles(
    "mimeType = '" + MimeType.GOOGLE_SHEETS + "' and modifiedDate < '" + moc + "' and trashed = false");
  let soDaDon = 0;
  while (it.hasNext() && soDaDon < 500) {
    const f = it.next();
    if (!laTenFileTamXuat_(f.getName())) continue;
    f.setTrashed(true);
    soDaDon++;
  }
  return soDaDon;
}

// Hàm do TRIGGER hằng đêm gọi. Là hàm công khai (trigger không gọi được hàm có
// "_" cuối) nhưng KHÔNG nằm trong bảng API_ROUTES và chỉ chạy khi mã trigger gửi kèm
// khớp đúng trigger đã cài - gọi thẳng qua google.script.run không có/không
// đoán được mã này nên bị bỏ qua.
function laLuotChayTriggerThat_(e) {
  const uid = (e && typeof e === "object" && e.triggerUid) ? String(e.triggerUid) : "";
  if (!uid) return false;
  try { return ScriptApp.getProjectTriggers().some(function (t) { return t.getUniqueId() === uid; }); } catch (err) { return false; }
}

function PHIEN_HE_THONG_TRIGGER_() {
  return { email: "trigger-tu-dong", vaiTro: null, vaiTroNhan: "Trigger tự động", quyen: [], coQuyen: true, laAdmin: false, laChiXem: false };
}

function TRIGGER_saoLuuHangDem(e) {
  const uid = (e && e.triggerUid) ? String(e.triggerUid) : "";
  if (!uid || !SL_timTrigger_().some(function (t) { return t.getUniqueId() === uid; })) return;
  SL_thucHienSaoLuu_("Tự động");
}

function HT_layTinhTrangSaoLuu_() {
  try {
    const goc = SL_layThuMucGoc_(false);
    const raw = PropertiesService.getScriptProperties().getProperty(SL_PROP_KET_QUA_);
    let ketQuaCuoi = null;
    try { ketQuaCuoi = raw ? JSON.parse(raw) : null; } catch (e) { ketQuaCuoi = null; }
    return {
      status: "success",
      data: {
        batTuDong: SL_timTrigger_().length > 0,
        gioChay: SL_GIO_CHAY_,
        giuLai: SL_soBanGiuLai_(),
        thuMucUrl: goc ? goc.getUrl() : "",
        ketQuaCuoi: ketQuaCuoi,
        dsBan: goc ? SL_dsBanSaoLuu_(goc).slice(0, 10).map(function (f) { return { ten: f.getName(), url: f.getUrl() }; }) : [],
        soSpreadsheet: _layDanhSachTaiNguyenDaGopId_().filter(function (tn) { return tn.loai === "sheet"; }).length
      }
    };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function HT_luuCauHinhSaoLuu_(cauHinh) {
  try {
    cauHinh = cauHinh || {};
    const giuLai = parseInt(cauHinh.giuLai, 10);
    if (!(giuLai >= 1 && giuLai <= 365)) throw new Error("Số bản giữ lại phải từ 1 đến 365.");
    PropertiesService.getScriptProperties().setProperty(SL_PROP_GIU_LAI_, String(giuLai));
    // Luôn xóa hết trigger cũ rồi tạo lại (tránh trùng 2 trigger chạy 2 lần/đêm).
    SL_timTrigger_().forEach(function (t) { ScriptApp.deleteTrigger(t); });
    if (cauHinh.batTuDong === true) {
      ScriptApp.newTrigger(SL_HAM_TRIGGER_).timeBased().everyDays(1).atHour(SL_GIO_CHAY_).create();
    }
    logAudit_("CAUHINH_SAO_LUU", "OK", (cauHinh.batTuDong === true ? "Bật" : "Tắt") + " sao lưu tự động, giữ " + giuLai + " bản");
    return { status: "success", message: cauHinh.batTuDong === true
      ? "✅ Đã bật sao lưu tự động hằng đêm (" + SL_GIO_CHAY_ + "–" + (SL_GIO_CHAY_ + 1) + " giờ sáng), giữ " + giuLai + " bản gần nhất."
      : "✅ Đã tắt sao lưu tự động (vẫn giữ các bản đã có)." };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function HT_saoLuuNgay_() {
  try {
    const kq = SL_thucHienSaoLuu_("Thủ công (" + layThongTinNguoiDungHienTai_().email + ")");
    return {
      status: kq.soFile > 0 ? "success" : "error",
      data: kq,
      message: (kq.soFile > 0 ? "✅ Đã sao lưu " + kq.soFile + " file vào " + kq.thuMuc : "❌ Không sao lưu được file nào")
        + (kq.loi.length ? " — lỗi: " + kq.loi.join("; ") : "")
    };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

/* ---------- 9B. NHẬT KÝ HOẠT ĐỘNG ---------- */
const NK_TIEU_DE_ = ["Thời gian", "Hành động", "Trạng thái", "Nội dung", "Người thực hiện"];
const NK_KICH_THUOC_TRANG_ = 50;
const NK_KHOI_DOC_ = 2000;         // đọc sheet Audit theo khối 2.000 dòng từ dưới lên
const NK_TOI_DA_DONG_ = 20000;     // tối đa số dòng khớp (xem/xuất) trong 1 lần lọc

function NK_ngay_(s, cuoiNgay) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return cuoiNgay ? new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999) : new Date(+m[1], +m[2] - 1, +m[3]);
}

// Nhật ký được ghi nối đuôi theo thời gian nên đọc TỪ DƯỚI LÊN theo khối và
// dừng ngay khi gặp dòng cũ hơn "Từ ngày" - xem 7 ngày gần nhất chỉ đọc vài
// khối cuối dù sheet Audit đã có hàng trăm nghìn dòng.
function NK_loc_(boLoc) {
  boLoc = boLoc || {};
  const bayGio = new Date();
  const den = NK_ngay_(boLoc.denNgay, true) || bayGio;
  const tu = NK_ngay_(boLoc.tuNgay, false) || new Date(den.getFullYear(), den.getMonth(), den.getDate() - 6);
  if (tu > den) throw new Error("'Từ ngày' phải trước 'Đến ngày'.");
  const emailLoc = chuanHoaEmailSoSanh_(boLoc.email || "");
  const hanhDongLoc = String(boLoc.hanhDong || "");
  const trangThaiLoc = String(boLoc.trangThai || "");
  const tuKhoa = String(boLoc.tuKhoa || "").trim().toLowerCase();

  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.AUDIT_SHEET);
  const ketQua = [], dsHanhDong = {}, dsEmail = {}, dsTrangThai = {};
  let biCat = false;
  if (sheet) {
    let cuoi = sheet.getLastRow();
    let dung = false;
    while (cuoi >= 2 && !dung) {
      const dau = Math.max(2, cuoi - NK_KHOI_DOC_ + 1);
      const khoi = sheet.getRange(dau, 1, cuoi - dau + 1, 5).getValues();
      for (let i = khoi.length - 1; i >= 0; i--) {
        const r = khoi[i];
        const t = r[0] instanceof Date ? r[0] : new Date(r[0]);
        if (isNaN(t.getTime()) || t > den) continue;
        if (t < tu) { dung = true; break; }
        const hanhDong = String(r[1] || ""), trangThai = String(r[2] || ""), email = String(r[4] || "");
        if (hanhDong) dsHanhDong[hanhDong] = true;
        if (trangThai) dsTrangThai[trangThai] = true;
        if (email) dsEmail[email] = true;
        if (emailLoc && chuanHoaEmailSoSanh_(email) !== emailLoc) continue;
        if (hanhDongLoc && hanhDong !== hanhDongLoc) continue;
        if (trangThaiLoc && trangThai !== trangThaiLoc) continue;
        if (tuKhoa && String(r[3] || "").toLowerCase().indexOf(tuKhoa) === -1) continue;
        if (ketQua.length >= NK_TOI_DA_DONG_) { biCat = true; dung = true; break; }
        ketQua.push({ t: t, hanhDong: hanhDong, trangThai: trangThai, noiDung: String(r[3] == null ? "" : r[3]), email: email });
      }
      cuoi = dau - 1;
    }
  }
  const sapXep = function (o) { return Object.keys(o).sort(); };
  return { tu: tu, den: den, dong: ketQua, biCat: biCat, dsHanhDong: sapXep(dsHanhDong), dsEmail: sapXep(dsEmail), dsTrangThai: sapXep(dsTrangThai) };
}

function HT_layNhatKy_(boLoc) {
  try {
    const kq = NK_loc_(boLoc);
    const tz = Session.getScriptTimeZone();
    const tongSo = kq.dong.length;
    const tongSoTrang = Math.max(1, Math.ceil(tongSo / NK_KICH_THUOC_TRANG_));
    const trang = Math.min(Math.max(1, parseInt((boLoc || {}).trang, 10) || 1), tongSoTrang);
    const data = kq.dong.slice((trang - 1) * NK_KICH_THUOC_TRANG_, trang * NK_KICH_THUOC_TRANG_).map(function (d) {
      return {
        thoiGian: Utilities.formatDate(d.t, tz, "dd/MM/yyyy HH:mm:ss"),
        hanhDong: d.hanhDong, trangThai: d.trangThai, email: d.email,
        noiDung: d.noiDung.length > 1000 ? d.noiDung.slice(0, 1000) + "…" : d.noiDung
      };
    });
    return {
      status: "success", data: data, tongSo: tongSo, trang: trang, tongSoTrang: tongSoTrang, biCat: kq.biCat,
      tuNgay: Utilities.formatDate(kq.tu, tz, "yyyy-MM-dd"), denNgay: Utilities.formatDate(kq.den, tz, "yyyy-MM-dd"),
      dsHanhDong: kq.dsHanhDong, dsEmail: kq.dsEmail, dsTrangThai: kq.dsTrangThai
    };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function HT_xuatNhatKyExcel_(boLoc) {
  try {
    const kq = NK_loc_(boLoc);
    if (kq.dong.length === 0) return { status: "error", message: "Không có dòng nhật ký nào phù hợp bộ lọc." };
    const rows = kq.dong.map(function (d) { return [d.t, d.hanhDong, d.trangThai, d.noiDung, d.email]; });
    const tempSS = createTempSheetForExport_("NhatKy_HoatDong_" + dinhDangGMT7_(new Date(), "ddMM_HHmm"), NK_TIEU_DE_, rows, []);
    tempSS.getSheets()[0].getRange(2, 1, rows.length, 1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
    logAudit_("EXPORT_EXCEL", "OK", "Xuất nhật ký hoạt động, " + rows.length + " dòng.");
    return { status: "success", url: getExportUrl_(tempSS, "xlsx") };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

/* =========================================================================
 * TRA CỨU PHIẾU CÂN (chỉ đọc): tìm phiếu cân NHẬP (PhieuCan_DN + các sheet
 * lưu trữ PhieuCan_DN_<năm>) và phiếu cân XUẤT (NL_PC_XH) theo từ khóa +
 * khoảng ngày cân lần 1; bấm 1 phiếu để xem CHI TIẾT đủ mọi cột.
 * Không ghi gì xuống Sheet, không chiếm khóa.
 * ========================================================================= */
const TC_GIOI_HAN_KET_QUA_ = 500; // tối đa số dòng trả về 1 lần tìm (mới nhất trước)

// Tiêu đề 27 cột A..AA của PhieuCan_DN - dùng khi ô tiêu đề trong sheet để trống.
const TC_TIEU_DE_NHAP_ = ["Số phiếu", "Ngày cân 1", "Giờ cân 1", "Ngày cân 2", "Giờ cân 2", "Biển số 1", "Biển số 2",
  "Cân lần 1", "Cân lần 2", "KL Hàng (KG)", "Nguồn gốc", "Khách hàng", "Mã hàng", "ĐL", "NG", "Hình ảnh",
  "Mã ĐG", "Giảm giá", "Timestamp", "ĐG_AD", "Picture", "ID_PC (Mã chứng từ)", "Số CT",
  "Đơn giá", "Trạng thái giá", "Thành tiền", "ID_DNTT"];
const TC_TIEU_DE_XUAT_ = ["Số phiếu", "Ngày giờ cân 1", "Ngày giờ cân 2", "Biển số 1", "Cân lần 1", "Cân lần 2",
  "KL Hàng (KG)", "Đơn vị vận chuyển", "Tên tài xế", "Khối lượng (Tấn)", "Ngày xuất", "Số BKLS",
  "Khối lượng (M3)", "NGƯỜI CÂN", "SỐ TKHQ", "Kho xuất", "Kho nhập"];

// Chữ thường, bỏ dấu tiếng Việt - gõ "nguyen van a" vẫn khớp "Nguyễn Văn A".
// PERF-TC-02: tìm theo từ khóa gọi hàm này cho ~10 cột × mọi dòng (hàng trăm
// nghìn lần) mà Khách hàng/Đại lý/Nguồn gốc lặp lại rất nhiều -> nhớ kết quả
// theo giá trị trong lượt thực thi; chuỗi không dấu (số phiếu, biển số, mã...)
// bỏ qua bước normalize tốn kém. Kết quả giống hệt cách cũ.
const TC_BO_NHO_CHUAN_HOA_ = new Map();
function TC_chuanHoa_(s) {
  const x = String(s == null ? "" : s);
  if (!/[^\x00-\x7f]/.test(x)) return x.toLowerCase().trim();
  let kq = TC_BO_NHO_CHUAN_HOA_.get(x);
  if (kq === undefined) {
    kq = x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim();
    if (TC_BO_NHO_CHUAN_HOA_.size < 50000) TC_BO_NHO_CHUAN_HOA_.set(x, kq);
  }
  return kq;
}

function TC_khopTuKhoa_(row, cacCot, tuKhoa) {
  if (!tuKhoa) return true;
  for (let i = 0; i < cacCot.length; i++) {
    if (TC_chuanHoa_(row[cacCot[i]]).indexOf(tuKhoa) !== -1) return true;
  }
  return false;
}

function TC_khoangNgay_(boLoc) {
  return {
    tu: boLoc.tuNgay ? new Date(boLoc.tuNgay + "T00:00:00+07:00") : null,
    den: boLoc.denNgay ? new Date(boLoc.denNgay + "T23:59:59+07:00") : null
  };
}

// Giá trị 1 ô -> chuỗi hiển thị (ngày/giờ theo GMT+7); số giữ nguyên để giao diện định dạng.
function TC_giaTriHienThi_(v) {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return "";
    if (v.getFullYear() < 1901) return gioCuaO_(v); // ô chỉ có giờ (GIO-01)
    const gio = dinhDangGMT7_(v, "HH:mm:ss");
    return dinhDangGMT7_(v, "dd/MM/yyyy") + (gio === "00:00:00" ? "" : " " + gio);
  }
  if (typeof v === "number" || typeof v === "boolean") return v;
  return String(v == null ? "" : v);
}

// PERF-TC-01: cùng kết quả với TC_ngayGioNhap_ nhưng tính bằng số học (múi giờ
// cố định GMT+7, không có giờ mùa hè) thay cho 3 lượt Utilities.formatDate mỗi
// dòng - Tra cứu không lọc từng gọi formatDate ~480.000 lần cho 160.000 phiếu.
// Trả về mốc thời gian (ms) hoặc null.
const TC_LECH_GMT7_MS_ = 7 * 3600000, TC_MOT_NGAY_MS_ = 86400000;
function TC_tsNgayGioNhap_(ngay, gio) {
  if (!(ngay instanceof Date)) return null;
  const tNgay = ngay.getTime();
  if (isNaN(tNgay)) return null;
  if (!(gio instanceof Date) || isNaN(gio.getTime())) return tNgay;
  const dauNgay = Math.floor((tNgay + TC_LECH_GMT7_MS_) / TC_MOT_NGAY_MS_) * TC_MOT_NGAY_MS_ - TC_LECH_GMT7_MS_;
  // GIO-01: giờ trong ngày theo múi giờ script (xem gioCuaO_), không cộng cố định +7.
  const giayTrongNgay = gio.getHours() * 3600 + gio.getMinutes() * 60 + gio.getSeconds();
  return dauNgay + giayTrongNgay * 1000;
}

// Ghép "Ngày cân" (Date) + "Giờ cân" (Date chỉ có giờ) của phiếu nhập -> Date đầy đủ.
function TC_ngayGioNhap_(ngay, gio) {
  if (!(ngay instanceof Date) || isNaN(ngay.getTime())) return null;
  if (!(gio instanceof Date) || isNaN(gio.getTime())) return ngay;
  const hms = gioCuaO_(gio); // GIO-01
  return new Date(dinhDangGMT7_(ngay, "yyyy-MM-dd") + "T" + hms + "+07:00");
}

// Các nguồn dữ liệu phiếu nhập cần quét theo khoảng ngày: sheet đang hoạt động
// + đúng các sheet lưu trữ năm liên quan (cùng quy tắc với báo cáo).
function TC_nguonPhieuNhap_(ss, tuNgay, denNgay) {
  const nguon = [{ sheet: ss.getSheetByName(CONFIG.DATA_SHEET), nhan: "Đang theo dõi" }];
  LT_capNamCanDoc_(ss, tuNgay, denNgay).forEach(function (nam) {
    const sh = ss.getSheetByName(LT_tenSheetLuuTru_(nam));
    if (sh) nguon.push({ sheet: sh, nhan: "Lưu trữ " + nam });
  });
  return nguon.filter(function (n) { return n.sheet; });
}

// Số phiếu, Biển số 1-2, Khách hàng, ĐL, NG, Mã ĐG, Mã chứng từ, Số CT, ID_DNTT
const TC_COT_TIM_NHAP_ = [0, 5, 6, 11, 13, 14, 16, 21, 22, 26];
// 1 dòng phiếu nhập có khớp bộ lọc Tra cứu không - DÙNG CHUNG cho tìm kiếm và
// "Tính lại giá theo bộ lọc" để 2 chức năng luôn chọn đúng cùng 1 tập phiếu.
function TC_dongNhapKhopBoLoc_(row, tuKhoa, kn) {
  if (!String(row[21] || "").trim() && !String(row[0] || "").trim()) return false; // dòng trống
  const ngay1 = row[1];
  if (kn.tu || kn.den) {
    if (!(ngay1 instanceof Date) || isNaN(ngay1.getTime())) return false;
    if (kn.tu && ngay1 < kn.tu) return false;
    if (kn.den && ngay1 > kn.den) return false;
  }
  return TC_khopTuKhoa_(row, TC_COT_TIM_NHAP_, tuKhoa);
}

// boLoc = {tuKhoa, tuNgay, denNgay} (ngày dạng yyyy-MM-dd, có thể để trống)
// PERF-TC-01: lượt 1 chỉ lọc + cộng tổng + lấy mốc thời gian để sắp xếp; chỉ
// 500 dòng được trả về mới dựng đối tượng hiển thị (định dạng ngày giờ...).
function TC_traCuuPhieuNhap_(boLoc) {
  try {
    boLoc = boLoc || {};
    const tuKhoa = TC_chuanHoa_(boLoc.tuKhoa);
    const kn = TC_khoangNgay_(boLoc);
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const khop = []; let tongKL = 0; let tongTien = 0; let soChuaChot = 0;
    TC_nguonPhieuNhap_(ss, boLoc.tuNgay, boLoc.denNgay).forEach(function (n) {
      const lastRow = n.sheet.getLastRow();
      if (lastRow <= 1) return;
      const dangTheoDoi = n.sheet.getName() === CONFIG.DATA_SHEET;
      n.sheet.getRange(2, 1, lastRow - 1, 27).getValues().forEach(function (row) {
        if (!TC_dongNhapKhopBoLoc_(row, tuKhoa, kn)) return;
        const choSua = dangTheoDoi && String(row[24] || "").trim() !== "OK";
        if (choSua) soChuaChot++;
        tongKL += parseFloat(row[9]) || 0; tongTien += parseFloat(row[25]) || 0;
        khop.push({ row: row, ts: TC_tsNgayGioNhap_(row[1], row[2]), nhan: n.nhan, choSua: choSua });
      });
    });
    khop.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }); // mới nhất trước (ổn định như cũ)
    const data = khop.slice(0, TC_GIOI_HAN_KET_QUA_).map(function (k) {
      const row = k.row;
      const idDntt = String(row[26] || "").trim();
      return {
        maChungTu: String(row[21] || "").trim(),
        soPhieu: String(row[0] == null ? "" : row[0]),
        ngayGioCan1: k.ts !== null ? dinhDangGMT7_(new Date(k.ts), "dd/MM/yyyy HH:mm") : "",
        soXe: String(row[5] || "").trim(),
        khachHang: String(row[11] || "").trim(),
        daiLy: String(row[13] || "").trim(),
        nguonGoc: String(row[14] || "").trim(),
        hinhAnh: TC_hinhAnhCuaDong_(row),
        klHang: parseFloat(row[9]) || 0,
        donGia: parseFloat(row[23]) || 0,
        thanhTien: parseFloat(row[25]) || 0,
        trangThaiGia: String(row[24] || "").trim(),
        trangThaiThanhToan: idDntt || "Chưa lập ĐNTT",
        noiLuu: k.nhan,
        choSua: k.choSua,
        ts: k.ts !== null ? k.ts : 0
      };
    });
    return {
      status: "success",
      data: data,
      tongSoDong: khop.length, gioiHan: TC_GIOI_HAN_KET_QUA_,
      soChuaChot: soChuaChot, // phiếu chưa "OK" ở sheet đang theo dõi - sửa/tính lại giá được
      summary: { soLuong: khop.length, tongKL: tongKL, tongTien: tongTien }
    };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function TC_tieuDe_(sheet, soCot, macDinh) {
  const h = sheet.getRange(1, 1, 1, soCot).getValues()[0];
  return h.map(function (x, i) { return String(x || "").trim() || macDinh[i] || ("Cột " + (i + 1)); });
}

// Tìm 1 phiếu nhập theo Mã chứng từ: sheet đang hoạt động trước, rồi sheet lưu
// trữ đúng năm trong mã ("<Số phiếu>/<Năm>/NK"), cuối cùng mới quét các năm còn lại.
function TC_timPhieuNhap_(ss, maCT) {
  const dsSheet = [ss.getSheetByName(CONFIG.DATA_SHEET)];
  const namTrongMa = maCT.match(/\/(\d{4})\/NK$/);
  let cacNam = LT_layDanhSachNamDaLuuTru_(ss).sort(function (a, b) { return b - a; });
  if (namTrongMa) {
    const nam = parseInt(namTrongMa[1], 10);
    if (cacNam.indexOf(nam) !== -1) cacNam = [nam].concat(cacNam.filter(function (n) { return n !== nam; }));
  }
  cacNam.forEach(function (nam) { dsSheet.push(ss.getSheetByName(LT_tenSheetLuuTru_(nam))); });
  for (let i = 0; i < dsSheet.length; i++) {
    const sh = dsSheet[i];
    if (!sh || sh.getLastRow() <= 1) continue;
    const ma = sh.getRange(2, 22, sh.getLastRow() - 1, 1).getValues();
    for (let r = 0; r < ma.length; r++) {
      if (String(ma[r][0] || "").trim() === maCT) return { sheet: sh, dong: r + 2 };
    }
  }
  return null;
}

function TC_chiTietPhieuNhap_(maChungTu) {
  try {
    const maCT = String(maChungTu || "").trim();
    if (!maCT) throw new Error("Thiếu Mã chứng từ.");
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const vt = TC_timPhieuNhap_(ss, maCT);
    if (!vt) return { status: "error", message: "Không tìm thấy phiếu cân nhập " + maCT };
    const soCot = Math.max(27, vt.sheet.getLastColumn());
    const row = vt.sheet.getRange(vt.dong, 1, 1, soCot).getValues()[0];
    const tieuDe = TC_tieuDe_(vt.sheet, soCot, TC_TIEU_DE_NHAP_);
    const ten = vt.sheet.getName();
    const idDntt = String(row[26] || "").trim();
    const daOK = String(row[24] || "").trim() === "OK";
    return {
      status: "success",
      data: {
        loai: "NHAP",
        maChungTu: maCT,
        choSua: ten === CONFIG.DATA_SHEET && !daOK,
        lyDoKhongSua: ten !== CONFIG.DATA_SHEET ? "Phiếu đã chuyển sang sheet lưu trữ (đã khóa sổ) - không sửa, không tính lại giá."
          : (daOK ? "Phiếu đã đóng thanh toán (Trạng thái giá = OK) - không sửa, không tính lại giá." : ""),
        noiLuu: ten === CONFIG.DATA_SHEET ? "Đang theo dõi (" + ten + ")" : "Lưu trữ (" + ten + ")",
        tomTat: {
          soPhieu: TC_giaTriHienThi_(row[0]),
          ngayGioCan1: TC_giaTriHienThi_(TC_ngayGioNhap_(row[1], row[2]) || ""),
          ngayGioCan2: TC_giaTriHienThi_(TC_ngayGioNhap_(row[3], row[4]) || ""),
          soXe: String(row[5] || "").trim() + (String(row[6] || "").trim() ? " / " + String(row[6]).trim() : ""),
          khachHang: String(row[11] || "").trim(),
          daiLy: String(row[13] || "").trim(), nguonGoc: String(row[14] || "").trim(), hinhAnh: TC_hinhAnhCuaDong_(row),
          klCan1: parseFloat(row[7]) || 0, klCan2: parseFloat(row[8]) || 0, klHang: parseFloat(row[9]) || 0,
          maDonGia: String(row[16] || "").trim(),
          donGia: parseFloat(row[23]) || 0, thanhTien: parseFloat(row[25]) || 0,
          trangThaiGia: String(row[24] || "").trim(),
          trangThaiThanhToan: idDntt || "Chưa lập ĐNTT"
        },
        truong: tieuDe.map(function (t, i) { return [t, TC_giaTriHienThi_(row[i])]; })
      }
    };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Cột tìm của phiếu xuất: Số phiếu, Biển số, ĐVVC, Tài xế, Số BKLS, Người cân, Số TKHQ, Kho xuất, Kho nhập
function TC_traCuuPhieuXuat_(boLoc) {
  try {
    boLoc = boLoc || {};
    const tuKhoa = TC_chuanHoa_(boLoc.tuKhoa);
    const kn = TC_khoangNgay_(boLoc);
    const sheet = XH_ss_().getSheetByName(XUATHANG_CONFIG.SHEET_NLPCXH);
    const lastRow = sheet ? sheet.getLastRow() : 0;
    const ketQua = []; let tongKL = 0; let tongTan = 0;
    if (lastRow > 1) {
      const COT_TIM = [0, 3, 7, 8, 11, 13, 14, 15, 16];
      sheet.getRange(2, 1, lastRow - 1, 17).getValues().forEach(function (row) {
        const soPhieu = String(row[0] == null ? "" : row[0]).trim();
        if (!soPhieu && !String(row[3] || "").trim()) return;
        // "Ngày giờ cân 1" trong NL_PC_XH là chuỗi "dd/MM/yyyy HH:mm:ss" hoặc Date
        const t = toDateObj_(row[1]);
        const coNgay = t && !isNaN(t.getTime());
        if (kn.tu || kn.den) {
          if (!coNgay) return;
          if (kn.tu && t < kn.tu) return;
          if (kn.den && t > kn.den) return;
        }
        if (!TC_khopTuKhoa_(row, COT_TIM, tuKhoa)) return;
        const klHang = parseFloat(row[6]) || 0;
        const tan = parseFloat(row[9]) || 0;
        tongKL += klHang; tongTan += tan;
        ketQua.push({ row: row, soPhieu: soPhieu, t: coNgay ? t : null, ts: coNgay ? t.getTime() : 0 });
      });
    }
    ketQua.sort(function (a, b) { return b.ts - a.ts; });
    // PERF-TC-01: chỉ định dạng 500 dòng trả về (trước: mọi dòng khớp).
    const data = ketQua.slice(0, TC_GIOI_HAN_KET_QUA_).map(function (k) {
      const row = k.row;
      return {
        soPhieu: k.soPhieu,
        ngayGioCan1: k.t ? dinhDangGMT7_(k.t, "dd/MM/yyyy HH:mm") : String(row[1] || ""),
        bienSo: String(row[3] || "").trim(),
        klHang: parseFloat(row[6]) || 0, khoiLuongTan: parseFloat(row[9]) || 0,
        donViVanChuyen: String(row[7] || "").trim(),
        tenTaiXe: String(row[8] || "").trim(),
        soTKHQ: String(row[14] || "").trim(),
        khoXuat: String(row[15] || "").trim(),
        khoNhap: String(row[16] || "").trim(),
        ts: k.ts
      };
    });
    return {
      status: "success",
      data: data,
      tongSoDong: ketQua.length, gioiHan: TC_GIOI_HAN_KET_QUA_,
      summary: { soLuong: ketQua.length, tongKLHang: tongKL, tongTan: tongTan }
    };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// Chi tiết 1 phiếu xuất: khớp Số phiếu (+ thời điểm cân lần 1 nếu có, vì số
// phiếu xuất có thể lặp lại giữa các trạm cân/năm).
function TC_chiTietPhieuXuat_(soPhieu, ts) {
  try {
    const so = String(soPhieu == null ? "" : soPhieu).trim();
    if (!so) throw new Error("Thiếu Số phiếu.");
    const sheet = XH_ss_().getSheetByName(XUATHANG_CONFIG.SHEET_NLPCXH);
    const lastRow = sheet ? sheet.getLastRow() : 0;
    if (lastRow <= 1) return { status: "error", message: "Không tìm thấy phiếu cân xuất " + so };
    const soCot = Math.max(17, sheet.getLastColumn());
    const data = sheet.getRange(2, 1, lastRow - 1, soCot).getValues();
    const tsSo = Number(ts) || 0;
    let row = null; let dongDauTien = null;
    for (let i = 0; i < data.length && !row; i++) {
      if (String(data[i][0] == null ? "" : data[i][0]).trim() !== so) continue;
      if (!dongDauTien) dongDauTien = data[i];
      const t = toDateObj_(data[i][1]);
      if (!tsSo || (t && t.getTime() === tsSo)) row = data[i];
    }
    row = row || dongDauTien;
    if (!row) return { status: "error", message: "Không tìm thấy phiếu cân xuất " + so };
    const t1 = toDateObj_(row[1]); const t2 = toDateObj_(row[2]);
    return {
      status: "success",
      data: {
        loai: "XUAT",
        noiLuu: XUATHANG_CONFIG.SHEET_NLPCXH,
        tomTat: {
          soPhieu: so,
          ngayGioCan1: t1 && !isNaN(t1.getTime()) ? TC_giaTriHienThi_(t1) : String(row[1] || ""),
          ngayGioCan2: t2 && !isNaN(t2.getTime()) ? TC_giaTriHienThi_(t2) : String(row[2] || ""),
          bienSo: String(row[3] || "").trim(),
          canLan1: parseFloat(row[4]) || 0, canLan2: parseFloat(row[5]) || 0, klHang: parseFloat(row[6]) || 0,
          khoiLuongTan: parseFloat(row[9]) || 0,
          donViVanChuyen: String(row[7] || "").trim(), tenTaiXe: String(row[8] || "").trim(),
          soTKHQ: String(row[14] || "").trim(), khoXuat: String(row[15] || "").trim(), khoNhap: String(row[16] || "").trim()
        },
        truong: TC_tieuDe_(sheet, soCot, TC_TIEU_DE_XUAT_).map(function (tieuDe, i) { return [tieuDe, TC_giaTriHienThi_(row[i])]; })
      }
    };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

/* ---------- SỬA PHIẾU CÂN NHẬP + TÍNH LẠI GIÁ (từ Tra cứu) ----------
 * Chỉ áp dụng cho phiếu ở sheet đang theo dõi (PhieuCan_DN) và CHƯA "OK" (cột Y
 * - ĐNTT ghi "OK" khi đã đóng thanh toán). Sửa Khách hàng / Đại lý / Nguồn gốc
 * theo ĐÚNG quy tắc import: K = ĐL_NG, N = ĐL, O = NG (chữ hoa), Q (Mã ĐG) =
 * ĐL_NG_<Hình ảnh Y/N> (P = Hình ảnh), S = thời điểm cập nhật. Đổi ĐL/NG/Hình ảnh
 * bắt buộc tính được giá mới mới lưu
 * (cùng công thức engine tính giá - TG_tinhGiaDong_).
 * Phiếu có trong sheet Draft Chưa Thanh Toán được cập nhật theo (không thêm mới).
 * Có khóa hệ thống + cờ Khóa sổ ĐNTT + kiểm tra dòng đích (CONCUR-01/02). */
function TC_chayCoKhoa_(viec) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", message: "Hệ thống đang bận xử lý một yêu cầu khác, vui lòng thử lại sau ít giây." };
  }
  try {
    const dnttKhoaSo = KS_thongBaoDNTTDangKhoaSo_();
    if (dnttKhoaSo) return { status: "error", message: dnttKhoaSo };
    return viec();
  } catch (e) {
    return { status: "error", message: e.message || e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// Số dòng (1-based) của phiếu trong PhieuCan_DN theo Mã chứng từ; 0 = không có.
function TC_timDongDangTheoDoi_(sheet, maCT) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;
  const ma = sheet.getRange(2, 22, lastRow - 1, 1).getValues();
  for (let i = 0; i < ma.length; i++) if (String(ma[i][0] || "").trim() === maCT) return i + 2;
  return 0;
}

// Báo lỗi rõ ràng khi phiếu không sửa/tính lại giá được.
function TC_loiPhieuKhongSuaDuoc_(ss, maCT) {
  if (TC_timPhieuNhap_(ss, maCT)) return "Phiếu " + maCT + " đã chuyển sang sheet lưu trữ (đã khóa sổ) - không sửa, không tính lại giá.";
  return "Không tìm thấy phiếu cân nhập " + maCT + ".";
}

function TC_moTaGia_(kq) {
  if (!kq) return "";
  return kq.trangThai === "Test giá"
    ? "Đơn giá " + Number(kq.hieuSo).toLocaleString("vi-VN") + " · Thành tiền " + Number(kq.thanhTien).toLocaleString("vi-VN")
    : "⚠️ Lỗi ĐK/Báo giá: chưa có báo giá khớp Mã ĐG + khối lượng + ngày cân";
}

// Cập nhật (KHÔNG thêm mới) các phiếu đang có trong sheet Draft Chưa Thanh Toán
// theo dữ liệu PhieuCan_DN vừa ghi (26 cột A..Z, cùng khuôn DRAFT-01). ketQua =
// [{rowNum, maCT}] từ engine tính giá. Lỗi Draft không làm hỏng thao tác chính.
function TC_dongBoDraftChuaTT_(sheetPC, ketQua) {
  if (!ketQua || ketQua.length === 0) return 0;
  try {
    const sh = SpreadsheetApp.openById(CONFIG.DRAFT_CHUATT_SPREADSHEET_ID).getSheetByName(CONFIG.DRAFT_CHUATT_SHEET);
    if (!sh || sh.getLastRow() <= 1) return 0;
    const dongPC = new Map();
    ketQua.forEach(function (k) { if (k.maCT) dongPC.set(k.maCT, k.rowNum); });
    const dongDraft = new Map(); // maCT -> dòng trong Draft
    sh.getRange(2, 22, sh.getLastRow() - 1, 1).getValues().forEach(function (r, i) {
      const k = String(r[0] || "").trim();
      if (k && dongPC.has(k) && !dongDraft.has(k)) dongDraft.set(k, i + 2);
    });
    if (dongDraft.size === 0) return 0;
    // PERF-TC-03: đọc đúng các dòng phiếu cần chép (theo cụm) thay vì cả đoạn từ
    // dòng nhỏ nhất tới dòng lớn nhất (phiếu rải rác -> hàng triệu ô thừa).
    const dongCanDoc = [];
    dongDraft.forEach(function (x, k) { dongCanDoc.push(dongPC.get(k)); });
    const khoi = docCacDong_(sheetPC, dongCanDoc, 1, 26);
    const giuChu = function (v) { return typeof v === "string" && v !== "" ? "'" + v.replace(/^'+/, "") : v; };
    const giaTheoMa = new Map(); // DRAFT-02: giá vừa tính (có thể đã ghi qua Sheets API)
    ketQua.forEach(function (k) { if (k.maCT && k.hieuSo !== undefined) giaTheoMa.set(k.maCT, k); });
    const ghi = [];
    dongDraft.forEach(function (dong, k) {
      const x = khoi.get(dongPC.get(k)).slice();
      if (String(x[21] || "").trim() !== k) return; // dòng PhieuCan vừa đổi vị trí -> bỏ qua an toàn
      const g = giaTheoMa.get(k);
      if (g) { x[19] = g.gia; x[23] = g.hieuSo; x[24] = g.trangThai; x[25] = g.thanhTien; }
      x[0] = giuChu(x[0]); x[22] = giuChu(x[22]);
      ghi.push({ dong: dong, row: x });
    });
    ghi.sort(function (a, b) { return a.dong - b.dong; });
    let i = 0;
    while (i < ghi.length) {
      let j = i;
      while (j + 1 < ghi.length && ghi[j + 1].dong === ghi[j].dong + 1) j++;
      sh.getRange(ghi[i].dong, 1, j - i + 1, 26).setValues(ghi.slice(i, j + 1).map(function (g) { return g.row; }));
      i = j + 1;
    }
    logAudit_("DRAFT_CHUATT", "OK", "Cập nhật " + ghi.length + " phiếu trong Draft Chưa Thanh Toán sau khi sửa/tính lại giá (Tra cứu / Import).");
    return ghi.length;
  } catch (e) {
    logAudit_("DRAFT_CHUATT", "ERROR", e.toString());
    return 0;
  }
}

// Hình ảnh (cột P) của 1 phiếu: "Y"/"N"; ô trống/lạ -> lấy đuôi Mã ĐG (Q), mặc định "Y"
// (import luôn ghi "Y"). Là phần thứ 3 của Mã ĐG: ĐL_NG_<Hình ảnh>.
function TC_hinhAnhCuaDong_(r) {
  const p = String(r[15] || "").trim().toUpperCase();
  if (p === "Y" || p === "N") return p;
  const duoi = String(r[16] || "").trim().toUpperCase().split("_").pop();
  return duoi === "N" ? "N" : "Y";
}

// thongTin = {khachHang, daiLy, nguonGoc, hinhAnh: "Y"|"N"}
// BẮT BUỘC: đổi Đại lý, Nguồn gốc hoặc Hình ảnh (-> đổi Mã ĐG) thì phải TÍNH ĐƯỢC giá mới
// (có báo giá khớp Mã ĐG + khối lượng + ngày cân) mới lưu. Giá được tính TRƯỚC,
// không tính được -> KHÔNG ghi gì; tính được -> ghi thông tin + giá cùng lượt,
// không có trạng thái "đã đổi Mã ĐG nhưng giá còn cũ/lỗi".
// Chỉ đổi Khách hàng (không ảnh hưởng giá) -> lưu Khách hàng, giữ nguyên giá.
function TC_suaPhieuNhap_(maChungTu, thongTin) {
  return TC_chayCoKhoa_(function () {
    const maCT = String(maChungTu || "").trim();
    thongTin = thongTin || {};
    const kh = sanitize_(String(thongTin.khachHang || "").trim());
    const dl = sanitize_(String(thongTin.daiLy || "").trim().toUpperCase());
    const ng = sanitize_(String(thongTin.nguonGoc || "").trim().toUpperCase());
    if (!maCT) throw new Error("Thiếu Mã chứng từ.");
    if (!kh || !dl || !ng) throw new Error("Vui lòng nhập đủ Khách hàng, Đại lý và Nguồn gốc.");

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.DATA_SHEET);
    const dong = TC_timDongDangTheoDoi_(sheet, maCT);
    if (!dong) throw new Error(TC_loiPhieuKhongSuaDuoc_(ss, maCT));
    const cu = sheet.getRange(dong, 1, 1, 26).getValues()[0];
    if (String(cu[24] || "").trim() === "OK") throw new Error("Phiếu " + maCT + " đã đóng thanh toán (Trạng thái giá = OK) - không sửa được.");

    const truoc = { kh: String(cu[11] || ""), dl: String(cu[13] || ""), ng: String(cu[14] || ""), ha: TC_hinhAnhCuaDong_(cu) };
    const ha = thongTin.hinhAnh === undefined || thongTin.hinhAnh === "" ? truoc.ha : String(thongTin.hinhAnh).trim().toUpperCase();
    if (ha !== "Y" && ha !== "N") throw new Error("Hình ảnh chỉ nhận Y (có hình ảnh) hoặc N (không hình ảnh).");
    const doiMaDG = truoc.dl !== dl || truoc.ng !== ng || truoc.ha !== ha;
    const thayDoi = [["Khách hàng", truoc.kh, kh], ["Đại lý", truoc.dl, dl], ["Nguồn gốc", truoc.ng, ng], ["Hình ảnh", truoc.ha, ha]]
      .filter(function (x) { return x[1] !== x[2]; }).map(function (x) { return x[0] + ": " + x[1] + " → " + x[2]; });
    if (!thayDoi.length) throw new Error("Không có thay đổi nào để lưu.");

    // Dòng mới A..Z trong bộ nhớ: K..S theo quy tắc import, M/P/R giữ nguyên.
    const moi = cu.slice();
    moi[11] = kh; moi[18] = new Date();
    let kq = null;
    if (doiMaDG) {
      moi[10] = dl + "_" + ng; moi[13] = dl; moi[14] = ng; moi[15] = ha; moi[16] = dl + "_" + ng + "_" + ha;
      kq = TG_tinhGiaDong_(moi, TG_docBaoGia_());
      if (kq.trangThai !== "Test giá") {
        const klTan = (parseFloat(cu[9]) || 0) / 1000;
        const ngay = cu[1] instanceof Date ? dinhDangGMT7_(cu[1], "dd/MM/yyyy") : String(cu[1] || "");
        throw new Error("CHƯA LƯU: không tính được giá cho Mã ĐG " + moi[16] + " (khối lượng " + klTan.toLocaleString("vi-VN")
          + " tấn, ngày cân " + ngay + ") - chưa có báo giá hiệu lực khớp. Kiểm tra lại Đại lý / Nguồn gốc / Hình ảnh, hoặc nhập báo giá cho mã này trước.");
      }
      moi[19] = kq.gia; moi[23] = kq.hieuSo; moi[24] = kq.trangThai; moi[25] = kq.thanhTien;
    }

    PC_kiemTraDongConDung_(sheet, new Map([[dong, PC_chuKyDong_(cu)]]));
    // ĐNTT (dự án khác) có thể vừa đóng thanh toán phiếu này -> đọc lại cột Y ngay trước khi ghi.
    if (String(sheet.getRange(dong, 25).getValue() || "").trim() === "OK") throw new Error("Phiếu " + maCT + " vừa được đóng thanh toán (OK) - không sửa được.");
    if (doiMaDG) {
      // Giá đã tính xong TRƯỚC khi ghi. Ghi K..T (thông tin + đơn giá gốc) và X..Z
      // (đơn giá, trạng thái, thành tiền) - không đụng U/V/W (Picture, Mã CT, Số CT).
      sheet.getRange(dong, 11, 1, 10).setValues([moi.slice(10, 20)]);
      sheet.getRange(dong, 24, 1, 3).setValues([moi.slice(23, 26)]);
      sheet.getRangeList(["X" + dong, "Z" + dong]).setNumberFormat("#,##0");
    } else {
      sheet.getRange(dong, 12, 1, 1).setValues([[kh]]);            // L - Khách hàng
      sheet.getRange(dong, 19, 1, 1).setValues([[moi[18]]]);       // S - lúc cập nhật
    }

    const soDraft = TC_dongBoDraftChuaTT_(sheet, [{ rowNum: dong, maCT: maCT }]);
    logAudit_("SUA_PHIEU_CAN", "OK", maCT + " | " + thayDoi.join("; ") + " | "
      + (kq ? kq.trangThai + ", đơn giá " + kq.hieuSo + ", thành tiền " + kq.thanhTien : "giá giữ nguyên"));
    return {
      status: "success",
      message: "Đã lưu phiếu " + maCT + " (" + thayDoi.join("; ") + ")"
        + (kq ? " - giá mới: " + TC_moTaGia_(kq) : " - chỉ đổi Khách hàng, giá giữ nguyên")
        + (soDraft ? " · đã cập nhật bản sao trong Draft Chưa TT" : ""),
      ketQua: kq
    };
  });
}

// Tính lại giá 1 phiếu (không sửa thông tin).
function TC_tinhLaiGiaPhieu_(maChungTu) {
  return TC_chayCoKhoa_(function () {
    const maCT = String(maChungTu || "").trim();
    if (!maCT) throw new Error("Thiếu Mã chứng từ.");
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.DATA_SHEET);
    const dong = TC_timDongDangTheoDoi_(sheet, maCT);
    if (!dong) throw new Error(TC_loiPhieuKhongSuaDuoc_(ss, maCT));
    if (String(sheet.getRange(dong, 25).getValue() || "").trim() === "OK") throw new Error("Phiếu " + maCT + " đã đóng thanh toán (Trạng thái giá = OK) - không tính lại giá.");
    const gia = runCalculatePrice_core_(function (r) { return String(r[21] || "").trim() === maCT; });
    if (gia.status !== "success") return gia;
    const kq = (gia.ketQua || [])[0];
    const soDraft = TC_dongBoDraftChuaTT_(sheet, gia.ketQua);
    logAudit_("TINH_LAI_GIA", "OK", maCT + " | " + (kq ? kq.trangThai + ", đơn giá " + kq.hieuSo + ", thành tiền " + kq.thanhTien : ""));
    return {
      status: "success",
      message: "Đã tính lại giá phiếu " + maCT + ": " + TC_moTaGia_(kq) + (soDraft ? " · đã cập nhật bản sao trong Draft Chưa TT" : ""),
      ketQua: kq
    };
  });
}

// Tính lại giá các phiếu ĐƯỢC CHỌN (ô chọn ở bảng Tra cứu). Phiếu đã OK, đã chuyển
// sang lưu trữ hoặc không còn trong PhieuCan_DN được bỏ qua và báo số lượng.
const TC_TOI_DA_PHIEU_CHON_ = 5000;
function TC_tinhLaiGiaCacPhieu_(dsMaChungTu) {
  return TC_chayCoKhoa_(function () {
    const ds = Array.from(new Set((Array.isArray(dsMaChungTu) ? dsMaChungTu : []).map(function (x) { return String(x == null ? "" : x).trim(); }).filter(Boolean)));
    if (!ds.length) throw new Error("Chưa chọn phiếu nào.");
    if (ds.length > TC_TOI_DA_PHIEU_CHON_) throw new Error("Chọn tối đa " + TC_TOI_DA_PHIEU_CHON_ + " phiếu mỗi lần - dùng \"Tính lại giá theo bộ lọc\" cho số lượng lớn hơn.");
    const can = new Set(ds);
    const gia = runCalculatePrice_core_(function (r) { return can.has(String(r[21] || "").trim()); });
    if (gia.status !== "success") return gia;
    const boQua = ds.length - gia.soPhieu;
    let soDraft = 0;
    if (gia.soPhieu) {
      const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.DATA_SHEET);
      soDraft = TC_dongBoDraftChuaTT_(sheet, gia.ketQua);
    }
    logAudit_("TINH_LAI_GIA", "OK", "Phiếu đã chọn: " + gia.soPhieu + "/" + ds.length + " phiếu, " + gia.soLoiBaoGia + " phiếu Lỗi ĐK/Báo giá, bỏ qua " + boQua
      + ", cập nhật Draft " + soDraft + " phiếu. " + ds.slice(0, 50).join(", ") + (ds.length > 50 ? "…" : ""));
    return {
      status: "success",
      message: (gia.soPhieu ? "Đã tính lại giá " + gia.soPhieu + "/" + ds.length + " phiếu đã chọn" : "Không tính lại được phiếu nào trong " + ds.length + " phiếu đã chọn")
        + (gia.soLoiBaoGia ? " - ⚠️ " + gia.soLoiBaoGia + " phiếu Lỗi ĐK/Báo giá (chưa có báo giá khớp)" : "")
        + (boQua ? " · bỏ qua " + boQua + " phiếu đã đóng thanh toán (OK) / đã khóa sổ / không còn trong sheet" : "")
        + (soDraft ? " · đã cập nhật " + soDraft + " phiếu trong Draft Chưa TT" : "") + ".",
      soPhieu: gia.soPhieu, soLoiBaoGia: gia.soLoiBaoGia, soBoQua: boQua
    };
  });
}

// Tính lại giá HÀNG LOẠT: mọi phiếu CHƯA "OK" ở sheet đang theo dõi khớp đúng bộ
// lọc Tra cứu (từ khóa + khoảng ngày) - kể cả phần vượt quá 500 dòng hiển thị.
function TC_tinhLaiGiaTheoBoLoc_(boLoc) {
  return TC_chayCoKhoa_(function () {
    boLoc = boLoc || {};
    const tuKhoa = TC_chuanHoa_(boLoc.tuKhoa);
    const kn = TC_khoangNgay_(boLoc);
    const gia = runCalculatePrice_core_(function (r) { return TC_dongNhapKhopBoLoc_(r, tuKhoa, kn); });
    if (gia.status !== "success") return gia;
    if (!gia.soPhieu) return { status: "success", message: "Không có phiếu chưa đóng thanh toán nào khớp bộ lọc để tính lại giá.", soPhieu: 0, soLoiBaoGia: 0 };
    const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.DATA_SHEET);
    const soDraft = TC_dongBoDraftChuaTT_(sheet, gia.ketQua);
    const moTaBoLoc = [boLoc.tuKhoa ? "từ khóa \"" + boLoc.tuKhoa + "\"" : "", boLoc.tuNgay ? "từ " + boLoc.tuNgay : "", boLoc.denNgay ? "đến " + boLoc.denNgay : ""].filter(Boolean).join(", ") || "toàn bộ";
    logAudit_("TINH_LAI_GIA", "OK", "Hàng loạt (" + moTaBoLoc + "): " + gia.soPhieu + " phiếu, " + gia.soLoiBaoGia + " phiếu Lỗi ĐK/Báo giá, cập nhật Draft " + soDraft + " phiếu.");
    return {
      status: "success",
      message: "Đã tính lại giá " + gia.soPhieu + " phiếu chưa đóng thanh toán"
        + (gia.soLoiBaoGia ? " - ⚠️ " + gia.soLoiBaoGia + " phiếu Lỗi ĐK/Báo giá (chưa có báo giá khớp)" : "")
        + (soDraft ? " · đã cập nhật " + soDraft + " phiếu trong Draft Chưa TT" : "") + ".",
      soPhieu: gia.soPhieu, soLoiBaoGia: gia.soLoiBaoGia
    };
  });
}
