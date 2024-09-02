const { exec, execSync, spawn, fork } = require('child_process');
const fs = require('fs');
const { DOMParser } = require('xmldom');
const xpath = require('xpath');
const path = require('path');
const Jimp = require('jimp'); // Thêm import cho jimp
const Device = require('./models/Device');
const WebSocket = require('ws');
const speakeasy = require('speakeasy');

let ws;

function connectWebSocket() {

    ws = new WebSocket('ws://localhost:8000/?action=multiplex');
    const ChannelCode = {
        FSLS: 'FSLS', // File System LiSt
        HSTS: 'HSTS', // HoSTS List
        SHEL: 'SHEL', // SHELl
        GTRC: 'GTRC', // Goog device TRaCer
        ATRC: 'ATRC', // Appl device TRaCer
        WDAP: 'WDAP', // WebDriverAgent Proxy
        QVHS: 'QVHS', // Quicktime_Video_Hack Stream
    }

    ws.on('error', console.error);

    ws.on('open', function open() {
        let message = createBuffer(4, 1, getChannelInitData(ChannelCode.GTRC));
        ws.send(message);
        message = createBuffer(4, 1, getChannelInitData(ChannelCode.SHEL));
        ws.send(message);
        let data = {
            id: 1,
            type: 'shell',
            data: {
                type: 'start',
                rows: 37,
                cols: 51,
                udid: "R9JNA05YFLJ",
            },
        };

        message = createBuffer(32, 1, getBufferData(JSON.stringify(data)));
        ws.send(message);
        // deviceManager()
    });

    // ws.on('message', function message(data) {
    //     data = data.toString().substring(5);
    //     // data = JSON.parse(data);
    //     console.log('mess => ', data);
    // });

    ws.on('close', function close() {
        console.log('Connection closed');
    });
}
function getChannelInitData(code) {
    const buffer = Buffer.alloc(4);
    buffer.write(code, 'ascii');
    return buffer;
}
function getBufferData(data) {
    const buffer = Buffer.alloc(data.length);
    buffer.write(data, 'ascii');
    return buffer;
}
function createBuffer(type, channelId, data) {
    const result = Buffer.alloc(5 + (data ? data.byteLength : 0));
    result.writeUInt8(type, 0);
    result.writeUInt32LE(channelId, 1);
    if (data?.byteLength) {
        result.set(Buffer.from(data), 5);
    }
    return result;
}
function sendMessageShell(message) {
    let data = createBuffer(32, 1, getBufferData(message));
    ws.send(data);
    ws.send([0x20, 0x01, 0x00, 0x00, 0x00, 0x0d, 0x0a]);
}

function getAttribute(event, xpathQuery, name, seconds) {
    console.log(`getAttribute: ${xpathQuery}, ${name}, ${seconds}`);

    const waitTime = seconds * 1000;

    sendMessageShell(`uiautomator dump /sdcard/ui.xml`);

    setTimeout(() => {
        // Sao chép tệp XML từ thiết bị Android về máy tính
        execSync(`adb pull /sdcard/ui.xml .`);

        // Kiểm tra sự tồn tại của tệp XML trước khi đọc
        if (fs.existsSync('ui.xml')) {
            // Đọc và phân tích tệp XML
            const data = fs.readFileSync('ui.xml', 'utf8');
            const doc = new DOMParser().parseFromString(data);
            const nodes = xpath.select(xpathQuery, doc);

            if (nodes.length > 0) {
                const node = nodes[0];
                const attributeValue = node.getAttribute(name);

                if (attributeValue) {
                    console.log(`Attribute found: ${attributeValue}`);
                    event.reply('attribute-reply', `Attribute found: ${attributeValue}`);
                } else {
                    console.log('Attribute not found');
                    event.reply('attribute-reply', 'Attribute not found');
                }
            } else {
                console.log('Element not found');
                event.reply('attribute-reply', 'Element not found');
            }
        } else {
            console.log('UI XML file does not exist');
            event.reply('attribute-reply', 'UI XML file does not exist');
        }

    }, waitTime);
}

async function ElementExists(event, xpathQuery, seconds = 10) {
    console.log(`ElementExists: ${xpathQuery}, ${seconds}`);

    await sendMessageShell(`uiautomator dump /sdcard/ui.xml`);

    setTimeout(() => {
        execSync(`adb pull /sdcard/ui.xml .`);

        // Bước 2: Đọc và phân tích tệp XML để lấy tọa độ từ XPath
        const data = fs.readFileSync('ui.xml', 'utf8');
        const doc = new DOMParser().parseFromString(data);
        const nodes = xpath.select(xpathQuery, doc);

        if (nodes.length > 0) {
            console.log(`Element found: ${nodes.length}`);
            return true
        } else {
            console.log('Element not found');
            return false
        }

    }, seconds * 1000);

}

function adbShell(event, command) {
    sendMessageShell(command);
}
function generate2FA(event, secretKey) {
    const token = speakeasy.totp({
        secret: secretKey,
        encoding: 'base32'
    });

    // Gửi mã 2FA qua WebSocket
    const message = `Generated 2FA token: ${token}`;
    sendMessageShell(message); // Gửi tin nhắn qua WebSocket

    console.log(message);

}

