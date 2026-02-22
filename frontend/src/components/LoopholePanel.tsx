import { Lock, Loader, Lightbulb } from 'lucide-react'
import { LoopholeReport } from '../types'

interface LoopholePanelProps {
  loopholes: LoopholeReport[]
  loading: boolean
}

export default function LoopholePanel({ loopholes, loading }: LoopholePanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader className="w-12 h-12 text-purple-500 animate-spin mb-4" />
        <p className="text-slate-400">Generating loopholes...</p>
      </div>
    )
  }

  if (loopholes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Lock className="w-12 h-12 text-slate-600 mb-4" />
        <p className="text-slate-400">No loopholes generated yet.</p>
        <p className="text-sm text-slate-500 mt-2">Upload a manuscript to discover creative exploits.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Loophole Generator</h3>
        <span className="text-sm text-slate-400">
          {loopholes.length} loophole{loopholes.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {loopholes.map((loophole, idx) => (
        <div
          key={idx}
          className="border border-purple-500/30 bg-purple-900/10 rounded-lg p-4"
        >
          <div className="flex items-start space-x-3">
            <Lightbulb className="w-5 h-5 text-purple-400 mt-1" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-lg">{loophole.title}</h4>
                <span className="text-xs text-slate-400">
                  Creativity: {(loophole.creativity_score * 100).toFixed(0)}%
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {loophole.systems_involved.map((system, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-slate-800 text-xs rounded-full"
                  >
                    {system}
                  </span>
                ))}
              </div>

              <p className="text-slate-300 mb-4">{loophole.description}</p>

              <div className="space-y-2">
                <p className="text-xs text-slate-400 font-medium">Exploitable Rules:</p>
                {loophole.exploitable_rules.map((rule, i) => (
                  <div key={i} className="bg-slate-800/50 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">{rule.system}</span>
                    </div>
                    <p className="text-sm">{rule.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
