/**
 * 函数防抖
 * @param func 
 * @param duration 
 */
export function debounce(func, duration = 500) {
    let timerId;
    // @ts-ignore
    return function (...args) {
        clearTimeout(timerId);
        timerId = setTimeout(() => {
            // @ts-ignore
            func.apply(this, args);
        }, duration);
    }
}

/**
 * 判断对象类型
 */
export const getType = (obj) => {
    // Object,Array,Date,RegExp,Function,Null,Undefined,Number,String,Boolean
    return Object.prototype.toString.call(obj).slice(8, -1);
}

/**
 * 定义对象类型，预防大小写混乱
 */
export const ObjectType = {
    Object: 'Object',
    Array: 'Array',
    Date: 'Date',
    RegExp: 'RegExp',
    Function: 'Function',
    Null: 'Null',
    Undefined: 'Undefined',
    Number: 'Number',
    String: 'String',
    Boolean: 'Boolean',
}
/**
 * 判断值是否为有效值
 * @param {*} value - 要检查的值
 * @returns {boolean} - 是否为有效值
 */
export function isValidValue(value) {
    // 处理null和undefined
    if (value === null || value === undefined) {
        return false;
    }

    // 处理空字符串
    if (typeof value === 'string' && value.trim() === '') {
        return false;
    }

    // 处理空数组
    if (Array.isArray(value) && value.length === 0) {
        return false;
    }

    // 处理空对象
    if (typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value).length !== 0;
    }

    // 处理NaN
    if (typeof value === 'number' && isNaN(value)) {
        return false;
    }

    return true;
}

