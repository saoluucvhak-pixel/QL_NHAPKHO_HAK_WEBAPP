const { createGasEnv } = require('./gasEnv');

const BAOGIA_SPREADSHEET_ID = '1SIhfjP5-6ouRPDj265lAMmI5yWs1XcnedjqpzDwaIC0';
const SRC_SHEET = 'Baogia_DN';
const MA_SHEET = 'Ma_BaoGia';
const PHIEUCAN_SPREADSHEET_ID = '1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g';
const DATA_SHEET = 'PhieuCan_DN';

// HT_layDashboard() luôn đọc PhieuCan_DN trước (phần Hôm nay/Tháng này) - cần
// có sheet này (dù rỗng) thì mới gọi được, không liên quan gì tới phần
// thongKeGia (Báo giá) đang test ở đây.
function setupPhieuCanRong(env) {
  env.spreadsheetApp.openById(PHIEUCAN_SPREADSHEET_ID).__setSheet(DATA_SHEET, [new Array(27).fill('')]);
}

// Cột: A=id_bg, B=tuNgay(Date), C=ma (danh sách phân cách phẩy), D="min_max", E=gia, F=(bỏ trống), G=id_goc
function baoGiaRow(idBg, tuNgay, maList, klRange, gia, idGoc) {
  const row = new Array(7).fill('');
  row[0] = idBg; row[1] = tuNgay; row[2] = maList; row[3] = klRange; row[4] = gia; row[6] = idGoc || idBg;
  return row;
}

// Cột: A=(bỏ trống), B=maBaoGia, C=daiLy, D=nguonGoc, E=hinhAnh, F=noiDung
function maBaoGiaRow(maBaoGia, daiLy, nguonGoc, hinhAnh, noiDung) {
  const row = new Array(6).fill('');
  row[1] = maBaoGia; row[2] = daiLy || ''; row[3] = nguonGoc; row[4] = hinhAnh || ''; row[5] = noiDung || '';
  return row;
}

function setupBaoGiaHeThong(env, srcRows, maRows) {
  const ss = env.spreadsheetApp.openById(BAOGIA_SPREADSHEET_ID);
  ss.__setSheet(SRC_SHEET, [new Array(7).fill(''), ...srcRows]);
  ss.__setSheet(MA_SHEET, [new Array(6).fill(''), ...maRows]);
  return ss;
}

