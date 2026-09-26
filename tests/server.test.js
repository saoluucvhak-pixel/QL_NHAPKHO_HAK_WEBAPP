const vm = require('vm'); const fs = require('fs'); const crypto = require('crypto');
const ROOT = require('path').join(__dirname, '..') + '/';
const code = fs.readFileSync(ROOT + 'Config.gs','utf8') + '\n' + fs.readFileSync(ROOT + 'Code.gs','utf8');
const store = {}; const cache = {}; let fetchCalls = []; const logs = [];
const toBuf = d => typeof d === 'string' ? Buffer.from(d, 'utf8') : Buffer.from(d);
const Utilities = {
  getUuid: () => crypto.randomUUID(),
  newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }),
  base64Encode: b => toBuf(b).toString('base64'),
  base64EncodeWebSafe: b => toBuf(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_'),
  base64DecodeWebSafe: s => Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'), 'base64'),
  computeHmacSha256Signature: (v, k) => [...crypto.createHmac('sha256', toBuf(k)).update(toBuf(v)).digest()],
};
const HtmlService = {
  createHtmlOutput: h => ({ setTitle(){ return this; }, html: h }),
  createTemplateFromFile: () => ({ evaluate(){ const t=this; return { setTitle(){return this;}, addMetaTag(){return this;}, setXFrameOptionsMode(){return this;}, vars:t }; } }),
  XFrameOptionsMode: { ALLOWALL: 1 },
};
const ctx = {
  console: { log: (...a) => logs.push(a.join(' ')), error: console.error, warn: console.warn },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => store[k] ?? null, setProperty: (k,v)=>{store[k]=v;}, deleteProperty: k=>{delete store[k];} }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k,v)=>{cache[k]=v;}, remove: k=>{delete cache[k];} }) },
  Utilities,
  UrlFetchApp: { fetch: (url, opt) => { fetchCalls.push({url, opt});
    return { getResponseCode: () => 200, getBlob: () => ({ getBytes: () => [37,80,68,70] }) }; } },
  ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/MAIN/exec' }), getOAuthToken: () => 'ADMIN_TOKEN' },
  DriveApp: { getFileById: () => ({ getName: () => 'BaoCao_TongHop' }) },
  SpreadsheetApp: { openById: () => ({ getSheetByName: () => null }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock(){}, releaseLock(){} }) },
  HtmlService,
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(code, ctx);
const run = (src) => vm.runInContext(src, ctx);
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name); } }
function throwsWith(fn, frag) { try { fn(); return false; } catch (e) { return String(e.message).includes(frag); } }
const reset = () => run('PHIEN_HIEN_TAI_ = null');

// Chạy mã nguồn Cổng thật (sinh ra từ taoMaNguonCong_) trong 1 vm riêng.
function taoCong(src) {
  let email = '';
  const g = { Session: { getActiveUser: () => ({ getEmail: () => email }) }, Utilities, HtmlService };
  vm.createContext(g); vm.runInContext(src, g);
  return (e) => { email = e; const out = g.doGet(); const m = out.html.match(/href="([^"]+)"/); return m ? m[1].replace(/&amp;/g,'&') : null; };
}
const veTuLink = link => decodeURIComponent(new URL(link).searchParams.get('cong'));
const dangNhap = ve => run(`doGet({parameter:{cong:${JSON.stringify(ve)}}})`).vars;

// 1. Chưa cài đặt -> trang hướng dẫn, không lộ khóa
check('unconfigured doGet shows setup page', String(run('doGet({parameter:{}})').html || '').includes('CAI_DAT_CONG_DANG_NHAP'));
// 2. Hàm cài đặt: tạo khóa, in mã nguồn vào nhật ký, KHÔNG trả về gì
const tra = ctx.CAI_DAT_CONG_DANG_NHAP();
check('setup returns nothing', tra === undefined);
const khoa = store.CONG_DN_KHOA_BI_MAT;
check('setup created 64-hex key', /^[a-f0-9]{64}$/.test(khoa));
const logText = logs.join('\n');
const src = logText.split('-----\n')[1].split('-----')[0];
check('log has gateway source with key + main url', src.includes(khoa) && src.includes('https://script.google.com/macros/s/MAIN/exec'));
ctx.CAI_DAT_CONG_DANG_NHAP();
check('setup is idempotent (key unchanged)', store.CONG_DN_KHOA_BI_MAT === khoa);
reset(); check('API refuses setup fn', throwsWith(()=>ctx.API('x', 'CAI_DAT_CONG_DANG_NHAP', []), 'PHIEN_HET_HAN') );

