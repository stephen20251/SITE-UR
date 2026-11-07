import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useRequireClassroom } from "@/components/classroom/shared";
import {
  ArrowLeft, CheckCircle2, Send, Plus, Trash2, AlertTriangle,
  Users, Clock, Calendar, BookOpen, X, Loader2, Eye, ChevronDown,
  CheckCircle, Info,
} from "lucide-react";

export const Route = createFileRoute("/classroom/planning/$id")({
  component: PlanningBuilder,
});

// ── Types ──────────────────────────────────────────────────────────────────────

type User_      = { id: string; firstName: string; lastName: string };
type Room       = { id: string; name: string; code: string; capacity: number; type: string };
type Group      = { id: string; name: string; type?: string };
type Promotion  = { id: string; name: string; level: string; groups: Group[] };
type SubjectTeacherRef = { type: string; teacher: { user: User_ } };
type Subject    = { id: string; code: string; name: string; credits: number; weeklyHours: number; subjectTeachers: SubjectTeacherRef[] };
type Avail      = { teacherUserId: string; day: string; startTime: string; endTime: string; isAvailable: boolean; teacher: User_ };
type Slot       = {
  id: string; subjectId?: string; subjectName: string; day: string;
  startTime: string; endTime: string; type: string;
  teacherUserId: string;
  teacher: User_; room?: { id: string; name: string; code: string };
  promotion: { id: string; name: string }; group?: { id: string; name: string };
  subject?: { id: string; name: string; code: string };
  _warnings?: string[];
};
type InvitedTeacher = {
  id: string; firstName: string; lastName: string; email: string;
  hasSubmitted: boolean; availabilityCount: number;
};
type Period = {
  id: string; name: string; status: string;
  availabilityDeadline: string | null; publishAt: string | null;
  mention: { id: string; name: string; code: string };
  semester: { id: string; name: string };
  slots: Slot[];
  availabilities: Avail[];
  invitedTeachers: InvitedTeacher[];
  validation?: { validatedAt: string; notes?: string };
  weekStart?: string | null;
  sentToTeachersAt?: string | null;
  confirmations?: {
    id: string; teacherUserId: string; status: "PENDING" | "ACCEPTED" | "CONTESTED"; comment: string | null;
    respondedAt: string | null; teacher: { firstName: string; lastName: string } | null;
  }[];
  _count: { slots: number; availabilities: number };
};
type Resources  = { teachers: User_[]; rooms: Room[]; promotions: Promotion[]; subjects: Subject[] };
type Conflict   = { type: string; slot?: Slot };

// ── Constants ──────────────────────────────────────────────────────────────────

const DAYS = [
  { key: "MONDAY",    label: "Lundi" },
  { key: "TUESDAY",   label: "Mardi" },
  { key: "WEDNESDAY", label: "Mercredi" },
  { key: "THURSDAY",  label: "Jeudi" },
  { key: "FRIDAY",    label: "Vendredi" },
  { key: "SATURDAY",  label: "Samedi" },
];

