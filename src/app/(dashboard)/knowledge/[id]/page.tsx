"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Upload, Link2, Loader2, FileText, Trash2, CheckCircle2,
  AlertCircle, Clock, Bot, Globe,
} from "lucide-react";
import { knowledge, type KnowledgeBase, type KnowledgeDocument } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: typeof Clock; label: string; spin?: boolean }> = {
    ready: { cls: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2, label: "Ready" },
    processing: { cls: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Loader2, label: "Processing", spin: true },
    pending: { cls: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Clock, label: "Pending" },
    failed: { cls: "bg-red-500/10 text-red-400 border-red-500/20", icon: AlertCircle, label: "Failed" },
  };
  const s = map[status] ?? { cls: "bg-slate-500/10 text-slate-400 border-slate-500/20", icon: Clock, label: status };
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", s.cls)}>
      <Icon className={cn("h-3 w-3", s.spin && "animate-spin")} />
      {s.label}
    </span>
  );
}

export default function KnowledgeDetailPage() {
  const params = useParams<{ id: string }>();
  const kbId = params.id;

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const [addingUrl, setAddingUrl] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = () => knowledge.documents.list(kbId).then(setDocs).catch(() => {});

  useEffect(() => {
    setLoading(true);
    Promise.all([knowledge.get(kbId).then(setKb).catch(() => {}), loadDocs()])
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbId]);

  // Poll while any document is still being ingested.
  useEffect(() => {
    const pending = docs.some((d) => d.status === "pending" || d.status === "processing");
    if (!pending) return;
    const t = setInterval(loadDocs, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await knowledge.documents.upload(kbId, file);
      toast.success("Document uploaded — ingesting…");
      loadDocs();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onAddUrl = async () => {
    if (!url.trim()) return;
    setAddingUrl(true);
    try {
      await knowledge.documents.addUrl(kbId, url.trim());
      toast.success("URL queued — ingesting…");
      setUrl("");
      loadDocs();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to add URL");
    } finally {
      setAddingUrl(false);
    }
  };

  const removeDoc = async (docId: string, name: string) => {
    if (!confirm(`Remove "${name}"?`)) return;
    try {
      await knowledge.documents.remove(kbId, docId);
      toast.success("Document removed");
      loadDocs();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to remove");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/knowledge" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
          <ArrowLeft className="h-3 w-3" /> Knowledge
        </Link>
        <h1 className="text-xl font-semibold text-white">{kb?.name ?? (loading ? "Loading…" : "Knowledge base")}</h1>
        {kb?.description && <p className="text-sm text-slate-400">{kb.description}</p>}
      </div>

      {/* How-to banner */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs text-slate-300">
          Attach this knowledge base to a voice agent (in <span className="font-medium text-white">Voice Agents</span>) and the
          agent will look up answers from these documents while on a call.
        </p>
      </div>

      {/* Add documents */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-white"><Upload className="h-4 w-4" /> Upload a file</h3>
          <p className="mb-3 text-xs text-slate-500">PDF, DOCX or TXT.</p>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={onUpload} className="hidden" id="kb-file" />
          <label
            htmlFor="kb-file"
            className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800", uploading && "pointer-events-none opacity-60")}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Choose file"}
          </label>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-white"><Link2 className="h-4 w-4" /> Add from URL</h3>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/page"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
            />
            <button
              onClick={onAddUrl}
              disabled={addingUrl || !url.trim()}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {addingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </button>
          </div>
        </div>
      </div>

      {/* Documents list */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-4 py-3 text-sm font-medium text-white">Documents</div>
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">No documents yet</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400">
                  {d.source_type === "url" ? <Globe className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{d.filename || d.source_url}</p>
                  <p className="text-xs text-slate-500">
                    {d.chunk_count} chunks
                    {d.status === "failed" && d.error ? ` · ${d.error}` : ""}
                  </p>
                </div>
                <StatusBadge status={d.status} />
                <button
                  onClick={() => removeDoc(d.id, d.filename || d.source_url || "document")}
                  className="rounded p-1 text-slate-600 hover:bg-red-500/10 hover:text-red-400"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
