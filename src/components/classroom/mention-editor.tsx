// Modification d'une mention par l'administration, dont sa présentation publique :
// c'est ce contenu qui s'affiche dans la fenêtre de détail de la page d'accueil.
import { useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useUpdateMention, type Mention, type MentionInput } from "@/lib/academic";
import { mediaUrl } from "@/components/online/mooc-card";

const inp = "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition";
const area = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-classroom/30 transition";
const LEVELS = ["Licence", "Master", "Doctorat"];

type Form = Required<{ [K in keyof MentionInput]: string }>;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border p-5">
      <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}

export function MentionEditor({ mention, onClose }: { mention: Mention; onClose: () => void }) {
  const update = useUpdateMention();
  const [form, setForm] = useState<Form>({
    name: mention.name ?? "", code: mention.code ?? "", level: mention.level ?? "Licence",
    duration: String(mention.duration ?? 3), description: mention.description ?? "",
    tagline: mention.tagline ?? "", diploma: mention.diploma ?? "", studyModes: mention.studyModes ?? "",
    objectives: mention.objectives ?? "", skills: mention.skills ?? "", careers: mention.careers ?? "",
    admission: mention.admission ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const preview = file ? URL.createObjectURL(file) : !removeImage && mention.imageUrl ? mediaUrl(mention.imageUrl) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await update.mutateAsync({ id: mention.id, data: { ...form, duration: Number(form.duration) || 3 } });
      if (file) {
        const fd = new FormData();
        fd.append("image", file);
        await api(`/structure/mentions/${mention.id}/image`, { method: "POST", body: fd, raw: true });
      } else if (removeImage && mention.imageUrl) {
        await api(`/structure/mentions/${mention.id}/image`, { method: "DELETE" });
      }
      toast.success(`Mention « ${form.name} » enregistrée`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={save} className="w-full max-w-3xl rounded-2xl border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b bg-card px-6 py-4">
          <div>
            <h2 className="font-bold">Modifier la mention</h2>
            <p className="text-xs text-muted-foreground">La présentation s'affiche sur la page d'accueil, au clic sur la mention.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent" aria-label="Fermer"><X size={16} /></button>
        </div>

        <div className="space-y-6 p-6">
          <Group title="Identité">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de la mention"><input className={inp} value={form.name} onChange={set("name")} required /></Field>
              <Field label="Code"><input className={inp} value={form.code} onChange={set("code")} required /></Field>
              <Field label="Niveau">
                <select className={inp} value={form.level} onChange={set("level")}>
                  {LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </Field>
              <Field label="Durée (années)"><input className={inp} type="number" min={1} max={10} value={form.duration} onChange={set("duration")} required /></Field>
            </div>
          </Group>

          <Group title="Présentation sur le site">
            <Field label="Photo" hint="JPEG, PNG ou WebP, 5 Mo maximum. Format paysage conseillé.">
              <div className="flex items-center gap-4">
                <div className="h-24 w-36 shrink-0 overflow-hidden rounded-xl border bg-muted">
                  {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-muted-foreground">Aucune photo</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium hover:bg-accent">
                    <ImagePlus size={15} /> Choisir une photo
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                      onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRemoveImage(false); }} />
                  </label>
                  {preview && (
                    <button type="button" onClick={() => { setFile(null); setRemoveImage(true); }}
                      className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10">
                      <Trash2 size={15} /> Retirer
                    </button>
                  )}
                </div>
              </div>
            </Field>
            <Field label="Phrase d'accroche" hint="Une phrase courte, affichée sous le nom de la mention.">
              <input className={inp} value={form.tagline} onChange={set("tagline")} placeholder="ex. Concevoir les outils numériques de demain." maxLength={200} />
            </Field>
            <Field label="Présentation" hint="Quelques phrases. Laissez une ligne vide entre deux paragraphes.">
              <textarea className={area} rows={5} value={form.description} onChange={set("description")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Diplôme délivré"><input className={inp} value={form.diploma} onChange={set("diploma")} placeholder="ex. Licence en Informatique" /></Field>
              <Field label="Modalités"><input className={inp} value={form.studyModes} onChange={set("studyModes")} placeholder="ex. Présentiel et en ligne" /></Field>
            </div>
          </Group>

          <Group title="Contenu de la formation">
            <Field label="Objectifs" hint="Un objectif par ligne.">
              <textarea className={area} rows={4} value={form.objectives} onChange={set("objectives")} />
            </Field>
            <Field label="Compétences acquises" hint="Une compétence par ligne.">
              <textarea className={area} rows={4} value={form.skills} onChange={set("skills")} />
            </Field>
            <Field label="Débouchés" hint="Un métier ou secteur par ligne.">
              <textarea className={area} rows={4} value={form.careers} onChange={set("careers")} />
            </Field>
            <p className="text-xs text-muted-foreground">
              Les parcours et le programme par année s'affichent aussi, depuis les sections Parcours et Plan de cursus.
            </p>
          </Group>

          <Group title="Admission">
            <Field label="Conditions d'admission" hint="Diplôme requis, pièces du dossier, calendrier…">
              <textarea className={area} rows={4} value={form.admission} onChange={set("admission")} />
            </Field>
          </Group>
        </div>

        <div className="sticky bottom-0 flex gap-2 rounded-b-2xl border-t bg-card px-6 py-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-accent">Annuler</button>
          <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />} Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
