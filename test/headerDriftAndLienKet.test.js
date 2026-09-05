const { createGasEnv } = require('./gasEnv');
const { makeFakeSheet } = require('./gasMocks');

describe('kiemTraLechHeaderSheet_() - cảnh báo lệch cấu trúc cột (tự học, không cần biết trước header đúng)', () => {
  test('sheet trống (chưa có header) -> không cảnh báo gì (không có gì để chụp)', () => {
    const env = createGasEnv();
    const sheet = makeFakeSheet('Test', []);
    expect(env.call('kiemTraLechHeaderSheet_', sheet, 'PhieuCan_DN', 5)).toBe('');
  });

  test('lần đầu tiên gọi trên 1 sheet có dữ liệu -> chỉ CHỤP LÀM CHUẨN, chưa cảnh báo', () => {
    const env = createGasEnv();
    const sheet = makeFakeSheet('Test', [
      ['Số phiếu', 'Ngày cân 1', 'Giờ cân 1', 'Ngày cân 2', 'Giờ cân 2'],
      ['001', '', '', '', ''],
    ]);
    const canhBao = env.call('kiemTraLechHeaderSheet_', sheet, 'PhieuCan_DN', 5);
    expect(canhBao).toBe('');
  });

  test('gọi lần 2 với header GIỐNG HỆT -> vẫn không cảnh báo', () => {
    const env = createGasEnv();
    const header = ['Số phiếu', 'Ngày cân 1', 'Giờ cân 1', 'Ngày cân 2', 'Giờ cân 2'];
    const sheet1 = makeFakeSheet('Test', [header.slice()]);
    env.call('kiemTraLechHeaderSheet_', sheet1, 'PhieuCan_DN', 5); // lần 1: chụp chuẩn

    const sheet2 = makeFakeSheet('Test', [header.slice()]); // "lần chạy sau" - sheet mới nhưng cùng header
    const canhBao = env.call('kiemTraLechHeaderSheet_', sheet2, 'PhieuCan_DN', 5);
    expect(canhBao).toBe('');
  });

  test('phát hiện cột bị đổi tên/thứ tự -> trả về cảnh báo nêu rõ cột nào, cũ/mới là gì', () => {
    const env = createGasEnv();
    const headerGoc = ['Số phiếu', 'Ngày cân 1', 'Giờ cân 1', 'Ngày cân 2', 'Giờ cân 2'];
    env.call('kiemTraLechHeaderSheet_', makeFakeSheet('Test', [headerGoc]), 'PhieuCan_DN', 5);

    const headerBiDoi = ['Số phiếu', 'Ghi chú (cột chèn nhầm)', 'Ngày cân 1', 'Giờ cân 1', 'Ngày cân 2'];
    const canhBao = env.call('kiemTraLechHeaderSheet_', makeFakeSheet('Test', [headerBiDoi]), 'PhieuCan_DN', 5);

    expect(canhBao).toMatch(/CẢNH BÁO/);
    expect(canhBao).toMatch(/PhieuCan_DN/);
    expect(canhBao).toMatch(/Cột 2/);
    expect(canhBao).toMatch(/Ngày cân 1/); // tên cũ xuất hiện trong thông báo
  });

  test('2 sheet khác nhau (tenGoiSheet khác) có baseline ĐỘC LẬP, không ảnh hưởng lẫn nhau', () => {
    const env = createGasEnv();
    env.call('kiemTraLechHeaderSheet_', makeFakeSheet('A', [['X', 'Y']]), 'SHEET_A', 2);
    env.call('kiemTraLechHeaderSheet_', makeFakeSheet('B', [['M', 'N']]), 'SHEET_B', 2);

    // Đổi header của SHEET_A - không được làm cảnh báo "rò" sang SHEET_B
    const canhBaoA = env.call('kiemTraLechHeaderSheet_', makeFakeSheet('A', [['X', 'ĐÃ ĐỔI']]), 'SHEET_A', 2);
    const canhBaoB = env.call('kiemTraLechHeaderSheet_', makeFakeSheet('B', [['M', 'N']]), 'SHEET_B', 2);
    expect(canhBaoA).toMatch(/CẢNH BÁO/);
    expect(canhBaoB).toBe('');
  });
});

