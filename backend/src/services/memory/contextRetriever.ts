import { getMarkdownStore } from './markdownStore.js'
import type { MemoryQuery, MemoryRetrievalResult, ContextItem } from './types.js'
import type { CompletionMessage } from '../llm/providers/base.js'

/**
 * Context Retriever - Retrieves relevant memories for new meetings
 */
export class ContextRetriever {
  private store = getMarkdownStore()

  /**
   * Retrieve relevant context for a new meeting
   */
  async retrieveContext(query: MemoryQuery): Promise<MemoryRetrievalResult> {
    const items: any[] = []
    let totalTokens = 0
    const maxTokens = 3000
    const minRelevance = query.minRelevance || 0.6

    // 1. Retrieve meeting summaries (highest priority for context)
    const meetingSummaries = await this.store.listMemories('meeting_summary')
    for (const summary of meetingSummaries) {
      const relevance = this.calculateRelevance(query, summary)
      if (relevance >= minRelevance) {
        const tokens = this.estimateTokens(summary.content)
        if (totalTokens + tokens <= maxTokens) {
          items.push({
            type: 'meeting_summary',
            source: summary.frontmatter.id,
            relevance,
            summary: this.extractSummary(summary),
            metadata: summary.frontmatter,
          })
          totalTokens += tokens
        }
      }
    }

    // 2. Retrieve decisions (highest priority)
    const decisions = await this.store.listMemories('decision')
    for (const decision of decisions) {
      const relevance = this.calculateRelevance(query, decision)
      if (relevance >= minRelevance) {
        const tokens = this.estimateTokens(decision.content)
        if (totalTokens + tokens <= maxTokens) {
          items.push({
            type: 'previous_decision',
            source: decision.frontmatter.id,
            relevance,
            summary: this.extractSummary(decision),
            metadata: decision.frontmatter,
          })
          totalTokens += tokens
        }
      }
    }

    // 3. Retrieve controversies
    const controversies = await this.store.listMemories('controversy')
    for (const controversy of controversies) {
      const relevance = this.calculateRelevance(query, controversy)
      if (relevance >= minRelevance) {
        const tokens = this.estimateTokens(controversy.content)
        if (totalTokens + tokens <= maxTokens) {
          items.push({
            type: 'controversy',
            source: controversy.frontmatter.id,
            relevance,
            summary: this.extractSummary(controversy),
            metadata: controversy.frontmatter,
          })
          totalTokens += tokens
        }
      }
    }

    // 4. Retrieve learnings
    const learnings = await this.store.listMemories('learning')
    for (const learning of learnings) {
      const relevance = this.calculateRelevance(query, learning)
      if (relevance >= minRelevance) {
        const tokens = this.estimateTokens(learning.content)
        if (totalTokens + tokens <= maxTokens) {
          items.push({
            type: 'learning',
            source: learning.frontmatter.id,
            relevance,
            summary: this.extractSummary(learning),
            metadata: learning.frontmatter,
          })
          totalTokens += tokens
        }
      }
    }

    // Sort by relevance
    items.sort((a, b) => b.relevance - a.relevance)

    return {
      items,
      totalTokens,
      compressed: false,
      query,
    }
  }

