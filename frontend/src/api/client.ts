import axios from 'axios'
import { World, InconsistencyReport, LoopholeReport, CharacterProfile, GraphData } from '../types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const api = {
  async createWorld(name: string, description?: string): Promise<World> {
    const response = await client.post('/worlds', { name, description })
    return response.data
  },

  async getWorld(worldId: string): Promise<World> {
    const response = await client.get(`/worlds/${worldId}`)
    return response.data
  },

  async uploadManuscript(worldId: string, file: File): Promise<void> {
    const formData = new FormData()
    formData.append('file', file)

    await client.post(`/worlds/${worldId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  async getInconsistencies(worldId: string): Promise<InconsistencyReport[]> {
    const response = await client.get(`/worlds/${worldId}/inconsistencies`)
    return response.data
  },

  async getLoopholes(worldId: string): Promise<LoopholeReport[]> {
    const response = await client.get(`/worlds/${worldId}/loopholes`)
    return response.data
  },

  async getCharacters(worldId: string): Promise<CharacterProfile[]> {
    const response = await client.get(`/worlds/${worldId}/characters`)
    return response.data
  },

  async getWorldGraph(worldId: string): Promise<GraphData> {
    const response = await client.get(`/worlds/${worldId}/graph`)
    return response.data
  },

  async queryWorld(worldId: string, query: string): Promise<any> {
    const response = await client.post(`/worlds/${worldId}/query`, {
      world_id: worldId,
      query,
    })
    return response.data
  },
}

export default client
