import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Loader2, UserPlus, Users, GraduationCap,
  ChevronDown, CheckCircle2, XCircle, AlertTriangle, X,
  UserCheck, MoreHorizontal, Filter,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useRequireClassroom } from "@/components/classroom/shared";
import { STUDY_MODES, StudyModeBadge, StudyModePicker, type StudyMode } from "@/components/classroom/study-mode";

export const Route = createFileRoute("/classroom/inscription")({ component: InscriptionPage });

// ── Types ──────────────────────────────────────────────────────────────────────

type AcYear     = { id: string; label?: string; name?: string };
type Mention    = { id: string; name: string; code: string };
type Promotion  = { id: string; name: string; level: string; academicYear?: { id: string; label: string } | null };
type Group      = { id: string; name: string; _count?: { students: number } };
type StudentProfile = {
  id: string; matricule: string; status: string; enrollmentDate: string; studyMode: StudyMode;
  user: { id: string; firstName: string; lastName: string; email: string; phone?: string | null; avatarUrl?: string | null };
  promotion?: { id: string; name: string; level: string; academicYear?: { label: string } | null } | null;
  group?:     { id: string; name: string } | null;
  mention?:   { id: string; name: string; code: string } | null;
};
type UnenrolledUser = { id: string; firstName: string; lastName: string; email: string };
type Stats = { total: number; active: number; online: number; presentiel: number; byStatus: { status: string; _count: { _all: number } }[] };

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ACTIVE:      { label: "Actif",        cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  SUSPENDED:   { label: "Suspendu",     cls: "bg-amber-50 text-amber-700 border-amber-200" },
  GRADUATED:   { label: "Diplômé",      cls: "bg-blue-50 text-blue-700 border-blue-200" },
  DROPPED_OUT: { label: "Abandonné",    cls: "bg-red-50 text-red-700 border-red-200" },
  TRANSFERRED: { label: "Transféré",    cls: "bg-purple-50 text-purple-700 border-purple-200" },
};

// ── API hooks ──────────────────────────────────────────────────────────────────

function useStudents(filters: { academicYearId?: string; mentionId?: string; promotionId?: string; groupId?: string; status?: string; studyMode?: string; q?: string; page?: number }) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
  return useQuery({
    queryKey: ["inscriptions", filters],
    queryFn: () => api<{ total: number; page: number; limit: number; items: StudentProfile[] }>(`/inscriptions?${qs}`),
  });
}
function useStats(yearId?: string) {
  return useQuery({
    queryKey: ["inscriptions-stats", yearId],
    queryFn: () => api<Stats>(`/inscriptions/stats${yearId ? `?academicYearId=${yearId}` : ""}`),
  });
}
function useAcYears() { return useQuery({ queryKey: ["structure","academic-years"], queryFn: () => api<AcYear[]>("/structure/academic-years") }); }
function useMentions() { return useQuery({ queryKey: ["structure","mentions"], queryFn: () => api<Mention[]>("/structure/mentions") }); }
function usePromos(mentionId?: string, yearId?: string) {
  const qs = new URLSearchParams();
  if (mentionId) qs.set("mentionId", mentionId);
  if (yearId)    qs.set("academicYearId", yearId);
  return useQuery({
    queryKey: ["structure","promotions", mentionId, yearId],
    queryFn: () => api<Promotion[]>(`/structure/promotions?${qs}`),
    enabled: !!(mentionId || yearId),
  });
}
function useGroups(promoId?: string) {
  return useQuery({
    queryKey: ["structure","groups", promoId],
    queryFn: () => api<Group[]>(`/structure/promotions/${promoId}/groups`),
    enabled: !!promoId,
  });
}
function useUnenrolled(q: string) {
  return useQuery({
    queryKey: ["inscriptions-unenrolled", q],
    queryFn: () => api<UnenrolledUser[]>(`/inscriptions/unenrolled?q=${encodeURIComponent(q)}`),
  });
}

// ── Shared select ──────────────────────────────────────────────────────────────

