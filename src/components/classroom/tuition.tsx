// Écolage mensuel : vue « Paiements » de l'étudiant / du parent, déclaration
// Mobile Money et guichet espèces (comptabilité / secrétariat).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, Building2, CheckCircle2, Clock, Smartphone, Wallet, X, XCircle } from "lucide-react";
import { Card, btnPrimary, inputCls } from "@/components/classroom/cursus-ui";
import {
  PAY_METHODS, fmtMGA, methodLabel, useDeclareTuition, useRecordCash, useTuitionStudents,
  type CashierStudent, type CursusMonth, type CursusOverview,
} from "@/lib/cursus";
import { ApiError } from "@/lib/api";
import { semesterLabel } from "@/lib/cursus";

// Paiement en espèces au guichet : validé immédiatement, reçu émis.
export function CashDesk() {
  const [q, setQ] = useState("");
  const [student, setStudent] = useState<CashierStudent | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [amount, setAmount] = useState<number | "">("");
  const [note, setNote] = useState("");
  const results = useTuitionStudents(q);
  const record = useRecordCash();

  useEffect(() => {
    if (student) { setMonth(student.nextPayableMonth); setAmount(student.monthlyAmount ?? ""); }
  }, [student]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!student || !month) return;
    try {
      const p = await record.mutateAsync({ studentId: student.id, month, amount: amount === "" ? undefined : Number(amount), note: note || undefined });
      toast.success(`Encaissé — reçu ${p.receiptNumber}. Mois ${month} débloqué.`);
      setStudent(null); setQ(""); setNote("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Encaissement impossible");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="font-semibold">1. Rechercher l'étudiant</h3>
        <input className={`${inputCls} mt-3 w-full`} placeholder="Nom, prénom ou matricule (2 lettres min.)" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-3 space-y-1.5">
          {results.isFetching && <p className="text-xs text-muted-foreground">Recherche…</p>}
          {(results.data ?? []).map((s) => (
            <button key={s.id} onClick={() => setStudent(s)}
              className={`w-full rounded-xl border p-3 text-left text-sm transition ${student?.id === s.id ? "border-classroom bg-classroom/5" : "hover:bg-accent"}`}>
              <div className="font-medium">{s.lastName} {s.firstName} <span className="text-xs text-muted-foreground">· {s.matricule}</span></div>
              <div className="text-xs text-muted-foreground">{s.promotion?.name ?? "—"} · prochain mois payable : {s.nextPayableMonth ?? "aucun"}</div>
            </button>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="font-semibold">2. Encaisser</h3>
        {!student ? <p className="mt-3 text-sm text-muted-foreground">Sélectionnez un étudiant.</p> : (
          <form onSubmit={submit} className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {student.months.map((m) => (
                <button type="button" key={m.month} disabled={!m.canPay} onClick={() => setMonth(m.month)} title={m.lockReason ?? ""}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-60 ${month === m.month ? "border-classroom bg-classroom/10 text-classroom" : ""}`}>
                  Mois {m.month} {m.status === "PAID" ? "✓" : m.status === "PENDING" ? "⏳" : ""}
                </button>
              ))}
            </div>
            {!student.nextPayableMonth && <p className="text-xs text-amber-600">Aucun mois payable : le mois précédent doit être payé et ses cours terminés à 100 %.</p>}
            <label className="block text-xs text-muted-foreground">Montant (MGA)
              <input type="number" min={1} className={`${inputCls} mt-1 w-full`} value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} />
            </label>
            <label className="block text-xs text-muted-foreground">Note (optionnel)
              <input className={`${inputCls} mt-1 w-full`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex : payé par le père" />
            </label>
            <button disabled={!month || record.isPending} className={`${btnPrimary} w-full justify-center`}>
              <Banknote className="h-4 w-4" /> Encaisser {month ? `le mois ${month}` : ""} en espèces
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}


export function PayDialog({ month, amount, currency, onClose }: { month: CursusMonth; amount: number | null; currency: string; onClose: () => void }) {
  const declare = useDeclareTuition();
  const [method, setMethod] = useState<string>("MVOLA");
  const [senderNumber, setSender] = useState("");
  const [transactionRef, setRef] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await declare.mutateAsync({ month: month.month, method, senderNumber, transactionRef });
      toast.success("Paiement déclaré : la comptabilité va le vérifier et débloquer le mois.");
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Échec de la déclaration");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Écolage — mois {month.month}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="rounded-xl bg-classroom/5 p-3 text-sm">
          Montant à envoyer : <b>{fmtMGA(amount, currency)}</b>
          <p className="mt-1 text-xs text-muted-foreground">
            Envoyez le montant par Mobile Money, puis indiquez votre numéro et la référence de la transaction.
            Vous pouvez aussi payer en espèces au guichet de la comptabilité.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PAY_METHODS.map((p) => (
            <button key={p.v} type="button" onClick={() => setMethod(p.v)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium ${method === p.v ? "border-classroom bg-classroom/10 text-classroom" : "hover:bg-accent"}`}>
              {p.l}
            </button>
          ))}
        </div>
        <label className="block text-xs text-muted-foreground">Numéro expéditeur
          <input className={`${inputCls} mt-1 w-full`} value={senderNumber} onChange={(e) => setSender(e.target.value)} placeholder="034 00 000 00" required />
        </label>
        <label className="block text-xs text-muted-foreground">Référence de la transaction
          <input className={`${inputCls} mt-1 w-full`} value={transactionRef} onChange={(e) => setRef(e.target.value)} placeholder="Ex : MP2410.1234.A5678" required />
        </label>
        <button type="submit" disabled={declare.isPending || !amount} className={`${btnPrimary} w-full justify-center`}>
          {declare.isPending ? "Envoi…" : "Déclarer le paiement"}
        </button>
        {!amount && <p className="text-xs text-amber-600">Le montant de l'écolage n'est pas encore configuré pour votre niveau.</p>}
      </form>
    </div>
  );
}

// ─── Vue « Paiements » (étudiant / parent) ───────────────────────────────────

const MONTH_STATUS: Record<CursusMonth["status"], { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  PAID:    { label: "Payé",       cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", Icon: CheckCircle2 },
  PENDING: { label: "En attente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",       Icon: Clock },
  REFUSED: { label: "Refusé",     cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",               Icon: XCircle },
  UNPAID:  { label: "Impayé",     cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",              Icon: Wallet },
};

export function tuitionSummary(data: CursusOverview) {
  const months = data.months;
  const ref = data.currentMonth ?? data.nextPayableMonth ?? months.find((m) => m.status !== "PAID")?.month ?? 1;
  const semester = ref <= 4 ? 1 : 2;
  const semMonths = months.filter((m) => m.semester === semester);
  const semDue = semMonths.filter((m) => m.status === "UNPAID" || m.status === "REFUSED");
  return {
    paid: months.filter((m) => m.status === "PAID").length,
    pending: months.filter((m) => m.status === "PENDING").length,
    unpaid: months.filter((m) => m.status === "UNPAID" || m.status === "REFUSED").length,
    total: months.length,
    semester,
    semDueCount: semDue.length,
    semDueAmount: data.monthlyAmount ? semDue.length * data.monthlyAmount : null,
  };
}

export function TuitionPanel({ data, onPay }: { data: CursusOverview; onPay?: (m: CursusMonth) => void }) {
  const s = tuitionSummary(data);
  const cur = data.currency;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="text-xs text-muted-foreground">Mois payés</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-600">{s.paid} <span className="text-sm font-normal text-muted-foreground">/ {s.total}</span></div>
        </Card>
        <Card>
          <div className="text-xs text-muted-foreground">Mois impayés</div>
          <div className="mt-1 text-2xl font-semibold">{s.unpaid}</div>
          {s.pending > 0 && <div className="text-xs text-amber-600">+ {s.pending} en attente de validation</div>}
        </Card>
        <Card className="sm:col-span-2">
          <div className="text-xs text-muted-foreground">Reste à payer — {semesterLabel(data.student.level, s.semester)}</div>
          <div className="mt-1 text-2xl font-semibold text-classroom">{fmtMGA(s.semDueAmount, cur)}</div>
          <div className="text-xs text-muted-foreground">
            {s.semDueCount} mois restant{s.semDueCount > 1 ? "s" : ""} · {fmtMGA(data.monthlyAmount, cur)} / mois
          </div>
        </Card>
      </div>

      {[1, 2].map((sem) => (
        <Card key={sem} className="overflow-hidden p-0">
          <div className="border-b bg-muted/30 px-4 py-2.5 text-sm font-semibold">{semesterLabel(data.student.level, sem)}</div>
          <div className="divide-y">
            {data.months.filter((m) => m.semester === sem).map((m) => {
              const st = MONTH_STATUS[m.status];
              return (
                <div key={m.month} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <div className="w-20 font-medium">Mois {m.month}</div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>
                    <st.Icon className="h-3 w-3" /> {st.label}
                  </span>
                  <div className="flex-1 text-xs text-muted-foreground">
                    {m.payment ? (
                      <>
                        {fmtMGA(m.payment.amount, m.payment.currency)} · {methodLabel(m.payment.method)}
                        {m.payment.receiptNumber && <> · reçu {m.payment.receiptNumber}</>}
                        {m.payment.status === "REFUSED" && m.payment.refusedReason && <> · motif : {m.payment.refusedReason}</>}
                      </>
                    ) : m.lockReason && !m.canPay ? m.lockReason : ""}
                  </div>
                  {onPay && m.canPay && (
                    <button onClick={() => onPay(m)} className={btnPrimary}><Wallet className="h-4 w-4" /> Payer</button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <PaymentOptions />
    </div>
  );
}

export function PaymentOptions() {
  return (
    <Card>
      <h3 className="font-semibold">Modes de paiement</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2 font-medium"><Smartphone className="h-4 w-4 text-classroom" /> En ligne — MVola</div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Envoyez le montant par MVola puis cliquez sur « Payer » pour déclarer la référence de la transaction.
            La comptabilité valide le paiement et débloque le mois.
          </p>
          <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            Le paiement MVola direct depuis le site sera activé après la mise en ligne.
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2 font-medium"><Building2 className="h-4 w-4 text-classroom" /> Au bureau du secrétariat</div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Payez en espèces auprès du secrétariat. Un reçu vous est remis et le mois est débloqué immédiatement.
          </p>
        </div>
      </div>
    </Card>
  );
}
