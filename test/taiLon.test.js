// Kiểm thử TẢI LỚN (mục XIII.1 báo cáo kiểm toán): đảm bảo các đoạn xử lý nóng không
// chậm dần theo bình phương khi dữ liệu lớn. Ngưỡng thời gian đặt rộng (máy CI chậm).
const test = require('node:test');
const assert = require('node:assert');
const { taoMoiTruong } = require('./gasEnv');

test('Tải lớn: tính giá 50.000 phiếu × 3.000 dòng báo giá < 5 giây, chọn đúng báo giá mới nhất', () => {
  const { chay } = taoMoiTruong();
  const kq = JSON.parse(chay(`(function () {
    var bg = [];
    for (var m = 0; m < 1000; m++) {
      var ma = "MA" + m;
      // 3 dòng / mã: dải cũ, dải mới chồng lên (mới nhất thắng), dải KL khác
      bg.push({ start: new Date(2026,0,1).getTime(), end: new Date(2027,0,1).getTime(), keyQ: ma, minKl: 0, maxKl: 100, price: 1000 });
      bg.push({ start: new Date(2026,5,1).getTime(), end: new Date(2027,0,1).getTime(), keyQ: ma, minKl: 0, maxKl: 100, price: 2000 });
      bg.push({ start: new Date(2026,0,1).getTime(), end: new Date(2027,0,1).getTime(), keyQ: ma, minKl: 100, maxKl: 999, price: 500 });
    }
    var t0 = Date.now(), tong = 0, soGia2000 = 0;
    for (var i = 0; i < 50000; i++) {
      var r = new Array(26).fill("");
      r[1] = new Date(2026, 7, 1 + (i % 28)); r[2] = "08:30"; r[9] = 20000; r[16] = "MA" + (i % 1000); r[17] = 0;
      var g = TG_tinhGiaDong_(r, bg);
      tong += g.thanhTien; if (g.gia === 2000) soGia2000++;
    }
    return JSON.stringify({ ms: Date.now() - t0, soGia2000: soGia2000, tong: tong });
  })()`));
  assert.strictEqual(kq.soGia2000, 50000);
  assert.strictEqual(kq.tong, 50000 * 40000);
  assert.ok(kq.ms < 5000, 'chạy ' + kq.ms + ' ms');
});

test('Tải lớn: báo cáo 100.000 dòng cắt còn 10.000 dòng mới nhất < 3 giây', () => {
  const { chay } = taoMoiTruong();
  const kq = JSON.parse(chay(`(function () {
    var data = [];
    for (var i = 0; i < 100000; i++) {
      var d = new Date(2026, 0, 1 + Math.floor(i / 400));
      data.push({ ngayCan1: Utilities.formatDate(d, "", "dd/MM/yyyy"), stt: i });
    }
    var t0 = Date.now();
    var res = BC_gioiHanDongWeb_({ status: "success", data: data }, "ngayCan1");
    return JSON.stringify({ ms: Date.now() - t0, n: res.data.length, tong: res.tongSoDong, dau: res.data[0].stt, cuoi: res.data[res.data.length - 1].stt });
  })()`));
  assert.strictEqual(kq.n, 10000);
  assert.strictEqual(kq.tong, 100000);
  assert.strictEqual(kq.dau, 90000);   // giữ đúng thứ tự gốc
  assert.strictEqual(kq.cuoi, 99999);
  assert.ok(kq.ms < 3000, 'chạy ' + kq.ms + ' ms');
});

test('Giám sát hiệu năng: API chậm ≥ 30 giây ghi Nhật ký API_CHAM (trừ sao lưu)', () => {
  const { chay, ctx } = taoMoiTruong();
  const log = [];
  ctx.logAudit_ = (a, s, m) => log.push([a, s, m]);
  assert.strictEqual(chay('ghiNhanApiCham_("getBaoCaoTongHop", 2500)'), false);
  assert.strictEqual(chay('ghiNhanApiCham_("getBaoCaoTongHop", 31250)'), true);
  assert.strictEqual(chay('ghiNhanApiCham_("HT_saoLuuNgay", 120000)'), false);
  assert.deepStrictEqual(log, [['API_CHAM', 'WARNING', 'getBaoCaoTongHop chạy 31.3 giây (ngưỡng 30 giây)']]);
});

