import { getRoleProvider } from '../llm/providerFactory.js'
import type { CompletionMessage } from '../llm/providers/base.js'
import { getRoleManager } from '../persona/roleManager.js'
import type { Message } from '../../models/index.js'

/**
 * BRAIN intervention types
 */
export type BrainInterventionType = 'question' | 'perspective' | 'elaboration_request' | 'synthesis'

/**
 * BRAIN intervention result
 */
export interface BrainIntervention {
  type: BrainInterventionType
  content: string
  targetRole?: string
  reasoning?: string
}

/**
 * Discussion context for BRAIN analysis
 */
export interface DiscussionContext {
  topic: string
  messages: Message[]
  currentStage: string
  participatingRoles: string[]
  remainingBudget: number
}

/**
 * Main Brain Service - implements BRAIN's active discussion guidance
 */
export class MainBrainService {
  /**
   * Get completion for BRAIN with proper model config
   */
  private async completeForBrain(
    messages: CompletionMessage[],
    temperature?: number,
    maxTokens?: number
  ) {
    const { provider, model, temperature: defaultTemp, maxTokens: defaultMaxTokens } =
      await getRoleProvider('brain')

    return provider.complete({
      messages,
      model,
      temperature: temperature ?? defaultTemp,
      maxTokens: maxTokens ?? defaultMaxTokens,
    })
  }

  /**
   * Analyze discussion and determine if intervention is needed
   */
  async shouldIntervene(context: DiscussionContext): Promise<boolean> {
    // Simple heuristic: intervene after every 3-4 department statements
    // In production, use more sophisticated analysis

    const recentMessages = context.messages.slice(-5)
    const departmentStatements = recentMessages.filter(
      (m) => m.type === 'statement' && !['PRIME', 'BRAIN', 'CLERK'].includes(m.role)
    )

    // Intervene if 3+ departments have spoken
    return departmentStatements.length >= 3
  }

  /**
   * Generate a clarifying question
   */
  async generateQuestion(context: DiscussionContext): Promise<BrainIntervention> {
    const systemPrompt = await this.getBrainSystemPrompt()

    const userPrompt = this.buildQuestionPrompt(context)

    try {
      const response = await this.completeForBrain(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        0.3,
        500
      )

      // Parse the response to extract the question
      const content = response.content.trim()

      return {
        type: 'question',
        content,
        reasoning: 'Identified information gap or unclear aspect',
      }
    } catch (error) {
      console.error('Failed to generate BRAIN question:', error)
      throw error
    }
  }

  /**
   * Request elaboration from a role
   */
  async requestElaboration(context: DiscussionContext, targetRole: string): Promise<BrainIntervention> {
    const systemPrompt = await this.getBrainSystemPrompt()

    const userPrompt = this.buildElaborationPrompt(context, targetRole)

    try {
      const response = await this.completeForBrain(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        0.3,
        500
      )

      const content = response.content.trim()

      return {
        type: 'elaboration_request',
        content,
        targetRole,
        reasoning: `Requested ${targetRole} to expand on their point`,
      }
    } catch (error) {
      console.error('Failed to generate elaboration request:', error)
      throw error
    }
  }

  /**
   * Introduce a new perspective
   */
  async introducePerspective(context: DiscussionContext): Promise<BrainIntervention> {
    const systemPrompt = await this.getBrainSystemPrompt()

    const userPrompt = this.buildPerspectivePrompt(context)

    try {
      const response = await this.completeForBrain(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        0.4,
        600
      )

      const content = response.content.trim()

      return {
        type: 'perspective',
        content,
        reasoning: 'Identified missing viewpoint or consideration',
      }
    } catch (error) {
      console.error('Failed to generate perspective:', error)
      throw error
    }
  }

  /**
   * Synthesize the discussion so far
   */
  async synthesize(context: DiscussionContext): Promise<BrainIntervention> {
    const systemPrompt = await this.getBrainSystemPrompt()

    const userPrompt = this.buildSynthesisPrompt(context)

    try {
      const response = await this.completeForBrain(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        0.3,
        1000
      )

      const content = response.content.trim()

      return {
        type: 'synthesis',
        content,
        reasoning: 'Synthesized discussion for clarity',
      }
    } catch (error) {
      console.error('Failed to generate synthesis:', error)
      throw error
    }
  }

