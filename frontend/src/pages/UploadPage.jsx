/**
 * Upload page — drag-and-drop zone with scan profile selector and processing state progression.
 * On success, navigates to the new invoice's detail page.
 * On 409 duplicate: shows confirmation modal with force-save option.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CheckCircle, Loader2 } from 'lucide-react'
import client from '../api/client'
import UploadZone from '../components/UploadZone'
import ScanConfigPanel from '../components/ScanConfigPanel'
import TopBar from '../components/Layout/TopBar'

const STAGES = [
  'Otpremam sliku...',
  'Čitam tekst (OCR)...',
  'Analiziram sa AI...',
  'Završeno!',
]

export default function UploadPage() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [scanProfile, setScanProfile] = useState('potpuno')
  const [processing, setProcessing] = useState(false)
  const [stage, setStage] = useState(0)
  const [done, setDone] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState(null) // { existing_id, message }

  const handleUpload = async (force = false) => {
    if (!file) return
    setProcessing(true)
    setStage(0)
    setDuplicateInfo(null)

    const stageTimer1 = setTimeout(() => setStage(1), 800)
    const stageTimer2 = setTimeout(() => setStage(2), 2000)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('scan_profile', scanProfile)

    const url = force ? '/api/invoices/upload?force=true' : '/api/invoices/upload'

    try {
      const res = await client.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      clearTimeout(stageTimer1)
      clearTimeout(stageTimer2)
      setStage(3)
      setDone(true)
      setTimeout(() => navigate(`/invoices/${res.data.id}`), 800)
    } catch (err) {
      clearTimeout(stageTimer1)
      clearTimeout(stageTimer2)
      setProcessing(false)
      setStage(0)

      if (err.response?.status === 409) {
        const detail = err.response.data?.detail || {}
        setDuplicateInfo({
          existing_id: detail.existing_id,
          message: detail.message || 'Moguć duplikat pronađen.',
        })
        return
      }

      const msg =
        err.response?.data?.detail?.error ||
        err.response?.data?.detail ||
        'Greška pri obradi fakture'
      toast.error(msg)
    }
  }

  return (
    <div>
      <TopBar title="Upload fakture" />
      <div className="p-6 max-w-xl space-y-5">
        <UploadZone onFileSelected={setFile} disabled={processing} />

        {!processing && (
          <ScanConfigPanel
            selected={scanProfile}
            onChange={setScanProfile}
            disabled={processing}
          />
        )}

        {file && !processing && (
          <button
            onClick={() => handleUpload(false)}
            className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Procesiraj fakturu
          </button>
        )}

        {processing && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            {STAGES.map((s, i) => (
              <div key={s} className={`flex items-center gap-3 py-2 ${i > stage ? 'opacity-30' : ''}`}>
                {i < stage ? (
                  <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                ) : i === stage && !done ? (
                  <Loader2 size={18} className="text-blue-600 animate-spin flex-shrink-0" />
                ) : i === stage && done ? (
                  <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />
                )}
                <span className={`text-sm ${i === stage ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400'}`}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Duplicate detection modal */}
        {duplicateInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-amber-200 p-6 max-w-sm w-full mx-4">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Moguć duplikat</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{duplicateInfo.message}</p>
                  {duplicateInfo.existing_id && (
                    <button
                      onClick={() => navigate(`/invoices/${duplicateInfo.existing_id}`)}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                    >
                      Pogledaj postojeći (ID #{duplicateInfo.existing_id})
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setDuplicateInfo(null); handleUpload(true) }}
                  className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
                >
                  Sačuvaj kao novi
                </button>
                <button
                  onClick={() => setDuplicateInfo(null)}
                  className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Otkaži
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
