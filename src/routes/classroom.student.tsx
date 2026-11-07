// @refresh reset
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen, Calendar, ClipboardList, CreditCard, FileText,
  Loader2, Megaphone, TrendingUp, Users, Bell, Clock, ChevronRight,
} from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import {
  useMyTimetable, useMyGrades, useMyAttendance, useAnnouncements,
  type ScheduleSlot, DAY_INDEX,
} from "@/lib/classroom";
import { useMyContext, isStudentCtx } from "@/lib/context";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/classroom/student")({ component: StudentDash });

// ── helpers ──────────────────────────────────────────────────────────
const TODAY_DOW = new Date().getDay() || 7; // 1=Mon…7=Sun

function nowMins() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}
function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

type CourseStatus = "past" | "current" | "upcoming";
function slotStatus(s: ScheduleSlot): CourseStatus {
  const now   = nowMins();
  const start = toMins(s.startTime);
  const end   = toMins(s.endTime);
  if (now >= start && now < end) return "current";
  if (now >= end)                return "past";
  return "upcoming";
}

const SUBJECT_PALETTE = [
  "from-blue-500 to-blue-600",
  "from-purple-500 to-purple-600",
  "from-green-500 to-green-600",
  "from-orange-500 to-orange-600",
  "from-pink-500 to-pink-600",
  "from-teal-500 to-teal-600",
  "from-indigo-500 to-indigo-600",
  "from-rose-500 to-rose-600",
];
function subjectGradient(title: string) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) & 0xffff;
  return SUBJECT_PALETTE[h % SUBJECT_PALETTE.length];
}

// ── Countdown ─────────────────────────────────────────────────────────
function Countdown({ startTime }: { startTime: string }) {
  const calc = () => toMins(startTime) - nowMins();
  const [mins, setMins] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setMins(calc()), 30_000);
    return () => clearInterval(id);
  }, [startTime]);
  if (mins <= 0) return <span>Maintenant</span>;
  if (mins >= 60) return <span>Dans {Math.floor(mins / 60)}h{String(mins % 60).padStart(2, "0")}</span>;
  return <span>Dans {mins} min</span>;
}

// ── Mini stat card ────────────────────────────────────────────────────
function Stat({ label, value, sub, icon, delay = 0 }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; delay?: number;
}) {
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-3 duration-500 flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-elegant"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-classroom/10 text-classroom">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60">{sub}</p>}
      </div>
    </div>
  );
}

