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
    expect(draft.__data.map((r) => r[0])).toEqual(['H', 'moi-A', 'cu-B', 'moi-C', 'moi-Z']);
    const f = draft.__formats;
    [2, 4, 5].forEach((r) => { expect(f[r + ',2']).toBeDefined(); expect(f[r + ',3']).toBeDefined(); expect(f[r + ',4']).toBe(f[r + ',2']); expect(f[r + ',5']).toBe(f[r + ',3']); });
    expect(f['3,2']).toBeUndefined(); // dòng B không bị đụng
    expect(mocks.getApiCounter_().calls.setNumberFormat).toBe(4); // chỉ còn 4 lệnh cho khối dòng MỚI
  });
});
