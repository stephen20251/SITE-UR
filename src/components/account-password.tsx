// Mots de passe : changement par l'utilisateur, et résultat d'une création de compte
// (mot de passe provisoire affiché une fois, e-mail envoyé ou non).
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Loader2, Mail, MailWarning } from "lucide-react";
import { api, ApiError, tokenStore } from "@/lib/api";
import { PasswordInput } from "@/components/form-fields";

export function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const input = "w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return toast.error("Nouveau mot de passe trop court (8 caractères minimum)");
    if (next !== confirm) return toast.error("Les deux nouveaux mots de passe ne correspondent pas");
    setSaving(true);
    try {
      // La session en cours reste ouverte ; les autres appareils sont déconnectés.
      await api("/auth/change-password", { method: "POST", body: { currentPassword: current, newPassword: next, refreshToken: tokenStore.refresh } });
      toast.success("Mot de passe modifié");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Modification impossible");
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-card p-5 shadow-elegant">
      <div className="mb-3 flex items-center gap-2 border-b pb-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><KeyRound size={14} /></span>
        <h3 className="text-sm font-semibold">Changer mon mot de passe</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-muted-foreground">Mot de passe actuel
          <span className="mt-1 block"><PasswordInput autoComplete="current-password" required className={input} value={current} onChange={(e) => setCurrent(e.target.value)} /></span>
        </label>
        <label className="text-xs font-medium text-muted-foreground">Nouveau (8 caractères min.)
          <span className="mt-1 block"><PasswordInput autoComplete="new-password" required minLength={8} className={input} value={next} onChange={(e) => setNext(e.target.value)} /></span>
        </label>
        <label className="text-xs font-medium text-muted-foreground">Confirmer
          <span className="mt-1 block"><PasswordInput autoComplete="new-password" required minLength={8} className={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></span>
        </label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Vos autres appareils seront déconnectés.</p>
      <div className="mt-3 flex justify-end">
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />} Enregistrer
        </button>
      </div>
    </form>
  );
}

// Résultat d'une création ou réinitialisation par l'administration.
export function AccountResult({ email, temporaryPassword, emailSent, onClose }: {
  email: string; temporaryPassword?: string; emailSent?: boolean; onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} className="text-emerald-600" /> Compte prêt : {email}</p>
      {emailSent ? (
        <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Mail size={16} className="mt-0.5 shrink-0" /> Un e-mail avec l'identifiant{temporaryPassword ? " et le mot de passe provisoire" : ""} a été envoyé à cette adresse.
        </p>
      ) : (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <MailWarning size={16} className="mt-0.5 shrink-0" /> L'e-mail n'a pas pu être envoyé (messagerie non configurée) : transmettez vous-même les informations.
        </p>
      )}
      {temporaryPassword && (
        <div>
          <p className="text-sm text-muted-foreground">Mot de passe provisoire (il ne sera plus affiché) :</p>
          <code className="mt-1 block select-all rounded-xl bg-muted px-4 py-3 text-center font-mono text-base">{temporaryPassword}</code>
        </div>
      )}
      <button onClick={onClose} className="w-full rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white hover:opacity-90">Fermer</button>
    </div>
  );
}
