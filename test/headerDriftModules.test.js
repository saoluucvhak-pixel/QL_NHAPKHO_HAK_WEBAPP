const { createGasEnv } = require('./gasEnv');

// BUG-002: cảnh báo lệch cột (kiemTraLechHeaderSheet_) trước đây chỉ có ở
// PhieuCan_DN / NL_PC_XH / NL_DH_XB - nay mở rộng sang Báo giá và Kho Dăm.
// Chỉ CẢNH BÁO kèm theo thông báo thành công, KHÔNG chặn ghi (giữ nguyên nghiệp vụ).
const ADMIN = 'saoluucvhak@gmail.com';
const BAOGIA_ID = '1SIhfjP5-6ouRPDj265lAMmI5yWs1XcnedjqpzDwaIC0';
const KHODAM_ID = '1MQ6eCOKgJyd4t1J84nA24hvkjSTufdH8jhJX-EJTWQU';

describe('BUG-002: cảnh báo lệch cột cho sheet Báo giá', () => {
  test('Ma_KL: lần đầu chụp chuẩn, bị chèn cột -> lần sau vẫn lưu thành công NHƯNG kèm cảnh báo', () => {
    const env = createGasEnv({ email: ADMIN });
    const sheet = env.spreadsheetApp.openById(BAOGIA_ID).__setSheet('Ma_KL', [['Timestamp', 'Mã KL', 'KL Min', 'KL Max']]);

    const lan1 = env.call('BG_addMaKL', { klMinTan: 0, klMaxTan: 45 });
    expect(lan1.status).toBe('success');
    expect(lan1.message).not.toMatch(/CẢNH BÁO/);

    sheet.__data[0] = ['Timestamp', 'CỘT CHÈN THÊM', 'Mã KL', 'KL Min'];
    const lan2 = env.call('BG_addMaKL', { klMinTan: 45, klMaxTan: 100 });
    expect(lan2.status).toBe('success');
    expect(lan2.message).toMatch(/CẢNH BÁO cấu trúc Sheet "Ma_KL"/);
  });

  test('Admin xác nhận cấu trúc mới -> tắt cảnh báo cho sheet Báo giá', () => {
    const env = createGasEnv({ email: ADMIN });
    const sheet = env.spreadsheetApp.openById(BAOGIA_ID).__setSheet('Ma_KL', [['Timestamp', 'Mã KL', 'KL Min', 'KL Max']]);
    env.call('BG_addMaKL', { klMinTan: 0, klMaxTan: 45 });
    sheet.__data[0] = ['Timestamp', 'Mã KL', 'KL Min (kg)', 'KL Max (kg)'];
    expect(env.call('HT_xacNhanCauTrucSheetHienTai').status).toBe('success');
    const res = env.call('BG_addMaKL', { klMinTan: 45, klMaxTan: 100 });
    expect(res.status).toBe('success');
    expect(res.message).not.toMatch(/CẢNH BÁO/);
  });
});

describe('BUG-002: cảnh báo lệch cột cho sheet Kho Dăm (processFormData)', () => {
  const themKho = { hanhDong: 'THEM', tenNhaMay: 'NM1', tenKho: 'Kho A', ngayKhoiTao: '2026-01-01' };

  test('SYS_DANHMUCKHO bị đổi thứ tự cột -> vẫn thêm kho thành công, kèm cảnh báo', () => {
    const env = createGasEnv({ email: ADMIN });
    const lan1 = env.call('processFormData', 'Danhmuckho', themKho);
    expect(lan1).toBe('✅ Đã thêm kho.');

    const sheet = env.spreadsheetApp.openById(KHODAM_ID).getSheetByName('SYS_DANHMUCKHO');
    sheet.__data[0] = ['Mã kho', 'Tên Kho Hàng', 'Tên Nhà Máy', 'Ngày Khởi Tạo', 'Trạng thái'];
    const lan2 = env.call('processFormData', 'Danhmuckho', themKho);
    expect(lan2).toMatch(/^✅ Đã thêm kho\. \| ⚠️ CẢNH BÁO cấu trúc Sheet "SYS_DANHMUCKHO"/);
  });

  test('cấu trúc không đổi -> thông báo giữ nguyên y hệt như trước khi sửa', () => {
    const env = createGasEnv({ email: ADMIN });
    env.call('processFormData', 'Danhmuckho', themKho);
    expect(env.call('processFormData', 'Danhmuckho', themKho)).toBe('✅ Đã thêm kho.');
  });

  test('hành động chỉ ĐỌC báo cáo (trả object) không bị chèn chuỗi cảnh báo', () => {
    const env = createGasEnv({ email: ADMIN });
    expect(env.call('KD_canhBaoLechHeader_', 'Baocaotonkho')).toBe('');
  });
});
