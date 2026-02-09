import { IssueBrief, SpeakPlan, Summary, FinalDecision } from '@/types'

interface ArtifactCardProps {
  type: 'issueBrief' | 'speakPlan' | 'summary' | 'finalDecision'
  artifact: IssueBrief | SpeakPlan | Summary | FinalDecision
}

export default function ArtifactCard({ type, artifact }: ArtifactCardProps) {
  const getArtifactStyle = () => {
    switch (type) {
      case 'issueBrief':
        return 'border-blue-700 bg-blue-900/20'
      case 'speakPlan':
        return 'border-purple-700 bg-purple-900/20'
      case 'summary':
        return 'border-slate-700 bg-slate-900/20'
      case 'finalDecision':
        return 'border-green-700 bg-green-900/20'
      default:
        return 'border-slate-700 bg-slate-900/20'
    }
  }

  const getArtifactTitle = () => {
    switch (type) {
      case 'issueBrief':
        return '议题简报'
      case 'speakPlan':
        return '发言计划'
      case 'summary':
        return '会议总结'
      case 'finalDecision':
        return '最终决策'
      default:
        return '产出'
    }
  }

  const renderArtifact = () => {
    switch (type) {
      case 'issueBrief':
        const brief = artifact as IssueBrief
        return (
          <>
            <h4 className="mb-3 text-xl font-bold text-blue-400">{brief.topic}</h4>
            <p className="mb-4 text-slate-300">{brief.background}</p>
            {brief.keyConsiderations.length > 0 && (
              <div>
                <h5 className="mb-2 font-semibold text-slate-400">关键要点</h5>
                <ul className="list-inside list-disc space-y-1 text-slate-300">
                  {brief.keyConsiderations.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )

      case 'speakPlan':
        const plan = artifact as SpeakPlan
        return (
          <>
            <h4 className="mb-3 text-xl font-bold text-purple-400">发言顺序</h4>
            <div className="mb-4 flex flex-wrap gap-2">
              {plan.speakingOrder.map((role, i) => (
                <span
                  key={i}
                  className="rounded-full bg-purple-700 px-3 py-1 text-sm font-semibold text-white"
                >
                  {i + 1}. {role}
                </span>
              ))}
            </div>
            <div>
              <h5 className="mb-2 font-semibold text-slate-400">安排理由</h5>
              <p className="text-slate-300">{plan.rationale}</p>
            </div>
          </>
        )

      case 'summary':
        const summary = artifact as Summary
        const keyPoints = summary.keyPoints ?? []
        const disagreements = summary.disagreements ?? []
        return (
          <>
            <h4 className="mb-3 text-xl font-bold text-slate-400">会议总结</h4>
            <p className="mb-4 text-slate-300">{summary.discussion || summary.summary}</p>

            {keyPoints.length > 0 && (
              <div className="mb-4">
                <h5 className="mb-2 font-semibold text-slate-400">关键要点</h5>
                <ul className="list-inside list-disc space-y-1 text-slate-300">
                  {keyPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {summary.consensus && (
              <div className="mb-4">
                <h5 className="mb-2 font-semibold text-green-400">共识</h5>
                <p className="text-slate-300">{summary.consensus}</p>
              </div>
            )}

            {disagreements.length > 0 && (
              <div>
                <h5 className="mb-2 font-semibold text-red-400">分歧</h5>
                <ul className="list-inside list-disc space-y-1 text-slate-300">
                  {disagreements.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )

      case 'finalDecision':
        const decision = artifact as FinalDecision
        return (
          <>
            <h4 className="mb-3 text-xl font-bold text-green-400">决策</h4>
            <p className="mb-4 text-lg font-semibold text-white">{decision.decision}</p>

            <div className="mb-4">
              <h5 className="mb-2 font-semibold text-slate-400">决策理由</h5>
              <p className="text-slate-300">{decision.reasoning}</p>
            </div>

            {decision.nextSteps.length > 0 && (
              <div>
                <h5 className="mb-2 font-semibold text-slate-400">后续步骤</h5>
                <ol className="list-inside list-decimal space-y-2 text-slate-300">
                  {decision.nextSteps.map((step, i) => (
                    <li key={i} className="pl-2">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )

      default:
        return null
    }
  }

  return (
    <div className={`rounded-lg border p-6 ${getArtifactStyle()}`}>
      <div className="mb-4 flex items-center">
        <span className="mr-2 text-2xl">📄</span>
        <h3 className="text-xl font-bold">{getArtifactTitle()}</h3>
      </div>
      {renderArtifact()}
    </div>
  )
}
