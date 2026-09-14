const { createGasEnv } = require('./gasEnv');

const PHIEUCAN_SPREADSHEET_ID = '1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g';
const DATA_SHEET = 'PhieuCan_DN';

function makeRow(overrides) {
  const row = new Array(27).fill('');
  return Object.assign(row, overrides);
}

// Dùng TRƯA (12:00) của ngày cần test thay vì giờ hiện tại chính xác - tránh
// flaky khi test chạy gần nửa đêm (ranh giới ngày theo GMT+7 trong
// getBaoCaoTongHop có thể lệch vài giờ so với "hôm nay" theo giờ hệ thống chạy
// test, do gasMocks.Utilities.formatDate() bỏ qua tham số timezone).
function ngayTruaHomNayCong_(soThang) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + (soThang || 0), soThang ? 15 : now.getDate(), 12, 0, 0);
}

function ticket(maChungTu, ngay, klHangKg, khachHang, trangThaiGia, idDntt) {
  return makeRow({
    0: 'SP-' + maChungTu, 1: ngay, 5: 'XE-01', 9: klHangKg, 11: khachHang || 'KH A',
    13: 'DL', 14: 'NG', 16: 'DL_NG_Y', 19: 1000000, 21: maChungTu, 22: maChungTu,
    23: 1000000, 24: trangThaiGia === undefined ? 'OK' : trangThaiGia,
    25: klHangKg / 1000 * 1000000, 26: idDntt || '',
  });
}

function setupPhieuCan(env, rows) {
  const ss = env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID);
  const header = new Array(27).fill('');
  ss.__setSheet(DATA_SHEET, [header, ...rows]);
  return ss;
}

describe('HT_layDashboard() - tổng quan Phiếu cân nhập + Báo giá/Doanh thu', () => {
  test('tính đúng "Hôm nay" và "Tháng này", KHÔNG lẫn dữ liệu tháng trước', () => {
    const env = createGasEnv();
    setupPhieuCan(env, [
      ticket('T1', ngayTruaHomNayCong_(0), 10000, 'KH A'),
      ticket('T2', ngayTruaHomNayCong_(-1), 5000, 'KH B'), // tháng trước - KHÔNG được tính
    ]);

    const res = env.call('HT_layDashboard');
    expect(res.status).toBe('success');
    expect(res.data.homNay.soLuong).toBe(1);
    expect(res.data.homNay.tongKL).toBe(10000);
    expect(res.data.thangNay.soLuong).toBe(1);
    expect(res.data.thangNay.tongKL).toBe(10000);
  });

  test('Top khách hàng theo doanh thu tháng này - gộp đúng theo khách hàng, sắp xếp giảm dần', () => {
    const env = createGasEnv();
    setupPhieuCan(env, [
      ticket('T1', ngayTruaHomNayCong_(0), 10000, 'KH LỚN'),
      ticket('T2', ngayTruaHomNayCong_(0), 20000, 'KH LỚN'), // cùng khách hàng -> gộp
      ticket('T3', ngayTruaHomNayCong_(0), 5000, 'KH NHỎ'),
    ]);

    const res = env.call('HT_layDashboard');
    expect(res.status).toBe('success');
    expect(res.data.topKhachHang[0].khachHang).toBe('KH LỚN');
    expect(res.data.topKhachHang[0].soPhieu).toBe(2);
    expect(res.data.topKhachHang[0].tongKL).toBe(30000);
    expect(res.data.topKhachHang[1].khachHang).toBe('KH NHỎ');
  });

  test('đếm đúng "Cần chú ý" (chưa tính giá xong) và "Chưa lập ĐNTT" trong tháng này', () => {
    const env = createGasEnv();
    setupPhieuCan(env, [
      ticket('T1', ngayTruaHomNayCong_(0), 10000, 'KH A', 'OK', 'Đóng TT'), // xong hết
      ticket('T2', ngayTruaHomNayCong_(0), 10000, 'KH A', '', ''),          // chưa tính giá + chưa lập ĐNTT
      ticket('T3', ngayTruaHomNayCong_(0), 10000, 'KH A', 'OK', ''),        // đã tính giá nhưng CHƯA lập ĐNTT
    ]);

    const res = env.call('HT_layDashboard');
    expect(res.status).toBe('success');
    expect(res.data.canChuY).toBe(1); // chỉ T2
    expect(res.data.chuaLapDntt).toBe(2); // T2 + T3
  });

  test('không có dữ liệu -> vẫn trả về success với số 0, không lỗi', () => {
    const env = createGasEnv();
    setupPhieuCan(env, []);
    const res = env.call('HT_layDashboard');
    expect(res.status).toBe('success');
    expect(res.data.homNay.soLuong).toBe(0);
    expect(res.data.thangNay.soLuong).toBe(0);
    expect(res.data.topKhachHang).toEqual([]);
    expect(res.data.canChuY).toBe(0);
    expect(res.data.chuaLapDntt).toBe(0);
  });
});
