/**
 * WebSocket 管理器
 * 负责 WebSocket 服务器初始化和消息广播
 */

import { WebSocketServer } from 'ws'

/**
 * WebSocket 管理器类
 */
export class WebSocketManager {
    constructor(port) {
        this.port = port
        this.wss = null
        this.clients = new Set()
    }

    /**
     * 初始化 WebSocket 服务器
     */
    init() {
        this.wss = new WebSocketServer({ port: this.port, host: '0.0.0.0' })

        this.wss.on('connection', (ws) => {
            this.clients.add(ws)
            console.log(`[WebSocket] 客户端连接，当前连接数: ${this.clients.size}`)

            // 发送当前统计给新连接的客户端
            this.sendCurrentStats(ws)

            ws.on('close', () => {
                this.clients.delete(ws)
                console.log(`[WebSocket] 客户端断开，当前连接数: ${this.clients.size}`)
            })

            ws.on('error', (error) => {
                console.error('[WebSocket] 连接错误:', error.message)
                this.clients.delete(ws)
            })

            // 处理客户端心跳
            ws.isAlive = true
            ws.on('pong', () => {
                ws.isAlive = true
            })
        })

        // 心跳检测，每 30 秒检测一次
        this.heartbeatInterval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    ws.terminate()
                    this.clients.delete(ws)
                    return
                }
                ws.isAlive = false
                ws.ping()
            })
        }, 30000)

        if (this.heartbeatInterval && this.heartbeatInterval.unref) {
            this.heartbeatInterval.unref()
        }

        console.log(`[WebSocket] WebSocket 服务器已启动于端口 ${this.port}`)
    }

    /**
     * 设置数据库管理器引用（用于获取统计数据）
     * @param {DatabaseManager} dbManager - 数据库管理器实例
     */
    setDbManager(dbManager) {
        this.dbManager = dbManager
    }

    /**
     * 广播统计数据
     * @param {Object} stats - 统计数据
     */
    broadcastStats(stats) {
        const message = JSON.stringify({
            type: 'stats_update',
            timestamp: new Date().toISOString(),
            data: stats,
        })

        this.clients.forEach((ws) => {
            if (ws.readyState === 1 /* WebSocket.OPEN */) {
                ws.send(message)
            }
        })
    }

    /**
     * 发送当前数据库统计给指定客户端
     * @param {WebSocket} ws - WebSocket 实例
     */
    sendCurrentStats(ws) {
        if (ws.readyState !== 1 /* WebSocket.OPEN */) return

        if (!this.dbManager) return

        const stats = this.dbManager.getStats()
        const message = JSON.stringify({
            type: 'stats_current',
            timestamp: new Date().toISOString(),
            data: stats,
        })

        ws.send(message)
    }

    /**
     * 获取当前连接数
     * @returns {number}
     */
    getConnectionCount() {
        return this.clients.size
    }

    /**
     * 关闭 WebSocket 服务器
     */
    close() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval)
        }
        this.wss.close()
        console.log('[WebSocket] WebSocket 服务器已关闭')
    }
}

export default WebSocketManager