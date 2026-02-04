/**
 * GLM (ZhipuAI) Provider Implementation
 * Supports GLM-4, GLM-4-Air, and other ZhipuAI models
 */

import type {
  CompletionMessage,
  CompletionParams,
  CompletionResponse,
  CompletionChunk,
  ModelInfo,
} from './base.js'
import { LLMProvider } from './base.js'

interface GLMConfig {
  apiKey: string
  baseURL?: string
}

interface GLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GLMResponse {
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

interface GLMStreamChunk {
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

export class GLMProvider extends LLMProvider {
  readonly name = 'GLM'
  readonly type = 'glm' as const
  private apiKey: string
  private baseURL: string
  private models: ModelInfo[] = [
    {
      id: 'glm-4',
      name: 'GLM-4',
      provider: 'glm',
      contextLength: 128000,
      supportsStreaming: true,
    },
    {
      id: 'glm-4-air',
      name: 'GLM-4 Air',
      provider: 'glm',
      contextLength: 128000,
      supportsStreaming: true,
    },
    {
      id: 'glm-4-flash',
      name: 'GLM-4 Flash',
      provider: 'glm',
      contextLength: 128000,
      supportsStreaming: true,
    },
    {
      id: 'glm-4-long',
      name: 'GLM-4 Long',
      provider: 'glm',
      contextLength: 1000000,
      supportsStreaming: true,
    },
  ]

  constructor(config: GLMConfig) {
    super()
    this.apiKey = config.apiKey
    this.baseURL = config.baseURL || 'https://open.bigmodel.cn/api/paas/v4'
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  private convertMessages(messages: CompletionMessage[]): GLMMessage[] {
    return messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }))
  }

  async complete(params: CompletionParams): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new Error('GLM API key not configured. Please set GLM_API_KEY.')
    }

    try {
      const messages = this.convertMessages(params.messages)

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: params.model || 'glm-4',
          messages,
          temperature: params.temperature ?? 0.7,
          max_tokens: params.maxTokens ?? 2000,
          stream: false,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`GLM API error (${response.status}): ${errorText}`)
      }

      const data: GLMResponse = await response.json()

      const choice = data.choices[0]
      if (!choice) {
        throw new Error('No response from GLM')
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
        throw new Error(`GLM API error: ${error.message}`)
      }
      throw error
    }
  }

  async *streamComplete(params: CompletionParams): AsyncGenerator<CompletionChunk> {
    if (!this.apiKey) {
      throw new Error('GLM API key not configured. Please set GLM_API_KEY.')
    }

    try {
      const messages = this.convertMessages(params.messages)

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: params.model || 'glm-4',
          messages,
          temperature: params.temperature ?? 0.7,
          max_tokens: params.maxTokens ?? 2000,
          stream: true,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`GLM API error (${response.status}): ${errorText}`)
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
            const chunk: GLMStreamChunk = JSON.parse(data)
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
        throw new Error(`GLM streaming error: ${error.message}`)
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
