import fs from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import type {
  MemoryType,
  MeetingSummaryMemory,
  DecisionSummaryMemory,
  ControversyMemory,
  ContextPackageMemory,
} from './types.js'

/**
 * All memory types supported by the system
 */
export type AllMemoryType =
  | 'session'
  | 'decision'
  | 'learning'
  | 'pattern'
  | 'persona'
  | 'meeting_summary'
  | 'controversy'
  | 'context_package'

// Re-export for backward compatibility
export type MemoryType = AllMemoryType

/**
 * Frontmatter structure for memory files
 */
export interface MemoryFrontmatter {
  id: string
  type: MemoryType
  createdAt: string
  updatedAt?: string
  [key: string]: unknown
}

/**
 * Complete memory structure
 */
export interface Memory {
  frontmatter: MemoryFrontmatter
  content: string
}

/**
 * Markdown Store for managing memory files
 * Handles reading, writing, and organizing markdown files
 */
export class MarkdownStore {
  private baseDir: string

  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  /**
   * Ensure directory exists
   */
  private async ensureDir(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true })
    }
  }

  /**
   * Parse frontmatter from markdown content
   */
  private parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; content: string } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
    const match = content.match(frontmatterRegex)

    if (!match) {
      return { frontmatter: {}, content }
    }

    try {
      const frontmatter = YAML.parse(match[1]) as Record<string, unknown>
      return { frontmatter, content: match[2] }
    } catch (error) {
      console.error('Failed to parse frontmatter:', error)
      return { frontmatter: {}, content }
    }
  }

  /**
   * Stringify frontmatter and content
   */
  private stringifyFrontmatter(frontmatter: Record<string, unknown>, content: string): string {
    return `---\n${YAML.stringify(frontmatter).trim()}\n---\n${content}`
  }

  /**
   * Get file path for a memory
   */
  private getMemoryPath(type: MemoryType, id: string): string {
    let subdir = ''
    switch (type) {
      case 'session':
        subdir = 'short-term'
        break
      case 'decision':
        subdir = path.join('long-term', 'decisions')
        break
      case 'learning':
        subdir = path.join('long-term', 'learnings')
        break
      case 'pattern':
        subdir = path.join('long-term', 'patterns')
        break
      case 'persona':
        subdir = '../personas'
        break
      case 'meeting_summary':
        subdir = path.join('long-term', 'meetings')
        break
      case 'controversy':
        subdir = path.join('long-term', 'controversies')
        break
      case 'context_package':
        subdir = path.join('short-term', 'contexts')
        break
    }
    return path.join(this.baseDir, subdir, `${id}.md`)
  }

  /**
   * Write a memory to disk
   */
  async writeMemory(type: MemoryType, id: string, frontmatter: Record<string, unknown>, content: string): Promise<void> {
    const filePath = this.getMemoryPath(type, id)
    const dir = path.dirname(filePath)

    await this.ensureDir(dir)

    const fullContent = this.stringifyFrontmatter({ ...frontmatter, id, type }, content)
    await fs.writeFile(filePath, fullContent, 'utf-8')
  }

  /**
   * Read a memory from disk
   */
  async readMemory(type: MemoryType, id: string): Promise<Memory | null> {
    const filePath = this.getMemoryPath(type, id)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const { frontmatter, content: body } = this.parseFrontmatter(content)
      return {
        frontmatter: frontmatter as MemoryFrontmatter,
        content: body,
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  /**
   * List all memories of a specific type
   */
  async listMemories(type: MemoryType): Promise<Memory[]> {
    let subdir = ''
    switch (type) {
      case 'session':
        subdir = 'short-term'
        break
      case 'decision':
        subdir = path.join('long-term', 'decisions')
        break
      case 'learning':
        subdir = path.join('long-term', 'learnings')
        break
      case 'pattern':
        subdir = path.join('long-term', 'patterns')
        break
      case 'persona':
        subdir = '../personas'
        break
      case 'meeting_summary':
        subdir = path.join('long-term', 'meetings')
        break
      case 'controversy':
        subdir = path.join('long-term', 'controversies')
        break
      case 'context_package':
        subdir = path.join('short-term', 'contexts')
        break
    }

    const dirPath = path.join(this.baseDir, subdir)

    if (!existsSync(dirPath)) {
      return []
    }

    const files = await fs.readdir(dirPath)
    const memories: Memory[] = []

    for (const file of files) {
      if (!file.endsWith('.md')) continue

      const id = file.replace('.md', '')
      const memory = await this.readMemory(type, id)
      if (memory) {
        memories.push(memory)
      }
    }

    // Sort by creation date (newest first)
    return memories.sort((a, b) => {
      const aDate = new Date(a.frontmatter.createdAt as string).getTime()
      const bDate = new Date(b.frontmatter.createdAt as string).getTime()
      return bDate - aDate
    })
  }

  /**
   * Delete a memory
   */
  async deleteMemory(type: MemoryType, id: string): Promise<void> {
    const filePath = this.getMemoryPath(type, id)

    try {
      await fs.unlink(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  /**
   * Update a memory
   */
  async updateMemory(type: MemoryType, id: string, updates: {
    frontmatter?: Partial<MemoryFrontmatter>
    content?: string
  }): Promise<void> {
    const existing = await this.readMemory(type, id)
    if (!existing) {
      throw new Error(`Memory not found: ${type}/${id}`)
    }

    const newFrontmatter = {
      ...existing.frontmatter,
      ...(updates.frontmatter || {}),
      updatedAt: new Date().toISOString(),
    }

    await this.writeMemory(type, id, newFrontmatter, updates.content || existing.content)
  }

  /**
   * Search memories by content
   */
  async searchMemories(query: string, types?: MemoryType[]): Promise<Memory[]> {
    const searchTypes = types || ['session', 'decision', 'learning', 'pattern']
    const results: Memory[] = []

    for (const type of searchTypes) {
      const memories = await this.listMemories(type)
      for (const memory of memories) {
        const searchText = `${JSON.stringify(memory.frontmatter)}\n${memory.content}`.toLowerCase()
        if (searchText.includes(query.toLowerCase())) {
          results.push(memory)
        }
      }
    }

    return results
  }
}

// Create a singleton instance
let storeInstance: MarkdownStore | null = null

export function getMarkdownStore(): MarkdownStore {
  if (!storeInstance) {
    if (process.env.MEMORY_DIR) {
      storeInstance = new MarkdownStore(process.env.MEMORY_DIR)
    } else {
      // Try different default paths
      if (existsSync('./data/memory')) {
        storeInstance = new MarkdownStore('./data/memory')
      } else if (existsSync('./backend/data/memory')) {
        storeInstance = new MarkdownStore('./backend/data/memory')
      } else {
        // Fallback
        const currentDir = path.dirname(fileURLToPath(import.meta.url))
        const memoryDir = path.resolve(currentDir, '../../data/memory')
        storeInstance = new MarkdownStore(memoryDir)
      }
    }
  }
  return storeInstance
}
