import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import React, { useEffect, useState, type ReactNode } from "react";
import {
  GraduationCap, LogOut, X, Menu, MessageSquare, LayoutDashboard,
  BookOpen, User, Shield, ChevronDown, Bell, CheckCircle2, AlertCircle, Award, Crown, Moon, Sun,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/lib/auth";
import { BackHomeButtons } from "@/components/nav-buttons";
import { LogoMark, serif, useSiteTheme } from "@/components/site-layout";
import { usePublicSettings } from "@/lib/lms-admin";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/lib/notifications";
import { useOnlineUnreadCount } from "@/lib/chat";
import { API_ORIGIN } from "@/lib/env";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const initials = (first?: string, last?: string) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "U";

const API_BASE = API_ORIGIN;
function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

// ─── Guard hook ───────────────────────────────────────────────────────────────

/**
 * Client-side guard for ONLINE routes. Redirects unauthenticated users to login
 * and (optionally) bounces users with the wrong role to their own dashboard.
 */
// Étudiants et enseignants de l'université utilisent aussi la plateforme en ligne
// (cursus universitaire + cours certifiants) : ils comptent comme rôles « online ».
export const isHybridUser = (u?: { systemRole?: string } | null) =>
  u?.systemRole === "STUDENT" || u?.systemRole === "TEACHER";
export function effectiveOnlineRole(u?: { role?: string; systemRole?: string } | null) {
  if (u?.systemRole === "STUDENT") return "STUDENT_ONLINE";
  if (u?.systemRole === "TEACHER") return "TEACHER_ONLINE";
  return u?.role;
}

export function useRequireOnline(role?: "TEACHER_ONLINE" | "STUDENT_ONLINE") {
  const { user, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    if (!user || (user.system !== "ONLINE" && !isHybridUser(user) && user.systemRole !== "SUPER_ADMIN")) {
      navigate({ to: "/online/login" });
      return;
    }
    const eff = effectiveOnlineRole(user);
    if (role && eff !== role && user.systemRole !== "SUPER_ADMIN") {
      navigate({ to: eff === "TEACHER_ONLINE" ? "/online/teacher" : "/online/dashboard" });
    }
  }, [ready, user, role, navigate]);

  return { user, ready };
}

// ─── Notification Bell ────────────────────────────────────────────────────────

function fmtRelative(date: string) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
  } catch {
    return "";
  }
}

type NotifStyle = { bg: string; color: string; Icon: React.ElementType };
function getNotifStyle(type: string): NotifStyle {
  switch (type) {
    case "PAYMENT":      return { bg: "bg-green-100 dark:bg-green-900/30",  color: "text-green-600",  Icon: CheckCircle2 };
    case "SUCCESS":      return { bg: "bg-green-100 dark:bg-green-900/30",  color: "text-green-600",  Icon: CheckCircle2 };
    case "GRADE":        return { bg: "bg-purple-100 dark:bg-purple-900/30", color: "text-purple-600", Icon: Award };
    case "ERROR":        return { bg: "bg-red-100 dark:bg-red-900/30",      color: "text-red-600",    Icon: AlertCircle };
    case "WARNING":      return { bg: "bg-amber-100 dark:bg-amber-900/30",  color: "text-amber-600",  Icon: AlertCircle };
    case "ANNOUNCEMENT": return { bg: "bg-blue-100 dark:bg-blue-900/30",    color: "text-blue-600",   Icon: Bell };
    default:             return { bg: "bg-muted",                           color: "text-muted-foreground", Icon: Bell };
  }
}

