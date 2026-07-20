import { Hono } from 'hono'
import ClassDBConnection from '../../utils/db/ClassDBConnection.js'
import { getType, isValidValue, getCurrentDate } from '../../utils/utils.js'
import { conf_uuidName, conf_tableName, conf_tableColumns } from './link.config.js'

// 定义常量
const uuidName = conf_uuidName
const tableName = conf_tableName
const tableColumns = conf_tableColumns

// 创建路由实例
const router = new Hono()

// 处理请求
router.get('/', async(c) => {
    // 处理业务逻辑
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    let sqlFields = [], sqlParams = [], sqlWhere = 'where 1=1'
    try {
        // 获取参数
        let { pageSize, pageRowNum, pageIndex } = c.getValuesPage()
        sqlFields = [uuidName, 'searchText']
        sqlFields.map((item) => {
            const value = c.getValueById(item)
            if (isValidValue(value)) {
                switch (item) {
                    case 'searchText':
                        sqlWhere += ' and d.name like ? '
                        sqlParams.push(`%${value}%`)
                    default:
                        sqlWhere += ` and d.${item}=? `
                        sqlParams.push(value)
                        break
                }
            }
        })

        let sqlValue = `
                    SELECT
                        d.${uuidName},d.${tableColumns.filter(item => item !== 'a').join(',d.')},d.create_time
                    FROM
                        ${tableName} AS d
                        ${sqlWhere} 
                    ORDER BY d.sort DESC LIMIT ? OFFSET ?
                    `
        classDBConnection.open()
        let result = await classDBConnection.query(sqlValue, [...sqlParams, pageSize, pageRowNum])

        // 格式化数据
        result.map(item => {
            item.create_time = getCurrentDate(item.create_time, 'YYYY-MM-DD HH:mm:ss')
        })

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
router.get('/getMaxSortNumber', async(c) => {
    // 处理业务逻辑
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    let sqlFields = [], sqlParams = [], sqlWhere = 'where 1=1'
    try {
        // 获取参数
        let { pageSize, pageRowNum } = c.getValuesPage()
        sqlFields = []
        sqlFields.map((item) => {
            const value = c.getValueById(item)
            if (isValidValue(value)) {
                switch (item) {
                    default:
                        sqlWhere += ` and d.${item}=? `
                        sqlParams.push(value)
                        break
                }
            }
        })

        let sqlValue = `
                    SELECT
                        d.id,max(d.sort) AS sortNumber
                    FROM
                        ${tableName} AS d
                        ${sqlWhere} 
                    ORDER BY d.sort DESC LIMIT ? OFFSET ?
                    `
        classDBConnection.open()
        let result = await classDBConnection.query(sqlValue, [...sqlParams, pageSize, pageRowNum])

        classDBConnection.close()
        return c.sendSuccess({
            message: 'success',
            result: result
        })

    } catch (error) {
        classDBConnection.close()
        return c.sendError(error)
    }
})
router.post('/', async(c) => {
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    let sqlFields = tableColumns, sqlParams, sqlValue
    try {
        // 插入数据
        sqlParams = c.getValueByIdToArray(sqlFields)
        sqlValue = `
                    insert into ${tableName}
                        (${sqlFields.join(',')},create_time)
                    values
                        (${sqlFields.map(() => { return '?' }).join(',')},${Date.now()})
                    `
        await classDBConnection.query(sqlValue, sqlParams)
        classDBConnection.close()
        return c.sendSuccess()
    } catch (error) {
        classDBConnection.close()
        return c.sendError(error)
    }
})
router.put('/', async(c) => {
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    let sqlFields = tableColumns, sqlParams, sqlWhere = 'WHERE 1=1', sqlSpace, sqlValue
    try {
        // 获取参数values
        const uuid = c.getValueById(uuidName)
        sqlParams = c.getValueByIdToArray(sqlFields)
        sqlSpace = sqlFields.map((item) => { return `${item}=?` }).join(',')
        sqlWhere += ` and ${uuidName}=? `
        sqlParams.push(uuid)
        sqlValue = `update ${tableName} set ${sqlSpace} ${sqlWhere}`
        classDBConnection.open()
        await classDBConnection.query(sqlValue, sqlParams)
        classDBConnection.close()
        return c.sendSuccess({ message: 'success' })
    } catch (error) {
        classDBConnection.close()
        return c.sendError(error)
    }
})
router.delete('/', async(c) => {
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    let sqlFields = [], sqlParams, sqlWhere = 'WHERE 1=1', sqlValue
    try {
        //查询是否存在，如果存在则删除
        sqlFields = [uuidName]
        sqlParams = c.getValueByIdToArray(sqlFields)
        sqlFields.map((item) => { sqlWhere += ` AND ${item}=? ` })
        sqlValue = `delete from ${tableName} ${sqlWhere}`
        classDBConnection.open()
        await classDBConnection.query(sqlValue, sqlParams)
        classDBConnection.close()
        return c.sendSuccess()
    } catch (error) {
        classDBConnection.close()
        return c.sendError(error)
    }
})
router.delete('/multiple', async(c) => {
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    let sqlParams, sqlWhere = 'where 1=1', sqlValue
    try {
        //查询是否存在，如果存在则删除
        sqlParams = c.getValues()
        if(getType(sqlParams) !== 'Array'){
            throw new Error('参数错误')
        }
        classDBConnection.open()
        for await (const element of sqlParams) {
            sqlWhere = ` where 1=1 and ${uuidName}=? `
            sqlValue = `delete from ${tableName} ${sqlWhere}`
            await classDBConnection.query(sqlValue, [element])
        }
        classDBConnection.close()
        return c.sendSuccess()
    } catch (error) {
        classDBConnection.close()
        return c.sendError(error)
    }
})

// 导出路由
export default router
