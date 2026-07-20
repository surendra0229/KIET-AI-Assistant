import { createFileRoute } from "@tanstack/react-router";
import {
  UploadCloud,
  FileText,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  Loader2,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, type DocumentInfo } from "@/services/api";

export const Route = createFileRoute("/_shell/documents")({
  component: DocumentsPage,
});

const ALLOWED = ["docx", "xlsx", "pdf", "txt"];
const MAX_SIZE = 50 * 1024 * 1024;

function humanSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [reindexing, setReindexing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { documents } = await api.documents();
      setDocs(documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const existingNames = useMemo(() => new Set(docs.map((d) => d.filename)), [docs]);

  const filtered = useMemo(
    () => docs.filter((d) => d.filename.toLowerCase().includes(query.toLowerCase())),
    [docs, query],
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const valid: File[] = [];
      Array.from(files).forEach((f) => {
        const ext = f.name.split(".").pop()?.toLowerCase();
        if (!ext || !ALLOWED.includes(ext)) {
          toast.error(`Unsupported file`, { description: f.name });
          return;
        }
        if (f.size > MAX_SIZE) {
          toast.error(`Too large`, { description: `${f.name} exceeds 50 MB` });
          return;
        }
        if (existingNames.has(f.name)) {
          toast.error(`Already uploaded`, {
            description: `${f.name} already exists. Delete it first to re-upload.`,
          });
          return;
        }
        valid.push(f);
      });
      if (valid.length === 0) return;

      setUploading(true);
      try {
        const { uploaded } = await api.upload(valid);
        uploaded.forEach((r) => {
          if (r.status === "indexed") {
            toast.success(`Indexed ${r.filename}`, {
              description: `${r.chunks ?? 0} chunks embedded`,
            });
          } else {
            toast.error(`Failed ${r.filename}`, { description: r.error ?? r.status });
          }
        });
        await reload();
      } catch (e: any) {
        toast.error("Upload failed", { description: e.message });
      } finally {
        setUploading(false);
      }
    },
    [existingNames, reload],
  );

  const remove = async (name: string) => {
    if (!window.confirm(`Delete "${name}" and remove its embeddings?`)) return;
    try {
      await api.deleteDocument(name);
      toast.success(`Deleted ${name}`);
      await reload();
    } catch (e: any) {
      toast.error("Delete failed", { description: e.message });
    }
  };

  const reindexAll = async () => {
    setReindexing(true);
    try {
      const res = await api.reindex();
      toast.success(`Reindexed ${res.indexed.length} documents`, {
        description: `${res.total_chunks} chunks total`,
      });
      await reload();
    } catch (e: any) {
      toast.error("Reindex failed", { description: e.message });
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-brand">Documents</p>
          <h1 className="mt-2 font-display text-5xl">Document manager</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload, reindex, and manage every file feeding your knowledge base.
          </p>
        </div>
        <button
          onClick={reindexAll}
          disabled={reindexing || docs.length === 0}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50"
        >
          {reindexing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Reindex all
        </button>
      </div>

      {/* Upload area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`relative rounded-3xl border-2 border-dashed p-12 text-center transition-colors ${
          dragOver ? "border-brand bg-brand/5" : "border-border bg-surface"
        }`}
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <UploadCloud className="h-6 w-6" />
          )}
        </div>
        <h3 className="mt-5 font-display text-2xl">
          {uploading ? "Indexing…" : "Drop files here"}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          or click to browse · DOCX, XLSX, PDF, TXT · up to 50 MB each
        </p>
        <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5">
          <UploadCloud className="h-4 w-4" />
          Choose files
          <input
            type="file"
            multiple
            accept=".docx,.xlsx,.pdf,.txt"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="rounded-md border border-border px-2 py-1">.docx</span>
          <span className="rounded-md border border-border px-2 py-1">.xlsx</span>
          <span className="rounded-md border border-border px-2 py-1">.pdf</span>
          <span className="rounded-md border border-border px-2 py-1">.txt</span>
        </div>
      </div>

      {/* Search + list */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="font-display text-xl">Your documents</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="h-9 w-56 rounded-lg border border-border bg-surface pl-9 pr-3 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {docs.length} file{docs.length === 1 ? "" : "s"}
          </span>
        </div>

        {error ? (
          <div className="px-5 py-10 text-center text-sm text-destructive">{error}</div>
        ) : loading ? (
          <div className="grid place-items-center py-14 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-muted-foreground">
            {docs.length === 0
              ? "No documents yet. Upload your first file to get started."
              : `No documents match "${query}".`}
          </div>
        ) : (
          <ul>
            {filtered.map((d) => (
              <li
                key={d.filename}
                className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4 last:border-0 hover:bg-surface/40"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
                  {d.documentType === "xlsx" || d.documentType === "xlsm" ? (
                    <FileSpreadsheet className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{d.filename}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {humanSize(d.fileSize)} · {d.chunkCount} chunks · {d.embeddingModel}
                  </p>
                </div>
                <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium capitalize text-brand">
                  {d.indexStatus}
                </span>
                <button
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => remove(d.filename)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
