/**
 * Axios instance pre-configured with the API base URL and auth header injection.
 * The Authorization header is set dynamically from localStorage on each request.
 */

import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach JWT token to every request if present
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Global error handling
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status

    if (status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (status === 429) {
      toast.error('Previše zahteva. Pokušajte za nekoliko minuta.')
      return Promise.reject(error)
    }

    if (status === 500 || status === 503) {
      toast.error('Greška servera. Kontaktirajte podršku.')
      return Promise.reject(error)
    }

    if (!error.response) {
      toast.error('Nema veze sa serverom')
      return Promise.reject(error)
    }

    return Promise.reject(error)
  }
)

export default client
