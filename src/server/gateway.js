/**
 * AI 代理网关 - 主入口文件
 * 模块结构：
 * - config.js      : 配置管理
 * - database.js    : 数据库管理器
 * - sse-parser.js  : SSE Token 解析器
 * - gateway.js     : 核心字节流转发
 * - websocket.js   : WebSocket 实时推送
 * - cleanup.js     : 定时清理任务
 */

import http from 'http'
import { DatabaseManager } from './database.js'
import { forwardRequest } from './gateway-target.js'
import { initCleanupTask } from './cleanup.js'
import CONFIG from './config.js'

/**
 * 初始化网关服务
 * @param {Object} options - 配置选项
 * @param {number} options.port - HTTP 端口
 * @param {string} options.host - 监听地址
 * @returns {Object} - 管理器集合
 */
export async function initGateway(options = {}) {
    const port = options.port || process.env.GATEWAY_PORT
    const host = options.host || process.env.GATEWAY_HOST
    const targetApiURL = process.env.TARGET_API_URL
    const requestIntervalMs = Number(process.env.REQUEST_INTERVAL_MS) || 300

    // ==================== 初始化模块 ====================

    // 创建统计类对象
    const netDataCount = {
        // 统计变量
        bytesIn: 0,
        bytesOut: 0,
        promptTokens: 0, //  (提示词 Token 数)
        completionTokens: 0, //  (生成/回答 Token 数)
        totalTokens: 0, // (总 Token 数)，本次交互消耗的总算力单位。计算公式：通常为 prompt + completion + reasoning。
        reasoningTokens: 0 // (推理/思考 Token 数)
    }

    // 创建数据库管理器（等待初始化完成）
    const dbManager = new DatabaseManager()
    await dbManager.ready

    // 初始化定时清理任务
    initCleanupTask(dbManager)

    // ==================== 管理器集合 ====================

    const managers = {
        dbManager,
        callback: {
            completeTokens: ({ prompt, completion, reasoning, total }) => {
                // { prompt: 0, completion: 0, reasoning: 1385, total: 1385 }
                netDataCount.promptTokens += prompt
                netDataCount.completionTokens += completion
                netDataCount.reasoningTokens += reasoning
                netDataCount.totalTokens += total
            }
        }
    }

    // ==================== HTTP 服务器 ====================
    const clientReqMap = new Map()
    const server = http.createServer(async(req, res) => {
        // 【新增】处理 OPTIONS 预检请求 (CORS 必需，否则 Chatbox 会报 Network Error)
        if (req.method === 'OPTIONS') {
            console.log('[index] req method OPTIONS')
            res.writeHead(204, CONFIG.CORS_HEADERS)
            res.end()
            return
        }

        // 获得请求指纹
        const remoteAddress = req.socket.remoteAddress
        const headers = req.headers
        const userAgent = headers['user-agent']
        const authorization = headers['authorization']
        const clientId = `${remoteAddress}${userAgent}${authorization}`
        const currentTime = Date.now()
        const lastTime = clientReqMap.get(clientId)

        // 300ms 内的重复请求拦截
        if (lastTime && (currentTime - lastTime < requestIntervalMs)) {
            console.log('[Gateway] 拦截高频重复请求')
            // 1. 使用标准的 429 状态码
            res.writeHead(429, CONFIG.CORS_HEADERS)
            res.end(JSON.stringify({
                error: 'Rate limit exceeded',
                message: 'Too many requests, please try again later.'
            }))
            return
        }

        // 2. 记录当前请求时间
        clientReqMap.set(clientId, currentTime)

        // 3. 【关键】设置过期清理，防止内存泄漏
        // 如果 1秒 内该客户端没有新请求，自动从 Map 中删除
        setTimeout(() => {
            // 只有当 Map 中记录的时间依然是当前时间时，才删除（防止误删新请求）
            if (clientReqMap.get(clientId) === currentTime) {
                clientReqMap.delete(clientId)
            }
        }, 1000)

        // 【新增】禁用 Nagle 算法，确保流式数据立即发送，降低 Chatbox 首字和流式卡顿延迟
        if (req.socket) {
            req.socket.setNoDelay(true)
        }

        // 解析 URL
        const protocol = req.socket.encrypted ? 'https' : 'http'
        const url = new URL(req.url || '/', `${protocol}://${req.headers.host || 'localhost'}`)
        const pathname = url.pathname.replace('/v1', `/${process.env.TARGET_API_VERSION}`)

        // 健康检查
        if (pathname === '/health' && req.method === 'GET') {
            const stats = dbManager.getStats()
            const memoryUsage = process.memoryUsage()

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: {
                    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
                    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
                    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
                },
                stats: {
                    totalRequests: stats.summary.total_requests,
                    successRequests: stats.summary.total_success,
                    failedRequests: stats.summary.total_failed,
                }
            }))
            return
        }

        // 获取统计数据
        if (pathname === '/api/stats' && req.method === 'GET') {
            const stats = dbManager.getStats()
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
                timestamp: new Date().toISOString(),
                data: stats,
            }))
            return
        }

        // 重置统计数据
        if (pathname === '/api/stats/reset' && req.method === 'POST') {
            dbManager.reset()
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
                message: '统计数据已重置',
                timestamp: new Date().toISOString(),
            }))
            return
        }

        // 转发请求到目标服务
        const targetURL = `${targetApiURL}${pathname}${url.search}`
        console.log(`[index] ${req.method} ${req.url} -> ${targetURL}`)

        try {
            await forwardRequest(req, res, targetURL, managers)
        } catch (error) {
            console.error('[index] 转发失败:', error)

            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' })
            }
            res.end(JSON.stringify({
                error: 'Internal Server Error',
                message: error.message,
            }))
        }

    })

    // ==================== 启动服务 ====================

    function formatMB(num){
        return `${(num / 1024 / 1024).toFixed(2)} MB`
    }

    server.listen(port, host, async() => {
        // 获取统计数据
        const stats = await dbManager.getStats()
        const summary = stats.summary[0]
        const totalPromptTokens = summary.total_prompt_tokens || 0
        const totalCompletionTokens = summary.total_completion_tokens || 0
        const totalReasoningTokens = summary.total_reasoning_tokens || 0
        const total_bytes_in = summary.total_bytes_in || 0
        const total_bytes_out = summary.total_bytes_out || 0
        const total_bytes_all = total_bytes_in + total_bytes_out

        console.log('[Gateway] HTTP 转发网关已启动')
        console.log(`[Gateway] 监听地址: http://${host}:${port}`)
        console.log(`[Gateway] 目标服务: ${targetApiURL}`)
        console.log(`[Gateway] 累计数据\r\t\t（Token）,输入：${formatMB(totalPromptTokens)}，输出：${formatMB(totalCompletionTokens)}, 思考：${formatMB(totalReasoningTokens)}`)
        console.log(`\t\t（Sizes）,输入：${formatMB(total_bytes_in)}，输出：${formatMB(total_bytes_out)}, 总大小：${formatMB(total_bytes_all)}`)
    })

    // ==================== 优雅关闭 ====================

    function gracefulShutdown() {
        console.log('[Gateway] 收到关闭信号，正在关闭服务...')
        server.close()
        dbManager.close()
        process.exit(0)
    }

    process.on('SIGINT', gracefulShutdown)
    process.on('SIGTERM', gracefulShutdown)

    // ==================== 返回管理器 ====================

    return { dbManager, server, forwardRequest, CONFIG, managers }
}

export default initGateway