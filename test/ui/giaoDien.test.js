// Kiểm thử giao diện trên Chromium (Playwright). Không có Playwright -> tự bỏ qua.
// Máy có sẵn Chromium: PLAYWRIGHT_BROWSERS_PATH=... npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let chromium = null;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
  try { chromium = require(p).chromium; break; } catch (e) { /* thử đường dẫn khác */ }
}
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'Index.html'), 'utf8');
// Giả lập google.script.run: ghi lại lời gọi API, không trả lời.
const STUB = `<script>window.__goi=[];window.google={script:{history:{replace(){}},run:new Proxy({}, {get(t,p){ const h={withSuccessHandler(){return h;},withFailureHandler(){return h;}, API(...a){ window.__goi.push(a); }}; return p in h ? h[p] : function(){}; }})}};</script>`;
function taoTrang(mien) {
  const f = path.join(os.tmpdir(), 'hak_ui_' + mien + '.html');
  fs.writeFileSync(f, SRC.replace(/<\?!= mienHeThongJson \?>/, JSON.stringify(mien)).replace(/<\?!= [a-zA-Z]+ \?>/g, '""')
    .replace('<head>', '<head>' + STUB).replace(/<link[^>]+fonts[^>]*>/g, ''));
  return 'file://' + f;
}
const GO = `async (id, text) => { const g = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value'); const el = document.getElementById(id); el.focus(); g.set.call(el,'');
  for (const ch of text) { const ev = new KeyboardEvent('keydown',{key:ch,bubbles:true,cancelable:true});
    if (el.dispatchEvent(ev)) { const a = el.selectionStart; const cur = g.get.call(el); g.set.call(el, cur.slice(0,a)+ch+cur.slice(el.selectionEnd)); el.setSelectionRange(a+1,a+1); el.dispatchEvent(new Event('input',{bubbles:true})); } }
  return [g.get.call(el), el.value]; }`;

for (const [mien, mong] of [['VN', { so: '17.990', le: '1.234,5', ngay: '25/07/2026', ngayIso: '25/07/2026 08:30' }], ['US', { so: '17,990', le: '1,234.5', ngay: '07/25/2026', ngayIso: '07/25/2026 08:30' }]]) {
  test('Ô nhập số + ngày theo Locale ' + mien, { skip: !chromium && 'chưa có Playwright' }, async () => {
    const b = await chromium.launch(); const pg = await b.newPage();
    await pg.goto(taoTrang(mien));
    const r = await pg.evaluate(`(async () => { const go = ${GO}; return {
      so: await go('m_klHang', '17990'), le: await go('m_klHang', ${JSON.stringify(mien === 'VN' ? '1234,5' : '1234.5')}),
      ngay: ngayHT('25/07/2026'), ngayIso: ngayHT('2026-07-25 08:30'), canh: getComputedStyle(document.getElementById('m_klHang')).textAlign }; })()`);
    await b.close();
    assert.deepStrictEqual(r.so, [mong.so, '17990']);
    assert.deepStrictEqual(r.le, [mong.le, '1234.5']);
    assert.strictEqual(r.ngay, mong.ngay);
    assert.strictEqual(r.ngayIso, mong.ngayIso);
    assert.strictEqual(r.canh, 'right');
  });
}

test('Xem trước import vẽ theo lô, chọn áp dụng mọi dòng; mã chống trùng', { skip: !chromium && 'chưa có Playwright' }, async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto(taoTrang('VN'));
  const r = await pg.evaluate(async () => {
    state.previewData = Array.from({ length: 1200 }, (_, i) => ({ isError: i === 5, errorMsg: 'x', typeImport: 'Mới', uniqueKey: i + '/2026/NK', soPhieu: String(i), soXe: 'X', ngayCan1: '25/07/2026', gioCan1: '08:00:00', ngayCan2: '25/07/2026', gioCan2: '09:00:00', klCan1: 1, klCan2: 2, klHangGoc: 3 }));
    renderPreview();
    const o = { hang: document.querySelectorAll('#previewBody tr').length };
    const cb = document.querySelector('.preview-row-check[data-idx="3"]'); cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true }));
    const chon = () => state.previewData.filter((r, i) => !r.isError && !state.previewBoChon.has(i)).length;
    o.sauBo1 = chon(); document.getElementById('btnTogglePreviewAll').click(); o.tatCa = chon();
    _baoPhienSanSang('x'); __goi.length = 0;
    runServer('BG_createQuote', { a: 1 }); await new Promise(z => setTimeout(z, 10));
    runServer('BG_createQuote', { a: 1 }); await new Promise(z => setTimeout(z, 10));
    o.ma = __goi.filter(g => g[1] === 'BG_createQuote').map(g => g[3]);
    return o;
  });
  await b.close();
  assert.strictEqual(r.hang, 501);
  assert.strictEqual(r.sauBo1, 1198);
  assert.strictEqual(r.tatCa, 1199);
  assert.ok(r.ma[0] && r.ma[0] === r.ma[1]);
});

test('Điện thoại 375px + bàn phím + nhãn ô nhập', { skip: !chromium && 'chưa có Playwright' }, async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 375, height: 700 } });
  await pg.goto(taoTrang('VN'));
  const r = await pg.evaluate(() => {
    document.getElementById('loginScreen').classList.remove('show');
    const l = Array.from(document.querySelectorAll('label'));
    const m = document.querySelectorAll('.menu-item')[2]; m.focus(); m.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return { nhan: l.length, gan: l.filter(x => x.htmlFor || x.querySelector('input,select,textarea')).length, enter: m.classList.contains('active'), tran: document.documentElement.scrollWidth > innerWidth + 2 };
  });
  await b.close();
  assert.strictEqual(r.gan, r.nhan);
  assert.ok(r.enter);
  assert.ok(!r.tran, 'không tràn ngang ở 375px');
});

