import { Hono } from 'hono'
import ClassDBConnection from '@/utils/db/ClassDBConnection.js'
import { isValidValue } from '@/utils/utils.js'

// 定义常量
const uuidName = 'id'
const tableName = 'tb_blog_class'

// 创建路由实例
const router = new Hono()

// 处理请求
router.get('/', async(c) => {
    // 处理业务逻辑
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    let sqlFields = [], sqlParams = [], sqlWhere = 'where 1=1', sqlValue
    try {
        // 获取参数
        let { pageSize, pageRowNum, pageIndex } = c.getValuesPage()
        sqlFields = ['searchText']
        sqlFields.map((item) => {
            const value = c.getValueById(item)
            if (isValidValue(value)) {
                if (item === 'searchText') {
                    sqlWhere += ' and d.name like ? '
                    sqlParams.push(`%${value}%`)
                } else {
                    sqlWhere += ` and d.${item}=? `
                    sqlParams.push(value)
                }
            }
        })

        sqlValue = `
                    SELECT
                        d.*
                    FROM
                        ${tableName} AS d
                        ${sqlWhere} 
                    ORDER BY d.sort ASC LIMIT ? OFFSET ?
                    `
        classDBConnection.open()
        let result = await classDBConnection.query(sqlValue, [...sqlParams, pageSize, pageRowNum])

        // 获取分页信息
        const pageResult = await classDBConnection.query(`SELECT COUNT(d.${uuidName}) AS total FROM ${tableName} AS d ${sqlWhere}`, sqlParams)
        const page = {
            total: pageResult[0]['total'],
            pageSize: pageSize,
            pageIndex: pageIndex
        }
        classDBConnection.close()
        return c.sendSuccess({
            message: 'success',
            result: result,
            page: page
        })

    } catch (error) {
        classDBConnection.close()
        return c.sendError(error)
    }
})

// 导出路由
export default router
