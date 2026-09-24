/**
 * Mock tối giản cho các dịch vụ Google Apps Script (SpreadsheetApp, DriveApp,
 * PropertiesService, LockService, Session, Utilities, HtmlService,
 * CacheService, Drive) - đủ để nạp Code.gs/Config.gs trong Node (không có kết
 * nối Google thật) và gọi được các hàm logic thuần cần kiểm thử.
 *
 * KHÔNG cố mô phỏng đầy đủ hành vi Google Sheets thật (công thức, định dạng
 * hiển thị...) - chỉ đủ cho các hàm test nhắm tới (xem test/gasEnv.js).
 */
'use strict';

// FIX (đa-realm Date - phát hiện qua test archiving): gasEnv.js nạp LẠI toàn
// bộ Code.gs/Config.gs vào 1 vm context MỚI cho MỖI lần gọi hàm (đúng mô hình
// thực thi thật của Apps Script - xem ghi chú đầu gasEnv.js), nhưng dữ liệu
// Date lưu trong các "sheet" giả (mảng 2 chiều trong bộ nhớ) lại "sống lâu"
// xuyên suốt nhiều lần gọi khác nhau (mô phỏng đúng việc Sheet là dịch vụ
// NGOÀI, tồn tại thật giữa các lần gọi). Hệ quả: 1 Date object được tạo ra ở
// LẦN GỌI A rồi đọc lại ở LẦN GỌI B (context khác - "realm" khác của JS) sẽ
// KHÔNG "instanceof Date" theo Date của context B, dù cùng giá trị/API (đặc
// điểm chuẩn của JS đa-realm, Code.gs có nhiều chỗ dùng "x instanceof Date" để
// nhận diện cột Ngày/Giờ - hoàn toàn ĐÚNG trong Apps Script thật vì ở đó luôn
// chỉ có 1 realm duy nhất, nhưng SAI trong môi trường test nếu không xử lý).
// Giải pháp: mọi lần ĐỌC giá trị từ "sheet" (getValues/getValue) sẽ TÁI TẠO
// LẠI Date bằng ĐÚNG constructor Date của context ĐANG THỰC THI lệnh đọc đó
// (gasEnv.js gọi setActiveDateCtor_ trước mỗi lần chạy hàm) - nhận diện Date
// gốc (dù thuộc realm nào) qua Object.prototype.toString (tag nội bộ, KHÔNG
// phụ thuộc identity constructor/prototype, nên hoạt động đúng xuyên realm),
// còn .getTime() hoạt động đúng xuyên realm vì đọc thẳng internal slot.
let _activeDateCtor = Date;
function setActiveDateCtor_(ctor) { _activeDateCtor = ctor || Date; }
function isDateLike_(v) {
  return v !== null && typeof v === 'object' && Object.prototype.toString.call(v) === '[object Date]';
}
function taiTaoDateNeuCan_(v) {
  return isDateLike_(v) ? new _activeDateCtor(v.getTime()) : v;
}

// Bộ đếm lời gọi Sheets API - trong Apps Script thật, MỖI lời gọi getRange/
// getValues/setValues... là 1 lượt round-trip mạng tới Google Sheets (50-500ms),
// nên SỐ LỜI GỌI + SỐ Ô đọc/ghi mới là thước đo hiệu năng đúng, không phải
// thời gian CPU của Node. Dùng cho test hiệu năng/tải (test/loadPerformance.test.js).
const _apiCounter = { calls: {}, oRead: 0, oWrite: 0 };
function demApi_(ten, soO, laGhi) {
  _apiCounter.calls[ten] = (_apiCounter.calls[ten] || 0) + 1;
  if (soO) { if (laGhi) _apiCounter.oWrite += soO; else _apiCounter.oRead += soO; }
}
function resetApiCounter_() { _apiCounter.calls = {}; _apiCounter.oRead = 0; _apiCounter.oWrite = 0; }
function getApiCounter_() {
  const tong = Object.keys(_apiCounter.calls).reduce((s, k) => s + _apiCounter.calls[k], 0);
  return { calls: Object.assign({}, _apiCounter.calls), tongLoiGoi: tong, oRead: _apiCounter.oRead, oWrite: _apiCounter.oWrite };
}

