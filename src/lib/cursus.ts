// ─────────────────────────────────────────────────────────────────────────────
// Cursus universitaire — écolage mensuel, plan du cursus, syllabus, appel,
// suivi des séances, passage de niveau. Backend : /api/cursus (+ /api/online).
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const LEVELS = ["L1", "L2", "L3", "M1", "M2"] as const;
export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const semesterOf = (m: number) => (m <= 4 ? 1 : 2);
// Semestres numérotés sur tout le cursus : L1 → S1/S2, L2 → S3/S4, L3 → S5/S6,
// M1 → S7/S8, M2 → S9/S10. `sem` = 1 ou 2 (semestre dans l'année).
export const semesterNumber = (level: string | null | undefined, sem: number) =>
  Math.max(0, LEVELS.indexOf((level ?? "L1") as (typeof LEVELS)[number])) * 2 + sem;
export const semesterLabel = (level: string | null | undefined, sem: number) => `S${semesterNumber(level, sem)}`;
// Semestre d'un mois du cursus (ex. L2, mois 6 → « S4 »).
export const monthSemesterLabel = (level: string | null | undefined, month: number | null | undefined) =>
  semesterLabel(level, semesterOf(month ?? 1));
// « L2 · S4 · mois 6 »
export const cursusPlace = (level: string | null | undefined, month: number | null | undefined) =>
  level ? `${level} · ${monthSemesterLabel(level, month)}${month ? ` · mois ${month}` : ""}` : "";
export const fmtMGA = (n?: number | null, cur = "MGA") =>
  n == null ? "—" : `${Math.round(n).toLocaleString("fr-FR")} ${cur}`;

export const PAY_METHODS = [
  { v: "MVOLA", l: "MVola" },
  { v: "ORANGE_MONEY", l: "Orange Money" },
  { v: "AIRTEL_MONEY", l: "Airtel Money" },
] as const;
export const methodLabel = (m: string) =>
  m === "CASH" ? "Espèces (guichet)" : PAY_METHODS.find((p) => p.v === m)?.l ?? m;

export type Person = { id: string; firstName: string; lastName: string; avatarUrl?: string | null };

export type CourseProgress = {
  plannedHours: number; hoursDone: number; hoursRemaining: number;
  syllabusDone: number; syllabusTotal: number; syllabusPct: number;
  status: "PRESENT" | "UPCOMING" | "COMPLETED";
};
export type SyllabusItem = {
  id: string; title: string; description?: string | null; plannedHours: number;
  order: number; isDone: boolean; doneAt?: string | null;
};
export type CursusCourse = {
  id: string; title: string; thumbnail?: string | null; status: string;
  courseKind: "UNIVERSITY" | "CERTIFYING" | "BOTH";
  cursusLevel: string | null; cursusMonth: number | null; mentionId: string | null;
  teacher: Person | null; enrollments: number;
  syllabus: SyllabusItem[]; progress: CourseProgress;
};

export type TuitionPayment = {
  id: string; studentId: string; level: string; month: number; amount: number; currency: string;
  method: string; source: "STUDENT" | "CASHIER"; senderNumber?: string | null; transactionRef?: string | null;
  status: "PENDING" | "VALIDATED" | "REFUSED"; refusedReason?: string | null; receiptNumber?: string | null;
  note?: string | null; createdAt: string; validatedAt?: string | null;
  student?: {
    id: string; matricule: string;
    user: { firstName: string; lastName: string; email: string };
    promotion?: { name: string; level: string } | null; mention?: { name: string } | null;
  };
};

export type CursusMonth = {
  month: number; semester: number;
  status: "PAID" | "PENDING" | "REFUSED" | "UNPAID";
  payment: TuitionPayment | null;
  courses: (CursusCourse & { myProgress: number; completed: boolean; relatedCourseIds: string[] })[];
  completed: boolean; canPay: boolean; lockReason: string | null;
};
export type CursusOverview = {
  student: {
    id: string; userId: string; matricule: string; level: string | null;
    mention?: { id: string; name: string } | null; promotion?: { id: string; name: string; level: string } | null;
    studyMode: "PRESENTIEL" | "EN_LIGNE";
  };
  monthlyAmount: number | null; currency: string; currentMonth: number | null;
  months: CursusMonth[]; paidCount: number; completedCount: number;
  nextPayableMonth: number | null; eligibleForPassage: boolean;
};

