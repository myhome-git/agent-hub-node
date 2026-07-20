import { routerIndex } from '../filterRouterIndex.js';
async function handleExtendRouter(app) {

    // 根路由
    app.get('/', (c) => {
        return c.sendSuccess({ message: 'Hello, World!' });
    })

    // 扩展子路由
    Object.keys(routerIndex).forEach(key => {
        const route = routerIndex[key];
        app.route(key, route);
        /**
         * 路由地址反向处理，可以解决访问时加斜杠和不加斜杠的问题
         * 如果不是以斜杠结尾，则添加斜杠，如果是斜杠结尾，则去掉斜杠
         * 处理子路由
         */
        app.route(handleRouteSlash(key), route);
        handleRouteChildrenReg(key, route);
    });

    // 处理路径中的斜杠
    function handleRouteSlash(path) {
        // 将路径转换为字符串
        let refPath = path.toString();
        // 如果路径不以斜杠结尾，则返回路径加上斜杠
        if (!refPath.endsWith('/')) {
            return `${refPath}/`;
        } else {
            // 如果路径以斜杠结尾，则去掉路径末尾的所有斜杠
            refPath = refPath.replace(/\/+$/, "");
        }
        // 返回处理后的路径
        return refPath;
    }

    // 处理路由子节点注册
    function handleRouteChildrenReg(path, route) {
        // 获取子路由数组
        const childrens = route.routes || [];
        if (childrens) {
            // 遍历子路由数组
            childrens.forEach((children) => {
                // 如果子路由地址长度小于等于1，则返回
                if (children.path.toString().length <= 1) {
                    return;
                }
                // 反向处理子路由地址
                const newKey = `${path.replace(/\/+$/, "")}${handleRouteSlash(children.path)}`;
                // 注册子路由
                app[children.method.toLowerCase()](newKey, children.handler);
            });
        }
    }
}
export default handleExtendRouter;