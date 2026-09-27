const crypto = require('crypto');
const { createGasEnv, ADMIN_GOC } = require('./gasEnv');

// Mô hình phân quyền hiện tại: Cổng đăng nhập Gmail (dự án riêng) ký "vé"
// HMAC-SHA256 -> doGet(?cong=...) đổi vé lấy mã phiên -> MỌI lời gọi từ giao
// diện đi qua API(maPhien, tenHam, thamSo). Xem Config.gs mục CỔNG ĐĂNG NHẬP.
const KHOA = 'khoa-bi-mat-test-0123456789abcdef';
const b64ws = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

function taoVe(email, opts) {
  opts = opts || {};
  const than = b64ws(Buffer.from(JSON.stringify({ v: 1, e: email, x: opts.hetHan || Date.now() + 4 * 60 * 1000, n: opts.nonce || crypto.randomUUID() })));
  const chuKy = b64ws(crypto.createHmac('sha256', opts.khoa || KHOA).update(than).digest());
  return than + '.' + chuKy;
}

function envCoCong(opts) {
  const env = createGasEnv(opts);
  env.propertiesService.getScriptProperties().setProperty('CONG_DN_KHOA_BI_MAT', KHOA);
  return env;
}

describe('Cổng đăng nhập: đổi vé lấy phiên (xuLyVeCong_)', () => {
  test('vé hợp lệ của Admin -> cấp mã phiên 64 ký tự hex, phiên dùng được với API()', () => {
    const env = envCoCong();
    const kq = env.call('xuLyVeCong_', taoVe(ADMIN_GOC));
    expect(kq.phien).toMatch(/^[a-f0-9]{64}$/);
    expect(env.callApi(kq.phien, 'HT_layThongTinNguoiDungHienTai').data.laAdmin).toBe(true);
  });

  test('email không có trong danh sách quyền -> KHÔNG cấp phiên', () => {
    const env = envCoCong();
    const kq = env.call('xuLyVeCong_', taoVe('nguoi-la@gmail.com'));
    expect(kq.phien).toBeUndefined();
    expect(kq.thongBao).toMatch(/chưa được cấp quyền/);
  });

  test('vé ký bằng khóa khác (Cổng giả mạo / mã nguồn cũ) -> từ chối', () => {
    const env = envCoCong();
    const kq = env.call('xuLyVeCong_', taoVe(ADMIN_GOC, { khoa: 'khoa-sai' }));
    expect(kq.phien).toBeUndefined();
    expect(kq.thongBao).toMatch(/sai chữ ký/);
  });

  test('vé hết hạn (quá 5 phút) -> từ chối', () => {
    const env = envCoCong();
    const kq = env.call('xuLyVeCong_', taoVe(ADMIN_GOC, { hetHan: Date.now() - 1000 }));
    expect(kq.thongBao).toMatch(/hết hạn/);
  });

  test('dùng lại cùng 1 vé (replay từ lịch sử trình duyệt) -> lần 2 bị từ chối', () => {
    const env = envCoCong();
    const ve = taoVe(ADMIN_GOC);
    expect(env.call('xuLyVeCong_', ve).phien).toBeTruthy();
    expect(env.call('xuLyVeCong_', ve).thongBao).toMatch(/đã được dùng/);
  });

  test('vé bị sửa nội dung (đổi email) nhưng giữ chữ ký cũ -> từ chối', () => {
    const env = envCoCong();
    const [, chuKy] = taoVe('nhanvien@gmail.com').split('.');
    const thanGia = b64ws(Buffer.from(JSON.stringify({ v: 1, e: ADMIN_GOC, x: Date.now() + 60000, n: crypto.randomUUID() })));
    expect(env.call('xuLyVeCong_', thanGia + '.' + chuKy).phien).toBeUndefined();
  });

  test('email Gmail khác dấu chấm / hoa thường / +hậu tố vẫn khớp đúng người trong danh sách', () => {
    const env = envCoCong();
    expect(env.call('xuLyVeCong_', taoVe('Sao.Luu.CVHak+abc@gmail.com')).phien).toBeTruthy();
  });
});

