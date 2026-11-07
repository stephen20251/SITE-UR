// Online subsystem — typed API calls + TanStack Query hooks.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { api } from "./api";

// ─── Core types ───
export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type LessonType = "VIDEO" | "PDF" | "TEXT" | "AUDIO" | "DOCUMENT" | "IMAGE" | "ZIP" | "FILE" | "CODE" | "LINK";
export type QuestionType = "MCQ_SINGLE" | "MCQ_MULTI" | "TRUE_FALSE";
export type SessionStatus = "SCHEDULED" | "LIVE" | "DONE" | "CANCELLED";
export type AssignmentStatus = "OPEN" | "CLOSED";
export type SubmissionStatus = "SUBMITTED" | "GRADED";
export type PathStatus = "DRAFT" | "PUBLISHED";

export type TeacherCard = {
  id?: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
};

// Cursus universitaire : type de cours et rattachement (niveau, mois).
export type CourseKind = "UNIVERSITY" | "CERTIFYING" | "BOTH";
export type CursusFields = {
  courseKind?: CourseKind;
  credentialType?: "CERTIFICATE" | "ATTESTATION";
  cursusLevel?: string | null;
  cursusMonth?: number | null;
  mentionId?: string | null;
  totalHours?: number | null;
};

export type CourseCard = CursusFields & {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  description: string | null;
  thumbnail: string | null;
  previewVideoUrl: string | null;
  status: CourseStatus;
  publishedAt: string | null;
  level: string | null;
  language: string | null;
  isFeatured: boolean;
  tags: string[];
  hasCertificate: boolean;
  estimatedHours: number | null;
  objectives: string[];
  skills: string[];
  audience: string | null;
  prerequisites: string | null;
  price: number | null;
  createdAt: string;
  updatedAt: string;
  teacher: TeacherCard;
  category: { id: string; name: string; icon: string | null; color: string | null } | null;
  _count: { modules: number; enrollments: number; quizzes: number };
  ratingAvg?: number;
  ratingCount?: number;
};

export type Paginated<T> = { items: T[]; total: number; page: number; limit: number };

export type LessonFile = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  allowDownload: boolean;
};

export type CourseLesson = {
  id: string;
  title: string;
  type: LessonType;
  duration: number | null;
  order: number;
  locked: boolean;
  contentUrl: string | null;
  body: string | null;
  allowDownload: boolean;
  files: LessonFile[];
  completed: boolean;
  watchedSec?: number;
  isPreview?: boolean;
};

export type CourseModule = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  isHidden?: boolean;
  locked?: boolean;
  lockReason?: "drip" | "prerequisite" | null;
  availableAt?: string | null;
  dripDays?: number | null;
  prerequisiteModuleId?: string | null;
  prerequisiteTitle?: string | null;
  lessons: CourseLesson[];
};

export type CourseQuizSummary = {
  id: string;
  audience?: "ALL" | "STUDENT" | "PUBLIC";
  title: string;
  description: string | null;
  passingScore: number;
  timeLimit: number | null;
  questionCount: number;
};

export type Certificate = {
  id: string;
  studentId: string;
  courseId: string;
  enrollmentId: string;
  code: string;
  issuedAt: string;
  course?: { id: string; title: string; slug: string; thumbnail: string | null };
};

export type CourseDetail = CursusFields & {
  relatedCourseIds?: string[];
  // Contenu du cursus : non téléchargeable / non partageable
  protectedContent?: boolean;
  // Accès via l'écolage (étudiants de l'université uniquement)
  cursus?: {
    inCursus: boolean;
    accessible: boolean;
    reason: "not_student" | "not_in_cursus" | "tuition_unpaid" | "related_incomplete" | null;
    month: number | null;
    level: string | null;
  } | null;
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  description: string | null;
  thumbnail: string | null;
  previewVideoUrl: string | null;
  status: CourseStatus;
  publishedAt: string | null;
  level: string | null;
  language: string | null;
  isFeatured: boolean;
  tags: string[];
  hasCertificate: boolean;
  estimatedHours: number | null;
  objectives: string[];
  skills: string[];
  audience: string | null;
  prerequisites: string | null;
  price: number | null;
  category: { id: string; name: string; icon: string | null; color: string | null } | null;
  teacher: TeacherCard;
  enrollmentsCount: number;
  isOwner: boolean;
  enrolled: boolean;
  subscribed?: boolean;
  progress: number;
  completedAt: string | null;
  lastVisitedLessonId: string | null;
  certificate: Certificate | null;
  modules: CourseModule[];
  quizzes: CourseQuizSummary[];
  ratingAvg: number;
  ratingCount: number;
  ratingDistribution: Record<string, number>;
  myReview: CourseReview | null;
};

export type Enrollment = {
  id: string;
  studentId: string;
  courseId: string;
  progress: number;
  completedAt: string | null;
  lastVisitedLessonId: string | null;
  lastVisitedAt: string | null;
  lastOpenedModuleId: string | null;
  createdAt: string;
  course?: {
    id: string;
    title: string;
    slug: string;
    thumbnail: string | null;
    teacher?: { firstName: string; lastName: string };
  };
  certificate?: Pick<Certificate, "id" | "code" | "issuedAt"> | null;
};

