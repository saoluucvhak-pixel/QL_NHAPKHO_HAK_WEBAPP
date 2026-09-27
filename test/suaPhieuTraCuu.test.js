const { createGasEnv } = require('./gasEnv');
const mocks = require('./gasMocks');

// Tra cứu: SỬA Khách hàng / Đại lý / Nguồn gốc + TÍNH LẠI GIÁ phiếu cân nhập chưa
// "OK" (cột Y - ĐNTT ghi "OK" khi đã đóng thanh toán), 1 phiếu hoặc hàng loạt
// theo bộ lọc. Quy tắc cột giống hệt import: K=ĐL_NG, N=ĐL, O=NG, Q=ĐL_NG_Y, S=lúc sửa.
const PHIEUCAN_ID = '1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g';
const BAOGIA_ID = '1SIhfjP5-6ouRPDj265lAMmI5yWs1XcnedjqpzDwaIC0';
const DRAFT = 'PhieuCan_DN_CHUA_TT_DRAFT';
const header = new Array(27).fill('H');

// Phiếu 20 tấn; giá cũ ghi sẵn (T/X/Z) để thấy rõ phiếu nào được tính lại.
function phieu(maCT, o) {
  o = o || {};
  const r = new Array(27).fill('');
  r[0] = maCT.split('/')[0]; r[1] = o.ngay || new Date(2026, 5, 10); r[2] = new Date(1899, 11, 30, 8, 0, 0);
  r[5] = o.xe || 'XE-1'; r[7] = 30000; r[8] = 10000; r[9] = 20000;
  const dl = o.dl || 'DL1', ng = o.ng || 'NG1';
  r[10] = dl + '_' + ng; r[11] = o.kh || 'Khách Cũ'; r[12] = 'GK'; r[13] = dl; r[14] = ng; r[15] = 'Y';
  r[16] = dl + '_' + ng + '_Y'; r[17] = o.giam || 0; r[18] = new Date(2026, 5, 10);
  r[19] = 111; r[21] = maCT; r[22] = maCT; r[23] = 111; r[24] = o.y === undefined ? 'Test giá' : o.y; r[25] = 999; r[26] = o.aa || '';
  return r;
}

function nap(env, dsDangTheoDoi, luuTru) {
  const ss = env.spreadsheetApp.openById(PHIEUCAN_ID);
  const sh = ss.__setSheet('PhieuCan_DN', [header, ...dsDangTheoDoi]);
  Object.keys(luuTru || {}).forEach((nam) => ss.__setSheet('PhieuCan_DN_' + nam, [header, ...luuTru[nam]]));
  const tu = new Date(2000, 0, 1), den = new Date(2100, 0, 1);
  env.spreadsheetApp.openById(BAOGIA_ID).__setSheet('Baogia_DN_SAVE', [
    ['TS', 'Từ', 'Đến', 'Mã ĐG', 'Min', 'Max', 'Giá'],
    [tu, tu, den, 'DL1_NG1_Y', 0, 1000, 1000],
    [tu, tu, den, 'DL2_NG2_Y', 0, 1000, 1500],
    [tu, tu, den, 'DL1_NG1_N', 0, 1000, 800], // cùng ĐL/NG nhưng KHÔNG hình ảnh -> giá khác
  ]);
  return sh || ss.getSheetByName('PhieuCan_DN');
}
const dongCua = (env, maCT) => env.spreadsheetApp.openById(PHIEUCAN_ID).getSheetByName('PhieuCan_DN').__data.find((r) => r[21] === maCT);

