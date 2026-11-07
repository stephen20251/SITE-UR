import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Stage, Layer, Rect, Text, Circle, Line, Image as KImage, Transformer, Group } from "react-konva";
import type Konva from "konva";
import {
  Plus, Save, Trash2, Copy, ChevronDown, X, Loader2, ZoomIn, ZoomOut,
  Type, Square, Circle as CircleIcon, Image, QrCode, AlignLeft, AlignCenter,
  AlignRight, Bold, Italic, Minus, RotateCcw, RotateCw, Eye, EyeOff, Layers,
  FileText, CreditCard, GraduationCap, ArrowLeft, Download, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useRequireClassroom } from "@/components/classroom/shared";

export const Route = createFileRoute("/classroom/designer")({ component: DesignerPage });

// ── Types ──────────────────────────────────────────────────────────────────────

type DocType = "STUDENT_CARD" | "TEACHER_CARD" | "STAFF_CARD" | "VISITOR_BADGE" |
  "CERTIFICATE" | "ATTESTATION" | "BULLETIN" | "DIPLOMA" | "CONVOCATION" |
  "MISSION_ORDER" | "ADMIN_LETTER";

type ElementType = "RECT" | "CIRCLE" | "TEXT" | "IMAGE" | "LINE" | "QRCODE";

type CanvasElement = {
  id: string;
  type: ElementType;
  x: number; y: number; width: number; height: number;
  rotation: number; opacity: number;
  // Shape
  fill?: string; stroke?: string; strokeWidth?: number; cornerRadius?: number;
  // Text
  text?: string; fontSize?: number; fontFamily?: string; fontStyle?: string;
  align?: string; lineHeight?: number;
  // Image / variable
  src?: string; variable?: string; objectFit?: "fill" | "contain" | "cover";
  // Shadow
  shadowColor?: string; shadowBlur?: number;
  // Visibility
  visible?: boolean;
  // Name in layers panel
  label?: string;
};

type Template = {
  id: string; name: string; type: DocType; description?: string;
  canvasData: CanvasElement[]; canvasWidth: number; canvasHeight: number;
  version: number; isDefault: boolean;
  createdAt: string; updatedAt: string;
};

type TemplateListItem = Omit<Template, "canvasData">;

// ── Constants ──────────────────────────────────────────────────────────────────

const DOC_TYPES: { value: DocType; label: string; icon: React.ReactNode; w: number; h: number }[] = [
  { value: "STUDENT_CARD",   label: "Carte étudiant",   icon: <GraduationCap size={13}/>, w: 638, h: 408 },
  { value: "TEACHER_CARD",   label: "Carte enseignant", icon: <CreditCard size={13}/>,    w: 638, h: 408 },
  { value: "STAFF_CARD",     label: "Carte personnel",  icon: <CreditCard size={13}/>,    w: 638, h: 408 },
  { value: "VISITOR_BADGE",  label: "Badge visiteur",   icon: <CreditCard size={13}/>,    w: 408, h: 638 },
  { value: "CERTIFICATE",    label: "Certificat",       icon: <FileText size={13}/>,      w: 794, h: 1123 },
  { value: "ATTESTATION",    label: "Attestation",      icon: <FileText size={13}/>,      w: 794, h: 1123 },
  { value: "BULLETIN",       label: "Bulletin",         icon: <FileText size={13}/>,      w: 794, h: 1123 },
  { value: "DIPLOMA",        label: "Diplôme",          icon: <GraduationCap size={13}/>, w: 1123, h: 794 },
  { value: "CONVOCATION",    label: "Convocation",      icon: <FileText size={13}/>,      w: 794, h: 1123 },
  { value: "MISSION_ORDER",  label: "Ordre de mission", icon: <FileText size={13}/>,      w: 794, h: 1123 },
  { value: "ADMIN_LETTER",   label: "Lettre admin",     icon: <FileText size={13}/>,      w: 794, h: 1123 },
];

const VARIABLES = [
  { group: "Étudiant",     vars: ["{{student.full_name}}", "{{student.first_name}}", "{{student.last_name}}", "{{student.matricule}}", "{{student.photo}}", "{{student.promotion}}", "{{student.mention}}", "{{student.parcours}}", "{{student.year}}"] },
  { group: "Enseignant",   vars: ["{{teacher.full_name}}", "{{teacher.first_name}}", "{{teacher.last_name}}", "{{teacher.photo}}", "{{teacher.specialization}}", "{{teacher.grade}}", "{{teacher.employee_id}}"] },
  { group: "Personnel",    vars: ["{{staff.full_name}}", "{{staff.first_name}}", "{{staff.last_name}}", "{{staff.photo}}", "{{staff.position}}", "{{staff.department}}", "{{staff.employee_id}}"] },
  { group: "Institution",  vars: ["{{school.name}}", "{{school.short_name}}", "{{school.sigle}}", "{{school.address}}", "{{school.city}}", "{{school.phone}}", "{{school.email}}", "{{school.website}}", "{{school.logo}}", "{{school.stamp}}", "{{school.signature}}", "{{school.watermark}}", "{{school.primary_color}}", "{{school.accent_color}}"] },
  { group: "Divers",       vars: ["{{current_date}}", "{{current_year}}", "{{academic_year}}", "{{semester}}", "{{qr_code}}", "{{document_number}}"] },
];

