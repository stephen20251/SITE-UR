import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Loader2, Building2, GraduationCap, BookOpen, Users, Mail, TrendingUp, Calendar, CreditCard, Camera, Pen, Trash2, Upload, UserRound, Phone, Pencil, Save, X, Clock, ShieldCheck, LifeBuoy, FileText, CheckCircle2, AlertCircle, Award } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import { studyModeLabel } from "@/components/classroom/study-mode";
import { ChangePasswordCard } from "@/components/account-password";
import { useMyContext, isStudentCtx, isTeacherCtx, isParentCtx, isStaffCtx, isAdminCtx, type MyContext, type TeacherCtx } from "@/lib/context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, tokenStore } from "@/lib/api";
import { ACADEMIC_TITLES, openCv, titleLabel } from "@/lib/faculty";
import { toast } from "sonner";
import { API_ORIGIN } from "@/lib/env";

const API_URL = API_ORIGIN;

export const Route = createFileRoute("/classroom/profile")({ component: ProfilePage });

// ── Avatar upload ──────────────────────────────────────────────────────────────

function AvatarUpload({ currentUrl, initials, onUpdate }: { currentUrl?: string | null; initials: string; onUpdate: () => void }) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const qc        = useQueryClient();
  const userId    = tokenStore.getUser()?.id;
  const [loading, setLoading] = useState(false);

  async function upload(file: File) {
    setLoading(true);
    const fd = new FormData();
    fd.append("avatar", file);
    try {
      const r = await fetch(`${API_URL}/api/me/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenStore.access}` },
        body: fd,
      });
      if (!r.ok) throw new Error(await r.text());
      qc.invalidateQueries({ queryKey: ["me", "context", userId] });
      onUpdate();
      toast.success("Photo mise à jour");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur upload");
    } finally { setLoading(false); }
  }

  async function remove() {
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/me/avatar`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenStore.access}` },
      });
      qc.invalidateQueries({ queryKey: ["me", "context", userId] });
      onUpdate();
      toast.success("Photo supprimée");
    } catch { toast.error("Erreur"); }
    finally { setLoading(false); }
  }

  const src = currentUrl ? (currentUrl.startsWith("http") ? currentUrl : `${API_URL}${currentUrl}`) : null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative group">
        {src ? (
          <img src={src} alt="Avatar" className="h-24 w-24 rounded-2xl object-cover border-2 border-white/20" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/20 backdrop-blur text-3xl font-bold text-white">
            {initials}
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        )}
        <button
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/0 opacity-0 group-hover:opacity-100 group-hover:bg-black/40 transition-all"
        >
          <Camera className="h-6 w-6 text-white" />
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      <div className="flex gap-1">
        <button onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 px-2 py-1 text-xs text-white transition-colors">
          <Upload size={11} /> {src ? "Changer la photo" : "Ajouter une photo"}
        </button>
        {src && (
          <button onClick={remove}
            className="flex items-center gap-1 rounded-lg bg-red-500/20 hover:bg-red-500/40 px-2 py-1 text-xs text-white transition-colors">
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Signature upload ───────────────────────────────────────────────────────────

function SignatureUpload({ currentUrl, onUpdate }: { currentUrl?: string | null; onUpdate: () => void }) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const qc        = useQueryClient();
  const userId    = tokenStore.getUser()?.id;
  const [loading, setLoading] = useState(false);

  async function upload(file: File) {
    setLoading(true);
    const fd = new FormData();
    fd.append("signature", file);
    try {
      const r = await fetch(`${API_URL}/api/me/signature`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenStore.access}` },
        body: fd,
      });
      if (!r.ok) throw new Error(await r.text());
      qc.invalidateQueries({ queryKey: ["me", "context", userId] });
      onUpdate();
      toast.success("Signature enregistrée");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur upload"); }
    finally { setLoading(false); }
  }

  async function remove() {
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/me/signature`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenStore.access}` },
      });
      qc.invalidateQueries({ queryKey: ["me", "context", userId] });
      onUpdate();
      toast.success("Signature supprimée");
    } catch { toast.error("Erreur"); }
    finally { setLoading(false); }
  }

  const src = currentUrl ? (currentUrl.startsWith("http") ? currentUrl : `${API_URL}${currentUrl}`) : null;

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-elegant">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-classroom/10 text-classroom"><Pen size={14} /></span>
        <h3 className="font-semibold text-sm">Signature manuscrite</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Utilisée sur les documents officiels (attestations, relevés de notes, lettres administratives).
      </p>
      {src ? (
        <div className="mb-3">
          <img src={src} alt="Signature" className="max-h-24 max-w-full border rounded-lg bg-white p-2 object-contain" />
        </div>
      ) : (
        <div className="mb-3 flex h-20 items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground/50">
          <p className="text-xs">Aucune signature</p>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      <div className="flex gap-2">
        <button onClick={() => inputRef.current?.click()} disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload size={12} />}
          {src ? "Remplacer" : "Téléverser"}
        </button>
        {src && !loading && (
          <button onClick={remove}
            className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 size={12} /> Supprimer
          </button>
        )}
      </div>
    </div>
  );
}

// ── Dossier académique de l'enseignant : titre, diplôme et CV (PDF) ───────────

function AcademicDossier({ teacher, onSaved }: { teacher: TeacherCtx; onSaved: () => void }) {
  const p = teacher.profile;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [academicTitle, setAcademicTitle] = useState<string>(p.academicTitle ?? "");
  const [highestDegree, setHighestDegree] = useState(p.highestDegree ?? "");
  const [yearsExperience, setYearsExperience] = useState(p.yearsExperience?.toString() ?? "");
  const listed = Boolean(p.academicTitle && p.cvFileName);
  const input = "w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-classroom/30";

  async function upload(file: File) {
    if (file.type !== "application/pdf") return toast.error("Le CV doit être un fichier PDF");
    if (file.size > 10 * 1024 * 1024) return toast.error("Le CV ne doit pas dépasser 10 Mo");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("cv", file);
      await api("/faculty/me/cv", { method: "POST", body: fd, raw: true });
      toast.success(p.cvFileName ? "CV remplacé" : "CV déposé");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Dépôt impossible");
    } finally { setUploading(false); }
  }

  async function remove() {
    if (!confirm("Retirer votre CV ? Votre fiche ne sera plus visible dans « Corps enseignant ».")) return;
    setUploading(true);
    try {
      await api("/faculty/me/cv", { method: "DELETE" });
      toast.success("CV retiré");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Suppression impossible");
    } finally { setUploading(false); }
  }

  async function view() {
    try {
      await openCv("/faculty/me/cv");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible d'ouvrir le CV");
    }
  }

  async function save() {
    setSaving(true);
    try {
      await api("/me/profile", { method: "PATCH", body: { academicTitle: academicTitle || null, highestDegree, yearsExperience: yearsExperience === "" ? null : Number(yearsExperience) } });
      toast.success("Dossier académique enregistré");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Enregistrement impossible");
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-elegant">
      <div className="mb-3 flex items-center gap-2 border-b pb-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-classroom/10 text-classroom"><Award size={14} /></span>
        <h3 className="text-sm font-semibold">Mon dossier académique et mon CV</h3>
      </div>

      <div className={`mb-4 flex items-start gap-2 rounded-xl p-3 text-xs ${listed ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"}`}>
        {listed ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
        <span>
          {listed
            ? <>Votre fiche de {titleLabel(p.academicTitle)?.toLowerCase()} est visible dans « Corps enseignant » par les étudiants inscrits et leurs parents, avec votre CV.</>
            : <>Votre fiche n'est pas encore visible. Il manque : {[!p.academicTitle && "votre titre (Professeur ou Docteur)", !p.cvFileName && "votre CV en PDF"].filter(Boolean).join(" et ")}.</>}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-muted-foreground">Titre académique
          <select className={`${input} mt-1`} value={academicTitle} onChange={(e) => setAcademicTitle(e.target.value)}>
            <option value="">— Non renseigné —</option>
            {ACADEMIC_TITLES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">Années d'expérience
          <input type="number" min={0} max={70} className={`${input} mt-1`} value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} placeholder="Ex. 12" />
        </label>
        <label className="text-xs font-medium text-muted-foreground sm:col-span-2">Diplôme le plus élevé
          <input className={`${input} mt-1`} value={highestDegree} onChange={(e) => setHighestDegree(e.target.value)} placeholder="Ex. Doctorat en informatique, Université d'Antananarivo, 2015" />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-classroom px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Enregistrer
        </button>
      </div>

      <div className="mt-4 border-t pt-4">
        <p className="text-xs font-medium text-muted-foreground">Curriculum vitae (PDF, 10 Mo maximum)</p>
        {p.cvFileName ? (
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border p-3">
            <FileText size={18} className="shrink-0 text-classroom" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.cvFileName}</p>
              {p.cvUpdatedAt && <p className="text-xs text-muted-foreground">Déposé le {fmtDay(p.cvUpdatedAt)}</p>}
            </div>
            <button onClick={view} className="rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-accent">Voir</button>
          </div>
        ) : (
          <div className="mt-2 flex h-16 items-center justify-center rounded-xl border-2 border-dashed text-xs text-muted-foreground/70">Aucun CV déposé</div>
        )}
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        <div className="mt-3 flex gap-2">
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50">
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {p.cvFileName ? "Remplacer le CV" : "Télécharger mon CV"}
          </button>
          {p.cvFileName && !uploading && (
            <button onClick={remove} className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
              <Trash2 size={12} /> Retirer
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Ce PDF sera lu par les étudiants et les parents : retirez-en vos coordonnées personnelles (adresse, téléphone privé).
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, always = false }: { label: string; value: string | null | undefined; always?: boolean }) {
  if (!value && !always) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <span className="w-36 shrink-0 text-xs text-muted-foreground">{label}</span>
      {value
        ? <span className="text-sm font-medium text-foreground whitespace-pre-line">{value}</span>
        : <span className="text-sm italic text-muted-foreground/70">Non renseigné</span>}
    </div>
  );
}

const fmtDay = (d?: string | null, withTime = false) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }) : null;

// ── Mes informations : coordonnées + champs modifiables selon le rôle ─────────

type MentionOpt = { id: string; name: string };
type FormState = { phone: string; specialization: string; office: string; bio: string; mentionId: string; occupation: string; relationship: string };

function MyInfoSection({ d, onSaved }: { d: MyContext; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const teacher = isTeacherCtx(d) ? d : null;
  const staff   = isStaffCtx(d) ? d : null;
  const parent  = isParentCtx(d) ? d : null;
  const phone   = d.account?.phone ?? (d.user as { phone?: string | null } | null)?.phone ?? null;
  const initial: FormState = {
    phone:          phone ?? "",
    specialization: teacher?.profile.specialization ?? "",
    office:         teacher?.profile.office ?? staff?.profile?.office ?? "",
    bio:            teacher?.profile.bio ?? "",
    mentionId:      teacher?.mention?.id ?? "",
    occupation:     parent?.profile.occupation ?? "",
    relationship:   parent?.profile.relationship ?? "",
  };
  const [form, setForm] = useState<FormState>(initial);
  const mentions = useQuery({
    queryKey: ["cursus", "mentions"],
    queryFn: () => api<MentionOpt[]>("/cursus/mentions"),
    enabled: editing && !!teacher,
  });
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, string> = { phone: form.phone };
      if (teacher) Object.assign(body, { specialization: form.specialization, office: form.office, bio: form.bio, mentionId: form.mentionId });
      if (staff)   Object.assign(body, { office: form.office });
      if (parent)  Object.assign(body, { occupation: form.occupation, relationship: form.relationship });
      await api("/me/profile", { method: "PATCH", body });
      toast.success("Informations enregistrées");
      setEditing(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally { setSaving(false); }
  }

  const input = "w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-classroom/30";
  const roles = d.account?.roles ?? [];

  return (
    <div className="rounded-2xl border bg-card shadow-elegant p-5">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-classroom/10 text-classroom"><UserRound size={14} /></span>
        <h3 className="font-semibold text-sm">Mes informations</h3>
        {!editing ? (
          <button onClick={() => { setForm(initial); setEditing(true); }} className="ml-auto flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
            <Pencil size={12} /> Modifier
          </button>
        ) : (
          <div className="ml-auto flex gap-2">
            <button onClick={() => setEditing(false)} disabled={saving} className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
              <X size={12} /> Annuler
            </button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-classroom px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Enregistrer
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="grid gap-x-8 lg:grid-cols-2">
          <div>
            <Row label="Adresse e-mail" value={d.user?.email} always />
            <Row label="Téléphone" value={phone} always />
            {teacher && <Row label="Spécialisation" value={teacher.profile.specialization} always />}
            {(teacher || staff) && <Row label="Bureau" value={teacher?.profile.office ?? staff?.profile?.office} always />}
            {parent && <Row label="Profession" value={parent.profile.occupation} always />}
            {parent && <Row label="Lien de parenté" value={parent.profile.relationship} always />}
          </div>
          <div>
            {roles.length > 0 && <Row label="Fonctions" value={roles.join("\n")} />}
            <Row label="Membre depuis" value={fmtDay(d.account?.createdAt)} />
            <Row label="Dernière connexion" value={fmtDay(d.account?.lastLoginAt, true)} />
          </div>
          {teacher && (
            <div className="lg:col-span-2 mt-3">
              <p className="text-xs text-muted-foreground mb-1">Présentation</p>
              {teacher.profile.bio
                ? <p className="text-sm leading-relaxed whitespace-pre-line">{teacher.profile.bio}</p>
                : <p className="text-sm italic text-muted-foreground/70">Ajoutez quelques lignes sur votre parcours et vos domaines d'enseignement.</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted-foreground">Téléphone
            <input className={`${input} mt-1`} value={form.phone} onChange={set("phone")} placeholder="+261 34 00 000 00" />
          </label>
          {teacher && (
            <>
              <label className="text-xs font-medium text-muted-foreground">Spécialisation
                <input className={`${input} mt-1`} value={form.specialization} onChange={set("specialization")} placeholder="Ex. Réseaux & Sécurité" />
              </label>
              <label className="text-xs font-medium text-muted-foreground">Mention de rattachement
                <select className={`${input} mt-1`} value={form.mentionId} onChange={set("mentionId")}>
                  <option value="">— Aucune —</option>
                  {(mentions.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
            </>
          )}
          {(teacher || staff) && (
            <label className="text-xs font-medium text-muted-foreground">Bureau
              <input className={`${input} mt-1`} value={form.office} onChange={set("office")} placeholder="Ex. Bâtiment A, bureau 12" />
            </label>
          )}
          {parent && (
            <>
              <label className="text-xs font-medium text-muted-foreground">Profession
                <input className={`${input} mt-1`} value={form.occupation} onChange={set("occupation")} />
              </label>
              <label className="text-xs font-medium text-muted-foreground">Lien de parenté
                <input className={`${input} mt-1`} value={form.relationship} onChange={set("relationship")} placeholder="Père, mère, tuteur…" />
              </label>
            </>
          )}
          {teacher && (
            <label className="text-xs font-medium text-muted-foreground sm:col-span-2">Présentation
              <textarea className={`${input} mt-1 min-h-28`} value={form.bio} onChange={set("bio")} placeholder="Parcours, diplômes, domaines d'enseignement…" />
            </label>
          )}
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Le nom et l'adresse e-mail sont gérés par l'administration. Pour les corriger, contactez le secrétariat.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card shadow-elegant p-5">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-classroom/10 text-classroom">{icon}</span>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function StatBadge({ label, value, color = "blue" }: { label: string; value: string | number; color?: string }) {
  const colors: Record<string, string> = {
    blue:  "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    green: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    red:   "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  };
  return (
    <div className={`rounded-xl px-3 py-2 ${colors[color] ?? colors.blue}`}>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="mt-0.5 text-xs opacity-75">{label}</p>
    </div>
  );
}

function ProfilePage() {
  const { user, ready } = useRequireClassroom();
  const ctx = useMyContext();

  if (!ready || !user || ctx.isLoading) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (ctx.error || !ctx.data) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-center">
        <div>
          <p className="text-muted-foreground">Impossible de charger votre profil.</p>
          <button onClick={() => ctx.refetch()} className="mt-2 text-sm text-classroom hover:underline">Réessayer</button>
        </div>
      </div>
    );
  }

  const d = ctx.data;

  const initials = d.user
    ? `${d.user.firstName[0]}${d.user.lastName[0]}`.toUpperCase()
    : "?";

  // avatarUrl and signatureUrl come from the /me/context extended fields
  const avatarUrl    = (d.user as { avatarUrl?: string | null })?.avatarUrl ?? null;
  const signatureUrl = (d.user as { signatureUrl?: string | null })?.signatureUrl ?? null;
  const canSign      = d.role === "TEACHER" || d.role === "STAFF" || d.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative overflow-hidden rounded-3xl grad-hero p-6 lg:p-8" style={{ animationFillMode: "both" }}>
        <div className="noise-bg absolute inset-0 opacity-40" />
        <div className="relative flex items-start gap-5">
          <AvatarUpload currentUrl={avatarUrl} initials={initials} onUpdate={() => ctx.refetch()} />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white">{d.user?.firstName} {d.user?.lastName}</h1>
            <p className="text-white/70 text-sm mt-0.5">
              {isStudentCtx(d) && d.profile.matricule && `Matricule: ${d.profile.matricule} · `}
              {isTeacherCtx(d) && d.profile.employeeId && `N° employé: ${d.profile.employeeId} · `}
              {d.role === "STUDENT" ? "Étudiant" : d.role === "TEACHER" ? "Enseignant" : d.role === "PARENT" ? "Parent" : d.role === "STAFF" ? "Personnel" : d.role === "CANDIDATE" ? "Candidat(e)" : d.role === "ONLINE" ? "Cours en ligne" : "Administrateur"}
            </p>
            {d.user?.email && <p className="text-white/60 text-xs mt-1 flex items-center gap-1"><Mail size={11} /> {d.user.email}</p>}
            {d.account?.phone && <p className="text-white/60 text-xs mt-1 flex items-center gap-1"><Phone size={11} /> {d.account.phone}</p>}
            {d.account?.createdAt && <p className="text-white/50 text-xs mt-1 flex items-center gap-1"><Clock size={11} /> Membre depuis le {fmtDay(d.account.createdAt)}</p>}
            {!avatarUrl && <p className="text-white/60 text-xs mt-3">Astuce : ajoutez une photo pour être reconnu dans la messagerie et les listes.</p>}
          </div>
        </div>
      </div>

      <MyInfoSection key={JSON.stringify(d.account ?? null) + JSON.stringify((d as { profile?: unknown }).profile ?? null)} d={d} onSaved={() => ctx.refetch()} />

      {/* Student-specific layout */}
      {isStudentCtx(d) && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBadge label="Moyenne" value={d.gradesSummary.average !== null ? `${d.gradesSummary.average}/20` : "—"} color="blue" />
            <StatBadge label="Assiduité" value={d.attendanceSummary.rate !== null ? `${d.attendanceSummary.rate}%` : "—"} color={d.attendanceSummary.rate !== null && d.attendanceSummary.rate >= 75 ? "green" : "amber"} />
            <StatBadge label="Factures en attente" value={d.financeSummary.pending} color={d.financeSummary.pending > 0 ? "amber" : "green"} />
            <StatBadge label="Matières" value={d.subjects.length} color="blue" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Organisational chain */}
            <Section title="Cursus et filière" icon={<GraduationCap size={14} />}>
              <Row label="Mode d'étude" value={studyModeLabel(d.profile.studyMode)} />
              <Row label="Promotion"    value={d.promotion?.name} />
              <Row label="Niveau"       value={d.promotion?.level} />
              <Row label="Mention"      value={d.mention?.name} />
              <Row label="Parcours"     value={d.parcours?.name} />
              <Row label="Groupe"       value={d.group?.name} />
              <Row label="Année univ."  value={d.academicYear?.label} />
              <Row label="Semestre actif" value={d.semester?.name} />
            </Section>

            <Section title="Établissement" icon={<Building2 size={14} />}>
              <Row label="Département"  value={d.department?.name} />
              <Row label="Faculté"      value={d.faculty?.name} />
              <Row label="Campus"       value={d.campus?.name} />
              <Row label="Ville"        value={d.campus?.city ?? undefined} />
              <Row label="Email campus" value={d.campus?.email ?? undefined} />
            </Section>

            {/* Subjects */}
            <Section title={`Matières (${d.subjects.length})`} icon={<BookOpen size={14} />}>
              <div className="space-y-2">
                {d.subjects.length === 0 && <p className="text-xs text-muted-foreground">Aucune matière assignée.</p>}
                {d.subjects.map((s) => (
                  <div key={s.courseId} className="flex items-start justify-between gap-2 py-1.5 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.code} · {s.credits} ECTS</p>
                    </div>
                    <div className="text-xs text-right text-muted-foreground">
                      {s.teachers.find((t) => t.isMain)?.lastName ?? s.teachers[0]?.lastName ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Parents */}
            {d.parents.length > 0 && (
              <Section title="Parents / Tuteurs" icon={<Users size={14} />}>
                <div className="space-y-2">
                  {d.parents.map((p) => (
                    <div key={p.id} className="py-1.5 border-b last:border-0">
                      <p className="text-sm font-medium">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-muted-foreground">{p.email}{p.phone ? ` · ${p.phone}` : ""}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </>
      )}

      {/* Teacher-specific layout */}
      {isTeacherCtx(d) && (
        <>
          <AcademicDossier teacher={d} onSaved={() => ctx.refetch()} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatBadge label="Cours assignés" value={d.courses.length} color="blue" />
            <StatBadge label="Étudiants totaux" value={d.studentCount} color="green" />
            <StatBadge label="Groupes" value={d.groups.length} color="blue" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Rattachement" icon={<Building2 size={14} />}>
              <Row label="N° employé"     value={d.profile.employeeId} always />
              <Row label="Mention"        value={d.mention?.name} always />
              <Row label="Département"    value={d.department?.name} always />
              <Row label="Faculté"        value={d.faculty?.name} always />
              <Row label="Campus"         value={d.campus?.name} />
              {!d.mention && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Choisissez votre mention dans « Mes informations » → Modifier : le département et la faculté se complètent automatiquement.
                </p>
              )}
            </Section>

            <Section title={`Cours (${d.courses.length})`} icon={<BookOpen size={14} />}>
              <div className="space-y-2">
                {d.courses.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Aucun cours ne vous est encore assigné. Le Responsable de votre mention vous attribue vos matières dans le cursus.
                  </p>
                )}
                {d.courses.map((c) => (
                  <div key={c.id} className="py-1.5 border-b last:border-0">
                    <p className="text-sm font-medium">{c.title ?? c.subject?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.promotion?.name}{c.mention ? ` · ${c.mention.name}` : ""}
                      {c.academicYear ? ` · ${c.academicYear.label}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </>
      )}

      {/* Parent-specific layout */}
      {isParentCtx(d) && (
        <div className="grid gap-4">
          {d.children.map((child) => (
            <Section key={child.studentProfileId} title={`${child.user.firstName} ${child.user.lastName}`} icon={<GraduationCap size={14} />}>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <StatBadge label="Moyenne" value={child.gradesSummary.average !== null ? `${child.gradesSummary.average}/20` : "—"} color="blue" />
                <StatBadge label="Assiduité" value={child.attendanceSummary.rate !== null ? `${child.attendanceSummary.rate}%` : "—"} color="green" />
                <StatBadge label="Factures" value={child.pendingInvoices.length || "OK"} color={child.pendingInvoices.length > 0 ? "amber" : "green"} />
              </div>
              <Row label="Matricule"  value={child.matricule} />
              <Row label="Promotion"  value={child.promotion?.name} />
              <Row label="Mention"    value={child.mention?.name} />
              <Row label="Groupe"     value={child.group?.name} />
              <Row label="Campus"     value={child.campus?.name} />
              <Row label="Statut"     value={child.status} />
            </Section>
          ))}
        </div>
      )}

      {/* Staff layout */}
      {isStaffCtx(d) && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBadge label="Étudiants actifs" value={d.stats.students} color="green" />
            <StatBadge label="Enseignants" value={d.stats.teachers} color="blue" />
            <StatBadge label="Candidatures à traiter" value={d.stats.pendingCandidates} color={d.stats.pendingCandidates > 0 ? "amber" : "green"} />
            <StatBadge label="Mentions actives" value={d.stats.activeMentions} color="blue" />
          </div>
          <Section title="Rattachement" icon={<ShieldCheck size={14} />}>
            <Row label="N° employé"  value={d.profile?.employeeId} always />
            <Row label="Département" value={d.department?.name} always />
            <Row label="Faculté"     value={d.faculty?.name} />
            <Row label="Campus"      value={d.campus?.name} />
          </Section>
        </>
      )}

      {/* Admin overview */}
      {isAdminCtx(d) && (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            <StatBadge label="Campus"       value={d.stats.campuses}        color="blue" />
            <StatBadge label="Facultés"     value={d.stats.faculties}       color="blue" />
            <StatBadge label="Mentions"     value={d.stats.mentions}        color="blue" />
            <StatBadge label="Étudiants"    value={d.stats.activeStudents}  color="green" />
            <StatBadge label="Enseignants"  value={d.stats.totalTeachers}   color="green" />
          </div>
          {d.currentAcademicYear && (
            <Section title="Année universitaire en cours" icon={<Calendar size={14} />}>
              <Row label="Année"    value={d.currentAcademicYear.label} />
              <Row label="Campus"   value={d.currentAcademicYear.campus?.name} />
              <Row label="Semestres" value={d.currentAcademicYear.semesters.map((s) => s.name).join(", ")} />
            </Section>
          )}
        </>
      )}

      <ChangePasswordCard />

      {/* Signature — staff/teacher/admin */}
      {canSign && (
        <SignatureUpload currentUrl={signatureUrl} onUpdate={() => ctx.refetch()} />
      )}

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <a href="/guide" className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"><LifeBuoy size={12} /> Guide d'utilisation</a>
        <Link to="/classroom/notifications" className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:bg-accent transition-colors">
          Notifications {d.unreadNotifications > 0 && <span className="ml-1 rounded-full bg-classroom px-1.5 py-0.5 text-[10px] text-white font-bold">{d.unreadNotifications}</span>}
        </Link>
        {isStudentCtx(d) && (
          <>
            <Link to="/classroom/notes"     className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"><TrendingUp size={12} /> Mes notes</Link>
            <Link to="/classroom/presences" className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"><Calendar size={12} /> Présences</Link>
            <Link to="/classroom/finance"   className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"><CreditCard size={12} /> Paiements</Link>
          </>
        )}
        {isTeacherCtx(d) && (
          <Link to="/classroom/timetable" className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"><Calendar size={12} /> Emploi du temps</Link>
        )}
      </div>
    </div>
  );
}
