const { createGasEnv } = require('./gasEnv');
const mocks = require('./gasMocks');
const { napDuLieuLon, doLuong, PHIEUCAN_ID } = require('./perfFixtures');
const { napBaoGiaLon, BAOGIA_ID } = require('./bgFixtures');

// Module Quản lý báo giá:
// BUG-BG-01: engine tính giá đọc Baogia_DN_SAVE nhưng sheet này chỉ được ghi lại khi
//   bấm "Xem toàn bộ lịch sử" -> tạo/sửa/xóa báo giá xong vẫn tính theo giá CŨ.
// PERF-BG-01..03: đọc phiếu cân 2 cột, đúng các năm cần, kiểm tra cả phiếu báo giá 1 lần.

function nenBaoGia(env) {
  const bg = env.spreadsheetApp.openById(BAOGIA_ID);
  const t0 = new Date(2026, 0, 1);
  bg.__setSheet('QL_BaoGia', [['a', 'b', 'c', 'd', 'e'], [t0, 'BG1', t0, t0, '']]);
  bg.__setSheet('Baogia_DN', [new Array(8).fill('H'), [t0, t0, 'DL1_NG1_Y', '0_1000', 1000, 'a', 'ID1', 'BG1']]);
  bg.__setSheet('Ma_BaoGia', [new Array(7).fill('H'), ['s', 'DL1_NG1_Y', 'DL1', 'NG1', 'Y', 'x', '']]);
  bg.__setSheet('Ma_KL', [['a', 'b', 'c', 'd'], [t0, '0_1000', 0, 1e6]]);
  bg.__setSheet('Baogia_DN_FINAL', [new Array(14).fill('H')]);
  bg.__setSheet('Baogia_DN_SAVE', [new Array(14).fill('H')]);
  const r = new Array(27).fill(''); r[0] = '1'; r[1] = new Date(2026, 8, 20); r[9] = 20000; r[16] = 'DL1_NG1_Y'; r[21] = '1/2026/NK';
  env.spreadsheetApp.openById(PHIEUCAN_ID).__setSheet('PhieuCan_DN', [new Array(27).fill('H'), r]);
  env.call('BG_showAllData');
  return bg;
}
const donGiaPhieu = (env) => { env.call('runCalculatePrice'); return env.spreadsheetApp.openById(PHIEUCAN_ID).getSheetByName('PhieuCan_DN').__data[1][23]; };

describe('BUG-BG-01: tạo/sửa/xóa báo giá -> tính giá dùng NGAY bảng giá mới', () => {
  test('tạo báo giá mới -> phiếu cân sau ngày hiệu lực lấy giá mới (không cần bấm "Xem toàn bộ")', () => {
    const env = createGasEnv();
    nenBaoGia(env);
    expect(donGiaPhieu(env)).toBe(1000);
    expect(env.call('BG_createQuote', { ngayBaoGia: '2026-09-01', hieuLuc: '2026-09-01T00:00', groups: [{ maList: ['DL1_NG1_Y'], klCode: '0_1000', gia: 2000 }] }).status).toBe('success');
    expect(donGiaPhieu(env)).toBe(2000);
  });

  test('sửa giá 1 dòng (chưa áp dụng) -> bảng giá tính giá cập nhật ngay; xóa dòng đó -> bỏ khỏi bảng giá', () => {
    const env = createGasEnv();
    const bg = nenBaoGia(env);
    env.call('BG_createQuote', { ngayBaoGia: '2026-09-01', hieuLuc: '2026-12-01T00:00', groups: [{ maList: ['DL1_NG1_Y'], klCode: '0_1000', gia: 2000 }] });
    const id = bg.getSheetByName('Baogia_DN').__data[2][6];
    const giaTrongSave = () => bg.getSheetByName('Baogia_DN_SAVE').__data.filter((r) => r[0] === id).map((r) => r[6]);
    expect(giaTrongSave()).toEqual([2000]);
    expect(env.call('BG_updateBaogiaRow', { idBgct: id, maList: ['DL1_NG1_Y'], klCode: '0_1000', gia: 3000, hieuLuc: '2026-12-01T00:00' }).status).toBe('success');
    expect(giaTrongSave()).toEqual([3000]);
    expect(env.call('BG_deleteBaogiaRow', id).status).toBe('success');
    expect(giaTrongSave()).toEqual([]);
    expect(donGiaPhieu(env)).toBe(1000);
  });

  test('xóa cả phiếu báo giá -> bảng giá tính giá bỏ luôn các nhóm đó', () => {
    const env = createGasEnv();
    const bg = nenBaoGia(env);
    const res = env.call('BG_createQuote', { ngayBaoGia: '2026-09-01', hieuLuc: '2026-12-01T00:00', groups: [{ maList: ['DL1_NG1_Y'], klCode: '0_1000', gia: 5000 }] });
    const soDongSave = () => bg.getSheetByName('Baogia_DN_SAVE').__data.filter((r) => r[3] === 'DL1_NG1_Y').length;
    expect(soDongSave()).toBe(2);
    expect(env.call('BG_deleteQuote', res.soBaoGia).status).toBe('success');
    expect(soDongSave()).toBe(1);
  });
});

