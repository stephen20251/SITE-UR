import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, Check, Search, X } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import { useAuth } from "@/lib/auth";
import { CashDesk } from "@/components/classroom/tuition";
import {
  Card, Empty, Loading, PageHeader, Pill, Tabs, TuitionBadge, btnGhost, btnPrimary, inputCls,
} from "@/components/classroom/cursus-ui";
import {
  fmtMGA, methodLabel, useEarningsOverview, useRecordCash, useSaveRevenueShare, useSaveTuitionSetting, useTuitionAction,
  useTuitionList, useTuitionSettings, useTuitionStats, useTuitionStudents, type CashierStudent, type RevenueShare, type TuitionPayment,
} from "@/lib/cursus";
import { ApiError } from "@/lib/api";
import { cursusPlace } from "@/lib/cursus";

export const Route = createFileRoute("/classroom/ecolage")({ component: Ecolage });

type Tab = "PENDING" | "CASH" | "HISTORY" | "SETTINGS" | "EARNINGS";

function Ecolage() {
  const { user, ready } = useRequireClassroom(["STAFF", "SUPER_ADMIN"]);
  const [tab, setTab] = useState<Tab>("PENDING");
  const stats = useTuitionStats();

  if (!ready || !user) return <Loading />;
  if (stats.isError) return <Empty>Accès réservé à la comptabilité.</Empty>;
  const s = stats.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Écolage" subtitle="Paiements mensuels de l'écolage : validation, guichet, tarifs et parts enseignants." />
      <div className="grid gap-3 sm:grid-cols-4">
        <Card><div className="text-xs text-muted-foreground">À valider</div><div className="mt-1 text-2xl font-semibold">{s?.pending ?? "—"}</div></Card>
        <Card><div className="text-xs text-muted-foreground">Encaissé ce mois</div><div className="mt-1 text-2xl font-semibold">{fmtMGA(s?.monthAmount)}</div><div className="text-xs text-muted-foreground">{s?.monthCount ?? 0} paiements</div></Card>
        <Card><div className="text-xs text-muted-foreground">Total encaissé</div><div className="mt-1 text-2xl font-semibold">{fmtMGA(s?.totalAmount)}</div><div className="text-xs text-muted-foreground">{s?.totalCount ?? 0} paiements</div></Card>
        <Card><div className="text-xs text-muted-foreground">Refusés</div><div className="mt-1 text-2xl font-semibold">{s?.refused ?? "—"}</div></Card>
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} items={[
        { v: "PENDING", label: "À valider", count: s?.pending },
        { v: "CASH", label: "Guichet" },
        { v: "HISTORY", label: "Historique" },
        { v: "SETTINGS", label: "Tarifs mensuels" },
        { v: "EARNINGS", label: "Parts enseignants" },
      ]} />
      {tab === "PENDING" && <PaymentsTable status="PENDING" />}
      {tab === "CASH" && <CashDesk />}
      {tab === "HISTORY" && <PaymentsTable />}
      {tab === "SETTINGS" && <SettingsTab />}
      {tab === "EARNINGS" && <EarningsTab />}
    </div>
  );
}

