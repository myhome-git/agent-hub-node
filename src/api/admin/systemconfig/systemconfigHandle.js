import SYSTEM_CONFIG from './config.js'
import { isValidValue, getType } from '@/utils/utils.js'

export async function handleGet(c) {
    try {
        let result = await c.env.KV_MYBLOG.get('SYSTEM_CONFIG')
        return {
            result: result || SYSTEM_CONFIG
        }
    } catch (error) {
        throw error
    }
}

export async function handlePut(c) {
    try {
        const values = c.getValues()
        if (!isValidValue(values)) {
            throw new Error('Invalid values')
        }
        if (getType(values) !== 'Object') {
            throw new Error('Invalid values')
        }
        await c.env.KV_MYBLOG.put('SYSTEM_CONFIG', values)
    } catch (error) {
        throw error
    }
}