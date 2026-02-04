import express from 'express'
import { getMemoryManager, getMemoryRetrieval } from '../services/memory/index.js'
import { getMarkdownStore } from '../services/memory/markdownStore.js'

const router = express.Router()

// Valid memory types
const VALID_MEMORY_TYPES = [
  'session',
  'decision',
  'learning',
  'pattern',
  'persona',
  'meeting_summary',
  'controversy',
  'context_package',
]

// Middleware to validate memory type
const validateMemoryType = (req, res, next) => {
  const { type } = req.params
  if (!VALID_MEMORY_TYPES.includes(type)) {
    return res.status(400).json({
      error: `Invalid memory type: "${type}". Valid types are: ${VALID_MEMORY_TYPES.join(', ')}`
    })
  }
  next()
}

// GET /api/memory/search - Search memories
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' })
    }

    const retrieval = getMemoryRetrieval()
    const results = await retrieval.search(q)

    res.json(results)
  } catch (error) {
    console.error('Error searching memory:', error)
    res.status(500).json({ error: 'Failed to search memory' })
  }
})

// GET /api/memory/sessions - List session memories
router.get('/sessions', async (req, res) => {
  try {
    const store = getMarkdownStore()
    const sessions = await store.listMemories('session')
    res.json(sessions)
  } catch (error) {
    console.error('Error fetching sessions:', error)
    res.status(500).json({ error: 'Failed to fetch sessions' })
  }
})

// GET /api/memory/decisions - List decision memories
router.get('/decisions', async (req, res) => {
  try {
    const store = getMarkdownStore()
    const decisions = await store.listMemories('decision')
    res.json(decisions)
  } catch (error) {
    console.error('Error fetching decisions:', error)
    res.status(500).json({ error: 'Failed to fetch decisions' })
  }
})

// GET /api/memory/learnings - List learning memories
router.get('/learnings', async (req, res) => {
  try {
    const store = getMarkdownStore()
    const learnings = await store.listMemories('learning')
    res.json(learnings)
  } catch (error) {
    console.error('Error fetching learnings:', error)
    res.status(500).json({ error: 'Failed to fetch learnings' })
  }
})

// GET /api/memory/patterns - List pattern memories
router.get('/patterns', async (req, res) => {
  try {
    const store = getMarkdownStore()
    const patterns = await store.listMemories('pattern')
    res.json(patterns)
  } catch (error) {
    console.error('Error fetching patterns:', error)
    res.status(500).json({ error: 'Failed to fetch patterns' })
  }
})

// GET /api/memory/:type/:id - Get specific memory
router.get('/:type/:id', validateMemoryType, async (req, res) => {
  try {
    const { type, id } = req.params
    const store = getMarkdownStore()
    const memory = await store.readMemory(type, id)

    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' })
    }

    res.json(memory)
  } catch (error) {
    console.error('Error fetching memory:', error)
    res.status(500).json({ error: 'Failed to fetch memory' })
  }
})

// PUT /api/memory/:type/:id - Update memory
router.put('/:type/:id', validateMemoryType, async (req, res) => {
  try {
    const { type, id } = req.params
    const { frontmatter, content } = req.body
    const store = getMarkdownStore()

    await store.updateMemory(type, id, { frontmatter, content })

    const updated = await store.readMemory(type, id)
    res.json(updated)
  } catch (error) {
    console.error('Error updating memory:', error)
    res.status(500).json({ error: 'Failed to update memory' })
  }
})

// DELETE /api/memory/:type/:id - Delete memory
router.delete('/:type/:id', validateMemoryType, async (req, res) => {
  try {
    const { type, id } = req.params
    const store = getMarkdownStore()

    await store.deleteMemory(type, id)
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting memory:', error)
    res.status(500).json({ error: 'Failed to delete memory' })
  }
})

export default router