// ── Course timeline item ──────────────────────────────────────────────
function CourseItem({ slot, status, delay = 0 }: { slot: ScheduleSlot; status: CourseStatus; delay?: number }) {
  const title = slot.course?.title ?? "Cours";
  const gradient = subjectGradient(title);
  const isCurrent = status === "current";
  const isPast    = status === "past";

  return (
    <div
      className={`animate-in fade-in slide-in-from-left-3 duration-500 relative flex items-start gap-4 pb-5 last:pb-0 ${isPast ? "opacity-50" : ""}`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div className="flex flex-col items-center">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white text-xs font-bold shadow-sm`}>
          {slot.startTime.slice(0, 5)}
        </div>
        <div className="mt-1 flex-1 w-px bg-border" />
      </div>

      <div className={`flex-1 rounded-2xl border p-4 transition-all ${isCurrent ? "border-classroom/30 bg-classroom/5 shadow-elegant" : "bg-card"}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={`font-semibold ${isCurrent ? "text-classroom" : "text-foreground"}`}>{title}</p>
            {slot.room && <p className="mt-0.5 text-xs text-muted-foreground">Salle {slot.room.name}</p>}
            {slot.teacher && <p className="mt-0.5 text-xs text-muted-foreground">Prof. {slot.teacher.firstName} {slot.teacher.lastName}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground tabular-nums">{slot.startTime} – {slot.endTime}</span>
            {isCurrent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-classroom px-2 py-0.5 text-[10px] font-bold text-white">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                En cours
              </span>
            )}
            {status === "upcoming" && (
              <span className="text-[10px] font-medium text-blue-600"><Countdown startTime={slot.startTime} /></span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
function StudentDash() {
  const { user, ready } = useRequireClassroom(["STUDENT"]);
  const enabled = ready && !!user;

  const ctx           = useMyContext();
  const sCtx          = isStudentCtx(ctx.data) ? ctx.data : null;

  const timetable     = useMyTimetable({ enabled });
  const grades        = useMyGrades({ enabled });
  const attendance    = useMyAttendance({ enabled });
  const announcements = useAnnouncements({ enabled });

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const todaySlots = (timetable.data ?? [])
    .filter((s) => DAY_INDEX[s.day] === TODAY_DOW)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const currentSlot     = todaySlots.find((s) => slotStatus(s) === "current") ?? null;
  const nextSlot        = todaySlots.find((s) => slotStatus(s) === "upcoming") ?? null;
  const highlighted     = currentSlot ?? nextSlot;

  const attendanceRecs  = attendance.data ?? [];
  const presentCount    = attendanceRecs.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const attendancePct   = attendanceRecs.length ? Math.round((presentCount / attendanceRecs.length) * 100) : null;

  const allGrades       = grades.data ?? [];
  const avgPct          = allGrades.length
    ? Math.round(allGrades.reduce((s, g) => s + (g.value / g.maxValue), 0) / allGrades.length * 100)
    : null;
  const avgStr          = avgPct !== null ? `${((avgPct / 100) * 20).toFixed(1)}/20` : "—";

  const recentAnnouncements = announcements.data?.items.slice(0, 4) ?? [];

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 relative overflow-hidden rounded-3xl grad-hero p-6 lg:p-8" style={{ animationFillMode: "both" }}>
        <div className="noise-bg absolute inset-0 opacity-40" />
        <div className="relative">
          <p className="text-sm font-medium text-white/60">
            {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-white">{greeting}, {user.firstName} 👋</h1>
          {sCtx && (
            <p className="mt-1 text-sm text-white/70">
              {[sCtx.promotion?.name, sCtx.mention?.name, sCtx.group?.name].filter(Boolean).join(" · ")}
            </p>
          )}

          {highlighted && (
            <div className="mt-4 inline-flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-sm px-4 py-3 border border-white/20">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
                <Clock className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{highlighted.course?.title ?? "Cours"}</p>
                <p className="text-xs text-white/70">
                  {currentSlot
                    ? `En cours · ${highlighted.startTime} – ${highlighted.endTime}${highlighted.room ? ` · Salle ${highlighted.room.name}` : ""}`
                    : <Countdown startTime={highlighted.startTime} />
                  }
                </p>
              </div>
            </div>
          )}
          {!highlighted && todaySlots.length > 0 && (
            <p className="mt-4 text-sm text-white/60">✓ Tous les cours du jour terminés</p>
          )}
          {todaySlots.length === 0 && !timetable.isLoading && (
            <p className="mt-4 text-sm text-white/60">Pas de cours aujourd'hui — bonne journée !</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat delay={100} label="Assiduité" value={attendancePct !== null ? `${attendancePct}%` : "—"} sub="Ce semestre" icon={<TrendingUp className="h-5 w-5" />} />
        <Stat delay={150} label="Moyenne" value={avgStr} sub={allGrades.length ? `${allGrades.length} note(s)` : undefined} icon={<ClipboardList className="h-5 w-5" />} />
        <Stat delay={200} label="Cours aujourd'hui" value={String(todaySlots.length)} icon={<Calendar className="h-5 w-5" />} />
        <Stat delay={250} label="Annonces" value={String(announcements.data?.total ?? 0)} icon={<Megaphone className="h-5 w-5" />} />
      </div>

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Today's schedule */}
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 rounded-2xl border bg-card shadow-elegant lg:col-span-2" style={{ animationDelay: "300ms", animationFillMode: "both" }}>
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">Aujourd'hui</h2>
              <p className="text-xs text-muted-foreground">{now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
            <Link to="/classroom/timetable" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-classroom transition-colors">
              Semaine <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="px-5 py-4">
            {timetable.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : todaySlots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50">
                <Calendar className="mb-2 h-8 w-8" />
                <p className="text-sm">Aucun cours planifié</p>
              </div>
            ) : (
              <div>
                {todaySlots.map((s, i) => (
                  <CourseItem key={s.id} slot={s} status={slotStatus(s)} delay={350 + i * 60} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Announcements */}
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 rounded-2xl border bg-card shadow-elegant" style={{ animationDelay: "400ms", animationFillMode: "both" }}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">Annonces</h2>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="divide-y">
              {announcements.isLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : recentAnnouncements.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">Aucune annonce.</p>
              ) : (
                recentAnnouncements.map((a) => (
                  <div key={a.id} className="px-5 py-3 hover:bg-muted/40 transition-colors">
                    <p className="text-sm font-medium line-clamp-1">{a.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true, locale: fr })}</p>
                  </div>
                ))
              )}
            </div>
            <div className="border-t px-5 py-3">
              <Link to="/classroom/announcements" className="text-xs font-medium text-classroom hover:underline">Voir toutes →</Link>
            </div>
          </div>

          {/* Quick links */}
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 rounded-2xl border bg-card shadow-elegant p-4" style={{ animationDelay: "500ms", animationFillMode: "both" }}>
            <h2 className="mb-3 px-1 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Accès rapide</h2>
            <div className="space-y-1">
              {([
                { label: "Emploi du temps",   to: "/classroom/timetable",    icon: <Calendar className="h-4 w-4" /> },
                { label: "Documents",          to: "/classroom/student",      icon: <FileText className="h-4 w-4" /> },
                { label: "Paiements",          to: "/classroom/finance",      icon: <CreditCard className="h-4 w-4" /> },
                { label: "Mes cours",          to: "/classroom/student",      icon: <BookOpen className="h-4 w-4" /> },
                { label: "Camarades",          to: "/classroom/student",      icon: <Users className="h-4 w-4" /> },
              ] as const).map((item) => (
                <Link key={item.label} to={item.to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-600 hover:bg-classroom/5 hover:text-classroom transition-colors group">
                  <span className="text-muted-foreground group-hover:text-classroom transition-colors">{item.icon}</span>
                  {item.label}
                  <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-classroom" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Recent grades */}
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 rounded-2xl border bg-card shadow-elegant" style={{ animationDelay: "550ms", animationFillMode: "both" }}>
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold">Notes récentes</h2>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </div>
          {grades.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : allGrades.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune note enregistrée.</p>
          ) : (
            <div className="divide-y">
              {allGrades.slice(0, 5).map((g) => {
                const pct = Math.round((g.value / g.maxValue) * 100);
                const color = pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
                return (
                  <div key={g.id} className="px-5 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{g.subject?.name ?? "—"}</span>
                      <span className="font-bold tabular-nums">{g.value}<span className="font-normal text-muted-foreground">/{g.maxValue}</span></span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{g.type}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Attendance */}
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 rounded-2xl border bg-card shadow-elegant" style={{ animationDelay: "600ms", animationFillMode: "both" }}>
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">Assiduité</h2>
              {attendancePct !== null && <p className="text-xs text-muted-foreground">{attendancePct}% de présence</p>}
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="p-5">
            {attendance.isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : attendanceRecs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Aucun enregistrement.</p>
            ) : (
              <>
                <div className="grid grid-cols-10 gap-1">
                  {attendanceRecs.slice(0, 40).map((r, i) => {
                    const bg = r.status === "PRESENT" ? "bg-green-400" : r.status === "LATE" ? "bg-yellow-400" : r.status === "ABSENT" ? "bg-red-400" : "bg-muted";
                    return <div key={i} className={`aspect-square rounded-sm ${bg} hover:scale-110 transition-transform`} title={`${r.date?.slice(0, 10)} — ${r.status}`} />;
                  })}
                </div>
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-green-400" /> Présent</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-yellow-400" /> Retard</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-400" /> Absent</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
