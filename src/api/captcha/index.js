import { Hono } from 'hono'
import { handleGet } from './handle.js'

// 创建路由实例
const app = new Hono()

// 处理请求
app.get('/', async(c) => {
    try {
        const result = await handleGet(c)
        return result
    } catch (error) {
        // console.log(error);
        throw error
    }
})

// 导出路由
export default app
