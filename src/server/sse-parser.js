/**
 * SSE Token 解析器
 * 用于从大模型 API 的 SSE 响应中解析 usage 字段
 */

export class SSETokenParser {
    constructor() {
        this.buffer = '';
        this.foundUsage = false;
    }

    /**
     * 处理 SSE 数据块
     * @param {Uint8Array} chunk - 数据块
     * @returns {Object|null} 解析到的 Token 信息
     */
    processChunk(chunk) {
        // 将字节转换为字符串
        this.buffer += new TextDecoder('utf-8').decode(chunk, { stream: true });

        // 按行分割处理
        const lines = this.buffer.split('\n');
        // 保留最后一个可能不完整的行到缓冲区
        this.buffer = lines.pop() || '';

        let tokenInfo = null;

        for (const line of lines) {
            // 跳过空行和注释行
            if (!line || line.startsWith(':')) {
                continue;
            }

            // 处理 SSE 数据行
            if (line.startsWith('data: ')) {
                const data = line.substring(6).trim();

                // SSE 结束标记
                if (data === '[DONE]') {
                    this.foundUsage = true;
                    continue;
                }

                // 尝试解析 JSON
                try {
                    const json = JSON.parse(data);

                    // 检查是否包含 usage 字段
                    if (json.usage && !this.foundUsage) {
                        const { prompt_tokens, completion_tokens, total_tokens } = json.usage;

                        if (prompt_tokens !== undefined || completion_tokens !== undefined) {
                            tokenInfo = {
                                promptTokens: prompt_tokens || 0,
                                completionTokens: completion_tokens || 0,
                                totalTokens: total_tokens || (prompt_tokens || 0) + (completion_tokens || 0),
                            };

                            this.foundUsage = true;
                        }
                    }
                } catch (e) {
                    // JSON 解析失败，忽略
                }
            }
        }

        return tokenInfo;
    }

    /**
     * 处理剩余缓冲区数据
     * @returns {Object|null}
     */
    flush() {
        if (this.buffer.trim()) {
            return this.processChunk(new TextEncoder().encode(this.buffer));
        }
        return null;
    }

    /**
     * 重置解析器状态
     */
    reset() {
        this.buffer = '';
        this.foundUsage = false;
    }
}

export default SSETokenParser;