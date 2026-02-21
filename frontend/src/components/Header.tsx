import { Sparkles, Wifi, WifiOff } from 'lucide-react'

interface HeaderProps {
  wsConnected: boolean
}

export default function Header({ wsConnected }: HeaderProps) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-8 h-8 text-purple-500" />
            <div>
              <h1 className="text-2xl font-bold gradient-text">
                Pure Imagination
              </h1>
              <p className="text-sm text-slate-400">
                World-Building AI Architecture
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {wsConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-400">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-400">Disconnected</span>
                </>
              )}
            </div>
            
            <div className="text-sm text-slate-400">
              Actian VectorAI DB · Hackathon 2026
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
