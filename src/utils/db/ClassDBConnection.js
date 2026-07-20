// import db from "@/db/db_myblog.sqlite";
import { Database } from 'bun:sqlite'
import path from 'path'

/**
 * 数据库连接封装类接口
 * @param uuidName
 * @param tableName
 * @param packSwitch
 */
class ClassDBConnection {
    constructor(option = {}) {
        const { uuidName, tableName, packSwitch = true } = option
        if(!uuidName || !tableName){
           throw new Error('database table parameter error')
        }
        this.config = {
            uuidName,
            tableName,
            packSwitch
        }
    }
    open() {
        try{
            const dbPath = path.resolve(process.cwd(), process.env.DB_PATH)
            this.DB = new Database(dbPath)
        }catch(error){
            console.error(error)
            throw error
        }
        return true
    }
    close() {
        try {
            this.DB && this.DB.close()
        } catch (error) {
            throw error
        }
        return true
    }

    /**
     * 自动调用释放资源
     */
    [Symbol.dispose]() {
        this.close()
    }

    /**
     * 执行数据库命令
     * @param {*} sql       sql语句
     * @param {*} params    sql参数
     * @param {*} isPack    是否包装查询，默认为true
     * @returns
     */
    async query(sql, params, isPack = true) {
        // 如果bool为true，则不对sql进行包装
        if (isPack) {
            sql = this.packagingQueryBefore(sql)
        }
        console.log('准备执行的sql：', sql)
        console.log('准备提交的参数', params)
        return new Promise((resolve, reject) => {
            try{
                resolve(this.DB.query(sql).all(params))
            }catch(error){
                reject(error)
            }
        })
        // try{
        //     return this.DB.query(sql).all(params).map((item) => {
        //         item.create_time ? item.create_time = getCurrentDate(item.create_time) : null
        //     })
        // }catch(error){
        //     throw error
        // }
    }

    /**
     * 分页
     * @param {*} sqlWhere
     * @param {*} params
     * @param {*} pageIndex
     * @param {*} pageSize
     * @returns
     */
    queryPage(sqlWhere, params, pageIndex, pageSize) {
        return this.query(`select count(${this.config.uuidName}) as total from ${this.config.tableName} ${sqlWhere}`, params).then((data) => {
            return {
                total: data[0]['total'],
                pageSize,
                pageIndex
            }
        })
    }

    /**
     * 删除，适合单表操作
     * @param {*} sqlParams
     */
    async delete(sqlParams) {
        for await (const element of sqlParams) {
            let sqlValue = `delete from ${this.config.tableName} where ${this.config.uuidName}=?`
            await this.query(sqlValue, [element])
        }
    }

    exec(sql) {
        console.log('准备执行的sql：', sql)
        return new Promise((resolve, reject) => {
            try {
                const result = this.DB.exec(sql)
                resolve(result)
            } catch (error) {
                console.error(error)
                reject(new Error('数据库执行错误，请检查提交参数'))
            }
        })
    }

    // 在查询打包之前执行
    packagingQueryBefore(value) {
        if (!this.__packSwitch) {
            return value
        }
        const newValue = value.replace(/^\s+/g, '')
        // 如果是select语句，则进行打包
        if (/^SELECT\b(?!\s+COUNT\b)/i.test(newValue)) {
            value = `
                    SELECT
                        ROW_NUMBER() OVER() AS row_num,
                        result.id AS 'row_key',
                        result.*
                    FROM (
                            ${value}
                        ) AS result
                    `
        }
        return value
    }

    /**
     * 开启事务
     * @param {*} bool ，是否独占模式，默认false
     */
    transactionBegin(bool = false) {
        this.query(bool ? 'BEGIN EXCLUSIVE TRANSACTION;' : 'BEGIN;')
    }
    // 保存事务的回滚点
    transactionSavePoint(name) {
        // 执行保存事务的回滚点操作
        this.query(`SAVEPOINT ${name}`)
    }
    // 回滚到事务的回滚点
    transactionRollbackToSavePoint(name) {
        // 执行回滚到事务的回滚点操作
        this.query(`ROLLBACK TO SAVEPOINT ${name}`)
    }
    // 提交事务
    transactionCommit() {
        this.query('commit')
    }
    // 回滚事务
    transactionRollback() {
        this.query('ROLLBACK')
    }

