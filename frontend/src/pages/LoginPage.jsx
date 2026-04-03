/**
 * Login and registration page.
 * Centered card layout — clean, minimal, no decorations.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', full_name: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (!form.email) errs.email = 'Email je obavezan'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Neispravan email'
    if (!form.password) errs.password = 'Lozinka je obavezna'
    else if (form.password.length < 8) errs.password = 'Minimum 8 karaktera'
    if (mode === 'register' && !form.full_name.trim()) errs.full_name = 'Ime je obavezno'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
      } else {
        await register(form.email, form.password, form.full_name)
      }
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.detail?.error || 'Greška pri prijavi'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (field) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-200'
    }`

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-7">
          <h1 className="text-2xl font-bold text-blue-600">FiskalFlow</h1>
          <p className="text-gray-500 text-sm mt-1">Automatizacija računovodske dokumentacije</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ime i prezime</label>
              <input
                className={inputClass('full_name')}
                type="text"
                value={form.full_name}
                onChange={set('full_name')}
                placeholder="Marko Petrović"
                autoComplete="name"
              />
              {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name}</p>}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email adresa</label>
            <input
              className={inputClass('email')}
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="marko@firma.rs"
              autoComplete="email"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Lozinka</label>
            <input
              className={inputClass('password')}
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="Minimum 8 karaktera"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors mt-2"
          >
            {loading
              ? 'Molimo sačekajte...'
              : mode === 'login'
              ? 'Prijava'
              : 'Registracija'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          {mode === 'login' ? 'Nemate nalog? ' : 'Već imate nalog? '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErrors({}) }}
            className="text-blue-600 font-medium hover:underline"
          >
            {mode === 'login' ? 'Registrujte se' : 'Prijavite se'}
          </button>
        </p>
      </div>
    </div>
  )
}
