# Agent Hub API 接口文档

## 概述

本文档描述了 Agent Hub 系统的所有 API 接口。

**基础路径**: `/api/app/agent-hub`

**数据格式**: JSON

**响应格式**:
```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

---

## 一、Agent 管理接口

### 1.1 获取 Agent 列表

**接口**: `GET /list`

**描述**: 获取 Agent 列表，支持分页和筛选

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| pageSize | Number | 否 | 每页条数，默认 20 |
| pageIndex | Number | 否 | 当前页码，默认 1 |
| category | String | 否 | 按分类筛选 |
| keyword | String | 否 | 关键词搜索（匹配 name 和 description） |
| status | String | 否 | 按状态筛选（enabled/disabled） |

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "content": [
      {
        "id": 1,
        "name": "客服助手",
        "description": "智能客服助手",
        "category": "客服",
        "status": "enabled",
        "config": "{}",
        "avatar": "",
        "create_time": "2026-07-21 10:00:00.000",
        "update_time": "2026-07-21 10:00:00.000"
      }
    ],
    "total": 10,
    "pageIndex": 1,
    "pageSize": 20
  }
}
```

---

### 1.2 获取 Agent 详情

**接口**: `GET /detail/:id`

**描述**: 根据 ID 获取单个 Agent 的详细信息

**路径参数**:

| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | Number | Agent ID |

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "name": "客服助手",
    "description": "智能客服助手",
    "category": "客服",
    "status": "enabled",
    "config": "{}",
    "avatar": "",
    "create_time": "2026-07-21 10:00:00.000",
    "update_time": "2026-07-21 10:00:00.000"
  }
}
```

**错误响应**:
- `404`: Agent 不存在

---

### 1.3 创建 Agent

**接口**: `POST /create`

**描述**: 创建一个新的 Agent

**请求体**:
```json
{
  "name": "客服助手",
  "description": "智能客服助手描述",
  "category": "客服",
  "config": {
    "model": "gpt-4",
    "temperature": 0.7
  },
  "avatar": "https://example.com/avatar.png",
  "status": "enabled"
}
```

**请求字段**:

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| name | String | 是 | - | Agent 名称 |
| description | String | 否 | "" | Agent 描述 |
| category | String | 否 | "未分类" | Agent 分类 |
| config | Object/String | 否 | "{}" | Agent 配置（JSON 对象或字符串） |
| avatar | String | 否 | "" | Agent 头像 URL |
| status | String | 否 | "enabled" | 状态（enabled/disabled） |

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 2,
    "name": "客服助手",
    "createdAt": "2026-07-21T10:00:00.000Z"
  }
}
```

**错误响应**:
- `400`: 名称不能为空

---

### 1.4 更新 Agent

**接口**: `POST /update/:id`

**描述**: 更新指定 Agent 的信息

**路径参数**:

| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | Number | Agent ID |

**请求体**（所有字段可选，未提供的字段保持原值）:
```json
{
  "name": "新名称",
  "description": "新描述",
  "category": "新分类",
  "config": {
    "model": "gpt-3.5"
  },
  "avatar": "https://example.com/new-avatar.png",
  "status": "disabled"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "updatedAt": "2026-07-21T10:00:00.000Z"
  }
}
```

**错误响应**:
- `404`: Agent 不存在

---

### 1.5 删除 Agent

**接口**: `POST /delete/:id`

**描述**: 删除指定 Agent 及其相关的对话消息

**路径参数**:

| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | Number | Agent ID |

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": "删除成功"
  }
}
```

**错误响应**:
- `404`: Agent 不存在

---

### 1.6 切换 Agent 状态

**接口**: `POST /toggle-status/:id`

**描述**: 启用或禁用指定 Agent

**路径参数**:

| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | Number | Agent ID |

**请求体**:
```json
{
  "enabled": true
}
```

**请求字段**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| enabled | Boolean | true=启用，false=禁用 |

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "status": "enabled",
    "message": "已启用"
  }
}
```

**错误响应**:
- `404`: Agent 不存在

---

## 二、对话接口

### 2.1 发送对话消息

**接口**: `POST /chat/:agentId`

**描述**: 向指定 Agent 发送消息并获取回复

**路径参数**:

| 参数名 | 类型 | 说明 |
|--------|------|------|
| agentId | Number | Agent ID |

