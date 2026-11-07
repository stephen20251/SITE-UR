// ─────────────────────────────────────────────────────────────────────────────
// Config module — Salles & Utilisateurs
// Backend: GET/POST /api/structure/rooms, GET/POST /api/admin/users
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// ─── Types ───────────────────────────────────────────────────────────────────

export type RoomType = "CLASSROOM" | "AMPHITHEATER" | "LAB" | "SEMINAR";

export type Room = {
  id: string;
  campusId: string;
  name: string;
  code: string;
  type: RoomType;
  capacity: number;
  building: string | null;
  floor: string | null;
  isActive: boolean;
  createdAt: string;
};

export type SystemRole =
  | "SUPER_ADMIN" | "STAFF" | "TEACHER" | "STUDENT"
  | "PARENT" | "CANDIDATE" | "TEACHER_ONLINE" | "STUDENT_ONLINE";

export type AdminUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  systemRole: SystemRole;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  userRoles: { role: { id: string; name: string; color: string } }[];
  studentProfile: { studentNo: string } | null;
  teacherProfile: { specialization: string | null } | null;
  staffProfile: { position: string | null } | null;
};

export type AdminUsersPage = {
  total: number;
  page: number;
  limit: number;
  users: AdminUser[];
};

export type AdminRole = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  color: string;
  createdAt: string;
  _count: { userRoles: number; rolePermissions: number };
};

// ─── Query keys ──────────────────────────────────────────────────────────────

export const cfk = {
  rooms: (type?: RoomType) => ["config", "rooms", type ?? "all"] as const,
  users: (search?: string, role?: string, page?: number) =>
    ["config", "users", search ?? "", role ?? "", page ?? 1] as const,
  roles: ["config", "roles"] as const,
};

// ─── Room hooks ───────────────────────────────────────────────────────────────

export function useRooms(type?: RoomType) {
  return useQuery({
    queryKey: cfk.rooms(type),
    queryFn: async () => {
      const all = await api<Room[]>("/structure/rooms");
      return type ? all.filter((r) => r.type === type) : all;
    },
    staleTime: 120_000,
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string; code: string; campusId: string;
      type: RoomType; capacity: number; building?: string; floor?: string;
    }) => api<Room>("/structure/rooms", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["config", "rooms"] }),
  });
}

// ─── User hooks ───────────────────────────────────────────────────────────────

export function useAdminUsers(params?: { search?: string; role?: string; page?: number; limit?: number }) {
  const { search = "", page = 1, limit = 20 } = params ?? {};
  return useQuery({
    queryKey: cfk.users(search, params?.role, page),
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (page !== 1) qs.set("page", String(page));
      if (limit !== 20) qs.set("limit", String(limit));
      const q = qs.toString();
      return api<AdminUsersPage>(`/admin/users${q ? "?" + q : ""}`);
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useAdminRoles() {
  return useQuery({
    queryKey: cfk.roles,
    queryFn: () => api<AdminRole[]>("/admin/roles"),
    staleTime: 300_000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      email: string; firstName: string; lastName: string;
      systemRole: SystemRole; password: string; phone?: string;
    }) => api<AdminUser>("/admin/users", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["config", "users"] }),
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const ROOM_TYPE_META: Record<RoomType, { label: string; icon: string; color: string }> = {
  CLASSROOM:    { label: "Salle de cours",  icon: "📚", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  AMPHITHEATER: { label: "Amphithéâtre",    icon: "🎭", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" },
  LAB:          { label: "Laboratoire",     icon: "🔬", color: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" },
  SEMINAR:      { label: "Salle séminaire", icon: "💼", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" },
};

export const SYSTEM_ROLE_META: Record<SystemRole, { label: string; color: string }> = {
  SUPER_ADMIN:     { label: "Super Admin",        color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  STAFF:           { label: "Personnel",           color: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400" },
  TEACHER:         { label: "Enseignant",          color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  STUDENT:         { label: "Étudiant",            color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  PARENT:          { label: "Parent",              color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  CANDIDATE:       { label: "Candidat",            color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  TEACHER_ONLINE:  { label: "Enseignant Online",   color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400" },
  STUDENT_ONLINE:  { label: "Étudiant Online",     color: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400" },
};
