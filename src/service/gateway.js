import { responseHeader } from '@/config'
import { validToken } from './validToken.js'
import { handleExtendRequest } from './handle/handleExtendRequest'
import { handleExtendBindMessage } from './handle/handleExtendResponse'
import useRouter from './router.js'
import { getCurrentDate } from '@/utils/utils'

export default async function useGateway(app) {
  // 系统入口拦截器
  app.use('*', async(c, next) => {
    console.log(`进入网关：[${getCurrentDate(new Date(), 'YYYY-MM-DD HH:mm:ss')}] ${c.req.method} ${c.req.path}`)

    // 绑定响应处理
    handleExtendBindMessage(c)

    // 处理逻辑
    const url = new URL(c.req.url)
    const { pathname } = url

    if (pathname.startsWith('/api/admin')) {
      // 管理员接口，需要验证token
      const isPass = validToken(c)
      if (!isPass) {
        return new Response(JSON.stringify({ message: '请求被拒绝，授权验证未通过' }), {
          status: 500,
          headers: responseHeader
        })
      }
    }

    // 解析并强化请求体
    await handleExtendRequest(c)

    // 递交给下一个中间件
    await next()
  })

  // 注册路由
  await useRouter(app)

  // 错误处理
  app.onError((error) => {
    console.error(error)
    return new Response(JSON.stringify({
        message: 'Server Error'
    }), {
      status: 500,
      headers: responseHeader
    })
  })

  // 404处理
  app.notFound(() => {
    return new Response(JSON.stringify({ message: 'Not Found' }), {
      status: 404,
      headers: responseHeader
    })
  })
}
