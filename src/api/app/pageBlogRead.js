import { Hono } from 'hono'
import ClassDBConnection from '@/utils/db/ClassDBConnection.js'
import { pageHandleNav, pageHandleBlogClassHot, pageHandleFriendlyLink } from './pageHandle.js'

// 创建路由实例
const router = new Hono()

// 处理请求，获取博客列表，只有标题、简述
router.get('/', async(c) => {
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    try {
        classDBConnection.open()
        /**
         * 业务开始
         */

        // 顶部导航
        const resultNav = await pageHandleNav(c, classDBConnection)
        //简述
        const pageHandleBlogsReadById = await pageHandleBlogsReadById(c, classDBConnection)
        // 分类热门
        const resultBlogClassHot = await pageHandleBlogClassHot(c, classDBConnection)
        // 友情链接
        const resultFriendlyLink = await pageHandleFriendlyLink(c, classDBConnection)

        const result = {
            resultNav: resultNav,
            pageHandleBlogsReadById: pageHandleBlogsReadById,
            resultBlogClassHot: resultBlogClassHot,
            resultFriendlyLink: resultFriendlyLink,
        }
        /**
         * 业务结束
         */
        classDBConnection.close()
        return c.sendSuccess(result)
    } catch (error) {
        classDBConnection.close()
        throw error
    }
})

// 导出路由
export default router
