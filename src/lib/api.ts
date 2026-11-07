// ─────────────────────────────────────────────────────────────────────────────
// Core API client for the University System backend.
// fetch-based (no extra deps), with bearer-token auth + transparent refresh.
// ─────────────────────────────────────────────────────────────────────────────

const API_URL =
  ((import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "")) ||
  "http://localhost:4000/api";

const isBrowser = typeof window !== "undefined";

const KEY = {
  access: "us.accessToken",
  refresh: "us.refreshToken",
  user: "us.user",
  roles: "us.roles",        // staff/admin role array (permissions + scope)
} as const;

export type ApiUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  systemRole: string; // STUDENT | TEACHER | PARENT | CANDIDATE | STAFF | SUPER_ADMIN | STUDENT_ONLINE | TEACHER_ONLINE
  system?: "ONLINE" | "CLASSROOM";
  avatarUrl?: string | null;
  phone?: string | null;
};

/** Role record returned by the backend for STAFF and SUPER_ADMIN users. */
export type ClassroomRole = {
  roleId: string;
  roleName: string;
  color: string | null;
  scope: {
    mentionId: string | null;
    mentionName: string | null;
    facultyId: string | null;
    departmentId: string | null;
    campusId: string | null;
  };
  permissions: string[];
};

export type AuthPayload = {
  user: ApiUser;
  roles?: ClassroomRole[];  // present for STAFF / SUPER_ADMIN
  accessToken: string;
  refreshToken: string;
};

// ─── Token storage (SSR-safe: no-ops on the server) ───
export const tokenStore = {
  get access() {
    return isBrowser ? localStorage.getItem(KEY.access) : null;
  },
  get refresh() {
    return isBrowser ? localStorage.getItem(KEY.refresh) : null;
  },
  getUser(): ApiUser | null {
    if (!isBrowser) return null;
    const raw = localStorage.getItem(KEY.user);
    try {
      return raw ? (JSON.parse(raw) as ApiUser) : null;
    } catch {
      return null;
    }
  },
  getRoles(): ClassroomRole[] {
    if (!isBrowser) return [];
    try { return JSON.parse(localStorage.getItem(KEY.roles) ?? "[]"); } catch { return []; }
  },
  set(payload: AuthPayload) {
    if (!isBrowser) return;
    localStorage.setItem(KEY.access, payload.accessToken);
    localStorage.setItem(KEY.refresh, payload.refreshToken);
    localStorage.setItem(KEY.user, JSON.stringify(payload.user));
    if (payload.roles) localStorage.setItem(KEY.roles, JSON.stringify(payload.roles));
  },
  clear() {
    if (!isBrowser) return;
    localStorage.removeItem(KEY.access);
    localStorage.removeItem(KEY.refresh);
    localStorage.removeItem(KEY.user);
    localStorage.removeItem(KEY.roles);
  },
};

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function readBody(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Single-flight refresh: concurrent 401s share one refresh round-trip.
let refreshing: Promise<string | null> | null = null;
export function refreshAccessToken(): Promise<string | null> {
  const rt = tokenStore.refresh;
  if (!rt) return Promise.resolve(null);
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    })
      .then(async (res) => {
        if (!res.ok) {
          tokenStore.clear();
          return null;
        }
        const data = (await res.json()) as AuthPayload;
        tokenStore.set(data);
        return data.accessToken;
      })
      .catch(() => {
        tokenStore.clear();
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  raw?: boolean; // set true to send body as-is (e.g. FormData)
  signal?: AbortSignal;
};

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, raw = false, signal } = opts;

  const isFormData = raw && body instanceof FormData;

  const send = (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: isFormData ? (body as FormData) : JSON.stringify(body) } : {}),
      signal,
    });

  let res = await send(tokenStore.access);

  // Token expired? Refresh once and retry.
  if (res.status === 401 && auth && tokenStore.refresh) {
    const fresh = await refreshAccessToken();
    if (fresh) res = await send(fresh);
  }

  if (!res.ok) {
    const data = await readBody(res);
    const message =
      (data && (data.error || data.message)) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message, data?.details);
  }

  if (res.status === 204) return undefined as T;
  return (await readBody(res)) as T;
}

export const API_BASE = API_URL;
