import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Search, Plus, Edit2, Trash2, Lock, Unlock, KeyRound,
  Shield, ChevronDown, Loader2, X, CheckCircle, AlertTriangle,
  UserCircle, GraduationCap, BookOpen, Briefcase, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useRequireClassroom } from "@/components/classroom/shared";

export const Route = createFileRoute("/classroom/utilisateurs")({ component: UtilisateursPage });

// ── Types ──────────────────────────────────────────────────────────────────────

type Role   = { id: string; name: string; color?: string };
type UserRow = {
  id: string; email: string; firstName: string; lastName: string;
  phone?: string | null; systemRole: string; isActive: boolean; avatarUrl?: string | null;
  createdAt: string;
  userRoles: { role: Role; mention?: { name: string } | null }[];
  studentProfile?: { matricule: string; status: string; mention?: { name: string } } | null;
  teacherProfile?: { employeeId?: string; specialization?: string } | null;
  staffProfile?: { employeeId?: string } | null;
};
type Page = { total: number; page: number; limit: number; users: UserRow[] };
type RoleItem = { id: string; name: string; color?: string | null; description?: string | null };

// ── Constants ──────────────────────────────────────────────────────────────────

const SYSTEM_ROLES: { value: string; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin",   icon: <Shield size={13} />,        color: "text-red-600 bg-red-50 border-red-200" },
  { value: "STAFF",       label: "Personnel admin", icon: <Briefcase size={13} />,   color: "text-purple-600 bg-purple-50 border-purple-200" },
  { value: "TEACHER",     label: "Enseignant",    icon: <BookOpen size={13} />,       color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { value: "STUDENT",     label: "Étudiant",      icon: <GraduationCap size={13} />, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "PARENT",      label: "Parent",         icon: <Users size={13} />,         color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "CANDIDATE",   label: "Candidat",      icon: <UserCircle size={13} />,    color: "text-gray-600 bg-gray-50 border-gray-200" },
];

function roleColor(sysRole: string) {
  return SYSTEM_ROLES.find((r) => r.value === sysRole)?.color ?? "text-gray-600 bg-gray-50 border-gray-200";
}
function roleLabel(sysRole: string) {
  return SYSTEM_ROLES.find((r) => r.value === sysRole)?.label ?? sysRole;
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useUsers(search: string, systemRole: string, page: number) {
  const qs = new URLSearchParams({ page: String(page), limit: "20" });
  if (search)     qs.set("search", search);
  if (systemRole) qs.set("systemRole", systemRole);
  return useQuery<Page>({
    queryKey: ["admin-users", search, systemRole, page],
    queryFn: () => api<Page>(`/admin/users?${qs}`),
    placeholderData: (prev) => prev,
  });
}

function useRoles() {
  return useQuery<RoleItem[]>({
    queryKey: ["admin-roles"],
    queryFn: () => api<RoleItem[]>("/admin/roles"),
  });
}

// ── Empty form ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  firstName: "", lastName: "", email: "", phone: "",
  systemRole: "STUDENT" as string, password: "",
};

// ── User form modal ────────────────────────────────────────────────────────────

function UserModal({
  user, onClose, onSaved,
}: {
  user: UserRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(user ? {
    firstName: user.firstName, lastName: user.lastName,
    email: user.email, phone: user.phone ?? "",
    systemRole: user.systemRole, password: "",
  } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!form.firstName || !form.lastName || !form.email) { setErr("Nom, prénom et email sont requis"); return; }
    if (!user && !form.password) { setErr("Mot de passe requis pour un nouvel utilisateur"); return; }
    setSaving(true); setErr("");
    try {
      const body: Record<string, string> = {
        firstName: form.firstName, lastName: form.lastName,
        email: form.email, phone: form.phone,
        systemRole: form.systemRole,
      };
      if (form.password) body.password = form.password;
      if (user) {
        await api(`/admin/users/${user.id}`, { method: "PUT", body });
      } else {
        await api("/admin/users", { method: "POST", body });
      }
      toast.success(user ? "Utilisateur mis à jour" : "Utilisateur créé");
      onSaved();
      onClose();
    } catch (e: unknown) { setErr((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold text-lg">{user ? "Modifier l'utilisateur" : "Nouvel utilisateur"}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 14rem)" }}>
          {err && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              <AlertTriangle size={14} className="shrink-0" /> {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prénom *</label>
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-classroom" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-classroom" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={!!user}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-classroom disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-classroom" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rôle système *</label>
            <div className="relative">
              <select value={form.systemRole} onChange={(e) => setForm({ ...form, systemRole: e.target.value })}
                className="w-full appearance-none rounded-xl border px-3 py-2.5 pr-8 text-sm outline-none focus:ring-2 focus:ring-classroom">
                {SYSTEM_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-gray-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {user ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe *"}
            </label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={user ? "••••••••" : ""}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-classroom" />
          </div>
        </div>
        <div className="flex gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Annuler</button>
          <button onClick={save} disabled={saving}
            className="flex-1 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {user ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Role assignment modal ──────────────────────────────────────────────────────

function RoleModal({ user, roles, onClose, onSaved }: { user: UserRow; roles: RoleItem[]; onClose: () => void; onSaved: () => void }) {
  const assigned = new Set(user.userRoles.map((r) => r.role.id));
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(roleId: string) {
    setSaving(roleId);
    try {
      if (assigned.has(roleId)) {
        await api(`/admin/users/${user.id}/roles/${roleId}`, { method: "DELETE" });
        toast.success("Rôle retiré");
      } else {
        await api(`/admin/users/${user.id}/roles`, { method: "POST", body: { roleId } });
        toast.success("Rôle assigné");
      }
      onSaved();
    } catch (e: unknown) { toast.error((e as Error).message); }
    finally { setSaving(null); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold text-lg">Rôles — {user.lastName} {user.firstName}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-6 space-y-2 max-h-96 overflow-y-auto">
          {roles.map((role) => {
            const isOn = assigned.has(role.id);
            return (
              <button key={role.id} onClick={() => toggle(role.id)} disabled={saving === role.id}
                className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all ${
                  isOn ? "border-classroom bg-classroom/5 text-classroom" : "border-gray-100 hover:bg-gray-50"
                }`}>
                <div className="text-left">
                  <div className="font-medium">{role.name}</div>
                  {role.description && <div className="text-xs text-gray-400 mt-0.5">{role.description}</div>}
                </div>
                {saving === role.id ? (
                  <Loader2 size={15} className="animate-spin text-classroom" />
                ) : isOn ? (
                  <CheckCircle size={15} className="text-classroom" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                )}
              </button>
            );
          })}
          {!roles.length && <p className="text-center text-sm text-gray-400 py-4">Aucun rôle configuré</p>}
        </div>
        <div className="border-t px-6 py-4">
          <button onClick={onClose} className="w-full rounded-xl border py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Fermer</button>
        </div>
      </div>
    </div>
  );
}

// ── Reset password modal ───────────────────────────────────────────────────────

function ResetPwdModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function reset() {
    if (!pwd || pwd.length < 8) { toast.error("Mot de passe trop court (8 caractères min)"); return; }
    setSaving(true);
    try {
      await api(`/admin/users/${user.id}/reset-password`, { method: "PUT", body: { newPassword: pwd } });
      setDone(true);
      toast.success("Mot de passe réinitialisé");
    } catch (e: unknown) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold">Réinitialiser le mot de passe</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-2 max-h-96 overflow-y-auto" style={{ maxHeight: "calc(100vh - 14rem)" }}>
          <p className="text-sm text-gray-600">
            Utilisateur : <strong>{user.lastName.toUpperCase()} {user.firstName}</strong>
          </p>
          {done ? (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              <CheckCircle size={15} /> Mot de passe mis à jour avec succès
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nouveau mot de passe</label>
              <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus
                placeholder="8 caractères minimum"
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-classroom" />
            </div>
          )}
        </div>
        <div className="flex gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            {done ? "Fermer" : "Annuler"}
          </button>
          {!done && (
            <button onClick={reset} disabled={saving}
              className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              Réinitialiser
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function UtilisateursPage() {
  const { user, ready } = useRequireClassroom(["SUPER_ADMIN"]);
  const qc = useQueryClient();

  const [search,     setSearch]     = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sysRole,    setSysRole]    = useState("");
  const [page,       setPage]       = useState(1);

  const [editUser,  setEditUser]  = useState<UserRow | null | "new">(null);
  const [roleUser,  setRoleUser]  = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const usersQ = useUsers(debouncedQ, sysRole, page);
  const rolesQ = useRoles();
  const users = usersQ.data?.users ?? [];
  const total  = usersQ.data?.total ?? 0;
  const pages  = Math.ceil(total / 20);

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ["admin-users"] }), [qc]);

  const blockMut = useMutation({
    mutationFn: ({ id, block }: { id: string; block: boolean }) =>
      api(`/admin/users/${id}/${block ? "block" : "unblock"}`, { method: "PUT" }),
    onSuccess: () => { toast.success("Statut mis à jour"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Utilisateur supprimé"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!ready || !user) return null;

  return (
    <div className="space-y-5 pb-10">
      {/* Modals */}
      {editUser !== null && (
        <UserModal
          user={editUser === "new" ? null : editUser}
          onClose={() => setEditUser(null)}
          onSaved={invalidate}
        />
      )}
      {roleUser && rolesQ.data && (
        <RoleModal
          user={roleUser} roles={rolesQ.data}
          onClose={() => setRoleUser(null)}
          onSaved={invalidate}
        />
      )}
      {resetUser && (
        <ResetPwdModal user={resetUser} onClose={() => setResetUser(null)} />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} utilisateur{total !== 1 ? "s" : ""} au total
          </p>
        </div>
        <button onClick={() => setEditUser("new")}
          className="flex items-center gap-2 rounded-xl grad-classroom px-4 py-2.5 text-sm font-semibold text-white shadow-elegant">
          <Plus size={15} /> Nouvel utilisateur
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email…"
            className="w-full rounded-xl border bg-background pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-classroom" />
        </div>
        <div className="relative">
          <select value={sysRole} onChange={(e) => { setSysRole(e.target.value); setPage(1); }}
            className="appearance-none rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm outline-none focus:ring-2 focus:ring-classroom">
            <option value="">— Tous les rôles —</option>
            {SYSTEM_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {SYSTEM_ROLES.map((r) => {
          const count = users.filter((u) => u.systemRole === r.value).length;
          return (
            <button key={r.value}
              onClick={() => { setSysRole(sysRole === r.value ? "" : r.value); setPage(1); }}
              className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all ${
                sysRole === r.value ? r.color + " shadow-sm" : "bg-background hover:bg-muted/50"
              }`}>
              {r.icon}
              <span className="truncate">{r.label}</span>
            </button>
          );
        })}
      </div>

      {/* User table */}
      {usersQ.isLoading ? (
        <div className="flex h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-muted-foreground/40">
          <Users size={40} className="mb-3 opacity-30" />
          <p className="font-medium text-muted-foreground">Aucun utilisateur trouvé</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 26rem)" }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-muted/30 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide backdrop-blur-sm">
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3 hidden md:table-cell">Rôle système</th>
                <th className="px-4 py-3 hidden lg:table-cell">Rôles fonctionnels</th>
                <th className="px-4 py-3 hidden sm:table-cell">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                        {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold">{u.lastName.toUpperCase()} {u.firstName}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                        {u.studentProfile && (
                          <div className="text-[10px] text-blue-600 font-mono">{u.studentProfile.matricule}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${roleColor(u.systemRole)}`}>
                      {roleLabel(u.systemRole)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {u.userRoles.slice(0, 3).map((r) => (
                        <span key={r.role.id} className="rounded-full bg-muted border px-2 py-0.5 text-[10px] font-medium">
                          {r.role.name}
                        </span>
                      ))}
                      {u.userRoles.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{u.userRoles.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      u.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${u.isActive ? "bg-green-500" : "bg-red-500"}`} />
                      {u.isActive ? "Actif" : "Bloqué"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button title="Modifier" onClick={() => setEditUser(u)}
                        className="rounded-lg p-1.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Edit2 size={13} />
                      </button>
                      <button title="Rôles fonctionnels" onClick={() => setRoleUser(u)}
                        className="rounded-lg p-1.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Shield size={13} />
                      </button>
                      <button title="Réinitialiser mot de passe" onClick={() => setResetUser(u)}
                        className="rounded-lg p-1.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <KeyRound size={13} />
                      </button>
                      <button title={u.isActive ? "Bloquer" : "Débloquer"}
                        onClick={() => blockMut.mutate({ id: u.id, block: u.isActive })}
                        className={`rounded-lg p-1.5 transition-colors ${
                          u.isActive ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-green-50 hover:text-green-600"
                        } text-muted-foreground`}>
                        {u.isActive ? <Lock size={13} /> : <Unlock size={13} />}
                      </button>
                      <button title="Supprimer"
                        onClick={() => { if (confirm(`Supprimer ${u.firstName} ${u.lastName} ?`)) deleteMut.mutate(u.id); }}
                        className="rounded-lg p-1.5 hover:bg-red-50 hover:text-red-600 transition-colors text-muted-foreground">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-3">
              <span className="text-xs text-muted-foreground">Page {page} sur {pages} ({total} résultats)</span>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-muted">
                  ← Préc.
                </button>
                <button disabled={page >= pages} onClick={() => setPage(page + 1)}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-muted">
                  Suiv. →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
