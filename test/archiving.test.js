const { createGasEnv } = require('./gasEnv');

const PHIEUCAN_SPREADSHEET_ID = '1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g';
const DATA_SHEET = 'PhieuCan_DN';
const ADMIN_EMAIL = 'saoluucvhak@gmail.com';

/** Dựng 1 dòng PhieuCan_DN đủ 27 cột (A..AA). */
function makeRow(overrides) {
  const row = new Array(27).fill('');
  return Object.assign(row, overrides);
}

function setupPhieuCan(env, rows) {
  const ss = env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID);
  const header = new Array(27).fill('').map((_, i) => 'Cot' + i);
  ss.__setSheet(DATA_SHEET, [header, ...rows]);
  return ss;
}

describe('HT_chotSoNam() - chốt sổ năm, chuyển phiếu đã "OK" sang sheet lưu trữ', () => {
  test('CHỈ ADMIN mới chốt sổ được', () => {
    const env = createGasEnv({ email: 'ai-do@gmail.com' });
    setupPhieuCan(env, [makeRow({ 1: new Date(2024, 0, 1), 24: 'OK' })]);
    const res = env.call('HT_chotSoNam', 2024);
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/quyền Quản trị/);
  });

  test('từ chối năm không hợp lệ', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    setupPhieuCan(env, []);
    expect(env.call('HT_chotSoNam', 'abc').status).toBe('error');
    expect(env.call('HT_chotSoNam', 1999).status).toBe('error');
  });

  test('chỉ chuyển đúng phiếu ĐÃ "OK" của ĐÚNG năm được chọn - bỏ qua phiếu chưa OK và phiếu năm khác', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    const rows = [
      makeRow({ 0: 'P1', 1: new Date(2024, 0, 1), 24: 'OK' }),      // năm 2024, OK -> ĐỦ ĐIỀU KIỆN
      makeRow({ 0: 'P2', 1: new Date(2024, 5, 1), 24: '' }),        // năm 2024, CHƯA OK -> giữ lại
      makeRow({ 0: 'P3', 1: new Date(2025, 0, 1), 24: 'OK' }),      // năm 2025 (khác năm) -> giữ lại
      makeRow({ 0: 'P4', 1: new Date(2024, 11, 31), 24: 'OK' }),    // năm 2024, OK -> ĐỦ ĐIỀU KIỆN
    ];
    const ss = setupPhieuCan(env, rows);

    const res = env.call('HT_chotSoNam', 2024);
    expect(res.status).toBe('success');
    expect(res.message).toMatch(/Đã chuyển 2 phiếu/);
    expect(res.message).toMatch(/PhieuCan_DN_2024/);

    const sheetChinh = ss.getSheetByName(DATA_SHEET);
    expect(sheetChinh.getLastRow()).toBe(3); // header + P2 + P3 còn lại
    const conLai = sheetChinh.getRange(2, 1, 2, 27).getValues().map(r => r[0]);
    expect(conLai.sort()).toEqual(['P2', 'P3']);

    const sheetLuuTru = ss.getSheetByName('PhieuCan_DN_2024');
    expect(sheetLuuTru).toBeTruthy();
    const daChuyen = sheetLuuTru.getRange(2, 1, sheetLuuTru.getLastRow() - 1, 27).getValues().map(r => r[0]);
    expect(daChuyen.sort()).toEqual(['P1', 'P4']);
  });

  test('không có phiếu nào đủ điều kiện -> báo rõ, KHÔNG tạo sheet lưu trữ mới', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    const ss = setupPhieuCan(env, [makeRow({ 0: 'P1', 1: new Date(2024, 0, 1), 24: '' })]); // chưa OK
    const res = env.call('HT_chotSoNam', 2024);
    expect(res.status).toBe('success');
    expect(res.message).toMatch(/không có phiếu nào/i);
    expect(ss.getSheetByName('PhieuCan_DN_2024')).toBeNull();
  });

  test('chạy CHỐT SỔ 2 lần cho cùng 1 năm -> lần sau NỐI THÊM vào sheet lưu trữ, không ghi đè lần trước', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    setupPhieuCan(env, [makeRow({ 0: 'P1', 1: new Date(2024, 0, 1), 24: 'OK' })]);
    env.call('HT_chotSoNam', 2024);

    // Giả lập có thêm 1 phiếu 2024 khác được chốt "OK" sau đó
    const ss = env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID);
    const sheetChinh = ss.getSheetByName(DATA_SHEET);
    sheetChinh.appendRow(makeRow({ 0: 'P5', 1: new Date(2024, 2, 1), 24: 'OK' }));

    const res2 = env.call('HT_chotSoNam', 2024);
    expect(res2.status).toBe('success');
    expect(res2.message).toMatch(/Đã chuyển 1 phiếu/);

    const sheetLuuTru = ss.getSheetByName('PhieuCan_DN_2024');
    expect(sheetLuuTru.getLastRow()).toBe(3); // header + P1 (lần 1) + P5 (lần 2), KHÔNG mất P1
    const daChuyen = sheetLuuTru.getRange(2, 1, 2, 27).getValues().map(r => r[0]);
    expect(daChuyen.sort()).toEqual(['P1', 'P5']);
  });

  test('nhiều KHỐI dòng không liên tiếp đều được chuyển đúng và xóa đúng khỏi sheet chính', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    const rows = [
      makeRow({ 0: 'A', 1: new Date(2024, 0, 1), 24: 'OK' }),  // chuyển
      makeRow({ 0: 'B', 1: new Date(2024, 0, 2), 24: 'OK' }),  // chuyển (liền A)
      makeRow({ 0: 'C', 1: new Date(2025, 0, 1), 24: 'OK' }),  // GIỮ (khác năm) - chen giữa 2 khối
      makeRow({ 0: 'D', 1: new Date(2024, 0, 3), 24: 'OK' }),  // chuyển
      makeRow({ 0: 'E', 1: new Date(2024, 0, 4), 24: '' }),    // GIỮ (chưa OK)
      makeRow({ 0: 'F', 1: new Date(2024, 0, 5), 24: 'OK' }),  // chuyển
    ];
    const ss = setupPhieuCan(env, rows);
    const res = env.call('HT_chotSoNam', 2024);
    expect(res.message).toMatch(/Đã chuyển 4 phiếu/);

    const sheetChinh = ss.getSheetByName(DATA_SHEET);
    const conLai = sheetChinh.getRange(2, 1, sheetChinh.getLastRow() - 1, 27).getValues().map(r => r[0]);
    expect(conLai.sort()).toEqual(['C', 'E']);

    const sheetLuuTru = ss.getSheetByName('PhieuCan_DN_2024');
    const daChuyen = sheetLuuTru.getRange(2, 1, sheetLuuTru.getLastRow() - 1, 27).getValues().map(r => r[0]);
    expect(daChuyen.sort()).toEqual(['A', 'B', 'D', 'F']);
  });
});

