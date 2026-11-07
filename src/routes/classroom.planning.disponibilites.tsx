import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useRequireClassroom } from "@/components/classroom/shared";
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, Loader2, Send, ThumbsUp } from "lucide-react";

export const Route = createFileRoute("/classroom/planning/disponibilites")({
  component: DisponibilitesPage,
});

type Period = {
  id: string; name: string; status: string; availabilityDeadline: string | null;
  weekStart: string | null; sentToTeachersAt: string | null; mention: { name: string };
};
type SlotEntry = { day: string; startTime: string; endTime: string; isAvailable: boolean };
type MySlot = {
  id: string; day: string; startTime: string; endTime: string; type: string; subjectName: string;
  room: { name: string; code: string } | null; promotion: { name: string; level: string } | null; group: { name: string } | null;
};
type Confirmation = { status: "PENDING" | "ACCEPTED" | "CONTESTED"; comment: string | null; respondedAt: string | null };

const DAYS = [
  { key: "MONDAY", label: "Lundi" }, { key: "TUESDAY", label: "Mardi" },
  { key: "WEDNESDAY", label: "Mercredi" }, { key: "THURSDAY", label: "Jeudi" },
  { key: "FRIDAY", label: "Vendredi" }, { key: "SATURDAY", label: "Samedi" },
];
const DAY_LABEL: Record<string, string> = Object.fromEntries(DAYS.map((d) => [d.key, d.label]));

const TIME_SLOTS = [
  { start: "07:00", end: "09:00", label: "07h–09h" },
  { start: "09:00", end: "11:00", label: "09h–11h" },
  { start: "11:00", end: "13:00", label: "11h–13h" },
  { start: "13:00", end: "15:00", label: "13h–15h" },
  { start: "15:00", end: "17:00", label: "15h–17h" },
  { start: "17:00", end: "19:00", label: "17h–19h" },
];

// Lundi de la semaine prochaine si la période n'a pas de semaine définie
function mondayOf(p: Period | null): Date {
  if (p?.weekStart) return new Date(p.weekStart);
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
  return d;
}
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtDay = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

