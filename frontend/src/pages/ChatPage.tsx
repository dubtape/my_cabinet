import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMeetingStore } from '../stores/useMeetingStore'
import { ArrowLeft, Send, MoreVertical } from 'lucide-react'

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentMeeting, messages, isConnected, addMessage, setConnected, setCurrentMeeting } = useMeetingStore()
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    // Fetch meeting details
    const fetchMeeting = async () => {
      try {
        const response = await fetch(`/api/meetings/${id}`)
        if (!response.ok) throw new Error('Failed to fetch meeting')
        const meeting = await response.json()
        setCurrentMeeting(meeting)
      } catch (error) {
        console.error('Failed to fetch meeting:', error)
      }
    }

    fetchMeeting()
  }, [id, setCurrentMeeting])

  useEffect(() => {
    // Connect WebSocket
    const ws = new WebSocket('ws://localhost:3000/ws')
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket connected')
      setConnected(true)
      // Join meeting
      ws.send(JSON.stringify({ type: 'JOIN_MEETING', meetingId: id }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('WebSocket message:', data)

      if (data.type === 'MEETING_UPDATED') {
        setCurrentMeeting(data.meeting)
        // Check for new messages
        if (data.meeting.messages.length > messages.length) {
          const newMessages = data.meeting.messages.slice(messages.length)
          newMessages.forEach((msg: any) => addMessage(msg))
        }
      }
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setConnected(false)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    return () => {
      ws.close()
    }
  }, [id, messages.length, addMessage, setConnected, setCurrentMeeting])

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!inputValue.trim() || !wsRef.current) return

    wsRef.current.send(
      JSON.stringify({
        type: 'USER_RESPONSE',
        meetingId: id,
        response: inputValue,
      })
    )

    // Add user message locally
    addMessage({
      id: `msg-${Date.now()}-user`,
      timestamp: new Date().toISOString(),
      role: 'USER',
      type: 'response',
      content: inputValue,
    })

    setInputValue('')
  }

  const handleStartMeeting = async () => {
    try {
      const response = await fetch(`/api/meetings/${id}/run`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to start meeting')
      alert('会议已启动')
    } catch (error) {
      console.error('Failed to start meeting:', error)
      alert('启动会议失败')
    }
  }

  const getRoleAvatar = (roleName: string) => {
    const colors: Record<string, string> = {
      PRIME: 'bg-amber-500',
      BRAIN: 'bg-purple-500',
      CRITIC: 'bg-red-500',
      FINANCE: 'bg-green-500',
      WORKS: 'bg-blue-500',
      CLERK: 'bg-gray-500',
      USER: 'bg-green-600',
    }
    const titles: Record<string, string> = {
      PRIME: '首',
      BRAIN: '学',
      CRITIC: '御',
      FINANCE: '户',
      WORKS: '工',
      CLERK: '吏',
      USER: '您',
    }
    return {
      color: colors[roleName] || 'bg-slate-500',
      title: titles[roleName] || roleName[0],
    }
  }

  const getRoleTitle = (roleName: string) => {
    const titles: Record<string, string> = {
      PRIME: '首辅',
      BRAIN: '学士',
      CRITIC: '御史',
      FINANCE: '户部',
      WORKS: '工部',
      CLERK: '吏部',
      USER: '您',
    }
    return titles[roleName] || roleName
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Sidebar */}
      <div className="w-80 border-r border-slate-700 bg-slate-900/50 p-6 backdrop-blur-sm">
        <button
          onClick={() => navigate('/history')}
          className="mb-6 flex items-center text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          返回奏折库
        </button>

        {currentMeeting && (
          <>
            <h2 className="mb-4 text-xl font-bold text-white">当前议题</h2>
            <div className="mb-6 rounded-lg bg-slate-800/50 p-4">
              <h3 className="mb-2 font-semibold text-cyan-400">{currentMeeting.topic}</h3>
              {currentMeeting.description && (
                <p className="text-sm text-slate-300">{currentMeeting.description}</p>
              )}
              <div className="mt-3 flex items-center space-x-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    currentMeeting.status === 'running'
                      ? 'bg-green-500/10 text-green-400'
                      : currentMeeting.status === 'completed'
                      ? 'bg-blue-500/10 text-blue-400'
                      : currentMeeting.status === 'failed'
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-yellow-500/10 text-yellow-400'
                  }`}
                >
                  {currentMeeting.status === 'running' && '进行中'}
                  {currentMeeting.status === 'completed' && '已完成'}
                  {currentMeeting.status === 'failed' && '失败'}
                  {currentMeeting.status === 'pending' && '等待开始'}
                </span>
              </div>
            </div>

            {currentMeeting.status === 'pending' && (
              <button
                onClick={handleStartMeeting}
                className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 font-semibold text-white hover:from-cyan-600 hover:to-blue-600"
              >
                开始议政
              </button>
            )}
          </>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900/50 px-6 py-3 backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-semibold text-white">议政大厅</h1>
            <span className="text-sm text-slate-400">#{id?.slice(-6)}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-slate-400">
              {isConnected ? '已连接' : '未连接'}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.length === 0 && (
              <div className="py-12 text-center text-slate-400">
                等待议政开始...
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.role === 'USER'
              const isSystem = message.type === 'system'
              const { color, title } = getRoleAvatar(message.role)

              if (isSystem) {
                return (
                  <div key={message.id} className="py-2 text-center">
                    <span className="rounded-full bg-slate-800/50 px-3 py-1 text-xs text-slate-400">
                      {message.content}
                    </span>
                  </div>
                )
              }

              return (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
                >
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${color} text-white text-sm font-semibold`}>
                    {title}
                  </div>
                  <div className={`flex max-w-[70%] ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`rounded-2xl px-4 py-2 ${
                        isUser
                          ? 'bg-green-500 text-white'
                          : message.role === 'PRIME'
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg'
                          : 'bg-white text-slate-900 shadow-md'
                      }`}
                    >
                      {!isUser && (
                        <div className={`mb-1 text-xs ${message.role === 'PRIME' ? 'text-amber-100' : 'text-slate-500'}`}>
                          {getRoleTitle(message.role)}
                        </div>
                      )}
                      <div className={`text-sm ${isUser ? 'text-white' : 'text-slate-900'}`}>
                        {message.content}
                      </div>
                      <div
                        className={`mt-1 text-xs ${
                          isUser ? 'text-green-100' : 'text-slate-400'
                        }`}
                      >
                        {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {isTyping && (
              <div className="flex items-start space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500 text-white text-sm">
                  ...
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 shadow-md">
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0.2s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-700 bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center space-x-3 rounded-full border border-slate-700 bg-white px-4 py-2 shadow-lg">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="您也想参与讨论？"
                className="flex-1 bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || !isConnected}
                className="rounded-full bg-cyan-500 p-2 text-white hover:bg-cyan-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
