import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  Database,
  FileSearch,
  Shield,
  Zap,
  Layers,
  Github,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const features = [
  {
    icon: FileSearch,
    title: "Grounded answers",
    desc: "Every response is cited from your uploaded college documents. Zero hallucinations.",
  },
  {
    icon: Database,
    title: "Vector-native",
    desc: "ChromaDB stores dense embeddings for millisecond semantic retrieval across thousands of pages.",
  },
  {
    icon: Shield,
    title: "Private by default",
    desc: "Documents never leave your infrastructure. Bring your own Gemini API key.",
  },
  {
    icon: Zap,
    title: "Real-time chat",
    desc: "Streaming responses with full markdown rendering, code blocks, and citation chips.",
  },
  {
    icon: Layers,
    title: "Multi-format",
    desc: "DOCX, XLSX, PDF, and plain text — chunked, embedded, and indexed automatically.",
  },
  {
    icon: Sparkles,
    title: "Admin analytics",
    desc: "Track top questions, document coverage, and response latency from a single pane.",
  },
];

const stack = [
  { group: "Frontend", items: ["React 19", "Vite", "TanStack Router", "Tailwind CSS v4"] },
  { group: "Backend", items: ["Python 3.11", "FastAPI", "Uvicorn", "Pydantic v2"] },
  {
    group: "AI Layer",
    items: ["Gemini 1.5", "Sentence Transformers", "ChromaDB", "LangChain-style RAG"],
  },
];

