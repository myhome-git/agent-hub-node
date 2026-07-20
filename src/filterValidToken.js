import { getType, isValidValue, ObjectType } from './utils/utils.js';
import ClassDBConnection from './utils/db/ClassDBConnection.js';

// 导出一个函数，用于过滤有效用户
const tableName = "tb_admin";
export async function filterValidToken(c) {
    const userToken = getRequestHeaders(c)["token"];
    if (!isValidValue(userToken)) {
        return false;
    }
    const env = c.env;
    const sqlValue = `
        SELECT
            d.id
        FROM
            ${tableName} AS d
        WHERE d.token=? 
        AND d.token_expire_time <= ${Date.now() + env.token_expire_time}
        AND d.token_expire_time >= ${Date.now()}
        `;
    
    const classDBConnection = new ClassDBConnection();
    classDBConnection.init(env);
    try {
         classDBConnection.open();
        let result = await classDBConnection.query(sqlValue, [userToken]);
        if (result.length < 1) {
            classDBConnection.close();
            return false;
        }
        const updateSql = `UPDATE ${tableName} SET token_expire_time=? WHERE token=?`;
        await classDBConnection.query(updateSql, [Date.now() + env.token_expire_time, userToken])
        classDBConnection.close();
    } catch (error) {
        classDBConnection.close();
        throw error;   
    }

    return true;
}

function getRequestHeaders(c) {
    return c.req.header();
}