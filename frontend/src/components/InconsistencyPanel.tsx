import { AlertTriangle, AlertCircle, Info, Loader } from 'lucide-react'
import { InconsistencyReport, SeverityLevel } from '../types'

interface InconsistencyPanelProps {
  inconsistencies: InconsistencyReport[]
  loading: boolean
}

export default function InconsistencyPanel({ inconsistencies, loading }: InconsistencyPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader className="w-12 h-12 text-purple-500 animate-spin mb-4" />
        <p className="text-slate-400">Analyzing inconsistencies...</p>
      </div>
    )
  }

  if (inconsistencies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-slate-600 mb-4" />
        <p className="text-slate-400">No inconsistencies detected yet.</p>
        <p className="text-sm text-slate-500 mt-2">Upload a manuscript to start analysis.</p>
      </div>
    )
  }

  const getSeverityIcon = (severity: SeverityLevel) => {
    switch (severity) {
      case SeverityLevel.HIGH:
        return <AlertTriangle className="w-5 h-5 text-red-500" />
      case SeverityLevel.MEDIUM:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case SeverityLevel.LOW:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getSeverityColor = (severity: SeverityLevel) => {
    switch (severity) {
      case SeverityLevel.HIGH:
        return 'border-red-500/30 bg-red-900/10'
      case SeverityLevel.MEDIUM:
        return 'border-yellow-500/30 bg-yellow-900/10'
      case SeverityLevel.LOW:
        return 'border-blue-500/30 bg-blue-900/10'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Inconsistency Report</h3>
        <span className="text-sm text-slate-400">
          {inconsistencies.length} issue{inconsistencies.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {inconsistencies.map((inc, idx) => (
        <div
          key={idx}
          className={`border rounded-lg p-4 ${getSeverityColor(inc.severity)}`}
        >
          <div className="flex items-start space-x-3">
            {getSeverityIcon(inc.severity)}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm uppercase tracking-wider">
                  {inc.severity} Severity
                </span>
                <span className="text-xs text-slate-400">
                  Similarity: {(inc.similarity * 100).toFixed(1)}%
                </span>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-800/50 rounded p-3">
                  <div className="text-xs text-slate-400 mb-1">
                    Rule A · {inc.rule_a.system}
                    {inc.rule_a.chapter && ` · Ch. ${inc.rule_a.chapter}`}
                    {inc.rule_a.page && ` · p. ${inc.rule_a.page}`}
                  </div>
                  <p className="text-sm">{inc.rule_a.text}</p>
                </div>

                <div className="bg-slate-800/50 rounded p-3">
                  <div className="text-xs text-slate-400 mb-1">
                    Rule B · {inc.rule_b.system}
                    {inc.rule_b.chapter && ` · Ch. ${inc.rule_b.chapter}`}
                    {inc.rule_b.page && ` · p. ${inc.rule_b.page}`}
                  </div>
                  <p className="text-sm">{inc.rule_b.text}</p>
                </div>

                <div className="bg-purple-900/20 border border-purple-700/30 rounded p-3">
                  <p className="text-sm text-purple-200">{inc.explanation}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