function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-glow text-brand-foreground">
              <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <span className="font-display text-xl">KIET AI</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#architecture" className="hover:text-foreground">
              Architecture
            </a>
            <a href="#stack" className="hover:text-foreground">
              Stack
            </a>
            <a href="#roadmap" className="hover:text-foreground">
              Roadmap
            </a>
          </nav>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            Launch app <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-[140px]" />
        <div className="relative mx-auto max-w-5xl px-6 py-28 text-center md:py-36">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            <span className="font-mono uppercase tracking-widest text-muted-foreground">
              RAG · v1.0 · Enterprise foundation
            </span>
          </div>
          <h1 className="mt-8 font-display text-6xl leading-[0.95] md:text-8xl">
            The AI that answers <span className="text-gradient-brand italic">only</span> from
            <br />
            your college's documents.
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground">
            Upload your handbooks, syllabi, and policy PDFs. KIET AI grounds every response in your
            own knowledge base — cited, verifiable, and never hallucinated.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/chat"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/10 transition-transform hover:-translate-y-0.5"
            >
              Try the assistant <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#architecture"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-3 text-sm font-medium text-foreground hover:bg-accent"
            >
              <Github className="h-4 w-4" /> View architecture
            </a>
          </div>

          {/* mock chat card */}
          <div className="mt-20 mx-auto max-w-3xl">
            <div className="glass rounded-3xl p-2 shadow-2xl shadow-brand/5">
              <div className="rounded-2xl border border-border bg-surface-elevated p-6 text-left">
                <div className="flex items-center gap-2 border-b border-border pb-4">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                    <span className="h-2.5 w-2.5 rounded-full bg-chart-3/60" />
                    <span className="h-2.5 w-2.5 rounded-full bg-brand/70" />
                  </div>
                  <p className="ml-2 font-mono text-xs text-muted-foreground">
                    chat / academic-handbook-2024.docx
                  </p>
                </div>
                <div className="mt-5 space-y-4">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      What's the attendance policy for final year students?
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-2 text-sm">
                      <p className="text-foreground">
                        Final-year students require <strong>75% minimum attendance</strong> per
                        subject to be eligible for end-semester examinations…
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                          handbook.docx · p.42
                        </span>
                        <span className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                          policy-2024.pdf · §3.1
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-widest text-brand">Features</p>
            <h2 className="mt-3 font-display text-5xl">Built for institutions, not demos.</h2>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group bg-background p-8 transition-colors hover:bg-surface"
              >
                <Icon className="h-6 w-6 text-brand" strokeWidth={1.75} />
                <h3 className="mt-5 text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="border-t border-border bg-surface py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-brand">Architecture</p>
            <h2 className="mt-3 font-display text-5xl">A pipeline you can trust.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Every question flows through a deterministic five-stage pipeline. No hidden magic.
            </p>
          </div>
          <div className="mt-16 grid gap-4 md:grid-cols-5">
            {[
              { n: "01", t: "Ingest", d: "DOCX · XLSX · PDF" },
              { n: "02", t: "Chunk", d: "Recursive splitter" },
              { n: "03", t: "Embed", d: "MiniLM · L6-v2" },
              { n: "04", t: "Retrieve", d: "ChromaDB · top-k" },
              { n: "05", t: "Generate", d: "Gemini 1.5 Flash" },
            ].map((s, i) => (
              <div key={s.n} className="relative">
                <div className="rounded-2xl border border-border bg-background p-5">
                  <p className="font-mono text-xs text-brand">{s.n}</p>
                  <h4 className="mt-2 font-display text-xl">{s.t}</h4>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{s.d}</p>
                </div>
                {i < 4 && (
                  <ArrowRight className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stack */}
      <section id="stack" className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-16 lg:grid-cols-[1fr_2fr] lg:items-start">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-brand">Tech stack</p>
              <h2 className="mt-3 font-display text-5xl">Boring where it matters.</h2>
              <p className="mt-4 text-muted-foreground">
                Proven, production-grade tools across the entire stack. No experimental frameworks
                in the critical path.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {stack.map((g) => (
                <div key={g.group} className="rounded-2xl border border-border bg-surface p-6">
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    {g.group}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {g.items.map((i) => (
                      <li key={i} className="flex items-center gap-2 text-foreground">
                        <span className="h-1 w-1 rounded-full bg-brand" />
                        {i}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why RAG */}
      <section className="border-t border-border bg-surface py-24">
        <div className="mx-auto grid max-w-6xl gap-14 px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-brand">Why RAG?</p>
            <h2 className="mt-3 font-display text-5xl">Because facts beat fluency.</h2>
            <p className="mt-5 text-muted-foreground">
              Base LLMs hallucinate policies, invent deadlines, and misquote handbooks. Retrieval-
              augmented generation grounds every answer in a specific, cited passage from your own
              corpus — auditable and trustworthy.
            </p>
          </div>
          <div className="grid gap-3">
            {[
              ["❌ Plain LLM", "Invents an attendance rule that doesn't exist."],
              ["✅ RAG-grounded", "Cites §3.1 of the 2024 handbook, verbatim."],
            ].map(([label, body]) => (
              <div key={label} className="rounded-2xl border border-border bg-background p-5">
                <p className="font-mono text-xs text-muted-foreground">{label}</p>
                <p className="mt-2 text-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6">
          <p className="font-mono text-xs uppercase tracking-widest text-brand">Roadmap</p>
          <h2 className="mt-3 font-display text-5xl">Where we're headed.</h2>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                p: "Q1",
                t: "Multi-tenant workspaces",
                d: "Separate corpora per department with fine-grained access control.",
              },
              {
                p: "Q2",
                t: "Streaming citations",
                d: "Live inline highlighting of source passages as tokens stream.",
              },
              {
                p: "Q3",
                t: "Faculty co-pilot",
                d: "Generate syllabi, quizzes, and rubrics grounded in institutional style.",
              },
            ].map((r) => (
              <div key={r.p} className="rounded-2xl border border-border bg-surface p-6">
                <p className="font-mono text-xs text-brand">{r.p} · 2026</p>
                <h4 className="mt-3 font-display text-2xl">{r.t}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{r.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-brand to-brand-glow text-brand-foreground">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
            </div>
            <span className="font-display text-lg">KIET AI</span>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            © 2026 KIET AI · Built for institutional knowledge.
          </p>
        </div>
      </footer>
    </div>
  );
}
