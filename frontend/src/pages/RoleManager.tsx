import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { useRolesStore } from '../stores/useRolesStore'
import type { Role } from '../types'

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
    <AppShell title="角色管理" backTo="/">
      <div className="space-y-4">
        {isLoading ? (
          <div className="apple-panel p-8 text-center text-sm text-slate-500">加载中...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((role) => (
              <div key={role.id} className="apple-panel p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-bold">{role.name}</h3>
                  <p className="text-xs text-slate-500">{role.title}</p>
                </div>

                <div className="space-y-1 text-xs text-slate-700">
                  <div>立场: {role.stance}</div>
                  <div>性格: {role.personality}</div>
                  <div>模型: {role.modelConfig.model}</div>
                  <div>版本: v{role.version}</div>
                </div>

                <div className="mt-3">
                  <button type="button" onClick={() => setEditingRole(role)} className="apple-primary-btn">
                    编辑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="apple-panel w-full max-w-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">编辑角色</h3>
              <button type="button" onClick={() => setEditingRole(null)} className="apple-back-btn">关闭</button>
            </div>

            <div className="grid gap-3">
              <input
                type="text"
                value={editingRole.stance}
                onChange={(e) => setEditingRole({ ...editingRole, stance: e.target.value })}
                className="apple-input"
                placeholder="立场"
              />
              <input
                type="text"
                value={editingRole.personality}
                onChange={(e) => setEditingRole({ ...editingRole, personality: e.target.value })}
                className="apple-input"
                placeholder="性格"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingRole(null)} className="apple-back-btn">取消</button>
              <button
                type="button"
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
                className="apple-primary-btn"
              >
                {isSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
