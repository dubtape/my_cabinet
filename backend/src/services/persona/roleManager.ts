import { getPersonaLoader } from './personaLoader.js'
import type { Persona, PersonaFrontmatter } from './personaLoader.js'
import type { ModelInfo } from '../llm/providers/base.js'

/**
 * Role information with metadata
 */
export interface RoleInfo {
  id: string
  name: string
  title: string
  version: number
  lastEvolved?: string
  stance: string
  personality: string
  expertise: string[]
  modelConfig: {
    provider: 'openai' | 'anthropic' | 'ollama' | 'glm' | 'deepseek'
    model: string
    temperature: number
    maxTokens: number
  }
  evolutionHistory: EvolutionEntry[]
}

/**
 * Evolution history entry
 */
export interface EvolutionEntry {
  version: number
  date: string
  changes: string
  rationale: string
}

/**
 * Role Manager - manages all cabinet roles
 */
export class RoleManager {
  private loader = getPersonaLoader()
  private roles: Map<string, RoleInfo> = new Map()

  /**
   * Initialize role manager by loading all personas
   */
  async initialize(): Promise<void> {
    const personas = await this.loader.loadAllPersonas()

    for (const persona of personas) {
      this.roles.set(persona.id, this.convertToRoleInfo(persona))
    }
  }

  /**
   * Convert persona to role info
   */
  private convertToRoleInfo(persona: Persona): RoleInfo {
    return {
      id: persona.id,
      name: persona.frontmatter.role,
      title: this.getRoleTitle(persona.frontmatter.role),
      version: persona.frontmatter.version,
      stance: persona.frontmatter.stance,
      personality: persona.frontmatter.personality,
      expertise: persona.frontmatter.expertise,
      modelConfig: {
        provider: persona.frontmatter.model_config.provider,
        model: persona.frontmatter.model_config.model,
        temperature: persona.frontmatter.model_config.temperature,
        maxTokens: persona.frontmatter.model_config.max_tokens,
      },
      evolutionHistory: [],
    }
  }

  /**
   * Get human-readable title for a role
   */
  private getRoleTitle(role: string): string {
    const titles: Record<string, string> = {
      PRIME: '总理',
      BRAIN: '主脑',
      CRITIC: '批评者',
      FINANCE: '财政部长',
      WORKS: '实务部长',
      CLERK: '书记官',
    }
    return titles[role] || role
  }

  /**
   * Get all roles
   */
  getAllRoles(): RoleInfo[] {
    return Array.from(this.roles.values()).sort((a, b) => {
      // Order: PRIME, BRAIN, then alphabetically
      const order = { prime: 0, brain: 1 }
      const aOrder = order[a.id as keyof typeof order] ?? 99
      const bOrder = order[b.id as keyof typeof order] ?? 99
      return aOrder - bOrder || a.id.localeCompare(b.id)
    })
  }

  /**
   * Get a specific role
   */
  getRole(id: string): RoleInfo | undefined {
    return this.roles.get(id)
  }

  /**
   * Get system prompt for a role
   */
  async getSystemPrompt(id: string): Promise<string | null> {
    return this.loader.getSystemPrompt(id)
  }

  /**
   * Get model config for a role
   */
  async getModelConfig(id: string): Promise<RoleInfo['modelConfig'] | null> {
    const role = this.roles.get(id)
    return role?.modelConfig || null
  }

  /**
   * Update a role
   */
  async updateRole(id: string, updates: Partial<RoleInfo>): Promise<void> {
    const existing = this.roles.get(id)
    if (!existing) {
      throw new Error(`Role not found: ${id}`)
    }

    // Load the persona
    const persona = await this.loader.loadPersona(id)
    if (!persona) {
      throw new Error(`Persona not found: ${id}`)
    }

    // Create updated frontmatter
    const updatedFrontmatter: PersonaFrontmatter = {
      ...persona.frontmatter,
      ...(updates.stance && { stance: updates.stance }),
      ...(updates.personality && { personality: updates.personality }),
      ...(updates.expertise && { expertise: updates.expertise }),
      ...(updates.modelConfig && {
        model_config: {
          provider: updates.modelConfig.provider,
          model: updates.modelConfig.model,
          temperature: updates.modelConfig.temperature,
          max_tokens: updates.modelConfig.maxTokens,
        },
      }),
    }

    // Save updated persona
    await this.loader.savePersona(id, updatedFrontmatter, persona.content)

    // Update cache
    const updated = { ...existing, ...updates }
    this.roles.set(id, updated)
  }

