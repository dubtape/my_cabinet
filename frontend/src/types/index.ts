// Core Types
export interface Meeting {
  id: string
  topic: string
  description?: string
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

// Role/Persona Types
export interface Role {
  id: string
  name: string
  title: string
  version: number
  lastEvolved?: string
  stance: string
  personality: string
  expertise: string[]
  modelConfig: ModelConfig
  evolutionHistory: EvolutionEntry[]
}

export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'glm' | 'deepseek'
  model: string
  temperature: number
  maxTokens: number
}

export interface EvolutionEntry {
  version: number
  date: string
  changes: string
  rationale: string
}

// Memory Types
export interface Memory {
  id?: string
  type?: 'session' | 'decision' | 'learning' | 'pattern' | 'meeting_summary' | 'controversy' | 'context_package'
  title?: string
  content: string
  frontmatter: Record<string, unknown>
  createdAt?: string
  tags?: string[]
  relatedIds?: string[]
}

export interface SessionMemory extends Memory {
  type: 'session'
  meetingId: string
  participants: string[]
  outcome: string
}

export interface DecisionMemory extends Memory {
  type: 'decision'
  decision: string
  reasoning: string
  impact?: string
}

export interface LearningMemory extends Memory {
  type: 'learning'
  category: string
  lesson: string
}

export interface PatternMemory extends Memory {
  type: 'pattern'
  pattern: string
  frequency: number
  contexts: string[]
}

// LLM Types
export interface CompletionParams {
  messages: Array<{ role: string; content: string }>
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface CompletionResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface CompletionChunk {
  content: string
  done: boolean
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  contextLength: number
}