function startApp(event, packageName) {

    sendMessageShell(`monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`)
    // const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`; // Đường dẫn đầy đủ tới adb

    // exec(`${adbPath} shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`, (error, stdout, stderr) => {
    //     if (error) {
    //         console.error(`Error: ${error.message}`);
    //         event.reply('open-app-reply', `Error: ${error.message}`);
    //         return;
    //     }
    //     if (stderr) {
    //         console.error(`Stderr: ${stderr}`);
    //         event.reply('open-app-reply', `Stderr: ${stderr}`);
    //         return;
    //     }
    //     event.reply('open-app-reply', `App opened: ${packageName}`);
    // });
}
function closeApp(event, packageName) {

    sendMessageShell(`am force-stop ${packageName}`);

    // const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`; // Đường dẫn đầy đủ tới adb

    // exec(`${adbPath} shell am force-stop ${packageName}`, (error, stdout, stderr) => {
    //     if (error) {
    //         console.error(`Error: ${error.message}`);
    //         event.reply('close-app-reply', `Error: ${error.message}`);
    //         return;
    //     }
    //     if (stderr) {
    //         console.error(`Stderr: ${stderr}`);
    //         event.reply('close-app-reply', `Stderr: ${stderr}`);
    //         return;
    //     }
    //     event.reply('close-app-reply', `App closed: ${packageName}`);
    // });
}
function pressBack() {

    sendMessageShell("input keyevent 4");

    // const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`; // Đường dẫn đầy đủ tới adb

    // // Gửi lệnh ADB để nhấn nút back
    // exec(`${adbPath} shell input keyevent 4`, (error, stdout, stderr) => {
    //     if (error) {
    //         console.error(`Error: ${error.message}`);
    //         return `Error: ${error.message}`;
    //     }
    //     if (stderr) {
    //         console.error(`Stderr: ${stderr}`);
    //         return `Stderr: ${stderr}`;
    //     }
    //     console.log(`Back button pressed`);
    //     return `Back button pressed`;
    // });
}
function pressHome() {

    sendMessageShell("input keyevent 3");

    // const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`; // Đường dẫn đầy đủ tới adb

    // // Gửi lệnh ADB để nhấn nút back
    // exec(`${adbPath} shell input keyevent 3`, (error, stdout, stderr) => {
    //     if (error) {
    //         console.error(`Error: ${error.message}`);
    //         return `Error: ${error.message}`;
    //     }
    //     if (stderr) {
    //         console.error(`Stderr: ${stderr}`);
    //         return `Stderr: ${stderr}`;
    //     }
    //     console.log(`Back button pressed`);
    //     return `Home button pressed`;
    // });
}
function pressMenu() {
    sendMessageShell("input keyevent 187");
    // const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`; // Đường dẫn đầy đủ tới adb

    // // Gửi lệnh ADB để nhấn nút back
    // exec(`${adbPath} shell input keyevent 187`, (error, stdout, stderr) => {
    //     if (error) {
    //         console.error(`Error: ${error.message}`);
    //         return `Error: ${error.message}`;
    //     }
    //     if (stderr) {
    //         console.error(`Stderr: ${stderr}`);
    //         return `Stderr: ${stderr}`;
    //     }
    //     console.log(`Menu button pressed`);
    //     return `Menu button pressed`;
    // });
}
function inStallApp(event, apkPath) {

    sendMessageShell(`install ${apkPath}`);

    // const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`; // Đường dẫn đầy đủ tới adb

    // const safeApkPath = `"${apkPath}"`;

    // exec(`${adbPath} install ${safeApkPath}`, (error, stdout, stderr) => {
    //     if (error) {
    //         console.error(`Error: ${error.message}`);
    //         event.reply('install-app-reply', `Error: ${error.message}`);
    //         return;
    //     }
    //     if (stderr) {
    //         console.error(`Stderr: ${stderr}`);
    //         event.reply('install-app-reply', `Stderr: ${stderr}`);
    //         return;
    //     }
    //     event.reply('install-app-reply', `App installed: ${apkPath}`);
    // });
}
function unInStallApp(event, packageName) {

    sendMessageShell(`uninstall ${packageName}`);

    // const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`; // Đường dẫn đầy đủ tới adb

    // exec(`${adbPath} uninstall ${packageName}`, (error, stdout, stderr) => {
    //     if (error) {
    //         console.error(`Error: ${error.message}`);
    //         event.reply('uninstall-app-reply', `Error: ${error.message}`);
    //         return;
    //     }
    //     if (stderr) {
    //         console.error(`Stderr: ${stderr}`);
    //         event.reply('uninstall-app-reply', `Stderr: ${stderr}`);
    //         return;
    //     }
    //     event.reply('uninstall-app-reply', `App uninstalled: ${packageName}`);
    // });
}
function isInStallApp(event, packageName) {

    sendMessageShell(`pm list packages | findstr ${packageName}`);

    // const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`; // Đường dẫn đầy đủ tới adb

    // exec(`${adbPath} shell pm list packages | findstr ${packageName}`, (error, stdout, stderr) => {

    //     if (stdout.includes(packageName)) {
    //         event.reply('check-app-reply', `App is installed: ${packageName}`);
    //         console.log(`App is installed: ${packageName}`);

    //     } else {
    //         event.reply('check-app-reply', `App is not installed: ${packageName}`);
    //         console.log(`App is not installed: ${packageName}`);
    //     }
    // });
}
function lockPhone(event) {

    sendMessageShell("input keyevent 26");

    // const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`; // Đường dẫn đầy đủ tới adb

    // exec(`${adbPath} shell input keyevent 26`, (error, stdout, stderr) => {
    //     if (error) {
    //         console.error(`Error: ${error.message}`);
    //         event.reply('lock-phone-reply', `Error: ${error.message}`);
    //         return;
    //     }
    //     if (stderr) {
    //         console.error(`Stderr: ${stderr}`);
    //         event.reply('lock-phone-reply', `Stderr: ${stderr}`);
    //         return;
    //     }
    //     event.reply('lock-phone-reply', `Phone locked successfully.`);
    // });
}
function unlockPhone(event) {

    sendMessageShell("input keyevent 82");

    // const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`; // Đường dẫn đầy đủ tới adb

    // exec(`${adbPath} shell input keyevent 82`, (error, stdout, stderr) => {
    //     if (error) {
    //         console.error(`Error: ${error.message}`);
    //         event.reply('unlock-phone-reply', `Error: ${error.message}`);
    //         return;
    //     }
    //     if (stderr) {
    //         console.error(`Stderr: ${stderr}`);
    //         event.reply('unlock-phone-reply', `Stderr: ${stderr}`);
    //         return;
    //     }
    //     event.reply('unlock-phone-reply', `Phone unlocked successfully.`);
    // });
}
function deciceActions(event, action) {

    switch (action) {

        case 'unlock':
            unlockPhone(event);
            break;
        default:
            lockPhone(event);
            break;
    }

}
// function toggleAirplaneMode(event) {
//     const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`;

