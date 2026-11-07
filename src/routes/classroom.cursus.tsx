import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Award, CheckCircle2, GraduationCap, Lock, PlayCircle, Wallet, X } from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import { PayDialog } from "@/components/classroom/tuition";
import {
  Bar, Card, Empty, Loading, PageHeader, TuitionBadge, btnPrimary, inputCls,
} from "@/components/classroom/cursus-ui";
import {
  PAY_METHODS, fmtMGA, methodLabel, useDeclareTuition, useMyCursus, type CursusMonth,
} from "@/lib/cursus";
import { ApiError } from "@/lib/api";
import { semesterLabel } from "@/lib/cursus";

export const Route = createFileRoute("/classroom/cursus")({ component: MyCursus });

function MyCursus() {
  const { user, ready } = useRequireClassroom(["STUDENT"]);
  const [part, setPart] = useState<"UNIVERSITY" | "CERTIFYING">("UNIVERSITY");
  const cursus = useMyCursus(ready && !!user);
  const [payMonth, setPayMonth] = useState<CursusMonth | null>(null);

  if (!ready || !user) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Mes cours" subtitle="Choisissez votre parcours : cursus universitaire ou cours certifiants." />

      {/* Deux choix */}
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          { v: "UNIVERSITY", title: "Cursus universitaire", sub: "Délivre un diplôme", Icon: GraduationCap },
          { v: "CERTIFYING", title: "Cours certifiants", sub: "Délivrent un certificat ou une attestation", Icon: Award },
        ] as const).map(({ v, title, sub, Icon }) => (
          <button
            key={v}
            onClick={() => setPart(v)}
            className={`flex items-center gap-4 rounded-2xl border p-5 text-left transition ${part === v ? "border-classroom bg-classroom/5 ring-2 ring-classroom/20" : "bg-card hover:bg-accent"}`}
          >
            <div className="grid h-11 w-11 place-items-center rounded-xl grad-classroom text-white"><Icon className="h-5 w-5" /></div>
            <div>
              <div className="font-semibold">{title}</div>
              <div className="text-sm text-muted-foreground">{sub}</div>
            </div>
          </button>
        ))}
      </div>

      {part === "CERTIFYING" ? (
        <Card className="text-center">
          <Award className="mx-auto h-10 w-10 text-classroom" />
          <h2 className="mt-2 text-lg font-semibold">Cours certifiants</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            En plus de votre cursus, vous pouvez suivre des cours professionnels. Chacun se termine par un test
            et délivre un certificat ou une attestation.
          </p>
          <Link to="/online" className={`${btnPrimary} mt-4`}>Ouvrir le catalogue certifiant</Link>
        </Card>
      ) : cursus.isLoading ? (
        <Loading />
      ) : cursus.isError || !cursus.data ? (
        <Empty>Impossible de charger votre cursus.</Empty>
      ) : (
        <CursusView data={cursus.data} onPay={setPayMonth} />
      )}

      {payMonth && cursus.data && (
        <PayDialog month={payMonth} amount={cursus.data.monthlyAmount} currency={cursus.data.currency} onClose={() => setPayMonth(null)} />
      )}
    </div>
  );
}

function CursusView({ data, onPay }: { data: NonNullable<ReturnType<typeof useMyCursus>["data"]>; onPay: (m: CursusMonth) => void }) {
  const totalCourses = data.months.reduce((s, m) => s + m.courses.length, 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card><div className="text-xs text-muted-foreground">Niveau</div><div className="mt-1 text-xl font-semibold">{data.student.level ?? "—"}</div><div className="text-xs text-muted-foreground">{data.student.mention?.name}</div></Card>
        <Card><div className="text-xs text-muted-foreground">Écolage mensuel</div><div className="mt-1 text-xl font-semibold">{fmtMGA(data.monthlyAmount, data.currency)}</div><div className="text-xs text-muted-foreground">8 mois par an</div></Card>
        <Card><div className="text-xs text-muted-foreground">Mois payés</div><div className="mt-1 text-xl font-semibold">{data.paidCount} / 8</div><Bar value={(data.paidCount / 8) * 100} className="mt-2" /></Card>
        <Card><div className="text-xs text-muted-foreground">Mois terminés à 100 %</div><div className="mt-1 text-xl font-semibold">{data.completedCount} / 8</div><Bar value={(data.completedCount / 8) * 100} className="mt-2" /></Card>
      </div>

      {data.eligibleForPassage && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <GraduationCap className="h-5 w-5 shrink-0" />
          Félicitations : votre année est complète. Votre Responsable de mention va valider votre passage au niveau supérieur.
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Règle : payez l'écolage d'un mois pour débloquer ses cours. Le mois suivant ne peut être payé qu'une fois
        tous les cours du mois terminés à 100 % (leçons + test).
        {totalCourses === 0 && " Aucun cours n'est encore publié pour votre niveau."}
      </p>

      {[1, 2].map((sem) => (
        <div key={sem} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{semesterLabel(data.student.level, sem)} · mois {sem === 1 ? "1 à 4" : "5 à 8"}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.months.filter((m) => m.semester === sem).map((m) => (
              <MonthCard key={m.month} m={m} current={data.currentMonth === m.month} onPay={() => onPay(m)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthCard({ m, current, onPay }: { m: CursusMonth; current: boolean; onPay: () => void }) {
  const unlocked = m.status === "PAID";
  const done = m.courses.filter((c) => c.completed).length;
  return (
    <Card className={current ? "ring-2 ring-classroom/30" : ""}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Mois {m.month}</h3>
            <TuitionBadge status={m.status} />
            {current && <span className="text-[11px] font-medium text-classroom">mois en cours</span>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {m.courses.length} cours · {done}/{m.courses.length} terminés
            {m.payment?.receiptNumber && ` · reçu ${m.payment.receiptNumber}`}
            {m.payment && m.status === "PENDING" && ` · ${methodLabel(m.payment.method)} en cours de vérification`}
          </p>
          {m.status === "REFUSED" && m.payment?.refusedReason && (
            <p className="mt-1 text-xs text-red-600">Paiement refusé : {m.payment.refusedReason}</p>
          )}
        </div>
        {m.canPay ? (
          <button onClick={onPay} className={btnPrimary}><Wallet className="h-4 w-4" /> Payer</button>
        ) : !unlocked && m.status !== "PENDING" && m.lockReason ? (
          <span className="flex max-w-[200px] items-start gap-1 text-right text-[11px] text-muted-foreground"><Lock className="mt-0.5 h-3 w-3 shrink-0" />{m.lockReason}</span>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {m.courses.length === 0 && <p className="text-xs italic text-muted-foreground">Cours pas encore publiés.</p>}
        {m.courses.map((c) => (
          <div key={c.id} className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground">
                  {c.teacher ? `${c.teacher.firstName} ${c.teacher.lastName}` : "—"}
                  {c.relatedCourseIds.length > 0 && " · lié à d'autres cours"}
                </div>
              </div>
              {c.completed ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              ) : unlocked ? (
                <Link to="/online/course/$id" params={{ id: c.id }} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-classroom hover:underline">
                  <PlayCircle className="h-4 w-4" /> {c.myProgress > 0 ? "Continuer" : "Commencer"}
                </Link>
              ) : (
                <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </div>
            {unlocked && <div className="mt-2 flex items-center gap-2"><Bar value={c.myProgress} className="flex-1" /><span className="w-9 text-right text-[11px] text-muted-foreground">{Math.round(c.myProgress)}%</span></div>}
          </div>
        ))}
      </div>
    </Card>
  );
}
