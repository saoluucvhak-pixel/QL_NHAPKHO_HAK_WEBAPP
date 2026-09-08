const { createGasEnv } = require('./gasEnv');

const ADMIN_EMAIL = 'saoluucvhak@gmail.com';

// ID mặc định trong Config.gs (LIENKET_DANH_SACH) - dùng để kiểm tra đúng
// tài nguyên nào được chia sẻ.
const CONFIG_SPREADSHEET_ID = '1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g'; // = CONFIG_DRAFT_CHUATT_SPREADSHEET_ID (trùng, phải gộp)
const CONFIG_FOLDER_DONE = '1bAp97Lwrpq6N8z4-2oXSaieszSL2roca';
const BAOGIA_SPREADSHEET_ID = '1SIhfjP5-6ouRPDj265lAMmI5yWs1XcnedjqpzDwaIC0';

describe('HT_chiaSeTaiNguyenChoDanhSachQuyen() - tự động share Sheet/Drive cho danh sách quyền', () => {
  test('CHỈ ADMIN mới gọi được', () => {
    const env = createGasEnv({ email: 'ai-do@gmail.com' });
    const res = env.call('HT_chiaSeTaiNguyenChoDanhSachQuyen');
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/quyền Quản trị/);
  });

  test('chia sẻ đúng ID (sheet dùng getFileById, folder dùng getFolderById) cho TỪNG người trong danh sách quyền, không trùng lặp ID', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    env.call('HT_luuDanhSachQuyen', [
      { email: ADMIN_EMAIL, vaiTro: 'ADMIN' },
      { email: 'nv1@gmail.com', vaiTro: 'NHANVIEN' },
    ]);

    const res = env.call('HT_chiaSeTaiNguyenChoDanhSachQuyen');
    expect(res.status).toBe('success');
    expect(res.data.every((r) => r.ok)).toBe(true);

    // Spreadsheet chính (dùng chung ID với Draft Chưa TT) - phải là getFileById, chỉ 1 lần cho mỗi email dù có 2 mục cấu hình trỏ tới cùng ID này
    expect(env.driveApp.__layEditorsFile(CONFIG_SPREADSHEET_ID).sort()).toEqual([ADMIN_EMAIL, 'nv1@gmail.com'].sort());
    const soLanChoConfigSpreadsheet = res.data.filter((r) => r.tenTaiNguyen.indexOf('PhieuCan_DN') !== -1 && r.email === 'nv1@gmail.com').length;
    expect(soLanChoConfigSpreadsheet).toBe(1); // không bị lặp lại do trùng ID với Draft Chưa TT

    // Thư mục Done - phải dùng getFolderById
    expect(env.driveApp.__layEditorsFolder(CONFIG_FOLDER_DONE).sort()).toEqual([ADMIN_EMAIL, 'nv1@gmail.com'].sort());

    // Spreadsheet Báo giá
    expect(env.driveApp.__layEditorsFile(BAOGIA_SPREADSHEET_ID).sort()).toEqual([ADMIN_EMAIL, 'nv1@gmail.com'].sort());
  });

  test('1 tài nguyên bị lỗi quyền (không phải chủ sở hữu) -> báo lỗi CHO ĐÚNG DÒNG đó, KHÔNG chặn các tài nguyên/người dùng khác', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    env.driveApp.__lamLoiChoId(CONFIG_FOLDER_DONE); // giả lập không phải chủ sở hữu thư mục Done

    const res = env.call('HT_chiaSeTaiNguyenChoDanhSachQuyen');
    expect(res.status).toBe('success'); // vẫn trả về success tổng thể, lỗi nằm ở từng dòng
    const dongLoi = res.data.filter((r) => !r.ok);
    expect(dongLoi.length).toBeGreaterThan(0);
    expect(dongLoi.every((r) => r.tenTaiNguyen.indexOf('Done') !== -1)).toBe(true);

    // Tài nguyên khác (không bị lỗi) vẫn chia sẻ thành công bình thường
    const dongOkKhac = res.data.filter((r) => r.ok && r.tenTaiNguyen.indexOf('PhieuCan_DN') !== -1);
    expect(dongOkKhac.length).toBeGreaterThan(0);
  });

  test('chưa từng lưu danh sách quyền -> DS_QUYEN_() fallback về Admin bootstrap, vẫn chia sẻ được cho đúng người đó', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    const res = env.call('HT_chiaSeTaiNguyenChoDanhSachQuyen');
    expect(res.status).toBe('success');
    expect(res.data.every((r) => r.email === ADMIN_EMAIL)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  test('mỗi người dùng chia sẻ ĐÚNG quyền Drive riêng (Xem/Bình luận/Chỉnh sửa) theo quyenDrive đã lưu, không phải mặc định EDITOR cho tất cả', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    env.call('HT_luuDanhSachQuyen', [
      { email: ADMIN_EMAIL, vaiTro: 'ADMIN', quyenDrive: 'EDITOR' },
      { email: 'ketoan-xem@gmail.com', vaiTro: 'NHANVIEN', quyenDrive: 'VIEWER' },
      { email: 'nv-binhluan@gmail.com', vaiTro: 'NHANVIEN', quyenDrive: 'COMMENTER' },
    ]);

    const res = env.call('HT_chiaSeTaiNguyenChoDanhSachQuyen');
    expect(res.status).toBe('success');
    expect(res.data.every((r) => r.ok)).toBe(true);

    expect(env.driveApp.__layQuyenFile(CONFIG_SPREADSHEET_ID, ADMIN_EMAIL)).toBe('EDITOR');
    expect(env.driveApp.__layQuyenFile(CONFIG_SPREADSHEET_ID, 'ketoan-xem@gmail.com')).toBe('VIEWER');
    expect(env.driveApp.__layQuyenFile(CONFIG_SPREADSHEET_ID, 'nv-binhluan@gmail.com')).toBe('COMMENTER');
    expect(env.driveApp.__layQuyenFolder(CONFIG_FOLDER_DONE, 'ketoan-xem@gmail.com')).toBe('VIEWER');

    const dongXem = res.data.find((r) => r.email === 'ketoan-xem@gmail.com' && r.tenTaiNguyen.indexOf('PhieuCan_DN') !== -1);
    expect(dongXem.quyenDrive).toBe('Xem');
  });

  test('quyenDrive không hợp lệ/thiếu -> HT_luuDanhSachQuyen tự chuẩn hoá về EDITOR (an toàn, giữ hành vi cũ)', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    const saveRes = env.call('HT_luuDanhSachQuyen', [
      { email: ADMIN_EMAIL, vaiTro: 'ADMIN' }, // không gửi quyenDrive
      { email: 'nv@gmail.com', vaiTro: 'NHANVIEN', quyenDrive: 'khong-hop-le' },
    ]);
    expect(saveRes.status).toBe('success');
    const ds = env.call('DS_QUYEN_');
    expect(ds.find((u) => u.email === ADMIN_EMAIL).quyenDrive).toBe('EDITOR');
    expect(ds.find((u) => u.email === 'nv@gmail.com').quyenDrive).toBe('EDITOR');
  });
});

