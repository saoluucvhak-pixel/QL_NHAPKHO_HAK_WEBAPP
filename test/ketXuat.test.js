// Kiểm tra TẤT CẢ chức năng kết xuất Excel/PDF: file tạm có đủ tiêu đề + mọi dòng dữ liệu,
// số đúng giá trị, ngày là giá trị ngày thật, mã giữ dạng chữ, định dạng hợp lệ, và
// luôn ép ghi (flush) trước khi máy chủ tải file về (lỗi "file trống trơn").
const test = require('node:test');
const assert = require('node:assert');
const { taoMoiTruong } = require('./gasEnv');

function moiTruongXuat() {
  const nhatKy = [];
  const files = [];
  // Range/Sheet giả: nhận MỌI lệnh định dạng (Proxy), ghi lại giá trị + định dạng số.
  function taoSheet() {
    const sh = { o: {}, fmt: {} };
    const range = (r, c, nr, nc) => {
      if (typeof r === 'string') { const m = r.match(/^([A-Z]+)(\d+)/); r = m ? +m[2] : 1; c = 1; }
      nr = nr || 1; nc = nc || 1;
      const g = new Proxy({}, { get(t, p) {
        if (p === 'setValues') return vs => { nhatKy.push('ghi'); vs.forEach((row, i) => row.forEach((v, j) => { sh.o[(r + i) + ',' + (c + j)] = v; })); return g; };
        if (p === 'setValue') return v => { nhatKy.push('ghi'); sh.o[r + ',' + c] = v; return g; };
        if (p === 'setNumberFormat') return f => { if (typeof f !== 'string' || !f) throw new Error('Định dạng số không hợp lệ: ' + f); for (let j = 0; j < nc; j++) sh.fmt[r + ',' + (c + j)] = f; return g; };
        return () => g;
      } });
      return g;
    };
    return new Proxy(sh, { get(t, p) {
      if (p in t) return t[p];
      if (p === 'getRange') return range;
      if (p === 'getRangeList') return list => { const g = new Proxy({}, { get(x, q) {
        if (q === 'setNumberFormat') return f => { if (typeof f !== 'string' || !f) throw new Error('Định dạng số không hợp lệ: ' + f); list.forEach(a1 => { const m = a1.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/); if (!m) return; const cot = m[1].split('').reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0); for (let i = +m[2]; i <= +m[4]; i++) sh.fmt[i + ',' + cot] = f; }); return g; };
        return () => g; } }); return g; };
      if (p === 'getSheetId') return () => 0;
      return () => undefined;
    } });
  }
  const { chay, ctx } = taoMoiTruong({
    SpreadsheetApp: {
      create: ten => { const sh = taoSheet(); const ss = { ten, sh, getId: () => 'TAM' + files.length, getSheets: () => [sh], setSpreadsheetLocale() {}, setSpreadsheetTimeZone() {} }; files.push(ss); return ss; },
      openById: () => { throw new Error('không dùng'); },
      flush: () => nhatKy.push('flush')
    },
    DriveApp: {
      getFileById: () => ({ moveTo() {}, getName: () => 'BaoCao_x', getMimeType: () => 'sheets', getParents: () => ({ hasNext: () => false }), setTrashed() {} }),
      getFolderById: () => ({})
    },
    MimeType: { GOOGLE_SHEETS: 'sheets' },
    ScriptApp: { getOAuthToken: () => 't' },
    UrlFetchApp: { fetch: () => { nhatKy.push('tai'); return { getResponseCode: () => 200, getBlob: () => ({ getBytes: () => [1] }) }; } }
  });
  ctx.Utilities.base64Encode = () => 'AQ==';
  ctx.logAudit_ = () => {};
  return { chay, ctx, nhatKy, files };
}

