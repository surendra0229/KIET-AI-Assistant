import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  FileStack,
  Database,
  Layers,
  Cpu,
  MessagesSquare,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api, type DashboardResponse } from "@/services/api";

export const Route = createFileRoute("/_shell/dashboard")({
  component: DashboardPage,
});

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:border-brand/40">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 font-display text-4xl leading-none text-foreground">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function InfoCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3.5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
      </div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
          ok ? "bg-brand/10 text-brand" : "bg-destructive/10 text-destructive"
        }`}
      >
        {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        {ok ? "Online" : "Offline"}
      </span>
    </div>
  );
}

function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setData(await api.dashboard());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid h-full place-items-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
        <p className="mt-4 text-sm text-muted-foreground">{error ?? "No data"}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-brand">Overview</p>
          <h1 className="mt-2 font-display text-5xl">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Real-time indexing status, chat activity, and system health.
          </p>
        </div>
        {!data.mongo.connected && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4" />
            MongoDB not connected — set MONGODB_URI in backend/.env
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileStack}
          label="Uploaded documents"
          value={String(data.documents.onDisk)}
          hint={`${data.documents.indexed} indexed`}
        />
        <StatCard
          icon={Database}
          label="Indexed documents"
          value={String(data.documents.indexed)}
          hint="stored in MongoDB"
        />
        <StatCard
          icon={Layers}
          label="Knowledge chunks"
          value={data.documents.chunks.toLocaleString()}
          hint="stored in ChromaDB"
        />
        <StatCard
          icon={MessagesSquare}
          label="Chat sessions"
          value={String(data.chats.total)}
          hint={`${data.chats.messages} messages`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">System</h2>
            <span className="font-mono text-xs text-muted-foreground">Live</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoCard label="Embedding model" value={data.config.embeddingModel} ok />
            <InfoCard label="Vector database" value={data.config.vectorDb} ok />
            <InfoCard
              label="LLM provider"
              value={data.config.llm}
              ok={data.config.geminiConfigured}
            />
            <InfoCard label="MongoDB Atlas" value="Persistence" ok={data.mongo.connected} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand" />
            <h2 className="font-display text-2xl">Recent uploads</h2>
          </div>
          {data.recentUploads.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No uploads yet.</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {data.recentUploads.map((u, i) => (
                <li key={i} className="flex gap-3">
                  <div className="mt-1 flex flex-col items-center">
                    <span className="h-2 w-2 rounded-full bg-brand" />
                    {i < data.recentUploads.length - 1 && (
                      <span className="mt-1 h-full w-px bg-border" />
                    )}
                  </div>
                  <div className="flex-1 pb-1">
                    <p className="truncate text-sm text-foreground">{u.filename}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {u.chunks} chunks
                      {u.uploadedAt ? ` · ${new Date(u.uploadedAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <Cpu className="h-5 w-5 text-brand" />
          <p className="mt-3 font-display text-2xl">
            {data.performance.avgRetrievalMs
              ? `${Math.round(data.performance.avgRetrievalMs)} ms`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Avg. retrieval time</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <Activity className="h-5 w-5 text-brand" />
          <p className="mt-3 font-display text-2xl">
            {data.performance.avgGenerationMs
              ? `${Math.round(data.performance.avgGenerationMs)} ms`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Avg. generation time</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <MessagesSquare className="h-5 w-5 text-brand" />
          <p className="mt-3 font-display text-2xl">{data.performance.chats7d}</p>
          <p className="mt-1 text-xs text-muted-foreground">Chats · last 7 days</p>
        </div>
      </div>
    </div>
  );
}
