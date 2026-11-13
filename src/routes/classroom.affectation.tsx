import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Loader2, Trash2, UserCheck, BookOpen, ChevronDown,
  X, Users, Search, CheckCircle2, UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { isMentionResponsible, useRequireClassroom } from "@/components/classroom/shared";
import { AccountResult } from "@/components/account-password";

export const Route = createFileRoute("/classroom/affectation")({ component: AffectationPage });

// ── Types ──────────────────────────────────────────────────────────────────────

type AcYear    = { id: string; label?: string; name?: string; isCurrent?: boolean };
type Mention   = { id: string; name: string; code: string };
type Semester  = { id: string; name: string; number: number; academicYearId?: string };
type Group     = { id: string; name: string };
type Promotion = { id: string; name: string; level: string };
type Teacher   = { userId: string; id: string | null; fullName: string; email: string; specialization: string; subjectsCount: number };
type SubjectWithAssignments = {
  id: string; code: string; name: string; credits: number;
  mention: { name: string } | null;
  teachingUnit: { name: string; code: string; semesterId: string } | null;
  subjectTeachers: {
    id: string; type: string;
    teacher: { id: string; user: { firstName: string; lastName: string } };
    group: { id: string; name: string } | null;
  }[];
};
type Assignment = {
  id: string; type: string;
  subject:  { id: string; code: string; name: string };
  teacher:  { id: string; user: { firstName: string; lastName: string }; mention: { name: string } | null };
  group:    { id: string; name: string } | null;
};

const TYPES = ["CM", "TD", "TP"] as const;
type CourseType = typeof TYPES[number];

const TYPE_COLORS: Record<CourseType, string> = {
  CM: "bg-blue-50 text-blue-700 border-blue-200",
  TD: "bg-amber-50 text-amber-700 border-amber-200",
  TP: "bg-purple-50 text-purple-700 border-purple-200",
};

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useAcYears()   { return useQuery({ queryKey: ["structure","academic-years"], queryFn: () => api<AcYear[]>("/structure/academic-years") }); }
function useMentions()  { return useQuery({ queryKey: ["structure","mentions"], queryFn: () => api<Mention[]>("/structure/mentions") }); }
function useSemesters(yearId?: string) {
  return useQuery({
    queryKey: ["structure","semesters", yearId],
    queryFn: () => yearId
      ? api<Semester[]>(`/structure/academic-years/${yearId}/semesters`)
      : api<Semester[]>("/structure/semesters"),
  });
}
function useGroups(promoId?: string) {
  return useQuery({
    queryKey: ["structure","groups", promoId],
    queryFn: () => api<Group[]>(`/structure/promotions/${promoId}/groups`),
    enabled: !!promoId,
  });
}
function usePromos(menId?: string, yearId?: string) {
  const qs = new URLSearchParams();
  if (menId)  qs.set("mentionId", menId);
  if (yearId) qs.set("academicYearId", yearId);
  return useQuery({
    queryKey: ["structure","promotions", menId, yearId],
    queryFn: () => api<Promotion[]>(`/structure/promotions?${qs}`),
    enabled: !!(menId || yearId),
  });
}
function useSubjectsWithAssignments(mentionId?: string, semesterId?: string) {
  const qs = new URLSearchParams();
  if (mentionId)  qs.set("mentionId",  mentionId);
  if (semesterId) qs.set("semesterId", semesterId);
  return useQuery({
    queryKey: ["affectation","subjects", mentionId, semesterId],
    queryFn: () => api<SubjectWithAssignments[]>(`/affectation/subjects?${qs}`),
    enabled: !!(mentionId || semesterId),
  });
}
// Tous les comptes enseignants (y compris ceux qui n'ont encore aucune matière)
function useTeacherList(q: string) {
  return useQuery({
    queryKey: ["affectation","teachers", q],
    queryFn: () => api<Teacher[]>(`/affectation/teachers?q=${encodeURIComponent(q)}`),
    staleTime: 30_000,
  });
}

const inp = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom";

// ── Création d'un enseignant ───────────────────────────────────────────────────

