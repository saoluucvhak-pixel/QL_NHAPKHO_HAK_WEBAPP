const crypto = require('crypto');
const { createGasEnv, ADMIN_GOC } = require('./gasEnv');

// Mô hình phân quyền hiện tại: Cổng đăng nhập Gmail (dự án riêng) ký "vé"
// HMAC-SHA256 -> doGet(?cong=...) đổi vé lấy mã phiên -> MỌI lời gọi từ giao
// diện đi qua API(maPhien, tenHam, thamSo). Xem Config.gs mục CỔNG ĐĂNG NHẬP.
const KHOA = 'khoa-bi-mat-test-0123456789abcdef';
const b64ws = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

function taoVe(email, opts) {
  opts = opts || {};
  const than = b64ws(Buffer.from(JSON.stringify({ v: 1, e: email, x: opts.hetHan || Date.now() + 4 * 60 * 1000, n: opts.nonce || crypto.randomUUID() })));
  const chuKy = b64ws(crypto.createHmac('sha256', opts.khoa || KHOA).update(than).digest());
  return than + '.' + chuKy;
}

function envCoCong(opts) {
  const env = createGasEnv(opts);
  env.propertiesService.getScriptProperties().setProperty('CONG_DN_KHOA_BI_MAT', KHOA);
  return env;
}

describe('Cổng đăng nhập: đổi vé lấy phiên (xuLyVeCong_)', () => {
  test('vé hợp lệ của Admin -> cấp mã phiên 64 ký tự hex, phiên dùng được với API()', () => {
    const env = envCoCong();
    const kq = env.call('xuLyVeCong_', taoVe(ADMIN_GOC));
    expect(kq.phien).toMatch(/^[a-f0-9]{64}$/);
    expect(env.callApi(kq.phien, 'HT_layThongTinNguoiDungHienTai').data.laAdmin).toBe(true);
  });

  test('email không có trong danh sách quyền -> KHÔNG cấp phiên', () => {
    const env = envCoCong();
    const kq = env.call('xuLyVeCong_', taoVe('nguoi-la@gmail.com'));
    expect(kq.phien).toBeUndefined();
    expect(kq.thongBao).toMatch(/chưa được cấp quyền/);
  });

  test('vé ký bằng khóa khác (Cổng giả mạo / mã nguồn cũ) -> từ chối', () => {
    const env = envCoCong();
    const kq = env.call('xuLyVeCong_', taoVe(ADMIN_GOC, { khoa: 'khoa-sai' }));
    expect(kq.phien).toBeUndefined();
    expect(kq.thongBao).toMatch(/sai chữ ký/);
  });

  test('vé hết hạn (quá 5 phút) -> từ chối', () => {
    const env = envCoCong();
    const kq = env.call('xuLyVeCong_', taoVe(ADMIN_GOC, { hetHan: Date.now() - 1000 }));
    expect(kq.thongBao).toMatch(/hết hạn/);
  });

  test('dùng lại cùng 1 vé (replay từ lịch sử trình duyệt) -> lần 2 bị từ chối', () => {
    const env = envCoCong();
    const ve = taoVe(ADMIN_GOC);
    expect(env.call('xuLyVeCong_', ve).phien).toBeTruthy();
    expect(env.call('xuLyVeCong_', ve).thongBao).toMatch(/đã được dùng/);
  });

  test('vé bị sửa nội dung (đổi email) nhưng giữ chữ ký cũ -> từ chối', () => {
    const env = envCoCong();
    const [, chuKy] = taoVe('nhanvien@gmail.com').split('.');
    const thanGia = b64ws(Buffer.from(JSON.stringify({ v: 1, e: ADMIN_GOC, x: Date.now() + 60000, n: crypto.randomUUID() })));
    expect(env.call('xuLyVeCong_', thanGia + '.' + chuKy).phien).toBeUndefined();
  });

  test('email Gmail khác dấu chấm / hoa thường / +hậu tố vẫn khớp đúng người trong danh sách', () => {
    const env = envCoCong();
    expect(env.call('xuLyVeCong_', taoVe('Sao.Luu.CVHak+abc@gmail.com')).phien).toBeTruthy();
  });
});