test('Chế độ tối: theo máy + nút chuyển Tự động/Tối/Sáng, chữ tiêu đề đọc được', { skip: !chromium && 'chưa có Playwright' }, async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ colorScheme: 'dark' });
  await pg.goto(taoTrang('VN'));
  const r = await pg.evaluate(() => {
    const nen = () => getComputedStyle(document.body).backgroundColor;
    const chuTieuDe = () => getComputedStyle(document.querySelector('.page-head h1')).color;
    const o = { tuDong: nen(), chuTuDong: chuTieuDe() };
    const nut = document.getElementById('btnGiaoDien');
    nut.click(); o.toi = [nen(), nut.textContent];
    nut.click(); o.sang = [nen(), nut.textContent, chuTieuDe()];
    nut.click(); o.lai = nut.textContent;
    return o;
  });
  await b.close();
  assert.strictEqual(r.tuDong, 'rgb(15, 20, 27)', 'máy đang tối -> Tự động là tối');
  assert.strictEqual(r.chuTuDong, 'rgb(243, 244, 246)', 'tiêu đề chữ sáng trên nền tối');
  assert.strictEqual(r.toi[0], 'rgb(15, 20, 27)');
  assert.ok(r.toi[1].includes('Tối'));
  assert.strictEqual(r.sang[0], 'rgb(243, 244, 246)');
  assert.strictEqual(r.sang[2], 'rgb(31, 41, 55)');
  assert.ok(r.lai.includes('Tự động'));
});

test('Tự lưu nháp: gõ dở form Nhập tay, tải lại trang -> khôi phục được; Bỏ nháp thì xóa', { skip: !chromium && 'chưa có Playwright' }, async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const pg = await ctx.newPage();
  const url = taoTrang('VN');
  await pg.goto(url);
  await pg.evaluate(() => {
    const g = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    const sp = document.getElementById('m_soPhieu'); sp.value = 'PX-123'; sp.dispatchEvent(new Event('input', { bubbles: true }));
    const kl = document.getElementById('m_klHang'); kl.value = '17990'; kl.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await pg.waitForTimeout(700);
  await pg.goto(url); // "tải lại trang"
  const r = await pg.evaluate(() => {
    const tb = document.getElementById('nhapTB_manual');
    const o = { coThanh: !!tb, truoc: document.getElementById('m_soPhieu').value };
    tb.querySelector('[data-khoi-phuc]').click();
    o.soPhieu = document.getElementById('m_soPhieu').value;
    o.klHienThi = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').get.call(document.getElementById('m_klHang'));
    o.conThanh = !!document.getElementById('nhapTB_manual');
    xoaNhap('manual'); o.sauXoa = localStorage.getItem('hak_nhap_manual_v1');
    return o;
  });
  await b.close();
  assert.ok(r.coThanh, 'hiện thanh "Có bản nháp"');
  assert.strictEqual(r.truoc, '');
  assert.strictEqual(r.soPhieu, 'PX-123');
  assert.strictEqual(r.klHienThi, '17.990');
  assert.ok(!r.conThanh);
  assert.strictEqual(r.sauXoa, null);
});

test('Tải lớn giao diện: xem trước 50.000 dòng vẽ lô đầu < 2 giây, Chọn tất cả đủ 50.000', { skip: !chromium && 'chưa có Playwright' }, async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto(taoTrang('VN'));
  const r = await pg.evaluate(() => {
    state.previewData = Array.from({ length: 50000 }, (_, i) => ({ isError: false, typeImport: 'Mới', uniqueKey: i + '/2026/NK', soPhieu: String(i), soXe: 'X', ngayCan1: '25/07/2026', gioCan1: '08:00:00', ngayCan2: '25/07/2026', gioCan2: '09:00:00', klCan1: 1, klCan2: 2, klHangGoc: 3 }));
    const t0 = performance.now();
    renderPreview();
    const ms = performance.now() - t0;
    const chon = () => state.previewData.filter((x, i) => !x.isError && !state.previewBoChon.has(i)).length;
    return { ms, hang: document.querySelectorAll('#previewBody tr').length, chon: chon() };
  });
  await b.close();
  assert.ok(r.ms < 2000, 'vẽ ' + Math.round(r.ms) + ' ms');
  assert.ok(r.hang <= 501, 'chỉ vẽ lô đầu, thấy ' + r.hang + ' dòng');
  assert.strictEqual(r.chon, 50000);
});

test('Múi giờ hiển thị: giờ VN đổi sang múi giờ chọn (kể cả qua nửa đêm), ngày không giờ giữ nguyên', { skip: !chromium && 'chưa có Playwright' }, async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const f = path.join(os.tmpdir(), 'hak_ui_tz.html');
  fs.writeFileSync(f, SRC.replace(/<\?!= mienHeThongJson \?>/, '"VN"').replace(/<\?!= muiGioJson \?>/, '"Asia/Tokyo"').replace(/<\?!= [a-zA-Z]+ \?>/g, '""')
    .replace('<head>', '<head>' + STUB).replace(/<link[^>]+fonts[^>]*>/g, ''));
  await pg.goto('file://' + f);
  const r = await pg.evaluate(() => [ngayHT('25/07/2026 08:30'), ngayHT('25/07/2026 23:30:15'), ngayHT('25/07/2026'), ngayHT('2026-07-25 08:30'), ngayHT('Lúc 25/07/2026 08:30:00 (VN)')]);
  await b.close();
  assert.deepStrictEqual(r, ['25/07/2026 10:30', '26/07/2026 01:30:15', '25/07/2026', '25/07/2026 10:30', 'Lúc 25/07/2026 10:30:00 (VN)']);
});
