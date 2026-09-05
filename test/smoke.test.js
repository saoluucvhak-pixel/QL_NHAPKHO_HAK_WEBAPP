const { createGasEnv } = require('./gasEnv');

describe('GAS test harness (smoke test)', () => {
  test('nạp Config.gs + Code.gs vào vm context mà không lỗi', () => {
    expect(() => createGasEnv()).not.toThrow();
  });

  test('các hàm public quan trọng đều tồn tại sau khi nạp', () => {
    const env = createGasEnv();
    const expectedFunctions = [
      'doGet', 'sanitize', 'parseSoTheoLocale_', 'REGION_FORMAT', 'MISA_FORMAT',
      'MISA_DEFAULTS', 'combineDateTime_', 'toDateOnly_', 'toTimeOnly_', 'toDateObj',
      'parseDate', '_tsTrongKhoangHieuLuc_', 'layThongTinNguoiDungHienTai_',
      'yeuCauQuyenAdmin_', 'yeuCauDangNhap_', 'DS_QUYEN_', 'HT_luuDanhSachQuyen',
      'kiemTraLechHeaderSheet_', 'apDungOverrideLienKet_', 'HT_luuLienKetDuLieu',
    ];
    expectedFunctions.forEach((name) => {
      expect(typeof env.context[name]).toBe('function');
    });
  });
});
