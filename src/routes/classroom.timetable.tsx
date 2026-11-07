import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Clock, DoorOpen, Loader2, MapPin, Users } from "lucide-react";
import { useRequireClassroom, WeekGrid } from "@/components/classroom/shared";
import { useMyTimetable, type ScheduleSlot } from "@/lib/classroom";

export const Route = createFileRoute("/classroom/timetable")({ component: Timetable });

const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DAY_LABEL: Record<string, string> = {
  MONDAY: "Lundi", TUESDAY: "Mardi", WEDNESDAY: "Mercredi", THURSDAY: "Jeudi", FRIDAY: "Vendredi", SATURDAY: "Samedi", SUNDAY: "Dimanche",
};

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtLong = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const fmtShort = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

// Date réelle d'un créneau : lundi de la semaine planifiée + jour
function slotDate(s: ScheduleSlot): Date | null {
  const ws = s.schedulePeriod?.weekStart;
  if (!ws) return null;
  return addDays(new Date(ws), Math.max(0, DAY_ORDER.indexOf(s.day)));
}

type Week = { id: string; name: string; weekStart: Date | null; mention?: string; semester?: string; slots: ScheduleSlot[] };

function Timetable() {
  const { user, ready } = useRequireClassroom();
  const enabled = ready && !!user;
  const myTimetable = useMyTimetable({ enabled });
  const [weekId, setWeekId] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string>("");
  const [selected, setSelected] = useState<ScheduleSlot | null>(null);

  // Un emploi du temps publié = une semaine (période) pour une mention
  const weeks = useMemo<Week[]>(() => {
    const map = new Map<string, Week>();
    for (const s of myTimetable.data ?? []) {
      const p = s.schedulePeriod;
      const key = p?.id ?? "none";
      if (!map.has(key)) {
        map.set(key, {
          id: key, name: p?.name ?? "Emploi du temps", weekStart: p?.weekStart ? new Date(p.weekStart) : null,
          mention: p?.mention?.name, semester: p?.semester?.name, slots: [],
        });
      }
      map.get(key)!.slots.push(s);
    }
    return [...map.values()].sort((a, b) => (b.weekStart?.getTime() ?? 0) - (a.weekStart?.getTime() ?? 0));
  }, [myTimetable.data]);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  // Semaine affichée par défaut : celle en cours, sinon la prochaine, sinon la plus récente
  const now = new Date();
  const current = weeks.find((w) => w.weekStart && w.weekStart <= now && addDays(w.weekStart, 7) > now)
    ?? [...weeks].reverse().find((w) => w.weekStart && w.weekStart > now)
    ?? weeks[0];
  const week = weeks.find((w) => w.id === weekId) ?? current;

  const classes = [...new Set((week?.slots ?? []).map((s) => s.promotion?.name).filter(Boolean))] as string[];
  const slots = (week?.slots ?? []).filter((s) => !classFilter || s.promotion?.name === classFilter);
  const steps = [...slots].sort((a, b) =>
    DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startTime.localeCompare(b.startTime));
  const isTeacher = user.systemRole === "TEACHER";
  const nextStep = steps.find((s) => { const d = slotDate(s); if (!d) return false; const [h, m] = s.endTime.split(":").map(Number); d.setHours(h, m); return d > now; });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Emploi du temps</h1>
          <p className="text-muted-foreground">{isTeacher ? "Vos cours de la semaine : où aller, à quelle heure, avec quelle classe." : "Vos cours de la semaine."}</p>
        </div>
        {weeks.length > 1 && (
          <select value={week?.id ?? ""} onChange={(e) => { setWeekId(e.target.value); setClassFilter(""); }}
            className="h-10 rounded-xl border bg-background px-3 text-sm">
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>{w.weekStart ? `Semaine du ${fmtShort(w.weekStart)}` : w.name}{w.mention ? ` — ${w.mention}` : ""}</option>
            ))}
          </select>
        )}
      </div>

      {myTimetable.isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : !week ? (
        <div className="rounded-2xl border border-dashed p-16 text-center text-sm text-muted-foreground">
          Aucun emploi du temps publié pour le moment.
          {isTeacher && <p className="mt-2">Le Responsable Pédagogique publiera votre emploi du temps après votre validation.</p>}
        </div>
      ) : (
        <>
          {/* Quelle semaine, quelle classe */}
          <div className="rounded-2xl border border-classroom/20 bg-classroom/5 p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-classroom" />
                <div>
                  <p className="text-xs text-muted-foreground">Semaine</p>
                  <p className="font-semibold">{week.weekStart ? `Du ${fmtLong(week.weekStart)} au ${fmtLong(addDays(week.weekStart, 5))}` : week.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-classroom" />
                <div>
                  <p className="text-xs text-muted-foreground">{isTeacher ? "Classes" : "Classe"}</p>
                  <p className="font-semibold">{classes.join(", ") || "—"}</p>
                </div>
              </div>
              {(week.mention || week.semester) && (
                <div className="text-sm text-muted-foreground">{[week.mention, week.semester].filter(Boolean).join(" · ")}</div>
              )}
            </div>
            {isTeacher && classes.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["", ...classes].map((c) => (
                  <button key={c || "all"} onClick={() => setClassFilter(c)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${classFilter === c ? "border-classroom bg-classroom text-white" : "bg-card hover:bg-accent"}`}>
                    {c || "Toutes mes classes"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <WeekGrid slots={slots} onSlotClick={setSelected} />
            </div>

            {/* Étape par étape */}
            <div className="rounded-2xl border bg-card p-4 shadow-elegant">
              <h2 className="font-semibold">Ma semaine, étape par étape</h2>
              <p className="text-xs text-muted-foreground">Dans l'ordre : quand, où et avec qui.</p>
              <ol className="mt-3 space-y-2">
                {steps.map((s, i) => {
                  const d = slotDate(s);
                  const isNext = nextStep?.id === s.id;
                  return (
                    <li key={s.id} onClick={() => setSelected(s)}
                      className={`cursor-pointer rounded-xl border p-3 text-sm transition hover:bg-accent ${isNext ? "border-classroom bg-classroom/5" : ""}`}>
                      <div className="flex items-center gap-2">
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${isNext ? "grad-classroom text-white" : "bg-muted"}`}>{i + 1}</span>
                        <span className="font-semibold">{DAY_LABEL[s.day]}{d ? ` ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : ""}</span>
                        <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> {s.startTime} → {s.endTime}</span>
                        {isNext && <span className="ml-auto rounded-full bg-classroom px-2 py-0.5 text-[10px] font-semibold text-white">Prochain</span>}
                      </div>
                      <p className="mt-1.5 pl-8">
                        {isTeacher ? "Aller en " : "Rendez-vous en "}
                        <b className="inline-flex items-center gap-1"><DoorOpen className="h-3 w-3" />{s.room?.name ?? "salle à confirmer"}</b>
                        {isTeacher && s.promotion && <> pour la classe <b>{s.promotion.name}</b></>}
                        {s.group && <> ({s.group.name})</>}
                      </p>
                      <p className="pl-8 text-xs text-muted-foreground">
                        {s.subjectName ?? "Cours"}{s.type ? ` · ${s.type}` : ""}
                        {!isTeacher && s.teacher && ` · avec ${s.teacher.firstName} ${s.teacher.lastName}`}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border bg-card p-6 shadow-elegant">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{selected.subjectName ?? selected.course?.title ?? "Cours"}</h2>
              <button onClick={() => setSelected(null)} className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-accent">×</button>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Jour</dt><dd>{DAY_LABEL[selected.day]}{slotDate(selected) ? ` ${slotDate(selected)!.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : ""}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Horaire</dt><dd>{selected.startTime} – {selected.endTime}</dd></div>
              {selected.type && <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd>{selected.type}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted-foreground">Salle</dt><dd className="flex items-center gap-1"><MapPin className="h-3 w-3" />{selected.room?.name ?? "à confirmer"}</dd></div>
              {selected.teacher && <div className="flex justify-between"><dt className="text-muted-foreground">Enseignant</dt><dd>{selected.teacher.firstName} {selected.teacher.lastName}</dd></div>}
              {selected.promotion && <div className="flex justify-between"><dt className="text-muted-foreground">Classe</dt><dd>{selected.promotion.name}</dd></div>}
              {selected.group && <div className="flex justify-between"><dt className="text-muted-foreground">Groupe</dt><dd>{selected.group.name}</dd></div>}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