test('Tải lớn: sắp xếp 100.000 mã chứng từ theo số (9 trước 10) < 3 giây', () => {
  const { chay } = taoMoiTruong();
  const kq = JSON.parse(chay(`(function () {
    var ds = [];
    for (var i = 0; i < 100000; i++) ds.push({ maChungTu: ((i * 7919) % 100000) + "/2026/NK" });
    var t0 = Date.now();
    ds.sort(function (a, b) { return soSanhMaChungTu_(a.maChungTu, b.maChungTu); });
    return JSON.stringify({ ms: Date.now() - t0, dau: ds.slice(0, 3).map(function (x) { return x.maChungTu; }), n: ds.length });
  })()`));
  assert.deepStrictEqual(kq.dau, ['0/2026/NK', '1/2026/NK', '2/2026/NK']);
  assert.strictEqual(chay('soSanhMaChungTu_("9/2026/NK", "10/2026/NK")') < 0, true);
  assert.strictEqual(chay('soSanhMaChungTu_("", "1/2026/NK")') < 0, true);
  assert.ok(kq.ms < 3000, 'sắp xếp ' + kq.ms + ' ms');
});

test('Gợi ý tính lại giá sau khi lưu báo giá: chỉ đọc 6 cột, đúng phiếu (chưa OK, đúng mã, từ ngày hiệu lực)', () => {
  const { taoSheet } = require('./gasEnv');
  const doc = [];
  const { chay, ctx } = taoMoiTruong({ SpreadsheetApp: { openById: () => ({ getSheetByName: () => ctx.pc }) } });
  chay(`function dong(ngay, ma, maCT, tt) { var r = new Array(27).fill(""); r[1] = ngay; r[16] = ma; r[21] = maCT; r[24] = tt; return r; }
        __rows = [new Array(27).fill("h"),
          dong(new Date(2026,8,1), "QS01", "1/2026/NK", "Test giá"),
          dong(new Date(2026,8,2), "QS01", "2/2026/NK", "Lỗi ĐK/Báo giá"),
          dong(new Date(2026,8,3), "QS01", "3/2026/NK", "OK"),
          dong(new Date(2026,7,1), "QS01", "4/2026/NK", "Test giá"),
          dong(new Date(2026,8,4), "QS02", "5/2026/NK", "Test giá")];`);
  ctx.pc = taoSheet(ctx.__rows);
  const goc = ctx.pc.getRange;
  ctx.pc.getRange = function (r, c, nr, nc) { doc.push(nc || 1); return goc.call(this, r, c, nr, nc); };
  const kq = JSON.parse(chay('JSON.stringify(BG_phieuChoTinhLai_(["QS01"], new Date(2026,8,1,15,0)))'));
  assert.deepStrictEqual(kq.dsMaCT, ['1/2026/NK', '2/2026/NK']);
  assert.strictEqual(kq.soLoiBaoGia, 1);
  assert.strictEqual(doc.reduce((a, b) => a + b, 0), 6);
});

test('Draft Chưa TT: ghi đè phiếu đã có theo KHỐI dòng liền nhau, bản sau thắng, phiếu mới thêm cuối', () => {
  const { taoSheet } = require('./gasEnv');
  const { chay, ctx } = taoMoiTruong({ SpreadsheetApp: { openById: () => ({ getSheetByName: () => ctx.draft }) } });
  const dong = (ma, gt) => { const r = new Array(23).fill(''); r[0] = gt; r[21] = ma; return r; };
  ctx.draft = taoSheet([new Array(23).fill('h'), dong('A', 'a'), dong('B', 'b'), dong('C', 'c'), dong('D', 'd')]);
  let soLanGhi = 0;
  const goc = ctx.draft.getRange;
  ctx.draft.getRange = function (r, c, nr, nc) {
    const g = goc.call(this, r, c, nr, nc); const sv = g.setValues;
    g.setValues = function (v) { soLanGhi++; if (r > ctx.draft.rows.length) { v.forEach(x => ctx.draft.rows.push(x.slice())); return g; } return sv.call(g, v); };
    return g;
  };
  ctx.logAudit_ = () => {};
  ctx.__moi = [dong('B', 'b1'), dong('C', 'c1'), dong('X', 'x'), dong('D', 'd1'), dong('B', 'b2')];
  chay('ghiVaoDraftChuaTT_(__moi)');
  assert.deepStrictEqual(ctx.draft.rows.slice(1).map(r => r[21] + '=' + String(r[0]).replace(/^'/, '')), ['A=a', 'B=b2', 'C=c1', 'D=d1', 'X=x']);
  assert.strictEqual(soLanGhi, 2, '1 khối ghi đè (dòng 3-5) + 1 lần thêm mới');
});
