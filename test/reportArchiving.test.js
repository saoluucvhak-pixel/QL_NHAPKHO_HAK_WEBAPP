const { createGasEnv } = require('./gasEnv');

const PHIEUCAN_SPREADSHEET_ID = '1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g';
const DATA_SHEET = 'PhieuCan_DN';

function makeRow(overrides) {
  const row = new Array(27).fill('');
  return Object.assign(row, overrides);
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

// 1 dòng PhieuCan_DN hợp lệ tối thiểu để đi qua bộ lọc mà không lỗi.
function ticket(maChungTu, ngay, klHangKg) {
  return makeRow({
    0: 'SP-' + maChungTu, 1: ngay, 5: 'XE-01', 9: klHangKg, 11: 'KH A',
    13: 'DL', 14: 'NG', 16: 'DL_NG_Y', 19: 1000000, 21: maChungTu, 22: maChungTu,
    23: 1000000, 24: 'OK', 25: klHangKg / 1000 * 1000000, 26: '',
  });
}

describe('getBaoCaoTongHop() - gộp đúng dữ liệu đã lưu trữ khi bộ lọc ngày cần', () => {
  test('lọc CHỈ trong năm hiện tại (chưa lưu trữ) -> KHÔNG lấy nhầm dữ liệu năm đã archive dù cùng gọi hàm', () => {
    const env = createGasEnv();
    setupPhieuCan(
      env,
      [ticket('H1', new Date(2026, 5, 15), 10000)],
      { 2024: [ticket('A1', new Date(2024, 5, 15), 10000)] }
    );

    const res = env.call('getBaoCaoTongHop', { fromDate: '2026-06-01', toDate: '2026-06-30' });
    expect(res.status).toBe('success');
    expect(res.data.map(r => r.maChungTu)).toEqual(['H1']);
  });

  test('lọc khoảng ngày CHẠM năm đã lưu trữ -> gộp cả 2 nguồn, tổng đúng', () => {
    const env = createGasEnv();
    setupPhieuCan(
      env,
      [ticket('H1', new Date(2026, 5, 15), 10000)],
      { 2024: [ticket('A1', new Date(2024, 5, 15), 20000)] }
    );

    const res = env.call('getBaoCaoTongHop', { fromDate: '2024-01-01', toDate: '2026-12-31' });
    expect(res.status).toBe('success');
    expect(res.data.map(r => r.maChungTu).sort()).toEqual(['A1', 'H1']);
    expect(res.summary.soLuong).toBe(2);
    expect(res.summary.tongKL).toBe(30000);
  });

  test('không lọc ngày (xem tất cả) -> tự động gộp MỌI năm đã lưu trữ, không cần khai báo trước', () => {
    const env = createGasEnv();
    setupPhieuCan(
      env,
      [ticket('H1', new Date(2026, 0, 1), 5000)],
      {
        2023: [ticket('A2023', new Date(2023, 0, 1), 5000)],
        2024: [ticket('A2024', new Date(2024, 0, 1), 5000)],
      }
    );

    const res = env.call('getBaoCaoTongHop', {});
    expect(res.data.map(r => r.maChungTu).sort()).toEqual(['A2023', 'A2024', 'H1']);
  });

  test('sheet chính rỗng nhưng có dữ liệu lưu trữ trong phạm vi lọc -> vẫn trả về đúng (không báo rỗng nhầm)', () => {
    const env = createGasEnv();
    setupPhieuCan(env, [], { 2024: [ticket('A1', new Date(2024, 3, 1), 8000)] });
    const res = env.call('getBaoCaoTongHop', { fromDate: '2024-01-01', toDate: '2024-12-31' });
    expect(res.data.map(r => r.maChungTu)).toEqual(['A1']);
  });

  test('không có dữ liệu ở cả 2 nguồn -> trả về rỗng, không lỗi', () => {
    const env = createGasEnv();
    setupPhieuCan(env, [], {});
    const res = env.call('getBaoCaoTongHop', { fromDate: '2024-01-01', toDate: '2024-12-31' });
    expect(res.status).toBe('success');
    expect(res.data).toEqual([]);
    expect(res.summary.soLuong).toBe(0);
  });
});

describe('getBaoCaoDonGia() - cũng gộp đúng dữ liệu lưu trữ như getBaoCaoTongHop', () => {
  test('gộp đúng khi bộ lọc chạm năm đã lưu trữ', () => {
    const env = createGasEnv();
    setupPhieuCan(
      env,
      [ticket('H1', new Date(2026, 5, 15), 10000)],
      { 2024: [ticket('A1', new Date(2024, 5, 15), 15000)] }
    );

    const res = env.call('getBaoCaoDonGia', { fromDate: '2024-01-01', toDate: '2026-12-31' });
    expect(res.status).toBe('success');
    expect(res.data.map(r => r.maChungTu).sort()).toEqual(['A1', 'H1']);
  });
});

describe('BG_getPhieuCanByMaDG_() - PHẢI thấy được phiếu cân đã lưu trữ (an toàn khóa Sửa/Xóa báo giá)', () => {
  test('mã báo giá CHỈ được dùng trong dữ liệu ĐÃ LƯU TRỮ vẫn phải được nhận diện là "đã dùng"', () => {
    const env = createGasEnv();
    // Không có phiếu nào ở sheet chính dùng mã này - CHỈ có ở năm đã archive.
    setupPhieuCan(
      env,
      [ticket('H1', new Date(2026, 0, 1), 5000)], // dùng mã khác (DL_NG_Y mặc định của ticket())
      { 2023: [ticket('A1', new Date(2023, 5, 1), 5000)] } // cũng dùng "DL_NG_Y" (mã trong hàm ticket())
    );

    const byMa = env.call('BG_getPhieuCanByMaDG_');
    expect(byMa['DL_NG_Y']).toBeDefined();
    // Phải thấy CẢ 2 timestamp (từ sheet chính lẫn sheet lưu trữ), không chỉ sheet chính.
    expect(byMa['DL_NG_Y'].length).toBe(2);
  });

  test('không có dữ liệu lưu trữ nào -> vẫn hoạt động bình thường như trước (không lỗi khi chưa từng chốt sổ)', () => {
    const env = createGasEnv();
    setupPhieuCan(env, [ticket('H1', new Date(2026, 0, 1), 5000)], {});
    const byMa = env.call('BG_getPhieuCanByMaDG_');
    expect(byMa['DL_NG_Y'].length).toBe(1);
  });
});

describe('Chống nhập trùng với dữ liệu đã lưu trữ (import + nhập tay)', () => {
  test('step1_ConfirmImport: re-import 1 phiếu đã CHỐT SỔ (nằm trong sheet lưu trữ) -> "Bỏ qua", KHÔNG bị thêm trùng vào sheet chính', () => {
    const env = createGasEnv();
    // "500/2024/NK" đã archive - không còn ở sheet chính.
    setupPhieuCan(
      env,
      [ticket('H1', new Date(2026, 0, 1), 5000)],
      { 2024: [ticket('500/2024/NK', new Date(2024, 0, 1), 5000)] }
    );

    const res = env.call('step1_ConfirmImport', [{
      isError: false, soPhieu: '500', soXe: 'XE',
      uniqueKey: '500/2024/NK', khGoc: 'X', dlGoc: 'x', ngGoc: 'y',
      klCan1: 1000, klCan2: 1000, klHangGoc: 1000,
      rawDateC: new Date(2024, 0, 1).toISOString(), rawDateD: new Date(2024, 0, 1).toISOString(),
    }], false);

    expect(res.status).toBe('success');
    expect(res.message).toMatch(/Bỏ qua: 1/);
    expect(res.message).toMatch(/Mới: 0/);

    // Sheet chính vẫn chỉ có đúng 1 dòng gốc (H1), không bị thêm dòng trùng "500/2024/NK".
    const sheet = env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID).getSheetByName(DATA_SHEET);
    expect(sheet.getLastRow()).toBe(2); // header + H1
  });

  test('addManualPhieuCan: nhập tay trùng đúng số phiếu/năm đã lưu trữ -> báo lỗi rõ ràng, KHÔNG cho thêm', () => {
    const env = createGasEnv();
    setupPhieuCan(env, [], { 2024: [ticket('777/2024/NK', new Date(2024, 5, 1), 5000)] });

    const res = env.call('addManualPhieuCan', {
      soPhieu: '777', soXe: 'XE-01',
      ngayCan1: '2024-06-01', gioCan1: '08:00', ngayCan2: '2024-06-01', gioCan2: '09:00',
      klCan1: 20, klCan2: 10, klHang: 10,
      khachHang: 'KH', maKH: 'DL', maNG: 'NG',
    });

    expect(res.status).toBe('error');
    expect(res.message).toMatch(/LƯU TRỮ/);
  });

  test('addManualPhieuCan: số phiếu khác năm đã lưu trữ (không trùng thật) vẫn thêm được bình thường', () => {
    const env = createGasEnv();
    setupPhieuCan(env, [], { 2024: [ticket('777/2024/NK', new Date(2024, 5, 1), 5000)] });

    const res = env.call('addManualPhieuCan', {
      soPhieu: '778', soXe: 'XE-01', // số phiếu KHÁC -> key khác, không trùng
      ngayCan1: '2024-06-01', gioCan1: '08:00', ngayCan2: '2024-06-01', gioCan2: '09:00',
      klCan1: 20, klCan2: 10, klHang: 10,
      khachHang: 'KH', maKH: 'DL', maNG: 'NG',
    });

    expect(res.status).toBe('success');
  });
});