const qk = {
  me: ["cursus", "me"] as const,
  parent: ["cursus", "parent"] as const,
  tuition: (f: object) => ["cursus", "tuition", f] as const,
  tuitionStats: ["cursus", "tuition-stats"] as const,
  settings: ["cursus", "tuition-settings"] as const,
  earnings: ["cursus", "earnings"] as const,
  myEarnings: ["cursus", "my-earnings"] as const,
  teacher: ["cursus", "teacher"] as const,
  options: (m?: string) => ["cursus", "options", m ?? ""] as const,
  curriculum: (m: string, l: string) => ["cursus", "curriculum", m, l] as const,
  supervision: (f: object) => ["cursus", "supervision", f] as const,
  passage: (m: string, l: string) => ["cursus", "passage", m, l] as const,
  promotions: ["cursus", "promotions"] as const,
  attendance: (p: string, g: string, d: string) => ["cursus", "attendance", p, g, d] as const,
  sessions: (d: string, m: string) => ["cursus", "sessions", d, m] as const,
};

const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};
const useInvalidate = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["cursus"] });
};

// ─── Étudiant ────────────────────────────────────────────────────────────────
export const useMyCursus = (enabled = true) =>
  useQuery({ queryKey: qk.me, queryFn: () => api<CursusOverview>("/cursus/me"), enabled });

export function useDeclareTuition() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (b: { month: number; method: string; senderNumber: string; transactionRef: string; note?: string }) =>
      api<TuitionPayment>("/cursus/me/tuition", { method: "POST", body: b }),
    onSuccess: inv,
  });
}

// ─── Parent ──────────────────────────────────────────────────────────────────
export type ParentChild = {
  student: CursusOverview["student"] & { user: Person };
  cursus: CursusOverview;
  attendance: {
    present: number; absent: number; late: number; excused: number;
    recent: { id: string; date: string; status: string; subject?: { name: string } | null }[];
  };
};
export const useParentCursus = (enabled = true) =>
  useQuery({ queryKey: qk.parent, queryFn: () => api<ParentChild[]>("/cursus/parent/children"), enabled });

// ─── Comptabilité ────────────────────────────────────────────────────────────
export const useTuitionList = (f: { status?: string; q?: string; month?: string; page?: number }) =>
  useQuery({
    queryKey: qk.tuition(f),
    queryFn: () => api<{ items: TuitionPayment[]; total: number }>(`/cursus/tuition${qs(f)}`),
  });
export const useTuitionStats = () =>
  useQuery({
    queryKey: qk.tuitionStats,
    queryFn: () => api<{ pending: number; refused: number; monthAmount: number; monthCount: number; totalAmount: number; totalCount: number }>("/cursus/tuition/stats"),
  });
export type CashierStudent = {
  id: string; matricule: string; firstName: string; lastName: string; level: string | null;
  mention?: { name: string } | null; promotion?: { name: string } | null;
  monthlyAmount: number | null; nextPayableMonth: number | null;
  months: { month: number; status: string; canPay: boolean; lockReason: string | null }[];
};
export const useTuitionStudents = (q: string) =>
  useQuery({
    queryKey: ["cursus", "tuition-students", q],
    queryFn: () => api<CashierStudent[]>(`/cursus/tuition/students${qs({ q })}`),
    enabled: q.trim().length >= 2,
  });
export function useTuitionAction() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "validate" | "refuse"; reason?: string }) =>
      api<TuitionPayment>(`/cursus/tuition/${id}/${action}`, { method: "POST", body: { reason } }),
    onSuccess: inv,
  });
}
export function useRecordCash() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (b: { studentId: string; month: number; amount?: number; note?: string }) =>
      api<TuitionPayment>("/cursus/tuition/cash", { method: "POST", body: b }),
    onSuccess: inv,
  });
}
export type TuitionSettings = {
  settings: { id: string; mentionId: string; level: string; monthlyAmount: number; currency: string; mention: { id: string; name: string } }[];
  mentions: { id: string; name: string; code: string; levels: string[] }[];
  levels: string[];
};
export const useTuitionSettings = () =>
  useQuery({ queryKey: qk.settings, queryFn: () => api<TuitionSettings>("/cursus/tuition/settings") });
export function useSaveTuitionSetting() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (b: { mentionId: string; level: string; monthlyAmount: number }) =>
      api("/cursus/tuition/settings", { method: "PUT", body: b }),
    onSuccess: inv,
  });
}
export type Earning = {
  id: string; grossAmount: number; teacherShare: number; universityShare: number; currency: string;
  status: "PENDING" | "IN_PAYSLIP" | "PAID" | "CANCELLED"; createdAt: string;
  course: { id: string; title: string }; teacher?: Person;
};
export const useEarningsOverview = () =>
  useQuery({
    queryKey: qk.earnings,
    queryFn: () => api<{
      teachers: { teacher: Person; pending: number; inPayslip: number; paid: number; gross: number; universityShare: number; sales: number }[];
      recent: Earning[];
      share?: RevenueShare;
    }>("/cursus/earnings"),
  });
