import { useEffect, useMemo, useRef, useState } from 'react'
import { Network } from 'vis-network'
import { DataSet } from 'vis-data'
import { Loader, Network as NetworkIcon, Maximize2, Minimize2, Search } from 'lucide-react'
import { GraphData } from '../api/client'

interface WorldGraphProps {
  data: GraphData | null
  loading: boolean
  graphHeight?: number
  isResizing?: boolean
  onSelectionHighlight?: (terms: string[]) => void
}

type VisNode = {
  id: string
  label: string
  title?: string
  color: string | { background: string; border: string; highlight: { background: string; border: string } }
  size: number
  borderWidth?: number
  shadow?: { enabled: boolean; color: string; size: number; x: number; y: number }
  x?: number
  y?: number
  font: { color: string; size: number; face: string }
}

type VisEdge = {
  id: string
  from: string
  to: string
  label: string
  title?: string
  width: number
  font: { size: number; color: string; align: string }
  color: { color: string; highlight: string }
  arrows: string
  smooth: { enabled: boolean; type: string; roundness: number }
}

type InteractionMode = 'focus' | 'highlight'

const NODE_TYPES = [
  { color: '#ec4899', label: 'character' },
  { color: '#2563eb', label: 'location' },
  { color: '#9333ea', label: 'faction' },
  { color: '#f59e0b', label: 'event' },
  { color: '#b45309', label: 'object' },
  { color: '#6b7280', label: 'concept' },
  { color: '#16a34a', label: 'creature' },
]

function darkenHex(hex: string, amount = 0.22): string {
  const raw = hex.replace('#', '')
  if (raw.length !== 6) return hex
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  const scale = Math.max(0, 1 - amount)
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n * scale))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

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

function maxNeighborhoodDepth(seedId: string, edges: { from_node: string; to_node: string }[], cap = 6): number {
  const adj = new Map<string, Set<string>>()
  for (const e of edges) {
    if (!adj.has(e.from_node)) adj.set(e.from_node, new Set())
    if (!adj.has(e.to_node)) adj.set(e.to_node, new Set())
    adj.get(e.from_node)!.add(e.to_node)
    adj.get(e.to_node)!.add(e.from_node)
  }
  if (!adj.has(seedId)) return 1

  const visited = new Set<string>([seedId])
  let frontier = new Set<string>([seedId])
  let depth = 0
  while (frontier.size > 0 && depth < cap) {
    const next = new Set<string>()
    for (const id of frontier) {
      for (const nb of adj.get(id) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb)
          next.add(nb)
        }
      }
    }
    if (next.size === 0) break
    frontier = next
    depth += 1
  }
  return Math.max(1, depth)
}