// Tiêm lỗi (fault injection) để mô phỏng "luồng dữ liệu bị kẹt" - VD Google
// Sheets trả lỗi timeout giữa chừng lúc đang ghi. { method: 'setValues', lanThu: 1 }
// -> lần gọi setValues thứ 1 (tính từ lúc đặt) sẽ ném lỗi giống Apps Script thật.
let _loiTiem = null;
function tiemLoiSheets_(cauHinh) { _loiTiem = cauHinh ? { method: cauHinh.method, conLai: cauHinh.lanThu || 1, thongBao: cauHinh.thongBao } : null; }
function kiemTraTiemLoi_(ten) {
  if (!_loiTiem || _loiTiem.method !== ten) return;
  _loiTiem.conLai -= 1;
  if (_loiTiem.conLai === 0) {
    const tb = _loiTiem.thongBao || 'Service Spreadsheets timed out while accessing document with id.';
    _loiTiem = null;
    throw new Error(tb);
  }
}

function makeFakePropertiesService() {
  const store = new Map();
  const properties = {
    getProperty: (key) => (store.has(key) ? store.get(key) : null),
    setProperty: (key, value) => { store.set(key, String(value)); },
    deleteProperty: (key) => { store.delete(key); },
    getProperties: () => Object.fromEntries(store),
  };
  return {
    getScriptProperties: () => properties,
    __store: store, // lối tắt cho test setup/assert trực tiếp
  };
}

function makeFakeRange(sheet, row, col, numRows, numCols) {
  return {
    getValues() {
      demApi_('getValues', numRows * numCols, false);
      kiemTraTiemLoi_('getValues');
      return this.__docNoiBo();
    },
    __docNoiBo() {
      const out = [];
      for (let r = 0; r < numRows; r++) {
        const rowArr = [];
        for (let c = 0; c < numCols; c++) {
          const dataRow = sheet.__data[row - 1 + r] || [];
          const raw = dataRow[col - 1 + c];
          rowArr.push(raw === undefined ? '' : taiTaoDateNeuCan_(raw));
        }
        out.push(rowArr);
      }
      return out;
    },
    getValue() {
      demApi_('getValue', 1, false);
      kiemTraTiemLoi_('getValue');
      return this.__docNoiBo()[0][0];
    },
    setValues(values) {
      demApi_('setValues', values.length * (values[0] ? values[0].length : 0), true);
      kiemTraTiemLoi_('setValues');
      return this.__ghiNoiBo(values);
    },
    __ghiNoiBo(values) {
      values.forEach((rowArr, r) => {
        while (sheet.__data.length < row + r) sheet.__data.push([]);
        const target = sheet.__data[row - 1 + r];
        rowArr.forEach((v, c) => { target[col - 1 + c] = v; });
      });
      return this;
    },
    setValue(v) {
      demApi_('setValue', 1, true);
      kiemTraTiemLoi_('setValue');
      return this.__ghiNoiBo([[v]]);
    },
    setNumberFormat() { return this; },
    setNumberFormats() { return this; },
    setFontWeight() { return this; },
    setBackground() { return this; },
    setFontColor() { return this; },
    setHorizontalAlignment() { return this; },
    clearContent() {
      for (let r = 0; r < numRows; r++) {
        const dataRow = sheet.__data[row - 1 + r];
        if (!dataRow) continue;
        for (let c = 0; c < numCols; c++) dataRow[col - 1 + c] = '';
      }
      return this;
    },
  };
}

function makeFakeSheet(name, initialRows) {
  const sheet = {
    __name: name,
    __data: (initialRows || []).map((r) => r.slice()),
    getName: () => name,
    getLastRow() { return this.__data.length; },
    getLastColumn() {
      return this.__data.reduce((max, row) => Math.max(max, row.length), 0);
    },
    getRange(row, col, numRows, numCols) {
      demApi_('getRange');
      return makeFakeRange(this, row, col, numRows === undefined ? 1 : numRows, numCols === undefined ? 1 : numCols);
    },
    getDataRange() {
      demApi_('getDataRange');
      return makeFakeRange(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1));
    },
    appendRow(arr) {
      demApi_('appendRow', arr.length, true);
      kiemTraTiemLoi_('appendRow');
      this.__data.push(arr.slice());
      return this;
    },
    deleteRow(idx) {
      demApi_('deleteRow');
      this.__data.splice(idx - 1, 1);
      return this;
    },
    deleteRows(rowPosition, howMany) {
      demApi_('deleteRows');
      this.__data.splice(rowPosition - 1, howMany);
      return this;
    },
    insertSheet() { return this; },
    setFrozenRows() { return this; },
    autoResizeColumns() { return this; },
    setRowHeight() { return this; },
    getSheets() { return [this]; },
  };
  return sheet;
}

