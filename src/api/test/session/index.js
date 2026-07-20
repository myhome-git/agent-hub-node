import { Hono } from 'hono'
const app = new Hono()

app.get('/get', async(c) => {
    // 获取参数
    const session = c.get('session')
    const userId = session.get('userId')
    console.log(session)

    // 处理业务逻辑
    return c.sendSuccess({ message: 'Hello from session!', userId })
})

app.get('/set', async(c) => {
    // 获取参数
    const { userId } = c.getValues()
    const session = c.get('session')
    session.set('userId', userId)

    // 处理业务逻辑
    return c.sendSuccess({ message: 'Hello from session', userId: session.get('userId') })
})

app.get('/clear', async(c) => {
    // 获取参数
    const session = c.get('session')
    session.set('userId', null)

    // 处理业务逻辑
    return c.sendSuccess({ message: 'Hello from session', userId: session.get('userId') })
})

export default app
