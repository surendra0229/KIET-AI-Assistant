import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileText, Search, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, type DocumentInfo } from "@/services/api";

export const Route = createFileRoute("/_shell/knowledge")({
  component: KnowledgePage,
});

function KnowledgePage() {
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { documents } = await api.documents();
        setDocs(documents);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalChunks = useMemo(() => docs.reduce((a, d) => a + (d.chunkCount ?? 0), 0), [docs]);
  const filtered = useMemo(
    () => docs.filter((r) => r.filename.toLowerCase().includes(q.toLowerCase())),
    [docs, q],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-brand">Knowledge</p>
        <h1 className="mt-2 font-display text-5xl">Knowledge base</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every document currently indexed in the vector store, with embedding status and chunk
          counts.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter documents…"
            className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div className="ml-auto flex items-center gap-2 font-mono text-xs text-muted-foreground">
          Total chunks · <span className="text-foreground">{totalChunks.toLocaleString()}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="grid place-items-center py-14 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <div className="px-5 py-10 text-center text-sm text-destructive">{error}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-5 py-3 font-normal">Document</th>
                <th className="px-5 py-3 font-normal">Chunks</th>
                <th className="px-5 py-3 font-normal">Status</th>
                <th className="px-5 py-3 font-normal">Embedding</th>
                <th className="px-5 py-3 font-normal">Last updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.filename}
                  className="border-b border-border last:border-0 hover:bg-surface/60"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-brand">
                        <FileText className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-foreground">{r.filename}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-muted-foreground">{r.chunkCount}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium capitalize text-brand">
                      <CheckCircle2 className="h-3 w-3" /> {r.indexStatus}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                    {r.embeddingModel.split("/").pop()}
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                    {docs.length === 0 ? "No indexed documents yet." : `No documents match “${q}”.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
