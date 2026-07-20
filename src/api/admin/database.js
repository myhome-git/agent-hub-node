import { Hono } from 'hono'
import ClassDBConnection from '../../utils/db/ClassDBConnection.js'
import { handleGet, handlePost, handlePostVacuum, handleDelete, handleDeleteMultiple } from './databaseHandle.js'

// 创建路由实例
const router = new Hono()

// 处理请求
router.get('/', async(c) => {
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    classDBConnection.open()
    try {
        const result = await handleGet(c, classDBConnection)
        classDBConnection.close()
        return c.sendSuccess(result)
    } catch (error) {
        // console.log(error);
        classDBConnection.close()
        throw error
    }
})
router.post('/', async(c) => {
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    classDBConnection.open()
    try {
        await handlePost(c, classDBConnection)
        classDBConnection.close()
        return c.sendSuccess()
    } catch (error) {
        classDBConnection.close()
        return c.sendError(error)
    }
})
// 空间回收
router.post('/Vacuum', async(c) => {
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    classDBConnection.open()
    try {
        await handlePostVacuum(c, classDBConnection)
        classDBConnection.close()
        return c.sendSuccess()
    } catch (error) {
        classDBConnection.close()
        return c.sendError(error)
    }
})
router.delete('/', async(c) => {
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    classDBConnection.open()
    try {
        await handleDelete(c, classDBConnection)
        classDBConnection.close()
        return c.sendSuccess()
    } catch (error) {
        classDBConnection.close()
        throw error
    }
})
router.delete('/multiple', async(c) => {
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    classDBConnection.open()
    try {
        await handleDeleteMultiple(c, classDBConnection)
        classDBConnection.close()
        return c.sendSuccess()
    } catch (error) {
        classDBConnection.close()
        throw error
    }
})

// 导出路由
export default router
