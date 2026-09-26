// Cần Playwright: npm i -D playwright (hoặc cài toàn cục). Đặt CHROME_PATH nếu dùng Chrome có sẵn.
let playwright;
try { playwright = require('playwright'); }
catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = playwright;
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'Index.html'),'utf8');
const OUT = process.argv[2] || require('os').tmpdir();
// Mock google.script.* chạy trong trình duyệt: phiên hợp lệ duy nhất = 'a'*64
const mock = `<script>
window.__calls = [];
window.__serverUser = window.__USER__ || { email:'nv1@gmail.com', vaiTro:'NHANVIEN', coQuyen:true, laAdmin:false, laChiXem:false };
window.__expireNext = false;
const hopLe = t => typeof t==='string' && t.length===64 && t!=='b'.repeat(64);
function mkRun(){ let ok=()=>{}, fail=()=>{};
  const r = new Proxy({}, { get(_,p){
    if (p==='withSuccessHandler') return f=>{ok=f;return r;};
    if (p==='withFailureHandler') return f=>{fail=f;return r;};
    return (...a)=>{ window.__calls.push([p,...a]); setTimeout(()=>{
      if (p==='DN_kiemTraPhien') return ok(hopLe(a[0])?{status:'success',data:window.__serverUser}:{status:'het_han',message:'Phiên đăng nhập đã hết hạn'});
      if (p==='DN_layLinkDangNhap') return ok({status:'success',url:'https://script.google.com/macros/s/CONG/exec'});
      if (p==='DN_dangXuat') return ok({status:'success'});
      if (p==='API') { const [tok,fn,args]=a;
        if (!hopLe(tok) || window.__expireNext) return fail(new Error('Exception: PHIEN_HET_HAN: Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'));
        if (fn==='HT_layThongTinNguoiDungHienTai') return ok({status:'success',data:window.__serverUser});
        if (fn==='HT_layCauHinhCong') return ok({status:'success',data:{linkCong:'https://script.google.com/macros/s/CONG/exec',linkWebappChinh:'https://script.google.com/macros/s/MAIN/exec',linkWebappHopLe:true}});
        if (fn==='HT_layMaNguonCong') return ok({status:'success',data:'const KHOA_BI_MAT = "k";'});
        if (fn==='HT_layDanhSachQuyen') return ok({status:'success',data:[{email:'saoluucvhak@gmail.com',vaiTro:'ADMIN'},{email:'xem@gmail.com',vaiTro:'CHIXEM'}]});
        if (fn==='layDanhSachDanhMucKho') return ok([{maKho:'K1',tenNhaMay:'NM <b>X</b>',tenKho:'Kho A',ngayKhoiTao:'2026-01-01'}]);
        if (fn==='exportBaoCaoTongHopExcel') return ok({status:'success', url:'https://docs.google.com/x/export?format=xlsx', fileBase64:btoa('PK-fake'), fileName:'BaoCao.xlsx', mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
        return ok({status:'success',data:[],summary:{}});
      }
      ok(null);
    },5); };
  }}); return r; }
window.google = { script: { get run(){ return mkRun(); }, history: { replace(){ window.__histReplaced = true; } } } };
</script>`;
function page(phienMoi, thongBao, user){
  return html.replace('<?!= phienMoiJson ?>', JSON.stringify(phienMoi)).replace('<?!= thongBaoDangNhapJson ?>', JSON.stringify(thongBao))
             .replace('<head>', '<head><script>window.__USER__=' + JSON.stringify(user||null) + ';</script>' + mock);
}
(async()=>{
  const b = await (process.env.CHROME_PATH ? chromium.launch({ executablePath: process.env.CHROME_PATH }) : chromium.launch());
  let pass=0, fail=0; const check=(n,c)=>{ c?pass++:fail++; console.log(c?'PASS':'FAIL', n); };
  const errs=[];
  async function open(phienMoi, thongBao, stored, user){
    const ctx = await b.newContext(); const p = await ctx.newPage();
    p.on('pageerror', e=>errs.push(String(e)));
    await p.route('https://app.test/**', r=>r.fulfill({contentType:'text/html', body: page(phienMoi, thongBao, user)}));
    await p.route('https://fonts.googleapis.com/**', r=>r.abort());
    await ctx.route('https://script.google.com/**', r=>r.fulfill({contentType:'text/html', body:'<h1>CONG</h1>'}));
    p.__ctx = ctx;
    if (stored) await p.addInitScript(v=>{ localStorage.setItem('hak_phien_dang_nhap_v1', v); }, stored);
    await p.goto('https://app.test/'); await p.waitForTimeout(400); return p;
  }
  // A. Chưa đăng nhập -> hiện màn hình đăng nhập, nút có link Google, không gọi API nào
  let p = await open('', '', null);
  check('login screen visible when no session', await p.isVisible('#loginScreen'));
  check('login button points to gateway', (await p.getAttribute('#btnDangNhapGoogle','href')||'') === 'https://script.google.com/macros/s/CONG/exec');
  check('no API calls made before login', (await p.evaluate(()=>window.__calls.filter(c=>c[0]==='API').length))===0);
  // B. Thông báo từ server (email không có quyền) hiển thị
  p = await open('', 'Tài khoản x@gmail.com chưa được cấp quyền', null);
  check('server message shown', (await p.textContent('#loginThongBao')).includes('x@gmail.com'));
  // C. Vừa đăng nhập xong (phiên từ server) -> ẩn login, lưu phiên, xóa ?code khỏi URL, các lệnh xếp hàng chạy
  p = await open('a'.repeat(64), '', null);
  check('login hidden after valid session', !(await p.isVisible('#loginScreen')));
  check('session persisted', (await p.evaluate(()=>localStorage.getItem('hak_phien_dang_nhap_v1')))==='a'.repeat(64));
  check('URL ?code cleared', await p.evaluate(()=>window.__histReplaced===true));
  const apiFns = await p.evaluate(()=>window.__calls.filter(c=>c[0]==='API').map(c=>c[2]));
  check('queued calls sent via API after login', apiFns.includes('HT_layThongTinNguoiDungHienTai') && apiFns.includes('getFilterOptions'));
  check('user + logout shown in sidebar', (await p.textContent('.sidebar-foot')).includes('nv1@gmail.com') && await p.isVisible('#btnDangXuat'));
  check('admin tabs hidden for staff', !(await p.isVisible('.sub-item[data-tab="ht-tab-quyen"]')));
  // D. apiRun (màn Kho Dăm cũ) đi qua API và escape dữ liệu
  await p.evaluate(()=>taiDanhSachDanhMucKho()); await p.waitForTimeout(200);
  check('legacy apiRun call routed through API', await p.evaluate(()=>window.__calls.some(c=>c[0]==='API'&&c[2]==='layDanhSachDanhMucKho')));
  check('legacy screen rendered & escaped', (await p.innerHTML('#khodamContentArea')).includes('NM &lt;b&gt;X&lt;/b&gt;'));
  const [dl] = await Promise.all([ p.waitForEvent('download', {timeout:3000}).catch(()=>null), p.evaluate(()=>document.getElementById('btnExcelTongHop').click()) ]);
  check('export button downloads file (no Drive link)', !!dl && dl.suggestedFilename()==='BaoCao.xlsx');
  // E. Phiên hết hạn giữa chừng -> quay về màn hình đăng nhập
  await p.evaluate(()=>{ window.__expireNext = true; runServer('getFilterOptions').catch(()=>{}); }); await p.waitForTimeout(200);
  check('expired session shows login again', await p.isVisible('#loginScreen'));
  check('expired session cleared storage', (await p.evaluate(()=>localStorage.getItem('hak_phien_dang_nhap_v1')))===null);
  // F. Mở lại trang với phiên đã lưu
  p = await open('', '', 'a'.repeat(64));
  check('stored session auto-login', !(await p.isVisible('#loginScreen')));
  // G. Phiên lưu đã hết hạn -> login
  p = await open('', '', 'b'.repeat(64));
  check('stale stored session -> login', await p.isVisible('#loginScreen'));
  // H. Đăng xuất
  p = await open('a'.repeat(64), '', null);
  await p.click('#btnDangXuat'); await p.waitForTimeout(100);
  check('logout shows login + clears storage', await p.isVisible('#loginScreen') && (await p.evaluate(()=>localStorage.getItem('hak_phien_dang_nhap_v1')))===null);
  await p.screenshot({ path: path.join(OUT, 'login.png') });
  // I. Vai trò Chỉ xem
  p = await open('a'.repeat(64), '', null, { email:'xem@gmail.com', vaiTro:'CHIXEM', coQuyen:true, laAdmin:false, laChiXem:true });
  await p.waitForTimeout(200);
  check('viewer: body flagged', await p.evaluate(()=>document.body.classList.contains('che-do-chi-xem')));
  check('viewer: Import + Nhập liệu menus hidden', !(await p.isVisible('.menu-item[data-view="view-import"]')) && !(await p.isVisible('.menu-item[data-view="view-router-nhaplieu"]')));
  check('viewer: report menu visible', await p.isVisible('.menu-item[data-view="view-router-baocaokho"]'));
  check('viewer: sidebar says Chỉ xem', (await p.textContent('.sidebar-foot')).includes('Chỉ xem'));
  await p.click('.menu-item[data-view="view-baogia"]'); await p.waitForTimeout(200);
  check('viewer: báo giá opens on Hiệu lực, Nhập tab hidden', await p.isVisible('#bg-tab-hieuluc') && !(await p.isVisible('#bg-tab-nhap')) && !(await p.isVisible('.tabbtn[data-pane="bg-tab-nhap"]')));
  await p.click('.tabbtn[data-pane="bg-tab-mabaogia"]'); await p.waitForTimeout(100);
  check('viewer: add-code form hidden', !(await p.isVisible('#bgBtnAddMaBaoGia')));
  check('viewer: admin tabs hidden', !(await p.isVisible('.sub-item[data-tab="ht-tab-quyen"]')));
  check('viewer: no gateway-config call', !(await p.evaluate(()=>window.__calls.some(c=>c[0]==='API'&&c[2]==='HT_layCauHinhCong'))));
  // J. Admin: thẻ Cổng đăng nhập + vai trò Chỉ xem trong danh sách
  p = await open('a'.repeat(64), '', null, { email:'saoluucvhak@gmail.com', vaiTro:'ADMIN', coQuyen:true, laAdmin:true, laChiXem:false });
  await p.click('.menu-item[data-view="view-hethong"]'); await p.click('.sub-item[data-tab="ht-tab-quyen"]'); await p.waitForTimeout(300);
  check('admin: gateway link loaded', (await p.inputValue('#ht_linkCong')) === 'https://script.google.com/macros/s/CONG/exec');
  check('admin: role list shows Chỉ xem', (await p.evaluate(()=>[...document.querySelectorAll('.ht-quyen-vaitro')].map(x=>x.value).join(','))) === 'ADMIN,CHIXEM');
  await p.click('#btnSaoChepMaCong'); await p.waitForTimeout(200);
  check('admin: gateway source shown for copy', (await p.inputValue('#ht_maNguonCong')).includes('KHOA_BI_MAT'));
  await p.screenshot({ path: path.join(OUT, 'admin_cong.png'), fullPage: false });
  // K. Nhúng trong Portal: bấm Đăng nhập mở CỬA SỔ RIÊNG, trang hiện tại không bị chuyển đi;
  //    cửa sổ kia đăng nhập xong (lưu phiên) -> khung này tự vào hệ thống + đóng cửa sổ.
  p = await open('', '', null);
  const [popup] = await Promise.all([ p.__ctx.waitForEvent('page'), p.click('#btnDangNhapGoogle') ]);
  await popup.waitForLoadState().catch(()=>{});
  check('login opens gateway in a popup', popup.url().startsWith('https://script.google.com/macros/s/CONG/exec'));
  check('embedding page not navigated away', p.url() === 'https://app.test/' && await p.isVisible('#loginScreen'));
  check('waiting message shown', (await p.textContent('#loginThongBao')).includes('cửa sổ vừa mở'));
  const landing = await p.__ctx.newPage();
  // Trang đích sau Cổng (?cong=...) = chính webapp, máy chủ đã cấp phiên mới 'c'*64
  await landing.route('https://app.test/**', r=>r.fulfill({contentType:'text/html', body: page('c'.repeat(64), '', null)}));
  await landing.goto('https://app.test/?cong=x');
  await p.waitForTimeout(2200);
  check('frame picks up session from other window', !(await p.isVisible('#loginScreen')));
  check('popup closed after login', popup.isClosed());
  check('queued calls ran with new session', await p.evaluate(()=>window.__calls.some(c=>c[0]==='API'&&c[1]==='c'.repeat(64)&&c[2]==='getFilterOptions')));
  // L. Đăng xuất rồi đăng nhập tài khoản Chỉ xem ngay trong trang -> giao diện đổi theo vai trò
  p = await open('a'.repeat(64), '', null, { email:'saoluucvhak@gmail.com', vaiTro:'ADMIN', coQuyen:true, laAdmin:true, laChiXem:false });
  check('admin sees admin tab', await p.evaluate(()=>document.querySelector('.sub-item[data-tab="ht-tab-quyen"]').style.display !== 'none'));
  await p.click('#btnDangXuat'); await p.waitForTimeout(100);
  await p.evaluate(()=>{ window.__serverUser = { email:'xem@gmail.com', vaiTro:'CHIXEM', coQuyen:true, laAdmin:false, laChiXem:true }; });
  await p.evaluate(()=>{ localStorage.setItem('hak_phien_dang_nhap_v1', 'd'.repeat(64)); window.dispatchEvent(new StorageEvent('storage', { key:'hak_phien_dang_nhap_v1', newValue:'d'.repeat(64) })); });
  await p.waitForTimeout(400);
  check('re-login in place works', !(await p.isVisible('#loginScreen')));
  check('role UI switched to viewer', await p.evaluate(()=>document.body.classList.contains('che-do-chi-xem')) && !(await p.isVisible('.menu-item[data-view="view-import"]')) && await p.evaluate(()=>document.querySelector('.sub-item[data-tab="ht-tab-quyen"]').style.display === 'none'));
  console.log('page errors:', errs.length ? errs : 'none');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  if (fail) process.exitCode = 1;
})();
