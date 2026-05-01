import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useToast } from './hooks/useToast'
import ToastContainer from './components/ui/Toast'
import Sidebar from './components/layout/Sidebar'
import LoginPage from './pages/LoginPage'
import { POSPage, InventoryPage, ClientsPage, ReportsPage, CashPage, UsersPage } from './pages/index'

function ProtectedLayout() {
  const { isAuthenticated } = useAuthStore()
  const { toasts } = useToast()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/pos"       element={<POSPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/clients"   element={<ClientsPage />} />
          <Route path="/cash"      element={<CashPage />} />
          <Route path="/reports"   element={<ReportsPage />} />
          <Route path="/users"     element={<UsersPage />} />
          <Route path="*"          element={<Navigate to="/pos" replace />} />
        </Routes>
      </main>
      <ToastContainer toasts={toasts} />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*"     element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  )
}
