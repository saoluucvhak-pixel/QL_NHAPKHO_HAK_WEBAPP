'use strict';
// Sinh dữ liệu lớn cho test hiệu năng/tải: phiếu cân rải đều trong sheet đang
// hoạt động (năm nay) + các sheet lưu trữ theo năm (PhieuCan_DN_<năm>).
const mocks = require('./gasMocks');

const PHIEUCAN_ID = '1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g';
const BAOGIA_ID = '1SIhfjP5-6ouRPDj265lAMmI5yWs1XcnedjqpzDwaIC0';

function taoPhieu_(i, ngay, trangThai) {
  const row = new Array(27).fill('');
  row[0] = 'SP-' + i; row[1] = ngay; row[2] = ngay; row[5] = 'XE-' + (i % 300);
  row[7] = 30000; row[8] = 10000; row[9] = 20000; row[11] = 'KH ' + (i % 200);
  row[13] = 'DL' + (i % 20); row[14] = 'NG' + (i % 10); row[16] = 'DL' + (i % 20) + '_NG' + (i % 10) + '_Y';
  row[19] = 1000000; row[21] = 'CT' + String(i).padStart(7, '0'); row[22] = row[21];
  row[23] = 1000000; row[24] = trangThai; row[25] = 20000000; row[26] = i % 3 === 0 ? '' : 'Đóng TT';
  return row;
}

// soDongNong: số dòng sheet đang hoạt động (rải trong tháng hiện tại, phần lớn đã OK)
// soDongMoiNamLuuTru: số dòng mỗi năm lưu trữ; soNamLuuTru: số năm cũ đã chốt sổ
function napDuLieuLon(env, opts) {
  const ss = env.spreadsheetApp.openById(PHIEUCAN_ID);
  const now = new Date();
  const header = new Array(27).fill('H');
  const nong = [];
  for (let i = 0; i < opts.soDongNong; i++) {
    const ngay = new Date(now.getFullYear(), now.getMonth(), 1 + (i % Math.max(1, now.getDate())), 12, 0, 0);
    const chuaChot = opts.tiLeChuaChot ? (i % Math.round(1 / opts.tiLeChuaChot) === 0) : false;
    nong.push(taoPhieu_(i, ngay, chuaChot ? 'Test giá' : 'OK'));
  }
  ss.__setSheet('PhieuCan_DN', [header, ...nong]);
  const bands = [];
  for (let d = 0; d < 20; d++) for (let g = 0; g < 10; g++) {
    bands.push([now, new Date(2000, 0, 1), new Date(2100, 0, 1), 'DL' + d + '_NG' + g + '_Y', 0, 1000, 1000000]);
  }
  env.spreadsheetApp.openById(BAOGIA_ID).__setSheet('Baogia_DN_SAVE', [['TS', 'Từ', 'Đến', 'Mã ĐG', 'Min', 'Max', 'Giá'], ...bands]);
  for (let k = 1; k <= (opts.soNamLuuTru || 0); k++) {
    const nam = now.getFullYear() - k;
    const rows = [];
    for (let i = 0; i < opts.soDongMoiNamLuuTru; i++) {
      rows.push(taoPhieu_(1e6 * k + i, new Date(nam, i % 12, 1 + (i % 28), 12, 0, 0), 'OK'));
    }
    ss.__setSheet('PhieuCan_DN_' + nam, [header, ...rows]);
  }
  return ss;
}

// Đo 1 lần gọi hàm server: số lời gọi Sheets API, số ô đọc/ghi, kích thước dữ
// liệu trả về client (google.script.run có giới hạn payload và trình duyệt phải
// parse/vẽ toàn bộ) và thời gian CPU phía Node (chỉ tham khảo tương đối).
function doLuong(env, fnName, ...args) {
  mocks.resetApiCounter_();
  const t0 = process.hrtime.bigint();
  const res = env.call(fnName, ...args);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const dem = mocks.getApiCounter_();
  const payload = JSON.stringify(res).length;
  return { res, ms, payload, ...dem };
}

module.exports = { napDuLieuLon, doLuong, taoPhieu_, PHIEUCAN_ID };
