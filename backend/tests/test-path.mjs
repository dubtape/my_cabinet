import path from 'path'
import { existsSync } from 'fs'
import fs from 'fs/promises'

async function test() {
  // Try different paths
  const pathsToTry = [
    './data/personas',
    './backend/data/personas',
    '../data/personas',
  ]

  for (const relPath of pathsToTry) {
    const resolved = path.resolve(relPath)
    const exists = existsSync(resolved)
    console.log(`Path: ${relPath}`)
    console.log(`  Resolved: ${resolved}`)
    console.log(`  Exists: ${exists}`)

    if (exists) {
      const files = await fs.readdir(resolved)
      console.log(`  Files: ${files.join(', ')}`)
    }
    console.log()
  }

  // Try using import.meta.url
  const currentDir = path.dirname(new URL(import.meta.url).pathname)
  const relativePath = path.resolve(currentDir, '../data/personas')
  console.log(`Using import.meta.url:`)
  console.log(`  Current dir: ${currentDir}`)
  console.log(`  Relative path: ${relativePath}`)
  console.log(`  Exists: ${existsSync(relativePath)}`)
  if (existsSync(relativePath)) {
    const files = await fs.readdir(relativePath)
    console.log(`  Files: ${files.join(', ')}`)
  }
}

test()