  /**
   * Build context package for injection
   */
  async buildContextPackage(query: MemoryQuery): Promise<{
    frontmatter: any
    content: string
    tokens: number
  }> {
    const result = await this.retrieveContext(query)

    const contextId = `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    const content = this.formatContextPackage(result.items)

    const frontmatter = {
      id: contextId,
      type: 'context_package' as const,
      targetTopic: query.topic,
      targetRoles: query.roles,
      date: new Date().toISOString().split('T')[0],
      itemCount: result.items.length,
      totalTokens: result.totalTokens,
    }

    // Save context package for tracking
    await this.store.writeMemory('context_package', contextId, frontmatter, content)

    return {
      frontmatter,
      content,
      tokens: result.totalTokens,
    }
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(query: MemoryQuery, memory: any): number {
    let score = 0

    // Topic match (40%)
    if (query.topic) {
      const topicLower = query.topic.toLowerCase()
      const contentLower = memory.content.toLowerCase()
      if (contentLower.includes(topicLower)) {
        score += 0.4
      }
    }

    // Role match (30%)
    if (query.roles && memory.frontmatter.participants) {
      const matchingRoles = query.roles.filter(r => memory.frontmatter.participants.includes(r))
      if (matchingRoles.length > 0) {
        score += 0.3 * (matchingRoles.length / query.roles.length)
      }
    } else if (query.roles && memory.frontmatter.involvedRoles) {
      const matchingRoles = query.roles.filter(r => memory.frontmatter.involvedRoles.includes(r))
      if (matchingRoles.length > 0) {
        score += 0.3 * (matchingRoles.length / query.roles.length)
      }
    }

    // Type match (20%)
    if (query.types && query.types.includes(memory.frontmatter.type)) {
      score += 0.2
    }

    // Time decay (10%)
    const daysSince = (Date.now() - new Date(memory.frontmatter.date || memory.frontmatter.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    const timeScore = Math.max(0, 1 - daysSince / 365) // Valid for 1 year
    score += timeScore * 0.1

    return Math.min(1, score)
  }

  /**
   * Extract summary from memory
   */
  private extractSummary(memory: any): string {
    // Return first paragraph or first 200 chars
    const lines = memory.content.split('\n\n')
    if (lines.length > 0) {
      const firstLine = lines[0].substring(0, 200)
      return firstLine + (lines[0].length > 200 ? '...' : '')
    }
    return memory.content.substring(0, 200) + '...'
  }

  /**
   * Format context package as completion messages
   */
  formatAsCompletionMessages(items: ContextItem[]): CompletionMessage[] {
    const messages: CompletionMessage[] = []

    messages.push({
      role: 'system',
      content: `以下是相关的历史上下文，供参考：`,
    })

    for (const item of items) {
      const role = this.getRoleForType(item.type)
      messages.push({
        role,
        content: `[${item.type}] ${item.summary}\n(相关度: ${(item.relevance * 100).toFixed(0)}%)`,
      })
    }

    return messages
  }

  /**
   * Get role name for context type
   */
  private getRoleForType(type: string): string {
    const typeRoles: Record<string, string> = {
      'meeting_summary': 'SYSTEM',
      'previous_decision': 'SYSTEM',
      'controversy': 'SYSTEM',
      'learning': 'SYSTEM',
      'pattern': 'SYSTEM',
    }
    return typeRoles[type] || 'SYSTEM'
  }

  /**
   * Format context package for injection
   */
  private formatContextPackage(items: ContextItem[]): string {
    let content = '# 相关历史上下文\n\n'

    if (items.length === 0) {
      content += '无相关历史记录。\n'
      return content
    }

    // Group by type
    const grouped = new Map<string, ContextItem[]>()
    for (const item of items) {
      if (!grouped.has(item.type)) {
        grouped.set(item.type, [])
      }
      grouped.get(item.type)!.push(item)
    }

    // Output each group
    for (const [type, typeItems] of grouped) {
      content += `## ${this.getTypeLabel(type)}\n\n`
      for (const item of typeItems) {
        const metadata = item.metadata || {}
        content += `- **${item.summary}**\n`
        content += `  - 相关度: ${(item.relevance * 100).toFixed(0)}%\n`
        content += `  - 来源: ${metadata.date || metadata.createdAt || '未知'}\n`
      }
      content += '\n'
    }

    return content
  }

  /**
   * Get type label
   */
  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'meeting_summary': '会议摘要',
      'previous_decision': '历史决策',
      'controversy': '相关争议',
      'learning': '学习经验',
      'pattern': '模式识别',
    }
    return labels[type] || type
  }

  /**
   * Estimate tokens
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }
}

// Singleton instance
let retrieverInstance: ContextRetriever | null = null

export function getContextRetriever(): ContextRetriever {
  if (!retrieverInstance) {
    retrieverInstance = new ContextRetriever()
  }
  return retrieverInstance
}
