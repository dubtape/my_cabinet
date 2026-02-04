import type { Meeting, Message, Artifact } from '../../models/index.js'
import type { BrainIntervention } from './mainBrain.js'

/**
 * Meeting stages - Optimized for Cabinet Meeting format
 */
export enum MeetingStage {
  IDLE = 'idle',
  ISSUE_BRIEF = 'issue_brief',           // 议题简报
  DEPARTMENT_SPEECHES = 'department_speeches',  // 第一轮：部门发言
  BRAIN_INTERVENTION = 'brain_intervention',  // BRAIN 分析争议点
  PRIME_SUMMARY = 'prime_summary',        // 群主总结
  FOLLOW_UP_DISCUSSION = 'follow_up_discussion',  // 第二轮：补充讨论
  PRIME_DECISION = 'prime_decision',      // 最终决策
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Stage configuration
 */
export interface StageConfig {
  stage: MeetingStage
  requiredRoles: string[]
  maxTokens?: number
  canDegrade?: boolean
}

/**
 * Stage configurations for each meeting stage
 */
export const STAGE_CONFIGS: Record<MeetingStage, StageConfig> = {
  [MeetingStage.IDLE]: {
    stage: MeetingStage.IDLE,
    requiredRoles: [],
  },
  [MeetingStage.ISSUE_BRIEF]: {
    stage: MeetingStage.ISSUE_BRIEF,
    requiredRoles: ['PRIME'],
    maxTokens: 1000,
  },
  [MeetingStage.DEPARTMENT_SPEECHES]: {
    stage: MeetingStage.DEPARTMENT_SPEECHES,
    requiredRoles: ['CRITIC', 'FINANCE', 'WORKS'],
    maxTokens: 4000,  // 第一轮发言，token 预算较高
    canDegrade: false,  // 必须执行
  },
  [MeetingStage.BRAIN_INTERVENTION]: {
    stage: MeetingStage.BRAIN_INTERVENTION,
    requiredRoles: ['BRAIN'],
    maxTokens: 1500,
    canDegrade: true,
  },
  [MeetingStage.PRIME_SUMMARY]: {
    stage: MeetingStage.PRIME_SUMMARY,
    requiredRoles: ['PRIME'],
    maxTokens: 1500,
    canDegrade: false,  // 必须执行
  },
  [MeetingStage.FOLLOW_UP_DISCUSSION]: {
    stage: MeetingStage.FOLLOW_UP_DISCUSSION,
    requiredRoles: ['CRITIC', 'FINANCE', 'WORKS'],
    maxTokens: 3000,
    canDegrade: true,
  },
  [MeetingStage.PRIME_DECISION]: {
    stage: MeetingStage.PRIME_DECISION,
    requiredRoles: ['PRIME'],
    maxTokens: 1500,
  },
  [MeetingStage.COMPLETED]: {
    stage: MeetingStage.COMPLETED,
    requiredRoles: [],
  },
  [MeetingStage.FAILED]: {
    stage: MeetingStage.FAILED,
    requiredRoles: [],
  },
}

/**
 * Get next stage in the meeting flow
 */
export function getNextStage(current: MeetingStage): MeetingStage {
  const stages = Object.values(MeetingStage)
  const currentIndex = stages.indexOf(current)
  return stages[Math.min(currentIndex + 1, stages.length - 1)]
}

/**
 * Get all stages in order
 */
export function getStageFlow(): MeetingStage[] {
  return [
    MeetingStage.ISSUE_BRIEF,
    MeetingStage.DEPARTMENT_SPEECHES,
    MeetingStage.BRAIN_INTERVENTION,
    MeetingStage.PRIME_SUMMARY,
    MeetingStage.FOLLOW_UP_DISCUSSION,
    MeetingStage.PRIME_DECISION,
  ]
}

/**
 * Check if a stage can be skipped due to budget constraints
 */
export function canSkipStage(stage: MeetingStage, usage: number, budget: number): boolean {
  const config = STAGE_CONFIGS[stage]
  if (!config.canDegrade) {
    return false
  }

  // Skip if we've used 90% of budget
  return usage >= budget * 0.9
}

/**
 * Check if we should go directly to final decision
 */
export function shouldSkipToDecision(usage: number, budget: number): boolean {
  return usage >= budget
}

/**
 * Create a stage transition message
 */
export function createStageMessage(stage: MeetingStage, previousStage?: MeetingStage): Message {
  const now = new Date().toISOString()

  const stageNames: Record<MeetingStage, string> = {
    [MeetingStage.IDLE]: '空闲',
    [MeetingStage.ISSUE_BRIEF]: '议题简报',
    [MeetingStage.DEPARTMENT_SPEECHES]: '第一轮：部门发言',
    [MeetingStage.BRAIN_INTERVENTION]: '主脑分析',
    [MeetingStage.PRIME_SUMMARY]: '群主总结',
    [MeetingStage.FOLLOW_UP_DISCUSSION]: '第二轮：补充讨论',
    [MeetingStage.PRIME_DECISION]: '最终决策',
    [MeetingStage.COMPLETED]: '已完成',
    [MeetingStage.FAILED]: '失败',
  }

  return {
    id: `msg-${Date.now()}`,
    timestamp: now,
    role: 'SYSTEM',
    type: 'system',
    content: previousStage
      ? `进入阶段: ${stageNames[stage]} (从 ${stageNames[previousStage]} 转换)`
      : `开始阶段: ${stageNames[stage]}`,
  }
}

/**
 * Create an artifact message
 */
export function createArtifactMessage(type: string, artifact: Artifact): Message {
  const now = new Date().toISOString()

  return {
    id: `msg-${Date.now()}`,
    timestamp: now,
    role: 'SYSTEM',
    type: 'system',
    content: `生成产出: ${type}`,
    metadata: { artifactType: type, artifact },
  }
}
