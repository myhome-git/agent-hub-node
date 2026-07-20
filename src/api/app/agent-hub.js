import { Hono } from 'hono'
import ClassDBConnection from '@/utils/db/ClassDBConnection'
import { isValidValue } from '@/utils/utils'
import dayjs from 'dayjs'
import tableConf from './agent-hub/config'

const app = new Hono()

const { uuidName, tableName, chatTableName } = tableConf

/**
 * 获取 Agent 列表（支持分页和筛选）
 * GET /list
 */
app.get('/list', async(c) => {
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
app.get('/detail/:id', async(c) => {
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
app.post('/create', async(c) => {
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
app.post('/update/:id', async(c) => {
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
app.post('/delete/:id', async(c) => {
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
app.post('/toggle-status/:id', async(c) => {
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
app.post('/chat/:agentId', async(c) => {
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
app.get('/chat-history/:agentId', async(c) => {
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
app.get('/search', async(c) => {
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
app.get('/categories', async(c) => {
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

export default app