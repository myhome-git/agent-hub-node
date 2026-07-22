/**
 * 定时清理任务模块
 * 每小时清理一次过期数据
 */

import CONFIG from './config.js'

/**
 * 初始化定时清理任务
 * @param {Object} dbManager - 数据库管理器实例
 */
export function initCleanupTask(dbManager) {
    // 等待数据库初始化完成（等待 2 秒）
    const waitForDb = () => {
        return dbManager.db !== null
    }

    // 立即执行一次清理（延迟 2 分钟，确保数据库已初始化）
    setTimeout(() => {
        try {
            if (!waitForDb()) {
                console.log('数据库未初始化，跳过本次清理')
                return
            }
            const deleted = dbManager.cleanup()
            const count = Number(deleted) || 0
            console.log(`清理完成: 删除了 ${count} 条过期记录`)
        } catch (error) {
            console.error('清理任务执行失败:', error)
        }
    }, 120000) // 2 分钟后首次执行

    // 之后按配置间隔执行（每 3600 秒 = 1 小时）
    const interval = setInterval(() => {
        try {
            if (!waitForDb()) {
                console.log('数据库未初始化，跳过本次清理')
                return
            }
            const deleted = dbManager.cleanup()
            const count = Number(deleted) || 0
            console.log(`清理完成: 删除了 ${count} 条过期记录`)
        } catch (error) {
            console.error('清理任务执行失败:', error)
        }
    }, CONFIG.cleanupIntervalMs)

    // 允许进程在不等待定时任务的情况下退出
    if (interval && interval.unref) {
        interval.unref()
    }

    console.log(`定时清理任务已启动，间隔: ${CONFIG.cleanupIntervalMs / 3600000} 小时`)
}

export default initCleanupTask