const HOURS = Array.from({ length: 26 }, (_, i) => {
  const h = Math.floor(i / 2) + 7;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

const ACTIVITY = "Activité péri-universitaire";

const TYPE_COLORS: Record<string, string> = {
  CM:      "bg-blue-100 border-blue-400 text-blue-900",
  TD:      "bg-emerald-100 border-emerald-400 text-emerald-900",
  TP:      "bg-amber-100 border-amber-400 text-amber-900",
  Examen:  "bg-red-100 border-red-400 text-red-900",
  Projet:  "bg-purple-100 border-purple-400 text-purple-900",
  "Activité péri-universitaire": "bg-pink-100 border-pink-400 text-pink-900",
  default: "bg-gray-100 border-gray-300 text-gray-800",
};

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  PREPARING: { label: "En préparation", color: "bg-yellow-50 text-yellow-700 border-yellow-200", dot: "bg-yellow-400" },
  BUILDING:  { label: "En construction", color: "bg-blue-50 text-blue-700 border-blue-200",    dot: "bg-blue-400" },
  VALIDATED: { label: "Validé",           color: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-400" },
  PUBLISHED: { label: "Publié",           color: "bg-classroom/5 text-classroom border-classroom/20", dot: "bg-classroom" },
};

const CONFLICT_LABELS: Record<string, string> = {
  TEACHER_UNAVAILABLE: "❌ Ce professeur n'est pas disponible à ce créneau",
  TEACHER_BUSY:   "❌ Ce professeur a déjà un cours à ce créneau",
  ROOM_BUSY:      "❌ Cette salle est déjà réservée",
  PROMOTION_BUSY: "❌ Cette promotion a déjà un cours à ce créneau",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const emptyForm = () => ({
  subjectId: "", subjectName: "", teacherUserId: "",
  roomId: "", promotionId: "", groupId: "",
  day: "MONDAY", startTime: "08:00", endTime: "10:00", type: "CM",
});

function timeToMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

// ── Main Component ─────────────────────────────────────────────────────────────

function PlanningBuilder() {
  const { id } = Route.useParams();
  const { user, ready } = useRequireClassroom(["SUPER_ADMIN", "STAFF", "TEACHER"]);
  const nav = useNavigate();

  const [period,       setPeriod]       = useState<Period | null>(null);
  const [resources,    setResources]    = useState<Resources | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<"grid" | "availability" | "slots">("grid");
  const [reminding,    setReminding]    = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Slot form state
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotForm, setSlotForm]         = useState(emptyForm());
  const [slotError, setSlotError]       = useState("");
  const [conflicts, setConflicts]       = useState<Conflict[]>([]);
  const [slotSaving, setSlotSaving]     = useState(false);


  useEffect(() => {
    if (!ready || !user) return;
    Promise.all([
      api<Period>(`/schedule/periods/${id}`),
      api<Resources>(`/schedule/periods/${id}/resources`),
    ]).then(([p, r]) => { setPeriod(p); setResources(r); })
      .catch(() => nav({ to: "/classroom/planning" }))
      .finally(() => setLoading(false));
  }, [id, ready]);

  const isChef    = user?.systemRole === "SUPER_ADMIN" || user?.systemRole === "STAFF";
  const canEdit   = isChef && ["PREPARING", "BUILDING"].includes(period?.status ?? "");
  const meta      = STATUS_META[period?.status ?? "PREPARING"] ?? STATUS_META.PREPARING;

  // Teacher availability lookup
  // Le professeur doit avoir coché ce créneau (des blocs contigus 07h-09h + 09h-11h couvrent 07h-11h)
  function teacherAvailableAt(teacherUserId: string, day: string, start: string, end: string): boolean | null {
    if (!period) return null;
    const avails = period.availabilities
      .filter((a) => a.teacherUserId === teacherUserId && a.day === day && a.isAvailable)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const declared = period.availabilities.some((a) => a.teacherUserId === teacherUserId);
    if (!declared) return null; // aucune disponibilité soumise
    let cursor = start;
    let moved = true;
    while (cursor < end && moved) {
      moved = false;
      for (const a of avails) if (a.startTime <= cursor && a.endTime > cursor) { cursor = a.endTime; moved = true; }
    }
    return cursor >= end;
  }

  // Professeurs attitrés de la matière choisie (affectation des matières)
  const assignedTeachers = useMemo(() => {
    const subject = resources?.subjects.find((s) => s.id === slotForm.subjectId);
    if (!subject) return [] as User_[];
    const sameType = subject.subjectTeachers.filter((st) => st.type === slotForm.type);
    const list = (sameType.length ? sameType : subject.subjectTeachers).map((st) => st.teacher.user);
    return list.filter((u, i) => list.findIndex((x) => x.id === u.id) === i);
  }, [slotForm.subjectId, slotForm.type, resources]);

  // Changement de matière / type : on garde un professeur attitré
  useEffect(() => {
    if (assignedTeachers.length && !assignedTeachers.some((t) => t.id === slotForm.teacherUserId)) {
      setSlotForm((f) => ({ ...f, teacherUserId: assignedTeachers[0].id }));
    }
  }, [assignedTeachers]);

  // Groups for selected promotion
  const availableGroups = useMemo(() => {
    if (!slotForm.promotionId || !resources) return [];
    return resources.promotions.find((p) => p.id === slotForm.promotionId)?.groups ?? [];
  }, [slotForm.promotionId, resources]);

  // Subject → auto-suggest assigned teacher
  function onSubjectChange(subjectId: string) {
    const subject = resources?.subjects.find((s) => s.id === subjectId);
    if (!subject) { setSlotForm((f) => ({ ...f, subjectId: "", subjectName: "" })); return; }

    // Professeur attitré : même type de séance en priorité, sinon n'importe quel affecté
    const sameType = subject.subjectTeachers.filter((st) => st.type === slotForm.type);
    const assigned = sameType.length ? sameType : subject.subjectTeachers;
    const suggestedTeacherId = assigned[0]?.teacher.user.id ?? "";

    setSlotForm((f) => ({
      ...f,
      subjectId,
      subjectName: subject.name,
      teacherUserId: suggestedTeacherId,
    }));
  }

  // Live availability indicator
  const availStatus = useMemo(() => {
    if (!slotForm.teacherUserId || !slotForm.day || !slotForm.startTime || !slotForm.endTime) return null;
    return teacherAvailableAt(slotForm.teacherUserId, slotForm.day, slotForm.startTime, slotForm.endTime);
  }, [slotForm.teacherUserId, slotForm.day, slotForm.startTime, slotForm.endTime, period]);

  async function doAddSlot() {
    setSlotSaving(true); setSlotError(""); setConflicts([]);
    try {
      const result = await api<Slot & { _warnings: string[] }>(`/schedule/periods/${id}/slots`, {
        method: "POST", body: slotForm,
      });
      const { _warnings, ...slot } = result;
      setPeriod((p) => p ? {
        ...p,
        slots: [...p.slots, slot as Slot],
        status: p.status === "PREPARING" ? "BUILDING" : p.status,
      } : p);
      setShowSlotForm(false);
      setSlotForm(emptyForm());
      if (_warnings?.length) {
        // Non-blocking — slot was created, just show info
      }
    } catch (e: unknown) {
      const err = e as { message?: string; conflicts?: Conflict[] };
      setSlotError(err.message ?? "Erreur serveur");
      setConflicts(err.conflicts ?? []);
    } finally { setSlotSaving(false); }
  }

  async function handleAddSlot() {
    setSlotError(""); setConflicts([]);
    if (!slotForm.subjectName || !slotForm.teacherUserId || !slotForm.promotionId) {
      setSlotError("Matière, professeur et promotion sont requis"); return;
    }
    // Le professeur doit être disponible à ce créneau
    if (availStatus !== true) {
      setSlotError(availStatus === null
        ? "Ce professeur n'a pas encore donné ses disponibilités : relancez-le avant de lui attribuer un créneau."
        : "Ce professeur n'est pas disponible à ce créneau. Choisissez un autre jour / horaire parmi ses disponibilités.");
      return;
    }
    await doAddSlot();
  }

  async function removeSlot(slotId: string) {
    if (!confirm("Supprimer ce créneau ?")) return;
    await api(`/schedule/slots/${slotId}`, { method: "DELETE" });
    setPeriod((p) => p ? { ...p, slots: p.slots.filter((s) => s.id !== slotId) } : p);
  }

  async function validate() {
    setActionLoading(true);
    try {
      const updated = await api<Period>(`/schedule/periods/${id}/validate`, { method: "POST", body: { notes: "" } });
      setPeriod((p) => p ? { ...p, status: updated.status, validation: updated.validation } : p);
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setActionLoading(false); }
  }

  async function publish() {
    const pending = (period?.confirmations ?? []).filter((c) => c.status !== "ACCEPTED").length;
    const warn = !period?.sentToTeachersAt
      ? "\n\n⚠ L'emploi du temps n'a pas encore été envoyé aux enseignants pour validation."
      : pending ? `\n\n⚠ ${pending} enseignant(s) n'ont pas encore validé leur emploi du temps.` : "";
    if (!confirm(`Publier cet emploi du temps ? Les professeurs, étudiants et parents seront notifiés.${warn}`)) return;
    setActionLoading(true);
    try {
      const updated = await api<Period>(`/schedule/periods/${id}/publish`, { method: "POST" });
      setPeriod((p) => p ? { ...p, status: updated.status } : p);
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setActionLoading(false); }
  }

  // Envoi des créneaux à chaque enseignant concerné pour validation
  async function sendToTeachers() {
    const again = period?.sentToTeachersAt ? " Les validations déjà reçues seront remises à zéro." : "";
    if (!confirm(`Envoyer à chaque enseignant les créneaux qui lui sont attribués ?${again}`)) return;
    setActionLoading(true);
    try {
      const updated = await api<Period>(`/schedule/periods/${id}/send-to-teachers`, { method: "POST" });
      setPeriod((p) => p ? { ...p, sentToTeachersAt: updated.sentToTeachersAt, confirmations: updated.confirmations } : p);
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setActionLoading(false); }
  }

  async function remind() {
    setReminding(true);
    try {
      const r = await api<{ reminded: number; message?: string }>(`/schedule/periods/${id}/remind`, { method: "POST" });
      alert(r.reminded > 0 ? `Relance envoyée à ${r.reminded} enseignant(s).` : r.message ?? "Tous les enseignants ont répondu.");
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setReminding(false); }
  }

  if (!ready || !user || loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!period) return null;

  const availByTeacher = new Map<string, Avail[]>();
  period.availabilities.forEach((a) => {
    if (!availByTeacher.has(a.teacherUserId)) availByTeacher.set(a.teacherUserId, []);
    availByTeacher.get(a.teacherUserId)!.push(a);
  });

  return (
    <div className="space-y-5 pb-10">

      {/* ── Availability warning dialog ─────────────────────────── */}
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-3">
        <Link to="/classroom/planning" className="mt-1 text-gray-400 hover:text-classroom transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold ${meta.color}`}>
              <span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}
            </span>
            <span className="text-xs text-gray-400">{period.mention.name} · {period.semester.name}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{period.name}</h1>
          <div className="flex flex-wrap gap-4 mt-1 text-xs text-gray-400">
            {period.availabilityDeadline && (
              <span className="flex items-center gap-1"><Clock size={11} /> Limite profs : {new Date(period.availabilityDeadline).toLocaleString("fr-FR")}</span>
            )}
            {period.publishAt && (
              <span className="flex items-center gap-1"><Send size={11} /> Publication : {new Date(period.publishAt).toLocaleString("fr-FR")}</span>
            )}
            {period.weekStart && (
              <span className="flex items-center gap-1"><Clock size={11} /> Semaine du {new Date(period.weekStart).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</span>
            )}
          </div>
        </div>
        {isChef && (
          <div className="flex flex-wrap gap-2">
            {["BUILDING", "VALIDATED"].includes(period.status) && period._count.slots > 0 && (
              <button onClick={sendToTeachers} disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-xl border border-classroom/30 bg-classroom/5 px-3 py-2 text-xs font-semibold text-classroom hover:bg-classroom/10">
                <Send size={13} /> {period.sentToTeachersAt ? "Renvoyer aux enseignants" : "Envoyer aux enseignants"}
              </button>
            )}
            {period.status === "BUILDING" && (
              <button onClick={validate} disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100">
                <CheckCircle size={13} /> Valider
              </button>
            )}
            {period.status === "VALIDATED" && (
              <button onClick={publish} disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-xl grad-classroom px-3 py-2 text-xs font-semibold text-white">
                <Send size={13} /> Publier
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Validation par les enseignants ─────────────────────── */}
      {(period.confirmations ?? []).length > 0 && (
        <div className="rounded-2xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Validation des enseignants</h3>
            <span className="text-xs text-muted-foreground">
              {(period.confirmations ?? []).filter((c) => c.status === "ACCEPTED").length}/{(period.confirmations ?? []).length} validé(s)
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(period.confirmations ?? []).map((c) => (
              <div key={c.id} className={`rounded-xl border px-3 py-2 text-xs ${
                c.status === "ACCEPTED" ? "border-emerald-200 bg-emerald-50" : c.status === "CONTESTED" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center justify-between font-semibold">
                  <span>{c.teacher ? `${c.teacher.lastName.toUpperCase()} ${c.teacher.firstName}` : "Enseignant"}</span>
                  <span>{c.status === "ACCEPTED" ? "✓ Validé" : c.status === "CONTESTED" ? "⚠ Problème" : "⏳ En attente"}</span>
                </div>
                {c.comment && <p className="mt-1 text-gray-600">« {c.comment} »</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
        {[
          { key: "grid",         label: "Grille horaire" },
          { key: "availability", label: `Disponibilités (${period.invitedTeachers?.filter(t => t.hasSubmitted).length ?? 0}/${period.invitedTeachers?.length ?? period._count.availabilities})` },
          { key: "slots",        label: `Créneaux (${period._count.slots})` },
        ].map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === t.key ? "bg-white shadow-sm text-classroom" : "text-gray-500 hover:text-gray-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ TAB : GRID ════════════════════════════════════════════ */}
      {activeTab === "grid" && (
        <div className="space-y-4">
          {canEdit && (
            <button onClick={() => setShowSlotForm(!showSlotForm)}
              className="flex items-center gap-2 rounded-xl grad-classroom px-4 py-2.5 text-sm font-bold text-white shadow-elegant">
              <Plus size={16} /> Ajouter un créneau
            </button>
          )}

          {/* ── Slot form ────────────────────────────────────── */}
          {showSlotForm && (
            <div className="rounded-2xl border border-classroom/20 bg-card p-5 shadow-elegant space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Nouveau créneau</h3>
                <button onClick={() => { setShowSlotForm(false); setSlotError(""); setConflicts([]); }}>
                  <X size={16} className="text-gray-400 hover:text-gray-600" />
                </button>
              </div>

              {/* Error banner */}
              {slotError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-1">
                  <div className="flex items-start gap-2 text-sm text-red-700">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span className="font-medium">{slotError}</span>
                  </div>
                  {conflicts.map((c, i) => (
                    <p key={i} className="pl-5 text-xs text-red-600">{CONFLICT_LABELS[c.type] ?? c.type}</p>
                  ))}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Subject picker */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    {slotForm.type === ACTIVITY ? "Intitulé de l'activité" : "Matière"} <span className="text-red-500">*</span>
                  </label>
                  {slotForm.type === ACTIVITY ? (
                    <input value={slotForm.subjectName}
                      onChange={(e) => setSlotForm((f) => ({ ...f, subjectId: "", subjectName: e.target.value }))}
                      placeholder="Ex : Tournoi sportif, conférence, sortie pédagogique…"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-classroom" />
                  ) : (
                  <div className="relative">
                    <select value={slotForm.subjectId}
                      onChange={(e) => onSubjectChange(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-gray-200 px-3 py-2.5 pr-8 text-sm outline-none focus:border-classroom">
                      <option value="">— Choisir une matière —</option>
                      {(resources?.subjects ?? []).map((s) => (
                        <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-gray-400" />
                  </div>
                  )}
                  {slotForm.type !== ACTIVITY && !resources?.subjects.length && (
                    <p className="mt-1 text-xs text-amber-600">
                      Aucune matière — configurez-les dans Configuration → Matières
                    </p>
                  )}
                </div>

                {/* Teacher */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Professeur <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    {assignedTeachers.length === 1 ? (
                      <div className="w-full rounded-xl border border-classroom/30 bg-classroom/5 px-3 py-2.5 text-sm">
                        {assignedTeachers[0].lastName.toUpperCase()} {assignedTeachers[0].firstName}
                        <span className="ml-1 text-xs text-muted-foreground">(professeur attitré)</span>
                      </div>
                    ) : (
                    <select value={slotForm.teacherUserId}
                      onChange={(e) => setSlotForm((f) => ({ ...f, teacherUserId: e.target.value }))}
                      className="w-full appearance-none rounded-xl border border-gray-200 px-3 py-2.5 pr-8 text-sm outline-none focus:border-classroom">
                      <option value="">— Choisir —</option>
                      {(assignedTeachers.length ? assignedTeachers : resources?.teachers ?? []).map((t) => {
                        const ok = teacherAvailableAt(t.id, slotForm.day, slotForm.startTime, slotForm.endTime);
                        return (
                          <option key={t.id} value={t.id} disabled={ok !== true}>
                            {t.lastName.toUpperCase()} {t.firstName} {ok === true ? "— disponible" : ok === false ? "— indisponible" : "— pas de disponibilités"}
                          </option>
                        );
                      })}
                    </select>
                    )}
                    <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-gray-400" />
                  </div>
                </div>

                {/* Promotion */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Promotion <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select value={slotForm.promotionId}
                      onChange={(e) => setSlotForm((f) => ({ ...f, promotionId: e.target.value, groupId: "" }))}
                      className="w-full appearance-none rounded-xl border border-gray-200 px-3 py-2.5 pr-8 text-sm outline-none focus:border-classroom">
                      <option value="">— Choisir —</option>
                      {(resources?.promotions ?? []).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.level})</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-gray-400" />
                  </div>
                </div>

                {/* Group (optional, cascades from promo) */}
                {availableGroups.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Groupe (opt.)</label>
                    <div className="relative">
                      <select value={slotForm.groupId}
                        onChange={(e) => setSlotForm((f) => ({ ...f, groupId: e.target.value }))}
                        className="w-full appearance-none rounded-xl border border-gray-200 px-3 py-2.5 pr-8 text-sm outline-none focus:border-classroom">
                        <option value="">— Tous les groupes —</option>
                        {availableGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-gray-400" />
                    </div>
                  </div>
                )}

                {/* Room */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Salle</label>
                  <div className="relative">
                    <select value={slotForm.roomId}
                      onChange={(e) => setSlotForm((f) => ({ ...f, roomId: e.target.value }))}
                      className="w-full appearance-none rounded-xl border border-gray-200 px-3 py-2.5 pr-8 text-sm outline-none focus:border-classroom">
                      <option value="">— Non assignée —</option>
                      {(resources?.rooms ?? []).map((r) => (
                        <option key={r.id} value={r.id}>{r.name} ({r.code}) — {r.capacity} pl.</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-gray-400" />
                  </div>
                </div>

                {/* Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Type</label>
                  <div className="flex gap-1 flex-wrap">
                    {["CM", "TD", "TP", "Examen", "Projet", "Activité péri-universitaire"].map((t) => (
                      <button key={t} onClick={() => setSlotForm((f) => ({ ...f, type: t }))}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                          slotForm.type === t ? "bg-classroom text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Day */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Jour</label>
                  <div className="relative">
                    <select value={slotForm.day}
                      onChange={(e) => setSlotForm((f) => ({ ...f, day: e.target.value }))}
                      className="w-full appearance-none rounded-xl border border-gray-200 px-3 py-2.5 pr-8 text-sm outline-none focus:border-classroom">
                      {DAYS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-gray-400" />
                  </div>
                </div>

                {/* Start / End time */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Début</label>
                    <select value={slotForm.startTime}
                      onChange={(e) => setSlotForm((f) => ({ ...f, startTime: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-classroom">
                      {HOURS.map((h) => <option key={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Fin</label>
                    <select value={slotForm.endTime}
                      onChange={(e) => setSlotForm((f) => ({ ...f, endTime: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-classroom">
                      {HOURS.filter((h) => h > slotForm.startTime).map((h) => <option key={h}>{h}</option>)}
                    </select>
                  </div>
                </div>

                {/* Live availability indicator */}
                {slotForm.teacherUserId && (
                  <div className="sm:col-span-2">
                    {availStatus === null && (
                      <p className="flex items-center gap-1.5 text-xs text-red-600">
                        <Info size={12} /> Ce professeur n'a soumis aucune disponibilité : impossible de lui attribuer un créneau
                      </p>
                    )}
                    {availStatus === true && (
                      <p className="flex items-center gap-1.5 text-xs text-green-600">
                        <CheckCircle size={12} /> Disponible à ce créneau
                      </p>
                    )}
                    {availStatus === false && (
                      <p className="flex items-center gap-1.5 text-xs text-amber-600">
                        <AlertTriangle size={12} /> Indisponible à ce créneau — choisissez un horaire parmi ses disponibilités
                      </p>
                    )}
                  </div>
                )}
              </div>

              <button onClick={handleAddSlot} disabled={slotSaving}
                className="w-full rounded-xl grad-classroom py-3 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60">
                {slotSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Ajouter le créneau
              </button>
            </div>
          )}

          {/* ── Week grid — calendrier professionnel ───────────── */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-elegant overflow-hidden flex flex-col" style={{ height: "calc(100vh - 22rem)" }}>
            {/* ── Sticky day header ─────────────────────────── */}
            <div className="flex shrink-0 border-b border-gray-100 bg-gray-50/90 backdrop-blur-sm z-20">
              <div className="w-14 shrink-0 border-r border-gray-100" />
              {DAYS.map((d) => (
                <div key={d.key} className="flex-1 border-l border-gray-100 py-2.5 text-center text-xs font-semibold text-gray-500 min-w-[100px]">
                  {d.label}
                </div>
              ))}
            </div>

            {/* ── Scrollable body ───────────────────────────── */}
            <div className="flex-1 overflow-y-auto overflow-x-auto">
              <div className="flex" style={{ minWidth: "700px" }}>
                {/* Hour column — sticky left */}
                <div className="sticky left-0 z-10 w-14 shrink-0 bg-white border-r border-gray-100">
                  {HOURS.map((h, i) => (
                    <div key={h} className={`flex items-start justify-end pr-2 pt-0.5 text-[10px] text-gray-400 border-b border-gray-50 ${i % 2 === 0 ? "font-medium text-gray-500" : "opacity-50"}`}
                      style={{ height: "28px" }}>
                      {i % 2 === 0 ? h : ""}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {DAYS.map((d) => {
                  const daySlots = period.slots.filter((s) => s.day === d.key);
                  return (
                    <div key={d.key} className="flex-1 relative border-l border-gray-100 min-w-[100px]">
                      {HOURS.map((h, i) => (
                        <div key={h} className={`border-b ${i % 2 === 0 ? "border-gray-100" : "border-gray-50"}`} style={{ height: "28px" }} />
                      ))}
                      {daySlots.map((slot) => {
                        const PX_PER_MIN = 28 / 30;
                        const top    = (timeToMin(slot.startTime) - timeToMin("07:00")) * PX_PER_MIN;
                        const height = Math.max((timeToMin(slot.endTime) - timeToMin(slot.startTime)) * PX_PER_MIN, 28);
                        const colorClass = TYPE_COLORS[slot.type] ?? TYPE_COLORS.default;
                        return (
                          <div key={slot.id}
                            className={`absolute left-0.5 right-0.5 rounded-lg border p-1 text-[9px] leading-tight overflow-hidden cursor-pointer group shadow-sm ${colorClass}`}
                            style={{ top: `${top}px`, height: `${height}px` }}>
                            <div className="font-bold truncate">{slot.subjectName}</div>
                            <div className="opacity-75 truncate">{slot.teacher?.lastName} {slot.teacher?.firstName?.charAt(0)}.</div>
                            <div className="flex items-center gap-1 opacity-60">
                              {slot.room && <span className="truncate">{slot.room.code}</span>}
                              <span className="rounded bg-black/10 px-1">{slot.type}</span>
                            </div>
                            {canEdit && (
                              <button onClick={() => removeSlot(slot.id)}
                                className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center h-4 w-4 rounded-md bg-red-500 text-white shadow">
                                <X size={7} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Legend ────────────────────────────────────── */}
            <div className="shrink-0 flex items-center gap-3 border-t border-gray-100 px-4 py-2 bg-gray-50/50">
              {Object.entries(TYPE_COLORS).filter(([k]) => k !== "default").map(([type, cls]) => (
                <span key={type} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
                  {type}
                </span>
              ))}
              <span className="ml-auto text-[10px] text-gray-400">{period.slots.length} créneau{period.slots.length !== 1 ? "x" : ""}</span>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB : AVAILABILITY ════════════════════════════════════ */}
      {activeTab === "availability" && (
        <div className="space-y-4">
          {/* Summary header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              {(() => {
                const invited = period.invitedTeachers ?? [];
                const done    = invited.filter(t => t.hasSubmitted).length;
                const total   = invited.length;
                return (
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {done}/{total} enseignant{total !== 1 ? "s" : ""} {done === total && total > 0 ? "ont tous répondu ✅" : "ont répondu"}
                      </p>
                      {period.availabilityDeadline && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock size={11} /> Date limite : {new Date(period.availabilityDeadline).toLocaleString("fr-FR")}
                        </p>
                      )}
                    </div>
                    {total > 0 && (
                      <div className="h-2 w-32 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            {isChef && period.status === "PREPARING" && (period.invitedTeachers ?? []).some(t => !t.hasSubmitted) && (
              <button onClick={remind} disabled={reminding}
                className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60">
                {reminding ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Relancer les en attente
              </button>
            )}
          </div>

          {/* Teacher cards */}
          {(period.invitedTeachers ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-14 text-center text-gray-400">
              <Users size={36} className="mb-3 opacity-30" />
              <p className="font-medium">Aucun enseignant trouvé pour cette mention</p>
              <p className="text-sm mt-1">Vérifiez que des matières et des enseignants sont configurés pour la mention {period.mention.name}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(period.invitedTeachers ?? []).map((teacher) => {
                const avails = period.availabilities.filter(a => a.teacherUserId === teacher.id && a.isAvailable);
                return (
                  <div key={teacher.id}
                    className={`rounded-2xl border p-4 transition-colors ${teacher.hasSubmitted ? "border-green-200 bg-green-50/30 dark:border-green-900/30 dark:bg-green-950/10" : "border-gray-200 bg-card"}`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${teacher.hasSubmitted ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                          {teacher.hasSubmitted ? "✓" : "?"}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-900">{teacher.lastName.toUpperCase()} {teacher.firstName}</p>
                          <p className="text-xs text-gray-400">{teacher.email}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        teacher.hasSubmitted
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${teacher.hasSubmitted ? "bg-green-500" : "bg-amber-400"}`} />
                        {teacher.hasSubmitted ? `Envoyé · ${teacher.availabilityCount} créneau${teacher.availabilityCount !== 1 ? "x" : ""}` : "En attente"}
                      </span>
                    </div>
                    {teacher.hasSubmitted && avails.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {avails.map((a, i) => (
                          <span key={i} className="rounded-lg bg-white border border-green-200 px-2 py-0.5 text-[11px] text-green-700 font-medium">
                            {DAYS.find((d) => d.key === a.day)?.label} {a.startTime}–{a.endTime}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB : SLOTS LIST ═════════════════════════════════════ */}
      {activeTab === "slots" && (
        <div className="space-y-2">
          {!period.slots.length ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-14 text-center text-gray-400">
              <BookOpen size={36} className="mb-3 opacity-30" />
              <p className="font-medium">Aucun créneau créé</p>
              <p className="text-sm mt-1">Passez à l'onglet "Grille horaire" pour ajouter des créneaux.</p>
            </div>
          ) : (
            period.slots
              .slice()
              .sort((a, b) => DAYS.findIndex((d) => d.key === a.day) - DAYS.findIndex((d) => d.key === b.day) || a.startTime.localeCompare(b.startTime))
              .map((slot) => (
                <div key={slot.id} className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3 shadow-sm">
                  <div className="w-20 shrink-0 text-xs font-semibold text-classroom">
                    {DAYS.find((d) => d.key === slot.day)?.label}<br />
                    <span className="font-normal text-gray-400">{slot.startTime}–{slot.endTime}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{slot.subjectName}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {slot.teacher?.lastName?.toUpperCase()} {slot.teacher?.firstName}
                      {slot.room && ` · ${slot.room.name}`}
                      {slot.group && ` · ${slot.group.name}`}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold bg-muted text-muted-foreground">
                    {slot.type}
                  </span>
                  {canEdit && (
                    <button onClick={() => removeSlot(slot.id)}
                      className="shrink-0 rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-500 hover:bg-red-100">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))
          )}
        </div>
      )}

      {/* ── Validation summary ──────────────────────────────────── */}
      {isChef && period.status === "BUILDING" && period.slots.length > 0 && (
        <div className="rounded-2xl border border-green-100 bg-green-50 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
            <CheckCircle2 size={15} /> Prêt à valider
          </h3>
          <div className="text-xs text-green-700 space-y-1">
            <p>✔ {period._count.slots} créneaux planifiés</p>
            <p>✔ {period._count.availabilities} disponibilités professeurs reçues</p>
            <p>✔ Vérification des conflits automatique à chaque ajout</p>
          </div>
          <button onClick={validate} disabled={actionLoading}
            className="mt-2 flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2 text-xs font-bold text-white hover:bg-green-800 disabled:opacity-60">
            {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
            Valider l'emploi du temps
          </button>
        </div>
      )}
    </div>
  );
}
