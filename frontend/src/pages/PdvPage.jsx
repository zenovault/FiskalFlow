/**
 * PDV Asistent page — two tabs: Fakture (table only) and Izveštaj (VAT report).
 * Upload is handled exclusively via the Dokumenti page.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  FileText,
  BarChart2,
  Loader2,
  Download,
  AlertCircle,
  FolderOpen,
} from 'lucide-react'
import client from '../api/client'
import TopBar from '../components/Layout/TopBar'

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHS = [
  'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
  'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar',
]

const STATUS_META = {
  primljen:  { label: 'Primljen',  cls: 'bg-gray-100 text-gray-600' },
  avans:     { label: 'Avans',     cls: 'bg-amber-100 text-amber-700' },
  opravdan:  { label: 'Opravdan',  cls: 'bg-blue-100 text-blue-700' },
  placeno:   { label: 'Plaćeno',   cls: 'bg-green-100 text-green-700' },
  pdv:       { label: 'PDV',       cls: 'bg-purple-100 text-purple-700' },
}

const STATUS_OPTIONS = [
  { value: 'primljen', label: 'Primljen' },
  { value: 'avans',    label: 'Avans' },
  { value: 'opravdan', label: 'Opravdan' },
  { value: 'placeno',  label: 'Plaćeno' },
  { value: 'pdv',      label: 'PDV' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (val) =>
  val != null
    ? Number(val).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'

const vatRateLabel = (rate) => {
  if (rate === 0.2 || rate === 0.20) return '20%'
  if (rate === 0.1 || rate === 0.10) return '10%'
  return '—'
}

// ─── Status cell with inline editing ─────────────────────────────────────────

function StatusCell({ invoice, allInvoices, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [newStatus, setNewStatus] = useState(invoice.status)
  const [datumPlacanja, setDatumPlacanja] = useState(invoice.datum_placanja || '')
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoice_date || '')
  const [avansId, setAvansId] = useState(invoice.avans_faktura_id || '')
  const [saving, setSaving] = useState(false)

  const avansInvoices = allInvoices.filter(
    (inv) => inv.status === 'avans' && inv.id !== invoice.id
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = { status: newStatus }
      if (newStatus === 'placeno' && datumPlacanja) body.datum_placanja = datumPlacanja
      if (newStatus === 'opravdan' && avansId) body.avans_faktura_id = Number(avansId)
      if (invoiceDate) body.invoice_date = invoiceDate

      const res = await client.patch(`/api/pdv/invoices/${invoice.id}/status`, body)
      toast.success('Status ažuriran')
      onUpdated(res.data)
      setEditing(false)
    } catch (err) {
      const msg = err.response?.data?.detail?.error || 'Greška pri ažuriranju statusa'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const meta = STATUS_META[invoice.status] || { label: invoice.status, cls: 'bg-gray-100 text-gray-600' }

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${meta.cls}`}
        title="Klikni za promenu statusa"
      >
        {meta.label}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[180px]">
      <select
        value={newStatus}
        onChange={(e) => setNewStatus(e.target.value)}
        className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Show invoice date field if missing — needed for report filtering */}
      {!invoice.invoice_date && (
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Datum fakture</p>
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="w-full border border-orange-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="YYYY-MM-DD"
          />
        </div>
      )}

      {newStatus === 'placeno' && (
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Datum plaćanja</p>
          <input
            type="date"
            value={datumPlacanja}
            onChange={(e) => setDatumPlacanja(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {newStatus === 'opravdan' && (
        <select
          value={avansId}
          onChange={(e) => setAvansId(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Izaberi avans fakturu —</option>
          {avansInvoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              #{inv.id} {inv.vendor_name || ''} {inv.invoice_number || ''}
            </option>
          ))}
        </select>
      )}

      <div className="flex gap-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Sačuvaj'}
        </button>
        <button
          onClick={() => { setEditing(false); setNewStatus(invoice.status) }}
          className="flex-1 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50"
        >
          Otkaži
        </button>
      </div>
    </div>
  )
}

// ─── Fakture Tab ─────────────────────────────────────────────────────────────

function FaktureTab() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get('/api/pdv/invoices')
      .then((res) => setInvoices(res.data))
      .catch(() => toast.error('Greška pri učitavanju faktura'))
      .finally(() => setLoading(false))
  }, [])

  const handleUpdated = (updatedInvoice) => {
    setInvoices((prev) => prev.map((inv) => inv.id === updatedInvoice.id ? updatedInvoice : inv))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <FileText size={44} className="mx-auto mb-4 opacity-30" />
        <p className="text-sm font-medium text-gray-600 mb-1">Nema faktura.</p>
        <p className="text-sm text-gray-400 mb-5">
          Uploadujte dokumente u sekciji Dokumenti.
        </p>
        <button
          onClick={() => navigate('/dokumenti')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <FolderOpen size={16} />
          Idi na Dokumenti
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Dobavljač', 'Broj fakture', 'Datum', 'Osnovica', 'PDV stopa', 'PDV iznos', 'Ukupno', 'Status', 'Plaćeno'].map(
                (h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[160px] truncate">
                  {inv.vendor_name || '—'}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{inv.invoice_number || '—'}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{inv.invoice_date || '—'}</td>
                <td className="px-4 py-3 text-gray-600 text-right whitespace-nowrap">{fmt(inv.base_amount)}</td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  {inv.vat_rate ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {vatRateLabel(inv.vat_rate)}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600 text-right whitespace-nowrap">{fmt(inv.vat_amount)}</td>
                <td className="px-4 py-3 font-semibold text-gray-900 text-right whitespace-nowrap">{fmt(inv.total_amount)}</td>
                <td className="px-4 py-3">
                  <StatusCell invoice={inv} allInvoices={invoices} onUpdated={handleUpdated} />
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {inv.datum_placanja || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Izveštaj Tab ─────────────────────────────────────────────────────────────

function IzvestajTab() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [report, setReport] = useState(null)
  const [avansInvoices, setAvansInvoices] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i)

  const generateReport = async () => {
    setLoading(true)
    setReport(null)
    try {
      const [reportRes, invoicesRes] = await Promise.all([
        client.get('/api/pdv/report', { params: { month, year } }),
        client.get('/api/pdv/invoices'),
      ])
      setReport(reportRes.data)
      setAvansInvoices(invoicesRes.data.filter((inv) => inv.status === 'avans'))
      toast.success('Izveštaj generisan!')
    } catch {
      toast.error('Greška pri generisanju izveštaja')
    } finally {
      setLoading(false)
    }
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const res = await client.post(
        '/api/pdv/report/export',
        null,
        { params: { month, year }, responseType: 'blob' }
      )
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `POPDV_${year}_${String(month).padStart(2, '0')}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV izvezen!')
    } catch {
      toast.error('Greška pri izvozu')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Period picker */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Izaberite period</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs text-gray-500 mb-1">Mesec</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[100px]">
            <label className="block text-xs text-gray-500 mb-1">Godina</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={generateReport}
            disabled={loading}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Generiši izveštaj
          </button>
        </div>
      </div>

      {/* Report card */}
      {report && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-gray-900">
                  POPDV — {MONTHS[report.period_month - 1]} {report.period_year}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Generisan: {new Date(report.generated_at).toLocaleString('sr-RS')}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Uključuje fakture sa statusom{' '}
                  <span className="font-medium text-purple-600">PDV</span> i{' '}
                  <span className="font-medium text-green-600">Plaćeno</span> po datumu fakture
                </p>
              </div>
              <button
                onClick={exportCsv}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Izvezi CSV
              </button>
            </div>

            <div className="space-y-3">
              {/* 20% */}
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Stopa PDV 20%</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Osnovica</p>
                    <p className="text-lg font-bold text-gray-900">{fmt(report.total_base_20)} RSD</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">PDV iznos</p>
                    <p className="text-lg font-bold text-blue-600">{fmt(report.total_vat_20)} RSD</p>
                  </div>
                </div>
              </div>

              {/* 10% */}
              <div className="bg-indigo-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Stopa PDV 10%</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Osnovica</p>
                    <p className="text-lg font-bold text-gray-900">{fmt(report.total_base_10)} RSD</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">PDV iznos</p>
                    <p className="text-lg font-bold text-indigo-600">{fmt(report.total_vat_10)} RSD</p>
                  </div>
                </div>
              </div>

              {/* Grand totals */}
              <div className="bg-gray-900 rounded-lg p-4 text-white">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ukupno</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">Ukupna osnovica</p>
                    <p className="text-base font-bold">{fmt(report.total_base)} RSD</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Ukupan PDV</p>
                    <p className="text-base font-bold text-yellow-400">{fmt(report.total_vat)} RSD</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Ukupno sa PDV</p>
                    <p className="text-base font-bold text-green-400">{fmt(report.total_with_vat)} RSD</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Avansi u toku */}
          <div className="bg-white border border-amber-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle size={16} className="text-amber-500" />
              <h3 className="font-semibold text-gray-900 text-sm">Avansi u toku</h3>
              <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {avansInvoices.length}
              </span>
            </div>

            {avansInvoices.length === 0 ? (
              <p className="text-sm text-gray-400">Nema neopravdanih avansnih faktura.</p>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {avansInvoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{inv.vendor_name || '—'}</p>
                        <p className="text-xs text-gray-400">{inv.invoice_number || ''} · {inv.invoice_date || ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-amber-700">{fmt(inv.total_amount)} RSD</p>
                        <p className="text-xs text-gray-400">PDV: {fmt(inv.vat_amount)} RSD</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-amber-50 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-xs font-semibold text-amber-700">Ukupno neopravdani avansi</span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-amber-800">{fmt(report.total_avans_base)} RSD</span>
                    <p className="text-xs text-amber-600">PDV: {fmt(report.total_avans_vat)} RSD</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PdvPage() {
  const [activeTab, setActiveTab] = useState('fakture')

  return (
    <div>
      <TopBar title="PDV Asistent" />
      <div className="p-6">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
          <button
            onClick={() => setActiveTab('fakture')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'fakture' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={16} />
            Fakture
          </button>
          <button
            onClick={() => setActiveTab('izvestaj')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'izvestaj' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart2 size={16} />
            Izveštaj
          </button>
        </div>

        {activeTab === 'fakture' ? <FaktureTab /> : <IzvestajTab />}
      </div>
    </div>
  )
}
