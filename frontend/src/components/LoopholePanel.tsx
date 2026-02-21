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
        <Loader style={{ color: 'var(--color-forest)' }} className="w-12 h-12 animate-spin mb-4" />
        <p style={{ color: 'var(--color-ink-light)' }}>generating loopholes...</p>
      </div>
    )
  }

  if (loopholes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Lock style={{ color: 'var(--color-ink-light)' }} className="w-12 h-12 mb-4" />
        <p style={{ color: 'var(--color-ink-light)' }}>no loopholes generated yet.</p>
        <p style={{ 
          fontSize: '0.875rem',
          color: 'var(--color-ink-light)',
          marginTop: '0.5rem'
        }}>upload a manuscript to discover creative exploits.</p>
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
        }}>loophole generator</h3>
        <span style={{
          fontSize: '0.875rem',
          color: 'var(--color-ink-light)'
        }}>
          {loopholes.length} loophole{loopholes.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {loopholes.map((loophole, idx) => (
        <div
          key={idx}
          style={{
            border: '1px solid rgba(212, 175, 55, 0.3)',
            background: 'rgba(212, 175, 55, 0.05)',
            borderRadius: '2px',
            padding: '1rem'
          }}
        >
          <div className="flex items-start space-x-3">
            <Lightbulb style={{ color: 'var(--color-gold)' }} className="w-5 h-5 mt-1" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h4 style={{
                  fontWeight: 600,
                  fontSize: '1.1rem',
                  color: 'var(--color-ink)'
                }}>{loophole.title}</h4>
                <span style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-ink-light)'
                }}>
                  creativity: {(loophole.creativity_score * 100).toFixed(0)}%
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {loophole.systems_involved.map((system, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '0.25rem 0.75rem',
                      background: 'var(--color-parchment)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.75rem',
                      borderRadius: '1rem',
                      color: 'var(--color-ink)'
                    }}
                  >
                    {system}
                  </span>
                ))}
              </div>

              <p style={{ 
                color: 'var(--color-ink)',
                marginBottom: '1rem',
                fontSize: '0.95rem',
                lineHeight: '1.5'
              }}>{loophole.description}</p>

              <div className="space-y-2">
                <p style={{
                  fontSize: '0.8rem',
                  color: 'var(--color-ink-light)',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>exploitable rules:</p>
                {loophole.exploitable_rules.map((rule, i) => (
                  <div key={i} style={{
                    background: 'var(--color-parchment)',
                    borderRadius: '2px',
                    padding: '0.5rem',
                    border: '1px solid var(--color-border)'
                  }}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-ink-light)'
                      }}>{rule.system}</span>
                    </div>
                    <p style={{ 
                      fontSize: '0.9rem',
                      color: 'var(--color-ink)'
                    }}>{rule.text}</p>
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
