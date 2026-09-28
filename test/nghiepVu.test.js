// Kiểm thử nghiệp vụ các bản sửa đợt 1-4 (docs/audit/13_Enterprise_Audit_2026-09-28.md).
const test = require('node:test');
const assert = require('node:assert');
const { taoMoiTruong, taoSheet } = require('./gasEnv');

test('H-03: ngày chuyển kỳ vét bãi không bị khóa nhầm', () => {
  const { chay } = taoMoiTruong();
  chay(`var KY=[{tenKy:'A',tu:new Date(2026,0,1).getTime(),den:new Date(2026,8,15,23,59,59,999).getTime(),isLocked:true},
               {tenKy:'B',tu:new Date(2026,8,15).getTime(),den:new Date(2028,8,15,23,59,59,999).getTime(),isLocked:false}];`);
  assert.strictEqual(chay('kiemTraKhoaKyVetBaiPure_(new Date(2026,8,15,9), KY)'), false);
  assert.strictEqual(chay('kiemTraKhoaKyVetBaiPure_(new Date(2026,8,14), KY)'), true);
  assert.strictEqual(chay('kiemTraKhoaKyVetBaiPure_(new Date(2026,8,16), KY)'), false);
});

test('M-03: năm 2 chữ số hiểu là 20xx', () => {
  const { chay } = taoMoiTruong();
  assert.strictEqual(chay('toDateObj_("25/07/26 08:00:00").getFullYear()'), 2026);
  assert.strictEqual(chay('toDateObj_("25/07/2026 08:00:00").getMonth()'), 6);
});

test('H-01: báo giá mới nhất thắng khi dải KL chồng nhau', () => {
  const { chay } = taoMoiTruong();
  chay(`var BG=[{start:new Date(2026,0,1).getTime(),end:new Date(2050,11,31).getTime(),keyQ:'X',minKl:0,maxKl:50,price:1000000},
               {start:new Date(2026,8,1).getTime(),end:new Date(2050,11,31).getTime(),keyQ:'X',minKl:0,maxKl:45,price:1100000},
               {start:new Date(2026,8,1).getTime(),end:new Date(2050,11,31).getTime(),keyQ:'X',minKl:45,maxKl:999,price:1150000}];
        function dong(d,kg){var r=new Array(26).fill('');r[1]=d;r[2]=new Date(1899,11,30,8,0,0);r[9]=kg;r[16]='X';r[17]=0;return r;}`);
  assert.strictEqual(chay('TG_tinhGiaDong_(dong(new Date(2026,8,20),40000),BG).gia'), 1100000);
  assert.strictEqual(chay('TG_tinhGiaDong_(dong(new Date(2026,8,20),48000),BG).gia'), 1150000);
  assert.strictEqual(chay('TG_tinhGiaDong_(dong(new Date(2026,5,20),40000),BG).gia'), 1000000);
  assert.strictEqual(chay('TG_tinhGiaDong_(dong(new Date(2026,5,20),60000),BG).trangThai'), 'Lỗi ĐK/Báo giá');
});

test('H-01: cảnh báo chồng dải khi lưu báo giá', () => {
  const { chay } = taoMoiTruong();
  chay(`var FR=[['old',new Date(2026,0,1),new Date(2050,11,31),'X','0','50',1000000,'','','','','','','Còn hiệu lực'],
               ['new',new Date(2026,8,1),new Date(2050,11,31),'X','0','45',1100000,'','','','','','','Còn hiệu lực'],
               ['new',new Date(2026,8,1),new Date(2050,11,31),'X','45','999',1150000,'','','','','','','Còn hiệu lực'],
               ['y',new Date(2026,8,1),new Date(2050,11,31),'Y','0','50',9,'','','','','','','Còn hiệu lực']];`);
  const w = chay('BG_canhBaoChongDai_(FR,["new"])');
  assert.ok(w.includes('0_45') && w.includes('45_999') && w.includes('0_50') && !w.includes('mã Y'));
  assert.strictEqual(chay('BG_canhBaoChongDai_(FR,["y"])'), '');
});

