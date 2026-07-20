import { defineConfig } from 'vite';
import path from 'path';

// 根据环境变量决定是否加载插件
const isDev = process.env.NODE_ENV === 'development';
console.log(`当前环境变量：${process.env.NODE_ENV}`);

export default defineConfig({
  plugins: [],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // 将 @ 指向 src 目录
    },
  },
  build: {
    minify: 'esbuild',   // 压缩
    outDir: 'dist', // 确保输出在 dist 目录
    emptyOutDir: true, // 每次构建前清空 dist 目录
    // Vite 默认输出格式就是 ESM，且完美支持顶层 await
    rollupOptions: {
      input: './src/index.js', // 指定入口文件
      output: {
        entryFileNames: 'index.js',
        // 关闭代码分割，将所有依赖打包进同一个文件中
        manualChunks: undefined, 
      }
    }
  },
  esbuild: {
    drop: isDev ? [] : ['console', 'debugger'],
  },
  // 对应你之前的 define 环境变量
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  }
});