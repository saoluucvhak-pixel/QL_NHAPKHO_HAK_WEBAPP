const { createGasEnv } = require('./gasEnv');

// ID/tên sheet lấy đúng từ hằng số KHODAM_CONFIG khai báo trong Config.gs.
const KHODAM_SPREADSHEET_ID = '1MQ6eCOKgJyd4t1J84nA24hvkjSTufdH8jhJX-EJTWQU';
const SHEET_NHAPDOKHO = 'Nhapdokho';

describe('xuLySuaXoaDoKho() - vẫn ghi ĐÚNG dữ liệu sau khi gộp 4 lệnh setValue thành 1 setValues (tối ưu hiệu năng)', () => {
  function setupSheet(env, rows) {
    const ss = env.spreadsheetApp.openById(KHODAM_SPREADSHEET_ID);
    return ss.__setSheet(SHEET_NHAPDOKHO, [
      ['Ngày nhập', 'Hình thức', 'Độ Khô', 'Độ Ấm', 'Trạng thái'],
      ...rows,
    ]);
  }

  test('SỬA 1 dòng đã có: cập nhật đúng cả 4 cột B..E (Hình thức/Độ khô/Độ ẩm/Trạng thái) trong 1 lần ghi', () => {
    const env = createGasEnv();
    setupSheet(env, [[new Date(2026, 0, 15), 'NKSX', 0.35, 0.2, 'Hợp lệ']]);

    const res = env.call('xuLySuaXoaDoKho', { ngay: '2026-01-15', hinhThuc: 'TP', doKho: 40, doAm: 25 });
    expect(res).toMatch(/Đã cập nhật/);

    const sheet = env.spreadsheetApp.openById(KHODAM_SPREADSHEET_ID).getSheetByName(SHEET_NHAPDOKHO);
    const row = sheet.getRange(2, 1, 1, 5).getValues()[0];
    expect(row[1]).toBe('TP');   // Hình thức
    expect(row[2]).toBeCloseTo(0.4); // Độ khô (40% -> 0.4)
    expect(row[3]).toBeCloseTo(0.25); // Độ ẩm (25% -> 0.25)
    expect(row[4]).toBe('Hợp lệ'); // Trạng thái không đổi khi SỬA (khác XÓA)
  });

  test('THÊM MỚI khi chưa có dòng nào cho ngày đó (nhánh appendRow, không đổi bởi tối ưu)', () => {
    const env = createGasEnv();
    setupSheet(env, []);
    const res = env.call('xuLySuaXoaDoKho', { ngay: '2026-02-01', hinhThuc: 'TP', doKho: 38, doAm: 22 });
    expect(res).toMatch(/Đã thêm/);
    const sheet = env.spreadsheetApp.openById(KHODAM_SPREADSHEET_ID).getSheetByName(SHEET_NHAPDOKHO);
    expect(sheet.getLastRow()).toBe(2); // header + 1 dòng mới
  });

  test('XÓA 1 dòng đã có: chỉ đổi cột Trạng thái (cột E) thành "Đã hủy", KHÔNG đụng cột khác', () => {
    const env = createGasEnv();
    setupSheet(env, [[new Date(2026, 0, 15), 'NKSX', 0.35, 0.2, 'Hợp lệ']]);
    const res = env.call('xuLySuaXoaDoKho', { ngay: '2026-01-15', hanhDong: 'XOA' });
    expect(res).toMatch(/Đã xóa/);
    const sheet = env.spreadsheetApp.openById(KHODAM_SPREADSHEET_ID).getSheetByName(SHEET_NHAPDOKHO);
    const row = sheet.getRange(2, 1, 1, 5).getValues()[0];
    expect(row[1]).toBe('NKSX'); // Hình thức GIỮ NGUYÊN
    expect(row[4]).toBe('Đã hủy');
  });
});