test('M-01: nhận diện đúng tên file tạm xuất báo cáo', () => {
  const { chay } = taoMoiTruong();
  assert.ok(chay('laTenFileTamXuat_("BaoCao_Misa_2809_1010")'));
  assert.ok(chay('laTenFileTamXuat_("PhieuNhapKho_1_2026_NK")'));
  assert.ok(!chay('laTenFileTamXuat_("Bao_Gia_HAK_2026")'));
  assert.ok(!chay('laTenFileTamXuat_("file_can.xlsx")'));
});

test('Kết xuất theo Locale Misa: nhận diện cột mã/số/ngày/giờ, đổi ngày thành giá trị thật', () => {
  const { chay } = taoMoiTruong({ props: { MISA_FORMAT_MIEN: 'US' } });
  chay(`var H=["Mã Chứng Từ","Số Phiếu","Ngày Cân 1","Giờ Cân 1","Số Xe","KL Hàng (kg)","Khối Lượng (Tấn)","Khách Hàng","Ngày Giờ Cân 1","Trống"];
        var ROWS=[["1/2026/NK",7107,"25/07/2026","08:30:15","92A-1",17990,21.92,"A","25/07/2026 08:30:15",""],["2/2026/NK",7108,"26/07/2026","","92A-2",1000,1,"B","26/07/2026 09:00:00",""]];
        var K=XK_chuanBiCot_(H,ROWS);`);
  const k = JSON.parse(chay('JSON.stringify(K)'));
  assert.deepStrictEqual(k.map(x => x.loai), ['ma', 'ma', 'ngay', 'gio', 'ma', 'so', 'so', 'chu', 'ngay', 'chu']);
  assert.strictEqual(k[2].fmt, 'MM/dd/yyyy');
  assert.strictEqual(k[5].fmt, '#,##0');
  assert.strictEqual(k[6].fmt, '#,##0.00');
  assert.ok(chay('ROWS[0][2] instanceof Date && ROWS[0][2].getDate()===25'));
  assert.strictEqual(chay('ROWS[0][3]'), (8 * 3600 + 30 * 60 + 15) / 86400);
});

test('Locale hệ thống: chuỗi ngày sheet xem trước + ngày đơn hàng', () => {
  const { chay } = taoMoiTruong();
  assert.strictEqual(chay('doiChuoiNgayTheoMien_("25/07/2026","US")'), '07/25/2026');
  assert.strictEqual(chay('doiChuoiNgayTheoMien_("25/07/2026","VN")'), '25/07/2026');
  assert.strictEqual(chay('XH_ngayTuInput_("2026-09-01").getDate()'), 1);
  assert.strictEqual(chay('XH_ngayTuInput_("=1+1")'), "'=1+1");
});

test('M-08: chống tạo trùng theo mã yêu cầu', () => {
  const { chay } = taoMoiTruong();
  chay('var DEM=0; function viec(){ DEM++; return {status:"success", message:"Mới: 1"}; }');
  chay('chayChongTrung_("a@x","step1_ConfirmImport","abcdefabcdefabcdef1",viec)');
  const lan2 = chay('chayChongTrung_("a@x","step1_ConfirmImport","abcdefabcdefabcdef1",viec)');
  assert.strictEqual(chay('DEM'), 1);
  assert.ok(lan2.message.includes('không lưu lần 2'));
  chay('var D2=0; function loi(){ D2++; return {status:"error",message:"bận"}; }');
  chay('chayChongTrung_("a@x","XH_saveDonHang","qqqqqqqqqqqqqqqq4",loi)');
  chay('chayChongTrung_("a@x","XH_saveDonHang","qqqqqqqqqqqqqqqq4",loi)');
  assert.strictEqual(chay('D2'), 2, 'lỗi thì được chạy lại');
  assert.ok(chay('chayChongTrung_("a@x","processFormData","zzzzzzzzzzzzzzzz3",function(){return "❌ lỗi"})').startsWith('❌'));
});

