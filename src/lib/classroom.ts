// ─────────────────────────────────────────────────────────────────────────────
// Classroom subsystem — typed API calls + TanStack Query hooks.
// All paths match the real backend routes in backend/src/app.js.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// ─── Shared primitives ───
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
export const DAY_INDEX: Record<DayOfWeek, number> = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 7,
};

export type Person = { id: string; firstName: string; lastName: string; avatarUrl?: string | null };

// ─── Real schedule slot (from /api/schedule/my-schedule) ───
export type ScheduleSlot = {
  id: string;
  day: DayOfWeek;
  startTime: string; // "08:00"
  endTime: string;
  subjectName?: string;
  type?: string;
  course?: { id: string; title: string } | null;
  room?: { id: string; name: string; code: string } | null;
  teacher?: { id: string; firstName: string; lastName: string } | null;
  group?: { id: string; name: string } | null;
  promotion?: { id: string; name: string; level: string } | null;
  schedulePeriod?: {
    id: string; name: string; weekStart?: string | null;
    mention?: { name: string } | null; semester?: { name: string } | null;
  } | null;
};

// ─── Grade (from /api/grades/) ───
export type Grade = {
  id: string;
  studentId: string;
  subjectId: string;
  teacherId: string | null;
  semesterId: string | null;
  type: string; // "CC" | "MIDTERM" | "FINAL" | "PROJECT" | "ORAL"
  value: number;
  maxValue: number;
  coefficient: number;
  comment: string | null;
  isValidated: boolean;
  createdAt: string;
  subject?: { id: string; name: string; code: string; credits: number } | null;
  student?: { user: { firstName: string; lastName: string } } | null;
};

// ─── Attendance (from /api/grades/attendance) ───
export type Attendance = {
  id: string;
  studentId: string;
  subjectId: string | null;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  subject?: { id: string; name: string } | null;
};

// ─── Announcement (from /api/announcements) ───
export type Announcement = {
  id: string;
  authorId: string;
  title: string;
  content: string;
  category: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isPinned: boolean;
  publishAt: string | null;
  targetAll: boolean;
  targetRoles: string[];
  createdAt: string;
  author: { id: string; firstName: string; lastName: string; systemRole: string; avatarUrl?: string | null };
  _count?: { reads: number; comments: number };
};

export type Department = {
  id: string;
  name: string;
  code: string;
  _count?: { classes: number; students: number; teachers: number };
};

export type ClassroomClass = {
  id: string;
  name: string;
  level: string;
  academicYear: string;
  departmentId: string;
  department?: { id: string; name: string; code: string };
  _count?: { students: number; timetable: number };
  students?: StudentProfile[];
};

export type StudentProfile = {
  id: string;
  userId: string;
  studentNo: string;
  classId: string | null;
  user: Person & { email?: string };
  class?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
};

// Returned by /api/admin/stats
export type ReportsOverview = {
  users: number;
  students: number;
  teachers: number;
  pendingCandidates: number;
  mentions: number;
  promotions: number;
};

export type ApiUserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  system: string;
  isActive: boolean;
};

// ─── Query key factories ───
export const ck = {
  mySchedule:   ["schedule", "me"] as const,
  myAttendance: ["grades", "me", "attendance"] as const,
  myGrades:     ["grades", "me"] as const,
  announcements: ["announcements"] as const,
  departments:  ["structure", "departments"] as const,
  classes:      (deptId?: string) => ["classroom", "classes", { deptId: deptId ?? "" }] as const,
  classTimetable: (classId: string) => ["classroom", "timetable", classId] as const,
  roster:       (classId: string) => ["classroom", "roster", classId] as const,
  gradebook:    (classId: string) => ["classroom", "gradebook", classId] as const,
  reports:      ["admin", "reports"] as const,
  users:        (role?: string) => ["admin", "users", { role: role ?? "" }] as const,
};

type QOpts = { enabled?: boolean };

// ─── Self (student/teacher) ───

// GET /api/schedule/my-schedule → ScheduleSlot[]
export const useMyTimetable = (o: QOpts = {}) =>
  useQuery({ queryKey: ck.mySchedule, queryFn: () => api<ScheduleSlot[]>("/schedule/my-schedule"), enabled: o.enabled ?? true });

// GET /api/grades/attendance → Attendance[]
export const useMyAttendance = (o: QOpts = {}) =>
  useQuery({ queryKey: ck.myAttendance, queryFn: () => api<Attendance[]>("/grades/attendance"), enabled: o.enabled ?? true });