const FONT_FAMILIES = ["Arial", "Times New Roman", "Georgia", "Helvetica", "Calibri", "Garamond", "Verdana", "Courier New"];

function uid() { return Math.random().toString(36).slice(2, 10); }

function docLabel(type: DocType): string { return DOC_TYPES.find(d => d.value === type)?.label ?? type; }
function docDims(type: DocType) { const d = DOC_TYPES.find(x => x.value === type); return { w: d?.w ?? 638, h: d?.h ?? 408 }; }

// ── Starter templates ──────────────────────────────────────────────────────────

function buildStarterCard(): CanvasElement[] {
  return [
    { id: uid(), type: "RECT", x: 0, y: 0, width: 638, height: 408, rotation: 0, opacity: 1, fill: "#1a365d", label: "Fond" },
    { id: uid(), type: "RECT", x: 0, y: 280, width: 638, height: 128, rotation: 0, opacity: 1, fill: "#FFD166", label: "Bande bas" },
    { id: uid(), type: "IMAGE", x: 20, y: 20, width: 80, height: 80, rotation: 0, opacity: 1, variable: "{{school.logo}}", label: "Logo université" },
    { id: uid(), type: "TEXT", x: 110, y: 22, width: 510, height: 30, rotation: 0, opacity: 1, text: "{{school.name}}", fontSize: 16, fontFamily: "Arial", fontStyle: "bold", fill: "#ffffff", align: "left", label: "Nom université" },
    { id: uid(), type: "TEXT", x: 110, y: 56, width: 510, height: 22, rotation: 0, opacity: 1, text: "Carte Étudiant", fontSize: 13, fontFamily: "Arial", fill: "#FFD166", align: "left", label: "Type carte" },
    { id: uid(), type: "RECT", x: 20, y: 120, width: 110, height: 140, rotation: 0, opacity: 1, fill: "#e5e7eb", cornerRadius: 8, label: "Cadre photo" },
    { id: uid(), type: "IMAGE", x: 20, y: 120, width: 110, height: 140, rotation: 0, opacity: 1, variable: "{{student.photo}}", label: "Photo étudiant" },
    { id: uid(), type: "TEXT", x: 148, y: 128, width: 470, height: 36, rotation: 0, opacity: 1, text: "{{student.full_name}}", fontSize: 22, fontFamily: "Arial", fontStyle: "bold", fill: "#ffffff", label: "Nom étudiant" },
    { id: uid(), type: "TEXT", x: 148, y: 172, width: 470, height: 22, rotation: 0, opacity: 1, text: "{{student.mention}}", fontSize: 14, fontFamily: "Arial", fill: "#e2e8f0", label: "Mention" },
    { id: uid(), type: "TEXT", x: 148, y: 200, width: 470, height: 22, rotation: 0, opacity: 1, text: "Promo {{student.promotion}} · {{student.year}}", fontSize: 13, fontFamily: "Arial", fill: "#94a3b8", label: "Promotion" },
    { id: uid(), type: "TEXT", x: 148, y: 228, width: 200, height: 22, rotation: 0, opacity: 1, text: "N° {{student.matricule}}", fontSize: 13, fontFamily: "Arial", fontStyle: "bold", fill: "#FFD166", label: "Matricule" },
    { id: uid(), type: "TEXT", x: 20, y: 288, width: 420, height: 40, rotation: 0, opacity: 1, text: "{{school.address}}", fontSize: 12, fontFamily: "Arial", fill: "#1a365d", label: "Adresse" },
    { id: uid(), type: "QRCODE", x: 558, y: 290, width: 70, height: 70, rotation: 0, opacity: 1, variable: "{{qr_code}}", label: "QR Code" },
  ];
}

// ── Image loader hook ──────────────────────────────────────────────────────────

const imgCache: Record<string, HTMLImageElement> = {};

function useKonvaImage(src?: string): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) { setImg(null); return; }
    if (imgCache[src]) { setImg(imgCache[src]); return; }
    const i = new window.Image();
    i.crossOrigin = "anonymous";
    i.src = src;
    i.onload = () => { imgCache[src] = i; setImg(i); };
    i.onerror = () => setImg(null);
  }, [src]);
  return img;
}

// ── Canvas element components ──────────────────────────────────────────────────

