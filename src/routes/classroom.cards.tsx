import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, CreditCard, ChevronDown, Search, X, ArrowLeft,
  Download, Printer, Package, Image as ImageIcon, Users,
  GraduationCap, ListChecks, User, CheckSquare, Square,
  RefreshCw, ZoomIn,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useRequireClassroom } from "@/components/classroom/shared";
import {
  useCardTemplates, generateCard, generateBulkCards,
  type CardTemplate, type CardResult, type BulkCardResult,
} from "@/lib/cards";

export const Route = createFileRoute("/classroom/cards")({ component: CardsPage });

// CR80 card: 85.6 × 54 mm — rendered at 969 × 612 px in backend HTML
const CARD_W = 969;
const CARD_H = 612;
const SCALE  = 0.35; // display scale in the gallery/preview

// ── Types ──────────────────────────────────────────────────────────────────────

type AcYear  = { id: string; label?: string; name?: string };
type Mention = { id: string; name: string };
type Promo   = { id: string; name: string; level: string };
type Group   = { id: string; name: string; _count?: { students: number } };
type Student = { id: string; matricule: string | null; user: { firstName: string; lastName: string }; group?: { name: string } | null };
type GenMode = "one" | "group" | "promotion" | "mention";

// ── Data hooks ─────────────────────────────────────────────────────────────────

function useAcYears()  { return useQuery({ queryKey: ["structure","academic-years"], queryFn: () => api<AcYear[]>("/structure/academic-years") }); }
function useMentions() { return useQuery({ queryKey: ["structure","mentions"], queryFn: () => api<Mention[]>("/structure/mentions") }); }
function usePromos(p: { mentionId?: string; academicYearId?: string }) {
  const qs = new URLSearchParams();
  if (p.mentionId) qs.set("mentionId", p.mentionId);
  if (p.academicYearId) qs.set("academicYearId", p.academicYearId);
  return useQuery({ queryKey: ["structure","promotions",p], queryFn: () => api<Promo[]>(`/structure/promotions?${qs}`), enabled: !!(p.mentionId || p.academicYearId) });
}
function useGroups(promId?: string) {
  return useQuery({ queryKey: ["structure","groups",promId], queryFn: () => api<Group[]>(`/structure/promotions/${promId}/groups`), enabled: !!promId });
}
function useDocStudents(p: { academicYearId?: string; mentionId?: string; promotionId?: string; groupId?: string }) {
  const qs = new URLSearchParams();
  if (p.academicYearId) qs.set("academicYearId", p.academicYearId);
  if (p.mentionId) qs.set("mentionId", p.mentionId);
  if (p.promotionId) qs.set("promotionId", p.promotionId);
  if (p.groupId) qs.set("groupId", p.groupId);
  const enabled = !!(p.promotionId || p.mentionId);
  return useQuery({ queryKey: ["docs","students",p], queryFn: () => api<Student[]>(`/documents/students?${qs}`), enabled });
}

// ── Shared select ──────────────────────────────────────────────────────────────

