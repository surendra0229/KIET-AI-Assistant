import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Send,
  Square,
  Sparkles,
  Trash2,
  MessagesSquare,
  FileText,
  Pencil,
  ChevronDown,
  Copy,
  Check,
  Loader2,
  Download,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, type Citation, type ChatSession, type StoredMessage } from "@/services/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_shell/chat")({
  component: ChatPage,
});

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  retrievalMs?: number | null;
  generationMs?: number | null;
  pending?: boolean;
}

function fmtRelative(iso: string) {
  if (!iso) return "just now";
  const safeIso = iso.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const d = new Date(safeIso).getTime();
  if (isNaN(d)) return "just now";
  const diff = Math.max(0, (Date.now() - d) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function stripSourceTags(text: string): string {
  return text
    .replace(/\s*\[Source\s+\d+[^\]]*\]\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function renderMarkdown(text: string): string {
  // Minimal safe markdown: bold, italic, code, line breaks.
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .replace(
      /`([^`]+)`/g,
      '<code class="rounded bg-surface px-1 py-0.5 font-mono text-[12px]">$1</code>',
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [showAllSources, setShowAllSources] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load sessions on mount.
  useEffect(() => {
    (async () => {
      try {
        const { sessions } = await api.listChats();
        setSessions(sessions);
        if (sessions[0]) setActiveId(sessions[0].chatId);
      } catch (e: any) {
        toast.error("Couldn't load chats", { description: e.message });
      } finally {
        setLoadingSessions(false);
      }
    })();
  }, []);

  // Load messages when active session changes.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    (async () => {
      try {
        const { messages } = await api.chatMessages(activeId);
        setMessages(
          messages.map<UIMessage>((m: StoredMessage) => ({
            id: m.messageId,
            role: m.role,
            content: m.content,
            citations: m.citations as Citation[],
            retrievalMs: m.retrievalTime,
            generationMs: m.generationTime,
          })),
        );
      } catch (e: any) {
        toast.error("Couldn't load messages", { description: e.message });
      }
    })();
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, isTyping]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.chatId === activeId) ?? null,
    [sessions, activeId],
  );

  const newChat = async () => {
    try {
      const s = await api.createChat();
      setSessions((p) => [s, ...p]);
      setActiveId(s.chatId);
      setMessages([]);
    } catch (e: any) {
      toast.error("Couldn't create chat", { description: e.message });
    }
  };

  const deleteChat = async (id: string) => {
    try {
      await api.deleteChat(id);
      setSessions((p) => p.filter((s) => s.chatId !== id));
      if (id === activeId) {
        setActiveId(null);
        setMessages([]);
      }
      toast.success("Chat deleted");
    } catch (e: any) {
      toast.error("Delete failed", { description: e.message });
    }
  };

  const renameChat = async (id: string) => {
    const current = sessions.find((s) => s.chatId === id);
    const title = window.prompt("Rename chat", current?.title ?? "");
    if (!title) return;
    try {
      const updated = await api.renameChat(id, title);
      setSessions((p) => p.map((s) => (s.chatId === id ? updated : s)));
    } catch (e: any) {
      toast.error("Rename failed", { description: e.message });
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    // Create a fresh AbortController for this request.
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMsg: UIMessage = { id: "u" + Date.now(), role: "user", content: text };
    const pendingId = "a" + Date.now();
    setMessages((p) => [
      ...p,
      userMsg,
      { id: pendingId, role: "assistant", content: "", pending: true },
    ]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await api.chat(text, activeId, controller.signal);
      const assistant: UIMessage = {
        id: pendingId,
        role: "assistant",
        content: stripSourceTags(res.reply),
        citations: res.citations,
        retrievalMs: res.retrieval_ms,
        generationMs: res.generation_ms,
      };
      setMessages((p) => p.map((m) => (m.id === pendingId ? assistant : m)));

      // Sync session state (create-on-first-message case).
      if (res.chat_id && res.chat_id !== activeId) {
        setActiveId(res.chat_id);
      }
      try {
        const { sessions } = await api.listChats();
        setSessions(sessions);
      } catch {
        /* non-fatal */
      }
    } catch (e: any) {
      // Distinguish an intentional user cancellation from a real error.
      const isAbort = e?.name === "AbortError" || controller.signal.aborted;

      if (isAbort) {
        // Replace the pending bubble with a neutral cancelled message.
        setMessages((p) =>
          p.map((m) =>
            m.id === pendingId ? { ...m, pending: false, content: "Generation stopped." } : m,
          ),
        );
        // Do NOT show an error toast for intentional cancellation.
      } else {
        setMessages((p) =>
          p.map((m) =>
            m.id === pendingId
              ? {
                  ...m,
                  pending: false,
                  content: `⚠️ ${e?.message ?? "Something went wrong."}`,
                }
              : m,
          ),
        );
        toast.error("Assistant error", { description: e?.message });
      }
    } finally {
      setIsTyping(false);
      abortControllerRef.current = null;
    }
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const regenerate = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    // Remove last assistant reply, then re-send.
    setMessages((p) => {
      const lastAssistantIdx = [...p].map((m) => m.role).lastIndexOf("assistant");
      if (lastAssistantIdx === -1) return p;
      return p.filter((_, i) => i !== lastAssistantIdx);
    });
    setInput(lastUser.content);
    setTimeout(send, 0);
  };

  const copy = async (msg: UIMessage) => {
    await navigator.clipboard.writeText(msg.content);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const clearChat = async () => {
    if (!activeId) return;
    if (!window.confirm("Clear all messages in this chat?")) return;
    try {
      await api.clearChatMessages(activeId);
      setMessages([]);
      // Update session list to reflect empty chat
      try {
        const { sessions } = await api.listChats();
        setSessions(sessions);
      } catch {
        /* non-fatal */
      }
      toast.success("Chat cleared");
    } catch (e: any) {
      toast.error("Failed to clear chat", { description: e.message });
    }
  };

  const downloadConversation = () => {
    if (messages.length === 0) {
      toast.warning("Nothing to download — the chat is empty.");
      return;
    }
    const lines: string[] = [
      `KIET AI Assistant — Conversation Export`,
      `Chat: ${activeSession?.title ?? "Untitled"}`,
      `Exported: ${new Date().toLocaleString()}`,
      `${"-".repeat(60)}`,
      "",
    ];
    messages.forEach((m) => {
      const role = m.role === "user" ? "You" : "AI Assistant";
      lines.push(`[${role}]`);
      lines.push(m.content);
      if (m.citations && m.citations.length > 0) {
        lines.push(`Sources: ${m.citations.map((c) => c.document_name).join(", ")}`);
      }
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kiet-ai-chat-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Conversation downloaded");
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
      {/* Chat sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="p-3">
          <button
            onClick={newChat}
            className="flex w-full items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" /> New chat
          </button>
        </div>
        <div className="px-3 pb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Recent
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {loadingSessions ? (
            <div className="grid place-items-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-xs text-muted-foreground">No conversations yet</p>
              <button
                onClick={newChat}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                <Plus className="h-3 w-3" /> Create New Chat
              </button>
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.chatId}
                onClick={() => setActiveId(s.chatId)}
                className={cn(
                  "group mb-1 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  s.chatId === activeId
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <MessagesSquare className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{s.title}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {fmtRelative(s.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      renameChat(s.chatId);
                    }}
                    className="p-1"
                    aria-label="Rename chat"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(s.chatId);
                    }}
                    className="p-1"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Chat surface */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Chat header toolbar */}
        {activeSession && (
          <div className="flex items-center justify-between border-b border-border bg-surface/60 px-5 py-2.5 backdrop-blur-sm">
            <p className="truncate text-sm font-medium text-foreground">{activeSession.title}</p>
            <div className="flex items-center gap-1">
              <button
                onClick={downloadConversation}
                disabled={messages.length === 0}
                title="Download conversation"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
              <button
                onClick={clearChat}
                disabled={messages.length === 0 || isTyping}
                title="Clear all messages"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
              >
                <Eraser className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
          </div>
        )}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-8">
            {messages.length === 0 ? (
              <div className="mt-24 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-glow text-brand-foreground shadow-lg shadow-brand/20">
                  <Sparkles className="h-6 w-6" strokeWidth={2} />
                </div>
                <h2 className="mt-6 font-display text-4xl">Ask your college anything.</h2>
                <p className="mt-3 text-muted-foreground">
                  Grounded in your uploaded documents. Cited, verifiable, private.
                </p>
                <div className="mt-10 grid gap-2 text-left sm:grid-cols-2">
                  {[
                    "What is the fee refund policy?",
                    "When are semester exams scheduled?",
                    "What is the attendance requirement?",
                    "What are the placement eligibility criteria?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground transition-colors hover:border-brand/40 hover:bg-accent"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((m) => {
                  const primary = m.citations?.[0];
                  const rest = m.citations?.slice(1) ?? [];
                  const expanded = showAllSources[m.id];
                  return (
                    <div
                      key={m.id}
                      className={cn("flex gap-4", m.role === "user" && "flex-row-reverse")}
                    >
                      <div
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
                          m.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-brand/15 text-brand",
                        )}
                      >
                        {m.role === "user" ? "You" : <Sparkles className="h-4 w-4" />}
                      </div>
                      <div
                        className={cn(
                          "max-w-[80%] min-w-0",
                          m.role === "user" && "flex flex-col items-end",
                        )}
                      >
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                            m.role === "user"
                              ? "rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-bl-md bg-surface text-foreground",
                          )}
                        >
                          {m.pending ? (
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                              <span className="flex gap-1">
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" />
                              </span>
                              Thinking…
                            </span>
                          ) : (
                            <span dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                          )}
                        </div>

                        {m.role === "assistant" && !m.pending && (
                          <>
                            {primary && (
                              <div className="mt-3 w-full space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                    Sources
                                  </p>
                                  <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                                    {m.retrievalMs != null && (
                                      <span>retrieve · {m.retrievalMs}ms</span>
                                    )}
                                    {m.generationMs != null && (
                                      <span>generate · {m.generationMs}ms</span>
                                    )}
                                  </div>
                                </div>
                                <CitationCard c={primary} primary />
                                {rest.length > 0 && (
                                  <>
                                    {expanded && rest.map((c, i) => <CitationCard key={i} c={c} />)}
                                    <button
                                      onClick={() =>
                                        setShowAllSources((s) => ({ ...s, [m.id]: !expanded }))
                                      }
                                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                                    >
                                      <ChevronDown
                                        className={cn(
                                          "h-3 w-3 transition-transform",
                                          expanded && "rotate-180",
                                        )}
                                      />
                                      {expanded
                                        ? "Hide sources"
                                        : `View ${rest.length} more source${rest.length > 1 ? "s" : ""}`}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                            <div className="mt-2 flex items-center gap-1">
                              <button
                                onClick={() => copy(m)}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                              >
                                {copiedId === m.id ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                                {copiedId === m.id ? "Copied" : "Copy"}
                              </button>
                              <button
                                onClick={regenerate}
                                className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                              >
                                Regenerate
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-background/80 p-4 backdrop-blur-xl">
          <div className="mx-auto max-w-3xl">
            <div className="glass flex items-end gap-2 rounded-2xl p-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  activeSession ? "Continue the conversation…" : "Ask about your documents…"
                }
                rows={1}
                className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                style={{ maxHeight: 160 }}
              />
              <button
                onClick={isTyping ? stopGeneration : send}
                disabled={!isTyping && !input.trim()}
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0",
                  isTyping
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-primary text-primary-foreground",
                )}
                aria-label={isTyping ? "Stop generation" : "Send"}
                title={isTyping ? "Stop generation" : "Send message"}
              >
                {isTyping ? (
                  <Square className="h-4 w-4 fill-current" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground">
              Grounded responses. No hallucinations. Every citation traceable to source.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function CitationCard({ c, primary = false }: { c: Citation; primary?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-xs",
        primary ? "border-brand/40 bg-brand/5" : "border-border bg-card",
      )}
    >
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand">
        <FileText className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{c.document_name}</p>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {c.sheet_name ? `sheet · ${c.sheet_name}` : null}
          {c.sheet_name && c.paragraph_number != null ? " · " : null}
          {c.paragraph_number != null ? `¶ ${c.paragraph_number}` : null}
        </p>
      </div>
      <span className="rounded-md bg-brand/10 px-2 py-0.5 font-mono text-[10px] text-brand">
        {(c.score * 100).toFixed(1)}%
      </span>
    </div>
  );
}
