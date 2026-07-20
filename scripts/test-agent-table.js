/**
 * 测试 Agent 表创建
 */
import { DatabaseManager } from '../src/server/database.js'

const db = new DatabaseManager('./database/gateway.db')

try {
    // 检查 agent 相关表
    const agentTables = db.queryAll('SELECT name FROM sqlite_master WHERE type=\'table\' AND name LIKE \'agent%\'')
    console.log('Agent 相关表:', agentTables)

    // 检查索引
    const agentIndexes = db.queryAll('SELECT name FROM sqlite_master WHERE type=\'index\' AND name LIKE \'idx_agent%\'')
    console.log('Agent 相关索引:', agentIndexes)

    // 插入测试数据
    db.prepareAndRun(
        'INSERT OR IGNORE INTO agent (id, name, description, category, status, config) VALUES (?, ?, ?, ?, ?, ?)',
        [1, '测试Agent', '这是一个测试Agent', '测试', 'enabled', '{}']
    )

    // 查询测试数据
    const agents = db.queryAll('SELECT * FROM agent')
    console.log('Agent 数据:', agents)

    // 清理测试数据
    db.prepareAndRun('DELETE FROM agent WHERE id = ?', [1])
    console.log('测试数据已清理')

    console.log('\n✅ Agent 表测试通过！')
} catch (error) {
    console.error('❌ 测试失败:', error)
} finally {
    db.close()
}