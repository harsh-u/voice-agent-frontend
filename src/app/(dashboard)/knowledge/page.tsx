"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Library, Plus, Loader2, X, FileText, Layers, Trash2 } from "lucide-react";
import { knowledge, type KnowledgeBase } from "@/lib/api/client";
import { toast } from "sonner";

function CreateDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await knowledge.create({ name: name.trim(), description: description.trim() || undefined });
      toast.success("Knowledge base created");
      setOpen(false); setName(""); setDescription("");
      onCreated();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" />
        New Knowledge Base
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">New Knowledge Base</h2>
                <p className="text-sm text-slate-400">A document store your voice agents can answer from</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Product FAQ"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
              />
            </div>
            <div className="mb-6">
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What's in this knowledge base?"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saving || !name.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function KnowledgePage() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    knowledge.list().then(setKbs).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete knowledge base "${name}"? This removes all its documents.`)) return;
    try {
      await knowledge.remove(id);
      toast.success("Knowledge base deleted");
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Knowledge</h1>
          <p className="text-sm text-slate-400">Knowledge bases your voice agents can query during calls</p>
        </div>
        <CreateDialog onCreated={load} />
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading…</div>
      ) : kbs.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center">
          <Library className="mx-auto mb-3 h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-500">No knowledge bases yet</p>
          <p className="mt-1 text-xs text-slate-600">Create one, upload documents, then attach it to a voice agent.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kbs.map((kb) => (
            <div key={kb.id} className="group relative rounded-xl border border-slate-800 bg-slate-900 p-5 transition-colors hover:border-slate-700">
              <Link href={`/knowledge/${kb.id}`} className="block">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Library className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{kb.name}</p>
                    <p className="truncate text-xs text-slate-500">{kb.description || "No description"}</p>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{kb.doc_count} docs</span>
                  <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{kb.chunk_count} chunks</span>
                  {kb.enable_hybrid && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">hybrid</span>}
                </div>
              </Link>
              <button
                onClick={() => remove(kb.id, kb.name)}
                className="absolute right-3 top-3 rounded p-1 text-slate-600 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