  /**
   * Create a custom role
   */
  async createCustomRole(id: string, config: {
    name: string
    title: string
    stance: string
    personality: string
    expertise: string[]
    modelConfig: RoleInfo['modelConfig']
    content: string
  }): Promise<void> {
    const frontmatter: PersonaFrontmatter = {
      type: 'persona',
      role: config.name,
      version: 1,
      stance: config.stance,
      personality: config.personality,
      expertise: config.expertise,
      model_config: {
        provider: config.modelConfig.provider,
        model: config.modelConfig.model,
        temperature: config.modelConfig.temperature,
        max_tokens: config.modelConfig.maxTokens,
      },
    }

    await this.loader.savePersona(id, frontmatter, config.content)

    // Add to roles
    this.roles.set(id, {
      id,
      name: config.name,
      title: config.title,
      version: 1,
      stance: config.stance,
      personality: config.personality,
      expertise: config.expertise,
      modelConfig: config.modelConfig,
      evolutionHistory: [],
    })
  }

  /**
   * Delete a custom role
   */
  async deleteCustomRole(id: string): Promise<void> {
    // Can't delete built-in roles
    const builtInRoles = ['prime', 'brain', 'critic', 'finance', 'works', 'clerk']
    if (builtInRoles.includes(id)) {
      throw new Error(`Cannot delete built-in role: ${id}`)
    }

    await this.loader.deletePersona(id)
    this.roles.delete(id)
  }

  /**
   * Evolve a role (increment version)
   */
  async evolveRole(
    id: string,
    changes: string,
    rationale: string,
    suggestedPersona?: {
      frontmatter: PersonaFrontmatter
      content: string
    }
  ): Promise<void> {
    const existing = this.roles.get(id)
    if (!existing) {
      throw new Error(`Role not found: ${id}`)
    }

    // Load the persona
    const persona = await this.loader.loadPersona(id)
    if (!persona) {
      throw new Error(`Persona not found: ${id}`)
    }

    // Use suggested version or increment
    const newVersion = suggestedPersona?.frontmatter.version || persona.frontmatter.version + 1

    // Add evolution entry
    const evolutionEntry: EvolutionEntry = {
      version: newVersion,
      date: new Date().toISOString(),
      changes,
      rationale,
    }

    // Use suggested frontmatter or update existing
    const updatedFrontmatter: PersonaFrontmatter = suggestedPersona?.frontmatter || {
      ...persona.frontmatter,
      version: newVersion,
    }

    // Use suggested content or append evolution history
    let updatedContent: string
    if (suggestedPersona?.content) {
      // Suggested content may not have evolution history, append it
      const evolutionHistory = `\n\n## Evolution History\n\n### v${newVersion} (${new Date().toLocaleDateString('zh-CN')})\n\n**Changes:** ${changes}\n\n**Rationale:** ${rationale}\n`
      updatedContent = suggestedPersona.content + evolutionHistory
    } else {
      // Append evolution history to existing content
      updatedContent = `${persona.content}\n\n## Evolution History\n\n### v${newVersion} (${new Date().toLocaleDateString('zh-CN')})\n\n**Changes:** ${changes}\n\n**Rationale:** ${rationale}\n`
    }

    // Save
    await this.loader.savePersona(id, updatedFrontmatter, updatedContent)

    // Update role info
    const updated = {
      ...existing,
      version: newVersion,
      lastEvolved: new Date().toISOString(),
      evolutionHistory: [...existing.evolutionHistory, evolutionEntry],
    }
    this.roles.set(id, updated)
  }
}

// Singleton instance
let managerInstance: RoleManager | null = null

export async function getRoleManager(): Promise<RoleManager> {
  if (!managerInstance) {
    managerInstance = new RoleManager()
    await managerInstance.initialize()
  }
  return managerInstance
}
