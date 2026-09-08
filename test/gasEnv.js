/**
 * Nạp Config.gs + Code.gs vào vm context giống hệt cách Apps Script gộp mọi
 * file .gs vào chung 1 global scope, kèm mock các dịch vụ Google, để Jest gọi
 * trực tiếp các hàm phía server mà KHÔNG cần kết nối Google Sheets thật.
 *
 * ĐIỂM MẤU CHỐT (đã sửa sau khi 1 test phát hiện ra hành vi SAI): Google Apps
 * Script KHÔNG giữ state biến toàn cục (`const CONFIG = {...}` v.v.) giữa các
 * lần gọi hàm khác nhau - MỖI lần gọi 1 hàm server (mỗi request doGet, mỗi
 * google.script.run) là 1 LẦN THỰC THI TOÀN BỘ SCRIPT TỪ ĐẦU hoàn toàn mới
 * (biến `const`/`let` top-level được khai báo lại từ giá trị literal gốc, và
 * đoạn code top-level tự chạy như `apDungOverrideLienKet_();` ở cuối Config.gs
 * chạy lại mỗi lần). CHỈ CÓ PropertiesService/Sheets/Session mới là nơi lưu
 * trạng thái THẬT SỰ xuyên suốt nhiều lần gọi (đó là các dịch vụ NGOÀI script).
 *
 * Vì vậy `call()` bên dưới tạo 1 vm CONTEXT MỚI (nạp lại Config.gs+Code.gs từ
 * đầu) cho MỖI lần gọi hàm - đúng thực tế Apps Script - trong khi vẫn dùng
 * chung 1 instance PropertiesService/SpreadsheetApp/Session xuyên suốt cả
 * `env` (mô phỏng đúng việc các dịch vụ đó là ngoại bộ, tồn tại giữa các lần
 * gọi). Bản đầu tiên của file này tái dùng 1 context cho nhiều lần gọi trong
 * cùng 1 test - sai mô hình thực thi thật, khiến 1 test về "để trống ô ghi đè
 * để khôi phục mặc định" báo PASS giả (state JS trong bộ nhớ không phản ánh
 * đúng việc mỗi lần gọi kế tiếp trong thực tế sẽ tự khởi tạo lại CONFIG từ
 * literal gốc rồi mới áp override hiện có).
 *
 * LƯU Ý KHÁC: các khai báo top-level dạng `const`/`let` KHÔNG lộ ra như thuộc
 * tính của object context (hành vi chuẩn của Node vm) - test PHẢI gọi qua các
 * hàm (`function foo(){}` - luôn lộ ra là thuộc tính context), không đọc thẳng
 * hằng số cấu hình - đúng tinh thần "kiểm tra hành vi qua hàm public".
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const mocks = require('./gasMocks');

const CONFIG_SRC = fs.readFileSync(path.join(__dirname, '..', 'Config.gs'), 'utf8');
const CODE_SRC = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');
const BUNDLE_SRC = CONFIG_SRC + '\n;\n' + CODE_SRC;

/**
 * Tạo 1 môi trường GAS giả lập MỚI HOÀN TOÀN (state cô lập cho từng test) -
 * gọi trong beforeEach/đầu mỗi test để test này không rò rỉ state sang test khác.
 */
