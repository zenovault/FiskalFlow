/**
 * Dokumenti page — unified upload and listing for all document types.
 * Single drag-and-drop zone, auto-detects faktura / racun / putni_nalog.
 */

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  CloudUpload,
  CheckCircle,
  Loader2,
  FileText,
  Receipt,
  Plane,
  HelpCircle,
} from 'lucide-react'
import client from '../api/client'
import TopBar from '../components/Layout/TopBar'

// ─── Constants ───────────────────────────────────────────────────────────────

const DOC_TYPE_META = {
  faktura: {
    label: 'Faktura',
    cls: 'bg-blue-100 text-blue-700',
    Icon: FileText,
  },
  racun: {
    label: 'Račun',
    cls: 'bg-green-100 text-green-700',
    Icon: Receipt,
  },
  putni_nalog: {
    label: 'Putni nalog',
    cls: 'bg-purple-100 text-purple-700',
    Icon: Plane,
  },
  nepoznato: {
    label: 'Nepoznato',
    cls: 'bg-gray-100 text-gray-500',
    Icon: HelpCircle,
  },
}

const FILTER_OPTIONS = [
  { value: null, label: 'Svi dokumenti' },
  { value: 'faktura', label: 'Fakture' },
  { value: 'racun', label: 'Računi' },
  { value: 'putni_nalog', label: 'Putni nalozi' },
]

const STAGES = [
  'Otpremam dokument...',
  'Čitam tekst (OCR)...',
  'Analiziram tip dokumenta...',
  'Završeno!',
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

// ─── Type Badge ───────────────────────────────────────────────────────────────

function DocTypeBadge({ type }) {
  const meta = DOC_TYPE_META[type] || DOC_TYPE_META.nepoznato
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>
      <meta.Icon size={11} />
      {meta.label}
    </span>
  )
}

// ─── Parsed fields card ───────────────────────────────────────────────────────

function ParsedFields({ doc }) {
  if (!doc) return null

  const type = doc.document_type

  if (type === 'faktura') {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Dobavljač" value={doc.vendor_name} />
        <Field label="Broj fakture" value={doc.invoice_number} />
        <Field label="Datum" value={doc.invoice_date} />
        <Field label="Osnovica" value={doc.base_amount != null ? `${fmt(doc.base_amount)} RSD` : null} />
        <Field label="PDV stopa" value={vatRateLabel(doc.vat_rate)} />
        <Field label="PDV iznos" value={doc.vat_amount != null ? `${fmt(doc.vat_amount)} RSD` : null} />
        <Field label="Ukupno" value={doc.total_amount != null ? `${fmt(doc.total_amount)} RSD` : null} highlight />
      </div>
    )
  }

  if (type === 'racun') {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Prodavnica" value={doc.store_name} />
        <Field label="Datum" value={doc.receipt_date} />
        <Field label="PDV iznos" value={doc.vat_amount != null ? `${fmt(doc.vat_amount)} RSD` : null} />
        <Field label="Ukupno" value={doc.total_amount != null ? `${fmt(doc.total_amount)} RSD` : null} highlight />
      </div>
    )
  }

  if (type === 'putni_nalog') {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Zaposleni" value={doc.employee_name} />
        <Field label="Destinacija" value={doc.destination} />
        <Field label="Od datuma" value={doc.date_from} />
        <Field label="Do datuma" value={doc.date_to} />
        <Field label="Svrha" value={doc.purpose} />
      </div>
    )
  }

  return <p className="text-sm text-gray-400">Tip dokumenta nije prepoznat.</p>
}

function Field({ label, value, highlight }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-blue-700' : 'text-gray-800'}`}>
        {value || '—'}
      </p>
    </div>
  )
}

// ─── Upload Zone ─────────────────────────────────────────────────────────────

