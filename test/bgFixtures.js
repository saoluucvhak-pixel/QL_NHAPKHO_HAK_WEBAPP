'use strict';
// Dữ liệu Báo giá lớn cho test hiệu năng/đúng đắn module Quản lý báo giá:
// nPhieu phiếu báo giá (QL_BaoGia), mỗi phiếu nNhom nhóm giá (Baogia_DN), mỗi nhóm
// 5 mã (Đại lý_Nguồn gốc_Y), hiệu lực cách nhau ~15 ngày lùi dần về quá khứ.
const BAOGIA_ID = '1SIhfjP5-6ouRPDj265lAMmI5yWs1XcnedjqpzDwaIC0';

function maDG(k) { return 'DL' + (k % 20) + '_NG' + (Math.floor(k / 20) % 10) + '_Y'; }

function napBaoGiaLon(env, opts) {
  opts = opts || {};
  const nPhieu = opts.nPhieu || 40, nNhom = opts.nNhom || 10;
  const ss = env.spreadsheetApp.openById(BAOGIA_ID);
  const now = Date.now();
  const ql = [['Ngày BG', 'Số BG', 'Tạo lúc', 'Hiệu lực', 'ID tạm']];
  const src = [['Timestamp', 'Hiệu lực', 'Mã ĐG', 'KL_Tấn', 'Giá', 'Email', 'ID_BGCT', 'Số BG']];
  for (let p = 0; p < nPhieu; p++) {
    const hieuLuc = new Date(now - (nPhieu - p) * 15 * 86400000);
    const so = 'BG' + String(p).padStart(4, '0');
    ql.push([hieuLuc, so, hieuLuc, hieuLuc, '']);
    for (let g = 0; g < nNhom; g++) {
      const ma = [0, 1, 2, 3, 4].map((x) => maDG((g * 5 + x) % 200)).join(' , ');
      src.push([hieuLuc, hieuLuc, ma, '0_1000', 1000000 + p * 1000 + g, 'a@gmail.com', so + '-' + g, so]);
    }
  }
  const maRows = [['STT', 'Mã BG', 'ĐL', 'NG', 'HA', 'Nội dung', 'ĐL_NG']];
  for (let k = 0; k < 200; k++) maRows.push(['BG26-' + k, maDG(k), 'DL', 'NG', 'Y', 'Diễn giải ' + k, '']);
  ss.__setSheet('QL_BaoGia', ql);
  ss.__setSheet('Baogia_DN', src);
  ss.__setSheet('Ma_BaoGia', maRows);
  ss.__setSheet('Ma_KL', [['TS', 'Mã KL', 'Min', 'Max'], [new Date(), '0_1000', 0, 1000000]]);
  ss.__setSheet('Baogia_DN_FINAL', [new Array(14).fill('H')]);
  ss.__setSheet('Baogia_DN_SAVE', [new Array(14).fill('H')]);
  return ss;
}

module.exports = { napBaoGiaLon, maDG, BAOGIA_ID };
