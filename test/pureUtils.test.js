const { createGasEnv } = require('./gasEnv');

describe('sanitize() - chống Formula/CSV Injection', () => {
  let env;
  beforeEach(() => { env = createGasEnv(); });

  test.each([
    ['=SUM(A1:A9)', "'=SUM(A1:A9)"],
    ['+1234', "'+1234"],
    ['-1234', "'-1234"],
    ['@SUM(1)', "'@SUM(1)"],
    ['  =cmd|whoami  ', "'=cmd|whoami"],
  ])('chuỗi bắt đầu bằng ký tự công thức %p được thêm dấu nháy đơn -> %p', (input, expected) => {
    expect(env.call('sanitize', input)).toBe(expected);
  });

  test('chuỗi bình thường giữ nguyên (chỉ trim)', () => {
    expect(env.call('sanitize', '  Công ty ABC  ')).toBe('Công ty ABC');
  });

  test('giá trị không phải chuỗi (số, null, undefined) trả về nguyên vẹn - không đụng vào', () => {
    expect(env.call('sanitize', 123)).toBe(123);
    expect(env.call('sanitize', null)).toBe(null);
    expect(env.call('sanitize', undefined)).toBe(undefined);
  });
});

describe('parseSoTheoLocale_() - phân tích số theo Locale hệ thống', () => {
  test('số Excel thật (typeof number) trả về nguyên vẹn, không phụ thuộc Locale', () => {
    const env = createGasEnv();
    expect(env.call('parseSoTheoLocale_', 17990)).toBe(17990);
    expect(env.call('parseSoTheoLocale_', 17.5)).toBe(17.5);
  });

  test('Locale VN (mặc định): "." là phân cách nghìn, "," là thập phân', () => {
    const env = createGasEnv();
    expect(env.call('parseSoTheoLocale_', '17.990')).toBe(17990);
    expect(env.call('parseSoTheoLocale_', '17.990,5')).toBe(17990.5);
  });

  test('Locale US: "," là phân cách nghìn, "." là thập phân', () => {
    const env = createGasEnv();
    env.propertiesService.__store.set('REGION_FORMAT_MIEN', 'US');
    expect(env.call('parseSoTheoLocale_', '17,990')).toBe(17990);
    expect(env.call('parseSoTheoLocale_', '17,990.5')).toBe(17990.5);
  });

  test('chuỗi rỗng/không có số -> NaN', () => {
    const env = createGasEnv();
    expect(Number.isNaN(env.call('parseSoTheoLocale_', ''))).toBe(true);
    expect(Number.isNaN(env.call('parseSoTheoLocale_', null))).toBe(true);
  });

  test('dọn sạch ký tự lạ (đơn vị đo, khoảng trắng) còn sót lại', () => {
    const env = createGasEnv();
    expect(env.call('parseSoTheoLocale_', '17.990 kg')).toBe(17990);
  });
});

describe('REGION_FORMAT() / MISA_FORMAT() - cấu hình vùng miền', () => {
  test('mặc định (chưa từng cấu hình) là VN: dd/MM/yyyy', () => {
    const env = createGasEnv();
    const rf = env.call('REGION_FORMAT');
    expect(rf.MIEN).toBe('VN');
    expect(rf.DATE_FMT).toBe('dd/MM/yyyy');
    expect(rf.DATETIME_FMT).toBe('dd/MM/yyyy hh:mm:ss AM/PM');
  });

  test('sau khi ADMIN lưu US, REGION_FORMAT() đổi theo ngay (không cần deploy lại)', () => {
    const env = createGasEnv({ email: 'phuthuy.apple@gmail.com' }); // admin mặc định (Config.gs)
    const res = env.call('HT_luuCauHinhVungMien', 'US', 'VN');
    expect(res.status).toBe('success');
    const rf = env.call('REGION_FORMAT');
    expect(rf.MIEN).toBe('US');
    expect(rf.DATE_FMT).toBe('MM/dd/yyyy');
  });

  test('NHÂN VIÊN thường (không phải Admin) KHÔNG đổi được cấu hình vùng miền', () => {
    const env = createGasEnv({ email: 'nhanvien@gmail.com' });
    env.call('HT_luuDanhSachQuyen', [
      { email: 'phuthuy.apple@gmail.com', vaiTro: 'ADMIN' },
      { email: 'nhanvien@gmail.com', vaiTro: 'NHANVIEN' },
    ]);
    const res = env.call('HT_luuCauHinhVungMien', 'US', 'VN');
    expect(res.status).toBe('error');
    expect(res.message).toMatch(/quyền Quản trị/);
    // Và cấu hình vẫn giữ nguyên mặc định VN, không bị đổi.
    expect(env.call('REGION_FORMAT').MIEN).toBe('VN');
  });

  test('MISA_FORMAT() độc lập với REGION_FORMAT() (đổi 1 bên không ảnh hưởng bên kia)', () => {
    const env = createGasEnv({ email: 'phuthuy.apple@gmail.com' });
    env.call('HT_luuCauHinhVungMien', 'US', 'VN');
    expect(env.call('REGION_FORMAT').MIEN).toBe('US');
    expect(env.call('MISA_FORMAT').MIEN).toBe('VN');
  });
});

