import { Hono } from 'hono'
import ClassDBConnection from '@/utils/db/ClassDBConnection.js'
import { isValidValue } from '@/utils/utils.js'
import tableConf from './agent-hub/config.js'
import { DatabaseManager } from '@/server/database.js'
import CONFIG from '@/server/config.js'

const router = new Hono()

const { uuidName, tableName, chatTableName } = tableConf

// ==================== Agent 管理接口 ====================

/**
 * 获取 Agent 列表（支持分页和筛选）
 * GET /list
 */
router.get('/list', async(c) => {
    using classDBConnection = new ClassDBConnection(tableConf)
    let sqlParams = [], sqlWhere = 'where 1=1'
    let { pageSize, pageRowNum, pageIndex } = c.getValuesPage()

    // 获取筛选参数
    const category = c.getValueById('category')
    const keyword = c.getValueById('keyword')
    const status = c.getValueById('status')

    if (isValidValue(category)) {
        sqlWhere += ' and d.category=? '
        sqlParams.push(category)
    }
    if (isValidValue(keyword)) {
        sqlWhere += ' and (d.name like ? or d.description like ?) '
        sqlParams.push(`%${keyword}%`, `%${keyword}%`)
    }
    if (isValidValue(status)) {
        sqlWhere += ' and d.status=? '
        sqlParams.push(status)
    }

    classDBConnection.open()
    let sqlValue = `
        SELECT
            d.*
        FROM
            ${tableName} AS d
        ${sqlWhere}
        ORDER BY d.${uuidName} DESC LIMIT ? OFFSET ?
    `
    let content = await classDBConnection.query(sqlValue, [...sqlParams, pageSize, pageRowNum])

    // 格式化时间
    content.forEach((item) => {
        if (item.create_time) {
            item.create_time = dayjs(item.create_time).format('YYYY-MM-DD HH:mm:ss.SSS')
        }
        if (item.update_time) {
            item.update_time = dayjs(item.update_time).format('YYYY-MM-DD HH:mm:ss.SSS')
        }
    })

    const page = await classDBConnection.queryPage(sqlWhere, sqlParams, pageIndex, pageSize)
    return c.sendSuccess({ content, ...page })
})

/**
 * 获取 Agent 详情
 * GET /detail/:id
 */
router.get('/detail/:id', async(c) => {
    using classDBConnection = new ClassDBConnection(tableConf)
    const id = c.req.param('id')

    classDBConnection.open()
    let sqlValue = `SELECT * FROM ${tableName} WHERE ${uuidName}=?`
    let content = await classDBConnection.query(sqlValue, [id])

    if (content.length === 0) {
        return c.text('Agent 不存在', 404)
    }

    // 格式化时间
    const item = content[0]
    if (item.create_time) {
        item.create_time = dayjs(item.create_time).format('YYYY-MM-DD HH:mm:ss.SSS')
    }
    if (item.update_time) {
        item.update_time = dayjs(item.update_time).format('YYYY-MM-DD HH:mm:ss.SSS')
    }

    return c.sendSuccess(item)
})

/**
 * 创建 Agent
 * POST /create
 */
