// Nạp Config.gs + Code.gs vào 1 môi trường Node giả lập Apps Script (vm), mỗi lần gọi
// taoMoiTruong() là 1 "lượt thực thi" mới. Chỉ giả lập các dịch vụ mà bài test cần;
// bài test tự truyền thêm (SpreadsheetApp, CacheService...) qua tham số dichVu.
// Chạy: npm test (Node >= 18, không cần cài thêm thư viện).
process.env.TZ = 'Asia/Ho_Chi_Minh';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const GOC = path.join(__dirname, '..');
const MA_NGUON = fs.readFileSync(path.join(GOC, 'Config.gs'), 'utf8') + '\n' + fs.readFileSync(path.join(GOC, 'Code.gs'), 'utf8');

function dinhDangNgayDonGian(d, tz, mau) {
  const p = n => String(n).padStart(2, '0');
  return String(mau).replace('yyyy', d.getFullYear()).replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate()))
    .replace('HH', p(d.getHours())).replace('mm', p(d.getMinutes())).replace('ss', p(d.getSeconds()));
}

function taoMoiTruong(dichVu) {
  const props = (dichVu && dichVu.props) || {};
  const cache = (dichVu && dichVu.cache) || {};
  const ctx = Object.assign({
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperties: () => props, getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; }, getAll: ks => { const o = {}; ks.forEach(k => { if (cache[k]) o[k] = cache[k]; }); return o; } }) },
    Utilities: {
      DigestAlgorithm: { MD5: 'md5' },
      computeDigest: (a, s) => Array.from(crypto.createHash('md5').update(typeof s === 'string' ? s : Buffer.from(s.map(b => (b + 256) % 256))).digest()).map(b => (b > 127 ? b - 256 : b)),
      base64EncodeWebSafe: b => Buffer.from(Array.isArray(b) ? b.map(x => (x + 256) % 256) : b).toString('base64url'),
      formatDate: dinhDangNgayDonGian
    },
    Session: { getScriptTimeZone: () => 'Asia/Ho_Chi_Minh', getActiveUser: () => ({ getEmail: () => '' }), getEffectiveUser: () => ({ getEmail: () => '' }) }
  }, dichVu || {});
  vm.createContext(ctx);
  vm.runInContext(MA_NGUON, ctx);
  const chay = ma => vm.runInContext(ma, ctx);
  return { ctx, chay, props, cache };
}

// Sheet giả lập tối thiểu (mảng 2 chiều, dòng/cột bắt đầu từ 1 như Apps Script).
function taoSheet(dong) {
  const sh = {
    rows: dong,
    getDataRange() { return { getValues: () => sh.rows.map(r => r.slice()) }; },
    getLastRow() { return sh.rows.length; },
    getRange(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      const g = {
        getValues: () => sh.rows.slice(r - 1, r - 1 + nr).map(x => x.slice(c - 1, c - 1 + nc)),
        getValue: () => sh.rows[r - 1][c - 1],
        setValue(v) { sh.rows[r - 1][c - 1] = v; return g; },
        setValues(vs) { vs.forEach((row, i) => row.forEach((v, j) => { sh.rows[r - 1 + i][c - 1 + j] = v; })); return g; },
        setNumberFormat() { return g; }, setHorizontalAlignment() { return g; }
      };
      return g;
    },
    getRangeList() { const g = { setNumberFormat() { return g; }, setHorizontalAlignment() { return g; } }; return g; },
    appendRow(r) { sh.rows.push(r); },
    deleteRow(r) { sh.rows.splice(r - 1, 1); }
  };
  return sh;
}

module.exports = { taoMoiTruong, taoSheet };
