import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import { OpenAIProvider } from './providers/openai.js'
import { AnthropicProvider } from './providers/anthropic.js'
import { OllamaProvider } from './providers/ollama.js'
import { GLMProvider } from './providers/glm.js'
import { DeepSeekProvider } from './providers/deepseek.js'
import type { LLMProvider } from './providers/base.js'
import type { ModelInfo } from './providers/base.js'

// Load environment variables from root .env first, then cwd .env
const envCandidates = [
  path.resolve(process.cwd(), '..', '.env'),
  path.resolve(process.cwd(), '.env'),
]
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate))
if (envPath) {
  config({ path: envPath, override: true })
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  type: 'openai' | 'anthropic' | 'ollama' | 'glm' | 'deepseek'
  model: string
  temperature?: number
  maxTokens?: number
}

/**
 * Factory class for creating LLM providers
 */
export class ProviderFactory {
  private static providers: Map<string, LLMProvider> = new Map()

  /**
   * Get or create a provider instance
   */
  static getProvider(config: ProviderConfig): LLMProvider {
    const cacheKey = `${config.type}:${config.model}`

    if (this.providers.has(cacheKey)) {
      return this.providers.get(cacheKey)!
    }

    let provider: LLMProvider

    switch (config.type) {
      case 'openai':
        provider = new OpenAIProvider(
          process.env.OPENAI_API_KEY,
          process.env.OPENAI_BASE_URL,
          process.env.OPENAI_TIMEOUT ? Number(process.env.OPENAI_TIMEOUT) : undefined
        )
        break
      case 'anthropic':
        provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY)
        break
      case 'ollama':
        provider = new OllamaProvider(
          process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
        )
        break
      case 'glm':
        provider = new GLMProvider({
          apiKey: process.env.GLM_API_KEY || '',
          baseURL: process.env.GLM_BASE_URL,
        })
        break
      case 'deepseek':
        provider = new DeepSeekProvider({
          apiKey: process.env.DEEPSEEK_API_KEY || '',
          baseURL: process.env.DEEPSEEK_BASE_URL,
        })
        break
      default:
        throw new Error(`Unsupported provider type: ${config.type}`)
    }

    this.providers.set(cacheKey, provider)
    return provider
  }

  /**
   * Get a provider with fallback support
   * Tries primary provider, falls back to alternatives if it fails
   */
  static async getProviderWithFallback(
    configs: ProviderConfig[]
  ): Promise<{ provider: LLMProvider; config: ProviderConfig }> {
    for (const config of configs) {
      try {
        const provider = this.getProvider(config)
        if (provider.isConfigured()) {
          return { provider, config }
        }
      } catch (error) {
        console.warn(`Provider ${config.type} not available:`, error)
      }
    }
    throw new Error('No configured provider available')
  }

  /**
   * Get all available models from all configured providers
   */
  static async getAllModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = []

    // Try each provider type
    const providerTypes: Array<'openai' | 'anthropic' | 'ollama' | 'glm' | 'deepseek'> =
      ['openai', 'anthropic', 'ollama', 'glm', 'deepseek']

    for (const type of providerTypes) {
      try {
        const provider = this.getProvider({ type, model: 'dummy' })
        if (provider.isConfigured()) {
          if (type === 'ollama') {
            const ollamaProvider = provider as any
            const providerModels = await ollamaProvider.getModels()
            models.push(...providerModels)
          } else {
            models.push(...provider.getModels())
          }
        }
      } catch (error) {
        // Skip unavailable providers
        console.debug(`Provider ${type} not available`)
      }
    }

    return models
  }

  /**
   * Clear cached providers (useful for testing)
   */
  static clearCache(): void {
    this.providers.clear()
  }
}

const PROVIDER_TYPES: Array<'openai' | 'anthropic' | 'ollama' | 'glm' | 'deepseek'> = [
  'openai',
  'anthropic',
  'glm',
  'deepseek',
  'ollama',
]

function isProviderConfigured(type: 'openai' | 'anthropic' | 'ollama' | 'glm' | 'deepseek'): boolean {
  switch (type) {
    case 'openai':
      return Boolean(process.env.OPENAI_API_KEY)
    case 'anthropic':
      return Boolean(process.env.ANTHROPIC_API_KEY)
    case 'glm':
      return Boolean(process.env.GLM_API_KEY)
    case 'deepseek':
      return Boolean(process.env.DEEPSEEK_API_KEY)
    case 'ollama':
      return Boolean(process.env.OLLAMA_BASE_URL || 'http://localhost:11434')
    default:
      return false
  }
}

function resolveProviderType(): 'openai' | 'anthropic' | 'ollama' | 'glm' | 'deepseek' {
  const fromEnv = process.env.DEFAULT_PROVIDER as 'openai' | 'anthropic' | 'ollama' | 'glm' | 'deepseek' | undefined
  if (fromEnv && PROVIDER_TYPES.includes(fromEnv) && isProviderConfigured(fromEnv)) {
    return fromEnv
  }

  const detected = PROVIDER_TYPES.find((type) => isProviderConfigured(type))
  return detected || 'openai'
}

function resolveProviderModel(type: 'openai' | 'anthropic' | 'ollama' | 'glm' | 'deepseek'): string {
  const explicit = process.env.DEFAULT_MODEL
  if (explicit) {
    return explicit
  }

  switch (type) {
    case 'openai':
      return process.env.OPENAI_MODEL || 'gpt-4o'
    case 'anthropic':
      return process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
    case 'glm':
      return process.env.GLM_MODEL || 'glm-4'
    case 'deepseek':
      return process.env.DEEPSEEK_MODEL || 'deepseek-chat'
    case 'ollama':
      return process.env.OLLAMA_MODEL || 'llama3.1:8b'
    default:
      return 'gpt-4o'
  }
}

/**
 * Convenience function to get the default provider
 */
export function getDefaultProvider(): LLMProvider {
  const defaultType = resolveProviderType()
  const defaultModel = resolveProviderModel(defaultType)

  return ProviderFactory.getProvider({
    type: defaultType,
    model: defaultModel,
  })
}

/**
 * Get a unified provider config for all roles from .env
 */
export async function getRoleProvider(_role: string): Promise<{ provider: LLMProvider; model: string; temperature: number; maxTokens: number }> {
  const defaultType = resolveProviderType()
  const defaultModel = resolveProviderModel(defaultType)
  const defaultTemperature = Number(process.env.DEFAULT_TEMPERATURE || '0.7')
  const defaultMaxTokens = Number(process.env.DEFAULT_MAX_TOKENS || '2000')

  const provider = ProviderFactory.getProvider({
    type: defaultType,
    model: defaultModel,
  })

  return {
    provider,
    model: defaultModel,
    temperature: Number.isFinite(defaultTemperature) ? defaultTemperature : 0.7,
    maxTokens: Number.isFinite(defaultMaxTokens) ? defaultMaxTokens : 2000,
  }
}
