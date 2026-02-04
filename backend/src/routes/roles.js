import express from 'express'
import { getRoleManager } from '../services/persona/roleManager.js'
import { getPersonaEvolution } from '../services/persona/personaEvolution.js'
import { z } from 'zod'

const router = express.Router()

const modelConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'ollama', 'glm', 'deepseek']),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().positive(),
})

const createRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().optional().default(''),
  stance: z.string().min(1),
  personality: z.string().min(1),
  expertise: z.array(z.string().min(1)).min(1),
  modelConfig: modelConfigSchema,
  content: z.string().min(1),
})

const updateRoleSchema = z.object({
  stance: z.string().min(1).optional(),
  personality: z.string().min(1).optional(),
  expertise: z.array(z.string().min(1)).min(1).optional(),
  modelConfig: modelConfigSchema.optional(),
})

// GET /api/roles - List all roles
router.get('/', async (req, res) => {
  try {
    const roleManager = await getRoleManager()
    const roles = roleManager.getAllRoles()
    res.json(roles)
  } catch (error) {
    console.error('Error fetching roles:', error)
    res.status(500).json({ error: 'Failed to fetch roles' })
  }
})

// GET /api/roles/:id - Get specific role
router.get('/:id', async (req, res) => {
  try {
    const roleManager = await getRoleManager()
    const role = roleManager.getRole(req.params.id.toLowerCase())

    if (!role) {
      return res.status(404).json({ error: 'Role not found' })
    }

    res.json(role)
  } catch (error) {
    console.error('Error fetching role:', error)
    res.status(500).json({ error: 'Failed to fetch role' })
  }
})

// PUT /api/roles/:id - Update a role
router.put('/:id', async (req, res) => {
  try {
    const roleManager = await getRoleManager()
    const parsed = updateRoleSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid role update payload', details: parsed.error.flatten() })
    }
    const { stance, personality, expertise, modelConfig } = parsed.data

    await roleManager.updateRole(req.params.id.toLowerCase(), {
      stance,
      personality,
      expertise,
      modelConfig,
    })

    const updated = roleManager.getRole(req.params.id.toLowerCase())
    res.json(updated)
  } catch (error) {
    console.error('Error updating role:', error)
    res.status(500).json({ error: 'Failed to update role' })
  }
})

// GET /api/roles/:id/evolve - Preview evolution suggestions
router.get('/:id/evolve', async (req, res) => {
  try {
    const evolution = getPersonaEvolution()
    const suggestion = await evolution.previewEvolution(req.params.id.toLowerCase())

    res.json({
      preview: true,
      suggestion,
    })
  } catch (error) {
    console.error('Error generating evolution preview:', error)
    res.status(500).json({ error: 'Failed to generate evolution preview' })
  }
})

// POST /api/roles/:id/evolve - Request AI-assisted evolution
router.post('/:id/evolve', async (req, res) => {
  try {
    const { apply = false } = req.body
    const evolution = getPersonaEvolution()

    if (apply) {
      // Generate and apply evolution
      const suggestion = await evolution.generateEvolution(req.params.id.toLowerCase())
      await evolution.applyEvolution(req.params.id.toLowerCase(), suggestion)

      res.json({
        applied: true,
        suggestion,
      })
    } else {
      // Only preview
      const suggestion = await evolution.generateEvolution(req.params.id.toLowerCase())

      res.json({
        applied: false,
        suggestion,
      })
    }
  } catch (error) {
    console.error('Error evolving role:', error)
    res.status(500).json({ error: 'Failed to evolve role' })
  }
})

// POST /api/roles/:id/evolve/apply - Apply a specific evolution
router.post('/:id/evolve/apply', async (req, res) => {
  try {
    const { suggestion } = req.body

    if (!suggestion) {
      return res.status(400).json({ error: 'Evolution suggestion is required' })
    }

    const evolution = getPersonaEvolution()
    await evolution.applyEvolution(req.params.id.toLowerCase(), suggestion)

    res.json({
      applied: true,
      newVersion: suggestion.suggestedVersion,
    })
  } catch (error) {
    console.error('Error applying evolution:', error)
    res.status(500).json({ error: 'Failed to apply evolution' })
  }
})

// POST /api/roles - Create custom role
router.post('/', async (req, res) => {
  try {
    const roleManager = await getRoleManager()
    const parsed = createRoleSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid role payload', details: parsed.error.flatten() })
    }
    const { id, name, title, stance, personality, expertise, modelConfig, content } = parsed.data

    await roleManager.createCustomRole(id.toLowerCase(), {
      name,
      title,
      stance,
      personality,
      expertise,
      modelConfig,
      content,
    })

    const newRole = roleManager.getRole(id.toLowerCase())
    res.status(201).json(newRole)
  } catch (error) {
    console.error('Error creating role:', error)
    res.status(500).json({ error: 'Failed to create role' })
  }
})

// DELETE /api/roles/:id - Delete custom role
router.delete('/:id', async (req, res) => {
  try {
    const roleManager = await getRoleManager()
    await roleManager.deleteCustomRole(req.params.id.toLowerCase())
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting role:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
