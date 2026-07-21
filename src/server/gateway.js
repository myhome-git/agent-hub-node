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
    const requestOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: req.method,
        headers: { ...req.headers },
    }

    // 移除不影响转发的头
    delete requestOptions.headers['host']
    delete requestOptions.headers['connection']
    delete requestOptions.headers['keep-alive']
    delete requestOptions.headers['transfer-encoding'] // 防止分块传输冲突

    // 添加额外请求头
    Object.entries(headers).forEach(([key, value]) => {
        requestOptions.headers[key] = value
    })

    // 1. 定义状态锁（必须在所有回调之前定义）
    let isCompleted = false
    let firstChunkSent = false

    // 根据协议选择 http 或 https 模块
    const targetModule = url.protocol === 'https:' ? https : http
    const targetReq = targetModule.request(requestOptions, (targetRes) => {
        // 首次响应处理
        if (!firstChunkSent) {
            const firstResponseTime = Date.now() - startTime
            console.log(`[Gateway] 首字节响应: ${firstResponseTime}ms - ${req.method} ${req.url}`)
            firstChunkSent = true
            callback.first(bytesIn)
            callback.promptByteLen(bytesIn)
        }

        // 发送响应头
        try {
            res.writeHead(targetRes.statusCode, targetRes.headers)
        } catch (e) {
            console.error('[Gateway] 写入响应头失败:', e.message)
            targetRes.destroy()
            return
        }

        // 检查是否是流式响应
        const contentType = targetRes.headers['content-type'] || ''
        const isStream = contentType.includes('text/event-stream')

        if (isStream && targetRes.readable) {
            // ========== 流式响应处理 ==========
            targetRes.on('data', (chunk) => {
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
            targetRes.pipe(res, { end: false })
        }

        targetRes.on('end', () => {
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

    // 不推荐处理targetReq.end事件
    // targetReq.on('end', () => {})

    // 处理远程服务器请求错误
    targetReq.on('error', (error) => {
        // 防御性判断：如果是主动销毁引起的错误，忽略
        if (req.destroyed || isCompleted) return
        console.error('[Gateway] 远程服务器Req错误:', error.message)

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
        // 在请求体接收完毕后，统一解析 JSON 计算 Prompt Tokens
        try {
            const bodyStr = Buffer.concat(reqBodyBuffer).toString('utf-8')
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
    })

    req.on('close', () => {
        if (isCompleted) return

        console.log(`[Gateway] 客户端连接关闭: ${req.url}`)

        // 销毁上游
        if (targetReq && !targetReq.destroyed) targetReq.destroy()

        // 结束下游
        if (!res.writableEnded) res.end()

        completeRequest(false)
    })

    req.on('error', (error) => {
        if (isCompleted) return

        // 如果是客户端主动断开导致的错误，可以忽略或仅打印 debug 日志
        if (error.code === 'ECONNRESET') {
            // 客户端主动断开通常不需要报错，交给 close 处理即可
            return
        }

        console.error('[Gateway] 客户端请求错误:', error.message)
        completeRequest(false)
    })

    req.pipe(targetReq, { end: true })

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