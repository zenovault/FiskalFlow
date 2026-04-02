/**
 * Scan profile selector — lets the user choose what the AI should focus on
 * before submitting the upload. Selected profile is sent to the backend as scan_profile.
 */

const PROFILES = [
  {
    id: 'potpuno',
    label: 'Potpuna ekstrakcija',
    description: 'Sva polja — preporučeno za računovodstvo',
  },
  {
    id: 'osnovno',
    label: 'Osnovno',
    description: 'Iznos, datum, izdavalac — brzo',
  },
  {
    id: 'pdv',
    label: 'PDV fokus',
    description: 'Sve PDV stope i iznosi — za poresku prijavu',
  },
  {
    id: 'artikli',
    label: 'Artikli i cene',
    description: 'Detaljna lista stavki sa cenama',
  },
  {
    id: 'placanje',
    label: 'Plaćanje',
    description: 'Način plaćanja, gotovina, kusur',
  },
]

export default function ScanConfigPanel({ selected, onChange, disabled }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Profil ekstrakcije
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PROFILES.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(p.id)}
            className={`text-left px-4 py-3 rounded-lg border transition-colors ${
              selected === p.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-500 ring-1 ring-blue-500'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:hover:border-gray-500 dark:text-gray-400'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <p className={`text-sm font-medium ${selected === p.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}>
              {p.label}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
