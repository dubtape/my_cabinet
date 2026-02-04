import { getMarkdownStore } from './markdownStore.js'
import type { MemoryFrontmatter } from './markdownStore.js'
import type { Meeting, Message, Artifact } from '../../models/index.js'

/**
 * Session memory structure
 */
export interface SessionMemory {
  id: string
  meetingId: string
  topic: string
  startedAt: string
  endedAt?: string
  participants: string[]
  messages: Message[]
  artifacts: Record<string, Artifact>
  outcome: string
}

/**
 * Decision memory structure
 */
export interface DecisionMemory {
  id: string
  date: string
  meetingId: string
  topic: string
  decision: string
  reasoning: string
  impact?: string
  stakeholders: string[]
}

/**
 * Learning memory structure
 */
export interface LearningMemory {
  id: string
  date: string
  category: string
  lesson: string
  context: string
  applicableRoles: string[]
}

/**
 * Pattern memory structure
 */
export interface PatternMemory {
  id: string
  pattern: string
  frequency: number
  contexts: string[]
  lastSeen: string
}

/**
 * Memory Manager - High-level interface for managing memories
 */
export class MemoryManager {
  private store = getMarkdownStore()

  /**
   * Create a session memory from a meeting
   */
  async createSessionMemory(meeting: Meeting): Promise<void> {
    const sessionId = `session-${meeting.id}`

    const frontmatter: MemoryFrontmatter = {
      id: sessionId,
      type: 'session',
      createdAt: meeting.createdAt,
      meetingId: meeting.id,
      topic: meeting.topic,
      status: meeting.status,
      budget: meeting.budget,
      usage: meeting.usage,
    }

    const content = this.formatSessionContent(meeting)

    await this.store.writeMemory('session', sessionId, frontmatter, content)
  }

  /**
   * Format session content as markdown
   */
  private formatSessionContent(meeting: Meeting): string {
    let content = `# ${meeting.topic}\n\n`
    content += `**Meeting ID:** ${meeting.id}\n`
    content += `**Status:** ${meeting.status}\n`
    content += `**Started:** ${new Date(meeting.createdAt).toLocaleString('zh-CN')}\n`
    if (meeting.completedAt) {
      content += `**Completed:** ${new Date(meeting.completedAt).toLocaleString('zh-CN')}\n`
    }
    content += `\n`

    // Messages
    content += `## Discussion\n\n`
    for (const message of meeting.messages) {
      const timestamp = new Date(message.timestamp).toLocaleTimeString('zh-CN')
      content += `### [${timestamp}] ${message.role}\n\n`
      content += `${message.content}\n\n`
    }

    // Artifacts
    if (Object.keys(meeting.artifacts).length > 0) {
      content += `## Artifacts\n\n`
      for (const [key, artifact] of Object.entries(meeting.artifacts)) {
        content += `### ${this.capitalizeFirst(key)}\n\n`
        content += `${JSON.stringify(artifact, null, 2)}\n\n`
      }
    }

    return content
  }

  /**
   * Extract and store decisions from a meeting
   */
  async extractDecisions(meeting: Meeting): Promise<void> {
    if (!meeting.artifacts.finalDecision) {
      return
    }

    const decisionId = `decision-${meeting.id}-${Date.now()}`

    const frontmatter: MemoryFrontmatter = {
      id: decisionId,
      type: 'decision',
      createdAt: new Date().toISOString(),
      meetingId: meeting.id,
      topic: meeting.topic,
    }

    const decision = meeting.artifacts.finalDecision
    const content = `# Decision: ${decision.decision}\n\n`
      + `**Topic:** ${meeting.topic}\n`
      + `**Date:** ${new Date(meeting.completedAt || meeting.createdAt).toLocaleDateString('zh-CN')}\n\n`
      + `## Reasoning\n\n${decision.reasoning}\n\n`
      + `## Next Steps\n\n${decision.nextSteps.map((step: string) => `- ${step}`).join('\n')}\n`

    await this.store.writeMemory('decision', decisionId, frontmatter, content)
  }

