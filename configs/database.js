const { Sequelize } = require('sequelize');
const path = require('path');
// Tạo kết nối với SQLite
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.sqlite'),  // Tệp SQLite sẽ được lưu dưới tên này
});

// Kiểm tra kết nối
async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('Kết nối thành công!');
    } catch (error) {
        console.error('Không thể kết nối:', error);
    }
}

testConnection();


module.exports = sequelize;
