import fs from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { z } from 'zod'

/**
 * Persona frontmatter schema
 */
export const PersonaFrontmatterSchema = z.object({
  type: z.literal('persona'),
  role: z.string(),
  version: z.number(),
  stance: z.string(),
  personality: z.string(),
  expertise: z.array(z.string()),
  model_config: z.object({
    provider: z.enum(['openai', 'anthropic', 'ollama', 'glm', 'deepseek']),
    model: z.string(),
    temperature: z.number().min(0).max(2),
    max_tokens: z.number().positive(),
  }),
})

export type PersonaFrontmatter = z.infer<typeof PersonaFrontmatterSchema>

/**
 * Complete persona structure
 */
export interface Persona {
  id: string
  frontmatter: PersonaFrontmatter
  content: string
}

/**
 * Persona loader - loads and validates persona files
 */
export class PersonaLoader {
  private personasDir: string
  private cache: Map<string, Persona> = new Map()

  constructor(personasDir?: string) {
    if (personasDir) {
      this.personasDir = personasDir
    } else if (process.env.PERSONAS_DIR) {
      this.personasDir = process.env.PERSONAS_DIR
    } else {
      // Try different default paths
      // When running from backend/: ./data/personas
      // When running from root: ./backend/data/personas
      if (existsSync('./data/personas')) {
        this.personasDir = './data/personas'
      } else if (existsSync('./backend/data/personas')) {
        this.personasDir = './backend/data/personas'
      } else {
        // Fallback to path relative to current file
        const currentDir = path.dirname(fileURLToPath(import.meta.url))
        this.personasDir = path.resolve(currentDir, '../../data/personas')
      }
    }
  }

  /**
   * Parse frontmatter from persona markdown
   */
  private parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; content: string } {
    // Normalize line endings and match frontmatter
    const normalizedContent = content.replace(/\r\n/g, '\n')
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
    const match = normalizedContent.match(frontmatterRegex)

    if (!match) {
      throw new Error('Invalid persona format: missing frontmatter')
    }

    try {
      const frontmatter = YAML.parse(match[1]) as Record<string, unknown>
      return { frontmatter, content: match[2] }
    } catch (error) {
      throw new Error(`Failed to parse persona frontmatter: ${error}`)
    }
  }

  /**
   * Load a persona by role name
   */
  async loadPersona(role: string): Promise<Persona | null> {
    // Check cache first
    if (this.cache.has(role)) {
      return this.cache.get(role)!
    }

    const filePath = path.join(this.personasDir, `${role.toUpperCase()}.md`)

    if (!existsSync(filePath)) {
      return null
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const { frontmatter, content: body } = this.parseFrontmatter(content)

      // Validate frontmatter
      const validated = PersonaFrontmatterSchema.parse(frontmatter)

      const persona: Persona = {
        id: role,
        frontmatter: validated,
        content: body,
      }

      // Cache it
      this.cache.set(role, persona)

      return persona
    } catch (error) {
      console.error(`Failed to load persona ${role}:`, error)
      return null
    }
  }

  /**
   * Load all personas
   */
  async loadAllPersonas(): Promise<Persona[]> {
    if (!existsSync(this.personasDir)) {
      return []
    }

    const files = await fs.readdir(this.personasDir)
    const personas: Persona[] = []

    for (const file of files) {
      if (!file.endsWith('.md')) continue

      const role = file.replace('.md', '').toLowerCase()
      const persona = await this.loadPersona(role)
      if (persona) {
        personas.push(persona)
      }
    }

    return personas
  }

  /**
   * Save a persona
   */
  async savePersona(role: string, frontmatter: PersonaFrontmatter, content: string): Promise<void> {
    const filePath = path.join(this.personasDir, `${role.toUpperCase()}.md`)
    const dir = path.dirname(filePath)

    // Ensure directory exists
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true })
    }

    // Stringify frontmatter and content
    const markdown = `---\n${YAML.stringify(frontmatter).trim()}\n---\n${content}`

    await fs.writeFile(filePath, markdown, 'utf-8')

    // Update cache
    const persona: Persona = {
      id: role,
      frontmatter,
      content,
    }
    this.cache.set(role, persona)
  }

  /**
   * Delete a persona from disk and cache
   */
  async deletePersona(role: string): Promise<void> {
    const filePath = path.join(this.personasDir, `${role.toUpperCase()}.md`)

    try {
      await fs.unlink(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }

    this.cache.delete(role)
  }

  /**
   * Get the system prompt for a persona
   */
  async getSystemPrompt(role: string): Promise<string | null> {
    const persona = await this.loadPersona(role)
    if (!persona) {
      return null
    }

    // Combine frontmatter info with content
    const prompt = `You are ${persona.frontmatter.role}.\n\n`
      + `**Stance:** ${persona.frontmatter.stance}\n`
      + `**Personality:** ${persona.frontmatter.personality}\n`
      + `**Expertise:** ${persona.frontmatter.expertise.join(', ')}\n\n`
      + `${persona.content}`

    return prompt
  }

  /**
   * Get model configuration for a persona
   */
  async getModelConfig(role: string): Promise<PersonaFrontmatter['model_config'] | null> {
    const persona = await this.loadPersona(role)
    if (!persona) {
      return null
    }

    return persona.frontmatter.model_config
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }
}

// Singleton instance
let loaderInstance: PersonaLoader | null = null

export function getPersonaLoader(): PersonaLoader {
  if (!loaderInstance) {
    loaderInstance = new PersonaLoader()
  }
  return loaderInstance
}