const cong = taoCong(src);
// 3. Gọi thẳng hàm nghiệp vụ (không qua API) bị chặn
reset(); check('direct call blocked', throwsWith(()=>run('getBaoCaoTongHop({})'), 'PHIEN_HET_HAN'));
reset(); check('API without session blocked', throwsWith(()=>ctx.API('', 'getBaoCaoTongHop', [{}]), 'PHIEN_HET_HAN'));
check('login link missing -> clear message', ctx.DN_layLinkDangNhap().status === 'error');

// 4. Đăng nhập qua Cổng
check('gateway without email shows no link', cong('') === null);
const linkAdmin = cong('Sao.Luucvhak@gmail.com');
check('gateway redirects to pinned main url', linkAdmin.startsWith('https://script.google.com/macros/s/MAIN/exec?cong='));
let v = dangNhap(veTuLink(linkAdmin));
const adminPhien = JSON.parse(v.phienMoiJson);
check('admin login gives session', /^[a-f0-9]{64}$/.test(adminPhien));
v = dangNhap(veTuLink(linkAdmin));
check('ticket single-use', v.phienMoiJson === '""' && v.thongBaoDangNhapJson.includes('đã được dùng'));
// Vé giả: sửa email trong thân vé
const [than, ky] = veTuLink(cong('nguoila@gmail.com')).split('.');
const thanGia = Utilities.base64EncodeWebSafe(JSON.stringify({ v:1, e:'saoluucvhak@gmail.com', x: Date.now()+60000, n: crypto.randomUUID() }));
check('forged payload rejected', dangNhap(thanGia + '.' + ky).phienMoiJson === '""');
check('garbage ticket rejected', dangNhap('abc').phienMoiJson === '""' && dangNhap('a.b.c').phienMoiJson === '""');
// Vé ký bằng khóa khác
const congKhac = taoCong(src.replace(khoa, 'f'.repeat(64)));
check('wrong key rejected', dangNhap(veTuLink(congKhac('saoluucvhak@gmail.com'))).thongBaoDangNhapJson.includes('sai chữ ký'));
// Vé hết hạn
const thanCu = Utilities.base64EncodeWebSafe(JSON.stringify({ v:1, e:'saoluucvhak@gmail.com', x: Date.now()-1000, n: crypto.randomUUID() }));
const kyCu = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(thanCu, khoa));
check('expired ticket rejected', dangNhap(thanCu + '.' + kyCu).thongBaoDangNhapJson.includes('hết hạn'));
const thanXa = Utilities.base64EncodeWebSafe(JSON.stringify({ v:1, e:'saoluucvhak@gmail.com', x: Date.now()+86400000, n: crypto.randomUUID() }));
check('far-future ticket rejected', dangNhap(thanXa + '.' + Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(thanXa, khoa))).phienMoiJson === '""');
// Email không có trong danh sách
v = dangNhap(than + '.' + ky);
check('non-listed email rejected', v.phienMoiJson === '""' && v.thongBaoDangNhapJson.includes('nguoila@gmail.com'));

// 5. API với phiên hợp lệ
reset(); const who = ctx.API(adminPhien, 'HT_layThongTinNguoiDungHienTai', []);
check('API works with session (admin)', who.status === 'success' && who.data.laAdmin === true);
reset(); check('API blocks eval', throwsWith(()=>ctx.API(adminPhien, 'eval', ['1']), 'Không được phép'));
reset(); check('API blocks private fn', throwsWith(()=>ctx.API(adminPhien, 'taoPhien_', ['x@gmail.com']), 'Không được phép'));
reset(); check('API blocks doGet', throwsWith(()=>ctx.API(adminPhien, 'doGet', []), 'Không được phép'));
reset(); check('API blocks setup fn with session', throwsWith(()=>ctx.API(adminPhien, 'CAI_DAT_CONG_DANG_NHAP', []), 'Không được phép'));

// 6. Quản trị Cổng
reset(); check('save bad gateway link rejected', ctx.API(adminPhien, 'HT_luuLinkCong', ['https://evil.example/exec']).status === 'error');
reset(); check('save main url as gateway rejected', ctx.API(adminPhien, 'HT_luuLinkCong', ['https://script.google.com/macros/s/MAIN/exec']).status === 'error');
reset(); check('save gateway link ok', ctx.API(adminPhien, 'HT_luuLinkCong', ['https://script.google.com/macros/s/CONG/exec']).status === 'success');
check('login link now points to gateway', ctx.DN_layLinkDangNhap().url === 'https://script.google.com/macros/s/CONG/exec');
reset(); const maNguon = ctx.API(adminPhien, 'HT_layMaNguonCong', []);
check('admin gets gateway source', maNguon.status === 'success' && maNguon.data === src);