  /**
   * Extract and learn from a meeting
   */
  async extractLearnings(meeting: Meeting): Promise<void> {
    // This is a simplified version - in production, use AI to extract learnings
    const learnings: string[] = []

    // Example patterns to learn from
    if (meeting.usage > meeting.budget * 0.9) {
      learnings.push('High token usage - consider shorter contexts or more efficient prompts')
    }

    if (meeting.degradation && meeting.degradation !== 'none') {
      learnings.push(`Meeting experienced ${meeting.degradation} degradation - adjust budget or simplify流程`)
    }

    for (const learning of learnings) {
      const learningId = `learning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const frontmatter: MemoryFrontmatter = {
        id: learningId,
        type: 'learning',
        createdAt: new Date().toISOString(),
        category: 'meeting-efficiency',
      }

      const content = `# ${learning}\n\n`
        + `**Context:** Meeting "${meeting.topic}"\n`
        + `**Date:** ${new Date(meeting.createdAt).toLocaleDateString('zh-CN')}\n\n`
        + `## Application\n\n`
        + `This learning applies to future meetings to improve efficiency.\n`

      await this.store.writeMemory('learning', learningId, frontmatter, content)
    }
  }

  /**
   * Get relevant context for a new meeting
   */
  async getRelevantContext(topic: string, roles: string[]): Promise<{
    decisions: string[]
    learnings: string[]
    patterns: string[]
  }> {
    const decisions: string[] = []
    const learnings: string[] = []
    const patterns: string[] = []

    // Search for relevant memories
    const relevantMemories = await this.store.searchMemories(topic, ['decision', 'learning', 'pattern'])

    for (const memory of relevantMemories) {
      switch (memory.frontmatter.type) {
        case 'decision':
          decisions.push(`- ${memory.content.split('\n')[0]}`) // Use heading
          break
        case 'learning':
          learnings.push(`- ${memory.content.split('\n')[0]}`)
          break
        case 'pattern':
          patterns.push(`- ${memory.content.split('\n')[0]}`)
          break
      }
    }

    return { decisions, learnings, patterns }
  }

  /**
   * Get recent sessions for context
   */
  async getRecentSessions(count = 5): Promise<SessionMemory[]> {
    const memories = await this.store.listMemories('session')
    return memories.slice(0, count).map((m) => ({
      id: m.frontmatter.id as string,
      meetingId: m.frontmatter.meetingId as string,
      topic: m.frontmatter.topic as string,
      startedAt: m.frontmatter.createdAt as string,
      participants: [],
      messages: [],
      artifacts: {},
      outcome: '',
    }))
  }

  /**
   * Get all decisions
   */
  async getDecisions(): Promise<DecisionMemory[]> {
    const memories = await this.store.listMemories('decision')
    return memories.map((m) => ({
      id: m.frontmatter.id as string,
      date: m.frontmatter.createdAt as string,
      meetingId: m.frontmatter.meetingId as string,
      topic: m.frontmatter.topic as string,
      decision: m.content.split('\n')[0].replace('# Decision: ', ''),
      reasoning: '',
      stakeholders: [],
    }))
  }

  /**
   * Get all learnings
   */
  async getLearnings(): Promise<LearningMemory[]> {
    const memories = await this.store.listMemories('learning')
    return memories.map((m) => ({
      id: m.frontmatter.id as string,
      date: m.frontmatter.createdAt as string,
      category: m.frontmatter.category as string,
      lesson: m.content.split('\n')[0].replace('# ', ''),
      context: '',
      applicableRoles: [],
    }))
  }

  /**
   * Helper: Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}

// Singleton instance
let managerInstance: MemoryManager | null = null

export function getMemoryManager(): MemoryManager {
  if (!managerInstance) {
    managerInstance = new MemoryManager()
  }
  return managerInstance
}
