interface ProgressBarProps {
  usage: number
  budget: number
  degradation?: 'none' | 'partial' | 'severe'
}

export default function ProgressBar({ usage, budget, degradation }: ProgressBarProps) {
  const percentage = Math.min((usage / budget) * 100, 100)
  const remaining = budget - usage

  const getColor = () => {
    if (percentage >= 100 || degradation === 'severe') return 'bg-red-500'
    if (percentage >= 90 || degradation === 'partial') return 'bg-yellow-500'
    return 'bg-cyan-500'
  }

  const getStatusMessage = () => {
    if (percentage >= 100 || degradation === 'severe') {
      return {
        text: '预算已用尽，进入严重降级模式',
        color: 'text-red-400',
      }
    }
    if (percentage >= 90 || degradation === 'partial') {
      return {
        text: '预算即将用尽，部分流程已简化',
        color: 'text-yellow-400',
      }
    }
    return {
      text: '预算充足',
      color: 'text-green-400',
    }
  }

  const status = getStatusMessage()

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">Token 使用</span>
        <div className="flex items-center space-x-4">
          <span className={status.color}>{status.text}</span>
          <span className="text-slate-400">
            {usage.toLocaleString()} / {budget.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-slate-700">
        <div
          className={`h-full transition-all duration-500 ${getColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-slate-500">
        <span>剩余: {remaining.toLocaleString()} tokens</span>
        <span>{percentage.toFixed(1)}%</span>
      </div>
    </div>
  )
}
