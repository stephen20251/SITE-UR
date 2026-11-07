import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Loader2, DoorOpen, Users, X, Search } from "lucide-react";
import { toast } from "sonner";
import { useRooms, useCreateRoom, ROOM_TYPE_META, type RoomType } from "@/lib/config";
import { useAcademicYears } from "@/lib/academic";

export const Route = createFileRoute("/classroom/config/salles")({ component: SallesPage });

const ROOM_TYPES: RoomType[] = ["CLASSROOM", "AMPHITHEATER", "LAB", "SEMINAR"];
const inp = "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition";

function SallesPage() {
  const { data: years } = useAcademicYears();
  const campusId = years?.[0]?.campusId ?? "";

  const { data: rooms, isLoading } = useRooms();
  const create = useCreateRoom();

  const [filter, setFilter] = useState<RoomType | "all">("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", code: "", type: "CLASSROOM" as RoomType,
    capacity: "30", building: "", floor: "",
  });

  const filtered = (rooms ?? []).filter((r) => {
    const matchType = filter === "all" || r.type === filter;
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const byType = ROOM_TYPES.reduce((acc, t) => {
    acc[t] = (rooms ?? []).filter((r) => r.type === t).length;
    return acc;
  }, {} as Record<RoomType, number>);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!campusId) return toast.error("Campus non disponible");
    try {
      await create.mutateAsync({
        name: form.name, code: form.code, campusId,
        type: form.type, capacity: parseInt(form.capacity) || 30,
        building: form.building || undefined, floor: form.floor || undefined,
      });
      toast.success(`Salle "${form.name}" créée`);
      setOpen(false);
      setForm({ name: "", code: "", type: "CLASSROOM", capacity: "30", building: "", floor: "" });
    } catch {
      toast.error("Erreur lors de la création");
    }
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ROOM_TYPES.map((t, i) => {
          const meta = ROOM_TYPE_META[t];
          return (
            <button
              key={t}
              onClick={() => setFilter(filter === t ? "all" : t)}
              className={`animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center rounded-2xl border p-4 text-center transition-all hover:-translate-y-0.5 ${filter === t ? "ring-2 ring-classroom grad-classroom text-white" : "bg-card shadow-elegant"}`}
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
            >
              <span className="text-2xl">{meta.icon}</span>
              <span className="mt-1 text-lg font-bold">{byType[t]}</span>
              <span className={`text-[10px] font-semibold ${filter === t ? "text-white/80" : "text-muted-foreground"}`}>{meta.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search + Add bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition"
            placeholder="Rechercher une salle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl grad-classroom px-4 py-2 text-sm font-semibold text-white shadow-elegant"
        >
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Rooms list */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed py-16 text-center">
          <DoorOpen className="mb-3 h-9 w-9 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Aucune salle</p>
          <button onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-2 rounded-xl grad-classroom px-3 py-1.5 text-xs font-semibold text-white">
            <Plus size={13} /> Créer une salle
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((room, i) => {
            const meta = ROOM_TYPE_META[room.type];
            return (
              <div
                key={room.id}
                className="animate-in fade-in slide-in-from-bottom-2 duration-400 rounded-2xl border bg-card p-4 shadow-elegant"
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{room.name}</p>
                      <div className={`h-2 w-2 shrink-0 rounded-full ${room.isActive ? "bg-emerald-500" : "bg-gray-300"}`} />
                    </div>
                    <p className="text-xs text-muted-foreground">{room.code}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users size={11} /> {room.capacity} places
                  </span>
                  {room.building && <span className="text-xs text-muted-foreground">{room.building}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="animate-in zoom-in-95 duration-200 w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-bold">Nouvelle salle / Labo</h2>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROOM_TYPES.map((t) => {
                    const m = ROOM_TYPE_META[t];
                    return (
                      <label key={t} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 transition-all ${form.type === t ? "border-classroom bg-classroom/5" : "hover:bg-accent"}`}>
                        <input type="radio" className="sr-only" value={t} checked={form.type === t}
                          onChange={() => setForm((f) => ({ ...f, type: t }))} />
                        <span>{m.icon}</span>
                        <span className="text-xs font-medium">{m.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Nom *</label>
                  <input className={inp} placeholder="ex: Salle A201" value={form.name} required
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Code *</label>
                  <input className={inp} placeholder="ex: S-A201" value={form.code} required
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Capacité *</label>
                  <input type="number" min={1} className={inp} value={form.capacity} required
                    onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Bâtiment</label>
                  <input className={inp} placeholder="Bât. A" value={form.building}
                    onChange={(e) => setForm((f) => ({ ...f, building: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Étage</label>
                  <input className={inp} placeholder="RDC" value={form.floor}
                    onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-accent">Annuler</button>
                <button type="submit" disabled={create.isPending || !campusId}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {create.isPending && <Loader2 size={14} className="animate-spin" />}
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
