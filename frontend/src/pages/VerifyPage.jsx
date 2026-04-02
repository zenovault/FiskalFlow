/**
 * Public diploma verification page — accessible without login.
 * Employer scans QR code → lands here → instant verification.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, XCircle, ShieldCheck } from 'lucide-react'
import client from '../api/client'

const NIVO_LABELS = { bachelor: 'Bachelor', master: 'Master', phd: 'PhD / Doktorat', srednja_skola: 'Srednja škola' }

export default function VerifyPage() {
  const { hash } = useParams()
  const [cert, setCert] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    client.get(`/api/trustdoc/verify/${hash}`)
      .then(res => setCert(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [hash])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ShieldCheck size={28} className="text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">TrustDoc</h1>
          </div>
          <p className="text-sm text-gray-500">Verifikacija diplome</p>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
            Proveravam sertifikat...
          </div>
        )}

        {!loading && notFound && (
          <div className="bg-white rounded-2xl border border-red-200 p-8 text-center">
            <XCircle size={56} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-700 mb-2">Nevažeći sertifikat</h2>
            <p className="text-sm text-gray-500">Ovaj sertifikat nije pronađen u bazi ili je poništen.</p>
          </div>
        )}

        {!loading && cert && (
          <div className={`bg-white rounded-2xl border p-8 ${cert.je_validan ? 'border-green-200' : 'border-red-200'}`}>
            <div className="text-center mb-6">
              {cert.je_validan
                ? <CheckCircle size={56} className="text-green-500 mx-auto mb-3" />
                : <XCircle size={56} className="text-red-500 mx-auto mb-3" />
              }
              <h2 className={`text-2xl font-bold ${cert.je_validan ? 'text-green-700' : 'text-red-700'}`}>
                {cert.je_validan ? 'VALIDNA DIPLOMA' : 'PONIŠTENA DIPLOMA'}
              </h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Student</span>
                  <span className="font-semibold text-gray-800">{cert.ime_studenta} {cert.prezime_studenta}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Institucija</span>
                  <span className="font-medium text-right max-w-[60%]">{cert.naziv_institucije}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Diploma</span>
                  <span className="font-medium text-right max-w-[60%]">{cert.naziv_diplome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Nivo</span>
                  <span className="font-medium">{NIVO_LABELS[cert.nivo_obrazovanja] || cert.nivo_obrazovanja}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Datum izdavanja</span>
                  <span className="font-medium">{cert.datum_izdavanja}</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Hash sertifikata</p>
                <p className="font-mono text-xs text-gray-600 break-all">{cert.hash}</p>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-6">
              Verifikovano putem TrustDoc blockchain registra
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
