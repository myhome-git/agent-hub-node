/**
 * AI 代理网关 - 主入口文件
 */
import loadEnvFile from './loadEnvFile.js'
import initGateway from './gateway.js'
import dayjs from 'dayjs'

// ==================== 独立运行模式 ====================
const now = dayjs(Date.now()).format('YYYY-MM-DD HH:mm:ss')
console.log(`
    ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
    █                                                                     █
    █                   ▄▄▄▄ ▄▄▄▄▄▄   ▄▄   ▄▄ ▄▄▄▄▄▄                      █
    █                  █      █   ▐█  ▐█ ▐▄█ █ █      █                   █
    █                  █      █   ▐█  ▐█ ▐█ ▐█ █ ▄▄▄▄▄█                   █
    █                  █      █   ▐█  ▐█ █▀▄▀█ █ █                        █
    █                  █▄▄▄▄▄▄█   ▐█▄▄▄█ █   █ █ █▄▄▄▄▄▄                  █
    █                                                                     █
    █           Aent Hub v1.0.0 • High-Performance API Gateway            █
    █           ────────────────────────────────────────────              █
    █           • Uptime: ${now}                             █
    █                                                                     █
    █           ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄             █
    █           █ STATUS 200 • Ready for incoming traffic   █             █
    █           ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀             █
    █                                                                     █
    ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
`)

// 1. 保存原始的 console 方法，防止死循环
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console)
}

// 2. 重写全局 console 对象的方法
const methods = ['log', 'warn', 'error', 'info']
methods.forEach(method => {
    console[method] = (...args) => {
        const time = dayjs(Date.now()).format('YYYY-MM-DD HH:mm:ss')
        const file = getCallerFileName()
        originalConsole[method](`[${time}] [${file}]`, ...args)
    }
})

function getCallerFileName() {
    try {
      const stack = new Error().stack
      if (!stack) return 'Unknown'

      const stackLines = stack.split('\n')
      // Error -> getCallerFileName -> 拦截函数(log/warn等) -> 真正的调用者
      // 所以通常取第 4 行（索引为 3）
      const callerLine = stackLines[3]

      if (!callerLine) return 'Unknown'

      // 匹配常见的文件路径格式，例如 http://.../app.js:10:5 或 /src/utils.js:12
      const match = callerLine.match(/(?:at |@)(?:.*\/)?([^\/\s]+?)(:\d+:\d+)?(?:\s|$)/)

      if (match && match[1]) {
        // 去掉后缀名（例如 .js, .ts, .vue）
        return match[1].replace(/\.[^/.]+$/, '')
      }
      return 'Unknown'
    // eslint-disable-next-line no-unused-vars
    } catch (e) {
      return 'Unknown'
    }
}
loadEnvFile()
initGateway()