describe('doGet()', () => {
  test('chưa cài Cổng đăng nhập -> trang hướng dẫn cài đặt, KHÔNG render giao diện', () => {
    const env = createGasEnv();
    const out = env.call('doGet', { parameter: {} });
    expect(out.__html).toMatch(/Cần cài đặt Cổng đăng nhập/);
  });

  test('đã cài Cổng + vé hợp lệ -> render Index kèm mã phiên; cho phép nhúng iframe (Portal)', () => {
    const env = envCoCong();
    const out = env.call('doGet', { parameter: { cong: taoVe(ADMIN_GOC) } });
    expect(out.__template.__ten).toBe('Index');
    expect(JSON.parse(out.__template.phienMoiJson)).toMatch(/^[a-f0-9]{64}$/);
    expect(out.__xFrame).toBe('ALLOWALL');
  });

  test('mã phiên/thông báo nhúng vào trang được chặn "</script>" (chống XSS)', () => {
    const env = envCoCong();
    const out = env.call('doGet', { parameter: { cong: taoVe('<script>alert(1)</script>@gmail.com') } });
    expect(out.__template.thongBaoDangNhapJson).not.toMatch(/</);
  });
});

// Mức quyền mong đợi của từng chức năng: giữ ĐÚNG như trước khi chuyển sang bảng
// API_ROUTES (hàm có yeuCauQuyenAdmin_ -> Quản trị; danh sách Chỉ xem cũ -> Xem),
// thay đổi duy nhất: Sao lưu + Nhật ký mở cho vai trò Tổng hợp (HE_THONG).
const MONG_DOI = {
  QUAN_TRI: ['HT_layCauHinhVungMien', 'HT_luuCauHinhVungMien', 'HT_layLocaleThatCuaSheet', 'HT_xacNhanCauTrucSheetHienTai',
    'HT_layLienKetDuLieu', 'HT_luuLienKetDuLieu', 'HT_layMisaDefaults', 'HT_luuMisaDefaults',
    'HT_layDanhSachQuyen', 'HT_luuDanhSachQuyen', 'HT_chiaSeTaiNguyenChoDanhSachQuyen', 'HT_layTinhTrangChiaSeTaiNguyen',
    'HT_thuHoiQuyenTaiNguyen', 'HT_thuHoiToanBoQuyenDriveChoEmail', 'HT_layCauHinhCong', 'HT_layMaNguonCong', 'HT_luuLinkCong', 'HT_doiKhoaCong'],
  HE_THONG: ['HT_layTinhTrangSaoLuu', 'HT_luuCauHinhSaoLuu', 'HT_saoLuuNgay', 'HT_layNhatKy', 'HT_xuatNhatKyExcel'],
  XEM: ['HT_layThongTinNguoiDungHienTai', 'HT_layDashboard', 'getFilterOptions', 'getDataForGiaoDichForm',
    'getBaoCaoTongHop', 'getBaoCaoMisa', 'getBaoCaoDonGia', 'exportBaoCaoTongHopExcel', 'exportBaoCaoTongHopPDF',
    'exportBaoCaoMisaExcel', 'exportBaoCaoMisaPDF', 'exportBaoCaoDonGiaExcel', 'exportBaoCaoDonGiaPDF', 'exportPhieuCanPDF',
    'XH_getBaoCaoXuatQuaCan', 'XH_getBaoCaoXuatMisa', 'XH_exportBaoCaoXuatQuaCanExcel', 'XH_exportBaoCaoXuatQuaCanPDF', 'XH_exportBaoCaoXuatMisaExcel',
    'XH_getDonHangList', 'XH_getDonHangByRow', 'XH_getKhoXuatList', 'XH_tinhDoKhoNhaMay',
    'BG_getQuoteList', 'BG_getQuoteListWithStatus', 'BG_getQuoteDetail', 'BG_showAllData', 'BG_getBaogiaRowByHash',
    'BG_getMaBaoGiaList', 'BG_getMaKLList', 'BG_exportFileSmart', 'BG_updateHieuLuc',
    'layBaoCaoTonKho', 'layDanhSachDanhMucKho', 'layDanhSachDoKhoTheoBoLoc', 'layDanhSachKyVetBai'],
};
const QUYEN_CUA_VAI_TRO = { CHIXEM: ['XEM'], NHANVIEN: ['XEM', 'NGHIEP_VU'], TONG_HOP: ['XEM', 'NGHIEP_VU', 'HE_THONG'], ADMIN: ['XEM', 'NGHIEP_VU', 'HE_THONG', 'QUAN_TRI'] };

