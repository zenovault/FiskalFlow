/**
 * Compact invoice summary card for dashboard recent items.
 */

import { useNavigate } from 'react-router-dom'
import { formatCurrency, formatDate, formatDocumentType } from '../utils/formatters'
import ConfidenceBadge from './ConfidenceBadge'

export default function InvoiceCard({ invoice }) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/invoices/${invoice.id}`)}
      className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {invoice.issuer_name || 'Nepoznat izdavalac'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDocumentType(invoice.document_type)} · {invoice.invoice_number || 'Bez broja'}
          </p>
        </div>
        <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
          {formatCurrency(invoice.total_amount, invoice.currency)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{formatDate(invoice.issue_date)}</span>
        <ConfidenceBadge confidence={invoice.confidence} />
      </div>
    </div>
  )
}
