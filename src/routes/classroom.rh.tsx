import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Users, Briefcase, Building2, FileText, Grid3X3, Plus, Pencil, Trash2,
  Loader2, Search, BarChart2, Calendar, XCircle, CheckCircle2, Clock,
  UserCheck,
} from "lucide-react";
import { isMentionResponsible, useRequireClassroom } from "@/components/classroom/shared";
import { format } from "date-fns";

export const Route = createFileRoute("/classroom/rh")({ component: RH });

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "employees" | "positions" | "departments" | "contracts" | "salary-grids" | "leaves";

interface HrDepartment { id: string; name: string; code?: string; active: boolean; _count?: { positions: number; employees: number }; }
interface HrPosition { id: string; title: string; code?: string; departmentId?: string; active: boolean; department?: { name: string }; _count?: { employees: number }; }
interface HrEmployee {
  id: string; employeeNumber: string; firstName: string; lastName: string; email?: string; phone?: string;
  positionId?: string; departmentId?: string; contractType: string; startDate: string; endDate?: string;
  baseSalary?: number | null; currency: string; active: boolean; userId?: string;
  position?: { title: string; payCalcMode?: string }; department?: { name: string };
  user?: { id: string; firstName: string; lastName: string; email: string; systemRole: string };
  contracts?: HrContract[];
}
interface StaffUser { id: string; firstName: string; lastName: string; email: string; systemRole: string; }
interface HrContract { id: string; employeeId: string; type: string; payCalcMode?: string; startDate: string; endDate?: string; baseSalary?: number | null; currency: string; notes?: string; }
interface HrSalaryGrid { id: string; positionId: string; currency: string; position?: { title: string; code?: string }; components: HrSalaryComponent[]; }
interface HrSalaryComponent { id?: string; gridId?: string; type: "GAIN" | "DEDUCTION"; label: string; code: string; amount: number; isPercent: boolean; order: number; active: boolean; }
interface HrLeaveType { id: string; name: string; code: string; daysPerYear?: number; paid: boolean; active: boolean; }
interface HrLeave { id: string; employeeId: string; leaveTypeId?: string; startDate: string; endDate: string; days: number; reason?: string; status: string; employee?: { firstName: string; lastName: string; employeeNumber: string }; }
interface HrDashboard { totalEmployees: number; activeEmployees: number; pendingLeaves: number; payrollMass: number; currentPeriodStatus?: string; byDepartment: { name: string; count: number }[]; byContractType: { type: string; count: number }[]; }

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTRACT_LABELS: Record<string, string> = {
  CDI: "CDI", CDD: "CDD", VACATAIRE: "Vacataire", CONSULTANT: "Consultant", STAGE: "Stage", AUTRE: "Autre",
};
const LEAVE_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: "En attente", cls: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "Approuvé",   cls: "bg-emerald-100 text-emerald-700" },
  REFUSED:  { label: "Refusé",     cls: "bg-red-100 text-red-700" },
  CANCELLED:{ label: "Annulé",     cls: "bg-gray-100 text-gray-500" },
};
const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

const hr = (path: string) => `/hr${path}`;
const fmt = (n: number | null | undefined) => n == null ? "Non défini" : n.toLocaleString("fr-FR") + " MGA";

// ─── Main Component ───────────────────────────────────────────────────────────

