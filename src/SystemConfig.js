const SystemConfig = {
    corsSwitch: true,  // 是否开启跨域
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],   // 允许的请求方法
    file_upload_max_size: 100 * 1024 * 1024,  // 文件最大限制，单位：字节
};
export default SystemConfig;