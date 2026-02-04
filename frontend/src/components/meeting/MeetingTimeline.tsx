import { Message } from '@/types'

interface MeetingTimelineProps {
  messages: Message[]
}

export default function MeetingTimeline({ messages }: MeetingTimelineProps) {
  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      PRIME: 'text-purple-400 border-purple-700 bg-purple-900/20',
      BRAIN: 'text-yellow-400 border-yellow-700 bg-yellow-900/20',
      CRITIC: 'text-red-400 border-red-700 bg-red-900/20',
      FINANCE: 'text-green-400 border-green-700 bg-green-900/20',
      WORKS: 'text-blue-400 border-blue-700 bg-blue-900/20',
      CLERK: 'text-slate-400 border-slate-700 bg-slate-900/20',
      SYSTEM: 'text-gray-400 border-gray-700 bg-gray-900/20',
    }
    return colors[role] || 'text-cyan-400 border-cyan-700 bg-cyan-900/20'
  }

  const getMessageIcon = (type: Message['type']) => {
    switch (type) {
      case 'question':
        return '❓'
      case 'perspective':
        return '💡'
      case 'elaboration_request':
        return '🔍'
      case 'system':
        return '⚙️'
      default:
        return '💬'
    }
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-slate-400">暂无消息</p>
          <p className="mt-2 text-sm text-slate-500">会议开始后，讨论内容将显示在这里</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <div
          key={message.id}
          className={`rounded-lg border p-4 transition-all hover:shadow-lg ${getRoleColor(message.role)} ${
            index === messages.length - 1 ? 'ring-2 ring-cyan-500' : ''
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">{getMessageIcon(message.type)}</span>
              <span className="font-semibold">{message.role}</span>
              {message.type !== 'statement' && (
                <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs">
                  {message.type}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500">
              {new Date(message.timestamp).toLocaleTimeString('zh-CN')}
            </span>
          </div>

          {message.metadata?.targetRole && (
            <p className="mb-2 text-sm text-slate-400">
              → @{message.metadata.targetRole as string}
            </p>
          )}

          <div className="prose prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-slate-200">{message.content}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
