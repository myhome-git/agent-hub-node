import databaseBackupConf from './database.config.js'
import { isValidValue, getType, getCurrentDate, toMd5, formatFileSize } from '../../utils/utils.js'
import { putObject, deleteObject } from '../../utils/cloudflare/bucket_database.js'

export async function handleGet(c, classDBConnection) {
    const { conf_uuidName, conf_tableName, conf_tableColumns } = databaseBackupConf
    const uuidName = conf_uuidName
    const tableName = conf_tableName
    let sqlFields = conf_tableColumns, sqlParams = [], sqlWhere = 'WHERE 1=1', sqlColumnsFilters = ['tempfilter']
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
                            d.${uuidName},d.${conf_tableColumns.filter(item => !sqlColumnsFilters.includes(item)).join(',d.')},d.create_time
                        FROM
                            ${tableName} AS d
                            ${sqlWhere} 
                        ORDER BY d.${uuidName} DESC LIMIT ? OFFSET ?
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
        return {
            result: result,
            page: page
        }
    } catch (error) {
        throw error
    }
}

export async function handlePost(c, classDBConnection) {
    const { conf_tableName, conf_tableColumns } = databaseBackupConf
    const tableName = conf_tableName
    let sqlFields = conf_tableColumns, sqlParams, sqlValue
    try {
        let sqlText = await classDBConnection.exportSql()
        const filename = `${getCurrentDate(Date.now(), 'YYYYMMDDHHmmss')}`
        const file = new Blob([sqlText], {
            type: 'application/sql',
            lastModified: Date.now()
        })
        const md5 = await toMd5(file)

        // 过滤重复
        sqlValue = `
                    SELECT
                        d.md5
                    FROM
                        ${tableName} AS d
                    WHERE
                        d.md5 = ?
                    `
        let result = await classDBConnection.query(sqlValue, [md5], false)
        if (result.length > 0) {
            throw new Error('数据库备份文件已存在')
        }

        await putObject(c.env, file, md5)
        // 插入数据
        sqlParams = [filename, formatFileSize(file.size), `/${md5}`, md5]
        sqlValue = `
                    insert into ${tableName}
                        (${sqlFields.join(',')},create_time)
                    values
                        (${sqlFields.map(() => { return '?' }).join(',')},${Date.now()})
                    `
        await classDBConnection.query(sqlValue, sqlParams)
    } catch (error) {
        throw error
    }
}
export async function handlePostVacuum(c, classDBConnection) {
    let sqlValue
    try {
        try {
            await classDBConnection.exec('COMMIT;')
            console.log('尝试提交之前可能未提交的事务.')
        } catch (commitError) {
            if (!commitError.message.includes('no transaction is active')) {
                console.warn('尝试提交事务时遇到其他错误:', commitError.message)
            }
        }

        // 空间回收
        sqlValue = 'VACUUM;'
        await classDBConnection.exec(sqlValue)
    } catch (error) {
        throw error
    }
}

export async function handlePut(c, classDBConnection) {
    const { conf_uuidName, conf_tableName, conf_tableColumns } = databaseBackupConf
    const uuidName = conf_uuidName
    const tableName = conf_tableName
    let sqlFields = conf_tableColumns, sqlParams, sqlValue
    try {
        // 更新数据
        const uuid = c.getValueById(uuidName)
        sqlParams = c.getValueByIdToArray(sqlFields)
        sqlValue = `
                    update ${tableName}
                    set ${sqlFields.map(item => { return `${item} = ?` }).join(',')}
                    where ${uuidName} = ?
                    `
        await classDBConnection.query(sqlValue, [...sqlParams, uuid])
    } catch (error) {
        throw error
    }
}

export async function handleDelete(c, classDBConnection) {
    const { conf_uuidName, conf_tableName } = databaseBackupConf
    const uuidName = conf_uuidName
    const tableName = conf_tableName
    let sqlFields = [], sqlParams, sqlWhere = 'WHERE 1=1', sqlValue
    try {
        //查询是否存在，如果存在则删除
        sqlFields = [uuidName]
        sqlParams = c.getValueByIdToArray(sqlFields)
        sqlValue = `
                SELECT
                    d.${uuidName},d.md5
                FROM
                    ${tableName} AS d
                    ${sqlWhere} 
                `
        classDBConnection.open()
        let result = await classDBConnection.query(sqlValue, [...sqlParams])
        if (result.length === 0) {
            throw new Error('数据不存在')
        }
        const filename = result[0]['md5']

        // 删除文件
        await deleteObject(c.env, filename)

        // 删除数据
        sqlWhere = ' where 1=1 '
        sqlFields = [uuidName]
        sqlParams = c.getValueByIdToArray(sqlFields)
        sqlFields.map((item) => { sqlWhere += ` AND ${item}=? ` })
        sqlValue = `delete from ${tableName} ${sqlWhere}`
        await classDBConnection.query(sqlValue, sqlParams)
    } catch (error) {
        throw error
    }
}

export async function handleDeleteMultiple(c, classDBConnection) {
    const { conf_uuidName, conf_tableName } = databaseBackupConf
    const uuidName = conf_uuidName
    const tableName = conf_tableName
    let sqlParams, sqlWhere = 'where 1=1', sqlValue
    try {
        //查询是否存在，如果存在则删除
        sqlParams = c.getValues()
        if (getType(sqlParams) !== 'Array') {
            throw new Error('参数错误')
        }
        for await (const element of sqlParams) {
            sqlWhere = ` where ${uuidName}=? `
            sqlValue = `
                SELECT
                    d.${uuidName},d.md5
                FROM
                    ${tableName} AS d
                    ${sqlWhere} 
                `
            let result = await classDBConnection.query(sqlValue, [element])
            if (result.length === 0) {
                continue
            }
            const filename = result[0]['md5']

            // 删除文件
            await deleteObject(c.env, filename)

            // 删除数据
            sqlWhere = ` where ${uuidName}=? `
            sqlValue = `delete from ${tableName} ${sqlWhere}`
            await classDBConnection.query(sqlValue, [element])
        }
    } catch (error) {
        throw error
    }
}

// class File {
//     constructor(data, filename, options = {}) {
//         // 支持 Uint8Array 或 string
//         if (typeof data === 'string') {
//             const encoder = new TextEncoder()
//             this.buffer = encoder.encode(data)
//         } else {
//             this.buffer = data // Uint8Array
//         }

//         this.name = filename
//         this.size = this.buffer.byteLength
//         this.type = options.type || 'application/octet-stream'
//         this.lastModified = options.lastModified || Date.now()
//     }
//     arrayBuffer() {
//         return Promise.resolve(this.buffer.buffer)
//     }
//     text() {
//         const decoder = new TextDecoder()
//         return Promise.resolve(decoder.decode(this.buffer))
//     }
//     stream() {
//         return new ReadableStream({
//             start: controller => {
//                 controller.enqueue(this.buffer)
//                 controller.close()
//             }
//         })
//     }
// }
// function sqlToFile(sqlText, filename = 'backup.sql') {
//     return new Blob([sqlText], filename, {
//         type: 'application/sql',
//         lastModified: Date.now()
//     })
// }