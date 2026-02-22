import { useEffect, useRef } from 'react'
import { Network } from 'vis-network'
import { DataSet } from 'vis-data'
import { Loader, Network as NetworkIcon } from 'lucide-react'
import { GraphData } from '../api/client'

interface WorldGraphProps {
  data: GraphData | null
  loading: boolean
}

export default function WorldGraph({ data, loading }: WorldGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)

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
      <div className="flex items-center justify-between">
        <h3 style={{
          fontSize: '1.25rem', fontWeight: 600,
          color: 'var(--color-ink)', fontFamily: "'Crimson Text', serif"
        }}>world topology map</h3>
        <div className="flex space-x-4" style={{ fontSize: '0.75rem' }}>
          {[
            { color: '#ec4899', label: 'character' },
            { color: '#2563eb', label: 'location' },
            { color: '#9333ea', label: 'faction' },
            { color: '#f59e0b', label: 'event' },
            { color: '#6b7280', label: 'concept' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center space-x-1">
              <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: color }} />
              <span style={{ color: 'var(--color-ink-light)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div ref={containerRef} style={{
        width: '100%', height: '400px',
        background: '#f5f3ed', borderRadius: '2px',
        border: '1px solid var(--color-border)'
      }} />

      <div style={{
        fontSize: '0.875rem', color: 'var(--color-ink-light)',
        textAlign: 'center', fontStyle: 'italic'
      }}>
        nodes are entities · edges are relationships · updates as you write
      </div>
    </div>
  )
}
