const { createGasEnv } = require('./gasEnv');

describe('layThongTinNguoiDungHienTai_() / DS_QUYEN_() - allowlist mặc định', () => {
  test('chưa từng cấu hình -> chỉ admin bootstrap (Config.gs) có quyền', () => {
    const env = createGasEnv({ email: 'saoluucvhak@gmail.com' });
    const nd = env.call('layThongTinNguoiDungHienTai_');
    expect(nd).toEqual({
      email: 'saoluucvhak@gmail.com',
      vaiTro: 'ADMIN',
      coQuyen: true,
      laAdmin: true,
    });
  });

  test('email không có trong danh sách -> coQuyen=false, laAdmin=false', () => {
    const env = createGasEnv({ email: 'nguoi-la@gmail.com' });
    const nd = env.call('layThongTinNguoiDungHienTai_');
    expect(nd.coQuyen).toBe(false);
    expect(nd.laAdmin).toBe(false);
    expect(nd.vaiTro).toBeNull();
  });

  test('chưa đăng nhập Google (email rỗng) -> không có quyền, không throw', () => {
    const env = createGasEnv({ email: '' });
    const nd = env.call('layThongTinNguoiDungHienTai_');
    expect(nd.coQuyen).toBe(false);
    expect(nd.email).toBe('');
  });

  test('so khớp email KHÔNG phân biệt hoa/thường và khoảng trắng thừa', () => {
    const env = createGasEnv({ email: '  SaoLuuCVHak@GMAIL.com  ' });
    const nd = env.call('layThongTinNguoiDungHienTai_');
    expect(nd.coQuyen).toBe(true);
    expect(nd.laAdmin).toBe(true);
  });
});

describe('yeuCauQuyenAdmin_() / yeuCauDangNhap_() - chặn cứng ở server', () => {
  test('yeuCauQuyenAdmin_() không throw với Admin', () => {
    const env = createGasEnv({ email: 'saoluucvhak@gmail.com' });
    expect(() => env.call('yeuCauQuyenAdmin_')).not.toThrow();
  });

  test('yeuCauQuyenAdmin_() throw với tài khoản không có quyền/không phải Admin', () => {
    const env = createGasEnv({ email: 'ke-la@gmail.com' });
    expect(() => env.call('yeuCauQuyenAdmin_')).toThrow(/quyền Quản trị/);
  });

  test('yeuCauDangNhap_() không throw với bất kỳ ai TRONG danh sách (kể cả không phải Admin)', () => {
    const env = createGasEnv({ email: 'saoluucvhak@gmail.com' });
    env.call('HT_luuDanhSachQuyen', [
      { email: 'saoluucvhak@gmail.com', vaiTro: 'ADMIN' },
      { email: 'nhanvien1@gmail.com', vaiTro: 'NHANVIEN' },
    ]);
    env.session.__setEmail('nhanvien1@gmail.com');
    expect(() => env.call('yeuCauDangNhap_')).not.toThrow();
    expect(() => env.call('yeuCauQuyenAdmin_')).toThrow();
  });

  test('yeuCauDangNhap_() throw với tài khoản ngoài danh sách', () => {
    const env = createGasEnv({ email: 'khong-duoc-cap-quyen@gmail.com' });
    expect(() => env.call('yeuCauDangNhap_')).toThrow(/chưa được cấp quyền/);
  });
});

describe('doGet() - chặn trang ngay từ đầu cho người không có quyền', () => {
  test('email không có trong danh sách -> trả về trang "Không có quyền truy cập", KHÔNG render app thật', () => {
    const env = createGasEnv({ email: 'ke-la@gmail.com' });
    const out = env.call('doGet');
    expect(out.__html).toMatch(/Không có quyền truy cập/);
    expect(out.__html).toMatch(/ke-la@gmail\.com/);
  });

  test('admin hợp lệ -> KHÔNG trả về trang chặn (đi tiếp vào nhánh render app thật)', () => {
    const env = createGasEnv({ email: 'saoluucvhak@gmail.com' });
    const out = env.call('doGet');
    expect(out.__html).toBeUndefined(); // nhánh chặn không được kích hoạt
  });
});

