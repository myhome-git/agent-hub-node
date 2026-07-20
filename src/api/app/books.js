import { Hono } from 'hono'
import ClassDBConnection from '@/utils/db/ClassDBConnection.js'
import { isValidValue, getCurrentDate } from '@/utils/utils.js'
import tableConf from '@/api/admin/books/config.js'
const { uuidName, tableName } = tableConf

// 创建路由实例
const router = new Hono()

// 处理请求
router.get('/list', async(c) => {
    // 处理业务逻辑
    using classDBConnection = new ClassDBConnection(tableConf)
    let sqlFields = [], sqlParams = [], sqlWhere = 'where 1=1', sqlValue
    // 获取参数
    let { pageSize, pageRowNum, pageIndex } = c.getValuesPage()
    sqlFields = ['searchText']
    sqlFields.map((item) => {
        const value = c.getValueById(item)
        if (isValidValue(value)) {
            if (item === 'searchText') {
                sqlWhere += ' and (d.author like ? or d.title like ?) '
                sqlParams.push(`%${value}%`)
                sqlParams.push(`%${value}%`)
            } else {
                sqlWhere += ` and d.${item}=? `
                sqlParams.push(value)
            }
        }
    })

    sqlValue = `
                SELECT
                    ROW_NUMBER() OVER(ORDER BY id DESC) AS row_num,
                    d.*
                FROM
                    ${tableName} AS d
                    ${sqlWhere} 
                ORDER BY d.${uuidName} desc LIMIT ? OFFSET ?
                `
    classDBConnection.open()
    let result = await classDBConnection.query(sqlValue, [...sqlParams, pageSize, pageRowNum])
    // 格式化数据
    result.map(item => {
        item.create_time = getCurrentDate(item.create_time, 'YYYY-MM-DD HH:mm:ss')
        item.update_time = getCurrentDate(item.update_time, 'YYYY-MM-DD HH:mm:ss')
    })

    // 获取分页信息
    const pageResult = await classDBConnection.query(`SELECT COUNT(d.${uuidName}) AS total FROM ${tableName} AS d ${sqlWhere}`, sqlParams)
    const page = {
        total: pageResult[0]['total'],
        pageSize: pageSize,
        pageIndex: pageIndex
    }
    return c.sendSuccess({
        message: 'success',
        result: result,
        page: page
    })
})
router.get('/detail', async(c) => {
    // 处理业务逻辑
    try {
        let result = { url: process.env.BOOKS_URL }
        return c.sendSuccess({
            message: 'success',
            result: result
        })

    } catch (error) {
        return c.sendError(error)
    }
})

// 导出路由
export default router
