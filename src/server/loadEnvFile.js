/**
 * 网关配置文件
 * 支持从 .env.dev 文件加载环境变量
 */

import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 计算项目根目录（src/server 的上一级）
const projectRoot = resolve(__dirname, '../..')

/**
 * 加载 .env.dev 文件
 */
function loadEnvFile() {
    const envPath = join(projectRoot, '.env.dev')

    if (fs.existsSync(envPath)) {
        try {
            const envContent = fs.readFileSync(envPath, 'utf-8')
            const lines = envContent.split('\n')

            for (const line of lines) {
                const trimmedLine = line.trim()

                // 跳过空行和注释
                if (!trimmedLine || trimmedLine.startsWith('#')) {
                    continue
                }

                // 解析 KEY=VALUE 格式
                const equalIndex = trimmedLine.indexOf('=')
                if (equalIndex > 0) {
                    const key = trimmedLine.substring(0, equalIndex).trim()
                    let value = trimmedLine.substring(equalIndex + 1).trim()

                    // 移除引号
                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith('\'') && value.endsWith('\''))) {
                        value = value.slice(1, -1)
                    }

                    // 仅当环境变量未设置时才设置
                    if (!(key in process.env)) {
                        process.env[key] = value
                    }
                }
            }

            console.log('[Config] 已加载环境变量文件: .env.dev')
        } catch (error) {
            console.warn(`[Config] 加载 .env.dev 失败: ${error.message}`)
        }
    } else {
        console.error('[Config] 未找到 .env.dev 文件，使用默认配置')
    }
}

export default loadEnvFile