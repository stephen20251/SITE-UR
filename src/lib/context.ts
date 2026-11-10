// ─────────────────────────────────────────────────────────────────────────────
// useMyContext — single call that resolves the full user context from the ERP.
//
// Each role returns a differently-shaped object (student, teacher, parent, etc.)
// but all share: role, user, unreadNotifications.
//
// Usage:
//   const { data: ctx } = useMyContext();
//   ctx?.promotion?.name   // works for STUDENT
//   ctx?.courses           // works for TEACHER
//   ctx?.children          // works for PARENT
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, tokenStore } from "./api";

// ─── Shared shapes ────────────────────────────────────────────────────────────

export type CampusCtx = {
  id: string; name: string; code: string; city?: string | null;
  country?: string | null; email?: string | null; phone?: string | null; logoUrl?: string | null;
};
export type FacultyCtx  = { id: string; name: string; code: string; deanName?: string | null };
export type DeptCtx     = { id: string; name: string; code: string };
export type MentionCtx  = { id: string; name: string; code: string; level: string; duration: number };
export type ParcoursCtx = { id: string; name: string; code: string };
export type AcaYearCtx  = { id: string; label: string; isCurrent: boolean; startDate?: string; endDate?: string };
export type SemesterCtx = { id: string; name: string; number: number; startDate?: string; endDate?: string; isActive: boolean };
export type PromotionCtx = { id: string; name: string; level: string };
export type GroupCtx     = { id: string; name: string; type: string };
export type SubjectCtx   = { id: string; name: string; code: string; credits: number; weeklyHours?: number | null };

export type GradesSummary = { count: number; average: number | null; percentage: number | null };
export type AttSummary    = { total: number; present: number; absent: number; rate: number | null };
export type FinanceSummary = { pending: number; totalDue: number; overdue: number; currency: string };
// Informations du compte, communes à tous les rôles
export type AccountCtx = { phone: string | null; createdAt: string | null; lastLoginAt: string | null; systemRole: string | null; roles: string[] };

// ─── Role-specific context shapes ─────────────────────────────────────────────

export type StudentCtx = {
  role: "STUDENT";
  user: { id: string; firstName: string; lastName: string; email: string; phone?: string | null; avatarUrl?: string | null };
  profile: { id: string; matricule: string | null; enrollmentDate?: string | null; status: string; scholarship?: boolean | null; studyMode?: "PRESENTIEL" | "EN_LIGNE" };
  campus: CampusCtx | null;
  faculty: FacultyCtx | null;
  department: DeptCtx | null;
  mention: MentionCtx | null;
  parcours: ParcoursCtx | null;
  academicYear: AcaYearCtx | null;
  semester: SemesterCtx | null;
  promotion: PromotionCtx | null;
  group: GroupCtx | null;
  subjects: (SubjectCtx & { courseId: string; teachers: { id: string; firstName: string; lastName: string; isMain: boolean }[] })[];
  parents: { id: string; firstName: string; lastName: string; email: string; phone?: string | null; relationship?: string | null }[];
  gradesSummary: GradesSummary;
  attendanceSummary: AttSummary;
  financeSummary: FinanceSummary;
  account?: AccountCtx;
  unreadNotifications: number;
};

export type TeacherCourseCtx = {
  id: string; title: string; status: string;
  subject: SubjectCtx | null;
  promotion: PromotionCtx | null;
  mention: MentionCtx | null;
  academicYear: AcaYearCtx | null;
  chaptersCount: number;
};

export type TeacherCtx = {
  role: "TEACHER";
  user: { id: string; firstName: string; lastName: string; email: string; phone?: string | null; avatarUrl?: string | null };
  profile: {
    id: string; employeeId?: string | null; specialization?: string | null; bio?: string | null; office?: string | null;
    academicTitle?: "PROFESSEUR" | "DOCTEUR" | null; highestDegree?: string | null; yearsExperience?: number | null;
    cvFileName?: string | null; cvUpdatedAt?: string | null;
  };
  campus: CampusCtx | null;
  faculty: FacultyCtx | null;
  department: DeptCtx | null;
  mention: MentionCtx | null;
  courses: TeacherCourseCtx[];
  groups: (GroupCtx & { promotionId: string | null; _count: { students: number } })[];
  studentCount: number;
  account?: AccountCtx;
  unreadNotifications: number;
};

