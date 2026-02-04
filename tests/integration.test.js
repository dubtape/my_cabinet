import { describe, it } from 'node:test'
import assert from 'node:assert'

// Test utilities
import { getMarkdownStore } from '../backend/src/services/memory/markdownStore.js'
import { getMemoryManager } from '../backend/src/services/memory/memoryManager.js'
import { getPersonaLoader } from '../backend/src/services/persona/personaLoader.js'
import { getRoleManager } from '../backend/src/services/persona/roleManager.js'

describe('Memory System', () => {
  it('should create markdown store instance', () => {
    const store = getMarkdownStore()
    assert.ok(store)
  })

  it('should create memory manager instance', () => {
    const manager = getMemoryManager()
    assert.ok(manager)
  })
})

describe('Persona System', async () => {
  it('should create persona loader instance', () => {
    const loader = getPersonaLoader()
    assert.ok(loader)
  })

  it('should create role manager instance', async () => {
    const manager = await getRoleManager()
    assert.ok(manager)
  })

  it('should list all roles', async () => {
    const manager = await getRoleManager()
    const roles = manager.getAllRoles()
    assert.ok(Array.isArray(roles))
    assert.ok(roles.length > 0)
  })

  it('should have required roles', async () => {
    const manager = await getRoleManager()
    const roles = manager.getAllRoles()
    const roleIds = roles.map(r => r.id)

    assert.ok(roleIds.includes('prime'), 'Should have PRIME role')
    assert.ok(roleIds.includes('brain'), 'Should have BRAIN role')
    assert.ok(roleIds.includes('critic'), 'Should have CRITIC role')
    assert.ok(roleIds.includes('finance'), 'Should have FINANCE role')
    assert.ok(roleIds.includes('works'), 'Should have WORKS role')
    assert.ok(roleIds.includes('clerk'), 'Should have CLERK role')
  })
})

describe('LLM Provider System', () => {
  it('should import providers without errors', async () => {
    const { OpenAIProvider } = await import('../backend/src/services/llm/providers/openai.js')
    const { AnthropicProvider } = await import('../backend/src/services/llm/providers/anthropic.js')
    const { OllamaProvider } = await import('../backend/src/services/llm/providers/ollama.js')
    const { GLMProvider } = await import('../backend/src/services/llm/providers/glm.js')
    const { DeepSeekProvider } = await import('../backend/src/services/llm/providers/deepseek.js')

    assert.ok(OpenAIProvider)
    assert.ok(AnthropicProvider)
    assert.ok(OllamaProvider)
    assert.ok(GLMProvider)
    assert.ok(DeepSeekProvider)
  })

  it('should create provider factory', async () => {
    const { ProviderFactory } = await import('../backend/src/services/llm/providerFactory.js')
    assert.ok(ProviderFactory)
  })
})

describe('Orchestrator', () => {
  it('should import orchestrator components', async () => {
    const { MeetingStage } = await import('../backend/src/services/orchestrator/stages.js')
    const { getFlowControl } = await import('../backend/src/services/orchestrator/flowControl.js')
    const { getMainBrainService } = await import('../backend/src/services/orchestrator/mainBrain.js')

    assert.ok(MeetingStage)
    assert.ok(getFlowControl)
    assert.ok(getMainBrainService)
  })
})

describe('Integration', () => {
  it('should have valid meeting stages', async () => {
    const { MeetingStage, getStageFlow } = await import('../backend/src/services/orchestrator/stages.js')

    const stages = getStageFlow()
    assert.ok(stages.length > 0)
    assert.ok(stages.includes(MeetingStage.ISSUE_BRIEF))
    assert.ok(stages.includes(MeetingStage.PRIME_DECISION))
  })
})
