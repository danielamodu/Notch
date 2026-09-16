import { Routes, Route } from 'react-router-dom'
import { useNimiq } from './context/NimiqContext.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import NotInNimiqPay from './components/NotInNimiqPay.jsx'
import Header from './components/Header.jsx'
import BottomNav from './components/BottomNav.jsx'
import Feed from './pages/Feed.jsx'
import MarketDetail from './pages/MarketDetail.jsx'
import CreateMarket from './pages/CreateMarket.jsx'
import Profile from './pages/Profile.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import './styles/global.css'

function AppContent() {
  const { address, isLoading, error } = useNimiq()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (error || !address) {
    return <NotInNimiqPay />
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Header />
      <main style={{
        flex: 1,
        marginTop: '56px',
        marginBottom: '60px',
        overflowY: 'auto',
      }}>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/market/:id" element={<MarketDetail />} />
          <Route path="/create" element={<CreateMarket />} />
          <Route path="/profile/:address" element={<Profile />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return <AppContent />
}
