const { createGasEnv } = require('./gasEnv');
const mocks = require('./gasMocks');

// TRA CỨU PHIẾU CÂN (chỉ đọc): tìm phiếu nhập (sheet đang theo dõi + sheet lưu
// trữ theo năm) và phiếu xuất (NL_PC_XH), xem chi tiết đủ mọi cột.
// Utilities.formatDate giả lập định dạng theo giờ MÁY chạy test (bỏ qua "GMT+7"),
// nên giá trị mong đợi của ngày+giờ ghép (tạo bằng "...+07:00") tính cùng cách.
const pad = (n) => String(n).padStart(2, '0');
function gioVN(iso, coGiay) {
  const d = new Date(iso + '+07:00');
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + (coGiay ? ':' + pad(d.getSeconds()) : '');
}
const PHIEUCAN_ID = '1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g';
const XUAT_ID = '1ZZ2iUwkkKe8wXdztA7mL-v9j6fmgY5c5rlDdI1sNoAk';

const TIEU_DE_NHAP = ['Số phiếu', 'Ngày cân 1', 'Giờ cân 1', 'Ngày cân 2', 'Giờ cân 2', 'Biển số 1', 'Biển số 2',
  'Cân lần 1', 'Cân lần 2', 'KL Hàng (KG)', 'Nguồn gốc', 'Khách hàng', 'Mã hàng', 'ĐL', 'NG', 'Hình ảnh',
  'Mã ĐG', 'Giảm giá', 'Timestamp', 'ĐG_AD', 'Picture', 'ID_PC (Mã chứng từ)', 'Số CT',
  'Đơn giá', 'Trạng thái giá', 'Thành tiền', 'ID_DNTT'];

function phieuNhap(maCT, o) {
  const r = new Array(27).fill('');
  r[0] = o.soPhieu || maCT.split('/')[0]; r[1] = o.ngay; r[2] = new Date(1899, 11, 30, 8, 30, 15);
  r[3] = o.ngay; r[4] = new Date(1899, 11, 30, 9, 5, 0); r[5] = o.xe || '81C-123.45'; r[6] = o.xe2 || '';
  r[7] = 30000; r[8] = 10000; r[9] = 20000; r[11] = o.kh || 'Nguyễn Văn An'; r[13] = o.dl || 'DL1'; r[14] = 'NG1';
  r[15] = o.anh || ''; r[16] = 'DL1_NG1_Y'; r[21] = maCT; r[22] = maCT;
  r[23] = 1200; r[24] = 'OK'; r[25] = 24000000; r[26] = o.dntt || '';
  return r;
}

function napNhap(env, dangTheoDoi, luuTru) {
  const ss = env.spreadsheetApp.openById(PHIEUCAN_ID);
  ss.__setSheet('PhieuCan_DN', [TIEU_DE_NHAP, ...dangTheoDoi]);
  Object.keys(luuTru || {}).forEach((nam) => ss.__setSheet('PhieuCan_DN_' + nam, [TIEU_DE_NHAP, ...luuTru[nam]]));
  return ss;
}

const TIEU_DE_XUAT = ['Số phiếu', 'Ngày giờ cân 1', 'Ngày giờ cân 2', 'Biển số 1', 'Cân lần 1', 'Cân lần 2', 'KL Hàng (KG)',
  'Đơn vị vận chuyển', 'Tên tài xế', 'Khối lượng (Tấn)', 'Ngày xuất', 'Số BKLS', 'Khối lượng (M3)', 'NGƯỜI CÂN', 'SỐ TKHQ', 'Kho xuất', 'Kho nhập'];
function phieuXuat(soPhieu, ngayGio, o) {
  o = o || {};
  return [soPhieu, ngayGio, ngayGio, o.xe || '43H-555.66', 40000, 15000, 25000, o.dvvc || 'Vận tải Hòa Phát', 'Trần Bình', 25.35,
    '', 'BK01', 0, 'Lê Cân', o.tkhq || '', o.khoXuat || 'Kho A', o.khoNhap || 'Cảng Tiên Sa'];
}
function napXuat(env, rows) {
  env.spreadsheetApp.openById(XUAT_ID).__setSheet('NL_PC_XH', [TIEU_DE_XUAT, ...rows]);
}

