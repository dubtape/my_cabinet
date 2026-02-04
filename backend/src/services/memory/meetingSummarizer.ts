import { getMarkdownStore } from './markdownStore.js'
import type { Meeting, Message } from '../../models/index.js'
import type { MeetingSummaryMemory, DecisionSummaryMemory, ControversyMemory } from './types.js'

/**
 * Meeting Summarizer - Generates summaries after meetings
 */
export class MeetingSummarizer {
  private store = getMarkdownStore()

  /**
   * Generate all summaries after a meeting
   */
  async generateMeetingSummaries(meeting: Meeting): Promise<{
    meetingSummary: { id: string; type: string }
    decisionSummary?: { id: string; type: string }
    controversies: { id: string; type: string }[]
  }> {
    const results = {
      meetingSummary: { id: '', type: '' },
      decisionSummary: undefined as { id: string; type: string } | undefined,
      controversies: [] as { id: string; type: string }[],
    }

    // 1. Generate meeting summary
    const meetingSummary = await this.generateMeetingSummary(meeting)
    await this.store.writeMemory(
      'meeting_summary',
      meetingSummary.id,
      meetingSummary.frontmatter,
      meetingSummary.content
    )
    results.meetingSummary = { id: meetingSummary.id, type: 'meeting_summary' }

    // 2. Extract decision summary
    if (meeting.artifacts.finalDecision) {
      const decisionSummary = await this.extractDecisionSummary(meeting)
      await this.store.writeMemory(
        'decision',
        decisionSummary.id,
        decisionSummary.frontmatter,
        decisionSummary.content
      )
      results.decisionSummary = { id: decisionSummary.id, type: 'decision' }
    }

    // 3. Extract controversies
    const controversies = await this.extractControversies(meeting)
    for (const controversy of controversies) {
      await this.store.writeMemory(
        'controversy',
        controversy.id,
        controversy.frontmatter,
        controversy.content
      )
      results.controversies.push({ id: controversy.id, type: 'controversy' })
    }

    return results
  }

  /**
   * Generate meeting summary
   */
  private async generateMeetingSummary(meeting: Meeting): Promise<MeetingSummaryMemory> {
    const summaryId = `meeting-summary-${new Date().toISOString().split('T')[0]}-${meeting.id}`

    // Gather information
    const participants = this.extractParticipants(meeting.messages)
    const stages = this.extractStages(meeting.messages)
    const duration = meeting.completedAt && meeting.startedAt
      ? Math.floor((new Date(meeting.completedAt).getTime() - new Date(meeting.startedAt).getTime()) / 1000)
      : undefined

    // Build summary content
    const content = this.buildMeetingSummaryContent(meeting, participants, stages)

    const frontmatter = {
      id: summaryId,
      type: 'meeting_summary' as const,
      meetingId: meeting.id,
      topic: meeting.topic,
      date: new Date().toISOString().split('T')[0],
      participants,
      duration,
      tokenUsage: meeting.usage,
      stages,
    }

    return {
      type: 'meeting_summary',
      frontmatter,
      content,
    }
  }

  /**
   * Extract participants from messages
   */
  private extractParticipants(messages: Message[]): string[] {
    const roles = new Set<string>()
    for (const message of messages) {
      if (message.role !== 'SYSTEM') {
        roles.add(message.role)
      }
    }
    return Array.from(roles)
  }

  /**
   * Extract stages from messages
   */
  private extractStages(messages: Message[]): string[] {
    const stages = new Set<string>()
    for (const message of messages) {
      if (message.type === 'system' && message.content.includes('进入阶段:')) {
        const match = message.content.match(/进入阶段: (\w+)/)
        if (match) {
          stages.add(match[1])
        }
      }
    }
    return Array.from(stages)
  }

