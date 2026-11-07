import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { Plus, Loader2, Search, Users, X, Eye, EyeOff, UserCheck, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  useAdminUsers, useCreateUser, useAdminRoles,
  SYSTEM_ROLE_META, type SystemRole, type AdminUser,
} from "@/lib/config";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/classroom/config/utilisateurs")({ component: UtilisateursPage });

const inp = "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition";

const SYSTEM_ROLES: SystemRole[] = ["SUPER_ADMIN", "STAFF", "TEACHER", "STUDENT", "PARENT", "CANDIDATE"];

// ─── User row ─────────────────────────────────────────────────────────────────

function UserRow({ user }: { user: AdminUser }) {
  const meta = SYSTEM_ROLE_META[user.systemRole] ?? { label: user.systemRole, color: "bg-muted text-muted-foreground" };
  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/30 transition-colors">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full grad-classroom text-xs font-bold text-white">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{user.firstName} {user.lastName}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail size={10} />
          <span className="truncate">{user.email}</span>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
          {meta.label}
        </span>
        {user.userRoles.slice(0, 1).map((ur) => (
          <span key={ur.role.id}
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border"
            style={{ color: ur.role.color, borderColor: ur.role.color + "40", backgroundColor: ur.role.color + "15" }}
          >
            {ur.role.name}
          </span>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-gray-300"}`} title={user.isActive ? "Actif" : "Inactif"} />
        {user.lastLoginAt && (
          <span className="hidden text-[10px] text-muted-foreground lg:block">
            {format(new Date(user.lastLoginAt), "d MMM", { locale: fr })}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateUser();
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    systemRole: "TEACHER" as SystemRole, password: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const user = await create.mutateAsync({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        systemRole: form.systemRole,
        password: form.password,
        phone: form.phone || undefined,
      });
      toast.success(`Compte créé : ${user.firstName} ${user.lastName}`);
      onClose();
    } catch {
      toast.error("Erreur lors de la création du compte");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="animate-in zoom-in-95 duration-200 w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-bold">Nouvel utilisateur</h2>
            <p className="text-xs text-muted-foreground">Un email de confirmation sera envoyé</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Prénom *</label>
              <input className={inp} placeholder="Jean" value={form.firstName} required
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nom *</label>
              <input className={inp} placeholder="RAKOTO" value={form.lastName} required
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email *</label>
            <input type="email" className={inp} placeholder="jean.rakoto@ur.mg" value={form.email} required
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Téléphone</label>
            <input className={inp} placeholder="+261 34 00 000 00" value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Rôle système *</label>
            <div className="grid grid-cols-3 gap-2">
              {SYSTEM_ROLES.map((r) => {
                const m = SYSTEM_ROLE_META[r];
                return (
                  <label key={r} className={`flex cursor-pointer items-center gap-1.5 rounded-xl border p-2 text-xs transition-all ${form.systemRole === r ? "border-classroom bg-classroom/5 font-semibold" : "hover:bg-accent"}`}>
                    <input type="radio" className="sr-only" value={r} checked={form.systemRole === r}
                      onChange={() => setForm((f) => ({ ...f, systemRole: r }))} />
                    <span className={`inline-block h-2 w-2 rounded-full ${m.color.split(" ")[0]}`} />
                    {m.label}
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Mot de passe *</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                className={inp + " pr-10"}
                placeholder="Min. 8 caractères"
                value={form.password}
                required
                minLength={8}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
              <button type="button" onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-accent">Annuler</button>
            <button type="submit" disabled={create.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl grad-classroom py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
              Créer le compte
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function UtilisateursPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const debounce = useCallback((value: string) => {
    setDebouncedSearch(value);
    setPage(1);
  }, []);

  const { data, isLoading } = useAdminUsers({ search: debouncedSearch, page, limit: 15 });
  const { data: roles } = useAdminRoles();

  const totalPages = data ? Math.ceil(data.total / 15) : 1;

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    clearTimeout((window as any).__searchTimer);
    (window as any).__searchTimer = setTimeout(() => debounce(e.target.value), 350);
  }

  // Count by role
  const roleCounts = SYSTEM_ROLES.reduce((acc, r) => {
    acc[r] = 0;
    return acc;
  }, {} as Record<SystemRole, number>);

  return (
    <div className="space-y-5">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {SYSTEM_ROLES.map((r, i) => {
          const m = SYSTEM_ROLE_META[r];
          return (
            <div
              key={r}
              className="animate-in fade-in slide-in-from-bottom-2 duration-400 rounded-2xl border bg-card p-3 shadow-elegant text-center"
              style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
            >
              <p className="text-xl font-bold">—</p>
              <p className={`mt-0.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${m.color}`}>{m.label}</p>
            </div>
          );
        })}
      </div>

      {/* Rôles métier */}
      {roles && (
        <div className="rounded-2xl border bg-card p-4 shadow-elegant">
          <h3 className="mb-3 text-sm font-semibold">Rôles métier</h3>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <div key={role.id} className="flex items-center gap-2 rounded-xl border px-3 py-1.5"
                style={{ borderColor: role.color + "40", backgroundColor: role.color + "10" }}>
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />
                <span className="text-xs font-medium" style={{ color: role.color }}>{role.name}</span>
                <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">{role._count.userRoles}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-classroom/30 transition"
            placeholder="Rechercher par nom ou email…"
            value={search}
            onChange={handleSearch}
          />
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl grad-classroom px-4 py-2 text-sm font-semibold text-white shadow-elegant"
        >
          <Plus size={16} /> Nouvel utilisateur
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-card shadow-elegant overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-classroom" />
            <span className="text-sm font-semibold">
              {data?.total ?? 0} utilisateur{(data?.total ?? 0) > 1 ? "s" : ""}
            </span>
          </div>
          {data && data.total > 15 && (
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="rounded-lg border px-2 py-1 text-xs disabled:opacity-40 hover:bg-accent">←</button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="rounded-lg border px-2 py-1 text-xs disabled:opacity-40 hover:bg-accent">→</button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (data?.users.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Users className="mb-3 h-9 w-9 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div>
            {data!.users.map((user) => <UserRow key={user.id} user={user} />)}
          </div>
        )}
      </div>

      {creating && <CreateUserDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
