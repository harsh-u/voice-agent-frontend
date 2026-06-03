"use client";

import { useEffect, useState } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, DollarSign, Mic, ChevronDown, ChevronRight, Plus, Loader2, X, Download, Bot, Activity, RefreshCw, PhoneOff } from "lucide-react";
import { calls, contacts as contactsApi, agents as agentsApi, getToken, type Call, type CallDetail, type Contact, type AgentConfig } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Active Call Monitor
// ---------------------------------------------------------------------------
function ActiveCallMonitor({ onRefresh }: { onRefresh: () => void }) {
  const [active, setActive] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    const token = getToken();
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${base}/calls/active`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setActive).catch(() => {});
  };

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  if (active.length === 0) return null;

  const hangup = async (id: string) => {
    await calls.hangup(id);
    load(); onRefresh();
  };

  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
        </span>
        <span className="text-sm font-semibold text-blue-300">{active.length} live call{active.length > 1 ? "s" : ""}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((c: any) => {
          const mins = Math.floor(c.live_duration_seconds / 60);
          const secs = c.live_duration_seconds % 60;
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {c.contact_name || c.to_number || c.from_number}
                </p>
                <p className="text-xs text-slate-400">
                  {mins}:{String(secs).padStart(2, '0')} · ${(c.estimated_cost_cents / 100).toFixed(3)}
                  {c.agent_name && <span className="ml-2 text-primary">{c.agent_name}</span>}
                </p>
              </div>
              <button onClick={() => hangup(c.id)} className="rounded p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
                <PhoneOff className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "–";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatCost(cents: number | undefined): string {
  if (!cents) return "–";
  return `$${(cents / 100).toFixed(3)}`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    completed: "bg-green-500/10 text-green-400 border-green-500/20",
    active: "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse",
    dialing: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium capitalize", colours[status] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20")}>
      {status}
    </span>
  );
}

function TranscriptRow({ callId }: { callId: string }) {
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (detail) return;
    setLoading(true);
    try {
      const d = await calls.get(callId);
      setDetail(d);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    if (!open) load();
    setOpen(!open);
  };

  return (
    <div className="border-t border-slate-800">
      <div className="flex items-center">
        <button
          onClick={toggle}
          className="flex flex-1 items-center gap-2 px-4 py-2 text-xs text-slate-400 hover:text-white"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Mic className="h-3 w-3" />
          Transcript
        </button>
        {detail?.recording_url && (
          <a
            href={detail.recording_url}
            download
            className="flex items-center gap-1 px-4 py-2 text-xs text-slate-400 hover:text-primary"
            title="Download recording"
          >
            <Download className="h-3 w-3" />
            Recording
          </a>
        )}
      </div>
      {open && (
        <div className="px-4 pb-4">
          {loading && <p className="text-xs text-slate-500">Loading…</p>}
          {detail?.turns?.length === 0 && <p className="text-xs text-slate-500">No transcript available</p>}
          {detail?.turns?.map((t) => (
            <div key={t.id} className={cn("mb-2 flex gap-2 text-xs", t.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-xs rounded-lg px-3 py-2", t.role === "user" ? "bg-primary/10 text-primary" : "bg-slate-800 text-slate-200")}>
                <p className="mb-0.5 font-medium capitalize text-slate-400">{t.role}</p>
                {t.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- New Call Dialog ----
function NewCallDialog({ onCallStarted }: { onCallStarted: () => void }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [agentList, setAgentList] = useState<AgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [dialing, setDialing] = useState(false);

  useEffect(() => {
    if (!open) return;
    contactsApi.list({ limit: 50 }).then(setContacts).catch(() => {});
    agentsApi.list().then((list) => {
      setAgentList(list);
      if (list.length > 0 && !selectedAgentId) setSelectedAgentId(list[0].id);
    }).catch(() => {});
  }, [open]);

  const filteredContacts = contacts.filter(c =>
    !contactSearch || c.name?.toLowerCase().includes(contactSearch.toLowerCase()) || c.phone.includes(contactSearch)
  );

  const selectContact = (c: Contact) => {
    setSelectedContact(c);
    setPhone(c.phone);
    setContactSearch(c.name || c.phone);
  };

  const handleDial = async () => {
    const target = phone.trim();
    if (!target) { toast.error("Enter a phone number"); return; }
    setDialing(true);
    try {
      await calls.outbound(target, selectedAgentId || undefined, selectedContact?.id);
      toast.success(`Dialling ${target}…`);
      setOpen(false);
      setPhone(""); setContactSearch(""); setSelectedContact(null);
      onCallStarted();
    } catch (e: any) {
      toast.error(e.message || "Call failed");
    } finally {
      setDialing(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" />
        New Call
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">New Call</h2>
                <p className="text-sm text-slate-400">Dial a contact or enter a number directly</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Contact search */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Search contact</label>
              <input
                value={contactSearch}
                onChange={e => { setContactSearch(e.target.value); setSelectedContact(null); }}
                placeholder="Name or phone…"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
              />
              {contactSearch && !selectedContact && filteredContacts.length > 0 && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800">
                  {filteredContacts.slice(0, 8).map(c => (
                    <button
                      key={c.id}
                      onClick={() => selectContact(c)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-700"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {(c.name || c.phone)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white">{c.name || "Unnamed"}</p>
                        <p className="text-xs text-slate-400">{c.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Direct number */}
            <div className="mb-6">
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Phone number</label>
              <input
                value={phone}
                onChange={e => { setPhone(e.target.value); setSelectedContact(null); }}
                placeholder="+91 98765 43210"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
              />
              {selectedContact && (
                <p className="mt-1 text-xs text-green-400">✓ {selectedContact.name} selected</p>
              )}
            </div>

            {/* Agent selection */}
            {agentList.length > 0 && (
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Voice Agent</label>
                <select
                  value={selectedAgentId}
                  onChange={e => setSelectedAgentId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                >
                  <option value="">Use default agent</option>
                  {agentList.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDial}
                disabled={dialing || !phone.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
              >
                {dialing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                {dialing ? "Dialling…" : "Dial"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function CallsPage() {
  const [callList, setCallList] = useState<Call[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [agentOptions, setAgentOptions] = useState<AgentConfig[]>([]);
  const LIMIT = 20;

  useEffect(() => {
    agentsApi.list().then(setAgentOptions).catch(() => {});
  }, []);

  const loadCalls = () => {
    setLoading(true);
    const token = getToken();
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (statusFilter) qs.set('status', statusFilter);
    if (agentFilter) qs.set('agent_id', agentFilter);
    fetch(`${base}/calls?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((res) => { setCallList(res.items); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCalls();
  }, [page, statusFilter, agentFilter]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Calls</h1>
          <p className="text-sm text-slate-400">Voice call history and transcripts</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300"
          >
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="active">Active</option>
            <option value="dialing">Dialing</option>
            <option value="failed">Failed</option>
          </select>
          {agentOptions.length > 0 && (
            <select
              value={agentFilter}
              onChange={(e) => { setAgentFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300"
            >
              <option value="">All agents</option>
              {agentOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <NewCallDialog onCallStarted={() => { setTimeout(loadCalls, 1500); }} />
        </div>
      </div>

      {/* Active calls monitor */}
      <ActiveCallMonitor onRefresh={loadCalls} />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total", value: total, icon: Phone },
          { label: "Completed", value: callList.filter(c => c.status === "completed").length, icon: Phone },
          { label: "Active", value: callList.filter(c => c.status === "active").length, icon: Clock },
          { label: "Failed", value: callList.filter(c => c.status === "failed").length, icon: Phone },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2 text-slate-400">
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading calls…</div>
        ) : callList.length === 0 ? (
          <div className="py-16 text-center">
            <Phone className="mx-auto mb-3 h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-500">No calls yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {callList.map((call) => (
              <div key={call.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  {/* Direction icon */}
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800">
                    {call.direction === "inbound"
                      ? <PhoneIncoming className="h-4 w-4 text-blue-400" />
                      : <PhoneOutgoing className="h-4 w-4 text-green-400" />}
                  </div>

                  {/* Number + contact + date */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      {(call as any).contact_name ? (
                        <span className="text-white">{(call as any).contact_name} · </span>
                      ) : null}
                      <span className="text-slate-300">{call.direction === "inbound" ? call.from_number : call.to_number}</span>
                      {" · "}
                      <span className="capitalize text-slate-400">{call.direction}</span>
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(call.started_at)}</p>
                  </div>

                  {/* Agent badge */}
                  {(call as any).agent_name && (
                    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Bot className="h-2.5 w-2.5" />
                      {(call as any).agent_name}
                    </span>
                  )}

                  {/* Duration */}
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    {formatDuration(call.duration_seconds)}
                  </div>

                  {/* Cost */}
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <DollarSign className="h-3 w-3" />
                    {formatCost(call.cost_cents)}
                  </div>

                  <StatusBadge status={call.status} />
                </div>
                {call.status === "completed" && <TranscriptRow callId={call.id} />}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-400 disabled:opacity-40 hover:bg-slate-800"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-400 disabled:opacity-40 hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
