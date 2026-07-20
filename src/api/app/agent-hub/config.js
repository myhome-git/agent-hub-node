// Agent Hub 数据库配置
export const uuidName = 'id'
export const tableName = 'tb_agent'
export const tableColumns = [
    'name',
    'description',
    'category',
    'status',
    'config',
    'avatar'
]

// 对话消息表配置
export const chatTableName = 'tb_chat_message'
export const chatTableColumns = [
    'agent_id',
    'session_id',
    'role',
    'content'
]

export default {
    uuidName,
    tableName,
    tableColumns,
    chatTableName,
    chatTableColumns
}