export type ProgressResult = {
  lesson: { id: string; completed: boolean; watchedSec: number };
  progress: number;
  completed: boolean;
  completedLessons: number;
  totalLessons: number;
  certificate: Certificate | null;
};

export type QuizListItem = {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimit: number | null;
  createdAt: string;
  questionCount: number;
  attempted?: boolean;
  lastScore?: number | null;
  passed?: boolean | null;
  course?: { id: string; title: string; slug: string };
};

export type QuizOption = { id: string; text: string; isCorrect?: boolean };
export type QuizQuestion = {
  id: string;
  text: string;
  type: QuestionType;
  points: number;
  order: number;
  options: QuizOption[];
};
export type Quiz = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimit: number | null;
  questions: QuizQuestion[];
};

export type SubmitResult = {
  attemptId: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  passingScore: number;
  breakdown: {
    questionId: string;
    correct: boolean;
    awarded: number;
    points: number;
    selectedOptionIds: string[];
    correctOptionIds: string[];
  }[];
};

export type CourseAnalytics = {
  enrollments: number;
  completed: number;
  completionRate: number;
  avgProgress: number;
  lessons: number;
  quizzes: { quizId: string; title: string; attempts: number; passRate: number; avgScore: number }[];
};

// ─── New Phase 2 types ───
export type LiveSession = {
  id: string;
  courseId: string;
  teacherId: string;
  title: string;
  description?: string | null;
  scheduledAt: string;
  durationMin: number;
  link: string | null;
  status: SessionStatus;
  createdAt: string;
  teacher: { firstName: string; lastName: string; avatarUrl?: string | null };
  course?: { id: string; title: string; slug: string; thumbnail: string | null };
};

export type OnlineAssignment = {
  id: string;
  courseId: string;
  moduleId: string | null;
  title: string;
  description: string | null;
  dueDate: string;
  maxScore: number;
  fileUrl: string | null;
  // Fichiers d'exercices joints par l'enseignant
  attachments?: { name: string; url: string; mimeType: string; size: number }[];
  status: AssignmentStatus;
  createdAt: string;
  module?: { id: string; title: string } | null;
  course?: { id: string; title: string; slug: string; thumbnail: string | null };
  submission?: OnlineSubmission | null;
  _count?: { submissions: number };
  peerReview?: boolean;
};

export type OnlineSubmission = {
  id: string;
  assignmentId: string;
  studentId: string;
  fileUrl: string | null;
  content: string | null;
  status: SubmissionStatus;
  score: number | null;
  feedback: string | null;
  submittedAt: string;
  gradedAt: string | null;
};

export type LearningActivity = {
  id: string;
  studentId: string;
  courseId: string | null;
  lessonId: string | null;
  quizId: string | null;
  action: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  course?: { id: string; title: string; slug: string; thumbnail: string | null } | null;
  lesson?: { id: string; title: string; type: string } | null;
};

export type LearningPathStep = {
  id: string;
  pathId: string;
  courseId: string;
  order: number;
  course: CourseCard;
  enrollment?: Pick<Enrollment, "courseId" | "progress" | "completedAt"> | null;
};

export type LearningPath = {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  status: PathStatus;
  createdAt: string;
  creator: { firstName: string; lastName: string };
  steps: LearningPathStep[];
};

// ─── Query keys ───
export const qk = {
  courses: (q?: string) => ["online", "courses", { q: q ?? "" }] as const,
  myCourses: (status?: string) => ["online", "courses", "mine", { status: status ?? "" }] as const,
  course: (id: string) => ["online", "course", id] as const,
  enrollments: () => ["online", "enrollments"] as const,
  certificates: () => ["online", "certificates"] as const,
  courseQuizzes: (courseId: string) => ["online", "course", courseId, "quizzes"] as const,
  quiz: (quizId: string) => ["online", "quiz", quizId] as const,
  myAttempts: (quizId: string) => ["online", "quiz", quizId, "my-attempts"] as const,
  quizAttempts: (quizId: string) => ["online", "quiz", quizId, "attempts"] as const,
  analytics: (courseId: string) => ["online", "course", courseId, "analytics"] as const,
  pendingQuizzes: () => ["online", "quizzes", "pending"] as const,
  liveSessions: () => ["online", "live-sessions"] as const,
  courseAssignments: (courseId: string) => ["online", "course", courseId, "assignments"] as const,
  pendingAssignments: () => ["online", "assignments", "pending"] as const,
  activity: () => ["online", "activity"] as const,
  weeklyActivity: () => ["online", "activity", "weekly"] as const,
  paths: () => ["online", "paths"] as const,
  pathsForMe: () => ["online", "paths", "for-me"] as const,
  path: (id: string) => ["online", "path", id] as const,
};

type QOpts = { enabled?: boolean };

