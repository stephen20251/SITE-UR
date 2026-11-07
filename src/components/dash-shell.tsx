import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LogOut, Search } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { BackHomeButtons } from "@/components/nav-buttons";

type Item = { to: string; label: string; icon: ReactNode };

export function DashShell({
  brand,
  brandColor,
  items,
  children,
  user,
  onLogout,
}: {
  brand: string;
  brandColor: "online" | "classroom";
  items: Item[];
  children: ReactNode;
  user: { name: string; role: string };
  onLogout?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5 font-semibold">
          <div className={`grid h-8 w-8 place-items-center rounded-lg text-white ${brandColor === "online" ? "grad-online" : "grad-classroom"}`}>
            <span className="text-xs font-bold">{brand.charAt(0)}</span>
          </div>
          {brand}
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((i) => {
            const active = pathname === i.to;
            return (
              <Link
                key={i.to}
                to={i.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                }`}
              >
                {i.icon}
                {i.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold text-white ${brandColor === "online" ? "grad-online" : "grad-classroom"}`}>
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">{user.role}</div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border hover:bg-accent"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-8">
          <BackHomeButtons home={brandColor === "online" ? "/online" : "/classroom"} compact />
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search..."
              className="h-9 w-full rounded-lg border bg-muted/40 pl-9 pr-3 text-sm outline-none focus:bg-background focus:ring-2 focus:ring-ring"
            />
          </div>
          <NotificationBell />
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>

        <nav className="sticky bottom-0 grid grid-cols-5 border-t bg-background md:hidden">
          {items.slice(0, 5).map((i) => {
            const active = pathname === i.to;
            return (
              <Link key={i.to} to={i.to} className={`flex flex-col items-center gap-1 py-2 text-[10px] ${active ? "text-foreground" : "text-muted-foreground"}`}>
                {i.icon}
                <span className="truncate">{i.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: "online" | "classroom" | "success" | "warning" }) {
  const accentBg =
    accent === "online" ? "grad-online text-white" :
    accent === "classroom" ? "grad-classroom text-white" :
    accent === "success" ? "bg-success text-success-foreground" :
    accent === "warning" ? "bg-warning text-warning-foreground" :
    "bg-muted text-foreground";
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-elegant">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`h-2 w-2 rounded-full ${accentBg}`} />
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
