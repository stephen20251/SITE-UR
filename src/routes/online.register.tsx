import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, BookOpenCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/online/register")({
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

  const input = "h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="flex items-center justify-center p-8 order-2 md:order-1">
        <div className="w-full max-w-sm">
          <Link to="/online" className="text-sm text-muted-foreground">← Retour</Link>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Créer un compte</h2>
          <p className="text-sm text-muted-foreground">Cours en ligne de l'Université Références.</p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl border p-1">
            {([
              { v: "student", label: "Étudiant", icon: <GraduationCap className="h-4 w-4" /> },
              { v: "teacher", label: "Enseignant", icon: <BookOpenCheck className="h-4 w-4" /> },
            ] as const).map((r) => (
              <button key={r.v} type="button" onClick={() => setRole(r.v)}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm transition ${role === r.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
                {r.icon} {r.label}
              </button>
            ))}
          </div>

          <form className="mt-6 space-y-3" onSubmit={onSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Prénom" className={input} value={form.firstName} onChange={set("firstName")} required />
              <input placeholder="Nom" className={input} value={form.lastName} onChange={set("lastName")} required />
            </div>
            <input placeholder="Adresse e-mail" type="email" autoComplete="email" className={input} value={form.email} onChange={set("email")} required />
            <input placeholder="Mot de passe (8 caractères minimum)" type="password" autoComplete="new-password" minLength={8} className={input} value={form.password} onChange={set("password")} required />

            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <button type="submit" disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-lg grad-online py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? "Création…" : "Créer mon compte"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Déjà un compte ? <Link to="/online/login" className="font-medium text-foreground hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>
      <div className="grad-online p-12 text-white md:flex md:flex-col md:justify-between order-1 md:order-2 hidden md:flex">
        <div className="text-sm opacity-80">Cours en ligne</div>
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Université Références</h1>
          <p className="mt-3 max-w-sm text-white/80">Apprenez à votre rythme, où que vous soyez.</p>
        </div>
        <div className="text-xs opacity-70">© Université Références</div>
      </div>
    </div>
  );
}
