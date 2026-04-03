/**
 * Financial report page — ulazne/izlazne split, avansi u toku, PDV pregled.
 * Floating filter panel (Task 1). Date input light/dark fix (Task 0).
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import client from '../api/client'
import TopBar from '../components/Layout/TopBar'
import toast from 'react-hot-toast'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

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

  // Floating filter panel state
  const [panelOpen, setPanelOpen] = useState(false)
  const panelRef = useRef(null)
  const filterBtnRef = useRef(null)

  // Filters state — issuerDraft drives 300ms debounce into filters.issuer
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS })
  const [issuerDraft, setIssuerDraft] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setFilters(f => ({ ...f, issuer: issuerDraft })), 300)
    return () => clearTimeout(t)
  }, [issuerDraft])

  // Close panel on outside click or Escape
  useEffect(() => {
    if (!panelOpen) return
    const onMouseDown = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        filterBtnRef.current && !filterBtnRef.current.contains(e.target)
      ) setPanelOpen(false)
    }
    const onKeyDown = (e) => { if (e.key === 'Escape') setPanelOpen(false) }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [panelOpen])

  const activeFilterCount = [
    filters.invoice_type,
    filters.status,
    issuerDraft.trim(),
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
    } catch {
      toast.error('Greška pri učitavanju izveštaja')
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () => {
    setFilters({ ...DEFAULT_FILTERS })
    setIssuerDraft('')
  }

  const toggleVat = (rate) => {
    setFilters(f => ({
      ...f,
      vat_rate: f.vat_rate.includes(rate)
        ? f.vat_rate.filter(r => r !== rate)
        : [...f.vat_rate, rate],
    }))
  }

  const applyAndClose = () => { fetchReport(); setPanelOpen(false) }

  // Task 7 — NL search
  const [nlInput, setNlInput] = useState('')
  const [nlLabel, setNlLabel] = useState('')
  const [nlIds, setNlIds] = useState(null) // null = inactive, [] = no results, [1,2] = filtered
  const [nlLoading, setNlLoading] = useState(false)

  const handleNlSearch = async (e) => {
    e.preventDefault()
    if (!nlInput.trim()) return
    setNlLoading(true)
    try {
      const res = await client.post('/api/search', { query: nlInput.trim() })
      if (res.data.error || !res.data.ids?.length) {
        toast('Pretraga nije dala rezultate', { icon: 'ℹ️' })
        setNlIds([])
      } else {
        setNlIds(res.data.ids)
      }
      setNlLabel(nlInput.trim())
    } catch {
      toast.error('Pretraga nije uspela — pokušaj ponovo')
    } finally {
      setNlLoading(false)
    }
  }

  const clearNlSearch = () => { setNlIds(null); setNlLabel(''); setNlInput('') }

  // Invoices after optional NL filter — used by chart and grouping
  const displayInvoices = useMemo(() => {
    const all = reportData?.invoices || []
    if (nlIds === null) return all
    const idSet = new Set(nlIds)
    return all.filter(i => idSet.has(i.id))
  }, [reportData, nlIds])

  // Task 4 — chart data (activates once Task 6 adds invoices[] to response)
  const chartData = useMemo(() => {
    const invoices = displayInvoices
    if (!invoices.length) return []
    const daysDiff = (new Date(toDate) - new Date(fromDate)) / 86400000
    const byMonth = daysDiff > 60
    const buckets = {}
    for (const inv of invoices) {
      if (!inv.issue_date) continue
      const key = byMonth ? inv.issue_date.slice(0, 7) : inv.issue_date.slice(0, 10)
      buckets[key] = (buckets[key] || 0) + (inv.total_amount || 0)
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, iznos]) => ({ date, iznos: Math.round(iznos * 100) / 100 }))
  }, [reportData, fromDate, toDate])

  // Task 3 — grouping
  const [groupBy, setGroupBy] = useState('')

  const groupedInvoices = useMemo(() => {
    const invoices = displayInvoices
    if (!groupBy || !invoices.length) return null
    const groups = {}
    for (const inv of invoices) {
      let key
      if (groupBy === 'month') {
        key = inv.issue_date ? inv.issue_date.slice(0, 7) : 'Nepoznato'
      } else if (groupBy === 'issuer') {
        key = inv.issuer_name || 'Nepoznato'
      } else if (groupBy === 'vat') {
        const ratio = inv.total_amount ? Math.round((inv.vat_amount || 0) / inv.total_amount * 100) : 0
        key = ratio >= 18 ? '20%' : ratio >= 8 ? '10%' : 'Bez PDV'
      }
      if (!groups[key]) groups[key] = []
      groups[key].push(inv)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [reportData, groupBy])

  // Task 0: bg-white/text-gray-900 light, dark:bg-gray-800/dark:text-white dark
  const inputClass = 'border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium uppercase tracking-wide'

  return (
    <div>
      <TopBar title="Finansijski izveštaj" />
      <div className="p-6 space-y-6">

        {/* Top bar: dates + Prikaži + Filteri */}
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">Od datuma</label>
            <input type="date" className={inputClass} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">Do datuma</label>
            <input type="date" className={inputClass} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <button
            onClick={fetchReport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Prikaži
          </button>

          {/* Grupiši po dropdown */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">Grupiši po</label>
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value)}
              className={inputClass}
            >
              <option value="">Bez grupiranja</option>
              <option value="month">Po mesecu</option>
              <option value="issuer">Po izdavaocu</option>
              <option value="vat">Po PDV stopi</option>
            </select>
          </div>

          {/* Filteri button + floating panel */}
          <div className="relative">
            <button
              ref={filterBtnRef}
              onClick={() => setPanelOpen(o => !o)}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                ${panelOpen
                  ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
            >
              ☰ Filteri
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {panelOpen && (
              <div
                ref={panelRef}
                className="absolute top-full left-0 mt-1 z-50 w-80 max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 space-y-5"
              >
                {/* 1. Tip računa */}
                <div>
                  <p className={labelClass}>Tip računa</p>
                  {[['', 'Svi'], ['ulazna', 'Ulazna'], ['izlazna', 'Izlazna']].map(([val, label]) => (
                    <label key={val} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                      <input
                        type="radio"
                        name="fp_invoice_type"
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
                        name="fp_status"
                        value={val}
                        checked={filters.status === val}
                        onChange={() => setFilters(f => ({ ...f, status: val }))}
                        className="accent-blue-600"
                      />
                      <span className="text-gray-700 dark:text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>

                {/* 3. Izdavalac (debounced 300ms) */}
                <div>
                  <label className={labelClass}>Izdavalac</label>
                  <input
                    type="text"
                    className={`${inputClass} w-full`}
                    placeholder="Pretraži izdavaoca..."
                    value={issuerDraft}
                    onChange={e => setIssuerDraft(e.target.value)}
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
                <div className="pt-1 space-y-2 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={applyAndClose}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Primeni
                  </button>
                  <button
                    onClick={resetFilters}
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Resetuj
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Task 7 — NL search bar */}
        {reportData && (
          <form onSubmit={handleNlSearch} className="flex gap-2 items-center">
            <input
              type="text"
              className={`flex-1 ${inputClass}`}
              placeholder="Npr. Pokaži sve račune od Delhaize-a iznad 500 RSD"
              value={nlInput}
              onChange={e => setNlInput(e.target.value)}
              disabled={nlLoading}
            />
            <button
              type="submit"
              disabled={nlLoading || !nlInput.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {nlLoading ? '...' : 'Traži'}
            </button>
            {nlIds !== null && (
              <button type="button" onClick={clearNlSearch}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >✕</button>
            )}
          </form>
        )}
        {nlLabel && nlIds !== null && (
          <p className="text-sm text-indigo-600 dark:text-indigo-400">
            Prikazujem rezultate za: <span className="font-medium">"{nlLabel}"</span>
            {' '}({displayInvoices.length} {displayInvoices.length === 1 ? 'faktura' : 'faktura'})
          </p>
        )}

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

            {/* Task 4 — line chart */}
            {chartData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-white mb-4">Trend iznosa</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                      tickFormatter={v => Number(v).toLocaleString('sr-RS', { maximumFractionDigits: 0 })} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-xs">
                          <p className="text-gray-500 mb-1">{label}</p>
                          <p className="font-semibold tabular-nums text-gray-800 dark:text-white">
                            {Number(payload[0].value).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} RSD
                          </p>
                        </div>
                      )
                    }} />
                    <Line type="monotone" dataKey="iznos" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

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
                  <p className="font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                    {fmt(Math.round(((reportData.izlazne.ukupan_pdv || 0) - (reportData.ulazne.ukupan_pdv || 0)) * 100) / 100)} RSD
                  </p>
                </div>
              </div>
            </div>

            {reportData.avansi_u_toku?.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 p-5">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-3">
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

        {/* Task 3 — grouped breakdown (activates once Task 6 adds invoices[] to response) */}
        {groupedInvoices && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-white">
              Grupisano {groupBy === 'month' ? 'po mesecu' : groupBy === 'issuer' ? 'po izdavaocu' : 'po PDV stopi'}
            </h3>
            {groupedInvoices.map(([key, items]) => {
              const subtotal = items.reduce((s, i) => s + (i.total_amount || 0), 0)
              return (
                <details key={key} open className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <span className="font-medium text-sm text-gray-800 dark:text-white">{key}</span>
                    <span className="text-xs text-gray-500">
                      {items.length} faktura · <span className="font-semibold tabular-nums">{fmt(subtotal)} RSD</span>
                    </span>
                  </summary>
                  <div className="border-t border-gray-100 dark:border-gray-700 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-100 dark:border-gray-700">
                          <th className="text-left px-4 py-2">Datum</th>
                          <th className="text-left px-4 py-2">Izdavalac</th>
                          <th className="text-left px-4 py-2">Br. dok.</th>
                          <th className="text-right px-4 py-2">Ukupno</th>
                          <th className="text-right px-4 py-2">PDV</th>
                          <th className="text-left px-4 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(inv => (
                          <tr key={inv.id} className="border-b border-gray-50 dark:border-gray-700">
                            <td className="px-4 py-1.5 text-gray-500">{inv.issue_date || '—'}</td>
                            <td className="px-4 py-1.5 text-gray-700 dark:text-gray-300" title={inv.issuer_name}>
                              {(inv.issuer_name || '—').length > 24 ? inv.issuer_name.slice(0, 24) + '…' : (inv.issuer_name || '—')}
                            </td>
                            <td className="px-4 py-1.5 text-gray-500 font-mono">{inv.invoice_number || '—'}</td>
                            <td className="px-4 py-1.5 text-right tabular-nums font-medium">{fmt(inv.total_amount)} RSD</td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-gray-500">{fmt(inv.vat_amount)} RSD</td>
                            <td className="px-4 py-1.5 text-gray-500">{inv.status || '—'}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-gray-200 dark:border-gray-600 font-semibold bg-gray-50 dark:bg-gray-700">
                          <td colSpan={3} className="px-4 py-2 text-xs uppercase text-gray-400">Subtotal</td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-800 dark:text-gray-100">{fmt(subtotal)} RSD</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