  /**
   * Build meeting summary content
   */
  private buildMeetingSummaryContent(meeting: Meeting, participants: string[], stages: string[]): string {
    let content = `# 会议摘要：${meeting.topic}\n\n`

    // Basic info
    content += `## 议题\n${meeting.topic}\n\n`
    if (meeting.description) {
      content += `${meeting.description}\n\n`
    }

    // Participants
    content += `## 参与角色\n`
    participants.forEach(role => {
      content += `- **${role}**\n`
    })
    content += '\n'

    // Stage by stage summary
    content += this.buildStageByStageSummary(meeting)

    // Final decision
    if (meeting.artifacts.finalDecision) {
      content += `## 最终决策\n${meeting.artifacts.finalDecision.decision}\n\n`
      content += `### 理由\n${meeting.artifacts.finalDecision.reasoning}\n\n`
    }

    // Controversies
    const brainAnalysis = meeting.artifacts.brainAnalysis
    if (brainAnalysis?.disagreements && brainAnalysis.disagreements.length > 0) {
      content += `## 争议点\n`
      brainAnalysis.disagreements.forEach((point, i) => {
        content += `${i + 1}. ${point}\n`
      })
      content += '\n'
    }

    return content
  }

  /**
   * Build stage-by-stage summary
   */
  private buildStageByStageSummary(meeting: Meeting): string {
    let content = '## 讨论过程\n\n'

    // Group messages by stage
    const stageMessages = new Map<string, Message[]>()
    for (const message of meeting.messages) {
      if (message.type === 'system' && message.content.includes('进入阶段:')) {
        const match = message.content.match(/进入阶段: (\w+)/)
        if (match) {
          const stage = match[1]
          if (!stageMessages.has(stage)) {
            stageMessages.set(stage, [])
          }
        }
      } else if (message.type !== 'system') {
        // Find current stage
        const lastStage = Array.from(stageMessages.keys()).pop()
        if (lastStage) {
          stageMessages.get(lastStage)!.push(message)
        }
      }
    }

    // Output each stage
    for (const [stage, messages] of stageMessages) {
      content += `### ${stage}\n\n`
      for (const message of messages) {
        content += `**${message.role}**: ${message.content.substring(0, 200)}${message.content.length > 200 ? '...' : ''}\n\n`
      }
    }

    return content
  }

  /**
   * Extract decision summary
   */
  private async extractDecisionSummary(meeting: Meeting): Promise<DecisionSummaryMemory> {
    const decisionId = `decision-${new Date().toISOString().split('T')[0]}-${meeting.id}`

    const finalDecision = meeting.artifacts.finalDecision
    if (!finalDecision) {
      throw new Error('No final decision found')
    }

    // Determine impact level based on budget and content
    const impact = this.assessImpact(meeting, finalDecision)

    // Determine category
    const category = this.categorizeDecision(meeting.topic, finalDecision)

    const content = `# 决策：${finalDecision.decision}\n\n`
      + `## 决策内容\n${finalDecision.decision}\n\n`
      + `## 决策理由\n${finalDecision.reasoning}\n\n`
      + `## 后续步骤\n${finalDecision.nextSteps?.map((s, i) => `${i + 1}. ${s}`).join('\n') || '暂无明确后续步骤'}\n`

    const frontmatter = {
      id: decisionId,
      type: 'decision' as const,
      meetingId: meeting.id,
      topic: meeting.topic,
      date: new Date().toISOString().split('T')[0],
      decisionMaker: 'PRIME',
      impact,
      category,
    }

    return {
      type: 'decision',
      frontmatter,
      content,
    }
  }

  /**
   * Assess decision impact
   */
  private assessImpact(meeting: Meeting, decision: any): 'high' | 'medium' | 'low' {
    // High impact indicators
    if (decision.decision.includes('实施') || decision.decision.includes('启动')) {
      return 'high'
    }

    // Token usage indicates complexity
    if (meeting.usage > meeting.budget * 0.8) {
      return 'high'
    }

    return 'medium'
  }

  /**
   * Categorize decision
   */
  private categorizeDecision(topic: string, decision: any): string {
    const keywords = {
      '财政': ['预算', '资金', '税收', '补贴', '成本'],
      '政策': ['政策', '法规', '标准', '规定'],
      '运营': ['流程', '实施', '执行', '操作'],
      '人事': ['人员', '任命', '组织', '团队'],
    }

    for (const [category, categoryKeywords] of Object.entries(keywords)) {
      if (categoryKeywords.some(kw => topic.includes(kw) || decision.decision.includes(kw))) {
        return category
      }
    }

    return '政策'
  }

