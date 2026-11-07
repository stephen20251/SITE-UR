// Choix de la catégorie d'un cours, avec « Autre… » : l'enseignant saisit une
// nouvelle catégorie, créée (ou retrouvée si elle existe déjà) côté serveur.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { usePublicCategories } from "@/lib/lms-admin";

const OTHER = "__other__";

export function CategorySelect({ value, onChange, className }: {
  value: string;
  onChange: (id: string) => void;
  className: string;
}) {
  const qc = useQueryClient();
  const { data: categories = [] } = usePublicCategories();
  const flat = categories.flatMap((c) => [c, ...(c.children ?? [])]);
  const [other, setOther] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function addCategory() {
    if (name.trim().length < 2) return;
    setSaving(true);
    try {
      const cat = await api<{ id: string; name: string }>("/online/categories", { method: "POST", body: { name: name.trim() } });
      await qc.invalidateQueries({ queryKey: ["lms", "public-categories"] });
      onChange(cat.id);
      setOther(false);
      setName("");
      toast.success(`Catégorie « ${cat.name} » ajoutée`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Ajout impossible");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <select
        value={other ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) { setOther(true); return; }
          setOther(false);
          onChange(e.target.value);
        }}
        className={className}
      >
        <option value="">— Aucune —</option>
        {flat.map((c) => <option key={c.id} value={c.id}>{c.parentId ? `  ↳ ${c.name}` : c.name}</option>)}
        <option value={OTHER}>Autre…</option>
      </select>
      {other && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
            placeholder="Nom de la nouvelle catégorie"
            maxLength={60}
            className={className}
          />
          <button
            type="button"
            onClick={addCategory}
            disabled={saving || name.trim().length < 2}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-online px-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Ajouter
          </button>
        </div>
      )}
    </div>
  );
}

// Mention à laquelle appartient le cours : elle désigne le Responsable qui le valide.
export function MentionSelect({ value, onChange, className }: {
  value: string;
  onChange: (id: string) => void;
  className: string;
}) {
  const { data: mentions = [] } = useQuery({
    queryKey: ["cursus", "mentions"],
    queryFn: () => api<{ id: string; name: string }[]>("/cursus/mentions"),
    staleTime: 300_000,
  });
  return (
    <div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
        <option value="">— Choisir la mention —</option>
        {mentions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      {!value && (
        <p className="mt-1 text-[11px] text-amber-600">Obligatoire pour soumettre le cours : il sera validé par le Responsable de cette mention.</p>
      )}
    </div>
  );
}
