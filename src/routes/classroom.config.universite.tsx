import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Palette, BookOpen, Users, FileText, Shield,
  Save, Upload, Loader2, CheckCircle, Globe, Phone, Mail,
  MapPin, Calendar, User2, QrCode, Hash,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useRequireClassroom } from "@/components/classroom/shared";
import { tokenStore } from "@/lib/api";
import { API_ORIGIN } from "@/lib/env";

export const Route = createFileRoute("/classroom/config/universite")({ component: UniversitePage });

const BASE = API_ORIGIN;

// ── Types ──────────────────────────────────────────────────────────────────────

type Branding = {
  id: string;
  name: string; shortName: string; sigle?: string | null; establishmentType?: string | null;
  address?: string | null; city?: string | null; country?: string | null;
  phone?: string | null; email?: string | null; website?: string | null; yearCreated?: number | null;
  primaryColor: string; secondaryColor: string; accentColor: string; fontFamily: string;
  logoUrl?: string | null; secondaryLogoUrl?: string | null; backgroundUrl?: string | null;
  watermarkUrl?: string | null; stampUrl?: string | null; signatureUrl?: string | null;
  iconUrl?: string | null; rectorSignUrl?: string | null;
  rectorName?: string | null; rectorTitle?: string | null;
  documentPrefix: string; qrCodeEnabled: boolean;
};

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useBranding() {
  return useQuery<Branding>({
    queryKey: ["branding"],
    queryFn: () => api<Branding>("/branding"),
  });
}

// ── Input helpers ──────────────────────────────────────────────────────────────

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}{label}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-classroom";

// ── Asset uploader ─────────────────────────────────────────────────────────────