function makeFakeSpreadsheet(id) {
  const sheets = new Map();
  const spreadsheet = {
    __id: id,
    getId: () => id,
    getSheetByName(name) { demApi_('getSheetByName'); return sheets.has(name) ? sheets.get(name) : null; },
    insertSheet(name) {
      const sh = makeFakeSheet(name, []);
      sheets.set(name, sh);
      return sh;
    },
    getSheets() { return Array.from(sheets.values()); },
    getSpreadsheetLocale: () => 'vi_VN',
    // Lối tắt CHỈ DÙNG TRONG TEST để chuẩn bị sẵn dữ liệu 1 sheet trước khi gọi hàm cần test.
    __setSheet(name, rows) {
      const sh = makeFakeSheet(name, rows);
      sheets.set(name, sh);
      return sh;
    },
  };
  return spreadsheet;
}

function makeFakeSpreadsheetApp() {
  const byId = new Map();
  const byUrl = new Map();
  return {
    openById(id) {
      demApi_('openById');
      if (!byId.has(id)) byId.set(id, makeFakeSpreadsheet(id));
      return byId.get(id);
    },
    openByUrl(url) {
      if (!byUrl.has(url)) byUrl.set(url, makeFakeSpreadsheet(url));
      return byUrl.get(url);
    },
    create(name) {
      const ss = makeFakeSpreadsheet('generated_' + name);
      return ss;
    },
    __byId: byId,
  };
}

/**
 * Mock DriveApp theo dõi đúng ID được thao tác (khác bản cũ trả về 1 object
 * cố định bất kể ID gì) - cần thiết để test HT_chiaSeTaiNguyenChoDanhSachQuyen
 * kiểm tra được addEditor() gọi đúng ID/email, và mô phỏng được lỗi quyền cho
 * riêng 1 ID cụ thể (test.__lamLoiChoId(id) trước khi gọi).
 */
function makeFakeDriveApp() {
  const idLoi = new Set();
  const rolesByFile = new Map(); // id -> Map(email -> 'VIEWER'|'COMMENTER'|'EDITOR')
  const rolesByFolder = new Map();
  function makeResource(id, rolesMap) {
    if (!rolesMap.has(id)) rolesMap.set(id, new Map());
    function ganQuyen(email, quyen) {
      if (idLoi.has(id)) throw new Error('Bạn không có quyền chia sẻ tài nguyên này (không phải chủ sở hữu).');
      rolesMap.get(id).set(String(email || '').toLowerCase(), quyen);
    }
    function boQuyenNeu(email, ...quyenCanBo) {
      if (idLoi.has(id)) throw new Error('Bạn không có quyền chia sẻ tài nguyên này (không phải chủ sở hữu).');
      const key = String(email || '').toLowerCase();
      if (quyenCanBo.indexOf(rolesMap.get(id).get(key)) !== -1) rolesMap.get(id).delete(key);
    }
    function layTheoQuyen(...quyen) {
      return Array.from(rolesMap.get(id).entries())
        .filter(([, r]) => quyen.indexOf(r) !== -1)
        .map(([email]) => ({ getEmail: () => email }));
    }
    return {
      getId: () => id,
      addEditor(email) { ganQuyen(email, 'EDITOR'); return this; },
      addViewer(email) { ganQuyen(email, 'VIEWER'); return this; },
      addCommenter(email) { ganQuyen(email, 'COMMENTER'); return this; },
      removeEditor(email) { boQuyenNeu(email, 'EDITOR'); return this; },
      // removeViewer() thật của DriveApp gỡ luôn cả quyền Bình luận (2 nhóm gộp chung).
      removeViewer(email) { boQuyenNeu(email, 'VIEWER', 'COMMENTER'); return this; },
      getEditors: () => layTheoQuyen('EDITOR'),
      getViewers: () => layTheoQuyen('VIEWER', 'COMMENTER'),
      createFile: () => ({ getId: () => 'fake-file-id' }),
      addFile: () => makeResource(id, rolesMap),
    };
  }
  return {
    getFolderById: (id) => makeResource(id, rolesByFolder),
    getFileById: (id) => makeResource(id, rolesByFile),
    getRootFolder: () => ({ removeFile: () => {} }),
    __lamLoiChoId: (id) => idLoi.add(id),
    __layEditorsFile: (id) => Array.from((rolesByFile.get(id) || new Map()).entries()).filter(([, r]) => r === 'EDITOR').map(([e]) => e),
    __layEditorsFolder: (id) => Array.from((rolesByFolder.get(id) || new Map()).entries()).filter(([, r]) => r === 'EDITOR').map(([e]) => e),
    __layQuyenFile: (id, email) => (rolesByFile.get(id) || new Map()).get(String(email || '').toLowerCase()),
    __layQuyenFolder: (id, email) => (rolesByFolder.get(id) || new Map()).get(String(email || '').toLowerCase()),
  };
}

