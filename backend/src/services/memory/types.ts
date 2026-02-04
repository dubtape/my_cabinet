/**
 * Memory Types - Extended for Cabinet Meeting System
 */

import type { Memory } from './markdownStore.js'

/**
 * All memory types in the system
 */
export type MemoryType =
  | 'session'           // 会议会话记录（完整）
  | 'decision'          // 决策记录
  | 'learning'          // 学习经验
  | 'pattern'           // 模式识别
  | 'persona'           // 角色人设
  | 'meeting_summary'   // 会议摘要（新增）
  | 'controversy'       // 争议点记录（新增）
  | 'context_package'   // 上下文包（新增）

/**
 * Meeting Summary Structure
 * 会议级摘要：记录一次会议的完整信息
 */
export interface MeetingSummaryMemory {
  type: 'meeting_summary'
  frontmatter: {
    id: string
    type: 'meeting_summary'
    meetingId: string
    topic: string
    date: string
    participants: string[]          // 参与角色
    duration?: number               // 时长（秒）
    tokenUsage: number              // Token 使用量
    stages: string[]                // 经历的阶段
  }
  content: string                  // Markdown 格式的摘要内容
}

/**
 * Decision Summary Structure
 * 决策摘要：记录最终决策的关键信息
 */
export interface DecisionSummaryMemory {
  type: 'decision'
  frontmatter: {
    id: string
    type: 'decision'
    meetingId: string
    topic: string
    date: string
    decisionMaker: string           // 决策者（通常是 PRIME）
    impact: 'high' | 'medium' | 'low'
    category: string                // 决策类别（政策/财政/运营等）
  }
  content: string                  // 决策内容、理由、后续步骤
}

/**
 * Controversy Summary Structure
 * 争议点摘要：记录讨论中的分歧点和解决过程
 */
export interface ControversyMemory {
  type: 'controversy'
  frontmatter: {
    id: string
    type: 'controversy'
    meetingId: string
    topic: string
    date: string
    involvedRoles: string[]         // 涉及的角色
    resolutionStatus: 'resolved' | 'partial' | 'unresolved'
    importance: 'high' | 'medium' | 'low'
  }
  content: string                  // 争议点描述、各方观点、解决方式
}

/**
 * Context Package Structure
 * 上下文包：轻量化的历史上下文，用于注入新会议
 */
export interface ContextPackageMemory {
  type: 'context_package'
  frontmatter: {
    id: string
    type: 'context_package'
    targetTopic?: string            // 目标议题
    targetRoles?: string[]           // 相关角色
    date: string
    itemCount: number               // 包含的条目数
    totalTokens: number             // 估算的 token 数
  }
  content: string                  // 结构化的上下文内容
}

/**
 * Lightweight Context Item
 * 上下文包中的单个条目
 */
export interface ContextItem {
  type: 'meeting_summary' | 'previous_decision' | 'learning' | 'pattern' | 'controversy'
  source: string                   // 来源会议/记忆ID
  relevance: number                // 相关度评分 0-1
  summary: string                  // 摘要内容
  metadata?: Record<string, unknown>
}

/**
 * Compressed Message Structure
 * 压缩后的消息：用于替换大量历史消息
 */
export interface CompressedMessage {
  role: string
  type: 'compressed'
  content: string                  // 压缩摘要
  metadata: {
    originalCount: number          // 原始消息数
    timeRange: {
      start: string
      end: string
    }
    compressionMethod: 'summary' | 'key_points' | 'role_aggregated'
  }
}

/**
 * Memory Retrieval Query
 * 记忆检索查询
 */
export interface MemoryQuery {
  topic?: string
  roles?: string[]
  types?: MemoryType[]
  dateRange?: {
    start: string
    end: string
  }
  limit?: number
  minRelevance?: number            // 最低相关度
}

/**
 * Memory Retrieval Result
 * 记忆检索结果
 */
export interface MemoryRetrievalResult {
  items: Memory[]
  totalTokens: number
  compressed: boolean
  query: MemoryQuery
}
