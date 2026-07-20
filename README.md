# Cloudflare Worker 项目配置说明

## 配置文件说明

本项目使用 `wrangler.jsonc` 作为配置文件，实现了以下功能：

1. 代码压缩（minify）
2. dev 和 deploy 环境变量配置

## 配置详情

### 代码压缩

```json
{
  "minify": true
}
```

### 环境变量配置

```json
{
  "vars": {
    "ENVIRONMENT": "development"
  },
  "env": {
    "deploy": {
      "vars": {
        "ENVIRONMENT": "production"
      }
    }
  }
}
```

## 使用说明

### 开发环境

运行以下命令启动开发服务器：

```bash
npx wrangler dev
```

在开发环境中，`ENVIRONMENT` 变量被设置为 `development`。

### 构建项目

运行以下命令构建项目：

```bash
npm run build
```

构建过程会自动移除所有文件中的 console 语句，包括：
1. `src` 目录下自己代码中的 console 语句
2. 第三方库中的 console 语句

然后生成优化后的代码。生成的代码位于 `dist/index.js` 文件中。

这种方法的优点是：
1. 不修改 `src` 目录下的原始代码
2. 移除所有代码中的 console 语句，包括第三方库
3. 通过构建过程自动完成，无需手动修改

### 部署环境

运行以下命令部署到生产环境：

```bash
npx wrangler deploy --env deploy
```

在部署过程中，Wrangler 会自动执行以下步骤：
1. 运行 `npm run build` 命令构建项目
2. 构建过程会自动移除 `src` 目录下所有文件中的 console 语句
3. 使用生成的 `dist/index.js` 文件进行部署

在部署环境中，`ENVIRONMENT` 变量被设置为 `production`。

## 注意事项

1. 代码压缩通过 `minify` 选项实现。
