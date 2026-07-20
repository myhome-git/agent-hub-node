import { Hono } from 'hono'
import ClassDBConnection from '../../utils/db/ClassDBConnection.js'
import { pageHandleNav, pageHandleBlogsJianShu, pageHandleBlogClassHot, pageHandleFriendlyLink } from './pageHandle.js'

// 创建路由实例
const router = new Hono()

// 处理请求，获取博客列表，只有标题、简述
router.get('/', async(c) => {
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    let result
    try {
        classDBConnection.open()
        /**
         * 业务开始
         */

        // 顶部导航
        const resultNav = await pageHandleNav(c, classDBConnection)
        //简述
        const resultJianShu = await pageHandleBlogsJianShu(c, classDBConnection)
        // 分类热门
        const resultBlogClassHot = await pageHandleBlogClassHot(c, classDBConnection)
        // 友情链接
        const resultFriendlyLink = await pageHandleFriendlyLink(c, classDBConnection)

        result = {
            resultNav: resultNav,
            resultJianShu: resultJianShu,
            resultBlogClassHot: resultBlogClassHot,
            resultFriendlyLink: resultFriendlyLink,
        }
        /**
         * 业务结束
         */
        classDBConnection.close()
        return c.sendSuccess(result)
    } catch (error) {
        // console.log(error);
        classDBConnection.close()
        throw error
    }
})

// 导出路由
export default router
