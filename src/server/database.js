/**
 * 数据库管理器
 * 使用 sql.js（纯 JavaScript SQLite 实现，无需编译 native 代码）
 * 负责数据库自动初始化、按分钟统计写入、定时清理
 */

import initSqlJs from 'sql.js';
import { dirname } from 'path';
import fs from 'fs';
import CONFIG from './config.js';

/**
 * 数据库管理器类
 */
export class DatabaseManager {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
        this.SQL = null;
        this.init();
    }

    /**
     * 初始化数据库
     * 自动创建数据库文件和统计表
     */
    async init() {
        try {
            // 初始化 sql.js
            // wasm 文件在 node_modules/sql.js/dist/ 目录中
            this.SQL = await initSqlJs({
                locateFile: file => `./node_modules/sql.js/dist/${file}`
            });

            // 加载现有数据库（如果存在）
            if (fs.existsSync(this.dbPath)) {
                const buffer = fs.readFileSync(this.dbPath);
                this.db = new this.SQL.Database(buffer);
                console.log('[Database] 数据库加载成功:', this.dbPath);
            } else {
                this.db = new this.SQL.Database();
                console.log('[Database] 创建新数据库:', this.dbPath);
            }

            // 创建统计表
            this.createTables();

            // 保存到文件
            this.saveDatabase();

            console.log('[Database] 数据库初始化完成:', this.dbPath);
        } catch (error) {
            console.error('[Database] 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 创建数据库表
     */
    createTables() {
        // 创建分钟级统计表
        this.exec(`
            CREATE TABLE IF NOT EXISTS stats_minute (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stat_time TEXT NOT NULL UNIQUE,
                prompt_tokens INTEGER DEFAULT 0,
                completion_tokens INTEGER DEFAULT 0,
                total_tokens INTEGER DEFAULT 0,
                bytes_in INTEGER DEFAULT 0,
                bytes_out INTEGER DEFAULT 0,
                request_count INTEGER DEFAULT 0,
                success_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            -- 创建汇总表（用于快速查询累计数据）
            CREATE TABLE IF NOT EXISTS stats_summary (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                total_prompt_tokens INTEGER DEFAULT 0,
                total_completion_tokens INTEGER DEFAULT 0,
                total_all_tokens INTEGER DEFAULT 0,
                total_bytes_in INTEGER DEFAULT 0,
                total_bytes_out INTEGER DEFAULT 0,
                total_requests INTEGER DEFAULT 0,
                total_success INTEGER DEFAULT 0,
                total_failed INTEGER DEFAULT 0,
                first_request_time TEXT,
                last_request_time TEXT,
                updated_at TEXT DEFAULT (datetime('now'))
            );

            -- 初始化汇总表（如果不存在）
            SELECT * FROM sqlite_master WHERE type='table' AND name='stats_summary';
        `);

        // 检查汇总表是否存在记录，不存在则初始化
        try {
            const result = this.exec("SELECT count(*) as count FROM stats_summary WHERE id = 1");
            if (result && result.length > 0 && result[0].values && result[0].values.length > 0) {
                const rowCount = result[0].values[0][0];
                if (rowCount === 0) {
                    // 使用 INSERT OR IGNORE 避免 UNIQUE 冲突
                    this.exec("INSERT OR IGNORE INTO stats_summary (id) VALUES (1)");
                }
            } else {
                // 如果查询返回空，直接插入
                this.exec("INSERT OR IGNORE INTO stats_summary (id) VALUES (1)");
            }
        } catch (error) {
            // 如果表不存在或查询失败，使用 INSERT OR IGNORE 避免冲突
            console.log('[Database] 汇总表初始化:', error.message);
            this.exec("INSERT OR IGNORE INTO stats_summary (id) VALUES (1)");
        }

        this.saveDatabase();
    }

    /**
     * 执行 SQL 语句
     * @param {string} sql - SQL 语句
     */
    exec(sql) {
        return this.db.run(sql);
    }

    /**
     * 查询数据
     * @param {string} sql - SQL 语句
     * @returns {Array} 查询结果
     */
    query(sql) {
        return this.db.exec(sql);
    }

    /**
     * 简单查询（返回对象数组）
     * @param {string} sql - SQL 语句
     * @returns {Array} 查询结果
     */
    queryAll(sql) {
        const result = this.db.exec(sql);
        if (result.length === 0 || result[0].values.length === 0) {
            return [];
        }

        const columns = result[0].columns;
        const rows = result[0].values;

        return rows.map(row => {
            const obj = {};
            columns.forEach((col, i) => {
                obj[col] = row[i];
            });
            return obj;
        });
    }

    /**
     * 单条查询（返回第一个对象）
     * @param {string} sql - SQL 语句
     * @returns {Object|null} 查询结果
     */
    queryOne(sql) {
        const results = this.queryAll(sql);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * 准备语句并执行（参数化查询）
     * @param {string} sql - SQL 语句（使用 ? 占位符）
     * @param {Array} params - 参数数组
     * @returns {Object} 执行结果
     */
    prepareAndRun(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            stmt.bind(params);
            const result = { changes: stmt.changes };
            stmt.free();
            return result;
        } catch (error) {
            console.error('[Database] 执行失败:', sql, error);
            throw error;
        }
    }

    /**
     * 准备语句并查询
     * @param {string} sql - SQL 语句（使用 ? 占位符）
     * @param {Array} params - 参数数组
     * @returns {Array} 查询结果
     */
    prepareAndQuery(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            stmt.bind(params);
            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            return results;
        } catch (error) {
            console.error('[Database] 查询失败:', sql, error);
            throw error;
        }
    }

    /**
     * 获取当前分钟的统计时间字符串
     * @returns {string} 格式：YYYY-MM-DD HH:mm
     */
    getMinuteKey() {
        const now = new Date();
        return now.toISOString().slice(0, 16).replace('T', ' ');
    }

    /**
     * 异步写入统计数据到数据库
     * 使用 setImmediate 确保不阻塞主转发流
     * @param {Object} data - 统计数据
     */
    async writeStats(data) {
        const {
            statTime,
            promptTokens = 0,
            completionTokens = 0,
            totalTokens = 0,
            bytesIn = 0,
            bytesOut = 0,
            isSuccess = true,
        } = data;

        // 使用 setImmediate 异步执行，不阻塞主线程
        return new Promise((resolve) => {
            setImmediate(() => {
                try {
                    this.upsertMinuteStats({
                        stat_time: statTime,
                        prompt_tokens: promptTokens,
                        completion_tokens: completionTokens,
                        total_tokens: totalTokens,
                        bytes_in: bytesIn,
                        bytes_out: bytesOut,
                        isSuccess,
                    });
                } catch (error) {
                    console.error('[Database] 写入统计失败:', error);
                }
                resolve();
            });
        });
    }

    /**
     * 按分钟累加更新统计数据（Upsert）
     * @param {Object} stats - 统计数据
     */
    upsertMinuteStats(stats) {
        const {
            stat_time,
            prompt_tokens,
            completion_tokens,
            total_tokens,
            bytes_in,
            bytes_out,
            isSuccess,
        } = stats;

        // 使用 INSERT OR REPLACE 实现 upsert
        const sql = `
            INSERT INTO stats_minute 
                (stat_time, prompt_tokens, completion_tokens, total_tokens, bytes_in, bytes_out, request_count, success_count, failed_count, created_at, updated_at)
            VALUES 
                (?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(stat_time) DO UPDATE SET
                prompt_tokens = prompt_tokens + excluded.prompt_tokens,
                completion_tokens = completion_tokens + excluded.completion_tokens,
                total_tokens = total_tokens + excluded.total_tokens,
                bytes_in = bytes_in + excluded.bytes_in,
                bytes_out = bytes_out + excluded.bytes_out,
                request_count = request_count + 1,
                success_count = success_count + excluded.success_count,
                failed_count = failed_count + excluded.failed_count,
                updated_at = datetime('now')
        `;

        const successCount = isSuccess ? 1 : 0;
        const failedCount = isSuccess ? 0 : 1;

        this.prepareAndRun(sql, [
            stat_time,
            prompt_tokens,
            completion_tokens,
            total_tokens,
            bytes_in,
            bytes_out,
            successCount,
            failedCount
        ]);

        // 同时更新汇总表
        this.updateSummary({
            prompt_tokens,
            completion_tokens,
            total_tokens,
            bytes_in,
            bytes_out,
            isSuccess,
        });

        this.saveDatabase();
    }

    /**
     * 更新汇总表
     * @param {Object} stats - 统计数据
     */
    updateSummary(stats) {
        const sql = `
            UPDATE stats_summary SET
                total_prompt_tokens = total_prompt_tokens + ?,
                total_completion_tokens = total_completion_tokens + ?,
                total_all_tokens = total_all_tokens + ?,
                total_bytes_in = total_bytes_in + ?,
                total_bytes_out = total_bytes_out + ?,
                total_requests = total_requests + 1,
                total_success = total_success + ?,
                total_failed = total_failed + ?,
                last_request_time = datetime('now'),
                updated_at = datetime('now')
            WHERE id = 1
        `;

        const successCount = stats.isSuccess ? 1 : 0;
        const failedCount = stats.isSuccess ? 0 : 1;

        this.prepareAndRun(sql, [
            stats.prompt_tokens,
            stats.completion_tokens,
            stats.total_tokens,
            stats.bytes_in,
            stats.bytes_out,
            successCount,
            failedCount
        ]);
    }

    /**
     * 获取当前统计数据
     * @returns {Object} 统计数据
     */
    getStats() {
        // 获取汇总表数据
        const summary = this.queryOne(
            'SELECT * FROM stats_summary WHERE id = 1'
        );

        // 获取最近 60 分钟的统计
        const recentStats = this.queryAll(
            `SELECT * FROM stats_minute 
             ORDER BY stat_time DESC 
             LIMIT 60`
        );

        // 计算当前分钟的累计
        const currentMinute = this.getMinuteKey();
        const currentMinuteStats = this.queryOne(
            `SELECT 
                COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
                COALESCE(SUM(completion_tokens), 0) as completion_tokens,
                COALESCE(SUM(total_tokens), 0) as total_tokens,
                COALESCE(SUM(bytes_in), 0) as bytes_in,
                COALESCE(SUM(bytes_out), 0) as bytes_out,
                COALESCE(SUM(request_count), 0) as request_count
             FROM stats_minute 
             WHERE stat_time = '${currentMinute}'`
        );

        return {
            summary: summary || {
                total_prompt_tokens: 0,
                total_completion_tokens: 0,
                total_all_tokens: 0,
                total_bytes_in: 0,
                total_bytes_out: 0,
                total_requests: 0,
                total_success: 0,
                total_failed: 0,
            },
            currentMinute: currentMinuteStats || {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
                bytes_in: 0,
                bytes_out: 0,
                request_count: 0,
            },
            recentMinutes: recentStats,
            databasePath: this.dbPath,
        };
    }

    /**
     * 清理过期数据
     * 删除超过指定天数的记录
     * @returns {number} 删除的记录数
     */
    cleanup() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - CONFIG.cleanupDays);
        const cutoffStr = cutoffDate.toISOString().slice(0, 10);

        // 先查询将要删除的记录数
        const selectSql = `SELECT COUNT(*) as count FROM stats_minute WHERE stat_time < '${cutoffStr}'`;
        const selectResult = this.db.exec(selectSql);
        const deletedCount = selectResult && selectResult[0] && selectResult[0].values && selectResult[0].values[0] 
            ? selectResult[0].values[0][0] 
            : 0;

        // 执行删除
        if (deletedCount > 0) {
            const deleteSql = `DELETE FROM stats_minute WHERE stat_time < '${cutoffStr}'`;
            this.db.run(deleteSql);
            console.log(`[Database] 清理完成: 删除了 ${deletedCount} 条过期记录`);
        } else {
            console.log('[Database] 清理完成: 没有过期记录需要删除');
        }

        this.saveDatabase();

        return deletedCount;
    }

    /**
     * 重置统计数据
     */
    reset() {
        this.prepareAndRun('DELETE FROM stats_minute');
        this.prepareAndRun(`
            UPDATE stats_summary SET
                total_prompt_tokens = 0,
                total_completion_tokens = 0,
                total_all_tokens = 0,
                total_bytes_in = 0,
                total_bytes_out = 0,
                total_requests = 0,
                total_success = 0,
                total_failed = 0,
                first_request_time = NULL,
                last_request_time = NULL,
                updated_at = datetime('now')
            WHERE id = 1
        `);

        this.saveDatabase();
        console.log('[Database] 统计数据已重置');
    }

    /**
     * 保存数据库到文件
     */
    saveDatabase() {
        try {
            const data = this.db.export();
            const dbDir = dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }
            fs.writeFileSync(this.dbPath, Buffer.from(data));
        } catch (error) {
            console.error('[Database] 保存失败:', error);
        }
    }

    /**
     * 关闭数据库连接
     */
    close() {
        this.saveDatabase();
        if (this.db) {
            this.db.close();
            console.log('[Database] 数据库连接已关闭');
        }
    }
}

export default DatabaseManager;