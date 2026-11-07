import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { useErpAuth } from "./erp";
import {
  ArrowLeft, CheckCircle2, Send, Plus, Trash2, AlertTriangle,
  Users, Clock, Calendar, BookOpen, X, Loader2, Eye, ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/erp/planning/$id")({
  component: PlanningBuilder,
});

type User_ = { id: string; firstName: string; lastName: string };
type Room   = { id: string; name: string; code: string; capacity: number };
type Promotion = { id: string; name: string; level: string; groups: { id: string; name: string }[] };
type Course = { id: string; title: string; subject: { name: string; code: string } };
type Avail  = { teacherUserId: string; day: string; startTime: string; endTime: string; isAvailable: boolean; teacher: User_ };
type Slot   = { id: string; subjectName: string; day: string; startTime: string; endTime: string; type: string;
                teacher: User_; room: { id: string; name: string; code: string } | null;
                promotion: { id: string; name: string } | null; group: { id: string; name: string } | null };
type Period = {
  id: string; name: string; status: string;
  availabilityDeadline: string | null; publishAt: string | null;
  mention: { name: string; code: string }; semester: { name: string };
  slots: Slot[]; availabilities: Avail[];
  _count: { slots: number; availabilities: number };
  validation: { validatedAt: string; notes: string } | null;
};

const DAYS: { key: string; label: string }[] = [
  { key: "MONDAY", label: "Lundi" }, { key: "TUESDAY", label: "Mardi" },
  { key: "WEDNESDAY", label: "Mercredi" }, { key: "THURSDAY", label: "Jeudi" },
  { key: "FRIDAY", label: "Vendredi" },
];
const HOURS = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
const HOUR0 = 7; const ROW = 64;
const toFloat = (t: string) => { const [h, m] = t.split(":").map(Number); return h + m / 60; };

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  PREPARING: { label: "En préparation", color: "text-yellow-700 bg-yellow-50 border-yellow-200", dot: "bg-yellow-400" },
  BUILDING:  { label: "En construction", color: "text-blue-700 bg-blue-50 border-blue-200", dot: "bg-blue-400" },
  VALIDATED: { label: "Validé",          color: "text-green-700 bg-green-50 border-green-200", dot: "bg-green-500" },
  PUBLISHED: { label: "Publié",          color: "text-[#0F1E3C] bg-[#0F1E3C]/5 border-[#0F1E3C]/20", dot: "bg-[#0F1E3C]" },
};

const SLOT_COLORS = ["bg-blue-500","bg-purple-500","bg-green-600","bg-orange-500","bg-pink-500","bg-teal-500","bg-indigo-500","bg-red-500"];

