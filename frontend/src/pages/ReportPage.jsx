/**
 * Financial report page — ulazne/izlazne split, avansi u toku, PDV pregled.
 * Collapsible filter sidebar (Excel-style).
 */

import { useState } from 'react'
import client from '../api/client'
import TopBar from '../components/Layout/TopBar'
import toast from 'react-hot-toast'

function fmt(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('sr-RS', { minimumFractionDigits: 2 })
}

const DEFAULT_FILTERS = {
  invoice_type: '',
  status: '',
  issuer: '',
  vat_rate: [],
  amount_from: '',
  amount_to: '',
}

function SummaryCard({ title, data, color }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border p-5 ${color}`}>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-white mb-4">{title}</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Broj faktura</span>
          <span className="font-medium">{data.broj}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Ukupan iznos</span>
          <span className="font-semibold tabular-nums">{fmt(data.ukupan_iznos)} RSD</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Ukupan PDV</span>
          <span className="font-medium tabular-nums">{fmt(data.ukupan_pdv)} RSD</span>
        </div>
        <div className="flex justify-between border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
          <span className="text-gray-500 dark:text-gray-400">Avans primljen</span>
          <span className="font-medium text-amber-600 tabular-nums">{fmt(data.avans_primljen)} RSD</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Avans opravdan</span>
          <span className="font-medium text-green-600 tabular-nums">{fmt(data.avans_opravdan)} RSD</span>
        </div>
        <div className="flex justify-between border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
          <span className="text-gray-700 dark:text-gray-300 font-medium">Preostalo za naplatu</span>
          <span className={`font-bold tabular-nums ${data.preostalo_za_naplatu > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            {fmt(data.preostalo_za_naplatu)} RSD
          </span>
        </div>
      </div>
    </div>
  )
}

