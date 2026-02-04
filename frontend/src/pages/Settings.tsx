import { useEffect, useState } from 'react'

type KeyStatus = {
  configured: boolean
  masked?: string
  value?: string
}

type KeyStatusResponse = {
  openai: KeyStatus
  anthropic: KeyStatus
  deepseek: KeyStatus
  glm: KeyStatus
  ollama: KeyStatus
}

export default function Settings() {
  const [status, setStatus] = useState<KeyStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    openaiApiKey: '',
    anthropicApiKey: '',
    deepseekApiKey: '',
    glmApiKey: '',
    ollamaBaseUrl: '',
    glmBaseUrl: '',
    deepseekBaseUrl: '',
  })

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/settings')
        if (!response.ok) throw new Error('Failed to fetch settings')
        const data = await response.json()
        setStatus(data)
      } catch (error) {
        console.error('Failed to fetch settings:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStatus()
  }, [])

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, value]) => value.trim().length > 0)
      )
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('Failed to save settings')
      const data = await response.json()
      setStatus(data.keys)
      setForm({
        openaiApiKey: '',
        anthropicApiKey: '',
        deepseekApiKey: '',
        glmApiKey: '',
        ollamaBaseUrl: '',
        glmBaseUrl: '',
        deepseekBaseUrl: '',
      })
      alert('保存成功')
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('保存失败，请稍后重试')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">系统设置</h2>
        <p className="mt-2 text-slate-400">配置模型 API Key（仅后端保存，不会在前端显示）</p>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-12 text-center">
          <p className="text-slate-400">加载中...</p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            {status && (
              <>
                <div className="text-sm text-slate-400">
                  OpenAI: {status.openai.configured ? `已配置 (${status.openai.masked})` : '未配置'}
                </div>
                <div className="text-sm text-slate-400">
                  Anthropic: {status.anthropic.configured ? `已配置 (${status.anthropic.masked})` : '未配置'}
                </div>
                <div className="text-sm text-slate-400">
                  DeepSeek: {status.deepseek.configured ? `已配置 (${status.deepseek.masked})` : '未配置'}
                </div>
                <div className="text-sm text-slate-400">
                  GLM: {status.glm.configured ? `已配置 (${status.glm.masked})` : '未配置'}
                </div>
                <div className="text-sm text-slate-400">
                  Ollama: {status.ollama.configured ? `已配置 (${status.ollama.value || 'default'})` : '未配置'}
                </div>
              </>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-400">OpenAI API Key</label>
              <input
                type="password"
                value={form.openaiApiKey}
                onChange={(e) => handleChange('openaiApiKey', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200"
                placeholder="sk-..."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Anthropic API Key</label>
              <input
                type="password"
                value={form.anthropicApiKey}
                onChange={(e) => handleChange('anthropicApiKey', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200"
                placeholder="sk-ant-..."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">DeepSeek API Key</label>
              <input
                type="password"
                value={form.deepseekApiKey}
                onChange={(e) => handleChange('deepseekApiKey', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200"
                placeholder="sk-..."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">GLM API Key</label>
              <input
                type="password"
                value={form.glmApiKey}
                onChange={(e) => handleChange('glmApiKey', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200"
                placeholder="..."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Ollama Base URL</label>
              <input
                type="text"
                value={form.ollamaBaseUrl}
                onChange={(e) => handleChange('ollamaBaseUrl', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200"
                placeholder="http://localhost:11434"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">GLM Base URL</label>
              <input
                type="text"
                value={form.glmBaseUrl}
                onChange={(e) => handleChange('glmBaseUrl', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">DeepSeek Base URL</label>
              <input
                type="text"
                value={form.deepseekBaseUrl}
                onChange={(e) => handleChange('deepseekBaseUrl', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200"
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded bg-cyan-500 px-4 py-2 text-white hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isSaving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
