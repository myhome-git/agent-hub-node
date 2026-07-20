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
import { WebSocketManager } from './websocket.js'
import { forwardRequest } from './gateway.js'
import { initCleanupTask } from './cleanup.js'
import CONFIG from './config.js'
import { fileURLToPath } from 'url'

// 检测是否直接运行此文件
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

/**
 * 初始化网关服务
 * @param {Object} options - 配置选项
 * @param {number} options.port - HTTP 端口
 * @param {string} options.host - 监听地址
 * @returns {Object} - 管理器集合
 */
export function initGateway(options = {}) {
    const port = options.port || CONFIG.port
    const host = options.host || CONFIG.host

    // ==================== 初始化模块 ====================

    // 创建数据库管理器
    const dbManager = new DatabaseManager(CONFIG.dbPath)

    // 创建 WebSocket 管理器
    const wsManager = new WebSocketManager(CONFIG.wsPort)
    wsManager.init()

    // 建立 WebSocket 与数据库的关联
    wsManager.setDbManager(dbManager)

    // 初始化定时清理任务
    initCleanupTask(dbManager)

    // ==================== 管理器集合 ====================

    const managers = {
        dbManager,
        wsManager,
    }

    // ==================== HTTP 服务器 ====================

    const server = http.createServer(async(req, res) => {
        // 解析 URL
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
        const pathname = url.pathname

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
                },
                wsPort: CONFIG.wsPort,
                wsConnections: wsManager.getConnectionCount(),
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
        const targetUrl = `${CONFIG.targetBaseUrl}${pathname}${url.search}`

        console.log(`[Gateway] ${req.method} ${req.url} -> ${targetUrl}`)

        try {
            await forwardRequest(req, res, targetUrl, managers)
        } catch (error) {
            console.error('[Gateway] 转发失败:', error)

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

    server.listen(port, host, () => {
        console.log('[Gateway] HTTP 转发网关已启动')
        console.log(`[Gateway] 监听地址: http://${host}:${port}`)
        console.log(`[Gateway] 目标服务: ${CONFIG.targetBaseUrl}`)
        console.log(`[Gateway] WebSocket 监控: ws://${host}:${CONFIG.wsPort}`)
        console.log(`[Gateway] 数据库路径: ${CONFIG.dbPath}`)
    })

    // ==================== 优雅关闭 ====================

    function gracefulShutdown() {
        console.log('[Gateway] 收到关闭信号，正在关闭服务...')
        server.close()
        wsManager.close()
        dbManager.close()
        process.exit(0)
    }

    process.on('SIGINT', gracefulShutdown)
    process.on('SIGTERM', gracefulShutdown)

    // ==================== 返回管理器 ====================

    return { dbManager, wsManager, server, forwardRequest, CONFIG, managers }
}

// ==================== 独立运行模式 ====================

if (isDirectRun) {
    // 加载环境变量文件
    import('./config.js').then(({ default: config }) => {
        console.log(`[Config] 已加载环境变量文件: ${config.envFile}`)
    }).catch(err => {
        console.error('[Config] 加载环境变量失败:', err.message)
    })

    // 启动 Gateway 服务
    initGateway({
        port: 9000,
        host: '0.0.0.0',
    })
}