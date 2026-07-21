/**
 * 核心字节流转发模块
 * 使用 Node.js 原生 http 模块进行高性能请求转发
 */

import http from 'http'
import https from 'https'
import { SSETokenParser } from './sse-parser.js'
import { TokenCounter } from './sse-token-counter.js'
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
 * @param {string} targetUrl - 远程服务器 URL
 * @param {Object} managers - 管理器对象
 * @param {Object} options - 转发选项
 */
export async function forwardRequest(req, res, targetUrl, managers, options = {}) {
    console.log('[Gateway] init')
    const {
        headers = {},
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

    const { dbManager, wsManager, callback } = managers

    // 准备请求选项
    const url = new URL(targetUrl)
    // 1. 定义允许转发的 Header 白名单
    const ALLOWED_HEADERS = [
        'content-type',
        // 'content-length',
        'connection',
        'authorization',
        'user-agent', // 可选，有时用于后端日志
        'x-request-id', // 如果有透传请求ID的需求
        'api-key', // 某些自定义鉴权
    ]

    ALLOWED_HEADERS.forEach(key => {
        if (req.headers[key]) {
            headers[key] = req.headers[key]
        }
    })

    // 3. 强制覆盖关键 Header
    headers['host'] = url.host // 必须指向目标服务器
    headers['connection'] = 'close' // 防止 Keep-Alive 导致的挂起
    headers['accept-encoding'] = 'identity' // 【关键】禁止压缩，防止网关收到乱码

    const requestOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: req.method,
        headers
    }

    // 1. 定义状态锁（必须在所有回调之前定义）
    let isCompleted = false
    let firstChunkSent = false

    // 根据协议选择 http 或 https 模块
    const targetModule = url.protocol === 'https:' ? https : http
    const targetReq = targetModule.request(requestOptions, (targetRes) => {
        console.log('targetRes 事件触发')
        // 首次响应处理
        if (!firstChunkSent && !res.headersSent) {
            const firstResponseTime = Date.now() - startTime
            console.log(`[Gateway] 首字节响应: ${firstResponseTime}ms`)
            firstChunkSent = true

            // 发送响应头
            try {
                res.writeHead(targetRes.statusCode, targetRes.headers)
            } catch (e) {
                // 如果写入响应头失败（例如客户端已断开），立即终止上游请求
                console.error('[Gateway] 写入响应头失败:', e.message)
                targetRes.destroy()
                return
            }
        }

        // 检查是否是流式响应
        const contentType = targetRes.headers['content-type'] || ''
        const isStream = contentType.includes('text/event-stream')

        if (isStream && targetRes.readable) {
            // ========== 流式响应处理 ==========
            targetRes.on('data', (chunk) => {
                console.log('targetRes data 事件触发')
                // 统计响应字节数
                bytesOut += chunk.length
                callback.completionByteLen(bytesOut)

                // 尝试解析 Token 信息
                // A. 调用解析器：将原始字节转为结构化数组
                // 返回格式如截图: [{ type: 'reasoning', text: '...' }, ...]
                const segments = tokenParser.processChunk(chunk)

                // B. 调用统计器：处理提取出的内容
                if (segments && segments.length > 0) {
                    for (const segment of segments) {
                        // 【关键步骤】在这里调用外部统计逻辑
                        // 你可以根据 type 决定是统计思考过程还是正式回答
                        if (segment.text) {
                            tokenCounter.add(segment.text, segment.type)
                        }
                    }
                }
                // 转发给客户端
                if (!res.writableEnded) res.write(chunk)
            })
        } else {
            // ========== 普通响应处理 ==========
            targetRes.on('data', (chunk) => { bytesOut += chunk.length })

            // 手动控制 end
            // targetRes.pipe(res, { end: false })
        }

        targetRes.on('end', () => {
            console.error('[Gateway] 远程服务器Resp end:')
            // 处理剩余缓冲区
            tokenParser.flush()

            if (!res.writableEnded){
                res.end()
            }
            completeRequest(true)
        })

        targetRes.on('error', (error) => {
            console.error('[Gateway] 远程服务器Resp错误:', error.message)
            if (!res.writableEnded){
                res.end()
            }
            completeRequest(false)
        })
    })

    // 处理远程服务器请求错误
    targetReq.on('error', (error) => {
        console.error('[Gateway] 远程服务器Req错误:', error.message)
        // console.log(targetReq)
        // 防御性判断：如果是主动销毁引起的错误，忽略
        if (req.destroyed || isCompleted) return

        try {
            // 必须同时满足：未发送首字节、未发送响应头、响应流仍可写
            if (!firstChunkSent && !res.headersSent && !res.writableEnded) {
                res.writeHead(502, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'Gateway Error', message: error.message }))
            } else if (!res.writableEnded) {
                // 如果响应头已经发送（流式传输中途上游报错），只能优雅地切断连接
                res.end()
            }
        } catch (e) {
            // 捕获底层流异常，防止 Node.js 进程崩溃
            console.error('[Gateway] 写入 502 响应时发生异常:', e.message)
        }

        completeRequest(false)
    })

    // 设置超时
    targetReq.setTimeout(timeout, () => {
        if (isCompleted) return
        console.warn(`[Gateway] 请求超时 (${timeout}ms): ${req.url}`)

        if (targetReq && !targetReq.destroyed) {
            targetReq.destroy()
        }

        if (!firstChunkSent && !res.headersSent && !res.writableEnded) {
            res.writeHead(504, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
                error: 'Gateway Timeout',
                message: '请求超时',
            }))
        } else if (!res.writableEnded) {
            // 如果响应头已经发送（流式传输中途超时），只能优雅地结束连接
            res.end()
        }

        completeRequest(false)
    })

    // ========== 请求体处理与输入 Token 统计 ==========
    let reqBodyBuffer = []

    req.on('data', (chunk) => {
        bytesIn += chunk.length
        reqBodyBuffer.push(chunk) // 缓存请求体用于后续解析
    })

    req.on('end', () => {
        console.log('[Gateway] req end 事件触发')
        // 拼接完整的请求体
        const fullBody = Buffer.concat(reqBodyBuffer)

        // 在请求体接收完毕后，统一解析 JSON 计算 Prompt Tokens
        try {
            const bodyStr = fullBody.toString('utf-8')
            const bodyJson = JSON.parse(bodyStr)

            // 【核心修复】：从 JSON 中提取 messages 进行统计
            if (bodyJson.messages && Array.isArray(bodyJson.messages)) {
                const promptText = bodyJson.messages.map(m => m.content).join('\n')
                // 假设你的 counter 支持直接添加文本
                tokenCounter.add(promptText, 'prompt')
            }
        // eslint-disable-next-line no-unused-vars
        } catch (e) {
            // 非 JSON 请求或解析失败，忽略
        }

        // 此时 Node.js 会自动使用 Content-Length，而不会使用 Transfer-Encoding: chunked
        if (!targetReq.destroyed) {
            // targetReq.setHeader('Content-Length', fullBody.length) // 显式设置长度
            targetReq.end(fullBody) // 一次性发送完整数据
        }
    })

    req.on('close', () => {
        console.log(`[Gateway] 客户端连接关闭: ${req.url}`)
        if (isCompleted) return

        // 销毁上游
        if (targetReq && !targetReq.destroyed) targetReq.destroy()

        // 结束下游
        if (!res.writableEnded) res.end()

        completeRequest(false)
    })

    req.on('error', (err) => {
        console.error('[Gateway] 客户端连接错误:', err.message)

        // 客户端出错，立即切断上游，防止资源浪费
        if (!targetReq.destroyed) {
            targetReq.destroy()
        }

        if (['ECONNRESET', 'EPIPE'].includes(err.code)) return
    })

    /**
     * 请求完成处理
     * @param {boolean} isSuccess - 是否成功
     */
    async function completeRequest(isSuccess) {
        if (isCompleted) return // 核心防重入
        isCompleted = true
        console.log(`[Gateway] 请求结束，状态: ${isSuccess ? '成功' : '失败'}`)

        const statTime = new Date().toISOString().slice(0, 16).replace('T', ' ')

        // 异步写入数据库（不阻塞响应）
        dbManager.writeStats({
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

        // 清空之前统计字节
        // if(!isSuccess){
        //     bytesIn = 0
        //     tokenCounter.resetValue('prompt', 0)
        // }

        // { prompt: 0, completion: 0, reasoning: 1385, total: 1385 }
        const finalStats = tokenCounter.getFinalStats()
        callback.completeTokens(finalStats)
        callback.complete()
    }
}

export default forwardRequest