import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Mail, Lock, Loader2, GraduationCap, BookOpen, Video,
  CheckCircle2, Star, BadgeCheck, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { usePublicStats, usePublicReviewHighlights } from "@/lib/online";

export const Route = createFileRoute("/online/login")({
  component: Login,
});

const DEMOS = [
  {
    email: "student.online@ur.mg",
    password: "Password123!",
    name: "Stephen Online",
    role: "Étudiant",
    detail: "2 cours · 40% progression",
    icon: BookOpen,
    color: "text-online",
    bg: "bg-online/10",
  },
  {
    email: "student.online1@ur.mg",
    password: "Password123!",
    name: "Anjara RAKOTO",
    role: "Étudiant certifié",
    detail: "JS Avancé ✓ · 3 cours",
    icon: GraduationCap,
    color: "text-success",
    bg: "bg-success/10",
  },
  {
    email: "student.online11@ur.mg",
    password: "Password123!",
    name: "Kanto ANDRIAMASIMANANA",
    role: "Étudiant",
    detail: "4 cours en cours",
    icon: BookOpen,
    color: "text-online",
    bg: "bg-online/10",
  },
  {
    email: "teacher.online1@ur.mg",
    password: "Password123!",
    name: "Thierry ANDRIANINA",
    role: "Enseignant",
    detail: "3 cours publiés",
    icon: Video,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    email: "lms.admin@ur.mg",
    password: "Password123!",
    name: "Admin LMS",
    role: "Super Administrateur",
    detail: "Gestion de la plateforme",
    icon: GraduationCap,
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
] as const;

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { data: stats } = usePublicStats();
  const { data: highlights = [] } = usePublicReviewHighlights();
  const quote = highlights[0];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [quickPending, setQuickPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doLogin(e: string, p: string) {
    setError(null);
    try {
      const user = await login(e, p);
      // Étudiants et enseignants de l'UR utilisent aussi la plateforme en ligne.
      const hybrid = user.systemRole === "STUDENT" || user.systemRole === "TEACHER";
      if (user.system !== "ONLINE" && !hybrid && user.systemRole !== "SUPER_ADMIN") {
        throw new ApiError(403, "Ce compte appartient à l'espace université : connectez-vous depuis l'espace Classroom.");
      }
      toast.success(`Bienvenue, ${user.firstName} !`);
      const dest = user.systemRole === "SUPER_ADMIN"
        ? "/online/admin"
        : user.role === "TEACHER_ONLINE" || user.systemRole === "TEACHER"
        ? "/online/teacher"
        : "/online/dashboard";
      navigate({ to: dest });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Impossible de se connecter. L'API est-elle démarrée ?";
      setError(msg);
      toast.error(msg);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await doLogin(email, password);
    setPending(false);
  }

  async function quickLogin(demo: (typeof DEMOS)[number]) {
    setQuickPending(demo.email);
    setEmail(demo.email);
    setPassword(demo.password);
    await doLogin(demo.email, demo.password);
    setQuickPending(null);
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Left panel — brand & trust */}
      <div className="relative hidden overflow-hidden grad-online p-12 text-white md:flex md:flex-col md:justify-between">
        {/* Ornaments */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-purple-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-10 top-1/3 text-6xl opacity-10">✦</div>

        <div className="relative flex items-center justify-between">
          <Link to="/online" className="text-sm opacity-80 transition hover:opacity-100">← Retour au catalogue</Link>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/15"><GraduationCap className="h-4 w-4" /></span>
            UR Online
          </div>
        </div>

        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Bon retour parmi<br />vos cours.
          </h1>
          <p className="mt-3 max-w-sm text-white/75">
            Vos leçons reprennent exactement où vous les avez laissées — vidéos, quiz, cours en direct et certificats.
          </p>

          {/* Value props */}
          <ul className="mt-8 space-y-3">
            {[
              "Certificats vérifiables en ligne (code + QR)",
              "Cours en direct : tableau interactif, voix, sondages",
              "Garantie remboursement 30 jours",
              "Paiement Mobile Money — accès instantané",
            ].map((v) => (
              <li key={v} className="flex items-start gap-2.5 text-sm text-white/90">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                {v}
              </li>
            ))}
          </ul>

          {/* Live stats */}
          {stats && (
            <div className="mt-8 flex gap-6">
              {[
                { v: stats.courses, l: "cours" },
                { v: stats.students, l: "étudiants" },
                { v: stats.certificates, l: "certificats délivrés" },
              ].map(({ v, l }) => (
                <div key={l}>
                  <div className="text-2xl font-extrabold">{v}</div>
                  <div className="text-xs text-white/60">{l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Real verified review */}
          {quote && (
            <figure className="mt-8 max-w-sm rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className={`h-3 w-3 ${i <= quote.rating ? "fill-amber-300 text-amber-300" : "text-white/30"}`} />
                ))}
              </div>
              <blockquote className="mt-2 text-sm leading-relaxed text-white/90">« {quote.comment} »</blockquote>
              <figcaption className="mt-2 flex items-center gap-1.5 text-xs text-white/60">
                {quote.studentName} <BadgeCheck className="h-3.5 w-3.5 text-emerald-300" /> — avis vérifié
              </figcaption>
            </figure>
          )}
        </div>

        <div className="relative flex items-center gap-2 text-xs text-white/60">
          <ShieldCheck className="h-3.5 w-3.5" />
          Université Références · Plateforme officielle d'enseignement en ligne
        </div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="md:hidden">
            <Link to="/online" className="text-sm text-muted-foreground">← Retour</Link>
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Connexion Online</h2>
          <p className="text-sm text-muted-foreground">Entrez vos identifiants pour continuer.</p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <Field icon={<Mail className="h-4 w-4" />} placeholder="Email" type="email" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Field icon={<Lock className="h-4 w-4" />} placeholder="Mot de passe" type="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required />

            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <button type="submit" disabled={pending || !!quickPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg grad-online py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Comptes de démonstration
            </p>
            <div className="space-y-2">
              {DEMOS.map((demo) => {
                const Icon = demo.icon;
                const isLoading = quickPending === demo.email;
                return (
                  <button
                    key={demo.email}
                    type="button"
                    disabled={!!quickPending || pending}
                    onClick={() => quickLogin(demo)}
                    className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:border-online/40 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className={`shrink-0 rounded-lg p-1.5 ${demo.bg}`}>
                      {isLoading
                        ? <Loader2 className={`h-4 w-4 animate-spin ${demo.color}`} />
                        : <Icon className={`h-4 w-4 ${demo.color}`} />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{demo.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{demo.role}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{demo.detail}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">→</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Mot de passe : <code className="rounded bg-muted px-1">Password123!</code>
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Nouveau ? <Link to="/online/register" className="font-medium text-foreground hover:underline">Créer un compte</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
      <input {...p} className="h-11 w-full rounded-lg border bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}
