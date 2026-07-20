import { Hono } from 'hono'
import { fileUpload } from '@/config'
import { md5 } from '@/utils/utils.js'
import ClassDBConnection from '@/utils/db/ClassDBConnection.js'

// 定义常量
const tableName = 'tb_admin'

// 创建路由实例
const app = new Hono()

app.post('/accountVerification', async(c) => {
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    let sqlFields = [], sqlParams, sqlWhere = 'where 1=1', sqlValue
    try {
        // 查询是否存在
        sqlFields = ['username', 'password']
        const { username, password } = c.getValues()
        const hashedPassword = await md5(password)
        sqlParams = [username, hashedPassword]
        sqlFields.map((item) => { sqlWhere += ` and d.${item}=? ` })
        sqlParams = sqlParams.filter((item) => { return item != null })
        if (sqlParams.length < 2) {
            throw new Error('参数缺失或不是有效参数')
        }
        sqlValue = `
            SELECT
                d.id,
                d.username,
                '${c.env.USER_TOKENS}' AS token,
                CAST(${fileUpload.maxSize} AS NUMERIC) AS file_upload_max_size
            FROM
                ${tableName} AS d
                ${sqlWhere}
            `
        classDBConnection.open()
        let result = await classDBConnection.query(sqlValue, sqlParams)
        classDBConnection.close()
        return result.length < 1 ?
        c.sendError('账户或密码不正确，验证失败') :
        c.sendSuccess({ result: result[0] })
    } catch (error) {
        classDBConnection.close()
        throw error
    }
})

// 导出路由
export default app
