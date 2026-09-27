const { createGasEnv } = require('./gasEnv');
const mocks = require('./gasMocks');

// PERF-06: ghiVaoDraftChuaTT_ - ghi đè dòng trùng Mã chứng từ + thêm dòng mới.
const DRAFT_ID = '1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g';

function dong(ma, sp) { const r = new Array(23).fill(''); r[0] = sp; r[1] = new Date(2026, 5, 1); r[21] = ma; r[22] = ma; return r; }

describe('PERF-06 ghiVaoDraftChuaTT_', () => {
  test('ghi đè đúng dòng trùng mã, thêm dòng mới, định dạng Ngày/Giờ đặt đúng ô; số lệnh không tăng theo số dòng', () => {
    const env = createGasEnv();
    const ss = env.spreadsheetApp.openById(DRAFT_ID);
    const ten = require('vm').runInContext('CONFIG.DRAFT_CHUATT_SHEET', env.context);
    const draft = ss.__setSheet(ten, [new Array(23).fill('H'), dong('A', 'cu-A'), dong('B', 'cu-B'), dong('C', 'cu-C')]);
    mocks.resetApiCounter_();
    env.call('ghiVaoDraftChuaTT_', [dong('C', 'moi-C'), dong('A', 'moi-A'), dong('Z', 'moi-Z')]);
    // Số phiếu ghi kèm dấu ' (giữ dạng chữ như ĐNTT; Google Sheets không lưu dấu ' vào giá trị)
    expect(draft.__data.map((r) => String(r[0]).replace(/^'/, ''))).toEqual(['H', 'moi-A', 'cu-B', 'moi-C', 'moi-Z']);
    expect(draft.__data[1][0]).toBe("'moi-A");
    const f = draft.__formats;
    [2, 4, 5].forEach((r) => { expect(f[r + ',2']).toBeDefined(); expect(f[r + ',3']).toBeDefined(); expect(f[r + ',4']).toBe(f[r + ',2']); expect(f[r + ',5']).toBe(f[r + ',3']); });
    expect(f['3,2']).toBeUndefined(); // dòng B không bị đụng
    expect(mocks.getApiCounter_().calls.setNumberFormat).toBe(4); // chỉ còn 4 lệnh cho khối dòng MỚI
  });

  test('DRAFT-01: import có tick "lưu Draft" -> phiếu mới vào bản sao ĐNTT KÈM Đơn giá / Trạng thái / Thành tiền', () => {
    const { napDuLieuLon, PHIEUCAN_ID } = require('./perfFixtures');
    const env = createGasEnv();
    napDuLieuLon(env, { soDongNong: 0 }); // Báo giá DL1_NG1_Y = 1.000.000 đ/tấn
    const ten = require('vm').runInContext('CONFIG.DRAFT_CHUATT_SHEET', env.context);
    const now = new Date().toISOString();
    const res = env.call('step1_ConfirmImport', [{ soPhieu: '0123', soXe: 'XE', uniqueKey: 'CT-0123', khGoc: 'KH', dlGoc: 'dl1', ngGoc: 'ng1',
      klCan1: 30000, klCan2: 10000, klHangGoc: 20000, rawDateC: now, rawDateD: now }], true);
    expect(res.status).toBe('success');
    const draft = env.spreadsheetApp.openById(DRAFT_ID).getSheetByName(ten);
    const r = draft.__data[1];
    expect(r[0]).toBe("'0123");       // A: Số phiếu giữ số 0 đầu
    expect(r[22]).toBe("'CT-0123");   // W: Số CT (khóa ĐNTT dùng để chọn phiếu)
    expect(r[23]).toBe(1000000);      // X: Đơn giá
    expect(r[24]).toBe('Test giá');   // Y: Trạng thái
    expect(r[25]).toBe(20000000);     // Z: Thành tiền > 0 -> ĐNTT hiện phiếu này để chọn thanh toán
    expect(r[26] === undefined || r[26] === '').toBe(true); // AA: ID_DNTT trống = chưa thanh toán
    void PHIEUCAN_ID;
  });
});