describe('MISA_DEFAULTS() - giá trị mặc định báo cáo Misa', () => {
  test('mặc định gốc khi chưa từng lưu', () => {
    const env = createGasEnv();
    const d = env.call('MISA_DEFAULTS');
    expect(d.maHang).toBe('621A.001');
    expect(d.tkCongNoTien).toBe('33111');
  });

  test('ADMIN lưu giá trị mới -> merge với mặc định gốc (không mất trường chưa gửi)', () => {
    const env = createGasEnv({ email: 'phuthuy.apple@gmail.com' });
    const res = env.call('HT_luuMisaDefaults', { maHang: '999.ZZZ' });
    expect(res.status).toBe('success');
    const d = env.call('MISA_DEFAULTS');
    expect(d.maHang).toBe('999.ZZZ');
    expect(d.tkCongNoTien).toBe('33111'); // vẫn giữ mặc định gốc cho trường không gửi lên
  });

  test('NHÂN VIÊN thường không lưu được giá trị mặc định Misa', () => {
    const env = createGasEnv({ email: 'ai-do@gmail.com' });
    const res = env.call('HT_luuMisaDefaults', { maHang: 'HACK' });
    expect(res.status).toBe('error');
    expect(env.call('MISA_DEFAULTS').maHang).toBe('621A.001');
  });
});

describe('combineDateTime_() - ghép ngày (yyyy-MM-dd) + giờ (HH:mm) thành Date', () => {
  test('ghép đúng ngày giờ hợp lệ', () => {
    const env = createGasEnv();
    const d = env.call('combineDateTime_', '2026-07-25', '14:30');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // tháng 7 (0-based)
    expect(d.getDate()).toBe(25);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  test('thiếu giờ -> mặc định 00:00', () => {
    const env = createGasEnv();
    const d = env.call('combineDateTime_', '2026-01-01', '');
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  test('không có ngày -> null', () => {
    const env = createGasEnv();
    expect(env.call('combineDateTime_', '', '14:30')).toBeNull();
  });

  test('ngày không hợp lệ -> null (không throw)', () => {
    const env = createGasEnv();
    expect(env.call('combineDateTime_', 'khong-phai-ngay', '14:30')).toBeNull();
  });
});

describe('toDateOnly_() / toTimeOnly_() - tách Ngày thuần / Giờ thuần', () => {
  test('toDateOnly_ giữ đúng ngày, giờ về 00:00:00', () => {
    const env = createGasEnv();
    const d = env.call('toDateOnly_', new Date(2026, 6, 25, 14, 30, 45));
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 25]);
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });

  test('toTimeOnly_ giữ đúng giờ:phút:giây, neo về mốc gốc Sheets 30/12/1899', () => {
    const env = createGasEnv();
    const t = env.call('toTimeOnly_', new Date(2026, 6, 25, 14, 30, 45));
    expect([t.getFullYear(), t.getMonth(), t.getDate()]).toEqual([1899, 11, 30]);
    expect([t.getHours(), t.getMinutes(), t.getSeconds()]).toEqual([14, 30, 45]);
  });
});

describe('toDateObj() - tự sửa ngày/tháng đảo ngược + nhận diện chuỗi ISO', () => {
  test('chuỗi ISO (round-trip qua client/server) được new Date() phân giải trực tiếp', () => {
    const env = createGasEnv();
    const d = env.call('toDateObj', '2026-07-25T00:00:00.000Z');
    expect(d.toISOString()).toBe('2026-07-25T00:00:00.000Z');
  });

  test('chuỗi "25/07/2026" (ngày > 12) hiểu đúng là 25 tháng 7, KHÔNG đảo thành tháng 25', () => {
    const env = createGasEnv();
    const d = env.call('toDateObj', '25/07/2026');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 25]);
  });

  test('chuỗi "07/25/2026" (tháng > 12 theo vị trí DD/MM) tự hoán đổi lại đúng', () => {
    const env = createGasEnv();
    // Vị trí đầu=07 (<=12, coi là "ngày" theo mặc định DD/MM), vị trí 2=25 (>12 -> không hợp lệ làm tháng)
    // -> tự hoán đổi: ngày=25, tháng=07
    const d = env.call('toDateObj', '07/25/2026');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 25]);
  });

  test('Date object thật trả về nguyên vẹn (không tạo bản sao/không parse lại)', () => {
    const env = createGasEnv();
    // QUAN TRỌNG: phải tạo Date bằng đúng constructor Date CỦA vm context (không
    // phải Date của Node/Jest) - "instanceof Date" bên trong toDateObj() so khớp
    // với Date của REALM đang thực thi (vm context), 1 Date tạo ở realm Node
    // ngoài sẽ KHÔNG "instanceof" Date của vm context dù cùng giá trị (đặc điểm
    // chuẩn của JS đa-realm, không phải lỗi code GAS).
    const { date, result } = env.callWithOwnDate('toDateObj', [2026, 0, 1]);
    expect(result).toBe(date);
  });

  test('giá trị không hợp lệ -> null', () => {
    const env = createGasEnv();
    expect(env.call('toDateObj', '')).toBeNull();
    expect(env.call('toDateObj', 'abc')).toBeNull();
    expect(env.call('toDateObj', null)).toBeNull();
  });
});

