import { useEffect, useRef, useState } from 'react'
import { Network } from 'vis-network'
import { DataSet } from 'vis-data'
import { Loader, Network as NetworkIcon, Maximize2, Minimize2 } from 'lucide-react'
import { GraphData } from '../api/client'

interface WorldGraphProps {
  data: GraphData | null
  loading: boolean
}

const NODE_TYPES = [
  { color: '#ec4899', label: 'character' },
  { color: '#2563eb', label: 'location' },
  { color: '#9333ea', label: 'faction' },
  { color: '#f59e0b', label: 'event' },
  { color: '#b45309', label: 'object' },
  { color: '#6b7280', label: 'concept' },
  { color: '#16a34a', label: 'creature' },
]

export default function WorldGraph({ data, loading }: WorldGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    () => new Set(NODE_TYPES.map(t => t.label))
  )

  const toggleType = (label: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(label)) {
        // Don't allow deselecting the last active type
        if (next.size === 1) return prev
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }

  useEffect(() => {
    if (!data || !containerRef.current || data.nodes.length === 0) return

    // Filter nodes by active types
    const visibleNodes = data.nodes.filter(n => activeTypes.has(n.type))
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id))

    // Filter edges — both endpoints must be visible
    const visibleEdges = data.edges.filter(
      e => visibleNodeIds.has(e.from_node) && visibleNodeIds.has(e.to_node)
    )

    const nodes = new DataSet(
      visibleNodes.map(n => ({
        id: n.id,
        label: n.label,
        color: n.color,
        size: n.size,
        font: { color: '#2c2416', size: 12, face: 'Lora' }
      }))
    )

    const edges = new DataSet(
      visibleEdges.map((e, i) => ({
        id: i,
        from: e.from_node,
        to: e.to_node,
        label: e.label,
        font: { size: 9, color: '#5a4a3a', align: 'middle' },
        color: { color: '#e8e3d8', highlight: '#2d5016' },
        arrows: 'to',
        smooth: { enabled: true, type: 'continuous', roundness: 0.5 }
      }))
    )

    const options = {
      nodes: { shape: 'dot', scaling: { min: 10, max: 30 } },
      edges: { width: 0.5, smooth: { enabled: true, type: 'continuous', roundness: 0.5 } },
      physics: {
        stabilization: false,
        barnesHut: { gravitationalConstant: -8000, springConstant: 0.001, springLength: 200 }
      },
      interaction: { hover: true, tooltipDelay: 100, hideEdgesOnDrag: true }
    }

    if (networkRef.current) networkRef.current.destroy()
    networkRef.current = new Network(containerRef.current, { nodes, edges }, options)

    return () => { if (networkRef.current) networkRef.current.destroy() }
  }, [data, activeTypes])

  // track fullscreen state changes (including Esc key which browser handles natively)
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // any key press exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return
    const onKey = () => {
      if (document.fullscreenElement) document.exitFullscreen()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  const toggleFullscreen = () => {
    if (!wrapperRef.current) return
    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader style={{ color: 'var(--color-forest)' }} className="w-12 h-12 animate-spin mb-4" />
        <p style={{ color: 'var(--color-ink-light)' }}>building world topology...</p>
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <NetworkIcon style={{ color: 'var(--color-ink-light)' }} className="w-12 h-12 mb-4" />
        <p style={{ color: 'var(--color-ink-light)' }}>no world data yet.</p>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-ink-light)', marginTop: '0.5rem' }}>
          start writing to populate the knowledge graph.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <h3 style={{
          fontSize: '1.25rem', fontWeight: 600,
          color: 'var(--color-ink)', fontFamily: "'Crimson Text', serif"
        }}>world topology map</h3>

        {/* Toggleable legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1" style={{ fontSize: '0.75rem' }}>
          {NODE_TYPES.map(({ color, label }) => {
            const active = activeTypes.has(label)
            return (
              <button
                key={label}
                onClick={() => toggleType(label)}
                title={active ? `hide ${label}s` : `show ${label}s`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  background: 'none', border: 'none', padding: '0.2rem 0.35rem',
                  borderRadius: '3px', cursor: 'pointer',
                  opacity: active ? 1 : 0.35,
                  transition: 'opacity 0.15s ease, background 0.15s ease',
                  outline: active ? `1px solid ${color}22` : 'none',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = `${color}18`
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'none'
                }}
              >
                <div style={{
                  width: '0.65rem', height: '0.65rem', borderRadius: '50%',
                  background: active ? color : '#9ca3af',
                  transition: 'background 0.15s ease',
                  flexShrink: 0,
                }} />
                <span style={{
                  color: active ? 'var(--color-ink)' : 'var(--color-ink-light)',
                  transition: 'color 0.15s ease',
                  userSelect: 'none',
                }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div
        ref={wrapperRef}
        style={{
          position: 'relative',
          background: '#f5f3ed',
          borderRadius: '2px',
          border: '1px solid var(--color-border)',
        }}
      >
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'exit fullscreen' : 'fullscreen'}
          style={{
            position: 'absolute', top: '0.5rem', left: '0.5rem', zIndex: 10,
            background: 'rgba(245,243,237,0.85)', border: '1px solid var(--color-border)',
            borderRadius: '2px', padding: '0.25rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isFullscreen
            ? <Minimize2 style={{ width: '0.875rem', height: '0.875rem', color: 'var(--color-ink)' }} />
            : <Maximize2 style={{ width: '0.875rem', height: '0.875rem', color: 'var(--color-ink)' }} />
          }
        </button>

        <div ref={containerRef} style={{
          width: '100%',
          height: isFullscreen ? '100vh' : '260px',
          minWidth: 0,
        }} />
      </div>

      <div style={{
        fontSize: '0.875rem', color: 'var(--color-ink-light)',
        textAlign: 'center', fontStyle: 'italic'
      }}>
        nodes are entities · edges are relationships · click a type to toggle visibility
      </div>
    </div>
  )
}
