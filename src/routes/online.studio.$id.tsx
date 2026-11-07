import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, BookOpen, Layers, FileText, HelpCircle, ClipboardList, Calendar,
  Users, BarChart3, Settings, Rocket, Loader2, Plus, Trash2, Pencil, Upload,
  X, Check, Film, Volume2, Image, Eye, EyeOff, Globe, Award, Clock, Play,
  Library, History, MessageSquare, RefreshCw, Download, DownloadCloud, BanIcon,
  TrendingDown, TrendingUp, Star, MessageCircle, Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import {
  useCourse, useUpdateCourse, useCreateQuiz, useCourseAnalytics,
  useCreateAssignment, useDeleteAssignment,
  useCourseLiveSessions, useCreateLiveSession, useDeleteLiveSession,
  useCourseStudents,
  type CourseDetail, type CourseModule, type CourseLesson,
} from "@/lib/online";
import { usePublicCategories } from "@/lib/lms-admin";
import { QuizBuilder } from "@/components/online/quiz-builder";
import { useRequireOnline } from "@/components/online/shared";
import { ModuleTree } from "@/components/online/studio/module-tree";
import { VersionHistory } from "@/components/online/studio/version-history";
import { CourseComments } from "@/components/online/studio/course-comments";
import { ReviewsSection, QASection, AnnouncementsSection } from "@/components/online/engagement";
import { QualityChecklist } from "@/components/online/studio/quality-checklist";
import { PublishWorkflow } from "@/components/online/studio/publish-workflow";
import { MediaLibraryModal } from "@/components/online/studio/media-library";
import { useAutoSave, SaveIndicator } from "@/components/online/studio/auto-save";
import { CursusFields, cursusValueOf, cursusPayload, cursusIncomplete } from "@/components/online/cursus-fields";
import { CategorySelect, MentionSelect } from "@/components/online/category-select";
import { useUploadManager, UploadManagerUI, DropZone } from "@/components/online/studio/upload-manager";
import { api } from "@/lib/api";
import { BackHomeButtons } from "@/components/nav-buttons";

export const Route = createFileRoute("/online/studio/$id")({
  component: CourseStudio,
});

type StudioTab =
  | "overview" | "info" | "cover" | "modules" | "lesson"
  | "quiz" | "assignments" | "sessions" | "students"
  | "analytics" | "settings" | "versions" | "comments" | "reviews" | "questions" | "announcements" | "publish";

const SIDEBAR: Array<{
  id: StudioTab; label: string; icon: React.ElementType; dividerBefore?: boolean;
}> = [
  { id: "overview",     label: "Vue d'ensemble",   icon: BookOpen },
  { id: "info",         label: "Informations",      icon: FileText },
  { id: "cover",        label: "Couverture",        icon: Image },
  { id: "modules",      label: "Modules & Leçons",  icon: Layers },
  { id: "quiz",         label: "Quiz",              icon: HelpCircle },
  { id: "assignments",  label: "Devoirs",           icon: ClipboardList },
  { id: "sessions",     label: "Sessions live",     icon: Calendar },
  { id: "students",     label: "Étudiants",        icon: Users,         dividerBefore: true },
  { id: "analytics",    label: "Statistiques",      icon: BarChart3 },
  { id: "reviews",      label: "Avis",              icon: Star },
  { id: "questions",    label: "Questions",         icon: MessageCircle },
  { id: "announcements", label: "Annonces",         icon: Megaphone },
  { id: "versions",     label: "Versions",          icon: History,       dividerBefore: true },
  { id: "comments",     label: "Commentaires",      icon: MessageSquare },
  { id: "settings",     label: "Paramètres",        icon: Settings },
  { id: "publish",      label: "Publication",       icon: Rocket },
];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon", REVIEW: "En révision", APPROVED: "Approuvé",
  PUBLISHED: "Publié", ARCHIVED: "Archivé",
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-yellow-500/15 text-yellow-700",
  REVIEW: "bg-blue-500/15 text-blue-700",
  APPROVED: "bg-purple-500/15 text-purple-700",
  PUBLISHED: "bg-green-500/15 text-green-600",
  ARCHIVED: "bg-muted text-muted-foreground",
};

