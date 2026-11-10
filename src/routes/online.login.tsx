import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { AuthShell, authButton, authInput, authLabel } from "@/components/auth-shell";
import { PasswordInput } from "@/components/form-fields";
import { serif } from "@/components/site-layout";

export const Route = createFileRoute("/online/login")({
  head: () => ({ meta: [{ title: "Connexion — Cours en ligne — Université Références" }] }),
  component: Login,
});

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const user = await login(email, password);
      // Étudiants et enseignants de l'UR utilisent aussi la plateforme en ligne.
      const hybrid = user.systemRole === "STUDENT" || user.systemRole === "TEACHER";
      if (user.system !== "ONLINE" && !hybrid && user.systemRole !== "SUPER_ADMIN") {
        throw new ApiError(403, "Ce compte appartient à l'espace université : connectez-vous depuis l'espace université.");
      }
      toast.success(`Bienvenue, ${user.firstName} !`);
      const dest = user.systemRole === "SUPER_ADMIN"
        ? "/online/admin"
        : user.role === "TEACHER_ONLINE" || user.systemRole === "TEACHER"
        ? "/online/teacher"
        : "/online/dashboard";
      navigate({ to: dest });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Impossible de se connecter. Réessayez dans un instant.";
      setError(msg);
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell photo="/images/accueil/campus-vie-etudiante.jpg" subtitle="Cours en ligne" backTo="/online">
      <h2 className="text-3xl font-semibold tracking-tight text-[#14204a] dark:text-white" style={serif}>Connexion</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">Entrez vos identifiants pour accéder à vos cours.</p>

      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <div>
          <label className={authLabel} htmlFor="email">Adresse e-mail</label>
          <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.mg"
            type="email" autoComplete="email" className={authInput} required />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className={authLabel} htmlFor="password">Mot de passe</label>
            <a href="/mot-de-passe-oublie" className="mb-1.5 text-sm font-medium text-online hover:underline">Mot de passe oublié ?</a>
          </div>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
            autoComplete="current-password" required />
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        <button type="submit" disabled={pending} className={authButton}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? "Connexion en cours…" : "Se connecter"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Étudiant ou personnel de l'université ?{" "}
        <Link to="/classroom" className="text-online hover:underline">Espace université →</Link>
      </p>

      <div className="mt-6 rounded-xl border border-dashed border-online/40 bg-online/5 p-4 text-center">
        <p className="text-sm font-medium">Nouveau sur les cours en ligne ?</p>
        <Link to="/online/register" className="mt-2 inline-block text-sm font-semibold text-online hover:underline">
          Créer un compte →
        </Link>
      </div>
    </AuthShell>
  );
}
