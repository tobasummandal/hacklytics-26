import { Users, Loader, AlertTriangle } from 'lucide-react'
import { CharacterProfile } from '../types'

interface CharacterPanelProps {
  characters: CharacterProfile[]
  loading: boolean
}

export default function CharacterPanel({ characters, loading }: CharacterPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader className="w-12 h-12 text-purple-500 animate-spin mb-4" />
        <p className="text-slate-400">Loading characters...</p>
      </div>
    )
  }

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Users className="w-12 h-12 text-slate-600 mb-4" />
        <p className="text-slate-400">No characters tracked yet.</p>
        <p className="text-sm text-slate-500 mt-2">Upload a manuscript to start tracking characters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Character Profiles</h3>
        <span className="text-sm text-slate-400">
          {characters.length} character{characters.length !== 1 ? 's' : ''} tracked
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {characters.map((char, idx) => (
          <div
            key={idx}
            className="border border-slate-700 bg-slate-800/30 rounded-lg p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <h4 className="font-bold text-lg text-pink-400">{char.character_name}</h4>
              <div className="text-right">
                <div className="text-xs text-slate-400">Consistency</div>
                <div className={`text-lg font-semibold ${
                  char.consistency_score > 0.8 ? 'text-green-400' :
                  char.consistency_score > 0.6 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {(char.consistency_score * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {char.warning && (
              <div className="flex items-center space-x-2 mb-3 bg-yellow-900/20 border border-yellow-700/30 rounded p-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <p className="text-xs text-yellow-300">{char.warning}</p>
              </div>
            )}

            <div className="space-y-2">
              {char.moral_alignment && (
                <div>
                  <span className="text-xs text-slate-400">Moral Alignment:</span>
                  <span className="ml-2 text-sm">{char.moral_alignment}</span>
                </div>
              )}

              {char.primary_ability && (
                <div>
                  <span className="text-xs text-slate-400">Primary Ability:</span>
                  <span className="ml-2 text-sm">{char.primary_ability}</span>
                </div>
              )}

              {char.motivation && (
                <div>
                  <span className="text-xs text-slate-400">Motivation:</span>
                  <span className="ml-2 text-sm">{char.motivation}</span>
                </div>
              )}

              {char.traits.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <div className="text-xs text-slate-400 mb-2">Tracked Traits:</div>
                  <div className="flex flex-wrap gap-1">
                    {char.traits.slice(0, 5).map((trait, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-slate-700 text-xs rounded-full"
                      >
                        {trait.trait_type}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
