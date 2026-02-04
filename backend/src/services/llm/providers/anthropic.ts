import Anthropic from '@anthropic-ai/sdk'
import type {
  CompletionMessage,
  CompletionParams,
  CompletionResponse,
  CompletionChunk,
  ModelInfo,
} from './base.js'
import { LLMProvider } from './base.js'

/**
 * Anthropic Provider Implementation
 * Supports Claude 3.5 Sonnet, Claude 3 Haiku, and other Anthropic models
 */
export class AnthropicProvider extends LLMProvider {
  readonly name = 'Anthropic'
  readonly type = 'anthropic' as const
  private client: Anthropic | null = null
  private models: ModelInfo[] = [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      contextLength: 200000,
      supportsStreaming: true,
    },
    {
      id: 'claude-3-5-sonnet-20240620',
      name: 'Claude 3.5 Sonnet (June 2024)',
      provider: 'anthropic',
      contextLength: 200000,
      supportsStreaming: true,
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      contextLength: 200000,
      supportsStreaming: true,
    },
    {
      id: 'claude-3-sonnet-20240229',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      contextLength: 200000,
      supportsStreaming: true,
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      contextLength: 200000,
      supportsStreaming: true,
    },
  ]

  constructor(private apiKey?: string) {
    super()
    if (apiKey) {
      this.client = new Anthropic({ apiKey })
    }
  }

  isConfigured(): boolean {
    return this.client !== null && !!this.apiKey
  }

  private convertMessages(messages: CompletionMessage[]): Array<{
    role: 'user' | 'assistant'
    content: string
  }> {
    // Anthropic requires system message to be handled separately
    // For now, prepend system message to first user message
    const converted: Array<{ role: 'user' | 'assistant'; content: string }> = []
    let systemMessage = ''

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessage = msg.content
      } else if (msg.role === 'user') {
        converted.push({
          role: 'user',
          content: systemMessage ? `${systemMessage}\n\n${msg.content}` : msg.content,
        })
        systemMessage = '' // Reset after using
      } else {
        converted.push(msg as { role: 'user' | 'assistant'; content: string })
      }
    }

    return converted
  }

  async complete(params: CompletionParams): Promise<CompletionResponse> {
    if (!this.client) {
      throw new Error('Anthropic client not configured. Please set ANTHROPIC_API_KEY.')
    }

    try {
      const messages = this.convertMessages(params.messages)

      const response = await this.client.messages.create({
        model: params.model || 'claude-3-5-sonnet-20241022',
        messages: messages as Array<{ role: 'user' | 'assistant'; content: string }>,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 2000,
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic')
      }

      return {
        content: content.text,
        usage: response.usage
          ? {
              promptTokens: response.usage.input_tokens,
              completionTokens: response.usage.output_tokens,
              totalTokens: response.usage.input_tokens + response.usage.output_tokens,
            }
          : undefined,
        model: response.model,
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Anthropic API error: ${error.message}`)
      }
      throw error
    }
  }

  async *streamComplete(params: CompletionParams): AsyncGenerator<CompletionChunk> {
    if (!this.client) {
      throw new Error('Anthropic client not configured. Please set ANTHROPIC_API_KEY.')
    }

    try {
      const messages = this.convertMessages(params.messages)

      const stream = await this.client.messages.create({
        model: params.model || 'claude-3-5-sonnet-20241022',
        messages: messages as Array<{ role: 'user' | 'assistant'; content: string }>,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 2000,
        stream: true,
      })

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'text_delta') {
            yield {
              content: chunk.delta.text,
              done: false,
            }
          }
        } else if (chunk.type === 'message_stop') {
          yield {
            content: '',
            done: true,
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Anthropic streaming error: ${error.message}`)
      }
      throw error
    }
  }

  estimateTokens(text: string): number {
    // Anthropic uses a custom tokenizer
    // For now, use character-based estimation
    return this.estimateTokensByChars(text)
  }

  getModels(): ModelInfo[] {
    return this.models
  }
}
