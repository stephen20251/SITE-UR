import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { CheckCircle2, Clock, Send, AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/erp/planning/disponibilites")({
  component: DisponibilitesPage,
});

type Period = { id: string; name: string; status: string; availabilityDeadline: string | null; mention: { name: string } };
type SlotEntry = { day: string; startTime: string; endTime: string; isAvailable: boolean };

const DAYS = [
  { key: "MONDAY", label: "Lundi" }, { key: "TUESDAY", label: "Mardi" },
  { key: "WEDNESDAY", label: "Mercredi" }, { key: "THURSDAY", label: "Jeudi" },
  { key: "FRIDAY", label: "Vendredi" },
];

const TIME_SLOTS = [
  { start: "07:00", end: "09:00", label: "07h–09h" },
  { start: "09:00", end: "11:00", label: "09h–11h" },
  { start: "11:00", end: "13:00", label: "11h–13h" },
  { start: "13:00", end: "15:00", label: "13h–15h" },
  { start: "15:00", end: "17:00", label: "15h–17h" },
  { start: "17:00", end: "19:00", label: "17h–19h" },
];

export default function DisponibilitesPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [slots, setSlots] = useState<Map<string, boolean>>(new Map()); // key = "DAY|startTime"
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Period[]>("/schedule/periods")
      .then((ps) => {
        const open = (ps as Period[]).filter((p) => p.status === "PREPARING");
        setPeriods(open);
        if (open.length) selectPeriod(open[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function selectPeriod(p: Period) {
    setSelectedPeriod(p);
    setSubmitted(false);
    setSlots(new Map());
    try {
      const existing = await api<SlotEntry[]>(`/schedule/periods/${p.id}/my-availability`);
      const map = new Map<string, boolean>();
      (existing as SlotEntry[]).forEach((e) => map.set(`${e.day}|${e.startTime}`, e.isAvailable));
      setSlots(map);
    } catch {}
  }

  function toggleSlot(day: string, start: string, available: boolean) {
    const key = `${day}|${start}`;
    setSlots((prev) => {
      const next = new Map(prev);
      if (next.get(key) === available) {
        next.delete(key); // deselect
      } else {
        next.set(key, available);
      }
      return next;
    });
  }

  function slotState(day: string, start: string): "available" | "unavailable" | "none" {
    const key = `${day}|${start}`;
    if (!slots.has(key)) return "none";
    return slots.get(key) ? "available" : "unavailable";
  }

  async function submit() {
    if (!selectedPeriod) return;
    const entries: SlotEntry[] = [];
    slots.forEach((isAvailable, key) => {
      const [day, startTime] = key.split("|");
      const ts = TIME_SLOTS.find((t) => t.start === startTime);
      if (ts) entries.push({ day, startTime: ts.start, endTime: ts.end, isAvailable });
    });
    if (!entries.length) { setError("Sélectionnez au moins un créneau"); return; }
    setSubmitting(true); setError("");
    try {
      await api(`/schedule/periods/${selectedPeriod.id}/my-availability`, {
        method: "POST",
        body: { slots: entries },
      });
      setSubmitted(true);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0F1E3C] border-t-[#FFD166]" />
    </div>
  );

  if (periods.length === 0) return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-20 text-gray-400">
      <Clock size={40} className="mb-3 opacity-30" />
      <p className="font-medium text-gray-600">Aucune période en cours</p>
      <p className="text-sm mt-1">Le responsable n'a pas encore ouvert de période de planification.</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mes disponibilités</h1>
        <p className="text-sm text-gray-500 mt-0.5">Indiquez vos disponibilités pour l'emploi du temps.</p>
      </div>

      {/* Period selector */}
      {periods.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Période active</p>
          <div className="flex flex-wrap gap-2">
            {periods.map((p) => (
              <button key={p.id} onClick={() => selectPeriod(p)}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${selectedPeriod?.id === p.id ? "border-[#0F1E3C] bg-[#0F1E3C] text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Period info */}
      {selectedPeriod && (
        <div className="rounded-2xl border border-[#FFD166]/60 bg-[#FFD166]/10 p-4">
          <p className="font-semibold text-[#0F1E3C]">{selectedPeriod.name}</p>
          <p className="text-sm text-[#0F1E3C]/70 mt-0.5">{selectedPeriod.mention.name}</p>
          {selectedPeriod.availabilityDeadline && (
            <p className="flex items-center gap-1.5 text-xs text-orange-700 mt-2 font-medium">
              <Clock size={12} /> Date limite : {new Date(selectedPeriod.availabilityDeadline).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      )}

      {submitted ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-green-200 bg-green-50 py-12 text-center">
          <CheckCircle2 size={40} className="text-green-500 mb-3" />
          <p className="font-semibold text-green-800">Disponibilités enregistrées !</p>
          <p className="text-sm text-green-600 mt-1">Le responsable de mention peut maintenant construire l'emploi du temps.</p>
          <button onClick={() => setSubmitted(false)} className="mt-4 text-sm text-green-700 underline">Modifier mes disponibilités</button>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {/* Instructions */}
          <div className="border-b border-gray-50 px-5 py-4">
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-md bg-green-500 flex items-center justify-center text-white text-[10px]">✓</span>
                Disponible
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-md bg-red-400 flex items-center justify-center text-white text-[10px]">✕</span>
                Indisponible
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-md border-2 border-gray-200 bg-white" />
                Non renseigné
              </span>
            </div>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="text-xs font-semibold text-gray-400 bg-gray-50">
                  <th className="py-3 pl-5 text-left w-24">Heure</th>
                  {DAYS.map((d) => <th key={d.key} className="py-3 px-2 text-center">{d.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {TIME_SLOTS.map((ts) => (
                  <tr key={ts.start} className="hover:bg-gray-50/40 transition-colors">
                    <td className="py-3 pl-5 text-xs font-medium text-gray-500">{ts.label}</td>
                    {DAYS.map((d) => {
                      const state = slotState(d.key, ts.start);
                      return (
                        <td key={d.key} className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Available button */}
                            <button onClick={() => toggleSlot(d.key, ts.start, true)}
                              className={`flex h-8 w-8 items-center justify-center rounded-lg border-2 text-xs font-bold transition-all ${state === "available" ? "border-green-500 bg-green-500 text-white" : "border-gray-200 text-gray-300 hover:border-green-300 hover:text-green-400"}`}>
                              ✓
                            </button>
                            {/* Unavailable button */}
                            <button onClick={() => toggleSlot(d.key, ts.start, false)}
                              className={`flex h-8 w-8 items-center justify-center rounded-lg border-2 text-xs font-bold transition-all ${state === "unavailable" ? "border-red-400 bg-red-400 text-white" : "border-gray-200 text-gray-300 hover:border-red-300 hover:text-red-400"}`}>
                              ✕
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Note */}
          <div className="border-t border-gray-50 p-5 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Note (optionnel)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                placeholder="Ex : Je préfère les matins, éviter le mercredi après-midi…"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#0F1E3C] resize-none" />
            </div>
            {error && <p className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle size={14} /> {error}</p>}
            <button onClick={submit} disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F1E3C] py-3 text-sm font-bold text-white hover:bg-[#1B3A6B] transition-colors disabled:opacity-60">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Enregistrer mes disponibilités
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