// GET /api/grades/ → Grade[]
export const useMyGrades = (o: QOpts = {}) =>
  useQuery({ queryKey: ck.myGrades, queryFn: () => api<Grade[]>("/grades/"), enabled: o.enabled ?? true });

// ─── Announcements ─── GET /api/announcements
export const useAnnouncements = (o: QOpts = {}) =>
  useQuery({
    queryKey: ck.announcements,
    queryFn: () => api<{ total: number; page: number; limit: number; items: Announcement[] }>("/announcements"),
    enabled: o.enabled ?? true,
  });

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string; content: string; category?: string; priority?: string; targetAll?: boolean;
      targetRoles?: string[]; mentionId?: string | null; promotionId?: string | null;
    }) =>
      api<Announcement>("/announcements", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ck.announcements }),
  });
}

// ─── Semesters ───
export type Semester = { id: string; name: string; startDate?: string; endDate?: string };
export const useSemesters = (o: QOpts = {}) =>
  useQuery({ queryKey: ["structure", "semesters"], queryFn: () => api<Semester[]>("/structure/semesters"), enabled: o.enabled ?? true });

// ─── Student profiles (admin search) ───
export type StudentProfileRow = {
  id: string;
  userId: string;
  matricule: string | null;
  user: { firstName: string; lastName: string; email: string };
  promotion?: { id: string; name: string; level: string } | null;
  mention?: { id: string; name: string } | null;
};
export const useStudentProfiles = (o: QOpts & { search?: string } = {}) =>
  useQuery({
    queryKey: ["classroom", "student-profiles", o.search ?? ""],
    queryFn: () => api<{ items: StudentProfileRow[]; total: number }>(`/admin/users?role=STUDENT&limit=50${o.search ? `&q=${encodeURIComponent(o.search)}` : ""}`),
    enabled: o.enabled ?? true,
  });

// ─── Structure ───
export const useDepartments = (o: QOpts = {}) =>
  useQuery({ queryKey: ck.departments, queryFn: () => api<Department[]>("/structure/departments"), enabled: o.enabled ?? true });

export const useClasses = (deptId: string | undefined, o: QOpts = {}) =>
  useQuery({
    queryKey: ck.classes(deptId),
    queryFn: () => api<ClassroomClass[]>(`/classroom/classes${deptId ? `?departmentId=${deptId}` : ""}`),
    enabled: o.enabled ?? true,
  });

export const useRoster = (classId: string | null, o: QOpts = {}) =>
  useQuery({
    queryKey: ck.roster(classId ?? "none"),
    queryFn: () => api<StudentProfile[]>(`/classroom/classes/${classId}/students`),
    enabled: (o.enabled ?? true) && !!classId,
  });

// ─── Grades (admin / teacher) ───
export function useCreateGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentId: string; subjectId: string; semesterId?: string; type: string; value: number; maxValue?: number; coefficient?: number; comment?: string }) =>
      api<Grade>("/grades/", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grades"] }),
  });
}

// ─── Bulletin ───
export type BulletinSubjectResult = {
  subject: { name: string; code: string; credits: number };
  grades: Grade[];
  average: number;
  credits: number;
};
export type BulletinData = {
  student: { id: string; matricule: string; user: { firstName: string; lastName: string }; promotion?: { name: string; level: string } | null; mention?: { name: string } | null };
  semesterId: string;
  results: BulletinSubjectResult[];
  summary: { gpa: number; totalCredits: number; earnedCredits: number; passed: boolean };
};

// GET /api/grades/bulletin/:studentId/:semesterId
export const useBulletin = (studentId: string | null, semesterId: string | null, o: QOpts = {}) =>
  useQuery({
    queryKey: ["grades", "bulletin", studentId, semesterId],
    queryFn: () => api<BulletinData>(`/grades/bulletin/${studentId}/${semesterId}`),
    enabled: (o.enabled ?? true) && !!studentId && !!semesterId,
  });

// POST /api/grades/attendance  — payload matches real backend: { records, courseId?, date }
export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { courseId?: string; date: string; records: { studentId: string; status: AttendanceStatus; comment?: string }[] }) =>
      api("/grades/attendance", { method: "POST", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grades"] }),
  });
}

export const useGrades = (o: QOpts & { studentId?: string; subjectId?: string; semesterId?: string } = {}) =>
  useQuery({
    queryKey: ["grades", "list", { studentId: o.studentId, subjectId: o.subjectId }],
    queryFn: () => {
      const q = new URLSearchParams();
      if (o.studentId) q.set("studentId", o.studentId);
      if (o.subjectId) q.set("subjectId", o.subjectId);
      if (o.semesterId) q.set("semesterId", o.semesterId);
      return api<Grade[]>(`/grades/?${q.toString()}`);
    },
    enabled: o.enabled ?? true,
  });

