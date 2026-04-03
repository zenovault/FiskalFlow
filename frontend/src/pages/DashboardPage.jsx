/**
 * Dashboard page — metric cards (from /stats) + recent 10 invoices.
 */

import { useEffect, useState, useRef } from 'react'
import { FileText, TrendingUp, Receipt, AlertCircle, Calculator, Store, ShieldCheck } from 'lucide-react'
import client from '../api/client'
import InvoiceCard from '../components/InvoiceCard'
import { formatCurrency } from '../utils/formatters'
import TopBar from '../components/Layout/TopBar'

const SCORE_COLORS = {
  green:  { bar: 'bg-green-500',  badge: 'bg-green-100 text-green-800',  ring: 'ring-green-200' },
  blue:   { bar: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-800',    ring: 'ring-blue-200'  },
  yellow: { bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-800',  ring: 'ring-amber-200' },
  red:    { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-800',      ring: 'ring-red-200'   },
}

function AuditScoreCard({ auditScore }) {
  const [displayed, setDisplayed] = useState(0)
  const [issuesOpen, setIssuesOpen] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!auditScore) return
    setDisplayed(0)
    const target = auditScore.score
    const step = Math.max(1, Math.floor(target / 40))
    intervalRef.current = setInterval(() => {
      setDisplayed(prev => {
        if (prev + step >= target) { clearInterval(intervalRef.current); return target }
        return prev + step
      })
    }, 20)
    return () => clearInterval(intervalRef.current)
  }, [auditScore])

  if (!auditScore) return null
  const c = SCORE_COLORS[auditScore.color] || SCORE_COLORS.blue

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 ring-2 ${c.ring}`}>
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-slate-700 flex-shrink-0">
          <ShieldCheck size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Audit Readiness Score</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>{auditScore.label}</span>
          </div>
          <div className="flex items-end gap-2 mt-1">
            <p className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">{displayed}</p>
            <p className="text-sm text-gray-400 mb-1">/ 100</p>
          </div>
          <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${c.bar}`} style={{ width: `${displayed}%` }} />
          </div>
          {auditScore.issues?.length > 0 && (
            <button
              onClick={() => setIssuesOpen(o => !o)}
              className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              title="Audit Readiness Score pokazuje koliko ste spremni za poresku kontrolu."
            >
              {issuesOpen ? '▲' : '▼'} {auditScore.issues.length} {auditScore.issues.length === 1 ? 'problem' : 'problema'}
            </button>
          )}
          {issuesOpen && (
            <ul className="mt-2 space-y-1">
              {auditScore.issues.map((issue, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                  <span className="text-amber-500 flex-shrink-0">•</span>{issue}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

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
  const [auditScore, setAuditScore] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchAudit = () => client.get('/api/audit-score').then(r => setAuditScore(r.data)).catch(() => {})

  useEffect(() => {
    Promise.all([
      client.get('/api/invoices/stats'),
      client.get('/api/invoices?per_page=10'),
    ]).then(([statsRes, invRes]) => {
      setStats(statsRes.data)
      setInvoices(invRes.data.items || [])
    }).finally(() => setLoading(false))
    fetchAudit()
  }, [])

  return (
    <div>
      <TopBar title="Dashboard" />
      <div className="p-6">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Učitavanje...</div>
        ) : (
          <>
            <AuditScoreCard auditScore={auditScore} />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8 mt-5">
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