**请求体**:
```json
{
  "message": "你好，请问有什么可以帮助的？",
  "sessionId": "session_123456"
}
```

**请求字段**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| message | String | 是 | 消息内容 |
| sessionId | String | 否 | 会话 ID（自动生成） |

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "reply": "收到您的消息：\"你好，请问有什么可以帮助的？\"。这是 Agent 的模拟回复。",
    "sessionId": "session_123456",
    "timestamp": "2026-07-21T10:00:00.000Z"
  }
}
```

**错误响应**:
- `400`: 消息内容不能为空 / Agent 已禁用
- `404`: Agent 不存在

---

### 2.2 获取对话历史

**接口**: `GET /chat-history/:agentId`

**描述**: 获取指定 Agent 的对话历史记录

**路径参数**:

| 参数名 | 类型 | 说明 |
|--------|------|------|
| agentId | Number | Agent ID |

**查询参数**:

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| sessionId | String | 否 | - | 按会话 ID 筛选 |
| limit | Number | 否 | 50 | 返回消息数量上限 |

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "messages": [
      {
        "id": 1,
        "agent_id": 1,
        "session_id": "session_123",
        "role": "user",
        "content": "你好",
        "create_time": "2026-07-21 10:00:00.000"
      },
      {
        "id": 2,
        "agent_id": 1,
        "session_id": "session_123",
        "role": "assistant",
        "content": "您好，有什么可以帮助您的？",
        "create_time": "2026-07-21 10:00:01.000"
      }
    ]
  }
}
```

**错误响应**:
- `404`: Agent 不存在

---

## 三、搜索与分类接口

### 3.1 搜索 Agent

**接口**: `GET /search`

**描述**: 搜索 Agent（支持多条件组合）

**查询参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| keyword | String | 否 | 关键词（匹配 name 和 description） |
| category | String | 否 | 按分类筛选 |
| status | String | 否 | 按状态筛选 |

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "results": [
      {
        "id": 1,
        "name": "客服助手",
        "description": "智能客服助手",
        "category": "客服",
        "status": "enabled",
        "create_time": "2026-07-21 10:00:00.000",
        "update_time": "2026-07-21 10:00:00.000"
      }
    ]
  }
}
```

---

### 3.2 获取分类列表

**接口**: `GET /categories`

**描述**: 获取所有 Agent 分类及其数量统计

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "categories": [
      { "category": "客服", "count": 10 },
      { "category": "销售", "count": 5 },
      { "category": "未分类", "count": 2 }
    ]
  }
}
```

---

## 四、统计数据接口

### 4.1 获取统计数据（汇总 + 分钟级）

**接口**: `GET /stats/summary`

**描述**: 获取完整的统计数据，包括汇总表、当前分钟统计和最近 60 分钟统计

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "summary": {
      "total_prompt_tokens": 10000,
      "total_completion_tokens": 5000,
      "total_all_tokens": 15000,
      "total_bytes_in": 1048576,
      "total_bytes_out": 524288,
      "total_requests": 100,
      "total_success": 95,
      "total_failed": 5,
      "first_request_time": "2026-07-21 10:00:00",
      "last_request_time": "2026-07-21 12:00:00"
    },
    "currentMinute": {
      "stat_time": "2026-07-21 12:30",
      "prompt_tokens": 100,
      "completion_tokens": 50,
      "all_tokens": 150,
      "bytes_in": 10240,
      "bytes_out": 5120,
      "requests": 10,
      "success": 9,
      "failed": 1
    },
    "recentMinutes": [...],
    "databasePath": "./database/db.sqlite"
  }
}
```

---

### 4.2 获取分钟级统计列表

**接口**: `GET /stats/minute`

**描述**: 获取分钟级统计记录列表，支持时间范围筛选

**查询参数**:

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| startTime | String | 否 | - | 开始时间（格式：YYYY-MM-DD HH:mm） |
| endTime | String | 否 | - | 结束时间（格式：YYYY-MM-DD HH:mm） |
| limit | Number | 否 | 100 | 返回记录数上限 |

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "id": 1,
        "stat_time": "2026-07-21 12:30",
        "prompt_tokens": 100,
        "completion_tokens": 50,
        "all_tokens": 150,
        "bytes_in": 10240,
        "bytes_out": 5120,
        "requests": 10,
        "success": 9,
        "failed": 1,
        "created_at": "2026-07-21 12:30:00",
        "updated_at": "2026-07-21 12:30:00"
      }
    ],
    "total": 1
  }
}
```

