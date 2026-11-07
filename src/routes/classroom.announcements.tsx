import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pin, Plus, Loader2, X, Megaphone, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useRequireClassroom } from "@/components/classroom/shared";
import { useAnnouncements, useCreateAnnouncement, type Announcement } from "@/lib/classroom";
import { api, ApiError } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/classroom/announcements")({ component: Announcements });

const CAN_POST_ROLES = ["SUPER_ADMIN", "STAFF", "TEACHER"];

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Étudiants", PARENT: "Parents", TEACHER: "Enseignants", STAFF: "Personnel", SUPER_ADMIN: "Administration",
};
const AUTHOR_ROLE: Record<string, string> = {
  SUPER_ADMIN: "Administration", STAFF: "Personnel", TEACHER: "Enseignant",
};

type Audiences = {
  canTargetAll: boolean;
  roles: string[];
  mentions: { id: string; name: string }[];
  promotions: { id: string; name: string; level: string; mentionId: string }[];
};

const PRIORITY_BADGE: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  HIGH:   "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  NORMAL: "bg-muted text-muted-foreground",
  LOW:    "bg-muted text-muted-foreground",
};

type AnnouncementFull = Announcement & {
  mention?: { name: string } | null; promotion?: { name: string } | null;
};

function audienceLabel(p: AnnouncementFull) {
  if (p.targetAll) return "Toute l'université";
  const parts = [
    p.targetRoles?.length ? p.targetRoles.map((r) => ROLE_LABELS[r] ?? r).join(", ") : null,
    p.promotion?.name ?? p.mention?.name ?? null,
  ].filter(Boolean);
  return parts.join(" · ") || "Public restreint";
}

function AnnouncementCard({ p, canDelete }: { p: AnnouncementFull; canDelete: boolean }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => api(`/announcements/${p.id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["announcements"] }); toast.success("Annonce supprimée"); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Suppression impossible"),
  });
  return (
    <article className="rounded-2xl border bg-card p-6 shadow-elegant transition hover:shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full grad-classroom text-sm font-bold text-white">
          {p.author.firstName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{p.author.firstName} {p.author.lastName}</p>
          <p className="text-xs text-muted-foreground">
            {AUTHOR_ROLE[p.author.systemRole] ?? p.author.systemRole} · {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true, locale: fr })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {p.isPinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
              <Pin className="h-3 w-3" /> Épinglé
            </span>
          )}
          {p.priority !== "NORMAL" && (
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${PRIORITY_BADGE[p.priority]}`}>{p.priority}</span>
          )}
          {canDelete && (
            <button onClick={() => confirm("Supprimer cette annonce ?") && del.mutate()} disabled={del.isPending}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          )}
        </div>
      </div>
      <h2 className="mt-4 text-xl font-bold tracking-tight">{p.title}</h2>
      <p className="mt-2 whitespace-pre-wrap leading-relaxed text-muted-foreground">{p.content}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {audienceLabel(p)}</span>
        {p._count && <span>{p._count.reads} lecture{p._count.reads !== 1 ? "s" : ""}</span>}
      </div>
    </article>
  );
}

function Announcements() {
  const { user, ready } = useRequireClassroom();
  const enabled = ready && !!user;
  const list = useAnnouncements({ enabled });
  const [creating, setCreating] = useState(false);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  const canPost = CAN_POST_ROLES.includes(user.systemRole);
  const posts = (list.data?.items ?? []) as AnnouncementFull[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Annonces</h1>
          <p className="text-muted-foreground">{canPost ? "Vos annonces et celles qui vous concernent." : "Les annonces qui vous concernent."}</p>
        </div>
        {canPost && !creating && (
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-xl grad-classroom px-4 py-2 text-sm font-semibold text-white shadow-elegant">
            <Plus className="h-4 w-4" /> Publier
          </button>
        )}
      </div>

      {creating && <CreateForm onClose={() => setCreating(false)} />}

      {list.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <Megaphone className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Aucune annonce pour le moment.</p>
        </div>
      ) : (
        posts.map((p) => <AnnouncementCard key={p.id} p={p} canDelete={p.authorId === user.id || user.systemRole === "SUPER_ADMIN"} />)
      )}
    </div>
  );
}

function CreateForm({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateAnnouncement();
  const aud = useQuery({ queryKey: ["announcements", "audiences"], queryFn: () => api<Audiences>("/announcements/audiences") });
  const [form, setForm] = useState({ title: "", content: "", targetAll: false, targetRoles: ["STUDENT"] as string[], mentionId: "", promotionId: "" });
  const inp = "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition";

  const a = aud.data;
  const isTeacher = !!a && !a.canTargetAll && a.mentions.length === 0;
  const promos = (a?.promotions ?? []).filter((p) => !form.mentionId || p.mentionId === form.mentionId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isTeacher && !form.promotionId) { toast.error("Choisissez la classe concernée"); return; }
    try {
      await createMutation.mutateAsync({
        title: form.title, content: form.content,
        targetAll: form.targetAll,
        targetRoles: form.targetAll ? [] : form.targetRoles,
        mentionId: form.targetAll ? null : form.mentionId || null,
        promotionId: form.targetAll ? null : form.promotionId || null,
      });
      toast.success("Annonce publiée");
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur lors de la publication");
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-elegant">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Nouvelle annonce</h2>
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><X className="h-4 w-4" /></button>
      </div>
      {!a ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
        <form onSubmit={submit} className="space-y-3">
          <input className={inp} placeholder="Titre de l'annonce" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          <textarea className="h-28 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-classroom/30"
            placeholder="Rédigez votre annonce…" value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} required />

          <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destinataires</p>
            {a.canTargetAll && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.targetAll} onChange={(e) => setForm((f) => ({ ...f, targetAll: e.target.checked }))} />
                Toute l'université
              </label>
            )}
            {!form.targetAll && (
              <>
                <div className="flex flex-wrap gap-2">
                  {a.roles.map((r) => {
                    const on = form.targetRoles.includes(r);
                    return (
                      <button key={r} type="button"
                        onClick={() => setForm((f) => ({ ...f, targetRoles: on ? f.targetRoles.filter((x) => x !== r) : [...f.targetRoles, r] }))}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${on ? "border-classroom bg-classroom text-white" : "hover:bg-accent"}`}>
                        {ROLE_LABELS[r] ?? r}
                      </button>
                    );
                  })}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {a.mentions.length > 0 && (
                    <select className={inp} value={form.mentionId} onChange={(e) => setForm((f) => ({ ...f, mentionId: e.target.value, promotionId: "" }))}>
                      <option value="">{a.canTargetAll ? "Toutes les mentions" : "Toute ma mention"}</option>
                      {a.mentions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  )}
                  <select className={inp} value={form.promotionId} onChange={(e) => setForm((f) => ({ ...f, promotionId: e.target.value }))}>
                    <option value="">{isTeacher ? "— Choisir ma classe —" : "Toutes les promotions"}</option>
                    {promos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {isTeacher && promos.length === 0 && (
                  <p className="text-xs text-amber-600">Aucune classe ne vous est encore attribuée : vous pourrez publier dès que vous aurez des créneaux ou des cours.</p>
                )}
                <p className="text-[11px] text-muted-foreground">Seules les personnes correspondant à tous les critères verront l'annonce et recevront une notification.</p>
              </>
            )}
          </div>
          <button type="submit" disabled={createMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Publier l'annonce
          </button>
        </form>
      )}
    </div>
  );
}
