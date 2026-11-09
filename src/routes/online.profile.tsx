import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  GraduationCap, BookOpen, Award, TrendingUp, Clock, CheckCircle2,
  Play, FileText, BarChart2, ChevronRight, Star, CalendarDays,
  Bookmark, BookmarkCheck, MessageCircle, Heart,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  useMyEnrollments, useCertificates, useMyActivity, useLessonNotes,
  useWishlist, useToggleWishlist, useMyGamification, useLeaderboard,
  type Enrollment, type Certificate, type LearningActivity, type LessonNote,
} from "@/lib/online";
import { useMyPayments, useRequestRefund } from "@/lib/payments";
import { OnlineNavbar, ProgressBar, initials, useRequireOnline, effectiveOnlineRole } from "@/components/online/shared";
import { MyInfoCard, roleLabel } from "@/components/online/my-info";
import { PaymentStatusBadge } from "@/components/online/payment-modal";
import { toast } from "sonner";
import { API_ORIGIN } from "@/lib/env";
import { ChangePasswordCard } from "@/components/account-password";

export const Route = createFileRoute("/online/profile")({
  head: () => ({ meta: [{ title: "Mon profil — UR Online" }] }),
  component: ProfilePage,
});

const API_BASE = API_ORIGIN;
function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

function fmtDate(d: string) {
  return format(new Date(d), "d MMM yyyy", { locale: fr });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ProfilePage() {
  // Profil ouvert à tous les comptes de la plateforme en ligne ; les sections
  // d'apprentissage (cours, certificats, paiements…) concernent les apprenants.
  const { user } = useRequireOnline();
  const isLearner = effectiveOnlineRole(user) === "STUDENT_ONLINE";

  const { data: enrollmentsPage, isLoading: loadingEnroll } = useMyEnrollments({ enabled: isLearner });
  const { data: certificates = [], isLoading: loadingCerts } = useCertificates({ enabled: isLearner });
  const { data: activity = [] } = useMyActivity({ enabled: isLearner });

  const enrollments = enrollmentsPage?.items ?? [];

  const completed = enrollments.filter((e) => e.completedAt);
  const inProgress = enrollments.filter((e) => !e.completedAt);
  const avgProgress = enrollments.length
    ? Math.round(enrollments.reduce((s, e) => s + e.progress, 0) / enrollments.length)
    : 0;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <OnlineNavbar />

      {/* ── Profile hero ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-slate-900 to-purple-950">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-900/90 to-purple-900/80" />
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
            {/* Avatar */}
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-3xl font-extrabold text-white shadow-2xl ring-4 ring-white/20">
              {initials(user.firstName, user.lastName)}
            </div>

            {/* Info */}
            <div className="flex-1 text-white">
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-0.5 text-xs font-medium text-white/80">
                <Star className="h-3 w-3 text-yellow-400" />
                {roleLabel(user.systemRole)}
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {user.firstName} {user.lastName}
              </h1>
              <div className="mt-0.5 text-sm text-white/60">{user.email}</div>

              {/* Mini stats */}
              {isLearner && <div className="mt-4 flex flex-wrap justify-center gap-5 sm:justify-start">
                {[
                  { label: "Cours suivis", value: enrollments.length, icon: BookOpen },
                  { label: "Complétés", value: completed.length, icon: CheckCircle2 },
                  { label: "Certificats", value: certificates.length, icon: Award },
                  { label: "Progression moy.", value: `${avgProgress}%`, icon: TrendingUp },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="text-center sm:text-left">
                    <div className="flex items-center gap-1.5 text-lg font-bold text-white">
                      <Icon className="h-4 w-4 text-violet-400" />
                      {value}
                    </div>
                    <div className="text-xs text-white/50">{label}</div>
                  </div>
                ))}
              </div>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8"><MyInfoCard /></div>
        <div className="mb-8"><ChangePasswordCard /></div>
        {isLearner && <div className="grid gap-8 lg:grid-cols-3">

          {/* ── Left: Courses ──────────────────── */}
          <div className="lg:col-span-2 space-y-8">

            {/* In-progress */}
            <section>
              <SectionHeader
                icon={Play}
                title="Cours en cours"
                count={inProgress.length}
                linkTo="/online/dashboard"
              />
              {loadingEnroll ? (
                <ListSkeleton count={3} />
              ) : inProgress.length === 0 ? (
                <EmptyCard message="Aucun cours en cours. Explorez le catalogue !" />
              ) : (
                <div className="space-y-3">
                  {inProgress.map((e) => <EnrollmentCard key={e.id} e={e} />)}
                </div>
              )}
            </section>

            {/* Completed */}
            {completed.length > 0 && (
              <section>
                <SectionHeader
                  icon={CheckCircle2}
                  title="Cours terminés"
                  count={completed.length}
                />
                <div className="space-y-3">
                  {completed.map((e) => <EnrollmentCard key={e.id} e={e} done />)}
                </div>
              </section>
            )}

            {/* Payments & refunds */}
            <PaymentsSection />

            {/* Wishlist */}
            <WishlistSection />

            {/* My notes & bookmarks */}
            <MyNotesSection />

            {/* Recent activity */}
            {activity.length > 0 && (
              <section>
                <SectionHeader icon={CalendarDays} title="Activité récente" />
                <div className="overflow-hidden rounded-xl border bg-card shadow-elegant divide-y">
                  {activity.slice(0, 8).map((a) => (
                    <ActivityRow key={a.id} a={a} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── Right: Certificates ────────────── */}
          <div className="space-y-6">
            {/* Gamification */}
            <GamificationCard />

            <section>
              <SectionHeader icon={Award} title="Certificats" count={certificates.length} />
              {loadingCerts ? (
                <ListSkeleton count={2} />
              ) : certificates.length === 0 ? (
                <EmptyCard message="Complétez un cours pour obtenir votre premier certificat." />
              ) : (
                <div className="space-y-3">
                  {certificates.map((c) => <CertCard key={c.id} c={c} />)}
                </div>
              )}
            </section>

            {/* Quick stats */}
            <section className="rounded-2xl border bg-card p-5 shadow-elegant space-y-4">
              <div className="font-semibold tracking-tight text-sm uppercase text-muted-foreground">Statistiques</div>
              <StatRow label="Total cours inscrits" value={enrollments.length} />
              <StatRow label="Cours complétés" value={completed.length} />
              <StatRow label="Cours en cours" value={inProgress.length} />
              <StatRow label="Certificats obtenus" value={certificates.length} />
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progression moyenne</span>
                  <span className="font-semibold">{avgProgress}%</span>
                </div>
                <ProgressBar value={avgProgress} />
              </div>
            </section>

            {/* Explore CTA */}
            <Link
              to="/online"
              className="flex items-center justify-between rounded-2xl border bg-gradient-to-br from-online/5 to-purple-500/5 p-4 hover:from-online/10 hover:to-purple-500/10 transition-colors group"
            >
              <div>
                <div className="text-sm font-semibold">Explorer le catalogue</div>
                <div className="text-xs text-muted-foreground">Découvrez de nouveaux cours</div>
              </div>
              <ChevronRight className="h-4 w-4 text-online group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  count,
  linkTo,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  linkTo?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-online/10 p-1.5">
          <Icon className="h-4 w-4 text-online" />
        </div>
        <h2 className="font-semibold tracking-tight">
          {title}{count !== undefined && <span className="ml-1.5 text-muted-foreground">({count})</span>}
        </h2>
      </div>
      {linkTo && (
        <Link to={linkTo} className="text-xs text-online hover:underline flex items-center gap-0.5">
          Voir tout <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function EnrollmentCard({ e, done }: { e: Enrollment; done?: boolean }) {
  const course = e.course;
  return (
    <Link
      to="/online/course/$id"
      params={{ id: e.courseId }}
      className="flex items-start gap-3 overflow-hidden rounded-xl border bg-card p-3 shadow-elegant hover:shadow-glow hover:-translate-y-0.5 transition-all group"
    >
      {/* Thumbnail */}
      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg grad-online/20 bg-muted">
        {course?.thumbnail ? (
          <img src={mediaUrl(course.thumbnail)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}
        {done && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-900/60">
            <CheckCircle2 className="h-6 w-6 text-green-400" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 text-sm font-semibold tracking-tight group-hover:text-online transition-colors">
          {course?.title ?? "Cours"}
        </div>
        {course?.teacher && (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {course.teacher.firstName} {course.teacher.lastName}
          </div>
        )}
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{done ? "Terminé" : `${e.progress}%`}</span>
            {done && e.completedAt && (
              <span className="text-muted-foreground">{fmtDate(e.completedAt)}</span>
            )}
          </div>
          <ProgressBar value={e.progress} />
        </div>
      </div>
    </Link>
  );
}

function CertCard({ c }: { c: Certificate }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 p-4 shadow-elegant">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 shadow">
          <Award className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-semibold leading-snug">
            {c.course?.title ?? "Certificat"}
          </div>
          {c.issuedAt && (
            <div className="mt-1 text-xs text-muted-foreground">
              Délivré le {fmtDate(c.issuedAt)}
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <div className="rounded bg-white/60 dark:bg-black/20 px-2 py-0.5 text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-400">
              {c.code}
            </div>
            <Link
              to="/online/certificate/$code"
              params={{ code: c.code }}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-0.5 text-[10px] font-semibold text-white hover:bg-amber-600 transition-colors"
            >
              🏅 Voir le certificat
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  LESSON_COMPLETED: CheckCircle2,
  LESSON_STARTED: Play,
  QUIZ_PASSED: Star,
  ENROLLED: GraduationCap,
  COURSE_COMPLETED: Award,
};
const ACTION_LABELS: Record<string, string> = {
  LESSON_COMPLETED: "Leçon terminée",
  LESSON_STARTED: "Leçon commencée",
  QUIZ_PASSED: "Quiz réussi",
  ENROLLED: "Inscription",
  COURSE_COMPLETED: "Cours terminé",
};

function ActivityRow({ a }: { a: LearningActivity }) {
  const Icon = ACTION_ICONS[a.action] ?? BarChart2;
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium">
          {ACTION_LABELS[a.action] ?? a.action}
          {a.lesson && (
            <span className="text-muted-foreground"> · {a.lesson.title}</span>
          )}
        </div>
        {a.course && (
          <div className="truncate text-[11px] text-muted-foreground">{a.course.title}</div>
        )}
      </div>
      <div className="shrink-0 text-[10px] text-muted-foreground">
        {fmtDate(a.createdAt)}
      </div>
    </div>
  );
}

function GamificationCard() {
  const { data: g } = useMyGamification();
  const { data: board = [] } = useLeaderboard();
  const { user } = useAuth();
  if (!g) return null;

  const earned = g.badges.filter((b) => b.earned);

  return (
    <section className="space-y-4">
      {/* Level & points */}
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-600 to-purple-700 p-5 text-white shadow-elegant">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/60">Niveau {g.level}</div>
            <div className="text-xl font-extrabold">{g.label}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold">{g.points.toLocaleString("fr-FR")}</div>
            <div className="text-xs text-white/60">points</div>
          </div>
        </div>
        {g.nextLevelAt != null && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${g.progressToNext}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-white/60">
              {g.nextLevelAt - g.points} pts avant le niveau suivant
            </div>
          </div>
        )}
        {g.streak > 0 && (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
            🔥 {g.streak} jour{g.streak > 1 ? "s" : ""} d'affilée
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="rounded-2xl border bg-card p-4 shadow-elegant">
        <div className="mb-3 text-sm font-semibold">
          Badges <span className="text-muted-foreground">({earned.length}/{g.badges.length})</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {g.badges.map((b) => (
            <div
              key={b.id}
              title={`${b.label} — ${b.desc}`}
              className={`grid aspect-square place-items-center rounded-xl border text-xl transition ${
                b.earned ? "border-amber-300/60 bg-amber-50 dark:bg-amber-950/20" : "opacity-25 grayscale"
              }`}
            >
              {b.icon}
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      {board.length > 0 && (
        <div className="rounded-2xl border bg-card shadow-elegant overflow-hidden">
          <div className="border-b bg-muted/20 px-4 py-2.5 text-sm font-semibold">🏆 Classement</div>
          <div className="divide-y">
            {board.slice(0, 5).map((r) => (
              <div key={r.id} className={`flex items-center gap-2.5 px-4 py-2 text-sm ${r.id === user?.id ? "bg-online/5" : ""}`}>
                <span className={`w-5 text-center font-bold ${r.rank <= 3 ? "text-amber-500" : "text-muted-foreground"}`}>
                  {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {r.firstName} {r.lastName} {r.id === user?.id && <span className="text-xs text-online">(vous)</span>}
                </span>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">{r.points.toLocaleString("fr-FR")} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const API_BASE_W = API_ORIGIN;
function thumbUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_BASE_W}${path}`;
}

function PaymentsSection() {
  const { data: payments = [], isLoading } = useMyPayments();
  const requestRefund = useRequestRefund();
  if (isLoading || payments.length === 0) return null;

  function canRefund(p: (typeof payments)[number]) {
    if (p.status !== "VALIDATED" || !p.validatedAt) return false;
    const days = (Date.now() - new Date(p.validatedAt).getTime()) / 86_400_000;
    return days <= 30;
  }

  async function askRefund(id: string) {
    const reason = prompt("Raison du remboursement (facultatif) :") ?? undefined;
    try {
      await requestRefund.mutateAsync({ id, reason });
      toast.success("Demande de remboursement envoyée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <section>
      <SectionHeader icon={TrendingUp} title="Mes paiements" count={payments.length} />
      <div className="overflow-hidden rounded-xl border bg-card shadow-elegant divide-y">
        {payments.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="line-clamp-1 text-sm font-medium">{p.course?.title ?? "Cours"}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{p.reference}</span>
                <span>· {p.amount.toLocaleString("fr-FR")} {p.currency}</span>
                {p.couponCode && <span className="text-emerald-600">🏷 {p.couponCode}</span>}
              </div>
            </div>
            <PaymentStatusBadge status={p.status} />
            {canRefund(p) && (
              <button
                onClick={() => askRefund(p.id)}
                disabled={requestRefund.isPending}
                className="shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-60"
              >
                Remboursement
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">Remboursement possible sous 30 jours après validation.</p>
    </section>
  );
}

function WishlistSection() {
  const { data: courses = [], isLoading } = useWishlist();
  const toggle = useToggleWishlist();
  if (isLoading || courses.length === 0) return null;

  return (
    <section>
      <SectionHeader icon={Heart} title="Mes favoris" count={courses.length} />
      <div className="space-y-3">
        {courses.map((c) => (
          <div key={c.id} className="flex items-start gap-3 overflow-hidden rounded-xl border bg-card p-3 shadow-elegant">
            <Link to="/online/course/$id" params={{ id: c.id }} className="flex min-w-0 flex-1 items-start gap-3 group">
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                {c.thumbnail ? (
                  <img src={thumbUrl(c.thumbnail)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center"><BookOpen className="h-5 w-5 text-muted-foreground/40" /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-sm font-semibold tracking-tight group-hover:text-online transition-colors">{c.title}</div>
                {c.teacher && <div className="mt-0.5 text-xs text-muted-foreground">{c.teacher.firstName} {c.teacher.lastName}</div>}
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {(c.ratingCount ?? 0) > 0 && <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{c.ratingAvg?.toFixed(1)}</span>}
                  <span>{(c.price ?? 0) > 0 ? `${c.price} MGA` : "Gratuit"}</span>
                </div>
              </div>
            </Link>
            <button
              onClick={() => toggle.mutate(c.id)}
              title="Retirer des favoris"
              className="shrink-0 rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10"
            >
              <Heart className="h-4 w-4 fill-rose-500" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function fmtTime(sec: number | null) {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function MyNotesSection() {
  const { data: notes = [], isLoading } = useLessonNotes({});
  if (isLoading || notes.length === 0) return null;

  // Group notes by course.
  const byCourse = new Map<string, { title: string; notes: LessonNote[] }>();
  for (const n of notes) {
    const key = n.course?.id ?? n.courseId;
    if (!byCourse.has(key)) byCourse.set(key, { title: n.course?.title ?? "Cours", notes: [] });
    byCourse.get(key)!.notes.push(n);
  }
  const bookmarkCount = notes.filter((n) => n.isBookmark).length;

  return (
    <section>
      <SectionHeader icon={Bookmark} title="Mes notes & marque-pages" count={notes.length} />
      <div className="space-y-4">
        {[...byCourse.entries()].map(([cid, { title, notes: cnotes }]) => (
          <div key={cid} className="overflow-hidden rounded-xl border bg-card shadow-elegant">
            <Link
              to="/online/course/$id"
              params={{ id: cid }}
              className="flex items-center justify-between border-b bg-muted/20 px-4 py-2.5 text-sm font-semibold hover:bg-muted/40 transition"
            >
              <span className="truncate">{title}</span>
              <span className="text-xs font-normal text-muted-foreground">{cnotes.length} note{cnotes.length !== 1 ? "s" : ""}</span>
            </Link>
            <div className="divide-y">
              {cnotes.slice(0, 6).map((n) => (
                <div key={n.id} className="flex items-start gap-2.5 px-4 py-2.5">
                  {n.isBookmark
                    ? <BookmarkCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    : <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {n.lesson && <span className="truncate">{n.lesson.title}</span>}
                      {n.timestamp != null && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-online/10 px-1.5 py-0.5 font-mono font-semibold text-online">
                          <Clock className="h-2.5 w-2.5" /> {fmtTime(n.timestamp)}
                        </span>
                      )}
                    </div>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed">{n.body}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {bookmarkCount > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{bookmarkCount} marque-page{bookmarkCount !== 1 ? "s" : ""} au total.</p>
      )}
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function ListSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-xl border bg-card p-3">
          <div className="h-16 w-24 shrink-0 animate-pulse rounded-lg bg-muted" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-2 w-full animate-pulse rounded bg-muted mt-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
