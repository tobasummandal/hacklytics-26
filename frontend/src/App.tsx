import Header from './components/Header'
import Dashboard from './components/Dashboard'

function App() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-parchment)' }}>
      <Header />
      <Dashboard />
    </div>
  )
}

export default App
