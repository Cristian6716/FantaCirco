import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { Layout } from './components/Layout'
import { PageLoader } from './components/ui'
import LoginPage from './pages/Login'
import ChooseTeamPage from './pages/ChooseTeamPage'
import AuctionsPage from './pages/Auctions'
import PlayersPage from './pages/Players'
import AuctionDetailPage from './pages/AuctionDetail'
import PronosticaPage from './pages/pronostici/PronosticaPage'
import ClassificaPage from './pages/pronostici/ClassificaPage'
import StoricoPage from './pages/pronostici/StoricoPage'
import PodioPage from './pages/pronostici/PodioPage'
import TorneiPage from './pages/Tornei'
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

  if (!manager.team_name) {
    return <ChooseTeamPage />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/asta/aste" replace />} />
        <Route path="/asta" element={<Navigate to="/asta/aste" replace />} />
        <Route path="/asta/giocatori" element={<PlayersPage />} />
        <Route path="/asta/aste" element={<AuctionsPage />} />
        <Route path="/asta/aste/:id" element={<AuctionDetailPage />} />
        <Route path="/pronostici" element={<Navigate to="/pronostici/pronostica" replace />} />
        <Route path="/pronostici/pronostica" element={<PronosticaPage />} />
        <Route path="/pronostici/classifica" element={<ClassificaPage />} />
        <Route path="/pronostici/storico" element={<StoricoPage />} />
        <Route path="/pronostici/podio" element={<PodioPage />} />
        <Route path="/tornei" element={<TorneiPage />} />
        <Route path="/profilo" element={<ProfilePage />} />
        <Route path="/admin" element={isAdmin ? <AdminPage /> : <Navigate to="/asta/aste" replace />} />
        <Route path="*" element={<Navigate to="/asta/aste" replace />} />
      </Routes>
    </Layout>
  )
}
