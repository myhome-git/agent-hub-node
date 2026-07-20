export function handleExtendCors(content) {
  content.header('Access-Control-Allow-Origin', '*') // 允许所有域名
  content.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  content.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return content
}
