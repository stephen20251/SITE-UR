import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, RotateCcw } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import { useAuth, hasPermission } from "@/lib/auth";
import {
  Card, CourseStatusBadge, Empty, HoursSummary, Loading, PageHeader, Tabs, btnGhost, btnPrimary, inputCls, todayStr,
} from "@/components/classroom/cursus-ui";
import { SupervisionTable } from "@/components/classroom/supervision";
import { useSaveSession, useSessionsDay, useToggleSyllabus, type CursusCourse, type DaySlot } from "@/lib/cursus";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/classroom/suivi-cours")({ component: SuiviCours });

type Tab = "TODAY" | "PROGRESS";

function SuiviCours() {
  const { user, ready } = useRequireClassroom(["STAFF", "SUPER_ADMIN"]);
  const [tab, setTab] = useState<Tab>("TODAY");
  if (!ready || !user) return <Loading />;
  return (
    <div className="space-y-6">
      <PageHeader title="Suivi des cours" subtitle="Cochez les cours accomplis et les points du syllabus traités à la fin de chaque séance." />
      <Tabs<Tab> value={tab} onChange={setTab} items={[
        { v: "TODAY", label: "Cours du jour" },
        { v: "PROGRESS", label: "Progression des cours" },
      ]} />
      {tab === "TODAY" ? <TodayTab /> : <SupervisionTable />}
    </div>
  );
}

function TodayTab() {
  const [date, setDate] = useState(todayStr());
  const q = useSessionsDay(date);
  const sessions = q.data?.sessions ?? [];
  const done = sessions.filter((s) => s.log).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        {sessions.length > 0 && <span className="text-sm text-muted-foreground"><b className="text-foreground">{done}</b> / {sessions.length} cours accomplis</span>}
      </div>
      {q.isLoading ? <Loading /> : q.isError ? <Empty>Accès réservé au secrétariat.</Empty> : sessions.length === 0 ? (
        <Empty>Aucun cours prévu ce jour.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sessions.map((s) => <SessionCard key={s.slot.id} date={date} slot={s.slot} done={Boolean(s.log)} course={s.course} />)}
        </div>
      )}
    </div>
  );
}

function SessionCard({ date, slot, done, course }: { date: string; slot: DaySlot; done: boolean; course: CursusCourse | null }) {
  const { user, roles } = useAuth();
  const canTrack = user?.systemRole === "SUPER_ADMIN" || hasPermission(roles, "TRACK_COURSES");
  const saveSession = useSaveSession();
  const toggle = useToggleSyllabus();
  const pending = course?.syllabus.filter((i) => !i.isDone) ?? [];
  const [picked, setPicked] = useState<string[]>([]);

  async function markDone() {
    try {
      await saveSession.mutateAsync({ slotId: slot.id, date, done: true, syllabusItemIds: picked });
      toast.success("Cours marqué comme accompli");
      setPicked([]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Échec");
    }
  }

  return (
    <Card className={done ? "border-emerald-300 dark:border-emerald-800" : ""}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{slot.startTime}–{slot.endTime} · {slot.type} · {slot.hours} h</div>
          <h3 className="font-semibold">{slot.subjectName}</h3>
          <p className="text-xs text-muted-foreground">
            {slot.promotion.name}{slot.group ? ` · ${slot.group.name}` : ""} · {slot.teacher.firstName} {slot.teacher.lastName}{slot.room ? ` · ${slot.room.name}` : ""}
          </p>
        </div>
        {!canTrack ? (
          <span className={`text-xs font-medium ${done ? "text-emerald-600" : "text-muted-foreground"}`}>{done ? "✓ Accompli" : "Non coché"}</span>
        ) : done ? (
          <button onClick={() => saveSession.mutate({ slotId: slot.id, date, done: false })} className={btnGhost} title="Annuler">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Accompli <RotateCcw className="h-3 w-3 opacity-60" />
          </button>
        ) : (
          <button onClick={markDone} disabled={saveSession.isPending} className={btnPrimary}>Cours accompli</button>
        )}
      </div>

      {course ? (
        <div className="mt-3 space-y-3 border-t pt-3">
          <div className="flex items-center gap-2 text-sm"><span className="font-medium">{course.title}</span><CourseStatusBadge status={course.progress.status} /></div>
          <HoursSummary p={course.progress} />
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Syllabus — cochez les points traités</p>
            {course.syllabus.length === 0 && <p className="text-xs italic text-muted-foreground">L'enseignant n'a pas encore rédigé de syllabus.</p>}
            <div className="space-y-1">
              {course.syllabus.map((it) => {
                // Avant de valider la séance : sélection locale ; après : bascule directe.
                const checked = it.isDone || picked.includes(it.id);
                const onClick = () => {
                  if (!canTrack) return;
                  if (it.isDone || done) toggle.mutate({ id: it.id, done: !it.isDone });
                  else setPicked((p) => (p.includes(it.id) ? p.filter((x) => x !== it.id) : [...p, it.id]));
                };
                return (
                  <button key={it.id} onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-accent">
                    {checked ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <span className={it.isDone ? "text-muted-foreground line-through" : ""}>{it.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{it.plannedHours} h</span>
                  </button>
                );
              })}
            </div>
            {!done && pending.length > 0 && picked.length > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">{picked.length} point(s) seront cochés en validant « Cours accompli ».</p>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 border-t pt-3 text-xs italic text-muted-foreground">Aucun cours du cursus n'est relié à cette séance (matière ou enseignant).</p>
      )}
    </Card>
  );
}
