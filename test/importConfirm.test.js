const { createGasEnv } = require('./gasEnv');

// ID/tên sheet lấy đúng từ CONFIG/BAOGIA_CONFIG khai báo trong Config.gs.
const PHIEUCAN_SPREADSHEET_ID = '1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g';
const DATA_SHEET = 'PhieuCan_DN';
const BAOGIA_SPREADSHEET_ID = '1SIhfjP5-6ouRPDj265lAMmI5yWs1XcnedjqpzDwaIC0';
const SHEET_BAO_GIA = 'Baogia_DN_SAVE';

/** Chuẩn bị PhieuCan_DN với 1 dòng "chưa khóa OK" sẵn có, và sheet Báo giá trống (tránh lỗi phụ khi step1_ConfirmImport tự gọi runCalculatePrice_core). */
function setupSpreadsheets(env, existingRow) {
  const ssPC = env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID);
  const header = new Array(25).fill('');
  const rows = existingRow ? [header, existingRow] : [header];
  ssPC.__setSheet(DATA_SHEET, rows);

  const ssBG = env.spreadsheetApp.openById(BAOGIA_SPREADSHEET_ID);
  ssBG.__setSheet(SHEET_BAO_GIA, [['Timestamp', 'Từ', 'Đến', 'Mã ĐG', 'Min', 'Max', 'Giá']]);

  return ssPC.getSheetByName(DATA_SHEET);
}

