import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Crown, Check, Loader2, Sparkles, Calendar, Infinity as InfinityIcon, X, ShieldCheck,
  Smartphone, Zap, BadgeCheck, TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  useSubscriptionPlans, useMyActiveSubscription, useMySubscriptions, useSubscribe,
  useMobileMoneySettings, type SubscriptionPlan, type PaymentMethod,
} from "@/lib/payments";
import { ApiError } from "@/lib/api";
import { OnlineNavbar, useRequireOnline } from "@/components/online/shared";
import { usePublicStats } from "@/lib/online";

export const Route = createFileRoute("/online/subscription")({
  head: () => ({ meta: [{ title: "Abonnement — UR Online" }] }),
  component: SubscriptionPage,
});

const fmtPrice = (n: number, c = "MGA") => `${n.toLocaleString("fr-FR")} ${c}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

function SubscriptionPage() {
  const { user } = useRequireOnline("STUDENT_ONLINE");
  const plans = useSubscriptionPlans();
  const active = useMyActiveSubscription();
  const history = useMySubscriptions();
  const stats = usePublicStats();
  const [subscribing, setSubscribing] = useState<SubscriptionPlan | null>(null);

  if (!user) return null;
  const sub = active.data;

  return (
    <div className="min-h-screen bg-background">
      <OnlineNavbar />

      {/* Hero */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white">
        {/* Ornements */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-rose-300/20 blur-3xl" />
        <div className="pointer-events-none absolute right-10 top-8 text-6xl opacity-15 select-none">👑</div>
        <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            <Crown className="h-3.5 w-3.5" /> UR Online Premium
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">
            Un abonnement.<br className="sm:hidden" /> Tout le savoir.
          </h1>
          <p className="mt-3 max-w-2xl text-white/85">
            Débloquez <span className="font-bold text-white">{stats.data ? `les ${stats.data.courses} cours` : "tous les cours"}</span> du
            catalogue — et tous ceux à venir — pour moins que le prix de deux cours à l'unité.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { icon: Zap, label: "Accès instantané" },
              { icon: Smartphone, label: "Mobile Money sécurisé" },
              { icon: BadgeCheck, label: "Certificats inclus" },
              { icon: ShieldCheck, label: "Validation sous 24 h" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur">
                <Icon className="h-3.5 w-3.5" /> {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Current subscription */}
        {sub && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-amber-300/50 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-elegant dark:from-amber-950/20 dark:to-orange-950/20">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Abonnement actif</div>
                  <div className="text-lg font-bold">{sub.plan.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold text-amber-600">{sub.expiresAt ? daysLeft(sub.expiresAt) : "∞"}</div>
                <div className="text-xs text-muted-foreground">jours restants</div>
              </div>
            </div>
            {sub.expiresAt && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> Expire le {fmtDate(sub.expiresAt)}
              </div>
            )}
          </div>
        )}

        {/* Plans */}
        <h2 className="mb-4 text-lg font-bold tracking-tight">
          {sub ? "Renouveler ou changer d'offre" : "Choisissez votre formule"}
        </h2>
        {plans.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (plans.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Aucune formule d'abonnement disponible pour le moment.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plans.data!.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                baselinePerDay={Math.max(...plans.data!.map((x) => x.price / x.durationDays))}
                onSubscribe={() => setSubscribing(p)}
                disabled={!!sub}
              />
            ))}
          </div>
        )}

        {/* Comparatif — à l'unité vs Premium */}
        <div className="mt-12">
          <h2 className="mb-4 text-lg font-bold tracking-tight">Achat à l'unité ou Premium ?</h2>
          <div className="overflow-hidden rounded-2xl border shadow-elegant">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="p-4 font-medium text-muted-foreground"></th>
                  <th className="p-4 font-semibold">Cours à l'unité</th>
                  <th className="bg-gradient-to-b from-amber-500/10 to-transparent p-4">
                    <span className="inline-flex items-center gap-1.5 font-bold text-amber-600">
                      <Crown className="h-4 w-4" /> Premium
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  { label: "Accès aux cours", unit: "1 seul cours par achat", prem: `${stats.data?.courses ?? "Tous les"} cours + les nouveautés` },
                  { label: "Certificats", unit: "Inclus avec le cours acheté", prem: "Inclus sur tout le catalogue" },
                  { label: "Sessions live & tableau", unit: "Du cours acheté uniquement", prem: "De tous les cours" },
                  { label: "Coût sur la durée", unit: "S'additionne à chaque cours", prem: "Un prix fixe, tout illimité" },
                  { label: "Garantie", unit: "Remboursement 30 jours", prem: "Remboursement 30 jours" },
                ].map((r) => (
                  <tr key={r.label}>
                    <td className="p-4 font-medium">{r.label}</td>
                    <td className="p-4 text-muted-foreground">{r.unit}</td>
                    <td className="bg-amber-500/[0.04] p-4">
                      <span className="flex items-start gap-1.5 font-medium">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {r.prem}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Garanties */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Zap, title: "Accès instantané", desc: "Le catalogue se débloque dès l'envoi de votre référence de paiement." },
            { icon: Smartphone, title: "Mobile Money sécurisé", desc: "MVola, Orange Money ou Airtel Money — validation humaine sous 24 h." },
            { icon: ShieldCheck, title: "Garantie 30 jours", desc: "Remboursement intégral si la plateforme ne vous convient pas." },
            { icon: InfinityIcon, title: "Sans engagement", desc: "L'abonnement s'arrête tout seul — aucun prélèvement automatique." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border bg-card p-5 shadow-elegant">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10">
                <Icon className="h-5 w-5 text-amber-500" />
              </div>
              <div className="mt-2.5 font-semibold">{title}</div>
              <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</div>
            </div>
          ))}
        </div>

        {/* History */}
        {(history.data ?? []).length > 0 && (
          <div className="mt-10">
            <h2 className="mb-3 text-lg font-bold tracking-tight">Historique</h2>
            <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant divide-y">
              {history.data!.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{s.plan.name}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(s.createdAt)} · {s.reference}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{fmtPrice(s.amount, s.plan.currency)}</div>
                    <SubStatusBadge status={s.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {subscribing && (
        <SubscribeModal plan={subscribing} onClose={() => setSubscribing(null)} />
      )}
    </div>
  );
}

function PlanCard({ plan, baselinePerDay, onSubscribe, disabled }: {
  plan: SubscriptionPlan;
  baselinePerDay: number;
  onSubscribe: () => void;
  disabled: boolean;
}) {
  const perMonth = plan.durationDays >= 30 ? Math.round(plan.price / (plan.durationDays / 30)) : null;
  const perDay = plan.price / plan.durationDays;
  const savings = baselinePerDay > 0 ? Math.round((1 - perDay / baselinePerDay) * 100) : 0;
  const durLabel = plan.durationDays >= 360 ? "1 an"
    : plan.durationDays >= 85 ? `${Math.round(plan.durationDays / 30)} mois`
    : plan.durationDays >= 28 ? "1 mois"
    : `${plan.durationDays} jours`;

  return (
    <div className={`relative flex flex-col rounded-3xl p-6 transition-all ${
      plan.isFeatured
        ? "border-2 border-amber-400 bg-gradient-to-b from-amber-50/80 to-card shadow-glow lg:-translate-y-2 lg:scale-[1.03] dark:from-amber-950/20"
        : "border bg-card shadow-elegant hover:-translate-y-1 hover:shadow-glow"
    }`}>
      {plan.isFeatured && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
          ⭐ Le plus choisi
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`grid h-9 w-9 place-items-center rounded-xl ${plan.isFeatured ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow" : "bg-amber-500/10 text-amber-500"}`}>
            <Crown className="h-4.5 w-4.5 h-[18px] w-[18px]" />
          </div>
          <div className="font-bold tracking-tight">{plan.name}</div>
        </div>
        {savings > 4 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
            <TrendingDown className="h-3 w-3" /> −{savings}%
          </span>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-4xl font-black tracking-tight">{plan.price.toLocaleString("fr-FR")}</span>
        <span className="text-sm font-medium text-muted-foreground">{plan.currency}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        pour <span className="font-semibold text-foreground">{durLabel}</span>
        {perMonth && plan.durationDays > 45 ? <> — soit <span className="font-semibold text-foreground">{perMonth.toLocaleString("fr-FR")} {plan.currency}/mois</span></> : null}
      </div>

      {plan.description && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{plan.description}</p>}

      <ul className="mt-5 flex-1 space-y-2.5 text-sm">
        {(plan.features?.length ? plan.features : [
          "Tous les cours du catalogue",
          "Nouveaux cours débloqués automatiquement",
          "Certificats vérifiables inclus",
          "Sessions live + tableau interactif",
          "Quiz, devoirs et forum illimités",
        ]).map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-4.5 w-4.5 h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-emerald-500/10">
              <Check className="h-3 w-3 text-emerald-600" />
            </span>
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={onSubscribe}
        disabled={disabled}
        className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-bold shadow transition hover:opacity-90 disabled:opacity-50 ${
          plan.isFeatured
            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/30"
            : "border-2 border-amber-500/60 text-amber-600 hover:bg-amber-500/10"
        }`}
      >
        {disabled ? "Déjà abonné" : plan.isFeatured ? "Choisir cette offre ⭐" : "S'abonner"}
      </button>
      <div className="mt-2 text-center text-[10px] text-muted-foreground">
        Accès immédiat · validation admin sous 24 h
      </div>
    </div>
  );
}

function SubStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: "Actif", cls: "bg-green-500/10 text-green-600" },
    EXPIRED: { label: "Expiré", cls: "bg-muted text-muted-foreground" },
    REFUSED: { label: "Refusé", cls: "bg-red-500/10 text-red-600" },
    CANCELLED: { label: "Annulé", cls: "bg-muted text-muted-foreground" },
    PENDING: { label: "En attente", cls: "bg-amber-500/10 text-amber-600" },
  };
  const s = map[status] ?? map.PENDING;
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>{s.label}</span>;
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "MVOLA", label: "MVola" },
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "AIRTEL_MONEY", label: "Airtel Money" },
];

function SubscribeModal({ plan, onClose }: { plan: SubscriptionPlan; onClose: () => void }) {
  const settings = useMobileMoneySettings();
  const subscribe = useSubscribe();
  const [method, setMethod] = useState<PaymentMethod>("MVOLA");
  const [senderNumber, setSenderNumber] = useState("");
  const [transactionRef, setTransactionRef] = useState("");

  const numbers = settings.data;
  const target = method === "MVOLA" ? numbers?.mvola : method === "ORANGE_MONEY" ? numbers?.orangeMoney : numbers?.airtelMoney;

  async function handleSubscribe() {
    if (!senderNumber.trim() || !transactionRef.trim()) { toast.error("Numéro et référence requis"); return; }
    try {
      await subscribe.mutateAsync({ planId: plan.id, method, senderNumber, transactionRef });
      toast.success("Abonnement activé ! Accès illimité débloqué 🎉");
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Échec de l'abonnement");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="text-base font-semibold">S'abonner — {plan.name}</h2>
            <p className="text-xs text-muted-foreground">{fmtPrice(plan.price, plan.currency)} · {plan.durationDays} jours</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Méthode</label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => (
                <button key={m.value} onClick={() => setMethod(m.value)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${method === m.value ? "border-amber-500 bg-amber-500/10 text-amber-600" : "hover:bg-accent"}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {target?.numero && (
            <div className="rounded-xl border border-amber-300/50 bg-amber-50/50 p-3 text-sm dark:bg-amber-950/10">
              <div className="text-xs text-muted-foreground">Effectuez le transfert vers :</div>
              <div className="mt-0.5 font-mono text-base font-bold text-amber-700 dark:text-amber-400">{target.numero}</div>
              {target.nom && <div className="text-xs text-muted-foreground">{target.nom}</div>}
              <div className="mt-1 text-xs">Montant : <span className="font-semibold">{fmtPrice(plan.price, plan.currency)}</span></div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Votre numéro (expéditeur) *</label>
            <input value={senderNumber} onChange={(e) => setSenderNumber(e.target.value)}
              placeholder="03X XX XXX XX" className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Référence de transaction *</label>
            <input value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="Ex : 123456789" className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
            💡 Accès débloqué immédiatement. Votre paiement sera validé par un administrateur.
          </div>

          <button onClick={handleSubscribe} disabled={subscribe.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60">
            {subscribe.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
            Confirmer l'abonnement
          </button>
        </div>
      </div>
    </div>
  );
}
