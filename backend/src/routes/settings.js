import express from 'express'
import { getKeyStore, setKeys, getKeyStatus } from '../services/llm/keyStore.js'
import { ProviderFactory } from '../services/llm/providerFactory.js'

const router = express.Router()

// GET /api/settings/status - Get API key status (masked)
router.get('/status', async (req, res) => {
  try {
    const status = getKeyStatus()

    // Also get available models
    const models = await ProviderFactory.getAllModels()

    res.json({
      keys: status,
      models,
      defaultProvider: process.env.DEFAULT_PROVIDER || 'anthropic',
      defaultModel: process.env.DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
    })
  } catch (error) {
    console.error('Error getting settings status:', error)
    res.status(500).json({ error: 'Failed to get settings status' })
  }
})

// GET /api/settings - Get current settings (with masked keys for security)
router.get('/', (req, res) => {
  try {
    const status = getKeyStatus()
    res.json(status)
  } catch (error) {
    console.error('Error getting settings:', error)
    res.status(500).json({ error: 'Failed to get settings' })
  }
})

// PUT /api/settings - Update API keys
router.put('/', async (req, res) => {
  try {
    const { openaiApiKey, anthropicApiKey, glmApiKey, deepseekApiKey, ollamaBaseUrl, glmBaseUrl, deepseekBaseUrl } = req.body

    const updates = {}
    if (openaiApiKey !== undefined) updates.openaiApiKey = openaiApiKey
    if (anthropicApiKey !== undefined) updates.anthropicApiKey = anthropicApiKey
    if (glmApiKey !== undefined) updates.glmApiKey = glmApiKey
    if (deepseekApiKey !== undefined) updates.deepseekApiKey = deepseekApiKey
    if (ollamaBaseUrl !== undefined) updates.ollamaBaseUrl = ollamaBaseUrl
    if (glmBaseUrl !== undefined) updates.glmBaseUrl = glmBaseUrl
    if (deepseekBaseUrl !== undefined) updates.deepseekBaseUrl = deepseekBaseUrl

    await setKeys(updates)

    // Clear provider cache to force reload with new keys
    ProviderFactory.clearCache()

    const status = getKeyStatus()
    res.json({
      success: true,
      keys: status,
      message: 'Settings updated successfully',
    })
  } catch (error) {
    console.error('Error updating settings:', error)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

// POST /api/settings/test - Test API key
router.post('/test', async (req, res) => {
  try {
    const { provider, apiKey, model } = req.body

    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'Provider and apiKey are required' })
    }

    // Temporarily set the key to test
    const keyMap = {
      openai: 'openaiApiKey',
      anthropic: 'anthropicApiKey',
      glm: 'glmApiKey',
      deepseek: 'deepseekApiKey',
    }

    const keyName = keyMap[provider]
    if (!keyName) {
      return res.status(400).json({ error: `Invalid provider: ${provider}` })
    }

    await setKeys({ [keyName]: apiKey })

    // Try to create a provider and check if it's configured
    const testProvider = ProviderFactory.getProvider({
      type: provider,
      model: model || 'test',
    })

    const isConfigured = testProvider.isConfigured()

    res.json({
      success: isConfigured,
      message: isConfigured
        ? `${provider} API key is valid`
        : `${provider} API key is invalid or not configured`,
    })
  } catch (error) {
    console.error('Error testing API key:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test API key',
    })
  }
})

export default router
