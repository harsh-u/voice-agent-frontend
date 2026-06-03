"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Users, Clock, Phone, Loader2, X, Check, ChevronRight } from "lucide-react";
import { agents as agentsApi, contacts as contactsApi, getToken, type AgentConfig, type Contact } from "@/lib/api/client";
import { toast } from "sonner";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).detail || res.statusText); }
  return res.json();
}

interface VoiceBroadcastWizardProps {
  onCancel: () => void;
}

export function VoiceBroadcastWizard({ onCancel }: VoiceBroadcastWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0=agent, 1=audience, 2=schedule+send

  // Step 0 — Agent
  const [agentList, setAgentList] = useState<AgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [broadcastName, setBroadcastName] = useState("");
  const [maxRetries, setMaxRetries] = useState(1);

  // Step 1 — Audience
  const [contactList, setContactList] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState("");

  // Step 2 — Schedule & Send
  const [scheduleAt, setScheduleAt] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    Promise.all([agentsApi.list(), contactsApi.list({ limit: 200 })]).then(([ag, co]) => {
      setAgentList(ag);
      if (ag.length > 0) setSelectedAgentId(ag[0].id);
      setContactList(co);
    }).catch(() => {});
  }, []);

  const filteredContacts = contactList.filter(c =>
    !contactSearch || c.name?.toLowerCase().includes(contactSearch.toLowerCase()) || c.phone.includes(contactSearch)
  );

  const toggleContact = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleSend = async () => {
    if (!broadcastName.trim()) { toast.error("Broadcast name is required"); return; }
    if (selectedIds.size === 0) { toast.error("Select at least one contact"); return; }
    setSending(true);
    try {
      const result = await apiFetch("/broadcasts", {
        method: "POST",
        body: JSON.stringify({
          name: broadcastName.trim(),
          contact_ids: Array.from(selectedIds),
          broadcast_type: "voice",
          agent_config_id: selectedAgentId || null,
          max_retries: maxRetries,
          scheduled_at: scheduleAt || null,
        }),
      });
      toast.success(`Voice broadcast started — calling ${selectedIds.size} contacts`);
      router.push(`/broadcasts`);
    } catch (e: any) {
      toast.error(e.message || "Failed to create broadcast");
    } finally {
      setSending(false);
    }
  };

  const steps = ["Choose Agent", "Select Audience", "Schedule & Send"];

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i < step ? "bg-green-500 text-white" : i === step ? "bg-primary text-white" : "bg-slate-700 text-slate-400"}`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? "font-medium text-white" : "text-slate-500"}`}>{s}</span>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-slate-700" />}
          </div>
        ))}
      </div>

      {/* Step 0 — Choose Agent */}
      {step === 0 && (
        <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <h3 className="text-base font-semibold text-white">Configure Voice Campaign</h3>
            <p className="mt-0.5 text-sm text-slate-400">The AI agent will call each contact and conduct the conversation.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Campaign Name *</label>
            <input
              value={broadcastName}
              onChange={e => setBroadcastName(e.target.value)}
              placeholder="e.g. Q2 Sales Outreach, Demo Follow-up"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Voice Agent</label>
            {agentList.length === 0 ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-300">
                No agents configured. <a href="/agents" className="underline">Create an agent</a> first.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {agentList.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAgentId(a.id)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${selectedAgentId === a.id ? "border-primary bg-primary/10" : "border-slate-700 bg-slate-800 hover:border-slate-600"}`}
                  >
                    <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{a.name}</p>
                      {a.llm_model && <p className="text-xs text-slate-500 truncate">{a.llm_model}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Retry if no answer</label>
            <select
              value={maxRetries}
              onChange={e => setMaxRetries(Number(e.target.value))}
              className="w-48 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            >
              <option value={1}>No retry</option>
              <option value={2}>Retry once</option>
              <option value={3}>Retry twice</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
            <button onClick={onCancel} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
            <button
              disabled={!broadcastName.trim() || agentList.length === 0}
              onClick={() => setStep(1)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              Next: Audience <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 1 — Audience */}
      {step === 1 && (
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <h3 className="text-base font-semibold text-white">Select Contacts to Call</h3>
            <p className="mt-0.5 text-sm text-slate-400">{selectedIds.size} of {contactList.length} contacts selected</p>
          </div>

          <input
            value={contactSearch}
            onChange={e => setContactSearch(e.target.value)}
            placeholder="Search contacts…"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
          />

          <div className="overflow-hidden rounded-lg border border-slate-800">
            <button
              onClick={toggleAll}
              className="flex w-full items-center gap-3 border-b border-slate-800 px-4 py-2.5 text-left text-xs font-medium text-slate-400 hover:bg-slate-800"
            >
              <div className={`h-4 w-4 rounded border ${selectedIds.size === filteredContacts.length && filteredContacts.length > 0 ? "border-primary bg-primary" : "border-slate-600"} flex items-center justify-center`}>
                {selectedIds.size === filteredContacts.length && filteredContacts.length > 0 && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              Select all ({filteredContacts.length})
            </button>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-800">
              {filteredContacts.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleContact(c.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-800/50"
                >
                  <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${selectedIds.has(c.id) ? "border-primary bg-primary" : "border-slate-600"}`}>
                    {selectedIds.has(c.id) && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">{c.name || "Unnamed"}</p>
                    <p className="text-xs text-slate-500 font-mono">{c.phone}</p>
                  </div>
                </button>
              ))}
              {filteredContacts.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">No contacts found</p>
              )}
            </div>
          </div>

          <div className="flex justify-between gap-3 border-t border-slate-800 pt-4">
            <button onClick={() => setStep(0)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">← Back</button>
            <button
              disabled={selectedIds.size === 0}
              onClick={() => setStep(2)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              Next: Schedule <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Schedule & Send */}
      {step === 2 && (
        <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <h3 className="text-base font-semibold text-white">Ready to Launch</h3>
            <p className="mt-0.5 text-sm text-slate-400">Review your campaign before sending.</p>
          </div>

          {/* Summary */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 divide-y divide-slate-700">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-400">Campaign</span>
              <span className="text-sm font-medium text-white">{broadcastName}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-400">Agent</span>
              <span className="text-sm text-white">{agentList.find(a => a.id === selectedAgentId)?.name || "Default"}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-400">Contacts</span>
              <span className="text-sm font-medium text-white">{selectedIds.size} calls</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-400">Retries</span>
              <span className="text-sm text-white">{maxRetries - 1} retry{maxRetries - 1 !== 1 ? "ies" : "y"} on no-answer</span>
            </div>
          </div>

          {/* Optional schedule */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Schedule (optional)</label>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={e => setScheduleAt(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-600">Leave empty to start immediately.</p>
          </div>

          <div className="flex justify-between gap-3 border-t border-slate-800 pt-4">
            <button onClick={() => setStep(1)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">← Back</button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              {sending ? "Launching…" : `Launch ${selectedIds.size} Calls`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
