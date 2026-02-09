import { getMainBrainService, type DiscussionContext } from './mainBrain.js'
import { getRoleManager } from '../persona/roleManager.js'
import { getRoleProvider } from '../llm/providerFactory.js'
import { getContextRetriever } from '../memory/contextRetriever.js'
import { getContextCompressor } from '../memory/contextCompressor.js'
import type { CompletionMessage } from '../llm/providers/base.js'
import type { Message, Meeting } from '../../models/index.js'
import { MeetingStage, getNextStage, canSkipStage, shouldSkipToDecision, STAGE_CONFIGS } from './stages.js'

/**
 * Flow control for the meeting orchestrator
 * Handles PRIME+BRAIN collaboration and stage transitions
 */
export class FlowControl {
  private brain = getMainBrainService()
  private roleManager = getRoleManager()
  private retriever = getContextRetriever()
  private compressor = getContextCompressor()
  private static completionQueue: Promise<void> = Promise.resolve()

  private shuffleRoles(roles: string[]): string[] {
    const shuffled = [...roles]
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  private readonly speechCharLimit = 50

  private getRoleFocusInstruction(role: string): string {
    const upperRole = role.toUpperCase()
    switch (upperRole) {
      case 'CRITIC':
        return '你是风险审查官，只能从风险、漏洞、反例角度发言，不要给预算细节。'
      case 'FINANCE':
        return '你是财政官，只能从成本、收益、预算约束角度发言，必须包含金额或成本判断。'
      case 'WORKS':
        return '你是实务执行官，只能从落地步骤、资源安排、时间节点角度发言。'
      default:
        return '请严格按照你的角色定位发言。'
    }
  }

  private withSpeechLimitInstruction(prompt: string): string {
    return `${prompt}\n\n硬性要求：你的最终发言必须控制在${this.speechCharLimit}个中文字符以内，不要换行，不要分点。`
  }

  private enforceSpeechLimit(content: string): string {
    const normalized = (content || '').replace(/\s+/g, ' ').trim()
    const chars = Array.from(normalized)
    if (chars.length <= this.speechCharLimit) {
      return normalized
    }
    return chars.slice(0, this.speechCharLimit).join('')
  }

  private getSelectedRoleIds(meeting: Meeting): string[] {
    const selected = Array.isArray(meeting.selectedRoleIds) ? meeting.selectedRoleIds : []
    if (selected.length === 0) {
      return ['prime', 'brain', 'critic', 'finance', 'works']
    }
    return [...new Set(selected.map((role) => role.toLowerCase()))]
  }

  private getDiscussionRoles(meeting: Meeting): string[] {
    const roles = this.getSelectedRoleIds(meeting)
      .filter((role) => !['prime', 'brain', 'clerk'].includes(role))
      .map((role) => role.toUpperCase())

    if (roles.length > 0) {
      return roles
    }

    // Safety fallback: keep core department discussion available.
    return ['CRITIC', 'FINANCE', 'WORKS']
  }

  /**
   * Get completion for a role with proper model config
   */
  private async completeForRole(
    role: string,
    messages: CompletionMessage[],
    temperature?: number,
    maxTokens?: number
  ) {
    const run = async () => {
      const { provider, model, temperature: defaultTemp, maxTokens: defaultMaxTokens } =
        await getRoleProvider(role)

      return provider.complete({
        messages,
        model,
        temperature: temperature ?? defaultTemp,
        maxTokens: maxTokens ?? defaultMaxTokens,
      })
    }

    const task = FlowControl.completionQueue.then(run, run)
    FlowControl.completionQueue = task.then(
      () => undefined,
      () => undefined
    )
    return task
  }

  /**
   * Execute a stage with PRIME+BRAIN collaboration
   */
  async executeStage(
    meeting: Meeting,
    stage: MeetingStage,
    ws?: WebSocket
  ): Promise<{ messages: Message[]; newStage: MeetingStage; degradation?: 'partial' | 'severe' }> {
    const messages: Message[] = []

    // Check budget constraints
    const usage = meeting.usage
    const budget = meeting.budget

    // If budget exceeded, skip to decision
    if (shouldSkipToDecision(usage, budget) && stage !== MeetingStage.PRIME_DECISION) {
      return {
        messages,
        newStage: MeetingStage.PRIME_DECISION,
        degradation: 'severe',
      }
    }

    // Check if stage should be skipped
    if (canSkipStage(stage, usage, budget) && stage !== MeetingStage.PRIME_DECISION) {
      return {
        messages,
        newStage: getNextStage(stage),
        degradation: 'partial',
      }
    }

    // Add stage transition message
    const stageMessage = {
      id: `msg-${Date.now()}`,
      timestamp: new Date().toISOString(),
      role: 'SYSTEM' as const,
      type: 'system' as const,
      content: `进入阶段: ${stage}`,
    }
    messages.push(stageMessage)

    // Execute stage-specific logic
    let newStage = stage
    let degradation: 'partial' | 'severe' | undefined = undefined

    switch (stage) {
      case MeetingStage.ISSUE_BRIEF:
        const issueBrief = await this.executeIssueBrief(meeting)
        messages.push(...issueBrief.messages)
        meeting.artifacts.issueBrief = issueBrief.artifact
        meeting.usage += issueBrief.tokens
        newStage = getNextStage(stage)
        break

      case MeetingStage.DEPARTMENT_SPEECHES:
        const deptSpeeches = await this.executeDepartmentSpeeches(meeting, ws)
        messages.push(...deptSpeeches.messages)
        meeting.usage += deptSpeeches.tokens
        newStage = getNextStage(stage)
        break

      case MeetingStage.BRAIN_INTERVENTION:
        const brainIntervention = await this.executeBrainIntervention(meeting)
        messages.push(...brainIntervention.messages)
        meeting.artifacts.brainAnalysis = brainIntervention.artifact
        meeting.usage += brainIntervention.tokens
        newStage = getNextStage(stage)
        break

      case MeetingStage.PRIME_SUMMARY:
        const summary = await this.executePrimeSummary(meeting)
        messages.push(...summary.messages)
        meeting.artifacts.summary = summary.artifact
        meeting.usage += summary.tokens
        newStage = getNextStage(stage)
        break

      case MeetingStage.FOLLOW_UP_DISCUSSION:
        const followUp = await this.executeFollowUpDiscussion(meeting, ws)
        messages.push(...followUp.messages)
        meeting.usage += followUp.tokens
        newStage = getNextStage(stage)
        break

      case MeetingStage.PRIME_DECISION:
        const decision = await this.executePrimeDecision(meeting)
        messages.push(...decision.messages)
        meeting.artifacts.finalDecision = decision.artifact
        meeting.usage += decision.tokens
        newStage = MeetingStage.COMPLETED
        break

      default:
        newStage = getNextStage(stage)
    }

    return { messages, newStage, degradation }
  }

  /**
   * Execute Issue Brief stage
   */
  private async executeIssueBrief(meeting: Meeting): Promise<{ messages: Message[]; artifact: any; tokens: number }> {
    const systemPrompt = await (await this.roleManager).getSystemPrompt('prime')

    // Retrieve relevant context from memory
    const contextPackage = await this.retriever.buildContextPackage({
      topic: meeting.topic,
      limit: 5,
      minRelevance: 0.6,
    })

    const userPrompt = this.withSpeechLimitInstruction(`请为以下议题创建简报:

议题: ${meeting.topic}
${meeting.description ? `描述: ${meeting.description}` : ''}

${contextPackage.tokens > 0 ? `\n相关背景:\n${contextPackage.content}\n` : ''}(注：以上为历史相关决策和经验，供参考)
`)

    const response = await this.completeForRole(
      'prime',
      [
        { role: 'system', content: systemPrompt || '' },
        { role: 'user', content: userPrompt },
      ],
      0.4,
      1000 // Increased to accommodate context
    )

    const message: Message = {
      id: `msg-${Date.now()}`,
      timestamp: new Date().toISOString(),
      role: 'PRIME',
      type: 'statement',
      content: this.enforceSpeechLimit(response.content),
    }

    const artifact = {
      topic: meeting.topic,
      background: response.content,
      keyConsiderations: [],
    }

    return {
      messages: [message],
      artifact,
      tokens: response.usage?.totalTokens || this.estimateTokens(response.content),
    }
  }

  /**
   * Execute Department Speeches stage
   */
  private async executeDepartmentSpeeches(meeting: Meeting, ws?: WebSocket): Promise<{ messages: Message[]; tokens: number }> {
    const roles = this.shuffleRoles(this.getDiscussionRoles(meeting))
    const messages: Message[] = []
    let totalTokens = 0

    if (roles.length === 0) {
      return {
        messages: [{
          id: `msg-${Date.now()}-system`,
          timestamp: new Date().toISOString(),
          role: 'SYSTEM',
          type: 'system',
          content: '无可用部门角色，跳过部门发言阶段。',
        }],
        tokens: 0,
      }
    }

    // Compress context if needed
    const contextMessages = await this.compressor.compressIfNeeded(meeting)
    const baseDiscussionSoFar = contextMessages
      .map((m) => {
        if (m.type === 'compressed') {
          return `[${m.metadata?.compressionMethod || 'summary'}] ${m.metadata?.originalCount || '?'} 条消息已压缩`
        }
        return `${m.role}: ${m.content.substring(0, 150)}${m.content.length > 150 ? '...' : ''}`
      })
      .join('\n\n')

    for (const role of roles) {
      const systemPrompt = await (await this.roleManager).getSystemPrompt(role.toLowerCase())
      const roleFocus = this.getRoleFocusInstruction(role)
      const liveDiscussionSoFar = [
        baseDiscussionSoFar,
        ...messages.map((m) => `${m.role}: ${m.content}`),
      ]
        .filter(Boolean)
        .join('\n\n')
      const userPrompt = this.withSpeechLimitInstruction(`议题: ${meeting.topic}

角色要求:
${roleFocus}

已发言内容:
${liveDiscussionSoFar}

请结合以上发言，提供你的完整意见和建议。`)

      const response = await this.completeForRole(
        role.toLowerCase(),
        [
          { role: 'system', content: systemPrompt || '' },
          { role: 'user', content: userPrompt },
        ],
        0.6,
        800
      )

      const message: Message = {
        id: `msg-${Date.now()}-${role}`,
        timestamp: new Date().toISOString(),
        role,
        type: 'statement',
        content: this.enforceSpeechLimit(response.content),
      }

      messages.push(message)
      totalTokens += response.usage?.totalTokens || this.estimateTokens(response.content)

      // Send WebSocket update if available
      if (ws) {
        ws.send(JSON.stringify({
          type: 'MESSAGE',
          meetingId: meeting.id,
          message,
        }))
      }
    }

    return { messages, tokens: totalTokens }
  }

  /**
   * Execute BRAIN Intervention stage - Analyze discussions and identify issues
   */
  private async executeBrainIntervention(meeting: Meeting): Promise<{ messages: Message[]; artifact: any; tokens: number }> {
    const messages: Message[] = []
    const participatingRoles = this.getDiscussionRoles(meeting)

    // Build context for BRAIN
    const context: DiscussionContext = {
      topic: meeting.topic,
      messages: meeting.messages,
      currentStage: 'brain_intervention',
      participatingRoles,
      remainingBudget: meeting.budget - meeting.usage,
    }

    // Ask BRAIN to analyze the discussion
    const systemPrompt = `你是内阁主脑（BRAIN），负责分析和引导讨论。

你的任务：
1. 分析第一轮部门发言
2. 识别共识点和分歧点
3. 找出需要澄清的关键问题
4. 如有必要，指定某个角色对特定问题进行阐述

请以JSON格式回复分析结果。`

    const recentDiscussion = meeting.messages
      .filter(m => participatingRoles.includes(m.role))
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n')

    const userPrompt = this.withSpeechLimitInstruction(`议题: ${meeting.topic}

第一轮部门发言：
${recentDiscussion}

请分析以上讨论，并返回：
{
  "analysis": "对整体讨论的分析",
  "consensus": ["共识点1", "共识点2"],
  "disagreements": ["分歧点1", "分歧点2"],
  "clarificationNeeded": {
    "role": "CRITIC|FINANCE|WORKS",
    "question": "需要该角色澄清的问题"
  },
  "shouldIntervene": true|false
}

如果没有需要澄清的问题，将 shouldIntervene 设为 false，clarificationNeeded 设为 null。`)

    try {
      const response = await this.completeForRole(
        'brain',
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        0.3,
        1000
      )

      const message: Message = {
        id: `msg-${Date.now()}-brain`,
        timestamp: new Date().toISOString(),
        role: 'BRAIN',
        type: 'statement',
        content: this.enforceSpeechLimit(response.content),
      }

      messages.push(message)

      // Parse JSON response
      const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/) ||
                         response.content.match(/\{[\s\S]*\}/)
      let analysis = null
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[1] || jsonMatch[0])
        } catch {
          // Failed to parse, continue
        }
      }

      // If clarification needed, get the response
      if (analysis?.shouldIntervene && analysis?.clarificationNeeded?.role) {
        const targetRole = analysis.clarificationNeeded.role
        if (participatingRoles.includes(String(targetRole).toUpperCase())) {
          const clarification = await this.getClarification(meeting, targetRole, analysis.clarificationNeeded.question)
          messages.push(clarification.message)
        }
      }

      const artifact = {
        analysis: response.content,
        parsed: analysis,
        consensus: analysis?.consensus || [],
        disagreements: analysis?.disagreements || [],
      }

      return {
        messages,
        artifact,
        tokens: response.usage?.totalTokens || this.estimateTokens(response.content),
      }
    } catch (error) {
      console.error('BRAIN intervention error:', error)
      // Fallback
      const fallbackMessage: Message = {
        id: `msg-${Date.now()}-brain-fallback`,
        timestamp: new Date().toISOString(),
        role: 'BRAIN',
        type: 'statement',
        content: '讨论已进行，进入总结阶段。',
      }
      return {
        messages: [fallbackMessage],
        artifact: { analysis: '分析失败', consensus: [], disagreements: [] },
        tokens: 100,
      }
    }
  }

  /**
   * Get clarification from a role
   */
  private async getClarification(meeting: Meeting, role: string, question: string): Promise<{ message: Message; tokens: number }> {
    const systemPrompt = await (await this.roleManager).getSystemPrompt(role.toLowerCase())
    const discussion = meeting.messages
      .filter(m => ['CRITIC', 'FINANCE', 'WORKS', 'BRAIN'].includes(m.role))
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n')

    const userPrompt = this.withSpeechLimitInstruction(`议题: ${meeting.topic}

之前的讨论：
${discussion}

BRAIN 请你澄清以下问题：
${question}

请提供详细回答。`)

    const response = await this.completeForRole(
      role.toLowerCase(),
      [
        { role: 'system', content: systemPrompt || '' },
        { role: 'user', content: userPrompt },
      ],
      0.5,
      800
    )

    const message: Message = {
      id: `msg-${Date.now()}-${role}-clarification`,
      timestamp: new Date().toISOString(),
      role: role.toUpperCase(),
      type: 'statement',
      content: this.enforceSpeechLimit(response.content),
    }

    return {
      message,
      tokens: response.usage?.totalTokens || this.estimateTokens(response.content),
    }
  }

  /**
   * Execute PRIME Summary stage
   */
  private async executePrimeSummary(meeting: Meeting): Promise<{ messages: Message[]; artifact: any; tokens: number }> {
    const systemPrompt = await (await this.roleManager).getSystemPrompt('prime')
    const participatingRoles = this.getDiscussionRoles(meeting)

    // Build discussion summary including BRAIN analysis
    const discussion = meeting.messages
      .filter(m => participatingRoles.includes(m.role) || m.role === 'BRAIN')
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n')

    const brainAnalysis = meeting.artifacts.brainAnalysis
    const analysisContext = brainAnalysis
      ? `\n\n主脑分析结果：\n${JSON.stringify(brainAnalysis, null, 2)}`
      : ''

    const userPrompt = this.withSpeechLimitInstruction(`议题: ${meeting.topic}

各部门发言及主脑分析：
${discussion}${analysisContext}

请作为总理，提供一份结构化总结，包含：
1. **核心观点**：各部门的主要观点
2. **共识点**：各方达成一致的地方
3. **分歧点**：需要进一步讨论的问题
4. **后续方向**：第二轮讨论需要聚焦的重点

请用清晰的标题和段落组织回答。`)

    const response = await this.completeForRole(
      'prime',
      [
        { role: 'system', content: systemPrompt || '' },
        { role: 'user', content: userPrompt },
      ],
      0.4,
      1500
    )

    const message: Message = {
      id: `msg-${Date.now()}-prime-summary`,
      timestamp: new Date().toISOString(),
      role: 'PRIME',
      type: 'statement',
      content: this.enforceSpeechLimit(response.content),
    }

    const artifact = {
      summary: response.content,
      structure: 'PRIME总结',
    }

    return {
      messages: [message],
      artifact,
      tokens: response.usage?.totalTokens || this.estimateTokens(response.content),
    }
  }

  /**
   * Execute Follow-up Discussion stage (Round 2)
   */
  private async executeFollowUpDiscussion(meeting: Meeting, ws?: WebSocket): Promise<{ messages: Message[]; tokens: number }> {
    const roles = this.shuffleRoles(this.getDiscussionRoles(meeting))
    const messages: Message[] = []
    let totalTokens = 0

    if (roles.length === 0) {
      return { messages, tokens: 0 }
    }

    const primeSummary = meeting.messages.find(m => m.id.includes('prime-summary'))
    const brainAnalysis = meeting.artifacts.brainAnalysis

    // Build focused discussion points
    const discussionPoints = brainAnalysis?.disagreements?.length > 0
      ? `需要重点讨论的分歧点：\n${brainAnalysis.disagreements.map((d, i) => `${i + 1}. ${d}`).join('\n')}`
      : '基于群主总结，请判断是否需要补充观点。'

    for (const role of roles) {
      const roleSystemPrompt = await (await this.roleManager).getSystemPrompt(role.toLowerCase())
      const roleFocus = this.getRoleFocusInstruction(role)
      const latestUserMessage = [...meeting.messages].reverse().find((m) => m.role === 'USER')

      const followupPrompt = this.withSpeechLimitInstruction(`议题: ${meeting.topic}

群主总结：
${primeSummary?.content || '（无）'}

${discussionPoints}

用户最新追加意见：
${latestUserMessage?.content || '（无）'}

角色要求：
${roleFocus}

请判断是否需要继续发言：
- 如果需要补充或回应分歧点，请直接给出你的发言。
- 如果群主总结已充分涵盖你的观点，请仅回复 "NO_RESPONSE"。

注意：第二轮重点是对分歧点的回应和补充。`)

      const followup = await this.completeForRole(
        role.toLowerCase(),
        [
          { role: 'system', content: roleSystemPrompt || '' },
          { role: 'user', content: followupPrompt },
        ],
        0.5,
        800
      )

      const content = this.enforceSpeechLimit(followup.content.trim())
      const noResponseSignals = ['NO_RESPONSE', '不发言', '无需补充', '无补充', '不需要补充', '总结已涵盖', '无新增观点']
      const shouldSkip = noResponseSignals.some((signal) => content.includes(signal))

      if (shouldSkip) {
        totalTokens += followup.usage?.totalTokens || this.estimateTokens(content)
        continue
      }

      const followupMessage: Message = {
        id: `msg-${Date.now()}-${role}-followup`,
        timestamp: new Date().toISOString(),
        role,
        type: 'statement',
        content,
      }

      messages.push(followupMessage)
      totalTokens += followup.usage?.totalTokens || this.estimateTokens(content)

      // Send WebSocket update if available
      if (ws) {
        ws.send(JSON.stringify({
          type: 'MESSAGE',
          meetingId: meeting.id,
          message: followupMessage,
        }))
      }
    }

    return { messages, tokens: totalTokens }
  }

  /**
   * Execute Prime Decision stage
   */
  private async executePrimeDecision(meeting: Meeting): Promise<{ messages: Message[]; artifact: any; tokens: number }> {
    const systemPrompt = await (await this.roleManager).getSystemPrompt('prime')

    // Build full context
    const discussion = meeting.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n')
    const userPrompt = this.withSpeechLimitInstruction(`基于以下讨论，请做出最终决定:\n\n议题: ${meeting.topic}\n\n讨论内容:\n${discussion}\n\n请提供:\n1. 决定\n2. 理由\n3. 后续步骤`)

    const response = await this.completeForRole(
      'prime',
      [
        { role: 'system', content: systemPrompt || '' },
        { role: 'user', content: userPrompt },
      ],
      0.4,
      1000
    )

    const message: Message = {
      id: `msg-${Date.now()}`,
      timestamp: new Date().toISOString(),
      role: 'PRIME',
      type: 'statement',
      content: this.enforceSpeechLimit(response.content),
    }

    const artifact = {
      decision: response.content,
      reasoning: '基于各部门意见的综合决策',
      nextSteps: [],
    }

    return {
      messages: [message],
      artifact,
      tokens: response.usage?.totalTokens || this.estimateTokens(response.content),
    }
  }

  /**
   * Estimate tokens (rough approximation)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }
}

export function getFlowControl(): FlowControl {
  return new FlowControl()
}