describe('step1_ConfirmImport() - cập nhật phiếu đã tồn tại (chưa khóa OK) khi re-import file đã sửa', () => {
  test('BUG ĐÃ SỬA: re-import cập nhật ĐÚNG cả khối lượng/ngày giờ/số xe, không chỉ mã khách hàng/đại lý/nguồn gốc', () => {
    const env = createGasEnv();
    const oldRow = new Array(25).fill('');
    oldRow[0] = '500';                          // A - Số phiếu
    oldRow[1] = new Date(2026, 0, 1);           // B - Ngày cân 1 (SAI, sẽ được sửa)
    oldRow[5] = '51C-000.00';                   // F - Số xe (SAI, sẽ được sửa)
    oldRow[7] = 30000; oldRow[8] = 10000; oldRow[9] = 20000; // H,I,J - khối lượng SAI
    oldRow[10] = 'OLDDL_OLDNG'; oldRow[11] = 'Khách Cũ';     // K,L
    oldRow[13] = 'OLDDL'; oldRow[14] = 'OLDNG';              // N,O
    oldRow[16] = 'OLDDL_OLDNG_Y';                            // Q
    oldRow[21] = '500/2026/NK'; oldRow[22] = '500/2026/NK';  // V,W - Mã chứng từ (key)
    oldRow[24] = '';                                          // Y - Trạng thái KHÁC "OK" -> vẫn sửa được

    setupSpreadsheets(env, oldRow);

    const rawDateC = new Date(2026, 5, 15, 9, 30, 0).toISOString();
    const rawDateD = new Date(2026, 5, 15, 14, 0, 0).toISOString();
    const res = env.call('step1_ConfirmImport', [{
      isError: false,
      soPhieu: '500',
      soXe: '51C-999.99',       // ĐÃ SỬA
      uniqueKey: '500/2026/NK', // trùng dòng cũ -> đi vào nhánh CẬP NHẬT
      khGoc: 'Khách Mới Đã Sửa',
      dlGoc: 'newdl',
      ngGoc: 'newng',
      klCan1: 31000, klCan2: 11000, klHangGoc: 21000, // KHỐI LƯỢNG ĐÃ SỬA (trước đây bị bỏ qua, đây là bug đã fix)
      rawDateC, rawDateD,
    }], false);

    expect(res.status).toBe('success');
    expect(res.message).toMatch(/Cập nhật: 1/);

    const sheet = env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID).getSheetByName(DATA_SHEET);
    const row = sheet.getRange(2, 1, 1, 25).getValues()[0];

    // Khối lượng phải được CẬP NHẬT (đây chính là bug đã sửa ở phiên trước)
    expect(row[7]).toBe(31000);  // H - Cân lần 1
    expect(row[8]).toBe(11000);  // I - Cân lần 2
    expect(row[9]).toBe(21000);  // J - KL Hàng

    // Ngày/giờ cân cũng phải được cập nhật theo file mới
    expect(row[1].getFullYear()).toBe(2026);
    expect(row[1].getMonth()).toBe(5); // tháng 6 (0-based = 5)
    expect(row[1].getDate()).toBe(15);

    // Số xe cũng được cập nhật
    expect(row[5]).toBe('51C-999.99');

    // Mã khách hàng/đại lý/nguồn gốc vẫn cập nhật đúng như trước (hành vi gốc không đổi)
    expect(row[10]).toBe('NEWDL_NEWNG'); // K
    expect(row[11]).toBe('Khách Mới Đã Sửa'); // L
    expect(row[13]).toBe('NEWDL'); // N
    expect(row[14]).toBe('NEWNG'); // O
    expect(row[16]).toBe('NEWDL_NEWNG_Y'); // Q

    // Mã chứng từ (khóa duy nhất) không đổi
    expect(row[21]).toBe('500/2026/NK');
  });

  test('phiếu đã khóa "OK" thì BỎ QUA hoàn toàn khi re-import (không ghi đè số liệu đã chốt)', () => {
    const env = createGasEnv();
    const oldRow = new Array(25).fill('');
    oldRow[0] = '501';
    oldRow[7] = 30000; oldRow[8] = 10000; oldRow[9] = 20000;
    oldRow[21] = '501/2026/NK'; oldRow[22] = '501/2026/NK';
    oldRow[24] = 'OK'; // ĐÃ KHÓA

    setupSpreadsheets(env, oldRow);

    const res = env.call('step1_ConfirmImport', [{
      isError: false, soPhieu: '501', soXe: 'XE-MOI',
      uniqueKey: '501/2026/NK', khGoc: 'X', dlGoc: 'x', ngGoc: 'y',
      klCan1: 99999, klCan2: 99999, klHangGoc: 99999,
      rawDateC: new Date(2026, 0, 1).toISOString(), rawDateD: new Date(2026, 0, 1).toISOString(),
    }], false);

    expect(res.status).toBe('success');
    expect(res.message).toMatch(/Bỏ qua: 1/);

    const sheet = env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID).getSheetByName(DATA_SHEET);
    const row = sheet.getRange(2, 1, 1, 25).getValues()[0];
    expect(row[9]).toBe(20000); // KL Hàng GIỮ NGUYÊN, không bị ghi đè bởi 99999
  });

  test('phiếu HOÀN TOÀN MỚI được thêm vào cuối sheet (không đụng dòng đã có)', () => {
    const env = createGasEnv();
    setupSpreadsheets(env, null); // sheet trống, chỉ có header

    const res = env.call('step1_ConfirmImport', [{
      isError: false, soPhieu: '600', soXe: '43A-111.11',
      uniqueKey: '600/2026/NK', khGoc: 'Khách Mới', dlGoc: 'dl1', ngGoc: 'ng1',
      klCan1: 15000, klCan2: 5000, klHangGoc: 10000,
      rawDateC: new Date(2026, 2, 3, 8, 0, 0).toISOString(),
      rawDateD: new Date(2026, 2, 3, 9, 0, 0).toISOString(),
    }], false);

    expect(res.status).toBe('success');
    expect(res.message).toMatch(/Mới: 1/);

    const sheet = env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID).getSheetByName(DATA_SHEET);
    expect(sheet.getLastRow()).toBe(2); // header + 1 dòng mới
    const row = sheet.getRange(2, 1, 1, 23).getValues()[0];
    expect(row[0]).toBe('600');
    expect(row[9]).toBe(10000); // KL Hàng
    expect(row[21]).toBe('600/2026/NK');
  });
});