// 7. Nhân viên + Chỉ xem
reset(); const luu = ctx.API(adminPhien, 'HT_luuDanhSachQuyen', [[{email:'saoluucvhak@gmail.com',vaiTro:'ADMIN'},{email:'nv1@gmail.com',vaiTro:'NHANVIEN'},{email:'xem@gmail.com',vaiTro:'chixem'},{email:'la@gmail.com',vaiTro:'HACKER'}]]);
check('role list saved', luu.status === 'success');
const ds = JSON.parse(store.DANH_SACH_QUYEN_JSON);
check('CHIXEM normalised, unknown role -> NHANVIEN', ds[2].vaiTro === 'CHIXEM' && ds[3].vaiTro === 'NHANVIEN');
const nvPhien = JSON.parse(dangNhap(veTuLink(cong('nv1@gmail.com'))).phienMoiJson);
const xemPhien = JSON.parse(dangNhap(veTuLink(cong('xem@gmail.com'))).phienMoiJson);
reset(); check('staff session ok', ctx.API(nvPhien, 'HT_layThongTinNguoiDungHienTai', []).data.vaiTro === 'NHANVIEN');
reset(); const adminOnly = ctx.API(nvPhien, 'HT_layDanhSachQuyen', []);
check('staff blocked from admin fn', adminOnly.status === 'error' && adminOnly.message.includes('Quản trị'));
reset(); check('staff blocked from gateway source', ctx.API(nvPhien, 'HT_layMaNguonCong', []).status === 'error');
reset(); const xemInfo = ctx.API(xemPhien, 'HT_layThongTinNguoiDungHienTai', []).data;
check('viewer session flags', xemInfo.laChiXem === true && xemInfo.laAdmin === false);
reset(); check('viewer blocked from write fn', throwsWith(()=>ctx.API(xemPhien, 'addManualPhieuCan', [{}]), 'chỉ có quyền XEM'));
reset(); check('viewer blocked from import', throwsWith(()=>ctx.API(xemPhien, 'step1_ConfirmImport', [[]]), 'chỉ có quyền XEM'));
reset(); check('viewer blocked from processFormData write action', throwsWith(()=>ctx.API(xemPhien, 'processFormData', ['Nhapkho', {}]), 'chỉ có quyền XEM'));
reset(); check('viewer blocked from Hoanthanhdonhang', throwsWith(()=>ctx.API(xemPhien, 'processFormData', ['Hoanthanhdonhang', {}]), 'chỉ có quyền XEM'));
reset(); check('viewer blocked from admin fn', throwsWith(()=>ctx.API(xemPhien, 'HT_luuDanhSachQuyen', [[]]), 'chỉ có quyền XEM'));
run("function testDoc(){ yeuCauPhien_(); return {status:'success', url:'https://docs.google.com/spreadsheets/d/ABC123/export?format=pdf&gid=0'}; }");
run("HAM_CHO_PHEP_CHI_XEM_.testDoc = true; HAM_API_.testDoc = true;");
reset(); const fx = ctx.API(xemPhien, 'testDoc', []);
check('viewer can call allow-listed read fn + gets file', fx.fileName === 'BaoCao_TongHop.pdf' && fx.mimeType === 'application/pdf');
check('export fetched with admin OAuth token', fetchCalls.at(-1).opt.headers.Authorization === 'Bearer ADMIN_TOKEN');
let okRead = true; try { ctx.API(xemPhien, 'processFormData', ['Baocaotonkho', {}]); } catch (e) { okRead = !String(e.message).includes('chỉ có quyền XEM'); }
check('viewer allowed processFormData report action', okRead);
// Mọi hàm trong danh sách Chỉ xem phải tồn tại và có yeuCauPhien_()
const dsXem = Object.keys(run('HAM_CHO_PHEP_CHI_XEM_')).filter(k => k !== 'testDoc');
check('allow-list fns all exist + guarded', dsXem.every(k => typeof ctx[k] === 'function' && String(ctx[k]).includes('yeuCauPhien_()')));

