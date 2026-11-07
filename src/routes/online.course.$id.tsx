import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play, FileText, CheckCircle2, Lock, ArrowLeft, Loader2, FileQuestion,
  Circle, GraduationCap, MessageSquare, Calendar, ClipboardList, Send,
  ExternalLink, Volume2, Image, Archive, FileDown, ChevronDown, ChevronRight,
  ChevronLeft, Film, BookOpen, Folder, Crown,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCourse, usePublicCourse, useEnroll, useMarkProgress, useSaveWatched,
  useCourseAssignments, useCourseLiveSessions, useSubmitAssignment,
  usePeerQueue, usePeerFeedback, useSubmitPeerReview,
  type CourseDetail, type CourseModule, type CourseLesson, type LessonFile,
  type OnlineAssignment, type LiveSession,
} from "@/lib/online";
import { useOpenCourseRoom } from "@/lib/chat";
import { ApiError } from "@/lib/api";
import { Modal, ProgressBar, OnlineNavbar, isHybridUser } from "@/components/online/shared";
import { useAuth } from "@/lib/auth";
import { BackHomeButtons } from "@/components/nav-buttons";
import { CourseLanding } from "@/components/online/course-landing";
import { ReviewsSection, QASection, NotesPanel, Stars, AnnouncementsSection } from "@/components/online/engagement";
import { QuizRunner } from "@/components/online/quiz-runner";
import { CodeSandbox } from "@/components/online/code-sandbox";
import { PaymentModal } from "@/components/online/payment-modal";
import { CoursePacks } from "@/components/online/course-packs";
import { useMyPayments } from "@/lib/payments";
import {
  ProtectedArea, ProtectedNotice, ProtectedPdf, UnviewableDocument, useProtectedContent,
} from "@/components/online/protected-content";
import { cursusPlace } from "@/lib/cursus";