function NewTeacherForm({ mentionId, onCreated, onCancel }: {
  mentionId?: string; onCreated: (t: Teacher) => void; onCancel: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", specialization: "" });
  const [result, setResult] = useState<{ email: string; temporaryPassword?: string; emailSent?: boolean; teacher: Teacher } | null>(null);
  const create = useMutation({
    mutationFn: () => api<Teacher & { temporaryPassword?: string; emailSent?: boolean }>("/affectation/teachers", { method: "POST", body: { ...f, mentionId } }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["affectation","teachers"] });
      toast.success(`Enseignant créé : ${t.fullName}`);
      setResult({ email: t.email, temporaryPassword: t.temporaryPassword, emailSent: t.emailSent, teacher: t });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (result) {
    return (
      <div className="rounded-xl border bg-muted/20 p-3">
        <AccountResult email={result.email} temporaryPassword={result.temporaryPassword} emailSent={result.emailSent}
          onClose={() => onCreated(result.teacher)} />
      </div>
    );
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form className="space-y-2 rounded-xl border bg-muted/20 p-3"
      onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
      <p className="text-xs font-semibold">Nouvel enseignant</p>
      <div className="grid grid-cols-2 gap-2">
        <input className={inp} placeholder="Prénom *" value={f.firstName} onChange={set("firstName")} required />
        <input className={inp} placeholder="Nom *" value={f.lastName} onChange={set("lastName")} required />
      </div>
      <input className={inp} type="email" placeholder="Adresse e-mail *" value={f.email} onChange={set("email")} required />
      <div className="grid grid-cols-2 gap-2">
        <input className={inp} placeholder="Téléphone" value={f.phone} onChange={set("phone")} />
        <input className={inp} placeholder="Spécialité" value={f.specialization} onChange={set("specialization")} />
      </div>
      <p className="text-[11px] text-muted-foreground">Un e-mail avec l'identifiant et un mot de passe provisoire est envoyé à l'enseignant.</p>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border py-2 text-xs font-medium hover:bg-accent">Annuler</button>
        <button type="submit" disabled={create.isPending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl grad-classroom py-2 text-xs font-semibold text-white disabled:opacity-60">
          {create.isPending ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} Créer l'enseignant
        </button>
      </div>
    </form>
  );
}

// ── Création d'une matière ─────────────────────────────────────────────────────

function NewSubjectModal({ mention, onClose }: { mention: Mention; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ code: "", name: "", credits: 3, weeklyHours: 2 });
  const create = useMutation({
    mutationFn: () => api("/affectation/subjects", { method: "POST", body: { ...f, mentionId: mention.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["affectation","subjects"] });
      qc.invalidateQueries({ queryKey: ["programme","subjects"] });
      toast.success(`Matière « ${f.name} » créée`);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
        className="w-full max-w-md space-y-3 rounded-2xl border bg-card p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Nouvelle matière</h2>
            <p className="text-xs text-muted-foreground">{mention.name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-muted-foreground">Code *
            <input className={`${inp} mt-1`} placeholder="INF101" value={f.code} required
              onChange={(e) => setF((x) => ({ ...x, code: e.target.value }))} />
          </label>
          <label className="col-span-2 text-xs text-muted-foreground">Intitulé *
            <input className={`${inp} mt-1`} placeholder="Algorithmique" value={f.name} required
              onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">Crédits
            <input type="number" min={1} max={30} className={`${inp} mt-1`} value={f.credits}
              onChange={(e) => setF((x) => ({ ...x, credits: +e.target.value }))} />
          </label>
          <label className="text-xs text-muted-foreground">Heures / semaine
            <input type="number" min={0.5} step={0.5} className={`${inp} mt-1`} value={f.weeklyHours}
              onChange={(e) => setF((x) => ({ ...x, weeklyHours: +e.target.value }))} />
          </label>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-medium hover:bg-accent">Annuler</button>
          <button type="submit" disabled={create.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer la matière
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Shared select ──────────────────────────────────────────────────────────────

function Sel({ label, value, onChange, options, disabled, placeholder }: {
  label?: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean; placeholder?: string;
}) {
  return (
    <div>
      {label && <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>}
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          className="w-full appearance-none rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-classroom disabled:opacity-50">
          <option value="">{placeholder ?? `— ${label ?? "Choisir"} —`}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

// ── Assign modal ───────────────────────────────────────────────────────────────

function AssignModal({
  subject, mentionId, onClose,
}: {
  subject: SubjectWithAssignments;
  mentionId?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [type,      setType]      = useState<CourseType>("CM");
  const [teacherQ,  setTeacherQ]  = useState("");
  const [selTeacher, setSelTeacher] = useState<Teacher | null>(null);
  const [creatingTeacher, setCreatingTeacher] = useState(false);
  const [listOpen,  setListOpen]  = useState(false);
  const [promoId,   setPromoId]   = useState("");
  const [grpId,     setGrpId]     = useState("");

  const teachers = useTeacherList(teacherQ);
  const promos   = usePromos(mentionId);
  const groups   = useGroups(promoId || undefined);

  const assign = useMutation({
    mutationFn: (body: unknown) => api("/affectation", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["affectation"] });
      qc.invalidateQueries({ queryKey: ["cursus"] });
      toast.success("Affectation enregistrée");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    if (!selTeacher) return toast.error("Sélectionnez un enseignant");
    assign.mutate({
      subjectId: subject.id, groupId: grpId || undefined, type,
      ...(selTeacher.id ? { teacherId: selTeacher.id } : { teacherUserId: selTeacher.userId }),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><UserCheck size={16} className="text-classroom" /> Affecter un enseignant</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{subject.code} — {subject.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Type */}
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Type de séance</label>
            <div className="flex gap-2">
              {TYPES.map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition-all ${type === t ? TYPE_COLORS[t] : "hover:bg-accent"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Teacher search */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Enseignant</label>
            {selTeacher ? (
              <div className="flex items-center gap-3 rounded-xl bg-classroom/10 border border-classroom/30 px-3 py-2">
                <UserCheck size={14} className="text-classroom shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-classroom">{selTeacher.fullName}</p>
                  <p className="text-xs text-muted-foreground">{selTeacher.specialization}</p>
                </div>
                <button onClick={() => { setSelTeacher(null); setTeacherQ(""); }} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
              </div>
            ) : creatingTeacher ? (
              <NewTeacherForm mentionId={mentionId}
                onCreated={(t) => { setSelTeacher(t); setCreatingTeacher(false); }}
                onCancel={() => setCreatingTeacher(false)} />
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3.5 text-muted-foreground" />
                  <input value={teacherQ} onChange={(e) => { setTeacherQ(e.target.value); setListOpen(true); }}
                    onFocus={() => setListOpen(true)}
                    placeholder="Rechercher ou choisir un enseignant…"
                    className="w-full rounded-xl border bg-background pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-classroom" />
                </div>
                {listOpen && (
                  <div className="max-h-56 overflow-y-auto rounded-xl border bg-card">
                    {teachers.isLoading ? (
                      <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-muted-foreground" /></div>
                    ) : (teachers.data ?? []).length === 0 ? (
                      <p className="px-4 py-3 text-xs text-muted-foreground">
                        {teacherQ ? "Aucun enseignant ne correspond." : "Aucun compte enseignant pour le moment."}
                      </p>
                    ) : (teachers.data ?? []).map((t) => (
                      <button key={t.userId} type="button" onClick={() => { setSelTeacher(t); setTeacherQ(""); setListOpen(false); }}
                        className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left text-sm last:border-0 hover:bg-accent">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full grad-classroom text-[10px] font-bold text-white">
                          {t.fullName.slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{t.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">{t.specialization} · {t.subjectsCount} matière(s)</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setCreatingTeacher(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-classroom hover:underline">
                  <UserPlus size={12} /> Créer un nouvel enseignant
                </button>
              </div>
            )}
          </div>

          {/* Group (optional) */}
          <Sel label="Groupe (optionnel — pour TD/TP)" value={grpId} onChange={setGrpId}
            options={(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
            disabled={!promoId} placeholder="— Aucun groupe —" />
          {!promoId && (
            <Sel label="Promotion (pour filtrer les groupes)" value={promoId} onChange={(v) => { setPromoId(v); setGrpId(""); }}
              options={(promos.data ?? []).map((p) => ({ value: p.id, label: `${p.name} · ${p.level}` }))}
              placeholder="— Choisir une promotion —" />
          )}
        </div>

        <div className="border-t px-5 py-4 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-medium hover:bg-accent">Annuler</button>
          <button onClick={submit} disabled={assign.isPending || !selTeacher}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
            {assign.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Affecter
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ligne de matière dépliable ────────────────────────────────────────────────

function SubjectRow({ subject, mentionId }: { subject: SubjectWithAssignments; mentionId: string }) {
  const qc = useQueryClient();
  const [open, setOpen]   = useState(false);
  const [modal, setModal] = useState(false);

  const remove = useMutation({
    mutationFn: (id: string) => api(`/affectation/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["affectation"] });
      qc.invalidateQueries({ queryKey: ["cursus"] });
      toast.success("Affectation supprimée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const teachers = [...new Set(subject.subjectTeachers.map((st) => `${st.teacher.user.lastName.toUpperCase()} ${st.teacher.user.firstName}`))];

  return (
    <div className="border-b last:border-0">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30">
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
        <BookOpen size={15} className="shrink-0 text-classroom" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{subject.name}</p>
          <p className="text-xs text-muted-foreground">{subject.code} · {subject.credits} crédits{subject.teachingUnit ? ` · UE ${subject.teachingUnit.code}` : ""}</p>
        </div>
        {teachers.length ? (
          <span className="hidden max-w-[40%] truncate text-xs text-muted-foreground sm:block">{teachers.join(", ")}</span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Non attribuée</span>
        )}
      </button>
      {open && (
        <div className="space-y-2 bg-muted/20 px-4 pb-4 pl-12">
          {subject.subjectTeachers.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">Aucun enseignant n'est encore attribué à cette matière.</p>
          ) : subject.subjectTeachers.map((st) => (
            <div key={st.id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2">
              <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${TYPE_COLORS[st.type as CourseType] ?? ""}`}>{st.type}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{st.teacher.user.lastName.toUpperCase()} {st.teacher.user.firstName}</p>
                {st.group && <p className="text-xs text-muted-foreground">{st.group.name}</p>}
              </div>
              <button onClick={() => remove.mutate(st.id)} disabled={remove.isPending}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
            </div>
          ))}
          <button onClick={() => setModal(true)}
            className="flex items-center gap-1.5 rounded-xl grad-classroom px-3 py-1.5 text-xs font-semibold text-white">
            <Plus size={12} /> Attribuer à un enseignant
          </button>
        </div>
      )}
      {modal && <AssignModal subject={subject} mentionId={mentionId} onClose={() => setModal(false)} />}
    </div>
  );
}

// ── Mention dépliable ──────────────────────────────────────────────────────────

function MentionBlock({ mention, q, defaultOpen, canCreate }: { mention: Mention; q: string; defaultOpen: boolean; canCreate: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [newSubject, setNewSubject] = useState(false);
  const subjects = useSubjectsWithAssignments(open ? mention.id : undefined);
  const list = (subjects.data ?? []).filter((s) =>
    !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.code.toLowerCase().includes(q.toLowerCase()));
  const unassigned = list.filter((s) => !s.subjectTeachers.length).length;
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 border-b bg-muted/20 px-4 py-3 text-left">
        <ChevronDown size={15} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
        <span className="font-semibold">{mention.name}</span>
        {open && subjects.data && (
          <span className="ml-auto text-xs text-muted-foreground">
            {list.length} matière(s){unassigned ? ` · ${unassigned} non attribuée(s)` : ""}
          </span>
        )}
      </button>
      {open && (
        subjects.isLoading ? (
          <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {list.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {q ? "Aucune matière ne correspond à la recherche." : "Aucune matière pour cette mention : créez-en une, ou planifiez un cours dans « Cursus universitaire »."}
              </p>
            ) : list.map((s) => <SubjectRow key={s.id} subject={s} mentionId={mention.id} />)}
            {canCreate && (
              <div className="border-t px-4 py-3">
                <button onClick={() => setNewSubject(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-accent">
                  <Plus size={12} /> Nouvelle matière
                </button>
              </div>
            )}
          </>
        )
      )}
      {newSubject && <NewSubjectModal mention={mention} onClose={() => setNewSubject(false)} />}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AffectationPage() {
  const { user, roles, ready } = useRequireClassroom(["SUPER_ADMIN", "STAFF"]);
  const [q, setQ] = useState("");
  const years    = useAcYears();
  const mentions = useMentions();

  if (!ready || !user) return null;

  // Le Responsable Pédagogique ne voit que sa mention ; l'année suivie est l'année en cours.
  const scopeMentionId = isMentionResponsible(roles?.[0]?.roleName) ? roles?.[0]?.scope?.mentionId ?? null : null;
  const list = (mentions.data ?? []).filter((m) => !scopeMentionId || m.id === scopeMentionId);
  const current = (years.data ?? []).find((y) => y.isCurrent);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Affectation des matières</h1>
          <p className="text-sm text-muted-foreground">
            Cliquez sur une matière pour l'attribuer à un enseignant. Les cours planifiés dans « Cursus universitaire » y figurent aussi · année {current?.label ?? "en cours"}
          </p>
        </div>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une matière…"
            className="w-full rounded-xl border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-classroom" />
        </div>
      </div>

      {mentions.isLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center text-muted-foreground/60">
          <Users size={40} className="mb-3 opacity-30" />
          <p className="font-medium text-muted-foreground">Aucune mention</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((m) => <MentionBlock key={m.id} mention={m} q={q} defaultOpen={list.length === 1} canCreate />)}
        </div>
      )}
    </div>
  );
}
