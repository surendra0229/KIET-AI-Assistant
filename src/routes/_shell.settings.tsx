import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Save, KeyRound, Cpu, Layers, Palette, Sun, Moon, Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { api, type SettingsResponse } from "@/services/api";

export const Route = createFileRoute("/_shell/settings")({
  component: SettingsPage,
});

function Field({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: any;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-card p-5 md:grid-cols-[220px_1fr] md:items-center md:gap-6">
      <div>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-brand" />
          <p className="text-sm font-medium text-foreground">{label}</p>
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [config, setConfig] = useState<SettingsResponse | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [chunkSize, setChunkSize] = useState(1000);
  const [overlap, setOverlap] = useState(200);
  const [topK, setTopK] = useState(5);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.settings();
        setConfig(s);
        setChunkSize(s.user.chunkSize ?? s.runtime.chunkSize);
        setOverlap(s.user.chunkOverlap ?? s.runtime.chunkOverlap);
        setTopK(s.user.topK ?? s.runtime.topK);
      } catch (e: any) {
        toast.error("Couldn't load settings", { description: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateSettings({
        geminiApiKey: apiKey || undefined,
        chunkSize,
        chunkOverlap: overlap,
        topK,
        theme,
      });
      toast.success("Settings saved");
      setApiKey("");
    } catch (e: any) {
      toast.error("Save failed", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-brand">Settings</p>
        <h1 className="mt-2 font-display text-5xl">Configuration</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Model credentials, retrieval strategy, and interface preferences. Persisted in MongoDB.
        </p>
      </div>

      <div className="space-y-4">
        <Field
          icon={KeyRound}
          label="Gemini API key"
          hint={
            config?.runtime.geminiConfigured
              ? "Key already configured in backend/.env"
              : "Paste a new key; stored server-side, never exposed to the browser."
          }
        >
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config?.runtime.geminiConfigured ? "•••• configured ••••" : "AIza…"}
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 font-mono text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </Field>

        <Field icon={Cpu} label="Embedding model" hint="Read-only — configured in backend/.env">
          <input
            readOnly
            value={config?.runtime.embeddingModel ?? ""}
            className="h-10 w-full cursor-not-allowed rounded-xl border border-border bg-muted/40 px-3 text-sm text-muted-foreground"
          />
        </Field>

        <Field icon={Layers} label="Chunk size" hint="Characters per chunk before overlap.">
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={200}
              max={2000}
              step={100}
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              className="flex-1 accent-[color:var(--color-brand)]"
            />
            <span className="w-20 rounded-lg border border-border bg-surface px-3 py-1.5 text-center font-mono text-sm">
              {chunkSize}
            </span>
          </div>
        </Field>

        <Field
          icon={Layers}
          label="Chunk overlap"
          hint="Characters shared between adjacent chunks."
        >
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={500}
              step={20}
              value={overlap}
              onChange={(e) => setOverlap(Number(e.target.value))}
              className="flex-1 accent-[color:var(--color-brand)]"
            />
            <span className="w-20 rounded-lg border border-border bg-surface px-3 py-1.5 text-center font-mono text-sm">
              {overlap}
            </span>
          </div>
        </Field>

        <Field icon={Layers} label="Top-K retrieval" hint="Number of chunks fetched per query.">
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={15}
              step={1}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="flex-1 accent-[color:var(--color-brand)]"
            />
            <span className="w-20 rounded-lg border border-border bg-surface px-3 py-1.5 text-center font-mono text-sm">
              {topK}
            </span>
          </div>
        </Field>

        <Field icon={Palette} label="Theme" hint="Interface color scheme.">
          <div className="flex gap-2">
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  theme === t
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {t}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
      </div>
    </div>
  );
}
