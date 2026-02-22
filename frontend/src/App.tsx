import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import { World } from './types'
import { api } from './api/client'

function App() {
  const [currentWorld, setCurrentWorld] = useState<World | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [lastWsMessage, setLastWsMessage] = useState<any>(null)

  useEffect(() => {
    api.createWorld('Untitled World').then(setCurrentWorld).catch(console.error)
  }, [])

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws')

    ws.onopen = () => { setWsConnected(true) }
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setLastWsMessage(data)
    }
    ws.onclose = () => { setWsConnected(false) }

    return () => { ws.close() }
  }, [])

  return (
    <Router>
      <div className="min-h-screen" style={{ background: 'var(--color-parchment)' }}>
        <Header wsConnected={wsConnected} />
        <Routes>
          <Route
            path="/"
            element={currentWorld
              ? <Dashboard world={currentWorld} wsMessage={lastWsMessage} />
              : <div style={{ padding: '2rem', color: 'var(--color-ink-light)', fontStyle: 'italic' }}>initializing...</div>
            }
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App
