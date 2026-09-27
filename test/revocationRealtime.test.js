const { createGasEnv, ADMIN_GOC } = require('./gasEnv');

// Thu hồi quyền phải có hiệu lực NGAY với người đang mở sẵn webapp: API()
// kiểm tra lại danh sách quyền ở MỖI lời gọi (xacThucPhien_), và việc kiểm tra
// chạy TRƯỚC khi chiếm khóa - người bị chặn không làm người khác phải chờ.
const NV = 'nhanvien-bi-thu-hoi@gmail.com';

function thuHoi(env) {
  env.session.__setEmail(ADMIN_GOC);
  env.call('HT_luuDanhSachQuyen', [{ email: ADMIN_GOC, vaiTro: 'ADMIN' }]);
  env.session.__setEmail(NV);
}

describe('Thu hồi quyền giữa phiên làm việc', () => {
  test.each([
    ['step1_ConfirmImport', [[], false]], ['addManualPhieuCan', [{}]],
    ['BG_addMaBaoGia', [{}]], ['BG_deleteMaBaoGia', ['X']], ['BG_addMaKL', [{}]], ['BG_deleteMaKL', ['X']],
    ['BG_updateBaogiaRow', [{}]], ['BG_deleteBaogiaRow', ['X']], ['BG_deleteQuote', ['X']], ['BG_createQuote', [{}]],
    ['XH_step1_ConfirmImport', [[]]], ['XH_saveDonHang', [{}]], ['XH_updateDonHang', [2, {}]], ['XH_deleteDonHang', [2]],
    ['processFormData', ['Danhmuckho', { hanhDong: 'THEM' }]],
  ])('%s: bị chặn ngay ở lần gọi kế tiếp, không chiếm khóa', (ten, args) => {
    const env = createGasEnv({ email: NV, vaiTro: 'NHANVIEN' });
    env.maPhien(); // NV đã đăng nhập từ trước
    thuHoi(env);
    const soLanCho = env.lockService.__soLanCho;
    expect(() => env.call(ten, ...args)).toThrow(/không còn trong danh sách/);
    expect(env.lockService.__soLanCho).toBe(soLanCho);
    expect(env.lockService.__dangGiu).toBe(false);
  });

  test('người CÒN quyền vẫn gọi bình thường (không bị chặn nhầm)', () => {
    const env = createGasEnv({ email: NV, vaiTro: 'NHANVIEN' });
    const res = env.call('BG_addMaBaoGia', {});
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/Đại lý/); // lỗi nghiệp vụ, không phải lỗi quyền
  });
});
