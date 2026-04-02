/**
 * Colored confidence pill displaying OCR/AI extraction confidence.
 * Green >= 0.8, Yellow 0.5-0.79, Red < 0.5
 */

export default function ConfidenceBadge({ confidence }) {
  if (confidence == null) return null

  const pct = Math.round(confidence * 100)

  let className, label
  if (confidence >= 0.8) {
    className = 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
    label = `Visoka pouzdanost (${pct}%)`
  } else if (confidence >= 0.5) {
    className = 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400'
    label = `Srednja pouzdanost (${pct}%)`
  } else {
    className = 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
    label = `Niska pouzdanost (${pct}%) — preporučuje se provera`
  }

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${className}`}>
      {label}
    </span>
  )
}
