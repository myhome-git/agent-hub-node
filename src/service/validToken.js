// import { getType, isValidValue, ObjectType } from '@/utils/utils.js';

// 导出一个函数，用于过滤有效用户
export function validToken(c) {
    const session = c.get('session')
    const userId = session.get('userId')
    if (!userId) {
        // session.set('userId', crypto.randomUUID())
        return false
    }
    return true
}

// function getRequestHeaders(c) {
//     return c.req.header();
// }