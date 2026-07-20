// 自定义 ESBuild 插件，用于移除所有文件中的 console 语句
export default {
  name: 'remove-console',
  setup(build) {
    // 处理所有 .js 文件
    build.onLoad({ filter: /\.js$/ }, async (args) => {
      const fs = await import('fs');
      
      // 读取文件内容
      let contents = fs.readFileSync(args.path, 'utf8');
      
      // 移除所有 console.log, console.info, console.warn, console.error 语句
      // 使用更精确的正则表达式来匹配 console 语句
      contents = contents.replace(/console\.(log|info|warn|error)\s*\([^;]*;/g, '');
      
      return {
        contents,
        loader: 'js',
      };
    });
  },
};
