import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { api, ApiError, tokenStore } from "@/lib/api";
import { classroomDashboard } from "@/components/classroom/shared";

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

  const inp = "h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ── Left panel ── */}
      <div className="relative hidden overflow-hidden grad-classroom p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link to="/choice" className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>

        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <GraduationCap className="h-4 w-4" />
            Système Classroom · ERP Universitaire
          </div>
          <h1 className="mt-2 text-4xl font-bold tracking-tight leading-tight">
            Votre campus,<br />numérisé.
          </h1>
          <p className="mt-4 max-w-sm text-white/80 leading-relaxed">
            Emplois du temps, notes, présences et annonces — un seul portail pour tous les acteurs de l'université.
          </p>

          {/* Role pills */}
          <div className="mt-8 flex flex-wrap gap-2">
            {["Étudiant", "Enseignant", "Resp. Pédagogique", "Secrétaire", "Parent", "Admin"].map((r) => (
              <span key={r} className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                {r}
              </span>
            ))}
          </div>
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

          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl grad-classroom">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-foreground">Université Références</p>
              <p className="text-xs text-muted-foreground">Système Classroom</p>
            </div>
          </div>

          {mode === "apply" ? <CandidateSignup onBack={() => setMode("login")} /> : (<>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Connexion</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Entrez vos identifiants pour accéder à votre espace.
          </p>

          {/* Form */}
          <form className="mt-6 space-y-3" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Adresse e-mail</label>
              <input
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
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Mot de passe</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
                className={inp}
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

          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Système en ligne ?{" "}
              <Link to="/online" className="text-classroom hover:underline">
                Accès Online →
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              ERP ?{" "}
              <Link to="/erp/login" className="text-classroom hover:underline">
                Accès ERP →
              </Link>
            </p>
          </div>

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
  const inp = "h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition";
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
      <h2 className="text-2xl font-bold tracking-tight text-foreground">Candidater</h2>
      <p className="mt-1 text-sm text-muted-foreground">
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
          <input className={inp} type="password" placeholder="Mot de passe (8 car. min.)" minLength={8} value={f.password} onChange={set("password")} required autoComplete="new-password" />
          <input className={inp} type="password" placeholder="Confirmer" minLength={8} value={f.confirm} onChange={set("confirm")} required autoComplete="new-password" />
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
