import { Hono } from 'hono';
import { md5 } from "../utils/utils.js";
import ClassDBConnection from "../utils/db/ClassDBConnection.js";

// 定义常量
const tableName = "tb_admin";
const tableColumns = [
    "username", "password"
];

// 创建路由实例
const router = new Hono();

router.post('/accountVerification', async (c) => {
    const env = c.env;
    const classDBConnection = new ClassDBConnection();
    classDBConnection.init(env);
    try {
        let sqlFields = [], sqlParams, sqlWhere = 'where 1=1', sqlSpace, sqlValue;
        // 查询是否存在
        sqlFields = ["username", "password"];
        const { username, password } = c.getValues();
        const hashedPassword = await md5(password);
        sqlParams = [username, hashedPassword];
        sqlFields.map((item) => { sqlWhere += ` and d.${item}=? ` });
        sqlParams = sqlParams.filter((item) => { return item != null });
        if (sqlParams.length < 2) {
            return c.sendError("参数缺失或不是有效参数");
        }

        // 生成uuid
        const uuidv4 = crypto.randomUUID();
        sqlValue = `
            SELECT
                d.id,
                d.username,
                '${uuidv4}' AS token,
                CAST(${env.file_upload_max_size} AS NUMERIC) AS file_upload_max_size
            FROM
                ${tableName} AS d
                ${sqlWhere}
            `;
        classDBConnection.open();
        let result = await classDBConnection.query(sqlValue, sqlParams);
        
        if (result.length < 1) {
            classDBConnection.close();
            return c.sendError("账户或密码不正确，验证失败");
        }

        // 写入数据库
        const updateSql = `UPDATE ${tableName} SET token=?,token_expire_time=? WHERE username=?`;
        await classDBConnection.query(updateSql, [uuidv4, Date.now() + env.token_expire_time, username])
        classDBConnection.close();
        return c.sendSuccess({ result: result[0] });
    } catch (error) {
        classDBConnection.close();
        throw error;
    }
    
});

// 导出路由
export default router;
