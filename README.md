# 赛博内阁 (Cyber Cabinet)

**AI 多智能体决策系统** - 基于多个 AI 角色的协作式内阁会议系统

## 项目简介

赛博内阁是一个现代化的 AI 多智能体决策系统，通过模拟内阁会议流程，让多个 AI 角色（总理、主脑、批评者、财政部长、实务部长、书记官）协作讨论议题并做出决策。

### 核心特性

- **多模型支持**: OpenAI (GPT-4o)、Anthropic (Claude 3.5 Sonnet)、Ollama (本地模型)、GLM (智谱)、DeepSeek (深度求索)
- **独立主脑 (BRAIN)**: 主动分析讨论、提出问题、引入新视角、综合结论
- **Markdown 记忆系统**: 短期会话记忆、长期决策/学习/模式记忆
- **人设演化**: AI 辅助的角色人设优化和演化
- **实时通信**: WebSocket 支持会议实时更新
- **预算降级**: 智能的资源管理和流程简化

### 角色设计

| 角色 | 职责 |
|------|------|
| **PRIME (总理)** | 主持会议、控制流程、做出最终决策 |
| **BRAIN (主脑)** | 独立分析、提问质疑、综合观点、引入新视角 |
| **CRITIC (批评者)** | 质疑假设、识别风险、验证论据 |
| **FINANCE (财政)** | 成本分析、ROI 评估、预算规划 |
| **WORKS (实务)** | 实施计划、资源评估、可行性分析 |
| **CLERK (书记官)** | 会议记录、总结整理、文档归档 |

## 技术栈

### 后端
- Node.js 20+ (ES Modules)
- Express.js
- WebSocket (ws)
- OpenAI SDK / Anthropic SDK / Ollama
- Markdown-it
- Zod (运行时验证)

### 前端
- React 18 + TypeScript
- Vite
- React Router v6
- Zustand (状态管理)
- React Query (服务端状态)
- TailwindCSS + shadcn/ui

## 目录结构

```
my_cabinet/
├── backend/                 # Node.js 后端
│   ├── src/
│   │   ├── server/         # Express 服务器
│   │   ├── routes/         # API 路由
│   │   ├── controllers/    # 控制器
│   │   ├── services/       # 业务逻辑
│   │   │   ├── orchestrator/  # 会议编排
│   │   │   ├── memory/        # 记忆系统
│   │   │   ├── llm/           # LLM 提供商
│   │   │   └── persona/       # 人设管理
│   │   └── models/         # 数据模型
│   └── data/              # 数据目录
│       ├── memory/        # Markdown 记忆
│       └── personas/      # 人设文件
├── frontend/              # React 前端
│   ├── src/
│   │   ├── components/    # 组件
│   │   ├── pages/         # 页面
│   │   ├── stores/        # Zustand 状态
│   │   └── types/         # TypeScript 类型
└── scripts/               # 工具脚本
```

## 快速开始

### 1. 环境要求

- Node.js 20+
- npm 或 pnpm

### 2. 安装依赖

```bash
# 安装所有依赖
npm install

# 或分别安装
cd backend && npm install
cd ../frontend && npm install
```

### 3. 配置环境变量

复制 `.env.example` 到 `.env` 并配置 API 密钥:

```bash
cp .env.example .env
```

编辑 `.env` 文件:

```env
# OpenAI (可选)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Anthropic (推荐)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Ollama (本地模型，可选)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:70b

# GLM (智谱AI，可选)
GLM_API_KEY=your-glm-api-key
GLM_MODEL=glm-4

# DeepSeek (深度求索，可选)
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_MODEL=deepseek-chat
```

### 4. 启动开发服务器

```bash
# 同时启动前后端
npm run dev

# 或分别启动
npm run dev:backend  # 后端 http://localhost:3000
npm run dev:frontend # 前端 http://localhost:5173
```

### 5. 访问应用

打开浏览器访问 http://localhost:5173

## 使用指南

### 创建会议

1. 点击"创建新会议"
2. 输入会议议题
3. 设置 Token 预算 (推荐 50000)
4. 点击"创建会议"

### 运行会议

1. 在会议详情页点击"开始会议"
2. 实时观看讨论过程
3. BRAIN 会主动提出问题和观点
4. 最终查看会议产出和决策

### 管理角色

1. 访问"角色管理"页面
2. 查看和编辑各角色人设
3. 配置不同的 AI 模型
4. 请求 AI 演化优化

### 浏览记忆

1. 访问"记忆浏览"页面
2. 搜索历史决策和学习
3. 查看模式识别结果

## API 端点

### 会议
- `POST /api/meetings` - 创建会议
- `GET /api/meetings` - 列出会议
- `GET /api/meetings/:id` - 获取会议详情
- `POST /api/meetings/:id/run` - 运行会议
- `DELETE /api/meetings/:id` - 删除会议

### 角色
- `GET /api/roles` - 列出所有角色
- `GET /api/roles/:id` - 获取角色详情
- `PUT /api/roles/:id` - 更新角色人设
- `POST /api/roles/:id/evolve` - 请求人设演化
- `POST /api/roles` - 创建自定义角色
- `DELETE /api/roles/:id` - 删除自定义角色

### 记忆
- `GET /api/memory/search?q=query` - 搜索记忆
- `GET /api/memory/sessions` - 列出会话
- `GET /api/memory/decisions` - 列出决策
- `GET /api/memory/learnings` - 列出学习
- `GET /api/memory/:type/:id` - 获取记忆详情
- `PUT /api/memory/:type/:id` - 更新记忆

### WebSocket
- 连接: `ws://localhost:3000/ws`
- 事件:
  - `JOIN_MEETING` - 加入会议
  - `USER_RESPONSE` - 用户响应
  - `MEETING_UPDATED` - 会议更新

## 数据迁移

如果你有旧版本的 MVP 数据:

```bash
npm run migrate
```

这会:
1. 备份原有数据到 `./backup`
2. 将会议转换为 Markdown 记忆文件
3. 提取决策记录

## 开发

### 运行测试

```bash
npm test
```

### 构建生产版本

```bash
npm run build
```

### 启动生产服务器

```bash
npm start
```

## 架构说明

### PRIME + BRAIN 协作模式

- **PRIME (总理)**: 控制会议流程
  - 决定谁发言
  - 决定何时进入下一阶段
  - 综合各方意见做出决策

- **BRAIN (主脑)**: 提供智力引导
  - 观察讨论进展
  - 识别信息缺口
  - 主动提出澄清问题
  - 要求角色详细阐述
  - 引入缺失的视角
  - 综合各方观点

### 记忆系统

三层架构:

1. **Canonical Markdown Storage**: 人类可读的 .md 文件
2. **Structured Index**: 快速检索索引
3. **Runtime Context**: 内存缓存

文件组织:
```
backend/data/memory/
├── short-term/           # 会话记忆
│   └── 2025-02-03-session-abc123.md
├── long-term/
│   ├── decisions/        # 决策记录
│   ├── learnings/        # 学习经验
│   └── patterns/         # 模式识别
└── personas/             # 角色人设
    ├── PRIME.md
    ├── BRAIN.md
    └── ...
```

## 许可证

MIT

## 致谢

- Clawdbot - Markdown 记忆系统灵感来源
- Anthropic - Claude API 支持
- OpenAI - GPT 模型支持