export type CatalogueSort = "recent" | "rating" | "popular";
export type CatalogueFilters = {
  q?: string;
  sort?: CatalogueSort;
  level?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  free?: boolean;
  minRating?: number;
  categoryId?: string;
  // Catalogue en deux parties ouvertes à tous : cursus universitaire / cours certifiants
  kind?: "ALL" | "UNIVERSITY" | "CERTIFYING";
  cursusLevel?: string;
  mentionId?: string;
  limit?: number;
};

function catalogueQS(f: CatalogueFilters, extra: Record<string, string | number> = {}): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.sort) p.set("sort", f.sort);
  if (f.level) p.set("level", f.level);
  if (f.free) p.set("free", "true");
  if (f.minRating != null) p.set("minRating", String(f.minRating));
  if (f.categoryId) p.set("categoryId", f.categoryId);
  if (f.kind) p.set("kind", f.kind);
  if (f.cursusLevel) p.set("cursusLevel", f.cursusLevel);
  if (f.mentionId) p.set("mentionId", f.mentionId);
  for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
  return p.toString();
}

// ─── Courses ───
// ─── Public (no auth) ───
export function usePublicCourses(filters: CatalogueFilters | string, opts: QOpts = {}) {
  const f: CatalogueFilters = typeof filters === "string" ? { q: filters } : filters;
  return useQuery({
    queryKey: ["online", "public-courses", f],
    queryFn: () => api<{ items: CourseCard[]; total: number; page: number; limit: number }>(`/online/public/courses?${catalogueQS(f, { limit: f.limit ?? 24 })}`, { auth: false }),
    enabled: opts.enabled ?? true,
    staleTime: 60_000,
  });
}

export type ReviewHighlight = {
  id: string; rating: number; comment: string; studentName: string;
  avatarUrl: string | null; courseId: string; courseTitle: string; createdAt: string;
};

export function usePublicReviewHighlights(opts: QOpts = {}) {
  return useQuery<ReviewHighlight[]>({
    queryKey: ["online", "public-review-highlights"],
    queryFn: () => api("/online/public/reviews-highlights"),
    enabled: opts.enabled ?? true,
    staleTime: 300_000,
  });
}

export type FeaturedInstructor = {
  id: string; firstName: string; lastName: string; avatarUrl: string | null;
  courses: number; students: number; ratingAvg: number; ratingCount: number;
};

export function useFeaturedInstructors(opts: QOpts = {}) {
  return useQuery<FeaturedInstructor[]>({
    queryKey: ["online", "featured-instructors"],
    queryFn: () => api("/online/public/featured-instructors"),
    enabled: opts.enabled ?? true,
    staleTime: 300_000,
  });
}

export function usePublicStats(opts: QOpts = {}) {
  return useQuery({
    queryKey: ["online", "public-stats"],
    queryFn: () => api<{ courses: number; students: number; certificates: number }>(`/online/public/stats`),
    enabled: opts.enabled ?? true,
    staleTime: 300_000,
  });
}

export function useCourses(filters: CatalogueFilters | string, opts: QOpts = {}) {
  const f: CatalogueFilters = typeof filters === "string" ? { q: filters } : filters;
  return useQuery({
    queryKey: [...qk.courses(f.q), f],
    queryFn: () => api<Paginated<CourseCard>>(`/online/courses?${catalogueQS(f, { limit: f.limit ?? 50 })}`),
    enabled: opts.enabled ?? true,
  });
}

export function useMyCourses(status: string | undefined, opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.myCourses(status),
    queryFn: () =>
      api<Paginated<CourseCard>>(`/online/courses/mine?limit=50${status ? `&status=${status}` : ""}`),
    enabled: opts.enabled ?? true,
  });
}

// Page de présentation d'un cours pour un visiteur non connecté (style MOOC).
export function usePublicCourse(id: string, opts: QOpts = {}) {
  return useQuery({
    queryKey: ["online", "public-course", id],
    queryFn: () => api<CourseDetail>(`/online/public/courses/${id}`, { auth: false }),
    enabled: (opts.enabled ?? true) && !!id,
  });
}

export function useCourse(id: string, opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.course(id),
    queryFn: () => api<CourseDetail>(`/online/courses/${id}`),
    enabled: (opts.enabled ?? true) && !!id,
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string; subtitle?: string; description?: string;
      language?: string; level?: string; categoryId?: string;
      tags?: string[]; hasCertificate?: boolean; estimatedHours?: number;
    } & Record<string, unknown>) =>
      api<CourseCard>("/online/courses", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "courses", "mine"] }),
  });
}

