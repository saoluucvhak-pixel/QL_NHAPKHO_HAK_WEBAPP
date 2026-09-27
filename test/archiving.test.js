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

// Chức năng "Chốt sổ năm" đã bỏ (27/09/2026) - chỉ còn kiểm tra việc ĐỌC các
// sheet PhieuCan_DN_<năm> đã tồn tại từ trước.
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
