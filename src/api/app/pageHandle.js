import { isValidValue, isNumber, getCurrentDate } from '@/utils/utils.js'

// 导航栏
export async function pageHandleNav(c, classDBConnection) {
    const uuidName = 'id'
    const tableName = 'tb_blog_class'
    let sqlFields = [], sqlParams = [], sqlWhere = 'WHERE 1=1', sqlValue
    try {
        // 获取参数
        let { pageSize, pageRowNum, pageIndex } = c.getValuesPage()
        pageSize = 10
        pageRowNum = 0
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
        const result = await classDBConnection.query(sqlValue, [...sqlParams, pageSize, pageRowNum])

        // 获取分页信息
        const pageResult = await classDBConnection.query(`SELECT COUNT(d.${uuidName}) AS total FROM ${tableName} AS d ${sqlWhere}`, sqlParams)
        const page = {
            total: pageResult[0]['total'],
            pageSize: pageSize,
            pageIndex: pageIndex
        }
        return {
            message: 'success',
            result: result,
            page: page
        }

    } catch (error) {
        throw error
    }
}

// 简述
export async function pageHandleBlogsJianShu(c, classDBConnection) {
    const uuidName = 'id'
    const tableName = 'tb_blogs'
    let sqlFields = [], sqlParams = [], sqlWhere = 'WHERE 1=1', sqlValue
    try {
        // 获取参数
        let { pageSize, pageRowNum, pageIndex } = c.getValuesPage()
        sqlFields = ['searchText', 'title', 'classId', 'userId']
        sqlFields.map((item) => {
            const value = c.getValueById(item)
            if (isValidValue(value)) {
                switch (item) {
                    case 'title':
                        sqlWhere += ' and d.titleDecodeValue like ? '
                        sqlParams.push(`%${value}%`)
                        break
                    case 'searchText':
                        sqlWhere += ' and d.titleDecodeValue like ? '
                        sqlParams.push(`%${value}%`)
                        break
                    case 'classId':
                        if (isNumber(value)) {
                            sqlWhere += ` and d.${item}=? `
                            sqlParams.push(value)
                        }
                        break
                    default:
                        sqlWhere += ` and d.${item}=? `
                        sqlParams.push(value)
                        break
                }
            }
        })

        sqlValue = `
                SELECT
                    b.name as className,
                    d.classId,d.id,d.title,d.tags,d.jianshu,d.key,d.readTop,d.create_time
                FROM
                    ${tableName} AS d
                LEFT JOIN 
                    tb_blog_class AS b ON b.id=d.classId
                    ${sqlWhere} 
                ORDER BY d.readTop DESC,d.id DESC LIMIT ? OFFSET ?
                `
        const result = await classDBConnection.query(sqlValue, [...sqlParams, pageSize, pageRowNum])

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
        return {
            message: 'success',
            result: result,
            page: page
        }

    } catch (error) {
        throw error
    }
}

// 阅读文章
export async function pageHandleBlogsReadById(c, classDBConnection) {
    const uuidName = 'id'
    const tableName = 'tb_blogs'
    let sqlFields = [], sqlParams = [], sqlWhere = 'WHERE 1=1', sqlValue
    try {
        // 获取参数
        let { pageSize, pageRowNum, pageIndex } = c.getValuesPage()
        sqlFields = [uuidName]
        sqlFields.map((item) => {
            const value = c.getValueById(item)
            if (isValidValue(value)) {
                sqlWhere += ` and d.${item}=? `
                sqlParams.push(value)
            }
        })

        sqlValue = `
                    SELECT
                        b.name as className,
                        d.id,d.title,d.tags,d.content,d.key,d.readCount,d.create_time
                    FROM
                        ${tableName} AS d
                    LEFT JOIN 
                        tb_blog_class as b on b.id=d.classId 
                        ${sqlWhere} 
                    LIMIT ? OFFSET ?
                    `
        const result = await classDBConnection.query(sqlValue, [...sqlParams, pageSize, pageRowNum])

        // 格式化数据
        result.map(item => {
            item.create_time = getCurrentDate(item.create_time, 'YYYY-MM-DD HH:mm:ss')
        })

        // 更新一次记录
        sqlValue = `
                UPDATE ${tableName} SET 
                    readCount = readCount+1 
                WHERE ${uuidName} IN (
                    SELECT d.${uuidName} FROM ${tableName} AS d ${sqlWhere}
                )
            `
        await classDBConnection.query(sqlValue, sqlParams)

        // 获取分页信息
        const pageResult = await classDBConnection.query(`SELECT COUNT(d.${uuidName}) AS total FROM ${tableName} AS d ${sqlWhere}`, sqlParams)
        const page = {
            total: pageResult[0]['total'],
            pageSize: pageSize,
            pageIndex: pageIndex
        }
        return {
            message: 'success',
            result: result,
            page: page
        }
    } catch (error) {
        throw error
    }
}

// 分类热门
export async function pageHandleBlogClassHot(c, classDBConnection) {
    const uuidName = 'id'
    const tableName = 'tb_blogs'
    let sqlFields = [], sqlParams = [], sqlWhere = 'WHERE 1=1', sqlValue
    try {
        // 获取参数
        let { pageSize, pageRowNum, pageIndex } = c.getValuesPage()
        sqlFields = ['classId']
        sqlFields.map((item) => {
            const value = c.getValueById(item)
            if (isValidValue(value)) {
                sqlWhere += ` and d.${item}=? `
                sqlParams.push(value)
            }
        })

        sqlValue = `
                SELECT
                    d.id,d.title,d.key
                FROM
                    ${tableName} AS d
                    ${sqlWhere} 
                ORDER BY d.readCount desc,d.readTop DESC LIMIT ? OFFSET ?
                `
        const result = await classDBConnection.query(sqlValue, [...sqlParams, pageSize, pageRowNum])

        // 获取分页信息
        const pageResult = await classDBConnection.query(`SELECT COUNT(d.${uuidName}) AS total FROM ${tableName} AS d ${sqlWhere}`, sqlParams)
        const page = {
            total: pageResult[0]['total'],
            pageSize: pageSize,
            pageIndex: pageIndex
        }

        return {
            message: 'success',
            result: result,
            page: page
        }
    } catch (error) {
        throw error
    }
}

// 友情链接
export async function pageHandleFriendlyLink(c, classDBConnection) {
    const uuidName = 'id'
    const tableName = 'tb_blogs'
    let sqlParams = [], sqlWhere = 'WHERE 1=1', sqlValue
    try {
        // 获取参数
        let { pageSize, pageRowNum, pageIndex } = c.getValuesPage()
        //友情链接
        sqlValue = `
                SELECT
                    d.id,d.name,d.target,d.link_url
                FROM
                    tb_friendly_link AS d
                ORDER BY d.sort desc,d.create_time asc LIMIT ? OFFSET ?
                `
        const result = await classDBConnection.query(sqlValue, [pageSize, pageRowNum])
        // 获取分页信息
        const pageResult = await classDBConnection.query(`SELECT COUNT(d.${uuidName}) AS total FROM ${tableName} AS d ${sqlWhere}`, sqlParams)
        const page = {
            total: pageResult[0]['total'],
            pageSize: pageSize,
            pageIndex: pageIndex
        }
        return {
            message: 'success',
            result: result,
            page: page
        }
    } catch (error) {
        throw error
    }
}
