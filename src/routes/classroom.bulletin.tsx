import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, FileText, CheckCircle, XCircle, Printer, Download,
  GraduationCap, Users, ListChecks, ChevronDown, AlertTriangle,
  ArrowLeft, CheckSquare, Square, BookOpen, TrendingUp, Package,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { CONTACT } from "@/lib/contact";
import { useRequireClassroom } from "@/components/classroom/shared";
import { useBulletin, useSemesters, type BulletinData } from "@/lib/classroom";
import { API_ORIGIN } from "@/lib/env";

export const Route = createFileRoute("/classroom/bulletin")({ component: BulletinPage });

// ── Types ──────────────────────────────────────────────────────────────────────

type AcYear   = { id: string; label?: string; name?: string };
type Semester = { id: string; name: string; endDate?: string; isActive?: boolean; academicYear?: { id?: string; label?: string; name?: string } | null };
type Mention  = { id: string; name: string };
type Promo    = { id: string; name: string; level: string };
type Group    = { id: string; name: string; _count?: { students: number } };
type Student  = { id: string; matricule: string | null; user: { firstName: string; lastName: string }; group?: { name: string } | null };

// ── Data hooks ─────────────────────────────────────────────────────────────────

const useAcYears  = () => useQuery({ queryKey: ["structure","academic-years"], queryFn: () => api<AcYear[]>("/structure/academic-years") });
const useMentions = () => useQuery({ queryKey: ["structure","mentions"],       queryFn: () => api<Mention[]>("/structure/mentions") });

function usePromos(p: { mentionId?: string; academicYearId?: string }) {
  const qs = new URLSearchParams();
  if (p.mentionId)      qs.set("mentionId", p.mentionId);
  if (p.academicYearId) qs.set("academicYearId", p.academicYearId);
  return useQuery({ queryKey: ["structure","promotions",p], queryFn: () => api<Promo[]>(`/structure/promotions?${qs}`), enabled: !!(p.mentionId || p.academicYearId) });
}
function useGroups(promId?: string) {
  return useQuery({ queryKey: ["structure","groups",promId], queryFn: () => api<Group[]>(`/structure/promotions/${promId}/groups`), enabled: !!promId });
}
function useStudents(p: { promotionId?: string; groupId?: string }) {
  const qs = new URLSearchParams();
  if (p.promotionId) qs.set("promotionId", p.promotionId);
  if (p.groupId)     qs.set("groupId", p.groupId);
  return useQuery({ queryKey: ["docs","students",p], queryFn: () => api<Student[]>(`/documents/students?${qs}`), enabled: !!p.promotionId });
}

// ── Shared select ──────────────────────────────────────────────────────────────

function Sel({ label, value, onChange, options, disabled, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          className="w-full appearance-none rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-classroom disabled:opacity-40 disabled:cursor-not-allowed">
          <option value="">{placeholder ?? `— ${label} —`}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground" />
      </div>
      {hint && <p className="mt-1 text-[10px] text-amber-600">{hint}</p>}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ icon: I, title, sub }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <I size={36} className="text-muted-foreground/30" />
      <p className="font-medium text-sm text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/60">{sub}</p>
    </div>
  );
}

// ── HTML bulletin generator ────────────────────────────────────────────────────

