/**
 * Currency and date formatting utilities for invoice display.
 */

/**
 * Format a number as a currency string.
 * @param {number|null} amount
 * @param {string} currency - ISO currency code (default: RSD)
 */
export function formatCurrency(amount, currency = 'RSD') {
  if (amount == null) return '—'
  if (currency === 'RSD') {
    return new Intl.NumberFormat('sr-RS', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' RSD'
  }
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format an ISO date string (YYYY-MM-DD) for display.
 * @param {string|null} dateStr
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${d}.${m}.${y}`
}

/**
 * Format a datetime string for display.
 * @param {string|null} isoStr
 */
export function formatDateTime(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  return d.toLocaleString('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Translate document_type enum to human-readable Serbian label.
 * @param {string|null} type
 */
export function formatDocumentType(type) {
  const map = {
    faktura: 'Faktura',
    gotovinski_racun: 'Gotovinski račun',
    putni_nalog: 'Putni nalog',
    ostalo: 'Ostalo',
  }
  return map[type] || type || '—'
}

/**
 * Translate processing_status to human-readable label.
 * @param {string} status
 */
export function formatStatus(status) {
  const map = {
    pending: 'Na čekanju',
    processing: 'Obrađuje se',
    completed: 'Završeno',
    failed: 'Greška',
  }
  return map[status] || status
}
