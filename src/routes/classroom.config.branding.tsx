import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import {
  Upload, Save, Loader2, CheckCircle, AlertTriangle, ImageIcon,
  Palette, Type, Globe, Phone, Mail, MapPin, X,
} from "lucide-react";
import { toast } from "sonner";
import { useBranding, useUpdateBranding, useUploadBrandingAsset, brandingUrl, type SchoolBranding } from "@/lib/branding";

export const Route = createFileRoute("/classroom/config/branding")({ component: BrandingPage });

// ── Asset upload card ──────────────────────────────────────────────────────────

type AssetField = "logo" | "secondary-logo" | "background" | "watermark" | "stamp" | "signature" | "icon";

function AssetUpload({ label, field, currentUrl, accept = "image/*", hint }: {
  label: string; field: AssetField; currentUrl: string | null | undefined; accept?: string; hint?: string;
}) {
  const upload  = useUploadBrandingAsset();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    try {
      await upload.mutateAsync({ field, file });
      toast.success(`${label} mis à jour`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur upload"); }
  }, [field, label, upload]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const resolved = brandingUrl(currentUrl);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-classroom hover:bg-accent/30 transition-all"
      >
        {upload.isPending ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : resolved ? (
          <img src={resolved} alt={label} className="max-h-24 max-w-full object-contain rounded-lg" />
        ) : (
          <>
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground">Glissez ou cliquez pour uploader</span>
          </>
        )}
        {resolved && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
            <Upload className="h-6 w-6 text-white" />
            <span className="ml-2 text-xs text-white font-medium">Changer</span>
          </div>
        )}
        <input ref={inputRef} type="file" accept={accept} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      </div>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Color input ────────────────────────────────────────────────────────────────

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      <div className="flex items-center gap-3">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-lg border bg-transparent p-0.5" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-xl border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-classroom"
          placeholder="#000000" />
      </div>
    </div>
  );
}

// ── Live card preview ──────────────────────────────────────────────────────────

function CardPreview({ branding }: { branding: SchoolBranding }) {
  const logoUrl = brandingUrl(branding.logoUrl);
  const bg      = brandingUrl(branding.backgroundUrl);

  const previewHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:transparent;width:323px;height:204px;overflow:hidden;display:flex;align-items:center;justify-content:center;}
</style></head><body>
<div style="width:323px;height:204px;background:#fff;border:1px solid ${branding.primaryColor};border-radius:8px;font-family:${branding.fontFamily};position:relative;overflow:hidden;">
  ${bg ? `<img src="${bg}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.06;">` : ''}
  <div style="background:${branding.primaryColor};height:54px;display:flex;align-items:center;padding:0 12px;gap:8px;">
    ${logoUrl ? `<img src="${logoUrl}" style="height:34px;width:34px;object-fit:contain;filter:brightness(0) invert(1);">` : `<div style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.2);"></div>`}
    <div style="color:#fff;font-size:9px;font-weight:700;line-height:1.3;">${branding.name}<br><span style="opacity:.75;font-weight:400;">Direction des Affaires Académiques</span></div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;">
    <div style="width:42px;height:54px;background:#e2e8f0;border-radius:4px;border:1px solid ${branding.primaryColor};flex-shrink:0;"></div>
    <div>
      <div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Carte d'étudiant</div>
      <div style="font-size:10px;font-weight:700;color:${branding.primaryColor};line-height:1.3;">NOM PRÉNOM</div>
      <div style="font-size:8px;color:#555;margin-top:2px;">Mention — Niveau</div>
      <div style="font-size:7px;color:#4a5568;margin-top:4px;"><b>Matricule:</b> <span style="color:${branding.primaryColor};font-weight:700;font-family:monospace;">MAT-2026-0001</span></div>
      <div style="font-size:7px;color:#718096;">Année 2025-2026</div>
    </div>
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:4px;background:${branding.primaryColor};"></div>
  <div style="position:absolute;bottom:6px;right:10px;width:28px;height:28px;background:#f0f0f0;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:5px;color:#999;">QR</div>
