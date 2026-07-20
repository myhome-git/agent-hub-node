import { Hono } from 'hono'
import ClassDBConnection from '@/utils/db/ClassDBConnection.js'
import { isValidValue, getCurrentDate } from '@/utils/utils.js'
import { tableName } from './blogs/config'

// 创建路由实例
const app = new Hono()

// 处理请求，获取博客列表，只有title
app.get('/list/simple', async(c) => {
    // 处理业务逻辑
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    let sqlFields = [], sqlParams = [], sqlWhere = 'WHERE 1=1'
    try {
        // 获取参数
        let { pageSize, pageRowNum, pageIndex } = c.getValuesPage()
        sqlFields = ['searchText', 'classId']
        sqlFields.map((item) => {
            const value = c.getValueById(item)
            if (isValidValue(value)) {
                if (item === 'searchText') {
                    sqlWhere += ' and d.titleDecodeValue like ? '
                    sqlParams.push(`%${value}%`)
                } else {
                    sqlWhere += ` and d.${item}=? `
                    sqlParams.push(value)
                }
            }
        })

        let sqlValue = `
                    SELECT
                        b.name as className,d.id,d.title,d.tags,d.key,d.create_time,d.readTop,d.classId
                    FROM
                        ${tableName} AS d
                    LEFT JOIN 
                        tb_blog_class as b on b.id=d.classId
                        ${sqlWhere} 
                    ORDER BY d.id DESC LIMIT ? OFFSET ?
                    `
        classDBConnection.open()
        let result = await classDBConnection.query(sqlValue, [...sqlParams, pageSize, pageRowNum])

        // 格式化数据
        result.map(item => {
            item.create_time = getCurrentDate(item.create_time, 'YYYY-MM-DD HH:mm:ss')
        })

        // 获取分页信息
        const pageResult = await classDBConnection.query(`SELECT COUNT(d.id) AS total FROM ${tableName} AS d ${sqlWhere}`, sqlParams)
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

export default app
