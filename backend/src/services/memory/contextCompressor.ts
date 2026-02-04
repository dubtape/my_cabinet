import type { Message, Meeting } from '../../models/index.js'
import type { CompressedMessage } from './types.js'

/**
 * Context Compressor - Compresses long message history
 */
export class ContextCompressor {
  private readonly TOKEN_THRESHOLD = 8000
  private readonly PRESERVE_RECENT = 5
  private readonly PRESERVE_EARLY_SUMMARY = 3

  /**
   * Compress message history if needed
   */
  async compressIfNeeded(meeting: Meeting): Promise<Message[]> {
    const tokenCount = this.estimateTotalTokens(meeting.messages)

    if (tokenCount <= this.TOKEN_THRESHOLD) {
      return meeting.messages // No compression needed
    }

    console.log(`Compressing context: ${tokenCount} tokens > ${this.TOKEN_THRESHOLD} threshold`)

    return await this.compress(meeting.messages)
  }

  /**
   * Compress message history
   */
  async compress(messages: Message[]): Promise<Message[]> {
    if (messages.length <= this.PRESERVE_RECENT + 2) {
      return messages // Too short to compress
    }

    const result: Message[] = []

    // 1. Keep early system messages
    const earlySystemMessages = messages.filter(m =>
      m.type === 'system' && messages.indexOf(m) < this.PRESERVE_EARLY_SUMMARY
    )
    result.push(...earlySystemMessages)

    // 2. Add compressed middle section
    const middleStart = this.PRESERVE_EARLY_SUMMARY
    const middleEnd = messages.length - this.PRESERVE_RECENT
    const middleMessages = messages.slice(middleStart, middleEnd)

    if (middleMessages.length > 0) {
      const compressed = await this.compressMiddleSection(middleMessages)
      result.push(compressed)
    }

    // 3. Keep recent messages intact
    const recentMessages = messages.slice(-this.PRESERVE_RECENT)
    result.push(...recentMessages)

    return result
  }

  /**
   * Compress middle section by role aggregation
   */
  private async compressMiddleSection(messages: Message[]): Promise<Message> {
    // Group by role
    const roleMessages = new Map<string, Message[]>()
    for (const message of messages) {
      if (message.type === 'system') continue

      if (!roleMessages.has(message.role)) {
        roleMessages.set(message.role, [])
      }
      roleMessages.get(message.role)!.push(message)
    }

    // Generate summary for each role
    const summaries: string[] = []
    for (const [role, msgs] of roleMessages) {
      const summary = await this.summarizeMessages(role, msgs)
      summaries.push(`**${role}**: ${summary}`)
    }

    // Extract key points
    const keyPoints = this.extractKeyPoints(messages)

    // Get time range
    const timeRange = {
      start: messages[0].timestamp,
      end: messages[messages.length - 1].timestamp,
    }

    return {
      id: `compressed-${Date.now()}`,
      timestamp: new Date().toISOString(),
      role: 'SYSTEM',
      type: 'compressed' as const,
      content: `[早期讨论摘要]\n\n${summaries.join('\n\n')}\n\n${keyPoints ? `\n[关键要点]\n${keyPoints}\n` : ''}`,
      metadata: {
        originalCount: messages.length,
        timeRange,
        compressionMethod: 'role_aggregated' as const,
      },
    }
  }

  /**
   * Summarize messages for a role
   */
  private async summarizeMessages(role: string, messages: Message[]): Promise<string> {
    if (messages.length === 0) return ''

    // Extract first 100 chars from each message
    const keyContents = messages
      .map(m => m.content.substring(0, 100).trim())
      .filter(c => c.length > 0)

    if (keyContents.length === 1) {
      return keyContents[0]
    }

    return keyContents.join(' | ')
  }

  /**
   * Extract key points from messages
   */
  private extractKeyPoints(messages: Message[]): string {
    const keyPoints: string[] = []

    for (const message of messages) {
      // Look for bullet points, numbered lists, etc.
      const lines = message.content.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.match(/^[-*•]\s+/) || trimmed.match(/^\d+\.\s+/)) {
          keyPoints.push(trimmed)
          if (keyPoints.length >= 5) break // Max 5 key points
        }
      }
      if (keyPoints.length >= 5) break
    }

    return keyPoints.join('\n')
  }

  /**
   * Estimate total tokens
   */
  private estimateTotalTokens(messages: Message[]): number {
    return messages.reduce((sum, m) => sum + this.estimateTokens(m.content), 0)
  }

  /**
   * Estimate tokens for text
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  /**
   * Check if compression is needed
   */
  needsCompression(messages: Message[]): boolean {
    return this.estimateTotalTokens(messages) > this.TOKEN_THRESHOLD
  }

  /**
   * Get compression ratio
   */
  getCompressionRatio(original: Message[], compressed: Message[]): number {
    const originalTokens = this.estimateTotalTokens(original)
    const compressedTokens = this.estimateTotalTokens(compressed)
    return originalTokens / compressedTokens
  }
}

// Singleton instance
let compressorInstance: ContextCompressor | null = null

export function getContextCompressor(): ContextCompressor {
  if (!compressorInstance) {
    compressorInstance = new ContextCompressor()
  }
  return compressorInstance
}
