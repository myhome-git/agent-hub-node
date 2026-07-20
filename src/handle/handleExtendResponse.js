import { getType,ObjectType } from "../utils/utils.js";

/**
 * 绑定消息方法，方便调用
 * @param {*} c 
 */
export function handleExtendBindMessage(c) {
    const obj = { sendSuccess, sendWarning, sendError };
    Object.keys(obj).forEach(key => {
        c[key] = obj[key];
    });
    return c;
}

/**
 * 输出成功消息及数据
 */
export function sendSuccess(result) {
    let refResult = {
        status: 200,
        message: "success"
    };
    if (result instanceof Error) {
        return this.sendError(result);
    } else if (getType(result) === ObjectType.Object) {
        refResult = Object.assign(refResult, result);
    } else if (getType(result) === ObjectType.String) {
        refResult = Object.assign(refResult,{
            message: result
        });
    }
    return handleResponse(refResult, this);
};

/**
 * 输出消息-错误
 * 直接返回http500状态
 */
export function sendError(result) {
    let refResult = {
        status: 500,
        message: "error"
    };
    if (result instanceof Error) {
        // console.error(result);
        refResult = Object.assign(refResult, {
            message: result.message || "error"
        });
    } else if (getType(result) === ObjectType.Object) {
        refResult = Object.assign(refResult, result);
    } else if (getType(result) === ObjectType.String) {
        refResult = Object.assign(refResult, {
            message: result
        });
    }
    return handleResponse(refResult, this);
};

/**
 * 输出消息-警告
 * 一般用作返回给下级接口的提示
 */
export function sendWarning(result) {
    let refResult = {
        status: 500,
        message: "warning"
    };
    if (result instanceof Error) {
        return this.sendError(result);
    } else if (getType(result) === ObjectType.Object) {
        refResult = Object.assign(refResult, result);
    }else if (getType(result) === ObjectType.String) {
        refResult = Object.assign(refResult,{
            message: result
        });
    }
    return handleResponse(refResult, this);
};

function handleResponse(result, c) {
    // console.log(`准备返回数据：`,result);
    let text = null
    try {
        text = JSON.stringify(result);
    } catch (error) {
        text = JSON.stringify({ status: 500, message: "JSON格式转换失败" });
    }
    return new Response(text, {
        status: result.status || 200,
        headers: c.refHeaders || {
            'Content-Type': 'application/json; charset=UTF-8'
        }
    });
};
