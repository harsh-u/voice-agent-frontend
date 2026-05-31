"use client";

import { useEffect, useState } from "react";
import { Bot, Plus, Trash2, Pencil, Loader2, Cpu, Mic, ChevronDown, ChevronUp, X, Save } from "lucide-react";
import { getToken } from "@/lib/api/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AgentConfig { id: string; name: string; system_prompt: string | null; voice_id: string | null; llm_model: string | null; tools_json: string | null; sip_trunk_id: string | null; created_at: string; updated_at: string }
interface VoiceOption { id: string; name: string; provider: string }
interface ModelOption { id: string; name: string; provider: string; ttft_ms: number; cost_per_min_cents: number; recommended: boolean }

// ---------------------------------------------------------------------------
// Direct API helpers (avoid HMR caching issues)
// ---------------------------------------------------------------------------
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) }
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).detail || res.statusText) }
  if (res.status === 204) return undefined
  return res.json()
}

const agentApi = {
  list:   ()                        => apiFetch('/agents') as Promise<AgentConfig[]>,
  create: (d: Partial<AgentConfig>) => apiFetch('/agents', { method: 'POST', body: JSON.stringify(d) }) as Promise<AgentConfig>,
  update: (id: string, d: Partial<AgentConfig>) => apiFetch(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(d) }) as Promise<AgentConfig>,
  delete: (id: string)              => apiFetch(`/agents/${id}`, { method: 'DELETE' }),
  voices: ()                        => apiFetch('/agents/options/voices') as Promise<VoiceOption[]>,
  models: ()                        => apiFetch('/agents/options/models') as Promise<ModelOption[]>,
}

const DEFAULT_PROMPT = `You are a helpful voice AI assistant. Be concise, friendly, and professional.
Keep responses brief since this is a phone call — 1-2 sentences max unless asked for detail.`;

