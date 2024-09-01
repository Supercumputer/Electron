const { DataTypes } = require('sequelize');
const sequelize = require('../configs/database');

// Định nghĩa model Device
const Device = sequelize.define('Device', {
    id: {
        type: DataTypes.INTEGER,  // Sử dụng INTEGER cho id tự động tăng
        autoIncrement: true,     // Tự động tăng giá trị
        primaryKey: true,        // Đặt là khóa chính
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,  // Đảm bảo tên thiết bị là duy nhất
    },
    status: {
        type: DataTypes.ENUM('online', 'offline'),
        defaultValue: 'offline',
    },
}, {
    timestamps: true,  // Thêm cột createdAt và updatedAt tự động
});

module.exports = Device;
