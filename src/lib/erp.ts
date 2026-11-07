// ERP auth types & helpers
// NOTE: ErpRole is now an alias for ClassroomRole (unified in api.ts).
//       This file is kept for backward compatibility during incremental migration.
import { api, tokenStore, type ClassroomRole } from "./api";

export type ErpUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  systemRole: string;
  avatarUrl?: string | null;
  phone?: string | null;
};

// ErpRole = ClassroomRole (same shape, unified storage)
export type ErpRole = ClassroomRole;

export type ErpAuthPayload = {
  user: ErpUser;
  roles: ErpRole[];
  accessToken: string;
  refreshToken: string;
};

// erpStore delegates to tokenStore.getRoles() so both ERP and Classroom
// read/write roles from the same localStorage key ("us.roles").
export const erpStore = {
  getRoles(): ErpRole[] { return tokenStore.getRoles(); },
  setRoles(roles: ErpRole[]) { tokenStore.set({ user: tokenStore.getUser()!, roles, accessToken: tokenStore.access!, refreshToken: tokenStore.refresh! }); },
  clear() { /* tokenStore.clear() handles this */ },
};

export async function erpLogin(email: string, password: string): Promise<ErpAuthPayload> {
  const payload = await api<ErpAuthPayload>("/auth/login", {
    method: "POST", auth: false,
    body: { email, password },
  });
  // Use unified tokenStore.set() — stores user + tokens + roles
  tokenStore.set({ user: payload.user as any, roles: payload.roles, accessToken: payload.accessToken, refreshToken: payload.refreshToken });
  return payload;
}

export async function erpLogout() {
  const rt = tokenStore.refresh;
  if (rt) await api("/auth/logout", { method: "POST", auth: false, body: { refreshToken: rt } }).catch(() => {});
  tokenStore.clear();
  erpStore.clear();
}

export async function erpMe(): Promise<ErpAuthPayload> {
  return api<ErpAuthPayload>("/auth/me");
}

// Permission check
export function hasPermission(roles: ErpRole[], code: string): boolean {
  return roles.some(r => r.permissions.includes(code));
}

// Get primary role name
export function primaryRole(roles: ErpRole[]): string {
  return roles[0]?.roleName ?? "";
}

// Redirect path based on systemRole / role name
export function dashboardPath(systemRole: string, roleName: string): string {
  if (systemRole === "SUPER_ADMIN") return "/erp/admin";
  if (systemRole === "STUDENT")     return "/erp/etudiant";
  if (systemRole === "PARENT")      return "/erp/parent";
  if (systemRole === "CANDIDATE")   return "/erp/candidat";
  if (systemRole === "TEACHER")     return "/erp/enseignant";
  // STAFF — route by role name
  if (roleName === "Responsable Présence")          return "/classroom/appel";
  if (roleName.includes("Chef de Mention") || roleName.startsWith("Responsable ")) return "/erp/chef-mention";
  if (roleName.includes("Secrétaire"))              return "/erp/secretaire";
  if (roleName.includes("Comptabilité"))            return "/erp/finance";
  return "/erp/admin";
}
