import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ExternalLink, Eye, EyeOff, ImagePlus, Newspaper, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { NEWS_CATEGORIES, categoryLabel, fmtNewsDate, newsImage, type NewsAdminArticle, type NewsCategory } from "@/lib/news";
import { useRequireClassroom } from "@/components/classroom/shared";
import { Card, Empty, Loading, PageHeader, btnGhost, btnPrimary, inputCls } from "@/components/classroom/cursus-ui";

export const Route = createFileRoute("/classroom/actualites")({ component: NewsAdminPage });

// Tout le contenu de la page publique « Actualités » est géré ici, par le Super administrateur.

type Form = {
  title: string; category: NewsCategory; excerpt: string; body: string; authors: string;
  location: string; eventAt: string; linkUrl: string; publishedAt: string;
  isPublished: boolean; isFeatured: boolean; isArchived: boolean;
};
const EMPTY: Form = {
  title: "", category: "ACTUALITE", excerpt: "", body: "", authors: "", location: "", eventAt: "", linkUrl: "",
  publishedAt: "", isPublished: true, isFeatured: false, isArchived: false,
};

// <input type="datetime-local"> attend l'heure locale « AAAA-MM-JJTHH:MM »
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);

// Passage automatique aux archives après 12 mois (même règle que le serveur).
const isOld = (a: NewsAdminArticle) => {
  if (!a.publishedAt) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);
  return new Date(a.publishedAt) < cutoff;
};

type StatusFilter = "ALL" | "PUBLISHED" | "DRAFT" | "ARCHIVED";