---

### 4.3 获取汇总统计数据

**接口**: `GET /stats/summary-only`

**描述**: 仅获取汇总统计数据

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total_prompt_tokens": 10000,
    "total_completion_tokens": 5000,
    "total_all_tokens": 15000,
    "total_bytes_in": 1048576,
    "total_bytes_out": 524288,
    "total_requests": 100,
    "total_success": 95,
    "total_failed": 5,
    "first_request_time": "2026-07-21 10:00:00",
    "last_request_time": "2026-07-21 12:00:00"
  }
}
```

---

### 4.4 清理过期统计数据

**接口**: `POST /stats/cleanup`

**描述**: 清理过期的统计数据

**请求体**:
```json
{
  "days": 30
}
```

**请求字段**:

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| days | Number | 否 | 配置值 | 清理天数 |

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": "清理完成",
    "deletedCount": 100,
    "cleanupDays": 30
  }
}
```

---

### 4.5 重置统计数据

**接口**: `POST /stats/reset`

**描述**: 重置所有统计数据

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": "统计数据已重置"
  }
}
```

---

### 4.6 导出统计数据

**接口**: `GET /stats/export`

**描述**: 导出所有统计数据为 JSON 格式

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "exportTime": "2026-07-21T12:30:00.000Z",
    "summary": {
      "total_prompt_tokens": 10000,
      ...
    },
    "minuteRecords": [...],
    "statistics": {
      "totalRecords": 100,
      "dateRange": {
        "earliest": "2026-07-21 10:00",
        "latest": "2026-07-21 12:30"
      }
    }
  }
}
```

---

## 五、错误码说明

| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 六、数据库表结构

### tb_agent（Agent 表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INTEGER PRIMARY KEY | 主键 ID |
| name | TEXT NOT NULL | Agent 名称 |
| description | TEXT | Agent 描述 |
| category | TEXT | Agent 分类 |
| status | TEXT | 状态（enabled/disabled） |
| config | TEXT | 配置（JSON 字符串） |
| avatar | TEXT | 头像 URL |
| create_time | TEXT | 创建时间 |
| update_time | TEXT | 更新时间 |

### tb_chat_message（对话消息表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INTEGER PRIMARY KEY | 主键 ID |
| agent_id | INTEGER | Agent ID |
| session_id | TEXT | 会话 ID |
| role | TEXT | 角色（user/assistant） |
| content | TEXT | 消息内容 |
| create_time | TEXT | 创建时间 |

### stats_summary（统计汇总表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INTEGER PRIMARY KEY | 主键 ID（固定为 1） |
| total_prompt_tokens | INTEGER | 总提示词 token 数 |
| total_completion_tokens | INTEGER | 总补全 token 数 |
| total_all_tokens | INTEGER | 总 token 数 |
| total_bytes_in | INTEGER | 总输入字节数 |
| total_bytes_out | INTEGER | 总输出字节数 |
| total_requests | INTEGER | 总请求数 |
| total_success | INTEGER | 成功请求数 |
| total_failed | INTEGER | 失败请求数 |
| first_request_time | TEXT | 首次请求时间 |
| last_request_time | TEXT | 最后请求时间 |

### stats_minute（分钟级统计表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INTEGER PRIMARY KEY | 主键 ID |
| stat_time | TEXT | 统计时间（YYYY-MM-DD HH:mm） |
| prompt_tokens | INTEGER | 提示词 token 数 |
| completion_tokens | INTEGER | 补全 token 数 |
| all_tokens | INTEGER | 总 token 数 |
| bytes_in | INTEGER | 输入字节数 |
| bytes_out | INTEGER | 输出字节数 |
| requests | INTEGER | 请求数 |
| success | INTEGER | 成功请求数 |
| failed | INTEGER | 失败请求数 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

---

## 七、注意事项

1. 所有时间字段格式为 `YYYY-MM-DD HH:mm:ss.SSS`
2. config 字段在 Agent 表中存储为 JSON 字符串，在请求/响应中可传递 JSON 对象
3. 对话接口目前返回模拟回复，实际需接入 AI 服务
4. 统计数据接口依赖 `database/db.sqlite` 数据库文件