const fs = require('fs');
const path = require('path');
const { createGasEnv } = require('./gasEnv');
const mocks = require('./gasMocks');

// PERF-TG-02 (ghi gộp qua dịch vụ Sheets), DRAFT-02 (Draft luôn có giá), GIO-01
// (giờ của ô "chỉ có giờ"), quyền xem email trong appsscript.json.
const PHIEUCAN_ID = '1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g';
const BAOGIA_ID = '1SIhfjP5-6ouRPDj265lAMmI5yWs1XcnedjqpzDwaIC0';
const DRAFT = 'PhieuCan_DN_CHUA_TT_DRAFT';

function phieu(i, y) {
  const r = new Array(27).fill('');
  r[0] = String(i); r[1] = new Date(2026, 5, 15); r[2] = new Date(1899, 11, 30, 8, 30, 15);
  r[3] = new Date(2026, 5, 15); r[4] = new Date(1899, 11, 30, 9, 5, 0);
  r[5] = 'XE'; r[9] = 20000; r[11] = 'KH'; r[13] = 'DL1'; r[14] = 'NG1'; r[15] = 'Y'; r[16] = 'DL1_NG1_Y';
  r[21] = i + '/2026/NK'; r[22] = r[21]; r[24] = y; r[25] = 0;
  return r;
}
// 40 phiếu: chưa OK xen kẽ OK -> nhiều khối dòng rời rạc (>3 vùng ghi -> dùng API)
function nap(env) {
  const ds = []; for (let i = 1; i <= 40; i++) ds.push(phieu(i, i % 2 ? 'Test giá' : 'OK'));
  const sh = env.spreadsheetApp.openById(PHIEUCAN_ID).__setSheet('PhieuCan_DN', [new Array(27).fill('H'), ...ds]);
  const t = new Date(2000, 0, 1), t2 = new Date(2100, 0, 1);
  env.spreadsheetApp.openById(BAOGIA_ID).__setSheet('Baogia_DN_SAVE', [new Array(7).fill('H'), [t, t, t2, 'DL1_NG1_Y', 0, 1000, 1200]]);
  return env.spreadsheetApp.openById(PHIEUCAN_ID).getSheetByName('PhieuCan_DN') || sh;
}
const cot = (env, c) => env.spreadsheetApp.openById(PHIEUCAN_ID).getSheetByName('PhieuCan_DN').__data.slice(1).map((r) => r[c]);

describe('PERF-TG-02: tính giá ghi gộp 1 lệnh Sheets API, kết quả y hệt cách ghi từng vùng', () => {
  test('cùng giá trị từng ô như khi không có dịch vụ Sheets; chỉ 1 lệnh batchUpdate, vùng A1 đúng tên sheet + cột', () => {
    const coApi = createGasEnv({ sheetsApi: 'ghi' }); nap(coApi);
    const khongApi = createGasEnv(); nap(khongApi);
    expect(coApi.call('runCalculatePrice').status).toBe('success');
    expect(khongApi.call('runCalculatePrice').status).toBe('success');
    [19, 23, 24, 25].forEach((c) => expect(cot(coApi, c)).toEqual(cot(khongApi, c)));
    expect(cot(coApi, 25).filter((v) => v === 24000).length).toBe(20); // 20 phiếu chưa OK, 20 tấn x 1.200
    expect(coApi.sheetsApiCalls.length).toBe(1);
    const ranges = coApi.sheetsApiCalls[0].req.data.map((d) => d.range);
    expect(ranges).toContain("'PhieuCan_DN'!T2:T2");
    expect(ranges).toContain("'PhieuCan_DN'!X2:Z2");
    expect(coApi.sheetsApiCalls[0].req.valueInputOption).toBe('RAW');
  });

  test('tên cột sau Z (AA, AB...) đổi đúng', () => {
    const env = createGasEnv();
    expect([1, 26, 27, 28, 52, 53].map((n) => env.context.a1Cot_(n))).toEqual(['A', 'Z', 'AA', 'AB', 'AZ', 'BA']);
  });
});

