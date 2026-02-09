import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, Plus } from 'lucide-react'
import AppShell from '../components/AppShell'
import { useRolesStore } from '../stores/useRolesStore'

const ROLE_COLORS: Record<string, string> = {
  PRIME: '#f59e0b',
  BRAIN: '#2563eb',
  CRITIC: '#b91c1c',
  FINANCE: '#047857',
  WORKS: '#1d4ed8',
  CLERK: '#4b5563',
}

const ROLE_TITLES: Record<string, string> = {
  PRIME: '首辅',
  BRAIN: '主脑',
  CRITIC: '御史',
  FINANCE: '户部',
  WORKS: '工部',
  CLERK: '吏部',
}

export default function HomePage() {
  const navigate = useNavigate()
  const { roles, selectedRoles, isLoading, error, fetchRoles, toggleRoleSelection } = useRolesStore()
  const [showGuide, setShowGuide] = useState(true)
  const [topic, setTopic] = useState('')

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  const handleStartMeeting = async () => {
    if (selectedRoles.length < 2) {
      alert('请至少选择 2 位大臣')
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
          selectedRoleIds: selectedRoles,
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

  return (
    <AppShell title="赛博内阁" >
      <div className="space-y-4">
        <section className="apple-panel p-4">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="flex w-full items-center justify-between text-left text-sm font-semibold"
          >
            <span>内阁运作指南</span>
            {showGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showGuide && (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="apple-card">
                <div className="apple-card-title">首辅</div>
                <p>统筹流程并形成最终决策。</p>
              </div>
              <div className="apple-card">
                <div className="apple-card-title">主脑</div>
                <p>发现讨论缺口并发起澄清。</p>
              </div>
              <div className="apple-card">
                <div className="apple-card-title">部门</div>
                <p>从风险、财务与执行提出建议。</p>
              </div>
            </div>
          )}
        </section>

        <section className="apple-panel p-4">
          <label className="mb-2 block text-sm font-semibold">今日议题</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="请输入您想讨论的问题..."
            className="apple-input min-h-24 w-full resize-y"
          />
        </section>

        <section className="apple-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">参与议政的大臣</h2>
            <span className="text-xs text-slate-600">已选 {selectedRoles.length} 位</span>
          </div>
          {error && (
            <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              角色服务暂不可用，已切换为本地预设角色。
              <button
                type="button"
                onClick={() => fetchRoles()}
                className="ml-2 underline"
              >
                重试连接
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">加载角色中...</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {roles.map((role) => {
                const isSelected = selectedRoles.includes(role.id)
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleRoleSelection(role.id)}
                    className={`apple-role-card ${isSelected ? 'apple-role-card-selected' : ''}`}
                  >
                    <div className="apple-role-avatar" style={{ backgroundColor: ROLE_COLORS[role.name] || '#6b7280' }}>
                      {ROLE_TITLES[role.name] || role.name[0]}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="truncate text-sm font-semibold">{role.title}</div>
                      <div className="truncate text-xs text-slate-600">{role.stance}</div>
                    </div>
                  </button>
                )
              })}

              <button type="button" onClick={() => navigate('/roles')} className="apple-role-card border-dashed">
                <Plus className="h-4 w-4" />
                <span className="text-sm">自定义大臣</span>
              </button>
            </div>
          )}
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleStartMeeting}
            disabled={selectedRoles.length < 2 || !topic.trim()}
            className="apple-primary-btn"
          >
            开始议政
          </button>
        </div>
      </div>
    </AppShell>
  )
}
