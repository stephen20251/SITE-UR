import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Eye, EyeOff, ImagePlus, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { eventImage, type UniversityEvent } from "@/lib/events";
import { useRequireClassroom } from "@/components/classroom/shared";
import { Card, Empty, Loading, PageHeader, btnGhost, btnPrimary, inputCls } from "@/components/classroom/cursus-ui";

export const Route = createFileRoute("/classroom/evenements")({ component: EventsPage });

// Événements affichés dans « Actualité » sur la page d'accueil du site.
// Gérés par le Super administrateur et le Secrétariat.

type Form = { title: string; description: string; location: string; startAt: string; endAt: string; isPublished: boolean };
const EMPTY: Form = { title: "", description: "", location: "", startAt: "", endAt: "", isPublished: true };

// <input type="datetime-local"> attend l'heure locale « AAAA-MM-JJTHH:MM »
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

function EventsPage() {
  const { user, ready } = useRequireClassroom(["SUPER_ADMIN", "STAFF"]);
  const qc = useQueryClient();
  const events = useQuery({ queryKey: ["events", "manage"], queryFn: () => api<UniversityEvent[]>("/events"), enabled: ready && !!user });
  const [editing, setEditing] = useState<UniversityEvent | "new" | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["events"] });
  const onError = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Erreur");

  const togglePublish = useMutation({
    mutationFn: (ev: UniversityEvent) => api(`/events/${ev.id}`, { method: "PATCH", body: { isPublished: !ev.isPublished } }),
    onSuccess: () => { refresh(); toast.success("Visibilité mise à jour"); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/events/${id}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); toast.success("Événement supprimé"); },
    onError,
  });

  if (!ready || !user) return <Loading />;
  if (events.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Événements" />
        <Card><Empty>{events.error instanceof ApiError && events.error.status === 403 ? "Cette page est réservée au Super administrateur et au Secrétariat." : "Impossible de charger les événements."}</Empty></Card>
      </div>
    );
  }

  const now = Date.now();
  const list = events.data ?? [];
  const upcoming = list.filter((e) => new Date(e.endAt ?? e.startAt).getTime() >= now).sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  const past = list.filter((e) => new Date(e.endAt ?? e.startAt).getTime() < now);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Événements"
        subtitle="Ils apparaissent dans la section « Actualité » de la page d'accueil du site."
        actions={<button className={btnPrimary} onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Nouvel événement</button>}
      />
      {events.isLoading ? <Loading /> : list.length === 0 ? (
        <Card><Empty>Aucun événement. Cliquez sur « Nouvel événement » pour publier le premier.</Empty></Card>
      ) : (
        <>
          <EventGroup title={`À venir (${upcoming.length})`} items={upcoming} onEdit={setEditing} onToggle={(e) => togglePublish.mutate(e)}
            onDelete={(e) => { if (confirm(`Supprimer « ${e.title} » ?`)) remove.mutate(e.id); }} />
          <EventGroup title={`Passés (${past.length})`} items={past} onEdit={setEditing} onToggle={(e) => togglePublish.mutate(e)}
            onDelete={(e) => { if (confirm(`Supprimer « ${e.title} » ?`)) remove.mutate(e.id); }} />
        </>
      )}
      {editing && <EventDialog event={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}

function EventGroup({ title, items, onEdit, onToggle, onDelete }: {
  title: string; items: UniversityEvent[];
  onEdit: (e: UniversityEvent) => void; onToggle: (e: UniversityEvent) => void; onDelete: (e: UniversityEvent) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((e) => (
          <div key={e.id} className="overflow-hidden rounded-2xl border bg-card shadow-elegant">
            <div className="relative aspect-[16/9] bg-muted">
              {e.imageUrl
                ? <img src={eventImage(e.imageUrl)!} alt="" className="h-full w-full object-cover" />
                : <div className="grid h-full place-items-center text-muted-foreground"><CalendarDays className="h-10 w-10 opacity-40" /></div>}
              {!e.isPublished && <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white">Brouillon — non visible</span>}
            </div>
            <div className="space-y-2 p-4">
              <h3 className="font-semibold leading-snug">{e.title}</h3>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> {fmt(e.startAt)}</p>
              {e.location && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {e.location}</p>}
              {e.description && <p className="line-clamp-2 text-sm text-muted-foreground">{e.description}</p>}
              <div className="flex flex-wrap gap-2 pt-2">
                <button className={btnGhost} onClick={() => onEdit(e)}><Pencil className="h-3.5 w-3.5" /> Modifier</button>
                <button className={btnGhost} onClick={() => onToggle(e)}>
                  {e.isPublished ? <><EyeOff className="h-3.5 w-3.5" /> Masquer</> : <><Eye className="h-3.5 w-3.5" /> Publier</>}
                </button>
                <button className={`${btnGhost} text-red-600 hover:bg-red-50`} onClick={() => onDelete(e)}><Trash2 className="h-3.5 w-3.5" /> Supprimer</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EventDialog({ event, onClose, onSaved }: { event: UniversityEvent | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Form>(event ? {
    title: event.title, description: event.description ?? "", location: event.location ?? "",
    startAt: toLocalInput(event.startAt), endAt: toLocalInput(event.endAt), isPublished: event.isPublished,
  } : EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(eventImage(event?.imageUrl ?? null));
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.title.trim()) return toast.error("Le titre est obligatoire");
    if (!form.startAt) return toast.error("La date de l'événement est obligatoire");
    setSaving(true);
    try {
      const body = {
        title: form.title, description: form.description, location: form.location, isPublished: form.isPublished,
        startAt: new Date(form.startAt).toISOString(), endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
      };
      const saved = event
        ? await api<UniversityEvent>(`/events/${event.id}`, { method: "PATCH", body })
        : await api<UniversityEvent>("/events", { method: "POST", body });
      if (file) {
        const fd = new FormData();
        fd.append("image", file);
        await api(`/events/${saved.id}/image`, { method: "POST", body: fd, raw: true });
      } else if (removeImage && event?.imageUrl) {
        await api(`/events/${saved.id}/image`, { method: "DELETE" });
      }
      toast.success(event ? "Événement modifié" : "Événement créé");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Enregistrement impossible");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center">
          <h2 className="text-lg font-semibold">{event ? "Modifier l'événement" : "Nouvel événement"}</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 hover:bg-accent" aria-label="Fermer"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-medium">Titre *
            <input className={`${inputCls} mt-1 w-full`} value={form.title} onChange={set("title")} placeholder="Ex. Journée portes ouvertes" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Début *
              <input type="datetime-local" className={`${inputCls} mt-1 w-full`} value={form.startAt} onChange={set("startAt")} />
            </label>
            <label className="block text-sm font-medium">Fin <span className="font-normal text-muted-foreground">(facultatif)</span>
              <input type="datetime-local" className={`${inputCls} mt-1 w-full`} value={form.endAt} onChange={set("endAt")} />
            </label>
          </div>
          <label className="block text-sm font-medium">Lieu
            <input className={`${inputCls} mt-1 w-full`} value={form.location} onChange={set("location")} placeholder="Ex. Amphithéâtre A, campus d'Antananarivo" />
          </label>
          <label className="block text-sm font-medium">Description
            <textarea className="mt-1 min-h-28 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={form.description} onChange={set("description")} placeholder="Programme, public concerné, inscription…" />
          </label>
          <div>
            <p className="text-sm font-medium">Image</p>
            <div className="mt-1 flex items-center gap-3">
              <div className="h-20 w-32 overflow-hidden rounded-lg border bg-muted">
                {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><CalendarDays className="h-6 w-6 text-muted-foreground/50" /></div>}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setRemoveImage(false); } e.target.value = ""; }} />
              <button type="button" className={btnGhost} onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" /> {preview ? "Changer" : "Ajouter"}</button>
              {preview && (
                <button type="button" className={`${btnGhost} text-red-600`} onClick={() => { setFile(null); setPreview(null); setRemoveImage(true); }}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG ou WebP, 5 Mo maximum. Sans image, un visuel par défaut est affiché.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
            Visible sur la page d'accueil
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose} disabled={saving}>Annuler</button>
          <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}