export const useMyEarnings = (enabled = true) =>
  useQuery({
    queryKey: qk.myEarnings,
    queryFn: () => api<{ pending: number; paid: number; total: number; items: Earning[]; sharePercent?: number }>("/cursus/teacher/earnings"),
    enabled,
  });

// Répartition enseignant / université des ventes de cours (réglée par le Super administrateur)
export type RevenueShare = { teacherPercent: number; universityPercent: number };
export const useSaveRevenueShare = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teacherPercent: number) =>
      api<RevenueShare>("/cursus/earnings/share", { method: "PUT", body: { teacherPercent } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.earnings });
      qc.invalidateQueries({ queryKey: qk.myEarnings });
    },
  });
};

// ─── Enseignant ──────────────────────────────────────────────────────────────
export type Assignment = {
  id: string; title: string; level: string; month: number; plannedHours: number;
  mention: { id: string; name: string }; subject?: { id: string; name: string } | null;
};
// Matière attribuée dans « Affectation des matières »
export type TeacherSubject = {
  id: string; code: string; name: string; credits: number; weeklyHours: number;
  mention: { id: string; name: string } | null; types: string[]; groups: string[];
};
export const useTeacherCourses = (enabled = true) =>
  useQuery({
    queryKey: qk.teacher,
    queryFn: () => api<{
      currentMonth: number | null;
      present: CursusCourse[]; upcoming: CursusCourse[]; completed: CursusCourse[];
      assignments: Assignment[];
      subjects?: TeacherSubject[];
    }>("/cursus/teacher/courses"),
    enabled,
  });
export function useCreateCourseFromAssignment() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (b: { curriculumEntryId: string; title: string; courseKind: "UNIVERSITY" | "BOTH"; relatedCourseIds?: string[]; price?: number; credentialType?: string }) =>
      api<{ id: string }>("/online/courses", { method: "POST", body: b }),
    onSuccess: inv,
  });
}
export function useSyllabusMutations(courseId: string) {
  const inv = useInvalidate();
  const add = useMutation({
    mutationFn: (b: { title: string; description?: string; plannedHours: number }) =>
      api<SyllabusItem>(`/cursus/courses/${courseId}/syllabus`, { method: "POST", body: b }),
    onSuccess: inv,
  });
  const update = useMutation({
    mutationFn: ({ id, ...b }: { id: string; title?: string; plannedHours?: number; description?: string }) =>
      api<SyllabusItem>(`/cursus/syllabus/${id}`, { method: "PATCH", body: b }),
    onSuccess: inv,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/cursus/syllabus/${id}`, { method: "DELETE" }),
    onSuccess: inv,
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => api(`/cursus/courses/${courseId}/syllabus/reorder`, { method: "PUT", body: { ids } }),
    onSuccess: inv,
  });
  return { add, update, remove, reorder };
}

// ─── Responsable : plan du cursus ────────────────────────────────────────────
export type CurriculumOptions = {
  mentions: { id: string; name: string; code: string }[];
  teachers: (Person & { email: string; systemRole: string })[];
  subjects: { id: string; name: string; code: string; credits: number }[];
  courses: { id: string; title: string; cursusLevel: string | null; cursusMonth: number | null }[];
};
export const useCurriculumOptions = (mentionId?: string) =>
  useQuery({ queryKey: qk.options(mentionId), queryFn: () => api<CurriculumOptions>(`/cursus/curriculum/options${qs({ mentionId })}`) });
export type CurriculumEntry = {
  id: string; title: string; description?: string | null; month: number; level: string;
  plannedHours: number; order: number; teacher: Person | null;
  subject?: { id: string; name: string; code: string } | null; course: CursusCourse | null;
};
export const useCurriculum = (mentionId: string, level: string) =>
  useQuery({
    queryKey: qk.curriculum(mentionId, level),
    queryFn: () => api<{ months: { month: number; semester: number; entries: CurriculumEntry[]; warning: string | null }[]; total: number; currentMonth: number | null }>(
      `/cursus/curriculum${qs({ mentionId, level })}`),
    enabled: !!mentionId && !!level,
  });
export function useCurriculumMutations() {
  const inv = useInvalidate();
  const create = useMutation({
    mutationFn: (b: Record<string, unknown>) => api("/cursus/curriculum", { method: "POST", body: b }),
    onSuccess: inv,
  });
  const update = useMutation({
    mutationFn: ({ id, ...b }: Record<string, unknown> & { id: string }) => api(`/cursus/curriculum/${id}`, { method: "PATCH", body: b }),
    onSuccess: inv,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/cursus/curriculum/${id}`, { method: "DELETE" }),
    onSuccess: inv,
  });
  return { create, update, remove };
}
export type SupervisedCourse = CursusCourse & { students: number; avgStudentProgress: number; studentsCompleted: number };
export const useSupervision = (f: { mentionId?: string; level?: string }) =>
  useQuery({
    queryKey: qk.supervision(f),
    queryFn: () => api<{ currentMonth: number | null; mentions: { id: string; name: string }[]; courses: SupervisedCourse[] }>(`/cursus/supervision${qs(f)}`),
  });