function NewsAdminPage() {
  const { user, ready } = useRequireClassroom(["SUPER_ADMIN"]);
  const qc = useQueryClient();
  const articles = useQuery({
    queryKey: ["news", "manage"],
    queryFn: () => api<NewsAdminArticle[]>("/news"),
    enabled: ready && user?.systemRole === "SUPER_ADMIN",
  });
  const [editing, setEditing] = useState<NewsAdminArticle | "new" | null>(null);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [category, setCategory] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["news"] });
  const onError = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Erreur");

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Pick<NewsAdminArticle, "isPublished" | "isArchived" | "isFeatured">> }) =>
      api(`/news/${id}`, { method: "PATCH", body }),
    onSuccess: () => { refresh(); toast.success("Actualité mise à jour"); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/news/${id}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); toast.success("Actualité supprimée"); },
    onError,
  });

  if (!ready || !user) return <Loading />;
  if (articles.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Actualités" />
        <Card><Empty>{articles.error instanceof ApiError && articles.error.status === 403 ? "Cette page est réservée au Super administrateur." : "Impossible de charger les actualités."}</Empty></Card>
      </div>
    );
  }

  const all = articles.data ?? [];
  const archived = (a: NewsAdminArticle) => a.isArchived || isOld(a);
  const list = all.filter((a) => (!category || a.category === category) && (
    status === "ALL" || (status === "DRAFT" && !a.isPublished) || (status === "ARCHIVED" && a.isPublished && archived(a))
    || (status === "PUBLISHED" && a.isPublished && !archived(a))
  ));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Actualités"
        subtitle="Contenu de la page publique « Actualités ». Les événements restent gérés dans « Événements » et s'y affichent aussi."
        actions={(
          <div className="flex flex-wrap gap-2">
            <a className={btnGhost} href="/actualites" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Voir la page</a>
            <button className={btnPrimary} onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Nouvelle actualité</button>
          </div>
        )}
      />
      <div className="flex flex-wrap items-center gap-2">
        {([["ALL", "Toutes"], ["PUBLISHED", "En ligne"], ["DRAFT", "Brouillons"], ["ARCHIVED", "Archives"]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setStatus(v)} aria-pressed={status === v}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${status === v ? "border-classroom bg-classroom text-white" : "hover:bg-accent"}`}>
            {label}
          </button>
        ))}
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filtrer par rubrique" className={`${inputCls} ml-auto`}>
          <option value="">Toutes les rubriques</option>
          {NEWS_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {articles.isLoading ? <Loading /> : list.length === 0 ? (
        <Card><Empty>{all.length === 0 ? "Aucune actualité. Cliquez sur « Nouvelle actualité » pour publier la première." : "Aucune actualité ne correspond à ces filtres."}</Empty></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => {
            const img = newsImage(a.imageUrl);
            return (
              <div key={a.id} className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-elegant">
                <div className="relative aspect-[16/9] bg-muted">
                  {img
                    ? <img src={img} alt="" className="h-full w-full object-cover" />
                    : <div className="grid h-full place-items-center text-muted-foreground"><Newspaper className="h-10 w-10 opacity-40" /></div>}
                  <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    {!a.isPublished && <span className="rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white">Brouillon</span>}
                    {a.isPublished && archived(a) && <span className="rounded-full bg-slate-700/90 px-2.5 py-1 text-xs font-medium text-white">Archivée</span>}
                    {a.isFeatured && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-medium text-white"><Star className="h-3 w-3" /> À la une</span>}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="text-xs font-medium text-classroom">{categoryLabel(a.category)}</p>
                  <h3 className="font-semibold leading-snug">{a.title}</h3>
                  <p className="text-xs text-muted-foreground">{a.publishedAt ? `Publiée le ${fmtNewsDate(a.publishedAt)}` : "Jamais publiée"}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <button className={btnGhost} onClick={() => setEditing(a)}><Pencil className="h-3.5 w-3.5" /> Modifier</button>
                    <button className={btnGhost} onClick={() => patch.mutate({ id: a.id, body: { isPublished: !a.isPublished } })}>
                      {a.isPublished ? <><EyeOff className="h-3.5 w-3.5" /> Masquer</> : <><Eye className="h-3.5 w-3.5" /> Publier</>}
                    </button>
                    {!a.isFeatured && a.isPublished && !archived(a) && (
                      <button className={btnGhost} onClick={() => patch.mutate({ id: a.id, body: { isFeatured: true } })}><Star className="h-3.5 w-3.5" /> À la une</button>
                    )}
                    {!isOld(a) && (
                      <button className={btnGhost} onClick={() => patch.mutate({ id: a.id, body: { isArchived: !a.isArchived } })}>
                        {a.isArchived ? <><ArchiveRestore className="h-3.5 w-3.5" /> Sortir des archives</> : <><Archive className="h-3.5 w-3.5" /> Archiver</>}
                      </button>
                    )}
                    <button className={`${btnGhost} text-red-600 hover:bg-red-50`} onClick={() => { if (confirm(`Supprimer définitivement « ${a.title} » ?`)) remove.mutate(a.id); }}>
                      <Trash2 className="h-3.5 w-3.5" /> Supprimer
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && <NewsDialog article={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}

function NewsDialog({ article, onClose, onSaved }: { article: NewsAdminArticle | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Form>(article ? {
    title: article.title, category: article.category, excerpt: article.excerpt ?? "", body: article.body,
    authors: article.authors ?? "", location: article.location ?? "", eventAt: toLocalInput(article.eventAt),
    linkUrl: article.linkUrl ?? "", publishedAt: toLocalInput(article.publishedAt),
    isPublished: article.isPublished, isFeatured: article.isFeatured, isArchived: article.isArchived,
  } : EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(newsImage(article?.imageUrl ?? null));
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const check = (k: "isPublished" | "isFeatured" | "isArchived") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.checked }));
  const isEvent = form.category === "CONFERENCE" || form.category === "SOUTENANCE";

  async function save() {
    if (!form.title.trim()) return toast.error("Le titre est obligatoire");
    if (!form.body.trim()) return toast.error("Le contenu est obligatoire");
    setSaving(true);
    try {
      const body = { ...form, eventAt: toIso(form.eventAt), publishedAt: toIso(form.publishedAt) };
      const saved = article
        ? await api<NewsAdminArticle>(`/news/${article.id}`, { method: "PATCH", body })
        : await api<NewsAdminArticle>("/news", { method: "POST", body });
      if (file) {
        const fd = new FormData();
        fd.append("image", file);
        await api(`/news/${saved.id}/image`, { method: "POST", body: fd, raw: true });
      } else if (removeImage && article?.imageUrl) {
        await api(`/news/${saved.id}/image`, { method: "DELETE" });
      }
      toast.success(article ? "Actualité modifiée" : "Actualité créée");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Enregistrement impossible");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center">
          <h2 className="text-lg font-semibold">{article ? "Modifier l'actualité" : "Nouvelle actualité"}</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 hover:bg-accent" aria-label="Fermer"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-medium">Titre *
            <input className={`${inputCls} mt-1 w-full`} value={form.title} onChange={set("title")} />
          </label>
          <label className="block text-sm font-medium">Rubrique
            <select className={`${inputCls} mt-1 w-full`} value={form.category} onChange={set("category")}>
              {NEWS_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Résumé <span className="font-normal text-muted-foreground">(affiché sur les cartes)</span>
            <textarea className="mt-1 min-h-16 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" maxLength={400} value={form.excerpt} onChange={set("excerpt")} />
          </label>
          <label className="block text-sm font-medium">Contenu *
            <textarea className="mt-1 min-h-40 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" value={form.body} onChange={set("body")} />
          </label>
          {form.category === "RESULTAT" && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              Cette page est publique : n'y publiez que des résultats dont la diffusion est autorisée, jamais les notes individuelles.
            </p>
          )}
          {(isEvent || form.category === "PUBLICATION") && (
            <label className="block text-sm font-medium">{form.category === "PUBLICATION" ? "Auteurs" : "Intervenants / candidat"}
              <input className={`${inputCls} mt-1 w-full`} value={form.authors} onChange={set("authors")} />
            </label>
          )}
          {isEvent && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">Date et heure
                <input type="datetime-local" className={`${inputCls} mt-1 w-full`} value={form.eventAt} onChange={set("eventAt")} />
              </label>
              <label className="block text-sm font-medium">Lieu
                <input className={`${inputCls} mt-1 w-full`} value={form.location} onChange={set("location")} />
              </label>
            </div>
          )}
          <label className="block text-sm font-medium">Lien externe <span className="font-normal text-muted-foreground">(article scientifique, document officiel)</span>
            <input className={`${inputCls} mt-1 w-full`} value={form.linkUrl} onChange={set("linkUrl")} placeholder="https://…" />
          </label>
          <div>
            <p className="text-sm font-medium">Image</p>
            <div className="mt-1 flex items-center gap-3">
              <div className="h-20 w-32 overflow-hidden rounded-lg border bg-muted">
                {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Newspaper className="h-6 w-6 text-muted-foreground/50" /></div>}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setRemoveImage(false); } e.target.value = ""; }} />
              <button type="button" className={btnGhost} onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" /> {preview ? "Changer" : "Ajouter"}</button>
              {preview && (
                <button type="button" className={`${btnGhost} text-red-600`} aria-label="Retirer l'image" onClick={() => { setFile(null); setPreview(null); setRemoveImage(true); }}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG ou WebP, 5 Mo maximum. Indispensable pour une actualité à la une.</p>
          </div>
          <label className="block text-sm font-medium">Date de publication <span className="font-normal text-muted-foreground">(vide = maintenant ; une date ancienne classe aux archives, une date future programme la parution)</span>
            <input type="datetime-local" className={`${inputCls} mt-1 w-full`} value={form.publishedAt} onChange={set("publishedAt")} />
          </label>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isPublished} onChange={check("isPublished")} /> Publier sur le site</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isFeatured} onChange={check("isFeatured")} /> Grande actualité à la une (remplace la précédente)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isArchived} onChange={check("isArchived")} /> Placer dans les archives</label>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose} disabled={saving}>Annuler</button>
          <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}