export type ChildCtx = {
  studentProfileId: string;
  user: { id: string; firstName: string; lastName: string; email: string; avatarUrl?: string | null };
  matricule: string | null;
  status: string;
  promotion: PromotionCtx | null;
  academicYear: AcaYearCtx | null;
  mention: MentionCtx | null;
  parcours: ParcoursCtx | null;
  group: GroupCtx | null;
  faculty: FacultyCtx | null;
  campus: CampusCtx | null;
  gradesSummary: GradesSummary;
  attendanceSummary: AttSummary;
  pendingInvoices: { id: string; title: string; amount: number; status: string; dueDate?: string | null }[];
};

export type ParentCtx = {
  role: "PARENT";
  user: { id: string; firstName: string; lastName: string; email: string; phone?: string | null; avatarUrl?: string | null };
  profile: { id: string; occupation?: string | null; relationship?: string | null };
  children: ChildCtx[];
  account?: AccountCtx;
  unreadNotifications: number;
};

export type StaffCtx = {
  role: "STAFF";
  user: { id: string; firstName: string; lastName: string; email: string; avatarUrl?: string | null } | null;
  profile: { id: string; employeeId?: string | null; office?: string | null } | null;
  department: (DeptCtx & { faculty?: { campus?: CampusCtx | null } | null }) | null;
  faculty: FacultyCtx | null;
  campus: CampusCtx | null;
  stats: { students: number; teachers: number; pendingCandidates: number; activeMentions: number };
  account?: AccountCtx;
  unreadNotifications: number;
};

export type AdminCtx = {
  role: "SUPER_ADMIN";
  user: { id: string; firstName: string; lastName: string; email: string; avatarUrl?: string | null };
  currentAcademicYear: (AcaYearCtx & { campus?: CampusCtx | null; semesters: SemesterCtx[] }) | null;
  stats: {
    campuses: number; faculties: number; departments: number; mentions: number;
    totalStudents: number; activeStudents: number; totalTeachers: number;
    pendingCandidates: number; totalCourses: number;
  };
  account?: AccountCtx;
  unreadNotifications: number;
};

// Candidat ou compte en ligne sans fiche universitaire : identité seulement.
export type BasicCtx = {
  role: "CANDIDATE" | "ONLINE";
  user: { id: string; firstName: string; lastName: string; email: string; phone?: string | null; avatarUrl?: string | null } | null;
  profile: null;
  account?: AccountCtx;
  unreadNotifications: number;
};

export type MyContext = StudentCtx | TeacherCtx | ParentCtx | StaffCtx | AdminCtx | BasicCtx;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMyContext() {
  // userId in queryKey isolates cache per user — prevents stale data after logout/login
  const userId = tokenStore.getUser()?.id ?? null;
  return useQuery<MyContext>({
    queryKey: ["me", "context", userId],
    queryFn:  () => api<MyContext>("/me/context"),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!userId,
  });
}

/** Call after logout to wipe all user-specific cached data. */
export function useClearUserCache() {
  const qc = useQueryClient();
  return () => qc.clear();
}

// ─── Typed narrowers ──────────────────────────────────────────────────────────

export const isStudentCtx = (ctx: MyContext | undefined): ctx is StudentCtx => ctx?.role === "STUDENT";
export const isTeacherCtx = (ctx: MyContext | undefined): ctx is TeacherCtx => ctx?.role === "TEACHER";
export const isParentCtx  = (ctx: MyContext | undefined): ctx is ParentCtx  => ctx?.role === "PARENT";
export const isStaffCtx   = (ctx: MyContext | undefined): ctx is StaffCtx   => ctx?.role === "STAFF";
export const isAdminCtx   = (ctx: MyContext | undefined): ctx is AdminCtx   => ctx?.role === "SUPER_ADMIN";
