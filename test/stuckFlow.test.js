const { createGasEnv } = require('./gasEnv');
const mocks = require('./gasMocks');
const { napDuLieuLon, PHIEUCAN_ID } = require('./perfFixtures');

// "Luồng dữ liệu bị kẹt": (1) 1 người khác giữ khóa quá lâu, (2) Google Sheets
// lỗi/timeout GIỮA CHỪNG lúc đang ghi. Yêu cầu: không treo, báo lỗi rõ ràng,
// LUÔN trả khóa (khóa không được trả = mọi người dùng sau đều bị "treo" chờ),
// và chạy lại sau sự cố phải cho kết quả đúng, không nhân đôi dữ liệu.
const ADMIN = 'saoluucvhak@gmail.com';

afterEach(() => mocks.tiemLoiSheets_(null));

function khoaDaTraHet(env) {
  expect(env.lockService.__dangGiu).toBe(false);
  expect(env.lockService.__soLanTra).toBe(env.lockService.__soLanLay);
}

function phieuImport(i, maCT) {
  const now = new Date().toISOString();
  return { soPhieu: 'SP' + i, soXe: 'XE-1', khGoc: 'KH 1', dlGoc: 'DL1', ngGoc: 'NG1', klCan1: 30000, klCan2: 10000, klHangGoc: 20000, uniqueKey: maCT, rawDateC: now, rawDateD: now };
}

describe('Khóa bị người khác giữ quá lâu -> trả lỗi "đang bận" ngay, không treo, không ghi gì', () => {
  test.each([
    ['step1_ConfirmImport', [[phieuImport(1, 'CT1')], false]],
    ['addManualPhieuCan', [{ soPhieu: 'X', soXe: 'Y' }]],
    ['HT_chotSoNam', [2024]],
    ['copyDataWithFinalLookup', ['2026-01-01', '2026-01-31']],
    ['runCalculatePrice', []],
    ['BG_addMaBaoGia', [{}]], ['BG_deleteMaBaoGia', ['X']], ['BG_addMaKL', [{}]], ['BG_deleteMaKL', ['X']],
    ['BG_updateBaogiaRow', [{}]], ['BG_deleteBaogiaRow', ['X']], ['BG_deleteQuote', ['X']], ['BG_createQuote', [{}]],
    ['BG_updateHieuLuc', []], ['BG_showAllData', []],
    ['XH_step1_ConfirmImport', [[]]], ['XH_saveDonHang', [{}]], ['XH_updateDonHang', [2, {}]], ['XH_deleteDonHang', [2]],
  ])('%s', (fnName, args) => {
    const env = createGasEnv({ email: ADMIN });
    env.lockService.__giuBoiPhienKhac = true;
    mocks.resetApiCounter_();
    const res = env.call(fnName, ...args);
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/bận/);
    expect(mocks.getApiCounter_().oWrite).toBe(0);
    // thời gian chờ khóa tối đa có giới hạn (không chờ vô hạn)
    env.lockService.__timeoutYeuCau.forEach((ms) => expect(ms).toBeLessThanOrEqual(30000));
  });

  test('processFormData (Kho Dăm): báo "đang bận" bằng tiếng Việt thay vì lỗi "Lock timeout" tiếng Anh', () => {
    const env = createGasEnv({ email: ADMIN });
    env.lockService.__giuBoiPhienKhac = true;
    const res = env.call('processFormData', 'Danhmuckho', { hanhDong: 'THEM', tenNhaMay: 'A', tenKho: 'B', ngayKhoiTao: '2026-01-01' });
    expect(res).toMatch(/^❌ Hệ thống đang bận/);
    expect(res).not.toMatch(/Lock timeout/);
  });

  test('người giữ khóa xong việc -> người sau ghi được ngay (khóa không bị kẹt lại)', () => {
    const env = createGasEnv({ email: ADMIN });
    napDuLieuLon(env, { soDongNong: 0 });
    env.lockService.__giuBoiPhienKhac = true;
    expect(env.call('step1_ConfirmImport', [phieuImport(1, 'CT1')], false).message).toMatch(/bận/);
    env.lockService.__giuBoiPhienKhac = false;
    expect(env.call('step1_ConfirmImport', [phieuImport(1, 'CT1')], false).status).toBe('success');
    khoaDaTraHet(env);
  });
});

