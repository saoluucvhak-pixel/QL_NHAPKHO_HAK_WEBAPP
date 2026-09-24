const { createGasEnv } = require('./gasEnv');
const { napDuLieuLon, doLuong } = require('./perfFixtures');

// Hiệu năng trên Apps Script = SỐ LỜI GỌI Sheets API + SỐ Ô đọc/ghi (mỗi lời gọi
// là 1 lượt mạng tới Google Sheets), không phải thời gian CPU của Node. Các
// ngưỡng dưới đây khóa lại kết quả sau tối ưu PERF-01..04 để không bị thoái lui.
// STATIC ANALYSIS + MÔ PHỎNG - thời gian thật trên Google CHƯA đo runtime.
const ADMIN = 'saoluucvhak@gmail.com';
const QUY_MO = { soDongNong: 10000, soDongMoiNamLuuTru: 22500, soNamLuuTru: 4, tiLeChuaChot: 0.02 }; // 100.000 phiếu

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const HOM_NAY = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

let env;
beforeAll(() => {
  env = createGasEnv({ email: ADMIN });
  napDuLieuLon(env, QUY_MO);
});

describe('Tải 100.000 phiếu cân (10.000 đang hoạt động + 4 năm lưu trữ)', () => {
  test('PERF-01 getFilterOptions (mỗi lần mở trang): chỉ đọc 12 cột; từ lần 2 KHÔNG đọc lại sheet lưu trữ', () => {
    const lan1 = doLuong(env, 'getFilterOptions');
    expect(lan1.res.status).toBe('success');
    expect(lan1.oRead).toBeLessThanOrEqual(100000 * 12); // trước sửa: 100.000 x 17 = 1.700.000 ô

    const lan2 = doLuong(env, 'getFilterOptions');
    expect(lan2.oRead).toBeLessThanOrEqual(QUY_MO.soDongNong * 12); // chỉ còn sheet đang hoạt động
    expect(lan2.res).toEqual(lan1.res); // danh sách dropdown y hệt
    expect(lan1.res.khachHangList).toHaveLength(200);
    expect(lan1.res.xeList).toHaveLength(300);
  });

  test('PERF-01: thêm phiếu vào năm lưu trữ (chốt sổ tiếp) -> cache tự làm mới, giá trị mới hiện ngay', () => {
    const e2 = createGasEnv({ email: ADMIN });
    napDuLieuLon(e2, { soDongNong: 10, soDongMoiNamLuuTru: 10, soNamLuuTru: 1 });
    e2.call('getFilterOptions');
    const nam = now.getFullYear() - 1;
    const sh = e2.spreadsheetApp.openById('1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g').getSheetByName('PhieuCan_DN_' + nam);
    const r = new Array(27).fill(''); r[5] = 'XE-MOI'; r[11] = 'KH MOI';
    sh.__data.push(r);
    const res = e2.call('getFilterOptions');
    expect(res.xeList).toContain('XE-MOI');
    expect(res.khachHangList).toContain('KH MOI');
  });

  test('PERF-02 Dashboard: đọc sheet đang hoạt động đúng 1 lần (trước sửa: 2 lần)', () => {
    const r = doLuong(env, 'HT_layDashboard');
    expect(r.res.status).toBe('success');
    expect(r.oRead).toBeLessThanOrEqual(QUY_MO.soDongNong * 27 + 5000);
    expect(r.res.data.homNay.soLuong).toBeGreaterThan(0);
  });

  test('PERF-03 Báo cáo chỉ nhập "Đến ngày": không dò từng năm từ 2000', () => {
    const r = doLuong(env, 'getBaoCaoTongHop', { toDate: HOM_NAY });
    expect(r.res.status).toBe('success');
    expect(r.calls.getSheetByName || 0).toBeLessThanOrEqual(1 + QUY_MO.soNamLuuTru); // trước sửa: 27+
  });

  test('PERF-04 Tính giá: tối đa 4 lệnh Sheets cho mỗi khối dòng chờ tính giá (trước sửa: 10)', () => {
    const e3 = createGasEnv({ email: ADMIN });
    napDuLieuLon(e3, { soDongNong: 10000, tiLeChuaChot: 0.02 }); // 200 dòng chờ, rải rác
    const r = doLuong(e3, 'runCalculatePrice_core');
    expect(r.res.status).toBe('success');
    expect(r.tongLoiGoi).toBeLessThanOrEqual(200 * 4 + 20);
  });

  test('CẢNH BÁO (chưa sửa - cần quyết định nghiệp vụ): báo cáo KHÔNG lọc ngày trả về toàn bộ lịch sử', () => {
    const r = doLuong(env, 'getBaoCaoTongHop', {});
    expect(r.res.data).toHaveLength(100000);
    // ~34MB JSON gửi về trình duyệt + vẽ 100.000 dòng bảng -> nguy cơ treo tab.
    expect(r.payload).toBeGreaterThan(30 * 1024 * 1024);
  });
});
