/**
 * Drag-and-drop file upload zone using react-dropzone.
 */

import { useDropzone } from 'react-dropzone'
import { Upload, ImageIcon } from 'lucide-react'

const ACCEPTED = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/bmp': ['.bmp'],
  'image/tiff': ['.tiff'],
}

export default function UploadZone({ onFileSelected, disabled }) {
  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    accept: ACCEPTED,
    maxFiles: 1,
    disabled,
    onDrop: (files) => {
      if (files.length > 0) onFileSelected(files[0])
    },
  })

  const preview = acceptedFiles[0]

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-3 text-gray-400" size={40} />
        <p className="text-gray-700 dark:text-gray-300 font-medium">
          {isDragActive
            ? 'Otpustite fajl ovde...'
            : 'Prevucite fakturu ovde ili kliknite za odabir'}
        </p>
        <p className="text-gray-400 text-sm mt-1">JPG, PNG, WEBP, BMP, TIFF · Max 10MB</p>
      </div>

      {preview && (
        <div className="mt-4 flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <ImageIcon size={20} className="text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{preview.name}</p>
            <p className="text-xs text-gray-400">{(preview.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
      )}
    </div>
  )
}