//     // Kiểm tra trạng thái hiện tại của chế độ máy bay
//     exec(`${adbPath} shell settings get global airplane_mode_on`, (error, stdout, stderr) => {
//         if (error) {
//             console.error(`Error: ${error.message}`);
//             event.reply('service-toggle-reply', `Error: ${error.message}`);
//             return;
//         }
//         if (stderr) {
//             console.error(`Stderr: ${stderr}`);
//             event.reply('service-toggle-reply', `Stderr: ${stderr}`);
//             return;
//         }

//         const isAirplaneModeOn = stdout.trim() === '1';

//         // Chuyển trạng thái chế độ máy bay
//         const command = isAirplaneModeOn
//             ? `${adbPath} shell settings put global airplane_mode_on 0`
//             : `${adbPath} shell settings put global airplane_mode_on 1`;

//         exec(command, (error, stdout, stderr) => {
//             if (error) {
//                 console.error(`Error: ${error.message}`);
//                 event.reply('service-toggle-reply', `Error: ${error.message}`);
//                 return;
//             }
//             if (stderr) {
//                 console.error(`Stderr: ${stderr}`);
//                 event.reply('service-toggle-reply', `Stderr: ${stderr}`);
//                 return;
//             }

//             const action = isAirplaneModeOn ? 'disabled' : 'enabled';
//             event.reply('service-toggle-reply', `Airplane mode ${action} successfully.`);
//         });
//     });
// }
function toggleAirplaneMode(event) {
    // Gửi lệnh kiểm tra trạng thái chế độ máy bay qua WebSocket
    sendMessageShell('settings get global airplane_mode_on');

    let airplaneModeToggled = false;
    // Lắng nghe phản hồi từ WebSocket
    ws.on('message', function (data) {

        if (airplaneModeToggled) return;  // Nếu không xử lý báo cáo chê độ máy bay, không xử lý thểm

        // Chuyển đổi dữ liệu thành chuỗi và loại bỏ các ký tự không cần thiết
        const message = data.toString().substring(5);
        console.log(`Received message: ${message}`);

        // Kiểm tra xem phản hồi có chứa trạng thái chế độ máy bay không
        if (message.includes('0') || message.includes('1')) {

            const isAirplaneModeOn = message[0] == '1';

            // Dựa trên trạng thái hiện tại của chế độ máy bay, xác định lệnh bật/tắt
            const command = isAirplaneModeOn
                ? 'settings put global airplane_mode_on 0'  // Tắt chế độ máy bay
                : 'settings put global airplane_mode_on 1'; // Bật chế độ máy bay

            // Gửi lệnh bật/tắt chế độ máy bay qua WebSocket
            sendMessageShell(command);

            airplaneModeToggled = true;

        }

    });
}
// function toggleWifi(event) {
//     const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`;

//     const dumpsys = spawn(`${adbPath} shell dumpsys wifi`, { shell: true });

//     let stdoutData = '';
//     dumpsys.stdout.on('data', (data) => {
//         stdoutData += data.toString();
//     });

//     dumpsys.stderr.on('data', (data) => {
//         console.error(`Stderr: ${data}`);
//         event.reply('service-toggle-reply', `Stderr: ${data}`);
//     });

//     dumpsys.on('close', (code) => {
//         if (code !== 0) {
//             event.reply('service-toggle-reply', `Command failed with exit code ${code}`);
//             return;
//         }

//         const isWifiEnabled = stdoutData.includes("Wi-Fi is enabled");
//         const command = isWifiEnabled
//             ? `${adbPath} shell svc wifi disable`
//             : `${adbPath} shell svc wifi enable`;

//         const wifiToggle = spawn(command, { shell: true });

//         wifiToggle.on('close', (code) => {
//             if (code !== 0) {
//                 event.reply('service-toggle-reply', `Command failed with exit code ${code}`);
//                 return;
//             }

//             const action = isWifiEnabled ? 'Wi-Fi disabled' : 'Wi-Fi enabled';
//             event.reply('service-toggle-reply', `${action} successfully.`);
//         });
//     });
// }
function toggleWifi(event) {
    // Gửi lệnh kiểm tra trạng thái Wi-Fi qua WebSocket
    sendMessageShell('dumpsys wifi');

    // Cờ để ngăn chặn việc xử lý phản hồi nhiều lần
    let wifiToggled = false;

    // Xử lý phản hồi từ WebSocket
    ws.on('message', function (data) {
        if (wifiToggled) return;  // Nếu đã xử lý bật/tắt Wi-Fi, không xử lý thêm

        // Chuyển đổi dữ liệu thành chuỗi và loại bỏ các ký tự không cần thiết
        data = data.toString().substring(5);

        // Kiểm tra xem phản hồi có chứa trạng thái Wi-Fi không
        if (data.includes("Wi-Fi is enabled") || data.includes("Wi-Fi is disabled")) {
            const isWifiEnabled = data.includes("Wi-Fi is enabled");

            // Dựa trên trạng thái hiện tại của Wi-Fi, xác định lệnh bật/tắt
            const command = isWifiEnabled
                ? 'svc wifi disable'  // Lệnh tắt Wi-Fi
                : 'svc wifi enable';  // Lệnh bật Wi-Fi

            // Gửi lệnh bật/tắt Wi-Fi qua WebSocket
            sendMessageShell(command);

            // Đặt cờ để ngăn xử lý lại
            wifiToggled = true;

            // Gửi phản hồi về kết quả bật/tắt Wi-Fi
            const action = isWifiEnabled ? 'Wi-Fi disabled' : 'Wi-Fi enabled';
            event.reply('service-toggle-reply', `${action} successfully.`);
        }
    });
}
// function toggleData(event) {
//     const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`;

