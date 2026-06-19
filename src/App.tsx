import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { Layout } from './components/Layout'
import { PageLoader } from './components/ui'
import LoginPage from './pages/Login'
import AuctionsPage from './pages/Auctions'
import PlayersPage from './pages/Players'
import AuctionDetailPage from './pages/AuctionDetail'
import AdminPage from './pages/Admin'
import ProfilePage from './pages/Profile'

export default function App() {
  const { session, manager, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <PageLoader />
      </div>
    )
  }

  if (!session || !manager) {
    return <LoginPage />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<AuctionsPage />} />
        <Route path="/giocatori" element={<PlayersPage />} />
        <Route path="/asta/:id" element={<AuctionDetailPage />} />
        <Route path="/profilo" element={<ProfilePage />} />
        <Route path="/admin" element={isAdmin ? <AdminPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