function Sel({ label, value, onChange, options, disabled, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          className="w-full appearance-none rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-classroom disabled:opacity-50">
          <option value="">{placeholder ?? `— ${label} —`}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

// ── Student checklist ──────────────────────────────────────────────────────────

function StudentPicker({
  mode, onGenerate,
}: {
  mode: GenMode;
  onGenerate: (ids: string[]) => void;
}) {
  const [yearId, setYear] = useState("");
  const [menId,  setMen]  = useState("");
  const [proId,  setPro]  = useState("");
  const [grpId,  setGrp]  = useState("");
  const [sel,    setSel]  = useState<Set<string>>(new Set());
  const [singleId, setSingle] = useState("");

  const years  = useAcYears();
  const ments  = useMentions();
  const promos = usePromos({ mentionId: menId || undefined, academicYearId: yearId || undefined });
  const groups = useGroups(proId || undefined);
  const studQ  = useDocStudents(
    mode === "group"     ? { promotionId: proId, groupId: grpId } :
    mode === "promotion" ? { promotionId: proId } :
    mode === "mention"   ? { mentionId: menId, academicYearId: yearId } :
    /* "one" mode */       { promotionId: proId || undefined, groupId: grpId || undefined }
  );

  const students = studQ.data ?? [];
  const allIds   = students.map((s) => s.id);
  const allChk   = allIds.length > 0 && allIds.every((id) => sel.has(id));
  const someChk  = !allChk && allIds.some((id) => sel.has(id));

  function reset() { setSel(new Set()); setSingle(""); }

  if (mode === "one") {
    return (
      <div className="space-y-3">
        <Sel label="Année" value={yearId} onChange={(v) => { setYear(v); setMen(""); setPro(""); setGrp(""); reset(); }}
          options={(years.data ?? []).map((y) => ({ value: y.id, label: y.label ?? y.name ?? y.id }))} />
        <Sel label="Mention" value={menId} onChange={(v) => { setMen(v); setPro(""); setGrp(""); reset(); }} disabled={!yearId}
          options={(ments.data ?? []).map((m) => ({ value: m.id, label: m.name }))} />
        <Sel label="Promotion" value={proId} onChange={(v) => { setPro(v); setGrp(""); reset(); }} disabled={!menId}
          options={(promos.data ?? []).map((p) => ({ value: p.id, label: `${p.name} — ${p.level}` }))} />
        <Sel label="Groupe (opt.)" value={grpId} onChange={(v) => { setGrp(v); reset(); }} disabled={!proId}
          options={(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))} />
        {proId && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Étudiant</label>
            {studQ.isLoading
              ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Chargement…</div>
              : <select value={singleId} onChange={(e) => { setSingle(e.target.value); if (e.target.value) onGenerate([e.target.value]); }}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom">
                  <option value="">— Sélectionner —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.user.lastName.toUpperCase()} {s.user.firstName}{s.matricule ? ` (${s.matricule})` : ""}</option>
                  ))}
                </select>
            }
          </div>
        )}
      </div>
    );
  }

  const canQ = mode === "mention" ? !!menId : mode === "promotion" ? !!proId : (!!proId && !!grpId);
  return (
    <div className="space-y-3">
      <Sel label="Année" value={yearId} onChange={(v) => { setYear(v); setMen(""); setPro(""); setGrp(""); reset(); }}
        options={(years.data ?? []).map((y) => ({ value: y.id, label: y.label ?? y.name ?? y.id }))} />
      <Sel label="Mention" value={menId} onChange={(v) => { setMen(v); setPro(""); setGrp(""); reset(); }} disabled={!yearId}
        options={(ments.data ?? []).map((m) => ({ value: m.id, label: m.name }))} />
      {(mode === "group" || mode === "promotion") && (
        <Sel label="Promotion" value={proId} onChange={(v) => { setPro(v); setGrp(""); reset(); }} disabled={!menId}
          options={(promos.data ?? []).map((p) => ({ value: p.id, label: `${p.name} — ${p.level}` }))} />
      )}
      {mode === "group" && (
        <Sel label="Groupe" value={grpId} onChange={(v) => { setGrp(v); reset(); }} disabled={!proId}
          options={(groups.data ?? []).map((g) => ({ value: g.id, label: `${g.name}${g._count ? ` (${g._count.students})` : ""}` }))} />
      )}
      {canQ && (
        <div className="rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
            <button onClick={() => setSel(allChk ? new Set() : new Set(allIds))} className="text-classroom">
              {allChk ? <CheckSquare size={15} /> : someChk ? <CheckSquare size={15} className="opacity-50" /> : <Square size={15} />}
            </button>
            <span className="text-xs text-muted-foreground">
              {studQ.isLoading ? "Chargement…" : `${students.length} étudiant${students.length !== 1 ? "s" : ""}`}
            </span>
            {sel.size > 0 && <span className="ml-auto text-xs font-semibold text-classroom">{sel.size} sélectionné{sel.size !== 1 ? "s" : ""}</span>}
          </div>
          {studQ.isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : students.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">Aucun étudiant trouvé.</p>
          ) : (
            <div className="max-h-52 overflow-y-auto">
              {students.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-3 border-b last:border-0 px-3 py-2 hover:bg-accent">
                  <input type="checkbox" checked={sel.has(s.id)}
                    onChange={() => setSel((p) => { const n = new Set(p); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                    className="h-4 w-4 rounded accent-classroom" />
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full grad-classroom text-[10px] font-bold text-white">
                    {s.user.firstName[0]}{s.user.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.user.lastName.toUpperCase()} {s.user.firstName}</p>
                    <p className="text-[10px] text-muted-foreground">{s.matricule ?? "—"}{s.group ? ` · ${s.group.name}` : ""}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2 border-t bg-muted/20 px-3 py-2">
            <button onClick={() => onGenerate([...sel])} disabled={sel.size === 0}
              className="flex-1 rounded-lg bg-classroom py-2 text-xs font-semibold text-white disabled:opacity-40">
              {sel.size === 0 ? "Sélectionnez des étudiants" : `Générer ${sel.size} carte${sel.size !== 1 ? "s" : ""}`}
            </button>
            <button onClick={() => onGenerate(allIds)} disabled={allIds.length === 0}
              className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-accent whitespace-nowrap">
              Tous ({allIds.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card face renderer (iframe) ────────────────────────────────────────────────

function CardFace({ html, label }: { html: string; label: string }) {
  const w = Math.round(CARD_W * SCALE);
  const h = Math.round(CARD_H * SCALE);
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box;}body{width:${CARD_W}px;height:${CARD_H}px;overflow:hidden;transform-origin:top left;transform:scale(${SCALE});}</style></head><body>${html}</body></html>`;
  return (
    <div>
      <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div style={{ width: w, height: h, overflow: "hidden", borderRadius: 8, boxShadow: "0 4px 24px rgba(0,0,0,.18)" }}>
        <iframe srcDoc={fullHtml} style={{ width: w, height: h, border: "none" }} title={label} sandbox="allow-same-origin" scrolling="no" />
      </div>
    </div>
  );
}

// ── Download helpers ───────────────────────────────────────────────────────────

async function cardHtmlToPng(html: string, filename: string) {
  // Open in popup, let html2canvas capture it
  const win = window.open("", "_blank", `width=${CARD_W},height=${CARD_H}`);
  if (!win) { toast.error("Popup bloqué — autorisez les popups"); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;}body{width:${CARD_W}px;height:${CARD_H}px;overflow:hidden;}</style></head><body>${html}</body></html>`);
  win.document.close();
  await new Promise((r) => setTimeout(r, 600));

  try {
    const h2c = (await import("html2canvas")).default;
    const canvas = await h2c(win.document.body, { width: CARD_W, height: CARD_H, scale: 2, useCORS: true, allowTaint: true });
    win.close();
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (e) {
    win.close();
    toast.error("Erreur export PNG: " + (e instanceof Error ? e.message : ""));
  }
}

async function downloadPdf(html: string, filename: string) {
  const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@page{size:${CARD_W}px ${CARD_H}px;margin:0}*{margin:0;padding:0}body{width:${CARD_W}px;height:${CARD_H}px;overflow:hidden;}</style></head><body>${html}</body></html>`], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function printCard(rectoHtml: string, versoHtml: string) {
  const win = window.open("", "_blank");
  if (!win) { toast.error("Popup bloqué"); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  @page{size:${CARD_W}px ${CARD_H}px;margin:0}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#fff}
  .page{width:${CARD_W}px;height:${CARD_H}px;overflow:hidden;page-break-after:always}
  </style></head><body>
  <div class="page">${rectoHtml}</div>
  <div class="page">${versoHtml}</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

async function downloadBulkZip(cards: BulkCardResult[], templateId: string) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const card of cards) {
    const safeName = card.name.replace(/[^a-z0-9]/gi, "_");
    zip.file(`${safeName}_recto.html`, `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0}body{width:${CARD_W}px;height:${CARD_H}px;overflow:hidden}</style></head><body>${card.recto}</body></html>`);
    zip.file(`${safeName}_verso.html`, `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0}body{width:${CARD_W}px;height:${CARD_H}px;overflow:hidden}</style></head><body>${card.verso}</body></html>`);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `cartes-${templateId}-${Date.now()}.zip`; a.click();
  URL.revokeObjectURL(url);
}

async function printAllCards(cards: BulkCardResult[]) {
  const pages = cards.flatMap((c) => [c.recto, c.verso])
    .map((h, i) => `<div class="page">${h}</div>`)
    .join("\n");
  const win = window.open("", "_blank");
  if (!win) { toast.error("Popup bloqué"); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  @page{size:${CARD_W}px ${CARD_H}px;margin:0}
  *{margin:0;padding:0;box-sizing:border-box}
  .page{width:${CARD_W}px;height:${CARD_H}px;overflow:hidden;page-break-after:always}
  </style></head><body>${pages}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

// ── Card designer panel ────────────────────────────────────────────────────────

function CardDesigner({ template, onClose }: { template: CardTemplate; onClose: () => void }) {
  const [mode,    setMode]    = useState<GenMode>("one");
  const [loading, setLoading] = useState(false);
  const [card,    setCard]    = useState<CardResult | null>(null);
  const [bulk,    setBulk]    = useState<BulkCardResult[]>([]);
  const [viewIdx, setViewIdx] = useState(0);
  const [face,    setFace]    = useState<"recto" | "verso">("recto");

  const isBulk = bulk.length > 1;
  const displayCard = isBulk ? { recto: bulk[viewIdx]?.recto ?? "", verso: bulk[viewIdx]?.verso ?? "" } : card;

  async function genSingle(id: string) {
    setLoading(true); setCard(null); setBulk([]);
    try { setCard(await generateCard(template.id, id)); toast.success("Carte générée"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  async function genBulk(ids: string[]) {
    if (!ids.length) return;
    setLoading(true); setCard(null); setBulk([]); setViewIdx(0);
    try {
      const res = await generateBulkCards(template.id, ids);
      setBulk(res);
      toast.success(`${res.length} carte${res.length !== 1 ? "s" : ""} générées`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  const currentRecto = isBulk ? (bulk[viewIdx]?.recto ?? "") : (card?.recto ?? "");
  const currentVerso = isBulk ? (bulk[viewIdx]?.verso ?? "") : (card?.verso ?? "");

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0">
      {/* Left config */}
      <div className="flex flex-col border-r border-gray-100 dark:border-gray-800 shrink-0" style={{ width: "22rem" }}>
        <div className="flex items-center gap-3 border-b px-4 py-4">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={18} /></button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border" style={{ background: template.thumbnail.startsWith("#") ? template.thumbnail : undefined, backgroundImage: template.thumbnail.startsWith("linear") ? template.thumbnail : undefined }}>
            <CreditCard className="h-4 w-4 text-white drop-shadow" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{template.name}</p>
            <p className="text-[10px] text-muted-foreground">Carte d'étudiant · CR80</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Mode */}
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Mode de génération</label>
            <div className="grid grid-cols-2 gap-1.5">
              {([ { m: "one" as GenMode,       I: User,       lbl: "Un étudiant" },
                   { m: "group" as GenMode,     I: Users,      lbl: "Un groupe" },
                   { m: "promotion" as GenMode, I: ListChecks, lbl: "Promotion" },
                   { m: "mention" as GenMode,   I: GraduationCap, lbl: "Mention" },
                ]).map(({ m, I, lbl }) => (
                <button key={m} onClick={() => { setMode(m); setCard(null); setBulk([]); }}
                  className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition-all ${mode === m ? "border-classroom bg-classroom/10 text-classroom" : "text-muted-foreground hover:bg-accent"}`}>
                  <I size={13} /> {lbl}
                </button>
              ))}
            </div>
          </div>

          <StudentPicker mode={mode}
            onGenerate={(ids) => mode === "one" ? genSingle(ids[0]) : genBulk(ids)} />
        </div>

        {/* Actions */}
        {displayCard && (
          <div className="border-t p-4 space-y-2">
            {isBulk && (
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setViewIdx((v) => Math.max(0, v - 1))} disabled={viewIdx === 0}
                  className="rounded-lg border px-2 py-1 text-xs disabled:opacity-30">◀</button>
                <span className="text-xs text-muted-foreground font-medium">{bulk[viewIdx]?.name ?? ""}</span>
                <button onClick={() => setViewIdx((v) => Math.min(bulk.length - 1, v + 1))} disabled={viewIdx === bulk.length - 1}
                  className="rounded-lg border px-2 py-1 text-xs disabled:opacity-30">▶</button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setFace("recto")}
                className={`flex-1 rounded-xl border py-2 text-xs font-medium ${face === "recto" ? "bg-classroom text-white border-classroom" : "hover:bg-accent"}`}>
                Recto
              </button>
              <button onClick={() => setFace("verso")}
                className={`flex-1 rounded-xl border py-2 text-xs font-medium ${face === "verso" ? "bg-classroom text-white border-classroom" : "hover:bg-accent"}`}>
                Verso
              </button>
            </div>
            <button onClick={() => printCard(currentRecto, currentVerso)}
              className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
              <Printer size={14} /> Imprimer
            </button>
            <button onClick={() => downloadPdf(face === "recto" ? currentRecto : currentVerso, `carte-${template.id}-${face}.html`)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-accent">
              <Download size={14} /> Télécharger PDF
            </button>
            <button onClick={() => cardHtmlToPng(face === "recto" ? currentRecto : currentVerso, `carte-${template.id}-${face}.png`)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-accent">
              <ImageIcon size={14} /> Télécharger PNG
            </button>
            {isBulk && (
              <>
                <button onClick={() => downloadBulkZip(bulk, template.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-accent">
                  <Package size={14} /> Télécharger ZIP ({bulk.length} cartes)
                </button>
                <button onClick={() => printAllCards(bulk)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-accent">
                  <Printer size={14} /> Imprimer toutes ({bulk.length})
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right: preview */}
      <div className="flex flex-1 flex-col min-h-0 bg-gray-50 dark:bg-gray-950">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">Aperçu — {face === "recto" ? "Recto" : "Verso"}</span>
          {isBulk && <span className="text-xs text-muted-foreground">{viewIdx + 1} / {bulk.length}</span>}
          {displayCard && (
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {isBulk ? `${bulk.length} cartes prêtes` : "Carte générée"}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Génération en cours…</p>
            </div>
          ) : displayCard ? (
            <>
              <div className="flex flex-col items-center gap-4">
                {face === "recto"
                  ? <CardFace html={currentRecto} label="RECTO" />
                  : <CardFace html={currentVerso} label="VERSO" />}
              </div>
              {isBulk && (
                <div className="flex flex-wrap justify-center gap-3 max-w-4xl">
                  {bulk.slice(0, 6).map((c, i) => (
                    <button key={c.id} onClick={() => setViewIdx(i)}
                      className={`rounded-xl p-1.5 transition-all ${viewIdx === i ? "ring-2 ring-classroom" : "opacity-60 hover:opacity-100"}`}>
                      <CardFace html={face === "recto" ? c.recto : c.verso} label={c.name.split(" ")[0]} />
                    </button>
                  ))}
                  {bulk.length > 6 && (
                    <div className="flex items-center justify-center text-sm text-muted-foreground">
                      +{bulk.length - 6} autres
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
              <CreditCard size={64} />
              <p className="text-sm font-medium text-muted-foreground">Aperçu de la carte</p>
              <p className="text-xs text-muted-foreground/60">Sélectionnez un ou plusieurs étudiants et cliquez Générer</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Template gallery ───────────────────────────────────────────────────────────

function TemplateThumbnail({ t, onClick }: { t: CardTemplate; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-elegant hover:border-classroom hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-classroom/30">
      {/* Visual thumbnail */}
      <div className="relative h-36 w-full overflow-hidden"
        style={{ background: t.thumbnail.startsWith("#") ? t.thumbnail : undefined, backgroundImage: t.thumbnail.startsWith("linear") ? t.thumbnail : undefined }}>
        {/* Mini card outline overlay */}
        <div className="absolute inset-4 rounded-xl border-2 border-white/20 flex items-center justify-center">
          <CreditCard className="h-8 w-8 text-white/60" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
          <div className="flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-800">
            <ZoomIn size={12} /> Utiliser ce modèle
          </div>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold group-hover:text-classroom transition-colors">{t.name}</h3>
        <p className="text-xs text-muted-foreground mt-1">Recto + Verso · CR80</p>
      </div>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function CardsPage() {
  const { user, ready } = useRequireClassroom();
  const templates = useCardTemplates();
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<CardTemplate | null>(null);

  if (!ready || !user) {
    return <div className="grid min-h-96 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (selected) {
    return (
      <div className="-m-4 lg:-m-6 h-[calc(100vh-3.5rem)]">
        <CardDesigner template={selected} onClose={() => setSelected(null)} />
      </div>
    );
  }

  const all = templates.data ?? [];
  const filtered = all.filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Cartes Étudiantes</h1>
          <p className="text-muted-foreground">Bibliothèque de modèles CR80 — génération individuelle et en masse.</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
          <CreditCard size={15} /> {all.length} modèle{all.length !== 1 ? "s" : ""} disponible{all.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" placeholder="Rechercher un modèle…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border bg-card pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom shadow-elegant" />
        {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={14} /></button>}
      </div>

      {/* Gallery */}
      {templates.isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t) => (
            <TemplateThumbnail key={t.id} t={t} onClick={() => setSelected(t)} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-muted-foreground">Aucun modèle trouvé.</p>
          )}
        </div>
      )}

      {/* Feature highlights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: CreditCard, label: "8 modèles premium", desc: "Designs professionnels" },
          { icon: RefreshCw,  label: "Recto + Verso",     desc: "Deux faces par carte" },
          { icon: Download,   label: "PDF / PNG / ZIP",   desc: "Exports haute résolution" },
          { icon: Users,      label: "Génération en lot", desc: "Toute une promo d'un clic" },
        ].map(({ icon: I, label, desc }) => (
          <div key={label} className="rounded-2xl border bg-card p-4 flex items-center gap-3 shadow-elegant">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl grad-classroom">
              <I className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
