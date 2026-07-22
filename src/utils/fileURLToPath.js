import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
/**
 * 获得根目录
 * @returns
 */
export function getRootPath(){
    return resolve(getSrcPath(), '..')
}

/**
 * 获得src目录
 * @returns
 */
export function getSrcPath(){
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    return resolve(__dirname, '..')
}