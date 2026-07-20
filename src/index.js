import { Hono } from 'hono';
import { cors } from 'hono/cors';
import filterGateway from './filterGateway.js';

// 应用开始
const app = new Hono();

// 注册网关
await filterGateway(app);

// 导出应用
export default app
