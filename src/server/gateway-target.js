/**
 * 核心字节流转发模块 (适配 Chatbox + 本地大模型)
 * 使用 Node.js 原生 http 模块进行高性能请求转发
 */

import http from 'http'
import https from 'https'
import { SSETokenParser } from './sse-parser.js'
import { TokenCounter } from './sse-token-counter.js'
import CONFIG from './config.js'

/**
 * 高性能字节流转发函数
 */
export async function forwardRequest(req, res, targetUrl, managers, options = {}) {
    // console.log('init')

    // 在你的网关中提取 API Key
    const authHeader = req.headers['authorization']
    const anthropicKey = req.headers['x-api-key']

    let apiKey = null
    if (authHeader) {
        apiKey = authHeader.replace(/^Bearer\s+/i, '').trim()
    } else if (anthropicKey) {
        apiKey = anthropicKey
    }

    // 无凭证，跳过检查
    if (!apiKey) {
        res.writeHead(500, CONFIG.CORS_HEADERS)
        res.end(JSON.stringify({ error: 'Internal Server Error', message: 'authHeader' }))
        return
    }

    const {
        headers = {},
        timeout = Number(process.env.REQUEST_TIMEOUT) || 30000,
    } = options

    // 记录请求开始时间
    const startTime = Date.now()

    // 创建 Token 解析器
    const tokenParser = new SSETokenParser()
    const tokenCounter = new TokenCounter()

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
    headers['authorization'] = `Bearer ${process.env.TARGET_API_KEY}`
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
    let targetResControl = null
    const targetReq = targetModule.request(requestOptions, (targetRes) => {
        targetResControl = targetRes
        // 【优化】提前判断是否为流式响应，以便在发送 Header 前清理冲突字段
        const contentType = targetRes.headers['content-type'] || ''
        const isStream = contentType.includes('text/event-stream') || contentType.includes('application/octet-stream')

        // 首次响应处理
        if (!firstChunkSent && !res.headersSent) {
            const firstResponseTime = Date.now() - startTime
            console.log(`首字节响应: ${firstResponseTime}ms`)
            firstChunkSent = true

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
            const finalHeaders = { ...cleanHeaders, ...CONFIG.CORS_HEADERS }

            // 发送响应头
            if(!res.headersSent){
                res.writeHead(targetRes.statusCode, finalHeaders)
            }
        }

        targetRes.on('data', (chunk) => {
            // 尝试解析 Token 信息
            const segments = tokenParser.processChunk(chunk)
            if (segments && segments.length > 0) {
                for (const segment of segments) {
                    if (segment.text) {
                        tokenCounter.add(segment.text, segment.type)
                    }
                }
            }
            tokenCounter.addBytesLen(chunk, 'out')
            // 转发给客户端
            try {
                res.write(chunk)
            } catch {

            }
        })

        targetRes.on('end', () => {
            console.log('远程服务器 resp end')
            tokenParser.flush()
            if(!res.writableEnded){
                res.end()
            }
        })

        targetRes.on('close', () => {
            console.log('远程服务器 resp close')
            tokenParser.flush()
            if(!res.writableEnded){
                res.end()
            }
        })

        targetRes.on('error', (error) => {
            console.error('远程服务器 resp error', error.message)
            if(!res.headersSent){
                res.writeHead(502, CONFIG.CORS_HEADERS)
            }
            if (!res.writableEnded) {
                res.end(JSON.stringify({ error: 'Bad Gateway', message: error.message }))
            }
        })
    })

    targetReq.on('close', () => {
        console.error('远程服务器 req close')
        if(!res.headersSent){
            res.writeHead(502, CONFIG.CORS_HEADERS)
        }
        if(!res.writableEnded){
            res.end()
        }
    })

    // 处理远程服务器请求错误
    targetReq.on('error', (error) => {
        console.error('远程服务器 req error', error.message)
        if(!res.headersSent){
            res.writeHead(502, CONFIG.CORS_HEADERS)
        }
        if(!res.writableEnded){
            res.end(JSON.stringify({ error: 'Gateway Error', message: error.message }))
        }
    })

    // 设置超时
    targetReq.setTimeout(timeout, () => {
        console.warn(`请求超时 (${timeout}ms): ${req.url}`)
        if (isCompleted) return
        if (targetReq && !targetReq.destroyed) {
            targetReq.destroy()
        }
        if(!res.headersSent){
            res.writeHead(504, CONFIG.CORS_HEADERS)
        }
        if(!res.writableEnded){
            res.end(JSON.stringify({
                error: 'Gateway Timeout',
                message: `请求在 ${timeout}ms 内未得到响应`
            }))
        }
    })

    // ========== 请求体处理与输入 Token 统计 ==========
    let reqBodyBuffer = []

    req.on('data', (chunk) => {
        reqBodyBuffer.push(chunk)
        targetReq.write(chunk)
    })

    req.on('end', () => {
        // console.log('客户端req end')
        const fullBody = Buffer.concat(reqBodyBuffer)
        tokenCounter.addBytesLen(fullBody, 'in')
        try {
            const bodyStr = fullBody.toString('utf-8')
            const bodyJson = JSON.parse(bodyStr)
            tokenCounter.addModel(bodyJson.model || null)
            if (bodyJson.messages && Array.isArray(bodyJson.messages)) {
                const promptText = bodyJson.messages.map(m => m.content).join('\n')
                tokenCounter.add(promptText, 'prompt')
            }
            // eslint-disable-next-line no-unused-vars
        } catch (e) {
            // 非 JSON 请求或解析失败，忽略
        }
    })

    // req.on('close', () => {
    //     console.log(`客户端 req close: ${req.url}`)
    // })

    req.on('error', () => {
        console.log(`客户端 req error: ${err.message}`)
    })

    // response对象
    res.on('close', () => {
        console.log(`客户端 resp close: ${req.url}`)
        if (targetReq && !targetReq.destroyed) targetReq.destroy()
        if (targetResControl && !targetResControl.destroyed) targetResControl.destroy()
        if (!res.writableEnded) res.end()
        completeRequest(false)
    })

    res.on('error', (error) => {
        console.error('客户端 resp error:', error.message)
    })

    /**
     * 请求完成处理
     */
    async function completeRequest(isSuccess) {
        if (isCompleted) return
        isCompleted = true
        console.log(`请求结束，状态: ${isSuccess ? '成功' : '失败'}`)
        const finalStats = tokenCounter.getFinalStats()
        callback.completeTokens(finalStats)
        dbManager.writeStats({
            'api_key_uuid': apiKey,
            'model': finalStats.model,
            'start_time': startTime,
            'end_time': Date.now(),
            'prompt_tokens': finalStats.prompt,
            'completion_tokens': finalStats.completion,
            'reasoning_tokens': finalStats.reasoning,
            'total_tokens': finalStats.total,
            'bytes_in': finalStats.bytesIn,
            'bytes_out': finalStats.bytesOut,
            'is_success': isSuccess ? 1 : 0
        })
    }
}

export default forwardRequest
