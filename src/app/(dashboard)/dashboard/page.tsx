"use client"

import { useEffect, useState } from 'react'
import {
  MessageSquare,
  UserPlus,
  DollarSign,
  Send,
  Phone,
  PhoneCall,
  TrendingUp,
  RefreshCw,
  Activity,
  Zap,
} from 'lucide-react'
import { dashboard } from '@/lib/api/client'
import type { DashboardMetrics } from '@/lib/api/client'
import { MetricCard } from '@/components/dashboard/metric-card'
import { SkeletonCard } from '@/components/dashboard/skeleton'
import { QuickActions } from '@/components/dashboard/quick-actions'

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMetrics = () => {
    setLoading(true)
    setError(null)
    dashboard
      .getMetrics()
      .then(setMetrics)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadMetrics()
    // Auto-refresh every 30s
    const interval = setInterval(loadMetrics, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Live analytics across conversations, contacts, deals, and calls.
          </p>
        </div>
        <button
          onClick={loadMetrics}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Failed to load metrics: {error}
        </div>
      )}

      {/* CRM Metric cards */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">WhatsApp CRM</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : metrics ? (
            <>
              <MetricCard
                title="Open Conversations"
                value={metrics.open_conversations.toLocaleString()}
                icon={MessageSquare}
                delta={{ sign: metrics.conversations_today, label: `${metrics.conversations_today} new today` }}
              />
              <MetricCard
                title="Messages Today"
                value={metrics.messages_today.toLocaleString()}
                icon={Send}
              />
              <MetricCard
                title="Open Deals"
                value={metrics.deals_open.toLocaleString()}
                icon={TrendingUp}
                delta={{ sign: metrics.deals_won, label: `${metrics.deals_won} won` }}
              />
              <MetricCard
                title="Pipeline Value"
                value={new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(metrics.pipeline_value)}
                icon={DollarSign}
              />
            </>
          ) : null}
        </div>
      </div>

      {/* Voice Metric cards */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Voice Calls</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)
          ) : metrics ? (
            <>
              <MetricCard
                title="Calls Today"
                value={metrics.calls_today.toLocaleString()}
                icon={Phone}
              />
              <MetricCard
                title="Active Calls"
                value={metrics.active_calls.toLocaleString()}
                icon={PhoneCall}
                delta={{
                  sign: metrics.active_calls,
                  label: metrics.active_calls > 0 ? 'live right now' : 'none active',
                }}
              />
              <MetricCard
                title="Avg Call Duration"
                value={`${Math.round(metrics.avg_call_duration_seconds)}s`}
                icon={Phone}
              />
              <MetricCard
                title="Today's Voice Spend"
                value={`$${(metrics.voice_spend_today_cents / 100).toFixed(3)}`}
                icon={DollarSign}
              />
              <MetricCard
                title="Answer Rate"
                value={`${metrics.voice_answer_rate}%`}
                icon={Activity}
                delta={{ sign: metrics.outbound_calls_today, label: `${metrics.outbound_calls_today} outbound calls` }}
              />
            </>
          ) : null}
        </div>
      </div>

      {/* Quick actions */}
      <QuickActions />
    </div>
  )
}
