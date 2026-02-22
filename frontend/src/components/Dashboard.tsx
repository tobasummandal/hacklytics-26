import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader } from 'lucide-react'
import { api, Flag, GraphData, IngestProgress } from '../api/client'
import FlagPanel from './FlagPanel'
import WorldGraph from './WorldGraph'

const CHAPTER = 1

const EDITOR_STYLE = {
  fontFamily: "'Lora', Georgia, serif",
  fontSize: '0.875rem',
  lineHeight: '1.8',
  padding: '1.25rem 1.5rem',
} as const

function HighlightTextarea({ value, onChange, highlights, placeholder }: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  highlights: string[]
  placeholder?: string
}) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const getHTML = () => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    if (highlights.length === 0) return esc(value)

    // find all match ranges in original text (case-insensitive)
    const ranges: { start: number; end: number }[] = []
    for (const h of highlights) {
      if (!h.trim()) continue
      let idx = 0
      while (true) {
        const found = value.toLowerCase().indexOf(h.toLowerCase(), idx)
        if (found === -1) break
        ranges.push({ start: found, end: found + h.length })
        idx = found + 1
      }
    }

    // sort + merge overlapping ranges
    ranges.sort((a, b) => a.start - b.start)
    const merged: { start: number; end: number }[] = []
    for (const r of ranges) {
      const last = merged[merged.length - 1]
      if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
      else merged.push({ ...r })
    }

    // build html
    let html = ''
    let pos = 0
    for (const { start, end } of merged) {
      html += esc(value.slice(pos, start))
      html += `<mark style="background:rgba(196,90,90,0.3);border-radius:2px;color:inherit;">${esc(value.slice(start, end))}</mark>`
      pos = end
    }
    html += esc(value.slice(pos))
    return html
  }

  const syncScroll = () => {
    if (backdropRef.current && textareaRef.current)
      backdropRef.current.scrollTop = textareaRef.current.scrollTop
  }

  return (
    <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
      {/* highlighted backdrop */}
      <div
        ref={backdropRef}
        aria-hidden
        style={{
          ...EDITOR_STYLE,
          position: 'absolute', inset: 0,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          overflowWrap: 'break-word', overflow: 'hidden',
          color: 'transparent', background: 'var(--color-paper)',
          pointerEvents: 'none', boxSizing: 'border-box',
        }}
        dangerouslySetInnerHTML={{ __html: getHTML() + '\n' }}
      />
      {/* actual textarea — transparent so backdrop shows through */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onScroll={syncScroll}
        placeholder={placeholder}
        style={{
          ...EDITOR_STYLE,
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          resize: 'none', border: 'none', outline: 'none',
          background: 'transparent',
          color: 'var(--color-ink)',
          boxSizing: 'border-box',
          caretColor: 'var(--color-ink)',
        }}
      />
    </div>
  )
}