describe('doGet()', () => {
  test('chưa cài Cổng đăng nhập -> trang hướng dẫn cài đặt, KHÔNG render giao diện', () => {
    const env = createGasEnv();
    const out = env.call('doGet', { parameter: {} });
    expect(out.__html).toMatch(/Cần cài đặt Cổng đăng nhập/);
  });

  test('đã cài Cổng + vé hợp lệ -> render Index kèm mã phiên; cho phép nhúng iframe (Portal)', () => {
    const env = envCoCong();
    const out = env.call('doGet', { parameter: { cong: taoVe(ADMIN_GOC) } });
    expect(out.__template.__ten).toBe('Index');
    expect(JSON.parse(out.__template.phienMoiJson)).toMatch(/^[a-f0-9]{64}$/);
    expect(out.__xFrame).toBe('ALLOWALL');
  });

  test('mã phiên/thông báo nhúng vào trang được chặn "</script>" (chống XSS)', () => {
    const env = envCoCong();
    const out = env.call('doGet', { parameter: { cong: taoVe('<script>alert(1)</script>@gmail.com') } });
    expect(out.__template.thongBaoDangNhapJson).not.toMatch(/</);
  });
});

describe('API(maPhien, tenHam, thamSo) - cổng duy nhất cho mọi lời gọi từ giao diện', () => {
  test('không có / sai / hết hạn phiên -> lỗi PHIEN_HET_HAN (giao diện tự hiện màn hình đăng nhập)', () => {
    const env = createGasEnv();
    expect(() => env.callApi('', 'HT_layDashboard')).toThrow(/PHIEN_HET_HAN/);
    expect(() => env.callApi('a'.repeat(64), 'HT_layDashboard')).toThrow(/PHIEN_HET_HAN/);
    expect(() => env.callApi('../../etc', 'HT_layDashboard')).toThrow(/PHIEN_HET_HAN/);
  });

  test('chỉ gọi được hàm trong danh sách HAM_API_ (không gọi được hàm nội bộ/tuỳ ý)', () => {
    const env = createGasEnv();
    const ma = env.maPhien();
    expect(() => env.callApi(ma, 'taoKhoaCongMoi_')).toThrow(/Không được phép gọi hàm/);
    expect(() => env.callApi(ma, 'CAI_DAT_CONG_DANG_NHAP')).toThrow(/Không được phép gọi hàm/);
    expect(() => env.callApi(ma, 'constructor')).toThrow(/Không được phép gọi hàm/);
  });

  test('gọi thẳng hàm công khai qua google.script.run (bỏ qua API) -> bị chặn', () => {
    const env = createGasEnv();
    const ctx = env.context; // không đặt PHIEN_HIEN_TAI_ = y hệt 1 lời gọi google.script.run trực tiếp
    expect(() => ctx.HT_layDanhSachQuyen()).toThrow(/PHIEN_HET_HAN/);
    expect(() => ctx.step1_ConfirmImport([], false)).toThrow(/PHIEN_HET_HAN/);
  });

  test('thu hồi quyền có hiệu lực NGAY ở lần gọi kế tiếp (không chờ phiên hết hạn)', () => {
    const env = createGasEnv({ email: 'nv@gmail.com', vaiTro: 'NHANVIEN' });
    const maNV = env.maPhien();
    expect(env.callApi(maNV, 'HT_layThongTinNguoiDungHienTai').status).toBe('success');
    env.session.__setEmail(ADMIN_GOC);
    env.call('HT_luuDanhSachQuyen', [{ email: ADMIN_GOC, vaiTro: 'ADMIN' }]);
    expect(() => env.callApi(maNV, 'HT_layThongTinNguoiDungHienTai')).toThrow(/không còn trong danh sách/);
  });
});