// Dữ liệu mẫu cho từng báo cáo (giống đúng dạng các hàm báo cáo trả về).
const PHIEU = { maChungTu: '0123/2026/NK', soPhieu: '0123', ngayCan1: '05/09/2026', gioCan1: '07:30:15', ngayCan2: '05/09/2026', gioCan2: '08:10:00',
  soXe: '92C-08727', soXe2: '', khachHang: 'Nguyễn Văn A', daiLy: 'ĐL1', nguonGoc: 'Quế Sơn', maDonGia: 'QS01', maKL: 'KL1',
  klCan1: 30000, klCan2: 10000, klHang: 20000, donGia: 1500000, thanhTien: 30000000, giaGoc: 1450000, dieuChinh: 50000, donGiaApDung: 1500000,
  dienGiai: '=SUM(A1)', trangThaiGia: 'Test giá', trangThaiThanhToan: 'Chưa lập ĐNTT' };

const CA = [
  { ten: 'Tổng hợp cân - Excel', ham: 'exportBaoCaoTongHopExcel_', nguon: 'getBaoCaoTongHop_', kq: { status: 'success', data: [PHIEU, PHIEU] } },
  { ten: 'Tổng hợp cân - PDF', ham: 'exportBaoCaoTongHopPDF_', nguon: 'getBaoCaoTongHop_', kq: { status: 'success', data: [PHIEU] } },
  { ten: 'Theo báo giá - Excel', ham: 'exportBaoCaoDonGiaExcel_', nguon: 'getBaoCaoDonGia_', kq: { status: 'success', data: [PHIEU, PHIEU, PHIEU] } },
  { ten: 'Theo báo giá - PDF', ham: 'exportBaoCaoDonGiaPDF_', nguon: 'getBaoCaoDonGia_', kq: { status: 'success', data: [PHIEU] } },
  { ten: 'Báo cáo Misa - Excel', ham: 'exportBaoCaoMisaExcel_', nguon: 'getBaoCaoMisa_', kq: { status: 'success', data: [{ maChungTu: '0123/2026/NK', ngay: '05/09/2026', ngayRaw: '2026-09-05T00:00:00.000Z', soXe: '92C', khoiLuong: 20.5, donGia: 1500000, thanhTien: 30750000, tenNCC: 'NCC A', trangThaiThanhToan: 'Chưa lập ĐNTT' }] } },
  { ten: 'Báo cáo Misa - PDF', ham: 'exportBaoCaoMisaPDF_', nguon: 'getBaoCaoMisa_', kq: { status: 'success', data: [{ maChungTu: '1/2026/NK', ngay: '05/09/2026', ngayRaw: '2026-09-05T00:00:00.000Z', soXe: '92C', khoiLuong: 1, donGia: 2, thanhTien: 2, tenNCC: 'B', trangThaiThanhToan: 'Đã lập ĐNTT' }] } },
  { ten: 'Xuất qua cân - Excel', ham: 'XH_exportBaoCaoXuatQuaCanExcel_', nguon: 'XH_locBaoCaoXuatQuaCan_', kq: { matched: [{ soPhieu: '01', ngayGioCan1: '22/01/2026 07:36:52', bienSo: '92C', klHang: 21920, khoiLuongTan: 21.92, donViVanChuyen: 'HHH', tenTaiXe: 'Tâm', soTKHQ: '306123', khoXuat: 'Tiên Sa', khoNhap: 'XB' }] } },
  { ten: 'Xuất qua cân - PDF', ham: 'XH_exportBaoCaoXuatQuaCanPDF_', nguon: 'XH_locBaoCaoXuatQuaCan_', kq: { matched: [{ soPhieu: '02', ngayGioCan1: '22/01/2026 07:36:52', bienSo: '92C', klHang: 1000, khoiLuongTan: 1, donViVanChuyen: 'HHH', tenTaiXe: 'Tâm', soTKHQ: '', khoXuat: 'A', khoNhap: 'B' }] } },
  { ten: 'Xuất bán Misa - Excel', ham: 'XH_exportBaoCaoXuatMisaExcel_', nguon: 'XH_locBaoCaoXuatMisa_', kq: [{ ngayRaw: '2026-09-05T00:00:00.000Z', soTKHQ: '306123', tau: 'MCQUEEN', khachHang: 'KH', tenHangHoa: 'Dăm', donGiaUSD: 150.5, klMT: 10000.25, klBDMT: 5000.5, thanhTienUSD: 752575.25, khoXuat: 'Tiên Sa' }] },
  { ten: 'Nhật ký hoạt động - Excel', ham: 'HT_xuatNhatKyExcel_', nguon: 'NK_loc_', kq: 'NHAT_KY' }
];