export function useUpdateCourse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown> & Partial<{
      title: string; subtitle: string | null; description: string | null;
      thumbnail: string | null; previewVideoUrl: string | null;
      tags: string[]; language: string; level: string | null;
      categoryId: string | null; isFeatured: boolean; hasCertificate: boolean;
      estimatedHours: number | null; objectives: string[]; skills: string[];
      audience: string | null; prerequisites: string | null; price: number;
      status: CourseStatus; publishedAt: string | null;
    }>) =>
      api<CourseCard>(`/online/courses/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.course(id) });
      qc.invalidateQueries({ queryKey: ["online", "courses", "mine"] });
    },
  });
}

export function useArchiveCourse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<CourseCard>(`/online/courses/${id}/archive`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.course(id) });
      qc.invalidateQueries({ queryKey: ["online", "courses"] });
    },
  });
}

export function usePublishCourse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<CourseCard>(`/online/courses/${id}/publish`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.course(id) });
      qc.invalidateQueries({ queryKey: ["online", "courses"] });
    },
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/online/courses/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "courses"] }),
  });
}

export function useCourseAnalytics(courseId: string, opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.analytics(courseId),
    queryFn: () => api<CourseAnalytics>(`/online/courses/${courseId}/analytics`),
    enabled: (opts.enabled ?? true) && !!courseId,
  });
}

// ─── Curriculum ───
export function useCreateModule(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description?: string; order?: number }) =>
      api(`/online/courses/${courseId}/modules`, { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.course(courseId) }),
  });
}

export function useUpdateModule(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, data }: { moduleId: string; data: { title?: string; description?: string; dripDays?: number | null; prerequisiteModuleId?: string | null } }) =>
      api(`/online/modules/${moduleId}`, { method: "PATCH", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.course(courseId) }),
  });
}

export function useDeleteModule(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (moduleId: string) => api<void>(`/online/modules/${moduleId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.course(courseId) }),
  });
}

export function useCreateLesson(moduleId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; type: LessonType; contentUrl?: string; body?: string; duration?: number }) =>
      api(`/online/modules/${moduleId}/lessons`, { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.course(courseId) }),
  });
}

export function useUpdateLesson(lessonId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { title?: string; body?: string; duration?: number; contentUrl?: string; allowDownload?: boolean; isPreview?: boolean }) =>
      api(`/online/lessons/${lessonId}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.course(courseId) }),
  });
}

export function useDeleteLesson(lessonId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/online/lessons/${lessonId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.course(courseId) }),
  });
}

// ─── Enrollment · progress · certificates ───
export function useEnroll(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<Enrollment>(`/online/courses/${courseId}/enroll`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.course(courseId) });
      qc.invalidateQueries({ queryKey: qk.enrollments() });
    },
  });
}

export function useMyEnrollments(opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.enrollments(),
    queryFn: () => api<Paginated<Enrollment>>(`/online/enrollments?limit=50`),
    enabled: opts.enabled ?? true,
  });
}

// Lightweight fire-and-forget save of the video watch position. Does NOT
// invalidate the course query (avoids refetch/re-render on every tick).
export function useSaveWatched() {
  return useMutation({
    mutationFn: ({ lessonId, watchedSec }: { lessonId: string; watchedSec: number }) =>
      api<ProgressResult>(`/online/lessons/${lessonId}/progress`, {
        method: "POST",
        body: { watchedSec },
      }),
  });
}

export function useMarkProgress(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lessonId, completed }: { lessonId: string; completed: boolean }) =>
      api<ProgressResult>(`/online/lessons/${lessonId}/progress`, {
        method: "POST",
        body: { completed },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.course(courseId) });
      qc.invalidateQueries({ queryKey: qk.enrollments() });
      qc.invalidateQueries({ queryKey: qk.certificates() });
      qc.invalidateQueries({ queryKey: qk.activity() });
    },
  });
}

export function useCertificates(opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.certificates(),
    queryFn: () => api<Certificate[]>(`/online/certificates`),
    enabled: opts.enabled ?? true,
  });
}

// ─── Quizzes ───
export function useCourseQuizzes(courseId: string, opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.courseQuizzes(courseId),
    queryFn: () => api<QuizListItem[]>(`/online/courses/${courseId}/quizzes`),
    enabled: (opts.enabled ?? true) && !!courseId,
  });
}

export function useMyPendingQuizzes(opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.pendingQuizzes(),
    queryFn: () => api<QuizListItem[]>(`/online/quizzes/my-pending`),
    enabled: opts.enabled ?? true,
  });
}

export function useQuiz(quizId: string, opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.quiz(quizId),
    queryFn: () => api<Quiz>(`/online/quizzes/${quizId}`),
    enabled: (opts.enabled ?? true) && !!quizId,
  });
}

export function useCreateQuiz(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      description?: string;
      passingScore?: number;
      timeLimit?: number;
      randomize?: boolean;
      poolSize?: number;
      audience?: "ALL" | "STUDENT" | "PUBLIC";
      questions: {
        text: string;
        type: QuestionType;
        points?: number;
        options: { text: string; isCorrect: boolean }[];
      }[];
    }) => api<Quiz>(`/online/courses/${courseId}/quizzes`, { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.courseQuizzes(courseId) });
      qc.invalidateQueries({ queryKey: qk.course(courseId) });
    },
  });
}

export function useSubmitQuiz(quizId: string, courseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (answers: { questionId: string; selectedOptionIds: string[] }[]) =>
      api<SubmitResult>(`/online/quizzes/${quizId}/submit`, { method: "POST", body: { answers } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.myAttempts(quizId) });
      qc.invalidateQueries({ queryKey: qk.pendingQuizzes() });
      qc.invalidateQueries({ queryKey: qk.activity() });
      if (courseId) qc.invalidateQueries({ queryKey: qk.courseQuizzes(courseId) });
    },
  });
}

export function useQuizAttempts(quizId: string, opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.quizAttempts(quizId),
    queryFn: () =>
      api<{
        total: number;
        passRate: number;
        avgScore: number;
        attempts: {
          id: string;
          studentId: string;
          score: number;
          maxScore: number;
          percentage: number;
          passed: boolean;
          submittedAt: string;
        }[];
      }>(`/online/quizzes/${quizId}/attempts`),
    enabled: (opts.enabled ?? true) && !!quizId,
  });
}

// ─── Live Sessions ───
export function useMyLiveSessions(opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.liveSessions(),
    queryFn: () => api<LiveSession[]>(`/online/live-sessions/my`),
    enabled: opts.enabled ?? true,
  });
}

export function useCourseLiveSessions(courseId: string, opts: QOpts = {}) {
  return useQuery({
    queryKey: [...qk.liveSessions(), courseId],
    queryFn: () => api<LiveSession[]>(`/online/courses/${courseId}/live-sessions`),
    enabled: (opts.enabled ?? true) && !!courseId,
  });
}

export function useCreateLiveSession(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description?: string; scheduledAt: string; durationMin?: number; link?: string }) =>
      api<LiveSession>(`/online/courses/${courseId}/live-sessions`, { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.liveSessions() }),
  });
}

export function useUpdateLiveSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, ...patch }: { sessionId: string; title?: string; scheduledAt?: string; durationMin?: number; link?: string; status?: SessionStatus }) =>
      api<LiveSession>(`/online/live-sessions/${sessionId}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.liveSessions() }),
  });
}