describe('Vai trò CHỈ XEM: chặn cứng ở máy chủ, không chỉ ẩn nút', () => {
  test.each([
    ['step1_ConfirmImport', [[], false]],
    ['addManualPhieuCan', [{}]],
    ['BG_createQuote', [{}]],
    ['XH_saveDonHang', [{}]],
    ['HT_luuDanhSachQuyen', [[]]],
  ])('%s bị từ chối', (ten, args) => {
    const env = createGasEnv({ email: 'xem@gmail.com', vaiTro: 'CHIXEM' });
    expect(() => env.call(ten, ...args)).toThrow(/chỉ có quyền XEM/);
  });

  test('processFormData: được xem báo cáo tồn kho, KHÔNG được thêm kho', () => {
    const env = createGasEnv({ email: 'xem@gmail.com', vaiTro: 'CHIXEM' });
    expect(() => env.call('processFormData', 'Danhmuckho', { hanhDong: 'THEM' })).toThrow(/chỉ có quyền XEM/);
    expect(() => env.call('processFormData', 'Baocaotonkho', {})).not.toThrow(/chỉ có quyền XEM/);
  });

  test('vẫn xem được Dashboard và báo cáo', () => {
    const env = createGasEnv({ email: 'xem@gmail.com', vaiTro: 'CHIXEM' });
    env.spreadsheetApp.openById('1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g').__setSheet('PhieuCan_DN', [new Array(27).fill('H')]);
    expect(env.call('getBaoCaoTongHop', {}).status).toBe('success');
  });
});

describe('yeuCauQuyenAdmin_() - các chức năng cấu hình chỉ Admin', () => {
  test.each([
    ['HT_layLienKetDuLieu', []], ['HT_luuLienKetDuLieu', [{}]],
    ['HT_layMisaDefaults', []], ['HT_luuMisaDefaults', [{}]],
    ['HT_luuCauHinhVungMien', ['US', 'VN']], ['HT_layLocaleThatCuaSheet', []],
    ['HT_layDanhSachQuyen', []], ['HT_luuDanhSachQuyen', [[{ email: 'nv@gmail.com', vaiTro: 'ADMIN' }]]],
    ['HT_xacNhanCauTrucSheetHienTai', []], ['HT_layCauHinhCong', []], ['HT_layMaNguonCong', []],
    ['HT_luuLinkCong', ['https://script.google.com/macros/s/abc/exec']], ['HT_doiKhoaCong', []],
  ])('%s: Nhân viên bị từ chối', (ten, args) => {
    const env = createGasEnv({ email: 'nv@gmail.com', vaiTro: 'NHANVIEN' });
    const res = env.call(ten, ...args);
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/quyền Quản trị/);
  });

  test.each([['HT_layLienKetDuLieu'], ['HT_layMisaDefaults'], ['HT_layCauHinhVungMien'], ['HT_layDanhSachQuyen']])('%s: Admin dùng bình thường', (ten) => {
    expect(createGasEnv().call(ten).status).toBe('success');
  });

  test('HT_layMaNguonCong KHÔNG lộ khóa bí mật cho Nhân viên', () => {
    const env = createGasEnv({ email: 'nv@gmail.com', vaiTro: 'NHANVIEN' });
    env.propertiesService.getScriptProperties().setProperty('CONG_DN_KHOA_BI_MAT', KHOA);
    expect(JSON.stringify(env.call('HT_layMaNguonCong'))).not.toContain(KHOA);
  });
});

describe('HT_luuDanhSachQuyen() - kiểm tra dữ liệu danh sách người dùng', () => {
  let env;
  beforeEach(() => { env = createGasEnv(); });

  test('lưu hợp lệ -> áp dụng ngay', () => {
    const res = env.call('HT_luuDanhSachQuyen', [{ email: ADMIN_GOC, vaiTro: 'ADMIN' }, { email: 'ketoan@gmail.com', vaiTro: 'NHANVIEN' }]);
    expect(res.status).toBe('success');
    expect(env.call('DS_QUYEN_')).toHaveLength(2);
  });

  test('từ chối danh sách rỗng', () => {
    expect(env.call('HT_luuDanhSachQuyen', []).status).toBe('error');
  });

  test('từ chối khi không còn ADMIN nào - danh sách cũ giữ nguyên', () => {
    const res = env.call('HT_luuDanhSachQuyen', [{ email: 'nv1@gmail.com', vaiTro: 'NHANVIEN' }]);
    expect(res.status).toBe('error');
    expect(env.call('DS_QUYEN_').some((u) => u.vaiTro === 'ADMIN')).toBe(true);
  });

  test('từ chối email không hợp lệ', () => {
    expect(env.call('HT_luuDanhSachQuyen', [{ email: ADMIN_GOC, vaiTro: 'ADMIN' }, { email: 'khong-phai-email', vaiTro: 'NHANVIEN' }]).status).toBe('error');
  });
});
