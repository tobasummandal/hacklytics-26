import { useState, useEffect, useRef } from 'react'
import { Loader, Upload } from 'lucide-react'
import { World, InconsistencyReport, LoopholeReport, GraphData } from '../types'
import { api } from '../api/client'
import InconsistencyPanel from './InconsistencyPanel'
import LoopholePanel from './LoopholePanel'
import WorldGraph from './WorldGraph'

interface DashboardProps {
  world: World
  wsMessage?: any
}

export default function Dashboard({ world, wsMessage }: DashboardProps) {
  const [text, setText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [inconsistencies, setInconsistencies] = useState<InconsistencyReport[]>([])
  const [loopholes, setLoopholes] = useState<LoopholeReport[]>([])
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [incData, loopData, graph] = await Promise.all([
        api.getInconsistencies(world.id),
        api.getLoopholes(world.id),
        api.getWorldGraph(world.id),
      ])
      setInconsistencies(incData)
      setLoopholes(loopData)
      setGraphData(graph)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (wsMessage?.world_id === world.id && wsMessage?.type === 'inconsistencies_detected') {
      setAnalyzing(false)
      setAnalyzed(true)
      loadData()
    }
    if (wsMessage?.world_id === world.id && wsMessage?.type === 'error') {
      setAnalyzing(false)
    }
  }, [wsMessage])

  const submit = async (file: File) => {
    setAnalyzing(true)
    setAnalyzed(false)
    try {
      await api.uploadManuscript(world.id, file)
      // fallback reload if WS doesn't fire
      setTimeout(() => {
        setAnalyzing(false)
        setAnalyzed(true)
        loadData()
      }, 40000)
    } catch (e) {
      console.error(e)
      setAnalyzing(false)
    }
  }

  const handleAnalyze = () => {
    if (!text.trim()) return
    const blob = new Blob([text], { type: 'text/plain' })
    submit(new File([blob], 'manuscript.txt', { type: 'text/plain' }))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) submit(file)
  }

  const HEADER_H = 81

  return (
    <div style={{ display: 'flex', height: `calc(100vh - ${HEADER_H}px)`, overflow: 'hidden' }}>

      {/* ── Left: Text Editor ── */}
      <div style={{
        width: '40%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-paper)',
      }}>
        <div style={{
          padding: '1.25rem 1.5rem 0.75rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: "'Crimson Text', serif",
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'var(--color-ink)',
          }}>Manuscript</span>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: 'var(--color-ink-light)',
              }}
            >
              <Upload style={{ width: '0.875rem', height: '0.875rem' }} />
              Upload File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.docx"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            <button
              onClick={handleAnalyze}
              disabled={analyzing || !text.trim()}
              style={{
                padding: '0.35rem 1rem',
                background: analyzing || !text.trim() ? 'var(--color-border)' : 'var(--color-forest)',
                color: analyzing || !text.trim() ? 'var(--color-ink-light)' : 'white',
                border: 'none',
                borderRadius: '2px',
                cursor: analyzing || !text.trim() ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                letterSpacing: '0.03em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {analyzing && <Loader style={{ width: '0.875rem', height: '0.875rem', animation: 'spin 1s linear infinite' }} />}
              {analyzing ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste or type your manuscript here..."
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            padding: '1.25rem 1.5rem',
            fontFamily: "'Lora', Georgia, serif",
            fontSize: '0.9rem',
            lineHeight: '1.8',
            color: 'var(--color-ink)',
            background: 'var(--color-paper)',
          }}
        />

        {analyzed && (
          <div style={{
            padding: '0.75rem 1.5rem',
            borderTop: '1px solid var(--color-border)',
            fontSize: '0.8rem',
            color: 'var(--color-forest)',
            fontStyle: 'italic',
          }}>
            Analysis complete · {inconsistencies.length} inconsistenc{inconsistencies.length !== 1 ? 'ies' : 'y'} · {loopholes.length} loophole{loopholes.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── Right: Visualizations ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-parchment)' }}>

        <div style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-paper)',
          padding: '1.25rem 1.5rem',
        }}>
          <WorldGraph data={graphData} loading={loading} />
        </div>

        <div style={{
          borderBottom: '1px solid var(--color-border)',
          padding: '1.25rem 1.5rem',
        }}>
          <InconsistencyPanel inconsistencies={inconsistencies} loading={loading} />
        </div>

        <div style={{ padding: '1.25rem 1.5rem' }}>
          <LoopholePanel loopholes={loopholes} loading={loading} />
        </div>

      </div>
    </div>
  )
}
