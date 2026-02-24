import { useEffect, useMemo, useRef, useState } from 'react'
import { Network } from 'vis-network'
import { DataSet } from 'vis-data'
import { Loader, Network as NetworkIcon, Maximize2, Minimize2, Search } from 'lucide-react'
import { GraphData } from '../api/client'

interface WorldGraphProps {
  data: GraphData | null
  loading: boolean
  graphHeight?: number
}

type VisNode = {
  id: string
  label: string
  color: string
  size: number
  font: { color: string; size: number; face: string }
}

type VisEdge = {
  id: string
  from: string
  to: string
  label: string
  font: { size: number; color: string; align: string }
  color: { color: string; highlight: string }
  arrows: string
  smooth: { enabled: boolean; type: string; roundness: number }
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

function neighborhoodIds(seedId: string, edges: { from_node: string; to_node: string }[], depth: number): Set<string> {
  const adj = new Map<string, Set<string>>()
  for (const e of edges) {
    if (!adj.has(e.from_node)) adj.set(e.from_node, new Set())
    if (!adj.has(e.to_node)) adj.set(e.to_node, new Set())
    adj.get(e.from_node)!.add(e.to_node)
    adj.get(e.to_node)!.add(e.from_node)
  }

  const visited = new Set<string>([seedId])
  let frontier = new Set<string>([seedId])
  for (let d = 0; d < depth; d++) {
    const next = new Set<string>()
    for (const id of frontier) {
      for (const nb of adj.get(id) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb)
          next.add(nb)
        }
      }
    }
    frontier = next
    if (frontier.size === 0) break
  }
  return visited
}

