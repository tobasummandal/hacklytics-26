import { useEffect, useRef, useState } from 'react'
import { Network } from 'vis-network'
import { DataSet } from 'vis-data'
import { Loader, Network as NetworkIcon, Maximize2, Minimize2 } from 'lucide-react'
import { GraphData } from '../api/client'

interface WorldGraphProps {
  data: GraphData | null
  loading: boolean
}

export default function WorldGraph({ data, loading }: WorldGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!data || !containerRef.current || data.nodes.length === 0) return

    const nodes = new DataSet(
      data.nodes.map(n => ({
        id: n.id,
        label: n.label,
        color: n.color,
        size: n.size,
        font: { color: '#2c2416', size: 12, face: 'Lora' }
      }))
    )

    const edges = new DataSet(
      data.edges.map((e, i) => ({
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
  }, [data])

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
        <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ fontSize: '0.75rem' }}>
          {[
            { color: '#ec4899', label: 'character' },
            { color: '#2563eb', label: 'location' },
            { color: '#9333ea', label: 'faction' },
            { color: '#f59e0b', label: 'event' },
            { color: '#b45309', label: 'object' },
            { color: '#6b7280', label: 'concept' },
            { color: '#16a34a', label: 'creature' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center space-x-1">
              <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: color }} />
              <span style={{ color: 'var(--color-ink-light)' }}>{label}</span>
            </div>
          ))}
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
        nodes are entities · edges are relationships · updates as you write
      </div>
    </div>
  )
}