describe('Sửa Khách hàng / Đại lý / Nguồn gốc (phiếu chưa OK)', () => {
  test('ghi đúng các cột theo quy tắc import, giữ nguyên cột khác, tính lại giá CHỈ phiếu vừa sửa', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK'), phieu('2/2026/NK')]);
    const res = env.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: '  Nguyễn Văn Mới ', daiLy: 'dl2', nguonGoc: 'ng2' });
    expect(res.status).toBe('success');
    expect(res.message).toMatch(/Đại lý: DL1 → DL2/);
    expect(res.ketQua).toMatchObject({ trangThai: 'Test giá', hieuSo: 1500, thanhTien: 30000 });

    const r = dongCua(env, '1/2026/NK');
    expect([r[10], r[11], r[13], r[14], r[16]]).toEqual(['DL2_NG2', 'Nguyễn Văn Mới', 'DL2', 'NG2', 'DL2_NG2_Y']);
    expect([r[12], r[15], r[17]]).toEqual(['GK', 'Y', 0]); // M, P, R giữ nguyên
    expect(r[18]).not.toEqual(new Date(2026, 5, 10)); // S = thời điểm sửa
    expect([r[19], r[23], r[24], r[25]]).toEqual([1500, 1500, 'Test giá', 30000]);
    // phiếu khác chưa OK KHÔNG bị tính lại (giữ giá cũ)
    const r2 = dongCua(env, '2/2026/NK');
    expect([r2[19], r2[23], r2[25]]).toEqual([111, 111, 999]);
    // có ghi nhật ký
    const audit = env.spreadsheetApp.openById(PHIEUCAN_ID).getSheetByName('Audit').__data;
    expect(audit.some((a) => a[1] === 'SUA_PHIEU_CAN' && /1\/2026\/NK/.test(a[3]))).toBe(true);
  });

  test('đổi ĐL/NG mà KHÔNG tính được giá (Mã ĐG mới chưa có báo giá) -> CHƯA LƯU, không ghi ô nào', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK')]);
    const truoc = dongCua(env, '1/2026/NK').slice();
    mocks.resetApiCounter_();
    const res = env.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: 'Khách Mới', daiLy: 'DLX', nguonGoc: 'NGX' });
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/^CHƯA LƯU: không tính được giá cho Mã ĐG DLX_NGX_Y \(khối lượng 20 tấn, ngày cân 10\/06\/2026\)/);
    expect(mocks.getApiCounter_().oWrite).toBe(0);
    expect(dongCua(env, '1/2026/NK')).toEqual(truoc); // cả Khách hàng cũng không bị lưu
  });

  test('đổi ĐL/NG: khối lượng nằm ngoài dải báo giá -> cũng không lưu', () => {
    const env = createGasEnv();
    const p = phieu('1/2026/NK'); p[9] = 2000000; // 2.000 tấn > Max 1.000 tấn
    nap(env, [p]);
    expect(env.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: 'A', daiLy: 'DL2', nguonGoc: 'NG2' }).message).toMatch(/^CHƯA LƯU/);
    expect(dongCua(env, '1/2026/NK')[13]).toBe('DL1');
  });

  test('phiếu đang "Lỗi ĐK/Báo giá", đổi sang ĐL/NG có báo giá -> lưu, hết lỗi', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK', { dl: 'DLX', ng: 'NGX', y: 'Lỗi ĐK/Báo giá' })]);
    const res = env.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: 'Khách Cũ', daiLy: 'DL1', nguonGoc: 'NG1' });
    expect(res.status).toBe('success');
    expect(dongCua(env, '1/2026/NK').slice(23, 26)).toEqual([1000, 'Test giá', 20000]);
  });

  test('chỉ đổi Khách hàng -> lưu Khách hàng, GIÁ GIỮ NGUYÊN (không tính lại)', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK')]);
    const res = env.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: 'Khách Đổi Tên', daiLy: 'dl1', nguonGoc: 'ng1' });
    expect(res.status).toBe('success');
    expect(res.message).toMatch(/giá giữ nguyên/);
    const r = dongCua(env, '1/2026/NK');
    expect(r[11]).toBe('Khách Đổi Tên');
    expect([r[16], r[19], r[23], r[24], r[25]]).toEqual(['DL1_NG1_Y', 111, 111, 'Test giá', 999]);
  });

  test('không thay đổi gì -> báo không có thay đổi', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK')]);
    expect(env.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: 'Khách Cũ', daiLy: 'DL1', nguonGoc: 'NG1' }).message).toMatch(/Không có thay đổi/);
  });

  test('không ghi đè cột U, V, W (Picture, Mã chứng từ, Số CT)', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK')]);
    const sh = env.spreadsheetApp.openById(PHIEUCAN_ID).getSheetByName('PhieuCan_DN');
    const ghi = [];
    const goc = sh.getRange.bind(sh);
    sh.getRange = (...a) => { const rg = goc(...a); const sv = rg.setValues.bind(rg); rg.setValues = (v) => { ghi.push(a); return sv(v); }; return rg; };
    env.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: 'A', daiLy: 'DL2', nguonGoc: 'NG2' });
    const cot = new Set();
    ghi.forEach(([, c, , n]) => { for (let k = c; k < c + (n || 1); k++) cot.add(k); });
    [21, 22, 23].forEach((c) => expect(cot.has(c)).toBe(false));
    expect(cot.has(11) && cot.has(20) && cot.has(24) && cot.has(26)).toBe(true);
  });

  test('chống công thức (sanitize) như import', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK')]);
    expect(env.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: '=IMPORTXML("x")', daiLy: 'DL1', nguonGoc: 'NG1' }).status).toBe('success');
    expect(dongCua(env, '1/2026/NK')[11]).toBe('\'=IMPORTXML("x")');
  });

  test('phiếu đã OK (đã đóng thanh toán) -> từ chối, không ghi ô nào', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK', { y: 'OK', aa: 'Đóng TT' })]);
    mocks.resetApiCounter_();
    const res = env.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: 'A', daiLy: 'DL2', nguonGoc: 'NG2' });
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/đã đóng thanh toán/);
    expect(mocks.getApiCounter_().oWrite).toBe(0);
    expect(dongCua(env, '1/2026/NK')[13]).toBe('DL1');
  });

  test('phiếu ở sheet lưu trữ -> báo đã khóa sổ; không có -> báo không tìm thấy; thiếu trường -> báo thiếu', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK')], { 2025: [phieu('9/2025/NK', { y: 'OK' })] });
    expect(env.call('TC_suaPhieuNhap', '9/2025/NK', { khachHang: 'A', daiLy: 'B', nguonGoc: 'C' }).message).toMatch(/lưu trữ/);
    expect(env.call('TC_suaPhieuNhap', 'X/2026/NK', { khachHang: 'A', daiLy: 'B', nguonGoc: 'C' }).message).toMatch(/Không tìm thấy/);
    expect(env.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: 'A', daiLy: '', nguonGoc: 'C' }).message).toMatch(/nhập đủ/);
  });

  test('chi tiết phiếu cho biết sửa được hay không', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK'), phieu('2/2026/NK', { y: 'OK' })], { 2025: [phieu('9/2025/NK', { y: 'OK' })] });
    expect(env.call('TC_chiTietPhieuNhap', '1/2026/NK').data).toMatchObject({ choSua: true, lyDoKhongSua: '' });
    expect(env.call('TC_chiTietPhieuNhap', '2/2026/NK').data.lyDoKhongSua).toMatch(/đóng thanh toán/);
    expect(env.call('TC_chiTietPhieuNhap', '9/2025/NK').data.lyDoKhongSua).toMatch(/lưu trữ/);
    const tim = env.call('TC_traCuuPhieuNhap', {});
    expect(tim.soChuaChot).toBe(1);
    expect(tim.data.filter((r) => r.choSua).map((r) => r.maChungTu)).toEqual(['1/2026/NK']);
  });
});

