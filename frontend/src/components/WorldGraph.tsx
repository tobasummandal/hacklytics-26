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
        color: node.color || '#6b7280',
        size: node.size || 10,
        font: {
          color: '#ffffff',
          size: 12
        }
      }))
    )

    const edges = new DataSet(
      data.edges.map(edge => ({
        from: edge.from_node,
        to: edge.to_node,
        value: edge.weight,
        color: {
          color: '#475569',
          highlight: '#9333ea'
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
        <Loader className="w-12 h-12 text-purple-500 animate-spin mb-4" />
        <p className="text-slate-400">Building world topology...</p>
      </div>
    )
  }

  if (!data || (data.nodes.length === 0 && data.edges.length === 0)) {
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
        <div className="flex space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-magic"></div>
            <span>Magic</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-politics"></div>
            <span>Politics</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-technology"></div>
            <span>Technology</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-economy"></div>
            <span>Economy</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-character"></div>
            <span>Character</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full h-[600px] bg-slate-950 rounded-lg border border-slate-700"
      />

      <div className="text-sm text-slate-400 text-center">
        Nodes represent rules and characters. Edges show semantic proximity.
      </div>
    </div>
  )
}