test('ARCH-02: báo cáo gửi về trình duyệt tối đa 10.000 dòng mới nhất, giữ thứ tự', () => {
  const { chay } = taoMoiTruong();
  chay(`var R={status:"success",summary:{soLuong:12000},data:[]};
        for (var i=0;i<12000;i++){ var d=new Date(2025,0,1+Math.floor(i/40)); R.data.push({ma:i, ngayCan1: dinhDangGMT7_(d,"dd/MM/yyyy")}); }
        var K=BC_gioiHanDongWeb_(R,"ngayCan1");`);
  assert.strictEqual(chay('K.data.length'), 10000);
  assert.strictEqual(chay('K.tongSoDong'), 12000);
  assert.strictEqual(chay('K.biCat'), true);
  assert.strictEqual(chay('K.data[0].ma'), 2000, 'bỏ 2.000 dòng CŨ nhất');
  assert.strictEqual(chay('K.data[9999].ma'), 11999);
  assert.strictEqual(chay('K.summary.soLuong'), 12000);
});

test('BUG-004: chặn người lưu sau (Kho Dăm + độ khô)', () => {
  const gd = taoSheet([['Mã', 'TG', 'Loại', 'HT', 'Đợt', 'KX', 'KN', 'MT', 'ĐK', 'TH', 'BDMT', 'TT', 'Gốc', 'DG']]);
  const dk = taoSheet([['Ngày', 'HT', 'ĐK', 'ĐA', 'TT']]);
  const { chay, ctx } = taoMoiTruong({ SpreadsheetApp: { openById: () => ({ getSheetByName: n => (n === 'DATA_GIAODICH' ? gd : (n === 'Nhapdokho' ? dk : null)) }) } });
  ctx.gd = gd; ctx.dk = dk;
  chay(`gd.rows.push(["NK_1",new Date(2026,8,20,7),"NHẬP","Khác","A","Không có","Kho1",10,0.4,0.0315,4,"Hợp lệ","","x"]);
        dk.rows.push([new Date(2026,8,20),"NKSX",0.45,0.55,"Hợp lệ"]);`);
  const pb = chay('KD_phienBan_(gd.rows[1].slice(0,14))');
  const sua = (p, mt) => chay(`xuLySuaXoaGiaoDich_({loai:"NHẬP",maPhieu:"NK_1",ngay:"2026-09-20",hinhThuc:"Khác",khoXuat:"Không có",khoNhap:"Kho1",khoiLuongMT:${mt},doKho:0.4,hanhDong:"SUA",phienBan:"${p}"})`);
  assert.ok(sua(pb, 12).startsWith('✏️'));
  assert.ok(sua(pb, 15).includes('người khác'));
  assert.strictEqual(gd.rows[1][7], 12);
  const pb2 = chay('KD_phienBan_(gd.rows[1].slice(0,14))');
  assert.ok(chay(`xuLySuaXoaGiaoDich_({maPhieu:"NK_1",hanhDong:"XOA",phienBan:"${pb}"})`).includes('người khác'));
  assert.ok(chay(`xuLySuaXoaGiaoDich_({maPhieu:"NK_1",hanhDong:"XOA",phienBan:"${pb2}"})`).startsWith('🗑️'));
  assert.ok(sua(chay('KD_phienBan_(gd.rows[1].slice(0,14))'), 9).includes('đã bị xóa'));
  const pbd = chay('KD_phienBan_(dk.rows[1].slice(0,5))');
  assert.ok(chay('xuLySuaXoaDoKho_({ngay:"2026-09-20",hinhThuc:"NKSX",doKho:0.5,doAm:0.5,hanhDong:"SUA",phienBan:""})').includes('bấm "Sửa"'));
  assert.ok(chay(`xuLySuaXoaDoKho_({ngay:"2026-09-20",hinhThuc:"NKSX",doKho:0.5,doAm:0.5,hanhDong:"SUA",phienBan:"${pbd}"})`).startsWith('✏️'));
  assert.ok(chay(`xuLySuaXoaDoKho_({ngay:"2026-09-20",hinhThuc:"NKSX",doKho:0.6,doAm:0.4,hanhDong:"SUA",phienBan:"${pbd}"})`).includes('người khác'));
  assert.ok(chay('xuLySuaXoaDoKho_({ngay:"2026-09-21",hinhThuc:"NKSX",doKho:0.5,doAm:0.5,hanhDong:"SUA",phienBan:""})').startsWith('✅'));
});

