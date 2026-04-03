/**
 * ValidDoc — blockchain certificate verification module.
 * Three tabs: Izdaj dokument | Moji dokumenti | Proveri QR
 */

import { useState } from 'react'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { ShieldCheck, Copy, CheckCircle, XCircle, QrCode, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../api/client'
import TopBar from '../components/Layout/TopBar'

const TABS = ['Izdaj dokument', 'Moji dokumenti', 'Proveri QR']

const DOC_TYPES = [
  {
    value: 'diploma',
    label: 'Diploma',
    sublabel: 'Sertifikat obrazovanja',
    needs_person: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 8h10M7 11h6"/>
      </svg>
    ),
  },
  {
    value: 'ugovor',
    label: 'Ugovor',
    sublabel: 'O radu ili poslovni',
    needs_person: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
    ),
  },
  {
    value: 'punomoce',
    label: 'Punomoćje',
    sublabel: 'Ovlašćenje lica',
    needs_person: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    value: 'izvod',
    label: 'Izvod iz APR',
    sublabel: 'Registracija firme',
    needs_person: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    value: 'resenje',
    label: 'Rešenje',
    sublabel: 'Poresko ili sudsko',
    needs_person: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  },
  {
    value: 'overena_kopija',
    label: 'Overena kopija',
    sublabel: 'Overeni dokument',
    needs_person: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
  {
    value: 'faktura_dok',
    label: 'Faktura',
    sublabel: 'Verifikovana faktura',
    needs_person: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
]

const TIP_COLORS = {
  diploma: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
  ugovor: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  punomoce: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  izvod: 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300',
  resenje: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  overena_kopija: 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  faktura_dok: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
}

const fieldClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500'
const labelClass = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

// ─── Tab 1: Issue ────────────────────────────────────────────────────────────

function IssueTab() {
  const [tipDokumenta, setTipDokumenta] = useState('diploma')
  const [form, setForm] = useState({
    ime_lica: '', prezime_lica: '',
    naziv_institucije: '', naziv_dokumenta: '',
    broj_dokumenta: '', datum_izdavanja: '',
    nivo_obrazovanja: '', napomena: '',
    prosek: '',
    vrsta_ugovora: '', datum_isteka: '', druga_strana: '', vrednost_ugovora: '',
    punomocnik: '', notar: '',
    pib: '', maticni_broj: '', pravna_forma: '', registarski_sud: '',
    organ_izdavanja: '', datum_pravnosnaznosti: '',
    iznos: '', pdv_iznos: '', pib_izdavaoca: '',
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const setF = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }))

  const handleMint = async () => {
    if (!form.naziv_institucije || !form.naziv_dokumenta || !form.broj_dokumenta || !form.datum_izdavanja) {
      toast.error('Popunite sva obavezna polja')
      return
    }
    const needsPerson = DOC_TYPES.find(d => d.value === tipDokumenta)?.needs_person
    if (needsPerson && !form.ime_lica) {
      toast.error('Popunite ime')
      return
    }
    setLoading(true)
    try {
      const payload = {
        naziv_institucije: form.naziv_institucije,
        naziv_dokumenta: form.naziv_dokumenta,
        naziv_diplome: form.naziv_dokumenta,
        broj_diplome: form.broj_dokumenta,
        datum_izdavanja: form.datum_izdavanja,
        tip_dokumenta: tipDokumenta,
        ime_lica: needsPerson ? (form.ime_lica || null) : null,
        prezime_lica: needsPerson ? (form.prezime_lica || null) : null,
        ime_studenta: needsPerson ? (form.ime_lica || null) : null,
        prezime_studenta: needsPerson ? (form.prezime_lica || null) : null,
        nivo_obrazovanja: form.nivo_obrazovanja || null,
        napomena: form.napomena || null,
      }
      const res = await client.post('/api/validoc/mint', payload)
      setResult(res.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Greška pri izdavanju')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    const isPending = result.chain_status === 'pending_chain'
    const qrUrl = result.qr_data || result.verification_url
    const txShort = result.tx_hash && result.tx_hash.length > 14
      ? result.tx_hash.slice(0, 10) + '…' + result.tx_hash.slice(-6)
      : result.tx_hash
    return (
      <div className="max-w-md mx-auto">
        <div className="text-center p-6 border border-green-200 dark:border-green-800 rounded-xl bg-green-50 dark:bg-green-900/20">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
          <h3 className="font-semibold text-lg text-green-800 dark:text-green-300 mb-1">Dokument je registrovan</h3>
          <p className="text-sm text-green-600 dark:text-green-400 mb-1">{result.naziv_institucije} — {result.naziv_diplome}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{result.ime_studenta} {result.prezime_studenta}</p>

          {isPending ? (
            <div className="mb-4 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
              Dokument sačuvan lokalno. Blockchain upis će biti pokušan ponovo.
            </div>
          ) : (
            result.polygonscan_url && (
              <a
                href={result.polygonscan_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mb-4 text-xs text-blue-600 hover:underline font-mono"
              >
                <ExternalLink size={11} />
                {txShort}
              </a>
            )
          )}

          <div className="flex justify-center mb-4 bg-white p-3 rounded-lg">
            <QRCodeSVG value={qrUrl} size={180} />
          </div>
          <p className="text-xs text-gray-400 font-mono mb-4">{result.hash.slice(0, 24)}...</p>
          <button
            onClick={() => { navigator.clipboard.writeText(qrUrl); toast.success('Link kopiran') }}
            className="flex items-center gap-2 mx-auto text-sm border border-green-300 dark:border-green-700 rounded-lg px-4 py-2 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
          >
            <Copy size={14} />
            Kopiraj link za verifikaciju
          </button>
          <button
            onClick={() => setResult(null)}
            className="mt-3 text-xs text-gray-400 hover:text-gray-600 block mx-auto"
          >
            Izdaj novi dokument
          </button>
        </div>
      </div>
    )
  }

  const needsPerson = DOC_TYPES.find(d => d.value === tipDokumenta)?.needs_person

  return (
    <div className="max-w-lg space-y-4">
      {/* Document type selector */}
      <div className="grid grid-cols-4 gap-2 mb-8">
        {DOC_TYPES.map(dt => (
          <button
            key={dt.value}
            type="button"
            onClick={() => setTipDokumenta(dt.value)}
            className={`p-4 rounded-xl border text-left transition-all ${
              tipDokumenta === dt.value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500 text-gray-600 dark:text-gray-400'
            }`}
          >
            <div className={`mb-2 ${tipDokumenta === dt.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {dt.icon}
            </div>
            <div className="font-medium text-sm leading-tight text-gray-800 dark:text-gray-200">{dt.label}</div>
            <div className="text-xs mt-0.5 text-gray-400 dark:text-gray-500">{dt.sublabel}</div>
          </button>
        ))}
      </div>

      {/* Form fields */}
      <div className="space-y-4">

        {/* Person fields */}
        {needsPerson && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Ime *</label>
              <input value={form.ime_lica} onChange={setF('ime_lica')} placeholder="Petar" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Prezime *</label>
              <input value={form.prezime_lica} onChange={setF('prezime_lica')} placeholder="Petrović" className={fieldClass} />
            </div>
          </div>
        )}

        {/* Naziv institucije */}
        <div>
          <label className={labelClass}>
            {tipDokumenta === 'izvod' ? 'Naziv kompanije *' : 'Naziv institucije *'}
          </label>
          <input
            value={form.naziv_institucije}
            onChange={setF('naziv_institucije')}
            placeholder={tipDokumenta === 'izvod' ? 'Moja Firma DOO' : 'Elektrotehnički fakultet Beograd'}
            className={fieldClass}
          />
        </div>

        {/* Naziv dokumenta */}
        <div>
          <label className={labelClass}>Naziv dokumenta *</label>
          <input
            value={form.naziv_dokumenta}
            onChange={setF('naziv_dokumenta')}
            placeholder={
              tipDokumenta === 'diploma' ? 'Master informatike' :
              tipDokumenta === 'ugovor' ? 'Ugovor o radu — Senior developer' :
              tipDokumenta === 'punomoce' ? 'Punomoćje za zastupanje pred sudom' :
              tipDokumenta === 'izvod' ? 'Izvod iz registra privrednih subjekata' :
              tipDokumenta === 'resenje' ? 'Rešenje o registraciji PDV obveznika' :
              tipDokumenta === 'overena_kopija' ? 'Overena kopija pasoša' :
              'Faktura br. 2026/001'
            }
            className={fieldClass}
          />
        </div>

        {/* Broj dokumenta + Datum */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Broj dokumenta *</label>
            <input
              value={form.broj_dokumenta}
              onChange={setF('broj_dokumenta')}
              placeholder={
                tipDokumenta === 'diploma' ? 'ETF-2024-1234' :
                tipDokumenta === 'ugovor' ? 'HR-2026-0042' :
                tipDokumenta === 'izvod' ? 'APR-BD-123456' :
                'DOC-2026-001'
              }
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Datum izdavanja *</label>
            <input
              type="date"
              value={form.datum_izdavanja}
              onChange={setF('datum_izdavanja')}
              className={fieldClass}
              style={{colorScheme: 'dark'}}
            />
          </div>
        </div>

        {/* DIPLOMA-specific */}
        {tipDokumenta === 'diploma' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Nivo obrazovanja</label>
              <select value={form.nivo_obrazovanja} onChange={setF('nivo_obrazovanja')} className={fieldClass}>
                <option value="">Odaberi nivo</option>
                <option value="srednja_skola">Srednja škola</option>
                <option value="bachelor">Bachelor (OSS)</option>
                <option value="master">Master (MSS)</option>
                <option value="phd">Doktorat (PhD)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Prosek ocena</label>
              <input value={form.prosek} onChange={setF('prosek')} placeholder="9.45" className={fieldClass} />
            </div>
          </div>
        )}

        {/* UGOVOR-specific */}
        {tipDokumenta === 'ugovor' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Vrsta ugovora</label>
                <select value={form.vrsta_ugovora} onChange={setF('vrsta_ugovora')} className={fieldClass}>
                  <option value="">Odaberi vrstu</option>
                  <option value="ugovor_o_radu">Ugovor o radu</option>
                  <option value="ugovor_o_delu">Ugovor o delu</option>
                  <option value="ugovor_o_saradnji">Ugovor o saradnji</option>
                  <option value="ugovor_o_zakupu">Ugovor o zakupu</option>
                  <option value="kupoprodajni">Kupoprodajni ugovor</option>
                  <option value="nda">NDA — Ugovor o poverljivosti</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Datum isteka</label>
                <input type="date" value={form.datum_isteka} onChange={setF('datum_isteka')} className={fieldClass} style={{colorScheme: 'dark'}} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Ugovorna strana 2</label>
                <input value={form.druga_strana} onChange={setF('druga_strana')} placeholder="Ime i prezime ili firma" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Vrednost ugovora (RSD)</label>
                <input value={form.vrednost_ugovora} onChange={setF('vrednost_ugovora')} placeholder="120000.00" className={fieldClass} />
              </div>
            </div>
          </div>
        )}

        {/* PUNOMOĆJE-specific */}
        {tipDokumenta === 'punomoce' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Punomoćnik</label>
              <input value={form.punomocnik} onChange={setF('punomocnik')} placeholder="Advokat Marko Marković" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Overio notar</label>
              <input value={form.notar} onChange={setF('notar')} placeholder="Notar Beograd 3" className={fieldClass} />
            </div>
          </div>
        )}

        {/* IZVOD-specific */}
        {tipDokumenta === 'izvod' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>PIB</label>
                <input value={form.pib} onChange={setF('pib')} placeholder="123456789" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Matični broj</label>
                <input value={form.maticni_broj} onChange={setF('maticni_broj')} placeholder="12345678" className={fieldClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Pravna forma</label>
                <select value={form.pravna_forma} onChange={setF('pravna_forma')} className={fieldClass}>
                  <option value="">Odaberi formu</option>
                  <option value="doo">DOO</option>
                  <option value="ad">AD</option>
                  <option value="pr">PR — Preduzetnik</option>
                  <option value="ou">OU — Ortačko udruženje</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Registarski sud</label>
                <input value={form.registarski_sud} onChange={setF('registarski_sud')} placeholder="Privredni sud u Beogradu" className={fieldClass} />
              </div>
            </div>
          </div>
        )}

        {/* REŠENJE-specific */}
        {tipDokumenta === 'resenje' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Organ koji je izdao</label>
              <input value={form.organ_izdavanja} onChange={setF('organ_izdavanja')} placeholder="Poreska uprava Beograd" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Datum pravnosnažnosti</label>
              <input type="date" value={form.datum_pravnosnaznosti} onChange={setF('datum_pravnosnaznosti')} className={fieldClass} style={{colorScheme: 'dark'}} />
            </div>
          </div>
        )}

        {/* FAKTURA DOK-specific */}
        {tipDokumenta === 'faktura_dok' && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Iznos (RSD)</label>
              <input value={form.iznos} onChange={setF('iznos')} placeholder="250000.00" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>PDV iznos (RSD)</label>
              <input value={form.pdv_iznos} onChange={setF('pdv_iznos')} placeholder="41667.00" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>PIB izdavaoca</label>
              <input value={form.pib_izdavaoca} onChange={setF('pib_izdavaoca')} placeholder="103482050" className={fieldClass} />
            </div>
          </div>
        )}

        {/* Napomena */}
        <div>
          <label className={labelClass}>Napomena (opciono)</label>
          <textarea
            value={form.napomena}
            onChange={setF('napomena')}
            placeholder="Dodatne informacije o dokumentu..."
            rows={2}
            className={`${fieldClass} resize-none`}
          />
        </div>

        <button
          onClick={handleMint}
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Upisivanje na Polygon mrežu... (~10 sek)' : 'Registruj dokument na blockchain-u'}
        </button>
      </div>
    </div>
  )
}

// ─── Tab 2: My Certificates ──────────────────────────────────────────────────

function MyCertsTab({ onQr }) {
  const [certs, setCerts] = useState(null)
  const [revoking, setRevoking] = useState(null)
  const [confirmRevoke, setConfirmRevoke] = useState(null)
  const [verifying, setVerifying] = useState(null)   // cert id being verified
  const [verifyResults, setVerifyResults] = useState({}) // id -> result

  const load = async () => {
    const res = await client.get('/api/validoc/list')
    setCerts(res.data)
  }

  if (certs === null) {
    load().catch(() => setCerts([]))
    return <div className="text-center py-8 text-gray-400">Učitavanje...</div>
  }

  const handleRevoke = async (hash) => {
    setRevoking(hash)
    try {
      await client.post(`/api/validoc/revoke/${hash}`)
      toast.success('Sertifikat poništen')
      setCerts(null)
    } catch {
      toast.error('Greška pri poništavanju')
    } finally {
      setRevoking(null)
      setConfirmRevoke(null)
    }
  }

  const copyLink = async (hash) => {
    const url = `${window.location.origin}/verify/${hash}`
    await navigator.clipboard.writeText(url)
    toast.success('Link kopiran u clipboard!')
  }

  const handleVerifyChain = async (cert) => {
    setVerifying(cert.id)
    try {
      const res = await client.get(`/api/validoc/verify-chain/${cert.id}`)
      setVerifyResults(prev => ({ ...prev, [cert.id]: res.data }))
    } catch {
      setVerifyResults(prev => ({ ...prev, [cert.id]: { verified: null, error: 'Greška' } }))
    } finally {
      setVerifying(null)
    }
  }

  if (certs.length === 0) {
    return <p className="text-gray-400 text-sm">Još nema izdatih dokumenata.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <th className="text-left px-4 py-2">Tip</th>
            <th className="text-left px-4 py-2">Lice / Institucija</th>
            <th className="text-left px-4 py-2">Dokument</th>
            <th className="text-left px-4 py-2">Datum</th>
            <th className="text-left px-4 py-2">Status</th>
            <th className="text-left px-4 py-2">Akcije</th>
          </tr>
        </thead>
        <tbody>
          {certs.map((c) => (
            <tr key={c.hash} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TIP_COLORS[c.tip_dokumenta] || TIP_COLORS.diploma}`}>
                  {DOC_TYPES.find(d => d.value === c.tip_dokumenta)?.label || c.tip_dokumenta || 'Diploma'}
                </span>
              </td>
              <td className="px-4 py-3 dark:text-gray-300">
                {[c.ime_studenta, c.prezime_studenta].filter(Boolean).join(' ') || c.naziv_institucije}
              </td>
              <td className="px-4 py-3 dark:text-gray-300">{c.naziv_dokumenta || c.naziv_diplome}</td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.datum_izdavanja}</td>
              <td className="px-4 py-3">
                {c.je_validan
                  ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">Važeći</span>
                  : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">Poništen</span>
                }
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1">
                  <button onClick={() => copyLink(c.hash)} title="Kopiraj link"
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 hover:text-blue-600 transition-colors">
                    <Copy size={14} />
                  </button>
                  <button onClick={() => onQr(c)} title="Prikaži QR"
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 hover:text-blue-600 transition-colors">
                    <QrCode size={14} />
                  </button>
                  <button onClick={() => window.open(`/verify/${c.hash}`, '_blank')} title="Otvori verifikaciju"
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 hover:text-green-600 transition-colors">
                    <ExternalLink size={14} />
                  </button>
                  {c.polygonscan_url && (
                    <a href={c.polygonscan_url} target="_blank" rel="noopener noreferrer"
                      title="Otvori PolygonScan"
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 hover:text-purple-600 transition-colors">
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button
                    onClick={() => handleVerifyChain(c)}
                    disabled={verifying === c.id}
                    title="Verifikuj na blockchain-u"
                    className="text-xs px-2 py-1 rounded border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-40 transition-colors"
                  >
                    {verifying === c.id ? '...' : 'Verifikuj'}
                  </button>
                  {verifyResults[c.id] && (
                    verifyResults[c.id].verified === true
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">Na lancu</span>
                      : verifyResults[c.id].verified === false
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">Nije na lancu</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">Nedostupan</span>
                  )}
                  {c.je_validan && (
                    confirmRevoke === c.hash ? (
                      <div className="flex items-center gap-2 ml-1">
                        <span className="text-xs text-red-600">Sigurno?</span>
                        <button
                          onClick={() => handleRevoke(c.hash)}
                          disabled={revoking === c.hash}
                          className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          Da
                        </button>
                        <button onClick={() => setConfirmRevoke(null)}
                          className="text-xs px-2 py-1 border dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">
                          Ne
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRevoke(c.hash)}
                        title="Poništi"
                        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 hover:text-red-600 transition-colors">
                        <XCircle size={14} />
                      </button>
                    )
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Tab 3: Verify QR ────────────────────────────────────────────────────────

function VerifyTab() {
  const [hash, setHash] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const handleVerify = async () => {
    if (!hash.trim()) return
    setLoading(true)
    setResult(null)
    setNotFound(false)
    try {
      const res = await client.get(`/api/validoc/verify/${hash.trim()}`)
      setResult(res.data)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <div>
        <label className={labelClass}>Hash sertifikata ili skenirani QR link</label>
        <input
          className={fieldClass}
          value={hash}
          onChange={e => setHash(e.target.value)}
          placeholder="Unesite hash..."
          onKeyDown={e => e.key === 'Enter' && handleVerify()}
        />
      </div>
      <button
        onClick={handleVerify}
        disabled={loading}
        className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Proveravam...' : 'Proveri sertifikat'}
      </button>

      {result && (
        <div className={`p-5 rounded-xl border ${result.je_validan ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
          {result.je_validan
            ? <CheckCircle size={32} className="text-green-500 mb-2" />
            : <XCircle size={32} className="text-red-500 mb-2" />
          }
          <p className={`font-semibold text-lg ${result.je_validan ? 'text-green-800 dark:text-green-300' : 'text-red-700 dark:text-red-400'}`}>
            {result.je_validan ? 'VALIDAN DOKUMENT' : 'PONIŠTEN DOKUMENT'}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{result.ime_studenta} {result.prezime_studenta}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{result.naziv_institucije}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{result.naziv_diplome}</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Datum: {result.datum_izdavanja}</p>
        </div>
      )}

      {notFound && (
        <div className="p-5 rounded-xl border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <XCircle size={32} className="text-red-500 mb-2" />
          <p className="font-semibold text-red-700 dark:text-red-400">Sertifikat nije pronađen ili je nevažeći</p>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TrustDocPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [qrDoc, setQrDoc] = useState(null)

  const copyLink = async (hash) => {
    const url = `${window.location.origin}/verify/${hash}`
    await navigator.clipboard.writeText(url)
    toast.success('Link kopiran u clipboard!')
  }

  const downloadQR = () => {
    const canvas = document.getElementById('cert-qr')
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `validoc-qr-${qrDoc.hash.slice(0,8)}.png`
    a.click()
    toast.success('QR kod preuzet')
  }

  return (
    <div>
      <TopBar title="ValidDoc — Verifikacija dokumenata" />
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck size={20} className="text-blue-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Blockchain verifikacija diploma i sertifikata. Poslodavac proverava diplomu za 3 sekunde — bez poziva fakultetu.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit mb-6">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === i
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 0 && <IssueTab />}
        {activeTab === 1 && <MyCertsTab onQr={setQrDoc} />}
        {activeTab === 2 && <VerifyTab />}
      </div>

      {/* QR Modal */}
      {qrDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => setQrDoc(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{qrDoc.naziv_dokumenta || qrDoc.naziv_diplome}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{qrDoc.naziv_institucije}</p>
              </div>
              <button onClick={() => setQrDoc(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">✕</button>
            </div>
            <div className="flex justify-center mb-4 p-4 bg-white rounded-xl">
              <QRCodeCanvas id="cert-qr" value={`${window.location.origin}/verify/${qrDoc.hash}`}
                size={200} level="H" includeMargin={true} />
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 mb-4">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Hash dokumenta</p>
              <p className="text-xs font-mono text-gray-600 dark:text-gray-300 break-all">{qrDoc.hash}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => copyLink(qrDoc.hash)}
                className="flex items-center justify-center gap-2 py-2 px-3 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                <Copy size={14} /> Kopiraj link
              </button>
              <button onClick={downloadQR}
                className="flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                <QrCode size={14} /> Preuzmi QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
