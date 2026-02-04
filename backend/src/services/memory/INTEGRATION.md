# 记忆结构与会议流程接入点设计

## 1. 文件存储结构

```
backend/data/
├── meetings/                    # 当前会议运行时数据（JSON）
├── memory/
│   ├── short-term/             # 短期记忆
│   │   ├── session/            # 会议会话记录
│   │   └── contexts/           # 上下文包
│   └── long-term/              # 长期记忆
│       ├── decisions/          # 决策记录
│       ├── learnings/          # 学习经验
│       ├── patterns/           # 模式识别
│       ├── meetings/           # 会议摘要（新增）
│       └── controversies/       # 争议点记录（新增）
└── personas/                    # 角色人设
```

## 2. 新增 Memory 类型

### 2.1 会议摘要 (meeting_summary)
**触发时机**: 会议结束时 (PRIME_DECISION 之后)
**内容结构**:
```yaml
---
id: meeting-summary-20250204-abc123
type: meeting_summary
meetingId: abc123
topic: 实施新的碳税政策
date: 2025-02-04
participants: [PRIME, CRITIC, FINANCE, WORKS, BRAIN]
duration: 1800
tokenUsage: 12500
stages: [ISSUE_BRIEF, DEPARTMENT_SPEECHES, BRAIN_INTERVENTION, PRIME_SUMMARY, FOLLOW_UP_DISCUSSION, PRIME_DECISION]
---
# 会议摘要

## 议题
实施新的碳税政策

## 参与角色
- PRIME (总理)
- CRITIC (批评者)
- FINANCE (财政部长)
- WORKS (实务部长)
- BRAIN (主脑)

## 核心观点
### 第一轮发言
- **WORKS**: 从实施角度，碳税会增加企业运营成本...
- **CRITIC**: 看到WORKS的观点，我认为碳税的必要性需要更多数据支持...
- **FINANCE**: 听了两位的发言，从财政角度，碳税可以提供新的收入来源...

### 主脑分析
- 共识：都需要进一步评估政策影响
- 分歧：实施时机和税率设定存在分歧

### 第二轮讨论
- **CRITIC**: 基于总结，我认为分歧点在于...
- **FINANCE**: NO_RESPONSE（总结已涵盖我的观点）
- **WORKS**: 补充一点，实施细节需要考虑...

## 最终决策
PRIME 决定采用渐进式碳税政策...

## 争议点
1. 实施时机：立即 vs 延迟
2. 初始税率：低税率 vs 高税率
3. 收入用途：返还企业 vs 财政收入

## 决策影响
- 财政影响：中等
- 实施难度：中等
- 预期效果：高
```

### 2.2 决策摘要 (decision)
**触发时机**: 会议结束时 (从 meeting_summary 提取)
**内容结构**:
```yaml
---
id: decision-20250204-carbon-tax
type: decision
meetingId: abc123
topic: 实施新的碳税政策
date: 2025-02-04
decisionMaker: PRIME
impact: high
category: 政策
---
# 决策：采用渐进式碳税政策

## 决策内容
采用分阶段的碳税政策，从低税率开始，逐步提高。

## 决策理由
1. 平衡环保目标与经济承受力
2. 给企业适应时间
3. 根据实施效果调整税率

## 后续步骤
1. 制定详细的税率阶梯方案
2. 建立碳税收入管理机制
3. 设立监督评估委员会
4. 六个月后进行首次评估
```

### 2.3 争议点 (controversy)
**触发时机**: 会议结束时 (从 BRAIN 分析提取)
**内容结构**:
```yaml
---
id: controversy-20250204-timing
type: controversy
meetingId: abc123
topic: 碳税政策实施时机
date: 2025-02-04
involvedRoles: [WORKS, CRITIC]
resolutionStatus: resolved
importance: high
---
# 争议点：实施时机

## 分歧描述
- **WORKS**: 主张立即实施，认为越早越好
- **CRITIC**: 建议延迟6个月，需要更多数据支持

## 各方观点
### WORKS 的观点
立即实施可以展现政策决心，国际社会也在期待...

### CRITIC 的观点
需要先评估对现有产业的影响，避免一刀切...

## 解决方式
PRIME 提出：采用"准备期 + 实施期"的两阶段方案，给予3个月准备时间，然后正式实施。

## 最终结果
各方接受妥协方案，争议解决。
```

### 2.4 上下文包 (context_package)
**触发时机**: 新会议开始前 (ISSUE_BRIEF 之前)
**内容结构**:
```yaml
---
id: ctx-20250204-carbon-related
type: context_package
targetTopic: 环保相关政策
targetRoles: [FINANCE, WORKS]
date: 2025-02-04
itemCount: 5
totalTokens: 2000
---
# 相关上下文包

## 历史决策
### 2024-01: 碳税政策可行性研究
- 决策：启动前期研究
- 理由：需要数据支持
- 相关度：0.95

### 2024-06: 清洁能源补贴政策
- 决策：补贴新能源企业
- 影响：为碳税政策做铺垫
- 相关度：0.85

## 学习经验
### 2023-12: 政策实施风险评估
- 经验：大政策需分阶段实施
- 适用场景：所有重大政策
- 相关度：0.90

## 争议模式
### 常见分歧：实施时机
- 模式：WORKS 倾向立即行动，CRITIC 倾向谨慎评估
- 解决方式：采用准备期机制
- 相关度：0.88
```

## 3. 会议流程与记忆接入点映射