</div>
</body></html>`;

  return (
    <div className="rounded-2xl border bg-card shadow-elegant p-5 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Palette size={13} /> Prévisualisation de la carte
      </h3>
      <div className="flex justify-center">
        <div className="rounded-xl overflow-hidden shadow-md border">
          <iframe srcDoc={previewHtml} style={{ width: 323, height: 204 }} className="block"
            title="Aperçu carte" sandbox="allow-same-origin" scrolling="no" />
        </div>
      </div>
      <p className="text-center text-[10px] text-muted-foreground">Aperçu live — mis à jour automatiquement</p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function BrandingPage() {
  const { data: branding, isLoading } = useBranding();
  const update = useUpdateBranding();

  const [form, setForm] = useState<Partial<SchoolBranding>>({});
  const [saved, setSaved] = useState(false);

  // Merged: form overrides fetched values for live preview
  const merged: SchoolBranding | undefined = branding
    ? { ...branding, ...form }
    : undefined;

  function setF(key: keyof SchoolBranding, val: string) {
    setForm((p) => ({ ...p, [key]: val }));
    setSaved(false);
  }

  async function handleSave() {
    if (!Object.keys(form).length) return;
    try {
      await update.mutateAsync(form);
      setForm({});
      setSaved(true);
      toast.success("Identité visuelle enregistrée");
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  }

  if (isLoading || !branding) return (
    <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  );

  const v = (key: keyof SchoolBranding) => (form[key] as string) ?? (branding[key] as string) ?? "";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">Identité visuelle</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ces ressources sont injectées automatiquement dans tous les documents, cartes, lettres et diplômes.
          </p>
        </div>
        <button onClick={handleSave} disabled={!Object.keys(form).length || update.isPending}
          className="flex items-center gap-2 rounded-xl grad-classroom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
          {update.isPending ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saved ? "Enregistré" : "Enregistrer"}
        </button>
      </div>

      {/* Unsaved indicator */}
      {Object.keys(form).length > 0 && !update.isPending && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-900 dark:bg-amber-950/20">
          <AlertTriangle size={14} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">Modifications non enregistrées — cliquez sur Enregistrer</p>
          <button onClick={() => setForm({})} className="ml-auto text-amber-600 hover:text-amber-800"><X size={14} /></button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Assets */}
        <div className="lg:col-span-2 space-y-6">

          {/* Colors & Typography */}
          <div className="rounded-2xl border bg-card shadow-elegant p-6 space-y-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Palette size={15} /> Couleurs & Police</h3>
            <div className="grid gap-5 sm:grid-cols-3">
              <ColorField label="Couleur principale" value={v("primaryColor")} onChange={(val) => setF("primaryColor", val)} />
              <ColorField label="Couleur secondaire" value={v("secondaryColor")} onChange={(val) => setF("secondaryColor", val)} />
              <ColorField label="Couleur accent" value={v("accentColor")} onChange={(val) => setF("accentColor", val)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Type size={12} className="inline mr-1" />Police par défaut</label>
              <select value={v("fontFamily")} onChange={(e) => setF("fontFamily", e.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom">
                {["Arial, sans-serif","Georgia, serif","'Times New Roman', serif","Verdana, sans-serif","Tahoma, sans-serif","'Trebuchet MS', sans-serif","'Courier New', monospace"].map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>{f.split(",")[0].replace(/'/g, "")}</option>
                ))}
              </select>
            </div>
          </div>

          {/* School identity */}
          <div className="rounded-2xl border bg-card shadow-elegant p-6 space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Globe size={15} /> Informations de l'établissement</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { key: "name" as const,      label: "Nom complet", placeholder: "Université de Référence" },
                { key: "shortName" as const, label: "Sigle / Abréviation", placeholder: "UR" },
                { key: "address" as const,   label: "Adresse",  placeholder: "Antananarivo, Madagascar", icon: MapPin },
                { key: "email" as const,     label: "E-mail",   placeholder: "contact@ur.mg",           icon: Mail },
                { key: "phone" as const,     label: "Téléphone", placeholder: "+261 20 22 XXX XX",      icon: Phone },
                { key: "website" as const,   label: "Site web", placeholder: "www.ur.mg",               icon: Globe },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
                  <input value={v(key)} onChange={(e) => setF(key, e.target.value)} placeholder={placeholder}
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom" />
                </div>
              ))}
            </div>
          </div>

          {/* Assets grid */}
          <div className="rounded-2xl border bg-card shadow-elegant p-6 space-y-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Upload size={15} /> Ressources graphiques</h3>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <AssetUpload label="Logo principal" field="logo" currentUrl={branding.logoUrl}
                hint="PNG, SVG ou JPG · affiché en haut de chaque document" />
              <AssetUpload label="Logo secondaire" field="secondary-logo" currentUrl={branding.secondaryLogoUrl}
                hint="Optionnel — utilisé sur les en-têtes doubles" />
              <AssetUpload label="Icône / Favicon" field="icon" currentUrl={branding.iconUrl}
                hint="Petite version carrée du logo" />
              <AssetUpload label="Fond de carte" field="background" currentUrl={branding.backgroundUrl}
                accept="image/png,image/jpeg,image/webp"
                hint="Texture ou motif de fond (PNG, JPG, WEBP)" />
              <AssetUpload label="Filigrane" field="watermark" currentUrl={branding.watermarkUrl}
                hint="PNG transparent — appliqué en superposition légère" />
              <AssetUpload label="Cachet officiel" field="stamp" currentUrl={branding.stampUrl}
                hint="PNG transparent — apposé sur les documents officiels" />
            </div>
            <div className="pt-2 border-t">
              <AssetUpload label="Signature officielle" field="signature" currentUrl={branding.signatureUrl}
                hint="PNG transparent · signature du responsable habilitant" />
            </div>
          </div>
        </div>

        {/* Right: Live preview */}
        <div className="space-y-6">
          {merged && <CardPreview branding={merged} />}

          {/* Variable reference */}
          <div className="rounded-2xl border bg-card shadow-elegant p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Variables disponibles</h3>
            <div className="space-y-1.5 font-mono text-[10px] text-muted-foreground">
              {[
                "{{school.logo}}", "{{school.secondary_logo}}",
                "{{school.background}}", "{{school.watermark}}",
                "{{school.stamp}}", "{{school.signature}}",
                "{{school.primary_color}}", "{{school.secondary_color}}",
                "{{school.accent_color}}", "{{school.font}}",
                "{{school.name}}", "{{school.address}}",
                "{{school.email}}", "{{school.phone}}",
              ].map((v) => (
                <div key={v} className="rounded-lg bg-muted/50 px-2.5 py-1">{v}</div>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground/60">
              Ces variables sont automatiquement injectées dans les cartes, lettres, bulletins et tous les documents générés.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
