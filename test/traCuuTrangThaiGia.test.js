// Tra cứu phiếu cân nhập: bộ lọc "Trạng thái giá" (cột Y) - dùng chung cho tìm kiếm
// và "Tính lại giá theo bộ lọc".
const test = require('node:test');
const assert = require('node:assert');
const { taoMoiTruong, taoSheet } = require('./gasEnv');

// 6 phiếu, mỗi trạng thái giá 1-2 phiếu; tạo TRONG môi trường giả lập (instanceof Date).
function moiTruong() {
  const { ctx, chay } = taoMoiTruong();
  const rows = chay(`(function () {
    function p(so, y) { var r = new Array(27).fill(''); r[0] = so; r[1] = new Date(2026, 8, 10); r[2] = new Date(1899, 11, 30, 8, 0, 0);
      r[5] = 'XE'; r[9] = 20000; r[11] = 'KH'; r[16] = 'DL1_NG1_Y'; r[21] = so + '/2026/NK'; r[24] = y; r[25] = 0; return r; }
    return [new Array(27).fill('H'), p('1', 'OK'), p('2', 'Test giá'), p('3', 'Lỗi ĐK/Báo giá'), p('4', ''), p('5', 'Test giá'), p('6', 'OK')];
  })()`);
  const sh = taoSheet(rows);
  sh.getName = () => 'PhieuCan_DN';
  ctx.__sh = sh;
  chay(`SpreadsheetApp = { openById: function () { return { getSheetByName: function (t) { return t === 'PhieuCan_DN' ? __sh : null; }, getSheets: function () { return [__sh]; } }; } };`);
  return { ctx, chay };
}
const soPhieu = (chay, ttg) => JSON.parse(chay(`JSON.stringify(TC_traCuuPhieuNhap_({ trangThaiGia: ${JSON.stringify(ttg)} }).data.map(function (r) { return r.soPhieu; }).sort())`));

test('Trạng thái giá: mỗi lựa chọn trả đúng các phiếu', () => {
  const { chay } = moiTruong();
  assert.deepStrictEqual(soPhieu(chay, ''), ['1', '2', '3', '4', '5', '6']);
  assert.deepStrictEqual(soPhieu(chay, 'CHUA_OK'), ['2', '3', '4', '5']);
  assert.deepStrictEqual(soPhieu(chay, 'OK'), ['1', '6']);
  assert.deepStrictEqual(soPhieu(chay, 'TEST'), ['2', '5']);
  assert.deepStrictEqual(soPhieu(chay, 'LOI'), ['3']);
  assert.deepStrictEqual(soPhieu(chay, 'TRONG'), ['4']);
  assert.deepStrictEqual(soPhieu(chay, 'KHONG_CO'), ['1', '2', '3', '4', '5', '6']); // mã lạ = tất cả
});

test('Trạng thái giá: tổng số phiếu / số phiếu sửa được tính theo đúng lựa chọn', () => {
  const { chay } = moiTruong();
  const kq = JSON.parse(chay('JSON.stringify(TC_traCuuPhieuNhap_({ trangThaiGia: "TEST" }))'));
  assert.strictEqual(kq.tongSoDong, 2);
  assert.strictEqual(kq.summary.soLuong, 2);
  assert.strictEqual(kq.soChuaChot, 2);
  assert.strictEqual(JSON.parse(chay('JSON.stringify(TC_traCuuPhieuNhap_({ trangThaiGia: "OK" }))')).soChuaChot, 0);
});

test('Trạng thái giá: kết hợp được với từ khóa; "Tính lại giá theo bộ lọc" chọn đúng tập phiếu', () => {
  const { chay } = moiTruong();
  assert.deepStrictEqual(soPhieu(chay, 'CHUA_OK').length, 4);
  chay(`var __dsChon = [];
        runCalculatePrice_core_ = function (chon) { __sh.rows.slice(1).forEach(function (r) { if (String(r[24]).trim() !== 'OK' && chon(r)) __dsChon.push(r[0]); }); return { status: 'success', soPhieu: 0 }; };
        TC_chayCoKhoa_ = function (viec) { return viec(); };`);
  chay('TC_tinhLaiGiaTheoBoLoc_({ trangThaiGia: "LOI" })');
  assert.deepStrictEqual(JSON.parse(chay('JSON.stringify(__dsChon)')), ['3']);
  chay('__dsChon = []; TC_tinhLaiGiaTheoBoLoc_({ trangThaiGia: "TEST", tuKhoa: "5/2026" })');
  assert.deepStrictEqual(JSON.parse(chay('JSON.stringify(__dsChon)')), ['5']);
});
