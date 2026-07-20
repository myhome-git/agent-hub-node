import { getType } from '@/utils/utils.js'
import { responseHeader } from '@/config'

/**
 * 绑定消息方法，方便调用
 * @param {*} c
 */
export function handleExtendBindMessage(c) {
    const obj = { sendSuccess, sendError }
    Object.keys(obj).forEach(key => {
        c[key] = obj[key]
    })
    return c
}

/**
 * 输出成功消息及数据
 */
export function sendSuccess(result) {
    const res = { message: 'success' }
    if (result instanceof Error) {
        return this.sendError(result)
    } else if (getType(result) === 'Object') {
        Object.assign(res, result)
    } else if (getType(result) === 'String') {
        Object.assign(res, { message: result })
    }
    return handleResponse(res, 200)
}

/**
 * 输出消息-错误
 * 直接返回http500状态
 */
export function sendError(result) {
    const res = { message: 'error' }
    if (result instanceof Error) {
        Object.assign(res, { message: result.message })
    } else if (getType(result) === 'Object') {
        Object.assign(res, result)
    } else if (getType(result) === 'String') {
        Object.assign(res, { message: result })
    }
    return handleResponse(res, 500)
}

function handleResponse(result, code) {
    try {
        return new Response(JSON.stringify(result), {
            status: code,
            headers: responseHeader
        })
    } catch (error) {
        return new Response({ ...error, message: 'JSON格式转换失败' }, {
            status: 500,
            headers: responseHeader
        })
    }
}