export function useDeleteLiveSession(_courseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api<void>(`/online/live-sessions/${sessionId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.liveSessions() }),
  });
}

// ─── Assignments ───
export function useMyPendingAssignments(opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.pendingAssignments(),
    queryFn: () => api<OnlineAssignment[]>(`/online/assignments/my-pending`),
    enabled: opts.enabled ?? true,
  });
}

export function useCourseAssignments(courseId: string, opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.courseAssignments(courseId),
    queryFn: () => api<OnlineAssignment[]>(`/online/courses/${courseId}/assignments`),
    enabled: (opts.enabled ?? true) && !!courseId,
  });
}

export function useCreateAssignment(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description?: string; dueDate: string; maxScore?: number; moduleId?: string; fileUrl?: string; peerReview?: boolean }) =>
      api<OnlineAssignment>(`/online/courses/${courseId}/assignments`, { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.courseAssignments(courseId) }),
  });
}

export function useSubmitAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, ...input }: { assignmentId: string; fileUrl?: string; content?: string }) =>
      api<OnlineSubmission>(`/online/assignments/${assignmentId}/submit`, { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.pendingAssignments() });
      qc.invalidateQueries({ queryKey: qk.activity() });
    },
  });
}

export function useDeleteAssignment(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => api<void>(`/online/assignments/${assignmentId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.courseAssignments(courseId) }),
  });
}

// ─── Activity ───
export function useMyActivity(opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.activity(),
    queryFn: () => api<LearningActivity[]>(`/online/activity?limit=20`),
    enabled: opts.enabled ?? true,
  });
}

export function useWeeklyActivity(opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.weeklyActivity(),
    queryFn: () => api<Record<string, number>>(`/online/activity/weekly`),
    enabled: opts.enabled ?? true,
  });
}

// ─── Learning Paths ───
export function useLearningPaths(opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.paths(),
    queryFn: () => api<LearningPath[]>(`/online/paths`),
    enabled: opts.enabled ?? true,
  });
}

export function usePathsForMe(opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.pathsForMe(),
    queryFn: () => api<LearningPath[]>(`/online/paths/for-me`),
    enabled: opts.enabled ?? true,
  });
}

export function useLearningPath(id: string, opts: QOpts = {}) {
  return useQuery({
    queryKey: qk.path(id),
    queryFn: () => api<LearningPath>(`/online/paths/${id}`),
    enabled: (opts.enabled ?? true) && !!id,
  });
}

export function useCreateLearningPath() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description?: string; thumbnail?: string; courseIds?: string[] }) =>
      api<LearningPath>(`/online/paths`, { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.paths() }),
  });
}

