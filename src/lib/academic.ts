// ─────────────────────────────────────────────────────────────────────────────
// Academic year management — types, hooks, lifecycle helpers.
// Backend: GET/POST /api/structure/academic-years
//          GET     /api/structure/promotions  (filter by academicYearId client-side)
//          GET     /api/structure/mentions
//          GET     /api/structure/semesters
//          GET     /api/structure/faculties
//          PATCH   /api/structure/academic-years/:id  (lifecycle — may not exist yet)
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Semester = {
  id: string;
  academicYearId: string;
  name: string;
  number: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
};

export type AcademicYear = {
  id: string;
  campusId: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  createdAt: string;
  semesters?: Semester[];
  _count?: { promotions: number };
  _studentCount?: number;
};

export type AcademicYearStatus = "DRAFT" | "PREPARATION" | "ACTIVE" | "CLOSED" | "ARCHIVED";

export type Mention = {
  id: string;
  departmentId: string;
  name: string;
  code: string;
  level: string;
  duration: number;
  isActive: boolean;
  description?: string | null;
  // Présentation publique (fenêtre de détail de l'accueil) ; listes : une ligne par élément
  tagline?: string | null;
  imageUrl?: string | null;
  diploma?: string | null;
  studyModes?: string | null;
  objectives?: string | null;
  skills?: string | null;
  careers?: string | null;
  admission?: string | null;
  department?: {
    id: string;
    name: string;
    code: string;
    faculty?: { id: string; name: string; code: string };
  };
};

export type Faculty = {
  id: string;
  campusId: string;
  name: string;
  code: string;
  deanName: string | null;
  isActive: boolean;
  createdAt: string;
};

export type Department = {
  id: string;
  facultyId: string;
  name: string;
  code: string;
  headName: string | null;
  isActive: boolean;
  faculty?: { id: string; name: string };
};

export type Promotion = {
  id: string;
  mentionId: string;
  parcoursId: string | null;
  academicYearId: string;
  name: string;
  level: string;
  maxCapacity: number;
  createdAt: string;
  updatedAt?: string;
  mention?: { id: string; name: string; code: string };
  academicYear?: { id: string; label: string };
  parcours?: { id: string; name: string } | null;
  _count?: { students: number };
};

// Decision per-student in the promotion wizard
export type StudentDecision = "ADMITTED" | "REPEATING" | "EXCLUDED";

export type PromotionDecisionSummary = {
  promotionId: string;
  promotionName: string;
  level: string;
  mentionId: string;
  totalStudents: number;
  admitted: number;
  repeating: number;
  excluded: number;
};

// ─── Status derivation ────────────────────────────────────────────────────────

export function deriveYearStatus(year: AcademicYear): AcademicYearStatus {
  if (year.isCurrent) return "ACTIVE";
  const now = new Date();
  const end = new Date(year.endDate);
  const start = new Date(year.startDate);
  if (start > now) return "PREPARATION";
  if (end < now) return "CLOSED";
  return "PREPARATION";
}

export const LEVEL_ORDER: Record<string, number> = {
  L1: 1, L2: 2, L3: 3, M1: 4, M2: 5, D1: 6, D2: 7, D3: 8,
};

export function nextLevel(level: string): string {
  const levels = ["L1", "L2", "L3", "M1", "M2"];
  const idx = levels.indexOf(level);
  return idx >= 0 && idx < levels.length - 1 ? levels[idx + 1] : level;
}

// ─── Query keys ──────────────────────────────────────────────────────────────

export const yk = {
  years:      ["academic", "years"] as const,
  promotions: (yearId?: string) => ["academic", "promotions", yearId ?? "all"] as const,
  mentions:   ["academic", "mentions"] as const,
  faculties:  ["academic", "faculties"] as const,
  departments:["academic", "departments"] as const,
  semesters:  ["academic", "semesters"] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useAcademicYears() {
  return useQuery({
    queryKey: yk.years,
    queryFn: () => api<AcademicYear[]>("/structure/academic-years"),
    staleTime: 60_000,
  });
}

export function useActiveYear(): AcademicYear | null {
  const { data } = useAcademicYears();
  return data?.find((y) => y.isCurrent) ?? null;
}

export function usePromotions(yearId?: string) {
  return useQuery({
    queryKey: yk.promotions(yearId),
    queryFn: async () => {
      const all = await api<Promotion[]>("/structure/promotions");
      return yearId ? all.filter((p) => p.academicYearId === yearId) : all;
    },
    staleTime: 60_000,
  });
}

export function useMentions() {
  return useQuery({
    queryKey: yk.mentions,
    queryFn: () => api<Mention[]>("/structure/mentions"),
    staleTime: 300_000,
  });
}

export function useFaculties() {
  return useQuery({
    queryKey: yk.faculties,
    queryFn: () => api<Faculty[]>("/structure/faculties"),
    staleTime: 300_000,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: yk.departments,
    queryFn: () => api<Department[]>("/structure/departments"),
    staleTime: 300_000,
  });
}

export function useSemesters() {
  return useQuery({
    queryKey: yk.semesters,
    queryFn: () => api<Semester[]>("/structure/semesters"),
    staleTime: 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { label: string; startDate: string; endDate: string; campusId: string }) =>
      api<AcademicYear>("/structure/academic-years", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: yk.years }),
  });
}