```
┌─────────────────────────────────────────────────────────────┐
│                     会议生命周期                              │
└─────────────────────────────────────────────────────────────┘

[准备阶段]
  │
  ├─→ ISSUE_BRIEF 开始
  │   └─→ 检索相关上下文包 (context_package)
  │       ├─ 根据主题检索历史决策 (decision)
  │       ├─ 根据角色检索学习经验 (learning)
  │       └─ 根据主题检索相关争议 (controversy)
  │
  ├─→ 注入"轻量上下文包"到议题简报
  │
[执行阶段]
  │
  ├─→ DEPARTMENT_SPEECHES (第一轮)
  │   └─→ 监控消息数量，触发上下文压缩（如需要）
  │
  ├─→ BRAIN_INTERVENTION
  │   └─→ 分析讨论，记录争议点
  │
  ├─→ PRIME_SUMMARY
  │   └─→ 提取共识点、分歧点
  │
  ├─→ FOLLOW_UP_DISCUSSION (第二轮)
  │   └─→ 基于争议点进行针对性讨论
  │
  ├─→ PRIME_DECISION
  │   └─→ 做出最终决策
  │
[结束阶段]
  │
  └─→ 生成并持久化记忆
      ├─→ meeting_summary (会议摘要)
      ├─→ decision (决策摘要)
      ├─→ controversy (争议点记录)
      ├─→ session (会话记录)
      └─→ learning (自动提取学习经验)
```

## 4. 数据流向

```
新会议开始
   │
   ├─→ 检索相关上下文
   │   ├─ query by topic
   │   ├─ query by roles
   │   ├─ filter by relevance
   │   └─ 组装 context_package
   │
   ├─→ 注入到议题简报
   │   "议题：XXX
   │    相关背景：
   │    - 历史决策：...
   │    - 相关经验：...
   │    - 既往争议：..."
   │
   ├─→ 会议进行中...
   │   ├─ 消息累积
   │   ├─ Token 估算
   │   └─ 触发压缩（如 > 阈值）
   │       └─→ 生成 compressed_message
   │
   └─→ 会议结束
       ├─→ 提取关键信息
       ├─→ 生成摘要
       ├─→ 持久化到 MarkdownStore
       └─→ 索引更新（供后续检索）
```

## 5. Token 管理策略

### 5.1 压缩触发条件
- 当消息总数 > 20 条
- 或当估算 token 数 > 8000

### 5.2 压缩策略
```typescript
if (tokenCount > threshold) {
  // 保留最近 5 条完整消息
  const recentMessages = messages.slice(-5)

  // 压缩中间部分
  const middleMessages = messages.slice(5, -5)
  const compressed = await compressor.compress(middleMessages)

  // 组装：早期摘要 + 压缩中间部分 + 最近消息
  finalContext = [earlySummary, compressed, ...recentMessages]
}
```

### 5.3 不同阶段的 Token 预算
| 阶段 | 预算 | 上下文策略 |
|------|------|------------|
| ISSUE_BRIEF | 2000 | 注入轻量上下文包 |
| 第一轮发言 | 8000 | 完整历史 + 压缩（如需） |
| BRAIN 分析 | 2000 | 仅第一轮内容 |
| 群主总结 | 2000 | 完整历史 |
| 第二轮发言 | 4000 | 群主总结 + BRAIN 分析 |
| 最终决策 | 2000 | 完整历史（压缩） |

## 6. 记忆检索优化

### 6.1 相关度计算
```typescript
function calculateRelevance(query: MemoryQuery, memory: Memory): number {
  let score = 0

  // 主题匹配 (40%)
  if (query.topic && memory.content.includes(query.topic)) {
    score += 0.4
  }

  // 角色匹配 (30%)
  if (query.roles?.some(r => memory.frontmatter.participants?.includes(r))) {
    score += 0.3
  }

  // 类型匹配 (20%)
  if (query.types?.includes(memory.frontmatter.type)) {
    score += 0.2
  }

  // 时间衰减 (10%)
  const daysSince = (Date.now() - new Date(memory.frontmatter.date).getTime()) / (1000 * 60 * 60 * 24)
  const timeScore = Math.max(0, 1 - daysSince / 365) // 1年内有效
  score += timeScore * 0.1

  return score
}
```

### 6.2 检索优先级
1. **决策记录** (decision): 最高优先级，直接相关
2. **争议记录** (controversy): 避免重复争论
3. **学习经验** (learning): 提供参考
4. **会议摘要** (meeting_summary): 整体背景

### 6.3 上下文包大小限制
- 最大 token 数: 3000
- 最大条目数: 10
- 最低相关度: 0.6

## 7. 测试用例

### 7.1 上下文压缩测试
```typescript
test('should compress long message history', async () => {
  const messages = generateMessages(30) // 30条消息
  const compressed = await compressor.compress(messages)

  expect(compressed.tokenCount).toBeLessThan(8000)
  expect(compressed.preservedKeyPoints).toBe(true)
})
```

### 7.2 记忆融合测试
```typescript
test('should inject relevant context to new meeting', async () => {
  const context = await retriever.retrieve({
    topic: '碳税政策',
    roles: ['FINANCE', 'WORKS'],
    types: ['decision', 'learning']
  })

  expect(context.items).toHaveLength(5)
  expect(context.totalTokens).toBeLessThan(3000)
})
```

### 7.3 会议摘要生成测试
```typescript
test('should generate meeting summary', async () => {
  const summary = await summarizer.generate(meeting)

  expect(summary.frontmatter.type).toBe('meeting_summary')
  expect(summary.content).toContain('核心观点')
  expect(summary.content).toContain('最终决策')
})
```
