/**
 * 核心字节流转发模块
 * 使用 Node.js 原生 http 模块进行高性能请求转发
 */

import http from 'http'
import https from 'https'
import { SSETokenParser } from './sse-parser.js'
import CONFIG from './config.js'

/**
 * 高性能字节流转发函数
 *
 * 性能优化要点：
 * 1. 使用 http.request 原生模块，无框架开销
 * 2. 使用 pipe 实现零拷贝流转发
 * 3. 使用 SSETokenParser 在流中实时解析 Token 信息
 * 4. 使用 setImmediate 异步写入数据库，不阻塞主线程
 *
 * @param {http.IncomingMessage} req - 客户端请求
 * @param {http.ServerResponse} res - 客户端响应
 * @param {string} targetUrl - 目标 URL
 * @param {Object} managers - 管理器对象
 * @param {Object} options - 转发选项
 */
export async function forwardRequest(req, res, targetUrl, managers, options = {}) {
    const {
        headers = {},
        timeout = CONFIG.requestTimeout,
    } = options

    // 记录请求开始时间
    const startTime = Date.now()

    // 创建 Token 解析器
    const tokenParser = new SSETokenParser()

    // 统计变量
    let bytesIn = 0
    let bytesOut = 0
    let promptTokens = 0
    let completionTokens = 0
    let totalTokens = 0
    let firstChunkSent = false

    const { dbManager, wsManager } = managers

    // 准备请求选项
    const url = new URL(targetUrl)
    const requestOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: req.method,
        headers: { ...req.headers },
    }

    // 移除不影响转发的头
    delete requestOptions.headers.host
    delete requestOptions.headers.connection
    delete requestOptions.headers['keep-alive']

    // 添加额外请求头
    Object.entries(headers).forEach(([key, value]) => {
        requestOptions.headers[key] = value
    })

    // 根据协议选择 http 或 https 模块
    const targetModule = url.protocol === 'https:' ? https : http
    const targetReq = targetModule.request(requestOptions, (targetRes) => {
        // 首次响应时发送响应头（记录首字节时间）
        if (!firstChunkSent) {
            const firstResponseTime = Date.now() - startTime
            console.log(`[Gateway] 首字节响应: ${firstResponseTime}ms - ${req.method} ${req.url}`)
            firstChunkSent = true
        }

        // 发送响应头给客户端
        res.writeHead(targetRes.statusCode, targetRes.headers)

        // 检查是否是流式响应
        const contentType = targetRes.headers['content-type'] || ''
        const isStream = contentType.includes('text/event-stream') ||
                         contentType.includes('application/json')

        if (isStream && targetRes.readable) {
            // ========== 流式响应处理 ==========
            targetRes.on('data', (chunk) => {
                // 统计响应字节数
                bytesOut += chunk.length

                // 尝试解析 Token 信息
                const parsed = tokenParser.processChunk(chunk)
                if (parsed && !promptTokens && !completionTokens) {
                    promptTokens = parsed.promptTokens
                    completionTokens = parsed.completionTokens
                    totalTokens = parsed.totalTokens
                }

                // 转发给客户端（直接转发原始数据，不修改）
                res.write(chunk)
            })

            targetRes.on('end', () => {
                // 处理剩余缓冲区
                const flushToken = tokenParser.flush()
                if (flushToken && !promptTokens) {
                    promptTokens = flushToken.promptTokens
                    completionTokens = flushToken.completionTokens
                    totalTokens = flushToken.totalTokens
                }

                // 结束响应
                res.end()

                // 完成转发，写入统计
                completeRequest(true)
            })

            targetRes.on('error', (error) => {
                console.error('[Gateway] 目标响应错误:', error.message)
                // 确保响应已结束
                if (!res.writableEnded) {
                    res.end()
                }
                completeRequest(false)
            })
        } else {
            // ========== 普通响应处理 ==========
            targetRes.pipe(res, { end: true })

            targetRes.on('data', (chunk) => {
                bytesOut += chunk.length
            })

            targetRes.on('end', () => {
                completeRequest(true)
            })

            targetRes.on('error', (error) => {
                console.error('[Gateway] 目标响应错误:', error.message)
                completeRequest(false)
            })
        }
    })

    // 处理目标请求错误
    targetReq.on('error', (error) => {
        console.error('[Gateway] 目标请求错误:', error.message)

        if (!firstChunkSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
                error: 'Gateway Error',
                message: error.message,
            }))
        }

        completeRequest(false)
    })

    // 设置超时
    targetReq.setTimeout(timeout, () => {
        targetReq.destroy()

        if (!firstChunkSent) {
            res.writeHead(504, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
                error: 'Gateway Timeout',
                message: '请求超时',
            }))
        }

        completeRequest(false)
    })

    // 统计请求字节数并转发请求体
    req.on('data', (chunk) => {
        bytesIn += chunk.length
    })

    req.pipe(targetReq, { end: true })

    req.on('error', (error) => {
        console.error('[Gateway] 客户端请求错误:', error.message)
        completeRequest(false)
    })

    /**
     * 请求完成处理
     * @param {boolean} isSuccess - 是否成功
     */
    async function completeRequest(isSuccess) {
        const statTime = new Date().toISOString().slice(0, 16).replace('T', ' ')

        // 异步写入数据库（不阻塞响应）
        await dbManager.writeStats({
            statTime,
            promptTokens,
            completionTokens,
            totalTokens,
            bytesIn,
            bytesOut,
            isSuccess,
        })

        // 通过 WebSocket 广播统计
        wsManager.broadcastStats({
            promptTokens,
            completionTokens,
            totalTokens,
            bytesIn,
            bytesOut,
            isSuccess,
            responseTime: Date.now() - startTime,
        })
    }
}

export default forwardRequest