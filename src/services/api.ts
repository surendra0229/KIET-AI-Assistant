/**
 * API service layer.
 *
 * All calls to the FastAPI backend flow through this module.
 * Configure the base URL via VITE_API_BASE_URL (defaults to http://localhost:8000).
 */

const BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
  "http://localhost:8001";

let authToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export function registerUnauthorizedCallback(cb: () => void) {
  onUnauthorizedCallback = cb;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    if (res.status === 401) {
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }
    // If the request was aborted, propagate an AbortError so callers can detect it.
    if (res.status === 0 || res.type === "error") {
      throw new DOMException("Request aborted", "AbortError");
    }
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => "");
    }
    const err = new Error(detail || `${res.status} ${res.statusText}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export interface AuthUser {
  userId: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "STUDENT" | string;
  department: string;
  designation?: string;
  phone?: string;
  isActive: boolean;
  mustChangePassword?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresInMinutes: number;
  user: AuthUser;
  mustChangePassword: boolean;
}

// ── Admin management ─────────────────────────────────────────────────────
export type AdminStatus = "ACTIVE" | "INACTIVE" | "DISABLED";

export interface AdminRecord {
  userId: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN";
  department: string;
  designation: string;
  phone: string;
  status: AdminStatus;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: string | null;
}

export interface CreateAdminPayload {
  name: string;
  email: string;
  department: string;
  designation: string;
  phone: string;
}

export interface CreateAdminResponse {
  admin: AdminRecord;
  temporaryPassword: string;
  emailSent: boolean;
}

export interface AdminActivityEvent {
  eventId: string;
  action: string;
  actorUserId: string | null;
  actorEmail: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  ip: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

// ── Types ────────────────────────────────────────────────────────────────
export interface Citation {
  document_name: string;
  sheet_name?: string | null;
  paragraph_number?: number | null;
  score: number;
}

export interface ChatResponse {
  reply: string;
  citations: Citation[];
  retrieval_ms: number;
  generation_ms: number;
  query: string;
  chat_id: string | null;
}

export interface UploadResult {
  filename: string;
  status: "indexed" | "failed" | "rejected" | string;
  chunks?: number | null;
  error?: string | null;
}

export interface DocumentInfo {
  filename: string;
  documentType: string;
  fileSize: number;
  chunkCount: number;
  indexStatus: string;
  embeddingModel: string;
  uploadedAt?: string | null;
  updatedAt?: string | null;
}

export interface ChatSession {
  chatId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: string;
  messageCount: number;
}

export interface StoredMessage {
  messageId: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  retrievalTime: number | null;
  generationTime: number | null;
  timestamp: string;
}

export interface StatusResponse {
  status: string;
  documents_on_disk: number;
  indexed_documents: number;
  total_chunks: number;
  embedding_model: string;
  llm_model: string;
  gemini_configured: boolean;
  vector_db: string;
  mongodb_connected: boolean;
  mongodb_error?: string | null;
}

export interface DashboardResponse {
  documents: { onDisk: number; indexed: number; chunks: number };
  chats: { total: number; messages: number };
  config: {
    embeddingModel: string;
    vectorDb: string;
    llm: string;
    geminiConfigured: boolean;
  };
  performance: {
    chats7d: number;
    uploads7d: number;
    avgRetrievalMs: number;
    avgGenerationMs: number;
  };
  queryVolume: { date: string; count: number }[];
  recentUploads: { filename: string; chunks: number; uploadedAt?: string }[];
  mongo: { connected: boolean; error?: string | null };
}

export interface SettingsResponse {
  runtime: {
    embeddingModel: string;
    llmModel: string;
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    geminiConfigured: boolean;
    vectorDb: string;
    chromaPersistDir: string;
  };
  user: {
    chunkSize?: number;
    chunkOverlap?: number;
    topK?: number;
    theme?: string;
    geminiApiKeyConfigured?: boolean;
  };
}

// ── Client ───────────────────────────────────────────────────────────────
export const api = {
  health: () => request<{ status: string; version: string }>("/health"),
  status: () => request<StatusResponse>("/status"),
  dashboard: () => request<DashboardResponse>("/dashboard"),

  // Auth
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ status: string }>("/auth/logout", { method: "POST" }),
  me: () => request<AuthUser>("/auth/me"),
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    request<{ status: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    }),
  forgotPassword: (email: string) =>
    request<{ status: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, newPassword: string, confirmPassword: string) =>
    request<{ status: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword, confirmPassword }),
    }),

  // Documents
  documents: () => request<{ documents: DocumentInfo[] }>("/documents"),
  deleteDocument: (name: string) =>
    request<{ deleted: string; chunks_removed: number }>(`/documents/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),
  upload: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    const headers: Record<string, string> = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    return fetch(`${BASE_URL}/upload`, { method: "POST", body: form, headers }).then(async (r) => {
      if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
      return (await r.json()) as { uploaded: UploadResult[] };
    });
  },
  reindex: () =>
    request<{ indexed: UploadResult[]; total_chunks: number }>("/index", { method: "POST" }),

  // Chats
  chat: (message: string, chatId?: string | null, signal?: AbortSignal) =>
    request<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({ message, chat_id: chatId ?? null }),
      signal,
    }),
  listChats: () => request<{ sessions: ChatSession[] }>("/chats"),
  createChat: () => request<ChatSession>("/chats", { method: "POST" }),
  renameChat: (chatId: string, title: string) =>
    request<ChatSession>(`/chats/${chatId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  deleteChat: (chatId: string) =>
    request<{ deleted: string }>(`/chats/${chatId}`, { method: "DELETE" }),
  chatMessages: (chatId: string) =>
    request<{ messages: StoredMessage[] }>(`/chats/${chatId}/messages`),
  clearChatMessages: (chatId: string) =>
    request<{ cleared: number }>(`/chats/${chatId}/messages`, { method: "DELETE" }),

  // Settings
  settings: () => request<SettingsResponse>("/settings"),
  updateSettings: (patch: Record<string, unknown>) =>
    request<Record<string, unknown>>("/settings", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  // Admin management (SUPER_ADMIN only)
  listAdmins: () => request<AdminRecord[]>("/admins"),
  createAdmin: (payload: CreateAdminPayload) =>
    request<CreateAdminResponse>("/admins", { method: "POST", body: JSON.stringify(payload) }),
  updateAdmin: (userId: string, patch: Partial<CreateAdminPayload>) =>
    request<AdminRecord>(`/admins/${userId}`, { method: "PATCH", body: JSON.stringify(patch) }),
  setAdminStatus: (userId: string, status: AdminStatus) =>
    request<AdminRecord>(`/admins/${userId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  resetAdminPassword: (userId: string) =>
    request<{ temporaryPassword: string; emailSent: boolean }>(`/admins/${userId}/reset-password`, {
      method: "POST",
    }),
  deleteAdmin: (userId: string) =>
    fetch(`${BASE_URL}/admins/${userId}`, {
      method: "DELETE",
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    }).then((r) => {
      if (!r.ok && r.status !== 204) throw new Error(`Delete failed: ${r.status}`);
    }),
  adminActivity: (userId: string) =>
    request<{ events: AdminActivityEvent[] }>(`/admins/${userId}/activity`),
  recentAdminActivity: () => request<{ events: AdminActivityEvent[] }>("/admins/-/activity/recent"),

  // Students (ADMIN + SUPER_ADMIN)
  listStudents: (params: Record<string, string | number | boolean> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
    });
    const qs = q.toString();
    return request<{
      items: StudentRecord[];
      total: number;
      facets: { department: string[]; branch: string[]; year: string[] };
    }>(`/students${qs ? `?${qs}` : ""}`);
  },
  getStudent: (id: string) => request<StudentRecord>(`/students/${id}`),
  createStudent: (payload: StudentPayload) =>
    request<StudentRecord>("/students", { method: "POST", body: JSON.stringify(payload) }),
  updateStudent: (id: string, patch: Partial<StudentPayload>) =>
    request<StudentRecord>(`/students/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  setStudentStatus: (id: string, status: StudentStatus) =>
    request<StudentRecord>(`/students/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  deleteStudent: (id: string) => request<StudentRecord>(`/students/${id}`, { method: "DELETE" }),
  resetStudentPassword: (id: string) =>
    request<{ studentId: string; defaultPassword: string }>(`/students/${id}/reset-password`, {
      method: "POST",
    }),
  previewStudentImport: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const headers: Record<string, string> = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    return fetch(`${BASE_URL}/students/bulk-import/preview`, {
      method: "POST",
      body: form,
      headers,
    }).then(async (r) => {
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(t || `Preview failed: ${r.status}`);
      }
      return (await r.json()) as StudentImportPreview;
    });
  },
  bulkImportStudents: (rows: Record<string, unknown>[]) =>
    request<{
      imported: StudentRecord[];
      skipped: { data: Record<string, unknown>; reason: string }[];
      counts: { imported: number; skipped: number };
    }>("/students/bulk-import", { method: "POST", body: JSON.stringify({ rows }) }),
  exportStudents: (body: { ids?: string[]; filters?: Record<string, unknown> }) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    return fetch(`${BASE_URL}/students/export`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`Export failed: ${r.status}`);
      return await r.blob();
    });
  },
  studentTemplate: () => {
    const headers: Record<string, string> = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    return fetch(`${BASE_URL}/students/template`, { headers }).then(async (r) => {
      if (!r.ok) throw new Error(`Template download failed: ${r.status}`);
      return await r.blob();
    });
  },
};

// ── Student types ────────────────────────────────────────────────────────
export type StudentStatus = "ACTIVE" | "INACTIVE" | "DISABLED" | "DELETED";

export interface StudentRecord {
  studentId: string;
  rollNumber: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  branch: string;
  year: string;
  gender: string;
  status: StudentStatus;
  mustChangePassword: boolean;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastLogin: string | null;
}

export interface StudentPayload {
  rollNumber: string;
  fullName: string;
  email: string;
  phone?: string;
  department?: string;
  branch?: string;
  year?: string;
  gender?: string;
  status?: StudentStatus;
}

export interface StudentImportRow {
  row?: number;
  rollNumber?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  department?: string;
  branch?: string;
  year?: string;
  gender?: string;
  status?: string;
}

export interface StudentImportPreview {
  columns: string[];
  totalRows: number;
  toImport: StudentImportRow[];
  duplicatesInFile: { row: number; data: StudentImportRow; reason: string }[];
  existingInDb: { row: number; data: StudentImportRow; reason: string }[];
  invalidRows: { row: number; data: StudentImportRow; errors: string[] }[];
}
