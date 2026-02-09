import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Play, Send } from 'lucide-react'
import AppShell from '../components/AppShell'
import { useMeetingStore } from '../stores/useMeetingStore'

const ROLE_STYLES: Record<string, { dot: string; name: string }> = {
  PRIME: { dot: '#d97706', name: '首辅' },
  BRAIN: { dot: '#2563eb', name: '主脑' },
  CRITIC: { dot: '#b91c1c', name: '御史' },
  FINANCE: { dot: '#047857', name: '户部' },
  WORKS: { dot: '#1d4ed8', name: '工部' },
  CLERK: { dot: '#4b5563', name: '吏部' },
  USER: { dot: '#0f766e', name: '您' },
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const {
    currentMeeting,
    messages,
    isConnected,
    setConnected,
    setCurrentMeeting,
    setMessages,
  } = useMeetingStore()

  const [inputValue, setInputValue] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const wsCandidates = useMemo(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const directHost = window.location.hostname || 'localhost'
    const isDevServer = window.location.port === '5173'

    if (isDevServer) {
      // In Vite dev, connect backend WS directly to avoid proxy socket abort noise.
      return [
        `${protocol}//${directHost}:3001/ws`,
        `${protocol}//localhost:3001/ws`,
        `${protocol}//127.0.0.1:3001/ws`,
      ]
    }

    return [
      `${protocol}//${window.location.host}/ws`,
      `${protocol}//${directHost}:3001/ws`,
      `${protocol}//localhost:3001/ws`,
      `${protocol}//127.0.0.1:3001/ws`,
    ]
  }, [])

  useEffect(() => {
    if (!id) return

    const fetchMeeting = async () => {
      try {
        const response = await fetch(`/api/meetings/${id}`)
        if (!response.ok) throw new Error('Failed to fetch meeting')
        const meeting = await response.json()
        setCurrentMeeting(meeting)
        setMessages(meeting.messages || [])
      } catch (error) {
        console.error('Failed to fetch meeting:', error)
      }
    }

    fetchMeeting()
  }, [id, setCurrentMeeting, setMessages])

  useEffect(() => {
    if (!id) return

    let stopped = false
    let activeWs: WebSocket | null = null

    const connectByIndex = (index: number) => {
      if (stopped || index >= wsCandidates.length) {
        setConnected(false)
        return
      }

      const ws = new WebSocket(wsCandidates[index])
      activeWs = ws
      wsRef.current = ws

      ws.onopen = () => {
        if (stopped) {
          ws.close()
          return
        }
        setConnected(true)
        ws.send(JSON.stringify({ type: 'JOIN_MEETING', meetingId: id }))
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'MEETING_UPDATED') {
          setCurrentMeeting(data.meeting)
          setMessages(data.meeting.messages || [])
        }
      }

      ws.onclose = () => {
        if (stopped) return
        setConnected(false)
        connectByIndex(index + 1)
      }

      ws.onerror = () => {
        if (stopped) return
        setConnected(false)
        ws.close()
      }
    }

    connectByIndex(0)

    return () => {
      stopped = true
      if (activeWs) {
        activeWs.close()
      }
      wsRef.current = null
    }
  }, [id, wsCandidates, setConnected, setCurrentMeeting, setMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!inputValue.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !id) return

    wsRef.current.send(
      JSON.stringify({
        type: 'USER_RESPONSE',
        meetingId: id,
        response: inputValue.trim(),
      })
    )

    setInputValue('')
  }

  const handleStartMeeting = async () => {
    if (!id) return

    setIsStarting(true)
    try {
      const response = await fetch(`/api/meetings/${id}/run`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start meeting')
      }
      if (currentMeeting) {
        setCurrentMeeting({ ...currentMeeting, status: 'running' })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '启动会议失败'
      alert(message)
    } finally {
      setIsStarting(false)
    }
  }

  const getStatusText = (status?: string) => {
    if (status === 'running') return '进行中'
    if (status === 'completed') return '已完成'
    if (status === 'failed') return '失败'
    return '等待开始'
  }

  return (
    <AppShell title="议政大厅" backTo="/history">
      <div className="grid h-full min-h-[70vh] gap-3 lg:grid-cols-[280px_1fr]">
        <aside className="apple-panel p-3 text-sm">
          <div className="mb-3 text-xs uppercase text-slate-500">议题信息</div>
          {currentMeeting ? (
            <>
              <div className="mb-2 font-semibold">{currentMeeting.topic}</div>
              <div className="text-xs text-slate-600">状态: {getStatusText(currentMeeting.status)}</div>
              <div className="mt-1 text-xs text-slate-600">WebSocket: {isConnected ? '已连接' : '未连接'}</div>
              {currentMeeting.status === 'pending' && (
                <button type="button" onClick={handleStartMeeting} disabled={isStarting} className="apple-primary-btn mt-3 w-full justify-center">
                  <Play className="h-4 w-4" />
                  {isStarting ? '启动中...' : '开始议政'}
                </button>
              )}
            </>
          ) : (
            <div className="text-xs text-slate-500">加载中...</div>
          )}
        </aside>

        <section className="apple-panel flex min-h-0 flex-col">
          <div className="border-b border-slate-300 px-4 py-2 text-xs text-slate-600">
            会议 #{id?.slice(-6)} · {getStatusText(currentMeeting?.status)}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mx-auto flex max-w-4xl flex-col gap-3">
              {messages.length === 0 && (
                <div className="apple-panel p-6 text-center text-sm text-slate-500">等待议政开始...</div>
              )}

              {messages.map((message) => {
                if (message.type === 'system') {
                  return (
                    <div key={message.id} className="text-center text-xs text-slate-500">
                      <span className="rounded border border-slate-300 bg-slate-100 px-2 py-1">{message.content}</span>
                    </div>
                  )
                }

                const isUser = message.role === 'USER'
                const meta = ROLE_STYLES[message.role] || { dot: '#64748b', name: message.role }

                return (
                  <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded border px-3 py-2 shadow-sm ${isUser ? 'border-teal-500 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-800'}`}>
                      <div className={`mb-1 flex items-center gap-2 text-xs ${isUser ? 'text-teal-100' : 'text-slate-500'}`}>
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: meta.dot }} />
                        <span>{meta.name}</span>
                        <span>{new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                    </div>
                  </div>
                )
              })}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-slate-300 bg-white p-3">
            <div className="mx-auto flex max-w-4xl gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="输入你的补充意见..."
                className="apple-input flex-1"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputValue.trim() || !isConnected}
                className="apple-primary-btn min-w-20 justify-center"
              >
                <Send className="h-4 w-4" />
                发送
              </button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
