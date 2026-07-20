
import { handleExtendRequestBodyParser } from './handleExtendRequestBodyParser.js';
export async function handleExtendRequest(c) {
    let request = c.request || c.req;
    request.headers = request.raw.headers;
    request = await handleExtendRequestBodyParser(request);
    const obj = { getValues, getValuesPage, getValueByIdToArray, getValueByIdToObject, getValueById };
    Object.keys(obj).forEach(key => {
        request[key] = obj[key];
        c[key] = obj[key];
    });
    c.getValues = function () {
        return this.req.getValues();
    };
    return c;
}

/**
     * 取出全部，一般用作delete的时候传递的数组
     * @returns 
     */
function getValues() {
    console.log(`收到请求数据，方法：${this.method}，地址：${this.url}，参数：`);
    console.log(this.method === "GET" ? this.__query : this.__body);
    return this.method === "GET" ? this.__query : this.__body;
}

// 加入分页处理
function getValuesPage() {
    const values = this.getValues() || {};
    try {
        let { index, size } = values;
        index = Number(index);
        if (Number.isNaN(index)) {
            index = 1;
        }
        size = Number(size);
        if (Number.isNaN(size)) {
            size = 30;
        }
        values.pageIndex = index;
        values.pageSize = size;
        values.pageRowNum = (index - 1) * size;
    } catch (error) {
        throw error;
    }
    return values;
}

// 通用方法，获取请求参数为数组
function getValueByIdToArray(keys, targetObj) {
    let obj = targetObj || this.getValues();
    const result = [];
    keys.map(item => {
        result.push(obj[item]);
    });
    return result;
}

// 通用方法，获取请求参数为对象
function getValueByIdToObject(keys, targetObj) {
    let obj = targetObj || this.getValues();
    const result = {};
    keys.map(item => {
        result[item] = obj[item];
    });
    return result;
}

// 根据key取出body中的value
function getValueById(key) {
    return this.getValues()[key];
}