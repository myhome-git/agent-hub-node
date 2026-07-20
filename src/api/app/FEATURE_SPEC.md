# Agent Hub 模块功能提示词

## 模块概述

Agent Hub 是一个 AI Agent 管理和交互平台，提供 Agent 的增删改查、状态管理、在线对话等功能。

---

## API 接口清单

### 基础路径
```
/api/app/agent-hub
```

---

### 1. 获取 Agent 列表
**接口**: `GET /list`

**功能**: 获取 Agent 列表，支持分页和筛选

**请求参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页数量 |
| category | string | 分类筛选 |
| keyword | string | 搜索关键词 |
| status | string | 状态筛选（enabled/disabled） |

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "list": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 2. 获取 Agent 详情
**接口**: `GET /detail/:id`

**功能**: 获取指定 Agent 的详细信息

**路径参数**:
- `id`: Agent ID

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "id": "agent_001",
    "name": "智能助手",
    "description": "一个智能客服助手",
    "category": "客服",
    "status": "enabled",
    "config": {...},
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### 3. 创建 Agent
**接口**: `POST /create`

**功能**: 创建新的 Agent

**请求体**:
```json
{
  "name": "新Agent",
  "description": "Agent描述",
  "category": "分类",
  "config": {...}
}
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "id": "agent_002",
    "name": "新Agent",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### 4. 更新 Agent
**接口**: `POST /update/:id`

**功能**: 更新指定 Agent 的信息

**路径参数**:
- `id`: Agent ID

**请求体**:
```json
{
  "name": "更新后的名称",
  "description": "更新后的描述",
  "category": "新分类",
  "config": {...}
}
```

---

### 5. 删除 Agent
**接口**: `POST /delete/:id`

**功能**: 删除指定 Agent

**路径参数**:
- `id`: Agent ID

**响应示例**:
```json
{
  "code": 200,
  "message": "删除成功"
}
```

---

### 6. 切换 Agent 状态
**接口**: `POST /toggle-status/:id`

**功能**: 启用/禁用 Agent

**路径参数**:
- `id`: Agent ID

**请求体**:
```json
{
  "enabled": true  // true=启用, false=禁用
}
```

---

### 7. 发送对话消息
**接口**: `POST /chat/:agentId`

**功能**: 向指定 Agent 发送消息并获取回复

**路径参数**:
- `agentId`: Agent ID

**请求体**:
```json
{
  "message": "用户发送的消息内容",
  "sessionId": "会话ID（可选）"
}
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "reply": "Agent的回复内容",
    "sessionId": "会话ID",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

---

### 8. 获取对话历史
**接口**: `GET /chat-history/:agentId`

**功能**: 获取指定 Agent 的对话历史记录

**路径参数**:
- `agentId`: Agent ID

**请求参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| sessionId | string | 会话ID |
| page | number | 页码 |
| pageSize | number | 每页数量 |

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "messages": [
      {
        "role": "user",
        "content": "用户消息",
        "timestamp": "..."
      },
      {
        "role": "assistant",
        "content": "Agent回复",
        "timestamp": "..."
      }
    ],
    "total": 50
  }
}
```

---

### 9. 搜索 Agent
**接口**: `GET /search`

**功能**: 根据关键词搜索 Agent

**请求参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| keyword | string | 搜索关键词 |
| category | string | 分类筛选 |
| page | number | 页码 |
| pageSize | number | 每页数量 |

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "list": [...],
    "total": 10
  }
}
```

---

### 10. 获取分类列表
**接口**: `GET /categories`

**功能**: 获取所有 Agent 分类

**响应示例**:
```json
{
  "code": 200,
  "data": [
    { "id": "cat_001", "name": "客服", "count": 10 },
    { "id": "cat_002", "name": "销售", "count": 5 },
    { "id": "cat_003", "name": "技术支持", "count": 8 }
  ]
}
```

---

## 前端功能模块

### 1. Agent 列表页
- [x] 分页列表展示
- [x] 搜索功能
- [x] 分类筛选
- [x] 状态切换（启用/禁用）
- [x] 查看详情
- [x] 编辑功能
- [x] 删除功能

### 2. Agent 详情页
- [x] 基本信息展示
- [x] 配置信息展示
- [x] 创建/更新时间

### 3. Agent 创建/编辑页
- [x] 表单输入
- [x] 验证规则
- [x] 保存功能

### 4. 对话功能
- [x] 消息发送
- [x] 实时回复
- [x] 对话历史
- [x] 会话管理

---

## 数据字段说明

### Agent 对象结构
```typescript
interface Agent {
  id: string;              // Agent ID
  name: string;            // Agent 名称
  description: string;     // Agent 描述
  category: string;        // 分类
  status: 'enabled' | 'disabled';  // 状态
  config: object;          // 配置信息
  avatar?: string;         // 头像 URL
  createdAt: string;       // 创建时间
  updatedAt: string;       // 更新时间
}
```

---

## 错误处理

### 统一错误码
| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

### 错误响应示例
```json
{
  "code": 400,
  "message": "参数错误：名称不能为空"
}
```

---

## 使用示例

### 1. 获取 Agent 列表
```javascript
import { getAgentList } from './api';

getAgentList({ page: 1, pageSize: 20, category: '客服' })
  .then(res => {
    console.log(res.data);
  });
```

### 2. 发送对话消息
```javascript
import { sendAgentMessage } from './api';

sendAgentMessage('agent_001', { message: '你好' })
  .then(res => {
    console.log(res.data.reply);
  });
```

### 3. 切换 Agent 状态
```javascript
import { toggleAgentStatus } from './api';

toggleAgentStatus('agent_001', false)
  .then(res => {
    console.log('状态已更新');
  });
```

---

## 注意事项

1. 所有 API 请求都通过 `request` 工具封装，自动处理 token 和错误
2. 分页默认使用 `SystemConfig.page` 的配置
3. 对话功能支持多会话管理
4. 删除操作不可恢复，需要二次确认
5. 状态切换是即时生效的