import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { Layout } from './components/Layout'
import { PageLoader } from './components/ui'
import { resyncPush } from './lib/push'
import LoginPage from './pages/Login'
import ChooseTeamPage from './pages/ChooseTeamPage'
import HomePage from './pages/Home'
import AuctionsPage from './pages/Auctions'
import ArchivePage from './pages/Archive'
import PlayersPage from './pages/Players'
import AuctionDetailPage from './pages/AuctionDetail'
import PronosticaPage from './pages/pronostici/PronosticaPage'
import ClassificaPage from './pages/pronostici/ClassificaPage'
import StoricoPage from './pages/pronostici/StoricoPage'
import PodioPage from './pages/pronostici/PodioPage'
import TorneiPage from './pages/Tornei'
import RankingPage from './pages/Ranking'
import AdminPage from './pages/Admin'
import ProfilePage from './pages/Profile'

export default function App() {
  const { session, manager, loading, isAdmin } = useAuth()
  const managerId = manager?.id

  useEffect(() => {
    if (!managerId) return
    void resyncPush(managerId)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void resyncPush(managerId)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [managerId])

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

  if (!manager.team_name) {
    return <ChooseTeamPage />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/asta" element={<Navigate to="/asta/aste" replace />} />
        <Route path="/asta/giocatori" element={<PlayersPage />} />
        <Route path="/asta/aste" element={<AuctionsPage />} />
        <Route path="/asta/aste/:id" element={<AuctionDetailPage />} />
        <Route path="/asta/archivio" element={<ArchivePage />} />
        <Route path="/pronostici" element={<Navigate to="/pronostici/pronostica" replace />} />
        <Route path="/pronostici/pronostica" element={<PronosticaPage />} />
        <Route path="/pronostici/classifica" element={<ClassificaPage />} />
        <Route path="/pronostici/storico" element={<StoricoPage />} />
        <Route path="/pronostici/podio" element={<PodioPage />} />
        <Route path="/tornei" element={<TorneiPage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/profilo" element={<ProfilePage />} />
        <Route path="/admin" element={isAdmin ? <AdminPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
