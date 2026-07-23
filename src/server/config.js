
/**
 * 网关配置
 * 优先使用环境变量，其次使用 .env.dev 文件，最后使用默认值
 */
export const CONFIG = {
    // 超时配置
    CORS_HEADERS: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json'
    }
}

export default CONFIG