describe('HT_layTinhTrangChiaSeTaiNguyen() - xem CHÍNH XÁC email nào đang có quyền gì trên từng tài nguyên', () => {
  test('CHỈ ADMIN mới xem được', () => {
    const env = createGasEnv({ email: 'ai-do@gmail.com' });
    const res = env.call('HT_layTinhTrangChiaSeTaiNguyen');
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/quyền Quản trị/);
  });

  test('liệt kê đúng từng (tài nguyên, email, quyền) sau khi chia sẻ - phân biệt đúng Chỉnh sửa vs Xem/Bình luận', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    env.call('HT_luuDanhSachQuyen', [
      { email: ADMIN_EMAIL, vaiTro: 'ADMIN', quyenDrive: 'EDITOR' },
      { email: 'chi-xem@gmail.com', vaiTro: 'NHANVIEN', quyenDrive: 'VIEWER' },
    ]);
    env.call('HT_chiaSeTaiNguyenChoDanhSachQuyen');

    const res = env.call('HT_layTinhTrangChiaSeTaiNguyen');
    expect(res.status).toBe('success');

    const dongConfigAdmin = res.data.find((r) => r.id === CONFIG_SPREADSHEET_ID && r.email === ADMIN_EMAIL);
    expect(dongConfigAdmin.quyen).toBe('Chỉnh sửa');
    const dongConfigChiXem = res.data.find((r) => r.id === CONFIG_SPREADSHEET_ID && r.email === 'chi-xem@gmail.com');
    expect(dongConfigChiXem.quyen).toBe('Xem/Bình luận');

    // Không lặp lại tài nguyên trùng ID (Draft Chưa TT = CONFIG_SPREADSHEET_ID)
    const soDongConfigAdmin = res.data.filter((r) => r.id === CONFIG_SPREADSHEET_ID && r.email === ADMIN_EMAIL).length;
    expect(soDongConfigAdmin).toBe(1);
  });

  test('chưa chia sẻ gì -> trả về danh sách rỗng (không lỗi)', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    const res = env.call('HT_layTinhTrangChiaSeTaiNguyen');
    expect(res.status).toBe('success');
    expect(res.data).toEqual([]);
  });
});