export function useUpdateLearningPath(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { title?: string; description?: string; thumbnail?: string; status?: PathStatus; courseIds?: string[] }) =>
      api<LearningPath>(`/online/paths/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.path(id) });
      qc.invalidateQueries({ queryKey: qk.paths() });
    },
  });
}

export function useDeleteLearningPath() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/online/paths/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.paths() }),
  });
}

// ─── Course & lesson uploads ───────────────────────────────────────────────

export function useUploadCourseThumbnail(courseId: string) {
  const qc = useQueryClient();
  return useMutation<{ url: string; course: CourseCard }, Error, FormData>({
    mutationFn: (fd) => api(`/online/courses/${courseId}/upload-thumbnail`, { method: "POST", body: fd, raw: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.course(courseId) });
      qc.invalidateQueries({ queryKey: ["online", "courses"] });
    },
  });
}

export function useUploadCoursePreview(courseId: string) {
  const qc = useQueryClient();
  return useMutation<{ url: string; course: CourseCard }, Error, FormData>({
    mutationFn: (fd) => api(`/online/courses/${courseId}/upload-preview`, { method: "POST", body: fd, raw: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.course(courseId) }),
  });
}

export function useUploadLessonFile(lessonId: string) {
  const qc = useQueryClient();
  return useMutation<{ url: string; type: string; lesson: CourseLesson }, Error, FormData>({
    mutationFn: (fd) => api(`/online/lessons/${lessonId}/upload`, { method: "POST", body: fd, raw: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["online", "courses"] });
    },
  });
}

// ─── Course enrolled students (teacher view) ───────────────────────────────

export function useCourseStudents(courseId: string) {
  return useQuery({
    queryKey: ["online", "course-students", courseId],
    queryFn: () => api<{
      items: Array<{
        id: string; studentId: string; progress: number; completedAt: string | null;
        createdAt: string;
        student?: { id: string; firstName: string; lastName: string; avatarUrl: string | null; email?: string };
      }>;
      total: number;
    }>(`/online/courses/${courseId}/enrollments`),
    enabled: !!courseId,
  });
}

export type { UseQueryOptions };

export type StudentStats = {
  streak: number;
  progressionGlobale: number;
  todayMinutes: number;
  weekMinutes: number;
  weekGoalMinutes: number;
  pendingAssignments: number;
  pendingQuizzes: number;
  coursesTotal: number;
};

export function useStudentStats(opts: QOpts = {}) {
  return useQuery<StudentStats>({
    queryKey: ["online", "stats"],
    queryFn: () => api("/online/stats"),
    enabled: opts.enabled !== false,
    staleTime: 60_000,
  });
}

export type CertificateDetail = {
  id: string;
  code: string;
  issuedAt: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  studentEmail: string;
  progress: number;
  valid: boolean;
};

export function useVerifyCertificate(code: string, opts: QOpts = {}) {
  return useQuery<CertificateDetail>({
    queryKey: ["online", "certificate", code],
    queryFn: () => api(`/online/certificates/${encodeURIComponent(code)}/verify`),
    enabled: !!code && opts.enabled !== false,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ─────────────────────────────────────────────────────────────
// Reviews & ratings
// ─────────────────────────────────────────────────────────────

export type CourseReview = {
  id: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  repliedAt: string | null;
  isHidden?: boolean;
  createdAt: string;
  student?: TeacherCard;
};

export type RatingSummary = {
  avg: number;
  count: number;
  distribution: Record<string, number>;
};

export type ReviewsPage = {
  items: CourseReview[];
  total: number;
  page: number;
  limit: number;
  summary: RatingSummary;
};

export function useCourseReviews(courseId: string, opts: QOpts = {}) {
  return useQuery<ReviewsPage>({
    queryKey: ["online", "course", courseId, "reviews"],
    queryFn: () => api(`/online/courses/${courseId}/reviews`),
    enabled: !!courseId && opts.enabled !== false,
  });
}

export function useUpsertReview(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { rating: number; comment?: string }) =>
      api<CourseReview>(`/online/courses/${courseId}/reviews/mine`, { method: "PUT", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["online", "course", courseId] });
      qc.invalidateQueries({ queryKey: ["online", "courses"] });
    },
  });
}

export function useDeleteMyReview(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/online/courses/${courseId}/reviews/mine`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["online", "course", courseId] });
      qc.invalidateQueries({ queryKey: ["online", "courses"] });
    },
  });
}

export function useReplyToReview(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, reply }: { reviewId: string; reply: string }) =>
      api<CourseReview>(`/online/reviews/${reviewId}/reply`, { method: "POST", body: { reply } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "course", courseId, "reviews"] }),
  });
}

export function useSetReviewHidden(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, isHidden }: { reviewId: string; isHidden: boolean }) =>
      api<CourseReview>(`/online/reviews/${reviewId}/hidden`, { method: "PATCH", body: { isHidden } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "course", courseId, "reviews"] }),
  });
}

// ─────────────────────────────────────────────────────────────
// Q&A forum
// ─────────────────────────────────────────────────────────────

export type QaAnswer = {
  id: string;
  questionId: string;
  body: string;
  isInstructor: boolean;
  isAccepted: boolean;
  upvotes: string[];
  createdAt: string;
  author: TeacherCard;
};