export const Route = createFileRoute("/online/course/$id")({
  component: Course,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:4000";
function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

function mimeToType(mime: string): LessonFile["mimeType"] extends string ? CourseLesson["type"] : never {
  if (mime.startsWith("video/")) return "VIDEO" as any;
  if (mime === "application/pdf") return "PDF" as any;
  if (mime.startsWith("audio/")) return "AUDIO" as any;
  if (mime.startsWith("image/")) return "IMAGE" as any;
  if (mime.includes("zip") || mime.includes("rar")) return "ZIP" as any;
  return "DOCUMENT" as any;
}

function durationLabel(l: CourseLesson): string {
  if (!l.duration) return "";
  const m = Math.floor(l.duration / 60);
  const s = l.duration % 60;
  return s > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${m} min`;
}

function moduleDurationLabel(m: CourseModule): string {
  const totalSec = m.lessons.reduce((s, l) => s + (l.duration ?? 0), 0);
  const mins = Math.floor(totalSec / 60);
  if (mins <= 0) return "";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

// Lecteur intégré pour les liens vidéo connus (YouTube, Vimeo, Google Drive).
function embedUrl(url: string): string | null {
  const yt = youtubeEmbed(url);
  if (yt) return yt;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

// ─── Lesson type config ───────────────────────────────────────────────────────

type TypeConfig = { icon: React.ElementType; label: string; color: string; bg: string };

const TYPE_CFG: Record<string, TypeConfig> = {
  VIDEO:    { icon: Film,     label: "Vidéo",    color: "text-blue-500",   bg: "bg-blue-500/10" },
  PDF:      { icon: FileText, label: "PDF",      color: "text-red-500",    bg: "bg-red-500/10" },
  TEXT:     { icon: BookOpen, label: "Texte",    color: "text-green-600",  bg: "bg-green-500/10" },
  AUDIO:    { icon: Volume2,  label: "Audio",    color: "text-purple-500", bg: "bg-purple-500/10" },
  IMAGE:    { icon: Image,    label: "Image",    color: "text-amber-500",  bg: "bg-amber-500/10" },
  ZIP:      { icon: Archive,  label: "Archive",  color: "text-orange-500", bg: "bg-orange-500/10" },
  FILE:     { icon: FileDown, label: "Fichier",  color: "text-slate-500",  bg: "bg-slate-500/10" },
  DOCUMENT: { icon: FileText, label: "Document", color: "text-indigo-500", bg: "bg-indigo-500/10" },
  CODE:     { icon: BookOpen, label: "Code",     color: "text-emerald-500", bg: "bg-emerald-500/10" },
  LINK:     { icon: ExternalLink, label: "Lien",   color: "text-sky-600",    bg: "bg-sky-500/10" },
};

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CFG[type] ?? TYPE_CFG.DOCUMENT;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${cfg.color} ${cfg.bg}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function LessonTypeIcon({ type, active, className = "" }: { type: string; active?: boolean; className?: string }) {
  const cfg = TYPE_CFG[type] ?? TYPE_CFG.DOCUMENT;
  const Icon = cfg.icon;
  return <Icon className={`${active ? "text-online" : cfg.color} ${className}`} />;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const noop = () => {};

function Course() {
  const { id } = Route.useParams();
  const { user, ready } = useAuth();
  // Visiteur (ou compte sans accès à la plateforme en ligne) : présentation publique du cours.
  const onlineUser = !!user && (user.system === "ONLINE" || isHybridUser(user) || user.systemRole === "SUPER_ADMIN");
  const course = useCourse(id, { enabled: ready && onlineUser });
  const publicCourse = usePublicCourse(id, { enabled: ready && !onlineUser });

  if (!ready || (!onlineUser && publicCourse.isLoading)) return (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
  if (!onlineUser) {
    if (!publicCourse.data) return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <p className="text-muted-foreground">Ce cours n'existe pas ou n'est plus publié.</p>
          <Link to="/online" className="mt-3 inline-block text-sm font-medium text-online hover:underline">← Catalogue</Link>
        </div>
      </div>
    );
    return (
      <>
        <OnlineNavbar />
        <CourseLanding
          course={publicCourse.data}
          actions={{ guest: true, pending: false, hasPendingPayment: false, onEnroll: noop, onPay: noop, onPreview: noop }}
        />
      </>
    );
  }
  if (course.isLoading) return (
    <div className="grid min-h-screen place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (course.isError || !course.data) return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <p className="text-muted-foreground">Ce cours ne peut pas être chargé.</p>
        <Link to="/online" className="mt-3 inline-block text-sm font-medium text-online hover:underline">
          ← Catalogue
        </Link>
      </div>
    </div>
  );

  return <CourseView course={course.data} />;
}

// ─── Course view ──────────────────────────────────────────────────────────────

function CourseView({ course }: { course: CourseDetail }) {
  const navigate = useNavigate();
  const enroll = useEnroll(course.id);
  const markProgress = useMarkProgress(course.id);
  const openRoom = useOpenCourseRoom();
  const submitAssignment = useSubmitAssignment();
  const assignments = useCourseAssignments(course.id, { enabled: course.enrolled || course.isOwner });
  const liveSessions = useCourseLiveSessions(course.id, { enabled: course.enrolled || course.isOwner });
  const myPayments = useMyPayments();

  const [showPayment, setShowPayment] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<{ id: string; title: string } | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<OnlineAssignment | null>(null);
  const [submitContent, setSubmitContent] = useState("");

  const isPaid = (course.price ?? 0) > 0;
  const hasPendingPayment = myPayments.data?.some(
    (p) => p.courseId === course.id && p.status === "PENDING"
  ) ?? false;

  const lessons = useMemo(() => course.modules.flatMap((m) => m.lessons), [course.modules]);
  const unlocked = course.enrolled || course.isOwner;
  // Pas encore inscrit : page de présentation (MOOC), puis lecteur pour l'aperçu.
  const [mode, setMode] = useState<"landing" | "player">(unlocked ? "player" : "landing");
  useEffect(() => { if (unlocked) setMode("player"); }, [unlocked]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedId && lessons.some((l) => l.id === selectedId)) return;
    // Enrolled/owner: first unfinished (or first) lesson. Anonymous: first
    // free-preview lesson so the preview is visible without hunting for it.
    const first = unlocked
      ? (lessons.find((l) => !l.completed) ?? lessons[0])
      : lessons.find((l) => !l.locked);
    setSelectedId(first?.id ?? null);
  }, [lessons, selectedId, unlocked]);

  const selected = lessons.find((l) => l.id === selectedId) ?? null;
  const previewSelected = !unlocked && selected != null && !selected.locked;
  const selectedIdx = lessons.findIndex((l) => l.id === selectedId);
  const prevLesson = selectedIdx > 0 ? lessons[selectedIdx - 1] : null;
  const nextLesson = selectedIdx >= 0 && selectedIdx < lessons.length - 1 ? lessons[selectedIdx + 1] : null;

  async function onEnroll() {
    try {
      await enroll.mutateAsync();
      toast.success("Inscrit ! Contenu déverrouillé.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Échec de l'inscription");
    }
  }

  async function toggleComplete(lesson: CourseLesson) {
    try {
      const res = await markProgress.mutateAsync({ lessonId: lesson.id, completed: !lesson.completed });
      if (res.certificate) {
        toast.success(course.credentialType === "ATTESTATION" ? "🎓 Cours terminé — attestation débloquée !" : "🎓 Cours terminé — certificat débloqué !");
      } else if (res.completed && course.cursus) {
        toast.success("✅ Cours terminé à 100 % — il compte pour débloquer le mois suivant.");
      } else if (!lesson.completed) {
        toast.success(`Leçon terminée · ${Math.round(res.progress)}%`);
        if (nextLesson && !nextLesson.locked) setSelectedId(nextLesson.id);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Impossible de mettre à jour la progression");
    }
  }

  async function openClassChat() {
    try {
      const room = await openRoom.mutateAsync(course.id);
      navigate({ to: "/online/chat", search: { room: room.id } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Impossible d'ouvrir le chat");
    }
  }

  // Cours du cursus : consultation en ligne uniquement (filigrane, pas de téléchargement).
  const protectedMode = Boolean(course.protectedContent) && !course.isOwner;
  const cursusLocked = Boolean(course.cursus && !course.cursus.accessible);

  if (!unlocked && mode === "landing") {
    return (
      <>
        <OnlineNavbar />
        <CourseLanding
          course={course}
          actions={{
            guest: false,
            pending: enroll.isPending,
            hasPendingPayment,
            onEnroll,
            onPay: () => setShowPayment(true),
            onPreview: (lessonId) => { setSelectedId(lessonId); setMode("player"); window.scrollTo(0, 0); },
          }}
        />
        {showPayment && (
          <PaymentModal
            courseId={course.id}
            courseTitle={course.title}
            price={course.price ?? 0}
            onClose={() => setShowPayment(false)}
            onSuccess={() => setShowPayment(false)}
          />
        )}
      </>
    );
  }

  return (
    <ProtectedArea enabled={protectedMode && unlocked}>
    <div className="flex min-h-screen flex-col bg-background">

      {/* ── Top header ── */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center gap-3 px-4">
          <BackHomeButtons home="/online" homeLabel="Catalogue" />
          <div className="h-4 w-px bg-border" />
          <div className="min-w-0 flex-1 truncate text-sm font-semibold">{course.title}</div>
          {!unlocked && (
            <button onClick={() => setMode("landing")} className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent">
              Présentation du cours
            </button>
          )}
          {course.ratingCount > 0 && (
            <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
              <Stars value={course.ratingAvg} size={14} />
              <span className="text-xs font-medium">{course.ratingAvg.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({course.ratingCount})</span>
            </div>
          )}
          {course.enrolled && (
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <div className="w-28">
                <ProgressBar value={course.progress} />
              </div>
              <span className="text-xs text-muted-foreground">{Math.round(course.progress)}%</span>
            </div>
          )}
          {unlocked && (
            <button
              onClick={openClassChat}
              disabled={openRoom.isPending}
              className="hidden shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-60 sm:flex"
            >
              {openRoom.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <MessageSquare className="h-3.5 w-3.5" />}
              Chat
            </button>
          )}
        </div>
      </header>

      {protectedMode && unlocked && <ProtectedNotice />}

      {/* ── Body: content + sidebar ── */}
      <div className="mx-auto grid w-full max-w-screen-xl flex-1 md:grid-cols-[1fr_390px]">

        {/* Left: lesson content */}
        <div className="min-w-0 border-r">
          {unlocked ? (
            selected ? (
              <ContentPanel
                lesson={selected}
                lessons={lessons}
                modules={course.modules}
                courseTitle={course.title}
                courseId={course.id}
                canNote={course.enrolled}
                selectedIdx={selectedIdx}
                prevLesson={prevLesson}
                nextLesson={nextLesson}
                markPending={markProgress.isPending}
                onToggleComplete={() => toggleComplete(selected)}
                onNavigate={setSelectedId}
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Ce cours n'a pas encore de leçons.
              </div>
            )
          ) : previewSelected && selected ? (
            <div>
              {/* Free-preview banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-emerald-500/10 px-5 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  <Play className="h-4 w-4" /> Aperçu gratuit — inscrivez-vous pour débloquer tout le cours
                </div>
                <button
                  onClick={() => (isPaid ? setShowPayment(true) : onEnroll())}
                  disabled={enroll.isPending}
                  className="rounded-lg grad-online px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {isPaid ? "S'inscrire" : "S'inscrire gratuitement"}
                </button>
              </div>
              <ContentPanel
                lesson={selected}
                lessons={lessons}
                modules={course.modules}
                courseTitle={course.title}
                courseId={course.id}
                canNote={false}
                preview
                selectedIdx={selectedIdx}
                prevLesson={prevLesson}
                nextLesson={nextLesson}
                markPending={false}
                onToggleComplete={() => {}}
                onNavigate={setSelectedId}
              />
            </div>
          ) : (
            <div className="p-6">
              {cursusLocked ? <CursusLockPanel course={course} /> : <EnrollPanel
                course={course}
                onEnroll={onEnroll}
                pending={enroll.isPending}
                isPaid={isPaid}
                hasPendingPayment={hasPendingPayment}
                onPay={() => setShowPayment(true)}
              />}
            </div>
          )}

          {course.completedAt && (
            <div className="mx-6 mb-6 flex items-center gap-3 rounded-2xl border border-success/40 bg-success/10 p-4 text-sm">
              <GraduationCap className="h-5 w-5 shrink-0 text-success" />
              <span>Cours terminé. Votre certificat est dans votre tableau de bord.</span>
            </div>
          )}

          {/* ── Announcements + Q&A forum + reviews (course-level) ── */}
          {(course.enrolled || course.isOwner) && (
            <AnnouncementsSection course={course} />
          )}
          {(course.enrolled || course.isOwner) && (
            <QASection course={course} lessons={lessons} />
          )}
          <ReviewsSection course={course} />
        </div>

        {/* Right: curriculum sidebar */}
        <aside className="flex flex-col gap-4 p-4 md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] md:overflow-y-auto">

          {/* Mobile chat */}
          {unlocked && (
            <button onClick={openClassChat} disabled={openRoom.isPending}
              className="flex items-center justify-center gap-2 rounded-xl border bg-card p-3 text-sm font-medium hover:bg-accent disabled:opacity-60 sm:hidden">
              {openRoom.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              Chat de classe
            </button>
          )}

          {/* Curriculum tree */}
          <CurriculumSidebar
            course={course}
            selectedId={selectedId}
            unlocked={unlocked}
            onSelect={setSelectedId}
          />

          {/* Quizzes */}
          {course.quizzes.length > 0 && (
            <div className="rounded-2xl border bg-card shadow-elegant overflow-hidden">
              <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 text-sm font-semibold">
                <FileQuestion className="h-4 w-4 text-warning" /> Quiz ({course.quizzes.length})
              </div>
              <div className="divide-y">
                {course.quizzes.map((quiz) => (
                  <div key={quiz.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-sm">{quiz.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {quiz.questionCount} questions · réussite {quiz.passingScore}%
                      </div>
                    </div>
                    <button
                      disabled={!course.enrolled}
                      onClick={() => setActiveQuiz({ id: quiz.id, title: quiz.title })}
                      className="shrink-0 rounded-lg grad-online px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      title={course.enrolled ? undefined : "Inscrivez-vous pour accéder aux quiz"}
                    >
                      Passer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live sessions */}
          {(course.enrolled || course.isOwner) && (
            <LiveSessionsCard liveSessions={liveSessions} />
          )}

          {/* Assignments */}
          {course.enrolled && (
            <AssignmentsCard
              assignments={assignments}
              onSubmit={(a) => { setActiveAssignment(a); setSubmitContent(""); }}
            />
          )}
        </aside>
      </div>

      {/* Quiz modal */}
      <Modal open={!!activeQuiz} onClose={() => setActiveQuiz(null)} title={activeQuiz?.title ?? "Quiz"} wide>
        {activeQuiz && <QuizRunner quizId={activeQuiz.id} courseId={course.id} />}
      </Modal>

      {/* Assignment submit modal */}
      <Modal
        open={!!activeAssignment}
        onClose={() => setActiveAssignment(null)}
        title={activeAssignment?.title ?? "Rendre le devoir"}
      >
        {activeAssignment && (
          <div className="space-y-4">
            {activeAssignment.description && (
              <p className="text-sm text-muted-foreground">{activeAssignment.description}</p>
            )}
            {(activeAssignment.attachments ?? []).length > 0 && (
              <div className="space-y-1.5 rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground">Fichiers de l'exercice</p>
                {(activeAssignment.attachments ?? []).map((f) => (
                  <a key={f.url} href={mediaUrl(f.url)} target="_blank" rel="noreferrer" download={f.name}
                    className="flex items-center gap-2 text-sm text-online hover:underline">
                    <FileDown className="h-4 w-4 shrink-0" /> {f.name}
                  </a>
                ))}
              </div>
            )}
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Rendu avant : {new Date(activeAssignment.dueDate).toLocaleString("fr-FR")} · {activeAssignment.maxScore} pts max
            </div>
            <textarea
              rows={5}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Écrivez votre réponse ou collez un lien vers votre travail…"
              value={submitContent}
              onChange={(e) => setSubmitContent(e.target.value)}
            />
            <button
              disabled={!submitContent.trim() || submitAssignment.isPending}
              onClick={async () => {
                try {
                  const res = await submitAssignment.mutateAsync({
                    assignmentId: activeAssignment.id,
                    content: submitContent.trim(),
                  });
                  if ((res as { certificate?: unknown }).certificate) {
                    toast.success("🎓 Cours terminé — certificat débloqué !");
                  } else {
                    toast.success("Devoir rendu !");
                  }
                  setActiveAssignment(null);
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : "Échec de la soumission");
                }
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-online px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitAssignment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Rendre le devoir
            </button>
          </div>
        )}
      </Modal>

      {/* Payment modal */}
      {showPayment && (
        <PaymentModal
          courseId={course.id}
          courseTitle={course.title}
          price={course.price ?? 0}
          onClose={() => setShowPayment(false)}
          onSuccess={() => setShowPayment(false)}
        />
      )}
    </div>
    </ProtectedArea>
  );
}

// ─── Content panel (left) ─────────────────────────────────────────────────────

function ContentPanel({
  lesson, lessons, modules, courseTitle, courseId, canNote, preview = false, selectedIdx, prevLesson, nextLesson,
  markPending, onToggleComplete, onNavigate,
}: {
  lesson: CourseLesson;
  lessons: CourseLesson[];
  modules: CourseModule[];
  courseTitle: string;
  courseId: string;
  canNote: boolean;
  preview?: boolean;
  selectedIdx: number;
  prevLesson: CourseLesson | null;
  nextLesson: CourseLesson | null;
  markPending: boolean;
  onToggleComplete: () => void;
  onNavigate: (id: string) => void;
}) {
  return (
    <div className="flex flex-col">

      {/* ── Lecteur du module : onglets Word / Vidéo / Autre ── */}
      <ModuleReader lesson={lesson} modules={modules} courseTitle={courseTitle} onNavigate={onNavigate} />

      {/* ── Lesson info ── */}
      <div className="p-5 md:p-8">

        {/* Header row: badges + title + mark-complete */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <TypeBadge type={lesson.type} />
              {lesson.duration ? (
                <span className="text-xs text-muted-foreground">🕐 {durationLabel(lesson)}</span>
              ) : null}
              {lesson.completed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3 w-3" /> Terminée
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight leading-snug">{lesson.title}</h1>
          </div>

          {!preview && (
            <button
              onClick={onToggleComplete}
              disabled={markPending}
              className={`shrink-0 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
                lesson.completed
                  ? "border bg-background text-foreground hover:bg-accent"
                  : "grad-online text-white"
              }`}
            >
              {markPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : lesson.completed
                ? <CheckCircle2 className="h-4 w-4" />
                : <Circle className="h-4 w-4" />}
              {lesson.completed ? "Terminée" : "Marquer terminée"}
            </button>
          )}
        </div>

        {/* Body text (CODE lessons carry their starter code in body — already in the sandbox) */}
        {lesson.body && lesson.type !== "CODE" && lesson.type !== "TEXT" && (
          <div className="mt-6 rounded-xl border bg-muted/20 p-5">
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {lesson.body}
            </div>
          </div>
        )}

        {/* ── Notes & bookmarks for this lesson ── */}
        {canNote && (
          <div className="mt-6">
            <NotesPanel courseId={courseId} lessonId={lesson.id} />
          </div>
        )}

        {/* ── Navigation prev / next ── */}
        <div className="mt-8 flex items-center justify-between gap-3 border-t pt-6">
          {/* Prev */}
          <div>
            {prevLesson ? (
              <button
                onClick={() => onNavigate(prevLesson.id)}
                className="group flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition hover:bg-accent"
              >
                <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                <span className="hidden sm:block text-left">
                  <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Précédente</span>
                  <span className="line-clamp-1 max-w-[140px] text-xs font-medium">{prevLesson.title}</span>
                </span>
                <span className="text-xs sm:hidden">Précédente</span>
              </button>
            ) : <div />}
          </div>

          {/* Counter */}
          <span className="shrink-0 text-xs text-muted-foreground">
            {selectedIdx + 1} / {lessons.length}
          </span>

          {/* Next */}
          <div>
            {nextLesson ? (
              <button
                onClick={() => onNavigate(nextLesson.id)}
                className="group flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition hover:bg-accent"
              >
                <span className="hidden sm:block text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Suivante</span>
                  <span className="line-clamp-1 max-w-[140px] text-xs font-medium">{nextLesson.title}</span>
                </span>
                <span className="text-xs sm:hidden">Suivante</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
              </button>
            ) : (
              /* Last lesson: show finish CTA */
              !lesson.completed && (
                <button
                  onClick={onToggleComplete}
                  disabled={markPending}
                  className="flex items-center gap-2 rounded-xl grad-online px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Terminer le cours
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Curriculum sidebar ───────────────────────────────────────────────────────

function CurriculumSidebar({
  course, selectedId, unlocked, onSelect,
}: {
  course: CourseDetail;
  selectedId: string | null;
  unlocked: boolean;
  onSelect: (id: string) => void;
}) {
  const activeModuleId = useMemo(() => {
    for (const m of course.modules) {
      if (m.lessons.some((l) => l.id === selectedId)) return m.id;
    }
    return course.modules[0]?.id ?? null;
  }, [course.modules, selectedId]);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (activeModuleId) s.add(activeModuleId);
    return s;
  });

  useEffect(() => {
    if (activeModuleId) {
      setExpanded((prev) => {
        if (prev.has(activeModuleId)) return prev;
        const next = new Set(prev);
        next.add(activeModuleId);
        return next;
      });
    }
  }, [activeModuleId]);

  const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);
  const doneLessons = course.modules.reduce(
    (s, m) => s + m.lessons.filter((l) => l.completed).length, 0
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant">
      {/* Header */}
      <div className="border-b bg-muted/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Contenu du cours</span>
          <span className="text-xs text-muted-foreground">{doneLessons}/{totalLessons} leçons</span>
        </div>
        {course.enrolled && totalLessons > 0 && (
          <div className="mt-2">
            <ProgressBar value={course.progress} />
          </div>
        )}
      </div>

      {/* Module accordion */}
      <div className="divide-y">
        {course.modules.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">Aucun module pour l'instant.</p>
        )}
        {course.modules.map((m, idx) => {
          const isOpen = expanded.has(m.id);
          const modDone = m.lessons.filter((l) => l.completed).length;
          const modTotal = m.lessons.length;
          const modPct = modTotal > 0 ? Math.round((modDone / modTotal) * 100) : 0;
          const dur = moduleDurationLabel(m);
          const allDone = modTotal > 0 && modDone === modTotal;

          return (
            <div key={m.id}>
              {/* Module header */}
              <button
                onClick={() => toggle(m.id)}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition"
              >
                <Folder className={`mt-0.5 h-4 w-4 shrink-0 ${allDone ? "text-success" : "text-muted-foreground"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Module {idx + 1}
                    </span>
                    {allDone && <CheckCircle2 className="h-3 w-3 text-success" />}
                  </div>
                  <p className="mt-0.5 text-sm font-semibold leading-snug">{m.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>{modTotal} leçon{modTotal !== 1 ? "s" : ""}</span>
                    {dur && <span>· {dur}</span>}
                    {course.enrolled && modTotal > 0 && (
                      <span>· {modPct}% terminé</span>
                    )}
                  </div>
                  {course.enrolled && modTotal > 0 && (
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-online transition-all duration-500"
                        style={{ width: `${modPct}%` }}
                      />
                    </div>
                  )}
                  {m.locked && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      <Lock className="h-3 w-3 shrink-0" />
                      {m.lockReason === "drip" && m.availableAt
                        ? `Disponible le ${new Date(m.availableAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`
                        : m.lockReason === "prerequisite"
                        ? `Terminez « ${m.prerequisiteTitle ?? "le module précédent"} » d'abord`
                        : "Verrouillé"}
                    </div>
                  )}
                </div>
                {isOpen
                  ? <ChevronDown className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  : <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                }
              </button>

              {/* Lesson list */}
              {isOpen && (
                <ul className="border-t bg-background/60">
                  {m.lessons.length === 0 && (
                    <li className="px-10 py-3 text-xs text-muted-foreground">Aucune leçon</li>
                  )}
                  {m.lessons.map((l) => {
                    const active = l.id === selectedId;
                    // Backend already resolves `locked` (drip / prerequisite /
                    // enrollment). Free-preview lessons come back unlocked.
                    const clickable = !l.locked;

                    return (
                      <li key={l.id} className="border-b last:border-b-0">
                        <button
                          disabled={!clickable}
                          onClick={() => onSelect(l.id)}
                          className={`flex w-full items-center gap-3 py-2.5 pl-9 pr-4 text-left transition ${
                            active
                              ? "bg-online/10"
                              : clickable
                              ? "hover:bg-muted/40"
                              : "cursor-not-allowed"
                          }`}
                        >
                          {/* Status dot */}
                          <div className="shrink-0 w-4 flex items-center justify-center">
                            {l.locked ? (
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            ) : l.completed ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            ) : active ? (
                              <div className="h-3 w-3 rounded-full border-2 border-online bg-online/20" />
                            ) : (
                              <Circle className="h-3 w-3 text-muted-foreground/50" />
                            )}
                          </div>

                          {/* Type icon */}
                          <LessonTypeIcon
                            type={l.type}
                            active={active}
                            className={`h-3.5 w-3.5 shrink-0 ${l.locked ? "opacity-40" : ""}`}
                          />

                          {/* Title */}
                          <span className={`min-w-0 flex-1 truncate text-xs leading-snug ${
                            active ? "font-semibold text-online" : l.locked ? "text-muted-foreground" : "text-foreground"
                          }`}>
                            {l.title}
                          </span>

                          {/* Free-preview badge */}
                          {l.isPreview && !course.enrolled && !course.isOwner && (
                            <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                              Aperçu
                            </span>
                          )}

                          {/* Duration */}
                          {l.duration ? (
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {durationLabel(l)}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Live sessions card ───────────────────────────────────────────────────────

function LiveSessionsCard({ liveSessions }: { liveSessions: ReturnType<typeof useCourseLiveSessions> }) {
  const sessions = (liveSessions.data as LiveSession[] | undefined) ?? [];
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant">
      <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 text-sm font-semibold">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        Sessions live
        {sessions.length > 0 && (
          <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
            {sessions.length}
          </span>
        )}
      </div>
      <div className="divide-y">
        {liveSessions.isLoading ? (
          <div className="grid h-16 place-items-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">Aucune session planifiée.</p>
        ) : sessions.map((s) => (
          <div key={s.id} className="flex items-start gap-3 px-4 py-3">
            <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-medium">{s.title}</span>
                {s.status === "LIVE" && (
                  <span className="shrink-0 rounded bg-red-500 px-1 py-0.5 text-[9px] font-bold uppercase text-white">
                    Live
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {new Date(s.scheduledAt).toLocaleString("fr-FR")} · {s.durationMin} min
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              {s.link && (s.status === "SCHEDULED" || s.status === "LIVE") && (
                <a href={s.link} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg grad-online px-2.5 py-1.5 text-xs font-medium text-white">
                  <ExternalLink className="h-3 w-3" /> Rejoindre
                </a>
              )}
              <Link
                to="/online/live/$sessionId"
                params={{ sessionId: s.id }}
                className="inline-flex items-center gap-1 rounded-lg border border-purple-400/40 bg-purple-500/10 px-2.5 py-1.5 text-xs font-medium text-purple-500 hover:bg-purple-500/20 transition"
              >
                <BookOpen className="h-3 w-3" /> Tableau
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Assignments card ─────────────────────────────────────────────────────────

function AssignmentsCard({
  assignments, onSubmit,
}: {
  assignments: ReturnType<typeof useCourseAssignments>;
  onSubmit: (a: OnlineAssignment) => void;
}) {
  const list = (assignments.data as OnlineAssignment[] | undefined) ?? [];
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant">
      <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 text-sm font-semibold">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        Devoirs
        {list.length > 0 && (
          <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
            {list.length}
          </span>
        )}
      </div>
      <div className="divide-y">
        {assignments.isLoading ? (
          <div className="grid h-16 place-items-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : list.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">Aucun devoir pour l'instant.</p>
        ) : list.map((a) => {
          const submitted = !!a.submission;
          const graded = a.submission?.status === "GRADED";
          const overdue = !submitted && new Date(a.dueDate) < new Date();
          return (
            <div key={a.id} className="flex items-start gap-3 px-4 py-3">
              <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{a.title}</div>
                <div className={`mt-0.5 text-[11px] ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                  {overdue ? "⚠ En retard · " : "Rendu : "}
                  {new Date(a.dueDate).toLocaleDateString("fr-FR")} · {a.maxScore} pts
                </div>
                {graded && (
                  <div className="mt-0.5 text-[11px] font-semibold text-success">
                    Note : {a.submission!.score ?? "—"}/{a.maxScore}
                  </div>
                )}
                {(a.attachments ?? []).map((f) => (
                  <a key={f.url} href={mediaUrl(f.url)} target="_blank" rel="noreferrer" download={f.name}
                    className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-online hover:underline">
                    <FileDown className="h-3 w-3 shrink-0" /> {f.name}
                  </a>
                ))}
              </div>
              {!submitted ? (
                <button
                  onClick={() => onSubmit(a)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg grad-online px-2.5 py-1.5 text-xs font-medium text-white"
                >
                  <Send className="h-3 w-3" /> Rendre
                </button>
              ) : (
                <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-medium ${
                  graded ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                }`}>
                  {graded ? "✓ Noté" : "Rendu"}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Peer review panels (only for submitted peer-review assignments) */}
      {list.filter((a) => a.peerReview && a.submission).map((a) => (
        <PeerReviewPanel key={`pr-${a.id}`} assignment={a} />
      ))}
    </div>
  );
}

// ─── Peer review panel ────────────────────────────────────────────────────────

function PeerReviewPanel({ assignment }: { assignment: OnlineAssignment }) {
  const queue = usePeerQueue(assignment.id);
  const feedback = usePeerFeedback(assignment.id);
  const review = useSubmitPeerReview(assignment.id);
  const [scores, setScores] = useState<Record<string, { score: string; comment: string }>>({});

  const items = queue.data?.items ?? [];
  const fb = feedback.data;

  async function send(submissionId: string) {
    const draft = scores[submissionId];
    const n = Number(draft?.score);
    if (!(n >= 0) || n > assignment.maxScore) {
      toast.error(`Note entre 0 et ${assignment.maxScore}`);
      return;
    }
    try {
      await review.mutateAsync({ submissionId, score: n, comment: draft?.comment });
      toast.success("Évaluation envoyée 🤝");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Impossible d'envoyer l'évaluation");
    }
  }

  if (queue.isLoading) return null;

  return (
    <div className="border-t bg-online/[0.03] px-4 py-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
        🤝 Évaluation par les pairs — {assignment.title}
        {(queue.data?.reviewedCount ?? 0) > 0 && (
          <span className="font-normal text-muted-foreground">({queue.data!.reviewedCount} évaluée{queue.data!.reviewedCount > 1 ? "s" : ""})</span>
        )}
      </div>

      {/* Feedback received on my own submission */}
      {fb && fb.avg != null && (
        <div className="mb-3 rounded-lg border border-success/30 bg-success/5 p-2.5 text-xs">
          <span className="font-semibold text-success">Note moyenne reçue : {fb.avg}/{fb.maxScore ?? assignment.maxScore}</span>
          <span className="text-muted-foreground"> · {fb.reviews.length} évaluation{fb.reviews.length > 1 ? "s" : ""}</span>
          {fb.reviews.filter((r) => r.comment).slice(0, 2).map((r, i) => (
            <p key={i} className="mt-1 italic text-muted-foreground">« {r.comment} »</p>
          ))}
        </div>
      )}

      {/* Queue of anonymous peer submissions to review */}
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Aucune soumission à évaluer pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {items.map((s) => {
            const draft = scores[s.id] ?? { score: "", comment: "" };
            return (
              <div key={s.id} className="rounded-lg border bg-card p-2.5">
                <p className="mb-1.5 whitespace-pre-wrap text-xs">{s.content ?? "(fichier joint)"}</p>
                {s.fileUrl && (
                  <a href={mediaUrl(s.fileUrl)} target="_blank" rel="noreferrer" className="mb-1.5 inline-block text-[11px] text-online hover:underline">
                    📎 Voir le fichier
                  </a>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={assignment.maxScore}
                    value={draft.score}
                    onChange={(e) => setScores((p) => ({ ...p, [s.id]: { ...draft, score: e.target.value } }))}
                    placeholder={`/${assignment.maxScore}`}
                    className="w-16 rounded-lg border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={draft.comment}
                    onChange={(e) => setScores((p) => ({ ...p, [s.id]: { ...draft, comment: e.target.value } }))}
                    placeholder="Commentaire (facultatif)"
                    className="flex-1 rounded-lg border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={() => send(s.id)}
                    disabled={review.isPending}
                    className="inline-flex items-center gap-1 rounded-lg grad-online px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
                  >
                    <Send className="h-3 w-3" /> Noter
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Enroll panel ─────────────────────────────────────────────────────────────

// Cours du cursus universitaire verrouillé : il se débloque par l'écolage du
// mois (et après les cours liés), jamais par un achat à l'unité.
const CURSUS_LOCK_TEXT: Record<string, { title: string; body: string }> = {
  tuition_unpaid: {
    title: "Écolage du mois à régler",
    body: "Ce cours fait partie de votre cursus. Il sera accessible dès que l'écolage du mois correspondant sera validé par la comptabilité.",
  },
  related_incomplete: {
    title: "Terminez d'abord les cours liés",
    body: "Ce cours s'appuie sur d'autres cours du cursus. Terminez-les à 100 % (leçons et test) pour le débloquer.",
  },
  not_in_cursus: {
    title: "Hors de votre cursus",
    body: "Ce cours appartient au cursus d'un autre niveau ou d'une autre mention.",
  },
};

function CursusLockPanel({ course }: { course: CourseDetail }) {
  const txt = CURSUS_LOCK_TEXT[course.cursus?.reason ?? "tuition_unpaid"] ?? CURSUS_LOCK_TEXT.tuition_unpaid;
  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-card p-6 text-center shadow-sm">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-amber-500/15 text-amber-600">
        <Lock className="h-5 w-5" />
      </div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Cursus universitaire · {cursusPlace(course.cursusLevel, course.cursusMonth)}
      </p>
      <h3 className="mt-1 text-lg font-semibold">{txt.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{txt.body}</p>
      {course.cursus?.reason !== "not_in_cursus" && (
        <Link to="/classroom/cursus" className="mt-5 inline-flex items-center gap-2 rounded-xl grad-online px-5 py-2.5 text-sm font-semibold text-white">
          Voir mon cursus et l'écolage
        </Link>
      )}
    </div>
  );
}

function EnrollPanel({
  course, onEnroll, pending, isPaid, hasPendingPayment, onPay,
}: {
  course: CourseDetail;
  onEnroll: () => void;
  pending: boolean;
  isPaid: boolean;
  hasPendingPayment: boolean;
  onPay: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant">
      {/* Thumbnail / preview with lock */}
      <div className="relative aspect-video overflow-hidden grad-online">
        {course.thumbnail ? (
          <img src={mediaUrl(course.thumbnail)} alt="" className="h-full w-full object-cover opacity-80" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Lock className="h-16 w-16 text-white/20" />
          </div>
        )}
        {/* Teacher avatar → public instructor page */}
        <Link
          to="/online/instructor/$id"
          params={{ id: course.teacher.id ?? "" }}
          className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-sm transition hover:bg-black/70"
        >
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20 text-[10px] font-bold text-white">
            {(course.teacher.firstName[0] ?? "") + (course.teacher.lastName[0] ?? "")}
          </div>
          <span className="text-xs text-white underline-offset-2 hover:underline">
            {course.teacher.firstName} {course.teacher.lastName}
          </span>
        </Link>
        {/* Lock overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <div className="rounded-full bg-black/50 p-4 backdrop-blur-sm">
            <Lock className="h-8 w-8 text-white" />
          </div>
        </div>
      </div>

      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight">{course.title}</h1>
        {course.subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{course.subtitle}</p>}
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground line-clamp-3">{course.description}</p>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>📂 {course.modules.length} modules</span>
          <span>📚 {course.modules.reduce((s, m) => s + m.lessons.length, 0)} leçons</span>
          <span>🧩 {course.quizzes.length} quiz</span>
          <span>👥 {course.enrollmentsCount} inscrits</span>
        </div>

        {isPaid ? (
          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-3">
              <span className="text-sm font-medium">Prix du cours</span>
              <span className="text-xl font-extrabold text-online">
                {(course.price ?? 0).toLocaleString("fr-FR")} MGA
              </span>
            </div>
            {hasPendingPayment ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Paiement soumis — en attente de validation
              </div>
            ) : (
              <button
                onClick={onPay}
                className="flex w-full items-center justify-center gap-2 rounded-xl grad-online py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              >
                Acheter ce cours
              </button>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
              {["MVola", "Orange Money", "Airtel Money"].map((m) => (
                <div key={m} className="rounded-lg border bg-muted/30 py-2 font-medium">{m}</div>
              ))}
            </div>

            <CoursePacks courseId={course.id} />

            {/* Subscription upsell */}
            <Link
              to="/online/subscription"
              className="mt-4 flex items-center gap-3 rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-50 to-orange-50 p-3 transition hover:shadow-glow dark:from-amber-950/20 dark:to-orange-950/20"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white">
                <Crown className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold">Ou débloquez tout le catalogue</div>
                <div className="text-[11px] text-muted-foreground">Un abonnement = accès à ce cours et à tous les autres.</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-amber-600" />
            </Link>
          </div>
        ) : (
          <button
            onClick={onEnroll}
            disabled={pending}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl grad-online py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            S'inscrire gratuitement
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Video player: resume position + playback speed ───────────────────────────

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function VideoPlayer({ url, lessonId, initialSec }: { url: string; lessonId: string; initialSec: number }) {
  const protectedMode = useProtectedContent();
  const ref = useRef<HTMLVideoElement>(null);
  const save = useSaveWatched();
  const lastSaved = useRef(0);
  const [speed, setSpeed] = useState(1);
  const [resumed, setResumed] = useState(false);

  // Restore the saved position once metadata (duration) is available.
  function onLoadedMetadata() {
    const v = ref.current;
    if (!v) return;
    v.playbackRate = speed;
    if (initialSec > 5 && initialSec < v.duration - 10) {
      v.currentTime = initialSec;
      setResumed(true);
    }
  }

  // Persist position at most every 15s of playback.
  function onTimeUpdate() {
    const v = ref.current;
    if (!v) return;
    const t = Math.floor(v.currentTime);
    if (t - lastSaved.current >= 15) {
      lastSaved.current = t;
      save.mutate({ lessonId, watchedSec: t });
    }
  }

  function flush() {
    const v = ref.current;
    if (v && v.currentTime > 0) save.mutate({ lessonId, watchedSec: Math.floor(v.currentTime) });
  }

  // Save the final position when the player unmounts (lesson change / leave).
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function changeSpeed(r: number) {
    setSpeed(r);
    if (ref.current) ref.current.playbackRate = r;
  }

  return (
    <div className="relative">
      <video
        ref={ref}
        src={url}
        controls
        controlsList={protectedMode ? "nodownload" : undefined}
        disablePictureInPicture={protectedMode}
        className="aspect-video w-full bg-black"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onPause={flush}
      />
      {/* Speed selector */}
      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-black/60 px-1.5 py-1 backdrop-blur">
        <span className="px-1 text-[10px] font-medium uppercase tracking-wider text-white/60">Vitesse</span>
        <select
          value={speed}
          onChange={(e) => changeSpeed(Number(e.target.value))}
          className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-semibold text-white outline-none"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s} className="text-black">{s}×</option>
          ))}
        </select>
      </div>
      {resumed && (
        <div className="absolute bottom-16 left-2 rounded-lg bg-online/90 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg">
          ▶ Reprise à {Math.floor(initialSec / 60)}:{String(Math.floor(initialSec % 60)).padStart(2, "0")}
        </div>
      )}
    </div>
  );
}

// ─── Lecteur par module ───────────────────────────────────────────────────────
// En haut : le module (liste déroulante) et, dessous, sa place dans le cours.
// Trois onglets : Word (cours PDF / Word, lu par défaut), Vidéo, Autre (liste de
// fichiers, liens YouTube, audio, images…). Le contenu s'affiche en dessous.

type ReaderKind = "cours" | "video" | "autre";

type ReaderResource = {
  key: string;
  lessonId: string;
  kind: ReaderKind;
  title: string;
  subtitle: string | null;
  lesson: CourseLesson;      // leçon « virtuelle » prête pour LessonMedia
  text: string | null;       // leçon TEXT : affichée directement
  downloadUrl: string | null;
  tag: string;               // petite étiquette de la liste (PDF, YouTube, Audio…)
  Icon: React.ElementType;
};

const READER_TABS: { kind: ReaderKind; label: string; Icon: React.ElementType; empty: string }[] = [
  { kind: "cours", label: "Word",  Icon: FileText,     empty: "Aucun cours (PDF / Word) dans ce module." },
  { kind: "video", label: "Vidéo", Icon: Film,         empty: "Aucune vidéo dans ce module." },
  { kind: "autre", label: "Autre", Icon: FileDown,     empty: "Aucun autre fichier dans ce module." },
];

function buildResources(mod: CourseModule): ReaderResource[] {
  const out: ReaderResource[] = [];
  for (const l of mod.lessons) {
    if (l.locked) continue;
    const dl = (url: string | null | undefined) => (l.allowDownload && url ? mediaUrl(url) ?? null : null);
    const base = { lessonId: l.id, subtitle: null as string | null, text: null as string | null };

    // Contenu principal de la leçon
    if (l.type === "TEXT") {
      if (l.body) out.push({ ...base, key: `${l.id}:text`, kind: "cours", title: l.title, subtitle: null, lesson: l, text: l.body, downloadUrl: null, tag: "Texte", Icon: BookOpen });
    } else if (l.type === "CODE") {
      out.push({ ...base, key: `${l.id}:code`, kind: "autre", title: l.title, lesson: { ...l, files: [] }, downloadUrl: null, tag: "Code", Icon: BookOpen });
    } else if (l.contentUrl) {
      const yt = youtubeEmbed(l.contentUrl) != null;
      const kind: ReaderKind = yt || l.type === "LINK" ? "autre"
        : l.type === "VIDEO" ? "video"
        : l.type === "PDF" || l.type === "DOCUMENT" ? "cours" : "autre";
      const cfg = TYPE_CFG[l.type] ?? TYPE_CFG.DOCUMENT;
      out.push({
        ...base, key: `${l.id}:main`, kind, title: l.title, lesson: { ...l, files: [] },
        downloadUrl: yt || l.type === "LINK" ? null : dl(l.contentUrl),
        tag: yt ? "YouTube" : cfg.label, Icon: yt ? Film : cfg.icon,
      });
    }

    // Fichiers joints
    for (const f of l.files ?? []) {
      const t = mimeToType(f.mimeType) as CourseLesson["type"];
      const kind: ReaderKind = t === "PDF" || t === "DOCUMENT" ? "cours" : t === "VIDEO" ? "video" : "autre";
      const cfg = TYPE_CFG[t] ?? TYPE_CFG.DOCUMENT;
      out.push({
        ...base, key: `${l.id}:${f.id}`, kind, title: f.name, subtitle: l.title,
        lesson: { ...l, contentUrl: null, type: t, files: [f] },
        downloadUrl: dl(f.url), tag: cfg.label, Icon: cfg.icon,
      });
    }
  }
  return out;
}

function ModuleReader({ lesson, modules, courseTitle, onNavigate }: {
  lesson: CourseLesson;
  modules: CourseModule[];
  courseTitle: string;
  onNavigate: (lessonId: string) => void;
}) {
  const modIdx = Math.max(0, modules.findIndex((m) => m.lessons.some((l) => l.id === lesson.id)));
  const mod = modules[modIdx];
  const resources = useMemo(() => (mod ? buildResources(mod) : []), [mod]);
  const ofKind = (k: ReaderKind) => resources.filter((r) => r.kind === k);
  // Le cours (PDF / Word) est lu en premier, puis la vidéo, puis le reste
  const firstKind = (READER_TABS.find((t) => ofKind(t.kind).length > 0) ?? READER_TABS[0]).kind;

  const [tab, setTab] = useState<ReaderKind>(firstKind);
  const [resKey, setResKey] = useState<string | null>(null);
  const pending = useRef<string | null>(null);

  useEffect(() => {
    if (pending.current) {
      const p = resources.find((r) => r.key === pending.current);
      pending.current = null;
      if (p) { setTab(p.kind); setResKey(p.key); return; }
    }
    const current = resources.find((r) => r.key === resKey);
    if (current && current.lessonId === lesson.id) return;
    const mine = resources.find((r) => r.lessonId === lesson.id);
    if (mine) { setTab(mine.kind); setResKey(mine.key); return; }
    setTab(firstKind);
    setResKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, resources]);

  function pickTab(k: ReaderKind) {
    setTab(k);
    const r = ofKind(k)[0];
    setResKey(r?.key ?? null);
    if (r && r.lessonId !== lesson.id) onNavigate(r.lessonId);
  }
  function pickResource(r: ReaderResource) {
    setResKey(r.key);
    if (r.lessonId !== lesson.id) onNavigate(r.lessonId);
  }
  function pickModule(i: number) {
    const m = modules[i];
    if (!m) return;
    const rs = buildResources(m);
    const target = rs.find((r) => r.kind === "cours") ?? rs[0];
    const lessonId = target?.lessonId ?? m.lessons[0]?.id;
    if (!lessonId) return;
    pending.current = target?.key ?? null;
    onNavigate(lessonId);
  }

  const items = ofKind(tab);
  const current = items.find((r) => r.key === resKey) ?? null;
  const showList = items.length > 1 || (tab === "autre" && items.length > 0);
  const tabCfg = READER_TABS.find((t) => t.kind === tab)!;

  return (
    <div className="border-b bg-background">
      {/* Module + place dans le cours */}
      <div className="px-5 pt-5 md:px-8">
        <div className="relative inline-block">
          <select
            value={modIdx}
            onChange={(e) => pickModule(Number(e.target.value))}
            aria-label="Choisir le module"
            className="cursor-pointer appearance-none rounded-lg border-2 border-foreground/80 bg-background py-2 pl-4 pr-11 text-sm font-extrabold uppercase tracking-wide outline-none focus:ring-2 focus:ring-ring"
          >
            {modules.map((m, i) => (
              <option key={m.id} value={i} disabled={m.lessons.length === 0}>
                Module {i + 1}{m.lessons.length === 0 ? " (vide)" : ""}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{mod?.title}</span>
          {" · "}module {modIdx + 1} sur {modules.length} du cours « {courseTitle} »
        </p>
      </div>

      {/* Onglets + contenu */}
      <div className="px-5 pb-5 pt-4 md:px-8">
        <div className="overflow-hidden rounded-lg border-2 border-foreground/80">
          <div role="tablist" className="grid grid-cols-3 divide-x-2 divide-foreground/80 border-b-2 border-foreground/80">
            {READER_TABS.map(({ kind, label, Icon }) => {
              const n = ofKind(kind).length;
              const active = tab === kind;
              return (
                <button
                  key={kind}
                  role="tab"
                  aria-selected={active}
                  onClick={() => pickTab(kind)}
                  className={`flex items-center justify-center gap-2 px-3 py-3 text-sm font-bold transition ${
                    active ? "bg-foreground text-background" : n === 0 ? "text-muted-foreground/60 hover:bg-muted/40" : "hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                  <span className={`rounded-full px-1.5 text-[11px] font-semibold ${active ? "bg-background/20" : "bg-muted"}`}>{n}</span>
                </button>
              );
            })}
          </div>

          {showList && (
            <ul className="max-h-56 divide-y overflow-y-auto border-b bg-muted/20">
              {items.map((r) => (
                <li key={r.key}>
                  <button
                    onClick={() => pickResource(r)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-muted/60 ${r.key === current?.key ? "bg-online/10 font-semibold" : ""}`}
                  >
                    <r.Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{r.title}</span>
                      {r.subtitle && <span className="block truncate text-xs font-normal text-muted-foreground">{r.subtitle}</span>}
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{r.tag}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {current && (current.downloadUrl || items.length === 1) && (
            <div className="flex items-center gap-3 border-b px-4 py-2 text-xs text-muted-foreground">
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{current.title}</span>
              {current.downloadUrl && (
                <a href={current.downloadUrl} download className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 font-medium hover:bg-accent">
                  <FileDown className="h-3.5 w-3.5" /> Télécharger
                </a>
              )}
            </div>
          )}

          <div className="min-h-[200px] bg-muted/20">
            {current ? (
              <div key={current.key}>
                {current.text != null
                  ? <div className="whitespace-pre-wrap p-6 text-sm leading-relaxed text-foreground">{current.text}</div>
                  : <LessonMedia lesson={current.lesson} allowDownload={current.lesson.allowDownload} tall={current.kind === "cours"} />}
              </div>
            ) : (
              <Placeholder
                icon={<tabCfg.Icon className="h-10 w-10 opacity-60" />}
                label={items.length === 0 ? tabCfg.empty : "Choisissez un fichier dans la liste"}
                sub={lesson.locked ? "Cette leçon est verrouillée pour le moment." : " "}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Lesson media viewer ──────────────────────────────────────────────────────

function LessonMedia({ lesson, allowDownload = true, tall = false }: { lesson: CourseLesson; allowDownload?: boolean; tall?: boolean }) {
  const protectedMode = useProtectedContent();
  const primaryFile = !lesson.contentUrl && lesson.files?.length > 0 ? lesson.files[0] : null;
  const effectiveUrl = lesson.contentUrl ?? primaryFile?.url ?? null;
  const effectiveType = (
    lesson.contentUrl ? lesson.type : primaryFile ? mimeToType(primaryFile.mimeType) : lesson.type
  ) as CourseLesson["type"];
  const url = mediaUrl(effectiveUrl);

  if (effectiveType === "VIDEO") {
    if (!url) return <Placeholder icon={<Film className="h-10 w-10 opacity-60" />} label="Aucune vidéo" />;
    const embed = youtubeEmbed(effectiveUrl!);
    if (embed) return <iframe src={embed} title={lesson.title} className="aspect-video w-full" allowFullScreen />;
    return (
      <VideoPlayer
        key={lesson.id}
        url={url}
        lessonId={lesson.id}
        initialSec={lesson.watchedSec ?? 0}
      />
    );
  }

  if (effectiveType === "PDF" || effectiveType === "DOCUMENT") {
    if (!url) return <Placeholder icon={<FileText className="h-10 w-10 opacity-60" />} label="Aucun document" />;
    const isPdf = effectiveType === "PDF" || primaryFile?.mimeType === "application/pdf" || /\.pdf($|\?)/i.test(effectiveUrl ?? "");
    if (protectedMode) {
      return isPdf ? <ProtectedPdf url={url} height={tall ? 720 : undefined} /> : <UnviewableDocument name={primaryFile?.name ?? lesson.title} />;
    }
    // Word & co : le navigateur ne sait pas les afficher, on propose le fichier
    if (!isPdf) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <FileText className="h-12 w-12 text-indigo-500" />
          <p className="max-w-md truncate text-sm font-medium">{primaryFile?.name ?? lesson.title}</p>
          {allowDownload
            ? <a href={url} download className="inline-flex items-center gap-2 rounded-xl grad-online px-5 py-2.5 text-sm font-medium text-white"><FileDown className="h-4 w-4" /> Ouvrir / télécharger</a>
            : <p className="text-xs text-muted-foreground">Ce document n'est pas affichable dans le navigateur.</p>}
        </div>
      );
    }
    return (
      <div className={tall ? "h-[75vh] min-h-[480px] w-full bg-muted" : "aspect-video w-full bg-muted"}>
        <iframe src={url} title={lesson.title} className="h-full w-full" />
      </div>
    );
  }

  if (effectiveType === "AUDIO") {
    if (!url) return <Placeholder icon={<Volume2 className="h-10 w-10 opacity-60" />} label="Aucun audio" />;
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-6 bg-gradient-to-br from-purple-900 to-purple-700 text-white px-8">
        <Volume2 className="h-16 w-16 opacity-80" />
        <audio src={url} controls controlsList={protectedMode ? "nodownload" : undefined} className="w-full max-w-lg" />
      </div>
    );
  }

  if (effectiveType === "IMAGE") {
    if (!url) return <Placeholder icon={<Image className="h-10 w-10 opacity-60" />} label="Aucune image" />;
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-muted/60">
        <img src={url} alt={lesson.title} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }

  if (effectiveType === "LINK") {
    const link = lesson.contentUrl;
    if (!link) return <Placeholder icon={<ExternalLink className="h-10 w-10 opacity-60" />} label="Aucun lien" />;
    const embed = embedUrl(link);
    if (embed) return <iframe src={embed} title={lesson.title} className="aspect-video w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />;
    let host = link;
    try { host = new URL(link).hostname.replace(/^www\./, ""); } catch { /* lien brut */ }
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-sky-700 to-sky-500 px-6 text-center text-white">
        <ExternalLink className="h-12 w-12 opacity-80" />
        <div>
          <p className="text-sm opacity-80">Ressource externe</p>
          <p className="font-semibold">{host}</p>
        </div>
        <a href={link} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-6 py-3 text-sm font-medium hover:bg-white/30 transition">
          <ExternalLink className="h-4 w-4" /> Ouvrir le lien
        </a>
      </div>
    );
  }

  if (effectiveType === "CODE") {
    return <CodeSandbox key={lesson.id} starter={lesson.body ?? "<!-- Votre code HTML/CSS/JS ici -->\n"} lessonId={lesson.id} />;
  }

  if (effectiveType === "ZIP" || effectiveType === "FILE") {
    if (!url) return <Placeholder icon={<Archive className="h-10 w-10 opacity-60" />} label="Aucun fichier" />;
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 grad-online text-white">
        <Archive className="h-14 w-14 opacity-80" />
        <p className="text-sm opacity-70">Fichier compressé</p>
        {allowDownload && (
          <a
            href={url}
            download
            className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-6 py-3 text-sm font-medium hover:bg-white/30 transition"
          >
            <FileDown className="h-4 w-4" /> Télécharger
          </a>
        )}
      </div>
    );
  }

  // TEXT — body shown in ContentPanel below the media area
  return (
    <div className="flex aspect-[21/6] w-full items-center justify-center bg-gradient-to-br from-green-900/80 to-green-700/80 text-white">
      <BookOpen className="h-10 w-10 opacity-60" />
    </div>
  );
}

function Placeholder({ icon, label, sub }: { icon: React.ReactNode; label?: string; sub?: string }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 grad-online px-6 text-center text-white">
      {icon}
      {label && <span className="text-sm font-medium opacity-90">{label}</span>}
      <span className="max-w-xs text-xs opacity-70">
        {sub ?? "L'enseignant n'a pas encore ajouté de contenu à cette leçon."}
      </span>
    </div>
  );
}