  /**
   * Decide what type of intervention is needed
   */
  async decideIntervention(context: DiscussionContext): Promise<BrainIntervention | null> {
    const systemPrompt = await this.getBrainSystemPrompt()

    // Build a summary of recent discussion
    const recentMessages = context.messages.slice(-10)
    const discussionSummary = recentMessages
      .map((m) => `${m.role}: ${m.content.substring(0, 200)}...`)
      .join('\n\n')

    const decisionPrompt = `Analyze the following discussion and determine what type of BRAIN intervention (if any) is needed:

**Topic:** ${context.topic}

**Discussion:**
${discussionSummary}

**Current Stage:** ${context.currentStage}

**Participating Roles:** ${context.participatingRoles.join(', ')}

Respond with ONE of the following:
1. "QUESTION: <your question>" - if you need clarification
2. "ELABORATE: <role name>: <your request>" - if someone should expand
3. "PERSPECTIVE: <your perspective>" - if a new angle is needed
4. "NONE" - if no intervention is needed

Be concise and specific.`

    try {
      const response = await this.completeForBrain(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: decisionPrompt },
        ],
        0.2,
        300
      )

      const content = response.content.trim()

      if (content.toUpperCase() === 'NONE') {
        return null
      }

      // Parse the response
      if (content.startsWith('QUESTION:')) {
        const question = content.replace('QUESTION:', '').trim()
        return {
          type: 'question',
          content: question,
          reasoning: 'Clarification needed',
        }
      } else if (content.startsWith('ELABORATE:')) {
        const match = content.match(/ELABORATE:\s*(\w+):\s*(.+)/)
        if (match) {
          return {
            type: 'elaboration_request',
            content: match[2],
            targetRole: match[1].toUpperCase(),
            reasoning: `Requested ${match[1]} to elaborate`,
          }
        }
      } else if (content.startsWith('PERSPECTIVE:')) {
        const perspective = content.replace('PERSPECTIVE:', '').trim()
        return {
          type: 'perspective',
          content: perspective,
          reasoning: 'New perspective introduced',
        }
      }

      // Default: treat as general question
      return {
        type: 'question',
        content,
        reasoning: 'Clarification needed',
      }
    } catch (error) {
      console.error('Failed to decide intervention:', error)
      return null
    }
  }

  /**
   * Get BRAIN's system prompt
   */
  private async getBrainSystemPrompt(): Promise<string> {
    const roleManager = await getRoleManager()
    return await roleManager.getSystemPrompt('brain') || 'You are BRAIN, the analytical brain of the cabinet.'
  }

  /**
   * Build prompt for question generation
   */
  private buildQuestionPrompt(context: DiscussionContext): string {
    const recentDiscussion = context.messages.slice(-5).map((m) => `${m.role}: ${m.content}`).join('\n\n')

    return `Review the following discussion and identify ONE important question that needs clarification:

**Topic:** ${context.topic}

**Recent Discussion:**
${recentDiscussion}

What is the most important question that needs to be asked? Be specific and constructive.`
  }

  /**
   * Build prompt for elaboration request
   */
  private buildElaborationPrompt(context: DiscussionContext, targetRole: string): string {
    const roleMessages = context.messages.filter((m) => m.role === targetRole)
    const lastMessage = roleMessages[roleMessages.length - 1]

    return `${targetRole} made the following statement:

"${lastMessage?.content || 'No statement found'}"

Request a thoughtful elaboration. What specific aspect needs more detail or evidence? Be constructive.`
  }

  /**
   * Build prompt for perspective introduction
   */
  private buildPerspectivePrompt(context: DiscussionContext): string {
    const discussionSummary = context.messages.slice(-8).map((m) => `${m.role}: ${m.content}`).join('\n\n')

    return `Review this discussion and identify ONE important perspective or consideration that is missing:

**Topic:** ${context.topic}

**Discussion:**
${discussionSummary}

What perspective, angle, or consideration has not been adequately addressed? Introduce it constructively.`
  }

  /**
   * Build prompt for synthesis
   */
  private buildSynthesisPrompt(context: DiscussionContext): string {
    const allMessages = context.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n')

    return `Synthesize the following discussion into a clear, concise summary:

**Topic:** ${context.topic}

**Full Discussion:**
${allMessages}

Provide:
1. Key points from each role
2. Areas of agreement
3. Areas of disagreement
4. Main insights or conclusions

Be objective and comprehensive.`
  }

  /**
   * Create a BRAIN message for the meeting timeline
   */
  createBrainMessage(intervention: BrainIntervention): Message {
    const now = new Date().toISOString()

    let type: Message['type'] = 'statement'
    if (intervention.type === 'question') type = 'question'
    if (intervention.type === 'perspective') type = 'perspective'
    if (intervention.type === 'elaboration_request') type = 'elaboration_request'

    return {
      id: `msg-${Date.now()}`,
      timestamp: now,
      role: 'BRAIN',
      type,
      content: intervention.content,
      metadata: {
        targetRole: intervention.targetRole,
        reasoning: intervention.reasoning,
      },
    }
  }
}

// Singleton instance
let brainInstance: MainBrainService | null = null

export function getMainBrainService(): MainBrainService {
  if (!brainInstance) {
    brainInstance = new MainBrainService()
  }
  return brainInstance
}
