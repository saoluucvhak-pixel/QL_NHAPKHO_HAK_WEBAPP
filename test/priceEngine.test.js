const { createGasEnv } = require('./gasEnv');

const PHIEUCAN_SPREADSHEET_ID = '1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g';
const DATA_SHEET = 'PhieuCan_DN';
const BAOGIA_SPREADSHEET_ID = '1SIhfjP5-6ouRPDj265lAMmI5yWs1XcnedjqpzDwaIC0';
const SHEET_BAO_GIA = 'Baogia_DN_SAVE';

function setupBaoGia(env, bands) {
  const ssBG = env.spreadsheetApp.openById(BAOGIA_SPREADSHEET_ID);
  ssBG.__setSheet(SHEET_BAO_GIA, [
    ['Timestamp', 'Từ', 'Đến', 'Mã ĐG', 'Min', 'Max', 'Giá'],
    ...bands,
  ]);
}

/** Dựng 1 dòng PhieuCan_DN đủ 26 cột (A..Z), mặc định CHƯA "OK". */
function makeRow(overrides) {
  const row = new Array(26).fill('');
  row[24] = ''; // Y - Trạng thái mặc định: chưa OK
  return Object.assign(row, overrides);
}

function setupPhieuCan(env, rows) {
  const ss = env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID);
  const header = new Array(26).fill('');
  ss.__setSheet(DATA_SHEET, [header, ...rows]);
  return ss.getSheetByName(DATA_SHEET);
}

