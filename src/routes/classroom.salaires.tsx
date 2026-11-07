import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  BarChart2, Users, FileText, Grid3X3, Calculator, BadgeCheck,
  DollarSign, TrendingUp, History, Loader2, Plus, AlertCircle,
  CheckCircle2, Clock, Building2, Settings,
} from "lucide-react";
import { isMentionResponsible, useRequireClassroom } from "@/components/classroom/shared";
import { format } from "date-fns";

export const Route = createFileRoute("/classroom/salaires")({ component: Salaires });

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "employees" | "contracts" | "salary-grids" | "payroll" | "payslips" | "history" | "reports" | "settings";

interface HrHourlyRateSettings { rateCM: number; rateTD: number; rateTP: number; rateHS: number; }
interface HrEmployee { id: string; employeeNumber: string; firstName: string; lastName: string; email?: string; positionId?: string; departmentId?: string; contractType: string; baseSalary?: number; currency: string; active: boolean; position?: { title: string; code?: string; payCalcMode?: string }; department?: { name: string }; }
interface HrContract { id: string; employeeId: string; type: string; startDate: string; endDate?: string; baseSalary: number; currency: string; notes?: string; }
interface HrSalaryGrid { id: string; positionId: string; currency: string; position?: { title: string; code?: string }; components: HrSalaryComponent[]; }
interface HrSalaryComponent { id?: string; gridId?: string; type: "GAIN" | "DEDUCTION"; label: string; code: string; amount: number; isPercent: boolean; order: number; active: boolean; }
interface HrPayrollPeriod { id: string; month: number; year: number; status: string; _count?: { payslips: number }; }
interface HrPayslip { id: string; employeeId: string; periodId: string; baseSalary: number; grossSalary: number; deductions: number; netSalary: number; status: string; items: any[]; employee?: { firstName: string; lastName: string; employeeNumber: string }; period?: { month: number; year: number }; }
interface SalaryDashboard { totalEmployees: number; activeEmployees: number; payrollMass: number; currentPeriodStatus?: string; byDepartment: { name: string; count: number }[]; byContractType: { type: string; count: number }[]; pendingLeaves: number; }

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTRACT_LABELS: Record<string, string> = { CDI: "CDI", CDD: "CDD", VACATAIRE: "Vacataire", CONSULTANT: "Consultant", STAGE: "Stage", AUTRE: "Autre" };
const PAYROLL_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT:      { label: "En préparation", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  CALCULATED: { label: "Calculé",        cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  VALIDATED:  { label: "Validé",         cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  PAID:       { label: "Payé",           cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  CANCELLED:  { label: "Annulé",         cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};
const SLIP_STATUS: Record<string, { label: string; icon: string; cls: string }> = {
  DRAFT:      { label: "Non calculé", icon: "⬜", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800" },
  CALCULATED: { label: "Calculé",     icon: "🟡", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30" },
  VALIDATED:  { label: "Validé",      icon: "🟢", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30" },
  PAID:       { label: "Payé",        icon: "💰", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30" },
  CANCELLED:  { label: "Suspendu",    icon: "❌", cls: "bg-red-100 text-red-700 dark:bg-red-900/30" },
};
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const hr  = (path: string) => `/hr${path}`;
const fmt = (n: number) => n.toLocaleString("fr-FR") + " MGA";

// ─── Main Component ───────────────────────────────────────────────────────────

function Salaires() {
  const { user, roles } = useRequireClassroom();
  const sysRole  = user?.systemRole ?? "";
  const roleName = roles?.[0]?.roleName ?? "";

  const isAdmin       = sysRole === "SUPER_ADMIN";
  // Salaires gérés par l'administrateur et la comptabilité (plus par le secrétariat)
  const isAdminRole   = roleName.includes("Administration") || roleName.includes("Comptabilité") || roleName.includes("Trésorier") || roleName.includes("Finance");
  const isChefMention = isMentionResponsible(roleName);
  const isRespPeda    = roleName.includes("Responsable Pédagogique");
  const isFinance     = roleName.includes("Comptabilité") || roleName.includes("Trésorier") || roleName.includes("Finance");

  // Super Admin & Administration: all tabs
  // Chef de Mention: dashboard + employees + payslips (read — own mention)
  // Responsable Pédagogique: dashboard + salary-grids (read) + reports
  // Finance: dashboard + reports (read only)
  type TabRole = "all" | "manage" | "admin-only";
  const allTabs: { id: Tab; label: string; Icon: any; role: TabRole }[] = [
    { id: "dashboard",    label: "Tableau de bord",    Icon: BarChart2,   role: "all"        },
    { id: "employees",    label: "Employés",            Icon: Users,       role: "manage"     },
    { id: "contracts",    label: "Contrats",            Icon: FileText,    role: "manage"     },
    { id: "salary-grids", label: "Grilles salariales",  Icon: Grid3X3,    role: "manage"     },
    { id: "payroll",      label: "Calcul mensuel",      Icon: Calculator,  role: "manage"     },
    { id: "payslips",     label: "Bulletins",           Icon: FileText,    role: "manage"     },
    { id: "history",      label: "Historique",          Icon: History,     role: "manage"     },
    { id: "reports",      label: "Rapports",            Icon: TrendingUp,  role: "all"        },
    { id: "settings",     label: "Paramètres",          Icon: Settings,    role: "admin-only" },
  ];

  const tabs = allTabs.filter(t => {
    if (isAdmin) return true;
    if (isAdminRole) return t.role !== "admin-only";
    if (isChefMention) return t.id === "dashboard" || t.id === "employees" || t.id === "payslips";
    if (isRespPeda)    return t.id === "dashboard" || t.id === "salary-grids" || t.id === "reports";
    if (isFinance)     return t.id === "dashboard" || t.id === "reports";
    return t.role === "all";
  });

  const canEdit = isAdmin || isAdminRole;
  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? "dashboard");

  return (
    <div className="flex flex-col h-full">
      <div className="pb-3">
        <h1 className="text-xl font-bold">Gestion des Salaires</h1>
        <p className="text-xs text-muted-foreground">Rémunération, contrats et bulletins de paie du personnel</p>
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
        {tab === "dashboard"    && <SalDashboard />}
        {tab === "employees"    && <SalEmployees readOnly={!canEdit} />}
        {tab === "contracts"    && <SalContracts readOnly={!canEdit} />}
        {tab === "salary-grids" && <SalSalaryGrids readOnly={!canEdit} />}
        {tab === "payroll"      && <SalPayroll />}
        {tab === "payslips"     && <SalPayslips />}
        {tab === "history"      && <SalHistory />}
        {tab === "reports"      && <SalReports />}
        {tab === "settings"     && <SalSettings />}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function SalDashboard() {
  const { data, isLoading } = useQuery<SalaryDashboard>({
    queryKey: ["sal-dash"], queryFn: () => api(hr("/dashboard")), staleTime: 30 * 1000,
  });
  const { data: periods = [] } = useQuery<HrPayrollPeriod[]>({
    queryKey: ["hr-periods"], queryFn: () => api(hr("/payroll/periods")), staleTime: 30 * 1000,
  });
  const latest = periods[0];
  const latestMeta = latest ? PAYROLL_STATUS[latest.status] ?? PAYROLL_STATUS.DRAFT : null;

  if (isLoading) return <Spinner />;
  if (!data) return <Empty label="Données indisponibles" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Employés actifs"       value={String(data.activeEmployees)} icon={<Users size={15} />}       color="blue" />
        <Kpi label="Masse salariale"       value={fmt(data.payrollMass)}        icon={<DollarSign size={15} />}  color="green" />
        <Kpi label="Congés en attente"     value={String(data.pendingLeaves)}   icon={<Clock size={15} />}       color="amber" />
        <Kpi label="Total collaborateurs"  value={String(data.totalEmployees)}  icon={<Building2 size={15} />}  color="purple" />
      </div>

      {latest && (
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Période en cours — {MONTHS[latest.month - 1]} {latest.year}</p>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${latestMeta?.cls}`}>{latestMeta?.label}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Bulletins</p>
              <p className="text-lg font-bold">{latest._count?.payslips ?? 0}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Mois</p>
              <p className="text-lg font-bold">{MONTHS[latest.month - 1].slice(0, 3)}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Année</p>
              <p className="text-lg font-bold">{latest.year}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Par département" noPad>
          <table className="w-full text-sm">
            <THead cols={["Département", "Employés"]} />
            <tbody>
              {data.byDepartment.length === 0 ? <EmptyRow cols={2} label="Aucune donnée" /> :
                data.byDepartment.map(d => (
                  <tr key={d.name} className="border-b hover:bg-muted/20">
                    <Td bold>{d.name}</Td>
                    <Td right><span className="font-semibold">{d.count}</span></Td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
        <Card title="Par type de contrat" noPad>
          <table className="w-full text-sm">
            <THead cols={["Contrat", "Employés"]} />
            <tbody>
              {data.byContractType.length === 0 ? <EmptyRow cols={2} label="Aucune donnée" /> :
                data.byContractType.map(c => (
                  <tr key={c.type} className="border-b hover:bg-muted/20">
                    <Td>{CONTRACT_LABELS[c.type] ?? c.type}</Td>
                    <Td right><span className="font-semibold">{c.count}</span></Td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

// ─── Employees (read-only salary view) ───────────────────────────────────────

function SalEmployees({ readOnly }: { readOnly: boolean }) {
  const { data, isLoading } = useQuery<{ data: HrEmployee[]; total: number }>({
    queryKey: ["sal-employees"], queryFn: () => api(hr("/employees?limit=200")), staleTime: 60 * 1000,
  });
  const employees = data?.data ?? [];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {readOnly ? "Consultation uniquement — modification via le module Personnel." : "Liste des employés actifs avec leur rémunération de base."}
      </p>
      <Card noPad>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 22rem)" }}>
          <table className="w-full text-sm">
            <THead cols={["N°", "Nom", "Poste", "Mode de calcul", "Contrat", "Rémunération", "Statut"]} />
            <tbody>
              {isLoading ? <EmptyRow cols={7} loading /> :
              employees.length === 0 ? <EmptyRow cols={7} label="Aucun employé" /> :
              employees.map(emp => {
                const mode = emp.position?.payCalcMode ?? "FIXED";
                return (
                <tr key={emp.id} className="border-b hover:bg-muted/20">
                  <Td mono>{emp.employeeNumber}</Td>
                  <Td bold>{emp.firstName} {emp.lastName}</Td>
                  <Td muted>{emp.position?.title ?? "—"}</Td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${mode === "HOURLY" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}>
                      {mode === "HOURLY" ? "⏱ Par heures" : "💼 Fixe"}
                    </span>
                  </td>
                  <td className="px-4 py-2"><span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{CONTRACT_LABELS[emp.contractType] ?? emp.contractType}</span></td>
                  <Td right>{mode === "HOURLY" ? <span className="text-xs text-blue-600">Calculé / heure</span> : emp.baseSalary ? fmt(emp.baseSalary) : "—"}</Td>
                  <td className="px-4 py-2"><ActiveBadge v={emp.active} /></td>
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

// ─── Contracts ────────────────────────────────────────────────────────────────

function SalContracts({ readOnly }: { readOnly: boolean }) {
  const { data, isLoading } = useQuery<{ data: HrEmployee[] }>({
    queryKey: ["sal-employees"], queryFn: () => api(hr("/employees?limit=200")), staleTime: 60 * 1000,
  });
  const employees = data?.data ?? [];
  const [employeeId, setEmployeeId] = useState("");
  const { data: contracts = [], isLoading: cLoading } = useQuery<HrContract[]>({
    queryKey: ["sal-contracts", employeeId], queryFn: () => api(hr(`/employees/${employeeId}/contracts`)), enabled: !!employeeId,
  });
  const emp = employees.find(e => e.id === employeeId);

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Employé</label>
        <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="sel max-w-sm">
          <option value="">— Choisir un employé —</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeNumber})</option>)}
        </select>
      </div>
      {emp && (
        <div className="rounded-xl border bg-muted/30 p-3 flex gap-4 text-sm">
          <span className="text-muted-foreground">Poste :</span>
          <span className="font-medium">{emp.position?.title ?? "—"}</span>
          <span className="text-muted-foreground ml-4">Département :</span>
          <span className="font-medium">{emp.department?.name ?? "—"}</span>
          <span className="text-muted-foreground ml-4">Salaire actuel :</span>
          <span className="font-bold text-primary">{emp.baseSalary ? fmt(emp.baseSalary) : "—"}</span>
        </div>
      )}
      {employeeId && (
        <Card noPad>
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 28rem)" }}>
            <table className="w-full text-sm">
              <THead cols={["Type", "Début", "Fin", "Salaire de base", "Notes"]} />
              <tbody>
                {cLoading ? <EmptyRow cols={5} loading /> :
                contracts.length === 0 ? <EmptyRow cols={5} label="Aucun contrat" /> :
                contracts.map(c => (
                  <tr key={c.id} className="border-b hover:bg-muted/20">
                    <td className="px-4 py-2"><span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{CONTRACT_LABELS[c.type] ?? c.type}</span></td>
                    <Td muted>{format(new Date(c.startDate), "dd/MM/yyyy")}</Td>
                    <Td muted>{c.endDate ? format(new Date(c.endDate), "dd/MM/yyyy") : <span className="text-emerald-600 font-medium">En cours</span>}</Td>
                    <Td right><span className="font-semibold">{fmt(c.baseSalary)}</span></Td>
                    <Td muted>{c.notes ?? "—"}</Td>
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

// ─── Salary Grids (read or edit) ─────────────────────────────────────────────

function SalSalaryGrids({ readOnly }: { readOnly: boolean }) {
  const qc = useQueryClient();
  const { data: grids = [], isLoading } = useQuery<HrSalaryGrid[]>({
    queryKey: ["hr-grids"], queryFn: () => api(hr("/salary-grids")), staleTime: 5 * 60 * 1000,
  });
  const { data: posRes } = useQuery<any[]>({
    queryKey: ["hr-positions"], queryFn: () => api(hr("/positions")), staleTime: 5 * 60 * 1000,
  });
  const positions = posRes ?? [];
  const [selected, setSelected] = useState<HrSalaryGrid | null>(null);
  const [components, setComponents] = useState<Partial<HrSalaryComponent>[]>([]);

  const save = useMutation({
    mutationFn: ({ positionId, data }: { positionId: string; data: any }) =>
      api(hr(`/salary-grids/${positionId}`), { method: "PUT", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-grids"] }); setSelected(null); toast.success("Grille enregistrée"); },
    onError: () => toast.error("Erreur"),
  });

  if (selected && !readOnly) {
    const gains     = components.filter(c => c.type === "GAIN");
    const deductions = components.filter(c => c.type === "DEDUCTION");
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground">← Retour</button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-semibold">{selected.position?.title}</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setComponents(p => [...p, { type: "GAIN",      label: "", code: "", amount: 0, isPercent: false, order: p.length, active: true }])}
              className="flex items-center gap-1 text-xs text-emerald-600 hover:underline"><Plus size={12} /> Gain</button>
            <button onClick={() => setComponents(p => [...p, { type: "DEDUCTION", label: "", code: "", amount: 0, isPercent: false, order: p.length, active: true }])}
              className="flex items-center gap-1 text-xs text-red-600 hover:underline"><Plus size={12} /> Retenue</button>
            <Btn onClick={() => save.mutate({ positionId: selected.positionId, data: { currency: selected.currency, components } })} loading={save.isPending}>
              Enregistrer
            </Btn>
          </div>
        </div>
        <div className="space-y-2">
          {components.map((comp, i) => (
            <div key={i} className={`grid gap-2 grid-cols-2 sm:grid-cols-5 items-end border rounded-xl p-3 ${comp.type === "GAIN" ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/30" : "border-red-200 bg-red-50/30 dark:border-red-900/30"}`}>
              <F label="Libellé"  value={comp.label ?? ""} onChange={v => setComponents(p => p.map((x, j) => j === i ? { ...x, label: v } : x))} />
              <F label="Code"     value={comp.code ?? ""}  onChange={v => setComponents(p => p.map((x, j) => j === i ? { ...x, code: v } : x))} />
              <F label={comp.isPercent ? "%" : "Montant MGA"} type="number" value={String(comp.amount ?? 0)} onChange={v => setComponents(p => p.map((x, j) => j === i ? { ...x, amount: Number(v) } : x))} />
              <Check label="En %" checked={comp.isPercent ?? false} onChange={v => setComponents(p => p.map((x, j) => j === i ? { ...x, isPercent: v } : x))} />
              <button onClick={() => setComponents(p => p.filter((_, j) => j !== i))} className="p-1.5 text-red-500 hover:text-red-700 text-sm">✕</button>
            </div>
          ))}
          {components.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucune composante — ajoutez des gains et des retenues</p>}
        </div>
        {components.length > 0 && (
          <div className="rounded-xl border bg-muted/30 p-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Récapitulatif</p>
            {gains.map((c, i) => <div key={i} className="flex justify-between text-sm text-emerald-700"><span>+ {c.label || "Gain"}</span><span>{c.isPercent ? `${c.amount}% du salaire de base` : fmt(c.amount ?? 0)}</span></div>)}
            {deductions.map((c, i) => <div key={i} className="flex justify-between text-sm text-red-600"><span>− {c.label || "Retenue"}</span><span>{c.isPercent ? `${c.amount}%` : fmt(c.amount ?? 0)}</span></div>)}
          </div>
        )}
      </div>
    );
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-3">
      {readOnly && <p className="text-xs text-muted-foreground">Consultation uniquement.</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {positions.map((pos: any) => {
          const grid = grids.find(g => g.positionId === pos.id);
          const mode = pos.payCalcMode ?? "FIXED";
          return (
            <div key={pos.id} className="rounded-2xl border bg-card p-4 space-y-3 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm">{pos.title}</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${mode === "HOURLY" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30" : "bg-muted text-muted-foreground"}`}>
                  {mode === "HOURLY" ? "⏱ Heures" : "💼 Fixe"}
                </span>
              </div>
              {!readOnly && (
                <div className="flex gap-1.5">
                  <button
                    onClick={async () => {
                      await api(hr(`/positions/${pos.id}`), { method: "PUT", body: { ...pos, payCalcMode: "FIXED" } });
                      qc.invalidateQueries({ queryKey: ["hr-positions"] });
                      toast.success("Mode fixe activé");
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${mode === "FIXED" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
                    💼 Salaire fixe
                  </button>
                  <button
                    onClick={async () => {
                      await api(hr(`/positions/${pos.id}`), { method: "PUT", body: { ...pos, payCalcMode: "HOURLY" } });
                      qc.invalidateQueries({ queryKey: ["hr-positions"] });
                      toast.success("Mode horaire activé");
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${mode === "HOURLY" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30" : "border-border hover:bg-muted"}`}>
                    ⏱ Par heures
                  </button>
                </div>
              )}
              <div
                className={`${!readOnly ? "cursor-pointer hover:border-primary/40" : ""} rounded-xl border p-2.5`}
                onClick={() => {
                  if (readOnly) return;
                  const g = grid ?? { id: "", positionId: pos.id, currency: "MGA", position: pos, components: [] };
                  setSelected(g as HrSalaryGrid);
                  setComponents(g.components ?? []);
                }}>
                {grid
                  ? <p className="text-xs text-muted-foreground">{grid.components.filter(c => c.type === "GAIN").length} gain(s) · {grid.components.filter(c => c.type === "DEDUCTION").length} retenue(s) {!readOnly && <span className="text-primary">→ Modifier</span>}</p>
                  : <p className="text-xs text-muted-foreground">{readOnly ? "Aucune grille" : "Aucune grille — cliquer pour configurer"}</p>}
              </div>
              {!readOnly && grid && mode === "FIXED" && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const r = await api(hr(`/salary-grids/${pos.id}/apply-to-employees`), { method: "POST" }) as { updated: number; skipped: number; baseSalary?: number; reason?: string };
                      qc.invalidateQueries({ queryKey: ["hr-employees"] });
                      if (r.updated > 0) toast.success(`Salaire de base synchronisé pour ${r.updated} employé(s) — ${r.baseSalary?.toLocaleString("fr-FR")} MGA`);
                      else if (r.skipped === 0) toast.info("Aucun employé actif à ce poste");
                      else toast.info(r.reason ?? "Aucun employé à mettre à jour");
                    } catch { toast.error("Erreur lors de l'application"); }
                  }}
                  className="w-full text-xs text-center py-1.5 rounded-lg border border-dashed hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                  Synchroniser le salaire de base sur tous les employés de ce poste
                </button>
              )}
            </div>
          );
        })}
        {positions.length === 0 && <div className="col-span-3 text-center py-8 text-muted-foreground text-sm">Aucun poste — créez des postes dans le module Personnel</div>}
      </div>
    </div>
  );
}

// ─── Monthly Payroll (Calcul mensuel) ─────────────────────────────────────────

function SalPayroll() {
  const qc = useQueryClient();
  const now = new Date();
  const [newPeriod, setNewPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [showCreate, setShowCreate] = useState(false);
  const [activePeriodId, setActivePeriodId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: periods = [], isLoading: periodsLoading } = useQuery<HrPayrollPeriod[]>({
    queryKey: ["hr-periods"], queryFn: () => api(hr("/payroll/periods")), staleTime: 30 * 1000,
  });
  const { data: slipsData, isLoading: slipsLoading } = useQuery<{ data: HrPayslip[] }>({
    queryKey: ["hr-payslips-period", activePeriodId],
    queryFn: () => api(hr(`/payroll/payslips?periodId=${activePeriodId}&limit=200`)),
    enabled: !!activePeriodId, staleTime: 15 * 1000,
  });
  const slips = slipsData?.data ?? [];
  const activePeriod = periods.find(p => p.id === activePeriodId);

  const create = useMutation({
    mutationFn: (d: any) => api(hr("/payroll/periods"), { method: "POST", body: d }),
    onSuccess: (p: any) => { qc.invalidateQueries({ queryKey: ["hr-periods"] }); setShowCreate(false); setActivePeriodId(p.id); toast.success("Période créée"); },
    onError: () => toast.error("Erreur"),
  });
  const calculate = useMutation({
    mutationFn: (id: string) => api(hr(`/payroll/periods/${id}/calculate`), { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-periods"] }); qc.invalidateQueries({ queryKey: ["hr-payslips-period", activePeriodId] }); toast.success("Salaires calculés depuis les grilles de l'ERP"); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur de calcul"),
  });
  const validate = useMutation({
    mutationFn: (id: string) => api(hr(`/payroll/periods/${id}/validate`), { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-periods"] }); qc.invalidateQueries({ queryKey: ["hr-payslips-period", activePeriodId] }); setSelected(new Set()); toast.success("Paie validée"); },
    onError: () => toast.error("Erreur"),
  });
  const markPaid = useMutation({
    mutationFn: (id: string) => api(hr(`/payroll/periods/${id}/mark-paid`), { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-periods"] }); qc.invalidateQueries({ queryKey: ["hr-payslips-period", activePeriodId] }); toast.success("Paie marquée comme payée"); },
    onError: () => toast.error("Erreur"),
  });

  const totalGross = slips.reduce((s, p) => s + p.grossSalary, 0);
  const totalNet   = slips.reduce((s, p) => s + p.netSalary, 0);
  const totalDed   = slips.reduce((s, p) => s + p.deductions, 0);
  const nCalc   = slips.filter(s => s.status === "CALCULATED").length;
  const nValid  = slips.filter(s => s.status === "VALIDATED").length;
  const nPaid   = slips.filter(s => s.status === "PAID").length;

  const allSelected = slips.length > 0 && selected.size === slips.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(slips.map(s => s.id)));
  const toggleOne = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Period list
  if (!activePeriodId) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Périodes de paie</p>
          <Btn onClick={() => setShowCreate(true)}><Plus size={13} /> Nouvelle période</Btn>
        </div>
        {showCreate && (
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold">Créer une période de paie</p>
            <div className="flex gap-3">
              <div>
                <label className="label">Mois</label>
                <select value={newPeriod.month} onChange={e => setNewPeriod(p => ({ ...p, month: Number(e.target.value) }))} className="sel">
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <F label="Année" type="number" value={String(newPeriod.year)} onChange={v => setNewPeriod(p => ({ ...p, year: Number(v) }))} />
            </div>
            <FormActions onCancel={() => setShowCreate(false)} onSave={() => create.mutate(newPeriod)} loading={create.isPending} />
          </div>
        )}
        {periodsLoading ? <Spinner /> : periods.length === 0
          ? <Empty label="Aucune période" Icon={Calculator} sub="Créez une période pour démarrer le calcul automatique de la paie" />
          : (
            <div className="space-y-2">
              {periods.map(p => {
                const meta = PAYROLL_STATUS[p.status] ?? PAYROLL_STATUS.DRAFT;
                return (
                  <div key={p.id} onClick={() => setActivePeriodId(p.id)}
                    className="rounded-2xl border bg-card p-4 flex items-center gap-4 flex-wrap cursor-pointer hover:border-primary/40 transition-colors">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{MONTHS[p.month - 1]} {p.year}</p>
                      <p className="text-xs text-muted-foreground">{p._count?.payslips ?? 0} bulletin(s)</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                    <span className="text-xs text-muted-foreground hover:text-primary">Gérer →</span>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    );
  }

  // Period detail with per-employee table
  const meta = PAYROLL_STATUS[activePeriod?.status ?? "DRAFT"] ?? PAYROLL_STATUS.DRAFT;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => { setActivePeriodId(null); setSelected(new Set()); }}
          className="text-sm text-muted-foreground hover:text-foreground">← Périodes</button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-semibold">{activePeriod ? `${MONTHS[activePeriod.month - 1]} ${activePeriod.year}` : "—"}</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>{meta.label}</span>
        <div className="ml-auto flex gap-2 flex-wrap">
          {activePeriod?.status === "DRAFT" && (
            <Btn onClick={() => calculate.mutate(activePeriodId)} loading={calculate.isPending}>
              <Calculator size={12} /> Calculer tous automatiquement
            </Btn>
          )}
          {activePeriod?.status === "CALCULATED" && (
            <Btn variant="green" onClick={() => validate.mutate(activePeriodId)} loading={validate.isPending}>
              <BadgeCheck size={12} /> Valider la paie
            </Btn>
          )}
          {activePeriod?.status === "VALIDATED" && (
            <Btn variant="primary" onClick={() => markPaid.mutate(activePeriodId)} loading={markPaid.isPending}>
              <DollarSign size={12} /> Marquer comme payé
            </Btn>
          )}
        </div>
      </div>

      {slips.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { l: "Total",   v: String(slips.length), c: "" },
            { l: "Calculés", v: String(nCalc),  c: "text-amber-600" },
            { l: "Validés",  v: String(nValid), c: "text-emerald-600" },
            { l: "Payés",    v: String(nPaid),  c: "text-purple-600" },
            { l: "Brut total", v: fmt(totalGross), c: "" },
            { l: "Net total",  v: fmt(totalNet),   c: "text-emerald-600" },
          ].map(({ l, v, c }) => (
            <div key={l} className="rounded-xl border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className={`font-bold text-sm ${c}`}>{v}</p>
            </div>
          ))}
        </div>
      )}

      <Card noPad>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 22rem)" }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide backdrop-blur-sm">
                <th className="px-4 py-2 w-8"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" /></th>
                <th className="px-4 py-2 text-left">Employé</th>
                <th className="px-4 py-2 text-right">Base</th>
                <th className="px-4 py-2 text-right">Gains</th>
                <th className="px-4 py-2 text-right">Retenues</th>
                <th className="px-4 py-2 text-right">Net à payer</th>
                <th className="px-4 py-2 text-left">Statut</th>
              </tr>
            </thead>
            <tbody>
              {slipsLoading ? (
                <tr><td colSpan={7} className="text-center py-10"><Loader2 size={18} className="animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : slips.length === 0 && activePeriod?.status === "DRAFT" ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm px-4">
                  <Calculator size={36} className="mx-auto mb-3 opacity-20" />
                  <p>Cliquez sur <strong>« Calculer tous automatiquement »</strong></p>
                  <p className="text-xs mt-1">Le système récupère tous les employés actifs et calcule leur salaire selon les grilles configurées.</p>
                </td></tr>
              ) : slips.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Aucun bulletin</td></tr>
              ) : slips.map(slip => {
                const sm   = SLIP_STATUS[slip.status] ?? SLIP_STATUS.DRAFT;
                const gains = Array.isArray(slip.items) ? slip.items.filter((i: any) => i.type === "GAIN").reduce((s: number, i: any) => s + i.amount, 0) : 0;
                const isPaid = slip.status === "PAID";
                return (
                  <tr key={slip.id} className={`border-b hover:bg-muted/20 ${isPaid ? "opacity-60" : ""}`}>
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={selected.has(slip.id)} onChange={() => toggleOne(slip.id)} disabled={isPaid} className="rounded" />
                    </td>
                    <td className="px-4 py-2">
                      <p className="font-medium">{slip.employee ? `${slip.employee.firstName} ${slip.employee.lastName}` : "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{slip.employee?.employeeNumber ?? "—"}</p>
                    </td>
                    <Td right>{fmt(slip.baseSalary)}</Td>
                    <Td right><span className="text-emerald-600">+{fmt(gains)}</span></Td>
                    <Td right><span className="text-red-600">−{fmt(slip.deductions)}</span></Td>
                    <Td right><span className="font-bold text-emerald-700">{fmt(slip.netSalary)}</span></Td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sm.cls}`}>{sm.icon} {sm.label}</span>
                      {isPaid && <p className="text-xs text-muted-foreground mt-0.5">⚠ Déjà payé — doublon impossible</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {nPaid > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 px-4 py-3">
          <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {nPaid} employé(s) marqué(s) comme payé(s) pour cette période. Le système empêche tout double paiement.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Payslips (Bulletins) ─────────────────────────────────────────────────────

function SalPayslips() {
  const { data: periods = [] } = useQuery<HrPayrollPeriod[]>({ queryKey: ["hr-periods"], queryFn: () => api(hr("/payroll/periods")), staleTime: 30 * 1000 });
  const [periodId, setPeriodId] = useState("");
  const { data, isLoading } = useQuery<{ data: HrPayslip[] }>({
    queryKey: ["hr-payslips", periodId], queryFn: () => api(hr(`/payroll/payslips?periodId=${periodId}&limit=200`)), enabled: !!periodId,
  });
  const [detail, setDetail] = useState<HrPayslip | null>(null);
  const payslips = data?.data ?? [];

  if (detail) return <SlipDetail slip={detail} onBack={() => setDetail(null)} />;

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Période</label>
        <select value={periodId} onChange={e => setPeriodId(e.target.value)} className="sel max-w-sm">
          <option value="">— Choisir une période —</option>
          {periods.map(p => <option key={p.id} value={p.id}>{MONTHS[p.month - 1]} {p.year} — {PAYROLL_STATUS[p.status]?.label}</option>)}
        </select>
      </div>
      {periodId && (
        <Card noPad>
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 22rem)" }}>
            <table className="w-full text-sm">
              <THead cols={["N°", "Employé", "Brut", "Retenues", "Net à payer", "Statut", ""]} />
              <tbody>
                {isLoading ? <EmptyRow cols={7} loading /> :
                payslips.length === 0 ? <EmptyRow cols={7} label="Aucun bulletin pour cette période" /> :
                payslips.map(slip => {
                  const sm = SLIP_STATUS[slip.status] ?? SLIP_STATUS.DRAFT;
                  return (
                    <tr key={slip.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setDetail(slip)}>
                      <Td mono>{slip.employee?.employeeNumber ?? "—"}</Td>
                      <Td bold>{slip.employee ? `${slip.employee.firstName} ${slip.employee.lastName}` : "—"}</Td>
                      <Td right>{fmt(slip.grossSalary)}</Td>
                      <Td right><span className="text-red-600">−{fmt(slip.deductions)}</span></Td>
                      <Td right><span className="font-bold text-emerald-600">{fmt(slip.netSalary)}</span></Td>
                      <td className="px-4 py-2"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${sm.cls}`}>{sm.icon} {sm.label}</span></td>
                      <td className="px-4 py-2 text-right text-xs text-primary">Voir →</td>
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

function SlipDetail({ slip, onBack }: { slip: HrPayslip; onBack: () => void }) {
  const { data: s, isLoading } = useQuery<HrPayslip>({ queryKey: ["hr-payslip", slip.id], queryFn: () => api(hr(`/payroll/payslips/${slip.id}`)) });
  const data = s ?? slip;
  const items: any[] = Array.isArray(data.items) ? data.items : [];
  const gains     = items.filter(i => i.type === "GAIN");
  const deductions = items.filter(i => i.type === "DEDUCTION");

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← Bulletins</button>
      {isLoading ? <Spinner /> : (
        <div className="rounded-2xl border bg-card p-6 space-y-5 max-w-2xl mx-auto">
          <div className="flex justify-between items-start border-b pb-4">
            <div>
              <p className="font-bold text-lg">{data.employee ? `${data.employee.firstName} ${data.employee.lastName}` : "—"}</p>
              <p className="text-sm text-muted-foreground font-mono">{data.employee?.employeeNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{data.period ? `${MONTHS[data.period.month - 1]} ${data.period.year}` : "—"}</p>
              <p className="text-xs text-muted-foreground">Bulletin de salaire</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Éléments de rémunération</p>
            <div className="border rounded-xl overflow-hidden">
              <div className="flex justify-between px-4 py-2.5 bg-muted/30 border-b"><span className="text-sm text-muted-foreground">Salaire de base</span><span className="text-sm font-semibold">{fmt(data.baseSalary)}</span></div>
              {gains.map((g, i) => <div key={i} className="flex justify-between px-4 py-2 border-b"><span className="text-sm text-emerald-700">+ {g.label}</span><span className="text-sm font-medium text-emerald-700">{fmt(g.amount)}</span></div>)}
              <div className="flex justify-between px-4 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/20"><span className="text-sm font-semibold">Salaire brut</span><span className="text-sm font-bold">{fmt(data.grossSalary)}</span></div>
            </div>
          </div>
          {deductions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Retenues et cotisations</p>
              <div className="border rounded-xl overflow-hidden">
                {deductions.map((d, i) => <div key={i} className="flex justify-between px-4 py-2 border-b last:border-0"><span className="text-sm text-red-700">− {d.label}</span><span className="text-sm font-medium text-red-700">{fmt(d.amount)}</span></div>)}
              </div>
            </div>
          )}
          <div className="border-t-2 pt-4 flex justify-between items-center">
            <span className="text-base font-bold uppercase tracking-wide">NET À PAYER</span>
            <span className="text-2xl font-bold text-primary">{fmt(data.netSalary)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────

function SalHistory() {
  const { data: periods = [], isLoading } = useQuery<HrPayrollPeriod[]>({
    queryKey: ["hr-periods"], queryFn: () => api(hr("/payroll/periods")), staleTime: 60 * 1000,
  });
  const paid = periods.filter(p => p.status === "PAID");
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Périodes de paie marquées comme payées.</p>
      {isLoading ? <Spinner /> : paid.length === 0 ? <Empty label="Aucune période payée" Icon={History} sub="Les périodes payées apparaîtront ici." /> : (
        <Card noPad>
          <table className="w-full text-sm">
            <THead cols={["Période", "Statut", "Bulletins"]} />
            <tbody>
              {paid.map(p => (
                <tr key={p.id} className="border-b hover:bg-muted/20">
                  <Td bold>{MONTHS[p.month - 1]} {p.year}</Td>
                  <td className="px-4 py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PAYROLL_STATUS.PAID.cls}`}>{PAYROLL_STATUS.PAID.label}</span></td>
                  <Td>{p._count?.payslips ?? 0} bulletin(s)</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────────

function SalReports() {
  const { data: periods = [] } = useQuery<HrPayrollPeriod[]>({ queryKey: ["hr-periods"], queryFn: () => api(hr("/payroll/periods")), staleTime: 60 * 1000 });
  const [periodId, setPeriodId] = useState("");
  const { data, isLoading } = useQuery<{ data: HrPayslip[] }>({
    queryKey: ["sal-report", periodId], queryFn: () => api(hr(`/payroll/payslips?periodId=${periodId}&limit=200`)), enabled: !!periodId,
  });
  const payslips = data?.data ?? [];
  const totalNet   = payslips.reduce((s, p) => s + p.netSalary, 0);
  const totalGross = payslips.reduce((s, p) => s + p.grossSalary, 0);
  const totalDed   = payslips.reduce((s, p) => s + p.deductions, 0);

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Période de paie</label>
        <select value={periodId} onChange={e => setPeriodId(e.target.value)} className="sel max-w-sm">
          <option value="">— Choisir une période —</option>
          {periods.map(p => <option key={p.id} value={p.id}>{MONTHS[p.month - 1]} {p.year}</option>)}
        </select>
      </div>
      {periodId && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Masse salariale brute" value={fmt(totalGross)} icon={<TrendingUp size={15} />} color="blue" />
            <Kpi label="Total retenues"        value={fmt(totalDed)}   icon={<AlertCircle size={15} />} color="amber" />
            <Kpi label="Masse salariale nette" value={fmt(totalNet)}   icon={<DollarSign size={15} />} color="green" />
          </div>
          <Card title="Détail par employé" noPad>
            <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 28rem)" }}>
              <table className="w-full text-sm">
                <THead cols={["Employé", "N° Matricule", "Brut", "Retenues", "Net"]} />
                <tbody>
                  {isLoading ? <EmptyRow cols={5} loading /> :
                  payslips.length === 0 ? <EmptyRow cols={5} label="Aucun bulletin" /> :
                  payslips.map(slip => (
                    <tr key={slip.id} className="border-b hover:bg-muted/20">
                      <Td bold>{slip.employee ? `${slip.employee.firstName} ${slip.employee.lastName}` : "—"}</Td>
                      <Td mono>{slip.employee?.employeeNumber ?? "—"}</Td>
                      <Td right>{fmt(slip.grossSalary)}</Td>
                      <Td right><span className="text-red-600">−{fmt(slip.deductions)}</span></Td>
                      <Td right><span className="font-bold text-emerald-600">{fmt(slip.netSalary)}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Settings (Super Admin only) ─────────────────────────────────────────────

function SalSettings() {
  const qc = useQueryClient();
  const { data: rates, isLoading } = useQuery<HrHourlyRateSettings>({
    queryKey: ["hr-hourly-rates"], queryFn: () => api(hr("/settings/hourly-rates")), staleTime: 5 * 60 * 1000,
  });
  const [form, setForm] = useState<HrHourlyRateSettings | null>(null);

  // Initialise form from loaded data
  if (rates && !form) setForm({ ...rates });

  const save = useMutation({
    mutationFn: (data: HrHourlyRateSettings) => api(hr("/settings/hourly-rates"), { method: "PUT", body: data }),
    onSuccess: (d: any) => { qc.invalidateQueries({ queryKey: ["hr-hourly-rates"] }); setForm(d); toast.success("Tarifs enregistrés"); },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  if (isLoading) return <Spinner />;

  const f = form ?? { rateCM: 0, rateTD: 0, rateTP: 0, rateHS: 0 };
  const setF = (key: keyof HrHourlyRateSettings, v: string) => setForm(p => p ? { ...p, [key]: Number(v) } : p);

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h2 className="text-sm font-semibold">Tarification des enseignements</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ces tarifs sont utilisés pour calculer automatiquement le salaire des enseignants (mode horaire).
          Aucune règle n'est codée en dur — vous pouvez les modifier à tout moment.
        </p>
      </div>

      <div className="rounded-2xl border bg-card divide-y">
        {([
          { key: "rateCM", label: "Cours Magistral (CM)", desc: "Par heure de CM dispensée" },
          { key: "rateTD", label: "Travaux Dirigés (TD)",  desc: "Par heure de TD dispensée" },
          { key: "rateTP", label: "Travaux Pratiques (TP)", desc: "Par heure de TP dispensée" },
          { key: "rateHS", label: "Heures supplémentaires", desc: "Par heure au-delà du quota" },
        ] as { key: keyof HrHourlyRateSettings; label: string; desc: string }[]).map(({ key, label, desc }) => (
          <div key={key} className="flex items-center gap-4 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="number"
                min="0"
                step="500"
                value={f[key]}
                onChange={e => setF(key, e.target.value)}
                className="w-36 rounded-lg border bg-background px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground">MGA / h</span>
            </div>
          </div>
        ))}
      </div>

      {/* Live preview of total salary for a hypothetical teacher */}
      {(f.rateCM > 0 || f.rateTD > 0 || f.rateTP > 0) && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Exemple — enseignant type (30 CM + 20 TD + 10 TP)</p>
          {[
            { type: "CM", hours: 30, rate: f.rateCM },
            { type: "TD", hours: 20, rate: f.rateTD },
            { type: "TP", hours: 10, rate: f.rateTP },
          ].filter(r => r.rate > 0).map(r => (
            <div key={r.type} className="flex justify-between text-sm text-emerald-700">
              <span>{r.type} — {r.hours}h × {r.rate.toLocaleString("fr-FR")} MGA</span>
              <span className="font-semibold">{(r.hours * r.rate).toLocaleString("fr-FR")} MGA</span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between font-bold text-sm">
            <span>Total brut estimé</span>
            <span className="text-primary">{(30 * f.rateCM + 20 * f.rateTD + 10 * f.rateTP).toLocaleString("fr-FR")} MGA</span>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Btn onClick={() => form && save.mutate(form)} loading={save.isPending}>
          Enregistrer les tarifs
        </Btn>
      </div>

      <div className="border-t pt-5">
        <h2 className="text-sm font-semibold mb-1">Mode de calcul des postes</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Le mode de chaque poste est configurable dans l'onglet <strong>Grilles salariales</strong>.
          Chaque poste peut être indépendamment réglé sur « Salaire fixe » ou « Par heures d'enseignement ».
        </p>
        <div className="rounded-xl border divide-y text-sm">
          <div className="flex gap-3 px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase">
            <span className="flex-1">Poste</span><span>Mode recommandé</span>
          </div>
          {[
            ["Recteur / Vice-Recteur", "💼 Salaire fixe"],
            ["Directeur / Doyen", "💼 Salaire fixe"],
            ["Secrétaire / Comptable", "💼 Salaire fixe"],
            ["Bibliothécaire / Agent", "💼 Salaire fixe"],
            ["Enseignant titulaire", "⏱ Par heures"],
            ["Enseignant vacataire", "⏱ Par heures"],
            ["Assistant enseignant", "⏱ Par heures"],
          ].map(([p, m]) => (
            <div key={p} className="flex gap-3 px-4 py-2">
              <span className="flex-1 text-muted-foreground">{p}</span>
              <span className={m.startsWith("⏱") ? "text-blue-600 font-medium" : "text-muted-foreground"}>{m}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Shared Primitives ────────────────────────────────────────────────────────

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
      <div className="min-w-0"><div className="text-xs text-muted-foreground truncate">{label}</div><div className="text-base font-bold truncate">{value}</div></div>
    </div>
  );
}
function Card({ title, noPad, children }: { title?: string; noPad?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {title && <div className="border-b bg-muted/30 px-4 py-3"><p className="text-sm font-semibold">{title}</p></div>}
      {noPad ? children : <div className="p-4">{children}</div>}
    </div>
  );
}
function THead({ cols }: { cols: string[] }) {
  return <thead className="sticky top-0 z-10"><tr className="border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide backdrop-blur-sm">{cols.map(c => <th key={c} className="px-4 py-2 text-left whitespace-nowrap">{c}</th>)}</tr></thead>;
}
function Td({ children, right, bold, muted, mono }: { children?: React.ReactNode; right?: boolean; bold?: boolean; muted?: boolean; mono?: boolean }) {
  return <td className={`px-4 py-2 ${right ? "text-right" : ""} ${bold ? "font-medium" : ""} ${muted ? "text-muted-foreground" : ""} ${mono ? "font-mono text-xs" : ""}`}>{children}</td>;
}
function EmptyRow({ cols, label, loading }: { cols: number; label?: string; loading?: boolean }) {
  return <tr><td colSpan={cols} className="text-center py-8 text-muted-foreground">{loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : label}</td></tr>;
}
function Spinner() { return <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-muted-foreground" /></div>; }
function Empty({ label, sub, Icon }: { label: string; sub?: string; Icon?: any }) {
  return <div className="text-center py-14 text-muted-foreground">{Icon && <Icon size={40} className="mx-auto mb-3 opacity-20" />}<p className="text-sm font-medium">{label}</p>{sub && <p className="text-xs mt-1">{sub}</p>}</div>;
}
function ActiveBadge({ v, label }: { v: boolean; label?: string }) {
  return v
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">{label ?? "Actif"}</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Inactif</span>;
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
  return <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded" />{label}</label>;
}
function Btn({ onClick, children, loading, variant = "primary", disabled }: { onClick?: () => void; children?: React.ReactNode; loading?: boolean; variant?: "primary" | "green" | "red"; disabled?: boolean }) {
  const cls = { primary: "grad-classroom text-white", green: "bg-emerald-600 hover:bg-emerald-700 text-white", red: "bg-red-600 hover:bg-red-700 text-white" };
  return (
    <button onClick={onClick} disabled={loading || disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${cls[variant]} text-xs font-semibold disabled:opacity-50`}>
      {loading && <Loader2 size={12} className="animate-spin" />}{children}
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
