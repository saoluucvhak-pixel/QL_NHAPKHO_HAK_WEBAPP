const { createGasEnv } = require('./gasEnv');

describe('GAS test harness (smoke test)', () => {
  test('nạp Config.gs + Code.gs vào vm context mà không lỗi', () => {
    expect(() => createGasEnv()).not.toThrow();
  });

  test('các hàm quan trọng đều tồn tại sau khi nạp', () => {
    const env = createGasEnv();
    const expectedFunctions = [
      'doGet', 'API', 'DN_kiemTraPhien', 'runCalculatePrice', 'TRIGGER_saoLuuHangDem',
      'sanitize_', 'parseSoTheoLocale_', 'REGION_FORMAT_', 'MISA_FORMAT_',
      'MISA_DEFAULTS_', 'combineDateTime_', 'toDateOnly_', 'toTimeOnly_', 'toDateObj_',
      'parseDate_', '_tsTrongKhoangHieuLuc_', 'layThongTinNguoiDungHienTai_',
      'yeuCauQuyen_', 'yeuCauPhien_', 'xacThucPhien_', 'xuLyVeCong_', 'DS_QUYEN_', 'HT_luuDanhSachQuyen_',
      'kiemTraLechHeaderSheet_', 'apDungOverrideLienKet_', 'HT_luuLienKetDuLieu_', 'API_ROUTES_',
    ];
    expectedFunctions.forEach((name) => {
      expect(typeof env.context[name]).toBe('function');
    });
  });
});
