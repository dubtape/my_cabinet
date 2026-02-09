import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Clock, MessageSquare } from 'lucide-react'
import AppShell from '../components/AppShell'
import { Meeting } from '../types'

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
        setMeetings(
          data.sort((a: Meeting, b: Meeting) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          })
        )
      } catch (error) {
        console.error('Failed to fetch meetings:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMeetings()
  }, [])

  const getStatusText = (status: Meeting['status']) => {
    if (status === 'pending') return '等待开始'
    if (status === 'running') return '进行中'
    if (status === 'completed') return '已完成'
    return '失败'
  }

  const getSnippet = (messages: Meeting['messages']) => {
    if (!messages.length) return '暂无讨论内容'
    const first = messages.find((m) => m.type !== 'system')
    if (!first) return '暂无讨论内容'
    return first.content.length > 80 ? `${first.content.slice(0, 80)}...` : first.content
  }

  return (
    <AppShell title="奏折库" backTo="/">
      {isLoading ? (
        <div className="apple-panel p-8 text-center text-sm text-slate-500">加载中...</div>
      ) : meetings.length === 0 ? (
        <div className="apple-panel p-8 text-center text-sm text-slate-500">暂无议政记录</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {meetings.map((meeting) => (
            <button
              key={meeting.id}
              type="button"
              onClick={() => navigate(`/chat/${meeting.id}`)}
              className="apple-panel group p-4 text-left"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <h2 className="line-clamp-2 text-sm font-semibold">{meeting.topic}</h2>
                <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {getStatusText(meeting.status)}
                </span>
              </div>

              <p className="mb-3 line-clamp-2 text-xs text-slate-600">{getSnippet(meeting.messages)}</p>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(meeting.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {meeting.messages.length} 条
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
              </div>
            </button>
          ))}
        </div>
      )}
    </AppShell>
  )
}
