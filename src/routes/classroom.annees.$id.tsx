import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft, Calendar, Users, GraduationCap, BookOpen, CheckCircle2,
  Clock, Archive, AlertTriangle, Loader2, ChevronRight, Plus,
  Copy, Lock, Unlock, Star, AlertCircle, Check, X, BarChart3,
  Layers, ArrowRight, RefreshCw, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useRequireClassroom } from "@/components/classroom/shared";
import {
  useAcademicYears, usePromotions, useMentions,
  useActivateYear, useCloseYear, useArchiveYear, useCreatePromotion,
  useGroups, useCreateGroup,
  deriveYearStatus, nextLevel,
  type AcademicYear, type AcademicYearStatus, type PromotionDecisionSummary, type Promotion,
} from "@/lib/academic";

export const Route = createFileRoute("/classroom/annees/$id")({ component: AnneeDetailPage });

// ─── Status config ────────────────────────────────────────────────────────────

type StatusCfg = { label: string; textCls: string; ringCls: string; bgCls: string; icon: React.ReactNode };
const STATUS_CFG: Record<AcademicYearStatus, StatusCfg> = {
  DRAFT:       { label: "Brouillon",    textCls: "text-gray-500",                       ringCls: "ring-gray-200",    bgCls: "bg-gray-50 dark:bg-gray-900/40",        icon: <Clock size={14} /> },
  PREPARATION: { label: "Préparation",  textCls: "text-amber-700 dark:text-amber-400",  ringCls: "ring-amber-300",   bgCls: "bg-amber-50 dark:bg-amber-950/20",      icon: <Clock size={14} /> },
  ACTIVE:      { label: "Année active", textCls: "text-emerald-700 dark:text-emerald-400", ringCls: "ring-emerald-300", bgCls: "bg-emerald-50 dark:bg-emerald-950/20", icon: <CheckCircle2 size={14} /> },
  CLOSED:      { label: "Clôturée",     textCls: "text-blue-700 dark:text-blue-400",    ringCls: "ring-blue-300",    bgCls: "bg-blue-50 dark:bg-blue-950/20",        icon: <Lock size={14} /> },
  ARCHIVED:    { label: "Archivée",     textCls: "text-gray-500 dark:text-gray-400",    ringCls: "ring-gray-200",    bgCls: "bg-gray-50 dark:bg-gray-900/40",        icon: <Archive size={14} /> },
};

// ─── Checklist clôture ────────────────────────────────────────────────────────

const CLOSE_CHECKLIST = [
  { id: "notes",     label: "Toutes les notes sont validées" },
  { id: "delib",     label: "Les délibérations sont terminées" },
  { id: "bulletins", label: "Les bulletins ont été publiés" },
  { id: "payments",  label: "Les paiements ont été contrôlés" },
];

// ─── Tab: Vue d'ensemble ──────────────────────────────────────────────────────