function createGasEnv(opts) {
  opts = opts || {};
  // Các dịch vụ "NGOÀI script" - tồn tại xuyên suốt nhiều lần gọi hàm trong
  // cùng 1 kịch bản test, ĐÚNG như PropertiesService/Sheets/Session thật.
  const propertiesService = mocks.makeFakePropertiesService();
  const spreadsheetApp = mocks.makeFakeSpreadsheetApp();
  const session = mocks.makeFakeSession(opts.email || '');
  const driveApp = mocks.makeFakeDriveApp();
  const cacheService = mocks.makeFakeCacheService();

  function loadFreshContext() {
    const sandbox = {
      console,
      PropertiesService: propertiesService,
      SpreadsheetApp: spreadsheetApp,
      DriveApp: driveApp,
      Utilities: mocks.makeFakeUtilities(),
      LockService: mocks.makeFakeLockService(),
      Session: session,
      CacheService: cacheService,
      HtmlService: mocks.makeFakeHtmlService(),
      // "Drive" = Advanced Drive Service (Drive.Files.remove...) - chỉ cần đủ để không throw undefined.
      Drive: { Files: { remove: () => {} } },
    };
    const context = vm.createContext(sandbox);
    vm.runInContext(BUNDLE_SRC, context, { filename: 'gas-bundle.js' });
    // FIX (đa-realm Date): xem ghi chú chi tiết ở đầu gasMocks.js - đăng ký
    // Date constructor của CHÍNH context vừa tạo làm "Date đang hoạt động",
    // để mọi lần đọc dữ liệu từ sheet giả (getValues/getValue) tái tạo lại
    // đúng Date theo realm này, giúp "instanceof Date" trong Code.gs hoạt
    // động đúng như khi chạy thật trên Apps Script (chỉ có 1 realm duy nhất).
    mocks.setActiveDateCtor_(vm.runInContext('Date', context));
    return context;
  }

  return {
    /** Context "mẫu" 1 lần - chỉ dùng để kiểm tra sự tồn tại của hàm (smoke test), KHÔNG dùng để suy luận state xuyên suốt nhiều lần gọi. */
    context: loadFreshContext(),
    propertiesService,
    spreadsheetApp,
    session,
    driveApp,
    /**
     * Gọi 1 hàm global trong Code.gs/Config.gs - NẠP LẠI TOÀN BỘ SCRIPT TỪ ĐẦU
     * trước mỗi lần gọi (đúng mô hình thực thi thật của Apps Script - xem ghi
     * chú đầu file). PropertiesService/SpreadsheetApp/Session vẫn giữ nguyên
     * xuyên suốt vì đó là các dịch vụ ngoài, không bị nạp lại.
     */
    call(fnName, ...args) {
      const context = loadFreshContext();
      const fn = context[fnName];
      if (typeof fn !== 'function') {
        throw new Error('Hàm "' + fnName + '" không tồn tại (hoặc không phải function declaration) trong Code.gs/Config.gs.');
      }
      return fn(...args);
    },
    /**
     * Tạo 1 Date object bằng ĐÚNG constructor Date của 1 vm context mới - bắt
     * buộc dùng khi test cần "instanceof Date" bên trong Code.gs trả về true
     * cho input do test tự tạo (mỗi vm context là 1 REALM riêng, Date của 2
     * realm khác nhau không instanceof lẫn nhau dù cùng API/giá trị - đặc điểm
     * chuẩn của JS, không phải lỗi code GAS).
     */
    makeDate(...args) {
      const context = loadFreshContext();
      context.__dateArgs = args;
      return vm.runInContext('new Date(...__dateArgs)', context);
    },
    /**
     * Dành riêng cho test kiểm tra "trả về ĐÚNG cùng 1 object Date đã truyền
     * vào" (VD toDateObj/parseDate khi input đã instanceof Date thì trả về
     * nguyên vẹn, không tạo bản sao). Phải tạo Date VÀ gọi hàm trong CÙNG 1
     * context (cùng 1 "lần thực thi script") thì "instanceof"/"===" bên trong
     * hàm mới hoạt động đúng - khác với call()/makeDate() ở trên vốn mỗi lần
     * đều nạp context MỚI (đúng mô hình Apps Script thật, nhưng không phù hợp
     * cho riêng loại test danh tính-object này).
     */
    callWithOwnDate(fnName, dateArgs) {
      const context = loadFreshContext();
      context.__dateArgs = dateArgs;
      const date = vm.runInContext('new Date(...__dateArgs)', context);
      const fn = context[fnName];
      if (typeof fn !== 'function') {
        throw new Error('Hàm "' + fnName + '" không tồn tại trong Code.gs/Config.gs.');
      }
      return { date, result: fn(date) };
    },
  };
}

module.exports = { createGasEnv };
