import { Hono } from 'hono'
import ClassDBConnection from '@/utils/db/ClassDBConnection'
import { getType, isValidValue, md5 } from '@/utils/utils'
import dayjs from 'dayjs'
import tableConf from '@/table/admin'
const { uuidName, tableName, tableColumns } = tableConf

const app = new Hono()
app.get('/', async(c) => {
    using classDBConnection = new ClassDBConnection(tableConf)
    let sqlFields = [uuidName], sqlParams = [], sqlWhere = 'where 1=1'
    let { pageSize, pageRowNum, pageIndex } = c.getValuesPage()
    sqlFields.map((item) => {
        const value = c.getValueById(item)
        if (isValidValue(value)) {
            sqlWhere += ` and d.${item}=? `
            sqlParams.push(value)
        }
    })

    let sqlValue = `
                SELECT
                    d.*
                FROM
                    ${tableName} AS d
                    ${sqlWhere} 
                    order by d.${uuidName} desc limit ? offset ?
                `
    classDBConnection.open()
    let content = await classDBConnection.query(sqlValue, [...sqlParams, pageSize, pageRowNum])
    content.map((item) => {
        item.create_time ? item.create_time = dayjs(item.create_time).format('YYYY-MM-DD HH:mm:ss.SSS') : null
    })
    const page = await classDBConnection.queryPage(sqlWhere, sqlParams, pageIndex, pageSize)
    return c.sendSuccess({ content, ...page })
})
app.post('/', async(c) => {
    using classDBConnection = new ClassDBConnection(tableConf)
    let sqlFields = tableColumns, sqlParams, sqlValue
    const { username, password } = c.getValues()
    const hashedPassword = await md5(password)
    sqlParams = [username, hashedPassword]
    sqlValue = `
                insert into ${tableName}
                    (${sqlFields.join(',')},create_time)
                values
                    (${sqlFields.map(() => { return '?' }).join(',')},${strftime('%Y-%m-%d %H:%M:%f', 'now')})
                `
    classDBConnection.open()
    await classDBConnection.query(sqlValue, sqlParams)
    return c.sendSuccess()
})
app.put('/', async(c) => {
    using classDBConnection = new ClassDBConnection(tableConf)
    let sqlFields = tableColumns, sqlParams, sqlWhere = 'where 1=1', sqlSpace, sqlValue
    const uuid = c.getValueById(uuidName)
    const { username, password } = c.getValues()
    if (isValidValue(password)) {
        // 这里使用md5加密
        const hashedPassword = await md5(password)
        sqlParams = [username, hashedPassword]
    } else {
        sqlFields = ['username']
        sqlParams = [username]
    }
    sqlParams.push(uuid)
    sqlSpace = sqlFields.map((item) => { return `${item}=?` }).join(',')
    sqlWhere += ` and ${uuidName}=? `
    sqlValue = `update ${tableName} set ${sqlSpace} ${sqlWhere}`
    classDBConnection.open()
    await classDBConnection.query(sqlValue, sqlParams)
    return c.sendSuccess()
})
app.delete('/', async(c) => {
    using classDBConnection = new ClassDBConnection(tableConf)
    const sqlParams = c.getValueByIdToArray([uuidName])
    classDBConnection.open()
    await classDBConnection.delete(sqlParams)
    return c.sendSuccess()
})
app.delete('/multiple', async(c) => {
    using classDBConnection = new ClassDBConnection(tableConf)
    const sqlParams = c.getValues()
    if (getType(sqlParams) !== 'Array') {
        throw new Error('参数错误')
    }
    classDBConnection.open()
    await classDBConnection.delete(sqlParams)
    return c.sendSuccess()
})

export default app
