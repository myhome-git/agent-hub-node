import { Hono } from 'hono'
import ClassDBConnection from '@/utils/db/ClassDBConnection.js'
import { handleBlogClassTotal, handleBlogTotal, handleNotepadTotal, handleLinkTotal, handleBlogAddDateCount, handleBlogClassCount } from './pageWelcomeHandle.js'
// 创建路由实例
const app = new Hono()

// 处理请求，获取博客列表，只有标题、简述
app.get('/', async(c) => {
    const classDBConnection = new ClassDBConnection()
    classDBConnection.init(c.env)
    let result
    try {
        classDBConnection.open()
        /**
         * 业务开始
         */
        const blogClassTotal = await handleBlogClassTotal(c, classDBConnection)
        const blogTotal = await handleBlogTotal(c, classDBConnection)
        const notepadTotal = await handleNotepadTotal(c, classDBConnection)
        const linkTotal = await handleLinkTotal(c, classDBConnection)
        const blogAddDateCount = await handleBlogAddDateCount(c, classDBConnection)
        const blogClassCount = await handleBlogClassCount(c, classDBConnection)

        result = {
            blogClassTotal: blogClassTotal,
            blogTotal: blogTotal,
            notepadTotal: notepadTotal,
            linkTotal: linkTotal,
            blogAddDateCount: blogAddDateCount,
            blogClassCount: blogClassCount
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

export default app
