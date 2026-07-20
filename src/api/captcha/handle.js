export async function handleGet() {
    try {
        const captchaText = generateRandomText(6) // 生成6位长度的验证码
        // 将验证码文本存入 KV 存储，设置 5 分钟过期时间 (300 秒)
        const svg = generateCaptchaSvg(captchaText)
        // 返回 SVG 图像，并在响应头中带上验证码ID
        return new Response(svg, {
            headers: {
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', // 确保不缓存验证码图片
            },
        })
    } catch (error) {
        throw error
    }
}

// ---------------------- 辅助函数 ----------------------
/**
 * 生成指定长度的随机字符串作为验证码文本
 * @param length 验证码长度
 * @returns 随机字符串
 */
function generateRandomText(length = 6) {
    // 排除容易混淆的字符：'0' (数字零), 'O' (大写字母O), '1' (数字一), 'l' (小写字母L), 'I' (大写字母I)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}
/**
 * 生成随机的十六进制颜色
 * @returns 十六进制颜色字符串，如 '#RRGGBB'
 */
function getRandomColor() {
    const letters = '0123456789ABCDEF'
    let color = '#'
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)]
    }
    return color
}
/**
 * 生成 SVG 验证码图片
 * @param text 验证码文本
 * @returns SVG 字符串
 */
function generateCaptchaSvg(text) {
    const width = 200
    const height = 80
    const padding = 10
    let svgContent = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#f8f8f8"/>
    `
    // 添加一些随机背景干扰线
    for (let i = 0; i < 4; i++) {
        svgContent += `<line
            x1="${Math.random() * width}" y1="${Math.random() * height}"
            x2="${Math.random() * width}" y2="${Math.random() * height}"
            stroke="${getRandomColor()}" stroke-width="${Math.random() * 2 + 0.5}"
            opacity="${Math.random() * 0.5 + 0.2}"
        />`
    }
    // 添加一些随机背景点
    for (let i = 0; i < 20; i++) {
        svgContent += `<circle
            cx="${Math.random() * width}" cy="${Math.random() * height}"
            r="${Math.random() * 1.5 + 0.5}"
            fill="${getRandomColor()}"
            opacity="${Math.random() * 0.6 + 0.2}"
        />`
    }
    // 添加验证码文本，每个字符独立处理
    const charSpacing = (width - padding * 2) / text.length
    for (let i = 0; i < text.length; i++) {
        const char = text[i]
        const x = padding + charSpacing * i + charSpacing / 2 + (Math.random() - 0.5) * 10
        const y = height / 2 + (Math.random() - 0.5) * 15
        const rotation = (Math.random() - 0.5) * 40 // -20 到 +20 度
        const fontSize = 36 + Math.random() * 10 // 36 到 46 px
        const color = getRandomColor()
        svgContent += `
            <text
                x="${x}" y="${y}"
                font-family="monospace, sans-serif"
                font-size="${fontSize}"
                font-weight="bold"
                fill="${color}"
                text-anchor="middle"
                alignment-baseline="middle"
                transform="rotate(${rotation} ${x} ${y})"
            >${char}</text>
        `
    }
    svgContent += '</svg>'
    return svgContent
}

