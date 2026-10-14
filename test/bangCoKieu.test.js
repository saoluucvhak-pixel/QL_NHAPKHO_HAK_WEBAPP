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
// cheDo: false = sheet thường; true = Bảng, lỗi NGAY khi gọi; 'muon' = Bảng, lỗi chỉ bật
// ra khi Google "đẩy" lệnh (SpreadsheetApp.flush / hết lượt chạy) - đúng như chạy thật.
const hangDoiLoi = [];
const spreadsheetAppGia = { flush() { if (hangDoiLoi.length) { hangDoiLoi.length = 0; throw new Error(LOI_COT_CO_KIEU); } }, soLanFlush: 0 };
function sheetGia(dong, laBang, sheetId) {
  const sh = { rows: dong, soLanDinhDang: 0 };
  sh.getSheetId = () => sheetId || 0;
  sh.getParent = () => ({ getId: () => 'FILE_BAO_GIA' });
  const dinhDang = function () {
    sh.soLanDinhDang++;
    if (laBang === 'muon') hangDoiLoi.push(1); else if (laBang) throw new Error(LOI_COT_CO_KIEU);
    return this;
  };
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

function nenBaoGia(cheDoSave, dichVu) {
  const { ctx, chay } = taoMoiTruong(dichVu);
  const src = sheetGia(chay(`[
    ['TS', 'Hiệu lực', 'Mã', 'KL', 'Giá', 'Email', 'ID', 'Số BG'],
    [new Date(2026, 0, 1), new Date(2026, 0, 1), 'DL1_NG1_Y , DL2_NG2_Y', '0_1000', 1000, 'a', 'ID1', 'BG1'],
    [new Date(2026, 8, 1), new Date(2026, 8, 1), 'DL1_NG1_Y', '0_1000', 1200, 'a', 'ID2', 'BG2']]`), false, 1);
  const ma = sheetGia([new Array(7).fill('H'), ['s', 'DL1_NG1_Y', 'DL1', 'NG1', 'Y', 'Diễn giải 1', '']], false, 2);
  const save = sheetGia([new Array(14).fill('H')], cheDoSave, 7);
  ctx.__sheets = { Baogia_DN: src, Ma_BaoGia: ma, Baogia_DN_SAVE: save };
  chay('BG_ss_ = function () { return { getSheetByName: function (t) { return __sheets[t]; } }; };');
  return { chay, save };
}

test('TABLE-01: lỗi chỉ bật ra lúc Google "đẩy" lệnh (như chạy thật) - vẫn bắt được, hết lượt chạy không còn lỗi', () => {
  hangDoiLoi.length = 0;
  const { chay, save } = nenBaoGia('muon', { SpreadsheetApp: spreadsheetAppGia });
  assert.doesNotThrow(() => chay('BG_lamMoiSave_()'));
  assert.ok(save.soLanDinhDang > 0);
  assert.doesNotThrow(() => spreadsheetAppGia.flush(), 'hết lượt chạy (Google đẩy lệnh còn lại) không được báo lỗi nữa');
  assert.strictEqual(save.rows.length, 4); // tiêu đề + 3 dòng lịch sử
});

test('TABLE-01: hỏi được Sheets API -> sheet là Bảng thì không gửi lệnh định dạng nào; sheet thường vẫn định dạng', () => {
  hangDoiLoi.length = 0;
  let soLanHoi = 0;
  const Sheets = { Spreadsheets: { get: (id, opt) => { soLanHoi++; assert.match(opt.fields, /tables/);
    return { sheets: [{ properties: { sheetId: 7 }, tables: [{ tableId: 't1' }] }, { properties: { sheetId: 1 } }, { properties: { sheetId: 2 }, tables: [] }] }; } } };
  const a = nenBaoGia('muon', { SpreadsheetApp: spreadsheetAppGia, Sheets });
  a.chay('BG_lamMoiSave_()');
  assert.strictEqual(a.save.soLanDinhDang, 0, 'Baogia_DN_SAVE là Bảng: bỏ qua định dạng');
  assert.doesNotThrow(() => spreadsheetAppGia.flush());
  const b = nenBaoGia(false, { SpreadsheetApp: spreadsheetAppGia, Sheets: { Spreadsheets: { get: () => ({ sheets: [{ properties: { sheetId: 7 } }] }) } } });
  b.chay('BG_lamMoiSave_()');
  assert.ok(b.save.soLanDinhDang > 0, 'sheet thường: vẫn định dạng như cũ');
  a.chay('BG_lamMoiSave_()');
  assert.strictEqual(soLanHoi, 1, 'chỉ hỏi Sheets API 1 lần cho mỗi file trong 1 lượt chạy');
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
    if (FILE_XUAT_TAM.includes(ham)) return;
    // mỗi lệnh phải nằm trong dinhDangAnToan_(function () { ... }, <sheet>) - kèm sheet để biết có phải Bảng
    const soLenh = (s.match(/\.setNumberFormat\(/g) || []).length;
    const soBoc = (s.match(/dinhDangAnToan_\(function \(\) \{ [^\n]*?; \}, [A-Za-z_$][A-Za-z0-9_$]*\)/g) || []).length;
    if (soBoc < soLenh) sai.push((i + 1) + ' ' + ham + ': ' + s.trim());
  });
  assert.deepStrictEqual(sai, []);
});