function ElementImage({ el, onSelect, onUpdate, isSelected }: {
  el: CanvasElement; onSelect: (id: string) => void;
  onUpdate: (updated: CanvasElement) => void; isSelected: boolean;
}) {
  const resolvedSrc = el.src && !el.variable ? el.src : undefined;
  const img = useKonvaImage(resolvedSrc);

  const commonProps = {
    id: el.id, x: el.x, y: el.y, rotation: el.rotation ?? 0,
    opacity: (el.visible === false ? 0 : 1) * (el.opacity ?? 1),
    draggable: true,
    onClick: () => onSelect(el.id),
    onTap: () => onSelect(el.id),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
      onUpdate({ ...el, x: Math.round(e.target.x()), y: Math.round(e.target.y()) }),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      onUpdate({ ...el, x: Math.round(node.x()), y: Math.round(node.y()),
        width:  Math.round(Math.max(10, node.width()  * node.scaleX())),
        height: Math.round(Math.max(10, node.height() * node.scaleY())),
        rotation: Math.round(node.rotation()) });
      node.scaleX(1); node.scaleY(1);
    },
  };

  if (img) return <KImage {...commonProps} image={img} width={el.width} height={el.height} />;

  // Placeholder for variables / missing images
  return (
    <Group {...commonProps}>
      <Rect width={el.width} height={el.height} fill={el.variable?.includes("photo") ? "#94a3b8" : "#dbeafe"} cornerRadius={el.variable?.includes("photo") ? 6 : 0} />
      <Text text={el.variable ? el.variable.replace(/\{\{|\}\}/g, "").split(".")[1] ?? "img" : "?"} x={0} y={el.height / 2 - 8} width={el.width} align="center" fontSize={12} fill="#64748b" />
    </Group>
  );
}

function CanvasEl({ el, onSelect, onUpdate }: {
  el: CanvasElement; onSelect: (id: string) => void;
  onUpdate: (updated: CanvasElement) => void;
}) {
  const commonProps = {
    id: el.id, x: el.x, y: el.y, rotation: el.rotation ?? 0,
    opacity: (el.visible === false ? 0 : 1) * (el.opacity ?? 1),
    draggable: true,
    onClick: () => onSelect(el.id),
    onTap: () => onSelect(el.id),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
      onUpdate({ ...el, x: Math.round(e.target.x()), y: Math.round(e.target.y()) }),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      onUpdate({ ...el, x: Math.round(node.x()), y: Math.round(node.y()),
        width:  Math.round(Math.max(10, node.width()  * node.scaleX())),
        height: Math.round(Math.max(10, node.height() * node.scaleY())),
        rotation: Math.round(node.rotation()) });
      node.scaleX(1); node.scaleY(1);
    },
  };

  if (el.type === "RECT") return (
    <Rect {...commonProps} width={el.width} height={el.height}
      fill={el.fill ?? "#e5e7eb"} stroke={el.stroke} strokeWidth={el.strokeWidth ?? 0}
      cornerRadius={el.cornerRadius ?? 0}
      shadowColor={el.shadowColor} shadowBlur={el.shadowBlur ?? 0} />
  );

  if (el.type === "CIRCLE") return (
    <Circle {...commonProps} radius={(el.width ?? 60) / 2}
      fill={el.fill ?? "#e5e7eb"} stroke={el.stroke} strokeWidth={el.strokeWidth ?? 0} />
  );

  if (el.type === "TEXT") return (
    <Text {...commonProps} width={el.width} height={el.height}
      text={el.text ?? "Texte"} fontSize={el.fontSize ?? 14}
      fontFamily={el.fontFamily ?? "Arial"} fontStyle={el.fontStyle ?? "normal"}
      fill={el.fill ?? "#000000"} align={(el.align as "left" | "center" | "right") ?? "left"}
      lineHeight={el.lineHeight ?? 1.2} />
  );

  if (el.type === "LINE") return (
    <Line {...commonProps}
      points={[0, 0, el.width, 0]}
      stroke={el.stroke ?? "#64748b"} strokeWidth={el.strokeWidth ?? 2} />
  );

  if (el.type === "QRCODE") return (
    <Group {...commonProps}>
      <Rect width={el.width} height={el.height} fill="#ffffff" stroke="#e5e7eb" strokeWidth={1} />
      <Text text="QR" x={0} y={el.height / 2 - 10} width={el.width} align="center" fontSize={16} fill="#64748b" fontStyle="bold" />
    </Group>
  );

  if (el.type === "IMAGE") return (
    <ElementImage el={el} onSelect={onSelect} onUpdate={onUpdate} isSelected={false} />
  );

  return null;
}

// ── Properties panel ───────────────────────────────────────────────────────────

function PropInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const pinput = "w-full rounded-lg border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-classroom";
const smallInput = "w-full rounded-lg border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-classroom";

