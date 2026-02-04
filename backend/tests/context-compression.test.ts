/**
 * Context Compressor Tests
 */

import { describe, it, expect, beforeEach } from '@types/node'
import { getContextCompressor } from '../src/services/memory/contextCompressor.js'
import type { Message } from '../src/models/index.js'

describe('ContextCompressor', () => {
  let compressor: any

  beforeEach(() => {
    compressor = getContextCompressor()
  })

  describe('Token Estimation', () => {
    it('should estimate tokens correctly', () => {
      const text = 'This is a test message with some content'
      const tokens = compressor['estimateTokens'](text)
      expect(tokens).toBeGreaterThan(0)
    })

    it('should estimate total tokens for messages', () => {
      const messages: Message[] = [
        { id: '1', timestamp: '2024-01-01', role: 'TEST', type: 'statement', content: 'Message 1' },
        { id: '2', timestamp: '2024-01-01', role: 'TEST', type: 'statement', content: 'Message 2' },
      ]
      const tokens = compressor['estimateTotalTokens'](messages)
      expect(tokens).toBeGreaterThan(0)
    })
  })

  describe('Compression Detection', () => {
    it('should not compress short history', () => {
      const messages: Message[] = Array.from({ length: 5 }, (_, i) => ({
        id: `msg-${i}`,
        timestamp: '2024-01-01',
        role: 'TEST',
        type: 'statement',
        content: `Short message ${i}`,
      }))
      const needsCompression = compressor['needsCompression'](messages)
      expect(needsCompression).toBe(false)
    })

    it('should detect need for compression', () => {
      // Create enough messages to exceed 8000 tokens
      const messages: Message[] = Array.from({ length: 30 }, (_, i) => ({
        id: `msg-${i}`,
        timestamp: '2024-01-01',
        role: 'TEST',
        type: 'statement',
        content: 'A'.repeat(300), // ~75 tokens each
      }))
      const needsCompression = compressor['needsCompression'](messages)
      expect(needsCompression).toBe(true)
    })
  })

  describe('Compression', () => {
    it('should compress long message history', async () => {
      const messages: Message[] = Array.from({ length: 25 }, (_, i) => ({
        id: `msg-${i}`,
        timestamp: '2024-01-01',
        role: i % 2 === 0 ? 'CRITIC' : 'FINANCE',
        type: 'statement',
        content: `Detailed message content for index ${i}. This message contains substantial information that should be compressed.`,
      }))

      const compressed = await compressor['compress'](messages)

      // Should return fewer messages
      expect(compressed.length).toBeLessThan(messages.length)

      // Should have at least one compressed message
      const hasCompressed = compressed.some(m => m.type === 'compressed')
      expect(hasCompressed).toBe(true)

      // Should preserve recent messages
      const recentMessages = compressed.slice(-5)
      expect(recentMessages).toHaveLength(5)
    })

    it('should preserve recent messages intact', async () => {
      const messages: Message[] = Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}`,
        timestamp: '2024-01-01',
        role: 'TEST',
        type: 'statement',
        content: `Message ${i}`,
      }))

      const compressed = await compressor['compress'](messages)

      // Last 5 messages should be unchanged
      const last5Original = messages.slice(-5)
      const last5Compressed = compressed.slice(-5)

      expect(last5Compressed).toEqual(last5Original)
    })

    it('should group messages by role in compression', async () => {
      const messages: Message[] = [
        { id: '1', timestamp: '2024-01-01', role: 'CRITIC', type: 'statement', content: 'CRITIC message 1' },
        { id: '2', timestamp: '2024-01-01', role: 'CRITIC', type: 'statement', content: 'CRITIC message 2' },
        { id: '3', timestamp: '2024-01-01', role: 'FINANCE', type: 'statement', content: 'FINANCE message 1' },
        { id: '4', timestamp: '2024-01-01', role: 'WORKS', type: 'statement', content: 'WORKS message 1' },
      ]

      const compressed = await compressor['compress'](messages)

      const compressedMsg = compressed.find(m => m.type === 'compressed')
      expect(compressedMsg).toBeDefined()
      expect(compressedMsg!.content).toContain('CRITIC')
      expect(compressedMsg!.content).toContain('FINANCE')
    })
  })

  describe('Compression Ratio', () => {
    it('should achieve reasonable compression ratio', async () => {
      const messages: Message[] = Array.from({ length: 30 }, (_, i) => ({
        id: `msg-${i}`,
        timestamp: '2024-01-01',
        role: 'TEST',
        type: 'statement',
        content: `Long message content ${i}. `.repeat(50), // 50 words
      }))

      const compressed = await compressor['compress'](messages)
      const ratio = compressor['getCompressionRatio'](messages, compressed)

      // Should reduce tokens by at least 30%
      expect(ratio).toBeGreaterThan(1.3)
    })
  })
})
