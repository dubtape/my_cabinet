import { BrainIntervention } from '@/types'

interface BrainInterventionProps {
  intervention: BrainIntervention
}

export default function BrainInterventionCard({ intervention }: BrainInterventionProps) {
  const getInterventionStyle = () => {
    switch (intervention.type) {
      case 'question':
        return 'border-yellow-700 bg-yellow-900/20'
      case 'perspective':
        return 'border-blue-700 bg-blue-900/20'
      case 'elaboration_request':
        return 'border-purple-700 bg-purple-900/20'
      default:
        return 'border-slate-700 bg-slate-900/20'
    }
  }

  const getInterventionIcon = () => {
    switch (intervention.type) {
      case 'question':
        return '❓'
      case 'perspective':
        return '💡'
      case 'elaboration_request':
        return '🔍'
      default:
        return '🧠'
    }
  }

  const getInterventionTitle = () => {
    switch (intervention.type) {
      case 'question':
        return '主脑提问'
      case 'perspective':
        return '新视角'
      case 'elaboration_request':
        return '详细阐述请求'
      default:
        return '主脑介入'
    }
  }

  return (
    <div className={`rounded-lg border p-4 ${getInterventionStyle()}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xl">{getInterventionIcon()}</span>
          <span className="font-semibold text-yellow-400">BRAIN</span>
          <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
            {getInterventionTitle()}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {new Date(intervention.timestamp).toLocaleTimeString('zh-CN')}
        </span>
      </div>

      {intervention.targetRole && (
        <p className="mb-2 text-sm text-slate-400">
          → @{intervention.targetRole}
        </p>
      )}

      <p className="text-slate-200">{intervention.content}</p>

      {intervention.resolved && (
        <div className="mt-2 flex items-center text-sm text-green-400">
          <span>✓ 已解决</span>
        </div>
      )}
    </div>
  )
}