export default function PlanningBuilder() {
  const { id } = Route.useParams();
  const { user } = useErpAuth();
  const nav = useNavigate();
  const isChef = user?.systemRole === "SUPER_ADMIN" || user?.systemRole === "STAFF";

  const [period, setPeriod] = useState<Period | null>(null);
  const [resources, setResources] = useState<{ teachers: User_[]; rooms: Room[]; promotions: Promotion[]; courses: Course[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"grid" | "availability" | "slots">("grid");

  // New slot form
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotForm, setSlotForm] = useState({ subjectName: "", courseId: "", teacherUserId: "", roomId: "", promotionId: "", groupId: "", day: "MONDAY", startTime: "08:00", endTime: "10:00", type: "CM" });
  const [slotError, setSlotError] = useState("");
  const [conflicts, setConflicts] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api<Period>(`/schedule/periods/${id}`),
      api<any>(`/schedule/periods/${id}/resources`),
    ]).then(([p, r]) => { setPeriod(p); setResources(r); })
      .catch(() => nav({ to: "/erp/planning" }))
      .finally(() => setLoading(false));
  }, [id]);

  async function addSlot() {
    setSlotError(""); setConflicts([]);
    if (!slotForm.subjectName || !slotForm.teacherUserId || !slotForm.promotionId) {
      setSlotError("Matière, professeur et promotion sont requis"); return;
    }
    try {
      const slot = await api<Slot>(`/schedule/periods/${id}/slots`, { method: "POST", body: slotForm });
      setPeriod((p) => p ? { ...p, slots: [...p.slots, slot], status: p.status === "PREPARING" ? "BUILDING" : p.status } : p);
      setShowSlotForm(false);
      setSlotForm({ subjectName: "", courseId: "", teacherUserId: "", roomId: "", promotionId: "", groupId: "", day: "MONDAY", startTime: "08:00", endTime: "10:00", type: "CM" });
    } catch (e: any) {
      setSlotError(e.message);
      if (e.conflicts) setConflicts(e.conflicts);
    }
  }

  async function removeSlot(slotId: string) {
    await api(`/schedule/slots/${slotId}`, { method: "DELETE" });
    setPeriod((p) => p ? { ...p, slots: p.slots.filter((s) => s.id !== slotId) } : p);
  }

  async function validate() {
    setActionLoading(true);
    try {
      const updated = await api<Period>(`/schedule/periods/${id}/validate`, { method: "POST", body: { notes: "" } });
      setPeriod((p) => p ? { ...p, status: updated.status, validation: updated.validation } : p);
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  async function publish() {
    if (!confirm("Publier cet emploi du temps ? Les professeurs, étudiants et parents seront notifiés.")) return;
    setActionLoading(true);
    try {
      const updated = await api<Period>(`/schedule/periods/${id}/publish`, { method: "POST" });
      setPeriod((p) => p ? { ...p, status: updated.status } : p);
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  // Availability helpers
  function teacherAvailableAt(teacherUserId: string, day: string, startTime: string, endTime: string) {
    if (!period) return null;
    const avails = period.availabilities.filter((a) => a.teacherUserId === teacherUserId && a.day === day && a.isAvailable);
    return avails.some((a) => a.startTime <= startTime && a.endTime >= endTime);
  }

  function slotColor(i: number) { return SLOT_COLORS[i % SLOT_COLORS.length]; }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0F1E3C] border-t-[#FFD166]" />
    </div>
  );
  if (!period) return null;

  const meta = STATUS_META[period.status] ?? STATUS_META.PREPARING;
  const teacherMap = new Map(resources?.teachers.map((t) => [t.id, t]) ?? []);
  const promotionMap = new Map(resources?.promotions.map((p) => [p.id, p]) ?? []);

  // Group availabilities by teacher
  const availByTeacher = new Map<string, Avail[]>();
  period.availabilities.forEach((a) => {
    if (!availByTeacher.has(a.teacherUserId)) availByTeacher.set(a.teacherUserId, []);
    availByTeacher.get(a.teacherUserId)!.push(a);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <Link to="/erp/planning" className="mt-1 text-gray-400 hover:text-[#0F1E3C] transition-colors">
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
            {period.availabilityDeadline && <span className="flex items-center gap-1"><Clock size={11} /> Limite profs : {new Date(period.availabilityDeadline).toLocaleString("fr-FR")}</span>}
            {period.publishAt && <span className="flex items-center gap-1"><Send size={11} /> Publication : {new Date(period.publishAt).toLocaleString("fr-FR")}</span>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {isChef && period.status === "BUILDING" && (
            <button onClick={validate} disabled={actionLoading}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 transition-colors disabled:opacity-60">
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Valider
            </button>
          )}
          {isChef && period.status === "VALIDATED" && (
            <button onClick={publish} disabled={actionLoading}
              className="flex items-center gap-2 rounded-xl bg-[#0F1E3C] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1B3A6B] transition-colors disabled:opacity-60">
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Publier
            </button>
          )}
          {period.status === "PUBLISHED" && (
            <Link to="/erp/planning/view/$id" params={{ id }}
              className="flex items-center gap-2 rounded-xl bg-[#0F1E3C] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1B3A6B] transition-colors">
              <Eye size={14} /> Voir l'emploi du temps
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {[
          { key: "grid", label: "Grille horaire" },
          { key: "availability", label: `Disponibilités (${period._count.availabilities})` },
          { key: "slots", label: `Créneaux (${period.slots.length})` },
        ].map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${activeTab === t.key ? "bg-white shadow-sm text-[#0F1E3C]" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB : GRID ─────────────────────────────────────────── */}
      {activeTab === "grid" && (
        <div className="space-y-4">
          {isChef && ["PREPARING","BUILDING"].includes(period.status) && (
            <button onClick={() => setShowSlotForm(!showSlotForm)}
              className="flex items-center gap-2 rounded-xl bg-[#0F1E3C] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1B3A6B] transition-colors">
              <Plus size={16} /> Ajouter un créneau
            </button>
          )}

          {/* Slot form */}
          {showSlotForm && (
            <div className="rounded-2xl border border-[#0F1E3C]/20 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Nouveau créneau</h3>
                <button onClick={() => setShowSlotForm(false)}><X size={16} className="text-gray-400" /></button>
              </div>
              {slotError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <div>
                    {slotError}
                    {conflicts.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {conflicts.map((c, i) => (
                          <li key={i} className="text-xs">
                            {c.type === "TEACHER_BUSY" && "⚠️ Professeur déjà occupé à ce créneau"}
                            {c.type === "ROOM_BUSY" && "⚠️ Salle déjà occupée"}
                            {c.type === "PROMOTION_BUSY" && "⚠️ Promotion déjà en cours"}
                            {c.type === "TEACHER_UNAVAILABLE" && "ℹ️ Professeur non disponible (hors de ses créneaux)"}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Matière *</label>
                  <input value={slotForm.subjectName} onChange={(e) => setSlotForm({ ...slotForm, subjectName: e.target.value })}
                    placeholder="Base de données, Algorithmique…"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0F1E3C]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Professeur *</label>
                  <select value={slotForm.teacherUserId} onChange={(e) => setSlotForm({ ...slotForm, teacherUserId: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0F1E3C]">
                    <option value="">— Choisir —</option>
                    {resources?.teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Promotion *</label>
                  <select value={slotForm.promotionId} onChange={(e) => setSlotForm({ ...slotForm, promotionId: e.target.value, groupId: "" })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0F1E3C]">
                    <option value="">— Choisir —</option>
                    {resources?.promotions.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.level})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Salle</label>
                  <select value={slotForm.roomId} onChange={(e) => setSlotForm({ ...slotForm, roomId: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0F1E3C]">
                    <option value="">— Non assignée —</option>
                    {resources?.rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.code}) — {r.capacity} pl.</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select value={slotForm.type} onChange={(e) => setSlotForm({ ...slotForm, type: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0F1E3C]">
                    {["CM","TD","TP","Examen","Projet","Activité péri-universitaire"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Jour</label>
                  <select value={slotForm.day} onChange={(e) => setSlotForm({ ...slotForm, day: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0F1E3C]">
                    {DAYS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Début</label>
                  <select value={slotForm.startTime} onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0F1E3C]">
                    {HOURS.map((h) => <option key={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fin</label>
                  <select value={slotForm.endTime} onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0F1E3C]">
                    {HOURS.filter((h) => h > slotForm.startTime).map((h) => <option key={h}>{h}</option>)}
                  </select>
                </div>

                {/* Teacher availability indicator */}
                {slotForm.teacherUserId && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-gray-600 mb-1.5">Vérification disponibilité :</p>
                    {(() => {
                      const avail = teacherAvailableAt(slotForm.teacherUserId, slotForm.day, slotForm.startTime, slotForm.endTime);
                      if (avail === null) return <p className="text-xs text-gray-400">Aucune disponibilité soumise pour ce professeur.</p>;
                      return avail
                        ? <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 size={12} /> Disponible à ce créneau</p>
                        : <p className="text-xs text-orange-500 flex items-center gap-1"><AlertTriangle size={12} /> Non disponible (hors de ses créneaux)</p>;
                    })()}
                  </div>
                )}
              </div>
              <button onClick={addSlot}
                className="w-full rounded-xl bg-[#0F1E3C] py-3 text-sm font-bold text-white hover:bg-[#1B3A6B] transition-colors">
                Ajouter le créneau
              </button>
            </div>
          )}

          {/* Week grid */}
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="min-w-[700px]">
              {/* Header */}
              <div className="grid grid-cols-[56px_repeat(5,1fr)] border-b border-gray-100 text-xs font-semibold text-gray-500">
                <div className="p-3" />
                {DAYS.map((d) => <div key={d.key} className="border-l border-gray-100 p-3">{d.label}</div>)}
              </div>
              {/* Body */}
              <div className="grid grid-cols-[56px_repeat(5,1fr)]">
                {/* Hours column */}
                <div>
                  {HOURS.map((h) => <div key={h} className="h-16 border-b border-gray-50 px-2 py-1 text-[10px] text-gray-400">{h}</div>)}
                </div>
                {/* Day columns */}
                {DAYS.map((d) => {
                  const daySlots = period.slots.filter((s) => s.day === d.key);
                  const dayAvails = period.availabilities.filter((a) => a.day === d.key && a.isAvailable);
                  return (
                    <div key={d.key} className="relative border-l border-gray-100">
                      {/* Hour lines */}
                      {HOURS.map((h) => <div key={h} className="h-16 border-b border-gray-50" />)}
                      {/* Availability heatmap */}
                      {dayAvails.map((a, i) => {
                        const top = (toFloat(a.startTime) - HOUR0) * ROW;
                        const height = (toFloat(a.endTime) - toFloat(a.startTime)) * ROW;
                        return (
                          <div key={i} className="absolute left-0 right-0 bg-green-100/60 border-l-2 border-green-400/40 pointer-events-none"
                            style={{ top, height }} />
                        );
                      })}
                      {/* Slots */}
                      {daySlots.map((s, i) => {
                        const top = (toFloat(s.startTime) - HOUR0) * ROW + 2;
                        const height = Math.max(28, (toFloat(s.endTime) - toFloat(s.startTime)) * ROW - 4);
                        const color = slotColor(i);
                        return (
                          <div key={s.id} className={`absolute left-1 right-1 rounded-lg p-1.5 text-white shadow-sm ${color}`}
                            style={{ top, height }}>
                            <p className="text-[10px] font-bold truncate leading-tight">{s.subjectName}</p>
                            <p className="text-[9px] opacity-80 truncate">{s.teacher?.firstName} {s.teacher?.lastName}</p>
                            {s.room && <p className="text-[9px] opacity-80 truncate">{s.room.name}</p>}
                            {isChef && ["PREPARING","BUILDING"].includes(period.status) && (
                              <button onClick={() => removeSlot(s.id)}
                                className="absolute top-1 right-1 rounded p-0.5 hover:bg-black/20 transition-colors">
                                <X size={9} />
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
            {/* Legend */}
            <div className="border-t border-gray-50 px-4 py-2.5 flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-green-200 border border-green-400" /> Disponibilité prof</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-500" /> Cours placé</span>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB : AVAILABILITY ────────────────────────────────── */}
      {activeTab === "availability" && (
        <div className="space-y-3">
          {availByTeacher.size === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-12 text-gray-400">
              <Users size={36} className="mb-2 opacity-30" />
              <p className="text-sm">Aucun professeur n'a encore soumis ses disponibilités.</p>
            </div>
          ) : (
            [...availByTeacher.entries()].map(([tid, avails]) => {
              const teacher = avails[0].teacher;
              const byDay = new Map<string, Avail[]>();
              avails.forEach((a) => { if (!byDay.has(a.day)) byDay.set(a.day, []); byDay.get(a.day)!.push(a); });
              return (
                <div key={tid} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F1E3C] text-xs font-bold text-[#FFD166]">
                      {teacher.firstName[0]}{teacher.lastName[0]}
                    </div>
                    <p className="font-semibold text-gray-900">{teacher.firstName} {teacher.lastName}</p>
                    <span className="ml-auto text-xs text-gray-400">{avails.length} créneaux</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {DAYS.map((d) => {
                      const da = byDay.get(d.key) ?? [];
                      return (
                        <div key={d.key} className="text-center">
                          <p className="text-[10px] font-semibold text-gray-400 mb-1">{d.label.slice(0, 3)}</p>
                          {da.length === 0
                            ? <p className="text-[10px] text-gray-200">—</p>
                            : da.map((a) => (
                              <div key={a.startTime} className={`mb-0.5 rounded-md px-1 py-0.5 text-[10px] font-medium ${a.isAvailable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500 line-through"}`}>
                                {a.startTime}–{a.endTime}
                              </div>
                            ))
                          }
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB : SLOTS LIST ─────────────────────────────────── */}
      {activeTab === "slots" && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {period.slots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <BookOpen size={36} className="mb-2 opacity-30" />
              <p className="text-sm">Aucun créneau placé.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-xs text-gray-400">
                  {["Matière","Professeur","Jour & Heure","Salle","Type",""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {period.slots.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.subjectName}</td>
                    <td className="px-4 py-3 text-gray-600">{s.teacher?.firstName} {s.teacher?.lastName}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {DAYS.find((d) => d.key === s.day)?.label} {s.startTime}–{s.endTime}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{s.room?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{s.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      {isChef && ["PREPARING","BUILDING"].includes(period.status) && (
                        <button onClick={() => removeSlot(s.id)} className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Validation info */}
      {period.validation && (
        <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
          <CheckCircle2 size={18} className="text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Validé le {new Date(period.validation.validatedAt).toLocaleDateString("fr-FR")}</p>
            {period.validation.notes && <p className="text-xs text-green-600">{period.validation.notes}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
