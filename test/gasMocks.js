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
      const out = [];
      for (let r = 0; r < numRows; r++) {
        const rowArr = [];
        for (let c = 0; c < numCols; c++) {
          const dataRow = sheet.__data[row - 1 + r] || [];
          rowArr.push(dataRow[col - 1 + c] === undefined ? '' : dataRow[col - 1 + c]);
        }
        out.push(rowArr);
      }
      return out;
    },
    getValue() {
      return this.getValues()[0][0];
    },
    setValues(values) {
      values.forEach((rowArr, r) => {
        while (sheet.__data.length < row + r) sheet.__data.push([]);
        const target = sheet.__data[row - 1 + r];
        rowArr.forEach((v, c) => { target[col - 1 + c] = v; });
      });
      return this;
    },
    setValue(v) {
      return this.setValues([[v]]);
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
      return makeFakeRange(this, row, col, numRows === undefined ? 1 : numRows, numCols === undefined ? 1 : numCols);
    },
    getDataRange() {
      return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1));
    },
    appendRow(arr) {
      this.__data.push(arr.slice());
      return this;
    },
    deleteRow(idx) {
      this.__data.splice(idx - 1, 1);
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
    getSheetByName(name) { return sheets.has(name) ? sheets.get(name) : null; },
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

function makeFakeDriveApp() {
  const folder = {
    createFile: () => ({ getId: () => 'fake-file-id' }),
    addFile: () => folder,
  };
  return {
    getFolderById: () => folder,
    getFileById: () => ({ getId: () => 'fake-file-id' }),
    getRootFolder: () => ({ removeFile: () => {} }),
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

function makeFakeLockService() {
  return {
    getScriptLock: () => ({
      waitLock: () => {},
      releaseLock: () => {},
    }),
  };
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
};