function AgentForm({
  agent,
  voices,
  models,
  onSaved,
  onCancel,
}: {
  agent?: AgentConfig | null;
  voices: VoiceOption[];
  models: ModelOption[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!agent;
  const [name, setName] = useState(agent?.name ?? "");
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt ?? DEFAULT_PROMPT);
  const [voiceId, setVoiceId] = useState(agent?.voice_id ?? "");
  const [llmModel, setLlmModel] = useState(agent?.llm_model ?? "");
  const [toolsJson, setToolsJson] = useState(agent?.tools_json ?? "");
  const [sipTrunkId, setSipTrunkId] = useState(agent?.sip_trunk_id ?? "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !systemPrompt.trim()) {
      toast.error("Name and system prompt are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        system_prompt: systemPrompt.trim(),
        voice_id: voiceId || undefined,
        llm_model: llmModel || undefined,
        tools_json: toolsJson.trim() || undefined,
        sip_trunk_id: sipTrunkId.trim() || undefined,
      };
      if (isEdit && agent) {
        await agentApi.update(agent.id, payload);
        toast.success("Agent updated");
      } else {
        await agentApi.create(payload);
        toast.success("Agent created");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Agent Name *
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sales SDR, Support Bot"
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
        />
      </div>

      {/* System Prompt */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          System Prompt *
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={8}
          required
          placeholder="You are a helpful voice AI assistant..."
          className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
        />
        <p className="mt-1 text-xs text-slate-500">
          Keep responses brief — this is a live phone call. Instruct the agent to speak in 1–2 sentences.
        </p>
      </div>

      {/* Voice */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Voice (TTS)
        </label>
        <select
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
        >
          <option value="">Use default voice</option>
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      {/* LLM Model */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          LLM Model
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {models.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setLlmModel(m.id)}
              className={cn(
                "flex flex-col rounded-lg border p-3 text-left transition",
                llmModel === m.id || (!llmModel && m.recommended)
                  ? "border-primary bg-primary/10"
                  : "border-slate-700 bg-slate-800 hover:border-slate-600"
              )}
            >
              <div className="flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-medium text-white">{m.name}</span>
                {m.recommended && (
                  <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-green-400">
                    Recommended
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex gap-3 text-[10px] text-slate-500">
                <span>~{m.ttft_ms}ms TTFT</span>
                <span>${(m.cost_per_min_cents / 100).toFixed(4)}/min</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
      >
        {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        Advanced settings
      </button>

      {showAdvanced && (
        <div className="space-y-4 rounded-lg border border-slate-700/50 bg-slate-800/40 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Tools JSON
            </label>
            <textarea
              value={toolsJson}
              onChange={(e) => setToolsJson(e.target.value)}
              rows={4}
              placeholder='[{"type": "function", "function": {...}}]'
              className="w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600 focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-600">
              OpenAI-format function tools the agent can call during the conversation.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              SIP Trunk ID
            </label>
            <input
              value={sipTrunkId}
              onChange={(e) => setSipTrunkId(e.target.value)}
              placeholder="ST_xxxxxx (override default trunk)"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600 focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 border-t border-slate-800 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Agent"}
        </button>
      </div>
    </form>
  );
}

export default function AgentsPage() {
  const [agentList, setAgentList] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<AgentConfig | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [list, v, m] = await Promise.all([
        agentApi.list(),
        agentApi.voices(),
        agentApi.models(),
      ]);
      setAgentList(list);
      setVoices(v);
      setModels(m);
    } catch (e: any) {
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this agent? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await agentApi.delete(id);
      toast.success("Agent deleted");
      setAgentList((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error("Failed to delete agent");
    } finally {
      setDeleting(null);
    }
  };

  const openCreate = () => {
    setEditAgent(null);
    setFormOpen(true);
  };

  const openEdit = (agent: AgentConfig) => {
    setEditAgent(agent);
    setFormOpen(true);
  };

  const handleSaved = () => {
    setFormOpen(false);
    setEditAgent(null);
    loadAll();
  };

  const voiceLabel = (id: string | null) =>
    voices.find((v) => v.id === id)?.name ?? "Default voice";
  const modelLabel = (id: string | null) =>
    models.find((m) => m.id === id)?.name ?? "Default model";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Voice Agents</h1>
          <p className="text-sm text-slate-400">
            Configure AI agents for outbound and inbound calls — system prompt, voice, and LLM model.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Agent
        </button>
      </div>

      {/* Form panel (inline slide-in) */}
      {formOpen && (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              {editAgent ? `Edit — ${editAgent.name}` : "New Agent"}
            </h2>
            <button onClick={() => setFormOpen(false)} className="text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <AgentForm
            agent={editAgent}
            voices={voices}
            models={models}
            onSaved={handleSaved}
            onCancel={() => setFormOpen(false)}
          />
        </div>
      )}

      {/* Agent list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : agentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 py-20">
          <Bot className="mb-3 h-10 w-10 text-slate-600" />
          <p className="text-sm text-slate-500">No agents yet</p>
          <button
            onClick={openCreate}
            className="mt-4 flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Create your first agent
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {agentList.map((agent) => (
            <div
              key={agent.id}
              className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
            >
              {/* Row */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{agent.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Mic className="h-3 w-3" />
                      {voiceLabel(agent.voice_id)}
                    </span>
                    <span className="text-slate-700">·</span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Cpu className="h-3 w-3" />
                      {modelLabel(agent.llm_model)}
                    </span>
                    {agent.tools_json && (
                      <>
                        <span className="text-slate-700">·</span>
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                          Tools enabled
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => setExpanded(expanded === agent.id ? null : agent.id)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    {expanded === agent.id ? "Hide prompt" : "View prompt"}
                  </button>
                  <button
                    onClick={() => openEdit(agent)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(agent.id)}
                    disabled={deleting === agent.id}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                    title="Delete"
                  >
                    {deleting === agent.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expandable prompt */}
              {expanded === agent.id && (
                <div className="border-t border-slate-800 bg-slate-950/50 px-5 py-4">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    System Prompt
                  </p>
                  <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300 leading-relaxed">
                    {agent.system_prompt || "(no prompt set)"}
                  </pre>
                  {agent.sip_trunk_id && (
                    <p className="mt-3 text-[10px] text-slate-600">
                      SIP Trunk: <span className="font-mono text-slate-500">{agent.sip_trunk_id}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