describe('PERF-BG: kết quả Sửa/Xóa/Đã áp dụng đúng như quét toàn bộ, nhưng đọc ít hơn nhiều', () => {
  function dungLon() {
    const env = createGasEnv();
    napDuLieuLon(env, { soDongNong: 20000, soDongMoiNamLuuTru: 8000, soNamLuuTru: 3, tiLeChuaChot: 0.05 });
    napBaoGiaLon(env, { nPhieu: 60, nNhom: 8 });
    return env;
  }
  // Đáp án chuẩn: quét TOÀN BỘ phiếu cân (mọi sheet), khoảng [tu, den)
  function daApDungChuan(env) {
    const ss = env.spreadsheetApp.openById(PHIEUCAN_ID);
    const pc = [];
    ss.getSheets().forEach((sh) => { if (/^PhieuCan_DN(_\d{4})?$/.test(sh.getName())) sh.__data.slice(1).forEach((r) => pc.push([r[16], r[1].getTime()])); });
    return (ma, tu, den) => pc.some(([m, ts]) => m === ma && ts >= tu && ts < den);
  }

  test('Xem toàn bộ lịch sử: "Đã áp dụng" từng dòng khớp đáp án quét toàn bộ', () => {
    const env = dungLon();
    const data = env.call('BG_showAllData').data;
    const save = env.spreadsheetApp.openById(BAOGIA_ID).getSheetByName('Baogia_DN_SAVE').__data.slice(1);
    const chuan = daApDungChuan(env);
    expect(data.length).toBe(save.length);
    let soApDung = 0;
    data.forEach((d, i) => {
      const k = chuan(save[i][3], save[i][1].getTime(), save[i][2].getTime());
      expect(d.daApDung).toBe(k);
      if (k) soApDung++;
    });
    expect(soApDung).toBeGreaterThan(10); // dữ liệu thật sự có cả 2 loại
    expect(soApDung).toBeLessThan(data.length);
  });

  test('Cập nhật hiệu lực: chỉ trả dòng còn hiệu lực, khớp đáp án; không mở sheet lưu trữ năm cũ', () => {
    const env = dungLon();
    const ss = env.spreadsheetApp.openById(PHIEUCAN_ID);
    const daMo = [];
    const goc = ss.getSheetByName.bind(ss);
    ss.getSheetByName = (ten) => { daMo.push(ten); return goc(ten); };
    const data = env.call('BG_updateHieuLuc').data;
    expect(data.every((d) => d.trangThai === 'Còn hiệu lực')).toBe(true);
    const namCu = new Date().getFullYear() - 2;
    expect(daMo).not.toContain('PhieuCan_DN_' + namCu); // báo giá còn hiệu lực đều trong ~1 năm gần đây
    const save = (env.call('BG_showAllData'), env.spreadsheetApp.openById(BAOGIA_ID).getSheetByName('Baogia_DN_SAVE').__data.slice(1));
    const chuan = daApDungChuan(env);
    data.forEach((d) => {
      const r = save.find((x) => x[0] === d.id && x[3] === d.ma && x[13] === 'Còn hiệu lực');
      expect(d.daApDung).toBe(chuan(r[3], r[1].getTime(), r[2].getTime()));
    });
  });

  test('báo giá cũ: phiếu cân nằm trong sheet lưu trữ năm cũ vẫn được tính là "đã áp dụng" (không sửa/xóa được)', () => {
    const env = createGasEnv();
    const bg = nenBaoGia(env);
    const t = new Date(2024, 5, 1);
    bg.getSheetByName('Baogia_DN').__data.push([t, t, 'DLC_NGC_Y', '0_1000', 1, 'a', 'CU1', 'BGCU']);
    const r = new Array(27).fill(''); r[1] = new Date(2024, 6, 15); r[16] = 'DLC_NGC_Y'; r[21] = '5/2024/NK';
    env.spreadsheetApp.openById(PHIEUCAN_ID).__setSheet('PhieuCan_DN_2024', [new Array(27).fill('H'), r]);
    const kq = env.call('BG_getBaogiaRowByHash', 'CU1');
    expect(kq.editable).toBe(false);
    expect(kq.reason).toMatch(/ĐÃ CÓ PHIẾU CÂN ÁP DỤNG/);
  });

  test('xóa phiếu báo giá nhiều nhóm: đọc phiếu cân 1 lần (không nhân theo số nhóm)', () => {
    const env = dungLon();
    const bg = env.spreadsheetApp.openById(BAOGIA_ID);
    const tl = new Date(Date.now() + 30 * 86400000);
    bg.getSheetByName('QL_BaoGia').__data.push([tl, 'BGTL', tl, tl, '']);
    for (let g = 0; g < 10; g++) bg.getSheetByName('Baogia_DN').__data.push([tl, tl, 'DL' + g + '_NG0_Y', '0_1000', 9, 'a', 'TL-' + g, 'BGTL']);
    const mot = doLuong(env, 'BG_getBaogiaRowByHash', 'TL-1').oRead;
    const r = doLuong(env, 'BG_deleteQuote', 'BGTL');
    expect(r.res.status).toBe('success');
    expect(r.oRead).toBeLessThan(mot * 1.5);
  });

  test('ranh giới: phiếu cân đúng mốc kết thúc -> DS báo giá và Xóa thật cho cùng kết luận', () => {
    const env = createGasEnv();
    const bg = nenBaoGia(env);
    const mai = new Date(); mai.setHours(0, 0, 0, 0); mai.setDate(mai.getDate() + 1);
    const t1 = new Date(mai.getTime() + 1000);       // báo giá B bắt đầu -> A kết thúc đúng lúc "mai"
    const hqua = new Date(mai.getTime() - 2 * 86400000);
    bg.getSheetByName('QL_BaoGia').__data.push([hqua, 'BGA', hqua, hqua, ''], [t1, 'BGB', t1, t1, '']);
    bg.getSheetByName('Baogia_DN').__data.push([hqua, hqua, 'DLB_NGB_Y', '0_1000', 1, 'a', 'A1', 'BGA'], [t1, t1, 'DLB_NGB_Y', '0_1000', 2, 'a', 'B1', 'BGB']);
    const r = new Array(27).fill(''); r[1] = mai; r[16] = 'DLB_NGB_Y'; r[21] = '9/2026/NK';
    env.spreadsheetApp.openById(PHIEUCAN_ID).getSheetByName('PhieuCan_DN').__data.push(r);
    const ds = env.call('BG_getQuoteListWithStatus').data.find((x) => x.soBaoGia === 'BGA');
    expect(ds.deletable).toBe(true);
    expect(env.call('BG_deleteQuote', 'BGA').status).toBe('success');
  });
});

