import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "./api";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link?: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsPage = {
  items: AppNotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
};

export const notifKey = ["notifications"] as const;

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: notifKey,
    queryFn: () => api<NotificationsPage>("/notifications?limit=20"),
    enabled,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: notifKey }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/notifications/read-all`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: notifKey }),
  });
}

/** Page vers laquelle mène une notification (l'action à effectuer), ou null. */
export function notificationLink(n: AppNotification): string | null {
  const link = n.link ?? (typeof n.data?.link === "string" ? n.data.link : null);
  return link && link.startsWith("/") ? link : null;
}

/** Clic sur une notification : la marque comme lue puis ouvre la page concernée. */
export function useOpenNotification() {
  const markRead = useMarkNotificationRead();
  const navigate = useNavigate();
  return (n: AppNotification, after?: () => void) => {
    if (!n.readAt) markRead.mutate(n.id);
    after?.();
    const link = notificationLink(n);
    if (link) navigate({ href: link });
  };
}