export default function Dashboard() {
  const [storyText, setStoryText] = useState('')
  const [newText, setNewText] = useState('')
  const [flags, setFlags] = useState<Flag[]>([])
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [checking, setChecking] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [ingestSummary, setIngestSummary] = useState<string | null>(null)
  const [ingestProgress, setIngestProgress] = useState<IngestProgress | null>(null)
  const [ingestError, setIngestError] = useState<string | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)

  const lastIngestedLength = useRef(0)

  const highlights = flags.flatMap(f => f.conflicting_excerpts ?? [])

  const refreshGraph = useCallback(async () => {
    try { setGraphData(await api.getGraph()) } catch {}
  }, [])

  const runCheck = useCallback(async (text: string) => {
    if (!text.trim() || text.trim().split(/\s+/).length < 5) return
    setChecking(true)
    setFlags([])
    setCheckError(null)
    try {
      const present = await api.who(text)
      if (present.length === 0) {
        setCheckError('No known characters detected in this passage yet.')
        setChecking(false)
        return
      }
      const result = await api.check(text, present, CHAPTER)
      setFlags(result)
    } catch (e: any) {
      console.error('[check]', e)
      const detail = e?.response?.data?.detail
      if (typeof detail === 'string') {
        setCheckError(detail)
      } else if (detail?.message) {
        const retry = detail?.retry_after_seconds
        setCheckError(
          retry
            ? `${detail.message} Retry in ~${Math.ceil(Number(retry))}s.`
            : detail.message
        )
      } else {
        setCheckError('Check failed. Verify Gemini API key, quota, and backend logs.')
      }
    } finally {
      setChecking(false)
    }
  }, [])

  const handleIngest = async () => {
    const slice = storyText.slice(lastIngestedLength.current)
    if (!slice.trim()) return
    setIngesting(true)
    setIngestError(null)
    setIngestSummary(null)
    setIngestProgress({ percent: 0, phase: 'queued', message: 'Queued for ingestion' })
    let terminalState: 'completed' | 'failed' | null = null
    try {
      const started = await api.startIngest(slice, CHAPTER)
      let complete = false
      while (!complete) {
        const status = await api.getIngestStatus(started.job_id)
        if (status.progress) setIngestProgress(status.progress)
        if (status.status === 'completed' && status.result) {
          const summary = status.result
          lastIngestedLength.current = storyText.length
          setIngestSummary(`+${summary.entities} entities · +${summary.relationships} rels`)
          await refreshGraph()
          terminalState = 'completed'
          complete = true
        } else if (status.status === 'failed') {
          setIngestError(status.error?.message || 'Ingest failed. Check backend logs for details.')
          terminalState = 'failed'
          complete = true
        } else {
          await new Promise((resolve) => setTimeout(resolve, 700))
        }
      }
    } catch (e) {
      console.error('[ingest]', e)
      setIngestError('Unable to start ingest job. Check backend connectivity.')
    } finally {
      setIngesting(false)
      if (terminalState) setIngestProgress(null)
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
      setIngestProgress(null)
      setIngestError(null)
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
    setFlags([])
    if (!val.trim()) {
      setCheckError(null)
    }
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
            <button onClick={handleReset} disabled={resetting} style={{
              ...btnBase,
              background: resetting ? 'var(--color-border)' : '#c45a5a',
              color: resetting ? 'var(--color-ink-light)' : 'white',
              cursor: resetting ? 'not-allowed' : 'pointer',
            }}>
              {resetting && <Loader style={{ width: '0.875rem', height: '0.875rem', animation: 'spin 1s linear infinite' }} />}
              {resetting ? 'resetting…' : 'reset'}
            </button>
            <button onClick={handleIngest} disabled={ingesting || !storyText.trim()} style={{
              ...btnBase,
              background: ingesting || !storyText.trim() ? 'var(--color-border)' : 'var(--color-forest)',
              color: ingesting || !storyText.trim() ? 'var(--color-ink-light)' : 'white',
              cursor: ingesting || !storyText.trim() ? 'not-allowed' : 'pointer',
            }}>
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
            ...EDITOR_STYLE,
            color: 'var(--color-ink)', background: 'var(--color-paper)', minHeight: 0,
          }}
        />

        {/* Status bar */}
        <div style={{
          padding: '0.55rem 1.5rem',
          borderTop: '1px solid var(--color-border)',
          fontSize: '0.75rem',
          color: 'var(--color-ink-light)',
          flexShrink: 0,
          minHeight: '2.8rem',
        }}>
          {(ingesting || ingestProgress) && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.3rem',
                color: 'var(--color-ink-light)',
              }}>
                <span>
                  {ingestProgress?.message || 'Ingesting manuscript…'}
                  {ingestProgress?.chunk_index && ingestProgress?.total_chunks
                    ? ` (${ingestProgress.chunk_index}/${ingestProgress.total_chunks})`
                    : ''}
                </span>
                <span>{Math.max(0, Math.min(100, Math.round(ingestProgress?.percent || 0)))}%</span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: 'rgba(107,114,128,0.2)',
                borderRadius: '999px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.max(0, Math.min(100, ingestProgress?.percent || 0))}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #2d6a1f 0%, #4a7c2a 100%)',
                  transition: 'width 0.35s ease',
                }} />
              </div>
              {ingestProgress?.totals && (
                <div style={{ marginTop: '0.3rem', fontStyle: 'italic' }}>
                  entities {ingestProgress.totals.entities} · rels {ingestProgress.totals.relationships}
                </div>
              )}
            </div>
          )}
          {!ingesting && ingestSummary && (
            <span style={{ color: 'var(--color-forest)', fontStyle: 'italic' }}>{ingestSummary}</span>
          )}
          {!ingesting && ingestError && (
            <span style={{ color: '#9a3412' }}>{ingestError}</span>
          )}
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

        {/* New writing — highlighted textarea */}
        <HighlightTextarea
          value={newText}
          onChange={handleNewTextChange}
          highlights={highlights}
          placeholder="Write your new paragraph here. Hit 'check' to run consistency analysis."
        />
        {checkError && (
          <div style={{
            padding: '0.5rem 1.5rem',
            borderTop: '1px solid var(--color-border)',
            fontSize: '0.8rem',
            color: '#9a3412',
            background: 'rgba(154,52,18,0.06)',
          }}>
            {checkError}
          </div>
        )}
      </div>

      {/* ── Right: Graph + Flags ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-parchment)' }}>
        <div style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-paper)', padding: '1rem 1.5rem',
          flexShrink: 0,
        }}>
          <WorldGraph data={graphData} loading={false} />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '1rem 1.5rem' }}>
          <FlagPanel flags={flags} checking={checking} />
        </div>
      </div>
    </div>
  )
}