describe('Sửa 1 dòng báo giá: chặn nếu SAU KHI SỬA dòng này phủ lên phiếu cân đã có', () => {
  // Nền: báo giá BG1 (DL1_NG1_Y từ 01/01/2026) + phiếu cân DL1_NG1_Y ngày 20/09/2026.
  // Thêm: báo giá BG2 mã DL2_NG2_Y từ 01/01/2026 + phiếu cân DL2 ngày 15/09/2026;
  // dòng cần sửa X: mã DL3_NG3_Y hiệu lực 01/12/2026 (chưa phiếu nào dùng -> sửa được).
  function nen() {
    const env = createGasEnv();
    const bg = nenBaoGia(env);
    const t0 = new Date(2026, 0, 1), t12 = new Date(2026, 11, 1);
    bg.getSheetByName('Baogia_DN').__data.push(
      [t0, t0, 'DL2_NG2_Y', '0_1000', 1500, 'a', 'ID2', 'BG2'],
      [t12, t12, 'DL3_NG3_Y', '0_1000', 900, 'a', 'X', 'BG3']);
    const r = new Array(27).fill(''); r[1] = new Date(2026, 8, 15); r[16] = 'DL2_NG2_Y'; r[21] = '2/2026/NK';
    env.spreadsheetApp.openById(PHIEUCAN_ID).getSheetByName('PhieuCan_DN').__data.push(r);
    return { env, src: bg.getSheetByName('Baogia_DN') };
  }
  const sua = (env, o) => env.call('BG_updateBaogiaRow', Object.assign({ idBgct: 'X', maList: ['DL3_NG3_Y'], klCode: '0_1000', gia: 900, hieuLuc: '2026-12-01T00:00' }, o));

  test('thêm mã mới đang có phiếu cân trong khoảng hiệu lực mới -> chặn, báo rõ mã + số phiếu + ngày, không ghi', () => {
    const { env, src } = nen();
    const truoc = JSON.stringify(src.__data);
    const res = sua(env, { maList: ['DL3_NG3_Y', 'DL2_NG2_Y'], hieuLuc: '2026-09-01T00:00' });
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/^Không thể sửa: sau khi sửa, mã "DL2_NG2_Y" .* sẽ áp dụng cho 1 phiếu cân đã có \(ngày cân 15\/09\/2026\)/);
    expect(JSON.stringify(src.__data)).toBe(truoc);
  });

  test('dời ngày hiệu lực sớm hơn làm phủ lên phiếu cân của báo giá trước -> chặn', () => {
    const { env } = nen();
    const res = sua(env, { maList: ['DL1_NG1_Y'], hieuLuc: '2026-12-01T00:00' });
    expect(res.status).toBe('success'); // DL1 từ 01/12: chưa phiếu nào -> được
    const res2 = sua(env, { maList: ['DL1_NG1_Y'], hieuLuc: '2026-09-10T00:00' }); // phủ phiếu DL1 20/09
    expect(res2.status).toBe('error');
    expect(res2.message).toMatch(/mã "DL1_NG1_Y".*1 phiếu cân đã có \(ngày cân 20\/09\/2026\)/);
  });

  test('sửa hợp lệ (đổi giá, thêm mã chưa có phiếu, dời ngày không phủ phiếu nào) -> vẫn lưu được', () => {
    const { env, src } = nen();
    const res = sua(env, { maList: ['DL3_NG3_Y', 'DL4_NG4_Y'], gia: 950, hieuLuc: '2026-10-01T00:00' });
    expect(res.status).toBe('success');
    const d = src.__data.find((r) => r[6] === 'X');
    expect([d[2], d[4]]).toEqual(['DL3_NG3_Y , DL4_NG4_Y', 950]);
  });

  test('phiếu cân ở sheet lưu trữ năm cũ cũng được tính khi kiểm tra sau khi sửa', () => {
    const { env } = nen();
    const r = new Array(27).fill(''); r[1] = new Date(2025, 5, 1); r[16] = 'DL5_NG5_Y'; r[21] = '7/2025/NK';
    env.spreadsheetApp.openById(PHIEUCAN_ID).__setSheet('PhieuCan_DN_2025', [new Array(27).fill('H'), r]);
    const res = sua(env, { maList: ['DL5_NG5_Y'], hieuLuc: '2025-01-01T00:00' });
    expect(res.message).toMatch(/mã "DL5_NG5_Y".*1 phiếu cân đã có \(ngày cân 01\/06\/2025\)/);
  });
});