router.post('/create', async(c) => {
    using classDBConnection = new ClassDBConnection(tableConf)

    const { name, description, category, config, avatar, status } = await c.req.json()

    // 验证必填字段
    if (!name) {
        return c.text('名称不能为空', 400)
    }

    const finalStatus = status || 'enabled'
    const finalConfig = config ? JSON.stringify(config) : '{}'
    const finalAvatar = avatar || ''
    const finalDescription = description || ''
    const finalCategory = category || '未分类'

    classDBConnection.open()
    let sqlValue = `
        INSERT INTO ${tableName} (name, description, category, status, config, avatar, create_time, update_time)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    await classDBConnection.query(sqlValue, [name, finalDescription, finalCategory, finalStatus, finalConfig, finalAvatar])

    // 获取新创建的 Agent ID
    let getIdSql = `SELECT ${uuidName} FROM ${tableName} ORDER BY ${uuidName} DESC LIMIT 1`
    let result = await classDBConnection.query(getIdSql)

    return c.sendSuccess({
        id: result[0][uuidName],
        name,
        createdAt: new Date().toISOString()
    })
})

/**
 * 更新 Agent
 * POST /update/:id
 */
router.post('/update/:id', async(c) => {
    using classDBConnection = new ClassDBConnection(tableConf)
    const id = c.req.param('id')

    const { name, description, category, config, avatar, status } = await c.req.json()

    classDBConnection.open()

    // 检查 Agent 是否存在
    let checkSql = `SELECT * FROM ${tableName} WHERE ${uuidName}=?`
    let existing = await classDBConnection.query(checkSql, [id])

    if (existing.length === 0) {
        return c.text('Agent 不存在', 404)
    }

    const existingData = existing[0]
    const finalName = isValidValue(name) ? name : existingData.name
    const finalDescription = isValidValue(description) ? description : existingData.description
    const finalCategory = isValidValue(category) ? category : existingData.category
    const finalStatus = isValidValue(status) ? status : existingData.status
    const finalAvatar = isValidValue(avatar) ? avatar : (existingData.avatar || '')

    let finalConfig
    if (isValidValue(config)) {
        finalConfig = typeof config === 'string' ? config : JSON.stringify(config)
    } else {
        finalConfig = existingData.config || '{}'
    }

    let sqlValue = `
        UPDATE ${tableName}
        SET name=?, description=?, category=?, status=?, config=?, avatar=?, update_time=datetime('now')
        WHERE ${uuidName}=?
    `
    await classDBConnection.query(sqlValue, [
        finalName, finalDescription, finalCategory, finalStatus, finalConfig, finalAvatar, id
    ])

    return c.sendSuccess({ id, updatedAt: new Date().toISOString() })
})

/**
 * 删除 Agent
 * POST /delete/:id
 */
router.post('/delete/:id', async(c) => {
    using classDBConnection = new ClassDBConnection(tableConf)
    const id = c.req.param('id')

    classDBConnection.open()

    // 检查 Agent 是否存在
    let checkSql = `SELECT * FROM ${tableName} WHERE ${uuidName}=?`
    let existing = await classDBConnection.query(checkSql, [id])

    if (existing.length === 0) {
        return c.text('Agent 不存在', 404)
    }

    let sqlValue = `DELETE FROM ${tableName} WHERE ${uuidName}=?`
    await classDBConnection.query(sqlValue, [id])

    // 同时删除相关的对话消息
    let deleteChatSql = `DELETE FROM ${chatTableName} WHERE agent_id=?`
    await classDBConnection.query(deleteChatSql, [id])

    return c.sendSuccess({ message: '删除成功' })
})

/**
 * 切换 Agent 状态
 * POST /toggle-status/:id
 */
router.post('/toggle-status/:id', async(c) => {
    using classDBConnection = new ClassDBConnection(tableConf)
    const id = c.req.param('id')
    const { enabled } = await c.req.json()

    classDBConnection.open()

    // 检查 Agent 是否存在
    let checkSql = `SELECT * FROM ${tableName} WHERE ${uuidName}=?`
    let existing = await classDBConnection.query(checkSql, [id])

    if (existing.length === 0) {
        return c.text('Agent 不存在', 404)
    }

    const newStatus = enabled ? 'enabled' : 'disabled'
    let sqlValue = `
        UPDATE ${tableName}
        SET status=?, update_time=datetime('now')
        WHERE ${uuidName}=?
    `
    await classDBConnection.query(sqlValue, [newStatus, id])

    return c.sendSuccess({
        id,
        status: newStatus,
        message: enabled ? '已启用' : '已禁用'
    })
})

/**
 * 发送对话消息
 * POST /chat/:agentId
 */
router.post('/chat/:agentId', async(c) => {
    using classDBConnection = new ClassDBConnection(tableConf)
    const agentId = c.req.param('agentId')
    const { message, sessionId } = await c.req.json()

    // 验证消息
    if (!message) {
        return c.text('消息内容不能为空', 400)
    }

    classDBConnection.open()

    // 检查 Agent 是否存在且启用
    let checkSql = `SELECT * FROM ${tableName} WHERE ${uuidName}=?`
    let agent = await classDBConnection.query(checkSql, [agentId])

    if (agent.length === 0) {
        return c.text('Agent 不存在', 404)
    }

    if (agent[0].status !== 'enabled') {
        return c.text('Agent 已禁用', 400)
    }

    // 生成或获取会话 ID
    const finalSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // 保存用户消息
    let saveUserSql = `
        INSERT INTO ${chatTableName} (agent_id, session_id, role, content, create_time)
        VALUES (?, ?, 'user', ?, datetime('now'))
    `
    await classDBConnection.query(saveUserSql, [agentId, finalSessionId, message])

    // TODO: 这里应该调用 AI 服务获取回复
    // 目前返回模拟回复
    const reply = `收到您的消息："${message}"。这是 Agent 的模拟回复。`

    // 保存 Agent 回复
    let saveReplySql = `
        INSERT INTO ${chatTableName} (agent_id, session_id, role, content, create_time)
        VALUES (?, ?, 'assistant', ?, datetime('now'))
    `
    await classDBConnection.query(saveReplySql, [agentId, finalSessionId, reply])

    return c.sendSuccess({
        reply,
        sessionId: finalSessionId,
        timestamp: new Date().toISOString()
    })
})

/**
 * 获取对话历史
 * GET /chat-history/:agentId
 */
router.get('/chat-history/:agentId', async(c) => {
    using classDBConnection = new ClassDBConnection(tableConf)
    const agentId = c.req.param('agentId')
    const { sessionId, limit = 50 } = c.req.query()

    classDBConnection.open()

    // 检查 Agent 是否存在
    let checkSql = `SELECT * FROM ${tableName} WHERE ${uuidName}=?`
    let agent = await classDBConnection.query(checkSql, [agentId])

    if (agent.length === 0) {
        return c.text('Agent 不存在', 404)
    }

    let sqlWhere = 'WHERE agent_id=?'
    let sqlParams = [agentId]

    if (sessionId) {
        sqlWhere += ' AND session_id=?'
        sqlParams.push(sessionId)
    }

    let sqlValue = `
        SELECT * FROM ${chatTableName}
        ${sqlWhere}
        ORDER BY create_time ASC
        LIMIT ?
    `

    let messages = await classDBConnection.query(sqlValue, [...sqlParams, limit])

    // 格式化时间
    messages.forEach((msg) => {
        if (msg.create_time) {
            msg.create_time = dayjs(msg.create_time).format('YYYY-MM-DD HH:mm:ss.SSS')
        }
    })

    return c.sendSuccess({ messages })
})

/**
 * 搜索 Agent
 * GET /search
 */
router.get('/search', async(c) => {
    using classDBConnection = new ClassDBConnection(tableConf)
    const { keyword, category, status } = c.req.query()

    classDBConnection.open()

    let sqlWhere = 'where 1=1'
    let sqlParams = []

    if (keyword) {
        sqlWhere += ' and (d.name like ? or d.description like ?) '
        sqlParams.push(`%${keyword}%`, `%${keyword}%`)
    }
    if (category) {
        sqlWhere += ' and d.category=? '
        sqlParams.push(category)
    }
    if (status) {
        sqlWhere += ' and d.status=? '
        sqlParams.push(status)
    }

    let sqlValue = `
        SELECT d.*
        FROM ${tableName} AS d
        ${sqlWhere}
        ORDER BY d.${uuidName} DESC
    `

    let results = await classDBConnection.query(sqlValue, sqlParams)

    // 格式化时间
    results.forEach((item) => {
        if (item.create_time) {
            item.create_time = dayjs(item.create_time).format('YYYY-MM-DD HH:mm:ss.SSS')
        }
        if (item.update_time) {
            item.update_time = dayjs(item.update_time).format('YYYY-MM-DD HH:mm:ss.SSS')
        }
    })

    return c.sendSuccess({ results })
})

/**
 * 获取分类列表
 * GET /categories
 */
router.get('/categories', async(c) => {
    using classDBConnection = new ClassDBConnection(tableConf)

    classDBConnection.open()

    let sqlValue = `
        SELECT category, COUNT(*) as count
        FROM ${tableName}
        GROUP BY category
        ORDER BY count DESC
    `

    let categories = await classDBConnection.query(sqlValue)

    return c.sendSuccess({ categories })
})

// ==================== 统计数据接口 ====================

/**
 * 获取数据库管理器实例（单例）
 */
let dbManagerInstance = null

function getDbManager() {
    if (!dbManagerInstance) {
        const dbPath = CONFIG.dbPath || './database/db.sqlite'
        dbManagerInstance = new DatabaseManager(dbPath)
    }
    return dbManagerInstance
}

/**
 * 获取统计数据（汇总 + 当前分钟 + 最近60分钟）
 * GET /stats/summary
 */
router.get('/stats/summary', async(c) => {
    try {
        const db = getDbManager()

        // 等待数据库初始化完成
        if (!db.db) {
            await db.init()
        }

        const stats = db.getStats()

        return c.sendSuccess({
            summary: stats.summary,
            currentMinute: stats.currentMinute,
            recentMinutes: stats.recentMinutes,
            databasePath: stats.databasePath
        })
    } catch (error) {
        console.error('[Stats] 获取统计数据失败:', error)
        return c.json({ code: 500, message: '获取统计数据失败: ' + error.message }, 500)
    }
})

/**
 * 获取分钟级统计列表（支持时间范围筛选）
 * GET /stats/minute
 */
router.get('/stats/minute', async(c) => {
    try {
        const db = getDbManager()

        if (!db.db) {
            await db.init()
        }

        const { startTime, endTime, limit = 100 } = c.req.query()

        let sql = 'SELECT * FROM stats_minute WHERE 1=1'
        const params = []

        if (startTime) {
            sql += ' AND stat_time >= ?'
            params.push(startTime)
        }
        if (endTime) {
            sql += ' AND stat_time <= ?'
            params.push(endTime)
        }

        sql += ' ORDER BY stat_time DESC LIMIT ?'
        params.push(limit)

        const results = db.prepareAndQuery(sql, params)

        // 格式化时间
        results.forEach(item => {
            if (item.created_at) {
                item.created_at = dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')
            }
            if (item.updated_at) {
                item.updated_at = dayjs(item.updated_at).format('YYYY-MM-DD HH:mm:ss')
            }
        })

        return c.sendSuccess({ list: results, total: results.length })
    } catch (error) {
        console.error('[Stats] 获取分钟级统计失败:', error)
        return c.json({ code: 500, message: '获取分钟级统计失败: ' + error.message }, 500)
    }
})

/**
 * 获取汇总统计数据
 * GET /stats/summary-only
 */
router.get('/stats/summary-only', async(c) => {
    try {
        const db = getDbManager()

        if (!db.db) {
            await db.init()
        }

        const summary = db.queryOne('SELECT * FROM stats_summary WHERE id = 1')

        if (!summary) {
            return c.sendSuccess({
                total_prompt_tokens: 0,
                total_completion_tokens: 0,
                total_all_tokens: 0,
                total_bytes_in: 0,
                total_bytes_out: 0,
                total_requests: 0,
                total_success: 0,
                total_failed: 0,
                first_request_time: null,
                last_request_time: null
            })
        }

        return c.sendSuccess(summary)
    } catch (error) {
        console.error('[Stats] 获取汇总统计失败:', error)
        return c.json({ code: 500, message: '获取汇总统计失败: ' + error.message }, 500)
    }
})

/**
 * 清理过期统计数据
 * POST /stats/cleanup
 */
router.post('/stats/cleanup', async(c) => {
    try {
        const db = getDbManager()

        if (!db.db) {
            await db.init()
        }

        // 可以指定清理天数，默认使用配置值
        const { days } = await c.req.json() || {}
        const cleanupDays = days || CONFIG.cleanupDays

        // 临时修改配置并执行清理
        const originalCleanupDays = CONFIG.cleanupDays
        CONFIG.cleanupDays = cleanupDays

        const deletedCount = db.cleanup()

        // 恢复配置
        CONFIG.cleanupDays = originalCleanupDays

        return c.sendSuccess({
            message: '清理完成',
            deletedCount,
            cleanupDays
        })
    } catch (error) {
        console.error('[Stats] 清理失败:', error)
        return c.json({ code: 500, message: '清理失败: ' + error.message }, 500)
    }
})

/**
 * 重置统计数据
 * POST /stats/reset
 */
router.post('/stats/reset', async(c) => {
    try {
        const db = getDbManager()

        if (!db.db) {
            await db.init()
        }

        db.reset()

        return c.sendSuccess({ message: '统计数据已重置' })
    } catch (error) {
        console.error('[Stats] 重置失败:', error)
        return c.json({ code: 500, message: '重置失败: ' + error.message }, 500)
    }
})

/**
 * 导出统计数据为 JSON
 * GET /stats/export
 */
router.get('/stats/export', async(c) => {
    try {
        const db = getDbManager()

        if (!db.db) {
            await db.init()
        }

        // 获取汇总表数据
        const summary = db.queryOne('SELECT * FROM stats_summary WHERE id = 1') || {}

        // 获取所有分钟级数据
        const minuteData = db.queryAll('SELECT * FROM stats_minute ORDER BY stat_time DESC')

        // 获取基本统计信息
        const totalRecords = minuteData.length
        const dateRange = minuteData.length > 0
            ? {
                earliest: minuteData[minuteData.length - 1].stat_time,
                latest: minuteData[0].stat_time
              }
            : { earliest: null, latest: null }

        const exportData = {
            exportTime: new Date().toISOString(),
            summary: summary || {},
            minuteRecords: minuteData,
            statistics: {
                totalRecords,
                dateRange
            }
        }

        return c.sendSuccess(exportData)
    } catch (error) {
        console.error('[Stats] 导出失败:', error)
        return c.json({ code: 500, message: '导出失败: ' + error.message }, 500)
    }
})

export default router
