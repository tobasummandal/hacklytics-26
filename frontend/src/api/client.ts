import axios from 'axios'

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000'
const API_BASE = API_URL.replace(/\/+$/, '')

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const cfg = error?.config as any
    const status = error?.response?.status
    const isTransient = !status || status >= 500
    if (cfg && !cfg.__retried && isTransient) {
      cfg.__retried = true
      return client(cfg)
    }
    return Promise.reject(error)
  }
)

export const api = {
  async startIngest(text: string, chapter: number) {
    const r = await client.post('/ingest', { text, chapter })
    return r.data as { job_id: string; status: 'queued' | 'running' | 'completed' | 'failed' }
  },

  async getIngestStatus(jobId: string) {
    const r = await client.get(`/ingest/${jobId}`)
    return r.data as IngestJob
  },

  ingestEventStream(
    jobId: string,
    handlers: {
      onProgress: (job: IngestJob) => void
      onDone: () => void
      onError: (err: Event | string) => void
    }
  ) {
    const es = new EventSource(`${API_BASE}/ingest/${jobId}/events`)
    es.addEventListener('progress', (evt: MessageEvent) => {
      try {
        handlers.onProgress(JSON.parse(evt.data) as IngestJob)
      } catch (e) {
        handlers.onError(String(e))
      }
    })
    es.addEventListener('done', () => handlers.onDone())
    es.onerror = (evt) => handlers.onError(evt)
    return () => es.close()
  },

  async who(text: string): Promise<string[]> {
    const r = await client.post('/who', { text })
    return r.data.present
  },

  async check(text: string, characters_present: string[], chapter: number) {
    const r = await client.post('/check', { text, characters_present, chapter })
    return r.data.flags as Flag[]
  },

  async checkPassage(text: string, chapter: number, signal?: AbortSignal) {
    const r = await client.post('/check-passage', { text, chapter }, { signal })
    return r.data as { present: string[]; flags: Flag[] }
  },

  async getGraph(params?: { types?: string[]; q?: string; limit_nodes?: number; limit_edges?: number }) {
    const query = {
      ...(params?.types?.length ? { types: params.types.join(',') } : {}),
      ...(params?.q ? { q: params.q } : {}),
      ...(params?.limit_nodes ? { limit_nodes: params.limit_nodes } : {}),
      ...(params?.limit_edges ? { limit_edges: params.limit_edges } : {}),
    }
    const r = await client.get('/graph', { params: query })
    return r.data as GraphData
  },

  async reset() {
    await client.delete('/reset')
  },
}

export interface Flag {
  character: string
  issue: string
  severity: 'high' | 'medium' | 'low'
  evidence: string
  suggestion: string
  conflicting_excerpts: string[]
}

export interface GraphNode {
  id: string
  label: string
  type: string
  color: string
  size: number
}

export interface GraphEdge {
  from_node: string
  to_node: string
  label: string
  weight: number
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  meta?: {
    total_nodes: number
    total_edges: number
    returned_nodes: number
    returned_edges: number
  }
}

export interface IngestTotals {
  entities: number
  attributes: number
  relationships: number
  embedding_chunks: number
}

export interface IngestProgress {
  percent: number
  phase: string
  message: string
  chunk_index?: number
  total_chunks?: number
  totals?: IngestTotals
}

export interface IngestJob {
  job_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  progress?: IngestProgress
  result?: IngestTotals
  error?: { code?: string; message?: string; retry_after_seconds?: number }
}

export default client
