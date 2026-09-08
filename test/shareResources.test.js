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
