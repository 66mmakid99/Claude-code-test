import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Header from './components/Header'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import ReportDetail from './pages/ReportDetail'
import Pricing from './pages/Pricing'
import DealerDashboard from './pages/DealerDashboard'
import AEOChecker from './pages/AEOChecker'
import Scan from './pages/Scan'
import ViralMonitoring from './pages/ViralMonitoring'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')

    if (token && savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <>
      <Header user={user} onLogout={handleLogout} />
      <main style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />} />
          <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register onLogin={handleLogin} />} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/login" />} />
          <Route path="/report/:id" element={user ? <ReportDetail /> : <Navigate to="/login" />} />
          <Route path="/pricing" element={<Pricing user={user} />} />
          {/* AEO, Scan, Viral - 비회원도 접근 가능 (제한된 결과) */}
          <Route path="/aeo" element={<AEOChecker user={user} />} />
          <Route path="/scan" element={<Scan user={user} />} />
          <Route path="/viral" element={<ViralMonitoring user={user} />} />
          <Route
            path="/dealer"
            element={user?.role === 'dealer' || user?.role === 'admin' ? <DealerDashboard /> : <Navigate to="/" />}
          />
        </Routes>
      </main>
    </>
  )
}

export default App
