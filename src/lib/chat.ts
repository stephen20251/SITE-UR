import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useSocketEvent } from "./socket";

export type ChatUser = { id: string; firstName: string; lastName: string; avatarUrl?: string | null; role: string };

export type ErpContact = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  systemRole: string;
  subtitle: string;
  group: string;
};

export type ChatRoomCard = {
  id: string;
  type: "COURSE" | "PRIVATE" | "GROUP" | "CLASS" | "ADMIN";
  name: string;
  isPrivate: boolean;
  system?: string;
  courseId: string | null;
  otherUser: ChatUser | null;
  members: ChatUser[];
  lastMessage: { body: string; createdAt: string; senderId: string; isSystem?: boolean } | null;
  unread: number;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  body: string;
  fileUrl?: string | null;
  fileType?: string | null;
  fileName?: string | null;
  createdAt: string;
  isSystem?: boolean;
  sender: ChatUser;
};

// ── ERP Chat ──────────────────────────────────────────────────────────────────

export function useErpRooms(enabled = true) {
  return useQuery({
    queryKey: chatKeys.erpRooms,
    queryFn: () => api<ChatRoomCard[]>("/erp-chat/rooms"),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useErpUnreadCount(enabled = true) {
  const rooms = useErpRooms(enabled);
  const count = (rooms.data ?? []).reduce((s, r) => s + (r.unread ?? 0), 0);
  return count;
}

export function useErpContacts(q: string, enabled = true) {
  return useQuery({
    queryKey: chatKeys.erpContacts(q),
    queryFn: () => api<ErpContact[]>(`/erp-chat/contacts?q=${encodeURIComponent(q)}`),
    enabled,
    staleTime: 30_000,
  });
}

export function useOpenDM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api<ChatRoomCard>(`/erp-chat/dm/${userId}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.erpRooms }),
  });
}

export function useRoomMessages(roomId: string | null, enabled = true) {
  return useQuery({
    queryKey: chatKeys.messages(roomId ?? "none"),
    queryFn: () => api<ChatMessage[]>(`/erp-chat/rooms/${roomId}/messages?limit=80`),
    enabled: enabled && !!roomId,
  });
}

export function useMarkRoomRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => api(`/erp-chat/rooms/${roomId}/read`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.erpRooms }),
  });
}

export function useSendChatFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, file, body }: { roomId: string; file: File; body?: string }) => {
      const fd = new FormData();
      fd.append("file", file);
      if (body) fd.append("body", body);
      return fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/erp-chat/rooms/${roomId}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("us.accessToken") ?? ""}` },
        body: fd,
      }).then(async (r) => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? "Erreur upload"); }
        return r.json() as Promise<ChatMessage>;
      });
    },
    onSuccess: (msg) => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(msg.roomId) });
      qc.invalidateQueries({ queryKey: chatKeys.erpRooms });
    },
  });
}

// ── LMS online chat ───────────────────────────────────────────────────────────

export const onlineChatKeys = {
  rooms:    ["online-chat", "rooms"] as const,
  messages: (id: string) => ["online-chat", "messages", id] as const,
};

export function useChatRooms(enabled = true) {
  return useQuery({
    queryKey: onlineChatKeys.rooms,
    queryFn: () => api<ChatRoomCard[]>("/chat/rooms"),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useOnlineRoomMessages(roomId: string | null, enabled = true) {
  return useQuery({
    queryKey: onlineChatKeys.messages(roomId ?? "none"),
    queryFn: () => api<ChatMessage[]>(`/chat/rooms/${roomId}/messages?limit=80`),
    enabled: enabled && !!roomId,
  });
}

export function useOpenCourseRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => api<ChatRoomCard>(`/chat/courses/${courseId}/room`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: onlineChatKeys.rooms }),
  });
}

export function useOnlineUnreadCount(enabled = true) {
  const rooms = useChatRooms(enabled);
  return (rooms.data ?? []).reduce((s, r) => s + (r.unread ?? 0), 0);
}

export function useOpenPrivateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api<ChatRoomCard>(`/chat/private/${userId}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: onlineChatKeys.rooms }),
  });
}

// Legacy alias (kept for compatibility)
export const chatKeys = {
  erpRooms:    ["erp-chat", "rooms"] as const,
  erpContacts: (q: string) => ["erp-chat", "contacts", q] as const,
  erpUnread:   ["erp-chat", "unread"] as const,
  messages:    (roomId: string) => ["erp-chat", "messages", roomId] as const,
  rooms:       ["online-chat", "rooms"] as const,
};

// ── Live presence ─────────────────────────────────────────────────────────────

export function usePresence(enabled = true) {
  const [online, setOnline] = useState<Set<string>>(new Set());

  const snapshot = useQuery({
    queryKey: ["chat", "presence"],
    queryFn: () => api<{ online: string[] }>("/chat/presence"),
    enabled,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (snapshot.data) setOnline(new Set(snapshot.data.online));
  }, [snapshot.data]);

  useSocketEvent<{ userId: string; online: boolean }>("presence:update", ({ userId, online: isUp }) => {
    setOnline((prev) => {
      const next = new Set(prev);
      if (isUp) next.add(userId);
      else next.delete(userId);
      return next;
    });
  });

  useSocketEvent<{ online: string[] }>("connected", (payload) => {
    if (payload?.online) setOnline(new Set(payload.online));
  });

  return { online, isOnline: (id: string) => online.has(id) };
}