describe('HT_layThongKeNamPhieuCan() - thống kê theo năm để Admin quyết định chốt sổ', () => {
  test('CHỈ ADMIN xem được, đếm đúng số dòng OK/chưa OK theo từng năm', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    const rows = [
      makeRow({ 1: new Date(2024, 0, 1), 24: 'OK' }),
      makeRow({ 1: new Date(2024, 5, 1), 24: 'OK' }),
      makeRow({ 1: new Date(2024, 8, 1), 24: '' }),
      makeRow({ 1: new Date(2025, 0, 1), 24: 'OK' }),
    ];
    setupPhieuCan(env, rows);

    const res = env.call('HT_layThongKeNamPhieuCan');
    expect(res.status).toBe('success');
    const nam2024 = res.data.find(d => d.nam === 2024);
    const nam2025 = res.data.find(d => d.nam === 2025);
    expect(nam2024).toEqual(expect.objectContaining({ ok: 2, chuaOk: 1, coTheChotSo: true }));
    expect(nam2025).toEqual(expect.objectContaining({ ok: 1, chuaOk: 0 }));
  });

  test('nhân viên thường không xem được', () => {
    const env = createGasEnv({ email: 'nv@gmail.com' });
    setupPhieuCan(env, []);
    expect(env.call('HT_layThongKeNamPhieuCan').status).toBe('error');
  });
});

describe('LT_docPhieuCanGopLuuTru_() - gộp dữ liệu sheet chính + sheet lưu trữ theo bộ lọc ngày', () => {
  test('không lọc ngày -> gộp TẤT CẢ các năm đã lưu trữ', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    setupPhieuCan(env, [makeRow({ 0: 'HotRow', 1: new Date(2026, 0, 1), 24: '' })]);
    env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID)
      .__setSheet('PhieuCan_DN_2023', [new Array(27).fill(''), makeRow({ 0: 'Old2023' })]);
    env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID)
      .__setSheet('PhieuCan_DN_2024', [new Array(27).fill(''), makeRow({ 0: 'Old2024' })]);

    const rows = env.call('LT_docPhieuCanGopLuuTru_', '', '', 27);
    const soPhieuList = rows.map(r => r[0]).sort();
    expect(soPhieuList).toEqual(['HotRow', 'Old2023', 'Old2024']);
  });

  test('có lọc ngày trong phạm vi 1 năm KHÔNG lưu trữ -> chỉ đọc sheet chính, không đụng sheet lưu trữ khác', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    setupPhieuCan(env, [makeRow({ 0: 'HotRow', 1: new Date(2026, 0, 1), 24: '' })]);
    env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID)
      .__setSheet('PhieuCan_DN_2023', [new Array(27).fill(''), makeRow({ 0: 'Old2023' })]);

    const rows = env.call('LT_docPhieuCanGopLuuTru_', '2026-01-01', '2026-01-31', 27);
    expect(rows.map(r => r[0])).toEqual(['HotRow']);
  });

  test('bộ lọc ngày CHẠM vào năm đã lưu trữ -> tự động gộp thêm đúng năm đó', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    setupPhieuCan(env, [makeRow({ 0: 'HotRow', 1: new Date(2026, 0, 1), 24: '' })]);
    env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID)
      .__setSheet('PhieuCan_DN_2023', [new Array(27).fill(''), makeRow({ 0: 'Old2023' })]);

    const rows = env.call('LT_docPhieuCanGopLuuTru_', '2023-01-01', '2026-12-31', 27);
    expect(rows.map(r => r[0]).sort()).toEqual(['HotRow', 'Old2023']);
  });
});
