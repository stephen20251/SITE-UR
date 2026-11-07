import { createFileRoute, Outlet, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useErpAuth } from "./erp";
import { getSocket, useSocketEvent } from "../lib/socket";
import {
  MessageSquare, Search, Plus, User, Users, Shield, Bot,
  GraduationCap, ChevronRight, Loader2, X,
} from "lucide-react";

export const Route = createFileRoute("/erp/chat")({
  component: ErpChatLayout,
});

export type ChatRoom = {
  id: string; name: string; type: string; isPrivate: boolean;
  members: { id: string; firstName: string; lastName: string; avatarUrl?: string | null; role?: string }[];
  otherUser: { id: string; firstName: string; lastName: string; systemRole: string } | null;
  unread: number;
  lastMessage: { body: string; createdAt: string; senderId: string; isSystem: boolean } | null;
  updatedAt: string;
};

type Notify = { roomId: string; preview: string; sender: { firstName: string; lastName: string } };

const TYPE_ICON: Record<string, React.ReactNode> = {
  PRIVATE:   <User size={14} />,
  CLASS:     <GraduationCap size={14} />,
  ADMIN:     <Shield size={14} />,
  BROADCAST: <Users size={14} />,
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "maintenant";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function ErpChatLayout() {
  const { user } = useErpAuth();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { roomId?: string };
  const activeId = params.roomId;

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [searchUsers, setSearchUsers] = useState<any[]>([]);
  const [userQuery, setUserQuery] = useState("");

  // Load rooms
  const loadRooms = useCallback(async () => {
    try {
      const r = await api<ChatRoom[]>("/erp-chat/rooms");
      setRooms(r);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadRooms(); }, []);

  // Join all room sockets + real-time bump on new message
  useEffect(() => {
    const s = getSocket();
    if (!s || rooms.length === 0) return;
    rooms.forEach((r) => s.emit("chat:join", r.id));
  }, [rooms.length]);

  // Bump unread on incoming notify
  useSocketEvent<Notify>("chat:notify", (n) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === n.roomId
          ? { ...r, unread: r.id === activeId ? 0 : r.unread + 1, lastMessage: { body: n.preview, createdAt: new Date().toISOString(), senderId: "", isSystem: false } }
          : r
      ).sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
    );
  });

  // Clear unread when entering a room
  function openRoom(id: string) {
    setRooms((prev) => prev.map((r) => r.id === id ? { ...r, unread: 0 } : r));
    navigate({ to: "/erp/chat/$roomId", params: { roomId: id } });
  }

  // DM search
  useEffect(() => {
    if (!userQuery.trim()) { setSearchUsers([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api<any[]>(`/admin/users?search=${encodeURIComponent(userQuery)}&limit=8`);
        setSearchUsers(r.filter((u: any) => u.id !== user?.id));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [userQuery]);

  async function openDM(otherUserId: string) {
    try {
      const room = await api<ChatRoom>(`/erp-chat/dm/${otherUserId}`, { method: "POST" });
      setRooms((prev) => {
        const exists = prev.find((r) => r.id === room.id);
        return exists ? prev : [room, ...prev];
      });
      setShowNew(false);
      setUserQuery("");
      openRoom(room.id);
    } catch {}
  }

  const totalUnread = rooms.reduce((s, r) => s + r.unread, 0);
  const filtered = rooms.filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.lastMessage?.body.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 lg:-m-6 overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <div className={`flex w-full flex-col border-r border-gray-100 bg-white lg:w-80 lg:flex-shrink-0 ${activeId ? "hidden lg:flex" : "flex"}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-50 px-4 py-4">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-[#0F1E3C]" />
            <span className="font-bold text-gray-900">Messages</span>
            {totalUnread > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
          <button onClick={() => setShowNew(!showNew)}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0F1E3C] text-white hover:bg-[#1B3A6B] transition-colors">
            {showNew ? <X size={14} /> : <Plus size={14} />}
          </button>
        </div>

        {/* New DM search */}
        {showNew && (
          <div className="border-b border-gray-50 p-3 bg-gray-50">
            <p className="text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wide">Nouveau message</p>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Rechercher un utilisateur…"
                className="w-full rounded-xl border border-gray-200 pl-8 pr-3 py-2 text-sm outline-none focus:border-[#0F1E3C]"
                autoFocus
              />
            </div>
            {searchUsers.length > 0 && (
              <div className="mt-2 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                {searchUsers.map((u) => (
                  <button key={u.id} onClick={() => openDM(u.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F1E3C] text-[10px] font-bold text-[#FFD166] shrink-0">
                      {initials(`${u.firstName} ${u.lastName}`)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.firstName} {u.lastName}</p>
                      <p className="text-[11px] text-gray-400 truncate">{u.systemRole}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="px-3 py-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher dans les conversations…"
              className="w-full rounded-xl bg-gray-50 pl-8 pr-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#0F1E3C]/10 transition-all"
            />
          </div>
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center pt-10">
              <Loader2 size={20} className="animate-spin text-gray-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <MessageSquare size={32} className="mb-2" />
              <p className="text-sm">{search ? "Aucun résultat" : "Aucune conversation"}</p>
            </div>
          ) : (
            filtered.map((r) => (
              <button key={r.id} onClick={() => openRoom(r.id)}
                className={`flex w-full items-start gap-3 px-4 py-3 transition-colors text-left border-b border-gray-50 ${r.id === activeId ? "bg-[#0F1E3C]/5" : "hover:bg-gray-50"}`}>
                {/* Avatar */}
                <div className="relative shrink-0">
                  {r.isPrivate && r.otherUser ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F1E3C] text-xs font-bold text-[#FFD166]">
                      {initials(`${r.otherUser.firstName} ${r.otherUser.lastName}`)}
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F1E3C]/10 text-[#0F1E3C]">
                      {TYPE_ICON[r.type] ?? <Users size={14} />}
                    </div>
                  )}
                  {r.unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {r.unread > 9 ? "9+" : r.unread}
                    </span>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${r.unread > 0 ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>{r.name}</p>
                    {r.lastMessage && <span className="shrink-0 text-[10px] text-gray-400">{relTime(r.lastMessage.createdAt)}</span>}
                  </div>
                  {r.lastMessage && (
                    <p className={`mt-0.5 truncate text-xs ${r.unread > 0 ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                      {r.lastMessage.isSystem ? "🤖 " : ""}{r.lastMessage.body}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Chat panel ─────────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col bg-[#F8FAFC] ${activeId ? "flex" : "hidden lg:flex"}`}>
        {activeId ? (
          <Outlet />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-300">
            <MessageSquare size={48} className="mb-3" />
            <p className="font-medium text-gray-500">Sélectionnez une conversation</p>
            <p className="text-sm mt-1">Ou créez-en une nouvelle avec le bouton +</p>
          </div>
        )}
      </div>
    </div>
  );
}
