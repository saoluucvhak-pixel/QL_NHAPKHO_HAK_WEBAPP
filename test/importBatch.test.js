const { createGasEnv } = require('./gasEnv');
const mocks = require('./gasMocks');
const { chayKichBan } = require('./importBatchFixture');
const golden = require('./importBatch.golden.json');

// PERF-05: gộp lệnh ghi ở nhánh "cập nhật phiếu đã có" khi re-import. Ảnh chụp
// golden được tạo từ code TRƯỚC khi tối ưu - mọi ô và mọi định dạng số phải y hệt.
describe('PERF-05 step1_ConfirmImport: re-import cho kết quả y hệt bản trước tối ưu', () => {
  test('giá trị từng ô, định dạng từng ô và thông báo trùng khớp ảnh chụp golden', () => {
    const kq = chayKichBan(createGasEnv());
    expect(kq.message).toBe(golden.message);
    expect(kq.data).toEqual(golden.data);
    expect(kq.formats).toEqual(golden.formats);
  });

  test('số lệnh Sheets không tăng theo số phiếu cập nhật (tối đa 2 lệnh/phiếu)', () => {
    const env = createGasEnv();
    mocks.resetApiCounter_();
    chayKichBan(env);
    const c = mocks.getApiCounter_().calls;
    // 4 phiếu cập nhật: trước tối ưu = 4 x 8 lệnh ghi (setValues/setValue/setNumberFormat(s))
    const ghiCapNhat = (c.setValue || 0) + (c.setNumberFormats || 0);
    expect(ghiCapNhat).toBe(0);
  });
});