export const usePassage = (mentionId: string, level: string) =>
  useQuery({
    queryKey: qk.passage(mentionId, level),
    queryFn: () => api<{
      level: string; nextLevel: string | null;
      targetPromotions: { id: string; name: string; level: string }[];
      students: { id: string; matricule: string; user: Person; paidCount: number; completedCount: number; eligible: boolean; promotion?: { name: string } | null }[];
    }>(`/cursus/passage${qs({ mentionId, level })}`),
    enabled: !!mentionId && !!level,
  });
export function usePromote() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ studentId, ...b }: { studentId: string; toPromotionId: string; note?: string }) =>
      api(`/cursus/passage/${studentId}`, { method: "POST", body: b }),
    onSuccess: inv,
  });
}

// ─── Secrétariat : appel et suivi des séances ────────────────────────────────
export type DaySlot = {
  id: string; day: string; startTime: string; endTime: string; type: string; subjectName: string; hours: number;
  teacher: Person; room?: { name: string } | null; group?: { id: string; name: string } | null;
  promotion: { id: string; name: string; level: string; mentionId: string };
};
export type AttendancePromotion = {
  id: string; name: string; level: string; mention: { id: string; name: string };
  groups: { id: string; name: string }[]; _count: { students: number };
};
export const useAttendancePromotions = () =>
  useQuery({ queryKey: qk.promotions, queryFn: () => api<AttendancePromotion[]>("/cursus/attendance/promotions") });
export const useAttendanceDay = (promotionId: string, groupId: string, date: string) =>
  useQuery({
    queryKey: qk.attendance(promotionId, groupId, date),
    queryFn: () => api<{
      date: string; dayOfWeek: string; promotion: { name: string };
      slots: DaySlot[];
      students: { id: string; matricule: string; user: Person; group?: { name: string } | null }[];
      records: { studentId: string; scheduleSlotId: string; status: string }[];
    }>(`/cursus/attendance/day${qs({ promotionId, groupId, date })}`),
    enabled: !!promotionId,
  });
export function useSaveAttendance() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (b: { date: string; slotId: string; records: { studentId: string; status: string }[] }) =>
      api<{ saved: number }>("/cursus/attendance", { method: "POST", body: b }),
    onSuccess: inv,
  });
}
export const useSessionsDay = (date: string, mentionId = "") =>
  useQuery({
    queryKey: qk.sessions(date, mentionId),
    queryFn: () => api<{
      date: string; dayOfWeek: string;
      sessions: { slot: DaySlot; log: { id: string; hours: number; checkedAt: string } | null; course: CursusCourse | null }[];
    }>(`/cursus/sessions/day${qs({ date, mentionId })}`),
  });
export function useSaveSession() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (b: { slotId: string; date: string; done: boolean; syllabusItemIds?: string[] }) =>
      api("/cursus/sessions", { method: "POST", body: b }),
    onSuccess: inv,
  });
}
export function useToggleSyllabus() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      api<SyllabusItem>(`/cursus/syllabus/${id}/toggle`, { method: "POST", body: { done } }),
    onSuccess: inv,
  });
}

// ─── Affichage ───────────────────────────────────────────────────────────────
export const COURSE_STATUS: Record<CourseProgress["status"], { label: string; cls: string }> = {
  PRESENT: { label: "En cours", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  UPCOMING: { label: "À venir", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  COMPLETED: { label: "Complété", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
};
export const TUITION_STATUS: Record<string, { label: string; cls: string }> = {
  PAID: { label: "Payé", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  VALIDATED: { label: "Validé", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  PENDING: { label: "En attente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  REFUSED: { label: "Refusé", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  UNPAID: { label: "Non payé", cls: "bg-muted text-muted-foreground" },
};
export const KIND_LABEL: Record<string, string> = {
  UNIVERSITY: "Cursus universitaire",
  CERTIFYING: "Cours certifiant",
  BOTH: "Universitaire + certifiant",
};
