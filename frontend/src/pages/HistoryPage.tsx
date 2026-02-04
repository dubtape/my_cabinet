import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Meeting } from '../types'
import { ArrowRight, Clock, Users, MessageSquare } from 'lucide-react'

export default function HistoryPage() {
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const response = await fetch('/api/meetings')
        if (!response.ok) throw new Error('Failed to fetch meetings')
        const data = await response.json()
        setMeetings(data.sort((a: Meeting, b: Meeting) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }))
      } catch (error) {
        console.error('Failed to fetch meetings:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMeetings()
  }, [])

  const getStatusBadge = (status: Meeting['status']) => {
    const badges = {
      pending: 'bg-yellow-500/10 text-yellow-400',
      running: 'bg-green-500/10 text-green-400',
      completed: 'bg-blue-500/10 text-blue-400',
      failed: 'bg-red-500/10 text-red-400',
    }
    const labels = {
      pending: '等待中',
      running: '进行中',
      completed: '已完成',
      failed: '失败',
    }
    return { className: badges[status], label: labels[status] }
  }

  const getSnippet = (messages: any[]) => {
    if (messages.length === 0) return '暂无讨论'
    const snippets = messages.slice(0, 2).map((m) => {
      const content = m.content || ''
      return content.length > 50 ? content.slice(0, 50) + '...' : content
    })
    return snippets.join(' / ')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">奏折库</h1>
              <p className="mt-2 text-slate-400">历次议政记录</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-2 font-semibold text-white hover:from-cyan-600 hover:to-blue-600"
            >
              + 新建议政
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {isLoading ? (
          <div className="py-12 text-center text-slate-400">加载中...</div>
        ) : meetings.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-400">暂无议政记录</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-2 font-semibold text-white"
            >
              开始第一次议政
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {meetings.map((meeting) => {
              const statusBadge = getStatusBadge(meeting.status)
              return (
                <div
                  key={meeting.id}
                  onClick={() => navigate(`/chat/${meeting.id}`)}
                  className="group cursor-pointer rounded-lg border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm transition-all hover:border-cyan-500 hover:bg-slate-800/70"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <h3 className="flex-1 text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">
                      {meeting.topic}
                    </h3>
                    <span className={`ml-3 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge.className}`}>
                      {statusBadge.label}
                    </span>
                  </div>

                  <p className="mb-4 text-sm text-slate-400 line-clamp-2">
                    {getSnippet(meeting.messages)}
                  </p>

                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{new Date(meeting.createdAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MessageSquare className="h-4 w-4" />
                        <span>{meeting.messages.length} 条消息</span>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  </div>

                  {meeting.status === 'completed' && meeting.artifacts?.finalDecision && (
                    <div className="mt-3 rounded bg-cyan-500/10 p-2 text-xs text-cyan-400">
                      ✓ 已生成圣旨
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
