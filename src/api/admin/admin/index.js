import { Hono } from 'hono';
import ClassDBConnection from '@/utils/db/ClassDBConnection.js';
import { getType, isValidValue, getCurrentDate, md5 } from '@/utils/utils.js';
import { conf_uuidName, conf_tableName, conf_tableColumns } from './config.js';

// 定义常量
// 定义常量
const uuidName = conf_uuidName;
const tableName = conf_tableName;
const tableColumns = conf_tableColumns;

// 创建路由实例
const router = new Hono();

// 处理请求
router.get('/', async (c) => {
    // 处理业务逻辑
    const classDBConnection = new ClassDBConnection();
    classDBConnection.init(c.env);
    let sqlFields = [], sqlParams = [], sqlWhere = 'where 1=1', sqlSpace, sqlValue;
    try {
        // 获取参数
        const { uuid } = c.getValues();
        sqlFields = [uuidName];
        let { pageSize, pageRowNum, pageIndex } = c.getValuesPage();
        sqlFields.map((item) => {
            const value = c.getValueById(item);
            if (isValidValue(value)) {
                sqlWhere += ` and d.${item}=? `;
                sqlParams.push(value);
            }
        });

        let sqlValue = `
                    SELECT
                        ROW_NUMBER() OVER(order by d.${uuidName} desc) AS row_num,
                        d.*
                    FROM
                        ${tableName} AS d
                        ${sqlWhere} 
                        order by d.${uuidName} desc limit ? offset ?
                    `;
        classDBConnection.open();
        let result = await classDBConnection.query(sqlValue, [...sqlParams, pageSize, pageRowNum]);
        result.map((item) => {
            item.create_time = getCurrentDate(item.create_time);
        })

        // 获取分页信息
        const pageResult = await classDBConnection.query(`select count(d.id) as total from ${tableName} as d ${sqlWhere}`, sqlParams);
        const page = {
            total: pageResult[0]["total"],
            pageSize: pageSize,
            pageIndex: pageIndex
        };
        classDBConnection.close();
        return c.sendSuccess({
            message: "success",
            result: result,
            page: page
        });

    } catch (error) {
        classDBConnection.close();
        return c.sendError(error);
    }
});
router.post('/', async (c) => {
    const classDBConnection = new ClassDBConnection();
    classDBConnection.init(c.env);
    let sqlFields = tableColumns, sqlParams, sqlWhere = 'where 1=1', sqlSpace, sqlValue;
    try {
        // 插入数据
        const { username, password } = c.getValues();
        const hashedPassword = await md5(password);
        sqlParams = [username, hashedPassword];
        sqlValue = `
                    insert into ${tableName}
                        (${sqlFields.join(",")},create_time)
                    values
                        (${sqlFields.map(item => { return "?" }).join(",")},${Date.now()})
                    `;
        await classDBConnection.query(sqlValue, sqlParams);
        classDBConnection.close();
        return c.sendSuccess();
    } catch (error) {
        classDBConnection.close();
        return c.sendError(error);
    }
});
router.put('/', async (c) => {
    const classDBConnection = new ClassDBConnection();
    classDBConnection.init(c.env);
    let sqlFields = tableColumns, sqlParams, sqlWhere = 'where 1=1', sqlSpace, sqlValue;
    try {
        // 获取参数values
        const uuid = c.getValueById(uuidName);
        const { username, password } = c.getValues();
        if (isValidValue(password)) {
            // 这里使用md5加密
            const hashedPassword = await md5(password);
            sqlParams = [username, hashedPassword];
        } else {
            sqlFields = ["username"];
            sqlParams = [username];
        }
        sqlParams.push(uuid);
        sqlSpace = sqlFields.map((item) => { return `${item}=?` }).join(",");
        sqlWhere += ` and ${uuidName}=? `;
        sqlValue = `update ${tableName} set ${sqlSpace} ${sqlWhere}`;
        classDBConnection.open();
        await classDBConnection.query(sqlValue, sqlParams);
        classDBConnection.close();
        return c.sendSuccess({ message: "success" });
    } catch (error) {
        classDBConnection.close();
        return c.sendError(error);
    }
});
router.delete('/', async (c) => {
    const classDBConnection = new ClassDBConnection();
    classDBConnection.init(c.env);
    let sqlFields = tableColumns, sqlParams, sqlWhere = 'where 1=1', sqlValue;
    try {
        const uuid = c.getValueById(uuidName);
        //查询是否存在，如果存在则删除
        sqlFields = [uuidName];
        sqlParams = c.getValueByIdToArray(sqlFields);
        sqlFields.map((item) => { sqlWhere += ` and ${item}=? ` })
        sqlValue = `delete from ${tableName} ${sqlWhere}`;
        classDBConnection.open();
        await classDBConnection.query(sqlValue, sqlParams);
        classDBConnection.close();
        return c.sendSuccess();
    } catch (error) {
        classDBConnection.close();
        return c.sendError(error);
    }
});
router.delete('/multiple', async (c) => {
    const classDBConnection = new ClassDBConnection();
    classDBConnection.init(c.env);
    let sqlFields = tableColumns, sqlParams, sqlWhere = 'where 1=1', sqlValue;
    try {
        //查询是否存在，如果存在则删除
        sqlFields = [];
        sqlParams = c.getValues();
        if (getType(sqlParams) !== "Array") {
            throw new Error("参数错误");
        }
        classDBConnection.open();
        for await (const element of sqlParams) {
            sqlWhere = ` where 1=1 and ${uuidName}=? `
            sqlValue = `delete from ${tableName} ${sqlWhere}`;
            await classDBConnection.query(sqlValue, [element]);
        }
        classDBConnection.close();
        return c.sendSuccess();
    } catch (error) {
        classDBConnection.close();
        return c.sendError(error);
    }
});

// 导出路由
export default router;