for (const ca of CA) {
  test('Kết xuất ' + ca.ten + ': đủ tiêu đề + dữ liệu, định dạng hợp lệ, flush trước khi tải', () => {
    const { chay, ctx, nhatKy, files } = moiTruongXuat();
    ctx.__kq = ca.kq;
    if (ca.kq === 'NHAT_KY') chay(`__kq = { dong: [{ t: new Date(2026,8,5,8,30), hanhDong: "DANG_NHAP", trangThai: "OK", noiDung: "=1+1", email: "a@x" }] }`);
    chay(`${ca.nguon} = function () { return __kq; }`);
    const kq = chay(`chuyenLinkXuatThanhFile_(${ca.ham}({}))`);
    assert.strictEqual(kq.status, 'success', kq.message);
    assert.ok(kq.fileBase64, 'phải tải được file');
    assert.strictEqual(files.length, 1);
    const o = files[0].sh.o;
    const soCot = Object.keys(o).filter(k => k.startsWith('1,')).length;
    assert.ok(soCot >= 5, 'có dòng tiêu đề');
    const soDongDuLieu = Array.isArray(ca.kq) ? ca.kq.length : ca.kq === 'NHAT_KY' ? 1 : (ca.kq.data || ca.kq.matched).length;
    for (let i = 2; i <= soDongDuLieu + 1; i++) {
      for (let c = 1; c <= soCot; c++) assert.ok((i + ',' + c) in o, `thiếu ô dòng ${i} cột ${c}`);
    }
    assert.ok(!((soDongDuLieu + 2) + ',1' in o), 'không ghi thừa dòng');
    // Không có ô dữ liệu nào bị hiểu thành công thức
    Object.keys(o).forEach(k => { const v = o[k]; if (typeof v === 'string') assert.ok(!/^[=+\-@]/.test(v), 'ô ' + k + ' là công thức: ' + v); });
    // Cột tiêu đề chứa "Ngày" / "Thời gian": giá trị ngày thật + định dạng ngày
    for (let c = 1; c <= soCot; c++) {
      if (!/^(ngày|thời gian)/i.test(String(o['1,' + c]))) continue;
      assert.strictEqual(Object.prototype.toString.call(o['2,' + c]), '[object Date]', 'cột ' + o['1,' + c] + ' phải là ngày thật');
      assert.ok(/d|y/i.test(files[0].sh.fmt['2,' + c] || ''), 'cột ' + o['1,' + c] + ' phải có định dạng ngày');
    }
    // Mã chứng từ / số phiếu / số TKHQ giữ dạng chữ (không thành số, không mất số 0 đầu)
    for (let c = 1; c <= soCot; c++) {
      if (/^(mã chứng từ|số phiếu|số tkhq)/i.test(String(o['1,' + c]))) assert.strictEqual(files[0].sh.fmt['2,' + c], '@', 'cột ' + o['1,' + c] + ' phải dạng chữ');
    }
    assert.deepStrictEqual(nhatKy.slice(-2), ['flush', 'tai']);
  });
}

test('Kết xuất: không có dữ liệu -> báo lỗi rõ ràng, không tạo file', () => {
  const { chay, files } = moiTruongXuat();
  chay('getBaoCaoTongHop_ = function () { return { status: "success", data: [] }; }');
  const kq = chay('chuyenLinkXuatThanhFile_(exportBaoCaoTongHopExcel_({}))');
  assert.strictEqual(kq.status, 'error');
  assert.strictEqual(files.length, 0);
});

