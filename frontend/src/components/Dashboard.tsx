import { useState, useEffect } from 'react'
import { Upload, AlertTriangle, Lock, Users, Network } from 'lucide-react'
import { World, InconsistencyReport, LoopholeReport, CharacterProfile, GraphData } from '../types'
import { api } from '../api/client'
import FileUpload from './FileUpload'
import InconsistencyPanel from './InconsistencyPanel'
import LoopholePanel from './LoopholePanel'
import CharacterPanel from './CharacterPanel'
import WorldGraph from './WorldGraph'

interface DashboardProps {
  world: World
}

export default function Dashboard({ world }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'graph' | 'inconsistencies' | 'loopholes' | 'characters'>('upload')
  const [inconsistencies, setInconsistencies] = useState<InconsistencyReport[]>([])
  const [loopholes, setLoopholes] = useState<LoopholeReport[]>([])
  const [characters, setCharacters] = useState<CharacterProfile[]>([])
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [incData, loopData, charData, graph] = await Promise.all([
        api.getInconsistencies(world.id),
        api.getLoopholes(world.id),
        api.getCharacters(world.id),
        api.getWorldGraph(world.id)
      ])

      setInconsistencies(incData)
      setLoopholes(loopData)
      setCharacters(charData)
      setGraphData(graph)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (world.rule_count > 0) {
      loadData()
    }
  }, [world])

  const handleUploadComplete = () => {
    setTimeout(() => {
      loadData()
    }, 2000)
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2">{world.name}</h2>
        {world.description && (
          <p className="text-slate-400">{world.description}</p>
        )}
        
        <div className="flex space-x-6 mt-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
            <span className="text-sm text-slate-400">{world.rule_count} Rules</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-pink-500"></div>
            <span className="text-sm text-slate-400">{world.character_count} Characters</span>
          </div>
        </div>
      </div>

      <div className="flex space-x-2 mb-6 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-6 py-3 font-medium transition-colors flex items-center space-x-2 ${
            activeTab === 'upload'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Upload</span>
        </button>

        <button
          onClick={() => setActiveTab('graph')}
          className={`px-6 py-3 font-medium transition-colors flex items-center space-x-2 ${
            activeTab === 'graph'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <Network className="w-4 h-4" />
          <span>World Map</span>
        </button>

        <button
          onClick={() => setActiveTab('inconsistencies')}
          className={`px-6 py-3 font-medium transition-colors flex items-center space-x-2 ${
            activeTab === 'inconsistencies'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Inconsistencies</span>
          {inconsistencies.length > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {inconsistencies.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('loopholes')}
          className={`px-6 py-3 font-medium transition-colors flex items-center space-x-2 ${
            activeTab === 'loopholes'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Loopholes</span>
        </button>

        <button
          onClick={() => setActiveTab('characters')}
          className={`px-6 py-3 font-medium transition-colors flex items-center space-x-2 ${
            activeTab === 'characters'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Characters</span>
        </button>
      </div>

      <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
        {activeTab === 'upload' && (
          <FileUpload worldId={world.id} onUploadComplete={handleUploadComplete} />
        )}

        {activeTab === 'graph' && (
          <WorldGraph data={graphData} loading={loading} />
        )}

        {activeTab === 'inconsistencies' && (
          <InconsistencyPanel inconsistencies={inconsistencies} loading={loading} />
        )}

        {activeTab === 'loopholes' && (
          <LoopholePanel loopholes={loopholes} loading={loading} />
        )}

        {activeTab === 'characters' && (
          <CharacterPanel characters={characters} loading={loading} />
        )}
      </div>
    </div>
  )
}
