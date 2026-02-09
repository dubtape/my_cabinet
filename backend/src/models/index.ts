/**
 * Core data models for the Cyber Cabinet system
 */

export interface Meeting {
  id: string
  topic: string
  description?: string
  selectedRoleIds?: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
  budget: number
  usage: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  messages: Message[]
  artifacts: Artifacts
  degradation?: DegradationLevel
}

export type DegradationLevel = 'none' | 'partial' | 'severe'

export interface Message {
  id: string
  timestamp: string
  role: string
  type: 'statement' | 'question' | 'response' | 'perspective' | 'elaboration_request' | 'system' | 'compressed'
  content: string
  metadata?: Record<string, unknown>
}

export interface Artifacts {
  issueBrief?: IssueBrief
  speakPlan?: SpeakPlan
  summary?: Summary
  finalDecision?: FinalDecision
  brainInterventions?: BrainIntervention[]
  brainAnalysis?: BrainAnalysis
}

export interface IssueBrief {
  topic: string
  background: string
  keyConsiderations: string[]
  constraints?: string[]
}

export interface SpeakPlan {
  speakingOrder: string[]
  rationale: string
}

export interface Summary {
  summary: string
  structure?: string
  discussion?: string
  keyPoints?: string[]
  consensus?: string
  disagreements?: string[]
}

export interface FinalDecision {
  decision: string
  reasoning: string
  nextSteps: string[]
}

export interface BrainIntervention {
  id: string
  timestamp: string
  type: 'question' | 'perspective' | 'elaboration_request'
  content: string
  targetRole?: string
  resolved: boolean
}

export interface BrainAnalysis {
  analysis: string
  parsed?: Record<string, unknown> | null
  consensus: string[]
  disagreements: string[]
}

export interface Artifact {
  type: string
  content: unknown
  createdAt: string
}
