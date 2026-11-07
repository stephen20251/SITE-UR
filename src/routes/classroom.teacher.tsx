// @refresh reset
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen, Calendar, Check, ChevronRight, ClipboardCheck,
  Clock, Loader2, UserCheck, Users, X, BookOpenCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useRequireClassroom } from "@/components/classroom/shared";
import {
  useMyTimetable, useRoster, useMarkAttendance, useCreateGrade, useGrades,
  type ScheduleSlot, DAY_INDEX,
} from "@/lib/classroom";
import { useMyContext, isTeacherCtx } from "@/lib/context";

export const Route = createFileRoute("/classroom/teacher")({ component: TeacherDash });

// ── helpers ──────────────────────────────────────────────────────────
const TODAY_DOW = new Date().getDay() || 7;
const DAY_FR: Record<string, string> = { MONDAY: "Lun", TUESDAY: "Mar", WEDNESDAY: "Mer", THURSDAY: "Jeu", FRIDAY: "Ven", SATURDAY: "Sam", SUNDAY: "Dim" };

function nowMins() { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
function toMins(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

type CStatus = "past" | "current" | "upcoming";
function cStatus(s: ScheduleSlot): CStatus {
  const now = nowMins();
  const start = toMins(s.startTime);
  const end   = toMins(s.endTime);
  if (now >= start && now < end) return "current";
  if (now >= end)                return "past";
  return "upcoming";
}

const PALETTE = ["bg-blue-500","bg-purple-500","bg-green-600","bg-orange-500","bg-pink-500","bg-teal-500","bg-indigo-500","bg-rose-500"];
function slotColor(title: string) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

function Countdown({ startTime }: { startTime: string }) {
  const calc = () => toMins(startTime) - nowMins();
  const [mins, setMins] = useState(calc);
  useEffect(() => { const id = setInterval(() => setMins(calc()), 30_000); return () => clearInterval(id); }, [startTime]);
  if (mins <= 0) return <span>Maintenant</span>;
  if (mins >= 60) return <span>Dans {Math.floor(mins / 60)}h{String(mins % 60).padStart(2,"0")}</span>;
  return <span>Dans {mins} min</span>;
}

type AttState = Record<string, "PRESENT" | "LATE" | "ABSENT">;

// ── Component ─────────────────────────────────────────────────────────
function TeacherDash() {
  const { user, ready } = useRequireClassroom(["TEACHER"]);
  const enabled = ready && !!user;

  const ctx         = useMyContext();
  const tCtx        = isTeacherCtx(ctx.data) ? ctx.data : null;

  const timetable   = useMyTimetable({ enabled });
  const markAtt     = useMarkAttendance();
  const createGrade = useCreateGrade();

  // Selected slot for attendance / grade
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);
  const promotionId = selectedSlot?.promotion?.id ?? null;

  // For a selected slot, try to get students from that promotion
  // Using roster with a fake "promotionId" approach — roster needs classId
  // We use a simplified grade form instead
  const [att, setAtt] = useState<AttState>({});
  const [savingAtt, setSavingAtt] = useState(false);
  const [showGrade, setShowGrade] = useState(false);
  const [gradeForm, setGradeForm] = useState({ studentId: "", type: "FINAL", value: "", maxValue: "20", coefficient: "1" });
  const [addingGrade, setAddingGrade] = useState(false);

  const allGrades = useGrades({ enabled: enabled && !!selectedSlot?.course?.id, subjectId: selectedSlot?.course?.id });

  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 60_000); return () => clearInterval(id); }, []);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const allSlots   = timetable.data ?? [];
  const todaySlots = allSlots.filter((s) => DAY_INDEX[s.day] === TODAY_DOW).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const currentSlot = todaySlots.find((s) => cStatus(s) === "current") ?? null;
  const nextSlot    = todaySlots.find((s) => cStatus(s) === "upcoming") ?? null;
  const hero        = currentSlot ?? nextSlot;

  const todayDate = new Date().toISOString().slice(0, 10);
  const now       = new Date();
  const greeting  = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon après-midi" : "Bonsoir";

  // Days for the week view
  const DAYS_ORDER = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"] as const;
  const weekByDay = DAYS_ORDER.map((day) => ({
    day,
    label: DAY_FR[day],
    dow: DAY_INDEX[day],
    slots: allSlots.filter((s) => s.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));

  async function saveAttendance() {
    if (!selectedSlot?.course?.id) return;
    setSavingAtt(true);
    try {
      await markAtt.mutateAsync({
        courseId: selectedSlot.course.id,
        date: todayDate,
        records: Object.entries(att).map(([studentId, status]) => ({ studentId, status })),
      });
      toast.success("Appel enregistré");
    } catch { toast.error("Erreur lors de l'enregistrement"); }
    finally { setSavingAtt(false); }
  }

  async function submitGrade(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot?.course?.id || !gradeForm.studentId || !gradeForm.value) return;
    setAddingGrade(true);
    try {
      await createGrade.mutateAsync({
        studentId: gradeForm.studentId,
        subjectId: selectedSlot.course.id,
        type: gradeForm.type,
        value: parseFloat(gradeForm.value),
        maxValue: parseFloat(gradeForm.maxValue),
        coefficient: parseFloat(gradeForm.coefficient),
      });
      toast.success("Note ajoutée");
      setGradeForm({ studentId: "", type: "FINAL", value: "", maxValue: "20", coefficient: "1" });
      setShowGrade(false);
    } catch { toast.error("Erreur lors de l'ajout de la note"); }
    finally { setAddingGrade(false); }
  }

  const inp = "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/20";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 relative overflow-hidden rounded-3xl grad-hero p-6 lg:p-8" style={{ animationFillMode: "both" }}>
        <div className="noise-bg absolute inset-0 opacity-40" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-white/60">{now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
            <h1 className="mt-1 text-3xl font-bold text-white">{greeting}, Prof. {user.lastName} 👋</h1>
            {tCtx && (
              <p className="mt-1 text-sm text-white/70">
                {[tCtx.department?.name, tCtx.mention?.name].filter(Boolean).join(" · ")}
                {tCtx.studentCount > 0 && ` · ${tCtx.studentCount} étudiant${tCtx.studentCount > 1 ? "s" : ""}`}
              </p>
            )}

            {hero && (
              <div className="mt-4 inline-flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-sm px-4 py-3 border border-white/20">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
                  <Clock className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{hero.course?.title ?? "Cours"}</p>
                  <p className="text-xs text-white/70">
                    {currentSlot
                      ? `En cours · ${hero.startTime} – ${hero.endTime}${hero.room ? ` · ${hero.room.name}` : ""}`
                      : <><Countdown startTime={hero.startTime} /> · {hero.startTime}{hero.room ? ` · ${hero.room.name}` : ""}</>
                    }
                  </p>
                </div>
                {currentSlot && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    En cours
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { v: String(todaySlots.length), l: "Cours aujourd'hui" },
              { v: String(allSlots.length),   l: "Créneaux / sem." },
            ].map(({ v, l }) => (
              <div key={l} className="rounded-2xl bg-white/10 border border-white/20 px-4 py-3 text-center backdrop-blur-sm">
                <p className="text-xl font-bold text-white">{v}</p>
                <p className="text-[10px] text-white/60 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Week view */}
      <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 rounded-2xl border bg-card shadow-elegant overflow-hidden" style={{ animationDelay: "150ms", animationFillMode: "both" }}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">Cette semaine</h2>
          <Link to="/classroom/timetable" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-classroom">Vue complète <ChevronRight className="h-3 w-3" /></Link>
        </div>
        {timetable.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-5 divide-x overflow-x-auto">
            {weekByDay.map(({ day, label, dow, slots }) => (
              <div key={day} className={`min-w-[130px] p-3 ${dow === TODAY_DOW ? "bg-classroom/5" : ""}`}>
                <p className={`mb-2 text-center text-xs font-bold ${dow === TODAY_DOW ? "text-classroom" : "text-muted-foreground"}`}>
                  {label}
                  {dow === TODAY_DOW && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-classroom" />}
                </p>
                {slots.length === 0 ? (
                  <p className="text-center text-[10px] text-muted-foreground/40 py-2">—</p>
                ) : (
                  <div className="space-y-1.5">
                    {slots.map((s) => {
                      const title = s.course?.title ?? "Cours";
                      const st = dow === TODAY_DOW ? cStatus(s) : "upcoming";
                      const isSelected = selectedSlot?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSelectedSlot(isSelected ? null : s)}
                          className={`w-full rounded-lg px-2 py-2 text-white text-[10px] leading-tight text-left transition-all ${slotColor(title)} ${st === "past" ? "opacity-40" : ""} ${st === "current" ? "ring-2 ring-white ring-offset-1" : ""} ${isSelected ? "ring-2 ring-yellow-300" : ""}`}
                        >
                          <p className="font-bold truncate">{title}</p>
                          <p className="opacity-80">{s.startTime}</p>
                          {s.room && <p className="opacity-70 truncate">{s.room.name}</p>}
                          {s.promotion && <p className="opacity-60 truncate">{s.promotion.name}</p>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected slot actions */}
      {selectedSlot && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 grid gap-5 lg:grid-cols-2" style={{ animationFillMode: "both" }}>
          {/* Slot details + attendance */}
          <div className="rounded-2xl border bg-card shadow-elegant">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">{selectedSlot.course?.title ?? "Cours"}</h2>
              <p className="text-xs text-muted-foreground">{selectedSlot.startTime} – {selectedSlot.endTime} · {selectedSlot.room?.name ?? "Salle à définir"}</p>
              {selectedSlot.promotion && <p className="text-xs text-muted-foreground">{selectedSlot.promotion.name} · {selectedSlot.promotion.level}</p>}
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm font-medium">Appel rapide — {todayDate}</p>
              <p className="text-xs text-muted-foreground">Saisir les IDs étudiants présents/absents dans le système de gestion ou enregistrer directement.</p>
              <div className="flex gap-2">
                <input
                  className={inp + " flex-1"}
                  placeholder="ID étudiant"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const v = (e.target as HTMLInputElement).value.trim();
                      if (v) { setAtt((p) => ({ ...p, [v]: "PRESENT" })); (e.target as HTMLInputElement).value = ""; }
                    }
                  }}
                />
                <button
                  onClick={saveAttendance}
                  disabled={savingAtt || Object.keys(att).length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl grad-classroom px-4 py-2 text-sm font-semibold text-white shadow-elegant disabled:opacity-50"
                >
                  {savingAtt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                  Enregistrer
                </button>
              </div>
              {Object.keys(att).length > 0 && (
                <ul className="space-y-1">
                  {Object.entries(att).map(([sid, status]) => (
                    <li key={sid} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{sid}</span>
                      <div className="flex gap-1">
                        {(["PRESENT","LATE","ABSENT"] as const).map((s) => (
                          <button key={s} onClick={() => setAtt((p) => ({ ...p, [sid]: s }))}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${status === s ? (s === "PRESENT" ? "bg-green-500 text-white" : s === "LATE" ? "bg-yellow-500 text-white" : "bg-red-500 text-white") : "bg-muted text-muted-foreground"}`}>
                            {s === "PRESENT" ? <Check className="h-3 w-3" /> : s === "LATE" ? "R" : <X className="h-3 w-3" />}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Grade entry */}
          <div className="rounded-2xl border bg-card shadow-elegant">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">Saisie de notes</h2>
              <button onClick={() => setShowGrade(!showGrade)} className="text-xs text-classroom hover:underline">{showGrade ? "Fermer" : "Ajouter"}</button>
            </div>

            {showGrade && (
              <form onSubmit={submitGrade} className="space-y-2.5 p-5">
                <input className={inp} placeholder="ID étudiant (studentProfile.id)" value={gradeForm.studentId}
                  onChange={(e) => setGradeForm((f) => ({ ...f, studentId: e.target.value }))} required />
                <select className={inp} value={gradeForm.type} onChange={(e) => setGradeForm((f) => ({ ...f, type: e.target.value }))}>
                  {["CC","MIDTERM","FINAL","PROJECT","ORAL"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input className={inp} type="number" min={0} step={0.25} placeholder="Note" value={gradeForm.value}
                    onChange={(e) => setGradeForm((f) => ({ ...f, value: e.target.value }))} required />
                  <input className={inp} type="number" min={1} step={1} placeholder="Max (défaut 20)" value={gradeForm.maxValue}
                    onChange={(e) => setGradeForm((f) => ({ ...f, maxValue: e.target.value }))} />
                </div>
                <button type="submit" disabled={addingGrade}
                  className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-bold text-white disabled:opacity-60">
                  {addingGrade && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Enregistrer la note
                </button>
              </form>
            )}

            {/* Recent grades for this course */}
            {allGrades.isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : (allGrades.data ?? []).length === 0 ? (
              <p className="px-5 py-6 text-sm text-center text-muted-foreground">Aucune note pour ce cours.</p>
            ) : (
              <div className="divide-y">
                {(allGrades.data ?? []).slice(0, 8).map((g) => (
                  <div key={g.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="text-muted-foreground text-xs">{g.student?.user.firstName} {g.student?.user.lastName}</span>
                    <span className="font-bold">{g.value}<span className="font-normal text-muted-foreground">/{g.maxValue}</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 rounded-2xl border bg-card shadow-elegant p-4" style={{ animationDelay: "350ms", animationFillMode: "both" }}>
        <h2 className="mb-3 px-1 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Accès rapide</h2>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {([
            { label: "Emploi du temps", icon: <Calendar className="h-4 w-4" />, to: "/classroom/timetable" },
            { label: "Disponibilités",  icon: <UserCheck className="h-4 w-4" />, to: "/classroom/teacher" },
            { label: "Supports cours",  icon: <BookOpenCheck className="h-4 w-4" />, to: "/classroom/teacher" },
            { label: "Étudiants",       icon: <Users className="h-4 w-4" />, to: "/classroom/teacher" },
          ] as const).map((item) => (
            <Link key={item.label} to={item.to}
              className="flex flex-col items-center gap-2 rounded-xl border p-3 text-xs text-muted-foreground hover:bg-classroom/5 hover:text-classroom hover:border-classroom/30 transition-colors">
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
