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
        <Loader style={{ color: 'var(--color-forest)' }} className="w-12 h-12 animate-spin mb-4" />
        <p style={{ color: 'var(--color-ink-light)' }}>loading characters...</p>
      </div>
    )
  }

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Users style={{ color: 'var(--color-ink-light)' }} className="w-12 h-12 mb-4" />
        <p style={{ color: 'var(--color-ink-light)' }}>no characters tracked yet.</p>
        <p style={{ 
          fontSize: '0.875rem',
          color: 'var(--color-ink-light)',
          marginTop: '0.5rem'
        }}>upload a manuscript to start tracking characters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          color: 'var(--color-ink)'
        }}>character profiles</h3>
        <span style={{
          fontSize: '0.875rem',
          color: 'var(--color-ink-light)'
        }}>
          {characters.length} character{characters.length !== 1 ? 's' : ''} tracked
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {characters.map((char, idx) => (
          <div
            key={idx}
            className="paper-card"
            style={{
              borderRadius: '2px',
              padding: '1rem'
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <h4 style={{
                fontWeight: 600,
                fontSize: '1.15rem',
                color: 'var(--color-forest)'
              }}>{char.character_name}</h4>
              <div className="text-right">
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-ink-light)',
                  marginBottom: '0.125rem'
                }}>consistency</div>
                <div style={{
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: char.consistency_score > 0.8 ? 'var(--color-forest)' :
                         char.consistency_score > 0.6 ? 'var(--color-gold)' :
                         '#c45a5a'
                }}>
                  {(char.consistency_score * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {char.warning && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.75rem',
                background: 'rgba(212, 175, 55, 0.1)',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                borderRadius: '2px',
                padding: '0.5rem'
              }}>
                <AlertTriangle style={{ color: 'var(--color-gold)' }} className="w-4 h-4" />
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-gold)'
                }}>{char.warning}</p>
              </div>
            )}

            <div className="space-y-2">
              {char.moral_alignment && (
                <div>
                  <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-ink-light)'
                  }}>moral alignment:</span>
                  <span style={{
                    marginLeft: '0.5rem',
                    fontSize: '0.9rem',
                    color: 'var(--color-ink)'
                  }}>{char.moral_alignment}</span>
                </div>
              )}

              {char.primary_ability && (
                <div>
                  <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-ink-light)'
                  }}>primary ability:</span>
                  <span style={{
                    marginLeft: '0.5rem',
                    fontSize: '0.9rem',
                    color: 'var(--color-ink)'
                  }}>{char.primary_ability}</span>
                </div>
              )}

              {char.motivation && (
                <div>
                  <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-ink-light)'
                  }}>motivation:</span>
                  <span style={{
                    marginLeft: '0.5rem',
                    fontSize: '0.9rem',
                    color: 'var(--color-ink)'
                  }}>{char.motivation}</span>
                </div>
              )}

              {char.traits.length > 0 && (
                <div style={{
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--color-border)'
                }}>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-ink-light)',
                    marginBottom: '0.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>tracked traits:</div>
                  <div className="flex flex-wrap gap-1">
                    {char.traits.slice(0, 5).map((trait, i) => (
                      <span
                        key={i}
                        style={{
                          padding: '0.25rem 0.5rem',
                          background: 'var(--color-parchment)',
                          border: '1px solid var(--color-border)',
                          fontSize: '0.7rem',
                          borderRadius: '1rem',
                          color: 'var(--color-ink-light)'
                        }}
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
