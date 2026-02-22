import axios from 'axios'

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000'

const client = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } })

export const api = {
  async startIngest(text: string, chapter: number) {
    const r = await client.post('/ingest', { text, chapter })
    return r.data as { job_id: string; status: 'queued' | 'running' | 'completed' | 'failed' }
  },

  async getIngestStatus(jobId: string) {
    const r = await client.get(`/ingest/${jobId}`)
    return r.data as IngestJob
  },

  async who(text: string): Promise<string[]> {
    const r = await client.post('/who', { text })
    return r.data.present
  },

  async check(text: string, characters_present: string[], chapter: number) {
    const r = await client.post('/check', { text, characters_present, chapter })
    return r.data.flags as Flag[]
  },

  async getGraph() {
    const r = await client.get('/graph')
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
