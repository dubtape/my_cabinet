import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useMeetingsStore } from '@/stores/meetingsStore'

export default function MeetingsList() {
  const { meetings, setMeetings } = useMeetingsStore()
  const [filter, setFilter] = useState<'all' | 'running' | 'completed'>('all')
  const [isLoading, setIsLoading] = useState(true)

  const fetchMeetings = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/meetings')
      if (!response.ok) throw new Error('Failed to fetch meetings')
      const data = await response.json()
      setMeetings(data)
    } catch (error) {
      console.error('Failed to fetch meetings:', error)
    } finally {
      setIsLoading(false)
    }
  }, [setMeetings])

  // Fetch meetings from API
  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  const filteredMeetings = meetings.filter((m) => {
    if (filter === 'all') return true
    return m.status === filter
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">会议列表</h2>
          <p className="mt-2 text-slate-400">查看和管理所有内阁会议</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchMeetings}
            className="rounded-lg border border-slate-600 px-4 py-2 text-slate-300 hover:border-cyan-500 hover:bg-slate-700 transition-colors"
          >
            刷新
          </button>
          <Link
            to="/meetings/new"
            className="rounded-lg bg-cyan-500 px-6 py-3 text-white hover:bg-cyan-600 transition-colors"
          >
            创建新会议
          </Link>
        </div>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-lg px-4 py-2 transition-colors ${
            filter === 'all'
              ? 'bg-cyan-500 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          全部
        </button>
        <button
          onClick={() => setFilter('running')}
          className={`rounded-lg px-4 py-2 transition-colors ${
            filter === 'running'
              ? 'bg-cyan-500 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          进行中
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`rounded-lg px-4 py-2 transition-colors ${
            filter === 'completed'
              ? 'bg-cyan-500 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          已完成
        </button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-12 text-center">
            <p className="text-slate-400">加载中...</p>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-12 text-center">
            <p className="text-slate-400">暂无会议</p>
            <Link
              to="/meetings/new"
              className="mt-4 inline-block text-cyan-400 hover:text-cyan-300"
            >
              创建第一个会议 →
            </Link>
          </div>
        ) : (
          filteredMeetings.map((meeting) => (
            <Link
              key={meeting.id}
              to={`/meetings/${meeting.id}`}
              className="block rounded-lg border border-slate-700 bg-slate-800/50 p-6 hover:border-cyan-500 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">{meeting.topic}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {new Date(meeting.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <span
                    className={`rounded-full px-3 py-1 text-sm ${
                      meeting.status === 'completed'
                        ? 'bg-green-500/20 text-green-400'
                        : meeting.status === 'running'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-slate-500/20 text-slate-400'
                    }`}
                  >
                    {meeting.status === 'completed'
                      ? '已完成'
                      : meeting.status === 'running'
                        ? '进行中'
                        : '待开始'}
                  </span>
                  <span className="text-sm text-slate-400">
                    {meeting.usage.toFixed(0)} / {meeting.budget.toFixed(0)} tokens
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
