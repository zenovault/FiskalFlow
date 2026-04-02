/**
 * Invoice list table using TanStack Table v8.
 * Displays key invoice fields with clickable rows.
 */

import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'
import { useNavigate } from 'react-router-dom'
import { formatCurrency, formatDate, formatDocumentType, formatStatus } from '../utils/formatters'
import ConfidenceBadge from './ConfidenceBadge'

const columns = [
  {
    accessorKey: 'issue_date',
    header: 'Datum',
    cell: ({ getValue }) => formatDate(getValue()),
  },
  {
    accessorKey: 'issuer_name',
    header: 'Izdavalac',
    cell: ({ getValue }) => {
      const v = getValue() || '—'
      const truncated = v.length > 24 ? v.slice(0, 24) + '…' : v
      return <span title={v}>{truncated}</span>
    },
  },
  {
    accessorKey: 'invoice_number',
    header: 'Broj dokumenta',
    cell: ({ getValue }) => getValue() || '—',
  },
  {
    accessorKey: 'total_amount',
    header: () => <span className="block text-right">Ukupno</span>,
    cell: ({ row }) => <span className="block text-right tabular-nums">{formatCurrency(row.original.total_amount, row.original.currency)}</span>,
  },
  {
    accessorKey: 'vat_amount',
    header: () => <span className="block text-right">PDV</span>,
    cell: ({ row }) => <span className="block text-right tabular-nums">{formatCurrency(row.original.vat_amount, row.original.currency)}</span>,
  },
  {
    accessorKey: 'confidence',
    header: 'Pouzdanost',
    cell: ({ getValue }) => <span className="block max-w-[80px] overflow-hidden"><ConfidenceBadge confidence={getValue()} /></span>,
  },
  {
    accessorKey: 'interni_broj',
    header: 'Interni br.',
    cell: ({ getValue }) => (
      <span className="text-xs text-gray-500 font-mono">{getValue() || '—'}</span>
    ),
  },
  {
    accessorKey: 'tip_fakture',
    header: 'Tip',
    cell: ({ getValue }) => {
      const tip = getValue() || 'ulazna'
      return tip === 'izlazna'
        ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Izlazna</span>
        : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">Ulazna</span>
    },
  },
  {
    accessorKey: 'avans_primljen',
    header: () => <span className="block text-right">Avans</span>,
    cell: ({ getValue }) => {
      const v = getValue()
      return v != null
        ? <span className="block text-right tabular-nums">{Number(v).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} RSD</span>
        : <span className="block text-right text-gray-300">—</span>
    },
  },
  {
    accessorKey: 'preostalo_za_naplatu',
    header: () => <span className="block text-right">Preostalo</span>,
    cell: ({ getValue }) => {
      const val = getValue()
      if (val == null) return <span className="block text-right text-gray-300">—</span>
      return (
        <span className={`block text-right tabular-nums font-medium ${val > 0 ? 'text-amber-600' : 'text-green-600'}`}>
          {Number(val).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} RSD
        </span>
      )
    },
  },
  {
    accessorKey: 'processing_status',
    header: 'Status',
    cell: ({ getValue }) => {
      const status = getValue()
      const colors = {
        completed: 'text-green-600',
        failed: 'text-red-600',
        processing: 'text-blue-600',
        pending: 'text-gray-500',
      }
      return (
        <span className={`text-sm font-medium ${colors[status] || 'text-gray-500'}`}>
          {formatStatus(status)}
        </span>
      )
    },
  },
]

export default function InvoiceTable({ invoices }) {
  const navigate = useNavigate()

  const table = useReactTable({
    data: invoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nema pronađenih računa.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => navigate(`/invoices/${row.original.id}`)}
              className="border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