describe('Tra cứu phiếu cân NHẬP', () => {
  test('tìm theo từ khóa không dấu / không phân biệt hoa thường, mới nhất lên trước, kèm tổng', () => {
    const env = createGasEnv();
    napNhap(env, [
      phieuNhap('101/2026/NK', { ngay: new Date(2026, 5, 10), kh: 'Nguyễn Văn An' }),
      phieuNhap('102/2026/NK', { ngay: new Date(2026, 5, 12), kh: 'NGUYỄN VĂN AN', dntt: 'Đóng TT' }),
      phieuNhap('103/2026/NK', { ngay: new Date(2026, 5, 11), kh: 'Trần Thị Bình' }),
    ]);
    const res = env.call('TC_traCuuPhieuNhap', { tuKhoa: 'nguyen van an' });
    expect(res.status).toBe('success');
    expect(res.data.map((r) => r.maChungTu)).toEqual(['102/2026/NK', '101/2026/NK']);
    expect(res.summary).toEqual({ soLuong: 2, tongKL: 40000, tongTien: 48000000 });
    expect(res.data[0]).toMatchObject({ soPhieu: '102', ngayGioCan1: gioVN('2026-06-12T08:30:15'), trangThaiThanhToan: 'Đóng TT', noiLuu: 'Đang theo dõi' });
    expect(res.data[1].trangThaiThanhToan).toBe('Chưa lập ĐNTT');
  });

  test('tìm theo biển số, mã chứng từ, số phiếu', () => {
    const env = createGasEnv();
    napNhap(env, [
      phieuNhap('201/2026/NK', { ngay: new Date(2026, 5, 1), xe: '81C-999.99' }),
      phieuNhap('202/2026/NK', { ngay: new Date(2026, 5, 2) }),
    ]);
    expect(env.call('TC_traCuuPhieuNhap', { tuKhoa: '999.99' }).data.map((r) => r.maChungTu)).toEqual(['201/2026/NK']);
    expect(env.call('TC_traCuuPhieuNhap', { tuKhoa: '202/2026' }).data.map((r) => r.maChungTu)).toEqual(['202/2026/NK']);
    expect(env.call('TC_traCuuPhieuNhap', { tuKhoa: 'khong-co-ai' }).data).toEqual([]);
  });

  test('lọc khoảng ngày; để trống ngày -> tìm cả sheet lưu trữ các năm đã khóa sổ', () => {
    const env = createGasEnv();
    napNhap(env,
      [phieuNhap('301/2026/NK', { ngay: new Date(2026, 5, 15) })],
      { 2024: [phieuNhap('9/2024/NK', { ngay: new Date(2024, 2, 3), dntt: 'Đóng TT' })] });
    expect(env.call('TC_traCuuPhieuNhap', { tuNgay: '2026-06-01', denNgay: '2026-06-30' }).data.map((r) => r.maChungTu)).toEqual(['301/2026/NK']);
    const tatCa = env.call('TC_traCuuPhieuNhap', {});
    expect(tatCa.data.map((r) => [r.maChungTu, r.noiLuu])).toEqual([['301/2026/NK', 'Đang theo dõi'], ['9/2024/NK', 'Lưu trữ 2024']]);
    expect(env.call('TC_traCuuPhieuNhap', { tuNgay: '2024-01-01', denNgay: '2024-12-31' }).data.map((r) => r.maChungTu)).toEqual(['9/2024/NK']);
  });

  test('nhiều hơn 500 phiếu -> trả 500 phiếu mới nhất, báo tổng số tìm thấy', () => {
    const env = createGasEnv();
    const ds = [];
    for (let i = 0; i < 620; i++) ds.push(phieuNhap(i + '/2026/NK', { ngay: new Date(2026, 0, 1 + (i % 150)) }));
    napNhap(env, ds);
    const res = env.call('TC_traCuuPhieuNhap', {});
    expect(res.data.length).toBe(500);
    expect(res.tongSoDong).toBe(620);
    expect(res.summary.soLuong).toBe(620);
    expect(res.data[0].ts).toBeGreaterThanOrEqual(res.data[499].ts);
  });

  test('chi tiết: đủ 27 cột theo tiêu đề sheet + tóm tắt; phiếu ở sheet lưu trữ vẫn mở được', () => {
    const env = createGasEnv();
    napNhap(env,
      [phieuNhap('401/2026/NK', { ngay: new Date(2026, 5, 15), xe2: 'R-01', anh: 'https://drive.google.com/x' })],
      { 2025: [phieuNhap('77/2025/NK', { ngay: new Date(2025, 10, 20), dntt: 'Đóng TT' })] });
    const ct = env.call('TC_chiTietPhieuNhap', '401/2026/NK');
    expect(ct.status).toBe('success');
    expect(ct.data.truong.length).toBe(27);
    expect(ct.data.truong[0]).toEqual(['Số phiếu', '401']);
    expect(ct.data.truong[2]).toEqual(['Giờ cân 1', '08:30:15']);
    expect(ct.data.truong[15]).toEqual(['Hình ảnh', 'https://drive.google.com/x']);
    expect(ct.data.truong[25]).toEqual(['Thành tiền', 24000000]);
    expect(ct.data.tomTat).toMatchObject({ soXe: '81C-123.45 / R-01', ngayGioCan1: gioVN('2026-06-15T08:30:15', true), ngayGioCan2: gioVN('2026-06-15T09:05:00', true), klHang: 20000, thanhTien: 24000000, trangThaiThanhToan: 'Chưa lập ĐNTT' });
    expect(ct.data.noiLuu).toMatch(/Đang theo dõi/);

    const cu = env.call('TC_chiTietPhieuNhap', '77/2025/NK');
    expect(cu.status).toBe('success');
    expect(cu.data.noiLuu).toBe('Lưu trữ (PhieuCan_DN_2025)');
    expect(cu.data.tomTat.trangThaiThanhToan).toBe('Đóng TT');

    expect(env.call('TC_chiTietPhieuNhap', 'KHONG/2026/NK').status).toBe('error');
  });

  test('ô tiêu đề trống -> dùng tên cột chuẩn', () => {
    const env = createGasEnv();
    const ss = env.spreadsheetApp.openById(PHIEUCAN_ID);
    ss.__setSheet('PhieuCan_DN', [new Array(27).fill(''), phieuNhap('1/2026/NK', { ngay: new Date(2026, 1, 1) })]);
    const ct = env.call('TC_chiTietPhieuNhap', '1/2026/NK');
    expect(ct.data.truong.map((t) => t[0])).toEqual(TIEU_DE_NHAP);
  });
});