describe('runCalculatePrice_core() - tối ưu lưu trữ: CHỈ ghi lại dòng chưa "OK", không đụng dòng đã chốt', () => {
  test('sheet trống (chỉ có header) -> không lỗi, không ghi gì, báo rõ "không có phiếu nào cần tính"', () => {
    const env = createGasEnv();
    setupPhieuCan(env, []);
    setupBaoGia(env, []);
    const res = env.call('runCalculatePrice_core');
    expect(res.status).toBe('success');
    expect(res.message).toMatch(/Không có phiếu nào cần tính giá/);
  });

  test('mọi dòng đều đã "OK" -> không ghi lại gì (dòng OK giữ nguyên 100%, kể cả giá trị "sai"/sentinel cũ)', () => {
    const env = createGasEnv();
    const rowOK = makeRow({ 19: 999999, 23: 888888, 24: 'OK', 25: 777777 }); // giá trị sentinel CỐ TÌNH khác công thức thật, để phát hiện nếu bị ghi đè nhầm
    setupPhieuCan(env, [rowOK]);
    setupBaoGia(env, []);

    const res = env.call('runCalculatePrice_core');
    expect(res.status).toBe('success');
    expect(res.message).toMatch(/Không có phiếu nào cần tính lại giá \(tất cả đã chốt OK\)/);

    const sheet = env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID).getSheetByName(DATA_SHEET);
    const row = sheet.getRange(2, 1, 1, 26).getValues()[0];
    expect(row[19]).toBe(999999); // KHÔNG bị ghi đè lại - vẫn đúng giá trị sentinel cũ
    expect(row[23]).toBe(888888);
    expect(row[24]).toBe('OK');
    expect(row[25]).toBe(777777);
  });

  test('tính đúng giá cho dòng CHƯA "OK" và CHỈ ghi lại đúng dòng đó, không đụng các dòng "OK" khác', () => {
    const env = createGasEnv();
    const tsGiua = new Date(2026, 5, 15, 10, 0, 0).getTime();
    setupBaoGia(env, [[new Date(), new Date(2026, 0, 1), new Date(2026, 11, 31), 'DL1_NG1_Y', 0, 50, 1000000]]);

    const rowOKtruoc = makeRow({ 19: 111, 23: 111, 24: 'OK', 25: 111 }); // dòng OK PHÍA TRƯỚC dòng cần tính
    const rowCanTinh = makeRow({
      1: new Date(tsGiua), 2: new Date(tsGiua), // B,C - Ngày/Giờ cân 1
      9: 20000, // J - KL Hàng (20 tấn)
      16: 'DL1_NG1_Y', // Q - Mã ĐG
      17: 50000, // R - hiệu số cộng thêm
      24: '', // Y - chưa OK
    });
    const rowOKsau = makeRow({ 19: 222, 23: 222, 24: 'OK', 25: 222 }); // dòng OK PHÍA SAU dòng cần tính

    setupPhieuCan(env, [rowOKtruoc, rowCanTinh, rowOKsau]);

    const res = env.call('runCalculatePrice_core');
    expect(res.status).toBe('success');
    expect(res.message).toMatch(/Đã tính giá cho 1 phiếu chưa chốt/);

    const sheet = env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID).getSheetByName(DATA_SHEET);
    const all = sheet.getRange(2, 1, 3, 26).getValues();

    // Dòng 1 (OK trước) và dòng 3 (OK sau) TUYỆT ĐỐI không bị đụng tới
    expect([all[0][19], all[0][23], all[0][24], all[0][25]]).toEqual([111, 111, 'OK', 111]);
    expect([all[2][19], all[2][23], all[2][24], all[2][25]]).toEqual([222, 222, 'OK', 222]);

    // Dòng giữa được tính ĐÚNG công thức: giá=1,000,000 (khớp band 0-50 tấn), hiệu số = giá + rVal = 1,050,000
    // thành tiền = 20 (tấn) * 1,050,000 = 21,000,000 (đã là bội số 1000 nên không đổi khi làm tròn)
    expect(all[1][19]).toBe(1000000);
    expect(all[1][23]).toBe(1050000);
    expect(all[1][24]).toBe('Test giá');
    expect(all[1][25]).toBe(21000000);
  });

  test('không tìm được báo giá phù hợp -> giá=0, trạng thái "Lỗi ĐK/Báo giá", vẫn ghi lại (không phải OK)', () => {
    const env = createGasEnv();
    setupBaoGia(env, []); // không có báo giá nào
    const row = makeRow({
      1: new Date(2026, 0, 1), 2: new Date(2026, 0, 1),
      9: 20000, 16: 'MA_KHONG_TON_TAI', 17: 0, 24: '',
    });
    setupPhieuCan(env, [row]);

    env.call('runCalculatePrice_core');

    const sheet = env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID).getSheetByName(DATA_SHEET);
    const result = sheet.getRange(2, 1, 1, 26).getValues()[0];
    expect(result[19]).toBe(0);
    expect(result[24]).toBe('Lỗi ĐK/Báo giá');
  });

  test('nhiều KHỐI không liên tiếp (OK-chưaOK-OK-chưaOK) đều được tính và ghi đúng, không lẫn lộn giữa các khối', () => {
    const env = createGasEnv();
    setupBaoGia(env, [[new Date(), new Date(2026, 0, 1), new Date(2026, 11, 31), 'MA_A', 0, 50, 500000]]);

    const ts = new Date(2026, 3, 1, 8, 0, 0).getTime();
    const rows = [
      makeRow({ 24: 'OK', 19: 1 }),
      makeRow({ 1: new Date(ts), 2: new Date(ts), 9: 10000, 16: 'MA_A', 17: 0, 24: '' }), // khối 1: cần tính
      makeRow({ 24: 'OK', 19: 2 }),
      makeRow({ 24: 'OK', 19: 3 }),
      makeRow({ 1: new Date(ts), 2: new Date(ts), 9: 10000, 16: 'MA_A', 17: 0, 24: '' }), // khối 2: cần tính
      makeRow({ 1: new Date(ts), 2: new Date(ts), 9: 10000, 16: 'MA_A', 17: 0, 24: '' }), // khối 2: cần tính (liền kề dòng trên)
    ];
    setupPhieuCan(env, rows);

    const res = env.call('runCalculatePrice_core');
    expect(res.message).toMatch(/Đã tính giá cho 3 phiếu chưa chốt/);

    const sheet = env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID).getSheetByName(DATA_SHEET);
    const all = sheet.getRange(2, 1, 6, 26).getValues();
    expect(all[0][19]).toBe(1); // OK giữ nguyên
    expect(all[1][19]).toBe(500000); // tính đúng
    expect(all[2][19]).toBe(2); // OK giữ nguyên
    expect(all[3][19]).toBe(3); // OK giữ nguyên
    expect(all[4][19]).toBe(500000); // tính đúng (khối 2, dòng đầu)
    expect(all[5][19]).toBe(500000); // tính đúng (khối 2, dòng liền kề)
  });
});
