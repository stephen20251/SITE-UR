import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Play, Award, BarChart2, BookOpen, FileQuestion, Video, FileText, AlignLeft,
  Calendar, Activity, Flame, ArrowRight, CheckCircle2, Clock, ChevronRight, Zap, Star, Square,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/lib/auth";
import {
  useMyEnrollments, useCertificates, useMyPendingQuizzes, useMyPendingAssignments,
  useMyLiveSessions, useMyActivity, usePathsForMe, useStudentStats, useRecommendations,
  useWeeklyActivity,
  type Enrollment, type Certificate, type QuizListItem, type OnlineAssignment,
  type LiveSession, type LearningActivity,
} from "@/lib/online";
import { useRequireOnline, ProgressBar, OnlineNavbar } from "@/components/online/shared";
import { MyCursusBoard } from "@/components/online/cursus-online";
import { useMyCursus } from "@/lib/cursus";

const API_BASE = "http://localhost:4000";
function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

export const Route = createFileRoute("/online/dashboard")({
  component: StudentDash,
});

// ─── Helpers ───
const pct = (n: number) => `${Math.round(n)}%`;
const avg = (items: Enrollment[]) =>
  items.length ? Math.round(items.reduce((s, e) => s + e.progress, 0) / items.length) : 0;
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const fromNow = (iso: string) => {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "à l'instant";
  if (diff < 60) return `il y a ${diff} min`;
  if (diff < 1440) return `il y a ${Math.round(diff / 60)}h`;
  return `il y a ${Math.round(diff / 1440)}j`;
};
const LESSON_ICON: Record<string, React.ReactNode> = {
  VIDEO: <Video size={12} />, PDF: <FileText size={12} />, TEXT: <AlignLeft size={12} />,
};
const ACTION_LABELS: Record<string, string> = {
  lesson_open: "Leçon ouverte", lesson_complete: "Leçon terminée",
  quiz_start: "Quiz commencé", quiz_complete: "Quiz terminé",
  assignment_submit: "Devoir soumis", certificate_earned: "Certificat obtenu",
  enrollment: "Inscription au cours",
};

