import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpenCheck, GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { AuthShell, authButton, authInput, authLabel } from "@/components/auth-shell";

export const Route = createFileRoute("/online/register")({
  head: () => ({ meta: [{ title: "Créer un compte — Cours en ligne — Université Références" }] }),
  component: Register,
});

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const user = await register({
        ...form,
        role: role === "teacher" ? "TEACHER_ONLINE" : "STUDENT_ONLINE",
        system: "ONLINE",
      });
      toast.success(`Compte créé : bienvenue, ${user.firstName} !`);
      navigate({ to: user.role === "TEACHER_ONLINE" ? "/online/teacher" : "/online/dashboard" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Impossible de créer le compte. Réessayez dans un instant.";
      setError(msg);
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell photo="/images/accueil/campus-vie-etudiante.jpg" subtitle="Cours en ligne" backTo="/online">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">Créer un compte</h2>
      <p className="mt-1 text-sm text-muted-foreground">Accès aux cours en ligne de l'Université Références.</p>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl border p-1" role="radiogroup" aria-label="Type de compte">
        {([
          { v: "student", label: "Étudiant", icon: <GraduationCap className="h-4 w-4" /> },
          { v: "teacher", label: "Enseignant", icon: <BookOpenCheck className="h-4 w-4" /> },
        ] as const).map((r) => (
          <button key={r.v} type="button" role="radio" aria-checked={role === r.v} onClick={() => setRole(r.v)}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm transition ${role === r.v ? "grad-online text-white" : "text-muted-foreground hover:bg-accent"}`}>
            {r.icon} {r.label}
          </button>
        ))}
      </div>

      <form className="mt-6 space-y-3" onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={authLabel} htmlFor="firstName">Prénom</label>
            <input id="firstName" className={authInput} value={form.firstName} onChange={set("firstName")} autoComplete="given-name" required />
          </div>
          <div>
            <label className={authLabel} htmlFor="lastName">Nom</label>
            <input id="lastName" className={authInput} value={form.lastName} onChange={set("lastName")} autoComplete="family-name" required />
          </div>
        </div>
        <div>
          <label className={authLabel} htmlFor="email">Adresse e-mail</label>
          <input id="email" type="email" placeholder="votre@email.mg" autoComplete="email" className={authInput} value={form.email} onChange={set("email")} required />
        </div>
        <div>
          <label className={authLabel} htmlFor="password">Mot de passe (8 caractères minimum)</label>
          <input id="password" type="password" autoComplete="new-password" minLength={8} className={authInput} value={form.password} onChange={set("password")} required />
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        <button type="submit" disabled={pending} className={authButton}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? "Création…" : "Créer mon compte"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Déjà un compte ? <Link to="/online/login" className="font-medium text-online hover:underline">Se connecter</Link>
      </p>
    </AuthShell>
  );
}
