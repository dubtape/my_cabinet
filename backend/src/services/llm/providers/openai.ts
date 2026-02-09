import OpenAI from 'openai'
import type {
  CompletionMessage,
  CompletionParams,
  CompletionResponse,
  CompletionChunk,
  ModelInfo,
} from './base.js'
import { LLMProvider } from './base.js'

/**
 * OpenAI Provider Implementation
 * Supports GPT-4o, GPT-4o-mini, and other OpenAI models
 */
export class OpenAIProvider extends LLMProvider {
  readonly name = 'OpenAI'
  readonly type = 'openai' as const
  private client: OpenAI | null = null
  private models: ModelInfo[] = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      contextLength: 128000,
      supportsStreaming: true,
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      contextLength: 128000,
      supportsStreaming: true,
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      contextLength: 128000,
      supportsStreaming: true,
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      contextLength: 16385,
      supportsStreaming: true,
    },
  ]

  constructor(
    private apiKey?: string,
    private baseURL?: string,
    private timeout?: number
  ) {
    super()
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL,
        timeout,
        maxRetries: 3,
      })
    }
  }

  isConfigured(): boolean {
    return this.client !== null && !!this.apiKey
  }

  private isRetryableNetworkError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    const maybe = error as { code?: string; cause?: { code?: string } }
    const code = maybe.code || maybe.cause?.code
    return code === 'ECONNABORTED' || code === 'ECONNRESET' || code === 'ETIMEDOUT'
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      const maybe = error as Error & { code?: string; cause?: { code?: string } }
      const code = maybe.code || maybe.cause?.code
      return code ? `${error.message} [${code}]` : error.message
    }
    return String(error)
  }

  async complete(params: CompletionParams): Promise<CompletionResponse> {
    if (!this.client) {
      throw new Error('OpenAI client not configured. Please set OPENAI_API_KEY.')
    }

    let lastError: unknown
    const maxAttempts = 3

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await this.client.chat.completions.create({
          model: params.model || 'gpt-4o',
          messages: params.messages as Array<{ role: string; content: string }>,
          temperature: params.temperature ?? 0.7,
          max_tokens: params.maxTokens ?? 2000,
        })

        const choice = response.choices[0]
        if (!choice) {
          throw new Error('No response from OpenAI')
        }

        return {
          content: choice.message.content || '',
          usage: response.usage
            ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
              }
            : undefined,
          model: response.model,
        }
      } catch (error) {
        lastError = error
        if (!this.isRetryableNetworkError(error) || attempt === maxAttempts) {
          break
        }
        // Network jitter on upstream providers is common; retry with backoff.
        await this.sleep(300 * attempt)
      }
    }

    throw new Error(`OpenAI API error: ${this.formatError(lastError)}`)
  }

  async *streamComplete(params: CompletionParams): AsyncGenerator<CompletionChunk> {
    if (!this.client) {
      throw new Error('OpenAI client not configured. Please set OPENAI_API_KEY.')
    }

    try {
      const stream = await this.client.chat.completions.create({
        model: params.model || 'gpt-4o',
        messages: params.messages as Array<{ role: string; content: string }>,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 2000,
        stream: true,
      })

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || ''
        yield {
          content: delta,
          done: chunk.choices[0]?.finish_reason !== null,
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI streaming error: ${error.message}`)
      }
      throw error
    }
  }

  estimateTokens(text: string): number {
    // OpenAI uses tiktoken for accurate tokenization
    // For now, use character-based estimation
    return this.estimateTokensByChars(text)
  }

  getModels(): ModelInfo[] {
    return this.models
  }
}
