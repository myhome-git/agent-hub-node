/**
 * AI 代理网关 - 主入口文件
 */
import loadEnvFile from './loadEnvFile.js'
import initGateway from './gateway.js'
import dayjs from 'dayjs'

// ==================== 独立运行模式 ====================
loadEnvFile()
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
    █           • Uptime: ${now}                         █
    █                                                                     █
    █           ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄             █
    █           █ STATUS 200 • Ready for incoming traffic   █             █
    █           ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀             █
    █                                                                     █
    ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
`)

initGateway()