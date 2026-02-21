import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import WorldCreator from './components/WorldCreator'
import { World } from './types'

function App() {
  const [currentWorld, setCurrentWorld] = useState<World | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws')
    
    ws.onopen = () => {
      console.log('WebSocket connected')
      setWsConnected(true)
    }
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('WebSocket message:', data)
    }
    
    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setWsConnected(false)
    }
    
    return () => {
      ws.close()
    }
  }, [])

  return (
    <Router>
      <div className="min-h-screen bg-slate-950">
        <Header wsConnected={wsConnected} />
        
        <Routes>
          <Route 
            path="/" 
            element={
              currentWorld ? (
                <Dashboard world={currentWorld} />
              ) : (
                <WorldCreator onWorldCreated={setCurrentWorld} />
              )
            } 
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App
