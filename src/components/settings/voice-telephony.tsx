"use client";

import { useEffect, useState } from "react";
import { Phone, Wifi, Cpu, Mic, DollarSign, CheckCircle, XCircle, RefreshCw, ExternalLink } from "lucide-react";
import { getToken } from "@/lib/api/client";
import { toast } from "sonner";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch(path: string) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

interface VoiceConfig {
  sip_from_number: string;
  sip_provider_uri: string;
  sip_auth_username: string;
  sip_trunk_id: string;
  deepgram_model: string;
  groq_model: string;
  cartesia_model: string;
  cost_stt_cpm: number;
  cost_llm_cpm: number;
  cost_tts_cpm: number;
  cost_telephony_cpm: number;
  cost_total_cpm: number;
  livekit_url: string;
  sip_configured: boolean;
  livekit_configured: boolean;
}

interface CostItem {
  component: string;
  label: string;
  cpm_cents: number;
  cpm_dollars: number;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${ok ? "text-green-400" : "text-red-400"}`}>
      {ok ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function ConfigRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between border-b border-slate-800 py-3 last:border-0">
      <span className="text-sm text-slate-400 w-40 shrink-0">{label}</span>
      <span className={`text-sm text-white text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export function VoiceTelephonyConfig() {
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [costs, setCosts] = useState<CostItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      apiFetch("/settings/voice"),
      apiFetch("/settings/voice/costs"),
    ])
      .then(([cfg, cst]) => { setConfig(cfg); setCosts(cst); })
      .catch(() => toast.error("Failed to load voice settings"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  );

  if (!config) return null;

  const totalPerMin = (config.cost_total_cpm / 100).toFixed(4);

  return (
    <div className="space-y-6">
      {/* Status row */}
      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4">
        <StatusBadge ok={config.sip_configured} label={config.sip_configured ? "SIP configured" : "SIP not configured"} />
        <StatusBadge ok={config.livekit_configured} label={config.livekit_configured ? "LiveKit connected" : "LiveKit not configured"} />
        <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
          <DollarSign className="h-3.5 w-3.5" />
          Total cost: <strong className="text-white">${totalPerMin}/min</strong>
        </span>
        <button onClick={load} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {/* Caller ID / SIP */}
      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-3">
          <Phone className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-white">Outbound Caller ID & SIP</h3>
        </div>
        <div className="px-5">
          <ConfigRow label="Outbound number" value={config.sip_from_number} mono />
          <ConfigRow label="SIP provider URI" value={config.sip_provider_uri} mono />
          <ConfigRow label="SIP username" value={config.sip_auth_username} mono />
          <ConfigRow label="SIP Trunk ID" value={config.sip_trunk_id} mono />
        </div>
        <div className="border-t border-slate-800 px-5 py-3">
          <p className="text-xs text-slate-500">
            To change these values, update <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-300">.env</code> and restart the server.
            Set: <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-300">SIP_FROM_NUMBER</code>,&nbsp;
            <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-300">SIP_PROVIDER_URI</code>,&nbsp;
            <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-300">LIVEKIT_SIP_TRUNK_ID</code>
          </p>
        </div>
      </div>

      {/* AI Services */}
      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-3">
          <Cpu className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-white">AI Services</h3>
        </div>
        <div className="px-5">
          <ConfigRow label="STT model" value={`Deepgram ${config.deepgram_model}`} />
          <ConfigRow label="LLM model" value={`Groq ${config.groq_model}`} />
          <ConfigRow label="TTS model" value={`Cartesia ${config.cartesia_model}`} />
          <ConfigRow label="LiveKit URL" value={config.livekit_url} mono />
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-3">
          <DollarSign className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-white">Cost per Minute Breakdown</h3>
        </div>
        <div className="divide-y divide-slate-800">
          {costs.map((c) => (
            <div key={c.component} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-300">{c.label}</span>
              <div className="text-right">
                <span className="text-sm font-medium text-white">{c.cpm_cents}¢/min</span>
                <span className="ml-2 text-xs text-slate-500">(${c.cpm_dollars.toFixed(4)})</span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between bg-slate-800/40 px-5 py-3">
            <span className="text-sm font-semibold text-white">Total</span>
            <span className="text-sm font-bold text-primary">
              {config.cost_total_cpm}¢/min &nbsp;≈&nbsp; ${totalPerMin}/min
            </span>
          </div>
        </div>
        <div className="border-t border-slate-800 px-5 py-3">
          <p className="text-xs text-slate-500">
            Adjust in <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-300">.env</code>:&nbsp;
            <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-300">COST_STT_CPM</code>,&nbsp;
            <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-300">COST_LLM_CPM</code>,&nbsp;
            <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-300">COST_TTS_CPM</code>,&nbsp;
            <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-300">COST_TELEPHONY_CPM</code>
          </p>
        </div>
      </div>
    </div>
  );
}
