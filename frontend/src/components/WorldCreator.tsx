import { useState } from 'react'
import { BookOpen, Sparkles } from 'lucide-react'
import { api } from '../api/client'
import { World } from '../types'

interface WorldCreatorProps {
  onWorldCreated: (world: World) => void
}

export default function WorldCreator({ onWorldCreated }: WorldCreatorProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreateWorld = async () => {
    if (!name.trim()) return

    setLoading(true)
    try {
      const world = await api.createWorld(name, description)
      onWorldCreated(world)
    } catch (error) {
      console.error('Error creating world:', error)
      alert('Failed to create world. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Sparkles className="w-16 h-16 text-purple-500" />
          </div>
          <h2 className="text-4xl font-bold mb-4 gradient-text">
            Create Your World
          </h2>
          <p className="text-slate-400 text-lg">
            Start building your fictional universe with AI-powered consistency checking
          </p>
        </div>

        <div className="bg-slate-900 rounded-lg border border-slate-800 p-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                World Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., The Eternal Empire"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your world..."
                rows={4}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <button
              onClick={handleCreateWorld}
              disabled={loading || !name.trim()}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Creating...</span>
              ) : (
                <>
                  <BookOpen className="w-5 h-5" />
                  <span>Create World</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-slate-900/50 rounded-lg border border-slate-800">
            <div className="text-2xl mb-2">📖</div>
            <h3 className="font-semibold mb-2">Real-Time Ingestion</h3>
            <p className="text-sm text-slate-400">
              Upload manuscripts and watch rules get extracted automatically
            </p>
          </div>

          <div className="text-center p-6 bg-slate-900/50 rounded-lg border border-slate-800">
            <div className="text-2xl mb-2">⚠️</div>
            <h3 className="font-semibold mb-2">Inconsistency Detection</h3>
            <p className="text-sm text-slate-400">
              Find contradictions before they become plot holes
            </p>
          </div>

          <div className="text-center p-6 bg-slate-900/50 rounded-lg border border-slate-800">
            <div className="text-2xl mb-2">🗺️</div>
            <h3 className="font-semibold mb-2">World Topology Map</h3>
            <p className="text-sm text-slate-400">
              Visualize connections between rules and systems
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