// 8. Thu hồi, hết hạn, đăng xuất, đổi khóa
reset(); ctx.API(adminPhien, 'HT_luuDanhSachQuyen', [[{email:'saoluucvhak@gmail.com',vaiTro:'ADMIN'}]]);
reset(); check('revoked user blocked immediately', throwsWith(()=>ctx.API(nvPhien, 'HT_layThongTinNguoiDungHienTai', []), 'không còn trong danh sách'));
reset(); const doi = ctx.API(adminPhien, 'HT_doiKhoaCong', []);
check('rotate key returns new source', doi.status === 'success' && store.CONG_DN_KHOA_BI_MAT !== khoa && doi.data.includes(store.CONG_DN_KHOA_BI_MAT));
check('old gateway stops working after rotation', dangNhap(veTuLink(cong('saoluucvhak@gmail.com'))).phienMoiJson === '""');
check('new gateway works after rotation', /^[a-f0-9]{64}$/.test(JSON.parse(dangNhap(veTuLink(taoCong(doi.data)('saoluucvhak@gmail.com'))).phienMoiJson)));
const k = 'phien_' + adminPhien; const obj = JSON.parse(cache[k]); obj.taoLuc = Date.now() - 13*3600*1000; cache[k] = JSON.stringify(obj);
reset(); check('12h expiry enforced', throwsWith(()=>ctx.API(adminPhien, 'HT_layThongTinNguoiDungHienTai', []), 'quá 12 giờ'));
const p2 = JSON.parse(dangNhap(veTuLink(taoCong(doi.data)('saoluucvhak@gmail.com'))).phienMoiJson);
ctx.DN_dangXuat(p2);
reset(); check('logout invalidates session', ctx.DN_kiemTraPhien(p2).status === 'het_han');

