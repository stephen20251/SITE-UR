import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { AuthShell } from "./mot-de-passe-oublie";
import { PasswordInput } from "@/components/form-fields";

export const Route = createFileRoute("/reinitialiser-mot-de-passe")({
  head: () => ({ meta: [{ title: "Nouveau mot de passe — Université Références" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === "string" ? s.token : "" }),
  component: ResetPassword,
});

function ResetPassword() {
  const { token } = Route.useSearch();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError("Mot de passe trop court (8 caractères minimum)");
    if (pw !== confirm) return setError("Les deux mots de passe ne correspondent pas");
    setPending(true);
    try {
      const r = await api<{ loginPath: string }>("/auth/reset-password", { method: "POST", auth: false, body: { token, newPassword: pw } });
      setDone(r.loginPath || "/classroom");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le mot de passe n'a pas pu être changé.");
    } finally { setPending(false); }
  }

  if (!token) {
    return (
      <AuthShell>
        <h1 className="text-xl font-bold">Lien incomplet</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ouvrez le lien reçu par e-mail en entier, ou faites une nouvelle demande.</p>
        <Link to="/mot-de-passe-oublie" className="mt-4 inline-block text-sm font-semibold text-classroom hover:underline">Nouvelle demande</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {done ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <h1 className="mt-3 text-xl font-bold">Mot de passe changé</h1>
          <p className="mt-2 text-sm text-muted-foreground">Vous pouvez vous connecter avec votre nouveau mot de passe.</p>
          <a href={done} className="mt-5 inline-flex rounded-xl grad-classroom px-5 py-2.5 text-sm font-semibold text-white">Se connecter</a>
        </div>
      ) : (
        <>
          <h1 className="text-3xl font-semibold tracking-tight text-[#14204a]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Nouveau mot de passe</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choisissez un mot de passe d'au moins 8 caractères.</p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <PasswordInput required minLength={8} autoComplete="new-password" placeholder="Nouveau mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} />
            <PasswordInput required minLength={8} autoComplete="new-password" placeholder="Confirmer" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {error && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}{" "}
                {/lien/i.test(error) && <Link to="/mot-de-passe-oublie" className="font-semibold underline">Nouvelle demande</Link>}
              </p>
            )}
            <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl grad-classroom py-3 text-sm font-semibold text-white disabled:opacity-60">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
