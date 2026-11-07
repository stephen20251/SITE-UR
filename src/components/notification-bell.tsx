import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, type AppNotification } from "@/lib/notifications";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const TYPE_DOT: Record<string, string> = {
  EXAM_AVAILABLE:    "bg-amber-500",
  RESULTS_READY:     "bg-emerald-500",
  GRADE_PUBLISHED:   "bg-emerald-500",
  COURSE_PUBLISHED:  "bg-blue-500",
  PAYMENT_DUE:       "bg-red-500",
  PAYMENT_RECEIVED:  "bg-emerald-500",
  CHAT_MESSAGE:      "bg-blue-500",
  ANNOUNCEMENT:      "bg-purple-500",
  TIMETABLE_UPDATED: "bg-amber-500",
  ADMISSION_UPDATE:  "bg-classroom",
};

export function NotificationBell() {
  const { user, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const enabled = ready && !!user;
  const notifications = useNotifications(enabled);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  if (!enabled) {
    return (
      <span className="relative grid h-9 w-9 place-items-center rounded-lg border text-muted-foreground">
        <Bell className="h-4 w-4" />
      </span>
    );
  }

  const items = notifications.data?.items ?? [];
  const unread = notifications.data?.unreadCount ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-9 w-9 place-items-center rounded-lg border hover:bg-accent transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border bg-card shadow-elegant">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Notifications</span>
                {unread > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                    {unread}
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Tout lire
                </button>
              )}
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-classroom border-t-transparent" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center py-10">
                  <Bell className="mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Aucune notification</p>
                </div>
              ) : (
                items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onClick={() => { if (!n.readAt) markRead.mutate(n.id); setOpen(false); }}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationRow({ n, onClick }: { n: AppNotification; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full gap-3 border-b px-4 py-3 text-left text-sm transition-colors last:border-0 hover:bg-accent/50 ${n.readAt ? "opacity-55" : "bg-blue-50/40 dark:bg-blue-950/10"}`}
    >
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[n.type] ?? "bg-muted-foreground"}`} />
      <div className="min-w-0 flex-1">
        <div className={`text-sm leading-snug ${n.readAt ? "" : "font-semibold"}`}>{n.title}</div>
        {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
        <div className="mt-1 text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: fr })}
        </div>
      </div>
      {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
    </button>
  );
}