export type QaQuestion = {
  id: string;
  courseId: string;
  lessonId: string | null;
  title: string;
  body: string;
  resolved: boolean;
  upvotes: string[];
  createdAt: string;
  author: TeacherCard;
  lesson: { id: string; title: string } | null;
  _count: { answers: number };
  answers?: QaAnswer[];
};

export type QaQuestionsPage = { items: QaQuestion[]; total: number; page: number; limit: number };

export function useCourseQuestions(courseId: string, params: { lessonId?: string; resolved?: boolean } = {}, opts: QOpts = {}) {
  const qs = new URLSearchParams();
  if (params.lessonId) qs.set("lessonId", params.lessonId);
  if (params.resolved !== undefined) qs.set("resolved", String(params.resolved));
  const suffix = qs.toString() ? `?${qs}` : "";
  return useQuery<QaQuestionsPage>({
    queryKey: ["online", "course", courseId, "questions", params],
    queryFn: () => api(`/online/courses/${courseId}/questions${suffix}`),
    enabled: !!courseId && opts.enabled !== false,
  });
}

export function useQuestion(questionId: string, opts: QOpts = {}) {
  return useQuery<QaQuestion>({
    queryKey: ["online", "question", questionId],
    queryFn: () => api(`/online/questions/${questionId}`),
    enabled: !!questionId && opts.enabled !== false,
  });
}

export function useCreateQuestion(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; body: string; lessonId?: string }) =>
      api<QaQuestion>(`/online/courses/${courseId}/questions`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "course", courseId, "questions"] }),
  });
}

export function useDeleteQuestion(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => api(`/online/questions/${questionId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "course", courseId, "questions"] }),
  });
}

export function useCreateAnswer(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, body }: { questionId: string; body: string }) =>
      api<QaAnswer>(`/online/questions/${questionId}/answers`, { method: "POST", body: { body } }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["online", "question", vars.questionId] });
      qc.invalidateQueries({ queryKey: ["online", "course", courseId, "questions"] });
    },
  });
}

export function useDeleteAnswer(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ answerId }: { answerId: string; questionId: string }) =>
      api(`/online/answers/${answerId}`, { method: "DELETE" }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["online", "question", vars.questionId] });
      qc.invalidateQueries({ queryKey: ["online", "course", courseId, "questions"] });
    },
  });
}

export function useUpvoteQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) =>
      api<{ upvotes: string[]; upvoted: boolean }>(`/online/questions/${questionId}/upvote`, { method: "POST" }),
    onSuccess: (_data, questionId) => qc.invalidateQueries({ queryKey: ["online", "question", questionId] }),
  });
}

export function useUpvoteAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ answerId }: { answerId: string; questionId: string }) =>
      api<{ upvotes: string[]; upvoted: boolean }>(`/online/answers/${answerId}/upvote`, { method: "POST" }),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["online", "question", vars.questionId] }),
  });
}

export function useAcceptAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ answerId }: { answerId: string; questionId: string }) =>
      api<QaQuestion>(`/online/answers/${answerId}/accept`, { method: "POST" }),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["online", "question", vars.questionId] }),
  });
}

export function useSetQuestionResolved(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, resolved }: { questionId: string; resolved: boolean }) =>
      api<QaQuestion>(`/online/questions/${questionId}/resolved`, { method: "PATCH", body: { resolved } }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["online", "question", vars.questionId] });
      qc.invalidateQueries({ queryKey: ["online", "course", courseId, "questions"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Lesson notes & bookmarks
// ─────────────────────────────────────────────────────────────

export type LessonNote = {
  id: string;
  courseId: string;
  lessonId: string;
  body: string;
  timestamp: number | null;
  isBookmark: boolean;
  createdAt: string;
  updatedAt: string;
  lesson?: { id: string; title: string };
  course?: { id: string; title: string };
};

export function useLessonNotes(params: { courseId?: string; lessonId?: string; bookmarksOnly?: boolean } = {}, opts: QOpts = {}) {
  const qs = new URLSearchParams();
  if (params.courseId) qs.set("courseId", params.courseId);
  if (params.lessonId) qs.set("lessonId", params.lessonId);
  if (params.bookmarksOnly) qs.set("bookmarksOnly", "true");
  const suffix = qs.toString() ? `?${qs}` : "";
  return useQuery<LessonNote[]>({
    queryKey: ["online", "notes", params],
    queryFn: () => api(`/online/notes${suffix}`),
    enabled: opts.enabled !== false,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { courseId: string; lessonId: string; body?: string; timestamp?: number | null; isBookmark?: boolean }) =>
      api<LessonNote>(`/online/notes`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "notes"] }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; body?: string; timestamp?: number | null }) =>
      api<LessonNote>(`/online/notes/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "notes"] }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/online/notes/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "notes"] }),
  });
}

// ─────────────────────────────────────────────────────────────
// Course announcements
// ─────────────────────────────────────────────────────────────