describe('HT_luuDanhSachQuyen() - validate danh sách người dùng', () => {
  let env;
  beforeEach(() => { env = createGasEnv({ email: 'saoluucvhak@gmail.com' }); });

  test('lưu danh sách hợp lệ mới - áp dụng ngay, không cần khởi động lại', () => {
    const res = env.call('HT_luuDanhSachQuyen', [
      { email: 'saoluucvhak@gmail.com', vaiTro: 'ADMIN' },
      { email: 'ketoan@gmail.com', vaiTro: 'NHANVIEN' },
    ]);
    expect(res.status).toBe('success');
    expect(env.call('DS_QUYEN_')).toHaveLength(2);

    env.session.__setEmail('ketoan@gmail.com');
    expect(env.call('layThongTinNguoiDungHienTai_').coQuyen).toBe(true);
    expect(env.call('layThongTinNguoiDungHienTai_').laAdmin).toBe(false);
  });

  test('từ chối danh sách rỗng', () => {
    const res = env.call('HT_luuDanhSachQuyen', []);
    expect(res.status).toBe('error');
  });

  test('từ chối nếu không còn ADMIN nào trong danh sách', () => {
    const res = env.call('HT_luuDanhSachQuyen', [
      { email: 'nv1@gmail.com', vaiTro: 'NHANVIEN' },
      { email: 'nv2@gmail.com', vaiTro: 'NHANVIEN' },
    ]);
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/ít nhất 1 tài khoản ADMIN/);
    // Danh sách CŨ (có admin gốc) phải còn nguyên, không bị mất do lưu thất bại giữa chừng.
    expect(env.call('DS_QUYEN_').some((u) => u.vaiTro === 'ADMIN')).toBe(true);
  });

  test('từ chối email không hợp lệ', () => {
    const res = env.call('HT_luuDanhSachQuyen', [
      { email: 'saoluucvhak@gmail.com', vaiTro: 'ADMIN' },
      { email: 'khong-phai-email', vaiTro: 'NHANVIEN' },
    ]);
    expect(res.status).toBe('error');
  });

  test('loại email trùng, giữ lần xuất hiện đầu tiên', () => {
    const res = env.call('HT_luuDanhSachQuyen', [
      { email: 'a@gmail.com', vaiTro: 'ADMIN' },
      { email: 'A@GMAIL.com', vaiTro: 'NHANVIEN' }, // trùng (khác hoa/thường) - giữ vai trò ADMIN của dòng đầu
    ]);
    expect(res.status).toBe('success');
    const ds = env.call('DS_QUYEN_');
    expect(ds).toHaveLength(1);
    expect(ds[0].vaiTro).toBe('ADMIN');
  });

  test('NHÂN VIÊN thường không tự cấp quyền Admin cho chính mình được (server chặn)', () => {
    const attackerEnv = createGasEnv({ email: 'nhanvien-thuong@gmail.com' });
    const res = attackerEnv.call('HT_luuDanhSachQuyen', [
      { email: 'nhanvien-thuong@gmail.com', vaiTro: 'ADMIN' },
    ]);
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/quyền Quản trị/);
  });
});

describe('Các hàm cấu hình admin-only khác đều bị chặn đúng cách', () => {
  test.each([
    ['HT_layLienKetDuLieu', []],
    ['HT_luuLienKetDuLieu', [{}]],
    ['HT_layMisaDefaults', []],
    ['HT_luuMisaDefaults', [{}]],
    ['HT_layCauHinhVungMien', []],
    ['HT_luuCauHinhVungMien', ['US', 'VN']],
    ['HT_layLocaleThatCuaSheet', []],
    ['HT_layDanhSachQuyen', []],
    ['HT_xacNhanCauTrucSheetHienTai', []],
  ])('%s bị từ chối khi gọi bởi tài khoản không phải Admin', (fnName, args) => {
    const env = createGasEnv({ email: 'nguoi-ngoai@gmail.com' });
    const res = env.call(fnName, ...args);
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/quyền Quản trị/);
  });

  test.each([
    ['HT_layLienKetDuLieu', []],
    ['HT_layMisaDefaults', []],
    ['HT_layCauHinhVungMien', []],
    ['HT_layDanhSachQuyen', []],
  ])('%s hoạt động bình thường khi gọi bởi Admin', (fnName, args) => {
    const env = createGasEnv({ email: 'saoluucvhak@gmail.com' });
    const res = env.call(fnName, ...args);
    expect(res.status).toBe('success');
  });
});

describe('HT_layThongTinNguoiDungHienTai() - hàm public cho client, KHÔNG chặn', () => {
  test('trả về đúng thông tin cho cả người CÓ và KHÔNG có quyền (không throw)', () => {
    const env1 = createGasEnv({ email: 'saoluucvhak@gmail.com' });
    expect(env1.call('HT_layThongTinNguoiDungHienTai').data.laAdmin).toBe(true);

    const env2 = createGasEnv({ email: 'ai-cung-duoc@gmail.com' });
    const res2 = env2.call('HT_layThongTinNguoiDungHienTai');
    expect(res2.status).toBe('success');
    expect(res2.data.coQuyen).toBe(false);
  });
});
