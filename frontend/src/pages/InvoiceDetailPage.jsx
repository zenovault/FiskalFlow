/**
 * Invoice detail page — two-column layout with original image and editable extracted data form.
 * Also shows itemized stavke table, PDV breakdown, payment info, and fiscal metadata.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'
import ExtractedDataForm from '../components/ExtractedDataForm'
import TopBar from '../components/Layout/TopBar'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function fmt(n, decimals = 2) {
  if (n == null) return '—'
  return Number(n).toLocaleString('sr-RS', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function PDVTable({ breakdown, ukupan_pdv }) {
  if (!breakdown?.length) return null
  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">PDV Breakdown</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100">
            <th className="text-left py-1">Oznaka</th>
            <th className="text-left py-1">Vrsta</th>
            <th className="text-right py-1">Stopa</th>
            <th className="text-right py-1">Iznos (RSD)</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((pdv, i) => (
            <tr key={i} className="border-b border-gray-50">
              <td className="py-1 font-mono text-xs">{pdv.oznaka}</td>
              <td className="py-1 text-gray-600">{pdv.ime}</td>
              <td className="py-1 text-right font-medium">{pdv.stopa != null ? `${pdv.stopa}%` : '—'}</td>
              <td className="py-1 text-right">{fmt(pdv.iznos)}</td>
            </tr>
          ))}
          {ukupan_pdv != null && (
            <tr className="font-semibold border-t border-gray-200">
              <td colSpan={3} className="py-1.5 text-right text-gray-600 text-xs uppercase">Ukupan PDV</td>
              <td className="py-1.5 text-right">{fmt(ukupan_pdv)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function PaymentBlock({ invoice }) {
  if (!invoice.gotovina && !invoice.povracaj && !invoice.nacin_placanja_detalj) return null
  return (
    <div className="bg-gray-50 rounded-lg p-3 mt-4">
      <p className="text-xs font-medium text-gray-500 uppercase mb-2">Plaćanje</p>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-gray-400 text-xs">Način</p>
          <p className="font-medium capitalize">{invoice.nacin_placanja_detalj || '—'}</p>
        </div>
        {invoice.gotovina != null && (
          <div>
            <p className="text-gray-400 text-xs">Gotovina</p>
            <p className="font-medium">{fmt(invoice.gotovina)} RSD</p>
          </div>
        )}
        {invoice.povracaj != null && invoice.povracaj > 0 && (
          <div>
            <p className="text-gray-400 text-xs">Povraćaj</p>
            <p className="font-medium text-green-600">{fmt(invoice.povracaj)} RSD</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StavkeTable({ stavke, broj_artikala }) {
  if (!stavke?.length) return null
  return (
    <details className="mt-4 bg-white rounded-xl border border-gray-200" open>
      <summary className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800">
        Artikli ({broj_artikala || stavke.length})
      </summary>
      <div className="overflow-x-auto">
        <table className="w-full text-sm px-5">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left px-5 py-1.5">Naziv</th>
              <th className="text-right px-2 py-1.5">Kol.</th>
              <th className="text-right px-2 py-1.5">Cena</th>
              <th className="text-right px-2 py-1.5">PDV</th>
              <th className="text-right px-5 py-1.5">Iznos</th>
            </tr>
          </thead>
          <tbody>
            {stavke.map((item, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-5 py-1.5 text-gray-800">{item.naziv}</td>
                <td className="px-2 py-1.5 text-right text-gray-500">{item.kolicina ?? 1}</td>
                <td className="px-2 py-1.5 text-right">{item.cena != null ? fmt(item.cena) : '—'}</td>
                <td className="px-2 py-1.5 text-right font-mono text-xs text-gray-400">{item.pdv_oznaka || '—'}</td>
                <td className="px-5 py-1.5 text-right font-medium">{item.iznos != null ? fmt(item.iznos) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function FiskalniPodaci({ invoice }) {
  const hasAny = invoice.esir_broj || invoice.kasir || invoice.pfr_broj || invoice.brojac_racuna || invoice.vreme_transakcije
  if (!hasAny) return null
  return (
    <details className="mt-2 bg-white rounded-xl border border-gray-200">
      <summary className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-600">
        Fiskalni podaci
      </summary>
      <div className="px-5 pb-4 mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-500">
        {invoice.esir_broj && <div><span className="text-gray-400">ESIR: </span>{invoice.esir_broj}</div>}
        {invoice.kasir && <div><span className="text-gray-400">Kasir: </span>{invoice.kasir}</div>}
        {invoice.pfr_broj && <div className="col-span-2"><span className="text-gray-400">PFR: </span>{invoice.pfr_broj}</div>}
        {invoice.brojac_racuna && <div className="col-span-2"><span className="text-gray-400">Brojač: </span>{invoice.brojac_racuna}</div>}
        {invoice.vreme_transakcije && <div className="col-span-2"><span className="text-gray-400">Vreme: </span>{invoice.vreme_transakcije}</div>}
      </div>
    </details>
  )
}

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    client.get(`/api/invoices/${id}`)
      .then((res) => setInvoice(res.data))
      .catch(() => setError('Faktura nije pronađena'))
      .finally(() => setLoading(false))
  }, [id])

  const imageUrl = `${API_URL}/api/invoices/${id}/image`

  if (loading) {
    return (
      <div>
        <TopBar title="Detalji fakture" />
        <div className="p-6 text-center text-gray-400">Učitavanje...</div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div>
        <TopBar title="Detalji fakture" />
        <div className="p-6 text-center text-red-500">{error || 'Greška'}</div>
      </div>
    )
  }

  return (
    <div>
      <TopBar title={`Faktura #${invoice.id} — ${invoice.original_filename}`} />
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Original image */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Originalni dokument</p>
            <img
              src={imageUrl}
              alt="Original faktura"
              className="w-full rounded-lg object-contain max-h-[70vh]"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'flex'
              }}
            />
            <div className="hidden w-full h-48 items-center justify-center bg-gray-50 rounded-lg text-gray-400 text-sm">
              Slika nije dostupna
            </div>
          </div>

          {/* Right: Extracted data form + extra panels */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wide">Izvučeni podaci</p>
              <ExtractedDataForm invoice={invoice} onUpdated={setInvoice} />
              <PDVTable breakdown={invoice.pdv_breakdown} ukupan_pdv={invoice.ukupan_pdv} />
              <PaymentBlock invoice={invoice} />
            </div>
            <FiskalniPodaci invoice={invoice} />
          </div>
        </div>

        {/* Artikli table — full width below the two columns */}
        <StavkeTable stavke={invoice.stavke} broj_artikala={invoice.broj_artikala} />

        {/* Raw OCR text */}
        {invoice.raw_ocr_text && (
          <details className="mt-4 bg-white rounded-xl border border-gray-200">
            <summary className="px-5 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:text-gray-900">
              Sirovi OCR tekst
            </summary>
            <pre className="px-5 pb-4 text-xs text-gray-500 whitespace-pre-wrap overflow-x-auto font-mono">
              {invoice.raw_ocr_text}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
