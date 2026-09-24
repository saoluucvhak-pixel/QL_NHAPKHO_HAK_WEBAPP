const { createGasEnv } = require('./gasEnv');

// BUG-001 (QA Audit): yeuCauDangNhap_() trước đây không được gọi ở bất kỳ hàm
// ghi dữ liệu nào - thu hồi quyền chỉ có hiệu lực khi người dùng tải lại trang.
// Các test dưới đây mô phỏng đúng kịch bản thật: người dùng ĐANG MỞ webapp
// (cùng 1 env = cùng phiên), Admin xóa họ khỏi danh sách, họ bấm Lưu tiếp.

const ADMIN = 'saoluucvhak@gmail.com';
const NV = 'nhanvien-bi-thu-hoi@gmail.com';

function capQuyenRoiThuHoi(env) {
  env.session.__setEmail(ADMIN);
  env.call('HT_luuDanhSachQuyen', [
    { email: ADMIN, vaiTro: 'ADMIN' },
    { email: NV, vaiTro: 'NHANVIEN' },
  ]);
  env.session.__setEmail(NV);
  expect(env.call('layThongTinNguoiDungHienTai_').coQuyen).toBe(true);

  // Admin thu hồi quyền của NV trong lúc NV vẫn đang mở tab
  env.session.__setEmail(ADMIN);
  env.call('HT_luuDanhSachQuyen', [{ email: ADMIN, vaiTro: 'ADMIN' }]);
  env.session.__setEmail(NV);
}

describe('BUG-001: thu hồi quyền có hiệu lực NGAY, không cần người dùng tải lại trang', () => {
  test.each([
    ['step1_ConfirmImport', [[], false]],
    ['addManualPhieuCan', [{}]],
    ['BG_addMaBaoGia', [{}]],
    ['BG_deleteMaBaoGia', ['X']],
    ['BG_addMaKL', [{}]],
    ['BG_deleteMaKL', ['X']],
    ['BG_updateBaogiaRow', [{}]],
    ['BG_deleteBaogiaRow', ['X']],
    ['BG_deleteQuote', ['X']],
    ['BG_createQuote', [{}]],
    ['BG_updateHieuLuc', []],
    ['BG_showAllData', []],
    ['XH_step1_ConfirmImport', [[]]],
    ['XH_saveDonHang', [{}]],
    ['XH_updateDonHang', [2, {}]],
    ['XH_deleteDonHang', [2]],
  ])('%s: người vừa bị thu hồi quyền bị chặn ngay ở lần gọi kế tiếp', (fnName, args) => {
    const env = createGasEnv();
    capQuyenRoiThuHoi(env);
    const res = env.call(fnName, ...args);
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/chưa được cấp quyền/);
  });

  test('processFormData (toàn bộ module Kho Dăm): ném lỗi để client .withFailureHandler() hiển thị', () => {
    const env = createGasEnv();
    capQuyenRoiThuHoi(env);
    expect(() => env.call('processFormData', 'Danhmuckho', { hanhDong: 'THEM' })).toThrow(/chưa được cấp quyền/);
  });

  test('người CÒN quyền vẫn gọi bình thường (không bị chặn nhầm)', () => {
    const env = createGasEnv({ email: ADMIN });
    const res = env.call('BG_addMaBaoGia', {}); // thiếu dữ liệu -> lỗi NGHIỆP VỤ, không phải lỗi quyền
    expect(res.status).toBe('error');
    expect(res.message).not.toMatch(/chưa được cấp quyền/);
    expect(res.message).toMatch(/Đại lý/);
  });

  test('check quyền chạy TRƯỚC khi chiếm khóa - người bị chặn KHÔNG làm người khác phải chờ khóa', () => {
    const env = createGasEnv();
    capQuyenRoiThuHoi(env);
    const soLanChoTruoc = env.lockService.__soLanCho;
    const res = env.call('BG_deleteQuote', 'X');
    expect(res.message).toMatch(/chưa được cấp quyền/);
    expect(env.lockService.__soLanCho).toBe(soLanChoTruoc); // không hề gọi waitLock
    expect(env.lockService.__dangGiu).toBe(false);
  });
});
