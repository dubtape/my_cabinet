/**
 * DeepSeek Provider Implementation
 * Supports DeepSeek-V3, DeepSeek-R1, and other DeepSeek models
 */

import type {
  CompletionMessage,
  CompletionParams,
  CompletionResponse,
  CompletionChunk,
  ModelInfo,
} from './base.js'
import { LLMProvider } from './base.js'

interface DeepSeekConfig {
  apiKey: string
  baseURL?: string
}

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  model: string
}

interface DeepSeekStreamChunk {
  choices: Array<{
    delta: {
      content?: string
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export class DeepSeekProvider extends LLMProvider {
  readonly name = 'DeepSeek'
  readonly type = 'deepseek' as const
  private apiKey: string
  private baseURL: string
  private models: ModelInfo[] = [
    {
      id: 'deepseek-chat',
      name: 'DeepSeek-V3',
      provider: 'deepseek',
      contextLength: 64000,
      supportsStreaming: true,
    },
    {
      id: 'deepseek-reasoner',
      name: 'DeepSeek-R1',
      provider: 'deepseek',
      contextLength: 64000,
      supportsStreaming: true,
    },
  ]

  constructor(config: DeepSeekConfig) {
    super()
    this.apiKey = config.apiKey
    this.baseURL = config.baseURL || 'https://api.deepseek.com'
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  private convertMessages(messages: CompletionMessage[]): DeepSeekMessage[] {
    return messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }))
  }

  async complete(params: CompletionParams): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new Error('DeepSeek API key not configured. Please set DEEPSEEK_API_KEY.')
    }

    try {
      const messages = this.convertMessages(params.messages)

      const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: params.model || 'deepseek-chat',
          messages,
          temperature: params.temperature ?? 0.7,
          max_tokens: params.maxTokens ?? 2000,
          stream: false,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`DeepSeek API error (${response.status}): ${errorText}`)
      }

      const data: DeepSeekResponse = await response.json()

      const choice = data.choices[0]
      if (!choice) {
        throw new Error('No response from DeepSeek')
      }

      return {
        content: choice.message.content,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        model: data.model,
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`DeepSeek API error: ${error.message}`)
      }
      throw error
    }
  }

  async *streamComplete(params: CompletionParams): AsyncGenerator<CompletionChunk> {
    if (!this.apiKey) {
      throw new Error('DeepSeek API key not configured. Please set DEEPSEEK_API_KEY.')
    }

    try {
      const messages = this.convertMessages(params.messages)

      const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: params.model || 'deepseek-chat',
          messages,
          temperature: params.temperature ?? 0.7,
          max_tokens: params.maxTokens ?? 2000,
          stream: true,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`DeepSeek API error (${response.status}): ${errorText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue

          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') {
            yield { content: '', done: true }
            continue
          }

          try {
            const chunk: DeepSeekStreamChunk = JSON.parse(data)
            const delta = chunk.choices[0]?.delta

            if (delta?.content) {
              yield {
                content: delta.content,
                done: chunk.choices[0]?.finish_reason !== null,
                usage: chunk.usage ? {
                  promptTokens: chunk.usage.prompt_tokens,
                  completionTokens: chunk.usage.completion_tokens,
                  totalTokens: chunk.usage.total_tokens,
                } : undefined,
              }
            }
          } catch (e) {
            // Skip invalid JSON
            continue
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`DeepSeek streaming error: ${error.message}`)
      }
      throw error
    }
  }

  estimateTokens(text: string): number {
    return this.estimateTokensByChars(text)
  }

  getModels(): ModelInfo[] {
    return this.models
  }
}