test('Cú pháp: mã nguồn giao diện (Index.html) hợp lệ', () => {
  const fs = require('fs'); const path = require('path');
  const h = fs.readFileSync(path.join(__dirname, '..', 'Index.html'), 'utf8');
  const js = h.match(/<script>([\s\S]*)<\/script>/)[1].replace(/<\?!=[^?]*\?>/g, 'null');
  assert.doesNotThrow(() => new Function(js));
});

test('Kiểm tra hợp lý phiếu cân: ngày cân 2 trước cân 1, KL hàng lệch |Cân 1 - Cân 2|', () => {
  const { chay } = taoMoiTruong();
  assert.strictEqual(chay('PC_canhBaoHopLy_(new Date(2026,6,25,8), new Date(2026,6,25,9), 27020, 9030, 17990)'), '');
  assert.ok(chay('PC_canhBaoHopLy_(new Date(2026,6,25,9), new Date(2026,6,25,8), 27020, 9030, 17990)').includes('trước cân 1'));
  assert.ok(chay('PC_canhBaoHopLy_(null, null, 27020, 9030, 17000)').includes('17990'));
  assert.strictEqual(chay('PC_canhBaoHopLy_(null, null, 0, 0, 17000)'), '', 'thiếu số cân -> không cảnh báo');
});

test('Lịch sử sửa: chỉ liệt kê cột thay đổi; xóa thì chụp cả dòng', () => {
  const { chay } = taoMoiTruong();
  const d = chay('LS_thayDoi_(["MT","Kho","Ngày"], [10,"A",new Date(2026,8,20,7)], [12,"A",new Date(2026,8,20,7)])');
  assert.strictEqual(d, 'MT: 10 → 12');
  assert.strictEqual(chay('LS_thayDoi_(["MT"], [10], [10])'), 'Không có thay đổi');
  assert.ok(chay('LS_anhChup_(["MT","Kho"], [10,"A"])').includes('Kho=A'));
});

test('L-10: kho nguồn trung chuyển tính cùng lượt đọc, giống hàm cũ', () => {
  const { chay, ctx } = taoMoiTruong({ SpreadsheetApp: { openById: () => ({ getSheetByName: () => ctx.gdSheet }) } });
  const { taoSheet } = require('./gasEnv');
  ctx.gdSheet = taoSheet([['h']]);
  chay(`gdSheet.rows.push(["1",new Date(2026,8,1),"XUẤT","TC","","KhoA","KhoXB",10,0.4,0,4,"Hợp lệ"]);
        gdSheet.rows.push(["2",new Date(2026,8,2),"XUẤT","TC","","KhoB","KhoXB",20,0.4,0,8,"Hợp lệ"]);
        gdSheet.rows.push(["3",new Date(2026,8,3),"XUẤT","TC","","KhoA","KhoXB",5,0.4,0,2,"Đã hủy"]);`);
  const tu = 'new Date(2026,8,1).getTime()', den = 'new Date(2026,8,30).getTime()';
  assert.strictEqual(chay(`tongHopSoLieuKhoXuatBan_("KhoXB",${tu},${den}).khoNguonTC`), 'KhoB');
  assert.strictEqual(chay(`timKhoNguonTCLonNhat_("KhoXB",${tu},${den})`), 'KhoB');
  assert.strictEqual(chay(`tongHopSoLieuKhoXuatBan_("KhoXB",${tu},${den}).nhapTC_BDMT`), 12);
});