//     // Bước 1: Kiểm tra trạng thái hiện tại của Mobile Data
//     exec(`${adbPath} shell settings get global mobile_data`, (error, stdout, stderr) => {
//         if (error) {
//             console.error(`Error: ${error.message}`);
//             event.reply('service-toggle-reply', `Error: ${error.message}`);
//             return;
//         }
//         if (stderr) {
//             console.error(`Stderr: ${stderr}`);
//             event.reply('service-toggle-reply', `Stderr: ${stderr}`);
//             return;
//         }

//         // Tìm trạng thái của Mobile Data trong kết quả đầu ra
//         const isDataEnabled = stdout.trim() === '1'; // 1 indicates enabled

//         // Bước 2: Toggle trạng thái của Mobile Data
//         const action = isDataEnabled ? 'disable' : 'enable';

//         exec(`${adbPath} shell svc data ${action}`, (error, stdout, stderr) => {
//             if (error) {
//                 console.error(`Error: ${error.message}`);
//                 event.reply('service-toggle-reply', `Error: ${error.message}`);
//                 return;
//             }
//             if (stderr) {
//                 console.error(`Stderr: ${stderr}`);
//                 event.reply('service-toggle-reply', `Stderr: ${stderr}`);
//                 return;
//             }
//             event.reply('service-toggle-reply', `Mobile data ${action === 'enable' ? 'enabled' : 'disabled'}.`);
//         });
//     });
// }
function toggleData(event) {
    // Gửi lệnh kiểm tra trạng thái Mobile Data qua WebSocket
    sendMessageShell('settings get global mobile_data');

    // Cờ để ngăn chặn việc xử lý phản hồi nhiều lần
    let dataToggled = false;

    // Lắng nghe phản hồi từ WebSocket
    ws.on('message', function (data) {

        if (dataToggled) return;  // Nếu đã xử lý Mobile Data, không xử lý thêm

        // Chuyển đổi dữ liệu thành chuỗi và loại bỏ các ký tự không cần thiết
        const message = data.toString().substring(5);

        console.log(`Received message: ${message}`);

        // Kiểm tra trạng thái của Mobile Data
        if (message.includes('0') || message.includes('1')) {
            console.log('Processing toggle');

            const isDataEnabled = message[0] === '1';

            // Dựa trên trạng thái hiện tại của Mobile Data, xác định lệnh bật/tắt
            const command = isDataEnabled
                ? 'svc data disable'  // Tắt Mobile Data
                : 'svc data enable';  // Bật Mobile Data

            // Gửi lệnh bật/tắt Mobile Data qua WebSocket
            sendMessageShell(command);

            // Đặt cờ để ngăn xử lý lại
            dataToggled = true;

        }
    });
}
// function toggleLocation(event) {
//     const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`;

//     // Kiểm tra trạng thái hiện tại của Location
//     exec(`${adbPath} shell settings get secure location_mode`, (error, stdout, stderr) => {
//         if (error) {
//             console.error(`Error: ${error.message}`);
//             event.reply('service-toggle-reply', `Error: ${error.message}`);
//             return;
//         }
//         if (stderr) {
//             console.error(`Stderr: ${stderr}`);
//             event.reply('service-toggle-reply', `Stderr: ${stderr}`);
//             return;
//         }

//         const currentState = parseInt(stdout.trim(), 10);
//         const newState = currentState === 3 ? 0 : 3;

//         exec(`${adbPath} shell settings put secure location_mode ${newState}`, (error, stdout, stderr) => {
//             if (error) {
//                 console.error(`Error: ${error.message}`);
//                 event.reply('service-toggle-reply', `Error: ${error.message}`);
//                 return;
//             }
//             if (stderr) {
//                 console.error(`Stderr: ${stderr}`);
//                 event.reply('service-toggle-reply', `Stderr: ${stderr}`);
//                 return;
//             }
//             event.reply('service-toggle-reply', `Location mode toggled to ${newState === 3 ? 'enabled' : 'disabled'}.`);
//         });
//     });
// }
function toggleLocation(event) {
    // Gửi lệnh kiểm tra trạng thái Location qua WebSocket
    sendMessageShell('settings get secure location_mode');

    // Cờ để ngăn chặn việc xử lý phản hồi nhiều lần
    let locationToggled = false;

    // Lắng nghe phản hồi từ WebSocket
    ws.on('message', function (data) {

        if (locationToggled) return;  // Nếu đã xử lý Location, không xử lý thêm

        // Chuyển đổi dữ liệu thành chuỗi và loại bỏ các ký tự không cần thiết
        const message = data.toString().substring(5);


        if (message.includes('0') || message.includes('1')) {

            const isLocationModeOn = message[0] == '1';


            const command = isLocationModeOn
                ? 'settings put secure location_mode 0'
                : 'settings put secure location_mode 1';


            sendMessageShell(command);

            locationToggled = true;

        }
    });
}
function toggleService(event, service) {
    console.log(service);

    switch (service) {
        case 'AirplaneMode':
            toggleAirplaneMode(event);
            break;
        case 'Wifi':
            toggleWifi(event);
            break;
        case '3g/4g':
            toggleData(event);
            break;
        case 'Location':
            toggleLocation(event);
            break;
        default:
            event.reply('service-toggle-reply', 'Unknown action');
            break;
    }

}
function transferFile(event, action, localFilePath, remoteFilePath) {
    //  Remote (Thiết bị Android): /sdcard/Download/example.jpg
    //  Local (Máy tính của bạn): C:/Users/MY ASUS/Downloads/

    let command;
    if (action === 'push') {
        command = `push "${localFilePath}" "${remoteFilePath}"`;
    } else if (action === 'pull') {
        command = `pull "${remoteFilePath}" "${localFilePath}"`;
    } else {
        event.reply('file-transfer-reply', `Unknown action: ${action}`);
        return;
    }

    sendMessageShell(command);

    // const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`; // Đường dẫn đầy đủ tới adb
    // console.log(action, localFilePath, remoteFilePath);

    // // Xác định lệnh dựa trên hành động
    // let command;
    // if (action === 'push') {
    //     command = `${adbPath} push "${localFilePath}" "${remoteFilePath}"`;
    // } else if (action === 'pull') {
    //     command = `${adbPath} pull "${remoteFilePath}" "${localFilePath}"`;
    // } else {
    //     event.reply('file-transfer-reply', `Unknown action: ${action}`);
    //     return;
    // }
    // Thực thi lệnh
    // exec(command, (error, stdout, stderr) => {
    //     if (error) {
    //         console.error(`Error: ${error.message}`);
    //         event.reply('file-transfer-reply', `Error: ${error.message}`);
    //         return;
    //     }
    //     if (stderr) {
    //         console.error(`Stderr: ${stderr}`);
    //         event.reply('file-transfer-reply', `Stderr: ${stderr}`);
    //         return;
    //     }
    //     event.reply('file-transfer-reply', `File transfer successful: ${action}`);
    // });
}