describe('Tra cứu phiếu cân XUẤT', () => {
  test('tìm theo đơn vị vận chuyển (không dấu) + khoảng ngày; ngày dạng chuỗi dd/MM/yyyy HH:mm:ss', () => {
    const env = createGasEnv();
    napXuat(env, [
      phieuXuat('X1', '05/06/2026 07:15:00'),
      phieuXuat('X2', '20/06/2026 10:00:00'),
      phieuXuat('X3', '21/06/2026 10:00:00', { dvvc: 'Công ty Minh Long' }),
      phieuXuat('X4', '01/03/2026 10:00:00'),
    ]);
    const res = env.call('TC_traCuuPhieuXuat', { tuKhoa: 'hoa phat', tuNgay: '2026-06-01', denNgay: '2026-06-30' });
    expect(res.status).toBe('success');
    expect(res.data.map((r) => r.soPhieu)).toEqual(['X2', 'X1']);
    expect(res.data[1]).toMatchObject({ ngayGioCan1: '05/06/2026 07:15', bienSo: '43H-555.66', klHang: 25000, khoiLuongTan: 25.35, khoNhap: 'Cảng Tiên Sa' });
    expect(res.summary.tongKLHang).toBe(50000);
    expect(env.call('TC_traCuuPhieuXuat', {}).data.length).toBe(4);
    expect(env.call('TC_traCuuPhieuXuat', { tuKhoa: 'tien sa' }).data.length).toBe(4);
  });

  test('chi tiết: đủ 17 cột; số phiếu trùng -> chọn đúng phiếu theo thời điểm cân', () => {
    const env = createGasEnv();
    napXuat(env, [
      phieuXuat('X9', '01/06/2026 08:00:00', { xe: 'XE-CU' }),
      phieuXuat('X9', '02/06/2026 08:00:00', { xe: 'XE-MOI', tkhq: '1055' }),
    ]);
    const ds = env.call('TC_traCuuPhieuXuat', { tuKhoa: 'x9' }).data;
    expect(ds.map((r) => r.bienSo)).toEqual(['XE-MOI', 'XE-CU']);
    const ct = env.call('TC_chiTietPhieuXuat', 'X9', ds[1].ts);
    expect(ct.status).toBe('success');
    expect(ct.data.tomTat.bienSo).toBe('XE-CU');
    expect(ct.data.truong.length).toBe(17);
    expect(ct.data.truong[7]).toEqual(['Đơn vị vận chuyển', 'Vận tải Hòa Phát']);
    // không truyền thời điểm -> phiếu đầu tiên có số phiếu đó
    expect(env.call('TC_chiTietPhieuXuat', 'X9').data.tomTat.bienSo).toBe('XE-CU');
    expect(env.call('TC_chiTietPhieuXuat', 'KHONG').status).toBe('error');
  });
});

describe('Tra cứu chỉ đọc + quyền', () => {
  test('không ghi ô nào, không chiếm khóa', () => {
    const env = createGasEnv();
    napNhap(env, [phieuNhap('1/2026/NK', { ngay: new Date(2026, 5, 1) })]);
    napXuat(env, [phieuXuat('X1', '01/06/2026 08:00:00')]);
    mocks.resetApiCounter_();
    const soLanCho = env.lockService.__soLanCho;
    env.call('TC_traCuuPhieuNhap', {}); env.call('TC_chiTietPhieuNhap', '1/2026/NK');
    env.call('TC_traCuuPhieuXuat', {}); env.call('TC_chiTietPhieuXuat', 'X1');
    expect(mocks.getApiCounter_().oWrite).toBe(0);
    expect(env.lockService.__soLanCho).toBe(soLanCho);
  });

  test('vai trò Chỉ xem được tra cứu', () => {
    const env = createGasEnv({ email: 'xem@gmail.com', vaiTro: 'CHIXEM' });
    napNhap(env, [phieuNhap('1/2026/NK', { ngay: new Date(2026, 5, 1) })]);
    expect(env.call('TC_traCuuPhieuNhap', {}).status).toBe('success');
    expect(env.call('TC_chiTietPhieuNhap', '1/2026/NK').status).toBe('success');
  });
});
