import { Sparkles, Wifi, WifiOff } from 'lucide-react'

interface HeaderProps {
  wsConnected: boolean
}

export default function Header({ wsConnected }: HeaderProps) {
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
                pure imagination
              </h1>
              <p style={{ 
                fontSize: '0.8rem',
                color: 'var(--color-ink-light)',
                fontStyle: 'italic'
              }}>
                world-building architecture
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {wsConnected ? (
                <>
                  <Wifi style={{ color: 'var(--color-forest)' }} className="w-4 h-4" />
                  <span style={{ 
                    fontSize: '0.75rem',
                    color: 'var(--color-forest)'
                  }}>connected</span>
                </>
              ) : (
                <>
                  <WifiOff style={{ color: '#c45a5a' }} className="w-4 h-4" />
                  <span style={{ 
                    fontSize: '0.75rem',
                    color: '#c45a5a'
                  }}>disconnected</span>
                </>
              )}
            </div>
            
            <div style={{ 
              fontSize: '0.75rem',
              color: 'var(--color-ink-light)'
            }}>
              actian vectorai db
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