// function touch(event, xpathQuery, timeOut = 10, touchType = 'Normal', delay = 100) {
//     console.log(`Touch: ${xpathQuery}, ${timeOut}, ${touchType}, ${delay}`);

//     const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`; // Đường dẫn đầy đủ tới adb

//     try {
//         // Bước 1: Trích xuất giao diện hiện tại và lưu vào tệp XML
//         execSync(`${adbPath} shell uiautomator dump /sdcard/ui.xml`);
//         execSync(`${adbPath} pull /sdcard/ui.xml .`);

//         // Bước 2: Đọc và phân tích tệp XML để lấy tọa độ từ XPath
//         const data = fs.readFileSync('ui.xml', 'utf8');
//         const doc = new DOMParser().parseFromString(data);
//         const nodes = xpath.select(xpathQuery, doc);

//         if (nodes.length > 0) {
//             const boundsAttr = nodes[0].getAttribute('bounds');
//             const boundsRegex = /(\d+),(\d+)\]\[(\d+),(\d+)/;
//             const match = boundsAttr.match(boundsRegex);

//             if (match) {
//                 const [left, top, right, bottom] = match.slice(1).map(Number);
//                 const x = Math.floor((left + right) / 2);
//                 const y = Math.floor((top + bottom) / 2);

//                 const timeOutMilliseconds = timeOut * 1000;

//                 // Bước 3: Thực hiện lệnh chạm dựa trên loại chạm
//                 let touchCommand;
//                 switch (touchType) {
//                     case 'Long':
//                         // Chạm giữ lâu bằng cách sử dụng swipe với cùng tọa độ và thời gian giữ lâu
//                         touchCommand = `${adbPath} shell input swipe ${x} ${y} ${x} ${y} ${timeOutMilliseconds}`;
//                         break;
//                     case 'Double':
//                         // Chạm hai lần bằng cách sử dụng tap hai lần với khoảng cách ngắn
//                         touchCommand = `${adbPath} shell input tap ${x} ${y} && ${adbPath} shell input tap ${x} ${y}`;
//                         break;
//                     default:
//                         // Chạm bình thường
//                         touchCommand = `${adbPath} shell input tap ${x} ${y}`;
//                         break;
//                 }

//                 if (delay > 0) {
//                     setTimeout(() => {
//                         execSync(touchCommand);
//                         event.reply('touch-reply', `Element touched at (${x}, ${y})`);
//                     }, delay);
//                 } else {
//                     execSync(touchCommand);
//                     event.reply('touch-reply', `Element touched at (${x}, ${y})`);
//                 }

//             } else {
//                 event.reply('touch-reply', 'No bounds attribute found for the element');
//             }
//         } else {
//             event.reply('touch-reply', 'No element found for the XPath query');
//         }
//     } catch (error) {
//         event.reply('touch-reply', `Error: ${error.message}`);
//     }

async function touch(event, xpathQuery, timeOut = 10, touchType = 'Normal', delay = 100) {
    console.log(`Touch: ${xpathQuery}, ${timeOut}, ${touchType}, ${delay}`);

    try {
        await sendMessageShell(`uiautomator dump /sdcard/ui.xml`);

        execSync(`adb pull /sdcard/ui.xml .`);

        // Bước 2: Đọc và phân tích tệp XML để lấy tọa độ từ XPath
        const data = fs.readFileSync('ui.xml', 'utf8');
        const doc = new DOMParser().parseFromString(data);
        const nodes = xpath.select(xpathQuery, doc);

        if (nodes.length > 0) {
            const boundsAttr = nodes[0].getAttribute('bounds');
            const boundsRegex = /(\d+),(\d+)\]\[(\d+),(\d+)/;
            const match = boundsAttr.match(boundsRegex);

            if (match) {
                const [left, top, right, bottom] = match.slice(1).map(Number);
                const x = Math.floor((left + right) / 2);
                const y = Math.floor((top + bottom) / 2);

                const timeOutMilliseconds = timeOut * 1000;

                // Bước 3: Thực hiện lệnh chạm dựa trên loại chạm
                let touchCommand;
                switch (touchType) {
                    case 'Long':
                        // Chạm giữ lâu bằng cách sử dụng swipe với cùng tọa độ và thời gian giữ lâu
                        touchCommand = `input swipe ${x} ${y} ${x} ${y} ${timeOutMilliseconds}`;
                        break;
                    case 'Double':
                        // Chạm hai lần bằng cách sử dụng tap hai lần với khoảng cách ngắn
                        touchCommand = `input tap ${x} ${y} && input tap ${x} ${y}`;
                        break;
                    default:
                        // Chạm bình thường
                        touchCommand = `input tap ${x} ${y}`;
                        break;
                }

                if (delay > 0) {
                    setTimeout(() => {
                        sendMessageShell(touchCommand);
                        event.reply('touch-reply', `Element touched at (${x}, ${y})`);
                    }, delay);
                } else {
                    sendMessageShell(touchCommand);
                    event.reply('touch-reply', `Element touched at (${x}, ${y})`);
                }

            } else {
                event.reply('touch-reply', 'No bounds attribute found for the element');
            }
        } else {
            event.reply('touch-reply', 'No element found for the XPath query');
        }
    } catch (error) {
        event.reply('touch-reply', `Error: ${error.message}`);
    }


}

