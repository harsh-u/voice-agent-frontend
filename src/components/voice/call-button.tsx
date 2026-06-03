"use client";

import { useEffect, useState } from "react";
import { Phone, PhoneOff, Loader2, X, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calls, agents as agentsApi, getToken, type AgentConfig } from "@/lib/api/client";
import { toast } from "sonner";

interface CallButtonProps {
  contactId: string;
  phone: string;
  contactName?: string;
  onCallStarted?: (callId: string) => void;
}

export function CallButton({ contactId, phone, contactName, onCallStarted }: CallButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [agentList, setAgentList] = useState<AgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [status, setStatus] = useState<"idle" | "calling" | "active" | "error">("idle");
  const [callId, setCallId] = useState<string | null>(null);

  // Load agents when dialog opens
  useEffect(() => {
    if (!dialogOpen) return;
    agentsApi.list().then((list) => {
      setAgentList(list);
      if (list.length > 0) setSelectedAgentId(list[0].id);
    }).catch(() => {});
  }, [dialogOpen]);

  const handleDial = async () => {
    setStatus("calling");
    try {
      const result = await calls.outbound(phone, selectedAgentId || undefined, contactId);
      setCallId(result.call_id);
      setStatus("active");
      setDialogOpen(false);
      onCallStarted?.(result.call_id);
      toast.success(`Calling ${contactName || phone}…`);
    } catch (e: any) {
      setStatus("error");
      toast.error(e.message || "Call failed");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const handleHangup = async () => {
    if (!callId) return;
    try {
      await calls.hangup(callId);
      toast.success("Call ended");
    } finally {
      setStatus("idle");
      setCallId(null);
    }
  };

  if (status === "active") {
    return (
      <Button variant="destructive" size="sm" onClick={handleHangup} className="gap-2">
        <PhoneOff className="h-3.5 w-3.5" />
        Hang up
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDialogOpen(true)}
        className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
      >
        <Phone className="h-3.5 w-3.5" />
        Call
      </Button>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDialogOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Call {contactName || phone}</h3>
                <p className="text-xs text-slate-400">{phone}</p>
              </div>
              <button onClick={() => setDialogOpen(false)} className="text-slate-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {agentList.length > 0 && (
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Voice Agent</label>
                <select
                  value={selectedAgentId}
                  onChange={e => setSelectedAgentId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                >
                  <option value="">Use default agent</option>
                  {agentList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setDialogOpen(false)} className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800">
                Cancel
              </button>
              <button
                onClick={handleDial}
                disabled={status === "calling"}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
              >
                {status === "calling" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                {status === "calling" ? "Calling…" : "Dial"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