export default function WorldGraph({ data, loading, graphHeight }: WorldGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const dataSetsRef = useRef<{ nodes: DataSet<VisNode>; edges: DataSet<VisEdge> } | null>(null)
  const prevCountRef = useRef<number>(0)

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const [depth, setDepth] = useState<1 | 2 | 3>(2)
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    () => new Set(NODE_TYPES.map(t => t.label))
  )
  const [activeEdgeTypes, setActiveEdgeTypes] = useState<Set<string>>(new Set())

  const edgeTypes = useMemo(() => {
    if (!data) return [] as string[]
    return [...new Set(data.edges.map(e => e.label))].sort()
  }, [data])

  useEffect(() => {
    if (edgeTypes.length === 0) return
    setActiveEdgeTypes(prev => {
      if (prev.size === 0) return new Set(edgeTypes)
      const next = new Set<string>()
      for (const t of edgeTypes) {
        if (prev.has(t)) next.add(t)
      }
      if (next.size === 0) return new Set(edgeTypes)
      return next
    })
  }, [edgeTypes])

  const toggleType = (label: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(label)) {
        if (next.size === 1) return prev
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }

  const toggleEdgeType = (label: string) => {
    setActiveEdgeTypes(prev => {
      const next = new Set(prev)
      if (next.has(label)) {
        if (next.size === 1) return prev
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }

  useEffect(() => {
    if (!containerRef.current || networkRef.current) return

    const nodes = new DataSet<VisNode>([])
    const edges = new DataSet<VisEdge>([])
    dataSetsRef.current = { nodes, edges }

    const options = {
      autoResize: true,
      nodes: { shape: 'dot', scaling: { min: 10, max: 30 } },
      edges: { width: 0.5, smooth: { enabled: true, type: 'continuous', roundness: 0.5 } },
      physics: {
        stabilization: false,
        barnesHut: { gravitationalConstant: -8000, springConstant: 0.001, springLength: 200 },
      },
      interaction: { hover: true, tooltipDelay: 100, hideEdgesOnDrag: true },
    }

    const network = new Network(containerRef.current, { nodes, edges }, options)
    networkRef.current = network

    const onClick = (params: { nodes?: string[] }) => {
      const first = params.nodes && params.nodes[0]
      if (first) setFocusNodeId(first)
    }
    network.on('click', onClick)

    return () => {
      network.off('click', onClick)
      if (networkRef.current) networkRef.current.destroy()
      networkRef.current = null
      dataSetsRef.current = null
    }
  }, [])

  useEffect(() => {
    const ds = dataSetsRef.current
    const network = networkRef.current
    if (!ds || !network) return

    if (!data || data.nodes.length === 0) {
      ds.nodes.clear()
      ds.edges.clear()
      prevCountRef.current = 0
      return
    }

    const typedNodes = data.nodes.filter(n => activeTypes.has(n.type))
    const typedNodeIds = new Set(typedNodes.map(n => n.id))

    let visibleEdges = data.edges.filter(
      e => typedNodeIds.has(e.from_node) && typedNodeIds.has(e.to_node) && activeEdgeTypes.has(e.label)
    )

    let visibleNodes = typedNodes
    if (focusNodeId && typedNodeIds.has(focusNodeId)) {
      const keep = neighborhoodIds(focusNodeId, visibleEdges, depth)
      visibleNodes = typedNodes.filter(n => keep.has(n.id))
      const keepIds = new Set(visibleNodes.map(n => n.id))
      visibleEdges = visibleEdges.filter(e => keepIds.has(e.from_node) && keepIds.has(e.to_node))
    }

    ds.nodes.clear()
    ds.nodes.add(
      visibleNodes.map(n => ({
        id: n.id,
        label: n.label,
        color: n.color,
        size: n.id === focusNodeId ? Math.max(24, n.size + 6) : n.size,
        font: { color: '#2c2416', size: 12, face: 'Lora' },
      }))
    )

    ds.edges.clear()
    ds.edges.add(
      visibleEdges.map((e) => ({
        id: `${e.from_node}->${e.to_node}:${e.label}`,
        from: e.from_node,
        to: e.to_node,
        label: e.label,
        font: { size: 9, color: '#5a4a3a', align: 'middle' },
        color: { color: '#e8e3d8', highlight: '#2d5016' },
        arrows: 'to',
        smooth: { enabled: true, type: 'continuous', roundness: 0.5 },
      }))
    )

    const nextCount = visibleNodes.length + visibleEdges.length
    const prevCount = prevCountRef.current
    prevCountRef.current = nextCount
    if (Math.abs(nextCount - prevCount) > 8) {
      network.stabilize(80)
      network.fit({ animation: { duration: 220, easingFunction: 'easeOutQuad' } })
    } else {
      network.redraw()
    }
  }, [data, activeTypes, activeEdgeTypes, focusNodeId, depth])

  useEffect(() => {
    if (networkRef.current) networkRef.current.redraw()
  }, [graphHeight])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.fullscreenElement) document.exitFullscreen()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  const toggleFullscreen = () => {
    if (!wrapperRef.current) return
    if (!document.fullscreenElement) wrapperRef.current.requestFullscreen()
    else document.exitFullscreen()
  }

  const filteredSearchNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q || !data) return []
    return data.nodes
      .filter(n => activeTypes.has(n.type) && n.label.toLowerCase().includes(q))
      .slice(0, 8)
  }, [searchQuery, data, activeTypes])

  const focusNode = (nodeId: string) => {
    setFocusNodeId(nodeId)
    const network = networkRef.current
    if (!network) return
    network.selectNodes([nodeId])
    network.focus(nodeId, {
      scale: 1.25,
      animation: { duration: 260, easingFunction: 'easeOutQuad' },
    })
  }

  if (loading) {
    return (
      <div style={{
        height: `${Math.max(120, (graphHeight ?? 320) - 110)}px`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        transition: 'height 0.02s linear',
      }}>
        <Loader style={{ color: 'var(--color-forest)' }} className="w-12 h-12 animate-spin mb-4" />
        <p style={{ color: 'var(--color-ink-light)' }}>building world topology...</p>
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div style={{
        height: `${Math.max(120, (graphHeight ?? 320) - 110)}px`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        transition: 'height 0.02s linear',
      }}>
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
          color: 'var(--color-ink)', fontFamily: "'Crimson Text', serif",
        }}>world topology map</h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            border: '1px solid var(--color-border)', borderRadius: '3px',
            padding: '0.2rem 0.4rem', background: 'white',
          }}>
            <Search style={{ width: '0.8rem', height: '0.8rem', color: 'var(--color-ink-light)' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="find node"
              style={{ border: 'none', outline: 'none', fontSize: '0.75rem', width: '7rem', color: 'var(--color-ink)' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-light)' }}>depth</span>
        {[1, 2, 3].map(d => (
          <button
            key={d}
            onClick={() => setDepth(d as 1 | 2 | 3)}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: '999px',
              background: depth === d ? 'var(--color-forest)' : 'white',
              color: depth === d ? 'white' : 'var(--color-ink)',
              padding: '0.1rem 0.5rem',
              fontSize: '0.72rem',
              cursor: 'pointer',
            }}
          >
            {d}
          </button>
        ))}
        {focusNodeId && (
          <button
            onClick={() => setFocusNodeId(null)}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: '999px',
              background: 'white',
              color: 'var(--color-ink)',
              padding: '0.1rem 0.5rem',
              fontSize: '0.72rem',
              cursor: 'pointer',
            }}
          >
            clear focus
          </button>
        )}
      </div>

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
            >
              <div style={{
                width: '0.65rem', height: '0.65rem', borderRadius: '50%',
                background: active ? color : '#9ca3af',
                transition: 'background 0.15s ease', flexShrink: 0,
              }} />
              <span style={{
                color: active ? 'var(--color-ink)' : 'var(--color-ink-light)',
                transition: 'color 0.15s ease', userSelect: 'none',
              }}>
                {label}
              </span>
            </button>
          )
        })}
      </div>

      {edgeTypes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {edgeTypes.slice(0, 20).map((t) => {
            const active = activeEdgeTypes.has(t)
            return (
              <button
                key={t}
                onClick={() => toggleEdgeType(t)}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: '999px',
                  background: active ? '#eef4ea' : 'white',
                  color: active ? 'var(--color-forest)' : 'var(--color-ink-light)',
                  padding: '0.1rem 0.45rem',
                  fontSize: '0.68rem',
                  cursor: 'pointer',
                }}
                title={active ? `hide ${t}` : `show ${t}`}
              >
                {t}
              </button>
            )
          })}
        </div>
      )}

      {filteredSearchNodes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {filteredSearchNodes.map(n => (
            <button
              key={n.id}
              onClick={() => focusNode(n.id)}
              style={{
                border: '1px solid var(--color-border)',
                background: 'white',
                borderRadius: '999px',
                padding: '0.2rem 0.55rem',
                fontSize: '0.7rem',
                color: 'var(--color-ink)',
                cursor: 'pointer',
              }}
              title={`focus ${n.label}`}
            >
              {n.label}
            </button>
          ))}
        </div>
      )}

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
          height: isFullscreen ? '100vh' : `${Math.max(120, (graphHeight ?? 320) - 110)}px`,
          minWidth: 0,
          transition: 'height 0.02s linear',
        }} />
      </div>

      <div style={{
        fontSize: '0.875rem', color: 'var(--color-ink-light)',
        textAlign: 'center', fontStyle: 'italic',
      }}>
        nodes are entities · edges are relationships · click a node to isolate neighborhood
      </div>
    </div>
  )
}
