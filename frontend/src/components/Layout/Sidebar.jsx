/**
 * Sidebar navigation component.
 * Desktop: fixed 240px panel. Mobile: collapsible via hamburger.
 */

import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Upload, FileText, BarChart2, ShieldCheck, LogOut, Menu, X, Moon, Sun } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload', icon: Upload, label: 'Upload' },
  { to: '/invoices', icon: FileText, label: 'Računi' },
  { to: '/report', icon: BarChart2, label: 'Izveštaj' },
]

const trustDocItems = [
  { to: '/trustdoc', icon: ShieldCheck, label: 'TrustDoc — Diplome' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { dark, toggle } = useTheme()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const NavContent = () => (
    <>
      <div className="px-6 py-5 border-b border-slate-700">
        <h1 className="text-white font-bold text-lg leading-tight">Birokrat-Slayer</h1>
        <p className="text-slate-400 text-xs mt-0.5">Računovodska automatizacija</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}

        <div className="border-t border-slate-700 pt-2 mt-2">
          {trustDocItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-slate-700">
        <button
          onClick={toggle}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors text-sm mb-2"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
          {dark ? 'Svetli prikaz' : 'Tamni prikaz'}
        </button>
        <div className="px-3 py-2 mb-2">
          <p className="text-slate-400 text-xs truncate">{user?.email}</p>
          <p className="text-slate-300 text-sm font-medium truncate">{user?.full_name}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <LogOut size={18} />
          Odjava
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800 text-white rounded-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-full w-60 bg-slate-800 flex flex-col z-40 transform transition-transform ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <NavContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-slate-800 min-h-screen fixed left-0 top-0">
        <NavContent />
      </aside>
    </>
  )
}
