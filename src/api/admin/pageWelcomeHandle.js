import blogClassConf from '@/table/blogClass'
import blogsConf from './blogs/config'
import notepadConf from './notepad.config.js'
import linkConf from './link.config.js'
import { getDatePrevious } from '@/utils/utils.js'

// 分类数量
export async function handleBlogClassTotal(c, classDBConnection) {
    const { uuidName, tableName } = blogClassConf
    let sqlParams = [], sqlValue
    try {
        sqlValue = `
                SELECT
                    count(d.${uuidName}) AS total
                FROM
                    ${tableName} AS d
                `
        const result = await classDBConnection.query(sqlValue, [...sqlParams])
        return result[0]['total']
    } catch (error) {
        throw error
    }
}

// 文章数量
export async function handleBlogTotal(c, classDBConnection) {
    const { uuidName, tableName } = blogsConf
    let sqlParams = [], sqlValue
    try {
        // 获取参数
        sqlValue = `
                SELECT
                    count(d.${uuidName}) AS total
                FROM
                    ${tableName} AS d
                `
        const result = await classDBConnection.query(sqlValue, [...sqlParams])
        return result[0]['total']
    } catch (error) {
        throw error
    }
}

// 日记数量
export async function handleNotepadTotal(c, classDBConnection) {
    const { conf_uuidName, conf_tableName } = notepadConf
    const uuidName = conf_uuidName
    const tableName = conf_tableName
    let sqlParams = [], sqlValue
    try {
        // 获取参数
        sqlValue = `
                SELECT
                    count(d.${uuidName}) AS total
                FROM
                    ${tableName} AS d
                `
        const result = await classDBConnection.query(sqlValue, [...sqlParams])
        return result[0]['total']
    } catch (error) {
        throw error
    }
}

// 友链数量
export async function handleLinkTotal(c, classDBConnection) {
    const { conf_uuidName, conf_tableName } = linkConf
    const uuidName = conf_uuidName
    const tableName = conf_tableName
    let sqlParams = [], sqlValue
    try {
        // 获取参数
        sqlValue = `
                SELECT
                    count(d.${uuidName}) AS total
                FROM
                    ${tableName} AS d
                `
        const result = await classDBConnection.query(sqlValue, [...sqlParams])
        return result[0]['total']
    } catch (error) {
        throw error
    }
}

// 文章发布趋势
export async function handleBlogAddDateCount(c, classDBConnection) {
    const { conf_tableName } = blogsConf // 修复：应该使用blogsConf而不是linkConf
    const tableName = conf_tableName
    let sqlParams = [], sqlValue
    try {
        const endDate = Date.now()
        const startDate = getDatePrevious(endDate, '1y')
        // 修复：直接使用时间戳，让SQL处理转换
        sqlParams = [startDate, endDate]
        sqlValue = `
                SELECT 
                    strftime('%Y-%m', datetime(create_time / 1000, 'unixepoch', 'localtime')) AS publish_date,
                    COUNT(id) AS publish_count
                FROM ${tableName} 
                WHERE 
                    create_time >= ?
                    AND create_time <= ?
                GROUP BY strftime('%Y-%m', datetime(create_time / 1000, 'unixepoch', 'localtime'))
                ORDER BY publish_date;
                `
        const result = await classDBConnection.query(sqlValue, sqlParams, false)
        return result
    } catch (error) {
        throw error
    }
}

// 分类统计blog
export async function handleBlogClassCount(c, classDBConnection) {
    let sqlValue
    try {
        sqlValue = `
                SELECT 
                    bc.id AS class_id,
                    bc.name AS class_name,
                    COUNT(b.id) AS blog_count
                FROM tb_blog_class bc
                    INNER JOIN tb_blogs b ON bc.id = b.classId
                GROUP BY bc.id, bc.name
                ORDER BY blog_count DESC, bc.name;
                `
        const result = await classDBConnection.query(sqlValue, [], false)
        return result
    } catch (error) {
        throw error
    }
}
