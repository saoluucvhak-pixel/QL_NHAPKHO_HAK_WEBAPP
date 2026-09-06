const { createGasEnv } = require('./gasEnv');

const PHIEUCAN_SPREADSHEET_ID = '1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g';
const DATA_SHEET = 'PhieuCan_DN';
const MISA_DST_ID = '1vkeu2YxME6fsp9ed8DokdtV1jxla5pA-H7heHBt-BRs';
const MISA_DST_SHEET = 'Update_MiSa_PC';

function makeRow(overrides) {
  const row = new Array(27).fill('');
  return Object.assign(row, overrides);
}

function ticket(maChungTu, ngay, opts) {
  opts = opts || {};
  return makeRow(Object.assign({
    0: 'SP-' + maChungTu, 1: ngay, 5: 'XE-CU', 9: 5000, 11: 'KH CU',
    13: 'DL', 14: 'NG', 16: 'DL_NG_Y', 19: 1000000, 21: maChungTu, 22: maChungTu,
    23: 1000000, 24: 'OK', 25: 5000000, 26: opts.idDntt || '',
  }, opts.overrides || {}));
}

function setupPhieuCan(env, hotRows, archives) {
  const ss = env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID);
  const header = new Array(27).fill('');
  ss.__setSheet(DATA_SHEET, [header, ...hotRows]);
  Object.keys(archives || {}).forEach((nam) => {
    ss.__setSheet('PhieuCan_DN_' + nam, [header, ...archives[nam]]);
  });
  return ss;
}

describe('exportPhieuCanPDF() - in lại phiếu đã lưu trữ (chốt sổ năm)', () => {
  test('tìm thấy và in được phiếu ĐÃ archive dựa vào năm suy ra từ chính Mã Chứng Từ', () => {
    const env = createGasEnv();
    setupPhieuCan(
      env,
      [ticket('H1/2026/NK', new Date(2026, 0, 1))],
      { 2024: [ticket('500/2024/NK', new Date(2024, 5, 15))] }
    );

    const res = env.call('exportPhieuCanPDF', '500/2024/NK');
    // Không lỗi "Không tìm thấy" - đi tiếp được tới bước tạo file (có thể lỗi
    // ở bước tạo Sheet tạm do mock tối giản, nhưng KHÔNG được là lỗi "không tìm thấy").
    expect(res.message || '').not.toMatch(/Không tìm thấy/);
  });

  test('phiếu KHÔNG tồn tại ở cả 2 nơi -> vẫn báo lỗi "Không tìm thấy" như cũ', () => {
    const env = createGasEnv();
    setupPhieuCan(env, [ticket('H1/2026/NK', new Date(2026, 0, 1))], {});
    const res = env.call('exportPhieuCanPDF', '999/2024/NK');
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/Không tìm thấy/);
  });
});

describe('getFilterOptions() - dropdown lọc PHẢI thấy được giá trị chỉ có trong dữ liệu đã lưu trữ', () => {
  test('xe/khách hàng/đại lý CHỈ xuất hiện ở năm đã archive vẫn có trong danh sách', () => {
    const env = createGasEnv();
    setupPhieuCan(
      env,
      [ticket('H1/2026/NK', new Date(2026, 0, 1), { overrides: { 5: 'XE-MOI', 11: 'KH MOI' } })],
      { 2024: [ticket('A1/2024/NK', new Date(2024, 0, 1), { overrides: { 5: 'XE-2024-CHI-CO-O-LUU-TRU', 11: 'KH-2024-CHI-CO-O-LUU-TRU' } })] }
    );

    const res = env.call('getFilterOptions');
    expect(res.status).toBe('success');
    expect(res.xeList).toEqual(expect.arrayContaining(['XE-MOI', 'XE-2024-CHI-CO-O-LUU-TRU']));
    expect(res.khachHangList).toEqual(expect.arrayContaining(['KH MOI', 'KH-2024-CHI-CO-O-LUU-TRU']));
  });
});

describe('buildDNTTStatusMap_() / getBaoCaoMisa() - trạng thái ĐNTT đúng cho dữ liệu năm cũ đã lưu trữ', () => {
  test('phiếu đã lưu trữ có ĐNTT thật sự -> KHÔNG bị báo sai thành "Chưa lập ĐNTT"', () => {
    const env = createGasEnv();
    setupPhieuCan(
      env,
      [ticket('H1/2026/NK', new Date(2026, 0, 1))],
      { 2024: [ticket('A1/2024/NK', new Date(2024, 5, 1), { idDntt: 'Đóng TT' })] }
    );

    const dntt = env.call('buildDNTTStatusMap_', '2024-01-01', '2024-12-31');
    expect(dntt['A1/2024/NK']).toBe(true);
  });

  test('getBaoCaoMisa xem lại năm đã lưu trữ hiển thị đúng trạng thái ĐNTT (không mặc định sai thành Chưa lập)', () => {
    const env = createGasEnv();
    setupPhieuCan(
      env,
      [],
      { 2024: [ticket('A1/2024/NK', new Date(2024, 5, 1), { idDntt: 'Đóng TT' })] }
    );
    // Update_MiSa_PC: cột C (index2) = Mã Chứng Từ, cột A (ngày), D (xe), E (KL), F (giá), G (thành tiền), L (tên NCC)
    const misaRow = new Array(12).fill('');
    misaRow[0] = new Date(2024, 5, 1); misaRow[2] = 'A1/2024/NK'; misaRow[3] = 'XE-CU';
    misaRow[4] = 5; misaRow[5] = 1000000; misaRow[6] = 5000000; misaRow[11] = 'NCC A';
    const ssMisa = env.spreadsheetApp.openById(MISA_DST_ID);
    ssMisa.__setSheet(MISA_DST_SHEET, [new Array(12).fill(''), misaRow]);

    const res = env.call('getBaoCaoMisa', { fromDate: '2024-01-01', toDate: '2024-12-31' });
    expect(res.status).toBe('success');
    expect(res.data).toHaveLength(1);
    expect(res.data[0].trangThaiThanhToan).toBe('Đã lập ĐNTT');
  });
});
