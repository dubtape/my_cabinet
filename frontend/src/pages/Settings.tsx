import { useEffect, useMemo, useState } from 'react'

type KeyStatus = {
  configured: boolean
  masked?: string
  value?: string
}

type ModelInfo = {
  id: string
  name: string
  provider: string
  contextLength: number
}

type SettingsStatusResponse = {
  keys: {
    openai: KeyStatus
    anthropic: KeyStatus
    deepseek: KeyStatus
    glm: KeyStatus
    ollama: KeyStatus
  }
  models: ModelInfo[]
  defaultProvider: string
  defaultModel: string
}

export default function Settings() {
  const [status, setStatus] = useState<SettingsStatusResponse | null>(null)
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

  const groupedModels = useMemo(() => {
    const groups: Record<string, ModelInfo[]> = {}
    for (const model of status?.models || []) {
      groups[model.provider] = groups[model.provider] || []
      groups[model.provider].push(model)
    }
    return groups
  }, [status?.models])

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/settings/status')
      if (!response.ok) throw new Error('Failed to fetch settings status')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
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
      setForm({
        openaiApiKey: '',
        anthropicApiKey: '',
        deepseekApiKey: '',
        glmApiKey: '',
        ollamaBaseUrl: '',
        glmBaseUrl: '',
        deepseekBaseUrl: '',
      })
      await fetchStatus()
      alert('保存成功')
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('保存失败，请稍后重试')
    } finally {
      setIsSaving(false)
    }
  }

  const renderStatus = (name: string, item?: KeyStatus) => (
    <div className="mac-panel p-3 text-sm" key={name}>
      <div className="font-semibold">{name}</div>
      <div className="text-xs text-slate-600">
        {item?.configured ? `已配置 ${item.masked || item.value || ''}` : '未配置'}
      </div>
    </div>
  )

  return (
    <div className="mac-desktop min-h-screen p-4 md:p-6">
      <div className="mac-window mx-auto max-w-5xl overflow-hidden">
        <div className="mac-titlebar">
          <div className="mac-titlebar-lights">
            <span className="mac-light mac-light-red" />
            <span className="mac-light mac-light-yellow" />
            <span className="mac-light mac-light-green" />
          </div>
          <h1 className="mac-title text-base">模型与密钥设置</h1>
          <div className="text-xs text-slate-600">
            默认: {status?.defaultProvider || '-'} / {status?.defaultModel || '-'}
          </div>
        </div>

        <div className="mac-window-body space-y-4">
          {isLoading ? (
            <div className="mac-panel p-8 text-center text-sm text-slate-500">加载中...</div>
          ) : (
            <>
              <section className="grid gap-3 md:grid-cols-3">
                {renderStatus('OpenAI', status?.keys.openai)}
                {renderStatus('Anthropic', status?.keys.anthropic)}
                {renderStatus('DeepSeek', status?.keys.deepseek)}
                {renderStatus('GLM', status?.keys.glm)}
                {renderStatus('Ollama', status?.keys.ollama)}
              </section>

              <section className="mac-panel p-4">
                <h2 className="mb-3 text-sm font-semibold">更新配置</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  <input type="password" value={form.openaiApiKey} onChange={(e) => handleChange('openaiApiKey', e.target.value)} className="mac-input" placeholder="OpenAI API Key" />
                  <input type="password" value={form.anthropicApiKey} onChange={(e) => handleChange('anthropicApiKey', e.target.value)} className="mac-input" placeholder="Anthropic API Key" />
                  <input type="password" value={form.deepseekApiKey} onChange={(e) => handleChange('deepseekApiKey', e.target.value)} className="mac-input" placeholder="DeepSeek API Key" />
                  <input type="password" value={form.glmApiKey} onChange={(e) => handleChange('glmApiKey', e.target.value)} className="mac-input" placeholder="GLM API Key" />
                  <input type="text" value={form.ollamaBaseUrl} onChange={(e) => handleChange('ollamaBaseUrl', e.target.value)} className="mac-input" placeholder="Ollama Base URL" />
                  <input type="text" value={form.glmBaseUrl} onChange={(e) => handleChange('glmBaseUrl', e.target.value)} className="mac-input" placeholder="GLM Base URL" />
                  <input type="text" value={form.deepseekBaseUrl} onChange={(e) => handleChange('deepseekBaseUrl', e.target.value)} className="mac-input md:col-span-2" placeholder="DeepSeek Base URL" />
                </div>
                <div className="mt-3 flex justify-end">
                  <button onClick={handleSave} disabled={isSaving} className="mac-primary-btn">
                    {isSaving ? '保存中...' : '保存设置'}
                  </button>
                </div>
              </section>

              <section className="mac-panel p-4">
                <h2 className="mb-3 text-sm font-semibold">可用模型</h2>
                {Object.keys(groupedModels).length === 0 ? (
                  <div className="text-sm text-slate-500">暂无可用模型，请先配置对应 provider 的密钥。</div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(groupedModels).map(([provider, models]) => (
                      <div key={provider}>
                        <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{provider}</div>
                        <div className="flex flex-wrap gap-2">
                          {models.map((model) => (
                            <span key={model.id} className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs">
                              {model.id}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