// ─── Main ───
function StudentDash() {
  const { user, ready } = useRequireOnline("STUDENT_ONLINE");
  const { logout } = useAuth();
  const navigate = useNavigate();
  const enabled = ready && !!user;

  const enrollments = useMyEnrollments({ enabled });
  // Étudiant de l'UR : son cursus universitaire mois par mois, avec sa progression.
  const cursus = useMyCursus(enabled && user?.systemRole === "STUDENT");
  const certificates = useCertificates({ enabled });
  const pendingQuizzes = useMyPendingQuizzes({ enabled });
  const pendingAssignments = useMyPendingAssignments({ enabled });
  const liveSessions = useMyLiveSessions({ enabled });
  const activity = useMyActivity({ enabled });
  const paths = usePathsForMe({ enabled });
  const stats = useStudentStats({ enabled });
  const recos = useRecommendations({ enabled });
  const weekly = useWeeklyActivity({ enabled });

  // Last 7 days, zero-filled, French short weekday labels.
  const weekChart = useMemo(() => {
    const out: { day: string; full: string; n: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({
        day: d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""),
        full: d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
        n: weekly.data?.[key] ?? 0,
      });
    }
    return out;
  }, [weekly.data]);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Chargement…</div>;
  }

  const items = enrollments.data?.items ?? [];
  const inProgress = items.filter((e) => e.progress > 0 && !e.completedAt);
  const completed = items.filter((e) => e.completedAt);
  const certs = certificates.data ?? [];
  const quizzes = pendingQuizzes.data ?? [];
  const assignments = pendingAssignments.data ?? [];
  const sessions = liveSessions.data ?? [];
  const acts = activity.data ?? [];
  const allPaths = paths.data ?? [];

  // Hero: course to continue (lastVisitedAt or highest progress)
  const heroCourse = [...items]
    .sort((a, b) => {
      if (a.lastVisitedAt && b.lastVisitedAt)
        return new Date(b.lastVisitedAt).getTime() - new Date(a.lastVisitedAt).getTime();
      return b.progress - a.progress;
    })
    .find((e) => !e.completedAt) ?? items[0];

  // Recently visited (by lastVisitedAt)
  const recentlyVisited = [...items]
    .filter((e) => e.lastVisitedAt)
    .sort((a, b) => new Date(b.lastVisitedAt!).getTime() - new Date(a.lastVisitedAt!).getTime())
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      <OnlineNavbar />

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">

        {cursus.data && <MyCursusBoard overview={cursus.data} />}

        {/* ── Hero greeting + Continuer un cours ── */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col justify-between rounded-2xl grad-online p-6 text-white lg:col-span-2">
            <div>
              <p className="text-sm font-medium opacity-80">Bonjour 👋</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">{user.firstName} {user.lastName}</h1>
              <p className="mt-1 text-sm opacity-70">
                {items.length
                  ? `${inProgress.length} cours en cours · ${completed.length} terminé${completed.length > 1 ? "s" : ""}`
                  : "Parcourez le catalogue pour commencer à apprendre."}
              </p>
            </div>
            {heroCourse ? (
              <div className="mt-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider opacity-70">Continuer</p>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{heroCourse.course?.title}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 w-48 rounded-full bg-white/30">
                        <div className="h-full rounded-full bg-white" style={{ width: pct(heroCourse.progress) }} />
                      </div>
                      <span className="text-xs opacity-80">{pct(heroCourse.progress)}</span>
                    </div>
                  </div>
                  <Link
                    to="/online/course/$id"
                    params={{ id: heroCourse.courseId }}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium hover:bg-white/30 transition"
                  >
                    <Play size={14} /> Reprendre
                  </Link>
                </div>
              </div>
            ) : (
              <Link to="/online" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium hover:bg-white/30 w-fit">
                Explorer le catalogue <ArrowRight size={14} />
              </Link>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Cours suivis" value={items.length} icon={<BookOpen size={16} />} color="text-online" />
            <StatBox label="Terminés" value={completed.length} icon={<CheckCircle2 size={16} />} color="text-emerald-500" />
            <StatBox label="Certificats" value={certs.length} icon={<Award size={16} />} color="text-amber-500" />
            <StatBox label="Progression moy." value={`${stats.data?.progressionGlobale ?? avg(items)}%`} icon={<BarChart2 size={16} />} color="text-purple-500" />
          </div>
        </div>

        {/* ── Streak + Study time ── */}
        {stats.data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Streak */}
            <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
                <Flame size={20} className="text-orange-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.data.streak} <span className="text-base font-medium text-muted-foreground">j</span></div>
                <div className="text-xs text-muted-foreground">Série actuelle</div>
              </div>
            </div>

            {/* Today */}
            <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <Zap size={20} className="text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {stats.data.todayMinutes >= 60
                    ? `${Math.floor(stats.data.todayMinutes / 60)}h${stats.data.todayMinutes % 60 > 0 ? `${stats.data.todayMinutes % 60}min` : ""}`
                    : `${stats.data.todayMinutes}min`}
                </div>
                <div className="text-xs text-muted-foreground">Étude aujourd'hui</div>
              </div>
            </div>

            {/* Weekly goal */}
            <div className="col-span-2 flex flex-col justify-between rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Activity size={14} className="text-online" /> Objectif hebdomadaire
                </div>
                <span className="text-xs text-muted-foreground">
                  {stats.data.weekMinutes}min / {stats.data.weekGoalMinutes}min
                </span>
              </div>
              <div className="mt-3">
                <div className="mb-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full grad-online transition-all"
                    style={{ width: `${Math.min(100, Math.round((stats.data.weekMinutes / stats.data.weekGoalMinutes) * 100))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{Math.round((stats.data.weekMinutes / stats.data.weekGoalMinutes) * 100)}% de l'objectif atteint</span>
                  {stats.data.weekMinutes >= stats.data.weekGoalMinutes && (
                    <span className="font-medium text-emerald-500">🎉 Objectif atteint !</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Activité 7 jours (chart) ── */}
        <div className="rounded-2xl border bg-card p-5 shadow-elegant">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <BarChart2 size={15} className="text-online" /> Votre activité — 7 derniers jours
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Actions d'apprentissage par jour (leçons, quiz, devoirs)
              </p>
            </div>
            {stats.data && (
              <div className="flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-500">
                <Flame size={12} /> {stats.data.streak} j de série
              </div>
            )}
          </div>
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekChart} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                <XAxis dataKey="day" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} className="text-muted-foreground" />
                <YAxis stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} className="text-muted-foreground" />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
                  formatter={(v: number) => [`${v} action${v !== 1 ? "s" : ""}`, "Apprentissage"]}
                />
                <Bar dataKey="n" fill="var(--color-online)" radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Récemment consulté (Widget 2) ── */}
        {recentlyVisited.length > 0 && (
          <Section title="Derniers cours consultés" icon={<Clock size={16} />} href="/online">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recentlyVisited.map((e) => <RecentCard key={e.id} e={e} />)}
            </div>
          </Section>
        )}

        {/* ── Progression globale (Widget 3) ── */}
        {items.length > 0 && (
          <Section title="Progression globale" icon={<BarChart2 size={16} />}>
            <div className="space-y-3">
              {[...items].sort((a, b) => b.progress - a.progress).map((e) => (
                <Link
                  key={e.id}
                  to="/online/course/$id"
                  params={{ id: e.courseId }}
                  className="flex items-center gap-4 rounded-xl border bg-card p-3 hover:bg-muted/30 transition"
                >
                  {e.course?.thumbnail ? (
                    <img src={mediaUrl(e.course.thumbnail)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg grad-online" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{e.course?.title}</div>
                    <div className="mt-1.5"><ProgressBar value={e.progress} /></div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-online">{pct(e.progress)}</div>
                    {e.completedAt && <div className="text-xs text-emerald-600">✓ Terminé</div>}
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* ── Middle row: Devoirs + Quiz ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Widget 4 — Devoirs à rendre */}
          <Section title="Devoirs à rendre" icon={<FileText size={16} />} count={assignments.length}>
            {assignments.length === 0 ? (
              <Empty text="Aucun devoir en attente." />
            ) : (
              <div className="space-y-2">
                {assignments.slice(0, 4).map((a) => <AssignmentRow key={a.id} a={a} />)}
                {assignments.length > 4 && (
                  <p className="pt-1 text-xs text-muted-foreground">+{assignments.length - 4} autre{assignments.length - 4 > 1 ? "s" : ""}</p>
                )}
              </div>
            )}
          </Section>

          {/* Widget 5 — Quiz à terminer */}
          <Section title="Quiz à terminer" icon={<FileQuestion size={16} />} count={quizzes.length}>
            {quizzes.length === 0 ? (
              <Empty text="Aucun quiz en attente." />
            ) : (
              <div className="space-y-2">
                {quizzes.slice(0, 4).map((q) => <QuizRow key={q.id} q={q} />)}
                {quizzes.length > 4 && (
                  <p className="pt-1 text-xs text-muted-foreground">+{quizzes.length - 4} autre{quizzes.length - 4 > 1 ? "s" : ""}</p>
                )}
              </div>
            )}
          </Section>
        </div>

        {/* ── Calendrier des sessions live (Widget 7) ── */}
        <Section title="Sessions live" icon={<Calendar size={16} />} count={sessions.length}>
          {sessions.length === 0 ? (
            <Empty text="Aucune session prévue." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.slice(0, 6).map((s) => <SessionCard key={s.id} s={s} />)}
            </div>
          )}
        </Section>

        {/* ── Widget 6 — Certificats ── */}
        {certs.length > 0 && (
          <Section title="Certificats obtenus" icon={<Award size={16} />} count={certs.length}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {certs.map((c) => <CertCard key={c.id} c={c} />)}
            </div>
          </Section>
        )}

        {/* ── Widget 9 — Parcours recommandés ── */}
        {allPaths.length > 0 && (
          <Section title="Parcours de formation" icon={<Star size={16} />}>
            <div className="grid gap-4 sm:grid-cols-2">
              {allPaths.slice(0, 4).map((p) => <PathCard key={p.id} path={p} />)}
            </div>
          </Section>
        )}

        {/* ── Recommandations personnalisées ── */}
        {(recos.data ?? []).length > 0 && (
          <Section title="Recommandé pour vous" icon={<Zap size={16} />}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(recos.data ?? []).slice(0, 4).map((c) => (
                <Link
                  key={c.id}
                  to="/online/course/$id"
                  params={{ id: c.id }}
                  className="group overflow-hidden rounded-xl border bg-background transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-[16/9] overflow-hidden grad-online">
                    {c.thumbnail
                      ? <img src={mediaUrl(c.thumbnail)} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      : <div className="flex h-full items-center justify-center"><Play className="h-8 w-8 text-white/60" /></div>}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-2 text-xs font-semibold leading-snug group-hover:text-online transition-colors">{c.title}</div>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {(c.ratingCount ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <Star size={10} className="fill-amber-400 text-amber-400" /> {c.ratingAvg?.toFixed(1)}
                        </span>
                      )}
                      <span className="ml-auto font-semibold text-foreground">{(c.price ?? 0) > 0 ? `${c.price} MGA` : "Gratuit"}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* ── Widget 8 — Activité récente ── */}
        {acts.length > 0 && (
          <Section title="Activité récente" icon={<Activity size={16} />}>
            <div className="space-y-1">
              {acts.slice(0, 8).map((a) => <ActivityRow key={a.id} a={a} />)}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───

function Section({
  title, icon, count, href, children,
}: {
  title: string; icon: React.ReactNode; count?: number; href?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-elegant">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="text-online">{icon}</span>
          {title}
          {count !== undefined && count > 0 && (
            <span className="rounded-full bg-online/10 px-2 py-0.5 text-xs font-semibold text-online">{count}</span>
          )}
        </div>
        {href && (
          <Link to={href} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            Voir tout <ChevronRight size={12} />
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatBox({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex flex-col justify-between rounded-xl border bg-card p-4">
      <div className={`${color}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function RecentCard({ e }: { e: Enrollment }) {
  return (
    <Link to="/online/course/$id" params={{ id: e.courseId }}
      className="group flex items-center gap-3 rounded-xl border bg-background p-3 hover:border-online/30 hover:bg-online/5 transition">
      {e.course?.thumbnail ? (
        <img src={mediaUrl(e.course.thumbnail)} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="h-10 w-10 shrink-0 rounded-lg grad-online opacity-70" />
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium group-hover:text-online transition">{e.course?.title}</div>
        <div className="mt-1"><ProgressBar value={e.progress} /></div>
        <div className="mt-0.5 text-xs text-muted-foreground">{e.lastVisitedAt ? fromNow(e.lastVisitedAt) : ""}</div>
      </div>
    </Link>
  );
}

function AssignmentRow({ a }: { a: OnlineAssignment }) {
  const due = new Date(a.dueDate);
  const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
  const urgent = daysLeft <= 2;
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background p-3">
      <div className={`shrink-0 rounded-lg p-2 ${urgent ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
        <FileText size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{a.title}</div>
        <div className="text-xs text-muted-foreground">{a.course?.title}</div>
      </div>
      <div className={`shrink-0 text-right text-xs font-medium ${urgent ? "text-red-600" : "text-amber-600"}`}>
        {daysLeft === 0 ? "Auj." : daysLeft === 1 ? "Demain" : `${daysLeft}j`}
      </div>
    </div>
  );
}

function QuizRow({ q }: { q: QuizListItem }) {
  return (
    <Link
      to="/online/course/$id"
      params={{ id: q.course?.id ?? "" }}
      className="flex items-center gap-3 rounded-xl border bg-background p-3 hover:border-online/30 hover:bg-online/5 transition"
    >
      <div className="shrink-0 rounded-lg bg-purple-100 p-2 text-purple-600">
        <FileQuestion size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{q.title}</div>
        <div className="text-xs text-muted-foreground">{q.course?.title} · {q.questionCount} questions</div>
      </div>
      {q.attempted && <span className="shrink-0 text-xs text-amber-600 font-medium">À réessayer</span>}
    </Link>
  );
}

function SessionCard({ s }: { s: LiveSession }) {
  const isLive = s.status === "LIVE";
  return (
    <div className={`rounded-xl border p-4 ${isLive ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20" : "bg-background"}`}>
      {isLive && (
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> LIVE
        </div>
      )}
      <div className="font-medium text-sm">{s.title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{s.course?.title}</div>
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-1"><Calendar size={10} /> {dayLabel(s.scheduledAt)}</div>
          <div className="flex items-center gap-1 mt-0.5"><Clock size={10} /> {timeLabel(s.scheduledAt)} · {s.durationMin} min</div>
        </div>
        <div className="flex items-center gap-1.5">
          {s.link && (
            <a href={s.link} target="_blank" rel="noopener noreferrer"
              className="rounded-lg bg-online px-3 py-1.5 text-xs font-medium text-white hover:bg-online/90 transition">
              Rejoindre
            </a>
          )}
          <Link
            to="/online/live/$sessionId"
            params={{ sessionId: s.id }}
            className="inline-flex items-center gap-1 rounded-lg border border-purple-400/40 bg-purple-500/10 px-2.5 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-500/20 transition dark:text-purple-400"
          >
            <Square size={11} className="shrink-0" /> Tableau
          </Link>
        </div>
      </div>
    </div>
  );
}

function CertCard({ c }: { c: Certificate }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-4 bg-background">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-100">
        <Award size={18} className="text-amber-600" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{c.course?.title ?? "Certificat"}</div>
        <div className="text-xs text-muted-foreground">{dayLabel(c.issuedAt)} · {c.code}</div>
      </div>
    </div>
  );
}

function PathCard({ path }: { path: import("@/lib/online").LearningPath }) {
  const total = path.steps.length;
  const done = path.steps.filter((s) => s.enrollment?.completedAt).length;
  return (
    <Link to="/online" className="group flex gap-4 rounded-xl border bg-background p-4 hover:border-online/30 hover:bg-online/5 transition">
      {path.thumbnail ? (
        <img src={mediaUrl(path.thumbnail)} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="h-14 w-14 shrink-0 rounded-xl grad-online grid place-items-center">
          <Flame size={20} className="text-white" />
        </div>
      )}
      <div className="min-w-0">
        <div className="font-semibold text-sm group-hover:text-online transition">{path.title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{path.description}</div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-muted">
            <div className="h-full rounded-full bg-online" style={{ width: total ? `${(done / total) * 100}%` : "0%" }} />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{done}/{total} cours</span>
        </div>
      </div>
    </Link>
  );
}

function ActivityRow({ a }: { a: LearningActivity }) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-muted/30 transition">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-online/10 text-online">
        {LESSON_ICON[a.lesson?.type ?? ""] ?? <Activity size={12} />}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-sm">
          <span className="font-medium">{ACTION_LABELS[a.action] ?? a.action}</span>
          {a.lesson && <span className="text-muted-foreground"> · {a.lesson.title}</span>}
          {!a.lesson && a.course && <span className="text-muted-foreground"> · {a.course.title}</span>}
        </span>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{fromNow(a.createdAt)}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-4 text-center text-sm text-muted-foreground">{text}</p>;
}
