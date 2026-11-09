// @refresh reset
import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth, primaryRoleName } from "@/lib/auth";
import type { LucideProps } from "lucide-react";
import {
  LayoutDashboard, BookOpen, ClipboardList, UserCheck, Calendar,
  CreditCard, FileText, BarChart3, GraduationCap, Megaphone,
  MessageSquare, LogOut, Menu, X, ChevronRight, School, Bell,
  TrendingUp, CalendarDays, FolderOpen, UserCircle, Settings, PenLine,
  UserPlus, Users, CheckSquare, ListChecks, Wallet, ClipboardCheck, Tag, PartyPopper, Award, Newspaper,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { useClearUserCache, useMyContext } from "@/lib/context";
import { useErpUnreadCount } from "@/lib/chat";
import { BackHomeButtons } from "@/components/nav-buttons";
import { displayRoleName, isFinanceRole, isMentionResponsible, isPresenceRole } from "@/components/classroom/shared";
import { API_ORIGIN } from "@/lib/env";

const API_URL = API_ORIGIN;

export const Route = createFileRoute("/classroom")({ component: ClassroomLayout });

type NavItem = {
  label: string;
  path: string;
  Icon: React.ComponentType<LucideProps>;
};

function buildNav(systemRole: string, roleName: string): NavItem[] {
  const notifs   : NavItem = { label: "Notifications",  path: "notifications",         Icon: Bell };
  const annonces : NavItem = { label: "Annonces",        path: "announcements",          Icon: Megaphone };
  const chat     : NavItem = { label: "Messages",        path: "chat",                   Icon: MessageSquare };
  const faculty  : NavItem = { label: "Corps enseignant", path: "corps-enseignant",      Icon: Award };

  if (systemRole === "STUDENT") return [
    { label: "Tableau de bord", path: "student",   Icon: LayoutDashboard },
    { label: "Mes cours",       path: "cursus",    Icon: GraduationCap },
    { label: "Emploi du temps", path: "timetable", Icon: Calendar },
    { label: "Mes notes",       path: "notes",     Icon: TrendingUp },
    { label: "Présences",       path: "presences", Icon: CalendarDays },
    { label: "Mon bulletin",    path: "bulletin",  Icon: FileText },
    { label: "Documents",       path: "documents", Icon: FolderOpen },
    { label: "Paiements",       path: "finance",   Icon: CreditCard },
    faculty, chat, annonces, notifs,
  ];
  if (systemRole === "TEACHER") return [
    { label: "Tableau de bord",    path: "teacher",                 Icon: LayoutDashboard },
    { label: "Mes cours",          path: "mes-cours",               Icon: BookOpen },
    { label: "Emploi du temps",    path: "timetable",               Icon: Calendar },
    { label: "Mes disponibilités", path: "planning/disponibilites", Icon: UserCheck },
    { label: "Mon CV et mon profil", path: "profile",               Icon: FileText },
    chat, annonces, notifs,
  ];
  if (systemRole === "PARENT") return [
    { label: "Tableau de bord", path: "parent",  Icon: LayoutDashboard },
    { label: "Paiements",       path: "finance", Icon: CreditCard },
    faculty, chat, annonces, notifs,
  ];
  if (systemRole === "CANDIDATE") return [
    { label: "Ma candidature", path: "candidat", Icon: FileText },
    annonces, notifs,
  ];
  if (systemRole === "SUPER_ADMIN") return [
    { label: "Tableau de bord",       path: "admin",          Icon: LayoutDashboard },
    { label: "Utilisateurs",          path: "utilisateurs",   Icon: Users },
    { label: "Années universitaires", path: "annees",         Icon: Calendar },
    { label: "Configuration",         path: "config",         Icon: ClipboardList },
    { label: "Candidatures",          path: "candidatures",   Icon: FileText },
    { label: "Actualités",            path: "actualites",     Icon: Newspaper },
    { label: "Événements",            path: "evenements",     Icon: PartyPopper },
    { label: "Corps enseignant",      path: "corps-enseignant", Icon: Award },
    { label: "Inscriptions",          path: "inscription",    Icon: UserPlus },
    { label: "Cursus universitaire",  path: "cursus-plan",    Icon: GraduationCap },
    { label: "Validation des cours",  path: "validation-cours", Icon: CheckSquare },
    { label: "Suivi des cours",       path: "suivi-cours",    Icon: ListChecks },
    { label: "Présences",             path: "appel",          Icon: ClipboardCheck },
    { label: "Écolage",               path: "ecolage",        Icon: Wallet },
    { label: "Guichet écolage",       path: "guichet",        Icon: Wallet },
    { label: "Tarifs & packs",        path: "tarifs",         Icon: Tag },
    { label: "Affectation des matières", path: "affectation",    Icon: Users },
    { label: "Notes",                 path: "notes",          Icon: TrendingUp },
    { label: "Emplois du temps",      path: "planning",       Icon: BookOpen },
    { label: "Documents",             path: "documents",      Icon: FolderOpen },
    { label: "Lettres",               path: "letters",        Icon: PenLine },
    { label: "Cartes",                path: "cards",          Icon: CreditCard },
    { label: "Designer",              path: "designer",       Icon: PenLine },
    { label: "Bulletins",             path: "bulletin",       Icon: FileText },
    { label: "Finance Étudiante",     path: "finance",        Icon: BarChart3 },
    { label: "Personnel",             path: "rh",             Icon: Users },
    { label: "Gestion des Salaires",  path: "salaires",       Icon: CreditCard },
    chat, annonces, notifs,
  ];
  // Responsable Présence : appel et suivi des séances
  if (isPresenceRole(roleName)) return [
    { label: "Présences",            path: "appel",        Icon: ClipboardCheck },
    { label: "Suivi des cours",      path: "suivi-cours",  Icon: ListChecks },
    chat, annonces, notifs,
  ];
  // Responsable Pédagogique (fusion Chef de Mention + Responsable Pédagogique)
  if (isMentionResponsible(roleName)) return [
    { label: "Tableau de bord",      path: "chef-mention", Icon: LayoutDashboard },
    { label: "Cursus universitaire", path: "cursus-plan",  Icon: GraduationCap },
    { label: "Validation des cours", path: "validation-cours", Icon: CheckSquare },
    { label: "Suivi des cours",      path: "suivi-cours",  Icon: ListChecks },
    { label: "Affectation des matières", path: "affectation",  Icon: Users },
    { label: "Emplois du temps",     path: "planning",     Icon: Calendar },
    { label: "Notes",                path: "notes",        Icon: TrendingUp },
    { label: "Documents",            path: "documents",    Icon: FolderOpen },
    { label: "Lettres",              path: "letters",      Icon: PenLine },
    { label: "Bulletins",            path: "bulletin",     Icon: FileText },
    chat, annonces, notifs,
  ];
  // Secrétaire : inscriptions, présences, suivi des cours (plus de personnel / salaires)
  if (roleName.includes("Secrétaire") || roleName.includes("Administration")) return [
    { label: "Tableau de bord",      path: "secretaire",  Icon: LayoutDashboard },
    { label: "Candidatures",         path: "candidatures", Icon: FileText },
    { label: "Inscriptions",         path: "inscription", Icon: UserPlus },
    { label: "Guichet écolage",      path: "guichet",     Icon: Wallet },
    { label: "Présences",            path: "appel",       Icon: ClipboardCheck },
    { label: "Suivi des cours",      path: "suivi-cours", Icon: ListChecks },
    { label: "Documents",            path: "documents",   Icon: FolderOpen },
    { label: "Lettres",              path: "letters",     Icon: PenLine },
    { label: "Cartes",               path: "cards",       Icon: CreditCard },
    { label: "Événements",           path: "evenements",  Icon: PartyPopper },
    chat, annonces, notifs,
  ];
  // Comptabilité : écolage, finance, personnel et salaires
  if (isFinanceRole(roleName)) return [
    { label: "Tableau de bord",      path: "comptabilite",  Icon: LayoutDashboard },
    { label: "Écolage",              path: "ecolage",       Icon: Wallet },
    { label: "Finance Étudiante",    path: "finance",       Icon: BarChart3 },
    { label: "Personnel",            path: "rh",            Icon: Users },
    { label: "Gestion des Salaires", path: "salaires",      Icon: CreditCard },
    chat, annonces, notifs,
  ];
  return [
    { label: "Tableau de bord", path: "admin", Icon: LayoutDashboard },
    chat, annonces, notifs,
  ];
}

function ClassroomLayout() {
  const { user, roles, ready, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [profileOpen,  setProfileOpen]  = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // ALL hooks must be before any conditional return
  const clearCache  = useClearUserCache();
  const ctx         = useMyContext();
  const chatUnread  = useErpUnreadCount(ready && !!user);

  const isLoginPage = location.pathname === "/classroom" || location.pathname === "/classroom/";

  useEffect(() => {
    // Le layout peut encore être monté pendant qu'on quitte /classroom (ex. bouton
    // « Retour » vers /choice) : on ne protège que les pages /classroom/…
    if (!ready || isLoginPage || !location.pathname.startsWith("/classroom/")) return;
    const isOnline = user?.systemRole === "STUDENT_ONLINE" || user?.systemRole === "TEACHER_ONLINE";
    if (!user || isOnline) navigate({ to: "/classroom" });
  }, [ready, user, isLoginPage]);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (isLoginPage) return <Outlet />;

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-classroom border-t-transparent" />
      </div>
    );
  }

  const roleName    = primaryRoleName(roles);
  const scope       = roles[0]?.scope;
  const navItems    = buildNav(user.systemRole, roleName);
  const initials    = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  const displayRole = displayRoleName(roleName) || user.systemRole.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  const avatarUrl   = (ctx.data?.user as { avatarUrl?: string | null } | undefined)?.avatarUrl ?? user.avatarUrl ?? null;

  const handleLogout = async () => {
    clearCache();   // wipe TanStack Query cache before clearing tokens
    await logout();
    navigate({ to: "/classroom" });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex h-full w-64 flex-col bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transition-transform duration-300 lg:static lg:h-screen lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl grad-classroom">
            <GraduationCap size={19} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900 dark:text-white">Université Références</p>
            <p className="text-[10px] text-muted-foreground">Système Classroom</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-muted-foreground lg:hidden">
            <X size={18} />
          </button>
        </div>

        {/* User card */}
        <div className="mx-3 mt-4 rounded-xl border border-classroom/10 bg-classroom/5 p-3 dark:bg-classroom/10">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl.startsWith("http") ? avatarUrl : `${API_URL}${avatarUrl}`} alt={initials} className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full grad-classroom text-xs font-bold text-white">{initials}</div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-[11px] font-medium text-classroom">{displayRole}</p>
              {scope?.mentionName && (
                <p className="truncate text-[10px] text-muted-foreground">{scope.mentionName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {navItems.map((item, i) => {
            const fullPath = `/classroom/${item.path}`;
            const isActive = location.pathname === fullPath || location.pathname.startsWith(fullPath + "/");
            return (
              <Link
                key={`${item.path}-${i}`}
                to={fullPath}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                  isActive
                    ? "bg-classroom text-white font-semibold shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                }`}
              >
                <item.Icon size={18} />
                {item.label}
                {isActive && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="space-y-1 border-t border-gray-100 p-3 dark:border-gray-800">
          {/* Super admin : accès à l'administration de la plateforme en ligne */}
          {user.systemRole === "SUPER_ADMIN" && (
            <Link
              to="/online/admin"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-classroom transition-colors hover:bg-classroom/10"
            >
              <Settings size={16} />
              Admin plateforme en ligne
            </Link>
          )}
          <Link
            to="/classroom/profile"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-gray-700 dark:hover:text-gray-300"
          >
            <UserCircle size={16} />
            Mon profil
          </Link>
          <Link
            to="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-gray-700 dark:hover:text-gray-300"
          >
            <School size={16} />
            Accueil
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Topbar ───────────────────────────────────────── */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground lg:hidden">
            <Menu size={20} />
          </button>
          <BackHomeButtons home={`/classroom/${navItems[0]?.path ?? "admin"}`} />
          <div className="flex-1" />

          {/* Chat icon with unread badge */}
          <Link to="/classroom/chat" className="relative grid h-9 w-9 place-items-center rounded-lg border hover:bg-accent transition-colors text-muted-foreground hover:text-classroom">
            <MessageSquare className="h-4 w-4" />
            {chatUnread > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-classroom px-1 text-[10px] font-bold text-white leading-none">
                {chatUnread > 9 ? "9+" : chatUnread}
              </span>
            )}
          </Link>

          {/* Notification bell */}
          <NotificationBell />

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl border px-2 py-1 hover:bg-accent transition-colors"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl.startsWith("http") ? avatarUrl : `${API_URL}${avatarUrl}`}
                  alt={initials}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full grad-classroom text-[11px] font-bold text-white">
                  {initials}
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">{user.firstName}</p>
                <p className="text-[10px] text-muted-foreground leading-tight truncate max-w-[100px]">{displayRole}</p>
              </div>
              <ChevronRight size={12} className={`hidden sm:block shrink-0 text-muted-foreground transition-transform ${profileOpen ? "rotate-90" : ""}`} />
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border bg-card shadow-elegant">
                  {/* User card */}
                  <div className="border-b p-4">
                    <div className="flex items-center gap-3">
                      {avatarUrl ? (
                        <img src={avatarUrl.startsWith("http") ? avatarUrl : `${API_URL}${avatarUrl}`} alt={initials} className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full grad-classroom text-sm font-bold text-white">{initials}</div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{user.firstName} {user.lastName}</p>
                        <p className="truncate text-xs text-classroom font-medium">{displayRole}</p>
                        {scope?.mentionName && <p className="truncate text-[10px] text-muted-foreground">{scope.mentionName}</p>}
                      </div>
                    </div>
                  </div>
                  {/* Menu items */}
                  <div className="p-1.5 space-y-0.5">
                    <Link to="/classroom/profile" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-accent transition-colors dark:text-gray-300">
                      <UserCircle size={15} /> Mon profil
                    </Link>
                    <Link to="/" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-accent transition-colors dark:text-gray-300">
                      <School size={15} /> Accueil
                    </Link>
                  </div>
                  <div className="border-t p-1.5">
                    <button onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                      <LogOut size={15} /> Déconnexion
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
