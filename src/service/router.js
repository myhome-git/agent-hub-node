import fs from 'fs'
import path from 'path'
import { Hono } from 'hono'

// 路由功能
export default async function useRouter(app) {

    // 根路由
    app.get('/', (c) => {
        return c.sendSuccess({ message: 'Hello, World!' })
    })

    // 如果需要启用目录扫描功能
    const dbPath = path.resolve(process.cwd(), process.env.ROUTER_PATH)
    const dynamicRoutes = await loadRoutesFromDirectory(dbPath)
    // console.log(`遍历出的动态路由`, dynamicRoutes)

    // 扩展子路由
    Object.keys(dynamicRoutes).forEach(key => {
        const route = dynamicRoutes[key]
        app.route(key, route)
        /**
         * 路由地址反向处理，可以解决访问时加斜杠和不加斜杠的问题
         * 如果不是以斜杠结尾，则添加斜杠，如果是斜杠结尾，则去掉斜杠
         * 处理子路由
         */
        app.route(handleRouteSlash(key), route)
        handleRouteChildrenReg(key, route)
    })

    // 处理路由子节点注册
    function handleRouteChildrenReg(path, route) {
        // 获取子路由数组
        const childrens = route.routes || []
        if (childrens) {
            // 遍历子路由数组
            childrens.forEach((children) => {
                // 如果子路由地址长度小于等于1，则返回
                if (children.path.toString().length <= 1) {
                    return
                }
                // 反向处理子路由地址
                const newKey = `${path.replace(/\/+$/, '')}${handleRouteSlash(children.path)}`
                // 注册子路由
                app[children.method.toLowerCase()](newKey, children.handler)
            })
        }
    }
}

/**
 * 处理路径中的斜杠
 * @param {*} path
 * @returns
 */
function handleRouteSlash(path) {
    // 将路径转换为字符串
    let refPath = path.toString()
    // 如果路径不以斜杠结尾，则返回路径加上斜杠
    if (!refPath.endsWith('/')) {
        return `${refPath}/`
    } else {
        // 如果路径以斜杠结尾，则去掉路径末尾的所有斜杠
        refPath = refPath.replace(/\/+$/, '')
    }
    // 返回处理后的路径
    return refPath
}
/**
 * 遍历目录下的所有js和ts文件，并且将对象加入routerPath中
 * @param {*} directory
 * @returns
 */
async function loadRoutesFromDirectory(directory) {
  const routes = {}

  async function walkDir(dir) {
    const files = fs.readdirSync(dir)

    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        await walkDir(filePath)
      } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.ts'))) {
        // 计算相对于src/api的路径
        const relativePath = path.relative(path.join(directory, '..'), filePath)
        // 移除文件扩展名
        const routePath = relativePath.replace(/\.(js|ts)$/, '')
        // 转换为路由格式
        let route = `/${routePath.replace(/\\/g, '/')}`
        if (route === '') {
          route = '/' // 根路径特殊情况
        }
        // 处理以/index结尾的路径
        if (route.endsWith('/index')) {
          route = route.substring(0, route.length - '/index'.length) // 移除'/index'
        }
        // 异步方式加载模块
        try {
          // 使用动态导入支持ES模块
          const module = await import(filePath)
          if(module instanceof Hono){
            if(routes[route]){
              console.error(`发现重复路由：${route}`)
            }
            routes[route] = module
          } else if(module.default && module.default instanceof Hono) {
            if(routes[route]){
              console.error(`发现重复路由：${route}`)
            }
            routes[route] = module.default
          }
        } catch (err) {
          console.error(err)
        }
      }
    }
  }

  await walkDir(directory)
  // console.log(routesPath)
  return routes
}