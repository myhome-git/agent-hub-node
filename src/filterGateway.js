import { filterValidToken } from './filterValidToken.js';
import { handleExtendRequest } from './handle/handleExtendRequest.js';
import { handleExtendBindMessage } from './handle/handleExtendResponse.js';
import handleExtendRouter from './handle/handleExtendRouter.js';

async function filterGateway(app) {
    const refHeaders = {
        'Content-Type': 'application/json; charset=UTF-8',
        'test-date': Date.now().toString(),
    };

    // 系统入口拦截器
    app.use('*', async (c, next) => {
        console.log(`进入网关过滤器：[${new Date().toISOString()}] ${c.req.method} ${c.req.path}`);

        // 保存返回头格式
        c.refHeaders = refHeaders;

        // 绑定响应处理
        handleExtendBindMessage(c);

        // 处理逻辑
        const url = new URL(c.req.url);
        const { pathname } = url;

        if (pathname.startsWith('/api/admin')) {
            // 管理员接口，需要验证token
            const isPass = await filterValidToken(c);
            if (!isPass) {
                return c.sendError({
                    message: `请求被拒绝，授权验证未通过。`,
                    status: 401,
                });
            }
        }
        // 解析并强化请求体
        await handleExtendRequest(c);

        // 递交给下一个中间件
        await next();
        // 自动发送响应
        if (!c.res) {
            return new Response(JSON.stringify({
                message: `is not send response`,
                status: 500,
            }), {
                status: 500,
                headers: refHeaders
            })
        }
    })

    // 注册路由
    await handleExtendRouter(app);

    // 错误处理
    app.onError((err, c) => {
        console.error(`网关拦截器报错`, err);
        return new Response(JSON.stringify({ message: 'Server Error', status: 500 }), {
            status: 500,
            headers: c.refHeaders
        });
    })

    // 404处理
    app.notFound((c) => {
        return c.sendError({ message: 'Not Found', status: 404 });
    });
}
export default filterGateway;