function CourseStudio() {
  const { id } = Route.useParams();
  const { user, ready } = useRequireOnline("TEACHER_ONLINE");
  const navigate = useNavigate();
  const [tab, setTab] = useState<StudioTab>("overview");
  const [selectedLesson, setSelectedLesson] = useState<{ lesson: CourseLesson; moduleId: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const course = useCourse(id);

  if (!ready || !user) return <FullLoader />;
  if (course.isLoading) return <FullLoader />;
  if (!course.data) return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-destructive">Cours introuvable.</p>
    </div>
  );

  const c = course.data as CourseDetail;
  if (!c.isOwner && user.systemRole !== "SUPER_ADMIN") {
    navigate({ to: "/online/teacher" });
    return null;
  }

  // Quality score for sidebar badge
  const qChecks = [
    c.title.length >= 3, (c.description ?? "").length > 50, !!c.thumbnail,
    c.modules.length > 0, c.modules.some(m => m.lessons.length > 0), !!c.category,
  ];
  const qPct = Math.round((qChecks.filter(Boolean).length / qChecks.length) * 100);

  // Handle lesson selection → go to lesson editor
  function handleSelectLesson(lesson: CourseLesson, moduleId: string) {
    setSelectedLesson({ lesson, moduleId });
    setTab("lesson");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
        {/* Back + course name */}
        <div className="border-b p-3">
          <BackHomeButtons home="/online/teacher" homeLabel="Mon Studio" className="mb-2" />
          <div className="text-xs font-semibold leading-tight line-clamp-2">{c.title}</div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[c.status] ?? ""}`}>
              {STATUS_LABEL[c.status] ?? c.status}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-1.5">
          {SIDEBAR.map(({ id: sid, label, icon: Icon, dividerBefore }) => (
            <div key={sid}>
              {dividerBefore && <div className="my-1 border-t" />}
              <button
                onClick={() => { setTab(sid); if (sid !== "lesson") setSelectedLesson(null); }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition
                  ${tab === sid
                    ? "bg-online/10 font-semibold text-online"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                {sid === "publish" && (
                  <span className={`rounded-full px-1.5 text-[9px] font-bold ${qPct === 100 ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-700"}`}>
                    {qPct}%
                  </span>
                )}
              </button>
            </div>
          ))}
        </nav>

        {/* Preview button */}
        <div className="border-t p-2">
          <button onClick={() => setPreviewOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-xs hover:bg-accent">
            <Play className="h-3.5 w-3.5" /> Prévisualiser
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <StudioHeader tab={tab} sidebar={SIDEBAR} course={c} />
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "overview"     && <OverviewTab course={c} onGoToTab={setTab} />}
          {tab === "info"         && <InfoTab course={c} />}
          {tab === "cover"        && <CoverTab course={c} />}
          {tab === "modules"      && <ModulesTab course={c} onSelectLesson={handleSelectLesson} selectedLessonId={selectedLesson?.lesson.id} />}
          {tab === "lesson"       && selectedLesson && <LessonEditorTab lesson={selectedLesson.lesson} courseId={c.id} />}
          {tab === "quiz"         && <QuizTab course={c} />}
          {tab === "assignments"  && <AssignmentsTab course={c} />}
          {tab === "sessions"     && <SessionsTab course={c} />}
          {tab === "students"     && <StudentsTab course={c} />}
          {tab === "analytics"    && <AnalyticsTab course={c} />}
          {tab === "reviews"      && <ReviewsSection course={c} />}
          {tab === "questions"    && <QASection course={c} lessons={c.modules.flatMap((m) => m.lessons)} />}
          {tab === "announcements" && <AnnouncementsSection course={c} />}
          {tab === "versions"     && <VersionHistory courseId={c.id} />}
          {tab === "comments"     && <CourseComments courseId={c.id} />}
          {tab === "settings"     && <SettingsTab course={c} />}
          {tab === "publish"      && <PublishWorkflow course={c} onGoToTab={t => setTab(t as StudioTab)} />}
        </div>
      </main>

      {/* Live preview modal */}
      {previewOpen && (
        <LivePreviewModal course={c} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}

// ── Header with auto-save indicator ──────────────────────────────────────────

function StudioHeader({
  tab, sidebar, course,
}: {
  tab: StudioTab;
  sidebar: typeof SIDEBAR;
  course: CourseDetail;
}) {
  const label = tab === "lesson" ? "Éditeur de leçon" : (sidebar.find(s => s.id === tab)?.label ?? "");
  return (
    <div className="flex items-center gap-3 border-b bg-card px-6 py-3">
      <h1 className="text-sm font-semibold">{label}</h1>
      <span className="flex-1" />
      {/* Auto-save indicator placeholder — managed per-tab */}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({ course: c, onGoToTab }: { course: CourseDetail; onGoToTab: (t: StudioTab) => void }) {
  const analytics = useCourseAnalytics(c.id);
  const a = analytics.data;
  const quizChart = (a?.quizzes ?? [])
    .filter((q: { attempts: number }) => q.attempts > 0)
    .map((q: { title: string; passRate: number; attempts: number }) => ({
      name: q.title.length > 12 ? q.title.slice(0, 11) + "…" : q.title,
      full: q.title,
      passRate: q.passRate,
      attempts: q.attempts,
    }));
  const qChecks = [
    { label: "Titre", done: c.title.length >= 3 },
    { label: "Description", done: (c.description ?? "").length > 50 },
    { label: "Couverture", done: !!c.thumbnail },
    { label: "Module", done: c.modules.length > 0 },
    { label: "Leçon", done: c.modules.some(m => m.lessons.length > 0) },
    { label: "Quiz", done: c.quizzes.length > 0 },
  ];
  const done = qChecks.filter(q => q.done).length;
  const pct = Math.round((done / qChecks.length) * 100);
  const apiBase = "http://localhost:4000";

  const STEPS: { label: string; tab: StudioTab; done: boolean }[] = [
    { label: "Image de couverture",   tab: "cover",   done: !!c.thumbnail },
    { label: "Informations complètes",tab: "info",    done: (c.description ?? "").length > 50 },
    { label: "Modules créés",         tab: "modules", done: c.modules.length > 0 },
    { label: "Leçons avec contenu",   tab: "modules", done: c.modules.some(m => m.lessons.some(l => l.contentUrl)) },
    { label: "Quiz ajouté",           tab: "quiz",    done: c.quizzes.length > 0 },
    { label: "Publier",               tab: "publish", done: c.status === "PUBLISHED" },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {/* KPI hero row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Users, label: "Étudiants inscrits", value: c.enrollmentsCount, sub: a ? `${a.completed} ont terminé` : "", color: "text-online", bg: "bg-online/10" },
          { icon: Star, label: "Note du cours", value: c.ratingCount > 0 ? c.ratingAvg.toFixed(1) : "—", sub: c.ratingCount > 0 ? `${c.ratingCount} avis` : "Aucun avis", color: "text-amber-500", bg: "bg-amber-500/10" },
          { icon: TrendingUp, label: "Progression moyenne", value: a ? `${a.avgProgress}%` : "…", sub: a ? `${a.completionRate}% de complétion` : "", color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { icon: HelpCircle, label: "Quiz actifs", value: c.quizzes.length, sub: a?.quizzes?.length ? `${a.quizzes.reduce((s: number, q: { attempts: number }) => s + q.attempts, 0)} tentatives` : "", color: "text-purple-500", bg: "bg-purple-500/10" },
        ].map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="rounded-2xl border bg-card p-4 shadow-elegant">
            <div className={`mb-2 grid h-9 w-9 place-items-center rounded-xl ${bg}`}>
              <Icon className={`h-4.5 w-4.5 h-[18px] w-[18px] ${color}`} />
            </div>
            <div className="text-2xl font-extrabold tracking-tight">{value}</div>
            <div className="text-xs font-medium">{label}</div>
            {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
          </div>
        ))}
      </div>

      {/* Quiz pass-rate chart */}
      {quizChart.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 shadow-elegant">
          <h3 className="text-sm font-semibold">Réussite aux quiz</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Taux de réussite (%) par quiz — survolez pour le détail</p>
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quizChart} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                <XAxis dataKey="name" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} className="text-muted-foreground" />
                <YAxis domain={[0, 100]} stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} className="text-muted-foreground" />
                <ChartTooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                  labelFormatter={(_: unknown, payload: Array<{ payload?: { full?: string } }>) => payload?.[0]?.payload?.full ?? ""}
                  formatter={(v: unknown, _n: unknown, item: { payload?: { attempts?: number } }) =>
                    [`${v}% de réussite · ${item?.payload?.attempts ?? 0} tentative(s)`, ""]}
                />
                <Bar dataKey="passRate" fill="var(--color-online)" radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Course card */}
      <div className="flex gap-5 rounded-2xl border bg-card p-5">
        <div className="h-28 w-44 shrink-0 overflow-hidden rounded-xl bg-muted">
          {c.thumbnail
            ? <img src={`${apiBase}${c.thumbnail}`} alt="" className="h-full w-full object-cover" />
            : <div className="flex h-full items-center justify-center"><Image className="h-10 w-10 text-muted-foreground/30" /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{c.title}</div>
          {c.subtitle && <div className="text-sm text-muted-foreground">{c.subtitle}</div>}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {c.language && <span className="rounded border px-2 py-0.5">{c.language.toUpperCase()}</span>}
            {c.level && <span className="rounded border px-2 py-0.5">{c.level}</span>}
            {c.category && <span className="rounded border px-2 py-0.5">{c.category.name}</span>}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span>{c.modules.length} module(s)</span>
            <span>{c.modules.reduce((s, m) => s + m.lessons.length, 0)} leçon(s)</span>
            <span>{c.quizzes.length} quiz</span>
            <span>{c.enrollmentsCount} inscrit(s)</span>
          </div>
        </div>
      </div>

      {/* Workflow steps */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Workflow de création</h3>
          <span className="text-xs font-medium text-muted-foreground">{done}/{qChecks.length}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted mb-4">
          <div className="h-full rounded-full grad-online transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="space-y-2">
          {STEPS.map(({ label, tab, done }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`shrink-0 rounded-full p-1 ${done ? "bg-green-500/10" : "bg-muted"}`}>
                {done
                  ? <Check className="h-3.5 w-3.5 text-green-600" />
                  : <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />}
              </div>
              <span className={`flex-1 text-sm ${done ? "" : "text-muted-foreground"}`}>{label}</span>
              {!done && (
                <button onClick={() => onGoToTab(tab)} className="text-xs text-online hover:underline">
                  Compléter →
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Modifier les infos",  tab: "info" as StudioTab,    icon: FileText },
          { label: "Ajouter une leçon",   tab: "modules" as StudioTab, icon: Layers },
          { label: "Créer un quiz",       tab: "quiz" as StudioTab,    icon: HelpCircle },
        ].map(({ label, tab, icon: Icon }) => (
          <button key={label} onClick={() => onGoToTab(tab)}
            className="flex flex-col items-center gap-2 rounded-xl border p-4 text-xs hover:bg-accent transition">
            <Icon className="h-6 w-6 text-online/70" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Informations ──────────────────────────────────────────────────────────────

function InfoTab({ course }: { course: CourseDetail }) {
  const updateCourse = useUpdateCourse(course.id);
  const { data: categories = [] } = usePublicCategories();
  const [form, setForm] = useState({
    title:         course.title,
    subtitle:      course.subtitle ?? "",
    description:   course.description ?? "",
    audience:      course.audience ?? "",
    prerequisites: course.prerequisites ?? "",
    objectives:    (course.objectives ?? []).join("\n"),
    skills:        (course.skills ?? []).join("\n"),
    language:      course.language ?? "fr",
    level:         course.level ?? "",
    categoryId:    course.category?.id ?? "",
    mentionId:     course.mentionId ?? "",
  });

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));
  const flatCats = categories.flatMap(c => [c, ...(c.children ?? [])]);

  // Auto-save
  const { state, flush } = useAutoSave(
    form,
    useCallback(async (f) => {
      await updateCourse.mutateAsync({
        title: f.title, subtitle: f.subtitle || null, description: f.description || null,
        audience: f.audience || null, prerequisites: f.prerequisites || null,
        objectives: f.objectives.split("\n").map(s => s.trim()).filter(Boolean),
        skills: f.skills.split("\n").map(s => s.trim()).filter(Boolean),
        language: f.language, level: (f.level || null) as any,
        categoryId: f.categoryId || null,
        mentionId: f.mentionId || null,
      });
    }, []),
  );

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Les modifications sont sauvegardées automatiquement.</p>
        <SaveIndicator state={state} />
      </div>

      <Section title="Titre & Sous-titre">
        <Field label="Titre du cours *">
          <input value={form.title} onChange={e => set("title", e.target.value)} className={inp} />
        </Field>
        <Field label="Sous-titre">
          <input value={form.subtitle} onChange={e => set("subtitle", e.target.value)} className={inp} placeholder="Phrase d'accroche" />
        </Field>
      </Section>

      <Section title="Description">
        <textarea value={form.description} onChange={e => set("description", e.target.value)}
          rows={6} className={`${inp} h-auto py-2.5 resize-y`}
          placeholder="Description complète du cours…" />
      </Section>

      <Section title="Objectifs pédagogiques">
        <Field label="Objectifs (un par ligne)">
          <textarea value={form.objectives} onChange={e => set("objectives", e.target.value)}
            rows={4} className={`${inp} h-auto py-2.5 resize-y`} />
        </Field>
        <Field label="Compétences (une par ligne)">
          <textarea value={form.skills} onChange={e => set("skills", e.target.value)}
            rows={3} className={`${inp} h-auto py-2.5 resize-y`} />
        </Field>
      </Section>

      <Section title="Public & Prérequis">
        <Field label="Public visé">
          <textarea value={form.audience} onChange={e => set("audience", e.target.value)}
            rows={2} className={`${inp} h-auto py-2.5 resize-none`} />
        </Field>
        <Field label="Prérequis">
          <textarea value={form.prerequisites} onChange={e => set("prerequisites", e.target.value)}
            rows={2} className={`${inp} h-auto py-2.5 resize-none`} />
        </Field>
      </Section>

      <Section title="Classement">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Langue">
            <select value={form.language} onChange={e => set("language", e.target.value)} className={inp}>
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="mg">Malagasy</option>
            </select>
          </Field>
          <Field label="Niveau">
            <select value={form.level} onChange={e => set("level", e.target.value)} className={inp}>
              <option value="">— Non spécifié —</option>
              <option value="BEGINNER">Débutant</option>
              <option value="INTERMEDIATE">Intermédiaire</option>
              <option value="ADVANCED">Avancé</option>
            </select>
          </Field>
          <Field label="Mention *">
            <MentionSelect value={form.mentionId} onChange={v => set("mentionId", v)} className={inp} />
          </Field>
          <Field label="Catégorie">
            <CategorySelect value={form.categoryId} onChange={v => set("categoryId", v)} className={inp} />
          </Field>
        </div>
      </Section>

      <button onClick={flush} disabled={state === "saving"}
        className="flex items-center gap-2 rounded-lg grad-online px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Sauvegarder maintenant
      </button>
    </div>
  );
}

// ── Couverture ────────────────────────────────────────────────────────────────

function CoverTab({ course }: { course: CourseDetail }) {
  const [mediaLibOpen, setMediaLibOpen] = useState(false);
  const updateCourse = useUpdateCourse(course.id);
  const qc = useQueryClient();
  const { uploads: thumbUploads, uploadFile: uploadThumb, cancel: cancelThumb, remove: removeThumb } =
    useUploadManager(`/online/courses/${course.id}/upload-thumbnail`);
  const { uploads: previewUploads, uploadFile: uploadPreview, cancel: cancelPreview, remove: removePreview } =
    useUploadManager(`/online/courses/${course.id}/upload-preview`);
  const apiBase = "http://localhost:4000";

  const handleThumb = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Image requise (JPG, PNG, WebP)"); return; }
    uploadThumb(f, () => { qc.invalidateQueries({ queryKey: ["online", "course", course.id] }); });
  };

  const handlePreview = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) { toast.error("Vidéo requise (MP4, WebM)"); return; }
    uploadPreview(f, () => { qc.invalidateQueries({ queryKey: ["online", "course", course.id] }); });
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Thumbnail */}
      <Section title="Image de couverture">
        <p className="text-xs text-muted-foreground mb-3">1280×720 px (16:9) · JPG, PNG, WebP · max 5 Mo</p>
        {course.thumbnail ? (
          <div className="relative overflow-hidden rounded-xl border" style={{ aspectRatio: "16/9" }}>
            <img src={`${apiBase}${course.thumbnail}`} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/50 opacity-0 transition hover:opacity-100">
              <button onClick={() => setMediaLibOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-black">
                <Library className="h-3.5 w-3.5" /> Bibliothèque
              </button>
            </div>
          </div>
        ) : (
          <DropZone onFiles={handleThumb} accept="image/*" multiple={false}
            label="Glissez une image (16:9) ou cliquez pour parcourir"
            uploading={thumbUploads.some(u => u.status === "uploading")} />
        )}
        <UploadManagerUI uploads={thumbUploads} onCancel={cancelThumb} onRemove={removeThumb} />
        {course.thumbnail && (
          <div className="mt-2 flex gap-2">
            <DropZone onFiles={handleThumb} accept="image/*" multiple={false}
              label="Remplacer l'image" uploading={thumbUploads.some(u => u.status === "uploading")} />
            <button onClick={() => setMediaLibOpen(true)}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-accent">
              <Library className="h-4 w-4" /> Bibliothèque
            </button>
          </div>
        )}
      </Section>

      {/* Preview video */}
      <Section title="Vidéo de présentation (optionnelle)">
        <p className="text-xs text-muted-foreground mb-3">1–3 minutes pour convaincre · MP4 · max 200 Mo</p>
        {course.previewVideoUrl ? (
          <div className="space-y-3">
            <video src={`${apiBase}${course.previewVideoUrl}`} controls className="w-full rounded-xl border" style={{ maxHeight: 280 }} />
            <DropZone onFiles={handlePreview} accept="video/*" multiple={false}
              label="Remplacer la vidéo" uploading={previewUploads.some(u => u.status === "uploading")} />
          </div>
        ) : (
          <DropZone onFiles={handlePreview} accept="video/*" multiple={false}
            label="Glissez une vidéo MP4 ou cliquez pour parcourir"
            uploading={previewUploads.some(u => u.status === "uploading")} />
        )}
        <UploadManagerUI uploads={previewUploads} onCancel={cancelPreview} onRemove={removePreview} />
      </Section>

      {/* Media library modal */}
      {mediaLibOpen && (
        <MediaLibraryModal filter="IMAGE"
          onSelect={async (file) => {
            await updateCourse.mutateAsync({ thumbnail: file.url });
            toast.success("Couverture mise à jour depuis la bibliothèque");
          }}
          onClose={() => setMediaLibOpen(false)} />
      )}
    </div>
  );
}

// ── Modules & Leçons ──────────────────────────────────────────────────────────

function ModulesTab({
  course, onSelectLesson, selectedLessonId,
}: {
  course: CourseDetail;
  onSelectLesson: (l: CourseLesson, mid: string) => void;
  selectedLessonId?: string;
}) {
  return (
    <div className="max-w-2xl space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          {(course.modules ?? []).length} module(s) · {(course.modules ?? []).reduce((s, m) => s + (m.lessons ?? []).length, 0)} leçon(s)
        </p>
        <p className="text-xs text-muted-foreground">Glisser-déposer pour réordonner</p>
      </div>
      <ModuleTree
        courseId={course.id}
        modules={course.modules ?? []}
        onSelectLesson={onSelectLesson}
        selectedLessonId={selectedLessonId}
      />
    </div>
  );
}

// ── Lesson Editor ─────────────────────────────────────────────────────────────

function LessonEditorTab({ lesson, courseId }: { lesson: CourseLesson; courseId: string }) {
  const qc = useQueryClient();
  const [mediaLibOpen, setMediaLibOpen] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [allowDownload, setAllowDownload] = useState((lesson as any).allowDownload ?? true);
  const [isPreview, setIsPreview] = useState((lesson as any).isPreview ?? false);
  const { uploads, uploadFile, cancel, remove } = useUploadManager(`/online/studio/lessons/${lesson.id}/files/upload`);
  const apiBase = "http://localhost:4000";

  const { data: files = [], refetch: refetchFiles } = useQuery({
    queryKey: ["lesson-files", lesson.id],
    queryFn: () => api<any[]>(`/online/studio/lessons/${lesson.id}/files`),
  });

  const updateLesson = useMutation({
    mutationFn: (patch: any) => api(`/online/lessons/${lesson.id}`, { method: "PATCH", body: patch }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["online", "course", courseId] }); toast.success("Leçon sauvegardée"); },
  });

  const deleteFile = useMutation({
    mutationFn: (fileId: string) => api(`/online/studio/lesson-files/${fileId}`, { method: "DELETE" }),
    onSuccess: () => refetchFiles(),
  });

  // Auto-save for title
  const { state, flush } = useAutoSave(
    title,
    useCallback(async (t) => {
      await updateLesson.mutateAsync({ title: t });
    }, []),
  );

  const handleUpload = (fs: File[]) => {
    for (const f of fs) {
      uploadFile(f, () => { refetchFiles(); });
    }
  };

  const acceptAll = "image/*,video/*,audio/*,application/pdf,.pdf,.ppt,.pptx,.doc,.docx,.zip,.rar,.7z,.js,.ts,.py,.java,.c,.cpp,.cs,.go,.rs";

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Titre</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className={`${inp} text-base font-semibold`} />
        </div>
        <SaveIndicator state={state} />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={allowDownload}
            onChange={e => { setAllowDownload(e.target.checked); updateLesson.mutate({ allowDownload: e.target.checked }); }} />
          <Download className="h-4 w-4 text-muted-foreground" />
          Téléchargement autorisé
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={isPreview}
            onChange={e => { setIsPreview(e.target.checked); updateLesson.mutate({ isPreview: e.target.checked }); }} />
          <Eye className="h-4 w-4 text-emerald-500" />
          Aperçu gratuit
          <span className="text-xs text-muted-foreground">(visible sans inscription)</span>
        </label>
      </div>

      {/* Primary content (legacy single file) */}
      {lesson.contentUrl && (
        <Section title="Contenu principal">
          <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
            <Film className="h-5 w-5 shrink-0 text-online" />
            <span className="flex-1 truncate text-sm">{lesson.contentUrl.split("/").pop()}</span>
            <a href={`${apiBase}${lesson.contentUrl}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-online hover:underline">Voir</a>
          </div>
        </Section>
      )}

      {/* Multiple files */}
      <Section title={`Fichiers joints (${files.length})`}>
        {files.length > 0 && (
          <div className="mb-3 space-y-2">
            {files.map((f: any) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <div className="h-8 w-8 shrink-0 rounded-lg bg-muted grid place-items-center">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-xs font-medium">{f.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {(f.size / 1024).toFixed(0)} KB · {f.mimeType}
                  </div>
                </div>
                <a href={`${apiBase}${f.url}`} target="_blank" rel="noopener noreferrer"
                  className="rounded border px-2 py-1 text-[10px] hover:bg-accent">Voir</a>
                <button onClick={() => deleteFile.mutate(f.id)}
                  className="rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <UploadManagerUI uploads={uploads} onCancel={cancel} onRemove={remove} />
        <div className="mt-2 flex gap-2">
          <DropZone onFiles={handleUpload} accept={acceptAll}
            label="Glissez des fichiers ou cliquez — image, vidéo, PDF, Word, PPT, ZIP, audio, code…"
            uploading={uploads.some(u => u.status === "uploading")} />
          <button onClick={() => setMediaLibOpen(true)}
            className="flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-5 text-xs text-muted-foreground hover:bg-accent">
            <Library className="h-5 w-5" />
            Bibliothèque
          </button>
        </div>
      </Section>

      {/* Text body for TEXT lessons */}
      {lesson.type === "TEXT" && (
        <Section title="Contenu textuel">
          <TextBody lesson={lesson} courseId={courseId} />
        </Section>
      )}

      {mediaLibOpen && (
        <MediaLibraryModal
          onSelect={async (file) => {
            await api(`/online/studio/lessons/${lesson.id}/files/upload`, {
              method: "POST",
              body: { name: file.name, url: file.url, mimeType: file.mimeType ?? "application/octet-stream", size: file.size ?? 0 },
            });
            refetchFiles();
            toast.success("Fichier ajouté depuis la bibliothèque");
          }}
          onClose={() => setMediaLibOpen(false)} />
      )}
    </div>
  );
}

function TextBody({ lesson, courseId }: { lesson: CourseLesson; courseId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState(lesson.body ?? "");
  const updateLesson = useMutation({
    mutationFn: (patch: any) => api(`/online/lessons/${lesson.id}`, { method: "PATCH", body: patch }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["online", "course", courseId] }); },
  });
  const { state, flush } = useAutoSave(body, useCallback(async (b) => { await updateLesson.mutateAsync({ body: b }); }, []));
  return (
    <div className="space-y-2">
      <div className="flex justify-end"><SaveIndicator state={state} /></div>
      <textarea value={body} onChange={e => setBody(e.target.value)}
        rows={12} className={`${inp} h-auto resize-y`} placeholder="Rédigez le contenu…" />
      <button onClick={flush} disabled={state === "saving"}
        className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60">
        {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Sauvegarder
      </button>
    </div>
  );
}

// ── Quiz ─────────────────────────────────────────────────────────────────────

function QuizTab({ course }: { course: CourseDetail }) {
  return (
    <div className="max-w-3xl">
      <QuizBuilder courseId={course.id} onDone={() => {}} />
    </div>
  );
}

// ── Devoirs ───────────────────────────────────────────────────────────────────

function AssignmentsTab({ course }: { course: CourseDetail }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["online", "course", course.id, "assignments"],
    queryFn: () => api<any[]>(`/online/courses/${course.id}/assignments`),
  });
  const create = useMutation({
    mutationFn: (b: any) => api(`/online/courses/${course.id}/assignments`, { method: "POST", body: b }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "course", course.id, "assignments"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/online/assignments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "course", course.id, "assignments"] }),
  });
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", maxScore: 100, peerReview: false });
  const [files, setFiles] = useState<File[]>([]);
  const [show, setShow] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["online", "course", course.id, "assignments"] });

  // Fichiers d'exercices (énoncés, données…) joints au devoir
  async function attach(assignmentId: string, list: File[]) {
    setUploading(assignmentId);
    try {
      for (const f of list) {
        const fd = new FormData();
        fd.append("file", f);
        await api(`/online/assignments/${assignmentId}/attachments`, { method: "POST", body: fd, raw: true });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Envoi du fichier impossible");
    } finally {
      setUploading(null);
      refresh();
    }
  }
  async function detach(assignmentId: string, url: string) {
    await api(`/online/assignments/${assignmentId}/attachments?url=${encodeURIComponent(url)}`, { method: "DELETE" });
    refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const created: any = await create.mutateAsync({ ...form, maxScore: Number(form.maxScore) });
    if (files.length && created?.id) await attach(created.id, files);
    setForm({ title: "", description: "", dueDate: "", maxScore: 100, peerReview: false });
    setFiles([]);
    setShow(false);
    toast.success("Devoir créé");
  }

  return (
    <div className="max-w-2xl space-y-4">
      <button onClick={() => setShow(p => !p)} className="flex items-center gap-2 rounded-lg grad-online px-4 py-2 text-sm font-medium text-white">
        <Plus className="h-4 w-4" /> Nouveau devoir
      </button>
      {show && (
        <form onSubmit={handleCreate} className="rounded-xl border bg-card p-4 space-y-3">
          <Field label="Titre *"><input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className={inp} required /></Field>
          <Field label="Instructions">
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className={`${inp} h-auto resize-none py-2.5`} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date limite"><input type="datetime-local" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} className={inp} /></Field>
            <Field label="Score max"><input type="number" value={form.maxScore} onChange={e => setForm(p => ({ ...p, maxScore: Number(e.target.value) }))} className={inp} /></Field>
          </div>
          <Field label="Fichiers d'exercices (optionnel)">
            <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-online/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-online" />
            {files.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{files.length} fichier(s) : {files.map(f => f.name).join(", ")}</p>}
          </Field>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-dashed bg-muted/20 p-3">
            <input type="checkbox" checked={form.peerReview} onChange={e => setForm(p => ({ ...p, peerReview: e.target.checked }))} className="mt-0.5 rounded" />
            <span>
              <span className="block text-sm font-medium">Évaluation par les pairs</span>
              <span className="block text-xs text-muted-foreground">Les étudiants ayant rendu leur devoir évaluent anonymement les soumissions de leurs camarades (note + commentaire).</span>
            </span>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={create.isPending || !!uploading || !form.title} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60">{uploading ? "Envoi des fichiers…" : "Créer"}</button>
            <button type="button" onClick={() => setShow(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Annuler</button>
          </div>
        </form>
      )}
      <div className="space-y-2">
        {data?.map((a: any) => (
          <div key={a.id} className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-online" />
            <div className="flex-1">
              <div className="font-medium text-sm">{a.title}</div>
              <div className="text-xs text-muted-foreground">
                {a.dueDate ? `Rendu le ${new Date(a.dueDate).toLocaleDateString("fr")}` : "Pas de date limite"}
              </div>
              <div className="mt-2 space-y-1">
                {(a.attachments ?? []).map((f: { name: string; url: string }) => (
                  <div key={f.url} className="flex items-center gap-2 text-xs">
                    <a href={`http://localhost:4000${f.url}`} target="_blank" rel="noreferrer" className="truncate text-online hover:underline">📎 {f.name}</a>
                    <button onClick={() => detach(a.id, f.url)} className="text-muted-foreground hover:text-destructive" title="Retirer"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-online hover:underline">
                  {uploading === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Joindre un fichier d'exercice
                  <input type="file" multiple className="hidden" onChange={e => { const l = Array.from(e.target.files ?? []); e.target.value = ""; if (l.length) attach(a.id, l); }} />
                </label>
              </div>
            </div>
            <button onClick={() => { if (confirm("Supprimer ?")) del.mutate(a.id); }} className="rounded p-1 hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          </div>
        ))}
        {!data?.length && <EmptyState icon={ClipboardList} text="Aucun devoir." />}
      </div>
    </div>
  );
}

// ── Sessions ──────────────────────────────────────────────────────────────────

function SessionsTab({ course }: { course: CourseDetail }) {
  const { data } = useCourseLiveSessions(course.id);
  const create = useCreateLiveSession(course.id);
  const del = useDeleteLiveSession();
  const [form, setForm] = useState({ title: "", description: "", scheduledAt: "", durationMin: 60, link: "" });
  const [show, setShow] = useState(false);

  const STATUS_COLOR: Record<string, string> = {
    SCHEDULED: "bg-blue-500/10 text-blue-600",
    LIVE: "bg-green-500/10 text-green-600",
    DONE: "bg-muted text-muted-foreground",
    CANCELLED: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="max-w-2xl space-y-4">
      <button onClick={() => setShow(p => !p)} className="flex items-center gap-2 rounded-lg grad-online px-4 py-2 text-sm font-medium text-white">
        <Plus className="h-4 w-4" /> Nouvelle session live
      </button>
      {show && (
        <form onSubmit={async e => {
          e.preventDefault();
          await create.mutateAsync({ ...form, durationMin: Number(form.durationMin) });
          setForm({ title: "", description: "", scheduledAt: "", durationMin: 60, link: "" });
          setShow(false);
          toast.success("Session créée");
        }} className="rounded-xl border bg-card p-4 space-y-3">
          <Field label="Titre *">
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className={inp} placeholder="Ex : Correction du TP 3 en direct" required />
          </Field>
          <Field label="Description / programme de la séance">
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={3}
              className={`${inp} h-auto py-2.5 resize-none`}
              placeholder="Ce que les étudiants doivent préparer, les points abordés…"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date & heure *"><input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))} className={inp} required /></Field>
            <Field label="Durée">
              <select value={form.durationMin} onChange={e => setForm(p => ({ ...p, durationMin: Number(e.target.value) }))} className={inp}>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 h</option>
                <option value={90}>1 h 30</option>
                <option value={120}>2 h</option>
                <option value={180}>3 h</option>
              </select>
            </Field>
          </div>
          <Field label="Lien visioconférence (optionnel)">
            <input value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} className={inp} placeholder="https://meet.google.com/… ou https://zoom.us/…" />
          </Field>
          <p className="rounded-lg bg-online/5 border border-online/20 px-3 py-2 text-xs text-muted-foreground">
            💡 Le <span className="font-medium text-online">Tableau interactif intégré</span> (dessin collaboratif, présentation, voix, chat) est toujours disponible via le bouton « Tableau » — le lien externe n'est utile que si vous préférez Zoom/Meet en plus.
            Les étudiants inscrits reçoivent une notification à la création.
          </p>
          <div className="flex gap-2">
            <button type="submit" disabled={create.isPending || !form.title || !form.scheduledAt} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60">
              {create.isPending ? "Création…" : "Créer et notifier les étudiants"}
            </button>
            <button type="button" onClick={() => setShow(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Annuler</button>
          </div>
        </form>
      )}
      <div className="space-y-2">
        {data?.map(s => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
            <Calendar className="h-5 w-5 shrink-0 text-online" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{s.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[s.status] ?? ""}`}>{s.status}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(s.scheduledAt).toLocaleString("fr")} · {s.durationMin} min
                {s.link && <> · <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-online hover:underline">Rejoindre</a></>}
              </div>
              {s.description && (
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">{s.description}</div>
              )}
            </div>
            <Link
              to="/online/live/$sessionId"
              params={{ sessionId: s.id }}
              className="flex items-center gap-1.5 rounded-lg border border-online/30 bg-online/5 px-3 py-1.5 text-xs font-medium text-online hover:bg-online/10 transition"
            >
              <Globe className="h-3.5 w-3.5" /> Tableau
            </Link>
            <button onClick={() => { if (confirm("Supprimer ?")) del.mutate(s.id); }} className="rounded p-1 hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          </div>
        ))}
        {!data?.length && <EmptyState icon={Calendar} text="Aucune session planifiée." />}
      </div>
    </div>
  );
}

// ── Étudiants ─────────────────────────────────────────────────────────────────

function StudentsTab({ course }: { course: CourseDetail }) {
  const { data, isLoading } = useCourseStudents(course.id);
  if (isLoading) return <Spinner />;
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">{data?.total ?? 0} étudiant(s) inscrit(s)</p>
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Étudiant</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Progression</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Inscrit le</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data?.items.map(e => (
              <tr key={e.id} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 shrink-0 rounded-full grad-online grid place-items-center text-xs font-semibold text-white">
                      {e.studentId.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm">{e.studentId.slice(0, 8)}…</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div className="h-full grad-online" style={{ width: `${e.progress}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{Math.round(e.progress)}%</span>
                    {e.completedAt && <Award className="h-3.5 w-3.5 text-yellow-500" aria-label="Complété" />}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleDateString("fr")}
                </td>
              </tr>
            ))}
            {!data?.items.length && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun étudiant inscrit.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Statistiques enrichies ────────────────────────────────────────────────────

function AnalyticsTab({ course }: { course: CourseDetail }) {
  const { data, isLoading } = useQuery({
    queryKey: ["online", "course", course.id, "analytics-enhanced"],
    queryFn: () => api<any>(`/online/studio/courses/${course.id}/analytics/enhanced`),
  });
  if (isLoading) return <Spinner />;
  if (!data) return null;

  return (
    <div className="max-w-2xl space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Inscrits",       value: data.enrollments,      color: "text-online" },
          { label: "Complétés",      value: data.completed,        color: "text-green-500" },
          { label: "Taux complétion", value: `${data.completionRate}%`, color: "text-purple-500" },
          { label: "Progression moy.", value: `${data.avgProgress}%`, color: "text-blue-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Top lessons */}
      {data.topLessons?.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Leçons les plus consultées</h3>
          <div className="space-y-2">
            {data.topLessons.map((l: any, i: number) => (
              <div key={l.id} className="flex items-center gap-3 rounded-lg border p-3">
                <span className="shrink-0 text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{l.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.views} vue(s) · {l.avgWatchedMin} min moy. · {l.completionRate}% taux
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {l.dropoutRate > 50
                    ? <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                    : <TrendingUp className="h-3.5 w-3.5 text-green-500" />}
                  <span className={l.dropoutRate > 50 ? "text-destructive" : "text-green-600"}>
                    {l.dropoutRate}% abandon
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All lessons */}
      {data.allLessonStats?.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
            Toutes les leçons
          </div>
          <table className="w-full text-xs">
            <thead className="border-b">
              <tr>
                <th className="px-4 py-2 text-left text-muted-foreground">Leçon</th>
                <th className="px-4 py-2 text-right text-muted-foreground">Vues</th>
                <th className="px-4 py-2 text-right text-muted-foreground">Moy.</th>
                <th className="px-4 py-2 text-right text-muted-foreground">Taux</th>
                <th className="px-4 py-2 text-right text-muted-foreground">Abandon</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.allLessonStats.map((l: any) => (
                <tr key={l.id} className="hover:bg-muted/10">
                  <td className="px-4 py-2.5 truncate max-w-[200px]">{l.title}</td>
                  <td className="px-4 py-2.5 text-right">{l.views}</td>
                  <td className="px-4 py-2.5 text-right">{l.avgWatchedMin}m</td>
                  <td className="px-4 py-2.5 text-right text-green-600">{l.completionRate}%</td>
                  <td className={`px-4 py-2.5 text-right ${l.dropoutRate > 50 ? "text-destructive" : ""}`}>{l.dropoutRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Paramètres ────────────────────────────────────────────────────────────────

function SettingsTab({ course }: { course: CourseDetail }) {
  const updateCourse = useUpdateCourse(course.id);
  const [form, setForm] = useState({
    hasCertificate: course.hasCertificate,
    estimatedHours: course.estimatedHours ?? "",
    cursus: cursusValueOf(course),
  });
  const { state, flush } = useAutoSave(
    form,
    useCallback(async (f) => {
      // Tant que niveau et mois ne sont pas choisis, on n'enregistre pas le cursus.
      if (cursusIncomplete(f.cursus)) throw new Error("Choisissez le niveau (L1…) et le mois du cursus avant d'enregistrer");
      await updateCourse.mutateAsync({
        hasCertificate: f.cursus.courseKind === "UNIVERSITY" ? false : f.hasCertificate,
        estimatedHours: f.estimatedHours ? Number(f.estimatedHours) : null,
        ...cursusPayload(f.cursus),
      });
    }, []),
  );
  const university = form.cursus.courseKind === "UNIVERSITY";

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Sauvegarde automatique active.</p>
        <SaveIndicator state={state} />
      </div>

      <Section title="Cursus universitaire / cours certifiant">
        <CursusFields value={form.cursus} courseId={course.id} onChange={(cursus) => setForm(p => ({ ...p, cursus }))} />
        {cursusIncomplete(form.cursus) && (
          <p className="mt-2 text-xs text-amber-600">Choisissez le niveau et le mois pour enregistrer.</p>
        )}
      </Section>

      {!university && <Section title="Certificat">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={form.hasCertificate}
            onChange={e => setForm(p => ({ ...p, hasCertificate: e.target.checked }))} className="mt-0.5 rounded" />
          <div>
            <div className="text-sm font-medium">Délivrer un certificat</div>
            <div className="text-xs text-muted-foreground">
              Délivré automatiquement à la fin du cours.
            </div>
          </div>
        </label>
      </Section>}

      <Section title="Durée & Prix">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Durée estimée (heures)">
            <input type="number" min={0} step={0.5} value={form.estimatedHours}
              onChange={e => setForm(p => ({ ...p, estimatedHours: e.target.value }))} className={inp} />
          </Field>
          {<Field label={university ? "Prix pour les non-étudiants" : "Prix de vente"}>
            <div className={`${inp} flex items-center bg-muted/40 text-muted-foreground`}>
              {(course.price ?? 0) > 0 ? `${(course.price ?? 0).toLocaleString("fr-FR")} MGA` : "Gratuit"} — fixé par le Super Admin
            </div>
          </Field>}
        </div>
      </Section>

      <button onClick={flush} disabled={state === "saving"}
        className="flex items-center gap-2 rounded-lg grad-online px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Sauvegarder maintenant
      </button>
    </div>
  );
}

// ── Live Preview Modal ────────────────────────────────────────────────────────

function LivePreviewModal({ course, onClose }: { course: CourseDetail; onClose: () => void }) {
  const apiBase = "http://localhost:4000";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-background shadow-2xl">
        <div className="flex items-center gap-3 border-b px-5 py-3">
          <Eye className="h-4 w-4 text-online" />
          <span className="text-sm font-semibold">Prévisualisation — vue étudiant</span>
          <span className="flex-1" />
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Hero */}
            <div className="overflow-hidden rounded-2xl border" style={{ aspectRatio: "16/9" }}>
              {course.thumbnail
                ? <img src={`${apiBase}${course.thumbnail}`} alt="" className="h-full w-full object-cover" />
                : <div className="flex h-full items-center justify-center bg-muted"><Image className="h-12 w-12 text-muted-foreground/30" /></div>}
            </div>
            {/* Info */}
            <div>
              <h1 className="text-2xl font-bold">{course.title}</h1>
              {course.subtitle && <p className="mt-1 text-muted-foreground">{course.subtitle}</p>}
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                {course.level && <span className="rounded-full border px-3 py-1">{course.level}</span>}
                {course.language && <span className="rounded-full border px-3 py-1">{course.language.toUpperCase()}</span>}
                {course.estimatedHours && <span className="rounded-full border px-3 py-1"><Clock className="inline h-3.5 w-3.5 mr-1" />{course.estimatedHours}h</span>}
              </div>
            </div>
            {/* Description */}
            {course.description && (
              <div>
                <h2 className="mb-2 text-base font-semibold">À propos</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{course.description}</p>
              </div>
            )}
            {/* Objectives */}
            {(course.objectives ?? []).length > 0 && (
              <div>
                <h2 className="mb-2 text-base font-semibold">Objectifs</h2>
                <ul className="space-y-1">
                  {(course.objectives ?? []).map((o, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />{o}</li>
                  ))}
                </ul>
              </div>
            )}
            {/* Curriculum preview */}
            {(course.modules ?? []).length > 0 && (
              <div>
                <h2 className="mb-2 text-base font-semibold">Programme</h2>
                <div className="space-y-2">
                  {(course.modules ?? []).map((m, i) => (
                    <div key={m.id} className="rounded-xl border p-4">
                      <div className="font-medium text-sm">Module {i + 1} — {m.title}</div>
                      <div className="mt-2 space-y-1">
                        {m.lessons.map(l => (
                          <div key={l.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Film className="h-3 w-3 shrink-0" /> {l.title}
                            <span className="rounded bg-muted px-1.5 py-0.5">🔒</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const inp = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
      <Icon className="mx-auto mb-2 h-8 w-8 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-online" />
    </div>
  );
}

function FullLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-online" />
    </div>
  );
}