describe('parseDate() - phân giải dữ liệu ngày CŨ dạng chuỗi/số serial Excel', () => {
  test('Date object thật trả về nguyên vẹn', () => {
    const env = createGasEnv();
    // Xem ghi chú "QUAN TRỌNG" ở test tương tự của toDateObj() phía trên.
    const { date, result } = env.callWithOwnDate('parseDate', [2026, 0, 1]);
    expect(result).toBe(date);
  });

  test('chuỗi "yyyy-MM-dd" không mơ hồ, đọc trực tiếp', () => {
    const env = createGasEnv();
    const d = env.call('parseDate', '2026-07-25');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 25]);
  });

  test('chuỗi "dd/MM/yyyy" mặc định, tự sửa nếu phần tháng > 12', () => {
    const env = createGasEnv();
    const d1 = env.call('parseDate', '25/07/2026');
    expect([d1.getFullYear(), d1.getMonth(), d1.getDate()]).toEqual([2026, 6, 25]);
    const d2 = env.call('parseDate', '07/25/2026');
    expect([d2.getFullYear(), d2.getMonth(), d2.getDate()]).toEqual([2026, 6, 25]);
  });

  test('giá trị rỗng/falsy -> null', () => {
    const env = createGasEnv();
    expect(env.call('parseDate', '')).toBeNull();
    expect(env.call('parseDate', null)).toBeNull();
    expect(env.call('parseDate', 0)).toBeNull();
  });
});

describe('_tsTrongKhoangHieuLuc_() - quy ước ranh giới khoảng hiệu lực báo giá', () => {
  test('nửa khoảng [start, end): đầu bao gồm, cuối KHÔNG bao gồm', () => {
    const env = createGasEnv();
    const start = 1000;
    const end = 2000;
    expect(env.call('_tsTrongKhoangHieuLuc_', 1000, start, end)).toBe(true); // đúng mốc đầu -> true
    expect(env.call('_tsTrongKhoangHieuLuc_', 1500, start, end)).toBe(true); // giữa khoảng -> true
    expect(env.call('_tsTrongKhoangHieuLuc_', 1999, start, end)).toBe(true); // sát cuối -> true
    expect(env.call('_tsTrongKhoangHieuLuc_', 2000, start, end)).toBe(false); // đúng mốc cuối -> false (thuộc khoảng KẾ TIẾP)
    expect(env.call('_tsTrongKhoangHieuLuc_', 999, start, end)).toBe(false); // trước khoảng -> false
  });
});
