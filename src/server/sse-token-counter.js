// TokenCounter.js
import { encoding_for_model } from '@dqbd/tiktoken' // 推荐使用 tiktoken

export class TokenCounter {
    constructor(model = 'gpt-3.5-turbo') {
        this.encoder = encoding_for_model(model)
        this.model = null
        this.bytesIn = 0
        this.bytesOut = 0
        this.promptTokens = 0
        this.completionTokens = 0
        this.reasoningTokens = 0 // 单独统计思考过程的 Token
    }

    /**
     * 增量添加文本并统计
     * @param {string} text - 新收到的文本片段
     * @param {string} type - 'reasoning' | 'content'
     */
    add(text, type) {
        if (!text) return

        try {
            // 计算当前片段的 token 数
            const tokens = this.encoder.encode(text).length
            switch (type) {
                case 'prompt':
                    this.promptTokens += tokens
                    break
                case 'reasoning':
                    this.reasoningTokens += tokens
                    break
                default:
                    // 默认为 content
                    this.completionTokens += tokens
                    break
            }
        } catch (e) {
            console.error('Token 计算出错:', e)
        }
    }
    addBytesLen(text, direction){
        if (!text) return
        switch (direction) {
                case 'in':
                    this.bytesIn += text.length
                    break
                case 'out':
                    this.bytesOut += text.length
                    break
                default:
                    break
            }
    }
    setAttr(key, value){
        this[key] = value
    }
    addModel(value){
        this.model = value
    }

    get currentTotal() {
        return this.promptTokens + this.completionTokens + this.reasoningTokens
    }

    getFinalStats() {
        return {
            model: this.model,
            bytesIn: this.bytesIn,
            bytesOut: this.bytesOut,
            prompt: this.promptTokens,
            completion: this.completionTokens,
            reasoning: this.reasoningTokens,
            total: this.currentTotal
        }
    }

    resetValue(key, value){
        this[key] = value
        return value
    }
}
export default TokenCounter