function generateBulletinHtml(data: BulletinData, semesterLabel: string): string {
  const studentName = `${data.student.user.lastName.toUpperCase()} ${data.student.user.firstName}`;
  const mention   = data.student.mention?.name ?? "—";
  const promotion = data.student.promotion?.name ?? "—";
  const level     = data.student.promotion?.level ?? "—";
  const { gpa, totalCredits, earnedCredits, passed } = data.summary;

  const rows = data.results.map((r) => {
    const avg  = r.average;
    const ment = avg >= 16 ? "Très Bien" : avg >= 14 ? "Bien" : avg >= 12 ? "Assez Bien" : avg >= 10 ? "Passable" : "Insuffisant";
    const ok   = avg >= 10;
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${r.subject.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-family:monospace;font-size:11pt;">${r.subject.code}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.subject.credits}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:700;color:${ok ? "#059669" : "#DC2626"};">${avg.toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${ment}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:14pt;color:${ok ? "#059669" : "#DC2626"};">${ok ? "✓" : "✗"}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Bulletin — ${studentName}</title>
<style>
@page{size:A4;margin:18mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Times New Roman',serif;font-size:12pt;color:#1a1a1a;background:#fff}
.header{display:flex;align-items:center;gap:20px;border-bottom:3px solid #1a365d;padding-bottom:16px;margin-bottom:20px}
.logo{width:72px;height:72px;background:#1a365d;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9pt;font-weight:bold;text-align:center;padding:6px}
.uni{color:#1a365d;font-size:17pt;font-weight:bold}
.doc-title{font-size:15pt;text-align:center;font-weight:bold;color:#1a365d;margin:18px 0;text-transform:uppercase;letter-spacing:2px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:18px;border:1px solid #e0e0e0;border-radius:8px;padding:14px;background:#f8fafc}
.info-row{display:flex;gap:8px;font-size:11pt}
.info-label{font-weight:bold;color:#555;min-width:110px}
table{width:100%;border-collapse:collapse;margin-top:14px}
th{background:#1a365d;color:#fff;padding:9px 12px;text-align:left;font-size:10pt}
th:not(:first-child){text-align:center}
.summary{margin-top:20px;border:2px solid #1a365d;border-radius:8px;padding:14px}
.decision{font-size:19pt;font-weight:bold;color:${passed?"#059669":"#DC2626"};text-align:center;margin-top:6px}
.sig-row{display:flex;justify-content:space-between;margin-top:36px}
.sig-box{text-align:center}
.sig-line{width:150px;border-top:1px solid #333;margin:36px auto 4px}
.footer{margin-top:28px;border-top:1px solid #ddd;padding-top:6px;font-size:9pt;color:#888;text-align:center}
</style></head><body>
<div class="header">
  <div class="logo">UNIVERSITÉ DE RÉFÉRENCE</div>
  <div><div class="uni">Université de Référence</div><div style="color:#555;font-size:10pt">Direction des Affaires Académiques</div></div>
</div>
<div class="doc-title">Bulletin de Notes — ${semesterLabel}</div>
<div class="info-grid">
  <div class="info-row"><span class="info-label">Étudiant :</span><span>${studentName}</span></div>
  <div class="info-row"><span class="info-label">Matricule :</span><span style="font-family:monospace;font-weight:bold">${data.student.matricule ?? "—"}</span></div>
  <div class="info-row"><span class="info-label">Mention :</span><span>${mention}</span></div>
  <div class="info-row"><span class="info-label">Promotion :</span><span>${promotion}</span></div>
  <div class="info-row"><span class="info-label">Niveau :</span><span>${level}</span></div>
  <div class="info-row"><span class="info-label">Semestre :</span><span>${semesterLabel}</span></div>
</div>
<table>
  <thead><tr><th>Matière</th><th>Code</th><th>Crédits</th><th>Moyenne /20</th><th>Mention</th><th>Résultat</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="6" style="text-align:center;padding:20px;color:#888;">Aucune note saisie pour ce semestre</td></tr>`}</tbody>
</table>
<div class="summary">
  <div style="display:flex;gap:32px;justify-content:center;margin-bottom:6px">
    <span>Moyenne Générale : <strong>${gpa.toFixed(2)} / 20</strong></span>
    <span>Crédits obtenus : <strong>${earnedCredits} / ${totalCredits}</strong></span>
  </div>
  <div class="decision">${passed ? "ADMIS(E)" : "AJOURNÉ(E)"}</div>
</div>
<div class="sig-row">
  <div class="sig-box"><div class="sig-line"></div><div>Le Responsable Pédagogique</div></div>
  <div class="sig-box"><div class="sig-line"></div><div>Cachet universitaire</div></div>
</div>
<div class="footer">Université Références — ${CONTACT.address}, ${CONTACT.city} · ${CONTACT.phone} · ${CONTACT.email} · Document officiel</div>
</body></html>`;
}

function printBulletin(html: string) {
  const w = window.open("", "_blank");
  if (!w) { toast.error("Popup bloqué — autorisez les popups"); return; }
  w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400);
}

function downloadBulletin(html: string, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  a.download = filename; a.click();
}

// ── Bulk download (ZIP) ────────────────────────────────────────────────────────

async function generateBulkBulletins(ids: string[], semId: string, semLabel: string) {
  if (!ids.length) return;
  const BASE  = API_ORIGIN;
  const token = localStorage.getItem("us.accessToken") ?? "";
  toast.info(`Génération de ${ids.length} bulletin${ids.length !== 1 ? "s" : ""}…`);
  try {
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`${BASE}/api/grades/bulletin/${id}/${semId}`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.ok ? r.json() as Promise<BulletinData> : null)
          .catch(() => null)
      )
    );
    const valid = results.filter(Boolean) as BulletinData[];
    if (!valid.length) { toast.error("Aucun bulletin disponible"); return; }

    if (valid.length === 1) {
      const html = generateBulletinHtml(valid[0], semLabel);
      const nm = `${valid[0].student.user.lastName}_${valid[0].student.user.firstName}`;
      downloadBulletin(html, `bulletin_${nm}_${semLabel}.html`);
      return;
    }
    const JSZip = (await import("jszip")).default;
    const zip   = new JSZip();
    valid.forEach((bd) => {
      const html = generateBulletinHtml(bd, semLabel);
      const nm   = `${bd.student.user.lastName}_${bd.student.user.firstName}`.replace(/[^a-z0-9_]/gi, "_");
      zip.file(`bulletin_${nm}.html`, html);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `bulletins_${semLabel.replace(/\s/g, "_")}.zip`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${valid.length} bulletins téléchargés dans le ZIP`);
  } catch (e) { toast.error("Erreur : " + (e instanceof Error ? e.message : "")); }
}

// ── Single bulletin viewer ─────────────────────────────────────────────────────

function BulletinViewer({ studentId, semesterId, semLabel, onBack }: {
  studentId: string; semesterId: string; semLabel: string; onBack: () => void;
}) {
  const { data, isLoading, error } = useBulletin(studentId, semesterId);

  if (isLoading) return (
    <div className="flex flex-col items-center gap-3 py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Chargement du bulletin…</p>
    </div>
  );
  if (error || !data) return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/20 text-center">
      <XCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
      <p className="font-semibold text-red-700 dark:text-red-400">Impossible de charger le bulletin</p>
      <p className="text-sm text-red-600/70 mt-1">Aucune note disponible pour ce semestre.</p>
      <button onClick={onBack} className="mt-4 rounded-xl border px-4 py-2 text-sm hover:bg-accent">← Retour</button>
    </div>
  );

  const noGrades   = data.results.length === 0;
  const unvalidated = data.results.some((r) => r.grades?.some((g: { isValidated?: boolean }) => !g.isValidated));
  const html = generateBulletinHtml(data, semLabel);
  const nm   = `${data.student.user.lastName}_${data.student.user.firstName}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={18} /></button>
        <div>
          <h2 className="text-lg font-semibold">{data.student.user.lastName.toUpperCase()} {data.student.user.firstName}</h2>
          <p className="text-xs text-muted-foreground">{data.student.matricule ?? "—"} · {semLabel}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => printBulletin(html)}
            className="flex items-center gap-1.5 rounded-xl grad-classroom px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Printer size={14} /> Imprimer / PDF
          </button>
          <button onClick={() => downloadBulletin(html, `bulletin_${nm}_${semLabel}.html`)}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm hover:bg-accent">
            <Download size={14} /> Télécharger
          </button>
        </div>
      </div>

      {noGrades && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/20 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">Aucune note saisie pour ce semestre — le bulletin est vide.</p>
        </div>
      )}
      {!noGrades && unvalidated && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/20 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">Certaines notes ne sont pas encore validées par le responsable pédagogique.</p>
        </div>
      )}
      {!noGrades && !unvalidated && data.summary.gpa >= 10 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/20 flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">Notes validées · Moyenne générale : <strong>{data.summary.gpa.toFixed(2)}/20</strong> · Crédits : {data.summary.earnedCredits}/{data.summary.totalCredits}</p>
        </div>
      )}
      <div className="rounded-2xl border overflow-hidden shadow-elegant bg-white">
        <iframe srcDoc={html} className="w-full h-[calc(100vh-16rem)] min-h-96" title="Aperçu bulletin" sandbox="allow-same-origin" />
      </div>
    </div>
  );
}

// ── Student self view ──────────────────────────────────────────────────────────

function StudentSelfBulletin({ semId, semLabel }: { semId: string; semLabel: string }) {
  const profileQ = useQuery({
    queryKey: ["me","profile-id"],
    queryFn: async () => {
      const ctx = await api<{ profile?: { id?: string } }>("/me/context");
      return ctx.profile?.id ?? null;
    },
  });
  const { data, isLoading, error } = useBulletin(profileQ.data ?? null, semId);

  if (profileQ.isLoading || isLoading) return (
    <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  );
  if (!profileQ.data || error || !data) return (
    <EmptyState icon={XCircle} title="Aucune note disponible" sub="Aucune note n'a été saisie pour ce semestre." />
  );

  const html = generateBulletinHtml(data, semLabel);
  const nm   = `${data.student.user.lastName}_${data.student.user.firstName}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 justify-end">
        <button onClick={() => printBulletin(html)} className="flex items-center gap-1.5 rounded-xl grad-classroom px-4 py-2 text-sm font-semibold text-white">
          <Printer size={14} /> Imprimer
        </button>
        <button onClick={() => downloadBulletin(html, `bulletin_${nm}_${semLabel}.html`)} className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm hover:bg-accent">
          <Download size={14} /> Télécharger
        </button>
      </div>
      <div className="rounded-2xl border overflow-hidden shadow-elegant">
        <iframe srcDoc={html} className="w-full h-[calc(100vh-14rem)] min-h-96" title="Mon bulletin" sandbox="allow-same-origin" />
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function BulletinPage() {
  const { user, ready } = useRequireClassroom();

  const [yearId, setYear] = useState("");
  const [semId,  setSem]  = useState("");
  const [menId,  setMen]  = useState("");
  const [proId,  setPro]  = useState("");
  const [grpId,  setGrp]  = useState("");
  const [sel,    setSel]  = useState<Set<string>>(new Set());
  const [viewStudent, setViewStudent] = useState<{ id: string } | null>(null);

  const years    = useAcYears();
  const semesters = useSemesters({ enabled: ready });
  const mentions = useMentions();
  const promos   = usePromos({ mentionId: menId || undefined, academicYearId: yearId || undefined });
  const groups   = useGroups(proId || undefined);
  const studQ    = useStudents({ promotionId: proId || undefined, groupId: grpId || undefined });

  const students = studQ.data ?? [];
  const allIds   = students.map((s) => s.id);
  const allChk   = allIds.length > 0 && allIds.every((id) => sel.has(id));
  const someChk  = !allChk && allIds.some((id) => sel.has(id));

  const semLabel = useMemo(() =>
    (semesters.data as Semester[] ?? []).find((s) => s.id === semId)?.name ?? semId,
    [semesters.data, semId]
  );

  function reset() { setSel(new Set()); setViewStudent(null); }
  function guard() { if (!semId) { toast.error("Choisissez un semestre d'abord"); return false; } return true; }

  if (!ready || !user) return (
    <div className="grid min-h-96 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  );

  // Single bulletin view
  if (viewStudent && semId) return (
    <BulletinViewer studentId={viewStudent.id} semesterId={semId} semLabel={semLabel} onBack={() => setViewStudent(null)} />
  );

  // Student: self-service
  if (user.systemRole === "STUDENT") return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Mon bulletin</h1>
        <p className="text-muted-foreground">Consultez vos notes par semestre.</p>
      </div>
      {(() => {
        // Le bulletin n'est publié qu'une fois le semestre terminé
        const all = (semesters.data as Semester[] ?? []);
        const ended = all.filter((x) => x.endDate && new Date(x.endDate) < new Date() && !x.isActive);
        const ongoing = all.filter((x) => !ended.includes(x));
        return (
          <>
            <div className="max-w-xs">
              <Sel label="Semestre" value={semId} onChange={setSem}
                options={ended.map((s) => ({ value: s.id, label: `${s.name}${s.academicYear?.label ? ` — ${s.academicYear.label}` : ""}` }))}
                placeholder="— Choisir un semestre —" />
            </div>
            {ongoing.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {ongoing.map((s) => `${s.name} : en cours — le bulletin sera disponible une fois le semestre terminé${s.endDate ? ` (fin prévue le ${new Date(s.endDate).toLocaleDateString("fr-FR")})` : ""}`).join(" · ")}
              </p>
            )}
            {semId ? <StudentSelfBulletin semId={semId} semLabel={semLabel} /> : (
              <EmptyState icon={BookOpen} title={ended.length ? "Aucun semestre sélectionné" : "Aucun bulletin disponible"}
                sub={ended.length ? "Choisissez un semestre terminé pour afficher votre bulletin." : "Le bulletin est publié en ligne une fois le semestre terminé."} />
            )}
          </>
        );
      })()}
    </div>
  );

  // Admin/Staff: hierarchical workflow
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Bulletins de notes</h1>
        <p className="text-muted-foreground">Génération individuelle ou en masse — par groupe, promotion ou mention.</p>
      </div>

      {/* Hierarchical selector */}
      <div className="rounded-2xl border bg-card shadow-elegant p-6 space-y-4">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <ListChecks size={14} /> Sélection académique
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Sel label="Année universitaire" value={yearId}
            onChange={(v) => { setYear(v); setSem(""); setMen(""); setPro(""); setGrp(""); reset(); }}
            options={(years.data ?? []).map((y) => ({ value: y.id, label: y.label ?? y.name ?? y.id }))}
            hint={!yearId ? "⟶ Commencez ici" : undefined} />
          <Sel label="Semestre" value={semId}
            onChange={(v) => { setSem(v); reset(); }}
            options={(semesters.data as Semester[] ?? []).map((s) => ({ value: s.id, label: s.name }))}
            hint={yearId && !semId ? "⟶ Requis pour générer les bulletins" : undefined}
            placeholder={!yearId ? "— Choisir d'abord l'année —" : undefined} />
          <Sel label="Mention" value={menId}
            onChange={(v) => { setMen(v); setPro(""); setGrp(""); reset(); }} disabled={!yearId}
            options={(mentions.data ?? []).map((m) => ({ value: m.id, label: m.name }))} />
          <Sel label="Promotion" value={proId}
            onChange={(v) => { setPro(v); setGrp(""); reset(); }} disabled={!menId}
            options={(promos.data ?? []).map((p) => ({ value: p.id, label: `${p.name} — ${p.level}` }))}
            hint={menId && !promos.isLoading && promos.isFetched && !promos.data?.length
              ? "⚠️ Aucune promotion pour cette mention / année" : undefined} />
          <Sel label="Groupe (optionnel)" value={grpId}
            onChange={(v) => { setGrp(v); reset(); }} disabled={!proId}
            options={(groups.data ?? []).map((g) => ({ value: g.id, label: `${g.name}${g._count ? ` (${g._count.students} étud.)` : ""}` }))}
            hint={proId && !groups.isLoading && groups.isFetched && !groups.data?.length
              ? "Aucun groupe configuré dans cette promotion" : undefined} />
        </div>
      </div>

      {/* Student list */}
      {proId ? (
        <div className="rounded-2xl border bg-card shadow-elegant overflow-hidden">
          <div className="flex items-center gap-3 border-b px-4 py-3 bg-muted/30">
            <button onClick={() => setSel(allChk ? new Set() : new Set(allIds))} className="text-classroom" disabled={studQ.isLoading}>
              {allChk ? <CheckSquare size={16} /> : someChk ? <CheckSquare size={16} className="opacity-50" /> : <Square size={16} />}
            </button>
            <span className="text-sm font-medium">
              {studQ.isLoading ? "Chargement des étudiants…" : `${students.length} étudiant${students.length !== 1 ? "s" : ""}${grpId ? " dans ce groupe" : " dans cette promotion"}`}
            </span>
            {sel.size > 0 && (
              <span className="ml-auto text-sm font-semibold text-classroom">{sel.size} sélectionné{sel.size !== 1 ? "s" : ""}</span>
            )}
          </div>

          {studQ.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : students.length === 0 ? (
            <EmptyState icon={Users}
              title="Aucun étudiant inscrit dans cette promotion"
              sub={grpId ? "Ce groupe ne contient aucun étudiant." : "Cette promotion ne contient aucun étudiant inscrit. Vérifiez les inscriptions."} />
          ) : (
            <>
              <div className="divide-y max-h-72 overflow-y-auto">
                {students.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors">
                    <label className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                      <input type="checkbox" checked={sel.has(s.id)}
                        onChange={() => setSel((p) => { const n = new Set(p); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                        className="h-4 w-4 rounded accent-classroom shrink-0" />
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full grad-classroom text-[11px] font-bold text-white">
                        {s.user.firstName[0]}{s.user.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm">{s.user.lastName.toUpperCase()} {s.user.firstName}</p>
                        <p className="text-[11px] text-muted-foreground">{s.matricule ?? "—"}{s.group ? ` · ${s.group.name}` : ""}</p>
                      </div>
                    </label>
                    <button onClick={() => { if (guard()) setViewStudent({ id: s.id }); }}
                      className="shrink-0 rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
                      {semId ? "Voir bulletin" : "Choisir un semestre ↑"}
                    </button>
                  </div>
                ))}
              </div>
              <div className="border-t bg-muted/20 px-4 py-3 flex flex-wrap items-center gap-2">
                <button onClick={() => { if (!guard()) return; if (!sel.size) { toast.error("Sélectionnez au moins un étudiant"); return; } generateBulkBulletins([...sel], semId, semLabel); }}
                  disabled={sel.size === 0 || !semId}
                  className="flex items-center gap-2 rounded-xl grad-classroom px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                  <TrendingUp size={14} />
                  {sel.size === 0 ? "Sélectionnez des étudiants" : `Générer ${sel.size} bulletin${sel.size !== 1 ? "s" : ""}`}
                </button>
                <button onClick={() => { if (!guard()) return; generateBulkBulletins(allIds, semId, semLabel); }}
                  disabled={!students.length || !semId}
                  className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-40">
                  <Package size={14} /> Tous ({students.length}) — ZIP
                </button>
                {!semId && (
                  <p className="self-center text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle size={12} /> Sélectionnez un semestre
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-card/50 p-12 text-center">
          <GraduationCap className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">Sélectionnez une promotion pour voir les étudiants</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Année → Mention → Promotion dans les filtres ci-dessus.</p>
        </div>
      )}
    </div>
  );
}