function RH() {
  const { user, roles } = useRequireClassroom();
  const sysRole = user?.systemRole ?? "";
  const roleName = roles?.[0]?.roleName ?? "";
  const isAdmin = sysRole === "SUPER_ADMIN";
  // Personnel géré par l'administrateur et la comptabilité (plus par le secrétariat)
  const isAdminRole = roleName.includes("Administration") || roleName.includes("Comptabilité") || roleName.includes("Finance");
  const isChefMention = isMentionResponsible(roleName);

  // Personnel module: HR data only — payroll lives in classroom.salaires.tsx
  type TabRole = "all" | "admin";
  const allTabs: { id: Tab; label: string; Icon: any; roles: TabRole }[] = [
    { id: "dashboard",    label: "Tableau de bord",   Icon: BarChart2,  roles: "all" },
    { id: "employees",    label: "Employés",           Icon: Users,      roles: "admin" },
    { id: "positions",    label: "Postes",             Icon: Briefcase,  roles: "all" },
    { id: "departments",  label: "Départements",       Icon: Building2,  roles: "all" },
    { id: "contracts",    label: "Contrats",           Icon: FileText,   roles: "admin" },
    { id: "salary-grids", label: "Grilles salariales", Icon: Grid3X3,   roles: "all" },
    { id: "leaves",       label: "Congés & Absences",  Icon: Calendar,  roles: "admin" },
  ];

  const tabs = allTabs.filter(t => {
    if (isAdmin || isAdminRole) return true;
    if (isChefMention) return t.id === "dashboard" || t.id === "employees";
    return t.roles === "all";
  });

  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? "dashboard");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h1 className="text-xl font-bold">Personnel</h1>
          <p className="text-xs text-muted-foreground">Gestion des ressources humaines</p>
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
        {tab === "dashboard"    && <DashboardTab />}
        {tab === "employees"    && <EmployeesTab />}
        {tab === "positions"    && <PositionsTab />}
        {tab === "departments"  && <DepartmentsTab />}
        {tab === "contracts"    && <ContractsTab />}
        {tab === "salary-grids" && <SalaryGridsTab />}
        {tab === "leaves"       && <LeavesTab />}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardTab() {
  const { data, isLoading } = useQuery<HrDashboard>({
    queryKey: ["hr-dash"], queryFn: () => api(hr("/dashboard")), staleTime: 30 * 1000,
  });
  if (isLoading) return <Spinner />;
  if (!data) return <Empty label="Tableau de bord indisponible" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total employés"      value={String(data.totalEmployees)}  icon={<Users size={15} />}    color="blue" />
        <Kpi label="Employés actifs"     value={String(data.activeEmployees)} icon={<UserCheck size={15} />} color="green" />
        <Kpi label="Congés en attente"   value={String(data.pendingLeaves)}   icon={<Clock size={15} />}    color="amber" />
        <Kpi label="Masse salariale (mois)" value={fmt(data.payrollMass)}     icon={<UserCheck size={15} />} color="purple" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Répartition par département" noPad>
          <table className="w-full text-sm">
            <THead cols={["Département", "Employés"]} />
            <tbody>
              {data.byDepartment.length === 0 ? <EmptyRow cols={2} label="Aucune donnée" /> :
                data.byDepartment.map(d => (
                  <tr key={d.name} className="border-b hover:bg-muted/20">
                    <Td bold>{d.name}</Td>
                    <Td right><span className="font-semibold">{d.count}</span></Td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </Card>
        <Card title="Répartition par type de contrat" noPad>
          <table className="w-full text-sm">
            <THead cols={["Type", "Employés"]} />
            <tbody>
              {data.byContractType.length === 0 ? <EmptyRow cols={2} label="Aucune donnée" /> :
                data.byContractType.map(c => (
                  <tr key={c.type} className="border-b hover:bg-muted/20">
                    <Td>{CONTRACT_LABELS[c.type] ?? c.type}</Td>
                    <Td right><span className="font-semibold">{c.count}</span></Td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </Card>
      </div>

      {data.currentPeriodStatus && (
        <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
          <BarChart2 size={20} className="text-primary" />
          <div>
            <p className="text-sm font-semibold">Période de paie en cours</p>
            <p className="text-xs text-muted-foreground">
              Statut : <span className="font-medium">{data.currentPeriodStatus}</span> — gérez les salaires dans <em>Gestion des Salaires</em>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Departments ──────────────────────────────────────────────────────────────

function DepartmentsTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery<HrDepartment[]>({ queryKey: ["hr-depts"], queryFn: () => api(hr("/departments")), staleTime: 5 * 60 * 1000 });
  const [form, setForm] = useState<Partial<HrDepartment> | null>(null);

  const save = useMutation({
    mutationFn: (d: any) => form?.id ? api(hr(`/departments/${form.id}`), { method: "PUT", body: d }) : api(hr("/departments"), { method: "POST", body: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-depts"] }); setForm(null); toast.success("Enregistré"); },
    onError: () => toast.error("Erreur"),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(hr(`/departments/${id}`), { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-depts"] }); toast.success("Supprimé"); },
    onError: (e: any) => toast.error(e?.message ?? "Impossible de supprimer"),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Btn onClick={() => setForm({ active: true })}><Plus size={13} /> Nouveau département</Btn>
      </div>
      {form !== null && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">{form.id ? "Modifier" : "Nouveau département"}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Nom" value={form.name ?? ""} onChange={v => setForm(p => ({ ...p!, name: v }))} />
            <F label="Code (optionnel)" value={form.code ?? ""} onChange={v => setForm(p => ({ ...p!, code: v || undefined }))} />
          </div>
          <Check label="Actif" checked={form.active ?? true} onChange={v => setForm(p => ({ ...p!, active: v }))} />
          <FormActions onCancel={() => setForm(null)} onSave={() => save.mutate(form)} loading={save.isPending} />
        </div>
      )}
      <Card noPad>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 26rem)" }}>
          <table className="w-full text-sm">
            <THead cols={["Département", "Code", "Postes", "Employés", "Statut", "Actions"]} />
            <tbody>
              {isLoading ? <EmptyRow cols={6} loading /> :
              data.length === 0 ? <EmptyRow cols={6} label="Aucun département" /> :
              data.map(d => (
                <tr key={d.id} className="border-b hover:bg-muted/20">
                  <Td bold>{d.name}</Td>
                  <Td mono>{d.code ?? "—"}</Td>
                  <Td>{d._count?.positions ?? 0}</Td>
                  <Td>{d._count?.employees ?? 0}</Td>
                  <td className="px-4 py-2"><ActiveBadge v={d.active} /></td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setForm(d)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Pencil size={13} /></button>
                      <button onClick={() => del.mutate(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 dark:hover:bg-red-950/20"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Positions ────────────────────────────────────────────────────────────────

function PositionsTab() {
  const qc = useQueryClient();
  const { data: positions = [], isLoading } = useQuery<HrPosition[]>({ queryKey: ["hr-positions"], queryFn: () => api(hr("/positions")), staleTime: 5 * 60 * 1000 });
  const { data: departments = [] } = useQuery<HrDepartment[]>({ queryKey: ["hr-depts"], queryFn: () => api(hr("/departments")), staleTime: 5 * 60 * 1000 });
  const [form, setForm] = useState<Partial<HrPosition> | null>(null);

  const save = useMutation({
    mutationFn: (d: any) => form?.id ? api(hr(`/positions/${form.id}`), { method: "PUT", body: d }) : api(hr("/positions"), { method: "POST", body: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-positions"] }); setForm(null); toast.success("Enregistré"); },
    onError: () => toast.error("Erreur"),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(hr(`/positions/${id}`), { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-positions"] }); toast.success("Supprimé"); },
    onError: (e: any) => toast.error(e?.message ?? "Impossible de supprimer"),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Btn onClick={() => setForm({ active: true })}><Plus size={13} /> Nouveau poste</Btn>
      </div>
      {form !== null && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">{form.id ? "Modifier" : "Nouveau poste"}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Titre du poste" value={form.title ?? ""} onChange={v => setForm(p => ({ ...p!, title: v }))} />
            <F label="Code (optionnel)" value={form.code ?? ""} onChange={v => setForm(p => ({ ...p!, code: v || undefined }))} />
            <div>
              <label className="label">Département</label>
              <select value={form.departmentId ?? ""} onChange={e => setForm(p => ({ ...p!, departmentId: e.target.value || undefined }))} className="sel">
                <option value="">— Aucun —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Mode de calcul du salaire</label>
              <select value={(form as any).payCalcMode ?? "FIXED"} onChange={e => setForm(p => ({ ...p!, payCalcMode: e.target.value }))} className="sel">
                <option value="FIXED">💼 Salaire fixe</option>
                <option value="HOURLY">⏱ Par heures d'enseignement</option>
              </select>
            </div>
          </div>
          <Check label="Actif" checked={form.active ?? true} onChange={v => setForm(p => ({ ...p!, active: v }))} />
          <FormActions onCancel={() => setForm(null)} onSave={() => save.mutate(form)} loading={save.isPending} />
        </div>
      )}
      <Card noPad>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 26rem)" }}>
          <table className="w-full text-sm">
            <THead cols={["Poste", "Code", "Mode", "Département", "Employés", "Statut", "Actions"]} />
            <tbody>
              {isLoading ? <EmptyRow cols={6} loading /> :
              positions.length === 0 ? <EmptyRow cols={6} label="Aucun poste" /> :
              positions.map(p => (
                <tr key={p.id} className="border-b hover:bg-muted/20">
                  <Td bold>{p.title}</Td>
                  <Td mono>{p.code ?? "—"}</Td>
                  <Td><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${(p as any).payCalcMode === "HOURLY" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{(p as any).payCalcMode === "HOURLY" ? "⏱ Horaire" : "💼 Fixe"}</span></Td>
                  <Td muted>{p.department?.name ?? "—"}</Td>
                  <Td>{p._count?.employees ?? 0}</Td>
                  <td className="px-4 py-2"><ActiveBadge v={p.active} /></td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setForm(p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Pencil size={13} /></button>
                      <button onClick={() => del.mutate(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 dark:hover:bg-red-950/20"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Employees ────────────────────────────────────────────────────────────────

function EmployeesTab() {
  const qc = useQueryClient();
  const [search, setSearch]   = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage]       = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<Partial<HrEmployee & { userId?: string }>>({});
  const timer = useState<any>(null);

  const { data: positions   = [] } = useQuery<HrPosition[]>({ queryKey: ["hr-positions"],   queryFn: () => api(hr("/positions")),   staleTime: 5 * 60 * 1000 });
  const { data: departments = [] } = useQuery<HrDepartment[]>({ queryKey: ["hr-depts"],      queryFn: () => api(hr("/departments")), staleTime: 5 * 60 * 1000 });
  const { data: staffUsers  = [] } = useQuery<StaffUser[]>({ queryKey: ["hr-staff-users"],   queryFn: () => api(hr("/staff-users")), staleTime: 30 * 1000 });

  const qs = new URLSearchParams({ page: String(page), limit: "20", ...(searchQ ? { search: searchQ } : {}) }).toString();
  const { data, isLoading } = useQuery<{ data: HrEmployee[]; total: number; pages: number }>({
    queryKey: ["hr-employees", qs], queryFn: () => api(hr(`/employees?${qs}`)), staleTime: 30 * 1000,
  });

  const save = useMutation({
    mutationFn: (d: any) => form.id ? api(hr(`/employees/${form.id}`), { method: "PUT", body: d }) : api(hr("/employees"), { method: "POST", body: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-employees"] }); qc.invalidateQueries({ queryKey: ["hr-staff-users"] }); setShowForm(false); setForm({}); toast.success("Enregistré"); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => api(hr(`/employees/${id}/deactivate`), { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-employees"] }); toast.success("Employé désactivé"); },
    onError: () => toast.error("Erreur"),
  });

  const handleSearch = (v: string) => {
    setSearch(v);
    if (timer[0]) clearTimeout(timer[0]);
    (timer as any)[0] = setTimeout(() => { setSearchQ(v); setPage(1); }, 400);
  };

  const handleUserPick = (userId: string) => {
    if (!userId) { setForm(p => ({ ...p, userId: undefined })); return; }
    const u = staffUsers.find(u => u.id === userId);
    if (u) setForm(p => ({ ...p, userId, firstName: u.firstName, lastName: u.lastName, email: u.email }));
  };

  const isEditing = !!form.id;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Rechercher un employé..."
            className="w-full rounded-xl border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <Btn onClick={() => { setForm({ active: true, currency: "MGA", contractType: "CDI" }); setShowForm(true); }}><Plus size={13} /> Ajouter</Btn>
      </div>

      {showForm && (
        <div className="rounded-2xl border bg-card p-4 space-y-4">
          <p className="text-sm font-semibold">{isEditing ? "Modifier employé" : "Nouvel employé"}</p>

          {/* User link — only for new employees or those without a link */}
          {!isEditing && (
            <div className="rounded-xl border border-dashed bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Lier à un compte utilisateur existant <span className="text-muted-foreground/60">(optionnel)</span></p>
              <select value={form.userId ?? ""} onChange={e => handleUserPick(e.target.value)} className="sel">
                <option value="">— Aucun lien (employé sans compte) —</option>
                {staffUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} · {u.email}</option>)}
              </select>
              {form.userId && <p className="text-xs text-emerald-600">✓ Nom et email pré-remplis depuis le compte utilisateur</p>}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Prénom" value={form.firstName ?? ""} onChange={v => setForm(p => ({ ...p, firstName: v }))} />
            <F label="Nom" value={form.lastName ?? ""} onChange={v => setForm(p => ({ ...p, lastName: v }))} />
            <F label="N° Employé" value={form.employeeNumber ?? ""} onChange={v => setForm(p => ({ ...p, employeeNumber: v }))} placeholder="Auto si vide" />
            <F label="Email" type="email" value={form.email ?? ""} onChange={v => setForm(p => ({ ...p, email: v || undefined }))} />
            <F label="Téléphone" value={form.phone ?? ""} onChange={v => setForm(p => ({ ...p, phone: v || undefined }))} />
            <div>
              <label className="label">Type de contrat</label>
              <select value={form.contractType ?? "CDI"} onChange={e => setForm(p => ({ ...p, contractType: e.target.value }))} className="sel">
                {Object.entries(CONTRACT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Poste</label>
              <select value={form.positionId ?? ""} onChange={e => setForm(p => ({ ...p, positionId: e.target.value || undefined }))} className="sel">
                <option value="">— Aucun —</option>
                {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Département</label>
              <select value={form.departmentId ?? ""} onChange={e => setForm(p => ({ ...p, departmentId: e.target.value || undefined }))} className="sel">
                <option value="">— Aucun —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            {(() => {
              const pos = positions.find(p => p.id === form.positionId);
              const mode = (pos as any)?.payCalcMode ?? "FIXED";
              return mode === "FIXED" ? (
                <F label="Salaire de base (MGA)" type="number" value={form.baseSalary != null ? String(form.baseSalary) : ""} onChange={v => setForm(p => ({ ...p, baseSalary: v ? Number(v) : undefined }))} />
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 col-span-1">
                  <span>⏱</span> Mode horaire — les heures validées dans l'EDT calculeront automatiquement la rémunération.
                </div>
              );
            })()}
            <F label="Date d'entrée" type="date" value={form.startDate?.slice(0, 10) ?? ""} onChange={v => setForm(p => ({ ...p, startDate: v }))} />
            <F label="Date de fin (optionnel)" type="date" value={form.endDate?.slice(0, 10) ?? ""} onChange={v => setForm(p => ({ ...p, endDate: v || undefined }))} />
          </div>
          <FormActions onCancel={() => { setShowForm(false); setForm({}); }} onSave={() => save.mutate(form)} loading={save.isPending} />
        </div>
      )}

      <Card noPad>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 24rem)" }}>
          <table className="w-full text-sm">
            <THead cols={["N°", "Employé", "Compte", "Poste", "Département", "Contrat", "Salaire de base", "Statut", "Actions"]} />
            <tbody>
              {isLoading ? <EmptyRow cols={9} loading /> :
              (data?.data ?? []).length === 0 ? <EmptyRow cols={9} label="Aucun employé" /> :
              (data?.data ?? []).map(emp => (
                <tr key={emp.id} className="border-b hover:bg-muted/30">
                  <Td mono>{emp.employeeNumber}</Td>
                  <Td bold>{emp.firstName} {emp.lastName}</Td>
                  <td className="px-4 py-2">
                    {emp.user
                      ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><UserCheck size={11} /> Lié</span>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <Td muted>{emp.position?.title ?? "—"}</Td>
                  <Td muted>{emp.department?.name ?? "—"}</Td>
                  <td className="px-4 py-2"><span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{CONTRACT_LABELS[emp.contractType] ?? emp.contractType}</span></td>
                  <td className="px-4 py-2 text-right text-xs">
                    {(() => {
                      const activeContract = emp.contracts?.[0];
                      const mode = activeContract?.payCalcMode ?? emp.position?.payCalcMode ?? "FIXED";
                      if (mode === "HOURLY") return <span className="text-blue-600 font-medium">⏱ Calcul horaire</span>;
                      if (!activeContract) return <span className="text-muted-foreground">Aucun contrat</span>;
                      return activeContract.baseSalary != null
                        ? <span className="font-semibold">{fmt(activeContract.baseSalary)}</span>
                        : <span className="text-amber-600">Non défini</span>;
                    })()}
                  </td>
                  <td className="px-4 py-2"><ActiveBadge v={emp.active} /></td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setForm(emp); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Pencil size={13} /></button>
                      {emp.active && (
                        <button onClick={() => deactivate.mutate(emp.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 dark:hover:bg-red-950/20">
                          <XCircle size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Contracts ────────────────────────────────────────────────────────────────

function ContractsTab() {
  const { data: employeesRes } = useQuery<{ data: HrEmployee[] }>({ queryKey: ["hr-employees", "limit=200"], queryFn: () => api(hr("/employees?limit=200")), staleTime: 5 * 60 * 1000 });
  const employees = employeesRes?.data ?? [];
  const [employeeId, setEmployeeId] = useState("");

  const { data: contracts = [], isLoading } = useQuery<HrContract[]>({
    queryKey: ["hr-contracts", employeeId], queryFn: () => api(hr(`/employees/${employeeId}/contracts`)), enabled: !!employeeId,
  });

  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<HrContract> | null>(null);
  const save = useMutation({
    mutationFn: (d: any) => api(hr(`/employees/${employeeId}/contracts`), { method: "POST", body: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-contracts", employeeId] }); setForm(null); toast.success("Contrat ajouté"); },
    onError: () => toast.error("Erreur"),
  });

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Sélectionner un employé</label>
        <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="sel max-w-sm">
          <option value="">— Choisir un employé —</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeNumber})</option>)}
        </select>
      </div>

      {employeeId && (
        <>
          <div className="flex justify-end">
            <Btn onClick={() => setForm({ type: "CDI", baseSalary: 0, currency: "MGA" })}><Plus size={13} /> Nouveau contrat</Btn>
          </div>
          {form !== null && (
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800">Nouveau contrat</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">Type de contrat</label>
                  <select value={form.type ?? "CDI"} onChange={e => setForm(p => ({ ...p!, type: e.target.value }))} className="sel">
                    {Object.entries(CONTRACT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Mode de calcul</label>
                  <select value={form.payCalcMode ?? "FIXED"} onChange={e => setForm(p => ({ ...p!, payCalcMode: e.target.value }))} className="sel">
                    <option value="FIXED">💼 Salaire fixe</option>
                    <option value="HOURLY">⏱ Par heures d'enseignement</option>
                  </select>
                </div>
                <F label="Date de début" type="date" value={form.startDate?.slice(0, 10) ?? ""} onChange={v => setForm(p => ({ ...p!, startDate: v }))} />
                <F label="Date de fin (optionnel)" type="date" value={form.endDate?.slice(0, 10) ?? ""} onChange={v => setForm(p => ({ ...p!, endDate: v || undefined }))} />
                {(form.payCalcMode ?? "FIXED") === "FIXED" ? (
                  <F label="Salaire de base (MGA)" type="number" value={form.baseSalary != null ? String(form.baseSalary) : ""} placeholder="Montant à saisir" onChange={v => setForm(p => ({ ...p!, baseSalary: v ? Number(v) : undefined }))} />
                ) : (
                  <div className="flex items-center rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-700 gap-2">
                    <span>⏱</span> Rémunération calculée automatiquement depuis l'EDT.
                  </div>
                )}
                <div className="sm:col-span-3"><F label="Notes (optionnel)" value={form.notes ?? ""} onChange={v => setForm(p => ({ ...p!, notes: v }))} /></div>
              </div>
              <FormActions onCancel={() => setForm(null)} onSave={() => save.mutate(form)} loading={save.isPending} />
            </div>
          )}
          <Card noPad>
            <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 28rem)" }}>
              <table className="w-full text-sm">
                <THead cols={["Type", "Mode", "Début", "Fin", "Rémunération", "Notes"]} />
                <tbody>
                  {isLoading ? <EmptyRow cols={6} loading /> :
                  contracts.length === 0 ? <EmptyRow cols={6} label="Aucun contrat" /> :
                  contracts.map(c => (
                    <tr key={c.id} className="border-b hover:bg-muted/20">
                      <td className="px-4 py-2"><span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{CONTRACT_LABELS[c.type] ?? c.type}</span></td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.payCalcMode === "HOURLY" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {c.payCalcMode === "HOURLY" ? "⏱ Horaire" : "💼 Fixe"}
                        </span>
                      </td>
                      <Td muted>{format(new Date(c.startDate), "dd/MM/yyyy")}</Td>
                      <Td muted>{c.endDate ? format(new Date(c.endDate), "dd/MM/yyyy") : "En cours"}</Td>
                      <Td right>
                        {c.payCalcMode === "HOURLY"
                          ? <span className="text-blue-600 text-xs">Selon les heures EDT</span>
                          : c.baseSalary != null
                            ? <span className="font-semibold">{fmt(c.baseSalary)}</span>
                            : <span className="text-amber-600 text-xs">Non défini</span>}
                      </Td>
                      <Td muted>{c.notes ?? "—"}</Td>
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

// ─── Salary Grids ─────────────────────────────────────────────────────────────

function SalaryGridsTab() {
  const qc = useQueryClient();
  const { data: grids = [], isLoading } = useQuery<HrSalaryGrid[]>({ queryKey: ["hr-grids"], queryFn: () => api(hr("/salary-grids")), staleTime: 5 * 60 * 1000 });
  const { data: positions = [] } = useQuery<HrPosition[]>({ queryKey: ["hr-positions"], queryFn: () => api(hr("/positions")), staleTime: 5 * 60 * 1000 });
  const [selected, setSelected] = useState<HrSalaryGrid | null>(null);
  const [components, setComponents] = useState<Partial<HrSalaryComponent>[]>([]);

  const save = useMutation({
    mutationFn: ({ positionId, data }: { positionId: string; data: any }) => api(hr(`/salary-grids/${positionId}`), { method: "PUT", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-grids"] }); setSelected(null); toast.success("Grille enregistrée"); },
    onError: () => toast.error("Erreur"),
  });

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground">← Retour</button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-semibold">{selected.position?.title}</span>
          <div className="ml-auto">
            <Btn onClick={() => save.mutate({ positionId: selected.positionId, data: { currency: selected.currency, components } })} loading={save.isPending}>
              Enregistrer la grille
            </Btn>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Composantes salariales</p>
            <div className="flex gap-2">
              <button onClick={() => setComponents(p => [...p, { type: "GAIN", label: "", code: "", amount: 0, isPercent: false, order: p.length, active: true }])}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:underline"><Plus size={12} /> Gain</button>
              <button onClick={() => setComponents(p => [...p, { type: "DEDUCTION", label: "", code: "", amount: 0, isPercent: false, order: p.length, active: true }])}
                className="flex items-center gap-1 text-xs text-red-600 hover:underline"><Plus size={12} /> Retenue</button>
            </div>
          </div>
          {components.map((comp, i) => (
            <div key={i} className={`grid gap-2 grid-cols-2 sm:grid-cols-5 items-end border rounded-xl p-3 ${comp.type === "GAIN" ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/30" : "border-red-200 bg-red-50/30 dark:border-red-900/30"}`}>
              <F label="Libellé" value={comp.label ?? ""} onChange={v => setComponents(p => p.map((x, j) => j === i ? { ...x, label: v } : x))} />
              <F label="Code" value={comp.code ?? ""} onChange={v => setComponents(p => p.map((x, j) => j === i ? { ...x, code: v } : x))} />
              <F label={comp.isPercent ? "%" : "Montant MGA"} type="number" value={String(comp.amount ?? 0)} onChange={v => setComponents(p => p.map((x, j) => j === i ? { ...x, amount: Number(v) } : x))} />
              <Check label="En %" checked={comp.isPercent ?? false} onChange={v => setComponents(p => p.map((x, j) => j === i ? { ...x, isPercent: v } : x))} />
              <button onClick={() => setComponents(p => p.filter((_, j) => j !== i))} className="p-1.5 text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
            </div>
          ))}
          {components.length > 0 && (
            <div className="rounded-xl border bg-muted/30 p-3 space-y-1">
              <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>RÉCAPITULATIF</span>
              </div>
              {components.filter(c => c.type === "GAIN").map((c, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-emerald-700">+ {c.label || "Gain"}</span>
                  <span className="font-medium text-emerald-700">{c.isPercent ? `${c.amount}% du salaire de base` : fmt(c.amount ?? 0)}</span>
                </div>
              ))}
              {components.filter(c => c.type === "DEDUCTION").map((c, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-red-600">− {c.label || "Retenue"}</span>
                  <span className="font-medium text-red-600">{c.isPercent ? `${c.amount}%` : fmt(c.amount ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Configurez une grille salariale pour chaque poste. Les montants sont entièrement configurables.</p>
      {isLoading ? <Spinner /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {positions.map(pos => {
            const grid = grids.find(g => g.positionId === pos.id);
            return (
              <div key={pos.id} className="rounded-2xl border bg-card p-4 space-y-2 hover:border-primary/40 transition-colors cursor-pointer"
                onClick={() => {
                  const g = grid ?? { id: "", positionId: pos.id, currency: "MGA", position: pos, components: [] };
                  setSelected(g as HrSalaryGrid);
                  setComponents(g.components ?? []);
                }}>
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-sm">{pos.title}</p>
                  {grid ? <ActiveBadge v label={`${grid.components.length} compo.`} /> : <span className="text-xs text-muted-foreground">Aucune grille</span>}
                </div>
                {grid && (
                  <div className="text-xs text-muted-foreground">
                    {grid.components.filter(c => c.type === "GAIN").length} gain(s) · {grid.components.filter(c => c.type === "DEDUCTION").length} retenue(s)
                  </div>
                )}
              </div>
            );
          })}
          {positions.length === 0 && <div className="col-span-3 text-center py-8 text-muted-foreground text-sm">Aucun poste configuré — créez des postes dans l'onglet Postes</div>}
        </div>
      )}
    </div>
  );
}

// ─── Leaves ───────────────────────────────────────────────────────────────────

function LeavesTab() {
  const qc = useQueryClient();
  const { data: leaveTypes = [] } = useQuery<HrLeaveType[]>({ queryKey: ["hr-leave-types"], queryFn: () => api(hr("/leave-types")), staleTime: 5 * 60 * 1000 });
  const { data: employeesRes2 } = useQuery<{ data: HrEmployee[] }>({ queryKey: ["hr-employees", "limit=200"], queryFn: () => api(hr("/employees?limit=200")), staleTime: 5 * 60 * 1000 });
  const employees2 = employeesRes2?.data ?? [];
  const [status, setStatus] = useState("PENDING");
  const qs = new URLSearchParams({ limit: "50", ...(status ? { status } : {}) }).toString();
  const { data, isLoading } = useQuery<{ data: HrLeave[] }>({ queryKey: ["hr-leaves", qs], queryFn: () => api(hr(`/leaves?${qs}`)), staleTime: 15 * 1000 });
  const [form, setForm] = useState<Partial<HrLeave> | null>(null);

  const save = useMutation({
    mutationFn: (d: any) => api(hr("/leaves"), { method: "POST", body: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-leaves"] }); setForm(null); toast.success("Congé enregistré"); },
    onError: () => toast.error("Erreur"),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(hr(`/leaves/${id}/status`), { method: "PATCH", body: { status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-leaves"] }); toast.success("Statut mis à jour"); },
    onError: () => toast.error("Erreur"),
  });

  const leaves = data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex gap-2 justify-between flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(LEAVE_STATUS).map(([v, { label }]) => (
            <button key={v} onClick={() => setStatus(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${status === v ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>{label}</button>
          ))}
          <button onClick={() => setStatus("")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${status === "" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>Tous</button>
        </div>
        <Btn onClick={() => setForm({ days: 1 })}><Plus size={13} /> Demande de congé</Btn>
      </div>

      {form !== null && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">Nouvelle demande de congé</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Employé</label>
              <select value={form.employeeId ?? ""} onChange={e => setForm(p => ({ ...p!, employeeId: e.target.value }))} className="sel">
                <option value="">— Choisir —</option>
                {employees2.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Type de congé</label>
              <select value={form.leaveTypeId ?? ""} onChange={e => setForm(p => ({ ...p!, leaveTypeId: e.target.value || undefined }))} className="sel">
                <option value="">— Optionnel —</option>
                {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
              </select>
            </div>
            <F label="Nombre de jours" type="number" value={String(form.days ?? 1)} onChange={v => setForm(p => ({ ...p!, days: Number(v) }))} />
            <F label="Date de début" type="date" value={form.startDate?.slice(0, 10) ?? ""} onChange={v => setForm(p => ({ ...p!, startDate: v }))} />
            <F label="Date de fin" type="date" value={form.endDate?.slice(0, 10) ?? ""} onChange={v => setForm(p => ({ ...p!, endDate: v }))} />
            <F label="Motif" value={form.reason ?? ""} onChange={v => setForm(p => ({ ...p!, reason: v }))} />
          </div>
          <FormActions onCancel={() => setForm(null)} onSave={() => save.mutate(form)} loading={save.isPending} />
        </div>
      )}

      <Card noPad>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 26rem)" }}>
          <table className="w-full text-sm">
            <THead cols={["Employé", "Début", "Fin", "Jours", "Motif", "Statut", "Actions"]} />
            <tbody>
              {isLoading ? <EmptyRow cols={7} loading /> :
              leaves.length === 0 ? <EmptyRow cols={7} label="Aucun congé" /> :
              leaves.map(l => {
                const meta = LEAVE_STATUS[l.status] ?? LEAVE_STATUS.PENDING;
                return (
                  <tr key={l.id} className="border-b hover:bg-muted/20">
                    <Td bold>{l.employee ? `${l.employee.firstName} ${l.employee.lastName}` : "—"}</Td>
                    <Td muted>{format(new Date(l.startDate), "dd/MM/yyyy")}</Td>
                    <Td muted>{format(new Date(l.endDate), "dd/MM/yyyy")}</Td>
                    <Td>{l.days} j</Td>
                    <Td muted>{l.reason ?? "—"}</Td>
                    <td className="px-4 py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${meta.cls}`}>{meta.label}</span></td>
                    <td className="px-4 py-2">
                      {l.status === "PENDING" && (
                        <div className="flex gap-1">
                          <button onClick={() => updateStatus.mutate({ id: l.id, status: "APPROVED" })}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30">
                            <CheckCircle2 size={11} /> Approuver
                          </button>
                          <button onClick={() => updateStatus.mutate({ id: l.id, status: "REFUSED" })}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30">
                            <XCircle size={11} /> Refuser
                          </button>
                        </div>
                      )}
                    </td>
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

// ─── Shared Primitives (same as Finance) ─────────────────────────────────────

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
      {title && <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-3"><p className="text-sm font-semibold">{title}</p>{subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}</div>}
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
