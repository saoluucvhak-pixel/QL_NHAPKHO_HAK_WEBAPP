'use strict';
// Công cụ phân tích tĩnh (chạy cục bộ bằng Node, KHÔNG deploy lên Apps Script):
// đo độ dài/độ phức tạp hàm, tìm lệnh Sheets/Drive trong vòng lặp, innerHTML,
// addEventListener. Dùng:  node tools/audit.js [--json]
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.join(__dirname, '..');
const SHEETS_IO = new Set(['getRange', 'getRangeList', 'getValues', 'getValue', 'setValues', 'setValue', 'appendRow', 'deleteRow', 'deleteRows',
  'insertRowAfter', 'insertRowBefore', 'insertRows', 'getDataRange', 'getSheetByName', 'openById', 'openByUrl', 'getLastRow', 'getLastColumn',
  'setNumberFormat', 'setNumberFormats', 'setFontWeight', 'setBackground', 'clearContent', 'getFileById', 'getFolderById', 'getFilesByName',
  'fetch', 'getProperty', 'setProperty', 'flush']);
const LOOP_CALLBACKS = new Set(['forEach', 'map', 'filter', 'reduce', 'some', 'every', 'find', 'findIndex', 'flatMap', 'sort']);

function nguon(file) {
  let src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (!file.endsWith('.html')) return [{ src, offsetLine: 0 }];
  const out = [];
  const re = /<script>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(src))) {
    const offsetLine = src.slice(0, m.index).split('\n').length - 1;
    out.push({ src: m[1].replace(/<\?!?=[\s\S]*?\?>/g, '""'), offsetLine });
  }
  return out;
}

function trongVongLap(p) {
  for (let q = p.parentPath; q; q = q.parentPath) {
    if (q.isFunction()) {
      const call = q.parentPath;
      if (call && call.isCallExpression() && call.node.callee.type === 'MemberExpression' && LOOP_CALLBACKS.has(call.node.callee.property.name)) return true;
      return false; // ranh giới hàm thường
    }
    if (q.isLoop()) return true;
  }
  return false;
}

function phanTich(file) {
  const kq = { file, functions: [], ioInLoop: [], innerHTML: [], listeners: [], flush: 0 };
  for (const { src, offsetLine } of nguon(file)) {
    const ast = parser.parse(src, { sourceType: 'script', errorRecovery: true, plugins: [] });
    traverse(ast, {
      Function(p) {
        const n = p.node;
        const ten = (n.id && n.id.name) || (p.parent.type === 'VariableDeclarator' && p.parent.id.name) || null;
        if (!ten || p.getFunctionParent()) return; // chỉ hàm đặt tên ở cấp ngoài cùng
        let cc = 1;
        p.traverse({
          'IfStatement|ConditionalExpression|ForStatement|ForInStatement|ForOfStatement|WhileStatement|DoWhileStatement|CatchClause'() { cc++; },
          SwitchCase(q) { if (q.node.test) cc++; },
          LogicalExpression(q) { if (q.node.operator === '&&' || q.node.operator === '||' || q.node.operator === '??') cc++; },
        });
        kq.functions.push({ ten, dong: n.loc.start.line + offsetLine, soDong: n.loc.end.line - n.loc.start.line + 1, cc });
      },
      CallExpression(p) {
        const c = p.node.callee;
        if (c.type !== 'MemberExpression' || c.property.type !== 'Identifier') return;
        const name = c.property.name;
        const line = p.node.loc.start.line + offsetLine;
        if (name === 'flush') kq.flush++;
        if (SHEETS_IO.has(name) && trongVongLap(p)) {
          const fn = p.getFunctionParent();
          let top = fn; while (top && top.getFunctionParent()) top = top.getFunctionParent();
          const ten = top && ((top.node.id && top.node.id.name) || (top.parent.id && top.parent.id.name)) || '?';
          kq.ioInLoop.push({ ham: ten, dong: line, lenh: name });
        }
        if (name === 'addEventListener') {
          let top = p.getFunctionParent(); while (top && top.getFunctionParent()) top = top.getFunctionParent();
          kq.listeners.push({ dong: line, trongHam: top ? ((top.node.id && top.node.id.name) || (top.parent.id && top.parent.id.name) || '(ẩn danh)') : '(cấp ngoài)' });
        }
      },
      AssignmentExpression(p) {
        const l = p.node.left;
        if (l.type === 'MemberExpression' && l.property && (l.property.name === 'innerHTML' || l.property.name === 'outerHTML')) {
          kq.innerHTML.push({ dong: p.node.loc.start.line + offsetLine, op: p.node.operator, laChuoiTinh: p.node.right.type === 'StringLiteral' });
        }
      },
    });
  }
  return kq;
}

const files = ['Config.gs', 'Code.gs', 'Index.html'];
const ketQua = files.map(phanTich);
if (process.argv.includes('--json')) { console.log(JSON.stringify(ketQua, null, 1)); process.exit(0); }
for (const k of ketQua) {
  const fns = k.functions;
  const dai = fns.filter((f) => f.soDong > 80).sort((a, b) => b.soDong - a.soDong);
  const phucTap = fns.filter((f) => f.cc > 20).sort((a, b) => b.cc - a.cc);
  console.log(`\n=== ${k.file}: ${fns.length} hàm | >80 dòng: ${dai.length} | CC>20: ${phucTap.length} | IO trong vòng lặp: ${k.ioInLoop.length} | innerHTML: ${k.innerHTML.length} | addEventListener: ${k.listeners.length} | flush: ${k.flush}`);
  console.log('  Dài nhất:', dai.slice(0, 12).map((f) => `${f.ten}(${f.soDong}d,cc${f.cc})`).join(', '));
  console.log('  Phức tạp nhất:', phucTap.slice(0, 12).map((f) => `${f.ten}(cc${f.cc})`).join(', '));
  const nhom = {};
  k.ioInLoop.forEach((x) => { const key = x.ham; (nhom[key] = nhom[key] || []).push(x.lenh + '@' + x.dong); });
  Object.keys(nhom).forEach((h) => console.log('  IO-LOOP', h, nhom[h].join(' ')));
}