function DisponibilitesPage() {
  const { user, ready } = useRequireClassroom(["TEACHER"]);

  const [periods, setPeriods]               = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [slots, setSlots]                   = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading]               = useState(true);
  const [submitting, setSubmitting]         = useState(false);
  const [submitted, setSubmitted]           = useState(false);
  const [error, setError]                   = useState("");

  function load() {
    return api<Period[]>("/schedule/periods")
      .then((ps) => {
        setPeriods(ps);
        const open = ps.filter((p) => ["PREPARING", "BUILDING"].includes(p.status));
        if (open.length && !selectedPeriod) selectPeriod(open[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (ready) load(); }, [ready]);

  async function selectPeriod(p: Period) {
    setSelectedPeriod(p);
    setSubmitted(false);
    setSlots(new Map());
    try {
      const existing = await api<SlotEntry[]>(`/schedule/periods/${p.id}/my-availability`);
      const map = new Map<string, boolean>();
      existing.forEach((e) => map.set(`${e.day}|${e.startTime}`, e.isAvailable));
      setSlots(map);
    } catch { /* aucune disponibilité encore */ }
  }

  // Cocher = disponible ; recliquer = retirer
  function toggle(day: string, start: string) {
    const key = `${day}|${start}`;
    setSlots((prev) => {
      const next = new Map(prev);
      if (next.get(key)) next.delete(key); else next.set(key, true);
      return next;
    });
  }

  async function submit() {
    if (!selectedPeriod) return;
    const entries: SlotEntry[] = [];
    // Toutes les cases de la grille sont envoyées : cochée = disponible, sinon indisponible
    DAYS.forEach((d) => TIME_SLOTS.forEach((ts) => {
      entries.push({ day: d.key, startTime: ts.start, endTime: ts.end, isAvailable: !!slots.get(`${d.key}|${ts.start}`) });
    }));
    if (![...slots.values()].some(Boolean)) { setError("Cochez au moins un créneau où vous êtes disponible"); return; }
    setSubmitting(true); setError("");
    try {
      await api(`/schedule/periods/${selectedPeriod.id}/my-availability`, { method: "POST", body: { slots: entries } });
      setSubmitted(true);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setSubmitting(false); }
  }

  if (!ready || !user || loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const open = periods.filter((p) => ["PREPARING", "BUILDING"].includes(p.status));
  const toValidate = periods.filter((p) => p.sentToTeachersAt);
  const monday = mondayOf(selectedPeriod);
  const saturday = addDays(monday, 5);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Mes disponibilités</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Cochez les créneaux où vous êtes disponible la semaine prochaine. Le Responsable Pédagogique s'en sert pour construire
          l'emploi du temps de chaque classe, puis vous l'envoie pour validation.
        </p>
      </div>

      {/* ── Emplois du temps envoyés par le RP ───────────────────────── */}
      {toValidate.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarCheck size={18} className="text-classroom" /> Emploi du temps à valider</h2>
          {toValidate.map((p) => <ScheduleToValidate key={p.id} period={p} />)}
        </section>
      )}

      {/* ── Saisie des disponibilités ────────────────────────────────── */}
      {open.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-muted-foreground">
          <Clock size={40} className="mb-3 opacity-30" />
          <p className="font-medium">Aucune demande de disponibilité en cours</p>
          <p className="mt-1 text-sm">Le Responsable Pédagogique n'a pas encore ouvert la planification de la semaine prochaine.</p>
        </div>
      ) : (
        <section className="space-y-4">
          {open.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {open.map((p) => (
                <button key={p.id} onClick={() => selectPeriod(p)}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${selectedPeriod?.id === p.id ? "border-classroom bg-classroom text-white" : "hover:bg-accent"}`}>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {selectedPeriod && (
            <div className="rounded-2xl border border-classroom/20 bg-classroom/5 p-4">
              <p className="font-semibold text-classroom">{selectedPeriod.name} — {selectedPeriod.mention.name}</p>
              <p className="mt-0.5 text-sm">Semaine du <b>{monday.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</b> au <b>{saturday.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</b></p>
              {selectedPeriod.availabilityDeadline && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-orange-700">
                  <Clock size={12} /> À rendre avant le {new Date(selectedPeriod.availabilityDeadline).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          )}

          {submitted ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-green-200 bg-green-50 py-12 text-center">
              <CheckCircle2 size={40} className="mb-3 text-green-500" />
              <p className="font-semibold text-green-800">Disponibilités envoyées !</p>
              <p className="mt-1 text-sm text-green-600">Le Responsable Pédagogique va organiser les emplois du temps et vous les envoyer pour validation.</p>
              <button onClick={() => setSubmitted(false)} className="mt-4 text-sm text-green-700 underline">Modifier mes disponibilités</button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="bg-muted/40 text-xs font-semibold text-muted-foreground">
                      <th className="w-24 py-3 pl-5 text-left">Heure</th>
                      {DAYS.map((d, i) => (
                        <th key={d.key} className="px-2 py-3 text-center">
                          {d.label}<div className="font-normal">{fmtDay(addDays(monday, i))}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {TIME_SLOTS.map((ts) => (
                      <tr key={ts.start}>
                        <td className="py-2 pl-5 text-xs font-medium text-muted-foreground">{ts.label}</td>
                        {DAYS.map((d) => {
                          const on = !!slots.get(`${d.key}|${ts.start}`);
                          return (
                            <td key={d.key} className="px-1.5 py-1.5 text-center">
                              <button onClick={() => toggle(d.key, ts.start)}
                                className={`h-9 w-full rounded-lg border-2 text-xs font-bold transition ${on ? "border-green-500 bg-green-500 text-white" : "border-dashed text-muted-foreground/40 hover:border-green-300"}`}>
                                {on ? "✓ Dispo" : ""}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 border-t p-5">
                <p className="text-xs text-muted-foreground">{[...slots.values()].filter(Boolean).length} créneau(x) coché(s) · les cases non cochées sont considérées comme indisponibles.</p>
                {error && <p className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle size={14} /> {error}</p>}
                <button onClick={submit} disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom py-3 text-sm font-bold text-white disabled:opacity-60">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Envoyer mes disponibilités
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// Emploi du temps envoyé par le Responsable Pédagogique : l'enseignant valide ou signale un problème
function ScheduleToValidate({ period }: { period: Period }) {
  const [data, setData] = useState<{ slots: MySlot[]; confirmation: Confirmation | null } | null>(null);
  const [comment, setComment] = useState("");
  const [contesting, setContesting] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => api<{ slots: MySlot[]; confirmation: Confirmation | null }>(`/schedule/periods/${period.id}/my-slots`).then(setData).catch(() => setData(null));
  useEffect(() => { load(); }, [period.id]);

  async function respond(status: "ACCEPTED" | "CONTESTED") {
    setBusy(true);
    try {
      await api(`/schedule/periods/${period.id}/respond`, { method: "POST", body: { status, comment } });
      toast.success(status === "ACCEPTED" ? "Emploi du temps validé" : "Problème signalé au Responsable Pédagogique");
      setContesting(false); setComment("");
      await load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  }

  if (!data?.confirmation) return null;
  const c = data.confirmation;
  const monday = mondayOf(period);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3">
        <span className="font-semibold">{period.name}</span>
        <span className="text-xs text-muted-foreground">semaine du {fmtDay(monday)}</span>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          c.status === "ACCEPTED" ? "bg-emerald-100 text-emerald-700" : c.status === "CONTESTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
          {c.status === "ACCEPTED" ? "Validé" : c.status === "CONTESTED" ? "Problème signalé" : "À valider"}
        </span>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {data.slots.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-2 font-medium">{DAY_LABEL[s.day] ?? s.day} {fmtDay(addDays(monday, Math.max(0, DAYS.findIndex((d) => d.key === s.day))))}</td>
              <td className="px-4 py-2">{s.startTime}–{s.endTime}</td>
              <td className="px-4 py-2">{s.subjectName} <span className="text-xs text-muted-foreground">({s.type})</span></td>
              <td className="px-4 py-2 text-muted-foreground">{s.promotion?.name ?? ""}{s.group ? ` · ${s.group.name}` : ""}</td>
              <td className="px-4 py-2 text-muted-foreground">{s.room?.name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {c.comment && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Votre remarque : « {c.comment} »</p>}
      {c.status !== "ACCEPTED" && (
        <div className="space-y-2 border-t p-4">
          {contesting && (
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
              placeholder="Expliquez le problème (créneau impossible, conflit, salle…)"
              className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:border-classroom" />
          )}
          <div className="flex gap-2">
            <button onClick={() => respond("ACCEPTED")} disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              <ThumbsUp size={15} /> Valider mon emploi du temps
            </button>
            <button onClick={() => (contesting ? respond("CONTESTED") : setContesting(true))} disabled={busy}
              className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-60">
              <AlertTriangle size={15} /> {contesting ? "Envoyer" : "Signaler un problème"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
