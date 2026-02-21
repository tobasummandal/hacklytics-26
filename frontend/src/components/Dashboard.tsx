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
  wsMessage?: any
}

export default function Dashboard({ world, wsMessage }: DashboardProps) {
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

  useEffect(() => {
    if (wsMessage?.world_id === world.id && wsMessage?.type === 'inconsistencies_detected') {
      loadData()
    }
  }, [wsMessage])

  const handleUploadComplete = () => {
    // Fallback poll in case WebSocket isn't connected; backend takes ~30s to process
    setTimeout(() => {
      loadData()
    }, 35000)
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 style={{
          fontFamily: "'Crimson Text', serif",
          fontSize: '2.25rem',
          fontWeight: 600,
          marginBottom: '0.5rem',
          color: 'var(--color-ink)',
          letterSpacing: '0.01em'
        }}>{world.name}</h2>
        {world.description && (
          <p style={{ 
            color: 'var(--color-ink-light)',
            fontSize: '1rem',
            fontStyle: 'italic',
            marginBottom: '1rem'
          }}>{world.description}</p>
        )}
        
        <div className="flex space-x-6 mt-4">
          <div className="flex items-center space-x-2">
            <div style={{ 
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '50%',
              background: 'var(--color-forest)'
            }}></div>
            <span style={{ 
              fontSize: '0.875rem',
              color: 'var(--color-ink-light)'
            }}>{world.rule_count} rules</span>
          </div>
          <div className="flex items-center space-x-2">
            <div style={{ 
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '50%',
              background: 'var(--color-gold)'
            }}></div>
            <span style={{ 
              fontSize: '0.875rem',
              color: 'var(--color-ink-light)'
            }}>{world.character_count} characters</span>
          </div>
        </div>
      </div>

      <div style={{ 
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--color-border)',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => setActiveTab('upload')}
          style={{
            padding: '0.75rem 1.5rem',
            fontWeight: 500,
            fontSize: '0.95rem',
            transition: 'all 0.2s',
            color: activeTab === 'upload' ? 'var(--color-forest)' : 'var(--color-ink-light)',
            borderBottom: activeTab === 'upload' ? '2px solid var(--color-forest)' : '2px solid transparent',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'upload') e.currentTarget.style.color = 'var(--color-ink)'
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'upload') e.currentTarget.style.color = 'var(--color-ink-light)'
          }}
        >
          <Upload className="w-4 h-4" />
          <span>upload</span>
        </button>

        <button
          onClick={() => setActiveTab('graph')}
          style={{
            padding: '0.75rem 1.5rem',
            fontWeight: 500,
            fontSize: '0.95rem',
            transition: 'all 0.2s',
            color: activeTab === 'graph' ? 'var(--color-forest)' : 'var(--color-ink-light)',
            borderBottom: activeTab === 'graph' ? '2px solid var(--color-forest)' : '2px solid transparent',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'graph') e.currentTarget.style.color = 'var(--color-ink)'
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'graph') e.currentTarget.style.color = 'var(--color-ink-light)'
          }}
        >
          <Network className="w-4 h-4" />
          <span>world map</span>
        </button>

        <button
          onClick={() => setActiveTab('inconsistencies')}
          style={{
            padding: '0.75rem 1.5rem',
            fontWeight: 500,
            fontSize: '0.95rem',
            transition: 'all 0.2s',
            color: activeTab === 'inconsistencies' ? 'var(--color-forest)' : 'var(--color-ink-light)',
            borderBottom: activeTab === 'inconsistencies' ? '2px solid var(--color-forest)' : '2px solid transparent',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'inconsistencies') e.currentTarget.style.color = 'var(--color-ink)'
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'inconsistencies') e.currentTarget.style.color = 'var(--color-ink-light)'
          }}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>inconsistencies</span>
          {inconsistencies.length > 0 && (
            <span style={{
              background: '#c45a5a',
              color: 'white',
              fontSize: '0.7rem',
              padding: '0.125rem 0.5rem',
              borderRadius: '1rem',
              fontWeight: 600
            }}>
              {inconsistencies.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('loopholes')}
          style={{
            padding: '0.75rem 1.5rem',
            fontWeight: 500,
            fontSize: '0.95rem',
            transition: 'all 0.2s',
            color: activeTab === 'loopholes' ? 'var(--color-forest)' : 'var(--color-ink-light)',
            borderBottom: activeTab === 'loopholes' ? '2px solid var(--color-forest)' : '2px solid transparent',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'loopholes') e.currentTarget.style.color = 'var(--color-ink)'
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'loopholes') e.currentTarget.style.color = 'var(--color-ink-light)'
          }}
        >
          <Lock className="w-4 h-4" />
          <span>loopholes</span>
        </button>

        <button
          onClick={() => setActiveTab('characters')}
          style={{
            padding: '0.75rem 1.5rem',
            fontWeight: 500,
            fontSize: '0.95rem',
            transition: 'all 0.2s',
            color: activeTab === 'characters' ? 'var(--color-forest)' : 'var(--color-ink-light)',
            borderBottom: activeTab === 'characters' ? '2px solid var(--color-forest)' : '2px solid transparent',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'characters') e.currentTarget.style.color = 'var(--color-ink)'
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'characters') e.currentTarget.style.color = 'var(--color-ink-light)'
          }}
        >
          <Users className="w-4 h-4" />
          <span>characters</span>
        </button>
      </div>

      <div className="paper-card rounded-sm p-6">
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