describe('Bảng phân quyền API_ROUTES', () => {
  test('mức quyền từng chức năng giữ đúng như trước (chỉ mở Sao lưu/Nhật ký cho Tổng hợp)', () => {
    const routes = createGasEnv().context.API_ROUTES_();
    const thucTe = {};
    Object.keys(routes).forEach((ten) => {
      const r = routes[ten];
      const q = r.quyenTheoThaoTac ? 'THEO_THAO_TAC' : r.quyen;
      (thucTe[q] = thucTe[q] || []).push(ten);
    });
    ['QUAN_TRI', 'HE_THONG', 'XEM'].forEach((q) => expect((thucTe[q] || []).sort()).toEqual(MONG_DOI[q].slice().sort()));
    expect(thucTe.THEO_THAO_TAC).toEqual(['processFormData']);
    expect(routes.processFormData.quyenTheoThaoTac).toEqual({
      Danhmuckho: 'NGHIEP_VU', Thongsokho: 'NGHIEP_VU', Nhapdokho: 'NGHIEP_VU', Nhapkho: 'NGHIEP_VU', Xuatkho: 'NGHIEP_VU',
      Hoanthanhdonhang: 'NGHIEP_VU', HoanthanhTuDong: 'NGHIEP_VU', Baocaotonkho: 'XEM', BaocaoKyVetBai: 'XEM',
    });
  });

  test('mọi chức năng trong bảng đều trỏ tới hàm nội bộ (tên kết thúc "_") có thật', () => {
    const routes = createGasEnv().context.API_ROUTES_();
    Object.keys(routes).forEach((ten) => {
      expect(typeof routes[ten].fn).toBe('function');
      expect(routes[ten].fn.name).toBe(ten + '_');
    });
  });

  test('trình duyệt chỉ gọi thẳng được đúng các hàm cổng/đăng nhập/trigger - mọi hàm nghiệp vụ là nội bộ', () => {
    const fs = require('fs'); const path = require('path');
    const src = ['Config.gs', 'Code.gs'].map((f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
    const congKhai = [...src.matchAll(/^function ([A-Za-z0-9_$]+)\s*\(/gm)].map((m) => m[1]).filter((n) => !n.endsWith('_')).sort();
    expect(congKhai).toEqual(['API', 'CAI_DAT_CONG_DANG_NHAP', 'DN_dangXuat', 'DN_kiemTraPhien', 'DN_layLinkDangNhap', 'TRIGGER_saoLuuHangDem', 'doGet', 'runCalculatePrice'].sort());
  });

  describe.each(Object.keys(QUYEN_CUA_VAI_TRO))('Vai trò %s: được/không được gọi đúng từng chức năng', (vaiTro) => {
    const env = createGasEnv(vaiTro === 'ADMIN' ? {} : { email: 'nd-' + vaiTro.toLowerCase() + '@gmail.com', vaiTro });
    const routes = env.context.API_ROUTES_();
    const ma = env.maPhien();
    const ca = [];
    Object.keys(routes).forEach((ten) => {
      if (routes[ten].quyenTheoThaoTac) Object.keys(routes[ten].quyenTheoThaoTac).forEach((tt) => ca.push([ten, tt, routes[ten].quyenTheoThaoTac[tt]]));
      else ca.push([ten, null, routes[ten].quyen]);
    });
    test.each(ca)('%s %s (%s)', (ten, thaoTac, quyen) => {
      let loi = '';
      try { env.callApi(ma, ten, ...(thaoTac ? [thaoTac, {}] : [])); } catch (e) { loi = String(e.message || e); }
      if (QUYEN_CUA_VAI_TRO[vaiTro].includes(quyen)) expect(loi).not.toMatch(/\[QUYEN\]|PHIEN_HET_HAN/);
      else expect(loi).toMatch(/^\[QUYEN\] .*không có quyền/);
    });
  });
});

describe('API(maPhien, tenHam, thamSo) - cổng duy nhất', () => {
  test('không có / sai / hết hạn phiên -> PHIEN_HET_HAN (giao diện tự hiện màn hình đăng nhập)', () => {
    const env = createGasEnv();
    expect(() => env.callApi('', 'HT_layDashboard')).toThrow(/PHIEN_HET_HAN/);
    expect(() => env.callApi('a'.repeat(64), 'HT_layDashboard')).toThrow(/PHIEN_HET_HAN/);
  });

  test('chức năng không có trong bảng / thao tác Kho Dăm lạ -> từ chối', () => {
    const env = createGasEnv();
    const ma = env.maPhien();
    ['taoKhoaCongMoi_', 'CAI_DAT_CONG_DANG_NHAP', 'constructor', '__proto__', 'toString'].forEach((ten) =>
      expect(() => env.callApi(ma, ten)).toThrow(/Chức năng không tồn tại/));
    expect(() => env.callApi(ma, 'processFormData', 'XoaHet', {})).toThrow(/Thao tác không tồn tại/);
  });

  test('thu hồi quyền có hiệu lực NGAY ở lần gọi kế tiếp', () => {
    const env = createGasEnv({ email: 'nv@gmail.com', vaiTro: 'NHANVIEN' });
    const maNV = env.maPhien();
    expect(env.callApi(maNV, 'HT_layThongTinNguoiDungHienTai').status).toBe('success');
    env.session.__setEmail(ADMIN_GOC);
    env.call('HT_luuDanhSachQuyen', [{ email: ADMIN_GOC, vaiTro: 'ADMIN' }]);
    expect(() => env.callApi(maNV, 'HT_layThongTinNguoiDungHienTai')).toThrow(/không còn trong danh sách/);
  });
});

describe('Danh sách người dùng: sheet SYS_NguoiDung trong file chứa script', () => {
  const layShNguoiDung = (env) => env.spreadsheetApp.getActive().getSheetByName('SYS_NguoiDung');

  test('lưu vào đúng file chứa script, đủ cột Email/Họ tên/Vai trò/Trạng thái/Quyền Drive/Cập nhật lúc/Cập nhật bởi', () => {
    const env = createGasEnv();
    expect(layShNguoiDung(env)).toBeNull(); // chỉ đọc thì không tạo sheet
    const res = env.call('HT_luuDanhSachQuyen', [
      { email: ADMIN_GOC, hoTen: 'Admin', vaiTro: 'ADMIN' },
      { email: 'KeToan@Gmail.com', hoTen: 'Kế toán A', vaiTro: 'TONG_HOP', trangThai: 'Hoạt động', quyenDrive: 'VIEWER' },
    ]);
    expect(res.status).toBe('success');
    const sh = layShNguoiDung(env);
    expect(sh.__data[0]).toEqual(['Email', 'Họ tên', 'Vai trò', 'Trạng thái', 'Quyền Drive', 'Cập nhật lúc', 'Cập nhật bởi']);
    expect(sh.__data[2].slice(0, 5)).toEqual(['ketoan@gmail.com', 'Kế toán A', 'TONG_HOP', 'Hoạt động', 'VIEWER']);
    expect(sh.__data[2][6]).toBe(ADMIN_GOC);
  });

  test('lưu lại không đổi gì -> giữ nguyên "Cập nhật lúc/bởi" của dòng cũ', () => {
    const env = createGasEnv();
    env.call('HT_luuDanhSachQuyen', [{ email: ADMIN_GOC, vaiTro: 'ADMIN' }, { email: 'a@gmail.com', vaiTro: 'NHANVIEN' }]);
    const sh = layShNguoiDung(env);
    sh.__data[2][5] = 'MOC_CU'; sh.__data[2][6] = 'nguoi-cu@gmail.com';
    env.call('HT_luuDanhSachQuyen', [{ email: ADMIN_GOC, vaiTro: 'ADMIN' }, { email: 'a@gmail.com', vaiTro: 'NHANVIEN' }]);
    expect(sh.__data[2].slice(5)).toEqual(['MOC_CU', 'nguoi-cu@gmail.com']);
  });

  test('tài khoản bị Khóa: không đăng nhập được, phiên đang mở bị chặn ngay', () => {
    const env = envCoCong({ email: 'nv@gmail.com', vaiTro: 'NHANVIEN' });
    const ma = env.maPhien();
    env.session.__setEmail(ADMIN_GOC);
    env.call('HT_luuDanhSachQuyen', [{ email: ADMIN_GOC, vaiTro: 'ADMIN' }, { email: 'nv@gmail.com', vaiTro: 'NHANVIEN', trangThai: 'Khóa' }]);
    expect(() => env.callApi(ma, 'HT_layDashboard')).toThrow(/nv@gmail\.com đã bị khóa/);
    expect(env.call('xuLyVeCong_', taoVe('nv@gmail.com')).phien).toBeUndefined();
  });

  test('Quản trị cố định: luôn là Quản trị dù không có trong sheet hoặc bị đặt Khóa/Chỉ xem', () => {
    const env = envCoCong();
    env.call('HT_luuDanhSachQuyen', [{ email: ADMIN_GOC, vaiTro: 'ADMIN' }, { email: 'phuthuy.apple@gmail.com', vaiTro: 'CHIXEM', trangThai: 'Khóa' }]);
    const kq = env.call('xuLyVeCong_', taoVe('phuthuy.apple@gmail.com'));
    expect(kq.phien).toMatch(/^[a-f0-9]{64}$/);
    const nd = env.callApi(kq.phien, 'HT_layThongTinNguoiDungHienTai').data;
    expect(nd.vaiTro).toBe('ADMIN');
    expect(nd.quyen).toEqual(['XEM', 'NGHIEP_VU', 'HE_THONG', 'QUAN_TRI']);
  });

  test('Tổng hợp: làm được Sao lưu/Nhật ký nhưng không vào được Người dùng/Cấu hình', () => {
    const env = createGasEnv({ email: 'th@gmail.com', vaiTro: 'TONG_HOP' });
    expect(() => env.call('HT_layNhatKy', {})).not.toThrow(/\[QUYEN\]/);
    expect(() => env.call('HT_layDanhSachQuyen')).toThrow(/\[QUYEN\].*Tổng hợp/);
    const nd = env.call('HT_layThongTinNguoiDungHienTai').data;
    expect(nd.vaiTroNhan).toBe('Tổng hợp');
  });

  test('tự chuyển danh sách cũ (Script Properties) sang sheet ở lần đọc đầu tiên, rồi không chuyển lại', () => {
    const env = createGasEnv();
    const props = env.propertiesService.getScriptProperties();
    props.setProperty('DANH_SACH_QUYEN_JSON', JSON.stringify([
      { email: ADMIN_GOC, vaiTro: 'ADMIN', quyenDrive: 'EDITOR' },
      { email: 'cu@gmail.com', vaiTro: 'CHIXEM', quyenDrive: 'VIEWER' },
    ]));
    const ds = env.call('DS_QUYEN_');
    expect(ds.map((u) => [u.email, u.vaiTro, u.trangThai, u.quyenDrive])).toEqual([
      [ADMIN_GOC, 'ADMIN', 'Hoạt động', 'EDITOR'], ['cu@gmail.com', 'CHIXEM', 'Hoạt động', 'VIEWER']]);
    expect(layShNguoiDung(env).__data[1][6]).toBe('Chuyển từ danh sách cũ');
    expect(props.getProperty('ND_DA_CHUYEN_SANG_SHEET')).toBe('1');
  });

  test('sửa thẳng trên sheet có hiệu lực khi hết bộ nhớ đệm (<= 60 giây)', () => {
    const env = createGasEnv({ email: 'nv@gmail.com', vaiTro: 'NHANVIEN' });
    const sh = layShNguoiDung(env);
    const dong = sh.__data.findIndex((r) => r[0] === 'nv@gmail.com');
    sh.__data[dong][2] = 'CHIXEM';
    env.cacheService.__store.delete('sys_nguoi_dung_v1'); // giả lập hết 60 giây
    expect(env.call('HT_layThongTinNguoiDungHienTai').data.vaiTro).toBe('CHIXEM');
  });
});

describe('HT_luuDanhSachQuyen() - kiểm tra dữ liệu', () => {
  let env;
  beforeEach(() => { env = createGasEnv(); });
  test('từ chối danh sách rỗng', () => { expect(env.call('HT_luuDanhSachQuyen', []).status).toBe('error'); });
  test('từ chối khi không còn Quản trị đang hoạt động', () => {
    expect(env.call('HT_luuDanhSachQuyen', [{ email: 'nv1@gmail.com', vaiTro: 'NHANVIEN' }]).status).toBe('error');
    expect(env.call('HT_luuDanhSachQuyen', [{ email: 'a@gmail.com', vaiTro: 'ADMIN', trangThai: 'Khóa' }]).status).toBe('error');
  });
  test('từ chối email không hợp lệ', () => {
    expect(env.call('HT_luuDanhSachQuyen', [{ email: ADMIN_GOC, vaiTro: 'ADMIN' }, { email: 'khong-phai-email', vaiTro: 'NHANVIEN' }]).status).toBe('error');
  });
  test('vai trò lạ -> Nhân viên; trạng thái lạ -> Hoạt động; email trùng giữ dòng đầu', () => {
    env.call('HT_luuDanhSachQuyen', [{ email: ADMIN_GOC, vaiTro: 'ADMIN' }, { email: 'x@gmail.com', vaiTro: 'SIEU_NHAN', trangThai: '???' }, { email: 'X@gmail.com', vaiTro: 'ADMIN' }]);
    const ds = env.call('DS_QUYEN_');
    expect(ds).toHaveLength(2);
    expect([ds[1].vaiTro, ds[1].trangThai]).toEqual(['NHANVIEN', 'Hoạt động']);
  });
});
