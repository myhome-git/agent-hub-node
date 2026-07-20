import { Hono } from 'hono'
import { cors } from 'hono/cors'
// @ts-nocheck
import { corsSwitch } from '@/config'
import useGateway from './gateway'
import { useSession } from './useSession'

// 引入时间处理插件
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
dayjs.locale('zh-cn') // 全局使用中文语言环境

export default function(){
    // 应用开始
    const app = new Hono()

    // 如果开启了跨域，则使用cors中间件
    if (corsSwitch) {
        app.use('*', cors({ origin: '*' }))
    }
    useSession(app)
    useGateway(app)
    return app
}

