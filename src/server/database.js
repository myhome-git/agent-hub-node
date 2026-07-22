/**
 * 数据库管理器
 * 负责数据库自动初始化、按分钟统计写入、定时清理
 */
import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'
import { getRootPath } from '../utils/fileURLToPath.js'
// import dayjs from 'dayjs'

/**
 * 数据库管理器类
 */
export class DatabaseManager {
    constructor() {
        this.dbPath = null
        this.db = null
        this.init()
    }

    /**
     * 初始化数据库
     * 自动创建数据库文件和统计表
     */
    init() {
        try {
            // 使用绝对路径，基于当前文件所在目录
            this.dbPath = path.resolve(getRootPath(), process.env.DB_PATH)
            // console.log('[Database] database path:', this.dbPath)
            // 加载现有数据库（如果存在）
            if (!fs.existsSync(this.dbPath)) {
                console.log('[Database] 数据库文件不存在', this.dbPath)
            }
        } catch (error) {
            console.error('[Database] 初始化失败:', error)
            throw error
        }
    }
    open() {
        try{
            this.db = new DatabaseSync(this.dbPath)
        }catch(error){
            console.error(error)
            throw error
        }
        return true
    }
    isOpen(){
        return this.db ? true : false
    }
    /**
     * sql执行方法
     * @param {*} sql
     * @param {*} params
     * @returns
     */
    async query(sql, params) {
        // console.log('准备执行的sql：', sql)
        // console.log('准备提交的参数', params)
        if(!this.isOpen()){
            this.open()
        }
        return new Promise((resolve, reject) => {
            try{
                resolve(this.db.prepare(sql).all(...params))
            }catch(error){
                reject(error)
            }
        })
    }

    async addLogs(stats){
        const flelds = [
            'api_key_uuid',
            'prompt_tokens',
            'completion_tokens',
            'reasoning_tokens',
            'total_tokens',
            'bytes_in',
            'bytes_out',
            'is_success'
        ]
        const sqlValue = `
            INSERT INTO tb_logs 
                (${flelds.join(',')}, create_time)
            VALUES 
                (${flelds.map(() => '?').join(',')},?)
        `
        return this.query(sqlValue, [...flelds.map((item) => stats[item]), Date.now()])
    }

    async writeStats(stats){
        await this.addLogs(stats)

        // 汇总更新
        const sqlValueSearch = `
            SELECT 
                SUM(prompt_tokens) AS total_prompt_tokens,
                SUM(completion_tokens) AS total_completion_tokens,
                SUM(reasoning_tokens) AS total_reasoning_tokens,
                SUM(total_tokens) AS total_all_tokens,
                SUM(bytes_in) AS total_bytes_in,
                SUM(bytes_out) AS total_bytes_out
            FROM tb_logs
        `
        const resultSearch = await this.query(sqlValueSearch, [])
        const resultSearchValue = resultSearch[0]

        await this.query('DELETE FROM stats_summary', [])
        const flelds = [
            'total_prompt_tokens',
            'total_completion_tokens',
            'total_reasoning_tokens',
            'total_all_tokens',
            'total_bytes_in',
            'total_bytes_out'
        ]
        const sqlValue = `
            INSERT INTO stats_summary 
                (id,${flelds.join(',')})
            VALUES 
                (?, ${flelds.map(() => '?').join(',')})
        `
        return this.query(sqlValue, [1, ...flelds.map((item) => resultSearchValue[item])])
    }

    /**
     * 获取当前统计数据
     * @returns {Object} 统计数据
     */
    async getStats() {
        // 获取汇总表数据
        const sqlValue = 'SELECT * FROM stats_summary where id=1'
        const summary = await this.query(sqlValue, [])
        return {
            summary
        }
    }

    /**
     * 清理过期数据
     * 删除超过指定天数的记录
     * @returns {number} 删除的记录数
     */
    cleanup() {

    }

    /**
     * 重置统计数据
     */
    reset() {

    }

    /**
     * 关闭数据库连接
     */
    close() {
        try {
            if(this.isOpen()){
                this.db.close()
                this.db = null
            }
            console.log('[Database] 数据库连接已关闭')
        } catch (error) {
            console.log(`[Database] 数据库关闭失败，错误信息：${error.message}`)
        }
    }
    /**
     * 自动调用释放资源
     */
    [Symbol.dispose]() {
        this.close()
    }
}

export default DatabaseManager