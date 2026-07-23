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

    // 定时任务
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
    }, process.env.CLEANUP_INTERVAL_MS)

    // 允许进程在不等待定时任务的情况下退出
    if (interval && interval.unref) {
        interval.unref()
    }

    console.log('定时清理任务已启动')
}

export default initCleanupTask