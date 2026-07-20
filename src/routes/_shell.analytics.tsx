import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, Clock, Zap, Loader2 } from "lucide-react";
import { api, type DashboardResponse } from "@/services/api";

export const Route = createFileRoute("/_shell/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-sm text-muted-foreground">
        {error ?? "No analytics data yet."}
      </div>
    );
  }

  const series = data.queryVolume.map((d) => ({ d: d.date.slice(5), q: d.count }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-brand">Analytics</p>
        <h1 className="mt-2 font-display text-5xl">Usage & performance</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live metrics computed from the analytics event log in MongoDB.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6">
          <TrendingUp className="h-5 w-5 text-brand" />
          <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Queries · last 7 days
          </p>
          <p className="mt-1 font-display text-4xl">{data.performance.chats7d}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <Clock className="h-5 w-5 text-brand" />
          <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Avg. retrieval
          </p>
          <p className="mt-1 font-display text-4xl">
            {data.performance.avgRetrievalMs
              ? `${Math.round(data.performance.avgRetrievalMs)}ms`
              : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <Zap className="h-5 w-5 text-brand" />
          <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Avg. generation
          </p>
          <p className="mt-1 font-display text-4xl">
            {data.performance.avgGenerationMs
              ? `${Math.round(data.performance.avgGenerationMs)}ms`
              : "—"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl">Query volume</h2>
        <p className="mt-1 text-xs text-muted-foreground">Chats per day · last 7 days</p>
        <div className="mt-6 h-64">
          {series.length === 0 ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              No chat activity yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-brand)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="var(--color-brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="d" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="q"
                  stroke="var(--color-brand)"
                  fill="url(#brandGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
