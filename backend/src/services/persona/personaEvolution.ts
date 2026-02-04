import { getDefaultProvider } from '../llm/providerFactory.js'
import type { CompletionMessage } from '../llm/providers/base.js'
import { getPersonaLoader } from './personaLoader.js'
import { getRoleManager } from './roleManager.js'
import type { PersonaFrontmatter } from './personaLoader.js'

/**
 * Evolution suggestion
 */
export interface EvolutionSuggestion {
  currentVersion: number
  suggestedVersion: number
  changes: string[]
  rationale: string
  suggestedPersona: {
    frontmatter: Partial<PersonaFrontmatter>
    content: string
  }
}

/**
 * Evolution trigger result
 */
export interface EvolutionTrigger {
  shouldEvolve: boolean
  reason: string
  confidence: number
}

/**
 * Persona Evolution Service
 * Analyzes persona performance and suggests improvements
 */
export class PersonaEvolution {
  private provider = getDefaultProvider()
  private loader = getPersonaLoader()

  /**
   * Analyze if a persona should evolve
   */
  async shouldEvolve(roleId: string, recentPerformance?: {
    meetingsCount?: number
    averageRelevance?: number
    userFeedback?: number
  }): Promise<EvolutionTrigger> {
    // Simple heuristic: if enough meetings have passed, consider evolution
    const meetingsCount = recentPerformance?.meetingsCount || 0

    if (meetingsCount < 3) {
      return {
        shouldEvolve: false,
        reason: `需要参与至少3个会议后才考虑演化 (当前: ${meetingsCount})`,
        confidence: 0,
      }
    }

    const avgRelevance = recentPerformance?.averageRelevance || 0.7
    const userFeedback = recentPerformance?.userFeedback || 0.7

    // If performance is good but not great, suggest evolution
    if (avgRelevance > 0.6 && avgRelevance < 0.85) {
      return {
        shouldEvolve: true,
        reason: `相关度评分 ${avgRelevance.toFixed(2)} 有提升空间`,
        confidence: 0.7,
      }
    }

    if (userFeedback > 0.6 && userFeedback < 0.85) {
      return {
        shouldEvolve: true,
        reason: `用户反馈评分 ${userFeedback.toFixed(2)} 可以改进`,
        confidence: 0.7,
      }
    }

    return {
      shouldEvolve: false,
      reason: '当前表现良好，暂不需要演化',
      confidence: 0.3,
    }
  }

  /**
   * Generate evolution suggestion
   */
  async generateEvolution(roleId: string): Promise<EvolutionSuggestion> {
    const persona = await this.loader.loadPersona(roleId)
    if (!persona) {
      throw new Error(`Persona not found: ${roleId}`)
    }

    const currentVersion = persona.frontmatter.version
    const suggestedVersion = currentVersion + 1

    const systemPrompt = `你是一个AI人设优化专家。你的任务是分析现有的内阁角色人设，并提出改进建议。

分析时考虑:
1. 角色的核心职责是否清晰
2. 立场(stance)是否精准表达
3. 性格(personality)描述是否具体
4. 专业领域(expertise)是否全面
5. 系统提示词是否有效指导行为

请提出具体的、可操作的改进建议。`

    const userPrompt = `请为以下角色人设提出演化建议:

## 当前角色
**角色名**: ${persona.frontmatter.role}
**版本**: v${currentVersion}
**立场**: ${persona.frontmatter.stance}
**性格**: ${persona.frontmatter.personality}
**专业领域**: ${persona.frontmatter.expertise.join(', ')}

## 当前人设内容
${persona.content}

请提供:
1. **改进建议**: 2-4条具体的改进建议
2. **演化理由**: 为什么需要这些改进
3. **新的人设内容**: 根据建议修改后的完整人设内容
4. **更新后的frontmatter**: 包含新版本号和调整后的属性

以JSON格式回复:
{
  "changes": ["改进建议1", "改进建议2", ...],
  "rationale": "演化理由",
  "newFrontmatter": {
    "stance": "更新后的立场",
    "personality": "更新后的性格",
    "expertise": ["专业1", "专业2", ...],
    "model_config": {...}
  },
  "newContent": "更新后的完整人设内容"
}`

    try {
      const response = await this.provider.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      })

