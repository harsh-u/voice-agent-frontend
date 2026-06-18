"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { observability, type TraceDetail, type TraceTurn } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const COMPONENT_COLORS: Record<string, string> = {
  vad: "bg-slate-500",
  stt: "bg-sky-500",
  llm: "bg-indigo-500",
  tts: "bg-emerald-500",
  transport: "bg-amber-500",
  telephony: "bg-rose-500",
};

function ms(v?: number | null) { return v == null ? "–" : `${Math.round(v)}ms`; }
function cost(v?: number | null) { return v == null ? "–" : `$${(v / 100).toFixed(3)}`; }
function dur(v?: number | null) {
  if (v == null) return "–";
  const s = Math.round(v / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function TurnWaterfall({ turn }: { turn: TraceTurn }) {
  const spans = turn.spans ?? [];
  if (spans.length === 0) return <p className="text-xs text-slate-600">No spans recorded</p>;

  // Build a local time window for this turn from its spans.
  const minStart = Math.min(...spans.map((s) => s.start_ms ?? 0));
  const maxEnd = Math.max(...spans.map((s) => s.end_ms ?? s.start_ms ?? 0));
  const span = Math.max(maxEnd - minStart, 1);

  return (
    <div className="space-y-1.5">
      {spans
        .slice()
        .sort((a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0))
        .map((s) => {
          const start = s.start_ms ?? 0;
          const end = s.end_ms ?? start;
          const left = ((start - minStart) / span) * 100;
          const width = Math.max(((end - start) / span) * 100, 1.5);
          return (
            <div key={s.id} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-right text-[10px] uppercase tracking-wide text-slate-500">{s.component}</span>
              <div className="relative h-5 flex-1 rounded bg-slate-800/60">
                <div
                  className={cn("absolute top-0 h-5 rounded", COMPONENT_COLORS[s.component] ?? "bg-slate-400", s.error && "ring-1 ring-red-400")}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${s.name} · ${ms(s.duration_ms ?? end - start)}`}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-[10px] text-slate-400">{ms(s.duration_ms ?? end - start)}</span>
            </div>
          );
        })}
    </div>
  );
}

export default function TraceDetailPage() {
  const params = useParams<{ id: string }>();
  const [trace, setTrace] = useState<TraceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    observability.trace(params.id)
      .then(setTrace)
      .catch(() => setError("Could not load trace."))
      .finally(() => setLoading(false));
  }, [params.id]);

  const kpis = trace
    ? [
        { label: "Turns", value: String(trace.turn_count) },
        { label: "Duration", value: dur(trace.duration_ms) },
        { label: "E2E p50", value: ms(trace.e2e_p50_ms) },
        { label: "E2E p95", value: ms(trace.e2e_p95_ms) },
        { label: "E2E p99", value: ms(trace.e2e_p99_ms) },
        { label: "Cost", value: cost(trace.cost_cents) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/observability" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
          <ArrowLeft className="h-3 w-3" /> Observability
        </Link>
        <h1 className="font-mono text-lg font-semibold text-white">{trace?.external_call_id || params.id}</h1>
        <p className="text-sm capitalize text-slate-400">{trace?.framework} · {trace?.status}</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center text-sm text-slate-500">{error}</div>
      ) : loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading…</div>
      ) : trace ? (
        <>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs text-slate-400">{k.label}</p>
                <p className="mt-1 text-lg font-bold text-white">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-medium text-white">Turn waterfall</h2>
            {(trace.turns ?? []).length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900 py-8 text-center text-sm text-slate-500">No turns recorded</div>
            ) : (
              (trace.turns ?? [])
                .slice()
                .sort((a, b) => a.turn_index - b.turn_index)
                .map((turn) => (
                  <div key={turn.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        turn.role === "user" ? "bg-primary/10 text-primary" : "bg-slate-800 text-slate-300")}>
                        Turn {turn.turn_index} · {turn.role}
                      </span>
                      {turn.response_latency_ms != null && (
                        <span className="text-xs text-slate-400">response {ms(turn.response_latency_ms)}</span>
                      )}
                    </div>
                    {(turn.user_transcript || turn.agent_transcript) && (
                      <p className="mb-3 rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
                        {turn.user_transcript || turn.agent_transcript}
                      </p>
                    )}
                    <TurnWaterfall turn={turn} />
                  </div>
                ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
