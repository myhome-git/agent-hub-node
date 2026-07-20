/**
 * 检查数据库表结构
 */
import initSqlJs from 'sql.js'
import fs from 'fs'

async function main() {
    const SQL = await initSqlJs({
        locateFile: file => `./node_modules/sql.js/dist/${file}`
    })

    const data = fs.readFileSync('./database/db.sqlite')
    const db = new SQL.Database(data)

    // 获取所有表
    const tables = db.exec('SELECT name, sql FROM sqlite_master WHERE type="table"')
    console.log('=== 数据库表结构 ===')
    if (tables && tables[0] && tables[0].values) {
        for (const [name, sql] of tables[0].values) {
            console.log(`\n表: ${name}`)
            console.log(sql)
        }
    }

    // 获取所有索引
    const indexes = db.exec('SELECT name, sql FROM sqlite_master WHERE type="index" AND sql IS NOT NULL')
    console.log('\n=== 索引 ===')
    if (indexes && indexes[0] && indexes[0].values) {
        for (const [name, sql] of indexes[0].values) {
            console.log(`${name}: ${sql}`)
        }
    }

    db.close()
}

main().catch(console.error)