function PaymentsTable({ status }: { status?: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(status ?? "");
  const list = useTuitionList({ status: filter || undefined, q: q || undefined });
  const action = useTuitionAction();

  async function act(p: TuitionPayment, kind: "validate" | "refuse") {
    const reason = kind === "refuse" ? prompt("Motif du refus (visible par l'étudiant) :") ?? undefined : undefined;
    if (kind === "refuse" && reason === undefined) return;
    try {
      const r = await action.mutateAsync({ id: p.id, action: kind, reason });
      toast.success(kind === "validate" ? `Validé — reçu ${r.receiptNumber}, mois ${p.month} débloqué` : "Paiement refusé");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Échec");
    }
  }

  const items = list.data?.items ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input className={`${inputCls} pl-8`} placeholder="Nom ou matricule" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!status && (
          <select className={inputCls} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="VALIDATED">Validés</option>
            <option value="REFUSED">Refusés</option>
          </select>
        )}
      </div>
      {list.isLoading ? <Loading /> : items.length === 0 ? <Empty>{status === "PENDING" ? "Aucun paiement à valider." : "Aucun paiement."}</Empty> : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-elegant">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Étudiant</th><th className="px-4 py-3">Mois</th><th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Moyen</th><th className="px-4 py-3">Référence</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.student?.user.lastName} {p.student?.user.firstName}</div>
                    <div className="text-xs text-muted-foreground">{p.student?.matricule} · {p.student?.promotion?.name}</div>
                  </td>
                  <td className="px-4 py-3">{cursusPlace(p.level, p.month)}</td>
                  <td className="px-4 py-3 font-medium">{fmtMGA(p.amount, p.currency)}</td>
                  <td className="px-4 py-3 text-xs">{methodLabel(p.method)}{p.senderNumber && <div className="text-muted-foreground">{p.senderNumber}</div>}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.transactionRef ?? p.receiptNumber ?? "—"}</td>
                  <td className="px-4 py-3"><TuitionBadge status={p.status} />{p.refusedReason && <div className="mt-0.5 text-[11px] text-red-600">{p.refusedReason}</div>}</td>
                  <td className="px-4 py-3 text-right">
                    {p.status === "PENDING" && (
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => act(p, "validate")} disabled={action.isPending} className={btnPrimary}><Check className="h-4 w-4" /> Valider</button>
                        <button onClick={() => act(p, "refuse")} disabled={action.isPending} className={btnGhost}><X className="h-4 w-4" /> Refuser</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const q = useTuitionSettings();
  const save = useSaveTuitionSetting();
  const [draft, setDraft] = useState<Record<string, string>>({});
  if (q.isLoading) return <Loading />;
  if (!q.data) return <Empty>Impossible de charger les tarifs.</Empty>;
  const current = (mentionId: string, level: string) =>
    q.data!.settings.find((s) => s.mentionId === mentionId && s.level === level)?.monthlyAmount;

  return (
    <Card className="space-y-4">
      <p className="text-sm text-muted-foreground">Montant mensuel de l'écolage (8 mois par année) par mention et niveau.</p>
      {q.data.mentions.filter((m) => m.levels.length > 0).map((m) => (
        <div key={m.id}>
          <h3 className="mb-2 text-sm font-semibold">{m.name}</h3>
          <div className="flex flex-wrap gap-3">
            {m.levels.map((l) => {
              const key = `${m.id}:${l}`;
              const value = draft[key] ?? String(current(m.id, l) ?? "");
              return (
                <div key={l} className="flex items-center gap-2 rounded-xl border p-2">
                  <Pill className="bg-muted">{l}</Pill>
                  <input type="number" min={1} className={`${inputCls} w-32`} value={value} placeholder="Montant"
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />
                  <button className={btnGhost} disabled={!value || save.isPending}
                    onClick={() => save.mutateAsync({ mentionId: m.id, level: l, monthlyAmount: Number(value) })
                      .then(() => toast.success(`${m.name} ${l} : ${fmtMGA(Number(value))} / mois`))
                      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Échec"))}>
                    Enregistrer
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </Card>
  );
}

// Répartition des ventes de cours payants : affichée à tous, modifiable par le Super administrateur.
function ShareCard({ share, canEdit }: { share: RevenueShare; canEdit: boolean }) {
  const save = useSaveRevenueShare();
  const [draft, setDraft] = useState(String(share.teacherPercent));
  useEffect(() => setDraft(String(share.teacherPercent)), [share.teacherPercent]);
  const n = Number(draft);
  const valid = draft.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100;
  const teacher = valid ? n : share.teacherPercent;

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Répartition financière</h3>
        <p className="text-xs text-muted-foreground">Partage de chaque vente d'un cours payant entre l'enseignant et l'université.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="text-xs font-medium text-amber-800 dark:text-amber-300">Enseignant</div>
          <div className="mt-1 text-3xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{teacher} %</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
          <div className="text-xs font-medium text-blue-800 dark:text-blue-300">Université</div>
          <div className="mt-1 text-3xl font-bold tabular-nums text-blue-700 dark:text-blue-400">{Math.round((100 - teacher) * 100) / 100} %</div>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-blue-500/80" aria-hidden>
        <div className="h-full bg-amber-500" style={{ width: `${teacher}%` }} />
      </div>
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2 border-t pt-4">
          <label className="text-xs text-muted-foreground">Part de l'enseignant (%)
            <input type="number" min={0} max={100} step={1} className={`${inputCls} mt-1 block w-32`} value={draft}
              onChange={(e) => setDraft(e.target.value)} />
          </label>
          <button className={btnPrimary} disabled={!valid || n === share.teacherPercent || save.isPending}
            onClick={() => save.mutateAsync(n)
              .then((r) => toast.success(`Répartition enregistrée : ${r.teacherPercent} % enseignant / ${r.universityPercent} % université`))
              .catch((err) => toast.error(err instanceof ApiError ? err.message : "Échec"))}>
            Enregistrer
          </button>
          <p className="w-full text-xs text-muted-foreground">
            S'applique aux ventes validées à partir de maintenant ; les ventes déjà enregistrées gardent leur répartition.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Seul le Super administrateur peut modifier cette répartition.</p>
      )}
    </Card>
  );
}

function EarningsTab() {
  const q = useEarningsOverview();
  const { user } = useAuth();
  if (q.isLoading) return <Loading />;
  const teachers = q.data?.teachers ?? [];
  const share = q.data?.share ?? { teacherPercent: 25, universityPercent: 75 };
  return (
    <div className="space-y-3">
      <ShareCard share={share} canEdit={user?.systemRole === "SUPER_ADMIN"} />
      <p className="text-sm text-muted-foreground">
        La part enseignant en attente est ajoutée automatiquement à sa prochaine fiche de paie (menu Salaires).
      </p>
      {teachers.length === 0 ? <Empty>Aucune vente de cours payant pour le moment.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-elegant">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr><th className="px-4 py-3">Enseignant</th><th className="px-4 py-3">Ventes</th><th className="px-4 py-3">Chiffre d'affaires</th><th className="px-4 py-3">Part université</th><th className="px-4 py-3">À verser</th><th className="px-4 py-3">Sur fiche de paie</th><th className="px-4 py-3">Versé</th></tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.teacher.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{t.teacher.firstName} {t.teacher.lastName}</td>
                  <td className="px-4 py-3">{t.sales}</td>
                  <td className="px-4 py-3">{fmtMGA(t.gross)}</td>
                  <td className="px-4 py-3">{fmtMGA(t.universityShare)}</td>
                  <td className="px-4 py-3 font-medium text-amber-600">{fmtMGA(t.pending)}</td>
                  <td className="px-4 py-3">{fmtMGA(t.inPayslip)}</td>
                  <td className="px-4 py-3 text-emerald-600">{fmtMGA(t.paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
