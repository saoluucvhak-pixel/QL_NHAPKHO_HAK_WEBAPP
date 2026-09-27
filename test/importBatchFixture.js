'use strict';
// Kịch bản re-import dùng chung cho test tương đương (trước/sau khi gộp lệnh ghi).
const PHIEUCAN_ID = '1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g';
const BAOGIA_ID = '1SIhfjP5-6ouRPDj265lAMmI5yWs1XcnedjqpzDwaIC0';

function dong(ma, trangThai, extra) {
  const r = new Array(25).fill('');
  r[0] = 'SP-' + ma; r[1] = new Date(2026, 0, 2); r[2] = new Date(1899, 11, 30, 8, 0); r[5] = 'XE-CU';
  r[6] = 'G-' + ma; r[7] = 1; r[8] = 2; r[9] = 3; r[10] = 'K'; r[11] = 'KH CU'; r[12] = 'GK'; r[13] = 'DLC'; r[14] = 'NGC';
  r[15] = 'Y'; r[16] = 'DLC_NGC_Y'; r[17] = 7; r[18] = new Date(2026, 0, 3); r[19] = 11; r[20] = 'U-' + ma;
  r[21] = ma; r[22] = ma; r[23] = 13; r[24] = trangThai;
  return Object.assign(r, extra || {});
}

function chayKichBan(env) {
  env.spreadsheetApp.openById(PHIEUCAN_ID).__setSheet('PhieuCan_DN', [
    new Array(25).fill('H'),
    dong('CT1', ''), dong('CT2', 'OK'), dong('CT3', 'Lỗi ĐK/Báo giá'), dong('CT4', 'Test giá'), dong('CT5', 'OK'), dong('CT6', ''),
  ]);
  env.spreadsheetApp.openById(BAOGIA_ID).__setSheet('Baogia_DN_SAVE', [['TS', 'Từ', 'Đến', 'Mã ĐG', 'Min', 'Max', 'Giá'],
    [new Date(), new Date(2000, 0, 1), new Date(2100, 0, 1), 'DLM_NGM_Y', 0, 1000, 500000]]);
  const iso = (d, h) => new Date(2026, 5, d, h, 15, 0).toISOString();
  const item = (ma, i) => ({ isError: false, soPhieu: 'SP-' + ma, soXe: 'XE-' + i, uniqueKey: ma, khGoc: 'KH ' + i, dlGoc: 'dlm', ngGoc: 'ngm',
    klCan1: 30000 + i, klCan2: 10000 + i, klHangGoc: 20000, rawDateC: iso(10 + i, 8), rawDateD: iso(10 + i, 9) });
  const res = env.call('step1_ConfirmImport', [item('CT1', 1), item('CT2', 2), item('CT3', 3), item('CT4', 4), item('CT6', 6), item('CT9', 9)], false);
  const sheet = env.spreadsheetApp.openById(PHIEUCAN_ID).getSheetByName('PhieuCan_DN');
  const chuan = (v, c) => (c === 18 && v && typeof v.getTime === 'function' ? 'NOW' : (v && v.toISOString ? v.toISOString() : v));
  return {
    message: res.message,
    data: sheet.__data.map((row) => row.map((v, c) => (row === sheet.__data[0] ? v : chuan(v, c)))),
    formats: sheet.__formats,
  };
}

module.exports = { chayKichBan };
