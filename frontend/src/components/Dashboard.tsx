import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader } from 'lucide-react'
import { api, Flag, GraphData } from '../api/client'
import FlagPanel from './FlagPanel'
import WorldGraph from './WorldGraph'

const CHAPTER = 1

export default function Dashboard() {
  const [storyText, setStoryText] = useState('')
  const [newText, setNewText] = useState('')
  const [flags, setFlags] = useState<Flag[]>([])
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [checking, setChecking] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [ingestSummary, setIngestSummary] = useState<string | null>(null)

  const lastIngestedLength = useRef(0)

  const refreshGraph = useCallback(async () => {
    try { setGraphData(await api.getGraph()) } catch {}
  }, [])

  const runCheck = useCallback(async (text: string) => {
    if (!text.trim() || text.trim().split(/\s+/).length < 5) return
    setChecking(true)
    setFlags([])
    try {
      const present = await api.who(text)
      if (present.length === 0) { setChecking(false); return }
      const result = await api.check(text, present, CHAPTER)
      setFlags(result)
    } catch (e) {
      console.error('[check]', e)
    } finally {
      setChecking(false)
    }
  }, [])

  const handleIngest = async () => {
    const slice = storyText.slice(lastIngestedLength.current)
    if (!slice.trim()) return
    setIngesting(true)
    try {
      const summary = await api.ingest(slice, CHAPTER)
      lastIngestedLength.current = storyText.length
      setIngestSummary(`+${summary.entities} entities · +${summary.relationships} rels · +${summary.embedding_chunks} chunks`)
      await refreshGraph()
    } catch (e) {
      console.error('[ingest]', e)
    } finally {
      setIngesting(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await api.reset()
      setStoryText('')
      setNewText('')
      setFlags([])
      setIngestSummary(null)
      lastIngestedLength.current = 0
      setGraphData(null)
    } catch (e) {
      console.error('[reset]', e)
    } finally {
      setResetting(false)
    }
  }

  const handleNewTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setNewText(val)
    if (!val.trim()) setFlags([])
  }

  useEffect(() => { refreshGraph() }, [])

  const HEADER_H = 81

  const btnBase: React.CSSProperties = {
    padding: '0.35rem 1rem',
    border: 'none', borderRadius: '2px',
    fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.03em',
    display: 'flex', alignItems: 'center', gap: '0.4rem',
  }

  return (
    <div style={{ display: 'flex', height: `calc(100vh - ${HEADER_H}px)`, overflow: 'hidden' }}>

      {/* ── Left: Editor ── */}
      <div style={{
        width: '42%',
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-paper)', overflow: 'hidden',
      }}>

        {/* Manuscript header */}
        <div style={{
          padding: '1rem 1.5rem 0.75rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: "'Crimson Text', serif", fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-ink)' }}>
            manuscript
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleReset}
              disabled={resetting}
              style={{
                ...btnBase,
                background: resetting ? 'var(--color-border)' : '#c45a5a',
                color: resetting ? 'var(--color-ink-light)' : 'white',
                cursor: resetting ? 'not-allowed' : 'pointer',
              }}
            >
              {resetting && <Loader style={{ width: '0.875rem', height: '0.875rem', animation: 'spin 1s linear infinite' }} />}
              {resetting ? 'resetting…' : 'reset'}
            </button>
            <button
              onClick={handleIngest}
              disabled={ingesting || !storyText.trim()}
              style={{
                ...btnBase,
                background: ingesting || !storyText.trim() ? 'var(--color-border)' : 'var(--color-forest)',
                color: ingesting || !storyText.trim() ? 'var(--color-ink-light)' : 'white',
                cursor: ingesting || !storyText.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {ingesting && <Loader style={{ width: '0.875rem', height: '0.875rem', animation: 'spin 1s linear infinite' }} />}
              {ingesting ? 'ingesting…' : 'ingest'}
            </button>
          </div>
        </div>

        {/* Story textarea */}
        <textarea
          value={storyText}
          onChange={e => setStoryText(e.target.value)}
          placeholder="Paste your existing story here. Hit 'ingest' to build the knowledge graph."
          style={{
            flex: 2, resize: 'none', border: 'none', outline: 'none',
            padding: '1.25rem 1.5rem',
            fontFamily: "'Lora', Georgia, serif",
            fontSize: '0.875rem', lineHeight: '1.8',
            color: 'var(--color-ink)', background: 'var(--color-paper)', minHeight: 0,
          }}
        />

        {/* Status bar */}
        <div style={{
          padding: '0.4rem 1.5rem',
          borderTop: '1px solid var(--color-border)',
          fontSize: '0.75rem', color: 'var(--color-ink-light)',
          fontStyle: 'italic', flexShrink: 0,
          minHeight: '1.75rem', display: 'flex', alignItems: 'center',
        }}>
          {ingesting
            ? <><Loader style={{ width: '0.7rem', height: '0.7rem', animation: 'spin 1s linear infinite', color: 'var(--color-forest)', marginRight: '0.4rem' }} />ingesting…</>
            : ingestSummary && <span style={{ color: 'var(--color-forest)' }}>{ingestSummary}</span>
          }
        </div>

        {/* New writing header */}
        <div style={{
          borderTop: '2px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
          padding: '1rem 1.5rem 0.75rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--color-paper)', flexShrink: 0,
        }}>
          <span style={{ fontFamily: "'Crimson Text', serif", fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-ink)' }}>
            new writing
          </span>
          <button
            onClick={() => runCheck(newText)}
            disabled={checking || !newText.trim()}
            style={{
              ...btnBase,
              background: checking || !newText.trim() ? 'var(--color-border)' : '#2d6a1f',
              color: checking || !newText.trim() ? 'var(--color-ink-light)' : 'white',
              cursor: checking || !newText.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {checking && <Loader style={{ width: '0.875rem', height: '0.875rem', animation: 'spin 1s linear infinite' }} />}
            {checking ? 'checking…' : 'check'}
          </button>
        </div>

        {/* New writing textarea */}
        <textarea
          value={newText}
          onChange={handleNewTextChange}
          placeholder="Write your new paragraph here. Hit 'check' to run consistency analysis."
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none',
            padding: '1.25rem 1.5rem',
            fontFamily: "'Lora', Georgia, serif",
            fontSize: '0.875rem', lineHeight: '1.8',
            color: 'var(--color-ink)', background: 'var(--color-paper)', minHeight: 0,
          }}
        />
      </div>

      {/* ── Right: Graph + Flags ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-parchment)' }}>
        <div style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-paper)', padding: '1.25rem 1.5rem',
        }}>
          <WorldGraph data={graphData} loading={false} />
        </div>
        <div style={{ padding: '1.25rem 1.5rem' }}>
          <FlagPanel flags={flags} checking={checking} />
        </div>
      </div>
    </div>
  )
}
