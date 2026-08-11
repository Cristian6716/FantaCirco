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
import CampionatoPage from './pages/competizioni/CampionatoPage'
import CoppaPage from './pages/competizioni/CoppaPage'
import BattleRoyalePage from './pages/competizioni/BattleRoyalePage'
import MegagalatticoPage from './pages/competizioni/MegagalatticoPage'
import CampionatoStatsPage from './pages/statistiche/CampionatoStatsPage'
import MercatoStatsPage from './pages/statistiche/MercatoStatsPage'
import ScontriDirettiPage from './pages/statistiche/ScontriDirettiPage'
import ScambiStatsPage from './pages/statistiche/ScambiStatsPage'
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
        <Route path="/tornei" element={<Navigate to="/competizioni" replace />} />
        <Route path="/competizioni" element={<Navigate to="/competizioni/campionato" replace />} />
        <Route path="/competizioni/campionato" element={<CampionatoPage />} />
        <Route path="/competizioni/coppa" element={<CoppaPage />} />
        <Route path="/competizioni/battle-royale" element={<BattleRoyalePage />} />
        <Route path="/competizioni/megagalattico" element={<MegagalatticoPage />} />
        <Route path="/statistiche" element={<Navigate to="/statistiche/campionato" replace />} />
        <Route path="/statistiche/campionato" element={<CampionatoStatsPage />} />
        <Route path="/statistiche/mercato" element={<MercatoStatsPage />} />
        <Route path="/statistiche/scontri-diretti" element={<ScontriDirettiPage />} />
        <Route path="/statistiche/scambi" element={<ScambiStatsPage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/profilo" element={<ProfilePage />} />
        <Route path="/admin" element={isAdmin ? <AdminPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
