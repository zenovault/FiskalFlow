/**
 * Invoices list page with search, filters, pagination, and bulk CSV export.
 */

import { useEffect, useState, useCallback } from 'react'
import { Search, Download } from 'lucide-react'
import client from '../api/client'
import InvoiceTable from '../components/InvoiceTable'
import TopBar from '../components/Layout/TopBar'
import toast from 'react-hot-toast'

const DOC_TYPES = ['', 'faktura', 'gotovinski_racun', 'putni_nalog', 'ostalo']
const STATUSES = ['', 'pending', 'processing', 'completed', 'failed']

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [docType, setDocType] = useState('')
  const [status, setStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, per_page: 20 })
      if (search) params.set('search', search)
      if (docType) params.set('document_type', docType)
      if (status) params.set('status', status)
      const res = await client.get(`/api/invoices?${params}`)
      setInvoices(res.data.items)
      setTotal(res.data.total)
      setPages(res.data.pages)
    } finally {
      setLoading(false)
    }
  }, [page, search, docType, status])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, docType, status])

  const handleExport = async () => {
    try {
      const res = await client.get('/api/invoices/export/csv', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      const cd = res.headers['content-disposition'] || ''
      const match = cd.match(/filename="(.+)"/)
      a.download = match ? match[1] : 'racuni_export.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Greška pri izvozu')
    }
  }

  const selectClass = 'border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700'

  return (
    <div>
      <TopBar title="Računi" />
      <div className="p-6">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 mb-5 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
              placeholder="Pretraži po nazivu ili broju..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <select className={selectClass} value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="">Svi tipovi</option>
            {DOC_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>

          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Svi statusi</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Download size={16} />
            Izvezi CSV
          </button>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Učitavanje...</div>
          ) : (
            <InvoiceTable invoices={invoices} />
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">Ukupno: {total}</p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Prethodna
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">
                {page} / {pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Sledeća
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
