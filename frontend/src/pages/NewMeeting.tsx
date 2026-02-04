import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMeetingsStore } from '@/stores/meetingsStore'

export default function NewMeeting() {
  const navigate = useNavigate()
  const { addMeeting } = useMeetingsStore()
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState(50000)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, description, budget }),
      })

      if (!response.ok) throw new Error('Failed to create meeting')

      const newMeeting = await response.json()
      addMeeting(newMeeting)
      navigate(`/meetings/${newMeeting.id}`)
    } catch (error) {
      console.error('Failed to create meeting:', error)
      alert('创建会议失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white">创建新会议</h2>
        <p className="mt-2 text-slate-400">设置内阁会议议题和参数</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-slate-700 bg-slate-800/50 p-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">会议议题</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            placeholder="请输入会议议题..."
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            详细描述（可选）
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            placeholder="请输入议题的详细描述..."
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Token 预算: {budget.toLocaleString()}
          </label>
          <input
            type="range"
            min="10000"
            max="100000"
            step="5000"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-500">
            <span>10k</span>
            <span>100k</span>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg border border-slate-600 px-6 py-2 text-slate-300 hover:border-slate-500 hover:bg-slate-700 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !topic}
            className="rounded-lg bg-cyan-500 px-6 py-2 text-white hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
          >
            {isSubmitting ? '创建中...' : '创建会议'}
          </button>
        </div>
      </form>
    </div>
  )
}
