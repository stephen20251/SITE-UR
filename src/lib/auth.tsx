import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE, tokenStore, type ApiUser, type AuthPayload, type ClassroomRole } from "./api";

export type RegisterInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: ApiUser["role"];
  system: ApiUser["system"];
};

type AuthContextValue = {
  user: ApiUser | null;
  roles: ClassroomRole[];    // staff/admin role records (permissions + scope)
  ready: boolean;            // hydrated from storage on the client yet?
  login: (email: string, password: string) => Promise<ApiUser>;
  register: (input: RegisterInput) => Promise<ApiUser>;
  registerCandidate: (input: CandidateInput) => Promise<ApiUser>;
  logout: () => Promise<void>;
};

// Candidature à l'université : crée un compte CANDIDATE et un dossier en brouillon.
export type CandidateInput = {
  email: string; password: string; firstName: string; lastName: string;
  phone?: string; mentionId?: string; level?: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [roles, setRoles] = useState<ClassroomRole[]>([]);
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage on the client only (avoids SSR hydration mismatch).
  useEffect(() => {
    setUser(tokenStore.getUser());
    setRoles(tokenStore.getRoles());
    setReady(true);
  }, []);

  // Session expirée (renouvellement refusé) ou connexion / déconnexion dans un autre onglet :
  // l'état affiché suit les jetons réellement présents.
  useEffect(() => {
    const expired = () => {
      setUser(null);
      setRoles([]);
      queryClient.clear();
      toast.error(SESSION_EXPIRED_MESSAGE, { id: "session-expired" });
    };
    const sync = (e: StorageEvent) => {
      if (e.key !== null && e.key !== "us.user" && e.key !== "us.roles") return;
      setUser(tokenStore.getUser());
      setRoles(tokenStore.getRoles());
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
      window.removeEventListener("storage", sync);
    };
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const payload = await api<AuthPayload>("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    });
    tokenStore.set(payload);           // also persists payload.roles if present
    setUser(payload.user);
    setRoles(payload.roles ?? []);
    return payload.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const payload = await api<AuthPayload>("/auth/register", {
      method: "POST",
      auth: false,
      body: input,
    });
    tokenStore.set(payload);
    setUser(payload.user);
    setRoles(payload.roles ?? []);
    return payload.user;
  }, []);

  const registerCandidate = useCallback(async (input: CandidateInput) => {
    const payload = await api<AuthPayload>("/auth/register-candidate", {
      method: "POST",
      auth: false,
      body: input,
    });
    tokenStore.set(payload);
    setUser(payload.user);
    setRoles(payload.roles ?? []);
    return payload.user;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.refresh;
    if (refreshToken) {
      await api("/auth/logout", { method: "POST", auth: false, body: { refreshToken } }).catch(
        () => {},
      );
    }
    tokenStore.clear();
    setUser(null);
    setRoles([]);
    // Drop every cached query so the next (possibly anonymous or different)
    // session never refetches the previous user's role-gated data.
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, roles, ready, login, register, registerCandidate, logout }),
    [user, roles, ready, login, register, registerCandidate, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

// ── Convenience helpers ─────────────────────────────────────────────────────

/** Primary role name for STAFF users (e.g. "Chef de Mention"). */
export function primaryRoleName(roles: ClassroomRole[]): string {
  return roles[0]?.roleName ?? "";
}

/** Check if a specific permission code is granted. */
export function hasPermission(roles: ClassroomRole[], code: string): boolean {
  return roles.some((r) => r.permissions.includes(code));
}

/** Scope of the primary role (mention, faculty, department, campus). */
export function primaryScope(roles: ClassroomRole[]) {
  return roles[0]?.scope ?? null;
}

// ── Online system role helpers ──────────────────────────────────────────────
export const isOnlineTeacher = (u: ApiUser | null) =>
  u?.systemRole === "TEACHER_ONLINE";
export const isOnlineStudent = (u: ApiUser | null) =>
  u?.systemRole === "STUDENT_ONLINE";
export const isOnlineUser = (u: ApiUser | null) =>
  isOnlineTeacher(u) || isOnlineStudent(u);

// Re-export ClassroomRole for consumers that only import from auth.tsx
export type { ClassroomRole };
