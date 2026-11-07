import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  LayoutDashboard, Settings, Grid3X3, Users, CreditCard, CheckSquare,
  BarChart2, Plus, Pencil, Trash2, Search, Loader2,
  TrendingUp, TrendingDown, Clock, AlertCircle, CheckCircle2,
  RefreshCw, BadgeCheck, Ban, RotateCcw, Receipt,
  ArrowUpRight, DollarSign, Eye, History, Wallet,
  Building2, Coins, BookOpen, ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { useRequireClassroom } from "@/components/classroom/shared";
import { fr } from "date-fns/locale";
import { format } from "date-fns";

import { Empty as EmptyBox, Loading, PageHeader } from "@/components/classroom/cursus-ui";
import { PayDialog, TuitionPanel } from "@/components/classroom/tuition";
import { useMyCursus, useParentCursus, type CursusMonth, type CursusOverview } from "@/lib/cursus";

export const Route = createFileRoute("/classroom/finance")({ component: Finance });

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "settings" | "fee-grids" | "accounts" | "payments" | "validation" | "refunds" | "treasury" | "reports" | "history" | "audit";
type SettingsTab = "fee-types" | "categories" | "currencies" | "payment-methods" | "penalties" | "discounts" | "scholarships" | "accounting" | "cash-registers" | "fiscal-years";
type ItemStatus = "UNPAID" | "RECORDED" | "VALIDATED" | "RECEIPT_ISSUED" | "REFUSED" | "REFUNDED" | "NOT_APPLICABLE";

