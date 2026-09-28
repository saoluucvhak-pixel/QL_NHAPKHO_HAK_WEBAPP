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