describe('Tính lại giá', () => {
  test('1 phiếu: tính theo báo giá hiện tại, có Giảm giá; phiếu OK bị từ chối', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK', { giam: -100 }), phieu('2/2026/NK', { y: 'OK' })]);
    const res = env.call('TC_tinhLaiGiaPhieu', '1/2026/NK');
    expect(res.status).toBe('success');
    expect(res.ketQua).toMatchObject({ gia: 1000, hieuSo: 900, thanhTien: 18000 });
    expect(dongCua(env, '1/2026/NK').slice(23, 26)).toEqual([900, 'Test giá', 18000]);
    expect(env.call('TC_tinhLaiGiaPhieu', '2/2026/NK').message).toMatch(/đã đóng thanh toán/);
  });

  test('hàng loạt theo bộ lọc: chỉ phiếu CHƯA OK khớp từ khóa + ngày; phiếu OK và phiếu ngoài bộ lọc giữ nguyên', () => {
    const env = createGasEnv();
    nap(env, [
      phieu('1/2026/NK', { kh: 'Nguyễn Văn An' }),
      phieu('2/2026/NK', { kh: 'Nguyễn Văn An', dl: 'DLX', ng: 'NGX' }), // không có báo giá
      phieu('3/2026/NK', { kh: 'Nguyễn Văn An', y: 'OK' }),
      phieu('4/2026/NK', { kh: 'Trần Bình' }),
      phieu('5/2026/NK', { kh: 'Nguyễn Văn An', ngay: new Date(2026, 0, 5) }), // ngoài khoảng ngày
    ]);
    const res = env.call('TC_tinhLaiGiaTheoBoLoc', { tuKhoa: 'nguyen van an', tuNgay: '2026-06-01', denNgay: '2026-06-30' });
    expect(res.status).toBe('success');
    expect(res).toMatchObject({ soPhieu: 2, soLoiBaoGia: 1 });
    expect(res.message).toMatch(/2 phiếu.*1 phiếu Lỗi/);
    expect(dongCua(env, '1/2026/NK')[25]).toBe(20000);
    expect(dongCua(env, '2/2026/NK')[24]).toBe('Lỗi ĐK/Báo giá');
    [['3/2026/NK', 'OK'], ['4/2026/NK', 'Test giá'], ['5/2026/NK', 'Test giá']].forEach(([ma, y]) => {
      expect(dongCua(env, ma)[25]).toBe(999);
      expect(dongCua(env, ma)[24]).toBe(y);
    });
  });

  test('không có phiếu nào khớp -> báo rõ, không ghi', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK', { y: 'OK' })]);
    mocks.resetApiCounter_();
    const res = env.call('TC_tinhLaiGiaTheoBoLoc', {});
    expect(res.status).toBe('success');
    expect(res.soPhieu).toBe(0);
    expect(mocks.getApiCounter_().oWrite).toBe(0);
  });

  test('runCalculatePrice (nút cũ) vẫn tính mọi phiếu chưa OK như trước', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK'), phieu('2/2026/NK', { dl: 'DL2', ng: 'NG2' }), phieu('3/2026/NK', { y: 'OK' })]);
    const res = env.call('runCalculatePrice');
    expect(res.message).toBe('Đã tính giá cho 2 phiếu chưa chốt.');
    expect(res.ketQua).toBeUndefined();
    expect([dongCua(env, '1/2026/NK')[25], dongCua(env, '2/2026/NK')[25], dongCua(env, '3/2026/NK')[25]]).toEqual([20000, 30000, 999]);
  });
});