function UnifiedUploadZone({ onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [stage, setStage] = useState(0)
  const [result, setResult] = useState(null)

  const onDrop = useCallback(
    async (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (!file) return

      setUploading(true)
      setResult(null)
      setStage(0)

      const t1 = setTimeout(() => setStage(1), 700)
      const t2 = setTimeout(() => setStage(2), 1800)

      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await client.post('/api/documents/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        clearTimeout(t1)
        clearTimeout(t2)
        setStage(3)
        setTimeout(() => {
          setUploading(false)
          setStage(0)
          setResult(res.data)
          toast.success('Dokument uspešno obrađen!')
          onUploaded(res.data)
        }, 600)
      } catch (err) {
        clearTimeout(t1)
        clearTimeout(t2)
        setUploading(false)
        setStage(0)
        const msg =
          err.response?.data?.detail?.error ||
          err.response?.data?.detail ||
          'Greška pri obradi dokumenta'
        toast.error(msg)
      }
    },
    [onUploaded]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'] },
    multiple: false,
    disabled: uploading,
  })

  return (
    <div className="mb-6">
      {/* Drop zone */}
      {!uploading && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4 ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          <CloudUpload size={36} className="mx-auto mb-3 text-gray-400" />
          <p className="text-sm font-medium text-gray-700">
            {isDragActive ? 'Otpusti dokument ovde...' : 'Prevuci dokument ili klikni za odabir'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Faktura · Račun · Putni nalog &nbsp;·&nbsp; JPG, PNG, WEBP — max 10MB
          </p>
        </div>
      )}

      {/* Processing stages */}
      {uploading && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          {STAGES.map((s, i) => (
            <div key={s} className={`flex items-center gap-3 py-2 ${i > stage ? 'opacity-30' : ''}`}>
              {i < stage ? (
                <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
              ) : i === stage && stage < 3 ? (
                <Loader2 size={18} className="text-blue-600 animate-spin flex-shrink-0" />
              ) : (
                <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
              )}
              <span className={`text-sm ${i === stage ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                {s}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Result card */}
      {result && !uploading && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle size={18} className="text-green-500" />
            <span className="text-sm font-semibold text-gray-800">Obrađeno</span>
            <DocTypeBadge type={result.document_type} />
            <button
              onClick={() => setResult(null)}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600"
            >
              Zatvori
            </button>
          </div>
          <ParsedFields doc={result} />
        </div>
      )}
    </div>
  )
}

// ─── Documents table ──────────────────────────────────────────────────────────

function DocumentsTable({ documents, loading }) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <FileText size={40} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nema dokumenata. Uploadujte prvi dokument iznad.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Tip', 'Naziv / Dobavljač', 'Broj / Datum', 'Iznos', 'Datum uploada'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DocumentRow({ doc }) {
  const type = doc.document_type

  // Build display values per type
  let name = '—'
  let ref = '—'
  let amount = null

  if (type === 'faktura') {
    name = doc.vendor_name || '—'
    ref = [doc.invoice_number, doc.invoice_date].filter(Boolean).join(' · ') || '—'
    amount = doc.total_amount
  } else if (type === 'racun') {
    name = doc.store_name || '—'
    ref = doc.receipt_date || '—'
    amount = doc.total_amount
  } else if (type === 'putni_nalog') {
    name = doc.employee_name || '—'
    ref = [doc.destination, doc.date_from].filter(Boolean).join(' · ') || '—'
    amount = null
  }

  const uploadDate = new Date(doc.upload_date).toLocaleDateString('sr-RS')

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <DocTypeBadge type={type} />
      </td>
      <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{name}</td>
      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{ref}</td>
      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
        {amount != null ? `${fmt(amount)} RSD` : '—'}
      </td>
      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{uploadDate}</td>
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DokumentiPage() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState(null)

  const fetchDocuments = async (type = null) => {
    setLoading(true)
    try {
      const params = type ? { document_type: type } : {}
      const res = await client.get('/api/documents', { params })
      setDocuments(res.data)
    } catch {
      toast.error('Greška pri učitavanju dokumenata')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments(activeFilter)
  }, [activeFilter])

  const handleUploaded = (newDoc) => {
    // Refresh full list so filters stay consistent
    fetchDocuments(activeFilter)
  }

  return (
    <div>
      <TopBar title="Dokumenti" />
      <div className="p-6">
        <UnifiedUploadZone onUploaded={handleUploaded} />

        {/* Filter buttons */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => setActiveFilter(opt.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <DocumentsTable documents={documents} loading={loading} />
      </div>
    </div>
  )
}
