import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRolesStore } from '../stores/useRolesStore'
import { ChevronDown, ChevronUp, Plus } from 'lucide-react'

export default function HomePage() {
  const navigate = useNavigate()
  const { roles, selectedRoles, isLoading, fetchRoles, toggleRoleSelection } = useRolesStore()
  const [showGuide, setShowGuide] = useState(true)
  const [topic, setTopic] = useState('')

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  const handleStartMeeting = async () => {
    if (selectedRoles.length < 2) {
      alert('请至少选择2位大臣')
      return
    }
    if (!topic.trim()) {
      alert('请输入议题')
      return
    }

    try {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          description: '',
          budget: 50000,
        }),
      })

      if (!response.ok) throw new Error('Failed to create meeting')

      const meeting = await response.json()
      navigate(`/chat/${meeting.id}`)
    } catch (error) {
      console.error('Failed to create meeting:', error)
      alert('创建会议失败，请稍后重试')
    }
  }

  const getRoleColor = (roleName: string) => {
    const colors: Record<string, string> = {
      PRIME: 'bg-amber-500',
      BRAIN: 'bg-purple-500',
      CRITIC: 'bg-red-500',
      FINANCE: 'bg-green-500',
      WORKS: 'bg-blue-500',
      CLERK: 'bg-gray-500',
    }
    return colors[roleName] || 'bg-slate-500'
  }

  const getRoleTitle = (roleName: string) => {
    const titles: Record<string, string> = {
      PRIME: '首辅',
      BRAIN: '学士',
      CRITIC: '御史',
      FINANCE: '户部',
      WORKS: '工部',
      CLERK: '吏部',
    }
    return titles[roleName] || roleName
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-4xl font-bold text-cyan-400">赛博内阁</h1>
          <p className="mt-2 text-lg text-slate-400">众臣议政，为您解忧</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {/* 引导说明 */}
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <h2 className="text-xl font-semibold text-white">内阁运作指南</h2>
            {showGuide ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
          </button>
          {showGuide && (
            <div className="border-t border-slate-700 px-6 py-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-amber-500/10 p-4">
                  <h3 className="mb-2 font-semibold text-amber-400">首辅</h3>
                  <p className="text-sm text-slate-300">统筹会议流程，汇总各方观点，做出最终决策</p>
                </div>
                <div className="rounded-lg bg-purple-500/10 p-4">
                  <h3 className="mb-2 font-semibold text-purple-400">学士</h3>
                  <p className="text-sm text-slate-300">提供理性分析，基于数据和逻辑给出专业见解</p>
                </div>
                <div className="rounded-lg bg-red-500/10 p-4">
                  <h3 className="mb-2 font-semibold text-red-400">御史</h3>
                  <p className="text-sm text-slate-300">提供感性视角，关注人文关怀和情感因素</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 议题输入 */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm">
          <label className="mb-3 block text-lg font-semibold text-white">今日议题</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="请输入您想要咨询的问题..."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-lg text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            rows={3}
          />
        </div>

        {/* 角色选择 */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">选择参与议政的大臣</h2>
            <span className="text-sm text-slate-400">已选择 {selectedRoles.length} 位</span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-400">加载中...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => {
                const isSelected = selectedRoles.includes(role.id)
                return (
                  <div
                    key={role.id}
                    onClick={() => toggleRoleSelection(role.id)}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full text-white ${getRoleColor(role.name)}`}>
                        {getRoleTitle(role.name)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{role.title}</h3>
                        <p className="text-sm text-slate-400">{role.stance}</p>
                      </div>
                      <div
                        className={`h-6 w-6 rounded-full border-2 ${
                          isSelected ? 'border-cyan-500 bg-cyan-500' : 'border-slate-600'
                        }`}
                      >
                        {isSelected && (
                          <svg className="h-full w-full p-0.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div
                onClick={() => navigate('/roles')}
                className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-700 bg-slate-900/50 p-4 hover:border-slate-600"
              >
                <div className="flex items-center space-x-2 text-slate-400">
                  <Plus className="h-5 w-5" />
                  <span>自定义大臣</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 开始按钮 */}
        <div className="flex justify-center">
          <button
            onClick={handleStartMeeting}
            disabled={selectedRoles.length < 2 || !topic.trim()}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-12 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:from-cyan-600 hover:to-blue-600 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400"
          >
            开始议政
          </button>
        </div>
      </div>
    </div>
  )
}
