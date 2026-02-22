import { AlertTriangle, AlertCircle, Info, Loader } from 'lucide-react'
import { Flag } from '../api/client'

interface FlagPanelProps {
  flags: Flag[]
  checking: boolean
}

export default function FlagPanel({ flags, checking }: FlagPanelProps) {
  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader style={{ color: 'var(--color-forest)' }} className="w-8 h-8 animate-spin mb-3" />
        <p style={{ color: 'var(--color-ink-light)', fontSize: '0.875rem' }}>checking consistency…</p>
      </div>
    )
  }

  if (flags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle style={{ color: 'var(--color-ink-light)' }} className="w-10 h-10 mb-3" />
        <p style={{ color: 'var(--color-ink-light)', fontSize: '0.875rem' }}>no contradictions detected.</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-ink-light)', marginTop: '0.4rem', fontStyle: 'italic' }}>
          flags appear automatically as you write.
        </p>
      </div>
    )
  }

  const icon = (s: string) => {
    if (s === 'high') return <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: '#c45a5a' }} />
    if (s === 'medium') return <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#d4af37' }} />
    return <Info className="w-5 h-5 flex-shrink-0" style={{ color: '#4a7c2a' }} />
  }

  const colors = (s: string) => {
    if (s === 'high') return { border: '1px solid rgba(196,90,90,0.3)', background: 'rgba(196,90,90,0.05)' }
    if (s === 'medium') return { border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.05)' }
    return { border: '1px solid rgba(74,124,42,0.3)', background: 'rgba(74,124,42,0.05)' }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-ink)', fontFamily: "'Crimson Text', serif" }}>
          consistency flags
        </h3>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-ink-light)' }}>
          {flags.length} issue{flags.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {flags.map((flag, idx) => (
        <div key={idx} style={{ ...colors(flag.severity), borderRadius: '2px', padding: '1rem' }}>
          <div className="flex items-start space-x-3">
            {icon(flag.severity)}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span style={{
                  fontWeight: 600, fontSize: '0.8rem',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: 'var(--color-ink)'
                }}>
                  {flag.character} · {flag.severity}
                </span>
              </div>

              <p style={{ fontSize: '0.9rem', color: 'var(--color-ink)', marginBottom: '0.5rem' }}>
                {flag.issue}
              </p>

              <div style={{
                background: 'var(--color-parchment)',
                borderRadius: '2px', padding: '0.6rem 0.75rem',
                border: '1px solid var(--color-border)', marginBottom: '0.5rem'
              }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-ink-light)', marginBottom: '0.2rem' }}>evidence</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-ink)' }}>{flag.evidence}</p>
              </div>

              <div style={{
                background: 'rgba(45,80,22,0.06)',
                border: '1px solid rgba(45,80,22,0.2)',
                borderRadius: '2px', padding: '0.6rem 0.75rem'
              }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-ink-light)', marginBottom: '0.2rem' }}>suggestion</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-forest)', fontStyle: 'italic' }}>{flag.suggestion}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
