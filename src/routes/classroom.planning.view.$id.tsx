import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireClassroom } from "@/components/classroom/shared";
import { ArrowLeft, MapPin, User, BookOpen, Loader2 } from "lucide-react";

export const Route = createFileRoute("/classroom/planning/view/$id")({
  component: PlanningView,
});

type Slot = {
  id: string; subjectName: string; day: string; startTime: string; endTime: string; type: string;
  teacher: { firstName: string; lastName: string };
  room: { name: string; code: string } | null;
  promotion: { name: string; level: string };
  group: { name: string } | null;
};
type Period = { id: string; name: string; weekStart?: string | null; mention: { name: string }; semester: { name: string }; slots: Slot[] };

const DAYS = [
  { key: "MONDAY", label: "Lundi" }, { key: "TUESDAY", label: "Mardi" },
  { key: "WEDNESDAY", label: "Mercredi" }, { key: "THURSDAY", label: "Jeudi" },
  { key: "FRIDAY", label: "Vendredi" },
];
const HOURS = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
const HOUR0 = 7; const ROW = 72;
const toFloat = (t: string) => { const [h, m] = t.split(":").map(Number); return h + m / 60; };

const COLORS = [
  "bg-blue-500","bg-purple-500","bg-green-600","bg-orange-500","bg-pink-500",
  "bg-teal-500","bg-indigo-600","bg-red-500","bg-amber-500","bg-cyan-600",
];

function PlanningView() {
  const { id } = Route.useParams();
  const { ready, user } = useRequireClassroom();

  const [period, setPeriod] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ promotionId: "", teacherId: "" });

  useEffect(() => {
    if (!ready) return;
    api<Period>(`/schedule/periods/${id}/view`)
      .then(setPeriod).catch(console.error).finally(() => setLoading(false));
  }, [id, ready]);

  if (!ready || !user || loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!period) return <div className="text-center py-20 text-gray-400">Emploi du temps non trouvé.</div>;

  const promotions = [...new Map(period.slots.map((s) => [s.promotion.name, s.promotion])).values()];
  const teachers   = [...new Map(period.slots.map((s) => [s.teacher.firstName + s.teacher.lastName, s.teacher])).values()];

  const filtered = period.slots.filter((s) => {
    if (filter.promotionId && s.promotion.name !== filter.promotionId) return false;
    if (filter.teacherId && `${s.teacher.firstName} ${s.teacher.lastName}` !== filter.teacherId) return false;
    return true;
  });

  const subjectColors = new Map<string, string>();
  let ci = 0;
  filtered.forEach((s) => { if (!subjectColors.has(s.subjectName)) subjectColors.set(s.subjectName, COLORS[ci++ % COLORS.length]); });

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Link to="/classroom/planning" className="mt-1 text-gray-400 hover:text-classroom transition-colors"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{period.name}</h1>
          <p className="text-sm text-muted-foreground">{period.mention.name} · {period.semester.name}</p>
          <p className="mt-1 text-sm font-medium text-classroom">
            {period.weekStart
              ? `Semaine du ${new Date(period.weekStart).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} au ${new Date(new Date(period.weekStart).getTime() + 5 * 86_400_000).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`
              : "Semaine non précisée"}
            {filter.promotionId ? ` — Classe ${filter.promotionId}` : promotions.length ? ` — Classes : ${promotions.map((p) => p.name).join(", ")}` : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filter.promotionId} onChange={(e) => setFilter({ ...filter, promotionId: e.target.value })}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 outline-none focus:border-classroom">
          <option value="">Toutes les promotions</option>
          {promotions.map((p) => <option key={p.name} value={p.name}>{p.name} ({p.level})</option>)}
        </select>
        <select value={filter.teacherId} onChange={(e) => setFilter({ ...filter, teacherId: e.target.value })}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 outline-none focus:border-classroom">
          <option value="">Tous les professeurs</option>
          {teachers.map((t) => <option key={`${t.firstName}${t.lastName}`} value={`${t.firstName} ${t.lastName}`}>{t.firstName} {t.lastName}</option>)}
        </select>
      </div>

      {/* Week grid */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-elegant">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-[56px_repeat(5,1fr)] border-b border-gray-100 grad-classroom">
            <div className="p-3" />
            {DAYS.map((d) => (
              <div key={d.key} className="border-l border-white/10 p-3 text-center text-sm font-bold text-white">{d.label}</div>
            ))}
          </div>
          <div className="grid grid-cols-[56px_repeat(5,1fr)]">
            <div>
              {HOURS.map((h) => <div key={h} className="flex h-[72px] items-start border-b border-gray-50 px-2 pt-1 text-[10px] text-gray-400">{h}</div>)}
            </div>
            {DAYS.map((d) => {
              const daySlots = filtered.filter((s) => s.day === d.key);
              return (
                <div key={d.key} className="relative border-l border-gray-100">
                  {HOURS.map((h) => <div key={h} className="h-[72px] border-b border-gray-50" />)}
                  {daySlots.map((s) => {
                    const top    = (toFloat(s.startTime) - HOUR0) * ROW + 2;
                    const height = Math.max(32, (toFloat(s.endTime) - toFloat(s.startTime)) * ROW - 4);
                    const color  = subjectColors.get(s.subjectName) ?? "bg-gray-500";
                    return (
                      <div key={s.id} className={`absolute left-1 right-1 rounded-xl p-2 text-white shadow-md ${color} overflow-hidden`} style={{ top, height }}>
                        <p className="text-[11px] font-bold truncate">{s.subjectName}</p>
                        {height > 40 && <>
                          <p className="text-[9px] opacity-90 truncate flex items-center gap-0.5 mt-0.5">
                            <User className="inline shrink-0" size={8} /> {s.teacher.firstName} {s.teacher.lastName}
                          </p>
                          {s.room && <p className="text-[9px] opacity-90 truncate flex items-center gap-0.5">
                            <MapPin className="inline shrink-0" size={8} /> {s.room.name}
                          </p>}
                          {s.group && <p className="text-[9px] opacity-80 truncate">{s.group.name}</p>}
                        </>}
                        <span className="absolute bottom-1.5 right-2 text-[8px] opacity-70 uppercase tracking-wide">{s.type}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      {subjectColors.size > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-card p-4 shadow-elegant">
          <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Légende</p>
          <div className="flex flex-wrap gap-2">
            {[...subjectColors.entries()].map(([name, color]) => (
              <span key={name} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white ${color}`}>
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-12 text-gray-400">
          <BookOpen size={32} className="mb-2 opacity-30" />
          <p className="text-sm">Aucun cours pour ce filtre.</p>
        </div>
      )}
    </div>
  );
}
