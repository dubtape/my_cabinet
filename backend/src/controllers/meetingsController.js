import { getFlowControl } from '../services/orchestrator/flowControl.js'
import { MeetingStage } from '../services/orchestrator/stages.js'
import { getMemoryManager } from '../services/memory/memoryManager.js'
import { getMeetingSummarizer } from '../services/memory/meetingSummarizer.js'

/**
 * Run a complete meeting
 */
export async function runMeeting(meeting, meetingsMap) {
  const flowControl = getFlowControl()
  const memoryManager = getMemoryManager()
  let currentStage = MeetingStage.ISSUE_BRIEF

  try {
    console.log(`Starting meeting ${meeting.id}: ${meeting.topic}`)

    // Execute each stage
    while (
      currentStage !== MeetingStage.COMPLETED &&
      currentStage !== MeetingStage.FAILED
    ) {
      console.log(`Executing stage: ${currentStage}`)

      const { messages, newStage, degradation } = await flowControl.executeStage(
        meeting,
        currentStage
      )

      // Add messages to meeting
      meeting.messages.push(...messages)

      // Update degradation level
      if (degradation) {
        meeting.degradation = degradation
      }

      // Save updated meeting
      meetingsMap.set(meeting.id, meeting)

      // Broadcast update via WebSocket
      if (global.broadcastToMeeting) {
        global.broadcastToMeeting(meeting.id, {
          type: 'MEETING_UPDATED',
          meetingId: meeting.id,
          meeting,
        })
      }

      // Move to next stage
      currentStage = newStage

      // Small delay between stages
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    // Mark as completed
    meeting.status = 'completed'
    meeting.completedAt = new Date().toISOString()

    // Generate meeting summaries
    console.log(`Generating summaries for meeting ${meeting.id}...`)
    const summarizer = getMeetingSummarizer()
    const summaries = await summarizer.generateMeetingSummaries(meeting)
    console.log(`Generated summaries:`, summaries)

    // Create session memory
    await memoryManager.createSessionMemory(meeting)
    await memoryManager.extractLearnings(meeting)

    // Final update
    meetingsMap.set(meeting.id, meeting)

    // Broadcast completion
    if (global.broadcastToMeeting) {
      global.broadcastToMeeting(meeting.id, {
        type: 'MEETING_UPDATED',
        meetingId: meeting.id,
        meeting,
      })
    }

    console.log(`Meeting ${meeting.id} completed`)
  } catch (error) {
    console.error(`Meeting ${meeting.id} failed:`, error)
    meeting.status = 'failed'
    meeting.error = error instanceof Error ? error.message : String(error)
    meetingsMap.set(meeting.id, meeting)

    if (global.broadcastToMeeting) {
      global.broadcastToMeeting(meeting.id, {
        type: 'MEETING_UPDATED',
        meetingId: meeting.id,
        meeting,
      })
    }
  }
}
