import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader } from 'lucide-react'
import { api, Flag, GraphData } from '../api/client'
import FlagPanel from './FlagPanel'
import WorldGraph from './WorldGraph'

const DEBOUNCE_CHECK_MS = 2500
const DEBOUNCE_INGEST_MS = 6000
const TAIL_LINES = 4

function lastNLines(text: string, n: number): string {
  const lines = text.split('\n').filter(l => l.trim())
  return lines.slice(-n).join('\n')
}

export default function Dashboard() {
  const [text, setText] = useState('')
  const [chapter, setChapter] = useState(1)
  const [flags, setFlags] = useState<Flag[]>([])
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [checking, setChecking] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [ingestSummary, setIngestSummary] = useState<string | null>(null)

  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ingestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastIngestedLength = useRef(0)

  const refreshGraph = useCallback(async () => {
    try {
      const g = await api.getGraph()
      setGraphData(g)
    } catch {}
  }, [])

  const runCheck = useCallback(async (currentText: string) => {
    const tail = lastNLines(currentText, TAIL_LINES)
    if (!tail.trim() || tail.split(' ').length < 5) return
    setChecking(true)
    try {
      const present = await api.who(tail)
      if (present.length === 0) return
      const result = await api.check(tail, present, chapter)
      setFlags(result)
    } catch (e) {
      console.error(e)
    } finally {
      setChecking(false)
    }
  }, [chapter])

  const runIngest = useCallback(async (currentText: string) => {
    const newText = currentText.slice(lastIngestedLength.current)
    if (!newText.trim()) return
    setIngesting(true)
    try {
      const summary = await api.ingest(newText, chapter)
      lastIngestedLength.current = currentText.length
      setIngestSummary(`+${summary.entities} entities · +${summary.relationships} relationships`)
      await refreshGraph()
    } catch (e) {
      console.error(e)
    } finally {
      setIngesting(false)
    }
  }, [chapter, refreshGraph])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)

    if (checkTimer.current) clearTimeout(checkTimer.current)
    checkTimer.current = setTimeout(() => runCheck(val), DEBOUNCE_CHECK_MS)

    if (ingestTimer.current) clearTimeout(ingestTimer.current)
    ingestTimer.current = setTimeout(() => runIngest(val), DEBOUNCE_INGEST_MS)
  }

  const handleManualIngest = async () => {
    if (ingestTimer.current) clearTimeout(ingestTimer.current)
    await runIngest(text)
  }

  useEffect(() => { refreshGraph() }, [])

  const HEADER_H = 81

  return (
    <div style={{ display: 'flex', height: `calc(100vh - ${HEADER_H}px)`, overflow: 'hidden' }}>

      {/* ── Left: Editor ── */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              fontFamily: "'Crimson Text', serif",
              fontSize: '1.1rem',
              fontWeight: 600,
              color: 'var(--color-ink)',
            }}>Manuscript</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-light)' }}>ch.</span>
              <input
                type="number"
                min={1}
                value={chapter}
                onChange={e => setChapter(Number(e.target.value))}
                style={{
                  width: '2.5rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: '2px',
                  padding: '0.2rem 0.35rem',
                  fontSize: '0.8rem',
                  color: 'var(--color-ink)',
                  background: 'transparent',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            onClick={handleManualIngest}
            disabled={ingesting || !text.trim()}
            style={{
              padding: '0.35rem 1rem',
              background: ingesting || !text.trim() ? 'var(--color-border)' : 'var(--color-forest)',
              color: ingesting || !text.trim() ? 'var(--color-ink-light)' : 'white',
              border: 'none',
              borderRadius: '2px',
              cursor: ingesting || !text.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            {ingesting && <Loader style={{ width: '0.875rem', height: '0.875rem', animation: 'spin 1s linear infinite' }} />}
            {ingesting ? 'Ingesting...' : 'Ingest'}
          </button>
        </div>

        <textarea
          value={text}
          onChange={handleChange}
          placeholder="Write your story here. Consistency checks run automatically as you write."
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

        <div style={{
          padding: '0.6rem 1.5rem',
          borderTop: '1px solid var(--color-border)',
          fontSize: '0.75rem',
          color: 'var(--color-ink-light)',
          fontStyle: 'italic',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          minHeight: '2.25rem',
        }}>
          {checking && <><Loader style={{ width: '0.75rem', height: '0.75rem', animation: 'spin 1s linear infinite', color: 'var(--color-forest)' }} /> checking consistency…</>}
          {ingesting && !checking && <><Loader style={{ width: '0.75rem', height: '0.75rem', animation: 'spin 1s linear infinite', color: 'var(--color-forest)' }} /> ingesting…</>}
          {!checking && !ingesting && ingestSummary && <span style={{ color: 'var(--color-forest)' }}>{ingestSummary}</span>}
        </div>
      </div>

      {/* ── Right: Visualizations ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-parchment)' }}>
        <div style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-paper)',
          padding: '1.25rem 1.5rem',
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
