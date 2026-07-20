/**
 * 整个项目入口文件
 * 使用 nodemon 启动 Gateway 服务（自动重启）
 * nodemon 会监听 src/server/**
 */

import { spawn } from 'child_process'
/**
 * 创建子进程并包装输出
 * @param {string} command - 命令
 * @param {string[]} args - 参数数组
 * @param {string} name - 进程名称（用于日志）
 * @returns {ChildProcess}
 */
function createProcess(command, args, name) {
    const commandStr = `${command} ${args.join(' ')}`
    console.log(`[Manager] 启动 ${name}: ${commandStr}`)

    const child = spawn(command, args, {
        stdio: 'inherit', // 继承标准输入/输出
        env: { ...process.env }, // 继承环境变量
        cwd: process.cwd(), // 使用当前工作目录
    })

    // 监听进程退出
    child.on('exit', (code, signal) => {
        if (code !== 0) {
            console.error(`[Manager] ${name} 异常退出，代码: ${code}, 信号: ${signal}`)
        } else {
            console.log(`[Manager] ${name} 正常退出，代码: ${code}`)
        }
    })

    // 监听错误
    child.on('error', (err) => {
        console.error(`[Manager] ${name} 启动失败:`, err.message)
    })

    return child
}

/**
 * 优雅关闭所有子进程
 * @param {Map<string, ChildProcess>} processes - 进程映射
 */
function gracefulShutdown(processes) {
    console.log('\n[Manager] 收到关闭信号，正在关闭所有服务...')

    for (const [name, child] of processes.entries()) {
        if (!child.killed) {
            console.log(`[Manager] 发送 SIGINT 到 ${name}...`)
            child.kill('SIGINT')
        }
    }

    // 如果子进程没有在合理时间内退出，强制终止
    setTimeout(() => {
        for (const [name, child] of processes.entries()) {
            if (!child.killed) {
                console.log(`[Manager] ${name} 未响应，强制终止...`)
                child.kill('SIGKILL')
            }
        }
        process.exit(0)
    }, 5000)
}

/**
 * 主入口函数
 */
function main() {
    console.log('='.repeat(60))
    console.log('  Agent Hub Node - 项目启动管理器')
    console.log('='.repeat(60))
    console.log()

    const processes = new Map()

    // ==================== 启动 Gateway 服务 ====================
    // 使用 nodemon 启动 Gateway 服务（通过 npm run dev 启动 nodemon）
    const gatewayProcess = createProcess('npm', ['run', 'dev'], 'Gateway (后端服务)')
    processes.set('Gateway', gatewayProcess)

    // ==================== 监听子进程信号 ====================

    // 当任一子进程退出时，关闭其他进程
    for (const [name, child] of processes.entries()) {
        child.on('exit', (code, signal) => {
            if (code !== 0 || signal) {
                console.log(`[Manager] ${name} 退出，关闭其他服务...`)
                for (const [otherName, otherChild] of processes.entries()) {
                    if (otherName !== name && !otherChild.killed) {
                        console.log(`[Manager] 关闭 ${otherName}...`)
                        otherChild.kill('SIGINT')
                    }
                }
            }
        })
    }

    // ==================== 优雅关闭 ====================

    process.on('SIGINT', () => gracefulShutdown(processes))
    process.on('SIGTERM', () => gracefulShutdown(processes))
}

// 启动管理器
main()