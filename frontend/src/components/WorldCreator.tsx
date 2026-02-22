import { useState } from 'react'
import { BookOpen, Sparkles } from 'lucide-react'
import { api } from '../api/client'
import { World } from '../types'

interface WorldCreatorProps {
  onWorldCreated: (world: World) => void
}

export default function WorldCreator({ onWorldCreated }: WorldCreatorProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreateWorld = async () => {
    if (!name.trim()) return

    setLoading(true)
    try {
      const world = await api.createWorld(name, description)
      onWorldCreated(world)
    } catch (error) {
      console.error('Error creating world:', error)
      alert('Failed to create world. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12">
          <div className="flex items-center space-x-3 mb-3">
            <Sparkles style={{ color: 'var(--color-forest)' }} className="w-10 h-10" />
            <h2 style={{
              fontFamily: "'Crimson Text', serif",
              fontSize: 'clamp(2rem, 5vw, 2.75rem)',
              fontWeight: 600,
              color: 'var(--color-ink)',
              letterSpacing: '0.01em'
            }}>
              create your world
            </h2>
          </div>
          
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <span className="ornament">✦</span>
            <div style={{
              flex: 1,
              height: '1px',
              background: 'linear-gradient(to right, var(--color-gold), transparent)'
            }} />
          </div>
          
          <p style={{ 
            color: 'var(--color-ink-light)',
            fontSize: '1.05rem',
            lineHeight: '1.6',
            maxWidth: '42rem'
          }}>
            begin building your fictional universe with semantic consistency checking,
            loophole detection, and character tracking powered by vector embeddings
          </p>
        </div>

        <div className="paper-card rounded-sm p-8 mb-10">
          <div className="space-y-6">
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: 500,
                color: 'var(--color-ink)',
                marginBottom: '0.5rem',
                letterSpacing: '0.02em'
              }}>
                world name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="the eternal empire"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'var(--color-parchment)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '2px',
                  color: 'var(--color-ink)',
                  fontFamily: "'Lora', serif",
                  fontSize: '1rem'
                }}
                className="focus:outline-none focus:ring-2"
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-forest)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: 500,
                color: 'var(--color-ink)',
                marginBottom: '0.5rem',
                letterSpacing: '0.02em'
              }}>
                description <span style={{ color: 'var(--color-ink-light)', fontStyle: 'italic' }}>(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="a brief description of your world..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'var(--color-parchment)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '2px',
                  color: 'var(--color-ink)',
                  fontFamily: "'Lora', serif",
                  fontSize: '1rem',
                  resize: 'vertical'
                }}
                className="focus:outline-none focus:ring-2"
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-forest)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
              />
            </div>

            <button
              onClick={handleCreateWorld}
              disabled={loading || !name.trim()}
              style={{
                width: '100%',
                padding: '0.875rem 1.5rem',
                background: loading || !name.trim() ? 'var(--color-border)' : 'var(--color-forest)',
                color: loading || !name.trim() ? 'var(--color-ink-light)' : 'var(--color-paper)',
                fontWeight: 500,
                borderRadius: '2px',
                border: 'none',
                cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '1rem',
                letterSpacing: '0.02em'
              }}
              className="flex items-center justify-center space-x-2"
              onMouseEnter={(e) => {
                if (!loading && name.trim()) e.currentTarget.style.background = 'var(--color-forest-light)'
              }}
              onMouseLeave={(e) => {
                if (!loading && name.trim()) e.currentTarget.style.background = 'var(--color-forest)'
              }}
            >
              {loading ? (
                <span>creating...</span>
              ) : (
                <>
                  <BookOpen className="w-5 h-5" />
                  <span>begin world</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '2rem'
        }}>
          <span className="ornament">✦</span>
          <div style={{
            flex: 1,
            height: '1px',
            background: 'var(--color-border)'
          }} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="paper-card rounded-sm p-6">
            <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: 'var(--color-gold)' }}>📖</div>
            <h3 style={{
              fontWeight: 600,
              marginBottom: '0.5rem',
              color: 'var(--color-ink)',
              fontSize: '1.05rem'
            }}>real-time ingestion</h3>
            <p style={{ 
              fontSize: '0.9rem',
              color: 'var(--color-ink-light)',
              lineHeight: '1.5'
            }}>
              upload manuscripts and watch rules get extracted automatically
            </p>
          </div>

          <div className="paper-card rounded-sm p-6">
            <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: 'var(--color-gold)' }}>⚠️</div>
            <h3 style={{
              fontWeight: 600,
              marginBottom: '0.5rem',
              color: 'var(--color-ink)',
              fontSize: '1.05rem'
            }}>inconsistency detection</h3>
            <p style={{ 
              fontSize: '0.9rem',
              color: 'var(--color-ink-light)',
              lineHeight: '1.5'
            }}>
              find contradictions before they become plot holes
            </p>
          </div>

          <div className="paper-card rounded-sm p-6">
            <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: 'var(--color-gold)' }}>🗺️</div>
            <h3 style={{
              fontWeight: 600,
              marginBottom: '0.5rem',
              color: 'var(--color-ink)',
              fontSize: '1.05rem'
            }}>world topology map</h3>
            <p style={{ 
              fontSize: '0.9rem',
              color: 'var(--color-ink-light)',
              lineHeight: '1.5'
            }}>
              visualize connections between rules and systems
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
