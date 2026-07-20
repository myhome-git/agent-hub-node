import { Hono } from 'hono'
import ClassDBConnection from '../utils/db/ClassDBConnection.js'
import { isValidValue } from '../utils/utils.js'
import { conf_uuidName, conf_tableName, conf_tableColumns } from './template.config.js'

// 定义常量
const uuidName = conf_uuidName
const tableName = conf_tableName
const tableColumns = conf_tableColumns

const router = new Hono()
router.get('/', async(c) => {
    // 处理业务逻辑
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    let sqlFields = [], sqlParams = [], sqlWhere = 'WHERE 1=1'
    try {
        // 获取参数
        let { pageSize, pageRowNum, pageIndex } = c.getValuesPage()
        sqlFields = []
        sqlFields.map((item) => {
            const value = c.getValueById(item)
            if (isValidValue(value)) {
                sqlWhere += ` and d.${item}=? `
                sqlParams.push(value)
            }
        })

        let sqlValue = `
                    SELECT
                        d.id,
                        d.admin_name
                    FROM
                        ${tableName} AS d
                    LEFT JOIN
                        tb_files AS dict_files ON d.file_id = dict_files.id
                        ${sqlWhere} 
                    ORDER BY d.id DESC LIMIT ? OFFSET ?
                    `
        classDBConnection.open()
        let result = await classDBConnection.query(sqlValue, [...sqlParams, pageSize, pageRowNum])

        // 获取分页信息
        const pageResult = await classDBConnection.query(`SELECT COUNT(d.id) AS total FROM ${tableName} AS d ${sqlWhere}`, sqlParams)
        const page = {
            total: pageResult[0]['total'],
            pageSize: pageSize,
            pageIndex: pageIndex,
        }
        classDBConnection.close()
        return c.sendSuccess({
            message: 'success',
            result: result,
            page: page
        })

    } catch (error) {
        classDBConnection.close()
        throw error
    }
})
router.post('/', async(c) => {
    const classDBConnection = new ClassDBConnection()
    let sqlFields = tableColumns, sqlParams, sqlValue
    try {
        // 插入数据
        sqlParams = c.getValueByIdToArray(sqlFields)
        sqlValue = `
                    insert into ${tableName}
                        (${sqlFields.join(',')},create_time)
                    values
                        (${sqlFields.map(() => { return '?' }).join(',')},now())
                    `
        await classDBConnection.query(sqlValue, sqlParams)
        classDBConnection.close()
        return c.sendSuccess()
    } catch (error) {
        classDBConnection.close()
        throw error
    }
})
router.put('/', async(c) => {
    const classDBConnection = new ClassDBConnection()
    let sqlFields = tableColumns, sqlParams, sqlWhere = 'WHERE 1=1', sqlValue
    try {
        // 获取参数values
        const uuid = c.getValueById(uuidName)
        sqlParams = c.getValueByIdToArray(sqlFields)
        sqlParams.push(uuid)
        sqlSpace = sqlFields.map((item) => { return `${item}=?` }).join(',')
        sqlWhere += ` and ${uuidName}=? `
        sqlValue = `update ${tableName} set ${sqlSpace} ${sqlWhere}`
        /**
         * 特殊情况下，可能需要下面的写法，带别名的UPDATE
         */
        sqlValue = `
                    UPDATE ${tableName} SET 
                        ${sqlSpace}
                    WHERE ${uuidName} IN (
                        SELECT d.${uuidName} FROM ${tableName} AS d ${sqlWhere}
                    )
                `
        classDBConnection.open()
        await classDBConnection.query(sqlValue, sqlParams)
        classDBConnection.close()
        return c.sendSuccess({ message: 'success' })
    } catch (error) {
        classDBConnection.close()
        throw error
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
        sqlFields.map((item) => { sqlWhere += ` and ${item}=? ` })
        sqlValue = `delete from ${tableName} ${sqlWhere}`
        classDBConnection.open()
        await classDBConnection.query(sqlValue, sqlParams)
        classDBConnection.close()
        return c.sendSuccess()
    } catch (error) {
        classDBConnection.close()
        throw error
    }
})

// 导出路由
export default router
