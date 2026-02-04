import { getMarkdownStore } from './markdownStore.js'
import type { Memory } from './markdownStore.js'

/**
 * Search result with relevance score
 */
export interface SearchResult extends Memory {
  score: number
}

/**
 * Retrieval options
 */
export interface RetrievalOptions {
  types?: Array<'session' | 'decision' | 'learning' | 'pattern'>
  limit?: number
  minScore?: number
}

/**
 * Memory Retrieval Service
 * Provides search and retrieval capabilities for memories
 */
export class MemoryRetrieval {
  private store = getMarkdownStore()

  /**
   * Simple keyword-based search
   * In production, consider using vector embeddings for semantic search
   */
  async search(query: string, options: RetrievalOptions = {}): Promise<SearchResult[]> {
    const {
      types = ['session', 'decision', 'learning', 'pattern', 'meeting_summary', 'controversy'],
      limit = 10,
      minScore = 0.1,
    } = options

    const results: SearchResult[] = []
    const queryLower = query.toLowerCase()
    const queryTerms = queryLower.split(/\s+/)

    for (const type of types) {
      const memories = await this.store.listMemories(type)

      for (const memory of memories) {
        const score = this.calculateRelevance(memory, queryTerms)

        if (score >= minScore) {
          results.push({ ...memory, score })
        }
      }
    }

    // Sort by score (highest first) and limit
    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  /**
   * Calculate relevance score based on keyword matching
   */
  private calculateRelevance(memory: Memory, queryTerms: string[]): number {
    let score = 0

    const text = `${JSON.stringify(memory.frontmatter)}\n${memory.content}`.toLowerCase()

    // Exact match bonus
    for (const term of queryTerms) {
      if (text.includes(term)) {
        score += 1
      }

      // Title/frontmatter matches are weighted higher
      const frontmatterText = JSON.stringify(memory.frontmatter).toLowerCase()
      if (frontmatterText.includes(term)) {
        score += 0.5
      }
    }

    // Normalize by query length
    return score / queryTerms.length
  }

  /**
   * Get memories by date range
   */
  async getByDateRange(startDate: Date, endDate: Date, types?: Array<'session' | 'decision' | 'learning' | 'pattern'>): Promise<Memory[]> {
    const searchTypes = types || ['session', 'decision', 'learning', 'pattern']
    const results: Memory[] = []

    for (const type of searchTypes) {
      const memories = await this.store.listMemories(type)

      for (const memory of memories) {
        const createdAt = new Date(memory.frontmatter.createdAt as string)
        if (createdAt >= startDate && createdAt <= endDate) {
          results.push(memory)
        }
      }
    }

    return results.sort((a, b) => {
      const aDate = new Date(a.frontmatter.createdAt as string).getTime()
      const bDate = new Date(b.frontmatter.createdAt as string).getTime()
      return bDate - aDate
    })
  }

  /**
   * Get memories by tag
   */
  async getByTag(tag: string, types?: Array<'session' | 'decision' | 'learning' | 'pattern'>): Promise<Memory[]> {
    const searchTypes = types || ['session', 'decision', 'learning', 'pattern']
    const results: Memory[] = []

    for (const type of searchTypes) {
      const memories = await this.store.listMemories(type)

      for (const memory of memories) {
        const tags = memory.frontmatter.tags as string[] | undefined
        if (tags && tags.includes(tag)) {
          results.push(memory)
        }
      }
    }

    return results
  }

  /**
   * Get related memories
   */
  async getRelated(memoryId: string, limit = 5): Promise<Memory[]> {
    const memory = await this.store.readMemory('session', memoryId)
    if (!memory) {
      return []
    }

    // Extract keywords from the memory
    const text = memory.content.toLowerCase()
    const keywords = text
      .split(/\s+/)
      .filter((word) => word.length > 4)
      .slice(0, 10)

    // Search using these keywords
    const results = await this.search(keywords.join(' '), { limit })
    return results.filter((r) => r.frontmatter.id !== memoryId)
  }

  /**
   * Get context for a meeting topic
   */
  async getContextForTopic(topic: string): Promise<{
    decisions: Memory[]
    learnings: Memory[]
    patterns: Memory[]
  }> {
    const [decisions, learnings, patterns] = await Promise.all([
      this.search(topic, { types: ['decision'] }),
      this.search(topic, { types: ['learning'] }),
      this.search(topic, { types: ['pattern'] }),
    ])

    return {
      decisions: decisions.slice(0, 3),
      learnings: learnings.slice(0, 3),
      patterns: patterns.slice(0, 3),
    }
  }
}

// Singleton instance
let retrievalInstance: MemoryRetrieval | null = null

export function getMemoryRetrieval(): MemoryRetrieval {
  if (!retrievalInstance) {
    retrievalInstance = new MemoryRetrieval()
  }
  return retrievalInstance
}
