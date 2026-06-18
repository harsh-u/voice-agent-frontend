"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { observability, type LatencyMetric } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const COMPONENT_COLORS: Record<string, string> = {
  vad: "bg-slate-500",
  stt: "bg-sky-500",
  llm: "bg-indigo-500",
  tts: "bg-emerald-500",
  transport: "bg-amber-500",
  telephony: "bg-rose-500",
  "end-to-end": "bg-primary",
};

function label(c: string | null) { return c == null ? "end-to-end" : c; }
function ms(v?: number | null) { return v == null ? "–" : `${Math.round(v)}ms`; }

export default function LatencyPage() {
  const [metrics, setMetrics] = useState<LatencyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    observability.projects()
      .then((ps) => {
        if (ps.length === 0) { setError("No observability project provisioned yet."); setLoading(false); return; }
        return observability.latency(ps[0].id).then((r) => setMetrics(r.metrics));
      })
      .catch(() => setError("Could not load latency metrics."))
      .finally(() => setLoading(false));
  }, []);

  // Scale bars against the largest p99 across components.
  const maxP99 = Math.max(1, ...metrics.map((m) => m.p99_ms ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/observability" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
          <ArrowLeft className="h-3 w-3" /> Observability
        </Link>
        <h1 className="text-xl font-semibold text-white">Latency by component</h1>
        <p className="text-sm text-slate-400">p50 / p95 / p99 across your voice pipeline stages</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center text-sm text-slate-500">{error}</div>
      ) : loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading…</div>
      ) : metrics.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center text-sm text-slate-500">
          No metrics yet — they aggregate from call traces over time.
        </div>
      ) : (
        <div className="space-y-3">
          {metrics.map((m) => {
            const key = label(m.component);
            const color = COMPONENT_COLORS[key] ?? "bg-slate-400";
            return (
              <div key={key} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium capitalize text-white">
                    <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
                    {key}
                  </span>
                  <span className="text-xs text-slate-500">{m.count} samples · {m.error_count} errors</span>
                </div>
                <div className="space-y-1.5">
                  {([["p50", m.p50_ms], ["p95", m.p95_ms], ["p99", m.p99_ms]] as const).map(([name, val]) => (
                    <div key={name} className="flex items-center gap-2">
                      <span className="w-8 shrink-0 text-[10px] text-slate-500">{name}</span>
                      <div className="h-4 flex-1 rounded bg-slate-800/60">
                        <div className={cn("h-4 rounded", color)} style={{ width: `${Math.min(((val ?? 0) / maxP99) * 100, 100)}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right text-[10px] text-slate-300">{ms(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
