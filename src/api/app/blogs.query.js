import { Hono } from 'hono'
import ClassDBConnection from '@/utils/db/ClassDBConnection.js'
import { pageHandleBlogsJianShu, pageHandleBlogsReadById, pageHandleBlogClassHot, pageHandleFriendlyLink } from './pageHandle.js'

// 创建路由实例
const router = new Hono()

// 处理请求，获取博客列表，只有标题、简述
router.get('/list/jianshu', async(c) => {
    // 处理业务逻辑
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    try {
        classDBConnection.open()
        const result = await pageHandleBlogsJianShu(c, classDBConnection)
        classDBConnection.close()
        return c.sendSuccess(result)
    } catch (error) {
        classDBConnection.close()
        throw error
    }
})
router.get('/getBlogReadById', async(c) => {
    // 处理业务逻辑
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    try {
        classDBConnection.open()
        const result = await pageHandleBlogsReadById(c, classDBConnection)
        classDBConnection.close()
        return c.sendSuccess(result)
    } catch (error) {
        classDBConnection.close()
        throw error
    }
})
// 获取博客分类列表热门
router.get('/getBlogClassHot', async(c) => {
    // 处理业务逻辑
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    try {
        classDBConnection.open()
        const result = await pageHandleBlogClassHot(c, classDBConnection)
        classDBConnection.close()
        return c.sendSuccess(result)
    } catch (error) {
        classDBConnection.close()
        throw error
    }
})
router.get('/getLink', async(c) => {
    // 处理业务逻辑
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    try {
        classDBConnection.open()
        const result = await pageHandleFriendlyLink(c, classDBConnection)
        classDBConnection.close()
        return c.sendSuccess(result)
    } catch (error) {
        classDBConnection.close()
        throw error
    }
})

// 导出路由
export default router
