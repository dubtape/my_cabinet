import { useState, useEffect } from 'react'
import type { Memory } from '@/types'

export default function MemoryBrowser() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'decisions' | 'learnings' | 'patterns'>('sessions')
  const [searchQuery, setSearchQuery] = useState('')
  const [memories, setMemories] = useState<Memory[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Fetch memories when tab changes
  useEffect(() => {
    const fetchMemories = async () => {
      setIsLoading(true)
      try {
        const endpoint = `/api/memory/${activeTab}`
        const response = await fetch(endpoint)
        if (!response.ok) throw new Error('Failed to fetch memories')
        const data = await response.json()
        setMemories(data)
      } catch (error) {
        console.error('Failed to fetch memories:', error)
        setMemories([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchMemories()
  }, [activeTab])

  const filteredMemories = memories.filter((m) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()

    // Search in content
    if (m.content?.toLowerCase().includes(searchLower)) {
      return true
    }

    // Search in frontmatter (safely)
    if (m.frontmatter) {
      try {
        const frontmatterStr = JSON.stringify(m.frontmatter).toLowerCase()
        if (frontmatterStr.includes(searchLower)) {
          return true
        }
      } catch {
        // Ignore JSON stringify errors
      }
    }

    return false
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">记忆浏览</h2>
        <p className="mt-2 text-slate-400">搜索和查看内阁的历史记忆</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 rounded-lg border border-slate-700 bg-slate-800/50 p-1">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex-1 rounded-lg px-4 py-2 transition-colors ${
            activeTab === 'sessions'
              ? 'bg-cyan-500 text-white'
              : 'text-slate-400 hover:bg-slate-700'
          }`}
        >
          会话记录
        </button>
        <button
          onClick={() => setActiveTab('decisions')}
          className={`flex-1 rounded-lg px-4 py-2 transition-colors ${
            activeTab === 'decisions'
              ? 'bg-cyan-500 text-white'
              : 'text-slate-400 hover:bg-slate-700'
          }`}
        >
          决策记录
        </button>
        <button
          onClick={() => setActiveTab('learnings')}
          className={`flex-1 rounded-lg px-4 py-2 transition-colors ${
            activeTab === 'learnings'
              ? 'bg-cyan-500 text-white'
              : 'text-slate-400 hover:bg-slate-700'
          }`}
        >
          学习经验
        </button>
        <button
          onClick={() => setActiveTab('patterns')}
          className={`flex-1 rounded-lg px-4 py-2 transition-colors ${
            activeTab === 'patterns'
              ? 'bg-cyan-500 text-white'
              : 'text-slate-400 hover:bg-slate-700'
          }`}
        >
          模式识别
        </button>
      </div>

      {/* Search */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索记忆..."
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </div>

      {/* Results */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-12 text-center">
            <p className="text-slate-400">加载中...</p>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-12 text-center">
            <p className="text-slate-400">暂无记忆</p>
          </div>
        ) : (
          filteredMemories.map((memory: any) => {
            // Extract appropriate title based on memory type
            let title = `记忆 ${memory.frontmatter?.id || memory.id}`
            if (memory.frontmatter?.topic) {
              title = memory.frontmatter.topic
            } else if (memory.frontmatter?.pattern) {
              title = memory.frontmatter.pattern
            } else if (memory.content) {
              const firstLine = memory.content.split('\n')[0]
              if (firstLine.startsWith('# ')) {
                title = firstLine.replace('# ', '')
              } else if (firstLine.startsWith('**Decision:**')) {
                title = firstLine.replace('**Decision:**', '').trim()
              } else {
                title = firstLine.substring(0, 50) + (firstLine.length > 50 ? '...' : '')
              }
            }

            // Extract date
            const dateStr = memory.frontmatter?.createdAt || memory.frontmatter?.date || memory.createdAt
            const displayDate = dateStr ? new Date(dateStr).toLocaleDateString('zh-CN') : ''

            // Extract preview content
            let preview = memory.content || ''
            if (preview.length > 200) {
              preview = preview.substring(0, 200) + '...'
            }

            return (
              <div
                key={memory.frontmatter?.id || memory.id}
                className="rounded-lg border border-slate-700 bg-slate-800/50 p-6 hover:border-cyan-500 transition-colors cursor-pointer"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                  {displayDate && (
                    <span className="text-xs text-slate-500">{displayDate}</span>
                  )}
                </div>
                <p className="text-slate-400 line-clamp-2">{preview}</p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