function Sel({ label, value, onChange, options, disabled, required }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean; required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          className="w-full appearance-none rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-classroom disabled:opacity-50">
          <option value="">— {label} —</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

// ── Enrollment modal ───────────────────────────────────────────────────────────

function EnrollModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"new" | "existing">("new");

  // Form — new student
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });

  // Cascade
  const [yearId,  setYearId]  = useState("");
  const [menId,   setMenId]   = useState("");
  const [proId,   setProId]   = useState("");
  const [grpId,   setGrpId]   = useState("");
  const [scholarship, setScholarship] = useState(false);
  const [studyMode, setStudyMode] = useState<StudyMode>("PRESENTIEL");

  const years  = useAcYears();
  const ments  = useMentions();
  const promos = usePromos(menId || undefined, yearId || undefined);
  const groups = useGroups(proId || undefined);

  // Existing user search
  const [existQ, setExistQ] = useState("");
  const [selUser, setSelUser] = useState<UnenrolledUser | null>(null);
  const unenrolled = useUnenrolled(existQ);

  // Mot de passe provisoire généré par le serveur : affiché une seule fois.
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const enroll = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ temporaryPassword?: string }>(tab === "new" ? "/inscriptions" : "/inscriptions/existing", { method: "POST", body }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["inscriptions"] });
      qc.invalidateQueries({ queryKey: ["inscriptions-stats"] });
      toast.success("Inscription créée avec succès");
      if (created.temporaryPassword) setTempPassword(created.temporaryPassword);
      else onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    if (!proId) return toast.error("Sélectionnez une promotion");
    if (tab === "new") {
      if (!form.firstName || !form.lastName || !form.email) return toast.error("Prénom, nom et e-mail requis");
      enroll.mutate({ ...form, promotionId: proId, groupId: grpId || undefined, mentionId: menId || undefined, scholarship, studyMode });
    } else {
      if (!selUser) return toast.error("Sélectionnez un utilisateur");
      enroll.mutate({ userId: selUser.id, promotionId: proId, groupId: grpId || undefined, mentionId: menId || undefined, scholarship, studyMode });
    }
  }

  if (tempPassword) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-2xl">
          <h2 className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} className="text-emerald-600" /> Étudiant inscrit</h2>
          <p className="text-sm text-muted-foreground">
            Mot de passe provisoire à transmettre à l'étudiant. Il ne sera plus affiché : notez-le maintenant.
          </p>
          <code className="block select-all rounded-xl bg-muted px-4 py-3 text-center font-mono text-base">{tempPassword}</code>
          <button onClick={onClose} className="w-full rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white hover:opacity-90">
            C'est noté
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-card border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold flex items-center gap-2"><UserPlus size={18} className="text-classroom" /> Nouvelle inscription</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        {/* Tab */}
        <div className="flex border-b">
          {([["new","Nouveau étudiant"],["existing","Utilisateur existant"]] as const).map(([t, lbl]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${tab === t ? "border-b-2 border-classroom text-classroom" : "text-muted-foreground hover:text-foreground"}`}>
              {lbl}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {tab === "new" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Prénom <span className="text-red-500">*</span></label>
                  <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom"
                    placeholder="Prénom" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Nom <span className="text-red-500">*</span></label>
                  <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom"
                    placeholder="Nom de famille" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail <span className="text-red-500">*</span></label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom"
                  placeholder="etudiant@ur.mg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Téléphone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom"
                    placeholder="+261 XX XX XXX XX" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Mot de passe temporaire</label>
                  <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom"
                    placeholder="Vide = généré automatiquement" />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Rechercher un utilisateur</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3.5 text-muted-foreground" />
                <input value={existQ} onChange={(e) => setExistQ(e.target.value)}
                  className="w-full rounded-xl border bg-background pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom"
                  placeholder="Nom, prénom ou e-mail…" />
              </div>
              {selUser && (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-classroom/10 border border-classroom/30 px-3 py-2 text-sm">
                  <UserCheck size={14} className="text-classroom shrink-0" />
                  <span className="font-medium text-classroom">{selUser.lastName.toUpperCase()} {selUser.firstName}</span>
                  <button onClick={() => setSelUser(null)} className="ml-auto text-muted-foreground hover:text-foreground"><X size={13} /></button>
                </div>
              )}
              {!selUser && (unenrolled.data ?? []).length > 0 && (
                <div className="mt-1 rounded-xl border bg-card shadow-sm overflow-hidden">
                  {(unenrolled.data ?? []).map((u) => (
                    <button key={u.id} onClick={() => { setSelUser(u); setExistQ(""); }}
                      className="flex w-full items-center gap-3 border-b last:border-0 px-4 py-2.5 text-left text-sm hover:bg-accent">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full grad-classroom text-[10px] font-bold text-white">
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <div>
                        <div className="font-medium">{u.lastName.toUpperCase()} {u.firstName}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <hr className="my-1" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Affectation académique</p>

          <Sel label="Année universitaire" value={yearId} onChange={(v) => { setYearId(v); setMenId(""); setProId(""); setGrpId(""); }}
            options={(years.data ?? []).map((y) => ({ value: y.id, label: y.label ?? y.name ?? y.id }))} />
          <Sel label="Mention" value={menId} onChange={(v) => { setMenId(v); setProId(""); setGrpId(""); }} disabled={!yearId}
            options={(ments.data ?? []).map((m) => ({ value: m.id, label: `${m.name} (${m.code})` }))} required />
          <Sel label="Promotion" value={proId} onChange={(v) => { setProId(v); setGrpId(""); }} disabled={!menId}
            options={(promos.data ?? []).map((p) => ({ value: p.id, label: `${p.name} — ${p.level}` }))} required />
          <Sel label="Groupe (optionnel)" value={grpId} onChange={setGrpId} disabled={!proId}
            options={(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))} />

          <StudyModePicker value={studyMode} onChange={setStudyMode} />

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={scholarship} onChange={(e) => setScholarship(e.target.checked)}
              className="h-4 w-4 rounded accent-classroom" />
            Étudiant boursier
          </label>
        </div>

        <div className="border-t px-5 py-4 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-medium hover:bg-accent">Annuler</button>
          <button onClick={submit} disabled={enroll.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
            {enroll.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Inscrire
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status change modal ────────────────────────────────────────────────────────

function StatusModal({ profile, onClose }: { profile: StudentProfile; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(profile.status);
  const [studyMode, setStudyMode] = useState<StudyMode>(profile.studyMode);
  const [notes,  setNotes]  = useState("");

  const update = useMutation({
    mutationFn: () => api(`/inscriptions/${profile.id}`, { method: "PATCH", body: { status, studyMode, notes: notes || undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inscriptions"] });
      qc.invalidateQueries({ queryKey: ["inscriptions-stats"] });
      toast.success("Inscription mise à jour");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-card border shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Modifier l'inscription</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <p className="text-sm text-muted-foreground">{profile.user.lastName.toUpperCase()} {profile.user.firstName} — {profile.matricule}</p>

        <StudyModePicker value={studyMode} onChange={setStudyMode} />

        <p className="text-xs font-medium text-muted-foreground">Statut</p>
        <div className="grid grid-cols-1 gap-2">
          {Object.entries(STATUS_LABELS).map(([k, { label, cls }]) => (
            <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-all ${status === k ? cls : "hover:bg-accent"}`}>
              <input type="radio" name="status" value={k} checked={status === k} onChange={() => setStatus(k)} className="sr-only" />
              <div className={`h-2 w-2 rounded-full ${status === k ? "bg-current" : "bg-gray-300"}`} />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Note (optionnel)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom resize-none"
            placeholder="Motif du changement…" />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-medium hover:bg-accent">Annuler</button>
          <button onClick={() => update.mutate()} disabled={update.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white hover:opacity-90">
            {update.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function InscriptionPage() {
  const { user, ready } = useRequireClassroom(["SUPER_ADMIN", "STAFF"]);

  const [yearId,   setYearId]   = useState("");
  const [menId,    setMenId]    = useState("");
  const [proId,    setProId]    = useState("");
  const [grpId,    setGrpId]    = useState("");
  const [statusF,  setStatusF]  = useState("");
  const [modeF,    setModeF]    = useState("");
  const [q,        setQ]        = useState("");
  const [page,     setPage]     = useState(1);
  const [showModal,setModal]    = useState(false);
  const [editProfile, setEdit]  = useState<StudentProfile | null>(null);

  const years  = useAcYears();
  const ments  = useMentions();
  const promos = usePromos(menId || undefined, yearId || undefined);
  const groups = useGroups(proId || undefined);
  const stats  = useStats(yearId || undefined);

  const students = useStudents({ academicYearId: yearId || undefined, mentionId: menId || undefined,
    promotionId: proId || undefined, groupId: grpId || undefined, status: statusF || undefined,
    studyMode: modeF || undefined, q: q || undefined, page });

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => setPage(1), 400); return () => clearTimeout(t); }, [q]);

  if (!ready || !user) return null;

  const data  = students.data;
  const total = data?.total ?? 0;
  const pages = Math.ceil(total / (data?.limit ?? 30));

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inscriptions</h1>
          <p className="text-sm text-muted-foreground">Gérez les inscriptions académiques des étudiants</p>
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-2 rounded-xl grad-classroom px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
          <UserPlus size={16} /> Nouvelle inscription
        </button>
      </div>

      {/* Stats cards */}
      {stats.data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">Total inscrits</p>
            <p className="text-3xl font-bold text-foreground">{stats.data.total}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">Actifs</p>
            <p className="text-3xl font-bold text-emerald-600">{stats.data.active}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">Présentiel</p>
            <p className="text-3xl font-bold text-amber-600">{stats.data.presentiel}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">En ligne</p>
            <p className="text-3xl font-bold text-sky-600">{stats.data.online}</p>
          </div>
          {stats.data.byStatus.map((s) => {
            if (s.status === "ACTIVE") return null;
            const info = STATUS_LABELS[s.status];
            return (
              <div key={s.status} className="rounded-2xl border bg-card p-4 shadow-sm">
                <p className="text-xs text-muted-foreground mb-1">{info?.label ?? s.status}</p>
                <p className="text-3xl font-bold">{s._count._all}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-3.5 text-muted-foreground" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par nom, matricule, e-mail…"
            className="w-full rounded-xl border bg-background pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom" />
          {q && <button onClick={() => setQ("")} className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground"><X size={13} /></button>}
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <select value={yearId} onChange={(e) => { setYearId(e.target.value); setMenId(""); setProId(""); setGrpId(""); setPage(1); }}
              className="appearance-none rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-classroom">
              <option value="">Toutes les années</option>
              {(years.data ?? []).map((y) => <option key={y.id} value={y.id}>{y.label ?? y.name ?? y.id}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2 top-3.5 text-muted-foreground" />
          </div>

          <div className="relative">
            <select value={menId} onChange={(e) => { setMenId(e.target.value); setProId(""); setGrpId(""); setPage(1); }}
              className="appearance-none rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-classroom">
              <option value="">Toutes les mentions</option>
              {(ments.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2 top-3.5 text-muted-foreground" />
          </div>

          {menId && (
            <div className="relative">
              <select value={proId} onChange={(e) => { setProId(e.target.value); setGrpId(""); setPage(1); }}
                className="appearance-none rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-classroom">
                <option value="">Toutes les promotions</option>
                {(promos.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} — {p.level}</option>)}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2 top-3.5 text-muted-foreground" />
            </div>
          )}

          {proId && (
            <div className="relative">
              <select value={grpId} onChange={(e) => { setGrpId(e.target.value); setPage(1); }}
                className="appearance-none rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-classroom">
                <option value="">Tous les groupes</option>
                {(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2 top-3.5 text-muted-foreground" />
            </div>
          )}

          <div className="relative">
            <select value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }}
              className="appearance-none rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-classroom">
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_LABELS).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2 top-3.5 text-muted-foreground" />
          </div>

          <div className="relative">
            <select value={modeF} onChange={(e) => { setModeF(e.target.value); setPage(1); }} aria-label="Filtrer par mode d'étude"
              className="appearance-none rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-classroom">
              <option value="">Présentiel et en ligne</option>
              {STUDY_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2 top-3.5 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden flex flex-col">
        {students.isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (data?.items ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
            <Users size={40} className="mb-3 opacity-30" />
            <p className="font-medium text-muted-foreground">Aucun étudiant trouvé</p>
            <p className="text-xs mt-1">Modifiez les filtres ou inscrivez un nouvel étudiant</p>
          </div>
        ) : (
          <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: "calc(100vh - 28rem)" }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-muted/30 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide backdrop-blur-sm">
                  <th className="px-4 py-3">Étudiant</th>
                  <th className="px-4 py-3">Matricule</th>
                  <th className="px-4 py-3">Mention / Promo</th>
                  <th className="px-4 py-3">Groupe</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((s) => {
                  const st = STATUS_LABELS[s.status];
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full grad-classroom text-[11px] font-bold text-white">
                            {s.user.firstName[0]}{s.user.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium">{s.user.lastName.toUpperCase()} {s.user.firstName}</p>
                            <p className="text-xs text-muted-foreground">{s.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{s.matricule}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.mention?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{s.promotion?.name} {s.promotion?.level ? `· ${s.promotion.level}` : ""}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.group?.name ?? <span className="text-muted-foreground/40">—</span>}</td>
                      <td className="px-4 py-3"><StudyModeBadge mode={s.studyMode} /></td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${st?.cls}`}>{st?.label ?? s.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setEdit(s)}
                          className="rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
                          Modifier
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">{total} étudiant{total !== 1 ? "s" : ""}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40">Préc.</button>
              <span className="rounded-lg border px-3 py-1.5 text-xs font-medium bg-muted/30">{page} / {pages}</span>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40">Suiv.</button>
            </div>
          </div>
        )}
      </div>

      {showModal && <EnrollModal onClose={() => setModal(false)} />}
      {editProfile && <StatusModal profile={editProfile} onClose={() => setEdit(null)} />}
    </div>
  );
}
