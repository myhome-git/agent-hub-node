export const cloudflare = [
    {
        title: 'KV（键值对）',
        remarks: '键值对存储，适合存储少量数据，如配置信息、系统参数等。',
        content: {
            read: 1000000,
            put: 1000000,
            delete: 1000000
        },
        contentUsed: {
            read: 1000000,
            put: 1000000,
            delete: 1000000
        }
    },
    {
        title: 'D1（数据库Sqlite）',
        remarks: '轻量级数据库，适合存储少量数据，如用户信息、订单信息等。',
        content: {
            read: 1000000,
            put: 1000000,
            delete: 1000000
        },
        contentUsed: {
            read: 1000000,
            put: 1000000,
            delete: 1000000
        }
    },
    {
        title: 'R2（对象存储）',
        remarks: '云存储，适合存储大量数据，如图片、视频、音频等。',
        content: {
            read: 1000000,
            put: 1000000,
            delete: 1000000
        },
        contentUsed: {
            read: 1000000,
            put: 1000000,
            delete: 1000000
        }
    }
]

export const SYSTEM_CONFIG = {
    cloudflare
}
export default SYSTEM_CONFIG