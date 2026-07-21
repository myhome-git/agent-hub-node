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
import { forwardRequest } from './gateway.js'
import { initCleanupTask } from './cleanup.js'
import CONFIG from './config.js'
import { fileURLToPath } from 'url'
import dayjs from 'dayjs'

// 检测是否直接运行此文件
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

// 【新增】定义 CORS 跨域响应头，解决 Chatbox 网页版或特定桌面版的跨域拦截问题
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key',
    'Access-Control-Max-Age': '86400'
}

/**
 * 初始化网关服务
 * @param {Object} options - 配置选项
 * @param {number} options.port - HTTP 端口
 * @param {string} options.host - 监听地址
 * @returns {Object} - 管理器集合
 */
export async function initGateway(options = {}) {
    const port = options.port || CONFIG.port
    const host = options.host || CONFIG.host

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
    const dbManager = new DatabaseManager(CONFIG.dbPath)
    await dbManager.ready

    // 初始化定时清理任务
    initCleanupTask(dbManager)

    // ==================== 管理器集合 ====================

    const managers = {
        dbManager,
        callback: {
            promptByteLen: (len) => {
                netDataCount.bytesIn += len
            },
            completionByteLen: (len) => {
                netDataCount.bytesOut += len
            },
            completeTokens: ({ prompt, completion, reasoning, total }) => {
                // { prompt: 0, completion: 0, reasoning: 1385, total: 1385 }
                netDataCount.promptTokens += prompt
                netDataCount.completionTokens += completion
                netDataCount.reasoningTokens += reasoning
                netDataCount.totalTokens += total
            },
            complete: () => {
                console.log('complete')
            }
        }
    }

    // ==================== HTTP 服务器 ====================

    const server = http.createServer(async(req, res) => {
        // 【新增】处理 OPTIONS 预检请求 (CORS 必需，否则 Chatbox 会报 Network Error)
        if (req.method === 'OPTIONS') {
            console.log('[index] req method OPTIONS')
            res.writeHead(204, CORS_HEADERS)
            res.end()
            return
        }

        // 【新增】禁用 Nagle 算法，确保流式数据立即发送，降低 Chatbox 首字和流式卡顿延迟
        if (req.socket) {
            req.socket.setNoDelay(true)
        }

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
        const targetUrl = `${CONFIG.targetBaseUrl}${pathname}${url.search}`
        console.log(`[index] ${req.method} ${req.url} -> ${targetUrl}`)

        try {
            await forwardRequest(req, res, targetUrl, managers)
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

        console.log('[Gateway] HTTP 转发网关已启动')
        console.log(`[Gateway] 监听地址: http://${host}:${port}`)
        console.log(`[Gateway] 目标服务: ${CONFIG.targetBaseUrl}`)
        console.log(`[Gateway] 数据库路径: ${CONFIG.dbPath}`)
        console.log(`[Gateway] 累计数据（Token）,输入:${formatMB(totalPromptTokens)}，输出：${formatMB(totalCompletionTokens)}, 思考：${formatMB(totalReasoningTokens)}`)
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

const now = dayjs(Date.now()).format('YYYY-MM-DD HH:mm:ss.SSS')
console.log(`
    ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
    █                                                                     █
    █                   ▄▄▄▄ ▄▄▄▄▄▄   ▄▄   ▄▄ ▄▄▄▄▄▄                      █
    █                  █      █   ▐█  ▐█ ▐▄█ █ █      █                   █
    █                  █      █   ▐█  ▐█ ▐█ ▐█ █ ▄▄▄▄▄█                   █
    █                  █      █   ▐█  ▐█ █▀▄▀█ █ █                        █
    █                  █▄▄▄▄▄▄█   ▐█▄▄▄█ █   █ █ █▄▄▄▄▄▄                  █
    █                                                                     █
    █           Aent Hub v1.0.0 • High-Performance API Gateway            █
    █           ────────────────────────────────────────────              █
    █           • Uptime: ${now}                         █
    █                                                                     █
    █           ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄             █
    █           █ STATUS 200 • Ready for incoming traffic   █             █
    █           ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀             █
    █                                                                     █
    ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
`)