// ─── Admin ───
export const useReportsOverview = (o: QOpts = {}) =>
  useQuery({ queryKey: ck.reports, queryFn: () => api<ReportsOverview>("/admin/stats"), enabled: o.enabled ?? true });

export const useUsers = (role: string | undefined, o: QOpts = {}) =>
  useQuery({
    queryKey: ck.users(role),
    queryFn: () => api<{ items: ApiUserRow[]; total: number }>(`/admin/users?limit=20${role ? `&role=${role}` : ""}`),
    enabled: o.enabled ?? true,
  });

// ─── Finance ───

export type PaymentStatus = "PENDING" | "PAID" | "PARTIAL" | "OVERDUE" | "CANCELLED";

export type FeeStructure = {
  id: string;
  name: string;
  academicYear: string;
  amount: number;
  currency: string;
  description: string | null;
};

export type Payment = {
  id: string;
  invoiceId: string;
  amount: number;
  status: PaymentStatus;
  method: string | null;
  receiptNumber: string | null;
  paidAt: string | null;
  createdAt: string;
  student?: { user: { firstName: string; lastName: string } };
  invoice?: { invoiceNumber: string; title: string } | null;
};

export type FinanceOverview = {
  totalInvoiced: number;
  totalPaid: number;
  pendingCount: number;
  overdueCount: number;
  currency: string;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  title: string;
  amount: number;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
  dueDate: string | null;
  createdAt: string;
  feeStructure?: { name: string } | null;
  payments?: { id: string; amount: number; status: string; paidAt: string | null }[];
};

export const fk = {
  myInvoices: ["finance", "my-invoices"] as const,
  payments:   (status?: string) => ["finance", "payments", { status: status ?? "" }] as const,
  fees:       ["finance", "fees"] as const,
  overview:   ["finance", "overview"] as const,
};

export const useMyInvoices = (o: QOpts = {}) =>
  useQuery({ queryKey: fk.myInvoices, queryFn: () => api<Invoice[]>("/finance/invoices/my"), enabled: o.enabled ?? true });

export const useFees = (o: QOpts = {}) =>
  useQuery({ queryKey: fk.fees, queryFn: () => api<FeeStructure[]>("/finance/fees"), enabled: o.enabled ?? true });

export const useFinanceOverview = (o: QOpts = {}) =>
  useQuery({ queryKey: fk.overview, queryFn: () => api<FinanceOverview>("/finance/summary"), enabled: o.enabled ?? true });

export const usePayments = (status: string | undefined, o: QOpts = {}) =>
  useQuery({
    queryKey: fk.payments(status),
    queryFn: () => api<{ total: number; payments: Payment[] }>(`/finance/payments${status ? `?status=${status}` : ""}`),
    enabled: o.enabled ?? true,
  });

export function useValidatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<Payment>(`/finance/payments/${id}/validate`, { method: "PUT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance"] }),
  });
}

export function useCancelPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<Payment>(`/finance/payments/${id}/cancel`, { method: "PUT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance"] }),
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { invoiceId: string; amount: number; method?: string }) =>
      api<Payment>("/finance/payments", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance"] }),
  });
}

// ─── Parent ───

export type ChildUser = Person & {
  email: string;
  studentProfile?: {
    id: string;
    matricule: string | null;
    promotion?: { id: string; name: string; level: string } | null;
    mention?: { id: string; name: string } | null;
    group?: { id: string; name: string } | null;
  } | null;
};

export const pk = {
  children:       ["me", "children"] as const,
  childGrades:    (childId: string) => ["me", "children", childId, "grades"] as const,
  childAttendance:(childId: string) => ["me", "children", childId, "attendance"] as const,
};

export const useMyChildren = (o: QOpts = {}) =>
  useQuery({ queryKey: pk.children, queryFn: () => api<ChildUser[]>("/classroom/me/children"), enabled: o.enabled ?? true });

export const useChildGrades = (childId: string | null, o: QOpts = {}) =>
  useQuery({
    queryKey: pk.childGrades(childId ?? "none"),
    queryFn: () => api<Grade[]>(`/grades/?studentId=${childId}`),
    enabled: (o.enabled ?? true) && !!childId,
  });

export const useChildAttendance = (childId: string | null, o: QOpts = {}) =>
  useQuery({
    queryKey: pk.childAttendance(childId ?? "none"),
    queryFn: () => api<Attendance[]>(`/grades/attendance?studentId=${childId}`),
    enabled: (o.enabled ?? true) && !!childId,
  });