// }
// async function screenShot(event, options) {
//     console.log('Options:', options);

//     const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`;

//     const screenshotName = options.fileName || 'screenshot.png';
//     const outputFolder = `"${options.folderOutput}"` || '.';
//     const screenshotPathOnDevice = '/sdcard/screenshot.png';
//     const localScreenshotPath = path.join(outputFolder, screenshotName);

//     const crop = options.crop || false;
//     const outputVariable = options.outputVariable || null;
//     const startX = options.startX || 0;
//     const startY = options.startY || 0;
//     const endX = options.endX || 0;
//     const endY = options.endY || 0;

//     try {
//         // Bước 1: Chụp ảnh màn hình trên thiết bị Android và lưu vào bộ nhớ của thiết bị
//         console.log('Taking screenshot...');
//         execSync(`${adbPath} shell screencap -p ${screenshotPathOnDevice}`);

//         // Bước 2: Tải ảnh chụp màn hình về máy tính
//         console.log('Pulling screenshot...');
//         execSync(`${adbPath} pull ${screenshotPathOnDevice} ${localScreenshotPath}`);

//         // Bước 3: Xóa ảnh chụp màn hình khỏi thiết bị sau khi đã tải về
//         execSync(`${adbPath} shell rm ${screenshotPathOnDevice}`);

//         // Bước 4: Xử lý cắt ảnh nếu được yêu cầu
//         if (crop) {
//             console.log('Cropping screenshot...');
//             // Sử dụng jimp để cắt ảnh dựa trên các tọa độ được nhập
//             const image = await Jimp.read(localScreenshotPath);
//             const width = endX - startX;
//             const height = endY - startY;
//             await image
//                 .crop(startX, startY, width, height)
//                 .writeAsync(localScreenshotPath.replace('.png', '_cropped.png'));
//         }

//         // Bước 5: Xuất ảnh dưới dạng base64 nếu yêu cầu
//         if (outputVariable) {
//             const screenshotData = fs.readFileSync(localScreenshotPath, { encoding: 'base64' });
//             event.reply('screenshot-reply', { base64: screenshotData });
//         } else {
//             event.reply('screenshot-reply', `Screenshot saved as ${localScreenshotPath}`);
//         }
//     } catch (error) {
//         console.error(`Error: ${error.message}`);
//         event.reply('screenshot-reply', `Error: ${error.message}`);
//     }
// }

async function screenShot(event, options) {
    console.log('Options:', options);

    const screenshotName = options.fileName || 'screenshot.png';
    const outputFolder = options.folderOutput || '.';
    const localScreenshotPath = path.join(outputFolder, screenshotName);

    // Kiểm tra thư mục đích và tạo nếu cần
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }

    const crop = options.crop || false;
    const outputVariable = options.outputVariable || null;
    const startX = options.startX || 0;
    const startY = options.startY || 0;
    const endX = options.endX || 0;
    const endY = options.endY || 0;

    try {
        // Bước 1: Gửi lệnh chụp màn hình qua WebSocket
        const screenshotCommand = 'screencap -p /sdcard/screenshot.png';
        sendMessageShell(screenshotCommand);

        // Đợi một chút để thiết bị xử lý lệnh chụp màn hình
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Bước 2: Tải ảnh chụp màn hình về máy tính
        console.log('Pulling screenshot...');
        // Sử dụng dấu gạch chéo cho đường dẫn trên Windows
        const pullCommand = `adb pull /sdcard/screenshot.png "${localScreenshotPath.replace(/\\/g, '/')}"`;
        execSync(pullCommand);

        // Bước 3: Xóa ảnh chụp màn hình khỏi thiết bị sau khi đã tải về
        const removeCommand = 'rm /sdcard/screenshot.png';
        sendMessageShell(removeCommand);

        // Bước 4: Xử lý cắt ảnh nếu được yêu cầu
        if (crop) {
            console.log('Cropping screenshot...');
            const image = await Jimp.read(localScreenshotPath);
            const width = endX - startX;
            const height = endY - startY;
            await image
                .crop(startX, startY, width, height)
                .writeAsync(localScreenshotPath.replace('.png', '_cropped.png'));
        }

        // Bước 5: Xuất ảnh dưới dạng base64 nếu yêu cầu
        if (outputVariable) {
            const screenshotData = fs.readFileSync(localScreenshotPath, { encoding: 'base64' });
            event.reply('screenshot-reply', { base64: screenshotData });
        } else {
            event.reply('screenshot-reply', `Screenshot saved as ${localScreenshotPath}`);
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        event.reply('screenshot-reply', `Error: ${error.message}`);
    }
}
function swipeSimple(event, direction) {
    console.log('Direction:', direction);

    // Đường dẫn đầy đủ tới adb
    // const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`; 

    // Kiểm tra tham số
    if (!direction) {
        event.reply('swipe-reply', 'Lỗi: Thiếu tùy chọn Direction');
        return;
    }

    // Xác định tọa độ swipe dựa trên direction
    let startX, startY, endX, endY;

    switch (direction) {
        case 'Up':
            startX = 500;
            startY = 1000;
            endX = 500;
            endY = 200;
            break;
        case 'Down':
            startX = 500;
            startY = 300;
            endX = 500;
            endY = 800;
            break;
        case 'Left':
            startX = 600;
            startY = 500;
            endX = 300;
            endY = 500;
            break;
        case 'Right':
            startX = 200;
            startY = 500;
            endX = 1000;
            endY = 500;
            break;
        default:
            event.reply('swipe-reply', 'Lỗi: Direction không hợp lệ');
            return;
    }

    console.log(`Start: (${startX}, ${startY}), End: (${endX}, ${endY})`);

    sendMessageShell(`input swipe ${startX} ${startY} ${endX} ${endY}`);

    // Xây dựng lệnh swipe
    // const swipeCommand = `${adbPath} shell input swipe ${startX} ${startY} ${endX} ${endY}`;
    // console.log(`Đang thực hiện lệnh: ${swipeCommand}`); // Dòng debug

    // try {
    //     // Thực thi lệnh swipe
    //     const stdout = execSync(swipeCommand).toString();
    //     console.log(`Đầu ra của lệnh: ${stdout}`); // Dòng debug

    //     event.reply('swipe-reply', 'Swipe/Scroll đã được thực hiện thành công');
    // } catch (error) {
    //     console.error(`Lỗi khi thực hiện lệnh: ${error.message}`);
    //     event.reply('swipe-reply', `Lỗi: ${error.message}`);
    // }
}
function swipeCustom(event, startX, startY, endX, endY, duration) {

    // const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`;

    if (startX === undefined || startY === undefined || endX === undefined || endY === undefined || duration === undefined) {
        event.reply('swipe-reply', 'Lỗi: Thiếu tham số cần thiết cho Custom Mode');
        return;
    }

    // Xây dựng lệnh swipe với các tham số custom
    // const swipeCommand = `${adbPath} shell input swipe ${startX} ${startY} ${endX} ${endY} ${duration}`;

    sendMessageShell(`input swipe ${startX} ${startY} ${endX} ${endY} ${duration}`);

    // try {
    //     // Thực thi lệnh swipe
    //     const stdout = execSync(swipeCommand).toString();
    //     console.log(`Đầu ra của lệnh: ${stdout}`); // Dòng debug

    //     event.reply('swipe-reply', 'Swipe/Scroll đã được thực hiện thành công');
    // } catch (error) {
    //     console.error(`Lỗi khi thực hiện lệnh: ${error.message}`);
    //     event.reply('swipe-reply', `Lỗi: ${error.message}`);
    // }
}
function pressKey(event, keyCode) {
    sendMessageShell(`input keyevent ${keyCode}`);
    // const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`;

    // console.log(`Pressing key ${keyCode}...`);

    // try {
    //     // Sử dụng execSync để gửi lệnh nhấn phím tới thiết bị Android
    //     console.log(`Sending key event ${keyCode} to the device...`);
    //     execSync(`${adbPath} shell input keyevent ${keyCode}`);
    //     console.log(`Key event ${keyCode} sent successfully.`);
    // } catch (error) {
    //     console.error(`Error: ${error.message}`);
    // }
}