export default function ReportPage() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS })

  const activeFilterCount = [
    filters.invoice_type,
    filters.status,
    filters.issuer.trim(),
    filters.vat_rate.length > 0,
    filters.amount_from,
    filters.amount_to,
  ].filter(Boolean).length

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = { from_date: fromDate, to_date: toDate }
      if (filters.invoice_type) params.invoice_type = filters.invoice_type
      if (filters.status) params.status = filters.status
      if (filters.issuer.trim()) params.issuer = filters.issuer.trim()
      if (filters.vat_rate.length === 1) params.vat_rate = filters.vat_rate[0]
      if (filters.amount_from !== '') params.amount_from = parseFloat(filters.amount_from)
      if (filters.amount_to !== '') params.amount_to = parseFloat(filters.amount_to)

      const res = await client.get('/api/invoices/report', { params })
      setReportData(res.data)
    } catch(e) {
      toast.error('Greška pri učitavanju izveštaja')
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () => setFilters({ ...DEFAULT_FILTERS })

  const toggleVat = (rate) => {
    setFilters(f => ({
      ...f,
      vat_rate: f.vat_rate.includes(rate)
        ? f.vat_rate.filter(r => r !== rate)
        : [...f.vat_rate, rate],
    }))
  }

  const inputClass = 'border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100'
  const labelClass = 'block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium uppercase tracking-wide'

  return (
    <div className="flex h-full">
      {/* Filter sidebar */}
      <div
        className="flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-200 overflow-hidden"
        style={{ width: sidebarOpen ? '280px' : '48px' }}
      >
        {/* Toggle button */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="flex items-center justify-center h-12 w-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative flex-shrink-0"
          title={sidebarOpen ? 'Sakrij filtere' : 'Prikaži filtere'}
        >
          <span className="text-gray-500 dark:text-gray-400 text-lg">☰</span>
          {activeFilterCount > 0 && (
            <span className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Filter content — only rendered when open */}
        {sidebarOpen && (
          <div className="flex flex-col flex-1 overflow-y-auto p-4 space-y-5 min-w-0">
            {/* 1. Tip računa */}
            <div>
              <p className={labelClass}>Tip računa</p>
              {[['', 'Svi'], ['ulazna', 'Ulazna'], ['izlazna', 'Izlazna']].map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                  <input
                    type="radio"
                    name="invoice_type"
                    value={val}
                    checked={filters.invoice_type === val}
                    onChange={() => setFilters(f => ({ ...f, invoice_type: val }))}
                    className="accent-blue-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">{label}</span>
                </label>
              ))}
            </div>

            {/* 2. Status */}
            <div>
              <p className={labelClass}>Status</p>
              {[['', 'Svi'], ['completed', 'Završeno'], ['pending', 'Na čekanju']].map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value={val}
                    checked={filters.status === val}
                    onChange={() => setFilters(f => ({ ...f, status: val }))}
                    className="accent-blue-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">{label}</span>
                </label>
              ))}
            </div>

            {/* 3. Izdavalac */}
            <div>
              <label className={labelClass}>Izdavalac</label>
              <input
                type="text"
                className={`${inputClass} w-full`}
                placeholder="Pretraži izdavaoca..."
                value={filters.issuer}
                onChange={e => setFilters(f => ({ ...f, issuer: e.target.value }))}
              />
            </div>

            {/* 4. PDV stopa */}
            <div>
              <p className={labelClass}>PDV stopa</p>
              {[['10', '10%'], ['20', '20%']].map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.vat_rate.includes(val)}
                    onChange={() => toggleVat(val)}
                    className="accent-blue-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">{label}</span>
                </label>
              ))}
            </div>

            {/* 5. Iznos od/do */}
            <div>
              <p className={labelClass}>Iznos (RSD)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  className={`${inputClass} w-full`}
                  placeholder="Od"
                  value={filters.amount_from}
                  onChange={e => setFilters(f => ({ ...f, amount_from: e.target.value }))}
                />
                <input
                  type="number"
                  className={`${inputClass} w-full`}
                  placeholder="Do"
                  value={filters.amount_to}
                  onChange={e => setFilters(f => ({ ...f, amount_to: e.target.value }))}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 space-y-2 mt-auto">
              <button
                onClick={fetchReport}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Primeni
              </button>
              <button
                onClick={() => { resetFilters(); }}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Resetuj
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <TopBar title="Finansijski izveštaj" />
        <div className="p-6 space-y-6">
          {/* Date filters */}
          <div className="flex gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">Od datuma</label>
              <input type="date" className={inputClass} value={fromDate} onChange={e => setFromDate(e.target.value)} style={{colorScheme: 'dark'}} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">Do datuma</label>
              <input type="date" className={inputClass} value={toDate} onChange={e => setToDate(e.target.value)} style={{colorScheme: 'dark'}} />
            </div>
            <button
              onClick={fetchReport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Prikaži
            </button>
          </div>

          {!reportData && !loading && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-600">
              Odaberite period i kliknite Prikaži
            </div>
          )}
          {reportData && reportData.ukupno.broj_faktura === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-600">
              Nema faktura u odabranom periodu ({fromDate} — {toDate})
            </div>
          )}
          {loading ? (
            <div className="text-center py-12 text-gray-400">Učitavanje...</div>
          ) : reportData && reportData.ukupno.broj_faktura > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SummaryCard title="Ulazne fakture (primamo)" data={reportData.ulazne} color="border-red-100" />
                <SummaryCard title="Izlazne fakture (šaljemo)" data={reportData.izlazne} color="border-green-100" />
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-white mb-3">Ukupno</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Broj faktura</p>
                    <p className="font-semibold text-lg">{reportData.ukupno.broj_faktura}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Ukupan iznos</p>
                    <p className="font-semibold text-lg tabular-nums">{fmt(reportData.ukupno.ukupan_iznos)} RSD</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Ukupan PDV</p>
                    <p className="font-semibold text-lg tabular-nums">{fmt(reportData.ukupno.ukupan_pdv)} RSD</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-white mb-3">PDV pregled (za prijavu)</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">PDV na ulaznim</p>
                    <p className="font-medium text-red-600 tabular-nums">{fmt(reportData.ulazne.ukupan_pdv)} RSD</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">PDV na izlaznim</p>
                    <p className="font-medium text-green-600 tabular-nums">{fmt(reportData.izlazne.ukupan_pdv)} RSD</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Razlika (obaveza)</p>
                    <p className="font-bold text-gray-800 tabular-nums">
                      {fmt(Math.round(((reportData.izlazne.ukupan_pdv || 0) - (reportData.ulazne.ukupan_pdv || 0)) * 100) / 100)} RSD
                    </p>
                  </div>
                </div>
              </div>

              {reportData.avansi_u_toku?.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 p-5">
                  <h3 className="text-sm font-semibold text-amber-800 mb-3">
                    Avansi u toku ({reportData.avansi_u_toku.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">
                          <th className="text-left py-2">Izdavalac</th>
                          <th className="text-left py-2">Interni br.</th>
                          <th className="text-right py-2">Avans primljen</th>
                          <th className="text-right py-2">Avans opravdan</th>
                          <th className="text-right py-2">Razlika</th>
                          <th className="text-right py-2">Datum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.avansi_u_toku.map((a) => (
                          <tr key={a.id} className="border-b border-amber-50 dark:border-gray-700">
                            <td className="py-2">{a.izdavalac || '—'}</td>
                            <td className="py-2 font-mono text-xs text-gray-500">{a.interni_broj || '—'}</td>
                            <td className="py-2 text-right tabular-nums">{fmt(a.avans_primljen)} RSD</td>
                            <td className="py-2 text-right text-green-600 tabular-nums">{fmt(a.avans_opravdan)} RSD</td>
                            <td className="py-2 text-right font-semibold text-amber-700 tabular-nums">{fmt(a.razlika)} RSD</td>
                            <td className="py-2 text-right text-gray-400">{a.datum || '—'}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-amber-200 font-semibold">
                          <td colSpan={4} className="py-2 text-right text-xs uppercase text-gray-500">Ukupno</td>
                          <td className="py-2 text-right text-amber-700 tabular-nums">
                            {fmt(reportData.avansi_u_toku.reduce((s, a) => s + (a.razlika || 0), 0))} RSD
                          </td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
