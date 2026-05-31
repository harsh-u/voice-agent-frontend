"use client";

import { useState } from "react";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calls } from "@/lib/api/client";

interface CallButtonProps {
  contactId: string;
  phone: string;
  agentConfigId?: string;
  onCallStarted?: (callId: string) => void;
}

export function CallButton({ contactId, phone, agentConfigId, onCallStarted }: CallButtonProps) {
  const [status, setStatus] = useState<"idle" | "calling" | "active" | "error">("idle");
  const [callId, setCallId] = useState<string | null>(null);

  const handleCall = async () => {
    setStatus("calling");
    try {
      const result = await calls.outbound(phone, agentConfigId, contactId);
      setCallId(result.call_id);
      setStatus("active");
      onCallStarted?.(result.call_id);
    } catch (e) {
      console.error("Call failed:", e);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const handleHangup = async () => {
    if (!callId) return;
    try {
      await calls.hangup(callId);
    } finally {
      setStatus("idle");
      setCallId(null);
    }
  };

  if (status === "active") {
    return (
      <Button
        variant="destructive"
        size="sm"
        onClick={handleHangup}
        className="gap-2"
      >
        <PhoneOff className="h-4 w-4" />
        Hang up
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCall}
      disabled={status === "calling"}
      className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
    >
      {status === "calling" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Phone className="h-4 w-4" />
      )}
      {status === "calling" ? "Calling…" : status === "error" ? "Failed" : "Call"}
    </Button>
  );
}
