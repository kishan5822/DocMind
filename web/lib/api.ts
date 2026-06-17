/**
 * Typed client for the DocMind FastAPI backend.
 * The contract here is implemented by ../../api (FastAPI over the docmind pipeline).
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "docmind-token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function parseError(res: Response): Promise<never> {
  let detail = res.statusText;
  try {
    const data = await res.json();
    detail = data.detail || data.message || detail;
  } catch {
    /* non-JSON error body */
  }
  throw new ApiError(res.status, detail);
}

/* ---------- Types ---------- */
export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface IngestReport {
  ingested: string[];
  skipped: [string, string][];
  chunks_added: number;
}

export interface Settings {
  has_groq_key: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updated_at: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  messages: ChatMessage[];
  files: string[];
}

/* ---------- Auth ---------- */
export async function signup(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function me(): Promise<User> {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

/* ---------- Settings (per-account Groq key) ---------- */
export async function getSettings(): Promise<Settings> {
  const res = await fetch(`${API_URL}/api/settings`, { headers: authHeaders() });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function saveGroqKey(apiKey: string): Promise<Settings> {
  const res = await fetch(`${API_URL}/api/settings/groq-key`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function deleteGroqKey(): Promise<Settings> {
  const res = await fetch(`${API_URL}/api/settings/groq-key`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

/* ---------- Conversations ---------- */
export async function listConversations(): Promise<ConversationSummary[]> {
  const res = await fetch(`${API_URL}/api/conversations`, {
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function createConversation(): Promise<ConversationSummary> {
  const res = await fetch(`${API_URL}/api/conversations`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  const res = await fetch(
    `${API_URL}/api/conversations/${encodeURIComponent(id)}`,
    { headers: authHeaders() }
  );
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function renameConversation(
  id: string,
  title: string
): Promise<ConversationSummary> {
  const res = await fetch(
    `${API_URL}/api/conversations/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ title }),
    }
  );
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/conversations/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: authHeaders() }
  );
  if (!res.ok) await parseError(res);
}

/* ---------- Models & sessions ---------- */
export async function getModels(): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/models`, { headers: authHeaders() });
  if (!res.ok) await parseError(res);
  const data = await res.json();
  return data.models ?? data;
}

export async function createSession(): Promise<string> {
  const res = await fetch(`${API_URL}/api/session`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res);
  const data = await res.json();
  return data.session_id;
}

export async function getSessionFiles(sessionId: string): Promise<string[]> {
  const res = await fetch(
    `${API_URL}/api/session/files?session_id=${encodeURIComponent(sessionId)}`,
    { headers: authHeaders() }
  );
  if (!res.ok) await parseError(res);
  const data = await res.json();
  return data.files ?? [];
}

/* ---------- Ingest ---------- */
export async function deleteIngestedFile(
  sessionId: string,
  filename: string
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/ingest/file?session_id=${encodeURIComponent(sessionId)}&filename=${encodeURIComponent(filename)}`,
    { method: "DELETE", headers: authHeaders() }
  );
  if (!res.ok) await parseError(res);
}

export async function ingestFiles(
  sessionId: string,
  files: File[]
): Promise<IngestReport> {
  const form = new FormData();
  form.append("session_id", sessionId);
  files.forEach((f) => form.append("files", f, f.name));
  const res = await fetch(`${API_URL}/api/ingest`, {
    method: "POST",
    headers: authHeaders(), // do NOT set Content-Type; browser sets multipart boundary
    body: form,
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

/* ---------- Chat (SSE streaming) ---------- */
export async function* chatStream(
  sessionId: string,
  message: string,
  model: string,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ session_id: sessionId, message, model }),
    signal,
  });
  if (!res.ok) await parseError(res);
  if (!res.body) throw new ApiError(500, "No response stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      // Each delta is JSON-encoded by the backend so whitespace/newlines
      // inside tokens survive the SSE framing.
      try {
        yield JSON.parse(payload) as string;
      } catch {
        yield payload;
      }
    }
  }
}
