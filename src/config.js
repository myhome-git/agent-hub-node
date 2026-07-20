// 是否开启跨域
export const corsSwitch = true

// 输出header
export const responseHeader = {
    'Content-Type': 'application/json; charset=UTF-8',
}

// 允许的请求方法
export const requestMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']

// 文件上传
export const fileUpload = {
    maxSize: 100 * 1024 * 1024, // 文件最大限制，单位：字节
}

export default {
    corsSwitch,
    responseHeader,
    requestMethods,
    fileUpload
}