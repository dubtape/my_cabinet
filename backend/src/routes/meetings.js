import express from 'express'
import { runMeeting } from '../controllers/meetingsController.js'
import { getRoleProvider } from '../services/llm/providerFactory.js'

const router = express.Router()

// TODO: Implement in-memory store for meetings
const meetings = new Map()
const DEFAULT_ROLES = ['prime', 'brain', 'critic', 'finance', 'works']

function normalizeSelectedRoles(input) {
  if (!Array.isArray(input)) {
    return [...DEFAULT_ROLES]
  }
  const normalized = input
    .map((roleId) => String(roleId || '').trim().toLowerCase())
    .filter(Boolean)
  const deduped = [...new Set(normalized)]
  if (deduped.length === 0) {
    return [...DEFAULT_ROLES]
  }
  if (!deduped.includes('prime')) {
    deduped.unshift('prime')
  }
  if (!deduped.includes('brain')) {
    deduped.push('brain')
  }
  return deduped
}

// GET /api/meetings - List all meetings
router.get('/', (req, res) => {
  const allMeetings = Array.from(meetings.values())
  res.json(allMeetings)
})

// GET /api/meetings/:id - Get meeting details
router.get('/:id', (req, res) => {
  const meeting = meetings.get(req.params.id)
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' })
  }
  res.json(meeting)
})

// POST /api/meetings - Create a new meeting
router.post('/', (req, res) => {
  const { topic, description, budget = 50000, selectedRoleIds } = req.body

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' })
  }

  const meeting = {
    id: Date.now().toString(),
    topic,
    description,
    selectedRoleIds: normalizeSelectedRoles(selectedRoleIds),
    status: 'pending',
    budget,
    usage: 0,
    createdAt: new Date().toISOString(),
    messages: [],
    artifacts: {},
  }

  meetings.set(meeting.id, meeting)

  res.status(201).json(meeting)
})

// POST /api/meetings/:id/run - Run a meeting
router.post('/:id/run', async (req, res) => {
  const meeting = meetings.get(req.params.id)

  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' })
  }

  if (meeting.status === 'running') {
    return res.status(400).json({ error: 'Meeting is already running' })
  }

  if (meeting.status === 'completed') {
    return res.status(400).json({ error: 'Meeting has already completed' })
  }

  // Validate providers are configured for required roles
  try {
    const requiredRoles = normalizeSelectedRoles(meeting.selectedRoleIds)
    for (const role of requiredRoles) {
      const { provider } = await getRoleProvider(role)
      if (!provider.isConfigured()) {
        return res.status(400).json({
          error: `Provider not configured for role "${role}". Check API key and model settings.`,
        })
      }
    }
  } catch (error) {
    return res.status(400).json({ error: 'Failed to validate provider configuration' })
  }

  // Start the meeting asynchronously
  meeting.status = 'running'
  meeting.startedAt = new Date().toISOString()

  // Send initial response
  res.json({
    message: 'Meeting started',
    meetingId: meeting.id,
    status: 'running',
  })

  // Run meeting in background
  runMeeting(meeting, meetings).catch((error) => {
    console.error('Meeting execution error:', error)
    meeting.status = 'failed'
  })
})

// DELETE /api/meetings/:id - Delete a meeting
router.delete('/:id', (req, res) => {
  if (!meetings.has(req.params.id)) {
    return res.status(404).json({ error: 'Meeting not found' })
  }

  meetings.delete(req.params.id)
  res.status(204).send()
})

// Export the meetings map for use in controller
export { meetings }

export default router
