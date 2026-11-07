import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getSocket, disconnectSocket, useSocketEvent } from "@/lib/socket";
import { notifKey } from "@/lib/notifications";
import { chatKeys } from "@/lib/chat";

/**
 * Headless component (mounted once at the root) that owns the socket lifecycle
 * and fans live server events into the React Query cache + toasts.
 */
export function SocketManager() {
  const { user, ready } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!ready) return;
    if (user) getSocket();
    else disconnectSocket();
  }, [ready, user]);

  // Persisted notification pushed live → toast + refresh the bell.
  useSocketEvent<{ title?: string; body?: string }>("notification", (n) => {
    qc.invalidateQueries({ queryKey: notifKey });
    if (n?.title) toast(n.title, { description: n.body ?? undefined });
  });

  // New chat message in a room I'm not currently viewing → refresh unread badges.
  useSocketEvent("chat:notify", () => {
    qc.invalidateQueries({ queryKey: chatKeys.rooms });
  });

  // Q&A forum activity (question/answer/accept) → live-refresh the course
  // forum list and, if open, the affected thread.
  useSocketEvent<{ courseId?: string; questionId?: string }>("qa:update", (e) => {
    if (e?.courseId) qc.invalidateQueries({ queryKey: ["online", "course", e.courseId, "questions"] });
    if (e?.questionId) qc.invalidateQueries({ queryKey: ["online", "question", e.questionId] });
  });

  return null;
}