describe('BG_layThongKeGiaHieuLuc_() - thống kê đơn giá nhập keo đang hiệu lực (cho Dashboard)', () => {
  test('tính đúng cao nhất/thấp nhất/trung bình và đúng khu vực (Nguồn gốc) tương ứng', () => {
    const env = createGasEnv();
    setupBaoGiaHeThong(
      env,
      [
        baoGiaRow('BG1', new Date(2026, 0, 1), 'MA1', '0_999999', 1700000),
        baoGiaRow('BG2', new Date(2026, 0, 1), 'MA2', '0_999999', 1900000),
        baoGiaRow('BG3', new Date(2026, 0, 1), 'MA3', '0_999999', 1500000),
      ],
      [
        maBaoGiaRow('MA1', 'DL1', 'Quế Sơn'),
        maBaoGiaRow('MA2', 'DL2', 'Đại Hiệp'),
        maBaoGiaRow('MA3', 'DL3', 'Hòa Nhơn'),
      ]
    );

    const res = env.call('BG_layThongKeGiaHieuLuc_');
    expect(res.soLuong).toBe(3);
    expect(res.giaCaoNhat).toBe(1900000);
    expect(res.khuVucGiaCaoNhat).toBe('Đại Hiệp');
    expect(res.giaThapNhat).toBe(1500000);
    expect(res.khuVucGiaThapNhat).toBe('Hòa Nhơn');
    expect(res.giaTrungBinh).toBe(1700000); // (1.7tr + 1.9tr + 1.5tr) / 3
  });

  test('chỉ tính đúng mức giá ĐANG hiệu lực - bỏ qua mức giá CŨ đã hết hiệu lực (đã bị mức mới thay thế)', () => {
    const env = createGasEnv();
    setupBaoGiaHeThong(
      env,
      [
        // Cùng mã + cùng dải KL (0_999999) nhưng 2 mốc hiệu lực khác nhau -> mốc CŨ tự động "Hết hiệu lực"
        baoGiaRow('BG_CU', new Date(2020, 0, 1), 'MA1', '0_999999', 999999), // giá SENTINEL - phải bị loại vì đã hết hiệu lực
        baoGiaRow('BG_MOI', new Date(2026, 0, 1), 'MA1', '0_999999', 1600000),
      ],
      [maBaoGiaRow('MA1', 'DL1', 'Quế Sơn')]
    );

    const res = env.call('BG_layThongKeGiaHieuLuc_');
    expect(res.soLuong).toBe(1);
    expect(res.giaCaoNhat).toBe(1600000);
    expect(res.giaThapNhat).toBe(1600000);
  });

  test('bỏ qua mức giá CHƯA đến hạn (tuNgay ở tương lai xa)', () => {
    const env = createGasEnv();
    const namSau = new Date().getFullYear() + 5;
    setupBaoGiaHeThong(
      env,
      [
        baoGiaRow('BG1', new Date(2026, 0, 1), 'MA1', '0_999999', 1600000),
        baoGiaRow('BG2', new Date(namSau, 0, 1), 'MA2', '0_999999', 9999999), // chưa đến hạn - phải bị loại
      ],
      [maBaoGiaRow('MA1', 'DL1', 'Quế Sơn'), maBaoGiaRow('MA2', 'DL2', 'Đại Hiệp')]
    );

    const res = env.call('BG_layThongKeGiaHieuLuc_');
    expect(res.soLuong).toBe(1);
    expect(res.giaCaoNhat).toBe(1600000);
  });

  test('không có mức giá nào đang hiệu lực -> trả về 0 hết, không throw', () => {
    const env = createGasEnv();
    setupBaoGiaHeThong(env, [], []);
    const res = env.call('BG_layThongKeGiaHieuLuc_');
    expect(res.soLuong).toBe(0);
    expect(res.giaCaoNhat).toBe(0);
    expect(res.giaThapNhat).toBe(0);
    expect(res.giaTrungBinh).toBe(0);
  });
});

describe('HT_layDashboard() - có kèm thongKeGia (đơn giá nhập keo đang hiệu lực)', () => {
  test('trả về đúng thongKeGia lồng trong kết quả Dashboard', () => {
    const env = createGasEnv();
    setupPhieuCanRong(env);
    setupBaoGiaHeThong(
      env,
      [
        baoGiaRow('BG1', new Date(2026, 0, 1), 'MA1', '0_999999', 1700000),
        baoGiaRow('BG2', new Date(2026, 0, 1), 'MA2', '0_999999', 1900000),
      ],
      [maBaoGiaRow('MA1', 'DL1', 'Quế Sơn'), maBaoGiaRow('MA2', 'DL2', 'Đại Hiệp')]
    );

    const res = env.call('HT_layDashboard');
    expect(res.status).toBe('success');
    expect(res.data.thongKeGia.soLuong).toBe(2);
    expect(res.data.thongKeGia.giaCaoNhat).toBe(1900000);
    expect(res.data.thongKeGia.khuVucGiaCaoNhat).toBe('Đại Hiệp');
  });

  test('lỗi ở Spreadsheet Báo giá (VD thiếu sheet Ma_BaoGia) -> Dashboard vẫn trả về success, chỉ riêng thongKeGia báo 0/lỗi, không sập cả trang', () => {
    const env = createGasEnv();
    setupPhieuCanRong(env);
    // KHÔNG setup Ma_BaoGia/Baogia_DN -> BG_ss_() mở được Spreadsheet nhưng thiếu sheet -> getSheetByName trả null -> lỗi khi gọi .getDataRange()
    const res = env.call('HT_layDashboard');
    expect(res.status).toBe('success');
    expect(res.data.thongKeGia.soLuong).toBe(0);
  });
});
