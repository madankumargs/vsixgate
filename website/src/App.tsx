import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Examples from './pages/Examples'
import ExampleDetail from './pages/ExampleDetail'
import Scanner from './pages/Scanner'
import AgentChat from './components/AgentChat'

export default function App(){
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/examples" element={<Examples />} />
          <Route path="/examples/:id" element={<ExampleDetail />} />
          <Route path="/scan" element={<Scanner />} />
        </Routes>
      </main>
      <Footer />
      <AgentChat />
    </div>
  )
}