  /**
   * Extract controversies from meeting
   */
  private async extractControversies(meeting: Meeting): Promise<ControversyMemory[]> {
    const controversies: ControversyMemory[] = []
    const brainAnalysis = meeting.artifacts.brainAnalysis

    if (!brainAnalysis?.disagreements || brainAnalysis.disagreements.length === 0) {
      return controversies
    }

    // Find messages related to each disagreement
    for (const disagreement of brainAnalysis.disagreements) {
      const controversyId = `controversy-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`

      // Find involved roles
      const involvedRoles = this.findInvolvedRoles(meeting.messages, disagreement)

      // Determine resolution status
      const resolutionStatus = this.determineResolutionStatus(meeting, disagreement)

      // Determine importance
      const importance = this.assessControversyImportance(disagreement)

      // Build content
      const content = this.buildControversyContent(disagreement, meeting.messages)

      const frontmatter = {
        id: controversyId,
        type: 'controversy' as const,
        meetingId: meeting.id,
        topic: `${meeting.topic} - ${disagreement.substring(0, 30)}`,
        date: new Date().toISOString().split('T')[0],
        involvedRoles,
        resolutionStatus,
        importance,
      }

      controversies.push({
        type: 'controversy',
        frontmatter,
        content,
      })
    }

    return controversies
  }

  /**
   * Find roles involved in a controversy
   */
  private findInvolvedRoles(messages: Message[], disagreement: string): string[] {
    const roles = new Set<string>()

    // Find messages mentioning the disagreement topic
    const relevantMessages = messages.filter(m =>
      m.content.includes(disagreement.substring(0, 20)) ||
      disagreement.includes(m.content.substring(0, 20))
    )

    for (const message of relevantMessages) {
      if (message.role !== 'SYSTEM' && message.role !== 'PRIME') {
        roles.add(message.role)
      }
    }

    return Array.from(roles)
  }

  /**
   * Determine if controversy was resolved
   */
  private determineResolutionStatus(meeting: Meeting, disagreement: string): 'resolved' | 'partial' | 'unresolved' {
    // Check if follow-up discussion mentions resolution
    const followUpMessages = meeting.messages.filter(m =>
      m.type === 'statement' && m.id.includes('-followup')
    )

    const resolvedKeywords = ['达成一致', '同意', '接受', '解决']
    const partialKeywords = ['进一步讨论', '需要研究', '保留意见']

    for (const message of followUpMessages) {
      if (resolvedKeywords.some(kw => message.content.includes(kw))) {
        return 'resolved'
      }
      if (partialKeywords.some(kw => message.content.includes(kw))) {
        return 'partial'
      }
    }

    return 'unresolved'
  }

  /**
   * Assess controversy importance
   */
  private assessControversyImportance(disagreement: string): 'high' | 'medium' | 'low' {
    const highImportanceKeywords = ['根本性', '原则', '关键', '核心']
    const lowImportanceKeywords = ['细节', '次要', '程序', '形式']

    if (highImportanceKeywords.some(kw => disagreement.includes(kw))) {
      return 'high'
    }
    if (lowImportanceKeywords.some(kw => disagreement.includes(kw))) {
      return 'low'
    }

    return 'medium'
  }

  /**
   * Build controversy content
   */
  private buildControversyContent(disagreement: string, messages: Message[]): string {
    let content = `# 争议点\n\n${disagreement}\n\n`

    // Find relevant messages
    const relevantMessages = messages.filter(m =>
      m.type === 'statement' &&
      ['CRITIC', 'FINANCE', 'WORKS'].includes(m.role)
    )

    // Group by role
    const roleMessages = new Map<string, Message[]>()
    for (const message of relevantMessages) {
      if (!roleMessages.has(message.role)) {
        roleMessages.set(message.role, [])
      }
      roleMessages.get(message.role)!.push(message)
    }

    // Output each role's perspective
    for (const [role, msgs] of roleMessages) {
      content += `## ${role} 的观点\n\n`
      for (const msg of msgs) {
        content += `${msg.content}\n\n`
      }
    }

    // Resolution
    content += `## 解决方式\n\n详见会议总结中的最终决策。\n`

    return content
  }
}

// Singleton instance
let summarizerInstance: MeetingSummarizer | null = null

export function getMeetingSummarizer(): MeetingSummarizer {
  if (!summarizerInstance) {
    summarizerInstance = new MeetingSummarizer()
  }
  return summarizerInstance
}