describe('Draft Chưa Thanh Toán được cập nhật theo (không thêm mới)', () => {
  test('phiếu có trong Draft -> ghi đè đúng dòng 26 cột; phiếu không có -> không thêm', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK'), phieu('2/2026/NK'), phieu('3/2026/NK')]);
    const ss = env.spreadsheetApp.openById(PHIEUCAN_ID);
    const cuDraft = (ma) => { const r = phieu(ma).slice(0, 26); r[0] = "'" + r[0]; r[22] = "'" + r[22]; return r; };
    ss.__setSheet(DRAFT, [header.slice(0, 26), cuDraft('3/2026/NK'), cuDraft('1/2026/NK')]);

    expect(env.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: 'KH Mới', daiLy: 'DL2', nguonGoc: 'NG2' }).message).toMatch(/Draft Chưa TT/);
    let d = ss.getSheetByName(DRAFT).__data;
    expect(d.length).toBe(3);
    expect(d[2].slice(10, 17)).toEqual(['DL2_NG2', 'KH Mới', 'GK', 'DL2', 'NG2', 'Y', 'DL2_NG2_Y']);
    expect(d[2].slice(23, 26)).toEqual([1500, 'Test giá', 30000]);
    expect(d[2][0]).toBe("'1");
    expect(d[1][25]).toBe(999); // phiếu 3 chưa tính lại -> giữ nguyên

    env.call('TC_tinhLaiGiaTheoBoLoc', {});
    d = ss.getSheetByName(DRAFT).__data;
    expect(d.length).toBe(3); // phiếu 2 không có trong Draft -> không thêm
    expect(d[1][25]).toBe(20000);
  });
});