test('Kết xuất Phiếu nhập kho PDF: có số phiếu, khối lượng, thành tiền; flush trước khi tải', () => {
  const { chay, ctx, nhatKy, files } = moiTruongXuat();
  chay(`var dong = new Array(27).fill(""); dong[0] = "0123"; dong[1] = new Date(2026,8,5); dong[2] = new Date(1899,11,30,7,30); dong[3] = new Date(2026,8,5);
        dong[4] = new Date(1899,11,30,8,10); dong[5] = "92C-08727"; dong[9] = 20000; dong[10] = "Quế Sơn"; dong[11] = "Nguyễn Văn A";
        dong[21] = "0123/2026/NK"; dong[23] = 1500; dong[25] = 30000000;
        __nguon = { getLastRow: function () { return 2; }, getRange: function () { return { getValues: function () { return [dong]; } }; } };`);
  ctx.SpreadsheetApp.openById = () => ({ getSheetByName: () => ctx.__nguon });
  const kq = chay('chuyenLinkXuatThanhFile_(exportPhieuCanPDF_("0123/2026/NK"))');
  assert.strictEqual(kq.status, 'success', kq.message);
  assert.ok(kq.fileBase64 && kq.fileName.endsWith('.pdf'));
  const giaTri = Object.values(files[0].sh.o);
  assert.ok(giaTri.includes('0123') && giaTri.includes(20000) && giaTri.includes(30000000), 'thiếu số liệu phiếu');
  assert.deepStrictEqual(nhatKy.slice(-2), ['flush', 'tai']);
});

test('Kết xuất File mẫu import (Phiếu cân + Xuất hàng): có ghi chú, tiêu đề, dòng ví dụ', () => {
  for (const ham of ['taoFileMauPhieuCan_', 'taoFileMauXuatHang_']) {
    const { chay, nhatKy, files } = moiTruongXuat();
    const kq = chay(`chuyenLinkXuatThanhFile_(${ham}())`);
    assert.strictEqual(kq.status, 'success', kq.message);
    const o = files[0].sh.o;
    assert.ok(String(o['1,1']).length > 20, 'ghi chú');
    assert.strictEqual(o['2,2'], 'Số phiếu');
    assert.ok('3,1' in o && '3,5' in o, 'dòng ví dụ');
    assert.deepStrictEqual(nhatKy.slice(-2), ['flush', 'tai']);
  }
});

test('Kết xuất Bảng báo giá: đủ dòng báo giá đã chọn, đơn giá là số, hiệu lực là ngày thật', () => {
  const { chay, ctx, files } = moiTruongXuat();
  chay(`var bg = [["id","B","C","D","E","F","G","H","I","J","K","L","M","N"],
          ["1", new Date(2026,0,1), new Date(2026,11,31), "QS01", 0, 100, 1500000, "", "", "", "", "", "Keo Quế Sơn", "Đang áp dụng"],
          ["2", new Date(2026,0,1), new Date(2026,11,31), "QS02", 0, 100, 1400000, "", "", "", "", "", "Keo Duy Xuyên", "Đang áp dụng"],
          ["3", new Date(2026,0,1), new Date(2026,11,31), "QS03", 0, 100, 1300000, "", "", "", "", "", "Không chọn", "Đang áp dụng"]];
        BG_ss_ = function () { return { getSheetByName: function () { return { getDataRange: function () { return { getValues: function () { return bg; } }; } }; } }; };`);
  const kq = chay('chuyenLinkXuatThanhFile_(BG_exportFileSmart_("2026-09-29", "SAVE", ["1","2"]))');
  assert.strictEqual(kq.status, 'success', kq.message);
  const o = files[0].sh.o;
  assert.strictEqual(o['6,2'], 'MÃ');
  assert.strictEqual(o['7,2'], 'QS01'); assert.strictEqual(o['8,2'], 'QS02'); assert.ok(!('9,2' in o), 'không lấy dòng không chọn');
  assert.strictEqual(o['7,4'], 1500000);
  assert.strictEqual(Object.prototype.toString.call(o['7,5']), '[object Date]');
});