      // Parse JSON response
      const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/) ||
                         response.content.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from response')
      }

      const evolutionData = JSON.parse(jsonMatch[1] || jsonMatch[0])

      return {
        currentVersion,
        suggestedVersion,
        changes: evolutionData.changes || [],
        rationale: evolutionData.rationale || '基于性能分析和最佳实践',
        suggestedPersona: {
          frontmatter: {
            ...persona.frontmatter,
            ...evolutionData.newFrontmatter,
            version: suggestedVersion,
          },
          content: evolutionData.newContent || persona.content,
        },
      }
    } catch (error) {
      console.error('Failed to generate evolution:', error)

      // Fallback: simple version increment
      return {
        currentVersion,
        suggestedVersion,
        changes: ['微调人设描述以提高清晰度'],
        rationale: '常规迭代更新',
        suggestedPersona: {
          frontmatter: persona.frontmatter,
          content: persona.content,
        },
      }
    }
  }

  /**
   * Apply evolution to a persona
   */
  async applyEvolution(roleId: string, evolution: EvolutionSuggestion): Promise<void> {
    const roleManager = await getRoleManager()

    // Update role manager (it will handle version increment and saving)
    await roleManager.evolveRole(
      roleId,
      evolution.changes.join('; '),
      evolution.rationale,
      evolution.suggestedPersona
    )
  }

  /**
   * Request evolution with AI preview (without applying)
   */
  async previewEvolution(roleId: string): Promise<EvolutionSuggestion> {
    return await this.generateEvolution(roleId)
  }

  /**
   * Auto-evolve based on performance metrics
   */
  async autoEvolve(roleId: string, metrics: {
    meetingsCount: number
    averageRelevance: number
    userFeedback?: number
  }): Promise<{ evolved: boolean; suggestion?: EvolutionSuggestion }> {
    const trigger = await this.shouldEvolve(roleId, metrics)

    if (!trigger.shouldEvolve) {
      return { evolved: false }
    }

    // Generate suggestion
    const suggestion = await this.generateEvolution(roleId)

    // Only auto-evolve if confidence is high
    if (trigger.confidence >= 0.7) {
      await this.applyEvolution(roleId, suggestion)
      return { evolved: true, suggestion }
    }

    return { evolved: false, suggestion }
  }

  /**
   * Compare two persona versions
   */
  async compareVersions(roleId: string, version1: number, version2: number): Promise<{
    changes: string[]
    summary: string
  }> {
    // In a full implementation, this would load both versions from history
    // For now, return a placeholder
    return {
      changes: ['需要实现历史版本存储功能'],
      summary: `比较 v${version1} 和 v${version2} 之间的差异`,
    }
  }

  /**
   * Rollback to a previous version
   */
  async rollbackVersion(roleId: string, targetVersion: number): Promise<void> {
    const roleManager = await getRoleManager()
    const role = roleManager.getRole(roleId)

    if (!role) {
      throw new Error(`Role not found: ${roleId}`)
    }

    if (targetVersion >= role.version) {
      throw new Error(`Cannot rollback to current or future version`)
    }

    // In a full implementation, this would:
    // 1. Load the historical version from backup
    // 2. Restore the persona file
    // 3. Update the version tracking

    throw new Error('Version rollback not yet implemented - requires historical version storage')
  }
}

// Singleton instance
let evolutionInstance: PersonaEvolution | null = null

export function getPersonaEvolution(): PersonaEvolution {
  if (!evolutionInstance) {
    evolutionInstance = new PersonaEvolution()
  }
  return evolutionInstance
}