function TabOverview({ year, status, isSuperAdmin }: {
  year: AcademicYear;
  status: AcademicYearStatus;
  isSuperAdmin: boolean;
}) {
  const activate  = useActivateYear();
  const closeYear = useCloseYear();
  const archive   = useArchiveYear();
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [showClose, setShowClose]   = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const cfg = STATUS_CFG[status];

  const allChecked = CLOSE_CHECKLIST.every((c) => checklist[c.id]);

  async function handleActivate() {
    try {
      await activate.mutateAsync(year.id);
      toast.success(`Année ${year.label} activée`);
    } catch {
      toast.error("Impossible d'activer l'année — endpoint non disponible");
    }
  }

  async function handleClose() {
    try {
      await closeYear.mutateAsync(year.id);
      toast.success(`Année ${year.label} clôturée`);
      setShowClose(false);
    } catch {
      toast.error("Impossible de clôturer l'année — endpoint non disponible");
    }
  }

  async function handleArchive() {
    try {
      await archive.mutateAsync(year.id);
      toast.success(`Année ${year.label} archivée`);
      setShowArchive(false);
    } catch {
      toast.error("Impossible d'archiver l'année — endpoint non disponible");
    }
  }

  return (
    <div className="space-y-6">
      {/* Status card */}
      <div className={`rounded-2xl border-2 ${cfg.ringCls} ${cfg.bgCls} p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${status === "ACTIVE" ? "grad-classroom" : "bg-white dark:bg-gray-800 border"}`}>
              <span className={status === "ACTIVE" ? "text-white" : cfg.textCls}>{cfg.icon}</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Statut actuel</p>
              <p className={`text-lg font-bold ${cfg.textCls}`}>{cfg.label}</p>
            </div>
          </div>
          {isSuperAdmin && (
            <div className="flex flex-wrap gap-2">
              {status === "PREPARATION" && (
                <button
                  onClick={handleActivate}
                  disabled={activate.isPending}
                  className="inline-flex items-center gap-2 rounded-xl grad-classroom px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {activate.isPending ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                  Activer l'année
                </button>
              )}
              {status === "ACTIVE" && (
                <button
                  onClick={() => setShowClose(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800"
                >
                  <Lock size={14} /> Préparer la clôture
                </button>
              )}
              {status === "CLOSED" && (
                <button
                  onClick={() => setShowArchive(true)}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent"
                >
                  <Archive size={14} /> Archiver
                </button>
              )}
            </div>
          )}
        </div>

        {/* Context banners */}
        {status === "PREPARATION" && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-white/70 dark:bg-amber-950/20 p-4">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Checklist avant activation</p>
            <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-400">
              <li className="flex items-center gap-2"><ChevronRight size={12} /> Créer les semestres</li>
              <li className="flex items-center gap-2"><ChevronRight size={12} /> Créer les promotions</li>
              <li className="flex items-center gap-2"><ChevronRight size={12} /> Affecter les étudiants</li>
              <li className="flex items-center gap-2"><ChevronRight size={12} /> Configurer les UE et matières</li>
            </ul>
          </div>
        )}
        {status === "ACTIVE" && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-white/70 dark:bg-emerald-950/20 p-4 text-sm text-emerald-700 dark:text-emerald-400">
            Cette année est <strong>active</strong> — les inscriptions, emplois du temps et notes sont modifiables.
          </div>
        )}
        {status === "CLOSED" && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-white/70 dark:bg-blue-950/20 p-4 text-sm text-blue-700 dark:text-blue-400">
            <Lock size={14} className="mr-1.5 inline" /> Année <strong>clôturée</strong> — toutes les données sont en lecture seule.
          </div>
        )}
        {status === "ARCHIVED" && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-white/70 dark:bg-gray-900/40 p-4 text-sm text-muted-foreground">
            <Archive size={14} className="mr-1.5 inline" /> Données historiques disponibles en consultation uniquement.
          </div>
        )}
      </div>

      {/* Semestres quick view */}
      <div className="rounded-2xl border bg-card p-5 shadow-elegant">
        <h3 className="mb-4 font-semibold">Semestres</h3>
        {(year.semesters ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun semestre configuré.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {year.semesters!.map((sem) => (
              <div key={sem.id} className={`flex items-center gap-3 rounded-xl border p-3 ${sem.isActive ? "border-classroom/30 bg-classroom/5" : "bg-muted/30"}`}>
                <div className={`h-2.5 w-2.5 rounded-full ${sem.isActive ? "bg-classroom" : "bg-muted-foreground/40"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{sem.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(sem.startDate), "d MMM", { locale: fr })} → {format(new Date(sem.endDate), "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
                {sem.isActive && <span className="text-[10px] font-bold text-classroom">ACTIF</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Close checklist modal */}
      {showClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="animate-in zoom-in-95 duration-200 w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/40">
                <Lock size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold">Clôturer {year.label}</h2>
                <p className="text-sm text-muted-foreground">Vérifiez chaque point avant de continuer</p>
              </div>
              <button onClick={() => setShowClose(false)} className="ml-auto grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><X size={16} /></button>
            </div>
            <div className="space-y-2 mb-5">
              {CLOSE_CHECKLIST.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 hover:bg-accent/50 transition-colors">
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${checklist[item.id] ? "border-classroom bg-classroom" : "border-muted-foreground/30"}`}>
                    {checklist[item.id] && <Check size={11} className="text-white" />}
                  </div>
                  <input type="checkbox" className="sr-only" checked={!!checklist[item.id]}
                    onChange={(e) => setChecklist((c) => ({ ...c, [item.id]: e.target.checked }))} />
                  <span className="text-sm">{item.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowClose(false)} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-accent">Annuler</button>
              <button
                disabled={!allChecked || closeYear.isPending}
                onClick={handleClose}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-blue-700"
              >
                {closeYear.isPending && <Loader2 size={14} className="animate-spin" />}
                <Lock size={14} /> Clôturer l'année
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirm */}
      {showArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="animate-in zoom-in-95 duration-200 w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl">
            <Archive size={32} className="mx-auto mb-3 text-muted-foreground" />
            <h2 className="text-center font-bold">Archiver {year.label} ?</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">L'archivage ne supprime rien. Toutes les données restent consultables.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setShowArchive(false)} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-accent">Annuler</button>
              <button
                disabled={archive.isPending}
                onClick={handleArchive}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold hover:bg-accent"
              >
                {archive.isPending ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                Archiver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Promotions ──────────────────────────────────────────────────────────

function TabPromotions({ year, readonly }: { year: AcademicYear; readonly: boolean }) {
  const { data: promotions, isLoading } = usePromotions(year.id);
  const { data: mentions } = useMentions();
  const createPromo = useCreatePromotion();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ mentionId: "", level: "L1", maxCapacity: "50" });

  const levels = ["L1", "L2", "L3", "M1", "M2"];
  const inp = "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition";

  async function addPromotion(e: React.FormEvent) {
    e.preventDefault();
    const mention = mentions?.find(m => m.id === form.mentionId);
    if (!mention) return;
    try {
      await createPromo.mutateAsync({
        mentionId: form.mentionId,
        academicYearId: year.id,
        name: `${form.level} ${mention.name} ${year.label}`,
        level: form.level,
        maxCapacity: parseInt(form.maxCapacity),
      });
      toast.success("Promotion créée");
      setShowForm(false);
      setForm({ mentionId: "", level: "L1", maxCapacity: "50" });
    } catch {
      toast.error("Erreur lors de la création");
    }
  }

  const LEVEL_COLORS: Record<string, string> = {
    L1: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    L2: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
    L3: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
    M1: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
    M2: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{promotions?.length ?? 0} promotion{(promotions?.length ?? 0) > 1 ? "s" : ""} dans cette année</p>
        {!readonly && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl grad-classroom px-3 py-1.5 text-xs font-semibold text-white"
          >
            <Plus size={13} /> Ajouter une promotion
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (promotions?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed py-16 text-center">
          <GraduationCap className="mb-3 h-9 w-9 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Aucune promotion</p>
          {!readonly && <p className="mt-1 text-sm text-muted-foreground/70">Ajoutez des promotions pour cette année.</p>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {promotions!.map((promo, i) => (
            <div
              key={promo.id}
              className="animate-in fade-in slide-in-from-bottom-2 duration-400 rounded-2xl border bg-card p-4 shadow-elegant"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
            >
              <div className="flex items-start gap-3">
                <span className={`rounded-lg px-2 py-1 text-xs font-bold ${LEVEL_COLORS[promo.level] ?? "bg-muted text-muted-foreground"}`}>
                  {promo.level}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{promo.mention?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{promo.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold">{promo._count?.students ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">étudiants</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full grad-classroom"
                  style={{ width: `${Math.min(100, ((promo._count?.students ?? 0) / promo.maxCapacity) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{promo._count?.students ?? 0} / {promo.maxCapacity} places</p>
            </div>
          ))}
        </div>
      )}

      {/* Add promotion form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="animate-in zoom-in-95 duration-200 w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">Nouvelle promotion</h2>
              <button onClick={() => setShowForm(false)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><X size={16} /></button>
            </div>
            <form onSubmit={addPromotion} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Mention</label>
                <select className={inp} value={form.mentionId} onChange={e => setForm(f => ({ ...f, mentionId: e.target.value }))} required>
                  <option value="">Choisir une mention…</option>
                  {mentions?.map(m => <option key={m.id} value={m.id}>{m.name} — {m.code}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Niveau</label>
                <select className={inp} value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}>
                  {levels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Capacité maximale</label>
                <input type="number" min={1} max={500} className={inp} value={form.maxCapacity}
                  onChange={e => setForm(f => ({ ...f, maxCapacity: e.target.value }))} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-accent">Annuler</button>
                <button type="submit" disabled={createPromo.isPending || !form.mentionId}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {createPromo.isPending && <Loader2 size={14} className="animate-spin" />}
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Assistant de promotion ──────────────────────────────────────────────

function TabAssistant({ currentYear, years }: { currentYear: AcademicYear; years: AcademicYear[] }) {
  const { data: currentPromotions } = usePromotions(currentYear.id);
  const createPromo = useCreatePromotion();

  const futureYears = years.filter(y => !y.isCurrent);
  const [targetYearId, setTargetYearId] = useState(futureYears[0]?.id ?? "");
  const [decisions, setDecisions] = useState<Record<string, PromotionDecisionSummary>>({});
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [done, setDone] = useState(false);

  const targetYear = years.find(y => y.id === targetYearId);

  function initDecisions() {
    if (!currentPromotions) return;
    const init: Record<string, PromotionDecisionSummary> = {};
    currentPromotions.forEach(p => {
      const total = p._count?.students ?? 0;
      init[p.id] = {
        promotionId: p.id,
        promotionName: p.name,
        level: p.level,
        mentionId: p.mentionId,
        totalStudents: total,
        admitted: total,
        repeating: 0,
        excluded: 0,
      };
    });
    setDecisions(init);
    setStep(2);
  }

  function updateDecision(id: string, field: "admitted" | "repeating" | "excluded", val: number) {
    setDecisions(d => {
      const entry = d[id];
      const total = entry.totalStudents;
      const updated = { ...entry, [field]: val };
      // auto-balance
      const others = (["admitted", "repeating", "excluded"] as const).filter(f => f !== field);
      const remaining = total - val;
      const sumOthers = others.reduce((s, f) => s + updated[f], 0);
      if (sumOthers > remaining) {
        const ratio = remaining / sumOthers;
        others.forEach(f => { updated[f] = Math.round(updated[f] * ratio); });
        // fix rounding
        const diff = total - val - others.reduce((s, f) => s + updated[f], 0);
        updated[others[0]] += diff;
      }
      return { ...d, [id]: updated };
    });
  }

  async function executePromotion() {
    if (!targetYear) return;
    let created = 0;
    for (const d of Object.values(decisions)) {
      if (d.admitted > 0) {
        try {
          const nl = nextLevel(d.level);
          await createPromo.mutateAsync({
            mentionId: d.mentionId,
            academicYearId: targetYear.id,
            name: `${nl} ${currentPromotions?.find(p => p.id === d.promotionId)?.mention?.name ?? ""} ${targetYear.label}`,
            level: nl,
            maxCapacity: d.admitted + 10,
          });
          created++;
        } catch { /* skip on error */ }
      }
    }
    toast.success(`${created} promotion${created > 1 ? "s" : ""} créée${created > 1 ? "s" : ""} pour ${targetYear.label}`);
    setDone(true);
    setStep(3);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center rounded-2xl border bg-card py-16 text-center shadow-elegant">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 mb-4">
          <CheckCircle2 size={28} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-bold">Promotion exécutée</h3>
        <p className="mt-2 text-sm text-muted-foreground">Les promotions de l'année {targetYear?.label} ont été créées.</p>
        <Link to="/classroom/annees/$id" params={{ id: targetYearId }}
          className="mt-4 inline-flex items-center gap-2 rounded-xl grad-classroom px-4 py-2 text-sm font-semibold text-white">
          Voir l'année {targetYear?.label} <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:bg-blue-950/20 dark:border-blue-800">
        <div className="flex gap-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-semibold">Assistant de promotion des étudiants</p>
            <p className="mt-0.5">Le système ne promeut pas automatiquement les étudiants. Vous définissez le nombre d'admis, de redoublants et d'exclus par promotion. Les nouvelles promotions sont ensuite créées dans l'année cible.</p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        {[1, 2, 3].map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            {i > 0 && <div className={`h-px flex-1 ${step > i ? "bg-classroom" : "bg-muted"}`} />}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${step >= s ? "grad-classroom text-white" : "bg-muted text-muted-foreground"}`}>{s}</div>
            {i === 0 && <span className="hidden text-xs text-muted-foreground sm:block">Cible</span>}
            {i === 1 && <span className="hidden text-xs text-muted-foreground sm:block">Décisions</span>}
            {i === 2 && <span className="hidden text-xs text-muted-foreground sm:block">Confirmer</span>}
          </div>
        ))}
      </div>

      {/* Step 1: Choose target year */}
      {step === 1 && (
        <div className="rounded-2xl border bg-card p-6 shadow-elegant space-y-4">
          <h3 className="font-semibold">Étape 1 — Choisir l'année cible</h3>
          <p className="text-sm text-muted-foreground">Dans quelle année seront inscrits les étudiants promus ?</p>
          {futureYears.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              Aucune autre année disponible. <Link to="/classroom/annees" className="text-classroom underline">Créez une nouvelle année.</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {futureYears.map(y => (
                <label key={y.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${targetYearId === y.id ? "border-classroom bg-classroom/5" : "hover:bg-accent"}`}>
                  <div className={`h-4 w-4 rounded-full border-2 transition-all ${targetYearId === y.id ? "border-classroom bg-classroom" : "border-muted-foreground/30"}`} />
                  <input type="radio" className="sr-only" value={y.id} checked={targetYearId === y.id}
                    onChange={() => setTargetYearId(y.id)} />
                  <div>
                    <p className="font-semibold">{y.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(y.startDate), "d MMM yyyy", { locale: fr })} → {format(new Date(y.endDate), "d MMM yyyy", { locale: fr })}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <button
            disabled={!targetYearId || (currentPromotions?.length ?? 0) === 0}
            onClick={initDecisions}
            className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Suivant <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Step 2: Decisions per promotion */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="font-semibold">Étape 2 — Décisions par promotion</h3>
          <p className="text-sm text-muted-foreground">Définissez le nombre d'admis, de redoublants et d'exclus pour chaque promotion.</p>
          {Object.values(decisions).map((d) => {
            const sum = d.admitted + d.repeating + d.excluded;
            const valid = sum === d.totalStudents;
            return (
              <div key={d.promotionId} className="rounded-2xl border bg-card p-5 shadow-elegant">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold">{d.promotionName}</p>
                    <p className="text-xs text-muted-foreground">{d.totalStudents} étudiant{d.totalStudents > 1 ? "s" : ""}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${valid ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"}`}>
                    {valid ? <Check size={11} /> : <AlertCircle size={11} />}
                    {sum} / {d.totalStudents}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { key: "admitted" as const, label: "Admis", color: "border-emerald-300 focus:ring-emerald-300" },
                    { key: "repeating" as const, label: "Redoublants", color: "border-amber-300 focus:ring-amber-300" },
                    { key: "excluded" as const, label: "Exclus", color: "border-red-300 focus:ring-red-300" },
                  ]).map(({ key, label, color }) => (
                    <div key={key}>
                      <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</label>
                      <input
                        type="number" min={0} max={d.totalStudents}
                        value={d[key]}
                        onChange={e => updateDecision(d.promotionId, key, parseInt(e.target.value) || 0)}
                        className={`h-10 w-full rounded-xl border-2 bg-background px-3 text-sm font-semibold outline-none focus:ring-2 transition ${color}`}
                      />
                    </div>
                  ))}
                </div>
                {/* Bar visual */}
                <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full">
                  <div className="bg-emerald-500 transition-all" style={{ width: `${(d.admitted / (d.totalStudents || 1)) * 100}%` }} />
                  <div className="bg-amber-500 transition-all" style={{ width: `${(d.repeating / (d.totalStudents || 1)) * 100}%` }} />
                  <div className="bg-red-500 transition-all" style={{ width: `${(d.excluded / (d.totalStudents || 1)) * 100}%` }} />
                </div>
              </div>
            );
          })}
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-accent">Retour</button>
            <button
              disabled={!Object.values(decisions).every(d => d.admitted + d.repeating + d.excluded === d.totalStudents)}
              onClick={() => setStep(3)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Suivant <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & confirm */}
      {step === 3 && (
        <div className="rounded-2xl border bg-card p-6 shadow-elegant space-y-5">
          <h3 className="font-semibold">Étape 3 — Récapitulatif</h3>
          <p className="text-sm text-muted-foreground">
            Les promotions suivantes seront créées dans <strong>{targetYear?.label}</strong> avec le niveau supérieur.
          </p>
          <div className="divide-y rounded-xl border overflow-hidden">
            <div className="grid grid-cols-4 gap-3 bg-muted/50 px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground">
              <span>Promotion actuelle</span>
              <span className="text-center text-emerald-600">Admis → {targetYear?.label}</span>
              <span className="text-center text-amber-600">Redoublants</span>
              <span className="text-center text-red-600">Exclus</span>
            </div>
            {Object.values(decisions).map(d => (
              <div key={d.promotionId} className="grid grid-cols-4 gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{d.level} → {nextLevel(d.level)}</p>
                  <p className="text-xs text-muted-foreground truncate">{d.promotionName}</p>
                </div>
                <p className="text-center font-semibold text-emerald-700 dark:text-emerald-400">{d.admitted}</p>
                <p className="text-center font-semibold text-amber-700 dark:text-amber-400">{d.repeating}</p>
                <p className="text-center font-semibold text-red-700 dark:text-red-400">{d.excluded}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-accent">Modifier</button>
            <button
              onClick={executePromotion}
              disabled={createPromo.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {createPromo.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Confirmer la promotion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Groupes ─────────────────────────────────────────────────────────────

const GROUP_TYPES = ["TD", "TP", "CM"] as const;
const TYPE_COLOR: Record<string, string> = {
  TD: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  TP: "bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
  CM: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function PromotionGroupsPanel({ promo }: { promo: Promotion }) {
  const { data: groups, isLoading } = useGroups(promo.id);
  const createGroup = useCreateGroup();
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "TD" as string, maxCapacity: 30 });
  const inp = "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createGroup.mutateAsync({ promotionId: promo.id, ...form });
      toast.success("Groupe créé");
      setShowForm(false);
      setForm({ name: "", type: "TD", maxCapacity: 30 });
    } catch {
      toast.error("Erreur lors de la création");
    }
  }

  const grpList = groups ?? [];

  return (
    <div className="rounded-2xl border bg-card shadow-elegant">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-accent/50"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-classroom/10">
          <GraduationCap size={16} className="text-classroom" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{promo.mention?.name ?? promo.name}</p>
          <p className="text-xs text-muted-foreground">{promo.level} · {grpList.length} groupe{grpList.length !== 1 ? "s" : ""}</p>
        </div>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="border-t px-5 pb-5 pt-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : grpList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun groupe — créez le premier ci-dessous.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {grpList.map((g) => (
                <div key={g.id} className="flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-2.5">
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${TYPE_COLOR[g.type] ?? "bg-muted text-muted-foreground"}`}>
                    {g.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{g.name}</p>
                    <p className="text-[11px] text-muted-foreground">{g._count?.students ?? 0} / {g.maxCapacity}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Plus size={13} /> Ajouter un groupe
            </button>
          ) : (
            <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-xl border bg-muted/30 p-3">
              <div className="flex-1 min-w-32">
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Nom</label>
                <input className={inp} placeholder="Groupe A" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Type</label>
                <select className={`${inp} w-20`} value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  {GROUP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Capacité</label>
                <input className={`${inp} w-24`} type="number" min={1} max={200} value={form.maxCapacity}
                  onChange={(e) => setForm((f) => ({ ...f, maxCapacity: +e.target.value }))} />
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setShowForm(false)}
                  className="h-10 rounded-xl border px-3 text-sm hover:bg-accent">
                  <X size={14} />
                </button>
                <button type="submit" disabled={createGroup.isPending}
                  className="h-10 rounded-xl grad-classroom px-3 text-sm font-semibold text-white disabled:opacity-60">
                  {createGroup.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function TabGroupes({ year }: { year: AcademicYear }) {
  const { data: promotions, isLoading } = usePromotions(year.id);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if ((promotions?.length ?? 0) === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed py-16 text-center">
        <Users className="mb-3 h-9 w-9 text-muted-foreground/40" />
        <p className="font-medium text-muted-foreground">Aucune promotion dans cette année</p>
        <p className="mt-1 text-sm text-muted-foreground/70">Créez des promotions d'abord dans l'onglet "Promotions".</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Gérez les groupes (TD, TP, CM) pour chaque promotion.</p>
      {promotions!.map((promo) => (
        <PromotionGroupsPanel key={promo.id} promo={promo} />
      ))}
    </div>
  );
}

// ─── Tab: Réutilisation ───────────────────────────────────────────────────────

function TabCopier({ targetYear, years }: { targetYear: AcademicYear; years: AcademicYear[] }) {
  const sourceYears = years.filter(y => y.id !== targetYear.id && y.isCurrent);
  const [sourceId, setSourceId] = useState(sourceYears[0]?.id ?? "");
  const { data: sourcePros } = usePromotions(sourceId);
  const { data: targetPros } = usePromotions(targetYear.id);
  const { data: mentions } = useMentions();
  const createPromo = useCreatePromotion();
  const [copying, setCopying] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const sourceYear = years.find(y => y.id === sourceId);
  const targetIds = new Set(targetPros?.map(p => p.mentionId + p.level) ?? []);
  const available = (sourcePros ?? []).filter(p => !targetIds.has(p.mentionId + p.level));

  async function copySelected() {
    setCopying(true);
    let ok = 0;
    for (const p of available.filter(p => selected[p.id])) {
      try {
        await createPromo.mutateAsync({
          mentionId: p.mentionId,
          academicYearId: targetYear.id,
          name: `${p.level} ${p.mention?.name ?? ""} ${targetYear.label}`,
          level: p.level,
          maxCapacity: p.maxCapacity,
        });
        ok++;
      } catch { /* skip */ }
    }
    toast.success(`${ok} promotion${ok > 1 ? "s" : ""} copiée${ok > 1 ? "s" : ""}`);
    setCopying(false);
    setSelected({});
  }

  const allSelected = available.every(p => selected[p.id]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:bg-blue-950/20 dark:border-blue-800">
        <div className="flex gap-3 text-sm text-blue-700 dark:text-blue-300">
          <Copy size={15} className="mt-0.5 shrink-0" />
          <span>Copiez les promotions d'une autre année pour éviter de tout recréer. Vous pourrez ensuite modifier ce qui change.</span>
        </div>
      </div>

      {years.filter(y => y.id !== targetYear.id).length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucune autre année disponible comme source.</p>
      ) : (
        <>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Source (année à copier)</label>
            <select
              className="h-10 w-full max-w-xs rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30"
              value={sourceId}
              onChange={e => { setSourceId(e.target.value); setSelected({}); }}
            >
              {years.filter(y => y.id !== targetYear.id).map(y => (
                <option key={y.id} value={y.id}>{y.label}{y.isCurrent ? " (active)" : ""}</option>
              ))}
            </select>
          </div>

          {available.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{available.length} promotion{available.length > 1 ? "s" : ""} disponible{available.length > 1 ? "s" : ""} de {sourceYear?.label}</p>
                <button onClick={() => setSelected(allSelected ? {} : Object.fromEntries(available.map(p => [p.id, true])))}
                  className="text-xs text-classroom hover:underline">
                  {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
              </div>
              <div className="space-y-2">
                {available.map(p => (
                  <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${selected[p.id] ? "border-classroom bg-classroom/5" : "hover:bg-accent"}`}>
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${selected[p.id] ? "border-classroom bg-classroom" : "border-muted-foreground/30"}`}>
                      {selected[p.id] && <Check size={11} className="text-white" />}
                    </div>
                    <input type="checkbox" className="sr-only" checked={!!selected[p.id]}
                      onChange={e => setSelected(s => ({ ...s, [p.id]: e.target.checked }))} />
                    <span className="text-sm font-medium">{p.level} {p.mention?.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{p._count?.students ?? 0} étudiants</span>
                  </label>
                ))}
              </div>
              <button
                disabled={!Object.values(selected).some(Boolean) || copying}
                onClick={copySelected}
                className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {copying ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                Copier les promotions sélectionnées
              </button>
            </>
          )}
          {available.length === 0 && sourceId && (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              Toutes les promotions de {sourceYear?.label} existent déjà dans {targetYear.label}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

const TABS = [
  { key: "overview",   label: "Vue d'ensemble", icon: <BarChart3 size={15} /> },
  { key: "promotions", label: "Promotions",      icon: <GraduationCap size={15} /> },
  { key: "groupes",    label: "Groupes",         icon: <Users size={15} /> },
  { key: "copier",     label: "Réutiliser",      icon: <Copy size={15} /> },
  { key: "assistant",  label: "Ass. promotion",  icon: <Layers size={15} /> },
] as const;

type Tab = typeof TABS[number]["key"];

function AnneeDetailPage() {
  const { id } = Route.useParams();
  const { user, ready } = useRequireClassroom(["SUPER_ADMIN", "STAFF"]);
  const { data: years, isLoading } = useAcademicYears();
  const [tab, setTab] = useState<Tab>("overview");

  if (!ready || !user) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (isLoading) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const year = years?.find(y => y.id === id);
  if (!year) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertTriangle className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium text-muted-foreground">Année introuvable</p>
        <Link to="/classroom/annees" className="mt-3 text-sm text-classroom hover:underline">← Retour aux années</Link>
      </div>
    );
  }

  const status  = deriveYearStatus(year);
  const cfg     = STATUS_CFG[status];
  const readonly = status === "CLOSED" || status === "ARCHIVED";
  const isSuperAdmin = user.systemRole === "SUPER_ADMIN";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <Link to="/classroom/annees" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft size={14} /> Toutes les années
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${year.isCurrent ? "grad-classroom" : "bg-muted"}`}>
            {year.isCurrent ? <Star size={20} className="text-white" fill="currentColor" /> : <Calendar size={20} className="text-muted-foreground" />}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{year.label}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.bgCls} ${cfg.textCls}`}>
                {cfg.icon} {cfg.label}
              </span>
              {readonly && <Lock size={14} className="text-muted-foreground" />}
            </div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(year.startDate), "d MMMM yyyy", { locale: fr })}
              {" → "}
              {format(new Date(year.endDate), "d MMMM yyyy", { locale: fr })}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${tab === t.key ? "bg-white dark:bg-gray-800 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview"   && <TabOverview year={year} status={status} isSuperAdmin={isSuperAdmin} />}
      {tab === "promotions" && <TabPromotions year={year} readonly={readonly} />}
      {tab === "groupes"    && <TabGroupes year={year} />}
      {tab === "copier"     && <TabCopier targetYear={year} years={years ?? []} />}
      {tab === "assistant"  && <TabAssistant currentYear={year} years={years ?? []} />}
    </div>
  );
}
