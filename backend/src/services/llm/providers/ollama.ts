import ollama from 'ollama'
import type {
  CompletionMessage,
  CompletionParams,
  CompletionResponse,
  CompletionChunk,
  ModelInfo,
} from './base.js'
import { LLMProvider } from './base.js'

/**
 * Ollama Provider Implementation
 * Supports local models like Llama 3.1, Mistral, etc.
 */
export class OllamaProvider extends LLMProvider {
  readonly name = 'Ollama'
  readonly type = 'ollama' as const
  private baseUrl: string
  private cachedModels: ModelInfo[] = []

  constructor(baseUrl = 'http://localhost:11434') {
    super()
    this.baseUrl = baseUrl
  }

  isConfigured(): boolean {
    // Ollama doesn't require API keys, just check if server is accessible
    return true
  }

  private convertMessages(messages: CompletionMessage[]): Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }> {
    return messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }))
  }

  async complete(params: CompletionParams): Promise<CompletionResponse> {
    try {
      const messages = this.convertMessages(params.messages)

      const response = await ollama.chat({
        model: params.model || 'llama3.1',
        messages: messages,
        options: {
          temperature: params.temperature ?? 0.7,
          num_predict: params.maxTokens ?? 2000,
        },
        stream: false,
      })

      return {
        content: response.message.content,
        usage: response.prompt_eval && response.eval_duration
          ? {
              promptTokens: response.prompt_eval,
              completionTokens: response.eval_count || 0,
              totalTokens: (response.prompt_eval || 0) + (response.eval_count || 0),
            }
          : undefined,
        model: params.model || 'llama3.1',
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Ollama API error: ${error.message}`)
      }
      throw error
    }
  }

  async *streamComplete(params: CompletionParams): AsyncGenerator<CompletionChunk> {
    try {
      const messages = this.convertMessages(params.messages)

      const stream = await ollama.chat({
        model: params.model || 'llama3.1',
        messages: messages,
        options: {
          temperature: params.temperature ?? 0.7,
          num_predict: params.maxTokens ?? 2000,
        },
        stream: true,
      })

      for await (const chunk of stream) {
        if (chunk.done) {
          yield {
            content: '',
            done: true,
            usage: chunk.prompt_eval && chunk.eval_count
              ? {
                  promptTokens: chunk.prompt_eval,
                  completionTokens: chunk.eval_count,
                  totalTokens: chunk.prompt_eval + chunk.eval_count,
                }
              : undefined,
          }
        } else if (chunk.message?.content) {
          yield {
            content: chunk.message.content,
            done: false,
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Ollama streaming error: ${error.message}`)
      }
      throw error
    }
  }

  estimateTokens(text: string): number {
    // Ollama models vary, use character-based estimation
    return this.estimateTokensByChars(text)
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await ollama.list()
      this.cachedModels = response.models.map((model) => ({
        id: model.name,
        name: model.name,
        provider: 'ollama',
        contextLength: model.details?.context_length || 128000,
        supportsStreaming: true,
      }))
      return this.cachedModels
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error)
      // Return default models if fetch fails
      return [
        {
          id: 'llama3.1',
          name: 'Llama 3.1',
          provider: 'ollama',
          contextLength: 128000,
          supportsStreaming: true,
        },
        {
          id: 'llama3.1:70b',
          name: 'Llama 3.1 70B',
          provider: 'ollama',
          contextLength: 128000,
          supportsStreaming: true,
        },
      ]
    }
  }

  // Override to return async
  getModelsSync(): ModelInfo[] {
    return this.cachedModels.length > 0
      ? this.cachedModels
      : [
          {
            id: 'llama3.1',
            name: 'Llama 3.1',
            provider: 'ollama',
            contextLength: 128000,
            supportsStreaming: true,
          },
        ]
  }
}
