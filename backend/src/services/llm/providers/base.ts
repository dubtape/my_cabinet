/**
 * Base LLM Provider Interface
 * All LLM providers must implement this interface
 */

export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionParams {
  messages: CompletionMessage[]
  temperature?: number
  maxTokens?: number
  model?: string
}

export interface CompletionResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model: string
}

export interface CompletionChunk {
  content: string
  done: boolean
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  contextLength: number
  supportsStreaming: boolean
}

/**
 * Abstract base class for LLM providers
 */
export abstract class LLMProvider {
  abstract readonly name: string
  abstract readonly type: 'openai' | 'anthropic' | 'ollama' | 'glm' | 'deepseek'

  /**
   * Complete a prompt without streaming
   */
  abstract complete(params: CompletionParams): Promise<CompletionResponse>

  /**
   * Complete a prompt with streaming
   */
  abstract streamComplete(params: CompletionParams): AsyncGenerator<CompletionChunk>

  /**
   * Estimate token count for a text
   * This is an approximation and may not be accurate
   */
  abstract estimateTokens(text: string): number

  /**
   * Get list of available models
   */
  abstract getModels(): ModelInfo[]

  /**
   * Check if the provider is properly configured
   */
  abstract isConfigured(): boolean

  /**
   * Simple character-based token estimation (fallback)
   * Rough approximation: ~4 characters per token for English, ~2 for Chinese
   */
  protected estimateTokensByChars(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const otherChars = text.length - chineseChars
    return Math.ceil(chineseChars / 2 + otherChars / 4)
  }
}
