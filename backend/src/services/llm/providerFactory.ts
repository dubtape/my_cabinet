import { config } from 'dotenv'
import { OpenAIProvider } from './providers/openai.js'
import { AnthropicProvider } from './providers/anthropic.js'
import { OllamaProvider } from './providers/ollama.js'
import { GLMProvider } from './providers/glm.js'
import { DeepSeekProvider } from './providers/deepseek.js'
import type { LLMProvider } from './providers/base.js'
import type { ModelInfo } from './providers/base.js'
import { getKey } from './keyStore.js'

// Load environment variables
config()

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
        provider = new OpenAIProvider(getKey('openaiApiKey') || process.env.OPENAI_API_KEY)
        break
      case 'anthropic':
        provider = new AnthropicProvider(getKey('anthropicApiKey') || process.env.ANTHROPIC_API_KEY)
        break
      case 'ollama':
        provider = new OllamaProvider(
          getKey('ollamaBaseUrl') || process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
        )
        break
      case 'glm':
        provider = new GLMProvider({
          apiKey: getKey('glmApiKey') || process.env.GLM_API_KEY || '',
          baseURL: getKey('glmBaseUrl') || process.env.GLM_BASE_URL,
        })
        break
      case 'deepseek':
        provider = new DeepSeekProvider({
          apiKey: getKey('deepseekApiKey') || process.env.DEEPSEEK_API_KEY || '',
          baseURL: getKey('deepseekBaseUrl') || process.env.DEEPSEEK_BASE_URL,
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

/**
 * Convenience function to get the default provider
 */
export function getDefaultProvider(): LLMProvider {
  const defaultType = (process.env.DEFAULT_PROVIDER || 'anthropic') as
    | 'openai'
    | 'anthropic'
    | 'ollama'
    | 'glm'
    | 'deepseek'
  const defaultModel = process.env.DEFAULT_MODEL || 'claude-3-5-sonnet-20241022'

  return ProviderFactory.getProvider({
    type: defaultType,
    model: defaultModel,
  })
}

/**
 * Convenience function to get a provider for a specific role
 * Returns provider with role-specific model configuration
 */
export async function getRoleProvider(role: string): Promise<{ provider: LLMProvider; model: string; temperature: number; maxTokens: number }> {
  const { getRoleManager } = await import('../persona/roleManager.js')
  const roleManager = await getRoleManager()

  const roleInfo = roleManager.getRole(role.toLowerCase())
  if (roleInfo && roleInfo.modelConfig) {
    const provider = ProviderFactory.getProvider({
      type: roleInfo.modelConfig.provider,
      model: roleInfo.modelConfig.model,
    })

    return {
      provider,
      model: roleInfo.modelConfig.model,
      temperature: roleInfo.modelConfig.temperature,
      maxTokens: roleInfo.modelConfig.maxTokens,
    }
  }

  // Fallback to default
  const defaultType = (process.env.DEFAULT_PROVIDER || 'anthropic') as
    | 'openai'
    | 'anthropic'
    | 'ollama'
    | 'glm'
    | 'deepseek'
  const defaultModel = process.env.DEFAULT_MODEL || 'claude-3-5-sonnet-20241022'

  const provider = ProviderFactory.getProvider({
    type: defaultType,
    model: defaultModel,
  })

  return {
    provider,
    model: defaultModel,
    temperature: 0.7,
    maxTokens: 4096,
  }
}