describe('Khóa, cờ Khóa sổ ĐNTT, quyền', () => {
  test.each([
    ['TC_suaPhieuNhap', ['1/2026/NK', { khachHang: 'A', daiLy: 'DL2', nguonGoc: 'NG2' }]],
    ['TC_tinhLaiGiaPhieu', ['1/2026/NK']],
    ['TC_tinhLaiGiaTheoBoLoc', [{}]],
  ])('%s: khóa đang bị giữ -> "đang bận"; ĐNTT đang khóa sổ -> tạm dừng; không ghi gì, khóa đã trả', (ten, args) => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK')]);
    env.lockService.__giuBoiPhienKhac = true;
    mocks.resetApiCounter_();
    expect(env.call(ten, ...args).message).toMatch(/bận/);
    env.lockService.__giuBoiPhienKhac = false;
    env.spreadsheetApp.openById(PHIEUCAN_ID)
      .addDeveloperMetadata('HAK_KHOA_SO_NAM_DANG_CHAY', JSON.stringify({ nam: 2025, batDau: Date.now(), ung: 'DNTT' }), 'DOCUMENT');
    expect(env.call(ten, ...args).message).toMatch(/Khóa sổ/);
    expect(mocks.getApiCounter_().oWrite).toBe(0);
    expect(env.lockService.__dangGiu).toBe(false);
  });

  test('Chỉ xem: không được sửa/tính lại giá; Nhân viên: được', () => {
    const xem = createGasEnv({ email: 'xem@gmail.com', vaiTro: 'CHIXEM' });
    nap(xem, [phieu('1/2026/NK')]);
    expect(() => xem.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: 'A', daiLy: 'DL2', nguonGoc: 'NG2' })).toThrow(/\[QUYEN\]/);
    expect(() => xem.call('TC_tinhLaiGiaTheoBoLoc', {})).toThrow(/\[QUYEN\]/);
    const nv = createGasEnv({ email: 'nv@gmail.com', vaiTro: 'NHANVIEN' });
    nap(nv, [phieu('1/2026/NK')]);
    expect(nv.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: 'A', daiLy: 'DL2', nguonGoc: 'NG2' }).status).toBe('success');
  });
});

describe('Hình ảnh (Y/N) - phần thứ 3 của Mã ĐG', () => {
  test('đổi Hình ảnh Y -> N: P = N, Mã ĐG = ĐL_NG_N, giá theo báo giá "không hình ảnh"', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK')]);
    const res = env.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: 'Khách Cũ', daiLy: 'DL1', nguonGoc: 'NG1', hinhAnh: 'n' });
    expect(res.status).toBe('success');
    expect(res.message).toMatch(/Hình ảnh: Y → N/);
    const r = dongCua(env, '1/2026/NK');
    expect([r[10], r[15], r[16]]).toEqual(['DL1_NG1', 'N', 'DL1_NG1_N']);
    expect(r.slice(23, 26)).toEqual([800, 'Test giá', 16000]);
  });

  test('đổi Hình ảnh sang mã chưa có báo giá -> CHƯA LƯU, không ghi', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK', { dl: 'DL2', ng: 'NG2' })]);
    mocks.resetApiCounter_();
    const res = env.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: 'Khách Cũ', daiLy: 'DL2', nguonGoc: 'NG2', hinhAnh: 'N' });
    expect(res.message).toMatch(/^CHƯA LƯU: không tính được giá cho Mã ĐG DL2_NG2_N/);
    expect(mocks.getApiCounter_().oWrite).toBe(0);
    expect(dongCua(env, '1/2026/NK')[15]).toBe('Y');
  });

  test('giá trị Hình ảnh không hợp lệ -> báo lỗi; không gửi Hình ảnh -> giữ giá trị cũ', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK')]);
    expect(env.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: 'A', daiLy: 'DL1', nguonGoc: 'NG1', hinhAnh: 'X' }).message).toMatch(/Y .*hoặc N/);
    env.call('TC_suaPhieuNhap', '1/2026/NK', { khachHang: 'A', daiLy: 'DL2', nguonGoc: 'NG2' });
    expect(dongCua(env, '1/2026/NK').slice(15, 17)).toEqual(['Y', 'DL2_NG2_Y']);
  });

  test('tra cứu + chi tiết trả Hình ảnh; ô P trống -> lấy theo đuôi Mã ĐG', () => {
    const env = createGasEnv();
    const p = phieu('2/2026/NK'); p[15] = ''; p[16] = 'DL1_NG1_N';
    nap(env, [phieu('1/2026/NK'), p]);
    const tim = env.call('TC_traCuuPhieuNhap', {}).data;
    expect(tim.map((r) => [r.maChungTu, r.hinhAnh]).sort()).toEqual([['1/2026/NK', 'Y'], ['2/2026/NK', 'N']]);
    expect(env.call('TC_chiTietPhieuNhap', '2/2026/NK').data.tomTat.hinhAnh).toBe('N');
  });
});