function NotificationBell() {
  const { data } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();
  const [open, setOpen] = useState(false);
  const unread = data?.unreadCount ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-9 w-9 place-items-center rounded-lg border hover:bg-accent transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-white leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1.5 w-80 overflow-hidden rounded-xl border bg-card shadow-elegant">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="text-sm font-semibold">Notifications</div>
              {unread > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending}
                  className="text-xs text-online hover:underline disabled:opacity-50"
                >
                  Tout marquer lu
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y">
              {(data?.items ?? []).length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Aucune notification
                </div>
              ) : (
                (data?.items ?? []).map((n) => {
                  const style = getNotifStyle(n.type);
                  const Icon = style.Icon;
                  const isUnread = !n.readAt;
                  return (
                    <button
                      key={n.id}
                      onClick={() => { if (isUnread) markOne.mutate(n.id); }}
                      className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors ${isUnread ? "bg-online/5" : ""}`}
                    >
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.bg}`}>
                        <Icon className={`h-3.5 w-3.5 ${style.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-semibold leading-snug ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
                          {n.title}
                        </div>
                        {n.body && (
                          <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                        )}
                        <div className="mt-1 text-[10px] text-muted-foreground/70">{fmtRelative(n.createdAt)}</div>
                      </div>
                      {isUnread && <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-online" />}
                    </button>
                  );
                })
              )}
            </div>
            {(data?.total ?? 0) > (data?.items?.length ?? 0) && (
              <div className="border-t px-4 py-2 text-center text-xs text-muted-foreground">
                {data!.total} notifications au total
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Premium Online Navbar ─────────────────────────────────────────────────────

export function OnlineNavbar() {
  const { user, ready, logout } = useAuth();
  const navigate = useNavigate();
  const { data: settings } = usePublicSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const onlineUnread = useOnlineUnreadCount(!!user);
  const theme = useSiteTheme();
  const themeButton = (
    <button type="button" onClick={theme.toggle}
      aria-label={theme.dark ? "Passer au thème clair" : "Passer au thème sombre"} title={theme.dark ? "Thème clair" : "Thème sombre"}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground">
      {theme.dark ? <Sun className="h-[18px] w-[18px]" strokeWidth={1.5} /> : <Moon className="h-[18px] w-[18px]" strokeWidth={1.5} />}
    </button>
  );

  const isStudent = effectiveOnlineRole(user) === "STUDENT_ONLINE";
  const isTeacher = effectiveOnlineRole(user) === "TEACHER_ONLINE";
  const hybrid = isHybridUser(user);
  const isSuperAdmin = user?.systemRole === "SUPER_ADMIN";
  const dashLink = isTeacher ? "/online/teacher" : "/online/dashboard";

  function isActive(path: string) {
    return pathname === path || pathname.startsWith(path + "/");
  }

  const navLinks = ready && user ? [
    { to: "/online" as const,          label: "Catalogue",  icon: BookOpen,       exact: true },
    { to: dashLink as "/online/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { to: "/online/chat" as const,     label: "Messages",   icon: MessageSquare },
    ...(isStudent && !hybrid ? [
      { to: "/online/subscription" as const, label: "Premium", icon: Crown },
    ] : []),
    { to: "/online/profile" as const, label: "Mon profil", icon: User },
    // Retour à l'espace université (cursus, emploi du temps, notes…)
    ...(hybrid ? [
      { to: (isStudent ? "/classroom/cursus" : "/classroom/mes-cours") as "/online", label: "Espace université", icon: User },
    ] : []),
  ] : [];

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-background/80 backdrop-blur-xl dark:border-white/10">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">

        {/* ── Retour / Accueil ── */}
        <BackHomeButtons home="/online" compact className="hidden sm:flex" />

        {/* ── Logo ── */}
        <Link
          to="/online"
          className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight"
          onClick={() => setMenuOpen(false)}
        >
          <LogoMark className="h-10" />
          <span className="hidden leading-none sm:block">
            <span className="block whitespace-nowrap text-[16px] font-semibold tracking-tight text-foreground" style={serif}>Université Références</span>
            <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.28em] text-online">
              {settings?.platformName && settings.platformName !== "UR Online" ? settings.platformName : "Cours en ligne"}
            </span>
          </span>
        </Link>

        {/* ── Desktop nav links ── */}
        <nav className="hidden flex-1 items-center gap-0.5 md:flex">
          {navLinks.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : isActive(to as string);
            const badge = to === "/online/chat" && onlineUnread > 0 ? onlineUnread : 0;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-online/10 text-online"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {badge > 0 && (
                  <span className="flex min-w-[16px] h-4 items-center justify-center rounded-full bg-online px-0.5 text-[9px] font-bold text-white leading-none">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 md:hidden" />

        {/* ── Right side ── */}
        {ready && user ? (
          <div className="flex items-center gap-2">
            {themeButton}
            {/* Admin badge */}
            {isSuperAdmin && (
              <Link
                to="/online/admin"
                className="hidden items-center gap-1.5 rounded-lg border border-online/30 bg-online/5 px-3 py-1.5 text-xs font-semibold text-online hover:bg-online/10 sm:flex"
              >
                <Shield className="h-3 w-3" /> Admin
              </Link>
            )}
            {isSuperAdmin && (
              <Link
                to="/classroom/admin"
                className="hidden items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-accent sm:flex"
              >
                Administration UR
              </Link>
            )}

            {/* Notification bell */}
            <NotificationBell />

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-2 rounded-xl border bg-card px-2 py-1.5 hover:bg-accent transition-colors"
              >
                <div className="grid h-7 w-7 place-items-center rounded-full grad-online text-[11px] font-bold text-white shadow-sm">
                  {initials(user.firstName, user.lastName)}
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-xs font-semibold leading-none">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground leading-none">
                    {isTeacher ? "Enseignant" : isSuperAdmin ? "Super Admin" : "Étudiant"}
                  </div>
                </div>
                <ChevronDown className={`hidden h-3 w-3 text-muted-foreground transition-transform sm:block ${userMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1.5 w-52 overflow-hidden rounded-xl border bg-card shadow-elegant">
                    <div className="border-b px-4 py-3">
                      <div className="text-sm font-semibold">{user.firstName} {user.lastName}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </div>
                    <div className="p-1">
                      {isStudent && (
                        <Link
                          to="/online/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent"
                        >
                          <User className="h-3.5 w-3.5 text-muted-foreground" /> Mon profil
                        </Link>
                      )}
                      <Link
                        to={dashLink}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent"
                      >
                        <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" /> Tableau de bord
                      </Link>
                      {isSuperAdmin && (
                        <Link
                          to="/online/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent"
                        >
                          <Shield className="h-3.5 w-3.5 text-muted-foreground" /> Admin LMS
                        </Link>
                      )}
                      {isSuperAdmin && (
                        <Link
                          to="/classroom/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent"
                        >
                          <Shield className="h-3.5 w-3.5 text-muted-foreground" /> Administration université
                        </Link>
                      )}
                      <div className="my-1 border-t" />
                      <button
                        onClick={async () => {
                          setUserMenuOpen(false);
                          await logout();
                          navigate({ to: "/online" });
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                      >
                        <LogOut className="h-3.5 w-3.5" /> Déconnexion
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="grid h-9 w-9 place-items-center rounded-lg border hover:bg-accent md:hidden"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {themeButton}
            <Link
              to="/online/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Connexion
            </Link>
            <Link
              to="/online/register"
              className="rounded-full grad-online px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(59,45,143,0.6)] transition hover:-translate-y-px hover:opacity-95"
            >
              S'inscrire
            </Link>
          </div>
        )}
      </div>

      {/* ── Mobile menu ── */}
      {menuOpen && ready && user && (
        <div className="border-t bg-background md:hidden">
          <nav className="flex flex-col gap-0.5 p-3">
            {navLinks.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? pathname === to : isActive(to as string);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active ? "bg-online/10 text-online" : "text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
            {isSuperAdmin && (
              <Link
                to="/online/admin"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-online hover:bg-online/10"
              >
                <Shield className="h-4 w-4" /> Admin LMS
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

/** Legacy alias kept for backward compatibility */
export function OnlineTopbar() {
  return <OnlineNavbar />;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-elegant`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Status pill used across course lists. */
export function StatusPill({ status }: { status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  const map = {
    PUBLISHED: "bg-success/15 text-success",
    DRAFT: "bg-muted text-muted-foreground",
    ARCHIVED: "bg-warning/15 text-warning",
  } as const;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[status]}`}>
      {status.toLowerCase()}
    </span>
  );
}

/** Simple progress bar in the online gradient. */
export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full grad-online transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
