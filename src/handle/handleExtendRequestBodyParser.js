
import { getType,ObjectType } from '../utils/utils.js';
export async function handleExtendRequestBodyParser(request) {
    // console.log('进入bodyParser-header',request.raw.headers);
    const contentType = request.header('content-type') || '';
    let params = {};

    // 解析URL查询参数（兼容GET）
    const urlParams = new URL(request.url).searchParams;
    urlParams.forEach((value, key) => {
        params[key] = value;
    });

    // 解析Body参数（非GET请求）
    if (request.method !== 'GET') {
        if (contentType.includes('application/json')) {
            const data = await request.json();
            if(data){
                if(getType(data) === ObjectType.Array){
                    params = data;
                } else if (getType(data) === ObjectType.Object) {
                    params = { ...params, ...data };
                }
            }
        } else if (contentType.includes('form-data')) {
            const formData = await request.formData();
            for (const [key, value] of formData.entries()) {
                params[key] = value;
            }
        } else if (contentType.includes('x-www-form-urlencoded')) {
            const text = await request.text();
            new URLSearchParams(text).forEach((value, key) => {
                params[key] = value;
            });
        }
        request.__body = params;
    }else{
        request.__query = params;
    }
    return request;
}