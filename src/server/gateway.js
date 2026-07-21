/**
 * 核心字节流转发模块 (适配 Chatbox + 本地大模型)
 * 使用 Node.js 原生 http 模块进行高性能请求转发
 */

import http from 'http'
import https from 'https'
import { SSETokenParser } from './sse-parser.js'
import { TokenCounter } from './sse-token-counter.js'
import CONFIG from './config.js'

// 【新增】定义 CORS 跨域响应头，解决 Chatbox 网页版或特定桌面版的跨域拦截问题
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key',
    'Access-Control-Max-Age': '86400'
}

/**
 * 高性能字节流转发函数
 */
export async function forwardRequest(req, res, targetUrl, managers, options = {}) {
    // console.log('[Gateway] init')

    // 无凭证，跳过检查
    const authHeader = req.headers['authorization']
    if (!authHeader){
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS })
        res.end(JSON.stringify({ error: 'Internal Server Error', message: 'authHeader' }))
        return
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token){
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS })
        res.end(JSON.stringify({ error: 'Internal Server Error', message: 'token' }))
        return
    }

    const {
        headers = { },
        timeout = CONFIG.requestTimeout,
    } = options

    // 记录请求开始时间
    const startTime = Date.now()

    // 创建 Token 解析器
    const tokenParser = new SSETokenParser()
    const tokenCounter = new TokenCounter()

    // 统计变量
    let bytesIn = 0
    let bytesOut = 0
    let promptTokens = 0
    let completionTokens = 0
    let totalTokens = 0

    const { dbManager, callback } = managers

    // 准备请求选项
    const url = new URL(targetUrl)

    // 1. 定义允许转发的 Header 白名单
    const ALLOWED_HEADERS = [
        'content-type',
        'content-length',
        'connection',
        'authorization',
        'user-agent',
        'x-request-id',
        'accept-encoding',
        'x-api-key'
    ]

    ALLOWED_HEADERS.forEach(key => {
        if (req.headers[key]) {
            headers[key] = req.headers[key]
        }
    })

    // 3. 强制覆盖关键 Header
    headers['host'] = url.host
    headers['accept-encoding'] = 'identity' // 【关键】禁止压缩，防止网关收到乱码
    headers['connection'] = 'close'
    delete headers['keep-alive']

    const requestOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: req.method,
        headers: { ...headers },
        agent: false
    }

    // 1. 定义状态锁（必须在所有回调之前定义）
    let isCompleted = false
    let firstChunkSent = false

    // 根据协议选择 http 或 https 模块
    const targetModule = url.protocol === 'https:' ? https : http
    const targetReq = targetModule.request(requestOptions, (targetRes) => {

        // 【优化】提前判断是否为流式响应，以便在发送 Header 前清理冲突字段
        const contentType = targetRes.headers['content-type'] || ''
        const isStream = contentType.includes('text/event-stream') || contentType.includes('application/octet-stream')

        // 首次响应处理
        if (!firstChunkSent && !res.headersSent) {
            const firstResponseTime = Date.now() - startTime
            console.log(`[Gateway] 首字节响应: ${firstResponseTime}ms`)
            firstChunkSent = true
            callback.promptByteLen(bytesIn)

            // 【优化】清理并合并 Header
            const cleanHeaders = { ...targetRes.headers }
            if (isStream) {
                // 流式传输时，上游如果带了 content-length 会导致下游截断或报错，必须删除
                delete cleanHeaders['content-length']
                delete cleanHeaders['content-encoding']
                // 2. 【核心修复】强制添加 SSE 防缓存和跨域头，防止 Chatbox 界面卡顿
                cleanHeaders['cache-control'] = 'no-cache, no-transform'
                cleanHeaders['x-accel-buffering'] = 'no' // 防止 Nginx 等反向代理缓冲 SSE
                cleanHeaders['content-type'] = 'text/event-stream; charset=utf-8' // 强制规范 SSE 类型
            }

            // 合并 CORS 头
            const finalHeaders = { ...cleanHeaders, ...CORS_HEADERS }

            // 发送响应头
            try {
                res.writeHead(targetRes.statusCode, finalHeaders)
            } catch (e) {
                console.error('[Gateway] 写入响应头失败:', e.message)
                targetRes.destroy()
                return
            }
        }

        if (isStream && targetRes.readable) {
            // ========== 流式响应处理 ==========
            targetRes.on('data', (chunk) => {
                // 统计响应字节数
                bytesOut += chunk.length
                callback.completionByteLen(bytesOut)

                // 尝试解析 Token 信息
                const segments = tokenParser.processChunk(chunk)
                if (segments && segments.length > 0) {
                    for (const segment of segments) {
                        if (segment.text) {
                            tokenCounter.add(segment.text, segment.type)
                        }
                    }
                }
                // 转发给客户端
                res.write(chunk)
            })
        } else {
            // ========== 普通响应处理 ==========
            targetRes.on('data', (chunk) => {
                bytesOut += chunk.length
                res.write(chunk)
            })
        }

        targetRes.on('end', () => {
            // console.log('[Gateway] 远程服务器resp end')
            tokenParser.flush()
            if (!res.writableEnded) res.end()
        })

        targetRes.on('error', () => {
            // console.error('[Gateway] 远程服务器resp error', error.message)
            if (!res.writableEnded) res.end()
        })
    })

    targetReq.on('close', () => {
        // console.error('[Gateway] 远程服务器req close')
    })

    // 处理远程服务器请求错误
    targetReq.on('error', (error) => {
        // console.error('[Gateway] 远程服务器req error', error.message)
        if (res.destroyed || isCompleted) return

        try {
            if (!firstChunkSent && !res.headersSent && !res.writableEnded) {
                // 加上 CORS 头防止前端无法读取错误信息
                res.writeHead(502, { 'Content-Type': 'application/json', ...CORS_HEADERS })
                res.end(JSON.stringify({ error: 'Gateway Error', message: error.message }))
            } else if (!res.writableEnded) {
                res.end()
            }
        } catch (e) {
            console.error('[Gateway] 写入 502 响应时发生异常:', e.message)
        }
    })

    // 设置超时
    targetReq.setTimeout(timeout, () => {
        console.warn(`[Gateway] 请求超时 (${timeout}ms): ${req.url}`)
        if (isCompleted) return
        if (targetReq && !targetReq.destroyed) {
            targetReq.destroy()
        }

        if (!res.headersSent && !res.writableEnded) {
            res.writeHead(504, { 'Content-Type': 'application/json', ...CORS_HEADERS })
            res.end(JSON.stringify({
                error: 'Gateway Timeout',
                message: `请求在 ${timeout}ms 内未得到响应`
            }))
        } else if (!res.writableEnded) {
            // 如果流式传输中途超时，只能强制结束连接
            res.end()
        }

        // 4. 标记请求完成，清理资源
        completeRequest(false)
    })

    // ========== 请求体处理与输入 Token 统计 ==========
    let reqBodyBuffer = []

    req.on('data', (chunk) => {
        reqBodyBuffer.push(chunk)
        targetReq.write(chunk)
    })

    req.on('end', () => {
        // console.log('[Gateway] 客户端req end')
        const fullBody = Buffer.concat(reqBodyBuffer)
        bytesIn = fullBody.length
        try {
            const bodyStr = fullBody.toString('utf-8')
            const bodyJson = JSON.parse(bodyStr)

            if (bodyJson.messages && Array.isArray(bodyJson.messages)) {
                const promptText = bodyJson.messages.map(m => m.content).join('\n')
                tokenCounter.add(promptText, 'prompt')
            }
        // eslint-disable-next-line no-unused-vars
        } catch (e) {
            // 非 JSON 请求或解析失败，忽略
        }
    })

    req.on('error', () => {
        // console.log(`[Gateway] 客户端req error: ${err.message}`)
        if (isCompleted) return
        if (targetReq && !targetReq.destroyed) targetReq.destroy()
        if (!res.writableEnded) res.end()
        completeRequest(false)
    })

    // response对象
    res.on('close', () => {
        // console.log(`[Gateway] 客户端resp close: ${req.url}`)
        if (isCompleted) return
        if (targetReq && !targetReq.destroyed) targetReq.destroy()
        if (!res.writableEnded) res.end()
        completeRequest(false)
    })

    res.on('error', () => {
        // console.error('[Gateway] 客户端resp error:', err.message)
        if (targetReq && !targetReq.destroyed) targetReq.destroy()
        if (!res.writableEnded) res.end()
    })

    /**
     * 请求完成处理
     */
    async function completeRequest(isSuccess) {
        if (isCompleted) return
        isCompleted = true
        console.log(`[Gateway] 请求结束，状态: ${isSuccess ? '成功' : '失败'}`)

        const statTime = new Date().toISOString().slice(0, 16).replace('T', ' ')

        dbManager.writeStats({
            statTime, promptTokens, completionTokens, totalTokens, bytesIn, bytesOut, isSuccess,
        })

        const finalStats = tokenCounter.getFinalStats()
        callback.completeTokens(finalStats)
        callback.complete()
    }
}

export default forwardRequest
