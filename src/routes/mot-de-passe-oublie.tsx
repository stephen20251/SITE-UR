import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, GraduationCap, Loader2, MailCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";

export const Route = createFileRoute("/mot-de-passe-oublie")({
  head: () => ({ meta: [{ title: "Mot de passe oublié — Université Références" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("/auth/forgot-password", { method: "POST", auth: false, body: { email: email.trim() } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? "Trop de demandes : réessayez dans quelques minutes." : "La demande n'a pas pu être envoyée. Réessayez.");
    } finally { setPending(false); }
  }

  return (
    <AuthShell>
      {sent ? (
        <div className="text-center">
          <MailCheck className="mx-auto h-10 w-10 text-classroom" />
          <h1 className="mt-3 text-xl font-bold">Vérifiez votre boîte mail</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Si un compte existe pour <b>{email}</b>, un e-mail contenant un lien pour choisir un nouveau mot de passe
            vient d'être envoyé. Le lien est valable 1 heure. Pensez à regarder dans les courriers indésirables.
          </p>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight">Mot de passe oublié</h1>
          <p className="mt-1 text-sm text-muted-foreground">Indiquez l'adresse e-mail de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input type="email" required autoComplete="email" placeholder="votre@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30" />
            {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom py-3 text-sm font-semibold text-white disabled:opacity-60">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer le lien
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <div className="w-full max-w-md">
        <Link to="/classroom" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour à la connexion
        </Link>
        <div className="rounded-2xl border bg-card p-8 shadow-elegant">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl grad-classroom"><GraduationCap className="h-5 w-5 text-white" /></div>
            <p className="font-bold">Université Références</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
