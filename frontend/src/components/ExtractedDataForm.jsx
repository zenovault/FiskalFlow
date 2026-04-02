/**
 * Editable form displaying all fields extracted from an invoice.
 * Calls PATCH endpoint on save. Supports delete with confirmation.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Save, Trash2, Download } from 'lucide-react'
import client from '../api/client'
import ConfidenceBadge from './ConfidenceBadge'

const DOCUMENT_TYPES = ['faktura', 'gotovinski_racun', 'putni_nalog', 'ostalo']
const CURRENCIES = ['RSD', 'EUR', 'USD', 'BAM']

export default function ExtractedDataForm({ invoice, onUpdated }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    invoice_number: invoice.invoice_number || '',
    issue_date: invoice.issue_date || '',
    issuer_name: invoice.issuer_name || '',
    issuer_pib: invoice.issuer_pib || '',
    total_amount: invoice.total_amount != null ? Number(invoice.total_amount).toFixed(2) : '',
    vat_amount: invoice.vat_amount != null ? Number(invoice.vat_amount).toFixed(2) : '',
    currency: invoice.currency || 'RSD',
    document_type: invoice.document_type || 'ostalo',
    manually_verified: invoice.manually_verified || false,
    interni_broj: invoice.interni_broj || '',
    tip_fakture: invoice.tip_fakture || 'ulazna',
    avans_primljen: invoice.avans_primljen != null ? Number(invoice.avans_primljen).toFixed(2) : '',
    avans_opravdan: invoice.avans_opravdan != null ? Number(invoice.avans_opravdan).toFixed(2) : '',
    avans_datum_primanja: invoice.avans_datum_primanja || '',
    avans_datum_opravdanja: invoice.avans_datum_opravdanja || '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [field]: val }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        total_amount: form.total_amount !== '' ? parseFloat(form.total_amount) : null,
        vat_amount: form.vat_amount !== '' ? parseFloat(form.vat_amount) : null,
        avans_primljen: form.avans_primljen !== '' ? parseFloat(form.avans_primljen) : null,
        avans_opravdan: form.avans_opravdan !== '' ? parseFloat(form.avans_opravdan) : null,
        interni_broj: form.interni_broj || null,
        avans_datum_primanja: form.avans_datum_primanja || null,
        avans_datum_opravdanja: form.avans_datum_opravdanja || null,
      }
      const res = await client.patch(`/api/invoices/${invoice.id}`, payload)
      onUpdated(res.data)
      toast.success('Sačuvano')
    } catch (err) {
      const msg = err.response?.data?.detail?.error || 'Greška pri čuvanju'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await client.delete(`/api/invoices/${invoice.id}`)
      toast.success('Faktura obrisana')
      navigate('/invoices')
    } catch (err) {
      toast.error('Greška pri brisanju')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleExportSingle = async () => {
    try {
      const res = await client.get(`/api/invoices/export/csv`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `racun_${invoice.id}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Greška pri izvozu')
    }
  }

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const labelClass = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <ConfidenceBadge confidence={invoice.confidence} />
        <span className="text-xs text-gray-400">ID #{invoice.id}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Tip dokumenta</label>
          <select className={inputClass} value={form.document_type} onChange={set('document_type')}>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Broj dokumenta</label>
          <input className={inputClass} value={form.invoice_number} onChange={set('invoice_number')} placeholder="npr. 2024/001" />
        </div>
        <div>
          <label className={labelClass}>Datum izdavanja</label>
          <input className={inputClass} type="date" value={form.issue_date} onChange={set('issue_date')} />
        </div>
        <div>
          <label className={labelClass}>Valuta</label>
          <select className={inputClass} value={form.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Naziv izdavaoca</label>
        <input className={inputClass} value={form.issuer_name} onChange={set('issuer_name')} placeholder="Naziv firme" />
      </div>
      <div>
        <label className={labelClass}>PIB izdavaoca</label>
        <input className={inputClass} value={form.issuer_pib} onChange={set('issuer_pib')} placeholder="9 cifara" maxLength={9} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Ukupan iznos</label>
          <input className={inputClass} type="number" step="0.01" value={form.total_amount} onChange={set('total_amount')} placeholder="0.00" />
        </div>
        <div>
          <label className={labelClass}>PDV iznos</label>
          <input className={inputClass} type="number" step="0.01" value={form.vat_amount} onChange={set('vat_amount')} placeholder="0.00" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="verified"
          type="checkbox"
          checked={form.manually_verified}
          onChange={set('manually_verified')}
          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
        <label htmlFor="verified" className="text-sm text-gray-700">Ručno provereno</label>
      </div>

      {/* Accounting section */}
      <div className="border-t border-gray-100 pt-4 mt-2">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Računovodstveni podaci</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className={labelClass}>Interni broj / radni nalog</label>
            <input
              className={inputClass}
              value={form.interni_broj}
              onChange={set('interni_broj')}
              placeholder="npr. RN-2024-001"
            />
          </div>
          <div>
            <label className={labelClass}>Tip fakture</label>
            <select className={inputClass} value={form.tip_fakture} onChange={set('tip_fakture')}>
              <option value="ulazna">Ulazna (primamo)</option>
              <option value="izlazna">Izlazna (šaljemo)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Avans section */}
      <div className="border border-amber-100 bg-amber-50 rounded-lg p-3">
        <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-3">Avansi</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Avans primljen (RSD)</label>
            <input
              type="number"
              step="0.01"
              value={form.avans_primljen}
              onChange={set('avans_primljen')}
              placeholder="0.00"
              className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Datum primanja</label>
            <input
              type="date"
              value={form.avans_datum_primanja}
              onChange={set('avans_datum_primanja')}
              className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Avans opravdan (RSD)</label>
            <input
              type="number"
              step="0.01"
              value={form.avans_opravdan}
              onChange={set('avans_opravdan')}
              placeholder="0.00"
              className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Datum opravdanja</label>
            <input
              type="date"
              value={form.avans_datum_opravdanja}
              onChange={set('avans_datum_opravdanja')}
              className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
        </div>
        {form.total_amount !== '' && (
          <div className="mt-3 pt-3 border-t border-amber-200 flex justify-between items-center">
            <span className="text-sm text-amber-800 font-medium">Preostalo za naplatu:</span>
            <span className="text-lg font-semibold text-amber-900">
              {(parseFloat(form.total_amount || 0) - parseFloat(form.avans_primljen || 0))
                .toLocaleString('sr-RS', { minimumFractionDigits: 2 })} RSD
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Save size={16} />
          {saving ? 'Čuva se...' : 'Sačuvaj'}
        </button>

        <button
          onClick={handleExportSingle}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <Download size={16} />
          Izvezi CSV
        </button>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
          >
            <Trash2 size={16} />
            Obriši
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-600">Sigurno?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleting ? 'Briše se...' : 'Da, obriši'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Otkaži
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
