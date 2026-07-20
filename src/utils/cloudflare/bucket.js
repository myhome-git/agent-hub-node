
// 列出所有对象
export async function listObjects(env) {
    try {
        const listing = await env.MY_BUCKET.list({
            limit: 1000
        })
        const objects = listing.objects.map(obj => ({
            key: obj.key,
            size: obj.size,
            uploaded: obj.uploaded.toISOString(),
            etag: obj.etag,
            httpEtag: obj.httpEtag
        }))
        return new Response(JSON.stringify({
            objects: objects,
            truncated: listing.truncated,
            delimitedPrefixes: listing.delimitedPrefixes
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        })
    }
}
// 获取对象
export async function getObject(env, filename) {
    const objectKey = filename

    if (!objectKey) {
        throw new Error('缺少必要参数')
    }
    try {
        const object = await env.MY_BUCKET.get(objectKey)
        if (object === null) {
            throw new Error('文件不存在')
        }
        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)
        headers.set('Last-Modified', object.uploaded.toUTCString())
        return new Response(object.body, {
            headers,
            status: 200
        })
    } catch (error) {
        throw error
    }
}
// 上传对象
export async function putObject(env, file, filename) {
    const objectKey = filename

    if (!objectKey) {
        throw new Error('缺少必要参数')
    }
    try {
        await env.MY_BUCKET.put(objectKey, file, {
            httpMetadata: {
                contentType: file.type,
                cacheControl: 'public, max-age=3600'
            }
        })
    } catch (error) {
        throw error
    }
}
// 删除对象
export async function deleteObject(env, filename) {
    const objectKey = filename
    if (!objectKey) {
        throw new Error('缺少必要参数')
    }
    try {
        await env.MY_BUCKET.delete(objectKey)
    } catch (error) {
        console.log(error)
    }
}