describe('HT_thuHoiQuyenTaiNguyen() / HT_thuHoiToanBoQuyenDriveChoEmail() - thu hồi quyền Drive', () => {
  test('CHỈ ADMIN mới thu hồi được', () => {
    const env = createGasEnv({ email: 'ai-do@gmail.com' });
    expect(env.call('HT_thuHoiQuyenTaiNguyen', CONFIG_SPREADSHEET_ID, 'sheet', 'nv@gmail.com').status).toBe('error');
    expect(env.call('HT_thuHoiToanBoQuyenDriveChoEmail', 'nv@gmail.com').status).toBe('error');
  });

  test('thu hồi trên 1 tài nguyên cụ thể -> chỉ mất quyền ĐÚNG tài nguyên đó, các tài nguyên khác của cùng email vẫn còn', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    env.call('HT_luuDanhSachQuyen', [
      { email: ADMIN_EMAIL, vaiTro: 'ADMIN', quyenDrive: 'EDITOR' },
      { email: 'nv@gmail.com', vaiTro: 'NHANVIEN', quyenDrive: 'EDITOR' },
    ]);
    env.call('HT_chiaSeTaiNguyenChoDanhSachQuyen');
    expect(env.driveApp.__layQuyenFile(CONFIG_SPREADSHEET_ID, 'nv@gmail.com')).toBe('EDITOR');
    expect(env.driveApp.__layQuyenFile(BAOGIA_SPREADSHEET_ID, 'nv@gmail.com')).toBe('EDITOR');

    const res = env.call('HT_thuHoiQuyenTaiNguyen', CONFIG_SPREADSHEET_ID, 'sheet', 'nv@gmail.com');
    expect(res.status).toBe('success');
    expect(env.driveApp.__layQuyenFile(CONFIG_SPREADSHEET_ID, 'nv@gmail.com')).toBeUndefined();
    expect(env.driveApp.__layQuyenFile(BAOGIA_SPREADSHEET_ID, 'nv@gmail.com')).toBe('EDITOR'); // KHÔNG bị đụng tới
  });

  test('thu hồi quyền VIEWER/COMMENTER cũng dùng removeViewer() (DriveApp gộp chung 2 nhóm) - vẫn mất quyền', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    env.call('HT_luuDanhSachQuyen', [
      { email: ADMIN_EMAIL, vaiTro: 'ADMIN', quyenDrive: 'EDITOR' },
      { email: 'nv-binhluan@gmail.com', vaiTro: 'NHANVIEN', quyenDrive: 'COMMENTER' },
    ]);
    env.call('HT_chiaSeTaiNguyenChoDanhSachQuyen');
    expect(env.driveApp.__layQuyenFile(CONFIG_SPREADSHEET_ID, 'nv-binhluan@gmail.com')).toBe('COMMENTER');

    env.call('HT_thuHoiQuyenTaiNguyen', CONFIG_SPREADSHEET_ID, 'sheet', 'nv-binhluan@gmail.com');
    expect(env.driveApp.__layQuyenFile(CONFIG_SPREADSHEET_ID, 'nv-binhluan@gmail.com')).toBeUndefined();
  });

  test('thu hồi TOÀN BỘ cho 1 email -> mất quyền trên MỌI tài nguyên, người khác không bị ảnh hưởng', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    env.call('HT_luuDanhSachQuyen', [
      { email: ADMIN_EMAIL, vaiTro: 'ADMIN', quyenDrive: 'EDITOR' },
      { email: 'nghi-viec@gmail.com', vaiTro: 'NHANVIEN', quyenDrive: 'EDITOR' },
    ]);
    env.call('HT_chiaSeTaiNguyenChoDanhSachQuyen');

    const res = env.call('HT_thuHoiToanBoQuyenDriveChoEmail', 'nghi-viec@gmail.com');
    expect(res.status).toBe('success');
    expect(res.data.every((r) => r.ok)).toBe(true);

    expect(env.driveApp.__layQuyenFile(CONFIG_SPREADSHEET_ID, 'nghi-viec@gmail.com')).toBeUndefined();
    expect(env.driveApp.__layQuyenFile(BAOGIA_SPREADSHEET_ID, 'nghi-viec@gmail.com')).toBeUndefined();
    expect(env.driveApp.__layQuyenFolder(CONFIG_FOLDER_DONE, 'nghi-viec@gmail.com')).toBeUndefined();
    // Admin không bị đụng tới
    expect(env.driveApp.__layQuyenFile(CONFIG_SPREADSHEET_ID, ADMIN_EMAIL)).toBe('EDITOR');
  });

  test('thiếu email -> báo lỗi rõ ràng, không throw', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    expect(env.call('HT_thuHoiToanBoQuyenDriveChoEmail', '').status).toBe('error');
    expect(env.call('HT_thuHoiQuyenTaiNguyen', CONFIG_SPREADSHEET_ID, 'sheet', '').status).toBe('error');
  });
});
