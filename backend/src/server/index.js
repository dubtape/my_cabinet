import express from 'express'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Import routes
import meetingsRouter, { meetings } from '../routes/meetings.js'
import rolesRouter from '../routes/roles.js'
import memoryRouter from '../routes/memory.js'
import { continueWithUserResponse } from '../controllers/meetingsController.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from root .env first, then cwd .env
const envCandidates = [
  path.resolve(process.cwd(), '..', '.env'),
  path.resolve(process.cwd(), '.env'),
]
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate))
if (envPath) {
  config({ path: envPath, override: true })
}

const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
  next()
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.use('/api/meetings', meetingsRouter)
app.use('/api/roles', rolesRouter)
app.use('/api/memory', memoryRouter)

// Serve static files from frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../../frontend/dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      status: err.status || 500,
    },
  })
})

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' })

// Store active connections
const clients = new Map()

wss.on('connection', (ws, req) => {
  const clientId = Date.now().toString()
  console.log(`WebSocket client connected: ${clientId}`)

  clients.set(clientId, ws)

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString())
      console.log(`WebSocket message from ${clientId}:`, data.type)

      // Handle different message types
      switch (data.type) {
        case 'JOIN_MEETING':
          // Join a meeting room
          ws.meetingId = data.meetingId
          console.log(`Client ${clientId} joined meeting ${data.meetingId}`)
          break

        case 'USER_RESPONSE':
          // Handle user response to BRAIN question
          if (ws.meetingId) {
            const meeting = meetings.get(ws.meetingId)
            if (meeting) {
              // Add user response to meeting messages
              const userMessage = {
                id: `msg-${Date.now()}-user`,
                timestamp: new Date().toISOString(),
                role: 'USER',
                type: 'response',
                content: data.response,
              }
              meeting.messages.push(userMessage)

              // Broadcast updated meeting to all clients
              broadcastToMeeting(ws.meetingId, {
                type: 'MEETING_UPDATED',
                meetingId: ws.meetingId,
                meeting,
              })

              console.log(`User response added to meeting ${ws.meetingId}`)

              // Continue interaction:
              // - running meeting => PRIME immediate response
              // - completed meeting => follow-up discussion + refreshed decision
              continueWithUserResponse(meeting, meetings, data.response).catch((error) => {
                console.error(`Failed to continue meeting ${ws.meetingId}:`, error)
              })
            }
          }
          break

        default:
          console.log(`Unknown message type: ${data.type}`)
      }
    } catch (error) {
      console.error('WebSocket message error:', error)
    }
  })

  ws.on('close', () => {
    console.log(`WebSocket client disconnected: ${clientId}`)
    clients.delete(clientId)
  })

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error)
    clients.delete(clientId)
  })

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'CONNECTED',
    clientId,
  }))
})

// Broadcast to all clients in a meeting
function broadcastToMeeting(meetingId, data, excludeClientId) {
  for (const [clientId, client] of clients) {
    if (clientId !== excludeClientId && client.meetingId === meetingId && client.readyState === 1) {
      client.send(JSON.stringify(data))
    }
  }
}

// Make broadcast function available globally for use in controllers
global.broadcastToMeeting = broadcastToMeeting

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📡 WebSocket server running on ws://localhost:${PORT}/ws`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})
