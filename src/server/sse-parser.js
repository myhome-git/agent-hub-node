/**
 * SSE 内容提取器 (重构版)
 * 职责：从大模型 API 的 SSE 响应中可靠提取文本片段（Content & Reasoning）
 * 配合外部 Token 统计器使用
 */
export class SSETokenParser {
    constructor() {
        this.buffer = '' // 原始字符串缓冲区
        this.isDone = false // 标记流是否结束
    }

    /**
     * 处理网络流数据块
     * @returns {Array<Object>} 始终返回一维数组，例如 [{type: 'text', text: '...'}]
     */
    processChunk(chunk) {
        if (this.isDone) return []

        // 1. 解码并追加缓冲区
        const textChunk = typeof chunk === 'string' ? chunk : new TextDecoder('utf-8').decode(chunk, { stream: true })
        this.buffer += textChunk

        // 2. 按行分割
        const lines = this.buffer.split(/\r\n|\n|\r/)
        this.buffer = lines.pop() || '' // 保留未完成的行

        const extractedItems = [] // 【关键】在当前批次内初始化一个扁平数组
        for (const line of lines) {
            if (!line.trim() || line.startsWith(':')) continue
            if (line.includes('[DONE]')) {
                this.isDone = true
                continue
            }

            if (line.startsWith('data: ')) {
                try {
                    const json = JSON.parse(line.substring(6))

                    // 提取 reasoning_content
                    if (json.choices?.[0]?.delta?.reasoning_content) {
                        extractedItems.push({
                            type: 'reasoning',
                            text: json.choices[0].delta.reasoning_content
                        })
                    }

                    // 提取 content
                    if (json.choices?.[0]?.delta?.content) {
                        extractedItems.push({
                            type: 'content',
                            text: json.choices[0].delta.content
                        })
                    }
                // eslint-disable-next-line no-unused-vars
                } catch (e) {
                    // 忽略解析错误
                }
            }
        }

        // 【关键】直接返回这个一维数组，不要在外面再包一层 []
        return extractedItems
    }

    /**
     * 从 JSON 对象中提取文本
     * @private
     */
    extractTextFromDelta(json) {
        // 兼容 OpenAI / Qwen / DeepSeek 结构
        // 结构通常是: { choices: [ { delta: { content: "...", reasoning_content: "..." } } ] }
        const choice = json.choices?.[0]
        if (!choice || !choice.delta) return null

        const delta = choice.delta
        const results = []

        // 提取普通回复内容
        if (delta.content) {
            results.push({
                type: 'content',
                text: delta.content
            })
        }

        // 提取推理/思考内容 (Qwen/DeepSeek 特有)
        if (delta.reasoning_content) {
            results.push({
                type: 'reasoning',
                text: delta.reasoning_content
            })
        }

        // 如果该层没有 choices，尝试直接查找 (部分非标准 API)
        if (results.length === 0 && delta.text) {
             return { type: 'content', text: delta.text }
        }

        return results.length > 0 ? results : null
    }

    /**
     * 强制刷新剩余缓冲区
     */
    flush() {
        if (!this.buffer.trim()) return []
        // 模拟一个换行符触发最后一次解析
        return this.processChunk('\n')
    }

    /**
     * 重置状态
     */
    reset() {
        this.buffer = ''
        this.isDone = false
    }
}

export default SSETokenParser