// function typeText(event, selector, seconds = 10, text) {
//     console.log(`Selector: ${selector}, Duration: ${seconds}, Text: ${text}`);

//     const adbPath = `"C:/Users/MY ASUS/AppData/Local/Android/Sdk/platform-tools/adb.exe"`;

//     try {
//         // Bước 1: Trích xuất giao diện hiện tại và lưu vào tệp XML
//         console.log('Running uiautomator dump...');
//         execSync(`${adbPath} shell uiautomator dump /sdcard/ui.xml`, { stdio: 'inherit' });

//         console.log('Pulling ui.xml...');
//         execSync(`${adbPath} pull /sdcard/ui.xml .`, { stdio: 'inherit' });

//         // Bước 2: Đọc và phân tích tệp XML để lấy tọa độ của trường nhập liệu
//         const data = fs.readFileSync('ui.xml', 'utf8');
//         const doc = new DOMParser().parseFromString(data, 'text/xml');
//         const nodes = xpath.select(selector, doc);

//         if (nodes.length > 0) {
//             const node = nodes[0];
//             const boundsAttr = node.getAttribute('bounds');

//             if (!boundsAttr) {
//                 event.reply('type-text-reply', 'No bounds attribute found for the element');
//                 return;
//             }

//             const boundsRegex = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/;
//             const match = boundsAttr.match(boundsRegex);

//             if (match) {
//                 const [left, top, right, bottom] = match.slice(1).map(Number);
//                 const x = Math.floor((left + right) / 2);
//                 const y = Math.floor((top + bottom) / 2);

//                 // Bước 3: Nhấp vào trường để chọn nó
//                 console.log(`Tapping on (${x}, ${y})...`);
//                 execSync(`${adbPath} shell input tap ${x} ${y}`, { stdio: 'inherit' });

//                 // Bước 4: Nhập văn bản vào trường
//                 const escapedText = text.replace(/ /g, '%s'); // Escape space characters
//                 const typeCommand = `${adbPath} shell input text "${escapedText}"`;

//                 console.log(`Executing command: ${typeCommand}`);
//                 execSync(typeCommand, { stdio: 'inherit' });

