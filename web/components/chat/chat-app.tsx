"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  FileText,
  LogOut,
  ArrowLeft,
  Settings,
  Trash2,
  MessageSquare,
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import {
  ApiError,
  chatStream,
  createConversation,
  deleteConversation,
  deleteIngestedFile,
  getConversation,
  getModels,
  getSettings,
  ingestFiles,
  listConversations,
  type ConversationSummary,
} from "@/lib/api";
import {
  ClaudeChatInput,
  type ChatSubmission,
  type Model,
} from "@/components/ui/claude-style-chat-input";
import { Markdown, MessageCopyButton } from "@/components/chat/markdown";
import { SettingsDialog } from "@/components/chat/settings-dialog";
import { Logo } from "@/components/ui/logo";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const uid = () => Math.random().toString(36).slice(2, 11);

/** Turn a raw Groq model id into something friendlier for the selector. */
function prettyModel(id: string): Model {
  const name = id.includes("/") ? id.split("/").pop()! : id;
  return { id, name, description: id };
}

export function ChatApp() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [ingestedFiles, setIngestedFiles] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [booting, setBooting] = useState(true);

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Redirect unauthenticated visitors once auth state resolves.
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  const loadModels = useCallback(async () => {
    try {
      const mdls = await getModels();
      setModels(mdls.map(prettyModel));
    } catch {
      /* leave defaults; not fatal */
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const detail = await getConversation(id);
    setActiveId(detail.id);
    setMessages(
      detail.messages.map((m) => ({ id: uid(), role: m.role, content: m.content }))
    );
    setIngestedFiles(detail.files);
    setStatus(null);
  }, []);

  // Bootstrap: settings, conversation list, models.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [settings, convos] = await Promise.all([
          getSettings(),
          listConversations(),
        ]);
        if (cancelled) return;
        setHasKey(settings.has_groq_key);

        let list = convos;
        if (list.length === 0) {
          const created = await createConversation();
          list = [created];
        }
        if (cancelled) return;
        setConversations(list);
        await loadConversation(list[0].id);
        loadModels();
      } catch (err) {
        if (!cancelled)
          setStatus(
            err instanceof ApiError
              ? err.message
              : "Couldn't reach the server. Is the API running?"
          );
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loadConversation, loadModels]);

  // Keep the transcript pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await listConversations());
    } catch {
      /* non-fatal */
    }
  }, []);

  const handleIngestFile = useCallback(
    async (file: File): Promise<boolean> => {
      if (!activeId) return false;
      try {
        const report = await ingestFiles(activeId, [file]);
        setIngestedFiles((prev) =>
          Array.from(new Set([...prev, ...report.ingested]))
        );
        const parts: string[] = [];
        if (report.chunks_added) parts.push(`${report.chunks_added} chunks`);
        if (report.skipped.length) parts.push(`${report.skipped.length} skipped`);
        setStatus(parts.length ? parts.join(" · ") : null);
        return report.ingested.length > 0;
      } catch (err) {
        setStatus(err instanceof ApiError ? err.message : "File ingest failed.");
        return false;
      }
    },
    [activeId]
  );

  const removeDocument = useCallback(
    async (filename: string) => {
      if (!activeId) return;
      try {
        await deleteIngestedFile(activeId, filename);
        setIngestedFiles((prev) => prev.filter((n) => n !== filename));
        setStatus(null);
      } catch {
        /* non-fatal: vector delete best-effort */
      }
    },
    [activeId]
  );

  const handleRemoveFile = useCallback(
    (file: File) => removeDocument(file.name),
    [removeDocument]
  );

  const handleSend = useCallback(
    async (data: ChatSubmission) => {
      if (!activeId || streaming) return;

      // Fold any large pasted snippets into the question text.
      const pasted = data.pastedContent.map((p) => p.content).join("\n\n");
      const text = [data.message.trim(), pasted].filter(Boolean).join("\n\n");

      if (!text) return; // files already ingested on select; nothing to ask yet.

      // 2) Stream the grounded answer.
      const wasEmpty = messages.length === 0;
      const userMsg: Message = { id: uid(), role: "user", content: text };
      const assistantMsg: Message = { id: uid(), role: "assistant", content: "" };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreaming(true);
      setStatus(null);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        for await (const delta of chatStream(
          activeId,
          text,
          data.model,
          controller.signal
        )) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + delta }
                : m
            )
          );
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          const msg =
            err instanceof ApiError
              ? `_${err.message}_`
              : "_Sorry — I couldn't generate an answer. Check the server and try again._";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: m.content || msg } : m
            )
          );
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        // The first message sets the server-side title — refresh the sidebar.
        if (wasEmpty) refreshConversations();
      }
    },
    [activeId, streaming, messages.length, refreshConversations]
  );

  const stopStreaming = () => abortRef.current?.abort();

  const selectConversation = useCallback(
    async (id: string) => {
      if (id === activeId || streaming) return;
      abortRef.current?.abort();
      try {
        await loadConversation(id);
      } catch {
        setStatus("Couldn't open that conversation.");
      }
    },
    [activeId, streaming, loadConversation]
  );

  const newChat = useCallback(async () => {
    if (streaming) return;
    // Reuse the active conversation if it's already empty.
    if (messages.length === 0 && activeId) return;
    abortRef.current?.abort();
    try {
      const created = await createConversation();
      await refreshConversations();
      setMessages([]);
      setIngestedFiles([]);
      setStatus(null);
      setActiveId(created.id);
    } catch {
      setStatus("Couldn't start a new chat.");
    }
  }, [streaming, messages.length, activeId, refreshConversations]);

  const removeConversation = useCallback(
    async (id: string) => {
      try {
        await deleteConversation(id);
      } catch {
        setStatus("Couldn't delete that conversation.");
        return;
      }
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (id === activeId) {
        if (remaining.length > 0) {
          await loadConversation(remaining[0].id);
        } else {
          const created = await createConversation();
          setConversations([created]);
          setMessages([]);
          setIngestedFiles([]);
          setActiveId(created.id);
        }
      }
    },
    [conversations, activeId, loadConversation]
  );

  if (authLoading || !user) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  const keyMissing = hasKey === false;

  /* Shared sidebar content pieces */
  const sidebarChats = (
    <ul className="space-y-0.5">
      {conversations.map((c) => (
        <li key={c.id} className="group relative">
          <button
            type="button"
            onClick={() => { selectConversation(c.id); setMobileNavOpen(false); }}
            title={c.title}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
              c.id === activeId
                ? "bg-bg-200 text-foreground"
                : "text-text-300 hover:bg-bg-200/60 hover:text-foreground"
            } ${!sidebarOpen ? "justify-center" : ""}`}
          >
            <MessageSquare className="h-4 w-4 shrink-0 text-text-400" />
            {sidebarOpen && (
              <span className="truncate pr-6">{c.title}</span>
            )}
          </button>
          {sidebarOpen && (
            <button
              type="button"
              onClick={() => removeConversation(c.id)}
              aria-label="Delete chat"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-text-400 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  const sidebarDocs = ingestedFiles.length === 0 ? (
    sidebarOpen ? (
      <p className="px-2 text-sm text-text-400">Attach files to ingest them.</p>
    ) : null
  ) : (
    <ul className="space-y-0.5">
      {ingestedFiles.map((f) => (
        <li
          key={f}
          className={`group relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-200 ${
            !sidebarOpen ? "justify-center" : ""
          }`}
        >
          <FileText className="h-4 w-4 shrink-0 text-text-400" aria-label={f} />
          {sidebarOpen && (
            <>
              <span className="flex-1 truncate" title={f}>{f}</span>
              <button
                type="button"
                onClick={() => removeDocument(f)}
                aria-label={`Remove ${f}`}
                className="shrink-0 rounded p-0.5 text-text-400 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <div className="flex h-dvh overflow-hidden">
        {/* ── Desktop sidebar (md+) ── */}
        <aside
          className={`hidden md:flex flex-col shrink-0 border-r border-border bg-bg-100 transition-[width] duration-200 overflow-hidden ${
            sidebarOpen ? "w-72" : "w-16"
          }`}
        >
          {/* Header */}
          <div
            className={`flex items-center border-b border-border px-3 py-4 ${
              sidebarOpen ? "justify-between" : "justify-center"
            }`}
          >
            {sidebarOpen && (
              <Link href="/" aria-label="DocMind home">
                <Logo />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              className="rounded-lg p-1.5 text-text-400 transition-colors hover:bg-bg-200 hover:text-foreground"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <PanelLeftOpen className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* New chat */}
          <div className={`px-3 pt-3 ${!sidebarOpen ? "flex justify-center" : ""}`}>
            <button
              type="button"
              onClick={newChat}
              disabled={streaming}
              title="New chat"
              className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-foreground transition-colors hover:bg-bg-200 disabled:opacity-50 ${
                sidebarOpen ? "h-10 w-full" : "h-9 w-9"
              }`}
            >
              <Plus className="h-4 w-4 shrink-0" />
              {sidebarOpen && "New chat"}
            </button>
          </div>

          {/* Lists */}
          <div className="mt-4 flex-1 overflow-y-auto custom-scrollbar px-2">
            {sidebarOpen && (
              <h2 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-text-400">
                Chats
              </h2>
            )}
            {conversations.length === 0
              ? sidebarOpen && <p className="px-2 text-sm text-text-400">No chats yet.</p>
              : sidebarChats}

            {sidebarOpen && (
              <h2 className="mb-1 mt-5 px-2 text-xs font-semibold uppercase tracking-wider text-text-400">
                Documents
              </h2>
            )}
            {sidebarDocs}
          </div>

          {/* Footer */}
          <div className={`border-t border-border px-3 py-3 ${!sidebarOpen ? "flex flex-col items-center gap-2" : ""}`}>
            {sidebarOpen ? (
              <>
                <div className="mb-2 truncate px-1 text-xs text-text-400" title={user.email}>
                  {user.email}
                </div>
                <div className="flex gap-2">
                  <Link
                    href="/"
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-sm text-text-300 transition-colors hover:bg-bg-200"
                  >
                    <ArrowLeft className="h-4 w-4" /> Home
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-sm text-text-300 transition-colors hover:bg-bg-200"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  title="Settings"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-text-400 transition-colors hover:bg-bg-200 hover:text-foreground"
                >
                  <Settings className="h-5 w-5" />
                </button>
                <Link
                  href="/"
                  title="Home"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-text-400 transition-colors hover:bg-bg-200 hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  title="Sign out"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-text-400 transition-colors hover:bg-bg-200 hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </aside>

        {/* ── Mobile drawer (<md) ── */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-bg-100 transition-transform duration-200 md:hidden ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Link href="/" aria-label="DocMind home" onClick={() => setMobileNavOpen(false)}>
              <Logo />
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close menu"
              className="rounded-lg p-1.5 text-text-400 hover:bg-bg-200"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 pt-3">
            <button
              type="button"
              onClick={() => { newChat(); setMobileNavOpen(false); }}
              disabled={streaming}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-foreground transition-colors hover:bg-bg-200 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> New chat
            </button>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto custom-scrollbar px-3">
            <h2 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-text-400">Chats</h2>
            {conversations.length === 0
              ? <p className="px-2 text-sm text-text-400">No chats yet.</p>
              : (
                <ul className="space-y-0.5">
                  {conversations.map((c) => (
                    <li key={c.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => { selectConversation(c.id); setMobileNavOpen(false); }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                          c.id === activeId ? "bg-bg-200 text-foreground" : "text-text-300 hover:bg-bg-200/60 hover:text-foreground"
                        }`}
                      >
                        <MessageSquare className="h-4 w-4 shrink-0 text-text-400" />
                        <span className="truncate pr-6" title={c.title}>{c.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeConversation(c.id)}
                        aria-label="Delete chat"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-text-400 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

            <h2 className="mb-1 mt-5 px-2 text-xs font-semibold uppercase tracking-wider text-text-400">Documents</h2>
            {ingestedFiles.length === 0
              ? <p className="px-2 text-sm text-text-400">Attach files to ingest them.</p>
              : (
                <ul className="space-y-0.5">
                  {ingestedFiles.map((f) => (
                    <li key={f} className="group relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-200">
                      <FileText className="h-4 w-4 shrink-0 text-text-400" />
                      <span className="flex-1 truncate" title={f}>{f}</span>
                      <button
                        type="button"
                        onClick={() => removeDocument(f)}
                        aria-label={`Remove ${f}`}
                        className="shrink-0 rounded p-0.5 text-text-400 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </div>

          <div className="border-t border-border px-4 py-4">
            <div className="mb-2 truncate px-1 text-xs text-text-400" title={user.email}>{user.email}</div>
            <div className="flex gap-2">
              <Link href="/" className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-sm text-text-300 transition-colors hover:bg-bg-200">
                <ArrowLeft className="h-4 w-4" /> Home
              </Link>
              <button type="button" onClick={logout} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-sm text-text-300 transition-colors hover:bg-bg-200">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Mobile top bar */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-2 text-text-400 hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" aria-label="DocMind home"><Logo /></Link>
            <div className="flex items-center gap-1">
              <button type="button" onClick={newChat} aria-label="New chat" className="rounded-lg p-2 text-text-400 hover:text-foreground">
                <Plus className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Settings" className="rounded-lg p-2 text-text-400 hover:text-foreground">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages — only this scrolls */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="mx-auto w-full max-w-3xl px-4 py-8">
              {messages.length === 0 ? (
                <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
                  <Logo className="mb-6 scale-125" />
                  <h1 className="font-serif text-3xl font-light tracking-tight text-foreground">
                    {booting ? "Starting your session…" : "What can I help you find?"}
                  </h1>
                  <p className="mt-3 max-w-md text-text-300">
                    Attach documents and ask a question — answers stay grounded in your files, with citations.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((m) =>
                    m.role === "user" ? (
                      <div key={m.id} className="flex justify-end">
                        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[15px] text-on-primary">
                          {m.content}
                        </div>
                      </div>
                    ) : (
                      <div key={m.id} className="flex justify-start">
                        <div className="max-w-[88%]">
                          <div className="rounded-2xl rounded-bl-md border border-border bg-bg-100 px-4 py-3">
                            {m.content ? (
                              <Markdown>{m.content}</Markdown>
                            ) : (
                              <Loader2 className="h-4 w-4 animate-spin text-text-400" />
                            )}
                          </div>
                          {m.content && <MessageCopyButton text={m.content} />}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Composer — stays pinned */}
          <div className="border-t border-border bg-bg-0/80 px-4 py-4 backdrop-blur">
            {keyMissing && (
              <div className="mx-auto mb-3 flex max-w-2xl items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-text-200">
                  <KeyRound className="h-4 w-4 text-accent" />
                  Add your Groq API key to start chatting.
                </span>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-primary transition-colors hover:bg-accent-hover"
                >
                  Add key
                </button>
              </div>
            )}
            {status && (
              <p className="mx-auto mb-2 max-w-2xl text-center text-xs text-text-400">{status}</p>
            )}
            {streaming && (
              <div className="mx-auto mb-2 flex max-w-2xl justify-center">
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="rounded-lg border border-border px-3 py-1 text-xs text-text-300 hover:bg-bg-200"
                >
                  Stop generating
                </button>
              </div>
            )}
            <ClaudeChatInput
              onSendMessage={handleSend}
              onIngestFile={handleIngestFile}
              onRemoveFile={handleRemoveFile}
              models={models.length ? models : undefined}
              disabled={booting || !activeId || streaming || keyMissing}
              placeholder={
                keyMissing
                  ? "Add your Groq API key in Settings to begin…"
                  : "Ask anything about your documents…"
              }
            />
          </div>
        </main>
      </div>

      <SettingsDialog
        open={settingsOpen}
        hasKey={!!hasKey}
        onClose={() => setSettingsOpen(false)}
        onKeyChange={(has) => {
          setHasKey(has);
          if (has) loadModels();
        }}
      />
    </>
  );
}
