"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, BarChart3, Clock, DollarSign, MessagesSquare, RefreshCw } from "lucide-react";
import { observability, type ObservabilityTrace } from "@/lib/api/client";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    completed: "bg-green-500/10 text-green-400 border-green-500/20",
    active: "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse",
    error: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium capitalize", colours[status] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20")}>
      {status}
    </span>
  );
}

function ms(v?: number | null) { return v == null ? "–" : `${Math.round(v)}ms`; }
function cost(v?: number | null) { return v == null ? "–" : `$${(v / 100).toFixed(3)}`; }
function when(iso?: string) { return iso ? new Date(iso).toLocaleString() : "–"; }
function dur(v?: number | null) {
  if (v == null) return "–";
  const s = Math.round(v / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function ObservabilityPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [traces, setTraces] = useState<ObservabilityTrace[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Resolve the default observability project once.
  useEffect(() => {
    observability.projects()
      .then((ps) => {
        if (ps.length === 0) { setError("No observability project provisioned yet."); setLoading(false); return; }
        setProjectId(ps[0].id);
      })
      .catch(() => { setError("Could not load observability projects."); setLoading(false); });
  }, []);

  const load = (pid: string) => {
    setLoading(true);
    observability.traces(pid, { limit: 50, status: statusFilter || undefined })
      .then((r) => { setTraces(r.traces); setTotal(r.total_count); })
      .catch(() => setError("Could not load traces."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (projectId) load(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Observability</h1>
          <p className="text-sm text-slate-400">Per-call traces, latency and cost across your voice pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/observability/latency" className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
            <BarChart3 className="h-4 w-4" /> Latency
          </Link>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300"
          >
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="active">Active</option>
            <option value="error">Error</option>
          </select>
          <button
            onClick={() => projectId && load(projectId)}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total traces", value: total, icon: Activity },
          { label: "Completed", value: traces.filter((t) => t.status === "completed").length, icon: MessagesSquare },
          { label: "Errors", value: traces.filter((t) => t.status === "error").length, icon: Activity },
          { label: "Active", value: traces.filter((t) => t.status === "active").length, icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2 text-slate-400"><Icon className="h-4 w-4" /><span className="text-xs font-medium">{label}</span></div>
            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {error ? (
          <div className="py-16 text-center text-sm text-slate-500">{error}</div>
        ) : loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading traces…</div>
        ) : traces.length === 0 ? (
          <div className="py-16 text-center">
            <Activity className="mx-auto mb-3 h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-500">No traces yet</p>
            <p className="mt-1 text-xs text-slate-600">Traces appear here automatically after each voice call.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-medium">Call</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Started</th>
                  <th className="px-4 py-2 font-medium">Duration</th>
                  <th className="px-4 py-2 font-medium">Turns</th>
                  <th className="px-4 py-2 font-medium">E2E p50 / p95</th>
                  <th className="px-4 py-2 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {traces.map((t) => (
                  <tr key={t.id} className="cursor-pointer hover:bg-slate-800/50">
                    <td className="px-4 py-2.5">
                      <Link href={`/observability/${t.id}`} className="font-mono text-xs text-primary hover:underline">
                        {(t.external_call_id || t.id).slice(0, 18)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{when(t.started_at)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-300">{dur(t.duration_ms)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-300">{t.turn_count}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-300">{ms(t.e2e_p50_ms)} / {ms(t.e2e_p95_ms)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-300">{cost(t.cost_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
