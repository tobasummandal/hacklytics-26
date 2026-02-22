import { lazy, Suspense, useMemo, useCallback } from 'react'
import { Loader, Network as NetworkIcon } from 'lucide-react'
import { GraphData } from '../types'

const ExcalidrawLazy = lazy(() =>
  import('@excalidraw/excalidraw').then(m => ({ default: m.Excalidraw }))
)

interface WorldGraphProps {
  data: GraphData | null
  loading: boolean
}

const SYSTEM_COLORS: Record<string, { bg: string; stroke: string; text: string }> = {
  magic:      { bg: '#d0bfff', stroke: '#8b5cf6', text: '#4c1d95' },
  politics:   { bg: '#ffc9c9', stroke: '#ef4444', text: '#7f1d1d' },
  technology: { bg: '#a5d8ff', stroke: '#4a9eed', text: '#1e3a5f' },
  economy:    { bg: '#fff3bf', stroke: '#f59e0b', text: '#78350f' },
  culture:    { bg: '#b2f2bb', stroke: '#22c55e', text: '#14532d' },
  other:      { bg: '#e9ecef', stroke: '#6b7280', text: '#1f2937' },
}

function buildElements(data: GraphData): any[] {
  const n = data.nodes.length
  if (n === 0) return []

  const elements: any[] = []
  const W = 160, H = 56
  const CX = 450, CY = 380
  const radius = Math.min(300, Math.max(160, n * 42))
  const centerMap = new Map<string, { cx: number; cy: number }>()

  data.nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    const cx = CX + radius * Math.cos(angle)
    const cy = CY + radius * Math.sin(angle)
    centerMap.set(node.id, { cx, cy })

    const c = SYSTEM_COLORS[node.system ?? 'other'] ?? SYSTEM_COLORS.other

    elements.push({
      type: 'rectangle',
      id: `n-${node.id}`,
      x: cx - W / 2,
      y: cy - H / 2,
      width: W,
      height: H,
      angle: 0,
      strokeColor: c.stroke,
      backgroundColor: c.bg,
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      roundness: { type: 3 },
      boundElements: [{ type: 'text', id: `t-${node.id}` }],
      seed: i * 997,
      version: 1,
      versionNonce: 0,
      isDeleted: false,
      groupIds: [],
    })

    elements.push({
      type: 'text',
      id: `t-${node.id}`,
      x: cx - W / 2,
      y: cy - H / 2,
      width: W,
      height: H,
      angle: 0,
      strokeColor: c.text,
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      text: node.label,
      fontSize: 14,
      fontFamily: 1,
      textAlign: 'center',
      verticalAlign: 'middle',
      containerId: `n-${node.id}`,
      lineHeight: 1.25,
      seed: i * 997 + 1,
      version: 1,
      versionNonce: 0,
      isDeleted: false,
      groupIds: [],
    })
  })

  // edges pushed to front of array so they render behind nodes
  const edgeElements: any[] = []
  data.edges.forEach((edge, i) => {
    const from = centerMap.get(edge.from_node)
    const to = centerMap.get(edge.to_node)
    if (!from || !to || edge.from_node === edge.to_node) return

    const dx = to.cx - from.cx
    const dy = to.cy - from.cy

    edgeElements.push({
      type: 'arrow',
      id: `e-${i}`,
      x: from.cx,
      y: from.cy,
      width: dx,
      height: dy,
      angle: 0,
      strokeColor: '#94a3b8',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 60,
      points: [[0, 0], [dx, dy]],
      startBinding: { elementId: `n-${edge.from_node}`, focus: 0, gap: 8 },
      endBinding: { elementId: `n-${edge.to_node}`, focus: 0, gap: 8 },
      startArrowhead: null,
      endArrowhead: 'arrow',
      seed: i * 503,
      version: 1,
      versionNonce: 0,
      isDeleted: false,
      groupIds: [],
    })
  })

  return [...edgeElements, ...elements]
}

export default function WorldGraph({ data, loading }: WorldGraphProps) {
  const elements = useMemo(() => (data ? buildElements(data) : []), [data])

  const handleAPI = useCallback((api: any) => {
    if (api) setTimeout(() => api.scrollToContent(undefined, { animate: false }), 50)
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader className="w-12 h-12 text-purple-500 animate-spin mb-4" />
        <p className="text-slate-400">Building world topology...</p>
      </div>
    )
  }

  if (!data || elements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <NetworkIcon className="w-12 h-12 text-slate-600 mb-4" />
        <p className="text-slate-400">No world data available yet.</p>
        <p className="text-sm text-slate-500 mt-2">Upload a manuscript to visualize your world.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">World Topology Map</h3>
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(SYSTEM_COLORS).map(([name, c]) => (
            <div key={name} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: c.bg, borderColor: c.stroke }} />
              <span className="capitalize text-slate-500">{name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full h-[600px] rounded-lg overflow-hidden border border-slate-200">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full bg-slate-50">
            <Loader className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        }>
          <ExcalidrawLazy
            key={`graph-${data.nodes.length}-${data.edges.length}`}
            initialData={{ elements, appState: { viewBackgroundColor: '#fafaf9' } }}
            excalidrawAPI={handleAPI}
            viewModeEnabled={true}
          />
        </Suspense>
      </div>
    </div>
  )
}
