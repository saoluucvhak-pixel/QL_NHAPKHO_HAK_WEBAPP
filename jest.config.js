// Chạy test theo đúng múi giờ của dự án Apps Script (appsscript.json: "timeZone":
// "Asia/Ho_Chi_Minh") - Date(...) trong test và trong Code.gs hiểu cùng giờ như khi
// chạy thật (kể cả ô "chỉ có giờ" ngày 30/12/1899 lệch giờ địa phương cũ).
// Đặt ở đây (tiến trình chính) để mọi tiến trình con của Jest cùng múi giờ.
process.env.TZ = 'Asia/Ho_Chi_Minh';
module.exports = {};
