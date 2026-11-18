import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { api, ApiError, tokenStore } from "@/lib/api";
import { classroomDashboard } from "@/components/classroom/shared";
import { LogoMark, LogoOnPhoto, serif } from "@/components/site-layout";
import { FIELD, FIELD_LABEL, PasswordInput } from "@/components/form-fields";

export const Route = createFileRoute("/classroom/")({ component: ClassroomLogin });

function ClassroomLogin() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "apply">("login");
  // Lien « Devenir étudiant(e) » depuis la plateforme en ligne
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("candidater")) setMode("apply");
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const user = await login(email, password);
      const isOnline = user.systemRole === "STUDENT_ONLINE" || user.systemRole === "TEACHER_ONLINE";
      if (isOnline) throw new ApiError(403, "Ce compte appartient au système en ligne. Connectez-vous via /online.");
      toast.success(`Bienvenue, ${user.firstName} !`);
      // Read roles from tokenStore directly — context state hasn't re-rendered yet
      nav({ to: classroomDashboard(user.systemRole, tokenStore.getRoles()) });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Impossible de se connecter. L'API est-elle démarrée ?";
      setError(msg);
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  const inp = FIELD;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ── Panneau de gauche : photo de l'université et logo ── */}
      <div className="relative isolate hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <img src="/images/accueil/banniere.jpg" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 grad-classroom opacity-[0.88]" />
        <Link to="/choice" className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>

        <div className="flex flex-col items-center text-center">
          <LogoOnPhoto />
          <h1 className="mt-8 text-4xl font-semibold tracking-tight" style={serif}>Université Références</h1>
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.3em] text-white/70">Espace université</p>
        </div>

        <div className="text-xs opacity-60">© Université Références {new Date().getFullYear()}</div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Retour (petits écrans : le panneau de gauche est masqué) */}
          <Link to="/choice" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground lg:hidden">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>

          {/* Logo (petits écrans) */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="h-11" />
            <div>
              <p className="font-semibold text-foreground" style={serif}>Université Références</p>
              <p className="text-xs text-muted-foreground">Espace université</p>
            </div>
          </div>

          {mode === "apply" ? <CandidateSignup onBack={(prefill) => { if (prefill) setEmail(prefill); setMode("login"); }} /> : (<>
          <h2 className="text-3xl font-semibold tracking-tight text-[#14204a] dark:text-white" style={serif}>Connexion</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
            Entrez vos identifiants pour accéder à votre espace.
          </p>

          {/* Form */}
          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            <div>
              <label className={FIELD_LABEL} htmlFor="email">Adresse e-mail</label>
              <input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.mg"
                type="email"
                autoComplete="email"
                className={inp}
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className={FIELD_LABEL} htmlFor="password">Mot de passe</label>
                <a href="/mot-de-passe-oublie" className="mb-1.5 text-sm font-medium text-[#e3262b] hover:underline">Mot de passe oublié ?</a>
              </div>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom py-3 text-sm font-semibold text-white shadow-elegant disabled:opacity-60 transition-opacity"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? "Connexion en cours…" : "Se connecter"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Cours en ligne ?{" "}
            <Link to="/online/login" className="text-classroom hover:underline">Se connecter aux cours en ligne →</Link>
          </p>

          <div className="mt-6 rounded-xl border border-dashed border-classroom/40 bg-classroom/5 p-4 text-center">
            <p className="text-sm font-medium">Nouveau ? Vous souhaitez étudier chez nous ?</p>
            <button type="button" onClick={() => setMode("apply")} className="mt-2 text-sm font-semibold text-classroom hover:underline">
              Déposer ma candidature →
            </button>
          </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

// ─── Candidature : création du compte candidat ───────────────────────────────
// Vérification champ par champ avec un message clair, brouillon conservé si la page
// se recharge (sans les mots de passe), adapté au téléphone.
const DRAFT_KEY = "ur:candidature-brouillon";
type SignupForm = { firstName: string; lastName: string; email: string; phone: string; password: string; confirm: string; mentionId: string; level: string };
const EMPTY_SIGNUP: SignupForm = { firstName: "", lastName: "", email: "", phone: "", password: "", confirm: "", mentionId: "", level: "L1" };

function checkSignup(f: SignupForm): Partial<Record<keyof SignupForm, string>> {
  const e: Partial<Record<keyof SignupForm, string>> = {};
  if (!f.firstName.trim()) e.firstName = "Indiquez votre prénom";
  if (!f.lastName.trim()) e.lastName = "Indiquez votre nom";
  if (!f.email.trim()) e.email = "Indiquez votre adresse e-mail";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = "Adresse e-mail invalide (exemple : nom@gmail.com)";
  if (f.phone.trim() && !/^[+\d][\d\s.-]{6,}$/.test(f.phone.trim())) e.phone = "Numéro invalide (exemple : 034 12 345 67)";
  if (!f.mentionId) e.mentionId = "Choisissez la mention souhaitée";
  if (f.password.length < 8) e.password = "8 caractères minimum";
  if (f.confirm !== f.password) e.confirm = "Les deux mots de passe ne correspondent pas";
  return e;
}

function CandidateSignup({ onBack }: { onBack: (prefillEmail?: string) => void }) {
  const { registerCandidate } = useAuth();
  const nav = useNavigate();
  const [mentions, setMentions] = useState<{ id: string; name: string }[]>([]);
  const [mentionsError, setMentionsError] = useState(false);
  const [f, setF] = useState<SignupForm>(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null");
      return d ? { ...EMPTY_SIGNUP, ...d, password: "", confirm: "" } : EMPTY_SIGNUP;
    } catch { return EMPTY_SIGNUP; }
  });
  const [touched, setTouched] = useState<Partial<Record<keyof SignupForm, boolean>>>({});
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<{ message: string; exists?: boolean } | null>(null);
  const errors = checkSignup(f);
  const show = (k: keyof SignupForm) => (triedSubmit || touched[k]) && errors[k];
  const set = (k: keyof SignupForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF((prev) => ({ ...prev, [k]: e.target.value }));
    setServerError(null);
  };
  const blur = (k: keyof SignupForm) => () => setTouched((t) => ({ ...t, [k]: true }));

  // Brouillon (sans mot de passe) : rien n'est perdu si la page se recharge
  useEffect(() => {
    try {
      const { password: _p, confirm: _c, ...rest } = f;
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(rest));
    } catch { /* stockage indisponible */ }
  }, [f]);

  function loadMentions() {
    setMentionsError(false);
    api<{ id: string; name: string }[]>("/auth/mentions", { auth: false })
      .then((m) => { setMentions(m); if (m.length === 1) setF((p) => ({ ...p, mentionId: p.mentionId || m[0].id })); })
      .catch(() => setMentionsError(true));
  }
  useEffect(loadMentions, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTriedSubmit(true);
    if (Object.keys(errors).length) {
      toast.error("Vérifiez les champs signalés en rouge");
      return;
    }
    setPending(true);
    setServerError(null);
    try {
      await registerCandidate({
        firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim().toLowerCase(),
        phone: f.phone.trim() || undefined, password: f.password,
        mentionId: f.mentionId || undefined, level: f.level,
      });
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* rien */ }
      toast.success("Compte créé ! Complétez maintenant votre dossier de pré-inscription.");
      nav({ to: "/classroom/candidat" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message
        : "Connexion au serveur impossible : vérifiez votre connexion Internet puis réessayez.";
      setServerError({ message, exists: err instanceof ApiError && err.status === 409 });
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  const fieldCls = (k: keyof SignupForm) => `${FIELD} ${show(k) ? "!border-red-400 focus:!ring-red-200" : ""}`;
  const Err = ({ k }: { k: keyof SignupForm }) => show(k) ? <p className="mt-1 text-xs text-red-600">{errors[k]}</p> : null;

  return (
    <div>
      <button type="button" onClick={() => onBack()} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> J'ai déjà un compte
      </button>
      <h2 className="text-3xl font-semibold tracking-tight text-[#14204a] dark:text-white" style={serif}>Candidater</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
        Créez votre compte candidat, puis déposez votre pré-inscription (CIN ou acte de naissance, photo 4x4, BACC, questionnaire de motivation). Une fois acceptée, vous complétez votre inscription et le secrétariat la valide.
      </p>
      <form onSubmit={submit} noValidate className="mt-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <input className={fieldCls("firstName")} placeholder="Prénom" value={f.firstName} onChange={set("firstName")} onBlur={blur("firstName")} autoComplete="given-name" aria-invalid={!!show("firstName")} />
            <Err k="firstName" />
          </div>
          <div>
            <input className={fieldCls("lastName")} placeholder="Nom" value={f.lastName} onChange={set("lastName")} onBlur={blur("lastName")} autoComplete="family-name" aria-invalid={!!show("lastName")} />
            <Err k="lastName" />
          </div>
        </div>
        <div>
          <input className={fieldCls("email")} type="email" inputMode="email" placeholder="Adresse e-mail" value={f.email} onChange={set("email")} onBlur={blur("email")} autoComplete="email" autoCapitalize="none" aria-invalid={!!show("email")} />
          <Err k="email" />
        </div>
        <div>
          <input className={fieldCls("phone")} type="tel" inputMode="tel" placeholder="Téléphone (facultatif)" value={f.phone} onChange={set("phone")} onBlur={blur("phone")} autoComplete="tel" />
          <Err k="phone" />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <select className={fieldCls("mentionId")} value={f.mentionId} onChange={set("mentionId")} onBlur={blur("mentionId")} aria-invalid={!!show("mentionId")}>
              <option value="">Mention souhaitée…</option>
              {mentions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <Err k="mentionId" />
            {mentionsError && (
              <p className="mt-1 text-xs text-red-600">
                Liste des mentions indisponible. <button type="button" onClick={loadMentions} className="font-semibold underline">Réessayer</button>
              </p>
            )}
          </div>
          <select className={FIELD} value={f.level} onChange={set("level")} aria-label="Niveau">
            {["L1", "L2", "L3", "M1", "M2"].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <PasswordInput placeholder="Mot de passe (8 caractères min.)" value={f.password} onChange={set("password")} onBlur={blur("password")} autoComplete="new-password" />
            <Err k="password" />
          </div>
          <div>
            <PasswordInput placeholder="Confirmer le mot de passe" value={f.confirm} onChange={set("confirm")} onBlur={blur("confirm")} autoComplete="new-password" />
            <Err k="confirm" />
          </div>
        </div>
        {serverError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {serverError.message}
            {serverError.exists && (
              <button type="button" onClick={() => onBack(f.email.trim().toLowerCase())} className="ml-1 font-semibold underline">Se connecter</button>
            )}
          </div>
        )}
        <button type="submit" disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom py-3 text-sm font-semibold text-white shadow-elegant disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? "Création du compte…" : "Créer mon compte candidat"}
        </button>
        <p className="text-center text-xs text-muted-foreground">Vos informations restent enregistrées sur cet appareil jusqu'à la création du compte.</p>
      </form>
    </div>
  );
}