interface FeeType { id: string; name: string; code: string; category?: string; mandatory: boolean; active: boolean; order: number; }
interface FeeCategory { id: string; name: string; code: string; color?: string; active: boolean; order: number; }
interface Currency { id: string; name: string; code: string; symbol: string; isDefault: boolean; active: boolean; }
interface PaymentMethod { id: string; name: string; code: string; description?: string; active: boolean; order: number; }
interface Penalty { id: string; name: string; code: string; amount?: number; percent?: number; triggerDays: number; active: boolean; }
interface Discount { id: string; name: string; code: string; amount?: number; percent?: number; description?: string; active: boolean; }
interface Scholarship { id: string; name: string; code: string; coverageType: string; coverageValue: number; description?: string; active: boolean; }
interface AccountingAccount { id: string; name: string; code: string; type: string; active: boolean; }
interface CashRegister { id: string; name: string; code: string; description?: string; active: boolean; }
interface FiscalYear { id: string; label: string; startDate: string; endDate: string; isClosed: boolean; }
interface FeeGrid { id: string; name: string; academicYearId: string; mentionId?: string; promotionId?: string; active: boolean; items?: FeeGridItem[]; }
interface FeeGridItem { id: string; feeTypeId: string; feeType?: { name: string; code: string }; amount: number; currency: string; frequency: string; dueDate?: string; isOptional: boolean; order: number; }
interface AccountSummary {
  studentId: string; matricule: string; firstName: string; lastName: string; email?: string;
  mention?: { id: string; name: string } | null;
  promotion?: { id: string; name: string; academicYear?: { id: string; label: string } } | null;
  group?: { id: string; name: string } | null;
  hasAccount: boolean; accountId?: string | null;
  summary: { totalDue: number; totalPaid: number; remaining: number; payStatus: "PAID" | "PARTIAL" | "UNPAID" | "NO_FEES" };
}
interface AccountItem { id: string; label: string; amount: number; currency: string; amountPaid: number; dueDate?: string; status: ItemStatus; feeType?: { name: string; code: string }; receiptNumber?: string; notes?: string; transactions?: Transaction[]; }
interface Transaction { id: string; amount: number; currency: string; method: string; reference?: string; paidAt: string; notes?: string; }
interface StudentAccount {
  studentId: string;
  student: {
    matricule: string;
    user?: { firstName: string; lastName: string };
    mention?: { id: string; name: string } | null;
    promotion?: { id: string; name: string; academicYear?: { id: string; label: string } } | null;
    group?: { id: string; name: string } | null;
  };
  items: AccountItem[];
  summary: { totalExpected: number; totalPaid: number; totalUnpaid: number };
}
interface Dashboard { totalExpected: number; totalPaid: number; totalUnpaid: number; paymentsToday: number; paymentsWeek: number; paymentsMonth: number; pendingValidation: number; byMention: { name: string; expected: number; paid: number }[]; byMethod: { method: string; total: number; count: number }[]; overdueItems: { id: string; label: string; studentName: string; amount: number; dueDate: string }[]; recentPayments: any[]; }

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_STATUS: Record<ItemStatus, { label: string; icon: string; cls: string }> = {
  UNPAID:         { label: "Non payé",     icon: "⬜", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  RECORDED:       { label: "Enregistré",   icon: "🟡", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  VALIDATED:      { label: "Validé",       icon: "🟢", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  RECEIPT_ISSUED: { label: "Reçu édité",   icon: "🔵", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  REFUSED:        { label: "Refusé",       icon: "🔴", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  REFUNDED:       { label: "Remboursé",    icon: "🟣", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  NOT_APPLICABLE: { label: "Non concerné", icon: "—",  cls: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500" },
};

const FREQ_LABELS: Record<string, string> = {
  ONCE: "Une fois", MONTHLY: "Mensuel", QUARTERLY: "Trimestriel", SEMESTRIAL: "Semestriel", ANNUAL: "Annuel",
};

const fmt = (n: number | undefined | null, sym = "MGA") => n == null ? "—" : `${n.toLocaleString("fr-FR")} ${sym}`;

// ─── API helpers ──────────────────────────────────────────────────────────────

const fv2 = (path: string) => `/finance/v2${path}`;

const useSettings = <T,>(key: string, path: string) =>
  useQuery<T[]>({ queryKey: ["fin", key], queryFn: () => api(fv2(path)), staleTime: 5 * 60 * 1000 });

const useFeeTypes     = () => useSettings<FeeType>("fee-types",     "/settings/fee-types");
const useCategories   = () => useSettings<FeeCategory>("categories", "/settings/categories");
const useCurrencies   = () => useSettings<Currency>("currencies",    "/settings/currencies");
const usePayMethods   = () => useSettings<PaymentMethod>("pay-methods", "/settings/payment-methods");
const usePenalties    = () => useSettings<Penalty>("penalties",      "/settings/penalties");
const useDiscounts    = () => useSettings<Discount>("discounts",     "/settings/discounts");
const useScholarships = () => useSettings<Scholarship>("scholarships", "/settings/scholarships");
const useAccounting   = () => useSettings<AccountingAccount>("accounting", "/settings/accounting-accounts");
const useCashRegs     = () => useSettings<CashRegister>("cash-regs", "/settings/cash-registers");
const useFiscalYears  = () => useSettings<FiscalYear>("fiscal-years", "/settings/fiscal-years");
const useFeeGrids     = (qs = "") => useQuery<FeeGrid[]>({ queryKey: ["fin-grids", qs], queryFn: () => api(fv2(`/fee-grids${qs ? `?${qs}` : ""}`)), staleTime: 60 * 1000 });
const useDashboard    = () => useQuery<Dashboard>({ queryKey: ["fin-dash"], queryFn: () => api(fv2("/dashboard")), staleTime: 30 * 1000, refetchInterval: 60 * 1000 });

// ── Structure selects (ERP data — no raw IDs shown to user) ───────────────────
type AcademicYear = { id: string; label: string; isCurrent: boolean };
type Mention = { id: string; name: string };
type Promotion = { id: string; name: string; mentionId: string };
type Group = { id: string; name: string };
const useAcademicYears = () => useQuery<AcademicYear[]>({ queryKey: ["struct-years"], queryFn: () => api("/structure/academic-years"), staleTime: 10 * 60 * 1000 });
const useAllMentions   = () => useQuery<Mention[]>({ queryKey: ["struct-mentions"], queryFn: () => api("/structure/mentions"), staleTime: 10 * 60 * 1000 });
function usePromotionsByMention(mentionId?: string) {
  return useQuery<Promotion[]>({
    queryKey: ["struct-promotions", mentionId ?? "all"],
    queryFn: () => api(mentionId ? `/structure/promotions?mentionId=${mentionId}` : "/structure/promotions"),
    staleTime: 5 * 60 * 1000,
  });
}
function useGroupsByPromotion(promotionId?: string) {
  return useQuery<Group[]>({
    queryKey: ["struct-groups", promotionId ?? ""],
    queryFn: () => api(`/structure/promotions/${promotionId}/groups`),
    staleTime: 5 * 60 * 1000,
    enabled: !!promotionId,
  });
}

function useAccounts(qs: string) {
  return useQuery<{ data: AccountSummary[]; total: number; pages: number }>({
    queryKey: ["fin-accounts", qs], queryFn: () => api(fv2(`/accounts?${qs}`)), staleTime: 30 * 1000,
  });
}
function useAccount(sid: string) {
  return useQuery<StudentAccount>({ queryKey: ["fin-account", sid], queryFn: () => api(fv2(`/accounts/${sid}`)), enabled: !!sid });
}
function useValidationQueue() {
  return useQuery<{ data: AccountItem[]; total: number }>({
    queryKey: ["fin-validation"], queryFn: () => api(fv2("/payments?status=RECORDED&limit=100")),
    staleTime: 15 * 1000, refetchInterval: 30 * 1000,
  });
}
function useAuditLog() {
  return useQuery<any[]>({ queryKey: ["fin-audit"], queryFn: () => api(fv2("/audit")), staleTime: 30 * 1000 });
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Finance() {
  const { user, roles } = useRequireClassroom();
  const [tab, setTab] = useState<Tab>("dashboard");
  const sysRole = user?.systemRole ?? "";
  const isAdmin = sysRole === "SUPER_ADMIN";
  const canManage = isAdmin || roles?.some(r => r.roleName?.includes("Finance") || r.roleName?.includes("Trésorier"));

  // Étudiant / parent : uniquement leurs propres paiements d'écolage (pas de tableau
  // de bord ni de liste des comptes étudiants).
  if (sysRole === "STUDENT") return <StudentPayments />;
  if (sysRole === "PARENT")  return <ParentPayments />;

  const tabs: { id: Tab; label: string; Icon: any }[] = [
    { id: "dashboard",   label: "Tableau de bord",     Icon: LayoutDashboard },
    ...(canManage ? [{ id: "settings" as Tab,  label: "Paramètres",          Icon: Settings }] : []),
    ...(canManage ? [{ id: "fee-grids" as Tab, label: "Grilles tarifaires", Icon: Grid3X3 }] : []),
    { id: "accounts",    label: "Comptes étudiants",   Icon: Users },
    { id: "payments",    label: "Paiements",            Icon: CreditCard },
    ...(canManage ? [
      { id: "validation" as Tab, label: "Validation",   Icon: CheckSquare },
      { id: "refunds" as Tab,    label: "Remboursements",Icon: RotateCcw },
      { id: "treasury" as Tab,   label: "Trésorerie",   Icon: Wallet },
    ] : []),
    { id: "reports",     label: "Rapports",             Icon: BarChart2 },
    ...(canManage ? [
      { id: "history" as Tab,    label: "Historique",   Icon: History },
      { id: "audit" as Tab,      label: "Audit",        Icon: ShieldCheck },
    ] : []),
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h1 className="text-xl font-bold">Finance Étudiante</h1>
          <p className="text-xs text-muted-foreground">Paiements, trésorerie et suivi financier des étudiants</p>
        </div>
      </div>

      <div className="flex gap-0.5 border-b mb-4 overflow-x-auto shrink-0">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pb-4">
        {tab === "dashboard"   && <DashboardTab />}
        {tab === "settings"    && <SettingsTab />}
        {tab === "fee-grids"   && <FeeGridsTab />}
        {tab === "accounts"    && <AccountsTab />}
        {tab === "payments"    && <PaymentsTab />}
        {tab === "validation"  && <ValidationTab />}
        {tab === "refunds"     && <RefundsTab />}
        {tab === "treasury"    && <TreasuryTab />}
        {tab === "reports"     && <ReportsTab />}
        {tab === "history"     && <HistoryTab />}
        {tab === "audit"       && <AuditTab />}
      </div>
    </div>
  );
}

// ─── Étudiant / Parent ────────────────────────────────────────────────────────

function StudentPayments() {
  const cursus = useMyCursus();
  const [payMonth, setPayMonth] = useState<CursusMonth | null>(null);
  if (cursus.isLoading) return <Loading />;
  if (!cursus.data) return <EmptyBox>Aucune information de paiement disponible.</EmptyBox>;
  return (
    <div className="space-y-5">
      <PageHeader title="Paiements" subtitle="Suivi de votre écolage mensuel." />
      <TuitionPanel data={cursus.data} onPay={setPayMonth} />
      {payMonth && (
        <PayDialog month={payMonth} amount={cursus.data.monthlyAmount} currency={cursus.data.currency} onClose={() => setPayMonth(null)} />
      )}
    </div>
  );
}

function ParentPayments() {
  const children = useParentCursus();
  if (children.isLoading) return <Loading />;
  const list = children.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Paiements" subtitle="Suivi de l'écolage de vos enfants." />
      {list.length === 0 && <EmptyBox>Aucun enfant rattaché à votre compte.</EmptyBox>}
      {list.map((c) => (
        <section key={c.student.id} className="space-y-3">
          <h2 className="text-lg font-semibold">
            {c.student.user.firstName} {c.student.user.lastName}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{c.student.promotion?.name ?? ""} · {c.student.mention?.name ?? ""}</span>
          </h2>
          <TuitionPanel data={c.cursus} />
        </section>
      ))}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardTab() {
  const { data, isLoading } = useDashboard();
  if (isLoading) return <Spinner />;
  if (!data) return <Empty label="Impossible de charger le tableau de bord" />;

  const pct = data.totalExpected > 0 ? Math.round((data.totalPaid / data.totalExpected) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total attendu"        value={fmt(data.totalExpected)}  icon={<DollarSign size={15}/>}  color="blue" />
        <Kpi label="Total encaissé"       value={fmt(data.totalPaid)}      icon={<TrendingUp size={15}/>}  color="green" />
        <Kpi label="Reste à collecter"    value={fmt(data.totalUnpaid)}    icon={<TrendingDown size={15}/>}color="amber" />
        <Kpi label="En attente validation"value={String(data.pendingValidation)} icon={<Clock size={15}/>} color="purple" />
      </div>

      {/* Collection rate bar */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold">Taux de recouvrement</span>
          <span className="text-xl font-bold text-primary">{pct}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5">
          <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Timeline */}
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Encaissements</h3>
          {[{ l: "Aujourd'hui", v: data.paymentsToday }, { l: "Cette semaine", v: data.paymentsWeek }, { l: "Ce mois", v: data.paymentsMonth }].map(({ l, v }) => (
            <div key={l} className="flex justify-between py-2 border-b last:border-0">
              <span className="text-sm text-muted-foreground">{l}</span>
              <span className="text-sm font-semibold">{fmt(v)}</span>
            </div>
          ))}
        </div>

        {/* By method */}
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Par méthode de paiement</h3>
          {data.byMethod.length === 0 ? <p className="text-xs text-muted-foreground">Aucun paiement</p> :
            data.byMethod.map(m => (
              <div key={m.method} className="flex justify-between py-2 border-b last:border-0">
                <span className="text-sm">{m.method}</span>
                <div className="text-right">
                  <div className="text-sm font-semibold">{fmt(m.total)}</div>
                  <div className="text-xs text-muted-foreground">{m.count} opération(s)</div>
                </div>
              </div>
            ))
          }
        </div>

        {/* By mention */}
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Par mention</h3>
          {(data.byMention ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Aucune donnée</p> :
            data.byMention.map(m => {
              const mpct = m.expected > 0 ? Math.round((m.paid / m.expected) * 100) : 0;
              return (
                <div key={m.name} className="py-2 border-b last:border-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium">{m.name}</span>
                    <span className="text-xs font-semibold">{mpct}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${mpct}%` }} />
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>

      {/* Overdue alert */}
      {(data.overdueItems?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/30 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
            <AlertCircle size={14} /> {data.overdueItems.length} frais en retard
          </h3>
          {data.overdueItems.slice(0, 5).map(o => (
            <div key={o.id} className="flex justify-between text-xs py-1 text-red-700 dark:text-red-300">
              <span className="font-medium">{o.studentName}</span>
              <span>{o.label} — {fmt(o.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent payments */}
      <Card title="Paiements récents" noPad>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 46rem)" }}>
          <table className="w-full text-sm">
            <THead cols={["Date", "Étudiant", "Frais", "Méthode", "Montant"]} />
            <tbody>
              {(data.recentPayments ?? []).length === 0
                ? <EmptyRow cols={5} label="Aucune transaction récente" />
                : (data.recentPayments ?? []).map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-muted/20">
                    <Td>{p.paidAt ? format(new Date(p.paidAt), "dd/MM HH:mm", { locale: fr }) : "—"}</Td>
                    <Td>{p.accountItem?.account?.student?.user ? `${p.accountItem.account.student.user.firstName} ${p.accountItem.account.student.user.lastName}` : "—"}</Td>
                    <Td>{p.accountItem?.label ?? "—"}</Td>
                    <Td>{p.method}</Td>
                    <Td right><span className="font-semibold text-emerald-600">{fmt(p.amount)}</span></Td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function SettingsTab() {
  const [sub, setSub] = useState<SettingsTab>("fee-types");
  const subTabs: { id: SettingsTab; label: string }[] = [
    { id: "fee-types",    label: "Types de frais" },
    { id: "categories",   label: "Catégories" },
    { id: "currencies",   label: "Devises" },
    { id: "payment-methods", label: "Méthodes de paiement" },
    { id: "penalties",    label: "Pénalités" },
    { id: "discounts",    label: "Remises" },
    { id: "scholarships", label: "Bourses" },
    { id: "accounting",   label: "Comptes comptables" },
    { id: "cash-registers", label: "Caisses" },
    { id: "fiscal-years", label: "Exercices financiers" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {subTabs.map(({ id, label }) => (
          <button key={id} onClick={() => setSub(id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${sub === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
            {label}
          </button>
        ))}
      </div>
      {sub === "fee-types"       && <FeeTypesPanel />}
      {sub === "categories"      && <SimpleCrud<FeeCategory> key="cat" title="Catégories de frais" qKey="fin-categories" path="/settings/categories" cols={[{ key: "code", label: "Code", render: r => <Code>{r.code}</Code> }, { key: "name", label: "Nom" }, { key: "active", label: "Statut", render: r => <ActiveBadge v={r.active} /> }]} fields={[{ key: "name", label: "Nom" }, { key: "code", label: "Code" }, { key: "color", label: "Couleur (hex)" }]} boolFields={["active"]} />}
      {sub === "currencies"      && <SimpleCrud<Currency> key="cur" title="Devises" qKey="fin-currencies" path="/settings/currencies" cols={[{ key: "code", label: "Code", render: r => <Code>{r.code}</Code> }, { key: "name", label: "Nom" }, { key: "symbol", label: "Symbole" }, { key: "isDefault", label: "Défaut", render: r => r.isDefault ? <ActiveBadge v /> : null }, { key: "active", label: "Statut", render: r => <ActiveBadge v={r.active} /> }]} fields={[{ key: "name", label: "Nom" }, { key: "code", label: "Code ISO" }, { key: "symbol", label: "Symbole" }]} boolFields={["isDefault", "active"]} />}
      {sub === "payment-methods" && <SimpleCrud<PaymentMethod> key="pm" title="Méthodes de paiement" qKey="fin-pay-methods" path="/settings/payment-methods" cols={[{ key: "code", label: "Code", render: r => <Code>{r.code}</Code> }, { key: "name", label: "Nom" }, { key: "description", label: "Description", render: r => r.description ?? "—" }, { key: "active", label: "Statut", render: r => <ActiveBadge v={r.active} /> }]} fields={[{ key: "name", label: "Nom" }, { key: "code", label: "Code" }, { key: "description", label: "Description" }]} boolFields={["active"]} />}
      {sub === "penalties"       && <PenaltiesPanel />}
      {sub === "discounts"       && <SimpleCrud<Discount> key="dis" title="Remises" qKey="fin-discounts" path="/settings/discounts" cols={[{ key: "code", label: "Code", render: r => <Code>{r.code}</Code> }, { key: "name", label: "Nom" }, { key: "amount", label: "Valeur", render: r => r.amount ? fmt(r.amount) : r.percent ? `${r.percent}%` : "—" }, { key: "active", label: "Statut", render: r => <ActiveBadge v={r.active} /> }]} fields={[{ key: "name", label: "Nom" }, { key: "code", label: "Code" }, { key: "description", label: "Description" }]} numFields={[{ key: "amount", label: "Montant fixe (MGA)" }, { key: "percent", label: "Pourcentage (%)" }]} boolFields={["active"]} />}
      {sub === "scholarships"    && <SimpleCrud<Scholarship> key="sch" title="Bourses" qKey="fin-scholarships" path="/settings/scholarships" cols={[{ key: "code", label: "Code", render: r => <Code>{r.code}</Code> }, { key: "name", label: "Nom" }, { key: "coverageValue", label: "Couverture", render: r => r.coverageType === "PERCENT" ? `${r.coverageValue}%` : fmt(r.coverageValue) }, { key: "active", label: "Statut", render: r => <ActiveBadge v={r.active} /> }]} fields={[{ key: "name", label: "Nom" }, { key: "code", label: "Code" }, { key: "description", label: "Description" }]} numFields={[{ key: "coverageValue", label: "Valeur de couverture" }]} boolFields={["active"]} />}
      {sub === "accounting"      && <SimpleCrud<AccountingAccount> key="acc" title="Comptes comptables" qKey="fin-accounting" path="/settings/accounting-accounts" cols={[{ key: "code", label: "N° Compte", render: r => <Code>{r.code}</Code> }, { key: "name", label: "Intitulé" }, { key: "type", label: "Type" }, { key: "active", label: "Statut", render: r => <ActiveBadge v={r.active} /> }]} fields={[{ key: "name", label: "Intitulé" }, { key: "code", label: "N° Compte" }]} selectFields={[{ key: "type", label: "Type", options: [{ value: "REVENUE", label: "Produit" }, { value: "EXPENSE", label: "Charge" }, { value: "ASSET", label: "Actif" }, { value: "LIABILITY", label: "Passif" }] }]} boolFields={["active"]} />}
      {sub === "cash-registers"  && <SimpleCrud<CashRegister> key="cr" title="Caisses" qKey="fin-cash-regs" path="/settings/cash-registers" cols={[{ key: "code", label: "Code", render: r => <Code>{r.code}</Code> }, { key: "name", label: "Nom" }, { key: "description", label: "Description", render: r => r.description ?? "—" }, { key: "active", label: "Statut", render: r => <ActiveBadge v={r.active} /> }]} fields={[{ key: "name", label: "Nom" }, { key: "code", label: "Code" }, { key: "description", label: "Description" }]} boolFields={["active"]} />}
      {sub === "fiscal-years"    && <FiscalYearsPanel />}
    </div>
  );
}

function FeeTypesPanel() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useFeeTypes();
  const { data: cats = [] } = useCategories();
  const [form, setForm] = useState<Partial<FeeType> | null>(null);

  const save = useMutation({
    mutationFn: (d: any) => form?.id ? api(fv2(`/settings/fee-types/${form.id}`), { method: "PUT", body: d }) : api(fv2("/settings/fee-types"), { method: "POST", body: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fin", "fee-types"] }); setForm(null); toast.success("Enregistré"); },
    onError: () => toast.error("Erreur"),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(fv2(`/settings/fee-types/${id}`), { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fin", "fee-types"] }); toast.success("Supprimé"); },
    onError: (e: any) => toast.error(e?.message ?? "Impossible de supprimer — ce type est utilisé"),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Btn onClick={() => setForm({ mandatory: true, active: true, order: data.length })}>
          <Plus size={13} /> Ajouter
        </Btn>
      </div>
      {form !== null && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">{form.id ? "Modifier" : "Nouveau type de frais"}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Nom" value={form.name ?? ""} onChange={v => setForm(p => ({ ...p!, name: v }))} />
            <F label="Code unique" value={form.code ?? ""} onChange={v => setForm(p => ({ ...p!, code: v.toUpperCase() }))} />
            <div>
              <label className="label">Catégorie</label>
              <select value={form.category ?? ""} onChange={e => setForm(p => ({ ...p!, category: e.target.value }))} className="sel">
                <option value="">— Aucune —</option>
                {cats.map(c => <option key={c.id} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <F label="Ordre d'affichage" type="number" value={String(form.order ?? 0)} onChange={v => setForm(p => ({ ...p!, order: Number(v) }))} />
          </div>
          <div className="flex gap-6">
            <Check label="Obligatoire" checked={form.mandatory ?? true} onChange={v => setForm(p => ({ ...p!, mandatory: v }))} />
            <Check label="Actif" checked={form.active ?? true} onChange={v => setForm(p => ({ ...p!, active: v }))} />
          </div>
          <FormActions onCancel={() => setForm(null)} onSave={() => save.mutate(form)} loading={save.isPending} />
        </div>
      )}
      <CrudTable<FeeType>
        data={data} isLoading={isLoading}
        cols={[
          { key: "order", label: "#", render: r => <span className="text-muted-foreground">{r.order}</span> },
          { key: "code", label: "Code", render: r => <Code>{r.code}</Code> },
          { key: "name", label: "Nom" },
          { key: "category", label: "Catégorie", render: r => r.category ?? "—" },
          { key: "mandatory", label: "Obligatoire", render: r => r.mandatory ? <ActiveBadge v /> : <span className="text-xs text-muted-foreground">Non</span> },
          { key: "active", label: "Statut", render: r => <ActiveBadge v={r.active} /> },
        ]}
        onEdit={setForm}
        onDelete={r => del.mutate(r.id)}
      />
    </div>
  );
}

function PenaltiesPanel() {
  const qc = useQueryClient();
  const { data = [], isLoading } = usePenalties();
  const [form, setForm] = useState<Partial<Penalty> | null>(null);
  const save = useMutation({
    mutationFn: (d: any) => form?.id ? api(fv2(`/settings/penalties/${form.id}`), { method: "PUT", body: d }) : api(fv2("/settings/penalties"), { method: "POST", body: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fin", "penalties"] }); setForm(null); toast.success("Enregistré"); },
  });
  const del = useMutation({
    mutationFn: (id: string) => api(fv2(`/settings/penalties/${id}`), { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fin", "penalties"] }); toast.success("Supprimé"); },
  });
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Btn onClick={() => setForm({ active: true, triggerDays: 30 })}><Plus size={13} /> Ajouter</Btn></div>
      {form !== null && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Nom" value={form.name ?? ""} onChange={v => setForm(p => ({ ...p!, name: v }))} />
            <F label="Code" value={form.code ?? ""} onChange={v => setForm(p => ({ ...p!, code: v.toUpperCase() }))} />
            <F label="Déclenchement après (j)" type="number" value={String(form.triggerDays ?? 30)} onChange={v => setForm(p => ({ ...p!, triggerDays: Number(v) }))} />
            <F label="Montant fixe (MGA)" type="number" value={form.amount != null ? String(form.amount) : ""} onChange={v => setForm(p => ({ ...p!, amount: v ? Number(v) : undefined }))} placeholder="OU..." />
            <F label="Pourcentage (%)" type="number" value={form.percent != null ? String(form.percent) : ""} onChange={v => setForm(p => ({ ...p!, percent: v ? Number(v) : undefined }))} placeholder="OU..." />
          </div>
          <FormActions onCancel={() => setForm(null)} onSave={() => save.mutate(form)} loading={save.isPending} />
        </div>
      )}
      <CrudTable<Penalty> data={data} isLoading={isLoading}
        cols={[
          { key: "code", label: "Code", render: r => <Code>{r.code}</Code> },
          { key: "name", label: "Nom" },
          { key: "triggerDays", label: "Après", render: r => `${r.triggerDays} j` },
          { key: "amount", label: "Montant", render: r => r.amount != null ? fmt(r.amount) : r.percent != null ? `${r.percent}%` : "—" },
        ]}
        onEdit={setForm} onDelete={r => del.mutate(r.id)}
      />
    </div>
  );
}

function FiscalYearsPanel() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useFiscalYears();
  const [form, setForm] = useState<Partial<FiscalYear> | null>(null);
  const save = useMutation({
    mutationFn: (d: any) => form?.id ? api(fv2(`/settings/fiscal-years/${form.id}`), { method: "PUT", body: d }) : api(fv2("/settings/fiscal-years"), { method: "POST", body: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fin", "fiscal-years"] }); setForm(null); toast.success("Enregistré"); },
  });
  const del = useMutation({
    mutationFn: (id: string) => api(fv2(`/settings/fiscal-years/${id}`), { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fin", "fiscal-years"] }); toast.success("Supprimé"); },
  });
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Btn onClick={() => setForm({ isClosed: false })}><Plus size={13} /> Ajouter</Btn></div>
      {form !== null && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Libellé" value={form.label ?? ""} onChange={v => setForm(p => ({ ...p!, label: v }))} placeholder="Ex: 2026-2027" />
            <F label="Date de début" type="date" value={form.startDate?.slice(0, 10) ?? ""} onChange={v => setForm(p => ({ ...p!, startDate: v }))} />
            <F label="Date de fin" type="date" value={form.endDate?.slice(0, 10) ?? ""} onChange={v => setForm(p => ({ ...p!, endDate: v }))} />
          </div>
          <Check label="Exercice clôturé" checked={form.isClosed ?? false} onChange={v => setForm(p => ({ ...p!, isClosed: v }))} />
          <FormActions onCancel={() => setForm(null)} onSave={() => save.mutate(form)} loading={save.isPending} />
        </div>
      )}
      <CrudTable<FiscalYear & { id: string }> data={data as any} isLoading={isLoading}
        cols={[
          { key: "label", label: "Exercice" },
          { key: "startDate", label: "Début", render: r => format(new Date(r.startDate), "dd/MM/yyyy") },
          { key: "endDate", label: "Fin", render: r => format(new Date(r.endDate), "dd/MM/yyyy") },
          { key: "isClosed", label: "Statut", render: r => r.isClosed ? <span className="text-xs text-muted-foreground">Clôturé</span> : <ActiveBadge v label="En cours" /> },
        ]}
        onEdit={setForm} onDelete={r => del.mutate(r.id)}
      />
    </div>
  );
}

// Generic SimpleCrud for simple settings entities
function SimpleCrud<T extends { id: string; active?: boolean }>({
  title, qKey, path, cols, fields = [], numFields = [], selectFields = [], boolFields = [],
}: {
  title: string; qKey: string; path: string;
  cols: { key: string; label: string; render?: (r: T) => React.ReactNode }[];
  fields?: { key: string; label: string; placeholder?: string }[];
  numFields?: { key: string; label: string }[];
  selectFields?: { key: string; label: string; options: { value: string; label: string }[] }[];
  boolFields?: string[];
}) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery<T[]>({ queryKey: ["fin", qKey], queryFn: () => api(fv2(path)), staleTime: 5 * 60 * 1000 });
  const [form, setForm] = useState<Partial<T> | null>(null);
  const set = (k: string, v: any) => setForm(p => ({ ...p!, [k]: v } as any));

  const save = useMutation({
    mutationFn: (d: any) => (form as any)?.id ? api(fv2(`${path}/${(form as any).id}`), { method: "PUT", body: d }) : api(fv2(path), { method: "POST", body: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fin", qKey] }); setForm(null); toast.success("Enregistré"); },
    onError: () => toast.error("Erreur"),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(fv2(`${path}/${id}`), { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fin", qKey] }); toast.success("Supprimé"); },
    onError: () => toast.error("Impossible de supprimer"),
  });

  const initForm = () => {
    const init: any = {};
    boolFields.forEach(k => { init[k] = k === "active"; });
    setForm(init);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">{title}</p>
        <Btn onClick={initForm}><Plus size={13} /> Ajouter</Btn>
      </div>
      {form !== null && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(f => <F key={f.key} label={f.label} value={(form as any)[f.key] ?? ""} onChange={v => set(f.key, v)} placeholder={f.placeholder} />)}
            {numFields.map(f => <F key={f.key} label={f.label} type="number" value={(form as any)[f.key] != null ? String((form as any)[f.key]) : ""} onChange={v => set(f.key, v ? Number(v) : undefined)} />)}
            {selectFields.map(f => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <select value={(form as any)[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} className="sel">
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-4 flex-wrap">
            {boolFields.map(k => <Check key={k} label={k === "active" ? "Actif" : k === "isDefault" ? "Par défaut" : k} checked={(form as any)[k] ?? false} onChange={v => set(k, v)} />)}
          </div>
          <FormActions onCancel={() => setForm(null)} onSave={() => save.mutate(form)} loading={save.isPending} />
        </div>
      )}
      <CrudTable<T> data={data} isLoading={isLoading} cols={cols} onEdit={setForm as any} onDelete={r => del.mutate((r as any).id)} />
    </div>
  );
}

// ─── Fee Grids ────────────────────────────────────────────────────────────────

function FeeGridsTab() {
  const qc = useQueryClient();
  const { data: grids = [], isLoading } = useFeeGrids();
  const { data: feeTypes = [] } = useFeeTypes();
  const { data: years = [] } = useAcademicYears();
  const { data: mentions = [] } = useAllMentions();
  const [selected, setSelected] = useState<FeeGrid | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<FeeGrid>>({ name: "", active: true });
  const [items, setItems] = useState<Partial<FeeGridItem>[]>([]);
  const { data: promotions = [] } = usePromotionsByMention(form.mentionId);
  const { data: groups = [] } = useGroupsByPromotion(form.promotionId);

  const saveGrid = useMutation({
    mutationFn: (d: any) => api(fv2("/fee-grids"), { method: "POST", body: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fin-grids"] }); setShowForm(false); setForm({ name: "", active: true }); setItems([]); toast.success("Grille créée"); },
    onError: () => toast.error("Erreur"),
  });
  const delGrid = useMutation({
    mutationFn: (id: string) => api(fv2(`/fee-grids/${id}`), { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fin-grids"] }); setSelected(null); toast.success("Grille supprimée"); },
    onError: () => toast.error("Impossible de supprimer"),
  });
  const applyGrid = useMutation({
    mutationFn: (id: string) => api(fv2(`/fee-grids/${id}/apply`), { method: "POST" }),
    onSuccess: (r: any) => toast.success(`Grille appliquée — ${r.created ?? 0} frais créés, ${r.skipped ?? 0} ignorés`),
    onError: () => toast.error("Erreur lors de l'application"),
  });

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground">← Retour</button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-semibold">{selected.name}</span>
          <div className="ml-auto">
            <Btn variant="green" onClick={() => applyGrid.mutate(selected.id)} loading={applyGrid.isPending}>
              <ArrowUpRight size={13} /> Appliquer aux étudiants
            </Btn>
          </div>
        </div>
        <GridDetail grid={selected} feeTypes={feeTypes} onRefresh={() => qc.invalidateQueries({ queryKey: ["fin-grid", selected.id] })} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Btn onClick={() => { setShowForm(true); setForm({ name: "", active: true }); setItems([]); }}><Plus size={13} /> Nouvelle grille</Btn>
      </div>

      {showForm && (
        <div className="rounded-2xl border bg-card p-4 space-y-4">
          <p className="text-sm font-semibold">Nouvelle grille tarifaire</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Nom de la grille" value={form.name ?? ""} onChange={v => setForm(p => ({ ...p, name: v }))} />
            <div>
              <label className="label">Année universitaire</label>
              <select value={form.academicYearId ?? ""} onChange={e => setForm(p => ({ ...p, academicYearId: e.target.value }))} className="sel">
                <option value="">— Choisir une année —</option>
                {years.map(y => <option key={y.id} value={y.id}>{y.label}{y.isCurrent ? " ★ actuelle" : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Mention (optionnel)</label>
              <select value={form.mentionId ?? ""} onChange={e => setForm(p => ({ ...p, mentionId: e.target.value || undefined, promotionId: undefined }))} className="sel">
                <option value="">— Toutes les mentions —</option>
                {mentions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Promotion (optionnel)</label>
              <select value={form.promotionId ?? ""} onChange={e => setForm(p => ({ ...p, promotionId: e.target.value || undefined }))} className="sel" disabled={!form.mentionId}>
                <option value="">— Toutes les promotions —</option>
                {promotions.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
              </select>
            </div>
            {groups.length > 0 && (
              <div>
                <label className="label">Groupe (optionnel)</label>
                <select value={(form as any).groupId ?? ""} onChange={e => setForm(p => ({ ...p, groupId: e.target.value || undefined } as any))} className="sel">
                  <option value="">— Tous les groupes —</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Lignes de frais</p>
              <button onClick={() => setItems(p => [...p, { feeTypeId: "", amount: 0, currency: "MGA", frequency: "ONCE", isOptional: false }])}
                className="flex items-center gap-1 text-xs text-primary hover:underline"><Plus size={12} /> Ajouter une ligne</button>
            </div>
            {items.length === 0 && <p className="text-xs text-muted-foreground">Aucune ligne — cliquez sur « Ajouter une ligne »</p>}
            {items.map((item, i) => (
              <div key={i} className="grid gap-2 grid-cols-2 sm:grid-cols-5 items-end border rounded-xl p-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">Type de frais</label>
                  <select value={item.feeTypeId} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, feeTypeId: e.target.value } : x))} className="sel">
                    <option value="">Choisir...</option>
                    {feeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
                  </select>
                </div>
                <F label="Montant (MGA)" type="number" value={String(item.amount ?? 0)} onChange={v => setItems(p => p.map((x, j) => j === i ? { ...x, amount: Number(v) } : x))} />
                <div>
                  <label className="label">Fréquence</label>
                  <select value={item.frequency ?? "ONCE"} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, frequency: e.target.value } : x))} className="sel">
                    {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <F label="Échéance" type="date" value={item.dueDate?.slice(0, 10) ?? ""} onChange={v => setItems(p => p.map((x, j) => j === i ? { ...x, dueDate: v } : x))} />
                <div className="flex items-center gap-2 pt-5">
                  <Check label="Opt." checked={item.isOptional ?? false} onChange={v => setItems(p => p.map((x, j) => j === i ? { ...x, isOptional: v } : x))} />
                  <button onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="ml-auto text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <FormActions onCancel={() => setShowForm(false)} onSave={() => saveGrid.mutate({ ...form, items })} loading={saveGrid.isPending} />
        </div>
      )}

      {isLoading ? <Spinner /> : grids.length === 0 ? (
        <Empty label="Aucune grille tarifaire" sub="Créez une grille pour définir les frais par promotion" Icon={Grid3X3} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {grids.map(g => (
            <div key={g.id} className="rounded-2xl border bg-card p-4 space-y-3 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{g.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{g.items?.length ?? 0} ligne(s) de frais</p>
                </div>
                <ActiveBadge v={g.active} />
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <button onClick={() => setSelected(g)} className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg bg-muted hover:bg-muted/70">
                  <Eye size={12} /> Détail
                </button>
                <Btn variant="green" size="sm" onClick={() => applyGrid.mutate(g.id)} loading={applyGrid.isPending}>
                  <ArrowUpRight size={12} /> Appliquer
                </Btn>
                <button onClick={() => delGrid.mutate(g.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GridDetail({ grid, feeTypes, onRefresh }: { grid: FeeGrid; feeTypes: FeeType[]; onRefresh: () => void }) {
  const { data: detail, isLoading } = useQuery<FeeGrid>({ queryKey: ["fin-grid", grid.id], queryFn: () => api(fv2(`/fee-grids/${grid.id}`)) });
  if (isLoading) return <Spinner />;
  const items = detail?.items ?? [];
  const total = items.reduce((s, i) => s + i.amount, 0);
  return (
    <Card title={detail?.name ?? grid.name} subtitle={`${items.length} frais configurés`} noPad>
      <table className="w-full text-sm">
        <THead cols={["Type de frais", "Montant", "Fréquence", "Obligatoire", "Échéance"]} />
        <tbody>
          {items.length === 0 ? <EmptyRow cols={5} label="Aucune ligne dans cette grille" /> :
            items.map(item => (
              <tr key={item.id} className="border-b hover:bg-muted/20">
                <Td bold>{item.feeType?.name ?? feeTypes.find(f => f.id === item.feeTypeId)?.name ?? "—"}</Td>
                <Td right><span className="font-semibold">{fmt(item.amount)}</span></Td>
                <Td muted>{FREQ_LABELS[item.frequency] ?? item.frequency}</Td>
                <Td>{item.isOptional ? <span className="text-xs text-muted-foreground">Optionnel</span> : <ActiveBadge v label="Obligatoire" />}</Td>
                <Td muted>{item.dueDate ? format(new Date(item.dueDate), "dd/MM/yyyy") : "—"}</Td>
              </tr>
            ))
          }
          {items.length > 0 && (
            <tr className="bg-muted/30 font-bold">
              <td className="px-4 py-2 text-sm">Total</td>
              <Td right><span className="font-bold">{fmt(total)}</span></Td>
              <td colSpan={3} />
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

// ─── Student Accounts ─────────────────────────────────────────────────────────

const PAY_STATUS: Record<string, { label: string; cls: string }> = {
  PAID:    { label: "Soldé",           cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
  PARTIAL: { label: "Partiel",         cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  UNPAID:  { label: "Non payé",        cls: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" },
  NO_FEES: { label: "Aucun frais",     cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
};

function SyncFeesButton() {
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  async function sync() {
    setSyncing(true);
    try {
      const r = await api(fv2("/accounts/sync-fees"), { method: "POST" }) as { students: number; itemsCreated: number };
      toast.success(`Synchronisation terminée — ${r.itemsCreated} frais appliqués sur ${r.students} étudiants`);
      qc.invalidateQueries({ queryKey: ["fin-accounts"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSyncing(false); }
  }
  return (
    <button onClick={sync} disabled={syncing}
      className="flex items-center gap-1.5 rounded-xl border border-dashed border-classroom/40 px-3 py-1.5 text-xs font-medium text-classroom hover:bg-classroom/5 disabled:opacity-50 transition-colors whitespace-nowrap">
      {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
      Synchroniser les frais
    </button>
  );
}

// Comptes étudiants : regroupés par mois d'écolage puis par mention — on n'affiche
// que le nom, la mention et le statut ; un clic ouvre le détail complet.
type MonthStatus = "PAID" | "PENDING" | "REFUSED" | "UNPAID";
type MonthRow = {
  studentId: string; matricule: string; firstName: string; lastName: string;
  mention: { id: string; name: string } | null; promotion: { name: string; level: string } | null;
  status: MonthStatus; amount: number | null;
};
const MONTH_ST: Record<MonthStatus, { label: string; cls: string }> = {
  PAID:    { label: "Payé",       cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  PENDING: { label: "En attente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  REFUSED: { label: "Refusé",     cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  UNPAID:  { label: "Impayé",     cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

function AccountsTab() {
  const [month, setMonth]       = useState(1);
  const [search, setSearch]     = useState("");
  const [mentionId, setMention] = useState("");
  const [status, setStatus]     = useState<MonthStatus | "">("");
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen]         = useState<Record<string, boolean>>({});

  const { data: mentionsData = [] } = useAllMentions();
  const qs = new URLSearchParams({
    month: String(month),
    ...(search.length >= 2 ? { q: search } : {}),
    ...(mentionId ? { mentionId } : {}),
    ...(status ? { status } : {}),
  }).toString();
  const { data, isLoading } = useQuery<{ month: number; counts: Record<string, Record<MonthStatus, number>>; items: MonthRow[] }>({
    queryKey: ["fin-tuition-month", qs],
    queryFn: () => api(`/cursus/tuition/by-month?${qs}`),
    staleTime: 30 * 1000,
  });

  if (selected) return <StudentDetail studentId={selected} onBack={() => setSelected(null)} />;

  const items = data?.items ?? [];
  const groups = items.reduce<Record<string, MonthRow[]>>((acc, r) => {
    const k = r.mention?.name ?? "Sans mention";
    (acc[k] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {/* Mois d'écolage */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((m) => {
          const c = data?.counts?.[m];
          const total = c ? c.PAID + c.PENDING + c.REFUSED + c.UNPAID : 0;
          return (
            <button key={m} onClick={() => setMonth(m)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition ${month === m ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>
              <div className="font-semibold">Mois {m} <span className="font-normal text-muted-foreground">· S{m <= 4 ? 1 : 2}</span></div>
              {c && <div className="text-[10px] text-muted-foreground">{c.PAID}/{total} payés{c.PENDING ? ` · ${c.PENDING} en attente` : ""}</div>}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom ou matricule…"
            className="w-full rounded-xl border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <select value={mentionId} onChange={e => setMention(e.target.value)} className="sel w-44">
          <option value="">Toutes mentions</option>
          {mentionsData.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div className="flex gap-1">
          {(["", "PAID", "PENDING", "UNPAID"] as const).map((st) => (
            <button key={st || "all"} onClick={() => setStatus(st)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs ${status === st ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>
              {st ? MONTH_ST[st].label : "Tous"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <Spinner /> : items.length === 0 ? (
        <Empty label="Aucun étudiant pour ces critères" />
      ) : (
        <div className="space-y-2">
          {Object.entries(groups).map(([name, rows]) => {
            const isOpen = open[name] ?? Object.keys(groups).length === 1;
            const paid = rows.filter((r) => r.status === "PAID").length;
            return (
              <Card key={name} noPad>
                <button onClick={() => setOpen((o) => ({ ...o, [name]: !isOpen }))}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30">
                  <ChevronRight size={14} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  <span className="font-semibold text-sm">{name}</span>
                  <span className="text-xs text-muted-foreground">{rows.length} étudiant(s)</span>
                  <span className="ml-auto text-xs text-emerald-600">{paid} payé(s)</span>
                </button>
                {isOpen && (
                  <table className="w-full text-sm border-t">
                    <THead cols={["Nom et prénom", "Mention", "Statut"]} />
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.studentId} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(r.studentId)}>
                          <Td bold>{r.lastName} {r.firstName}</Td>
                          <Td muted>{r.mention?.name ?? "—"}</Td>
                          <td className="px-4 py-2"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${MONTH_ST[r.status].cls}`}>{MONTH_ST[r.status].label}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Détail d'un étudiant : écolage mensuel + autres frais / factures
type StudentTuitionDetail = CursusOverview & {
  student: CursusOverview["student"] & { user: { firstName: string; lastName: string; email: string; phone?: string | null } };
};

function StudentDetail({ studentId, onBack }: { studentId: string; onBack: () => void }) {
  const [view, setView] = useState<"tuition" | "fees">("tuition");
  const { data, isLoading } = useQuery<StudentTuitionDetail>({
    queryKey: ["fin-tuition-student", studentId],
    queryFn: () => api(`/cursus/tuition/student/${studentId}`),
  });
  if (view === "fees") return <StudentAccountDetail studentId={studentId} onBack={() => setView("tuition")} />;
  if (isLoading) return <Spinner />;
  if (!data) return <Empty label="Étudiant introuvable" />;
  const u = data.student.user;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted">← Retour</button>
        <div>
          <h2 className="text-lg font-bold">{u.lastName} {u.firstName}</h2>
          <p className="text-xs text-muted-foreground">
            {data.student.matricule} · {data.student.mention?.name ?? "—"} · {data.student.promotion?.name ?? "—"} · {u.email}{u.phone ? ` · ${u.phone}` : ""}
          </p>
        </div>
        <button onClick={() => setView("fees")} className="ml-auto rounded-lg border px-3 py-1.5 text-xs hover:bg-muted">Autres frais et factures →</button>
      </div>
      <TuitionPanel data={data} />
    </div>
  );
}

function StudentAccountDetail({ studentId, onBack }: { studentId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useAccount(studentId);
  const { data: methods = [] } = usePayMethods();
  const [payItemId, setPayItemId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, method: "CASH", reference: "", notes: "" });

  const recordPayment = useMutation({
    mutationFn: (d: any) => api(fv2("/payments"), { method: "POST", body: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fin-account", studentId] }); qc.invalidateQueries({ queryKey: ["fin-dash"] }); setPayItemId(null); toast.success("Paiement enregistré"); },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  if (isLoading) return <Spinner />;
  if (!data) return <Empty label="Compte introuvable" />;

  const s = data.student;
  const fullName = s.user ? `${s.user.firstName} ${s.user.lastName}` : s.matricule;
  const items = data.items ?? [];
  const totalOwed = items.reduce((s, i) => i.status !== "NOT_APPLICABLE" ? s + i.amount : s, 0);
  const totalPaid = items.reduce((s, i) => s + i.amountPaid, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← Retour</button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-semibold">{fullName}</span>
        <span className="text-xs text-muted-foreground font-mono">({s.matricule})</span>
        {s.mention?.name && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{s.mention.name}</span>}
        {s.promotion?.name && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{s.promotion.name}</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Total dû" value={fmt(totalOwed)} icon={<DollarSign size={15} />} color="blue" />
        <Kpi label="Total payé" value={fmt(totalPaid)} icon={<CheckCircle2 size={15} />} color="green" />
        <Kpi label="Reste à payer" value={fmt(Math.max(0, totalOwed - totalPaid))} icon={<AlertCircle size={15} />} color={totalOwed > totalPaid ? "amber" : "green"} />
      </div>

      {/* Payment form */}
      {payItemId && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">Enregistrer un paiement</p>
          <p className="text-xs text-muted-foreground">Frais : {items.find(i => i.id === payItemId)?.label}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Montant (MGA)" type="number" value={String(payForm.amount)} onChange={v => setPayForm(p => ({ ...p, amount: Number(v) }))} />
            <div>
              <label className="label">Méthode de paiement</label>
              <select value={payForm.method} onChange={e => setPayForm(p => ({ ...p, method: e.target.value }))} className="sel">
                <option value="CASH">Espèces</option>
                {methods.filter(m => m.active).map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
              </select>
            </div>
            <F label="Référence externe" value={payForm.reference} onChange={v => setPayForm(p => ({ ...p, reference: v }))} placeholder="N° bordereau, reçu externe..." />
            <F label="Notes" value={payForm.notes} onChange={v => setPayForm(p => ({ ...p, notes: v }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setPayItemId(null)} className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted">Annuler</button>
            <Btn onClick={() => recordPayment.mutate({ accountItemId: payItemId, ...payForm })} loading={recordPayment.isPending}>
              <CreditCard size={12} /> Enregistrer
            </Btn>
          </div>
        </div>
      )}

      {/* Fee items checklist */}
      <Card title="Détail du compte" noPad>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 28rem)" }}>
          <table className="w-full text-sm">
            <THead cols={["", "Frais", "Montant", "Payé", "Statut", "N° Reçu", "Échéance", "Action"]} />
            <tbody>
              {items.length === 0 ? <EmptyRow cols={8} label="Aucun frais dans ce compte" /> :
                items.map(item => {
                  const meta = ITEM_STATUS[item.status] ?? ITEM_STATUS.UNPAID;
                  const canPay = item.status === "UNPAID" || item.status === "RECORDED";
                  return (
                    <tr key={item.id} className="border-b hover:bg-muted/20">
                      <td className="px-4 py-3 text-base">{meta.icon}</td>
                      <Td bold>{item.label}</Td>
                      <Td right>{fmt(item.amount)}</Td>
                      <Td right>{item.amountPaid > 0 ? <span className="text-emerald-600">{fmt(item.amountPaid)}</span> : <span className="text-muted-foreground">—</span>}</Td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${meta.cls}`}>{meta.label}</span>
                      </td>
                      <Td mono>{item.receiptNumber ?? "—"}</Td>
                      <Td muted>{item.dueDate ? format(new Date(item.dueDate), "dd/MM/yyyy") : "—"}</Td>
                      <td className="px-4 py-2">
                        {canPay && (
                          <button onClick={() => { setPayItemId(item.id); setPayForm({ amount: item.amount - item.amountPaid, method: "CASH", reference: "", notes: "" }); }}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 whitespace-nowrap">
                            <CreditCard size={11} /> Payer
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Payments list ────────────────────────────────────────────────────────────

function NewPaymentModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep]           = useState<"student" | "item" | "confirm">("student");
  const [studentQ, setStudentQ]   = useState("");
  const [studentQD, setStudentQD] = useState("");
  const [selStudent, setSelStudent] = useState<AccountSummary | null>(null);
  const [selItemId, setSelItemId] = useState<string | null>(null);
  const [amount, setAmount]       = useState(0);
  const [method, setMethod]       = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes]         = useState("");
  const timerRef = useState<ReturnType<typeof setTimeout> | null>(null);
  const { data: methods = [] } = usePayMethods();

  const qs = new URLSearchParams({ limit: "10", ...(studentQD ? { search: studentQD } : {}) }).toString();
  const { data: studentsRes, isLoading: loadingStudents } = useAccounts(qs);
  const students = studentsRes?.data ?? [];

  const { data: acctDetail, isLoading: loadingDetail } = useAccount(selStudent?.studentId ?? "");
  const items = acctDetail?.items ?? [];
  const canPayItems = items.filter((i: any) => i.status === "UNPAID" || i.status === "RECORDED");

  const record = useMutation({
    mutationFn: (d: any) => api(fv2("/payments"), { method: "POST", body: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-payments"] });
      qc.invalidateQueries({ queryKey: ["fin-dash"] });
      toast.success("Paiement enregistré — en attente de validation");
      onClose();
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  const handleStudentSearch = (v: string) => {
    setStudentQ(v);
    if (timerRef[0]) clearTimeout(timerRef[0]);
    (timerRef as any)[0] = setTimeout(() => setStudentQD(v), 350);
  };

  const selItem = items.find((i: any) => i.id === selItemId);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-lg space-y-4 p-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Nouveau paiement</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 text-xs">
          {(["Étudiant", "Frais", "Confirmer"] as const).map((label, i) => (
            <span key={i} className={`px-2 py-0.5 rounded-full ${i === (step === "student" ? 0 : step === "item" ? 1 : 2) ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}. {label}</span>
          ))}
        </div>

        {step === "student" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Recherchez l'étudiant par nom, prénom ou matricule</p>
            <input value={studentQ} onChange={e => handleStudentSearch(e.target.value)}
              placeholder="Rechercher..." autoFocus
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            <div className="border rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              {loadingStudents ? <p className="text-xs text-center py-4 text-muted-foreground">Chargement...</p> :
               students.length === 0 ? <p className="text-xs text-center py-4 text-muted-foreground">Aucun résultat</p> :
               students.map(s => (
                <button key={s.studentId} onClick={() => { setSelStudent(s); setStep("item"); }}
                  className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b last:border-0 flex justify-between items-center gap-2 text-sm">
                  <span><span className="font-medium">{s.firstName} {s.lastName}</span> <span className="text-xs text-muted-foreground font-mono">({s.matricule})</span></span>
                  <span className="text-xs text-muted-foreground shrink-0">{s.promotion?.name ?? ""}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "item" && selStudent && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button onClick={() => { setStep("student"); setSelStudent(null); setSelItemId(null); }} className="text-xs text-muted-foreground hover:text-foreground">← Retour</button>
              <span className="text-sm font-medium">{selStudent.firstName} {selStudent.lastName}</span>
            </div>
            {loadingDetail ? <p className="text-xs text-muted-foreground">Chargement des frais...</p> :
             canPayItems.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Aucun frais impayé pour cet étudiant</p> :
             <div className="border rounded-xl overflow-hidden">
               {canPayItems.map((item: any) => {
                 const remaining = item.amount - item.amountPaid;
                 return (
                   <button key={item.id} onClick={() => { setSelItemId(item.id); setAmount(remaining); setStep("confirm"); }}
                     className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b last:border-0 flex justify-between items-center text-sm">
                     <span className="font-medium">{item.label}</span>
                     <span className="text-red-600 text-xs font-semibold">{fmt(remaining)} restants</span>
                   </button>
                 );
               })}
             </div>
            }
          </div>
        )}

        {step === "confirm" && selStudent && selItem && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setStep("item")} className="text-xs text-muted-foreground hover:text-foreground">← Retour</button>
              <span className="text-xs text-muted-foreground">Frais sélectionné : <span className="font-medium text-foreground">{selItem.label}</span></span>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Étudiant</span><span className="font-medium">{selStudent.firstName} {selStudent.lastName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Frais</span><span>{selItem.label}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Montant dû</span><span>{fmt(selItem.amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Déjà payé</span><span className="text-emerald-600">{fmt(selItem.amountPaid ?? 0)}</span></div>
              <div className="flex justify-between font-semibold"><span>Reste à payer</span><span className="text-red-600">{fmt(selItem.amount - (selItem.amountPaid ?? 0))}</span></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="Montant encaissé (MGA)" type="number" value={String(amount)} onChange={v => setAmount(Number(v))} />
              <div>
                <label className="label">Méthode</label>
                <select value={method} onChange={e => setMethod(e.target.value)} className="sel">
                  <option value="CASH">Espèces</option>
                  {methods.filter((m: any) => m.active).map((m: any) => <option key={m.code} value={m.code}>{m.name}</option>)}
                </select>
              </div>
              <F label="Référence / N° bordereau" value={reference} onChange={setReference} placeholder="Optionnel" />
              <F label="Notes" value={notes} onChange={setNotes} placeholder="Optionnel" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted">Annuler</button>
              <Btn onClick={() => record.mutate({ accountItemId: selItemId, amount, method, reference: reference || null, notes: notes || null })} loading={record.isPending}>
                <CreditCard size={12} /> Enregistrer le paiement
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentsTab() {
  const [status, setStatus] = useState("");
  const [page, setPage]     = useState(1);
  const [showNew, setShowNew] = useState(false);
  const qs = new URLSearchParams({ page: String(page), limit: "30", ...(status ? { status } : {}) }).toString();
  const { data, isLoading } = useQuery<{ data: any[]; total: number; pages: number }>({
    queryKey: ["fin-payments", qs], queryFn: () => api(fv2(`/payments?${qs}`)), staleTime: 15 * 1000,
  });
  return (
    <div className="space-y-3">
      {showNew && <NewPaymentModal onClose={() => setShowNew(false)} />}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {[{ v: "", l: "Tous" }, { v: "RECORDED", l: "🟡 Enregistrés" }, { v: "VALIDATED", l: "🟢 Validés" }, { v: "RECEIPT_ISSUED", l: "🔵 Reçu édité" }, { v: "REFUSED", l: "🔴 Refusés" }, { v: "REFUNDED", l: "🟣 Remboursés" }].map(({ v, l }) => (
            <button key={v} onClick={() => { setStatus(v); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${status === v ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>{l}</button>
          ))}
        </div>
        <Btn onClick={() => setShowNew(true)}><Plus size={13} /> Nouveau paiement</Btn>
      </div>
      <Card noPad>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 22rem)" }}>
          <table className="w-full text-sm">
            <THead cols={["Date", "Étudiant", "Frais", "Méthode", "Référence", "Montant", "Statut"]} />
            <tbody>
              {isLoading ? <EmptyRow cols={7} loading /> :
              (data?.data ?? []).length === 0 ? <EmptyRow cols={7} label="Aucune transaction" /> :
              (data?.data ?? []).map((p: any) => {
                const itemStatus: ItemStatus = p.accountItem?.status ?? "UNPAID";
                const meta = ITEM_STATUS[itemStatus];
                return (
                  <tr key={p.id} className="border-b hover:bg-muted/20">
                    <Td muted>{p.paidAt ? format(new Date(p.paidAt), "dd/MM/yy HH:mm") : "—"}</Td>
                    <Td>{p.accountItem?.account?.student?.user ? `${p.accountItem.account.student.user.firstName} ${p.accountItem.account.student.user.lastName}` : "—"}</Td>
                    <Td>{p.accountItem?.label ?? "—"}</Td>
                    <Td>{p.method}</Td>
                    <Td mono>{p.reference ?? "—"}</Td>
                    <Td right><span className="font-semibold text-emerald-600">{fmt(p.amount)}</span></Td>
                    <td className="px-4 py-2"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${meta.cls}`}>{meta.icon} {meta.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Validation ───────────────────────────────────────────────────────────────

function ValidationTab() {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useValidationQueue();
  const [refuseId, setRefuseId] = useState<string | null>(null);
  const [refuseReason, setRefuseReason] = useState("");

  const validate = useMutation({
    mutationFn: (txId: string) => api(fv2(`/payments/${txId}/validate`), { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fin-validation"] }); qc.invalidateQueries({ queryKey: ["fin-dash"] }); toast.success("✅ Paiement validé"); },
    onError: () => toast.error("Erreur"),
  });
  const refuse = useMutation({
    mutationFn: ({ txId, reason }: { txId: string; reason: string }) => api(fv2(`/payments/${txId}/refuse`), { method: "PATCH", body: { reason } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fin-validation"] }); setRefuseId(null); setRefuseReason(""); toast.success("Paiement refusé"); },
    onError: () => toast.error("Erreur"),
  });
  const issueReceipt = useMutation({
    mutationFn: (txId: string) => api(fv2(`/payments/${txId}/receipt`), { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fin-validation"] }); toast.success("🔵 Reçu édité"); },
    onError: () => toast.error("Erreur"),
  });

  const items: any[] = data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Paiements en attente de validation trésorier</p>
          <p className="text-xs text-muted-foreground">{items.length} élément(s) — 🟡 enregistré → 🟢 validé → 🔵 reçu édité</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted">
          <RefreshCw size={12} /> Actualiser
        </button>
      </div>

      {refuseId && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold text-red-600">Motif de refus</p>
          <F label="Motif" value={refuseReason} onChange={setRefuseReason} placeholder="Expliquez le motif de refus..." />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setRefuseId(null)} className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted">Annuler</button>
            <Btn variant="red" onClick={() => refuse.mutate({ txId: refuseId, reason: refuseReason })} loading={refuse.isPending}>Confirmer le refus</Btn>
          </div>
        </div>
      )}

      {isLoading ? <Spinner /> : items.length === 0 ? (
        <Empty label="Aucun paiement en attente de validation" Icon={CheckCircle2} />
      ) : (
        <Card noPad>
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 22rem)" }}>
            <table className="w-full text-sm">
              <THead cols={["Étudiant", "Frais", "Montant payé", "Méthode", "Référence", "Date", "Statut", "Actions"]} />
              <tbody>
                {items.map((item: any) => {
                  const tx = item.transactions?.[0];
                  const meta = ITEM_STATUS[item.status as ItemStatus] ?? ITEM_STATUS.RECORDED;
                  return (
                    <tr key={item.id} className="border-b hover:bg-muted/20">
                      <Td bold>{item.account?.student?.user ? `${item.account.student.user.firstName} ${item.account.student.user.lastName}` : "—"}</Td>
                      <Td>{item.label}</Td>
                      <Td right><span className="font-semibold">{fmt(item.amountPaid)}</span></Td>
                      <Td>{tx?.method ?? "—"}</Td>
                      <Td mono>{tx?.reference ?? "—"}</Td>
                      <Td muted>{tx?.paidAt ? format(new Date(tx.paidAt), "dd/MM HH:mm") : "—"}</Td>
                      <td className="px-4 py-2"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${meta.cls}`}>{meta.icon} {meta.label}</span></td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          {item.status === "RECORDED" && (
                            <>
                              <button onClick={() => validate.mutate(tx?.id ?? item.id)} disabled={validate.isPending}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 disabled:opacity-50">
                                <BadgeCheck size={11} /> Valider
                              </button>
                              <button onClick={() => setRefuseId(tx?.id ?? item.id)}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300">
                                <Ban size={11} /> Refuser
                              </button>
                            </>
                          )}
                          {item.status === "VALIDATED" && (
                            <button onClick={() => issueReceipt.mutate(tx?.id ?? item.id)} disabled={issueReceipt.isPending}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 disabled:opacity-50">
                              <Receipt size={11} /> Émettre reçu
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Refunds ──────────────────────────────────────────────────────────────────

function RefundsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ data: any[]; total: number }>({
    queryKey: ["fin-refunds"], queryFn: () => api(fv2("/payments?status=VALIDATED&limit=100")), staleTime: 30 * 1000,
  });
  const refund = useMutation({
    mutationFn: (txId: string) => api(fv2(`/payments/${txId}/refund`), { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fin-refunds"] }); toast.success("🟣 Remboursement enregistré"); },
    onError: () => toast.error("Erreur"),
  });

  const items: any[] = data?.data ?? [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Sélectionnez un paiement validé pour initier un remboursement.</p>
      {isLoading ? <Spinner /> : items.length === 0 ? <Empty label="Aucun paiement validé éligible au remboursement" Icon={RotateCcw} /> : (
        <Card noPad>
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 20rem)" }}>
            <table className="w-full text-sm">
              <THead cols={["Étudiant", "Frais", "Montant", "Date validation", "N° Reçu", "Action"]} />
              <tbody>
                {items.map((item: any) => (
                  <tr key={item.id} className="border-b hover:bg-muted/20">
                    <Td bold>{item.account?.student?.user ? `${item.account.student.user.firstName} ${item.account.student.user.lastName}` : "—"}</Td>
                    <Td>{item.label}</Td>
                    <Td right><span className="font-semibold text-emerald-600">{fmt(item.amountPaid)}</span></Td>
                    <Td muted>{item.validatedAt ? format(new Date(item.validatedAt), "dd/MM/yyyy") : "—"}</Td>
                    <Td mono>{item.receiptNumber ?? "—"}</Td>
                    <td className="px-4 py-2">
                      <button onClick={() => refund.mutate(item.transactions?.[0]?.id ?? item.id)} disabled={refund.isPending}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/30 dark:text-purple-300 disabled:opacity-50">
                        <RotateCcw size={11} /> Rembourser
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Treasury ─────────────────────────────────────────────────────────────────

function TreasuryTab() {
  const { data } = useDashboard();
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Encaissements du jour" value={fmt(data?.paymentsToday ?? 0)} icon={<Coins size={15} />} color="green" />
        <Kpi label="Encaissements semaine" value={fmt(data?.paymentsWeek ?? 0)} icon={<TrendingUp size={15} />} color="blue" />
        <Kpi label="Encaissements mois" value={fmt(data?.paymentsMonth ?? 0)} icon={<BarChart2 size={15} />} color="purple" />
      </div>
      <Card title="Répartition par méthode de paiement" noPad>
        <table className="w-full text-sm">
          <THead cols={["Méthode", "Nombre d'opérations", "Total encaissé"]} />
          <tbody>
            {(data?.byMethod ?? []).length === 0 ? <EmptyRow cols={3} label="Aucune donnée" /> :
              (data?.byMethod ?? []).map(m => (
                <tr key={m.method} className="border-b hover:bg-muted/20">
                  <Td bold>{m.method}</Td>
                  <Td>{m.count} opération(s)</Td>
                  <Td right><span className="font-semibold text-emerald-600">{fmt(m.total)}</span></Td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────────

function ReportsTab() {
  const [type, setType] = useState<"by-student" | "by-fee-type" | "collection-rate">("by-student");
  const [yearId, setYearId] = useState("");
  const [mentionId, setMentionId] = useState("");
  const [promoId, setPromoId] = useState("");

  const { data: years = [] } = useAcademicYears();
  const { data: mentions = [] } = useAllMentions();
  const { data: promotions = [] } = usePromotionsByMention(mentionId);

  const qs = new URLSearchParams({
    ...(yearId ? { academicYearId: yearId } : {}),
    ...(promoId ? { promotionId: promoId } : {}),
  }).toString();
  const { data, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["fin-report", type, qs], queryFn: () => api(fv2(`/reports/${type}?${qs}`)), enabled: false, staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {[{ id: "by-student" as const, l: "Par étudiant" }, { id: "by-fee-type" as const, l: "Par type de frais" }, { id: "collection-rate" as const, l: "Taux de recouvrement" }].map(({ id, l }) => (
          <button key={id} onClick={() => setType(id)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${type === id ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>{l}</button>
        ))}
      </div>
      <div className="flex gap-3 flex-wrap items-end">
        <div className="min-w-[180px]">
          <label className="label">Année universitaire</label>
          <select value={yearId} onChange={e => setYearId(e.target.value)} className="sel">
            <option value="">— Toutes les années —</option>
            {years.map(y => <option key={y.id} value={y.id}>{y.label}{y.isCurrent ? " ★" : ""}</option>)}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="label">Mention</label>
          <select value={mentionId} onChange={e => { setMentionId(e.target.value); setPromoId(""); }} className="sel">
            <option value="">— Toutes —</option>
            {mentions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        {type === "collection-rate" && (
          <div className="min-w-[160px]">
            <label className="label">Promotion</label>
            <select value={promoId} onChange={e => setPromoId(e.target.value)} className="sel" disabled={!mentionId}>
              <option value="">— Toutes —</option>
              {promotions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <Btn onClick={() => refetch()} loading={isLoading}><BarChart2 size={12} /> Générer</Btn>
      </div>
      {data && (
        <Card noPad>
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 30rem)" }}>
            {type === "by-student" && (
              <table className="w-full text-sm">
                <THead cols={["Étudiant", "Matricule", "Total dû", "Payé", "Reste", "Taux"]} />
                <tbody>
                  {data.map((r: any) => {
                    const rate = r.totalOwed > 0 ? Math.round((r.totalPaid / r.totalOwed) * 100) : 100;
                    return (
                      <tr key={r.studentId} className="border-b hover:bg-muted/20">
                        <Td bold>{r.fullName}</Td>
                        <Td mono>{r.matricule}</Td>
                        <Td right>{fmt(r.totalOwed)}</Td>
                        <Td right><span className="text-emerald-600">{fmt(r.totalPaid)}</span></Td>
                        <Td right><span className={r.balance > 0 ? "text-red-600 font-semibold" : "text-emerald-600"}>{fmt(r.balance)}</span></Td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-14 bg-muted rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${rate}%` }} /></div>
                            <span className="text-xs font-semibold">{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {type === "by-fee-type" && (
              <table className="w-full text-sm">
                <THead cols={["Type de frais", "Attendu", "Encaissé", "Taux"]} />
                <tbody>
                  {data.map((r: any) => {
                    const rate = r.expected > 0 ? Math.round((r.paid / r.expected) * 100) : 0;
                    return (
                      <tr key={r.feeTypeId} className="border-b hover:bg-muted/20">
                        <Td bold>{r.feeTypeName}</Td>
                        <Td right>{fmt(r.expected)}</Td>
                        <Td right><span className="text-emerald-600">{fmt(r.paid)}</span></Td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-14 bg-muted rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${rate}%` }} /></div>
                            <span className="text-xs font-semibold">{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {type === "collection-rate" && (
              <table className="w-full text-sm">
                <THead cols={["Promotion", "Attendu", "Collecté", "Non collecté", "Taux"]} />
                <tbody>
                  {data.map((r: any) => (
                    <tr key={r.promotionId ?? "all"} className="border-b hover:bg-muted/20">
                      <Td bold>{r.promotionName ?? "Toutes promotions"}</Td>
                      <Td right>{fmt(r.expected ?? r.totalExpected)}</Td>
                      <Td right><span className="text-emerald-600">{fmt(r.collected ?? r.totalPaid)}</span></Td>
                      <Td right><span className="text-red-600">{fmt(r.totalUnpaid ?? 0)}</span></Td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-14 bg-muted rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${r.collectionRate ?? r.rate ?? 0}%` }} /></div>
                          <span className="text-xs font-semibold">{r.collectionRate ?? r.rate ?? 0}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ["fin-history"], queryFn: () => api(fv2("/payments?limit=100&page=1")), staleTime: 30 * 1000,
  });
  return (
    <Card title="Historique des transactions" noPad>
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 18rem)" }}>
        <table className="w-full text-sm">
          <THead cols={["Date", "Étudiant", "Frais", "Montant", "Méthode", "Référence", "Opérateur"]} />
          <tbody>
            {isLoading ? <EmptyRow cols={7} loading /> :
            (data as any[]).length === 0 ? <EmptyRow cols={7} label="Aucun historique" /> :
            (data as any[]).map((p: any) => (
              <tr key={p.id} className="border-b hover:bg-muted/20">
                <Td muted>{p.paidAt ? format(new Date(p.paidAt), "dd/MM/yyyy HH:mm") : "—"}</Td>
                <Td>{p.accountItem?.account?.student?.user ? `${p.accountItem.account.student.user.firstName} ${p.accountItem.account.student.user.lastName}` : "—"}</Td>
                <Td>{p.accountItem?.label ?? "—"}</Td>
                <Td right><span className="font-semibold text-emerald-600">{fmt(p.amount)}</span></Td>
                <Td>{p.method}</Td>
                <Td mono>{p.reference ?? "—"}</Td>
                <Td muted>{p.recordedById ? "Opérateur" : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Audit ────────────────────────────────────────────────────────────────────

function AuditTab() {
  const { data = [], isLoading } = useAuditLog();
  return (
    <Card title="Journal d'audit" subtitle="Toutes les actions financières enregistrées" noPad>
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 18rem)" }}>
        <table className="w-full text-sm">
          <THead cols={["Date", "Action", "Entité", "Description", "Utilisateur"]} />
          <tbody>
            {isLoading ? <EmptyRow cols={5} loading /> :
            (data as any[]).length === 0 ? <EmptyRow cols={5} label="Aucun événement d'audit" /> :
            (data as any[]).map((e: any) => (
              <tr key={e.id} className="border-b hover:bg-muted/20">
                <Td muted>{e.createdAt ? format(new Date(e.createdAt), "dd/MM/yyyy HH:mm") : "—"}</Td>
                <td className="px-4 py-2"><Code>{e.action}</Code></td>
                <Td muted>{e.entityType}</Td>
                <Td>{e.description ?? "—"}</Td>
                <Td muted>{e.userId ?? "Système"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Shared UI Primitives ─────────────────────────────────────────────────────

function Kpi({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const cls: Record<string, string> = {
    blue:   "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    green:  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
    amber:  "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400",
  };
  return (
    <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${cls[color]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="text-base font-bold truncate">{value}</div>
      </div>
    </div>
  );
}

function Card({ title, subtitle, noPad, children }: { title?: string; subtitle?: string; noPad?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {title && (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-3">
          <p className="text-sm font-semibold">{title}</p>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      )}
      {noPad ? children : <div className="p-4">{children}</div>}
    </div>
  );
}

function THead({ cols }: { cols: string[] }) {
  return (
    <thead className="sticky top-0 z-10">
      <tr className="border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide backdrop-blur-sm">
        {cols.map(c => <th key={c} className="px-4 py-2 text-left whitespace-nowrap">{c}</th>)}
      </tr>
    </thead>
  );
}

function Td({ children, right, bold, muted, mono }: { children?: React.ReactNode; right?: boolean; bold?: boolean; muted?: boolean; mono?: boolean }) {
  return (
    <td className={`px-4 py-2 ${right ? "text-right" : ""} ${bold ? "font-medium" : ""} ${muted ? "text-muted-foreground" : ""} ${mono ? "font-mono text-xs" : ""}`}>
      {children}
    </td>
  );
}

function EmptyRow({ cols, label, loading }: { cols: number; label?: string; loading?: boolean }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center py-8 text-muted-foreground">
        {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : label}
      </td>
    </tr>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{children}</code>;
}

function ActiveBadge({ v, label }: { v: boolean; label?: string }) {
  return v
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">{label ?? "Actif"}</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Inactif</span>;
}

function Spinner() {
  return <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-muted-foreground" /></div>;
}

function Empty({ label, sub, Icon }: { label: string; sub?: string; Icon?: any }) {
  return (
    <div className="text-center py-14 text-muted-foreground">
      {Icon && <Icon size={40} className="mx-auto mb-3 opacity-20" />}
      <p className="text-sm font-medium">{label}</p>
      {sub && <p className="text-xs mt-1">{sub}</p>}
    </div>
  );
}

function F({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded" />
      {label}
    </label>
  );
}

function Btn({ onClick, children, loading, variant = "primary", size = "md", disabled }: { onClick?: () => void; children?: React.ReactNode; loading?: boolean; variant?: "primary" | "green" | "red"; size?: "sm" | "md"; disabled?: boolean }) {
  const cls = {
    primary: "grad-classroom text-white",
    green:   "bg-emerald-600 hover:bg-emerald-700 text-white",
    red:     "bg-red-600 hover:bg-red-700 text-white",
  };
  return (
    <button onClick={onClick} disabled={loading || disabled}
      className={`flex items-center gap-1.5 rounded-lg ${cls[variant]} font-semibold disabled:opacity-50 ${size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-1.5 text-xs"}`}>
      {loading && <Loader2 size={12} className="animate-spin" />}
      {children}
    </button>
  );
}

function FormActions({ onCancel, onSave, loading }: { onCancel: () => void; onSave: () => void; loading: boolean }) {
  return (
    <div className="flex gap-2 justify-end pt-1">
      <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted">Annuler</button>
      <Btn onClick={onSave} loading={loading}>Enregistrer</Btn>
    </div>
  );
}

type ColDef<T> = { key: string; label: string; render?: (r: T) => React.ReactNode };

function CrudTable<T extends { id: string }>({ data, isLoading, cols, onEdit, onDelete }: {
  data: T[]; isLoading: boolean; cols: ColDef<T>[]; onEdit: (r: T) => void; onDelete: (r: T) => void;
}) {
  return (
    <Card noPad>
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 34rem)" }}>
        <table className="w-full text-sm">
          <THead cols={[...cols.map(c => c.label), "Actions"]} />
          <tbody>
            {isLoading ? <EmptyRow cols={cols.length + 1} loading /> :
            data.length === 0 ? <EmptyRow cols={cols.length + 1} label="Aucune donnée" /> :
            data.map(row => (
              <tr key={row.id} className="border-b hover:bg-muted/20">
                {cols.map(c => (
                  <td key={c.key} className="px-4 py-2">{c.render ? c.render(row) : String((row as any)[c.key] ?? "—")}</td>
                ))}
                <td className="px-4 py-2">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => onEdit(row)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil size={13} /></button>
                    <button onClick={() => onDelete(row)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 dark:hover:bg-red-950/20"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