describe('Google Sheets lỗi/timeout GIỮA CHỪNG lúc ghi -> báo lỗi, trả khóa, chạy lại cho kết quả đúng', () => {
  test('Import phiếu cân: lỗi ở lệnh ghi -> status error, khóa đã trả; import lại -> đủ phiếu, KHÔNG trùng', () => {
    const env = createGasEnv({ email: ADMIN });
    napDuLieuLon(env, { soDongNong: 0 });
    const ds = [1, 2, 3].map((i) => phieuImport(i, 'CT' + i));

    mocks.tiemLoiSheets_({ method: 'setValues', lanThu: 1 });
    const loi = env.call('step1_ConfirmImport', ds, false);
    expect(loi.status).toBe('error');
    expect(loi.message).toMatch(/timed out/);
    khoaDaTraHet(env);

    const ok = env.call('step1_ConfirmImport', ds, false);
    expect(ok.status).toBe('success');
    const sheet = env.spreadsheetApp.openById(PHIEUCAN_ID).getSheetByName('PhieuCan_DN');
    const maCT = sheet.__data.slice(1).map((r) => r[21]);
    expect(maCT).toEqual(['CT1', 'CT2', 'CT3']);
    khoaDaTraHet(env);
  });

  test('Import: phiếu đã ghi nhưng bước TÍNH GIÁ lỗi -> báo rõ trong thông báo, tính giá lại sau đó tự đúng', () => {
    const env = createGasEnv({ email: ADMIN });
    napDuLieuLon(env, { soDongNong: 0 });
    mocks.tiemLoiSheets_({ method: 'setValues', lanThu: 2 }); // lần 1 = ghi phiếu, lần 2 = ghi giá
    const res = env.call('step1_ConfirmImport', [phieuImport(1, 'CT1')], false);
    expect(res.status).toBe('success');
    expect(res.message).toMatch(/Mới: 1.*Lỗi:.*timed out/);
    khoaDaTraHet(env);

    const sheet = env.spreadsheetApp.openById(PHIEUCAN_ID).getSheetByName('PhieuCan_DN');
    expect(sheet.__data[1][24] || '').toBe(''); // chưa có trạng thái giá
    expect(env.call('runCalculatePrice').status).toBe('success');
    expect(sheet.__data[1][24]).toBe('Test giá');
    expect(sheet.__data[1][25]).toBe(20000000);
    khoaDaTraHet(env);
  });

  test('Chốt sổ năm bị ngắt giữa lúc XÓA dòng -> chạy lại tự hết trùng, báo cáo không cộng đôi (STUCK-01)', () => {
    const env = createGasEnv({ email: ADMIN });
    const ss = env.spreadsheetApp.openById(PHIEUCAN_ID);
    const header = new Array(27).fill('H');
    const dong = (i, trangThai) => {
      const r = new Array(27).fill('');
      r[0] = 'P' + i; r[1] = new Date(2024, i % 12, 5, 12); r[9] = 1000; r[21] = 'CT' + i; r[24] = trangThai; r[25] = 100;
      return r;
    };
    // OK xen kẽ chưa OK -> nhiều khối rời, nhiều lệnh deleteRows
    const rows = [];
    for (let i = 1; i <= 10; i++) rows.push(dong(i, i % 2 ? 'OK' : ''));
    ss.__setSheet('PhieuCan_DN', [header, ...rows]);
    const tongTruoc = env.call('getBaoCaoTongHop', { fromDate: '2024-01-01', toDate: '2024-12-31' }).summary;
    expect(tongTruoc.soLuong).toBe(10);

    mocks.tiemLoiSheets_({ method: 'deleteRows', lanThu: 3 }); // xóa được 2 khối rồi lỗi
    const loi = env.call('HT_chotSoNam', 2024);
    expect(loi.status).toBe('error');
    khoaDaTraHet(env);
    // trạng thái dở dang: 3 phiếu OK còn ở CẢ 2 nơi -> báo cáo bị cộng trùng
    expect(env.call('getBaoCaoTongHop', { fromDate: '2024-01-01', toDate: '2024-12-31' }).summary.soLuong).toBe(13);

    const chayLai = env.call('HT_chotSoNam', 2024);
    expect(chayLai.status).toBe('success');
    expect(chayLai.message).toMatch(/3 phiếu đã có sẵn trong lưu trữ/);
    const luuTru = ss.getSheetByName('PhieuCan_DN_2024').__data.slice(1).map((r) => r[21]).sort();
    expect(luuTru).toEqual(['CT1', 'CT3', 'CT5', 'CT7', 'CT9']);
    expect(ss.getSheetByName('PhieuCan_DN').__data.slice(1).map((r) => r[21])).toEqual(['CT2', 'CT4', 'CT6', 'CT8', 'CT10']);
    expect(env.call('getBaoCaoTongHop', { fromDate: '2024-01-01', toDate: '2024-12-31' }).summary).toEqual(tongTruoc);
    khoaDaTraHet(env);
  });

  test('Chốt sổ chạy bình thường 2 lần liên tiếp -> lần 2 không chép trùng gì', () => {
    const env = createGasEnv({ email: ADMIN });
    const ss = env.spreadsheetApp.openById(PHIEUCAN_ID);
    const r = new Array(27).fill(''); r[1] = new Date(2024, 3, 1, 12); r[21] = 'CT1'; r[24] = 'OK';
    ss.__setSheet('PhieuCan_DN', [new Array(27).fill('H'), r]);
    expect(env.call('HT_chotSoNam', 2024).message).not.toMatch(/có sẵn/);
    expect(env.call('HT_chotSoNam', 2024).message).toMatch(/Không có (phiếu nào|dữ liệu)/);
    expect(ss.getSheetByName('PhieuCan_DN_2024').__data.length).toBe(2);
  });

  test('Kho Dăm: lỗi Sheets khi ghi -> trả "❌ Lỗi", khóa đã trả, không treo', () => {
    const env = createGasEnv({ email: ADMIN });
    env.call('processFormData', 'Danhmuckho', { hanhDong: 'THEM', tenNhaMay: 'A', tenKho: 'B', ngayKhoiTao: '2026-01-01' });
    mocks.tiemLoiSheets_({ method: 'appendRow', lanThu: 1 });
    const res = env.call('processFormData', 'Danhmuckho', { hanhDong: 'THEM', tenNhaMay: 'A', tenKho: 'C', ngayKhoiTao: '2026-01-01' });
    expect(res).toMatch(/^❌ Lỗi:.*timed out/);
    khoaDaTraHet(env);
  });
});
