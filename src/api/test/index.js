import { Hono } from 'hono';

// 创建路由实例
const router = new Hono();

// 处理请求
router.get('/', async (c) => {
    // 获取参数
    const { uuid } = c.getValues();

    // 处理业务逻辑
    return c.sendSuccess({ message: 'Hello from test!', uuid });
});

// 导出路由
export default router;