// 9. API chỉ cho gọi hàm trong danh sách HAM_API_ (chặn hàm nội bộ bỏ qua khóa/nhật ký)
const phienMoi = JSON.parse(dangNhap(veTuLink(taoCong(doi.data)('saoluucvhak@gmail.com'))).phienMoiJson);
reset(); check('API blocks internal helper xuLySuaXoaGiaoDich', throwsWith(()=>ctx.API(phienMoi, 'xuLySuaXoaGiaoDich', [{}]), 'Không được phép'));
reset(); check('API blocks internal helper sanitize', throwsWith(()=>ctx.API(phienMoi, 'sanitize', ['x']), 'Không được phép'));
reset(); check('API blocks taoPhieuDieuChinhKho', throwsWith(()=>ctx.API(phienMoi, 'taoPhieuDieuChinhKho', []), 'Không được phép'));
const dsApi = Object.keys(run('HAM_API_')).filter(k => k !== 'testDoc');
check('every HAM_API_ fn exists + guarded', dsApi.every(k => typeof ctx[k] === 'function' && /^[^{]*\{\s*yeuCauPhien_\(\);/.test(String(ctx[k]))));
const idx = fs.readFileSync(ROOT + 'Index.html', 'utf8');
const goiTuGiaoDien = new Set([...idx.matchAll(/runServer\(\s*'([A-Za-z0-9_]+)'/g)].map(m=>m[1]));
[...idx.matchAll(/\.\s*([A-Za-z][A-Za-z0-9_]+)\s*\(/g)].forEach(m => { if (typeof ctx[m[1]] === 'function' && !/_$/.test(m[1])) goiTuGiaoDien.add(m[1]); });
['API','DN_layLinkDangNhap','DN_kiemTraPhien','DN_dangXuat','doGet'].forEach(k=>goiTuGiaoDien.delete(k));
const thieu = [...goiTuGiaoDien].filter(k => !run('HAM_API_')[k]);
check('every server fn the UI calls is in HAM_API_ (missing: ' + thieu.join(',') + ')', thieu.length === 0);
check('every CHIXEM fn is in HAM_API_', Object.keys(run('HAM_CHO_PHEP_CHI_XEM_')).filter(k=>k!=='testDoc').every(k => run('HAM_API_')[k]));

// 10. Chống chèn công thức khi ghi file xuất
check('export formula guard', JSON.stringify(ctx.chongCongThucBang_([['=HYPERLINK("x")', '+1', '-2', '@a', 'binh thuong', 5, -3, null]]))
  === JSON.stringify([["'=HYPERLINK(\"x\")", "'+1", "'-2", "'@a", 'binh thuong', 5, -3, null]]));

// Sheet giả trong bộ nhớ
function sheetGia(rows) {
  const data = rows.map(r => r.slice());
  return {
    data,
    getLastRow: () => data.length,
    getDataRange: () => ({ getValues: () => data.map(r => r.slice()) }),
    getRange: (r, c, nr, nc) => ({
      getValue: () => data[r-1][c-1],
      getValues: () => data.slice(r-1, r-1+(nr||1)).map(row => row.slice(c-1, c-1+(nc||1))),
    }),
    deleteRow: (r) => { data.splice(r-1, 1); },
  };
}
// 11. Đơn hàng xuất bán: xác định đúng dòng theo STT
const shDH = sheetGia([['STT'], [1], [2], [3], [4]]);
check('order row: exact row+stt ok', ctx.XH_timDongDonHang_(shDH, 3, 2) === 3);
shDH.deleteRow(2); // người khác xóa STT 1 -> các dòng dịch lên
check('order row: shifted list finds by STT', ctx.XH_timDongDonHang_(shDH, 4, 3) === 3);
check('order row: deleted order -> error', throwsWith(()=>ctx.XH_timDongDonHang_(shDH, 2, 1), 'không còn tồn tại'));
const shTrung = sheetGia([['STT'], [1], [5], [5]]);
check('order row: duplicate STT -> error', throwsWith(()=>ctx.XH_timDongDonHang_(shTrung, 9, 5), 'cùng STT'));
check('order row: legacy call without STT still range-checked', ctx.XH_timDongDonHang_(shDH, 2) === 2 && throwsWith(()=>ctx.XH_timDongDonHang_(shDH, 99), 'Không tìm thấy'));

// 12. Kỳ vét bãi: chỉ xóa được kỳ mới nhất
const shCfg = sheetGia([['Loại','Kỳ','Thời gian','Tiêu hao'], ['Thông Số Kho','K1','',''], ['Khác','x','',''], ['Thông Số Kho','K2','',''], ['Khác','y','','']]);
const ssGoc = ctx.SpreadsheetApp.openById;
ctx.SpreadsheetApp.openById = () => ({ getSheetByName: () => shCfg });
run('PHIEN_HIEN_TAI_ = timNguoiDungTheoEmail_("saoluucvhak@gmail.com")');
check('kỳ: cannot delete header row', ctx.xuLyKyVetBai({ hanhDong:'XOA', rowIndex: 1 }).startsWith('❌') && shCfg.data.length === 5);
check('kỳ: cannot delete old (locked) period', ctx.xuLyKyVetBai({ hanhDong:'XOA', rowIndex: 2 }).startsWith('❌') && shCfg.data.length === 5);
check('kỳ: cannot delete non-period row', ctx.xuLyKyVetBai({ hanhDong:'XOA', rowIndex: 5 }).startsWith('❌'));
check('kỳ: delete latest period ok', ctx.xuLyKyVetBai({ hanhDong:'XOA', rowIndex: 4 }).startsWith('🗑️') && shCfg.data.length === 4 && shCfg.data[3][1] === 'y');
ctx.SpreadsheetApp.openById = ssGoc;

// 13. Xóa nhiều dòng: gom khối liền nhau, xóa từ dưới lên, bỏ tiêu đề/trùng
const goiXoa = []; const shX = { deleteRows: (r, n) => goiXoa.push([r, n]) };
const soXoa = ctx.xoaCacDong_(shX, [5, 3, 4, 9, 1, 4, 10, 12]);
check('block delete groups rows bottom-up', soXoa === 6 && JSON.stringify(goiXoa) === JSON.stringify([[12,1],[9,2],[3,3]]));

// 14. Nhật ký: ghi nguyên tử (appendRow), cắt nội dung quá dài, chặn công thức
const logRows = [];
ctx.SpreadsheetApp.openById = () => ({ getSheetByName: () => ({ getRange: () => ({ getValue: () => 'Người thực hiện', setValue(){} }), appendRow: r => logRows.push(r) }) });
ctx.logAudit_('TEST', 'OK', '=IMPORTXML("http://x")'); ctx.logAudit_('TEST', 'OK', 'a'.repeat(60000));
check('audit log appendRow + formula-safe + truncated', logRows.length === 2 && logRows[0][3] === "'=IMPORTXML(\"http://x\")" && logRows[1][3].length < 45100 && logRows[0][4] === 'saoluucvhak@gmail.com');
ctx.SpreadsheetApp.openById = ssGoc;
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
