/**
 * Dashboard page — metric cards (from /stats) + recent 10 invoices.
 */

import { useEffect, useState } from 'react'
import { FileText, TrendingUp, Receipt, AlertCircle, Calculator, Store } from 'lucide-react'
import client from '../api/client'
import InvoiceCard from '../components/InvoiceCard'
import { formatCurrency } from '../utils/formatters'
import TopBar from '../components/Layout/TopBar'

function MetricCard({ icon: Icon, label, value, sublabel, color }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-lg flex-shrink-0 ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5 truncate">{value}</p>
          {sublabel && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sublabel}</p>}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      client.get('/api/invoices/stats'),
      client.get('/api/invoices?per_page=10'),
    ]).then(([statsRes, invRes]) => {
      setStats(statsRes.data)
      setInvoices(invRes.data.items || [])
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <TopBar title="Dashboard" />
      <div className="p-6">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Učitavanje...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
              <MetricCard
                icon={FileText}
                label="Ukupno faktura"
                value={stats?.total_count ?? 0}
                sublabel={`Prosečna pouzdanost: ${stats?.avg_confidence != null ? Math.round(stats.avg_confidence * 100) + '%' : '—'}`}
                color="bg-blue-600"
              />
              <MetricCard
                icon={TrendingUp}
                label="Iznos ovog meseca"
                value={formatCurrency(stats?.total_amount_month ?? 0)}
                color="bg-green-600"
              />
              <MetricCard
                icon={Calculator}
                label="PDV ovog meseca"
                value={formatCurrency(stats?.total_pdv_month ?? 0)}
                color="bg-amber-500"
              />
              <MetricCard
                icon={AlertCircle}
                label="Čeka proveru"
                value={stats?.pending_verification ?? 0}
                color="bg-red-500"
              />
              {stats?.top_issuer && (
                <MetricCard
                  icon={Store}
                  label="Najčešći izdavalac"
                  value={stats.top_issuer}
                  sublabel={`${stats.top_issuer_count} računa`}
                  color="bg-purple-600"
                />
              )}
            </div>

            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Nedavne fakture</h2>
            {invoices.length === 0 ? (
              <p className="text-gray-400 text-sm">Nema faktura. Uploadujte prvu fakturu.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {invoices.map((inv) => <InvoiceCard key={inv.id} invoice={inv} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
