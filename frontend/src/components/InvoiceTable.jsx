/**
 * Invoice list table — TanStack Table v8 for rendering.
 * Client-side sort (header click: ASC → DESC → off) + inline column filter dropdowns.
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'
import { useNavigate } from 'react-router-dom'
import { formatCurrency, formatDate, formatStatus } from '../utils/formatters'
import ConfidenceBadge from './ConfidenceBadge'

// Columns that support sorting and what filter UI to show
const SORTABLE = new Set(['issue_date', 'issuer_name', 'invoice_number', 'total_amount', 'vat_amount', 'tip_fakture', 'processing_status'])
const FILTER_TYPE = {
  issue_date: 'text',
  issuer_name: 'text',
  invoice_number: 'text',
  total_amount: 'range',
  vat_amount: 'range',
  tip_fakture: 'checkbox',
  processing_status: 'checkbox',
}

function FilterDropdown({ colId, colFilters, setColFilters, uniqueVals, onClose }) {
  const ref = useRef(null)
  const type = FILTER_TYPE[colId]
  const current = colFilters[colId]

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const clearFilter = () => setColFilters(f => { const n = { ...f }; delete n[colId]; return n })

  const dropClass = 'absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-2 min-w-[180px]'
  const inputClass = 'w-full border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500'

  if (type === 'text') return (
    <div ref={ref} className={dropClass}>
      <input autoFocus type="text" placeholder="Pretraži..." className={inputClass}
        value={current || ''}
        onChange={e => setColFilters(f => ({ ...f, [colId]: e.target.value }))} />
      {current && <button className="mt-1 text-[10px] text-gray-400 hover:text-red-500" onClick={clearFilter}>✕ obriši</button>}
    </div>
  )

  if (type === 'range') {
    const { min = '', max = '' } = current || {}
    return (
      <div ref={ref} className={dropClass}>
        <div className="flex gap-1">
          <input type="number" placeholder="Od" className={inputClass}
            value={min} onChange={e => setColFilters(f => ({ ...f, [colId]: { ...f[colId], min: e.target.value } }))} />
          <input type="number" placeholder="Do" className={inputClass}
            value={max} onChange={e => setColFilters(f => ({ ...f, [colId]: { ...f[colId], max: e.target.value } }))} />
        </div>
        {(min || max) && <button className="mt-1 text-[10px] text-gray-400 hover:text-red-500" onClick={clearFilter}>✕ obriši</button>}
      </div>
    )
  }

  if (type === 'checkbox') {
    const opts = colId === 'tip_fakture' ? ['ulazna', 'izlazna'] : (uniqueVals[colId] || ['pending', 'processing', 'completed', 'failed'])
    const selected = current || []
    return (
      <div ref={ref} className={dropClass}>
        {opts.map(opt => (
          <label key={opt} className="flex items-center gap-2 text-xs py-0.5 cursor-pointer">
            <input type="checkbox" className="accent-blue-600" checked={selected.includes(opt)}
              onChange={() => setColFilters(f => {
                const cur = f[colId] || []
                const next = cur.includes(opt) ? cur.filter(v => v !== opt) : [...cur, opt]
                return next.length ? { ...f, [colId]: next } : (() => { const n = { ...f }; delete n[colId]; return n })()
              })} />
            <span className="text-gray-700 dark:text-gray-300 capitalize">{opt}</span>
          </label>
        ))}
        {selected.length > 0 && <button className="mt-1 text-[10px] text-gray-400 hover:text-red-500" onClick={clearFilter}>✕ obriši</button>}
      </div>
    )
  }

  return null
}

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
      const t = v.length > 28 ? v.slice(0, 28) + '…' : v
      return <span title={v}>{t}</span>
    },
  },
  {
    accessorKey: 'invoice_number',
    header: 'Broj dok.',
    cell: ({ getValue }) => getValue() || '—',
  },
  {
    accessorKey: 'total_amount',
    header: 'Ukupno',
    cell: ({ row }) => <span className="block text-right tabular-nums">{formatCurrency(row.original.total_amount, row.original.currency)}</span>,
  },
  {
    accessorKey: 'vat_amount',
    header: 'PDV',
    cell: ({ row }) => <span className="block text-right tabular-nums">{formatCurrency(row.original.vat_amount, row.original.currency)}</span>,
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
    accessorKey: 'confidence',
    header: 'Pouzdanost',
    cell: ({ getValue }) => <span className="block max-w-[80px] overflow-hidden"><ConfidenceBadge confidence={getValue()} /></span>,
  },
  {
    accessorKey: 'interni_broj',
    header: 'Interni br.',
    cell: ({ getValue }) => <span className="text-xs text-gray-500 font-mono">{getValue() || '—'}</span>,
  },
  {
    accessorKey: 'avans_primljen',
    header: 'Avans',
    cell: ({ getValue }) => {
      const v = getValue()
      return v != null
        ? <span className="block text-right tabular-nums">{Number(v).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} RSD</span>
        : <span className="block text-right text-gray-300">—</span>
    },
  },
  {
    accessorKey: 'preostalo_za_naplatu',
    header: 'Preostalo',
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
      const colors = { completed: 'text-green-600', failed: 'text-red-600', processing: 'text-blue-600', pending: 'text-gray-500' }
      return <span className={`text-sm font-medium ${colors[status] || 'text-gray-500'}`}>{formatStatus(status)}</span>
    },
  },
]

export default function InvoiceTable({ invoices, onProcessed }) {
  const navigate = useNavigate()
  const [sorting, setSorting] = useState({ id: null, dir: null })
  const [colFilters, setColFilters] = useState({})
  const [openFilterId, setOpenFilterId] = useState(null)

  const uniqueVals = useMemo(() => ({
    processing_status: [...new Set(invoices.map(i => i.processing_status).filter(Boolean))],
  }), [invoices])

  const processed = useMemo(() => {
    let data = [...invoices]

    for (const [colId, val] of Object.entries(colFilters)) {
      const type = FILTER_TYPE[colId]
      if (type === 'text' && val) {
        data = data.filter(r => String(r[colId] ?? '').toLowerCase().includes(val.toLowerCase()))
      } else if (type === 'range' && val) {
        const { min = '', max = '' } = val
        data = data.filter(r => {
          const v = r[colId] ?? 0
          if (min !== '' && v < Number(min)) return false
          if (max !== '' && v > Number(max)) return false
          return true
        })
      } else if (type === 'checkbox' && Array.isArray(val) && val.length) {
        data = data.filter(r => val.includes(r[colId]))
      }
    }

    if (sorting.id && sorting.dir) {
      data = [...data].sort((a, b) => {
        const av = a[sorting.id] ?? ''
        const bv = b[sorting.id] ?? ''
        if (av < bv) return sorting.dir === 'asc' ? -1 : 1
        if (av > bv) return sorting.dir === 'asc' ? 1 : -1
        return 0
      })
    }

    return data
  }, [invoices, colFilters, sorting])

  useEffect(() => { if (onProcessed) onProcessed(processed) }, [processed, onProcessed])

  const table = useReactTable({ data: processed, columns, getCoreRowModel: getCoreRowModel() })

  const toggleSort = (colId) => setSorting(prev => {
    if (prev.id !== colId) return { id: colId, dir: 'asc' }
    if (prev.dir === 'asc') return { id: colId, dir: 'desc' }
    return { id: null, dir: null }
  })

  if (invoices.length === 0) {
    return <div className="text-center py-12 text-gray-500">Nema pronađenih računa.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
              {headerGroup.headers.map((header) => {
                const colId = header.column.id
                const sortable = SORTABLE.has(colId)
                const filterable = colId in FILTER_TYPE
                const isFilterActive = colFilters[colId] !== undefined
                const sortDir = sorting.id === colId ? sorting.dir : null
                const rightAlign = colId === 'total_amount' || colId === 'vat_amount'
                return (
                  <th key={header.id} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${rightAlign ? 'text-right' : 'text-left'}`}>
                    <div className={`flex items-center gap-1 group ${rightAlign ? 'justify-end' : ''}`}>
                      {sortable ? (
                        <button onClick={() => toggleSort(colId)} className="flex items-center gap-0.5 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className={`text-[10px] ml-0.5 ${sortDir ? 'text-blue-500' : 'text-gray-300'}`}>
                            {sortDir === 'asc' ? '↑' : sortDir === 'desc' ? '↓' : '↕'}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                      {filterable && (
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenFilterId(id => id === colId ? null : colId) }}
                            className={`text-[11px] transition-opacity ${isFilterActive ? 'text-blue-500 opacity-100' : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600'}`}
                            title="Filtriraj"
                          >
                            🔍
                          </button>
                          {openFilterId === colId && (
                            <FilterDropdown
                              colId={colId}
                              colFilters={colFilters}
                              setColFilters={setColFilters}
                              uniqueVals={uniqueVals}
                              onClose={() => setOpenFilterId(null)}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                )
              })}
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
          {processed.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-gray-400 text-sm">
                Nema rezultata za aktivne filtere.{' '}
                <button className="text-blue-500 hover:underline" onClick={() => setColFilters({})}>Obriši filtere</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