describe('Tính lại giá các phiếu ĐƯỢC CHỌN', () => {
  test('chỉ phiếu được chọn và chưa OK; bỏ qua phiếu OK / lưu trữ / không có, báo đủ số', () => {
    const env = createGasEnv();
    nap(env, [
      phieu('1/2026/NK'), phieu('2/2026/NK', { dl: 'DLX', ng: 'NGX' }), phieu('3/2026/NK', { y: 'OK' }), phieu('4/2026/NK'),
    ], { 2025: [phieu('9/2025/NK', { y: 'OK' })] });
    const res = env.call('TC_tinhLaiGiaCacPhieu', ['1/2026/NK', '2/2026/NK', '3/2026/NK', '9/2025/NK', 'KHONG', '1/2026/NK', ' ']);
    expect(res.status).toBe('success');
    expect(res).toMatchObject({ soPhieu: 2, soLoiBaoGia: 1, soBoQua: 3 });
    expect(res.message).toMatch(/2\/5 phiếu đã chọn.*1 phiếu Lỗi.*bỏ qua 3 phiếu/);
    expect(dongCua(env, '1/2026/NK')[25]).toBe(20000);
    expect(dongCua(env, '2/2026/NK')[24]).toBe('Lỗi ĐK/Báo giá');
    expect(dongCua(env, '3/2026/NK')[25]).toBe(999); // OK giữ nguyên
    expect(dongCua(env, '4/2026/NK')[25]).toBe(999); // không chọn -> giữ nguyên
  });

  test('không chọn phiếu nào / vượt giới hạn -> báo lỗi, không ghi', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK')]);
    mocks.resetApiCounter_();
    expect(env.call('TC_tinhLaiGiaCacPhieu', []).message).toMatch(/Chưa chọn/);
    expect(env.call('TC_tinhLaiGiaCacPhieu', Array.from({ length: 5001 }, (_, i) => i + '/2026/NK')).message).toMatch(/tối đa 5000/);
    expect(mocks.getApiCounter_().oWrite).toBe(0);
  });

  test('cập nhật Draft Chưa TT cho phiếu được chọn có trong Draft', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK'), phieu('2/2026/NK')]);
    const ss = env.spreadsheetApp.openById(PHIEUCAN_ID);
    ss.__setSheet(DRAFT, [header.slice(0, 26), phieu('2/2026/NK').slice(0, 26)]);
    expect(env.call('TC_tinhLaiGiaCacPhieu', ['1/2026/NK', '2/2026/NK']).message).toMatch(/cập nhật 1 phiếu trong Draft/);
    expect(ss.getSheetByName(DRAFT).__data[1][25]).toBe(20000);
  });

  test('khóa bận / Chỉ xem bị chặn', () => {
    const env = createGasEnv();
    nap(env, [phieu('1/2026/NK')]);
    env.lockService.__giuBoiPhienKhac = true;
    expect(env.call('TC_tinhLaiGiaCacPhieu', ['1/2026/NK']).message).toMatch(/bận/);
    const xem = createGasEnv({ email: 'xem@gmail.com', vaiTro: 'CHIXEM' });
    nap(xem, [phieu('1/2026/NK')]);
    expect(() => xem.call('TC_tinhLaiGiaCacPhieu', ['1/2026/NK'])).toThrow(/\[QUYEN\]/);
  });
});