function AssetUpload({
  label, field, current, subfolder, onDone,
}: {
  label: string; field: string; current?: string | null; subfolder: string; onDone: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${BASE}/api/branding/upload/${subfolder}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenStore.access ?? ""}` },
        body: fd,
      });
      if (!res.ok) throw new Error("Upload échoué");
      toast.success(`${label} mis à jour`);
      onDone();
    } catch (e: unknown) { toast.error((e as Error).message); }
    finally { setUploading(false); }
  }

  return (
    <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {current ? (
        <div className="relative w-fit">
          <img src={`${BASE}${current}`} alt={label} className="h-14 max-w-[120px] object-contain rounded-lg border" />
        </div>
      ) : (
        <div className="flex h-14 w-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground/30">
          <Upload size={18} />
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      <button onClick={() => ref.current?.click()} disabled={uploading}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60">
        {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
        {uploading ? "Envoi…" : current ? "Changer" : "Télécharger"}
      </button>
    </div>
  );
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "identite",    label: "Identité",      icon: <Building2 size={15} /> },
  { key: "visuel",      label: "Identité visuelle", icon: <Palette size={15} /> },
  { key: "responsables", label: "Responsables",  icon: <Users size={15} /> },
  { key: "documents",   label: "Documents",      icon: <FileText size={15} /> },
] as const;

type TabKey = typeof TABS[number]["key"];

// ── Main page ──────────────────────────────────────────────────────────────────

function UniversitePage() {
  const { user, ready } = useRequireClassroom(["SUPER_ADMIN"]);
  const qc = useQueryClient();
  const brandingQ = useBranding();
  const branding = brandingQ.data;

  const [tab, setTab] = useState<TabKey>("identite");
  const [draft, setDraft] = useState<Partial<Branding>>({});
  const [saving, setSaving] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["branding"] });

  function set(key: keyof Branding, value: string | boolean | number) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function val(key: keyof Branding): string {
    if (key in draft) return String(draft[key as keyof typeof draft] ?? "");
    return String(branding?.[key as keyof Branding] ?? "");
  }

  function checked(key: keyof Branding): boolean {
    if (key in draft) return Boolean(draft[key as keyof typeof draft]);
    return Boolean(branding?.[key as keyof Branding]);
  }

  async function save() {
    if (!Object.keys(draft).length) { toast("Aucune modification"); return; }
    setSaving(true);
    try {
      await api("/branding", { method: "PATCH", body: draft });
      toast.success("Paramètres enregistrés");
      setDraft({});
      invalidate();
    } catch (e: unknown) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  const hasDraft = Object.keys(draft).length > 0;

  if (!ready || !user || brandingQ.isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 pb-10 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Paramètres université</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ces paramètres sont utilisés dans toutes les cartes, lettres, certificats, bulletins et diplômes.
          </p>
        </div>
        {hasDraft && (
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 rounded-xl grad-classroom px-4 py-2.5 text-sm font-semibold text-white shadow-elegant disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer les modifications
          </button>
        )}
      </div>

      {/* Preview banner */}
      <div className="flex items-center gap-4 rounded-2xl border px-4 py-3 bg-muted/30">
        {branding?.logoUrl ? (
          <img src={`${BASE}${branding.logoUrl}`} alt="Logo" className="h-10 w-10 object-contain rounded-lg" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
            {branding?.shortName ?? "—"}
          </div>
        )}
        <div>
          <p className="font-semibold text-sm">{branding?.name}</p>
          <p className="text-xs text-muted-foreground">{branding?.city}, {branding?.country} · {branding?.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="h-5 w-5 rounded border" style={{ backgroundColor: branding?.primaryColor }} />
          <div className="h-5 w-5 rounded border" style={{ backgroundColor: branding?.accentColor }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.key ? "border-b-2 border-classroom text-classroom" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Identité ─────────────────────────────────────── */}
      {tab === "identite" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Nom officiel" icon={<Building2 size={12} />}>
                <input value={val("name")} onChange={(e) => set("name", e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Nom court / Sigle" icon={<Hash size={12} />}>
              <input value={val("shortName")} onChange={(e) => set("shortName", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Acronyme" icon={<Hash size={12} />}>
              <input value={val("sigle")} onChange={(e) => set("sigle", e.target.value)} className={inputCls} placeholder="Ex : UNIREF" />
            </Field>
            <Field label="Type d'établissement">
              <div className="relative">
                <select value={val("establishmentType")} onChange={(e) => set("establishmentType", e.target.value)}
                  className={inputCls + " appearance-none pr-8"}>
                  <option value="">— Choisir —</option>
                  <option>Université</option>
                  <option>Institut</option>
                  <option>École Supérieure</option>
                  <option>Centre de Formation</option>
                  <option>Autre</option>
                </select>
              </div>
            </Field>
            <Field label="Année de création" icon={<Calendar size={12} />}>
              <input type="number" value={val("yearCreated")} onChange={(e) => set("yearCreated", Number(e.target.value))}
                placeholder="Ex : 1961" className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Adresse complète" icon={<MapPin size={12} />}>
                <input value={val("address")} onChange={(e) => set("address", e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Ville" icon={<MapPin size={12} />}>
              <input value={val("city")} onChange={(e) => set("city", e.target.value)} className={inputCls} placeholder="Antananarivo" />
            </Field>
            <Field label="Pays" icon={<Globe size={12} />}>
              <input value={val("country")} onChange={(e) => set("country", e.target.value)} className={inputCls} placeholder="Madagascar" />
            </Field>
            <Field label="Téléphone" icon={<Phone size={12} />}>
              <input type="tel" value={val("phone")} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Email officiel" icon={<Mail size={12} />}>
              <input type="email" value={val("email")} onChange={(e) => set("email", e.target.value)} className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Site web" icon={<Globe size={12} />}>
                <input type="url" value={val("website")} onChange={(e) => set("website", e.target.value)}
                  placeholder="https://www.universite.mg" className={inputCls} />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Identité visuelle ─────────────────────────────── */}
      {tab === "visuel" && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Couleur principale">
              <div className="flex items-center gap-2">
                <input type="color" value={val("primaryColor")} onChange={(e) => set("primaryColor", e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border" />
                <input value={val("primaryColor")} onChange={(e) => set("primaryColor", e.target.value)} className={inputCls} />
              </div>
            </Field>
            <Field label="Couleur secondaire">
              <div className="flex items-center gap-2">
                <input type="color" value={val("secondaryColor")} onChange={(e) => set("secondaryColor", e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border" />
                <input value={val("secondaryColor")} onChange={(e) => set("secondaryColor", e.target.value)} className={inputCls} />
              </div>
            </Field>
            <Field label="Couleur accentuée">
              <div className="flex items-center gap-2">
                <input type="color" value={val("accentColor")} onChange={(e) => set("accentColor", e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border" />
                <input value={val("accentColor")} onChange={(e) => set("accentColor", e.target.value)} className={inputCls} />
              </div>
            </Field>
          </div>

          <Field label="Police de caractères">
            <div className="relative">
              <select value={val("fontFamily")} onChange={(e) => set("fontFamily", e.target.value)}
                className={inputCls + " appearance-none pr-8"}>
                <option value="Arial, sans-serif">Arial</option>
                <option value="Times New Roman, serif">Times New Roman</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Helvetica, Arial, sans-serif">Helvetica</option>
                <option value="Calibri, sans-serif">Calibri</option>
                <option value="Garamond, serif">Garamond</option>
              </select>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AssetUpload label="Logo principal" field="logoUrl" current={branding?.logoUrl} subfolder="logo" onDone={invalidate} />
            <AssetUpload label="Logo secondaire" field="secondaryLogoUrl" current={branding?.secondaryLogoUrl} subfolder="logo-secondary" onDone={invalidate} />
            <AssetUpload label="Icône / Favicon" field="iconUrl" current={branding?.iconUrl} subfolder="icon" onDone={invalidate} />
            <AssetUpload label="Cachet officiel" field="stampUrl" current={branding?.stampUrl} subfolder="stamp" onDone={invalidate} />
            <AssetUpload label="Signature recteur" field="signatureUrl" current={branding?.signatureUrl} subfolder="signature" onDone={invalidate} />
            <AssetUpload label="Filigrane" field="watermarkUrl" current={branding?.watermarkUrl} subfolder="watermark" onDone={invalidate} />
            <AssetUpload label="Fond de page" field="backgroundUrl" current={branding?.backgroundUrl} subfolder="background" onDone={invalidate} />
          </div>
        </div>
      )}

      {/* ── Tab: Responsables ─────────────────────────────────── */}
      {tab === "responsables" && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Ces informations apparaissent automatiquement dans les lettres, certificats et diplômes officiels.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom du Recteur / Directeur" icon={<User2 size={12} />}>
              <input value={val("rectorName")} onChange={(e) => set("rectorName", e.target.value)}
                placeholder="Ex : Pr. Jean RAKOTO" className={inputCls} />
            </Field>
            <Field label="Titre du Recteur" icon={<User2 size={12} />}>
              <input value={val("rectorTitle")} onChange={(e) => set("rectorTitle", e.target.value)}
                placeholder="Ex : Recteur de l'Université" className={inputCls} />
            </Field>
          </div>
          <AssetUpload label="Signature du Recteur" field="rectorSignUrl" current={branding?.rectorSignUrl} subfolder="rector-sign" onDone={invalidate} />
          <div className="rounded-2xl border bg-amber-50 border-amber-200 px-4 py-3 text-sm text-amber-800">
            <p className="font-medium mb-1">📌 Utilisation dans les documents</p>
            <p>Les variables <code className="bg-amber-100 px-1 rounded">{"{{school.rectorName}}"}</code> et <code className="bg-amber-100 px-1 rounded">{"{{school.rectorTitle}}"}</code> sont automatiquement remplacées dans les templates de lettres et certificats.</p>
          </div>
        </div>
      )}

      {/* ── Tab: Documents ─────────────────────────────────────── */}
      {tab === "documents" && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Configuration de la numérotation et des fonctionnalités de sécurité des documents.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Préfixe des documents" icon={<Hash size={12} />}>
              <input value={val("documentPrefix")} onChange={(e) => set("documentPrefix", e.target.value)}
                placeholder="Ex : UR" className={inputCls} />
              <p className="mt-1 text-[11px] text-muted-foreground">Certificat : {val("documentPrefix") || "UR"}-2026-CERT-0001</p>
            </Field>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative h-6 w-11 rounded-full transition-colors ${checked("qrCodeEnabled") ? "bg-classroom" : "bg-gray-200"}`}
                onClick={() => set("qrCodeEnabled", !checked("qrCodeEnabled"))}>
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked("qrCodeEnabled") ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5"><QrCode size={14} /> QR Code sur les documents</p>
                <p className="text-xs text-muted-foreground">Chaque document aura un QR code pointant vers sa version en ligne pour vérification.</p>
              </div>
            </label>
          </div>

          <div className="rounded-2xl border bg-muted/30 p-4 space-y-3">
            <h3 className="text-sm font-semibold">Variables disponibles dans les templates</h3>
            {[
              ["{{school.name}}",           "Nom officiel"],
              ["{{school.shortName}}",      "Nom court"],
              ["{{school.sigle}}",          "Sigle / Acronyme"],
              ["{{school.address}}",        "Adresse"],
              ["{{school.city}}",           "Ville"],
              ["{{school.phone}}",          "Téléphone"],
              ["{{school.email}}",          "Email"],
              ["{{school.website}}",        "Site web"],
              ["{{school.rectorName}}",     "Nom du Recteur"],
              ["{{school.rectorTitle}}",    "Titre du Recteur"],
              ["{{school.logo}}",           "Logo (balise img)"],
              ["{{school.stamp}}",          "Cachet (balise img)"],
              ["{{school.signature}}",      "Signature (balise img)"],
              ["{{school.primary_color}}",  "Couleur principale"],
              ["{{school.accent_color}}",   "Couleur accentuée"],
            ].map(([variable, desc]) => (
              <div key={variable} className="flex items-center justify-between gap-4">
                <code className="rounded-lg bg-white border px-2 py-0.5 text-xs font-mono text-classroom">{variable}</code>
                <span className="text-xs text-muted-foreground text-right">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save button (sticky) */}
      {hasDraft && (
        <div className="sticky bottom-4 flex justify-end">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 rounded-xl grad-classroom px-5 py-3 text-sm font-semibold text-white shadow-xl disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer ({Object.keys(draft).length} modification{Object.keys(draft).length !== 1 ? "s" : ""})
          </button>
        </div>
      )}
    </div>
  );
}
