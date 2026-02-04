import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

type KeyStoreData = {
  openaiApiKey?: string
  anthropicApiKey?: string
  deepseekApiKey?: string
  glmApiKey?: string
  ollamaBaseUrl?: string
  glmBaseUrl?: string
  deepseekBaseUrl?: string
}

let cache: KeyStoreData | null = null

function resolveKeysPath(): string {
  if (process.env.KEYS_FILE) {
    return process.env.KEYS_FILE
  }

  if (existsSync('./data')) {
    return path.resolve('./data/keys.json')
  }

  if (existsSync('./backend/data')) {
    return path.resolve('./backend/data/keys.json')
  }

  return path.resolve('./data/keys.json')
}

const keysPath = resolveKeysPath()

function loadCache(): void {
  if (cache !== null) return

  if (!existsSync(keysPath)) {
    cache = {}
    return
  }

  try {
    const raw = fs.readFileSync(keysPath, 'utf-8')
    cache = JSON.parse(raw || '{}')
  } catch {
    cache = {}
  }
}

export function getKeyStore(): KeyStoreData {
  loadCache()
  return { ...(cache || {}) }
}

export function getKey(name: keyof KeyStoreData): string | undefined {
  loadCache()
  return cache?.[name]
}

export async function setKeys(updates: KeyStoreData): Promise<void> {
  loadCache()
  cache = { ...(cache || {}), ...updates }

  const dir = path.dirname(keysPath)
  if (!existsSync(dir)) {
    await fsp.mkdir(dir, { recursive: true })
  }

  await fsp.writeFile(keysPath, JSON.stringify(cache, null, 2), 'utf-8')
}

export function getKeyStatus(): Record<string, { configured: boolean; masked?: string; value?: string }> {
  const data = getKeyStore()
  const mask = (val?: string) => {
    if (!val) return undefined
    if (val.length <= 4) return '****'
    return `${val.slice(0, 2)}***${val.slice(-2)}`
  }

  return {
    openai: { configured: !!data.openaiApiKey, masked: mask(data.openaiApiKey) },
    anthropic: { configured: !!data.anthropicApiKey, masked: mask(data.anthropicApiKey) },
    deepseek: { configured: !!data.deepseekApiKey, masked: mask(data.deepseekApiKey) },
    glm: { configured: !!data.glmApiKey, masked: mask(data.glmApiKey) },
    ollama: { configured: !!(data.ollamaBaseUrl || process.env.OLLAMA_BASE_URL), value: data.ollamaBaseUrl || process.env.OLLAMA_BASE_URL },
  }
}