// MD5加密函数
export async function md5(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('MD5', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// MD5加密函数 - 改进版本，可以处理字符串或File对象
export async function toMd5(input) {
    let buffer;
    
    // 如果输入是File对象或其他Blob类型
    if (input instanceof Blob) {
        buffer = await input.arrayBuffer();
    } 
    // 如果输入是字符串
    else if (typeof input === 'string') {
        buffer = new TextEncoder().encode(input);
    } 
    // 如果输入是ArrayBuffer
    else if (input instanceof ArrayBuffer) {
        buffer = input;
    } 
    // 如果输入是Uint8Array或其他TypedArray
    else if (input && input.buffer instanceof ArrayBuffer) {
        buffer = input.buffer;
    } 
    // 其他情况，转换为字符串处理
    else {
        buffer = new TextEncoder().encode(String(input));
    }
    
    const hashBuffer = await crypto.subtle.digest('MD5', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isNumber(value) {
    return /^-?\d*\.?\d+$/.test(String(value));
}

/**
 * 生成一个随机数
 * @param min 
 * @param max 
 * @returns 
 */
export function getRandomInt(min, max) {
    min = Math.ceil(min); // 向上取整
    max = Math.floor(max); // 向下取整
    return Math.floor(Math.random() * (max - min + 1)) + min; // 最大值和最小值都包含
}

/**
 * 获取当前日期，并格式化为指定的格式。
 * @param {string} format - 日期格式，例如 'YYYY-MM-DD', 'MM/DD/YYYY', 'YYYY年MM月DD日' 等。
 * @returns {string} - 格式化后的日期字符串。
 */
export function getCurrentDate(timestamp = Date.now(), format = 'YYYY-MM-DD HH:mm:ss') {
    const now = new Date(timestamp);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // 月份从 0 开始，需要 +1
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    // 替换日期格式中的占位符
    let formattedDate = format.replace('YYYY', year);
    formattedDate = formattedDate.replace('MM', month);
    formattedDate = formattedDate.replace('DD', day);
    formattedDate = formattedDate.replace('HH', hours);
    formattedDate = formattedDate.replace('mm', minutes);
    formattedDate = formattedDate.replace('ss', seconds);

    return formattedDate;
}

/**
 * 获取从指定时间往前的时间戳
 * @param timestamp - 基准时间戳，默认为当前时间
 * @param format - 时间格式，支持字符串格式如 "1y"（1年前）、"3M"（3个月前）、"7d"（7天前）等
 * @returns 计算后的时间戳
 */
export function getDatePrevious(timestamp = Date.now(), format = "1M") {
    // 解析格式字符串，例如 "1y" 分解为数量 1 和单位 "y"
    const match = format.match(/^(\d+)([yMdHms])$/);
    if (!match) {
        console.error("Invalid format string. Expected format: {number}{unit}, e.g., '1y', '3M', '7d'");
        return undefined;
    }

    const num = parseInt(match[1], 10);
    const unit = match[2];

    if (num < 1) {
        return undefined;
    }

    const now = new Date(timestamp);

    switch (unit) {
        case "y": // 年
            now.setFullYear(now.getFullYear() - num);
            break;
        case "M": // 月
            // JavaScript的Date对象会自动处理跨年情况
            // 例如：1月(0)减去3个月会自动变为前一年的10月
            now.setMonth(now.getMonth() - num);
            break;
        case "d": // 天
            now.setDate(now.getDate() - num);
            break;
        case "H": // 小时
            now.setHours(now.getHours() - num);
            break;
        case "m": // 分钟
            now.setMinutes(now.getMinutes() - num);
            break;
        case "s": // 秒
            now.setSeconds(now.getSeconds() - num);
            break;
        default:
            console.error("Invalid time unit. Supported units: y(year), M(month), d(day), H(hour), m(minute), s(second)");
            return undefined;
    }
    return now.getTime();
}

/**
 * 格式化文件大小，将字节数转换为易读的格式
 * @param {number} bytes - 文件大小，单位字节
 * @returns {string} - 格式化后的文件大小字符串
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 定义一个字符串KEY_BASE，包含0-9、A-Z、a-z、[]{}:/,等字符
 */
const KEY_BASE = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz[]{}:/,";

// 生成一个随机密钥
export function getKey() {
    // 定义一个包含所有可能字符的字符串
    let key = KEY_BASE.toString();
    // 生成一个随机数
    Math.random();
    // 循环1000次
    for (var i = 0; i < 1000; i++) {
        // 生成两个随机数，分别表示字符在字符串中的位置
        var x = parseInt(Math.random() * (key.length) + 1),
            y = parseInt(Math.random() * (key.length) + 1),
            // 获取两个位置的字符
            si = key.substring(x - 1, x),
            sj = key.substring(y - 1, y);
        // 将两个位置的字符替换
        key = key.replace(si, "-")
            .replace(sj, si)
            .replace("-", sj);
    }
    // 返回生成的密钥
    return key;
}

// 函数encodeString用于将字符串s进行编码，返回编码后的字符串e
export function encodeString(keyStr, s) {
    // 定义一个空数组_array，用于存储编码后的字符
    const _array = [];
    let e = "";
    // 使用encodeURIComponent函数对字符串s进行编码
    s = encodeURIComponent(s);
    // 遍历0-127的字符
    for (var i = 0; i < 128; i++) {
        // 将字符转换为字符串，并存储到_array数组中
        _array[i] = String.fromCharCode(i);
        // 在temp_str中查找该字符，如果找到了，则将keyStr中对应位置的字符替换到_array中
        var li = KEY_BASE.indexOf(_array[i]);
        if (li > -1) {
            _array[i] = keyStr.substring(li, li + 1);
        }
    }
    // 遍历编码后的字符串s
    for (var i in s) {
        // 将编码后的字符添加到e中
        e = e + _array[s.charCodeAt(i)];
    }
    // 返回编码后的字符串e，并去除末尾的-字符
    return e.replace(/(\-*$)/g, "");
}

// 解码函数，将keyStr和s作为参数传入
export function decodeString(keyStr, s) {
    // 定义一个数组，用于存储字符编码
    const _array = [];
    let e = "";
    // 遍历0-127的字符编码
    for (var i = 0; i < 128; i++) {
        // 将字符编码转换为字符，并存储到数组中
        _array[i] = String.fromCharCode(i);
        // 在临时字符串中查找该字符，并获取其索引
        var li = KEY_BASE.indexOf(_array[i]);
        // 如果找到了该字符，则将其替换为keyStr中的对应字符
        if (li > -1) {
            _array[i] = keyStr.substring(li, li + 1);
        }
    }
    // 将s赋值给_s
    var _s = s;
    // 遍历_s中的每个字符
    for (var i in _s) {
        // 获取当前字符
        var _d = _s[i];
        // 定义一个变量，用于存储当前字符在_array中的索引
        var _li = -1;
        // 遍历_array中的每个字符
        for (var x = 0; x < 128; x++) {
            // 如果找到了当前字符，则将其索引赋值给_li，并跳出循环
            if (_array[x] == _d) {
                _li = x;
                break;
            }
        }
        //_li = -1 ? e= e + String.fromCharCode(_li) : 
        e = e + String.fromCharCode(_li);
    }
    try {
        e = decodeURIComponent(e);
    } catch (error) {

    }
    return e;
}