function makeFakeUtilities() {
  return {
    formatDate: (date, tz, fmt) => {
      // Định dạng RẤT đơn giản, đủ cho test (không cần đúng 100% mọi token) -
      // chỉ hỗ trợ đúng các mẫu Code.gs thực sự dùng (dd/MM/yyyy, HH:mm:ss...).
      const pad = (n) => String(n).padStart(2, '0');
      const d = date;
      return fmt
        .replace('yyyy', d.getFullYear())
        .replace('MM', pad(d.getMonth() + 1))
        .replace('dd', pad(d.getDate()))
        .replace('HH', pad(d.getHours()))
        .replace('mm', pad(d.getMinutes()))
        .replace('ss', pad(d.getSeconds()));
    },
    newBlob: (bytes, mimeType, name) => ({ bytes, mimeType, name }),
    base64Decode: (str) => Buffer.from(str, 'base64'),
    base64Encode: (bytes) => Buffer.from(bytes).toString('base64'),
  };
}

/**
 * Script Lock có TRẠNG THÁI, dùng chung cho cả env (giống Apps Script thật:
 * Script Lock là khóa toàn cục của cả dự án, xuyên suốt mọi lần gọi).
 * - __giuBoiPhienKhac=true: mô phỏng 1 người dùng khác đang giữ khóa lâu (luồng
 *   bị kẹt) -> waitLock() ném lỗi timeout như Apps Script thật, KHÔNG treo.
 * - __nhatKy: thứ tự các thao tác khóa, để kiểm tra khóa có được TRẢ đúng
 *   sau mọi lối thoát (kể cả khi lỗi giữa chừng) - khóa không được trả chính
 *   là nguyên nhân khiến MỌI người dùng sau đó đều bị "treo" chờ khóa.
 */
function makeFakeLockService() {
  const state = { __giuBoiPhienKhac: false, __dangGiu: false, __soLanCho: 0, __soLanLay: 0, __soLanTra: 0, __timeoutYeuCau: [], __nhatKy: [] };
  const lock = {
    waitLock(ms) {
      state.__soLanCho += 1;
      state.__timeoutYeuCau.push(ms);
      state.__nhatKy.push('waitLock');
      if (state.__giuBoiPhienKhac) throw new Error('Lock timeout: another process was holding the lock for too long.');
      state.__dangGiu = true;
      state.__soLanLay += 1;
    },
    tryLock(ms) {
      try { this.waitLock(ms); return true; } catch (e) { return false; }
    },
    hasLock() { return state.__dangGiu; },
    releaseLock() {
      state.__nhatKy.push('releaseLock');
      if (state.__dangGiu) { state.__dangGiu = false; state.__soLanTra += 1; }
    },
  };
  return Object.assign(state, { getScriptLock: () => lock, getUserLock: () => lock, getDocumentLock: () => lock });
}

function makeFakeSession(initialEmail) {
  let email = initialEmail || '';
  return {
    getActiveUser: () => ({ getEmail: () => email }),
    getScriptTimeZone: () => 'Asia/Ho_Chi_Minh',
    __setEmail: (e) => { email = e; },
  };
}

function makeFakeCacheService() {
  const store = new Map();
  return {
    getScriptCache: () => ({
      get: (k) => (store.has(k) ? store.get(k) : null),
      put: (k, v) => { store.set(k, v); },
    }),
  };
}

function makeFakeHtmlService() {
  return {
    createHtmlOutput: (html) => ({
      __html: html,
      setTitle() { return this; },
      addMetaTag() { return this; },
    }),
    createTemplateFromFile: () => ({
      evaluate: () => ({
        setTitle() { return this; },
        addMetaTag() { return this; },
        setXFrameOptionsMode() { return this; },
      }),
    }),
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
  };
}

module.exports = {
  makeFakePropertiesService,
  makeFakeSpreadsheetApp,
  makeFakeSpreadsheet,
  makeFakeSheet,
  makeFakeDriveApp,
  makeFakeUtilities,
  makeFakeLockService,
  makeFakeSession,
  makeFakeCacheService,
  makeFakeHtmlService,
  setActiveDateCtor_,
  resetApiCounter_,
  getApiCounter_,
  tiemLoiSheets_,
};
