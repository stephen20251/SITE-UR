import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { tokenStore, api } from "../lib/api";
import { erpStore, erpLogout, dashboardPath, type ErpUser, type ErpRole } from "../lib/erp";
import { getSocket, useSocketEvent } from "../lib/socket";
import {
  LayoutDashboard, Users, Building2, BookOpen, GraduationCap,
  CreditCard, FileText, Bell, LogOut, Menu, X, ChevronRight,
  School, UserCheck, BarChart3, Calendar, ClipboardList, Megaphone, MessageSquare,
} from "lucide-react";

export const Route = createFileRoute("/erp")({
  component: ErpLayout,
});

type NavItem = { label: string; path: string; icon: React.ReactNode; perm?: string };

function getNav(systemRole: string, roleName: string): NavItem[] {
  const annonces = { label: "Annonces", path: "annonces", icon: <Megaphone size={18} /> };
  const chat = { label: "Messages", path: "chat", icon: <MessageSquare size={18} /> };
  const base = [{ label: "Tableau de bord", path: "", icon: <LayoutDashboard size={18} /> }];

  if (systemRole === "SUPER_ADMIN") return [
    ...base,
    { label: "Utilisateurs",    path: "admin/users",      icon: <Users size={18} /> },
    { label: "Structure",       path: "admin/structure",  icon: <Building2 size={18} /> },
    { label: "Rôles & Droits",  path: "admin/roles",      icon: <UserCheck size={18} /> },
    { label: "Promotions",      path: "admin/promotions", icon: <School size={18} /> },
    { label: "Statistiques",    path: "admin/stats",      icon: <BarChart3 size={18} /> },
    chat, annonces,
  ];

  if (systemRole === "TEACHER") return [
    ...base,
    { label: "Mes cours",         path: "enseignant",                   icon: <BookOpen size={18} /> },
    { label: "Notes",             path: "enseignant/notes",             icon: <ClipboardList size={18} /> },
    { label: "Appel",             path: "enseignant/appel",             icon: <UserCheck size={18} /> },
    { label: "Mes disponibilités",path: "planning/disponibilites",      icon: <Calendar size={18} /> },
    { label: "Mon planning",      path: "planning",                     icon: <LayoutDashboard size={18} /> },
    chat, annonces,
  ];

  if (systemRole === "STUDENT") return [
    ...base,
    { label: "Mes cours",       path: "etudiant",          icon: <BookOpen size={18} /> },
    { label: "Notes & Bulletin",path: "etudiant/notes",    icon: <ClipboardList size={18} /> },
    { label: "Emploi du temps", path: "planning",          icon: <Calendar size={18} /> },
    { label: "Paiements",       path: "etudiant/paiements",icon: <CreditCard size={18} /> },
    chat, annonces,
  ];

  if (systemRole === "PARENT") return [
    ...base,
    { label: "Mon enfant",      path: "parent",            icon: <GraduationCap size={18} /> },
    { label: "Notes",           path: "parent/notes",      icon: <ClipboardList size={18} /> },
    { label: "Paiements",       path: "parent/paiements",  icon: <CreditCard size={18} /> },
    chat, annonces,
  ];

  if (systemRole === "CANDIDATE") return [
    ...base,
    { label: "Ma candidature",  path: "candidat",          icon: <FileText size={18} /> },
    annonces,
  ];

  // STAFF roles
  if (roleName.includes("Chef de Mention")) return [
    ...base,
    { label: "Cours",            path: "chef-mention",             icon: <BookOpen size={18} /> },
    { label: "Emplois du temps", path: "planning",                 icon: <Calendar size={18} /> },
    { label: "Enseignants",      path: "chef-mention/enseignants", icon: <Users size={18} /> },
    { label: "Statistiques",     path: "chef-mention/stats",       icon: <BarChart3 size={18} /> },
    chat, annonces,
  ];

  if (roleName.includes("Responsable Pédagogique")) return [
    ...base,
    { label: "Matières",        path: "resp-peda",              icon: <BookOpen size={18} /> },
    { label: "Promotions",      path: "resp-peda/promotions",   icon: <School size={18} /> },
    { label: "Notes",           path: "resp-peda/notes",        icon: <ClipboardList size={18} /> },
    { label: "Examens",         path: "resp-peda/examens",      icon: <FileText size={18} /> },
    chat, annonces,
  ];

  if (roleName.includes("Secrétaire")) return [
    ...base,
    { label: "Candidatures",    path: "secretaire",              icon: <FileText size={18} /> },
    { label: "Étudiants",       path: "secretaire/etudiants",    icon: <GraduationCap size={18} /> },
    { label: "Attestations",    path: "secretaire/attestations", icon: <UserCheck size={18} /> },
    chat, annonces,
  ];

  if (roleName.includes("Comptabilité")) return [
    ...base,
    { label: "Tableau de bord", path: "finance",                icon: <BarChart3 size={18} /> },
    { label: "Factures",        path: "finance/factures",       icon: <FileText size={18} /> },
    { label: "Paiements",       path: "finance/paiements",      icon: <CreditCard size={18} /> },
    { label: "Rapports",        path: "finance/rapports",       icon: <BarChart3 size={18} /> },
    chat, annonces,
  ];

  return [...base, chat, annonces];
}

