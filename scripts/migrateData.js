#!/usr/bin/env node

/**
 * Data Migration Script
 *
 * Migrates data from the old MVP format to the new system
 * - Converts meetings from db.json to markdown memory files
 * - Creates default persona files if they don't exist
 * - Backs up original data
 */

import fs from 'fs/promises'
import path from 'path'
import { existsSync, copyFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configuration
const DATA_DIR = path.resolve(__dirname, '../data')
const BACKUP_DIR = path.resolve(__dirname, '../backup')
const BACKEND_DATA_DIR = path.resolve(__dirname, '../backend/data')
const OLD_DB_PATH = path.join(DATA_DIR, 'db.json')

// Migration tracking
const migrationLog = []

function log(message) {
  console.log(`[MIGRATION] ${message}`)
  migrationLog.push({ timestamp: new Date().toISOString(), message })
}

async function backupData() {
  log('Creating backup...')

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`)

  try {
    mkdirSync(backupPath, { recursive: true })

    if (existsSync(OLD_DB_PATH)) {
      copyFileSync(OLD_DB_PATH, path.join(backupPath, 'db.json'))
      log(`Backed up db.json to ${backupPath}`)
    }

    log('Backup completed successfully')
    return true
  } catch (error) {
    log(`Backup failed: ${error.message}`)
    return false
  }
}

async function migrateMeetings() {
  log('Migrating meetings...')

  try {
    // Read old database
    if (!existsSync(OLD_DB_PATH)) {
      log('No existing db.json found, skipping meeting migration')
      return 0
    }

    const dbContent = await fs.readFile(OLD_DB_PATH, 'utf-8')
    const db = JSON.parse(dbContent)

    const meetings = db.meetings || {}
    let migratedCount = 0

    // Ensure memory directory exists
    const sessionsDir = path.join(BACKEND_DATA_DIR, 'memory/short-term')
    const decisionsDir = path.join(BACKEND_DATA_DIR, 'memory/long-term/decisions')

    mkdirSync(sessionsDir, { recursive: true })
    mkdirSync(decisionsDir, { recursive: true })

    // Migrate each meeting
    for (const [id, meeting] of Object.entries(meetings)) {
      try {
        const sessionId = `session-${id}`

        // Create session memory markdown
        const frontmatter = {
          id: sessionId,
          type: 'session',
          createdAt: meeting.createdAt || new Date().toISOString(),
          meetingId: id,
          topic: meeting.topic || 'Unknown Topic',
          status: meeting.status || 'unknown',
          budget: meeting.budget || 0,
          usage: meeting.usage || 0,
        }

        const content = formatMeetingContent(meeting)

        const markdown = formatMarkdown(frontmatter, content)
        const sessionPath = path.join(sessionsDir, `${sessionId}.md`)

        await fs.writeFile(sessionPath, markdown, 'utf-8')
        log(`Migrated meeting: ${id} - ${meeting.topic}`)
        migratedCount++

        // Extract and save decision if exists
        if (meeting.artifacts?.finalDecision) {
          const decisionId = `decision-${id}`
          const decisionFrontmatter = {
            id: decisionId,
            type: 'decision',
            createdAt: meeting.completedAt || meeting.createdAt,
            meetingId: id,
            topic: meeting.topic,
          }

          const decisionContent = formatDecisionContent(meeting)
          const decisionMarkdown = formatMarkdown(decisionFrontmatter, decisionContent)
          const decisionPath = path.join(decisionsDir, `${decisionId}.md`)

          await fs.writeFile(decisionPath, decisionMarkdown, 'utf-8')
          log(`Extracted decision from meeting: ${id}`)
        }
      } catch (error) {
        log(`Failed to migrate meeting ${id}: ${error.message}`)
      }
    }

    log(`Migrated ${migratedCount} meetings`)
    return migratedCount
  } catch (error) {
    log(`Meeting migration failed: ${error.message}`)
    return 0
  }
}

function formatMeetingContent(meeting) {
  let content = `# ${meeting.topic}\n\n`
  content += `**Meeting ID:** ${meeting.id}\n`
  content += `**Status:** ${meeting.status}\n`
  content += `**Started:** ${new Date(meeting.createdAt).toLocaleString('zh-CN')}\n`

  if (meeting.startedAt) {
    content += `**Started:** ${new Date(meeting.startedAt).toLocaleString('zh-CN')}\n`
  }

  if (meeting.completedAt) {
    content += `**Completed:** ${new Date(meeting.completedAt).toLocaleString('zh-CN')}\n`
  }

  if (meeting.budget) {
    content += `**Budget:** ${meeting.budget} tokens\n`
  }

  if (meeting.usage) {
    content += `**Usage:** ${meeting.usage} tokens\n`
  }

  content += `\n`

  // Messages
  if (meeting.messages && meeting.messages.length > 0) {
    content += `## Discussion\n\n`
    for (const message of meeting.messages) {
      const timestamp = new Date(message.timestamp).toLocaleTimeString('zh-CN')
      content += `### [${timestamp}] ${message.role}\n\n`
      content += `${message.content}\n\n`
    }
  }

  // Artifacts
  if (meeting.artifacts) {
    content += `## Artifacts\n\n`
    for (const [key, artifact] of Object.entries(meeting.artifacts)) {
      content += `### ${capitalizeFirst(key)}\n\n`
      content += `${JSON.stringify(artifact, null, 2)}\n\n`
    }
  }

  return content
}

function formatDecisionContent(meeting) {
  const decision = meeting.artifacts.finalDecision

  let content = `# Decision: ${decision.decision || 'N/A'}\n\n`
  content += `**Topic:** ${meeting.topic}\n`
  content += `**Date:** ${new Date(meeting.completedAt || meeting.createdAt).toLocaleDateString('zh-CN')}\n\n`

  if (decision.reasoning) {
    content += `## Reasoning\n\n${decision.reasoning}\n\n`
  }

  if (decision.nextSteps && decision.nextSteps.length > 0) {
    content += `## Next Steps\n\n`
    for (const step of decision.nextSteps) {
      content += `- ${step}\n`
    }
    content += `\n`
  }

  return content
}

function formatMarkdown(frontmatter, content) {
  return `---
${Object.entries(frontmatter)
  .map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v}"` : JSON.stringify(v)}`)
  .join('\n')}
---

${content}`
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

async function ensurePersonas() {
  log('Ensuring persona files exist...')

  const personasDir = path.join(BACKEND_DATA_DIR, 'personas')
  mkdirSync(personasDir, { recursive: true })

  const personas = [
    'PRIME',
    'BRAIN',
    'CRITIC',
    'FINANCE',
    'WORKS',
    'CLERK',
  ]

  const existingPersonas = new Set()

  try {
    const files = await fs.readdir(personasDir)
    for (const file of files) {
      if (file.endsWith('.md')) {
        existingPersonas.add(file.replace('.md', ''))
      }
    }
  } catch (error) {
    // Directory might not exist yet, ignore
  }

  let createdCount = 0

  for (const persona of personas) {
    if (!existingPersonas.has(persona)) {
      log(`Persona file missing: ${persona}.md`)
      log(`Please run the full setup to create default persona files`)
      createdCount++
    }
  }

  if (createdCount === 0) {
    log('All persona files exist')
  }

  return createdCount === 0
}

async function saveMigrationLog() {
  const logPath = path.join(BACKUP_DIR, `migration-log-${Date.now()}.json`)
  await fs.writeFile(logPath, JSON.stringify(migrationLog, null, 2))
  log(`Migration log saved to ${logPath}`)
}

async function main() {
  console.log('=== Cyber Cabinet Data Migration ===\n')

  // Step 1: Backup
  const backedUp = await backupData()
  if (!backedUp) {
    console.error('Migration aborted: Backup failed')
    process.exit(1)
  }

  console.log()

  // Step 2: Migrate meetings
  const meetingCount = await migrateMeetings()

  console.log()

  // Step 3: Ensure personas
  await ensurePersonas()

  console.log()

  // Step 4: Save log
  await saveMigrationLog()

  console.log('=== Migration Complete ===')
  console.log(`Migrated ${meetingCount} meetings`)
  console.log(`\nNext steps:`)
  console.log(`1. Review the migrated data in ${BACKEND_DATA_DIR}`)
  console.log(`2. Set up your API keys in .env`)
  console.log(`3. Run: npm run dev (backend) and npm run dev (frontend)`)
}

// Run migration
main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
