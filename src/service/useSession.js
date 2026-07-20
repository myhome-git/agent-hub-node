import { sessionMiddleware, CookieStore } from 'hono-sessions'

// 创建一个持久的会话存储实例
const store = new CookieStore()
export function useSession(app) {
    app.use('*', sessionMiddleware({
        store,
        // 加密密钥，用于加密存储在Cookie中的会话数据
        // 对于CookieStore是必需的，其他存储方式推荐使用
        encryptionKey: crypto.randomUUID(), // Required for CookieStore, recommended for others.
        // 会话过期时间（秒），此处设置为15分钟无活动后过期
        expireAfterSeconds: 900, // Expire session after 15 minutes of inactivity
        // 自动延长过期时间，当用户活跃时自动更新会话有效期
        autoExtendExpiration: true, // Extend the session expiration time automatically. Defaults to true
        cookieOptions: {
            // SameSite属性设置为Lax，提供基本的CSRF保护
            sameSite: 'Lax',
            // Cookie的有效路径，必须设置为'/'以确保库正常工作
            path: '/',
            // 设置HttpOnly标志，防止客户端脚本访问Cookie，提高XSS防护
            httpOnly: true
        },
    }))
}

export default useSession