function PropertiesPanel({ el, onChange, onDelete }: {
  el: CanvasElement | null;
  onChange: (updated: CanvasElement) => void;
  onDelete: () => void;
}) {
  const [varOpen, setVarOpen] = useState(false);

  if (!el) return (
    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-4">
      <Layers size={28} className="mb-2 opacity-30" />
      <p className="text-xs">Sélectionnez un élément pour modifier ses propriétés</p>
    </div>
  );

  const set = (k: keyof CanvasElement, v: unknown) => onChange({ ...el, [k]: v });
  const num = (v: string) => isNaN(Number(v)) ? 0 : Number(v);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{el.type}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => set("visible", !(el.visible ?? true))}
            className="rounded p-1 hover:bg-muted text-muted-foreground">
            {(el.visible ?? true) ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button onClick={onDelete}
            className="rounded p-1 hover:bg-red-50 text-red-500">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-4 text-sm">
        {/* Label */}
        <PropInput label="Nom">
          <input value={el.label ?? ""} onChange={e => set("label", e.target.value)} className={pinput} placeholder="Nom de l'élément" />
        </PropInput>

        {/* Position & Size */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Position & taille</p>
          <div className="grid grid-cols-2 gap-2">
            {[["X", "x"], ["Y", "y"]].map(([l, k]) => (
              <PropInput key={k} label={l}>
                <input type="number" value={el[k as "x"] ?? 0} onChange={e => set(k as "x", num(e.target.value))} className={smallInput} />
              </PropInput>
            ))}
            {el.type !== "LINE" && [["L", "width"], ["H", "height"]].map(([l, k]) => (
              <PropInput key={k} label={l}>
                <input type="number" value={el[k as "width"] ?? 0} onChange={e => set(k as "width", num(e.target.value))} className={smallInput} />
              </PropInput>
            ))}
            <PropInput label="Rotation">
              <input type="number" value={el.rotation ?? 0} onChange={e => set("rotation", num(e.target.value))} className={smallInput} />
            </PropInput>
            <PropInput label="Opacité %">
              <input type="number" min={0} max={100} value={Math.round((el.opacity ?? 1) * 100)} onChange={e => set("opacity", num(e.target.value) / 100)} className={smallInput} />
            </PropInput>
          </div>
        </div>

        {/* Couleurs */}
        {(el.type === "RECT" || el.type === "CIRCLE" || el.type === "TEXT") && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Couleurs</p>
            {(el.type === "RECT" || el.type === "CIRCLE") && (
              <PropInput label="Remplissage">
                <div className="flex items-center gap-2">
                  <input type="color" value={el.fill ?? "#e5e7eb"} onChange={e => set("fill", e.target.value)} className="h-8 w-10 cursor-pointer rounded border" />
                  <input value={el.fill ?? "#e5e7eb"} onChange={e => set("fill", e.target.value)} className={pinput} />
                </div>
              </PropInput>
            )}
            {el.type === "TEXT" && (
              <PropInput label="Couleur texte">
                <div className="flex items-center gap-2">
                  <input type="color" value={el.fill ?? "#000000"} onChange={e => set("fill", e.target.value)} className="h-8 w-10 cursor-pointer rounded border" />
                  <input value={el.fill ?? "#000000"} onChange={e => set("fill", e.target.value)} className={pinput} />
                </div>
              </PropInput>
            )}
            <PropInput label="Contour">
              <div className="flex items-center gap-2">
                <input type="color" value={el.stroke ?? "#000000"} onChange={e => set("stroke", e.target.value)} className="h-8 w-10 cursor-pointer rounded border" />
                <input type="number" min={0} value={el.strokeWidth ?? 0} onChange={e => set("strokeWidth", num(e.target.value))} className={pinput} placeholder="épaisseur" />
              </div>
            </PropInput>
            {el.type === "RECT" && (
              <PropInput label="Arrondi (px)">
                <input type="number" min={0} value={el.cornerRadius ?? 0} onChange={e => set("cornerRadius", num(e.target.value))} className={pinput} />
              </PropInput>
            )}
          </div>
        )}

        {/* Ligne */}
        {el.type === "LINE" && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Ligne</p>
            <PropInput label="Couleur">
              <div className="flex items-center gap-2">
                <input type="color" value={el.stroke ?? "#64748b"} onChange={e => set("stroke", e.target.value)} className="h-8 w-10 cursor-pointer rounded border" />
                <input type="number" min={1} value={el.strokeWidth ?? 2} onChange={e => set("strokeWidth", num(e.target.value))} className={pinput} placeholder="épaisseur" />
              </div>
            </PropInput>
            <PropInput label="Longueur">
              <input type="number" value={el.width ?? 100} onChange={e => set("width", num(e.target.value))} className={pinput} />
            </PropInput>
          </div>
        )}

        {/* Texte */}
        {el.type === "TEXT" && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Texte</p>
            <PropInput label="Contenu">
              <textarea value={el.text ?? ""} onChange={e => set("text", e.target.value)}
                rows={3} className={pinput + " resize-none"} placeholder="Texte ou {{variable}}" />
            </PropInput>
            <div className="grid grid-cols-2 gap-2">
              <PropInput label="Police">
                <select value={el.fontFamily ?? "Arial"} onChange={e => set("fontFamily", e.target.value)} className={smallInput}>
                  {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </PropInput>
              <PropInput label="Taille">
                <input type="number" min={6} max={200} value={el.fontSize ?? 14} onChange={e => set("fontSize", num(e.target.value))} className={smallInput} />
              </PropInput>
            </div>
            <div className="flex gap-1">
              {(["normal","bold","italic","bold italic"] as const).map((s) => (
                <button key={s} onClick={() => set("fontStyle", s)}
                  className={`rounded px-2 py-1 text-xs border transition-colors ${el.fontStyle === s ? "bg-classroom text-white border-classroom" : "hover:bg-muted border-border"}`}>
                  {s === "bold" ? <Bold size={11}/> : s === "italic" ? <Italic size={11}/> : s === "normal" ? "A" : <span><Bold size={11}/><Italic size={11}/></span>}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {([["left","AlignLeft"],["center","AlignCenter"],["right","AlignRight"]] as const).map(([v, icon]) => (
                <button key={v} onClick={() => set("align", v)}
                  className={`rounded px-2 py-1 text-xs border transition-colors ${el.align === v ? "bg-classroom text-white border-classroom" : "hover:bg-muted border-border"}`}>
                  {icon === "AlignLeft" ? <AlignLeft size={11}/> : icon === "AlignCenter" ? <AlignCenter size={11}/> : <AlignRight size={11}/>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Image variable */}
        {(el.type === "IMAGE" || el.type === "QRCODE") && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Variable</p>
            <div className="relative">
              <button onClick={() => setVarOpen(!varOpen)}
                className="w-full rounded-lg border px-3 py-2 text-xs text-left flex items-center justify-between hover:bg-muted">
                <span className="text-classroom font-mono">{el.variable || "Choisir une variable…"}</span>
                <ChevronDown size={11} />
              </button>
              {varOpen && (
                <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-56 overflow-y-auto rounded-xl border bg-background shadow-xl">
                  {VARIABLES.map((g) => (
                    <div key={g.group}>
                      <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50">{g.group}</div>
                      {g.vars.filter(v => {
                        if (el.type === "QRCODE") return v === "{{qr_code}}";
                        if (el.type === "IMAGE") return v.includes("photo") || v.includes("logo") || v.includes("stamp") || v.includes("signature") || v.includes("watermark");
                        return false;
                      }).map(v => (
                        <button key={v} onClick={() => { set("variable", v); setVarOpen(false); }}
                          className="w-full px-3 py-1.5 text-xs text-left hover:bg-classroom/10 font-mono text-classroom">
                          {v}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Variables pour texte */}
        {el.type === "TEXT" && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Insérer une variable</p>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
              {VARIABLES.flatMap(g => g.vars.filter(v => !v.includes("photo") && !v.includes("logo") && !v.includes("stamp") && !v.includes("signature") && !v.includes("watermark"))).map(v => (
                <button key={v} onClick={() => set("text", (el.text ?? "") + v)}
                  className="rounded-full border bg-muted px-2 py-0.5 text-[10px] font-mono text-classroom hover:bg-classroom/10">
                  {v.replace(/\{\{|\}\}/g, "")}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Template list view ─────────────────────────────────────────────────────────

function TemplateList({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery<TemplateListItem[]>({
    queryKey: ["designer-templates"],
    queryFn: () => api<TemplateListItem[]>("/designer"),
    staleTime: 1000 * 60 * 5,
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/designer/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Modèle supprimé"); qc.invalidateQueries({ queryKey: ["designer-templates"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dupMut = useMutation<Template, Error, string>({
    mutationFn: (id) => api<Template>(`/designer/${id}/duplicate`, { method: "POST" }),
    onSuccess: (tpl) => { toast.success("Modèle dupliqué"); qc.invalidateQueries({ queryKey: ["designer-templates"] }); onOpen(tpl.id); },
    onError: (e) => toast.error(e.message),
  });

  const byType: Record<string, TemplateListItem[]> = {};
  for (const t of templates) { (byType[t.type] ??= []).push(t); }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Document Designer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Créez et personnalisez vos modèles de documents</p>
        </div>
        <button onClick={onNew}
          className="flex items-center gap-2 rounded-xl grad-classroom px-4 py-2.5 text-sm font-semibold text-white shadow-elegant">
          <Plus size={15} /> Nouveau modèle
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-muted-foreground">
          <FileText size={42} className="mb-3 opacity-20" />
          <p className="font-medium">Aucun modèle de document</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Créez votre premier modèle en cliquant sur "Nouveau modèle"</p>
          <button onClick={onNew} className="mt-4 flex items-center gap-2 rounded-xl grad-classroom px-4 py-2.5 text-sm font-semibold text-white">
            <Plus size={14} /> Démarrer
          </button>
        </div>
      ) : (
        Object.entries(byType).map(([type, items]) => (
          <div key={type}>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{docLabel(type as DocType)}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map(t => (
                <div key={t.id} className="group relative rounded-xl border bg-card shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer" onClick={() => onOpen(t.id)}>
                  <div className="h-28 bg-gradient-to-br from-muted/50 to-muted/20 flex items-center justify-center">
                    <div className="text-muted-foreground/20 text-4xl font-bold">{t.name.charAt(0)}</div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{docLabel(t.type)} · v{t.version}</p>
                  </div>
                  <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1">
                    <button onClick={e => { e.stopPropagation(); dupMut.mutate(t.id); }}
                      className="rounded-lg border bg-background p-1.5 text-muted-foreground hover:text-classroom shadow-sm">
                      <Copy size={12} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); if (confirm("Supprimer ce modèle ?")) deleteMut.mutate(t.id); }}
                      className="rounded-lg border bg-background p-1.5 text-muted-foreground hover:text-red-600 shadow-sm">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {t.isDefault && <span className="absolute top-2 left-2 rounded-full bg-classroom px-2 py-0.5 text-[10px] font-bold text-white">Défaut</span>}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── New template modal ─────────────────────────────────────────────────────────

function NewTemplateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (id: string) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<DocType>("STUDENT_CARD");
  const [useStarter, setUseStarter] = useState(true);
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!name.trim()) { toast.error("Nom requis"); return; }
    setSaving(true);
    try {
      const dims = docDims(type);
      const canvasData = useStarter && type === "STUDENT_CARD" ? buildStarterCard() : [];
      const tpl = await api<Template>("/designer", {
        method: "POST",
        body: { name, type, canvasData, canvasWidth: dims.w, canvasHeight: dims.h },
      });
      toast.success("Modèle créé");
      qc.invalidateQueries({ queryKey: ["designer-templates"] });
      onCreate(tpl.id);
    } catch (e: unknown) { toast.error((e as Error).message); setSaving(false); }
  }

  const dims = docDims(type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold text-lg">Nouveau modèle</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nom du modèle *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && create()}
              placeholder="Ex : Carte étudiant 2025-2026" className={pinput} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type de document *</label>
            <div className="relative">
              <select value={type} onChange={e => setType(e.target.value as DocType)} className={pinput + " appearance-none pr-8"}>
                {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label} ({d.w}×{d.h}px)</option>)}
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3 text-gray-400" />
            </div>
          </div>
          <div className="rounded-xl bg-muted/30 border px-4 py-3 text-xs text-muted-foreground">
            Canvas : {dims.w} × {dims.h} px — {dims.w > dims.h ? "Paysage" : dims.w < dims.h ? "Portrait" : "Carré"}
          </div>
          {type === "STUDENT_CARD" && (
            <label className="flex items-center gap-3 cursor-pointer rounded-xl border p-3 hover:bg-muted/30">
              <input type="checkbox" checked={useStarter} onChange={e => setUseStarter(e.target.checked)}
                className="h-4 w-4 accent-classroom" />
              <div>
                <p className="text-sm font-medium">Démarrer avec un modèle de base</p>
                <p className="text-xs text-muted-foreground">Carte étudiant avec logo, photo, nom, matricule, QR code</p>
              </div>
            </label>
          )}
        </div>
        <div className="flex gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Annuler</button>
          <button onClick={create} disabled={saving}
            className="flex-1 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Créer et ouvrir l'éditeur
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN DESIGNER EDITOR ───────────────────────────────────────────────────────

function DesignerEditor({ templateId, onBack }: { templateId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const stageRef  = useRef<Konva.Stage>(null);
  const trRef     = useRef<Konva.Transformer>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: tplRaw, isLoading } = useQuery<Template>({
    queryKey: ["designer-tpl", templateId],
    queryFn: () => api<Template>(`/designer/${templateId}`),
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.8);
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [panelTab, setPanelTab] = useState<"library" | "layers" | "variables">("library");

  // Load canvas data when template loads
  useEffect(() => {
    if (tplRaw) {
      const data = Array.isArray(tplRaw.canvasData) ? tplRaw.canvasData as CanvasElement[] : [];
      setElements(data);
      setHistory([data]);
      setHistIdx(0);
      setDirty(false);
    }
  }, [tplRaw]);

  // Update Transformer when selection changes
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    if (selectedId) {
      const node = stageRef.current.findOne(`#${selectedId}`);
      if (node) trRef.current.nodes([node]);
      else trRef.current.nodes([]);
    } else {
      trRef.current.nodes([]);
    }
    trRef.current.getLayer()?.batchDraw();
  }, [selectedId, elements]);

  const pushHistory = useCallback((els: CanvasElement[]) => {
    setHistory(h => { const next = [...h.slice(0, histIdx + 1), els]; setHistIdx(next.length - 1); return next; });
    setDirty(true);
  }, [histIdx]);

  const undo = () => {
    if (histIdx <= 0) return;
    const prev = history[histIdx - 1];
    setElements(prev); setHistIdx(histIdx - 1); setDirty(true);
  };
  const redo = () => {
    if (histIdx >= history.length - 1) return;
    const next = history[histIdx + 1];
    setElements(next); setHistIdx(histIdx + 1); setDirty(true);
  };

  const updateElement = useCallback((updated: CanvasElement) => {
    setElements(els => {
      const next = els.map(e => e.id === updated.id ? updated : e);
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setElements(els => { const next = els.filter(e => e.id !== selectedId); pushHistory(next); return next; });
    setSelectedId(null);
  }, [selectedId, pushHistory]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return;
    setElements(els => {
      const src = els.find(e => e.id === selectedId);
      if (!src) return els;
      const copy = { ...src, id: uid(), x: src.x + 20, y: src.y + 20 };
      const next = [...els, copy];
      pushHistory(next);
      setSelectedId(copy.id);
      return next;
    });
  }, [selectedId, pushHistory]);

  function addElement(type: ElementType) {
    const cw = tplRaw?.canvasWidth ?? 638;
    const ch = tplRaw?.canvasHeight ?? 408;
    const defaults: Partial<CanvasElement> = {
      RECT:   { width: 120, height: 80, fill: "#e5e7eb", cornerRadius: 0 },
      CIRCLE: { width: 80, height: 80, fill: "#e5e7eb" },
      TEXT:   { width: 200, height: 30, text: "Texte", fontSize: 16, fontFamily: "Arial", fill: "#000000", align: "left" },
      LINE:   { width: 200, height: 2, stroke: "#64748b", strokeWidth: 2 },
      IMAGE:  { width: 80, height: 80, variable: "{{school.logo}}" },
      QRCODE: { width: 80, height: 80, variable: "{{qr_code}}" },
    }[type] ?? {};
    const el: CanvasElement = {
      id: uid(), type, label: type.toLowerCase(),
      x: Math.round(cw / 2 - 60), y: Math.round(ch / 2 - 40),
      width: 100, height: 60,
      rotation: 0, opacity: 1, visible: true,
      ...defaults,
    };
    setElements(els => { const next = [...els, el]; pushHistory(next); return next; });
    setSelectedId(el.id);
  }

  async function save() {
    setSaving(true);
    try {
      await api(`/designer/${templateId}`, { method: "PUT", body: { canvasData: elements } });
      toast.success("Modèle enregistré");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["designer-tpl", templateId] });
      qc.invalidateQueries({ queryKey: ["designer-templates"] });
    } catch (e: unknown) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function exportPDF() {
    if (!stageRef.current || !tplRaw) return;
    const { jsPDF } = await import("jspdf");
    const cardTypes = ["STUDENT_CARD", "TEACHER_CARD", "STAFF_CARD", "VISITOR_BADGE"];
    const isCard = cardTypes.includes(tplRaw.type);
    const isLandscape = cw >= ch;
    const wMm = isCard ? (isLandscape ? 85.6 : 54) : (isLandscape ? 297 : 210);
    const hMm = isCard ? (isLandscape ? 54 : 85.6) : (isLandscape ? 210 : 297);
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 3, mimeType: "image/png" });
    const pdf = new jsPDF({ orientation: isLandscape ? "landscape" : "portrait", unit: "mm", format: [wMm, hMm] });
    pdf.addImage(dataUrl, "PNG", 0, 0, wMm, hMm);
    pdf.save(`${tplRaw.name.replace(/\s+/g, "_")}.pdf`);
    toast.success("PDF téléchargé");
  }

  function printCanvas() {
    if (!stageRef.current) return;
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 3 });
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${tplRaw?.name ?? "Modèle"}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#fff;}
      @media print{@page{margin:0;size:${cw > ch ? "landscape" : "portrait"}}img{width:100%;height:auto;page-break-inside:avoid;}}</style></head>
      <body><img src="${dataUrl}" /></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "d") { e.preventDefault(); duplicateSelected(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); }
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") { e.preventDefault(); deleteSelected(); }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, histIdx]);

  const cw = tplRaw?.canvasWidth ?? 638;
  const ch = tplRaw?.canvasHeight ?? 408;
  const selectedEl = elements.find(e => e.id === selectedId) ?? null;

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="flex h-full flex-col">
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div className="flex h-12 items-center gap-2 border-b bg-background px-3 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
          <ArrowLeft size={14} /> Modèles
        </button>
        <div className="h-4 w-px bg-border" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold truncate">{tplRaw?.name}</span>
          <span className="ml-2 text-xs text-muted-foreground">{docLabel(tplRaw?.type ?? "STUDENT_CARD")} · {cw}×{ch}</span>
          {dirty && <span className="ml-2 text-xs text-amber-500">● non sauvegardé</span>}
        </div>
        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} className="rounded p-1.5 hover:bg-muted"><ZoomOut size={13} /></button>
          <span className="w-12 text-center text-xs font-mono">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="rounded p-1.5 hover:bg-muted"><ZoomIn size={13} /></button>
          <button onClick={() => setZoom(0.8)} className="rounded px-2 py-1 text-xs hover:bg-muted text-muted-foreground">Ajuster</button>
        </div>
        <div className="h-4 w-px bg-border" />
        {/* Undo/Redo */}
        <button onClick={undo} disabled={histIdx <= 0} className="rounded p-1.5 hover:bg-muted disabled:opacity-30"><RotateCcw size={13} /></button>
        <button onClick={redo} disabled={histIdx >= history.length - 1} className="rounded p-1.5 hover:bg-muted disabled:opacity-30"><RotateCw size={13} /></button>
        {selectedId && (
          <>
            <button onClick={duplicateSelected} className="rounded p-1.5 hover:bg-muted"><Copy size={13} /></button>
            <button onClick={deleteSelected} className="rounded p-1.5 hover:bg-red-50 text-red-500"><Trash2 size={13} /></button>
          </>
        )}
        <div className="h-4 w-px bg-border" />
        <button onClick={save} disabled={saving || !dirty}
          className="flex items-center gap-1.5 rounded-lg grad-classroom px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Enregistrer
        </button>
        <button onClick={exportPDF}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
          <Download size={12} /> PDF
        </button>
        <button onClick={printCanvas}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
          <FileText size={12} /> Imprimer
        </button>
      </div>

      {/* ── Three-panel workspace ─────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left: Library / Layers ─────────────────────────── */}
        <div className="flex w-48 flex-col border-r bg-background shrink-0">
          {/* Panel tabs */}
          <div className="flex border-b text-[11px] font-semibold shrink-0">
            {(["library","layers","variables"] as const).map(t => (
              <button key={t} onClick={() => setPanelTab(t)}
                className={`flex-1 py-2 transition-colors ${panelTab === t ? "border-b-2 border-classroom text-classroom" : "text-muted-foreground hover:text-foreground"}`}>
                {t === "library" ? "Lib." : t === "layers" ? "Calques" : "Vars."}
              </button>
            ))}
          </div>

          {panelTab === "library" && (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <p className="px-1 py-1 text-[10px] font-bold text-muted-foreground uppercase">Formes</p>
              {[
                { type: "RECT" as ElementType, label: "Rectangle", icon: <Square size={14}/> },
                { type: "CIRCLE" as ElementType, label: "Cercle",    icon: <CircleIcon size={14}/> },
                { type: "LINE" as ElementType,   label: "Ligne",     icon: <Minus size={14}/> },
              ].map(({ type, label, icon }) => (
                <button key={type} onClick={() => addElement(type)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-muted transition-colors">
                  {icon}{label}
                </button>
              ))}
              <p className="px-1 py-1 text-[10px] font-bold text-muted-foreground uppercase mt-2">Contenu</p>
              {[
                { type: "TEXT" as ElementType,   label: "Texte",     icon: <Type size={14}/> },
                { type: "IMAGE" as ElementType,  label: "Image",     icon: <Image size={14}/> },
                { type: "QRCODE" as ElementType, label: "QR Code",   icon: <QrCode size={14}/> },
              ].map(({ type, label, icon }) => (
                <button key={type} onClick={() => addElement(type)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-muted transition-colors">
                  {icon}{label}
                </button>
              ))}
            </div>
          )}

          {panelTab === "layers" && (
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {[...elements].reverse().map((el, i) => (
                <button key={el.id} onClick={() => setSelectedId(el.id === selectedId ? null : el.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${el.id === selectedId ? "bg-classroom/10 text-classroom" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>
                  <span className="text-[10px] text-muted-foreground w-4">{elements.length - i}</span>
                  <span className="flex-1 truncate text-left">{el.label ?? el.type}</span>
                  <button onClick={e => { e.stopPropagation(); updateElement({ ...el, visible: !(el.visible ?? true) }); }}
                    className="text-muted-foreground hover:text-foreground">
                    {(el.visible ?? true) ? <Eye size={11}/> : <EyeOff size={11}/>}
                  </button>
                </button>
              ))}
            </div>
          )}

          {panelTab === "variables" && (
            <div className="flex-1 overflow-y-auto p-2">
              {VARIABLES.map(g => (
                <div key={g.group} className="mb-3">
                  <p className="mb-1 text-[10px] font-bold text-muted-foreground uppercase">{g.group}</p>
                  {g.vars.map(v => (
                    <button key={v} onClick={() => { if (selectedEl?.type === "TEXT") updateElement({ ...selectedEl!, text: (selectedEl.text ?? "") + v }); }}
                      className="mb-0.5 flex w-full items-center gap-1 rounded px-2 py-1 text-[10px] font-mono text-classroom hover:bg-classroom/10 text-left">
                      {v}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Center: Canvas ────────────────────────────────────── */}
        <div ref={containerRef}
          className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center min-h-0"
          style={{ padding: "40px" }}
          onClick={e => { if ((e.target as HTMLElement).closest("canvas") === null && e.target === containerRef.current) setSelectedId(null); }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}>
            {/* Canvas shadow/border */}
            <div className="relative" style={{ width: cw, height: ch, boxShadow: "0 4px 32px rgba(0,0,0,0.18)" }}>
              <Stage ref={stageRef} width={cw} height={ch}
                onMouseDown={e => { if (e.target === e.target.getStage()) setSelectedId(null); }}>
                <Layer>
                  {/* White base */}
                  <Rect x={0} y={0} width={cw} height={ch} fill="white" />
                  {/* All elements */}
                  {elements.map(el => (
                    <CanvasEl key={el.id} el={el} onSelect={setSelectedId} onUpdate={updateElement} />
                  ))}
                  {/* Transformer */}
                  <Transformer ref={trRef}
                    rotateEnabled={true} keepRatio={false}
                    boundBoxFunc={(_, newBox) => ({ ...newBox, width: Math.max(5, newBox.width), height: Math.max(5, newBox.height) })}
                  />
                </Layer>
              </Stage>
            </div>
          </div>
        </div>

        {/* ── Right: Properties ─────────────────────────────────── */}
        <div className="flex w-56 flex-col border-l bg-background shrink-0 min-h-0 overflow-hidden">
          <PropertiesPanel
            el={selectedEl}
            onChange={updateElement}
            onDelete={deleteSelected}
          />
        </div>
      </div>
    </div>
  );
}

// ── Router page (toggles between list and editor) ──────────────────────────────

function DesignerPage() {
  const { user, ready } = useRequireClassroom(["SUPER_ADMIN"]);
  const [view, setView] = useState<"list" | "new" | "edit">("list");
  const [editId, setEditId] = useState<string | null>(null);

  if (!ready || !user) return null;

  if (view === "edit" && editId) {
    return (
      <div className="flex flex-col h-full -m-4 lg:-m-6">
        <DesignerEditor templateId={editId} onBack={() => setView("list")} />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      {view === "new" && (
        <NewTemplateModal
          onClose={() => setView("list")}
          onCreate={id => { setEditId(id); setView("edit"); }}
        />
      )}
      <TemplateList
        onOpen={id => { setEditId(id); setView("edit"); }}
        onNew={() => setView("new")}
      />
    </div>
  );
}
