// TABLE-01: sheet dữ liệu đã chuyển thành "Bảng" (Insert > Table) có cột gán kiểu ->
// Google chặn đặt định dạng số ("You can't set the number format of cells in a typed
// column"). Định dạng chỉ để hiển thị: bỏ qua đúng lỗi này, dữ liệu vẫn ghi đủ.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { taoMoiTruong } = require('./gasEnv');

const LOI_COT_CO_KIEU = "Exception: You can't set the number format of cells in a typed column.";

// Sheet giả có thể là "Bảng có kiểu cột": mọi lệnh đặt định dạng số đều báo lỗi như Google.
function sheetGia(dong, laBang) {
  const sh = { rows: dong, soLanDinhDang: 0 };
  const dinhDang = function () { sh.soLanDinhDang++; if (laBang) throw new Error(LOI_COT_CO_KIEU); return this; };
  const vung = (r, c, nr, nc) => {
    const g = {
      getValues: () => sh.rows.slice(r - 1, r - 1 + nr).map((x) => x.slice(c - 1, c - 1 + nc)),
      setValues(vs) { vs.forEach((row, i) => row.forEach((v, j) => { while (sh.rows.length < r + i) sh.rows.push([]); sh.rows[r - 1 + i][c - 1 + j] = v; })); return g; },
      clearContent() { for (let i = r - 1; i < r - 1 + nr && i < sh.rows.length; i++) for (let j = c - 1; j < c - 1 + nc; j++) sh.rows[i][j] = ''; return g; },
      setNumberFormat: dinhDang, setHorizontalAlignment() { return g; }
    };
    return g;
  };
  sh.getDataRange = () => ({ getValues: () => sh.rows.map((x) => x.slice()) });
  sh.getLastRow = () => sh.rows.filter((x) => x.some((v) => v !== '' && v !== undefined)).length;
  sh.getRange = (a, c, nr, nc) => (typeof a === 'string' ? vung(2, 1, 1, 1) : vung(a, c, nr || 1, nc || 1));
  sh.getRangeList = () => { const g = { setNumberFormat: dinhDang, setHorizontalAlignment() { return g; } }; return g; };
  return sh;
}

test('TABLE-01: dinhDangAnToan_ bỏ qua đúng lỗi "typed column", lỗi khác vẫn báo', () => {
  const { chay } = taoMoiTruong();
  assert.doesNotThrow(() => chay(`dinhDangAnToan_(function () { throw new Error(${JSON.stringify(LOI_COT_CO_KIEU)}); })`));
  assert.throws(() => chay('dinhDangAnToan_(function () { throw new Error("Service Spreadsheets timed out"); })'), /timed out/);
  assert.strictEqual(chay('var x = 0; dinhDangAnToan_(function () { x = 5; }); x'), 5);
});

test('TABLE-01: "Xem toàn bộ lịch sử" - Baogia_DN_SAVE là Bảng có kiểu cột: vẫn ghi đủ lịch sử, không báo lỗi', () => {
  const { ctx, chay } = taoMoiTruong();
  // Ngày phải tạo TRONG môi trường Apps Script giả lập (instanceof Date đúng như chạy thật).
  const src = sheetGia(chay(`[
    ['TS', 'Hiệu lực', 'Mã', 'KL', 'Giá', 'Email', 'ID', 'Số BG'],
    [new Date(2026, 0, 1), new Date(2026, 0, 1), 'DL1_NG1_Y , DL2_NG2_Y', '0_1000', 1000, 'a', 'ID1', 'BG1'],
    [new Date(2026, 8, 1), new Date(2026, 8, 1), 'DL1_NG1_Y', '0_1000', 1200, 'a', 'ID2', 'BG2']]`), false);
  const ma = sheetGia([new Array(7).fill('H'), ['s', 'DL1_NG1_Y', 'DL1', 'NG1', 'Y', 'Diễn giải 1', '']], false);
  const save = sheetGia([new Array(14).fill('H'), new Array(14).fill('cũ'), new Array(14).fill('cũ'), new Array(14).fill('cũ'), new Array(14).fill('cũ')], true);
  ctx.__sheets = { Baogia_DN: src, Ma_BaoGia: ma, Baogia_DN_SAVE: save };
  chay('BG_ss_ = function () { return { getSheetByName: function (t) { return __sheets[t]; } }; };');
  let kq;
  assert.doesNotThrow(() => { kq = chay('BG_lamMoiSave_().finalRows.length'); });
  assert.strictEqual(kq, 3); // 2 mã của BG1 + 1 mã của BG2
  assert.ok(save.soLanDinhDang > 0, 'đã thử đặt định dạng (và bị Bảng chặn)');
  const conLai = save.rows.slice(1).filter((r) => r.some((v) => v !== ''));
  assert.strictEqual(conLai.length, 3); // dòng "cũ" thừa đã được xóa
  assert.deepStrictEqual(conLai.map((r) => [r[3], r[6]]).sort(), [['DL1_NG1_Y', 1000], ['DL1_NG1_Y', 1200], ['DL2_NG2_Y', 1000]]);
});

test('TABLE-01: mọi lệnh đặt định dạng số trên sheet dữ liệu thật đều đi qua dinhDangAnToan_', () => {
  // Được phép KHÔNG bọc: file xuất mới tạo (SpreadsheetApp.create) - không thể là Bảng.
  const FILE_XUAT_TAM = ['downloadMisaExcel_', 'XK_apDinhDangCot_', 'XK_ghiBang_', 'exportBaoCaoMisaExcel_', 'exportBaoCaoMisaPDF_',
    'exportPhieuCanPDF_', 'taoFileMau_', 'XH_exportBaoCaoXuatMisaExcel_'];
  const dong = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8').split('\n');
  let ham = '';
  const sai = [];
  dong.forEach((s, i) => {
    const m = s.match(/^function ([A-Za-z0-9_$]+)\s*\(/); if (m) ham = m[1];
    if (!s.includes('.setNumberFormat(') || /^\s*\/\//.test(s)) return;
    if (s.includes('dinhDangAnToan_(') || FILE_XUAT_TAM.includes(ham)) return;
    sai.push((i + 1) + ' ' + ham + ': ' + s.trim());
  });
  assert.deepStrictEqual(sai, []);
});
