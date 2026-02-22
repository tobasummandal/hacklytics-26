import { Sparkles } from 'lucide-react'

export default function Header() {
  return (
    <header style={{
      background: 'var(--color-paper)',
      borderBottom: '1px solid var(--color-border)',
      boxShadow: '0 1px 3px var(--color-shadow)'
    }} className="sticky top-0 z-50">
      <div className="container mx-auto px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sparkles style={{ color: 'var(--color-forest)' }} className="w-7 h-7" />
            <div>
              <h1 style={{
                fontFamily: "'Crimson Text', serif",
                fontSize: '1.75rem',
                fontWeight: 600,
                color: 'var(--color-ink)',
                letterSpacing: '0.01em'
              }}>
                archivist
              </h1>
              <p style={{
                fontSize: '0.8rem',
                color: 'var(--color-ink-light)',
                fontStyle: 'italic'
              }}>
                story consistency engine
              </p>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-light)' }}>
            actian vectorai db · gemini 2.5
          </div>
        </div>
      </div>
    </header>
  )
}
