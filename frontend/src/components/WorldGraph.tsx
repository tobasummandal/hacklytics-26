import { useEffect, useRef } from 'react'
import { Network } from 'vis-network'
import { DataSet } from 'vis-data'
import { Loader, Network as NetworkIcon } from 'lucide-react'
import { GraphData } from '../types'

interface WorldGraphProps {
  data: GraphData | null
  loading: boolean
}

export default function WorldGraph({ data, loading }: WorldGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)

  useEffect(() => {
    if (!data || !containerRef.current) return

    const nodes = new DataSet(
      data.nodes.map(node => ({
        id: node.id,
        label: node.label,
        color: node.color || '#2d5016',
        size: node.size || 10,
        font: {
          color: '#2c2416',
          size: 12,
          face: 'Lora'
        }
      }))
    )

    const edges = new DataSet(
      data.edges.map(edge => ({
        from: edge.from_node,
        to: edge.to_node,
        value: edge.weight,
        color: {
          color: '#e8e3d8',
          highlight: '#2d5016'
        }
      }))
    )

    const options = {
      nodes: {
        shape: 'dot',
        scaling: {
          min: 10,
          max: 30
        },
        font: {
          size: 12,
          face: 'Tahoma'
        }
      },
      edges: {
        width: 0.5,
        color: { inherit: 'from' },
        smooth: {
          type: 'continuous'
        }
      },
      physics: {
        stabilization: false,
        barnesHut: {
          gravitationalConstant: -8000,
          springConstant: 0.001,
          springLength: 200
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        hideEdgesOnDrag: true
      }
    }

    if (networkRef.current) {
      networkRef.current.destroy()
    }

    networkRef.current = new Network(
      containerRef.current,
      { nodes, edges },
      options
    )

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy()
      }
    }
  }, [data])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader style={{ color: 'var(--color-forest)' }} className="w-12 h-12 animate-spin mb-4" />
        <p style={{ color: 'var(--color-ink-light)' }}>building world topology...</p>
      </div>
    )
  }

  if (!data || (data.nodes.length === 0 && data.edges.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <NetworkIcon style={{ color: 'var(--color-ink-light)' }} className="w-12 h-12 mb-4" />
        <p style={{ color: 'var(--color-ink-light)' }}>no world data available yet.</p>
        <p style={{ 
          fontSize: '0.875rem',
          color: 'var(--color-ink-light)',
          marginTop: '0.5rem'
        }}>upload a manuscript to visualize your world.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          color: 'var(--color-ink)'
        }}>world topology map</h3>
        <div className="flex space-x-4" style={{ fontSize: '0.75rem' }}>
          <div className="flex items-center space-x-1">
            <div style={{
              width: '0.75rem',
              height: '0.75rem',
              borderRadius: '50%',
              background: '#8b5cf6'
            }}></div>
            <span style={{ color: 'var(--color-ink-light)' }}>magic</span>
          </div>
          <div className="flex items-center space-x-1">
            <div style={{
              width: '0.75rem',
              height: '0.75rem',
              borderRadius: '50%',
              background: '#ec4899'
            }}></div>
            <span style={{ color: 'var(--color-ink-light)' }}>politics</span>
          </div>
          <div className="flex items-center space-x-1">
            <div style={{
              width: '0.75rem',
              height: '0.75rem',
              borderRadius: '50%',
              background: '#06b6d4'
            }}></div>
            <span style={{ color: 'var(--color-ink-light)' }}>technology</span>
          </div>
          <div className="flex items-center space-x-1">
            <div style={{
              width: '0.75rem',
              height: '0.75rem',
              borderRadius: '50%',
              background: '#f59e0b'
            }}></div>
            <span style={{ color: 'var(--color-ink-light)' }}>economy</span>
          </div>
          <div className="flex items-center space-x-1">
            <div style={{
              width: '0.75rem',
              height: '0.75rem',
              borderRadius: '50%',
              background: 'var(--color-forest)'
            }}></div>
            <span style={{ color: 'var(--color-ink-light)' }}>character</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '600px',
          background: '#f5f3ed',
          borderRadius: '2px',
          border: '1px solid var(--color-border)'
        }}
      />

      <div style={{
        fontSize: '0.875rem',
        color: 'var(--color-ink-light)',
        textAlign: 'center',
        fontStyle: 'italic'
      }}>
        nodes represent rules and characters. edges show semantic proximity.
      </div>
    </div>
  )
}
