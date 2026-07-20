import { Hono } from 'hono'
import { handleGet, handlePut } from './systemconfigHandle.js'

// 创建路由实例
const app = new Hono()

// 处理请求
app.get('/', async(c) => {
    try {
        const result = await handleGet(c)
        return c.sendSuccess(result)
    } catch (error) {
        // console.log(error);
        throw error
    }
})
app.put('/', async(c) => {
    try {
        await handlePut(c)
        return c.sendSuccess()
    } catch (error) {
        return c.sendError(error)
    }
})

export default app