describe('DRAFT-02: bản sao Draft Chưa TT luôn có Đơn giá/Thành tiền, kể cả khi đọc lại chưa thấy giá ghi qua API', () => {
  function chuaThay() { const env = createGasEnv({ sheetsApi: 'khongThay' }); nap(env); return env; }
  test('import có tích "Lưu Draft": phiếu mới trong Draft có giá dù PhieuCan_DN đọc lại chưa thấy', () => {
    const env = chuaThay();
    const now = new Date(2026, 5, 20, 8, 0, 0).toISOString();
    const res = env.call('step1_ConfirmImport', [{ soPhieu: '99', soXe: 'XE', khGoc: 'KH', dlGoc: 'DL1', ngGoc: 'NG1', klCan1: 30000, klCan2: 10000, klHangGoc: 20000, uniqueKey: '99/2026/NK', rawDateC: now, rawDateD: now }], true);
    expect(res.status).toBe('success');
    expect(env.sheetsApiCalls.length).toBe(1); // giá ghi qua API
    const pc = env.spreadsheetApp.openById(PHIEUCAN_ID).getSheetByName('PhieuCan_DN').__data;
    expect(pc[pc.length - 1][25] || '').toBe(''); // đọc lại PhieuCan_DN chưa thấy giá (tình huống xấu nhất)
    const d = env.spreadsheetApp.openById(PHIEUCAN_ID).getSheetByName(DRAFT).__data;
    const dong = d.find((r) => r[21] === '99/2026/NK');
    expect([dong[19], dong[23], dong[24], dong[25]]).toEqual([1200, 1200, 'Test giá', 24000]);
  });

  test('Tra cứu › tính lại giá phiếu đã chọn: Draft nhận giá mới', () => {
    const env = chuaThay();
    const ss = env.spreadsheetApp.openById(PHIEUCAN_ID);
    ss.__setSheet(DRAFT, [new Array(26).fill('H'), phieu(1, 'Test giá').slice(0, 26), phieu(3, 'Test giá').slice(0, 26)]);
    const res = env.call('TC_tinhLaiGiaCacPhieu', ['1/2026/NK', '3/2026/NK', '5/2026/NK', '7/2026/NK']);
    expect(res.status).toBe('success');
    expect(env.sheetsApiCalls.length).toBe(1);
    ss.getSheetByName(DRAFT).__data.slice(1).forEach((r) => expect([r[23], r[25]]).toEqual([1200, 24000]));
  });
});

describe('GIO-01: Giờ cân (ô chỉ có giờ, ngày 30/12/1899) hiển thị đúng như trên sheet', () => {
  test('Báo cáo tổng hợp, Tra cứu (bảng + chi tiết) hiện 08:30:15 - không lệch giờ địa phương cũ', () => {
    const env = createGasEnv(); nap(env);
    // bằng chứng lệch: định dạng "GMT+7" cố định cho ô năm 1899 KHÔNG ra 08:30:15,
    // còn gioCuaO_ (giờ theo múi giờ script) ra đúng (tạo Date trong chính context GAS).
    const trongGAS = (bt) => require('vm').runInContext(bt, env.context);
    expect(trongGAS("dinhDangGMT7_(new Date(1899, 11, 30, 8, 30, 15), 'HH:mm:ss')")).not.toBe('08:30:15');
    expect(trongGAS('gioCuaO_(new Date(1899, 11, 30, 8, 30, 15))')).toBe('08:30:15');
    const bc = env.call('getBaoCaoTongHop', { fromDate: '2026-06-01', toDate: '2026-06-30' }).data[0];
    expect([bc.gioCan1, bc.gioCan2]).toEqual(['08:30:15', '09:05:00']);
    const tc = env.call('TC_traCuuPhieuNhap', { tuKhoa: '1/2026/NK' }).data.find((r) => r.maChungTu === '1/2026/NK');
    expect(tc.ngayGioCan1).toBe('15/06/2026 08:30');
    const ct = env.call('TC_chiTietPhieuNhap', '1/2026/NK').data;
    expect(ct.truong[2][1]).toBe('08:30:15');
    expect([ct.tomTat.ngayGioCan1, ct.tomTat.ngayGioCan2]).toEqual(['15/06/2026 08:30:15', '15/06/2026 09:05:00']);
  });
});

describe('appsscript.json', () => {
  test('có quyền xem email (Session.getActiveUser/getEffectiveUser - chủ script vào thẳng) và dịch vụ Sheets', () => {
    const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'appsscript.json'), 'utf8'));
    expect(m.oauthScopes).toContain('https://www.googleapis.com/auth/userinfo.email');
    expect(m.oauthScopes).toContain('https://www.googleapis.com/auth/spreadsheets');
    expect(m.dependencies.enabledAdvancedServices.map((s) => s.serviceId)).toContain('sheets');
    expect(m.timeZone).toBe('Asia/Ho_Chi_Minh');
  });
});
