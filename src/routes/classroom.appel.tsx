import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, Save, UserCheck, UserX } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import { Card, Empty, Loading, PageHeader, btnGhost, btnPrimary, inputCls, todayStr } from "@/components/classroom/cursus-ui";
import { useAttendanceDay, useAttendancePromotions, useSaveAttendance } from "@/lib/cursus";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/classroom/appel")({ component: Appel });

const STATUSES = [
  { v: "PRESENT", label: "Présent", Icon: UserCheck, on: "bg-emerald-500 text-white border-emerald-500" },
  { v: "ABSENT", label: "Absent", Icon: UserX, on: "bg-red-500 text-white border-red-500" },
  { v: "LATE", label: "Retard", Icon: Clock, on: "bg-amber-500 text-white border-amber-500" },
  { v: "EXCUSED", label: "Excusé", Icon: Check, on: "bg-slate-500 text-white border-slate-500" },
] as const;

function Appel() {
  const { user, ready } = useRequireClassroom(["STAFF", "SUPER_ADMIN"]);
  const promotions = useAttendancePromotions();
  const [promotionId, setPromotionId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [slotId, setSlotId] = useState("");
  const [marks, setMarks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!promotionId && promotions.data?.[0]) {
      setPromotionId((promotions.data.find((p) => p._count.students > 0) ?? promotions.data[0]).id);
    }
  }, [promotions.data, promotionId]);

  const day = useAttendanceDay(promotionId, groupId, date);
  const save = useSaveAttendance();
  const promo = promotions.data?.find((p) => p.id === promotionId);
  const slots = day.data?.slots ?? [];
  const students = day.data?.students ?? [];

  useEffect(() => { setSlotId(slots[0]?.id ?? ""); }, [day.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pré-remplit avec l'appel déjà enregistré pour ce créneau
  const saved = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of day.data?.records ?? []) if (r.scheduleSlotId === slotId) m[r.studentId] = r.status;
    return m;
  }, [day.data, slotId]);
  useEffect(() => { setMarks(saved); }, [saved]);

  if (!ready || !user) return <Loading />;
  if (promotions.isError) return <Empty>Accès réservé au secrétariat et au responsable des présences.</Empty>;

  const done = students.filter((s) => marks[s.id]).length;
  const present = students.filter((s) => marks[s.id] === "PRESENT" || marks[s.id] === "LATE").length;

  async function submit() {
    const records = students.filter((s) => marks[s.id]).map((s) => ({ studentId: s.id, status: marks[s.id] }));
    if (!records.length) return toast.error("Cochez au moins un élève");
    try {
      const r = await save.mutateAsync({ date, slotId, records });
      toast.success(`Appel enregistré (${r.saved} élèves)`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Enregistrement impossible");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Présences" subtitle="Emploi du temps du jour et appel des élèves en salle." />

      <Card className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">Promotion
          <select className={`${inputCls} mt-1 block`} value={promotionId} onChange={(e) => { setPromotionId(e.target.value); setGroupId(""); }}>
            {(promotions.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} ({p._count.students})</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Groupe
          <select className={`${inputCls} mt-1 block`} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Tous</option>
            {(promo?.groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Date
          <input type="date" className={`${inputCls} mt-1 block`} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </Card>

      {day.isLoading ? <Loading /> : slots.length === 0 ? (
        <Empty>Aucun cours prévu ce jour pour cette promotion.</Empty>
      ) : (
        <>
          <div>
            <h2 className="mb-2 text-sm font-semibold">Emploi du temps du jour</h2>
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => {
                const count = (day.data?.records ?? []).filter((r) => r.scheduleSlotId === s.id).length;
                return (
                  <button key={s.id} onClick={() => setSlotId(s.id)}
                    className={`rounded-xl border px-4 py-2 text-left text-sm transition ${slotId === s.id ? "border-classroom bg-classroom/10" : "bg-card hover:bg-accent"}`}>
                    <div className="font-medium">{s.startTime}–{s.endTime} · {s.subjectName}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.teacher.firstName} {s.teacher.lastName}{s.room ? ` · ${s.room.name}` : ""} · {s.type}
                      {count > 0 && <span className="ml-1 text-emerald-600">· appel fait</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
              <div className="text-sm"><b>{present}</b> présent{present > 1 ? "s" : ""} · {done}/{students.length} cochés</div>
              <div className="flex gap-2">
                <button className={btnGhost} onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, "PRESENT"])))}>Tous présents</button>
                <button className={btnPrimary} onClick={submit} disabled={save.isPending || !slotId}><Save className="h-4 w-4" /> Enregistrer l'appel</button>
              </div>
            </div>
            <div className="divide-y">
              {students.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                  <div>
                    <div className="text-sm font-medium">{s.user.lastName} {s.user.firstName}</div>
                    <div className="text-xs text-muted-foreground">{s.matricule}{s.group ? ` · ${s.group.name}` : ""}</div>
                  </div>
                  <div className="flex gap-1">
                    {STATUSES.map(({ v, label, Icon, on }) => (
                      <button key={v} onClick={() => setMarks((m) => ({ ...m, [s.id]: v }))}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition ${marks[s.id] === v ? on : "hover:bg-accent"}`}>
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