    /**
     * 导出数据库为sql
     */
    async exportSql() {
        console.log('--- Cloudflare D1 SQL 导出开始 ---')
        const db = this.DB
        if (!db) {
            console.error('错误: 数据库绑定未提供。')
            throw new Error('数据库绑定未提供。')
        }
        let sql = ''
        // 禁用外键约束，以便在导入时可以按任意顺序创建表和插入数据
        sql += 'PRAGMA foreign_keys = OFF;\n'
        sql += 'BEGIN TRANSACTION;\n\n'
        try {
            // 1. 获取所有用户定义的表名
            // 过滤掉系统表 (sqlite_sequence, _cf_KV, etc.) 和内部视图
            const tablesResult = await db.prepare(
                'SELECT name FROM sqlite_master WHERE type=\'table\' AND name LIKE \'tb_%\''
            ).all()
            const tableNames = tablesResult.results.map(t => t.name)
            if (tableNames.length === 0) {
                console.warn('未找到任何用户定义的表。')
                return sql + 'COMMIT;\nPRAGMA foreign_keys = ON;\n' // 即使没有表也要提交事务
            }
            console.log('找到以下表:', tableNames.join(', '))
            for (const tableName of tableNames) {
                console.log(`--- 处理表: ${tableName} ---`)
                sql += `--\n-- Table: ${tableName}\n--\n`
                // 2. 导出表结构 (CREATE TABLE 语句)
                const schemaResult = await db.prepare(
                    'SELECT sql FROM sqlite_master WHERE name=?'
                ).bind(tableName).first()
                if (schemaResult && schemaResult.sql) {
                    sql += schemaResult.sql + ';\n'
                    console.log(`已添加表 ${tableName} 的结构。`)
                } else {
                    console.warn(`警告: 未能获取表 ${tableName} 的结构 (CREATE TABLE 语句)。`)
                    continue // 如果没有结构，跳过此表的数据导出
                }
                // 3. 导出表数据 (INSERT INTO 语句)
                const rowsResult = await db.prepare(
                    `SELECT * FROM ${tableName}`
                ).all()
                const rows = rowsResult.results
                if (rows && rows.length > 0) {
                    console.log(`找到 ${rows.length} 条数据用于表 ${tableName}。`)
                    for (const row of rows) {
                        const columnNames = Object.keys(row).map(col => `\`${col}\``).join(', ') // 使用反引号包裹列名
                        const values = Object.values(row)
                            .map(v => {
                                if (typeof v === 'string') {
                                    // 对字符串中的单引号进行转义（' 变为 ''）
                                    return `'${v.replace(/'/g, '\'\'')}'`
                                } else if (v === null || v === undefined) {
                                    return 'NULL' // SQLite 区分 NULL
                                } else if (typeof v === 'boolean') {
                                    return v ? 1 : 0 // SQLite 通常用 0/1 表示布尔值
                                }
                                return v // 数字等直接使用
                            })
                            .join(', ')
                        sql += `INSERT INTO \`${tableName}\` (${columnNames}) VALUES (${values});\n`
                    }
                    console.log(`已添加表 ${tableName} 的数据。`)
                } else {
                    console.log(`表 ${tableName} 没有数据。`)
                }
                sql += '\n' // 每张表之间添加一个空行，提高可读性
            }
        } catch (error) {
            console.error('在导出D1 SQL过程中发生错误:', error)
            // 如果发生错误，回滚事务
            sql = 'ROLLBACK;\n'
            throw error // 重新抛出错误，让调用者知道导出失败
        }
        sql += 'COMMIT;\n'
        // 重新启用外键约束
        sql += 'PRAGMA foreign_keys = ON;\n'
        console.log('--- Cloudflare D1 SQL 导出完成 ---')
        return sql
    }
}

export default ClassDBConnection