export function useActivateYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<AcademicYear>(`/structure/academic-years/${id}/activate`, {
        method: "POST",
        body: {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: yk.years }),
  });
}

export function useCloseYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<AcademicYear>(`/structure/academic-years/${id}/close`, {
        method: "POST",
        body: {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: yk.years }),
  });
}

export function useArchiveYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<AcademicYear>(`/structure/academic-years/${id}/archive`, {
        method: "POST",
        body: {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: yk.years }),
  });
}

export function useCreateFaculty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; code: string; campusId: string; deanName?: string }) =>
      api<Faculty>("/structure/faculties", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: yk.faculties }),
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; code: string; facultyId: string; headName?: string }) =>
      api<Department>("/structure/departments", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: yk.departments }),
  });
}

export function useCreateMention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; code: string; departmentId: string; level: string; duration: number; description?: string }) =>
      api<Mention>("/structure/mentions", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: yk.mentions }),
  });
}

export type MentionInput = Partial<Pick<Mention,
  "name" | "code" | "level" | "duration" | "description" | "tagline" | "diploma" | "studyModes" | "objectives" | "skills" | "careers" | "admission">>;

export function useUpdateMention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MentionInput }) =>
      api<Mention>(`/structure/mentions/${id}`, { method: "PUT", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: yk.mentions }),
  });
}

export function useCreateParcours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; code: string; mentionId: string; description?: string }) =>
      api<{ id: string; name: string; code: string; mentionId: string; isActive: boolean }>(
        "/structure/parcours", { method: "POST", body: data }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academic", "parcours"] }),
  });
}

export type Parcours = {
  id: string;
  mentionId: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  mention?: { id: string; name: string };
};

export function useParcours() {
  return useQuery({
    queryKey: ["academic", "parcours"] as const,
    queryFn: () => api<Parcours[]>("/structure/parcours"),
    staleTime: 300_000,
  });
}

// ─── Teaching Units (UE) ──────────────────────────────────────────────────────

export type TeachingUnit = {
  id: string;
  semesterId: string;
  mentionId: string;
  code: string;
  name: string;
  credits: number;
  subjects?: Subject[];
};

export type Subject = {
  id: string;
  mentionId: string;
  teachingUnitId: string | null;
  code: string;
  name: string;
  credits: number;
  weeklyHours: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  mention?: { id: string; name: string };
  teachingUnit?: { id: string; name: string } | null;
};

export type Group = {
  id: string;
  promotionId: string;
  name: string;
  type: "TD" | "TP" | "CM";
  maxCapacity: number;
  createdAt: string;
  _count?: { students: number };
};

export const progKeys = {
  teachingUnits: (mentionId?: string, semesterId?: string) =>
    ["programme", "teaching-units", mentionId ?? "all", semesterId ?? "all"] as const,
  subjects: (mentionId?: string) =>
    ["programme", "subjects", mentionId ?? "all"] as const,
  groups: (promotionId: string) =>
    ["programme", "groups", promotionId] as const,
};

export function useTeachingUnits(mentionId?: string, semesterId?: string) {
  return useQuery({
    queryKey: progKeys.teachingUnits(mentionId, semesterId),
    queryFn: () => {
      const p = new URLSearchParams();
      if (mentionId) p.set("mentionId", mentionId);
      if (semesterId) p.set("semesterId", semesterId);
      return api<TeachingUnit[]>(`/structure/teaching-units?${p}`);
    },
    staleTime: 60_000,
  });
}

export function useCreateTeachingUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { semesterId: string; mentionId: string; code: string; name: string; credits?: number }) =>
      api<TeachingUnit>("/structure/teaching-units", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["programme", "teaching-units"] }),
  });
}

export function useSubjects(mentionId?: string) {
  return useQuery({
    queryKey: progKeys.subjects(mentionId),
    queryFn: () => {
      // all=1 : la configuration affiche aussi les matières désactivées (pour les réactiver).
      const qs = new URLSearchParams({ all: "1" });
      if (mentionId) qs.set("mentionId", mentionId);
      return api<Subject[]>(`/structure/subjects?${qs}`);
    },
    staleTime: 10_000,
  });
}

export function useCreateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      mentionId: string;
      code: string;
      name: string;
      credits?: number;
      weeklyHours?: number;
      description?: string;
      teachingUnitId?: string;
    }) => api<Subject>("/structure/subjects", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["programme", "subjects"] }),
  });
}

export function useUpdateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; code?: string; credits?: number; weeklyHours?: number; description?: string; isActive?: boolean }) =>
      api<Subject>(`/structure/subjects/${id}`, { method: "PUT", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["programme", "subjects"] }),
  });
}

export function useGroups(promotionId: string) {
  return useQuery({
    queryKey: progKeys.groups(promotionId),
    queryFn: () => api<Group[]>(`/structure/promotions/${promotionId}/groups`),
    enabled: !!promotionId,
    staleTime: 60_000,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { promotionId: string; name: string; type?: string; maxCapacity?: number }) =>
      api<Group>("/structure/groups", { method: "POST", body: data }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: progKeys.groups(vars.promotionId) }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export function useCreatePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      mentionId: string;
      academicYearId: string;
      name: string;
      level: string;
      maxCapacity: number;
      parcoursId?: string;
    }) =>
      api<Promotion>("/structure/promotions", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: yk.promotions() }),
  });
}
