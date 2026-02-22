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
        <Loader style={{ color: 'var(--color-forest)' }} className="w-12 h-12 animate-spin mb-4" />
        <p style={{ color: 'var(--color-ink-light)' }}>analyzing inconsistencies...</p>
      </div>
    )
  }

  if (inconsistencies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle style={{ color: 'var(--color-ink-light)' }} className="w-12 h-12 mb-4" />
        <p style={{ color: 'var(--color-ink-light)' }}>no inconsistencies detected yet.</p>
        <p style={{ 
          fontSize: '0.875rem',
          color: 'var(--color-ink-light)',
          marginTop: '0.5rem'
        }}>upload a manuscript to start analysis.</p>
      </div>
    )
  }

  const getSeverityIcon = (severity: SeverityLevel) => {
    switch (severity) {
      case SeverityLevel.HIGH:
        return <AlertTriangle className="w-5 h-5" style={{ color: '#c45a5a' }} />
      case SeverityLevel.MEDIUM:
        return <AlertCircle className="w-5 h-5" style={{ color: '#d4af37' }} />
      case SeverityLevel.LOW:
        return <Info className="w-5 h-5" style={{ color: '#4a7c2a' }} />
    }
  }

  const getSeverityColor = (severity: SeverityLevel) => {
    switch (severity) {
      case SeverityLevel.HIGH:
        return { border: '1px solid rgba(196, 90, 90, 0.3)', background: 'rgba(196, 90, 90, 0.05)' }
      case SeverityLevel.MEDIUM:
        return { border: '1px solid rgba(212, 175, 55, 0.3)', background: 'rgba(212, 175, 55, 0.05)' }
      case SeverityLevel.LOW:
        return { border: '1px solid rgba(74, 124, 42, 0.3)', background: 'rgba(74, 124, 42, 0.05)' }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          color: 'var(--color-ink)'
        }}>inconsistency report</h3>
        <span style={{
          fontSize: '0.875rem',
          color: 'var(--color-ink-light)'
        }}>
          {inconsistencies.length} issue{inconsistencies.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {inconsistencies.map((inc, idx) => (
        <div
          key={idx}
          style={{
            ...getSeverityColor(inc.severity),
            borderRadius: '2px',
            padding: '1rem'
          }}
        >
          <div className="flex items-start space-x-3">
            {getSeverityIcon(inc.severity)}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span style={{
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--color-ink)'
                }}>
                  {inc.severity} severity
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-ink-light)'
                }}>
                  similarity: {(inc.similarity * 100).toFixed(1)}%
                </span>
              </div>

              <div className="space-y-3">
                <div style={{
                  background: 'var(--color-parchment)',
                  borderRadius: '2px',
                  padding: '0.75rem',
                  border: '1px solid var(--color-border)'
                }}>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-ink-light)',
                    marginBottom: '0.25rem'
                  }}>
                    rule a · {inc.rule_a.system}
                    {inc.rule_a.chapter && ` · ch. ${inc.rule_a.chapter}`}
                    {inc.rule_a.page && ` · p. ${inc.rule_a.page}`}
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-ink)' }}>{inc.rule_a.text}</p>
                </div>

                <div style={{
                  background: 'var(--color-parchment)',
                  borderRadius: '2px',
                  padding: '0.75rem',
                  border: '1px solid var(--color-border)'
                }}>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-ink-light)',
                    marginBottom: '0.25rem'
                  }}>
                    rule b · {inc.rule_b.system}
                    {inc.rule_b.chapter && ` · ch. ${inc.rule_b.chapter}`}
                    {inc.rule_b.page && ` · p. ${inc.rule_b.page}`}
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-ink)' }}>{inc.rule_b.text}</p>
                </div>

                <div style={{
                  background: 'rgba(45, 80, 22, 0.08)',
                  border: '1px solid rgba(45, 80, 22, 0.2)',
                  borderRadius: '2px',
                  padding: '0.75rem'
                }}>
                  <p style={{ 
                    fontSize: '0.9rem',
                    color: 'var(--color-forest)',
                    fontStyle: 'italic'
                  }}>{inc.explanation}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