export default function WorldGraph({ data, loading, graphHeight, isResizing, onSelectionHighlight }: WorldGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const fullscreenControlsRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const dataSetsRef = useRef<{ nodes: DataSet<VisNode>; edges: DataSet<VisEdge> } | null>(null)
  const nodePosRef = useRef<Record<string, { x: number; y: number }>>({})
  const dragStartPosRef = useRef<Record<string, { x: number; y: number }>>({})
  const resetLayoutRef = useRef(false)
  const dataRef = useRef<GraphData | null>(null)
  const selectionCbRef = useRef<((terms: string[]) => void) | undefined>(onSelectionHighlight)
  const interactionModeRef = useRef<InteractionMode>('focus')
  const selectionByKeyRef = useRef<Record<string, string[]>>({})
  const suppressClickUntilRef = useRef(0)
  const clampRafRef = useRef<number | null>(null)
  const lastFittedKeyRef = useRef('')
  const autoFitRafRef = useRef<number | null>(null)
  const lastAutoFitAtRef = useRef(0)
  const physicsEnabledRef = useRef(false)

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const [depth, setDepth] = useState<1 | 2 | 3>(2)
  const [showEdgeLabels, setShowEdgeLabels] = useState(false)
  const [physicsEnabled, setPhysicsEnabled] = useState(false)
  const [showHoverDetails, setShowHoverDetails] = useState(false)
  const [fullscreenControlsHeight, setFullscreenControlsHeight] = useState(0)
  const [activeNodeIds, setActiveNodeIds] = useState<Set<string>>(new Set())
  const [activeEdgeIds, setActiveEdgeIds] = useState<Set<string>>(new Set())
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set())
  const [activeEdgeTypes, setActiveEdgeTypes] = useState<Set<string>>(new Set())
  const [selectionByKey, setSelectionByKey] = useState<Record<string, string[]>>({})
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('focus')

  useEffect(() => { dataRef.current = data }, [data])
  useEffect(() => { selectionCbRef.current = onSelectionHighlight }, [onSelectionHighlight])
  useEffect(() => { interactionModeRef.current = interactionMode }, [interactionMode])
  useEffect(() => { physicsEnabledRef.current = physicsEnabled }, [physicsEnabled])

  const applySelectionMap = (next: Record<string, string[]>) => {
    selectionByKeyRef.current = next
    setSelectionByKey(next)
    const merged = [...new Set(Object.values(next).flat().filter(Boolean))]
    selectionCbRef.current?.(merged)
  }

  const toggleSelection = (key: string, terms: string[]) => {
    const next = { ...selectionByKeyRef.current }
    if (next[key]) delete next[key]
    else next[key] = terms
    applySelectionMap(next)
  }

  const clearHighlights = () => {
    applySelectionMap({})
    setActiveNodeIds(new Set())
    setActiveEdgeIds(new Set())
    if (networkRef.current) networkRef.current.unselectAll()
  }

  const hasHighlights = Object.keys(selectionByKey).length > 0

  const availableNodeTypes = useMemo(() => {
    if (!data) return [] as { color: string; label: string }[]
    const present = new Set(data.nodes.map(n => n.type))
    const known = NODE_TYPES.filter(t => present.has(t.label))
    const unknown = [...present]
      .filter(t => !NODE_TYPES.find(k => k.label === t))
      .map(t => ({ color: '#6b7280', label: t }))
    return [...known, ...unknown]
  }, [data])

  const edgeTypes = useMemo(() => {
    if (!data) return [] as string[]
    return [...new Set(data.edges.map(e => e.label))].sort()
  }, [data])

  useEffect(() => {
    const labels = availableNodeTypes.map(t => t.label)
    if (labels.length === 0) return
    setActiveTypes(prev => {
      if (prev.size === 0) return new Set(labels)
      const next = new Set<string>()
      for (const l of labels) {
        if (prev.has(l)) next.add(l)
      }
      if (next.size === 0) return new Set(labels)
      return next
    })
  }, [availableNodeTypes])

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

  const typedNodes = useMemo(() => {
    if (!data) return []
    return data.nodes.filter(n => activeTypes.has(n.type))
  }, [data, activeTypes])

  const typedNodeIds = useMemo(() => new Set(typedNodes.map(n => n.id)), [typedNodes])

  const candidateEdges = useMemo(() => {
    if (!data) return []
    return data.edges.filter(
      e => typedNodeIds.has(e.from_node) && typedNodeIds.has(e.to_node) && activeEdgeTypes.has(e.label)
    )
  }, [data, typedNodeIds, activeEdgeTypes])

  const maxDepth = useMemo(() => {
    if (!focusNodeId) return 1
    return maxNeighborhoodDepth(focusNodeId, candidateEdges, 6)
  }, [focusNodeId, candidateEdges])

  useEffect(() => {
    if (depth > 1 && maxDepth < depth) {
      setDepth(maxDepth >= 3 ? 3 : maxDepth >= 2 ? 2 : 1)
    }
  }, [depth, maxDepth])

  const visible = useMemo(() => {
    if (!focusNodeId || !typedNodeIds.has(focusNodeId)) {
      return { nodes: typedNodes, edges: candidateEdges }
    }
    const keep = neighborhoodIds(focusNodeId, candidateEdges, depth)
    const nodes = typedNodes.filter(n => keep.has(n.id))
    const keepIds = new Set(nodes.map(n => n.id))
    const edges = candidateEdges.filter(e => keepIds.has(e.from_node) && keepIds.has(e.to_node))
    return { nodes, edges }
  }, [focusNodeId, depth, typedNodes, typedNodeIds, candidateEdges])

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

  const snapshotNodePositions = () => {
    const network = networkRef.current
    const ds = dataSetsRef.current
    if (!network || !ds) return
    const ids = ds.nodes.getIds() as string[]
    if (!ids.length) return
    const pos = network.getPositions(ids)
    for (const id of ids) {
      const p = pos[id]
      if (p) nodePosRef.current[id] = { x: p.x, y: p.y }
    }
  }

  const getVisibleCanvasBounds = () => {
    const network = networkRef.current
    const container = containerRef.current
    if (!network || !container) return null
    const tl = network.DOMtoCanvas({ x: 0, y: 0 })
    const br = network.DOMtoCanvas({ x: container.clientWidth, y: container.clientHeight })
    return {
      minX: Math.min(tl.x, br.x),
      maxX: Math.max(tl.x, br.x),
      minY: Math.min(tl.y, br.y),
      maxY: Math.max(tl.y, br.y),
    }
  }

  const clampViewToGraphBounds = () => {
    const network = networkRef.current
    const ds = dataSetsRef.current
    const container = containerRef.current
    if (!network || !ds || !container) return
    const ids = ds.nodes.getIds() as string[]
    if (!ids.length) return

    let left = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let top = Number.POSITIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY

    for (const id of ids) {
      const box = network.getBoundingBox(id)
      left = Math.min(left, box.left)
      right = Math.max(right, box.right)
      top = Math.min(top, box.top)
      bottom = Math.max(bottom, box.bottom)
    }

    if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(top) || !Number.isFinite(bottom)) return

    const scale = Math.max(0.0001, network.getScale())
    const halfW = container.clientWidth / (2 * scale)
    const halfH = container.clientHeight / (2 * scale)
    const margin = 18 / scale

    const centerX = (left + right) / 2
    const centerY = (top + bottom) / 2

    const minX = left + halfW - margin
    const maxX = right - halfW + margin
    const minY = top + halfH - margin
    const maxY = bottom - halfH + margin

    const { x: viewX, y: viewY } = network.getViewPosition()
    const nextX = minX <= maxX ? Math.min(maxX, Math.max(minX, viewX)) : centerX
    const nextY = minY <= maxY ? Math.min(maxY, Math.max(minY, viewY)) : centerY

    if (Math.abs(nextX - viewX) > 0.001 || Math.abs(nextY - viewY) > 0.001) {
      network.moveTo({ position: { x: nextX, y: nextY }, scale, animation: false })
    }
  }

  const ensureGraphInViewport = () => {
    const network = networkRef.current
    const ds = dataSetsRef.current
    const container = containerRef.current
    if (!network || !ds || !container) return
    const ids = ds.nodes.getIds() as string[]
    if (!ids.length) return

    let left = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let top = Number.POSITIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    for (const id of ids) {
      const box = network.getBoundingBox(id)
      left = Math.min(left, box.left)
      right = Math.max(right, box.right)
      top = Math.min(top, box.top)
      bottom = Math.max(bottom, box.bottom)
    }
    if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(top) || !Number.isFinite(bottom)) return

    const visible = getVisibleCanvasBounds()
    if (!visible) return
    const pad = 20 / Math.max(0.0001, network.getScale())
    const outOfView =
      left < visible.minX + pad ||
      right > visible.maxX - pad ||
      top < visible.minY + pad ||
      bottom > visible.maxY - pad

    if (!outOfView) return

    const now = performance.now()
    if (now - lastAutoFitAtRef.current < 180) return
    lastAutoFitAtRef.current = now
    network.fit({ nodes: ids, animation: false })
    clampViewToGraphBounds()
  }

  const scheduleEnsureGraphInViewport = (durationMs = 700, whilePhysicsOnly = false) => {
    if (autoFitRafRef.current !== null) cancelAnimationFrame(autoFitRafRef.current)
    const start = performance.now()
    const loop = () => {
      ensureGraphInViewport()
      const keepRunning = whilePhysicsOnly ? physicsEnabledRef.current : true
      if (performance.now() - start < durationMs && keepRunning) {
        autoFitRafRef.current = requestAnimationFrame(loop)
      } else {
        autoFitRafRef.current = null
      }
    }
    autoFitRafRef.current = requestAnimationFrame(loop)
  }

  const scheduleClampView = (durationMs = 250) => {
    if (clampRafRef.current !== null) cancelAnimationFrame(clampRafRef.current)
    const start = performance.now()
    const loop = () => {
      clampViewToGraphBounds()
      if (performance.now() - start < durationMs) {
        clampRafRef.current = requestAnimationFrame(loop)
      } else {
        clampRafRef.current = null
      }
    }
    clampRafRef.current = requestAnimationFrame(loop)
  }

  const updateHoverDetailMode = (scale: number) => {
    const shouldShow = scale <= 0.42
    setShowHoverDetails((prev) => (prev === shouldShow ? prev : shouldShow))
  }

  const resetLayout = () => {
    nodePosRef.current = {}
    resetLayoutRef.current = true
    const network = networkRef.current
    if (network) {
      network.fit({ animation: { duration: 220, easingFunction: 'easeOutQuad' } })
      scheduleEnsureGraphInViewport(500, false)
    }
  }

  useEffect(() => {
    if (!containerRef.current || networkRef.current) return

    const nodes = new DataSet<VisNode>([])
    const edges = new DataSet<VisEdge>([])
    dataSetsRef.current = { nodes, edges }

    const options = {
      autoResize: true,
      nodes: { shape: 'dot', scaling: { min: 7, max: 18 } },
      edges: { width: 1.1, smooth: { enabled: true, type: 'continuous', roundness: 0.2 } },
      physics: { enabled: physicsEnabled },
      interaction: { hover: true, hideEdgesOnDrag: true, tooltipDelay: 100 },
    }

    const network = new Network(containerRef.current, { nodes, edges }, options)
    networkRef.current = network

    const onClick = (params: { nodes?: string[]; edges?: string[] }) => {
      if (Date.now() < suppressClickUntilRef.current) return
      const first = params.nodes && params.nodes[0]
      const currentData = dataRef.current
      const mode = interactionModeRef.current

      if (first) {
        if (mode === 'focus') {
          setFocusNodeId(first)
          scheduleEnsureGraphInViewport(450, false)
        } else {
          const key = `node:${first}`
          const node = currentData?.nodes.find(n => n.id === first)
          if (node) toggleSelection(key, [node.label])
          setActiveNodeIds(prev => {
            const next = new Set(prev)
            if (next.has(first)) next.delete(first)
            else next.add(first)
            return next
          })
        }
        scheduleClampView()
        return
      }

      const edgeId = params.edges && params.edges[0]
      if (edgeId && currentData) {
        if (mode === 'highlight') {
          const edge = currentData.edges.find(e => `${e.from_node}->${e.to_node}:${e.label}` === edgeId)
          if (edge) {
            const key = `edge:${edgeId}`
            const fromLabel = currentData.nodes.find(n => n.id === edge.from_node)?.label
            const toLabel = currentData.nodes.find(n => n.id === edge.to_node)?.label
            const terms = [edge.label]
            if (fromLabel) terms.push(fromLabel)
            if (toLabel) terms.push(toLabel)
            toggleSelection(key, terms)
            setActiveEdgeIds(prev => {
              const next = new Set(prev)
              if (next.has(edgeId)) next.delete(edgeId)
              else next.add(edgeId)
              return next
            })
            scheduleClampView()
            return
          }
        }
        return
      }

      if (mode === 'focus') {
        setFocusNodeId(null)
        network.unselectAll()
      }
      scheduleClampView()
    }
    const onDragStart = (params: { nodes?: string[] }) => {
      if (!params.nodes || params.nodes.length === 0) return
      const pos = network.getPositions(params.nodes)
      const next: Record<string, { x: number; y: number }> = {}
      for (const id of params.nodes) {
        const p = pos[id]
        if (p) next[id] = { x: p.x, y: p.y }
      }
      dragStartPosRef.current = next
    }

    const onDragEnd = (params: { nodes?: string[] }) => {
      if (params.nodes && params.nodes.length > 0) {
        const bounds = getVisibleCanvasBounds()
        const current = network.getPositions(params.nodes)
        for (const id of params.nodes) {
          const p = current[id]
          const start = dragStartPosRef.current[id]
          if (!p || !start || !bounds) continue
          const outside =
            p.x < bounds.minX || p.x > bounds.maxX ||
            p.y < bounds.minY || p.y > bounds.maxY
          if (outside) {
            network.moveNode(id, start.x, start.y)
            if (dataSetsRef.current) dataSetsRef.current.nodes.update({ id, x: start.x, y: start.y })
          }
        }
        dragStartPosRef.current = {}
      } else {
        scheduleClampView()
      }
      snapshotNodePositions()
      // Prevent drag gestures from triggering click-selection side effects.
      suppressClickUntilRef.current = Date.now() + 180
    }
    const onZoom = () => {
      updateHoverDetailMode(network.getScale())
      scheduleClampView()
    }
    const onDragging = (params: { nodes?: string[] }) => {
      if (!params.nodes || params.nodes.length === 0) {
        scheduleClampView()
      }
    }
    const onAnimationFinished = () => {
      scheduleClampView()
    }
    const onAfterDrawing = () => {
      if (physicsEnabledRef.current) {
        ensureGraphInViewport()
        clampViewToGraphBounds()
      }
    }

    network.on('click', onClick)
    network.on('dragStart', onDragStart)
    network.on('dragEnd', onDragEnd)
    network.on('dragging', onDragging)
    network.on('zoom', onZoom)
    network.on('animationFinished', onAnimationFinished)
    network.on('afterDrawing', onAfterDrawing)
    updateHoverDetailMode(network.getScale())

    return () => {
      snapshotNodePositions()
      network.off('afterDrawing', onAfterDrawing)
      network.off('animationFinished', onAnimationFinished)
      network.off('dragging', onDragging)
      network.off('zoom', onZoom)
      network.off('dragStart', onDragStart)
      network.off('dragEnd', onDragEnd)
      network.off('click', onClick)
      if (networkRef.current) networkRef.current.destroy()
      networkRef.current = null
      dataSetsRef.current = null
      if (clampRafRef.current !== null) {
        cancelAnimationFrame(clampRafRef.current)
        clampRafRef.current = null
      }
      if (autoFitRafRef.current !== null) {
        cancelAnimationFrame(autoFitRafRef.current)
        autoFitRafRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const network = networkRef.current
    if (!network) return
    if (!physicsEnabled) snapshotNodePositions()
    network.setOptions({ physics: { enabled: physicsEnabled } })
    if (!physicsEnabled) {
      if (autoFitRafRef.current !== null) {
        cancelAnimationFrame(autoFitRafRef.current)
        autoFitRafRef.current = null
      }
      network.redraw()
    } else {
      network.fit({ animation: { duration: 160, easingFunction: 'easeOutQuad' } })
      scheduleEnsureGraphInViewport(1200, true)
    }
  }, [physicsEnabled])

  useEffect(() => {
    const ds = dataSetsRef.current
    const network = networkRef.current
    if (!ds || !network) return

    if (!data || data.nodes.length === 0) {
      snapshotNodePositions()
      ds.nodes.clear()
      ds.edges.clear()
      return
    }

    snapshotNodePositions()

    ds.nodes.clear()
    ds.nodes.add(
      visible.nodes.map((n, idx) => {
        const saved = nodePosRef.current[n.id]
        const total = Math.max(1, visible.nodes.length)
        const angle = (idx / total) * Math.PI * 2
        const radius = 220 + Math.min(240, total * 2)
        const resetX = Math.cos(angle) * radius
        const resetY = Math.sin(angle) * radius
        const x = resetLayoutRef.current ? resetX : saved?.x
        const y = resetLayoutRef.current ? resetY : saved?.y
        const isActive = activeNodeIds.has(n.id)
        const baseColor = n.color
        const activeBackground = darkenHex(baseColor, 0.26)
        const activeBorder = darkenHex(baseColor, 0.45)
        return ({
          id: n.id,
          label: n.label,
          title: showHoverDetails ? `${n.label} (${n.type})` : undefined,
          color: isActive
            ? {
              background: activeBackground,
              border: activeBorder,
              highlight: { background: activeBackground, border: activeBorder },
            }
            : n.color,
          size: n.id === focusNodeId
            ? Math.max(12, Math.round(n.size * 0.58) + 4)
            : Math.max(8, Math.round(n.size * 0.58)),
          borderWidth: isActive ? 2.6 : 1.1,
          shadow: isActive
            ? { enabled: true, color: 'rgba(44,36,22,0.22)', size: 11, x: 0, y: 0 }
            : { enabled: false, color: 'rgba(0,0,0,0)', size: 0, x: 0, y: 0 },
          x,
          y,
          font: { color: '#2c2416', size: 11, face: 'Lora' },
        })
      })
    )

    ds.edges.clear()
    const labelById = new Map(data.nodes.map((n) => [n.id, n.label]))
    ds.edges.add(
      visible.edges.map(e => ({
        id: `${e.from_node}->${e.to_node}:${e.label}`,
        from: e.from_node,
        to: e.to_node,
        label: showEdgeLabels ? e.label : '',
        title: showHoverDetails
          ? `${labelById.get(e.from_node) ?? e.from_node} ${e.label} ${labelById.get(e.to_node) ?? e.to_node}`
          : undefined,
        width: activeEdgeIds.has(`${e.from_node}->${e.to_node}:${e.label}`) ? 2.6 : 1.1,
        font: { size: 8, color: '#4a3c2c', align: 'middle' },
        color: activeEdgeIds.has(`${e.from_node}->${e.to_node}:${e.label}`)
          ? { color: '#675640', highlight: '#4e402f' }
          : { color: '#b7aa95', highlight: '#2d5016' },
        arrows: 'to',
        smooth: { enabled: true, type: 'continuous', roundness: 0.2 },
      }))
    )

    resetLayoutRef.current = false
    network.redraw()
    scheduleClampView()
  }, [data, visible, focusNodeId, showEdgeLabels, physicsEnabled, showHoverDetails, activeNodeIds, activeEdgeIds])

  useEffect(() => {
    const network = networkRef.current
    if (!network || visible.nodes.length === 0) return
    const ids = visible.nodes.map(n => n.id)
    const viewKey = `${focusNodeId ?? 'all'}|${depth}|${ids.sort().join(',')}`
    if (viewKey === lastFittedKeyRef.current) return
    lastFittedKeyRef.current = viewKey
    network.fit({
      nodes: ids,
      animation: { duration: 180, easingFunction: 'easeOutQuad' },
    })
    scheduleEnsureGraphInViewport(500, false)
    scheduleClampView()
  }, [visible.nodes, focusNodeId, depth])

  useEffect(() => {
    if (Object.keys(selectionByKey).length === 0) return
    scheduleClampView()
  }, [selectionByKey])

  useEffect(() => {
    const network = networkRef.current
    const container = containerRef.current
    if (!network || !container) return

    const { x, y } = network.getViewPosition()
    const scale = network.getScale()
    const width = Math.max(1, Math.round(container.clientWidth))
    const height = Math.max(1, Math.round(container.clientHeight))

    network.setSize(`${width}px`, `${height}px`)
    network.redraw()
    network.moveTo({ position: { x, y }, scale, animation: false })
    scheduleEnsureGraphInViewport(280, false)
    scheduleClampView()
  }, [graphHeight, isFullscreen, isResizing, fullscreenControlsHeight])

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

  useEffect(() => {
    if (!isFullscreen) {
      setFullscreenControlsHeight(0)
      return
    }
    const panel = fullscreenControlsRef.current
    if (!panel) return
    const update = () => setFullscreenControlsHeight(Math.ceil(panel.getBoundingClientRect().height))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(panel)
    return () => ro.disconnect()
  }, [isFullscreen, focusNodeId, maxDepth, hasHighlights, availableNodeTypes.length, edgeTypes.length, showEdgeLabels, physicsEnabled])

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

  const fullscreenTopInset = isFullscreen ? Math.max(0, fullscreenControlsHeight + 10) : 0

  const focusNode = (nodeId: string) => {
    setFocusNodeId(nodeId)
    const network = networkRef.current
    if (!network) return
    network.selectNodes([nodeId])
    network.focus(nodeId, {
      scale: 1.2,
      animation: { duration: 240, easingFunction: 'easeOutQuad' },
    })
  }

  const controlCard: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
    background: '#f5f3ed',
    border: '1px solid var(--color-border)',
    borderRadius: '4px',
    padding: '0.45rem 0.55rem',
  }

  const pillBase: React.CSSProperties = {
    border: '1px solid var(--color-border)',
    borderRadius: '999px',
    padding: '0.1rem 0.5rem',
    fontSize: '0.72rem',
    cursor: 'pointer',
    background: 'white',
    color: 'var(--color-ink)',
  }

  const Controls = (
    <>
      {(focusNodeId && maxDepth > 1) && (
        <div style={controlCard}>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-light)' }}>depth</span>
          {[1, 2, 3].filter(d => d <= maxDepth).map(d => (
            <button
              key={`depth-${d}`}
              onClick={() => setDepth(d as 1 | 2 | 3)}
              style={{
                ...pillBase,
                background: depth === d ? 'var(--color-forest)' : 'white',
                color: depth === d ? 'white' : 'var(--color-ink)',
              }}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {focusNodeId && (
        <div style={controlCard}>
          <button
            onClick={() => {
              setFocusNodeId(null)
            }}
            style={pillBase}
          >
            clear focus
          </button>
        </div>
      )}

      {hasHighlights && (
        <div style={controlCard}>
          <button onClick={clearHighlights} style={pillBase}>clear highlights</button>
        </div>
      )}

      {availableNodeTypes.length > 1 && (
        <div style={{ ...controlCard, fontSize: '0.75rem' }}>
          {availableNodeTypes.map(({ color, label }) => {
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
                  background: active ? color : '#9ca3af', flexShrink: 0,
                }} />
                <span style={{
                  color: active ? 'var(--color-ink)' : 'var(--color-ink-light)',
                  userSelect: 'none',
                }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {edgeTypes.length > 1 && (
        <div style={{ ...controlCard, gap: '0.3rem' }}>
          {edgeTypes.slice(0, 20).map((t) => {
            const active = activeEdgeTypes.has(t)
            return (
              <button
                key={t}
                onClick={() => toggleEdgeType(t)}
                style={{
                  ...pillBase,
                  padding: '0.08rem 0.45rem',
                  fontSize: '0.68rem',
                  background: active ? '#eef4ea' : 'white',
                  color: active ? 'var(--color-forest)' : 'var(--color-ink-light)',
                }}
                title={active ? `hide ${t}` : `show ${t}`}
              >
                {t}
              </button>
            )
          })}
          <button
            onClick={() => setShowEdgeLabels((v) => !v)}
            style={{
              ...pillBase,
              padding: '0.08rem 0.45rem',
              fontSize: '0.68rem',
              background: showEdgeLabels ? '#eef4ea' : 'white',
              color: showEdgeLabels ? 'var(--color-forest)' : 'var(--color-ink-light)',
            }}
          >
            edge labels
          </button>
          <button
            onClick={resetLayout}
            style={{
              ...pillBase,
              padding: '0.08rem 0.45rem',
              fontSize: '0.68rem',
              background: 'white',
              color: 'var(--color-ink-light)',
            }}
          >
            reset layout
          </button>
          <button
            onClick={() => setPhysicsEnabled((v) => !v)}
            style={{
              ...pillBase,
              padding: '0.08rem 0.45rem',
              fontSize: '0.68rem',
              background: physicsEnabled ? '#eef4ea' : 'white',
              color: physicsEnabled ? 'var(--color-forest)' : 'var(--color-ink-light)',
            }}
          >
            physics
          </button>
        </div>
      )}
    </>
  )

  if (loading) {
    return (
      <div style={{
        height: '100%',
        minHeight: '160px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Loader style={{ color: 'var(--color-forest)' }} className="w-12 h-12 animate-spin mb-4" />
        <p style={{ color: 'var(--color-ink-light)' }}>building world topology...</p>
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div style={{
        height: '100%',
        minHeight: '160px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <h3 style={{
          fontSize: '1.25rem', fontWeight: 600,
          color: 'var(--color-ink)', fontFamily: "'Crimson Text', serif",
        }}>world topology map</h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            border: '1px solid var(--color-border)', borderRadius: '3px',
            padding: '0.2rem 0.4rem', background: '#f5f3ed',
          }}>
            <Search style={{ width: '0.8rem', height: '0.8rem', color: 'var(--color-ink-light)' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="find node"
              style={{ border: 'none', outline: 'none', fontSize: '0.75rem', width: '7rem', color: 'var(--color-ink)', background: 'transparent' }}
            />
          </div>
        </div>
      </div>

      {Controls}

      {filteredSearchNodes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {filteredSearchNodes.map(n => (
            <button
              key={n.id}
              onClick={() => focusNode(n.id)}
              style={{
                border: '1px solid var(--color-border)',
                background: '#f5f3ed',
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
          flex: 1,
          minHeight: 0,
          height: isFullscreen ? '100%' : undefined,
          background: '#f5f3ed',
          borderRadius: '2px',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
        {isFullscreen && (
          <div
            ref={fullscreenControlsRef}
            style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            zIndex: 11,
            maxWidth: 'min(58vw, 760px)',
            background: '#f5f3ed',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            padding: '0.45rem 0.55rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}>
            {Controls}
          </div>
        )}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'exit fullscreen' : 'fullscreen'}
          style={{
            position: 'absolute', top: '0.5rem', left: '0.5rem', zIndex: 12,
            background: 'rgba(245,243,237,0.95)', border: '1px solid var(--color-border)',
            borderRadius: '2px', padding: '0.25rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isFullscreen
            ? <Minimize2 style={{ width: '0.875rem', height: '0.875rem', color: 'var(--color-ink)' }} />
            : <Maximize2 style={{ width: '0.875rem', height: '0.875rem', color: 'var(--color-ink)' }} />
          }
        </button>
        <div style={{
          position: 'absolute',
          left: '0.5rem',
          bottom: '0.5rem',
          zIndex: 12,
          display: 'flex',
          gap: '0.2rem',
          background: 'rgba(245,243,237,0.96)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          padding: '0.2rem',
        }}>
          <button
            onClick={() => setInteractionMode('focus')}
            style={{
              ...pillBase,
              padding: '0.12rem 0.5rem',
              fontSize: '0.68rem',
              background: interactionMode === 'focus' ? '#eef4ea' : 'white',
              color: interactionMode === 'focus' ? 'var(--color-forest)' : 'var(--color-ink-light)',
            }}
            title="focus mode: click nodes to focus neighborhood"
          >
            focus
          </button>
          <button
            onClick={() => setInteractionMode('highlight')}
            style={{
              ...pillBase,
              padding: '0.12rem 0.5rem',
              fontSize: '0.68rem',
              background: interactionMode === 'highlight' ? '#eef4ea' : 'white',
              color: interactionMode === 'highlight' ? 'var(--color-forest)' : 'var(--color-ink-light)',
            }}
            title="highlight mode: click nodes/edges to toggle highlights"
          >
            highlight
          </button>
        </div>

        <div ref={containerRef} style={{
          width: '100%',
          height: isFullscreen ? `calc(100% - ${fullscreenTopInset}px)` : '100%',
          marginTop: isFullscreen ? `${fullscreenTopInset}px` : 0,
          minWidth: 0,
          overflow: 'hidden',
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
