/**
 * App root — React Router setup with protected routes.
 * Authenticated users see the layout with sidebar.
 * Unauthenticated users are redirected to /login.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Layout/Sidebar'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import UploadPage from './pages/UploadPage'
import InvoicesPage from './pages/InvoicesPage'
import InvoiceDetailPage from './pages/InvoiceDetailPage'
import ReportPage from './pages/ReportPage'
import TrustDocPage from './pages/TrustDocPage'
import VerifyPage from './pages/VerifyPage'

function ProtectedLayout({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 lg:ml-60 min-h-screen">
        {children}
      </main>
    </div>
  )
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/verify/:hash" element={<VerifyPage />} />
      <Route path="/dashboard" element={<ProtectedLayout><DashboardPage /></ProtectedLayout>} />
      <Route path="/upload" element={<ProtectedLayout><UploadPage /></ProtectedLayout>} />
      <Route path="/invoices" element={<ProtectedLayout><InvoicesPage /></ProtectedLayout>} />
      <Route path="/invoices/:id" element={<ProtectedLayout><InvoiceDetailPage /></ProtectedLayout>} />
      <Route path="/report" element={<ProtectedLayout><ReportPage /></ProtectedLayout>} />
      <Route path="/trustdoc" element={<ProtectedLayout><TrustDocPage /></ProtectedLayout>} />
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