describe('HT_xacNhanCauTrucSheetHienTai() / HT_datLaiChuanHeaderSheet_() - Admin xác nhận cấu trúc mới sau thay đổi hợp lệ', () => {
  test('sau khi đổi header hợp lệ rồi xác nhận, cảnh báo TẮT cho header mới đó', () => {
    const env = createGasEnv();
    const headerGoc = ['Số phiếu', 'Ngày cân 1'];
    env.call('kiemTraLechHeaderSheet_', makeFakeSheet('Test', [headerGoc]), 'PhieuCan_DN', 2);

    const headerMoiHopLe = ['Số phiếu', 'Ngày cân 1 (mới)'];
    // Trước khi xác nhận: vẫn cảnh báo lệch
    expect(env.call('kiemTraLechHeaderSheet_', makeFakeSheet('Test', [headerMoiHopLe]), 'PhieuCan_DN', 2)).toMatch(/CẢNH BÁO/);

    // Admin dùng HT_datLaiChuanHeaderSheet_ (hàm lõi được HT_xacNhanCauTrucSheetHienTai gọi) để chốt chuẩn mới
    env.call('HT_datLaiChuanHeaderSheet_', 'PhieuCan_DN', makeFakeSheet('Test', [headerMoiHopLe]));

    // Sau khi xác nhận: header mới không còn bị coi là "lệch" nữa
    expect(env.call('kiemTraLechHeaderSheet_', makeFakeSheet('Test', [headerMoiHopLe]), 'PhieuCan_DN', 2)).toBe('');
  });

  test('HT_xacNhanCauTrucSheetHienTai bị chặn nếu không phải Admin (đã kiểm tra ở permission.test.js, kiểm tra lại 1 lần trực tiếp ở đây)', () => {
    const env = createGasEnv({ email: 'ai-do@gmail.com' });
    const res = env.call('HT_xacNhanCauTrucSheetHienTai');
    expect(res.status).toBe('error');
  });
});

describe('Liên kết dữ liệu (LIENKET) - ghi đè ID Spreadsheet/Thư mục qua giao diện', () => {
  const ADMIN_EMAIL = 'phuthuy.apple@gmail.com';

  test('chưa ghi đè gì -> HT_layLienKetDuLieu trả về đúng giá trị GỐC trong code, daGhiDe=false', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    const res = env.call('HT_layLienKetDuLieu');
    expect(res.status).toBe('success');
    const item = res.data.find((x) => x.key === 'CONFIG_SPREADSHEET_ID');
    expect(item.daGhiDe).toBe(false);
    expect(item.giaTri).toBe(item.giaTriGoc);
    expect(item.giaTri).toBe('1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g');
  });

  test('ghi đè 1 ID hợp lệ -> áp dụng NGAY (không cần khởi động lại), đúng như tài liệu mô tả', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    const idMoi = 'a'.repeat(33); // 33 ký tự, khớp regex /^[a-zA-Z0-9_-]{15,60}$/
    const saveRes = env.call('HT_luuLienKetDuLieu', { CONFIG_SPREADSHEET_ID: idMoi });
    expect(saveRes.status).toBe('success');

    const res = env.call('HT_layLienKetDuLieu');
    const item = res.data.find((x) => x.key === 'CONFIG_SPREADSHEET_ID');
    expect(item.daGhiDe).toBe(true);
    expect(item.giaTri).toBe(idMoi);
    expect(item.giaTriGoc).toBe('1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g'); // vẫn nhớ giá trị gốc để khôi phục
  });

  test('từ chối giá trị KHÔNG giống ID Google hợp lệ (VD dán nhầm cả URL đầy đủ)', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    const res = env.call('HT_luuLienKetDuLieu', {
      CONFIG_SPREADSHEET_ID: 'https://docs.google.com/spreadsheets/d/abc123/edit',
    });
    expect(res.status).toBe('error');
  });

  test('để trống ô ghi đè -> tự khôi phục về giá trị GỐC trong code', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    const idMoi = 'b'.repeat(20);
    env.call('HT_luuLienKetDuLieu', { CONFIG_SPREADSHEET_ID: idMoi });
    expect(env.call('HT_layLienKetDuLieu').data.find((x) => x.key === 'CONFIG_SPREADSHEET_ID').daGhiDe).toBe(true);

    env.call('HT_luuLienKetDuLieu', {}); // gửi object rỗng = mọi ô đều "để trống"
    const item = env.call('HT_layLienKetDuLieu').data.find((x) => x.key === 'CONFIG_SPREADSHEET_ID');
    expect(item.daGhiDe).toBe(false);
    expect(item.giaTri).toBe(item.giaTriGoc);
  });

  test('BUG ĐÃ SỬA: engine tính giá (runCalculatePrice_core, qua BG_ss_) đọc đúng Spreadsheet Báo giá đã ghi đè, không còn dùng URL cứng CONFIG.URL_BAO_GIA', () => {
    const env = createGasEnv({ email: ADMIN_EMAIL });
    const idBaoGiaMoi = 'c'.repeat(25);
    env.call('HT_luuLienKetDuLieu', { BAOGIA_SPREADSHEET_ID: idBaoGiaMoi });

    // BG_ss_() phải mở ĐÚNG spreadsheet vừa ghi đè (không phải ID gốc trong code)
    const ssBG = env.call('BG_ss_');
    expect(ssBG.getId()).toBe(idBaoGiaMoi);
  });
});
