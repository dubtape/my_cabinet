/**
 * End-to-End Memory Integration Test
 */

import { describe, it, expect, beforeAll } from '@types/node'
import { getMeetingSummarizer } from '../src/services/memory/meetingSummarizer.js'
import { getContextRetriever } from '../src/services/memory/contextRetriever.js'
import { getContextCompressor } from '../src/services/memory/contextCompressor.js'
import type { Meeting } from '../src/models/index.js'

describe('Memory Integration E2E', () => {
  let testMeeting: Meeting

  beforeAll(() => {
    // Create a test meeting
    testMeeting = {
      id: 'test-e2e-meeting',
      topic: '实施新的环保政策',
      description: '讨论是否实施新的环保政策',
      status: 'completed' as const,
      budget: 15000,
      usage: 12500,
      createdAt: '2025-02-04T10:00:00.000Z',
      completedAt: '2025-02-04T10:30:00.000Z',
      messages: [
        {
          id: 'msg-1',
          timestamp: '2025-02-04T10:00:10.000Z',
          role: 'SYSTEM',
          type: 'system',
          content: '进入阶段: ISSUE_BRIEF',
        },
        {
          id: 'msg-2',
          timestamp: '2025-02-04T10:00:15.000Z',
          role: 'PRIME',
          type: 'statement',
          content: '议题简报：实施新的环保政策具有重要意义，可以从经济、社会、环境多角度评估...',
        },
        {
          id: 'msg-3',
          timestamp: '2025-02-04T10:05:00.000Z',
          role: 'CRITIC',
          type: 'statement',
          content: '从批评者角度，需要更多数据支持政策的必要性和可行性...',
        },
        {
          id: 'msg-4',
          timestamp: '2025-02-04T10:06:00.000Z',
          role: 'FINANCE',
          type: 'statement',
          content: '从财政角度，环保政策可以开辟新的收入来源...',
        },
        {
          id: 'msg-5',
          timestamp: '2025-02-04T10:07:00.000Z',
          role: 'BRAIN',
          type: 'statement',
          content: '主脑分析：共识：都有必要实施，分歧在于时机和力度...',
        },
        {
          id: 'msg-6',
          timestamp: '2025-02-04T10:15:00.000Z',
          role: 'PRIME',
          type: 'statement',
          content: '群主总结：核心观点：支持实施；共识：分阶段推进；分歧：立即实施 vs 延迟...',
        },
        {
          id: 'msg-7',
          timestamp: '2025-02-04T10:20:00.000Z',
          role: 'PRIME',
          type: 'statement',
          content: '最终决策：采用分阶段实施策略，先试点后推广...',
        },
      ],
      artifacts: {
        finalDecision: {
          decision: '采用分阶段实施策略',
          reasoning: '平衡各方关切，降低实施风险',
          nextSteps: ['制定试点方案', '建立评估机制', '三个月后全面推广'],
        },
        brainAnalysis: {
          analysis: 'BRAIN 分析结果',
          consensus: ['都有必要实施', '分阶段推进'],
          disagreements: ['实施时机', '政策力度'],
        },
      },
      degradation: undefined,
    }
  })

  describe('Complete Meeting Lifecycle', () => {
    it('should generate all summaries after meeting', async () => {
      const summarizer = getMeetingSummarizer()
      const summaries = await summarizer.generateMeetingSummaries(testMeeting)

      expect(summaries.meetingSummary).toBeDefined()
      expect(summaries.meetingSummary.type).toBe('meeting_summary')
      expect(summaries.decisionSummary).toBeDefined()
      expect(summaries.controversies).toBeDefined()
      expect(summaries.controversies.length).toBeGreaterThan(0)
    })

    it('should retrieve relevant context for new meeting', async () => {
      const retriever = getContextRetriever()

      const contextPackage = await retriever.buildContextPackage({
        topic: '环保政策',
        roles: ['PRIME', 'FINANCE'],
        limit: 5,
      })

      expect(contextPackage.content).toBeDefined()
      expect(contextPackage.tokens).toBeGreaterThan(0)
    })

    it('should compress long message history', async () => {
      const compressor = getContextCompressor()

      // Create a long message history
      const longMessages: any[] = Array.from({ length: 25 }, (_, i) => ({
        id: `msg-${i}`,
        timestamp: '2025-02-04T10:00:00.000Z',
        role: i % 2 === 0 ? 'CRITIC' : 'FINANCE',
        type: 'statement',
        content: `Long message ${i} with substantial content that needs compression. `.repeat(100),
      }))

      const compressed = await compressor.compress(longMessages)

      expect(compressed.length).toBeLessThan(longMessages.length)
      expect(compressed.some((m: any) => m.type === 'compressed')).toBe(true)
    })

    it('should integrate compression with retrieval', async () => {
      const compressor = getContextCompressor()

      const longMeeting: Meeting = {
        ...testMeeting,
        messages: Array.from({ length: 30 }, (_, i) => ({
          id: `msg-${i}`,
          timestamp: '2025-02-04T10:00:00.000Z',
          role: 'TEST',
          type: 'statement',
          content: 'Test message '.repeat(50),
        })),
      }

      // Check if compression is needed
      const needsCompression = compressor['needsCompression'](longMeeting.messages)
      expect(needsCompression).toBe(true)

      // Compress
      const compressed = await compressor.compressIfNeeded(longMeeting)

      // Should return compressed messages
      expect(compressed.length).toBeLessThan(longMeeting.messages.length)
    })
  })

  describe('Memory Persistence and Retrieval', () => {
    it('should persist and retrieve summaries correctly', async () => {
      const summarizer = getMeetingSummarizer()

      // Generate summaries
      const summaries = await summarizer.generateMeetingSummaries(testMeeting)

      // Retrieve meeting summary
      const retriever = getContextRetriever()
      const context = await retriever.retrieveContext({
        topic: testMeeting.topic,
        types: ['meeting_summary'],
        limit: 5,
      })

      expect(context.items).toBeDefined()
      // Should find the newly created summary
      expect(context.items.some((item: any) =>
        item.frontmatter.meetingId === testMeeting.id
      )
    })
  })

  describe('Token Budget Management', () => {
    it('should respect token limits in context packages', async () => {
      const retriever = getContextRetriever()

      const contextPackage = await retriever.buildContextPackage({
        topic: testMeeting.topic,
        limit: 10, // Large limit
        minRelevance: 0.1, // Low threshold
      })

      // Should still respect 3000 token limit
      expect(contextPackage.tokens).toBeLessThanOrEqual(3000)
    })

    it('should maintain context quality under compression', async () => {
      const compressor = getContextCompressor()

      const messages: any[] = Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}`,
        timestamp: '2025-02-04T10:00:00.000Z',
        role: ['CRITIC', 'FINANCE', 'WORKS'][i % 3],
        type: 'statement',
        content: `Important point ${i}: This message contains key information that should be preserved.`,
      }))

      const compressed = await compressor.compress(messages)
      const ratio = compressor.getCompressionRatio(messages, compressed)

      // Should achieve reasonable compression
      expect(ratio).toBeGreaterThan(1.2)
    })
  })
})
