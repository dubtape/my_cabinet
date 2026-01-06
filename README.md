# 内阁式多模型议事 Web 应用（MVP）

本项目依据 PRD 实现了一个可运行的一轮内阁会议 MVP，包括会议创建、编排、时间轴回放、预算降级与基础审计。采用零依赖纯 Node.js 与原生前端，开箱即可运行与测试。

## 快速开始

```bash
# 启动服务（默认 3000 端口）
npm start
# 打开浏览器访问 http://localhost:3000
```

## 主要特性
- 固定 4 角色 + 书记官流程：解析议题 → 相关性判断 → 排程 → 发言 → 纪要 → 定案
- 按 PRD 定义的结构化输出：IssueBrief / Relevance / SpeakPlan / RoleSpeech / RoundSummary / FinalDecision
- 预算与降级：达到 90% 跳过剩余发言，达到 100% 直接定案并记录降级原因
- 会议列表、详情页、产物展示，UI 参考 OpenAI 风格并加入青绿中式配色
- SSE 流式端点（单次快照），LLM 调用审计、消息时间轴、会议快照持久化（本地 JSON）

## API 速览
- `POST /api/meetings` 创建会议
- `POST /api/meetings/{id}/run` 启动编排
- `GET /api/meetings/{id}` 获取详情（含 messages / llm_calls / artifacts）
- `GET /api/meetings` 会议列表
- `GET /api/meetings/{id}/stream` SSE 快照

## 测试

```bash
npm test
```

测试覆盖正常链路完成定案与超小预算触发降级两大场景。