export function useErpAuth() {
  const [user, setUser] = useState<ErpUser | null>(null);
  const [roles, setRoles] = useState<ErpRole[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = tokenStore.getUser();
    if (raw) setUser(raw as unknown as ErpUser);
    setRoles(erpStore.getRoles());
    setReady(true);
  }, []);

  return { user, roles, ready };
}

function ErpLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, roles, ready } = useErpAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);

  // Load initial unread count
  useEffect(() => {
    if (!ready || !user) return;
    api<{ id: string; unread: number }[]>("/erp-chat/rooms")
      .then((rooms) => setChatUnread(rooms.reduce((s, r) => s + r.unread, 0)))
      .catch(() => {});
    getSocket(); // ensure socket connects
  }, [ready, user]);

  // Real-time: bump badge on any incoming chat notify
  useSocketEvent<{ roomId: string }>("chat:notify", () => {
    if (!location.pathname.startsWith("/erp/chat")) setChatUnread((n) => n + 1);
  });

  // Clear badge when entering chat
  useEffect(() => {
    if (location.pathname.startsWith("/erp/chat")) setChatUnread(0);
  }, [location.pathname]);

  useEffect(() => {
    if (!ready) return;
    if (!user) { navigate({ to: "/erp/login" }); return; }
    // Redirect ERP online users away
    if (user.systemRole === "STUDENT_ONLINE" || user.systemRole === "TEACHER_ONLINE") {
      navigate({ to: "/online" });
    }
  }, [ready, user]);

  // On the login page, render the outlet directly (no layout/auth needed)
  const isLoginPage = location.pathname === "/erp/login";
  if (isLoginPage) return <Outlet />;

  if (!ready || !user) return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0F1E3C] border-t-[#FFD166]" />
    </div>
  );

  const roleName = roles[0]?.roleName ?? "";
  const navItems = getNav(user.systemRole, roleName);
  const scope = roles[0]?.scope;

  const handleLogout = async () => {
    await erpLogout();
    navigate({ to: "/erp/login" });
  };

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-[#0F1E3C] transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFD166]">
            <GraduationCap size={20} className="text-[#0F1E3C]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Université Références</p>
            <p className="text-[10px] text-white/50">Système ERP</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-white/50 lg:hidden">
            <X size={18} />
          </button>
        </div>

        {/* User card */}
        <div className="mx-3 mt-4 rounded-xl bg-white/[0.06] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFD166] text-xs font-bold text-[#0F1E3C]">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.firstName} {user.lastName}</p>
              <p className="truncate text-[11px] text-[#FFD166]/80">{roleName || user.systemRole}</p>
              {scope?.mentionName && (
                <p className="truncate text-[10px] text-white/40">{scope.mentionName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const fullPath = `/erp/${item.path}`;
            const isActive = location.pathname === fullPath || (item.path === "" && location.pathname === "/erp");
            return (
              <Link
                key={item.path}
                to={fullPath}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                  isActive
                    ? "bg-[#FFD166] font-semibold text-[#0F1E3C]"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.icon}
                {item.label}
                {item.path === "chat" && chatUnread > 0 && !isActive && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {chatUnread > 99 ? "99+" : chatUnread}
                  </span>
                )}
                {isActive && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-white/10 p-3 space-y-1">
          <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/50 hover:text-white/80 transition-colors">
            <School size={16} />
            Accueil université
          </Link>
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header className="flex h-14 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500 lg:hidden">
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <Link to="/erp/chat" className="relative text-gray-500 hover:text-[#0F1E3C] transition-colors">
            <MessageSquare size={20} />
            {chatUnread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                {chatUnread > 9 ? "9+" : chatUnread}
              </span>
            )}
          </Link>
          <button className="relative text-gray-500 hover:text-gray-700">
            <Bell size={20} />
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">3</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F1E3C] text-xs font-bold text-[#FFD166]">
              {initials}
            </div>
            <span className="hidden text-sm font-medium text-gray-700 sm:block">{user.firstName}</span>
          </div>
        </header>

        {/* Content — chat takes full height with no padding */}
        <main className={`flex-1 overflow-auto ${location.pathname.startsWith("/erp/chat") ? "" : "p-4 lg:p-6"}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
