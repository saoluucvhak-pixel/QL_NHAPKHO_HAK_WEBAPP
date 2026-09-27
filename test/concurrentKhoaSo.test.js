const { createGasEnv } = require('./gasEnv');
const { napDuLieuLon, PHIEUCAN_ID } = require('./perfFixtures');

// CONCUR-01: ĐNTT Khóa sổ năm XÓA dòng khỏi PhieuCan_DN (dự án Apps Script khác,
// khóa hệ thống không chặn được nhau). Nếu việc xóa xảy ra giữa lúc webapp này
// ĐỌC số dòng và GHI theo số dòng đó, trước đây giá/khối lượng bị ghi nhầm sang
// phiếu khác. Nay phải phát hiện, không ghi gì, báo người dùng thực hiện lại.
function dong(i, trangThai) {
  const r = new Array(27).fill('');
  r[0] = 'SP-' + i; r[1] = new Date(2026, 5, 10, 12); r[9] = 20000; r[16] = 'DL1_NG1_Y';
  r[21] = 'CT' + i; r[22] = 'CT' + i; r[24] = trangThai;
  return r;
}
function chuanBi(env, soDong) {
  napDuLieuLon(env, { soDongNong: 0 }); // tạo sheet Báo giá (DL1_NG1_Y giá 1.000.000)
  const sh = env.spreadsheetApp.openById(PHIEUCAN_ID).__setSheet('PhieuCan_DN', [new Array(27).fill('H')]);
  for (let i = 1; i <= soDong; i++) sh.__data.push(dong(i, i % 2 ? 'OK' : ''));
  return sh;
}
// ĐNTT xóa 1 dòng phía trên ngay sau lần đọc dữ liệu chính (dòng 2 trở đi, nhiều dòng)
function dnttXoaDongSauKhiDoc(sh, dongXoa) {
  sh.__hookSauKhiDoc = (row, col, n) => { if (row === 2 && n > 1) { sh.__data.splice(dongXoa - 1, 1); return true; } return false; };
}

describe('CONCUR-01: dòng bị ứng dụng khác xóa giữa lúc đọc và ghi', () => {
  test('Tính giá: phát hiện lệch dòng -> không ghi giá vào phiếu nào, báo thực hiện lại', () => {
    const env = createGasEnv();
    const sh = chuanBi(env, 6);
    dnttXoaDongSauKhiDoc(sh, 2); // xóa phiếu SP-1 (dòng 2)
    const mongDoi = sh.__data.slice(); mongDoi.splice(1, 1); // chỉ ĐNTT xóa dòng, webapp này không ghi gì
    const truoc = JSON.stringify(mongDoi);
    const res = env.call('runCalculatePrice_core');
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/thay đổi vị trí dòng.*Khóa sổ/);
    expect(JSON.stringify(sh.__data)).toBe(truoc); // không một ô nào bị ghi
    // Lần sau (không còn ai xóa) tính giá đúng phiếu
    expect(env.call('runCalculatePrice_core').status).toBe('success');
    sh.__data.slice(1).forEach((r) => { if (r[24] !== 'OK') expect(r[25]).toBe(20000000); });
  });

  test('Import lại (cập nhật phiếu cũ): phát hiện lệch dòng -> không ghi dòng nào, khóa đã trả', () => {
    const env = createGasEnv();
    const sh = chuanBi(env, 6);
    dnttXoaDongSauKhiDoc(sh, 3); // xóa SP-2 ngay sau khi import đọc dữ liệu
    const mongDoi = sh.__data.slice(); mongDoi.splice(2, 1);
    const truoc = JSON.stringify(mongDoi);
    const now = new Date().toISOString();
    const res = env.call('step1_ConfirmImport', [{ soPhieu: 'SP-4', soXe: 'XE-MOI', uniqueKey: 'CT4', khGoc: 'KH', dlGoc: 'dl1', ngGoc: 'ng1',
      klCan1: 1, klCan2: 1, klHangGoc: 777, rawDateC: now, rawDateD: now }], false);
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/thay đổi vị trí dòng/);
    expect(JSON.stringify(sh.__data)).toBe(truoc);
    expect(env.lockService.__dangGiu).toBe(false);
  });

  test('Không có ai xóa dòng -> import lại cập nhật đúng phiếu như bình thường', () => {
    const env = createGasEnv();
    const sh = chuanBi(env, 6);
    const now = new Date().toISOString();
    const res = env.call('step1_ConfirmImport', [{ soPhieu: 'SP-4', soXe: 'XE-MOI', uniqueKey: 'CT4', khGoc: 'KH', dlGoc: 'dl1', ngGoc: 'ng1',
      klCan1: 1, klCan2: 1, klHangGoc: 777, rawDateC: now, rawDateD: now }], false);
    expect(res.status).toBe('success');
    expect(sh.__data[4][21]).toBe('CT4');
    expect(sh.__data[4][9]).toBe(777);
    expect(sh.__data[4][5]).toBe('XE-MOI');
  });
});

describe('CONCUR-02: cờ "ĐNTT đang Khóa sổ năm" trên file Phiếu Cân', () => {
  const datCo = (env, batDau) => env.spreadsheetApp.openById(PHIEUCAN_ID)
    .addDeveloperMetadata('HAK_KHOA_SO_NAM_DANG_CHAY', JSON.stringify({ nam: 2025, batDau, ung: 'DNTT' }), 'DOCUMENT');
  const now = new Date().toISOString();
  const phieu = { soPhieu: 'SP-9', soXe: 'XE', uniqueKey: 'CT9', khGoc: 'KH', dlGoc: 'dl1', ngGoc: 'ng1', klCan1: 1, klCan2: 1, klHangGoc: 5, rawDateC: now, rawDateD: now };

  test.each([
    ['step1_ConfirmImport', () => [[phieu], false]],
    ['addManualPhieuCan', () => [{ soPhieu: 'SP-9', soXe: 'XE' }]],
    ['runCalculatePrice', () => []],
  ])('%s: cờ còn mới -> báo đang khóa sổ, không ghi gì, khóa đã trả', (ten, args) => {
    const env = createGasEnv();
    const sh = chuanBi(env, 4);
    datCo(env, Date.now() - 60 * 1000);
    const truoc = JSON.stringify(sh.__data);
    const res = env.call(ten, ...args());
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/ĐNTT đang Khóa sổ năm 2025/);
    expect(JSON.stringify(sh.__data)).toBe(truoc);
    expect(env.lockService.__dangGiu).toBe(false);
  });

  test('cờ cũ hơn 10 phút (ĐNTT bị dừng đột ngột) -> bỏ qua, import chạy bình thường', () => {
    const env = createGasEnv();
    const sh = chuanBi(env, 4);
    datCo(env, Date.now() - 11 * 60 * 1000);
    expect(env.call('step1_ConfirmImport', [phieu], false).status).toBe('success');
    expect(sh.__data.map((r) => r[21])).toContain('CT9');
  });

  test('không có cờ -> không ảnh hưởng', () => {
    const env = createGasEnv();
    chuanBi(env, 4);
    expect(env.call('addManualPhieuCan', { soPhieu: 'SP-9', soXe: 'XE' }).message).not.toMatch(/Khóa sổ/);
  });
});
