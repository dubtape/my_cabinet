/**
 * Memory Fusion Tests
 */

import { describe, it, expect, beforeEach } from '@types/node'
import { getContextRetriever } from '../src/services/memory/contextRetriever.js'
import { getMarkdownStore } from '../src/services/memory/markdownStore.js'
import type { MemoryQuery } from '../src/services/memory/types.js'

describe('Context Retriever', () => {
  let retriever: any
  let store: any

  beforeEach(async () => {
    retriever = getContextRetriever()
    store = getMarkdownStore()

    // Setup test data
    await setupTestMemories()
  })

  async function setupTestMemories() {
    // Create a test decision
    await store.writeMemory('decision', 'test-decision-1', {
      id: 'test-decision-1',
      type: 'decision',
      meetingId: 'test-meeting-1',
      topic: 'Test policy',
      date: '2024-01-01',
      decisionMaker: 'PRIME',
      impact: 'high',
      category: 'policy',
    }, 'Test decision content')

    // Create a test learning
    await store.writeMemory('learning', 'test-learning-1', {
      id: 'test-learning-1',
      type: 'learning',
      date: '2024-01-15',
      category: 'implementation',
      lesson: 'Test lesson',
    }, 'Test learning content')
  }

  describe('Context Retrieval', () => {
    it('should retrieve context by topic', async () => {
      const query: MemoryQuery = {
        topic: 'Test policy',
        limit: 5,
        minRelevance: 0.5,
      }

      const result = await retriever.retrieveContext(query)

      expect(result.items).toBeDefined()
      expect(result.items.length).toBeGreaterThan(0)
      expect(result.totalTokens).toBeLessThanOrEqual(3000)
    })

    it('should retrieve context by roles', async () => {
      const query: MemoryQuery = {
        roles: ['PRIME', 'FINANCE'],
        limit: 5,
        minRelevance: 0.5,
      }

      const result = await retriever.retrieveContext(query)

      expect(result.items).toBeDefined()
      expect(result.compressed).toBe(false)
    })
  })

  describe('Relevance Calculation', () => {
    it('should calculate relevance for topic match', async () => {
      const query: MemoryQuery = {
        topic: 'Test policy',
        limit: 5,
      }

      const result = await retriever.retrieveContext(query)

      // Should find the test decision with high relevance
      const testDecision = result.items.find((item: any) =>
        item.source === 'test-decision-1'
      )

      expect(testDecision).toBeDefined()
      expect(testDecision.relevance).toBeGreaterThan(0.3)
    })

    it('should prioritize recent memories', async () => {
      // Create an old memory
      await store.writeMemory('decision', 'old-decision', {
        id: 'old-decision',
        type: 'decision',
        meetingId: 'old-meeting',
        topic: 'Old topic',
        date: '2020-01-01',
        decisionMaker: 'PRIME',
        impact: 'low',
        category: 'policy',
      }, 'Old decision content')

      const query: MemoryQuery = {
        topic: 'Old topic',
        limit: 5,
      }

      const result = await retriever.retrieveContext(query)

      // Old memory should have lower relevance due to time decay
      const oldMemory = result.items.find((item: any) => item.source === 'old-decision')
      if (oldMemory) {
        expect(oldMemory.relevance).toBeLessThan(0.9)
      }
    })
  })

  describe('Context Package Building', () => {
    it('should build formatted context package', async () => {
      const query: MemoryQuery = {
        topic: 'Test policy',
        limit: 3,
      }

      const contextPackage = await retriever.buildContextPackage(query)

      expect(contextPackage.content).toBeDefined()
      expect(contextPackage.tokens).toBeGreaterThan(0)
      expect(contextPackage.tokens).toBeLessThanOrEqual(3000)
      expect(contextPackage.frontmatter.type).toBe('context_package')
    })

    it('should limit context size', async () => {
      const query: MemoryQuery = {
        topic: 'Test',
        limit: 10,
      }

      const contextPackage = await retriever.buildContextPackage(query)

      // Should respect token limit
      expect(contextPackage.tokens).toBeLessThanOrEqual(3000)
    })
  })

  describe('Integration', () => {
    it('should handle empty results gracefully', async () => {
      const query: MemoryQuery = {
        topic: 'Nonexistent topic xyz',
        limit: 5,
      }

      const result = await retriever.retrieveContext(query)

      expect(result.items).toEqual([])
      expect(result.totalTokens).toBe(0)
    })

    it('should format context as completion messages', async () => {
      const query: MemoryQuery = {
        topic: 'Test policy',
        limit: 2,
      }

      const result = await retriever.retrieveContext(query)

      const messages = retriever['formatAsCompletionMessages'](result.items)

      expect(messages).toBeInstanceOf(Array)
      expect(messages.length).toBeGreaterThan(0)

      // First message should be system introduction
      expect(messages[0].role).toBe('system')

      // Should have content
      messages.forEach(msg => {
        expect(msg.content).toBeDefined()
        expect(msg.content.length).toBeGreaterThan(0)
      })
    })
  })
})