//                 // Đợi trong một khoảng thời gian để đảm bảo văn bản đã được nhập
//                 console.log(`Waiting for ${seconds} seconds...`);
//                 setTimeout(() => {
//                     event.reply('type-text-reply', `Text typed successfully into field at (${x}, ${y})`);
//                 }, seconds * 1000);
//             } else {
//                 event.reply('type-text-reply', 'Bounds attribute format is incorrect');
//             }
//         } else {
//             event.reply('type-text-reply', 'No element found for the XPath query');
//         }
//     } catch (error) {
//         console.error(`Error: ${error.message}`);
//         event.reply('type-text-reply', `Error: ${error.message}`);
//     }
// }
function typeText(event, selector, seconds = 10, text) {
    console.log(`Selector: ${selector}, Duration: ${seconds}, Text: ${text}`);

    try {
        // Bước 1: Trích xuất giao diện hiện tại và lưu vào tệp XML
        console.log('Running uiautomator dump...');
        sendMessageShell('uiautomator dump /sdcard/ui.xml');

        console.log('Pulling ui.xml...');
        execSync(`adb pull /sdcard/ui.xml .`);

        // Bước 2: Đọc và phân tích tệp XML để lấy tọa độ của trường nhập liệu
        const data = fs.readFileSync('ui.xml', 'utf8');
        const doc = new DOMParser().parseFromString(data, 'text/xml');
        const nodes = xpath.select(selector, doc);

        if (nodes.length > 0) {
            const node = nodes[0];
            const boundsAttr = node.getAttribute('bounds');

            if (!boundsAttr) {
                event.reply('type-text-reply', 'No bounds attribute found for the element');
                return;
            }

            const boundsRegex = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/;
            const match = boundsAttr.match(boundsRegex);

            if (match) {
                const [left, top, right, bottom] = match.slice(1).map(Number);
                const x = Math.floor((left + right) / 2);
                const y = Math.floor((top + bottom) / 2);

                // Bước 3: Nhấp vào trường để chọn nó
                console.log(`Tapping on (${x}, ${y})...`);
                sendMessageShell(`input tap ${x} ${y}`);

                // Bước 4: Nhập văn bản vào trường
                const escapedText = text.replace(/ /g, '%s'); // Escape space characters
                const typeCommand = `input text "${escapedText}"`;

                console.log(`Executing command: ${typeCommand}`);
                sendMessageShell(typeCommand);

                // Đợi trong một khoảng thời gian để đảm bảo văn bản đã được nhập
                console.log(`Waiting for ${seconds} seconds...`);
                setTimeout(() => {
                    event.reply('type-text-reply', `Text typed successfully into field at (${x}, ${y})`);
                }, seconds * 1000);
            } else {
                event.reply('type-text-reply', 'Bounds attribute format is incorrect');
            }
        } else {
            event.reply('type-text-reply', 'No element found for the XPath query');
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        event.reply('type-text-reply', `Error: ${error.message}`);
    }
}

let scrcpyProcess = null;

const wsScrcpyPath = path.join(__dirname, 'ws-scrcpy/dist/index.js');

function startScrcpy() {
    if (scrcpyProcess) {
        console.log('ws-scrcpy is already running.');
        return;
    }

    // Sử dụng fork để khởi động ws-scrcpy
    scrcpyProcess = fork(wsScrcpyPath);

    scrcpyProcess.on('message', (message) => {
        console.log(`ws-scrcpy message: ${message}`);
    });

    scrcpyProcess.on('error', (error) => {
        console.error(`Error starting ws-scrcpy: ${error}`);
    });

    scrcpyProcess.on('exit', (code) => {
        console.log(`ws-scrcpy exited with code ${code}`);
        scrcpyProcess = null;
    });

    console.log('ws-scrcpy started.');

}
function stopScrcpy() {
    if (!scrcpyProcess) {
        console.log('ws-scrcpy is not running.');
        return;
    }

    // Dừng tiến trình ws-scrcpy
    scrcpyProcess.kill();

    scrcpyProcess.on('exit', (code) => {
        console.log(`ws-scrcpy stopped with exit code ${code}`);
        scrcpyProcess = null;
    });

    console.log('ws-scrcpy stopping.');
}
function getDeviceList() {
    return new Promise((resolve, reject) => {
        exec('adb devices', (error, stdout, stderr) => {
            if (error) {
                reject(`Error: ${stderr}`);
                return;
            }
            resolve(stdout);
        });
    });
}

function deviceManager() {
    ws.send([0x04, 0x02, 0x00, 0x00, 0x00, 0x47, 0x54, 0x52, 0x43])
    ws.on('message', async function message(data) {
        try {
            data = data.toString().substring(5);
            // Chuyển đổi dữ liệu nhận được từ WebSocket thành chuỗi và phân tích nó
            const jsonData = JSON.parse(data);

            if (jsonData.type === 'devicelist') {

                const devices = jsonData.data.list;

                // Lấy danh sách UDID của thiết bị mới
                const deviceIds = devices.map(device => device.udid);

                // Cập nhật hoặc thêm thiết bị vào cơ sở dữ liệu
                for (const device of devices) {
                    const { udid, state, ...rest } = device;
                    await Device.upsert({
                        name: udid, // Sử dụng `udid` làm `name` để đảm bảo tính duy nhất
                        status: state === 'device' ? 'online' : 'offline', // Cập nhật trạng thái thiết bị
                        ...rest, // Thêm các trường khác nếu cần thiết
                        lastUpdate: new Date() // Cập nhật thời gian cuối cùng
                    });
                }

                // Lấy danh sách thiết bị hiện tại từ cơ sở dữ liệu
                const allDevices = await Device.findAll();
                const currentDeviceIds = allDevices.map(device => device.name); // Sử dụng `name` vì `id` là UDID

                // Xác định các thiết bị đã không còn trong danh sách mới
                const offlineDevices = currentDeviceIds.filter(id => !deviceIds.includes(id));

                // Cập nhật trạng thái của các thiết bị không còn trong danh sách mới
                if (offlineDevices.length > 0) {
                    await Device.update(
                        { status: 'offline' },
                        { where: { name: offlineDevices } } // Sử dụng `name` vì `id` là UDID
                    );
                }

                console.log('Device list updated.');

            }
        } catch (error) {
            console.error('Error processing device list:', error);
        }
    });
}

async function getDevices() {
    try {
        const devices = await Device.findAll();
        return devices
    } catch (error) {
        console.error('Error retrieving device list:', error);
        return [];
    }
}

async function deleteDevices(event, name) {
    console.log('Deleting device:', name);

    await Device.destroy({ where: { name } });
}

module.exports = {
    startApp,
    closeApp,
    pressBack,
    pressHome,
    pressMenu,
    inStallApp,
    unInStallApp,
    isInStallApp,
    deciceActions,
    toggleService,
    transferFile,
    touch,
    swipeSimple,
    swipeCustom,
    screenShot,
    pressKey,
    typeText,
    startScrcpy,
    stopScrcpy,
    getDeviceList,
    connectWebSocket,
    deviceManager,
    getDevices,
    deleteDevices,
    adbShell,
    generate2FA,
    ElementExists,
    getAttribute
}       