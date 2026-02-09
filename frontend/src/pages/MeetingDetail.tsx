import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMeetingsStore } from '@/stores/meetingsStore'
import type { Message } from '@/types'

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { meetings, updateMeeting, appendMessage, addMeeting } = useMeetingsStore()
  const [isFetching, setIsFetching] = useState(false)

  const meeting = meetings.find((m) => m.id === id)

  useEffect(() => {
    if (!id || meeting) return

    const fetchMeeting = async () => {
      setIsFetching(true)
      try {
        const response = await fetch(`/api/meetings/${id}`)
        if (!response.ok) throw new Error('Failed to fetch meeting')
        const data = await response.json()
        addMeeting(data)
      } catch (error) {
        console.error('Failed to fetch meeting:', error)
      } finally {
        setIsFetching(false)
      }
    }

    fetchMeeting()
  }, [id, meeting, addMeeting])

  useEffect(() => {
    if (!id) return

    // Connect to WebSocket for real-time updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const websocket = new WebSocket(`${protocol}//${window.location.host}/ws`)

    websocket.onopen = () => {
      websocket.send(JSON.stringify({ type: 'JOIN_MEETING', meetingId: id }))
    }

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'MEETING_UPDATED') {
        updateMeeting(id, data.meeting)
      }
      if (data.type === 'MESSAGE' && data.message) {
        appendMessage(id, data.message)
      }
    }

    return () => {
      websocket.close()
    }
  }, [id, updateMeeting, appendMessage])

  if (!meeting) {
    return (
      <div className="text-center">
        <p className="text-slate-400">{isFetching ? '加载中...' : '会议不存在'}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-cyan-400 hover:text-cyan-300"
        >
          返回列表
        </button>
      </div>
    )
  }

  const handleRunMeeting = async () => {
    if (!id) return
    try {
      const response = await fetch(`/api/meetings/${id}/run`, { method: 'POST' })
      if (!response.ok) throw new Error('Failed to run meeting')

      // Optimistically update status in case WS is delayed
      updateMeeting(id, { status: 'running', startedAt: new Date().toISOString() })

      // One-time refresh to ensure state is synced
      const latest = await fetch(`/api/meetings/${id}`)
      if (latest.ok) {
        const data = await latest.json()
        updateMeeting(id, data)
      }
    } catch (error) {
      console.error('Failed to run meeting:', error)
      alert('启动会议失败，请稍后重试')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/')}
            className="mb-2 text-sm text-slate-400 hover:text-slate-300"
          >
            ← 返回列表
          </button>
          <h2 className="text-3xl font-bold text-white">{meeting.topic}</h2>
          <p className="mt-2 text-slate-400">
            状态:{' '}
            <span
              className={
                meeting.status === 'completed'
                  ? 'text-green-400'
                  : meeting.status === 'running'
                    ? 'text-blue-400'
                    : meeting.status === 'failed'
                      ? 'text-red-400'
                      : 'text-slate-400'
              }
            >
              {meeting.status === 'completed'
                ? '已完成'
                : meeting.status === 'running'
                  ? '进行中'
                  : meeting.status === 'failed'
                    ? '失败'
                    : '待开始'}
            </span>
          </p>
          {meeting.status === 'failed' && meeting.error && (
            <p className="mt-2 text-sm text-red-400">
              失败原因：{meeting.error}
            </p>
          )}
        </div>
        {meeting.status === 'pending' && (
          <button
            onClick={handleRunMeeting}
            className="rounded-lg bg-cyan-500 px-6 py-3 text-white hover:bg-cyan-600 transition-colors"
          >
            开始会议
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-slate-400">Token 使用</span>
          <span className="text-sm text-slate-400">
            {meeting.usage.toFixed(0)} / {meeting.budget.toFixed(0)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full bg-cyan-500 transition-all"
            style={{ width: `${(meeting.usage / meeting.budget) * 100}%` }}
          />
        </div>
        {meeting.degradation && meeting.degradation !== 'none' && (
          <p className="mt-2 text-sm text-yellow-400">
            {meeting.degradation === 'partial'
              ? '⚠️ 部分降级：部分流程已简化'
              : '⚠️ 严重降级：仅保留核心流程'}
          </p>
        )}
      </div>

      {/* Messages Timeline */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white">讨论记录</h3>
        {meeting.messages.length === 0 ? (
          <p className="text-slate-400">暂无消息</p>
        ) : (
          <div className="space-y-4">
            {meeting.messages.map((message: Message) => (
              <div
                key={message.id}
                className={`rounded-lg border p-4 ${
                  message.type === 'system'
                    ? 'border-slate-700 bg-slate-800/30'
                    : message.type === 'question'
                      ? 'border-yellow-700 bg-yellow-900/20'
                      : 'border-slate-700 bg-slate-800/50'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-cyan-400">{message.role}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(message.timestamp).toLocaleTimeString('zh-CN')}
                  </span>
                </div>
                <p className="text-slate-300 whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Artifacts */}
      {meeting.artifacts && Object.keys(meeting.artifacts).length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-white">会议产出</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {meeting.artifacts.issueBrief && (
              <div className="rounded-lg border border-cyan-700 bg-cyan-900/20 p-4">
                <h4 className="mb-2 font-semibold text-cyan-400">议题简报</h4>
                <div className="text-sm text-slate-300">
                  <p className="font-semibold">{meeting.artifacts.issueBrief.topic}</p>
                  <p className="mt-2">{meeting.artifacts.issueBrief.background}</p>
                </div>
              </div>
            )}
            {meeting.artifacts.finalDecision && (
              <div className="rounded-lg border border-green-700 bg-green-900/20 p-4">
                <h4 className="mb-2 font-semibold text-green-400">最终决策</h4>
                <div className="text-sm text-slate-300">
                  <p className="font-semibold">{meeting.artifacts.finalDecision.decision}</p>
                  <p className="mt-2">{meeting.artifacts.finalDecision.reasoning}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
