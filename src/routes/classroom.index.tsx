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

          {mode === "apply" ? <CandidateSignup onBack={() => setMode("login")} /> : (<>
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
function CandidateSignup({ onBack }: { onBack: () => void }) {
  const { registerCandidate } = useAuth();
  const nav = useNavigate();
  const [mentions, setMentions] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirm: "", mentionId: "", level: "L1" });
  const [pending, setPending] = useState(false);
  const inp = FIELD;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    api<{ id: string; name: string }[]>("/auth/mentions", { auth: false }).then(setMentions).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.password !== f.confirm) return toast.error("Les deux mots de passe ne correspondent pas");
    setPending(true);
    try {
      await registerCandidate({
        firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim(),
        phone: f.phone.trim() || undefined, password: f.password,
        mentionId: f.mentionId || undefined, level: f.level,
      });
      toast.success("Compte créé ! Complétez et soumettez votre dossier.");
      nav({ to: "/classroom/candidat" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Création du compte impossible");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> J'ai déjà un compte
      </button>
      <h2 className="text-3xl font-semibold tracking-tight text-[#14204a] dark:text-white" style={serif}>Candidater</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
        Créez votre compte candidat, puis déposez votre pré-inscription (CIN ou acte de naissance, photo 4x4, BACC, questionnaire de motivation). Une fois acceptée, vous complétez votre inscription et le secrétariat la valide.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input className={inp} placeholder="Prénom" value={f.firstName} onChange={set("firstName")} required />
          <input className={inp} placeholder="Nom" value={f.lastName} onChange={set("lastName")} required />
        </div>
        <input className={inp} type="email" placeholder="Adresse e-mail" value={f.email} onChange={set("email")} required autoComplete="email" />
        <input className={inp} placeholder="Téléphone (optionnel)" value={f.phone} onChange={set("phone")} />
        <div className="grid grid-cols-2 gap-3">
          <select className={inp} value={f.mentionId} onChange={set("mentionId")}>
            <option value="">Mention souhaitée…</option>
            {mentions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className={inp} value={f.level} onChange={set("level")}>
            {["L1", "L2", "L3", "M1", "M2"].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <PasswordInput placeholder="Mot de passe (8 car. min.)" minLength={8} value={f.password} onChange={set("password")} required autoComplete="new-password" />
          <PasswordInput placeholder="Confirmer" minLength={8} value={f.confirm} onChange={set("confirm")} required autoComplete="new-password" />
        </div>
        <button type="submit" disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom py-3 text-sm font-semibold text-white shadow-elegant disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Créer mon compte candidat
        </button>
      </form>
    </div>
  );
}
