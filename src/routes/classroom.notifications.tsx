import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCheck, Loader2, BellOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useRequireClassroom } from "@/components/classroom/shared";
import {
  useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead,
  type AppNotification,
} from "@/lib/notifications";

export const Route = createFileRoute("/classroom/notifications")({ component: NotificationsPage });

const TYPE_META: Record<string, { label: string; dot: string }> = {
  EXAM_AVAILABLE:    { label: "Examen",          dot: "bg-amber-500" },
  RESULTS_READY:     { label: "Résultats",        dot: "bg-emerald-500" },
  GRADE_PUBLISHED:   { label: "Note",             dot: "bg-emerald-500" },
  COURSE_PUBLISHED:  { label: "Cours",            dot: "bg-blue-500" },
  PAYMENT_DUE:       { label: "Paiement dû",      dot: "bg-red-500" },
  PAYMENT_RECEIVED:  { label: "Paiement reçu",    dot: "bg-emerald-500" },
  CHAT_MESSAGE:      { label: "Message",           dot: "bg-blue-500" },
  ANNOUNCEMENT:      { label: "Annonce",           dot: "bg-purple-500" },
  TIMETABLE_UPDATED: { label: "Emploi du temps",  dot: "bg-amber-500" },
  ADMISSION_UPDATE:  { label: "Admission",         dot: "bg-classroom" },
};

function getMeta(type: string) {
  return TYPE_META[type] ?? { label: type.replace(/_/g, " ").toLowerCase(), dot: "bg-muted-foreground" };
}

function NotificationRow({ n, onRead }: { n: AppNotification; onRead: (id: string) => void }) {
  const meta = getMeta(n.type);
  const link = typeof n.data?.link === "string" ? n.data.link : null;

  const content = (
    <div
      className={`flex gap-4 rounded-2xl border p-4 transition-all ${
        n.readAt
          ? "bg-card opacity-70"
          : "bg-blue-50/60 border-blue-200/60 dark:bg-blue-950/10 dark:border-blue-800/30 shadow-elegant"
      }`}
    >
      <div className="flex flex-col items-center gap-1.5 pt-0.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className={`text-sm leading-snug ${n.readAt ? "" : "font-semibold"}`}>{n.title}</p>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {meta.label}
            </span>
            {!n.readAt && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRead(n.id); }}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Marquer comme lu"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
        <p className="mt-1.5 text-[11px] text-muted-foreground/70">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: fr })}
        </p>
      </div>
    </div>
  );

  if (link) {
    return (
      <a href={link} className="block hover:no-underline" onClick={() => { if (!n.readAt) onRead(n.id); }}>
        {content}
      </a>
    );
  }
  return <div onClick={() => { if (!n.readAt) onRead(n.id); }} className="cursor-default">{content}</div>;
}

function NotificationsPage() {
  const { user, ready } = useRequireClassroom();
  const enabled = ready && !!user;

  const notifications = useNotifications(enabled);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  if (!ready || !user) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const items = notifications.data?.items ?? [];
  const unread = notifications.data?.unreadCount ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0
              ? `${unread} notification${unread > 1 ? "s" : ""} non lue${unread > 1 ? "s" : ""}`
              : "Tout est à jour"}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Content */}
      {notifications.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <BellOff className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">Aucune notification</p>
          <p className="mt-1 text-sm text-muted-foreground/70">Vous serez notifié(e) des événements importants ici.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Unread section */}
          {items.some((n) => !n.readAt) && (
            <>
              <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Non lues</p>
              {items
                .filter((n) => !n.readAt)
                .map((n) => (
                  <NotificationRow key={n.id} n={n} onRead={(id) => markRead.mutate(id)} />
                ))}
            </>
          )}

          {/* Read section */}
          {items.some((n) => n.readAt) && (
            <>
              <p className="mt-4 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Déjà lues
              </p>
              {items
                .filter((n) => n.readAt)
                .map((n) => (
                  <NotificationRow key={n.id} n={n} onRead={(id) => markRead.mutate(id)} />
                ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