export type CourseAnnouncement = {
  id: string;
  courseId: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export function useCourseAnnouncements(courseId: string, opts: QOpts = {}) {
  return useQuery<CourseAnnouncement[]>({
    queryKey: ["online", "course", courseId, "announcements"],
    queryFn: () => api(`/online/courses/${courseId}/announcements`),
    enabled: !!courseId && opts.enabled !== false,
  });
}

export function useCreateAnnouncement(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; body: string; isPinned?: boolean }) =>
      api<CourseAnnouncement>(`/online/courses/${courseId}/announcements`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "course", courseId, "announcements"] }),
  });
}

export function useUpdateAnnouncement(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; title?: string; body?: string; isPinned?: boolean }) =>
      api<CourseAnnouncement>(`/online/announcements/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "course", courseId, "announcements"] }),
  });
}

export function useDeleteAnnouncement(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/online/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "course", courseId, "announcements"] }),
  });
}

// ─────────────────────────────────────────────────────────────
// Gamification
// ─────────────────────────────────────────────────────────────

export type GamificationBadge = { id: string; label: string; icon: string; desc: string; earned: boolean };
export type GamificationMe = {
  points: number;
  level: number;
  label: string;
  nextLevelAt: number | null;
  progressToNext: number;
  streak: number;
  stats: Record<string, number>;
  badges: GamificationBadge[];
};
export type LeaderboardRow = {
  rank: number;
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  points: number;
  level: number;
  label: string;
  certificates: number;
  coursesCompleted: number;
};

export function useMyGamification(opts: QOpts = {}) {
  return useQuery<GamificationMe>({
    queryKey: ["online", "gamification", "me"],
    queryFn: () => api("/online/gamification/me"),
    enabled: opts.enabled !== false,
    staleTime: 60_000,
  });
}

export function useLeaderboard(opts: QOpts = {}) {
  return useQuery<LeaderboardRow[]>({
    queryKey: ["online", "gamification", "leaderboard"],
    queryFn: () => api("/online/gamification/leaderboard"),
    enabled: opts.enabled !== false,
    staleTime: 5 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────
// Wishlist (favoris)
// ─────────────────────────────────────────────────────────────

export function useWishlist(opts: QOpts = {}) {
  return useQuery<CourseCard[]>({
    queryKey: ["online", "wishlist"],
    queryFn: () => api("/online/wishlist"),
    enabled: opts.enabled !== false,
  });
}

export function useWishlistIds(opts: QOpts = {}) {
  return useQuery<string[]>({
    queryKey: ["online", "wishlist", "ids"],
    queryFn: () => api("/online/wishlist/ids"),
    enabled: opts.enabled !== false,
    staleTime: 60_000,
  });
}

export function useToggleWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) =>
      api<{ inWishlist: boolean }>(`/online/wishlist/${courseId}/toggle`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["online", "wishlist"] });
    },
  });
}


// ─────────────────────────────────────────────────────────────
// Recommendations, instructor pages, peer review
// ─────────────────────────────────────────────────────────────

export function useRecommendations(opts: QOpts = {}) {
  return useQuery<CourseCard[]>({
    queryKey: ["online", "recommendations"],
    queryFn: () => api("/online/recommendations"),
    enabled: opts.enabled !== false,
    staleTime: 5 * 60 * 1000,
  });
}

export type InstructorProfile = {
  teacher: { id: string; firstName: string; lastName: string; avatarUrl: string | null; createdAt: string };
  stats: { courses: number; students: number; avgRating: number; reviews: number };
  courses: CourseCard[];
};

export function useInstructorProfile(id: string, opts: QOpts = {}) {
  return useQuery<InstructorProfile>({
    queryKey: ["online", "instructor", id],
    queryFn: () => api(`/online/public/instructors/${id}`, { auth: false }),
    enabled: !!id && opts.enabled !== false,
    staleTime: 60_000,
  });
}

export type PeerQueueItem = { id: string; content: string | null; fileUrl: string | null; submittedAt: string };
export type PeerFeedback = {
  reviews: { score: number; comment: string | null; createdAt: string }[];
  avg: number | null;
  maxScore?: number;
};

export function usePeerQueue(assignmentId: string, opts: QOpts = {}) {
  return useQuery<{ items: PeerQueueItem[]; reviewedCount: number }>({
    queryKey: ["online", "assignment", assignmentId, "peer-queue"],
    queryFn: () => api(`/online/assignments/${assignmentId}/peer-queue`),
    enabled: !!assignmentId && opts.enabled !== false,
    retry: false,
  });
}

export function usePeerFeedback(assignmentId: string, opts: QOpts = {}) {
  return useQuery<PeerFeedback>({
    queryKey: ["online", "assignment", assignmentId, "peer-feedback"],
    queryFn: () => api(`/online/assignments/${assignmentId}/peer-feedback`),
    enabled: !!assignmentId && opts.enabled !== false,
  });
}

export function useSubmitPeerReview(assignmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, score, comment }: { submissionId: string; score: number; comment?: string }) =>
      api(`/online/submissions/${submissionId}/peer-review`, { method: "POST", body: { score, comment } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "assignment", assignmentId] }),
  });
}
