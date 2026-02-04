import { useEffect, useState } from 'react'
import { useRolesStore } from '@/stores/rolesStore'
import type { Role } from '@/types'

export default function RoleManager() {
  const { roles, setRoles, updateRole } = useRolesStore()
  const [isLoading, setIsLoading] = useState(true)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch('/api/roles')
        if (!response.ok) throw new Error('Failed to fetch roles')
        const data = await response.json()
        setRoles(data)
      } catch (error) {
        console.error('Failed to fetch roles:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRoles()
  }, [setRoles])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">角色管理</h2>
        <p className="mt-2 text-slate-400">配置和管理内阁角色人设</p>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-12 text-center">
          <p className="text-slate-400">加载中...</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
          <div
            key={role.id}
            className="rounded-lg border border-slate-700 bg-slate-800/50 p-6 hover:border-cyan-500 transition-colors"
          >
            <div className="mb-4">
              <h3 className="text-xl font-bold text-cyan-400">{role.name}</h3>
              <p className="text-sm text-slate-400">{role.title}</p>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="text-slate-400">立场：</span>
                <span className="text-slate-200">{role.stance}</span>
              </div>
              <div>
                <span className="text-slate-400">性格：</span>
                <span className="text-slate-200">{role.personality}</span>
              </div>
              <div>
                <span className="text-slate-400">模型：</span>
                <span className="text-slate-200">{role.modelConfig.model}</span>
              </div>
              <div>
                <span className="text-slate-400">版本：</span>
                <span className="text-slate-200">v{role.version}</span>
              </div>
            </div>

            <div className="mt-4 flex space-x-2">
              <button
                onClick={() => setEditingRole(role)}
                className="flex-1 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-cyan-500 hover:bg-slate-700 transition-colors"
              >
                编辑
              </button>
              <button className="flex-1 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-cyan-500 hover:bg-slate-700 transition-colors">
                演化
              </button>
            </div>
          </div>
        ))}
        </div>
      )}

      <button className="rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/30 px-6 py-4 text-slate-400 hover:border-cyan-500 hover:text-cyan-400 transition-colors">
        + 创建自定义角色
      </button>

      {editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">编辑角色</h3>
              <button
                onClick={() => setEditingRole(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-400">立场</label>
                <input
                  type="text"
                  value={editingRole.stance}
                  onChange={(e) => setEditingRole({ ...editingRole, stance: e.target.value })}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-400">性格</label>
                <input
                  type="text"
                  value={editingRole.personality}
                  onChange={(e) => setEditingRole({ ...editingRole, personality: e.target.value })}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-400">专业领域（逗号分隔）</label>
                <input
                  type="text"
                  value={editingRole.expertise.join(', ')}
                  onChange={(e) =>
                    setEditingRole({
                      ...editingRole,
                      expertise: e.target.value
                        .split(',')
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-400">模型提供方</label>
                  <select
                    value={editingRole.modelConfig.provider}
                    onChange={(e) =>
                      setEditingRole({
                        ...editingRole,
                        modelConfig: { ...editingRole.modelConfig, provider: e.target.value as Role['modelConfig']['provider'] },
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200"
                  >
                    <option value="openai">openai</option>
                    <option value="anthropic">anthropic</option>
                    <option value="ollama">ollama</option>
                    <option value="glm">glm</option>
                    <option value="deepseek">deepseek</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">模型名称</label>
                  <input
                    type="text"
                    value={editingRole.modelConfig.model}
                    onChange={(e) =>
                      setEditingRole({
                        ...editingRole,
                        modelConfig: { ...editingRole.modelConfig, model: e.target.value },
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-400">温度</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={editingRole.modelConfig.temperature}
                    onChange={(e) =>
                      setEditingRole({
                        ...editingRole,
                        modelConfig: { ...editingRole.modelConfig, temperature: Number(e.target.value) },
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">最大 Tokens</label>
                  <input
                    type="number"
                    min="1"
                    value={editingRole.modelConfig.maxTokens}
                    onChange={(e) =>
                      setEditingRole({
                        ...editingRole,
                        modelConfig: { ...editingRole.modelConfig, maxTokens: Number(e.target.value) },
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setEditingRole(null)}
                className="rounded border border-slate-600 px-4 py-2 text-slate-300 hover:border-slate-500"
              >
                取消
              </button>
              <button
                disabled={isSaving}
                onClick={async () => {
                  if (!editingRole) return
                  setIsSaving(true)
                  try {
                    const response = await fetch(`/api/roles/${editingRole.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        stance: editingRole.stance,
                        personality: editingRole.personality,
                        expertise: editingRole.expertise,
                        modelConfig: editingRole.modelConfig,
                      }),
                    })
                    if (!response.ok) throw new Error('Failed to update role')
                    const updated = await response.json()
                    updateRole(editingRole.id, updated)
                    setEditingRole(null)
                  } catch (error) {
                    console.error('Failed to update role:', error)
                    alert('保存失败，请稍后重试')
                  } finally {
                    setIsSaving(false)
                  }
                }}
                className="rounded bg-cyan-500 px-4 py-2 text-white hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
