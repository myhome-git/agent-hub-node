/**
 * AI 代理网关 - 主入口文件
 * 
 * 模块结构：
 * - config.js      : 配置管理
 * - database.js    : 数据库管理器
 * - sse-parser.js  : SSE Token 解析器
 * - gateway.js     : 核心字节流转发
 * - websocket.js   : WebSocket 实时推送
 * - cleanup.js     : 定时清理任务
 */

import http from 'http';
import { DatabaseManager } from './database.js';
import { WebSocketManager } from './websocket.js';
import { forwardRequest } from './gateway.js';
import { initCleanupTask } from './cleanup.js';
import CONFIG from './config.js';

// ==================== 初始化模块 ====================

// 创建数据库管理器
const dbManager = new DatabaseManager(CONFIG.dbPath);

// 创建 WebSocket 管理器
const wsManager = new WebSocketManager(CONFIG.wsPort);
wsManager.init();

// 建立 WebSocket 与数据库的关联
wsManager.setDbManager(dbManager);

// 初始化定时清理任务
initCleanupTask(dbManager);

// ==================== 管理器集合 ====================

const managers = {
    dbManager,
    wsManager,
};

// ==================== HTTP 服务器 ====================

const server = http.createServer(async (req, res) => {
    // 解析 URL
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // 健康检查
    if (pathname === '/health' && req.method === 'GET') {
        const stats = dbManager.getStats();
        const memoryUsage = process.memoryUsage();

        res.writeHead(200, { 'Content-Type': 'application/json' });
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
        }));
        return;
    }

    // 获取统计数据
    if (pathname === '/api/stats' && req.method === 'GET') {
        const stats = dbManager.getStats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            timestamp: new Date().toISOString(),
            data: stats,
        }));
        return;
    }

    // 重置统计数据
    if (pathname === '/api/stats/reset' && req.method === 'POST') {
        dbManager.reset();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            message: '统计数据已重置',
            timestamp: new Date().toISOString(),
        }));
        return;
    }

    // 转发请求到目标服务
    const targetUrl = `${CONFIG.targetBaseUrl}${pathname}${url.search}`;

    console.log(`[Gateway] ${req.method} ${req.url} -> ${targetUrl}`);

    try {
        await forwardRequest(req, res, targetUrl, managers);
    } catch (error) {
        console.error('[Gateway] 转发失败:', error);

        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({
            error: 'Internal Server Error',
            message: error.message,
        }));
    }
});

// ==================== 启动服务 ====================

server.listen(CONFIG.port, CONFIG.host, () => {
    console.log(`[Gateway] HTTP 转发网关已启动`);
    console.log(`[Gateway] 监听地址: http://${CONFIG.host}:${CONFIG.port}`);
    console.log(`[Gateway] 目标服务: ${CONFIG.targetBaseUrl}`);
    console.log(`[Gateway] WebSocket 监控: ws://${CONFIG.host}:${CONFIG.wsPort}`);
    console.log(`[Gateway] 数据库路径: ${CONFIG.dbPath}`);
});

// ==================== 优雅关闭 ====================

function gracefulShutdown() {
    console.log('\n[Gateway] 收到关闭信号，正在关闭服务...');
    server.close();
    wsManager.close();
    dbManager.close();
    process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// ==================== 导出 ====================

export { dbManager, wsManager, server, forwardRequest, CONFIG };
export default { dbManager, wsManager, server, forwardRequest, CONFIG };