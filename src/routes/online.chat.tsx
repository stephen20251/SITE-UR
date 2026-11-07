import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare, Plus, Search, Loader2, Phone, Video, Info, ChevronLeft,
  LayoutDashboard, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { DashShell } from "@/components/dash-shell";
import { useAuth } from "@/lib/auth";
import { useRequireOnline, initials } from "@/components/online/shared";
import {
  useChatRooms, useOnlineRoomMessages, useOpenPrivateRoom, usePresence,
  onlineChatKeys, type ChatRoomCard, type ChatMessage,
} from "@/lib/chat";
import { useSocketEvent, socketEmit, getSocket } from "@/lib/socket";
import { MessageItem } from "@/components/online/chat/message-item";
import { MessageInput } from "@/components/online/chat/message-input";
import { UserPicker, type LmsContact } from "@/components/online/chat/user-picker";
import { ContactPanel } from "@/components/online/chat/contact-panel";
import { CallOverlay, useCallOverlay } from "@/components/online/chat/call-overlay";

export const Route = createFileRoute("/online/chat")({
  validateSearch: (s): { room?: string } => ({
    room: typeof s.room === "string" ? s.room : undefined,
  }),
  component: ChatPage,
});

// ─── Main page ────────────────────────────────────────────────────────────────

function ChatPage() {
  const { user, ready } = useRequireOnline();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { room: roomParam } = Route.useSearch();
  const qc = useQueryClient();

  const enabled = ready && !!user;
  const rooms = useChatRooms(enabled);
  const presence = usePresence(enabled);
  const openDM = useOpenPrivateRoom();

  const [activeId, setActiveId] = useState<string | null>(roomParam ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const call = useCallOverlay(`${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim());

  // Default to first room
  useEffect(() => {
    if (activeId || !rooms.data?.length) return;
    setActiveId(roomParam ?? rooms.data[0].id);
  }, [rooms.data, activeId, roomParam]);

  const navItems = useMemo(() => [
    { to: user?.role === "TEACHER_ONLINE" ? "/online/teacher" : "/online/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: "/online", label: "Catalogue", icon: <BarChart3 className="h-4 w-4" /> },
    { to: "/online/chat", label: "Chat", icon: <MessageSquare className="h-4 w-4" /> },
  ], [user?.role]);

  // Live: new message arrives → bump unread + refresh room list
  useSocketEvent<ChatMessage>("chat:notify", ({ roomId }) => {
    if (roomId === activeId) return; // already reading
    qc.setQueryData<ChatRoomCard[]>(onlineChatKeys.rooms, prev =>
      prev?.map(r => r.id === roomId ? { ...r, unread: r.unread + 1 } : r),
    );
  });

  function selectRoom(id: string) {
    setActiveId(id);
    setMobileView("chat");
    setShowInfo(false);
    qc.setQueryData<ChatRoomCard[]>(onlineChatKeys.rooms, prev =>
      prev?.map(r => r.id === id ? { ...r, unread: 0 } : r),
    );
  }

  async function openWithContact(contact: LmsContact) {
    setPickerOpen(false);
    try {
      const room = await openDM.mutateAsync(contact.id);
      selectRoom(room.id);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
  }

  if (!ready || !user) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const roomList = rooms.data ?? [];
  const filtered = searchQ
    ? roomList.filter(r => r.name.toLowerCase().includes(searchQ.toLowerCase()))
    : roomList;
  const activeRoom = roomList.find(r => r.id === activeId) ?? null;

  return (
    <DashShell
      brand="Online"
      brandColor="online"
      items={navItems}
      user={{ name: `${user.firstName} ${user.lastName}`, role: user.role === "TEACHER_ONLINE" ? "Enseignant" : "Étudiant" }}
      onLogout={async () => { await logout(); navigate({ to: "/online" }); }}
    >
      {/* WebRTC call overlay */}
      <CallOverlay ctrl={call} />

      {/* User picker modal */}
      {pickerOpen && (
        <UserPicker
          onSelect={openWithContact}
          onClose={() => setPickerOpen(false)}
          onlineSet={presence.online}
        />
      )}

      {/* 3-column layout — negate DashShell main padding to fill edge-to-edge */}
      <div className={`-m-4 md:-m-8 grid overflow-hidden border-t bg-card
        h-[calc(100vh-4rem-3rem)] md:h-[calc(100vh-4rem)]
        grid-cols-1
        md:grid-cols-[280px_1fr]
        ${showInfo && activeRoom?.otherUser ? "lg:grid-cols-[280px_1fr_240px]" : "lg:grid-cols-[280px_1fr]"}`}
      >
        {/* ── Column 1: Conversation list ───────────────────────────────── */}
        <div className={`flex min-h-0 flex-col border-r ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}>
          {/* Header */}
          <div className="border-b p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Messages</span>
              <button
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-online/10 px-3 py-1.5 text-xs font-medium text-online hover:bg-online/20 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Nouveau
              </button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Rechercher…"
                className="h-8 w-full rounded-lg border bg-muted/40 pl-8 pr-3 text-xs outline-none focus:bg-background"
              />
            </div>
          </div>

          {/* Room list */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rooms.isLoading ? (
              <div className="grid h-32 place-items-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {searchQ ? "Aucun résultat" : "Aucune conversation"}
                </p>
                {!searchQ && (
                  <button onClick={() => setPickerOpen(true)} className="mt-1 text-xs text-online hover:underline">
                    Démarrer une conversation
                  </button>
                )}
              </div>
            ) : (
              filtered.map(r => <RoomRow key={r.id} room={r} active={activeId === r.id} presence={presence} onSelect={() => selectRoom(r.id)} />)
            )}
          </div>
        </div>

        {/* ── Column 2: Active conversation ─────────────────────────────── */}
        <div className={`flex min-h-0 flex-col ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
          {activeRoom ? (
            <Conversation
              key={activeRoom.id}
              room={activeRoom}
              meId={user.id}
              meName={`${user.firstName} ${user.lastName}`}
              presence={presence}
              showInfoPanel={showInfo}
              onToggleInfo={() => setShowInfo(s => !s)}
              onBack={() => setMobileView("list")}
              onAudioCall={() => activeRoom.otherUser && call.startCall(activeRoom.otherUser.id, `${activeRoom.otherUser.firstName} ${activeRoom.otherUser.lastName}`, "audio")}
              onVideoCall={() => activeRoom.otherUser && call.startCall(activeRoom.otherUser.id, `${activeRoom.otherUser.firstName} ${activeRoom.otherUser.lastName}`, "video")}
            />
          ) : (
            <div className="hidden place-items-center text-sm text-muted-foreground md:grid">
              <div className="text-center">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
                <p>Sélectionnez une conversation</p>
                <button onClick={() => setPickerOpen(true)} className="mt-3 text-xs text-online hover:underline">
                  ou démarrez-en une nouvelle
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Column 3: Contact info panel (desktop, toggleable) ────────── */}
        {showInfo && activeRoom?.otherUser && (
          <div className="hidden lg:block">
            <ContactPanel
              room={activeRoom}
              isOnline={presence.isOnline(activeRoom.otherUser.id)}
              onClose={() => setShowInfo(false)}
              onAudioCall={() => call.startCall(activeRoom.otherUser!.id, `${activeRoom.otherUser!.firstName} ${activeRoom.otherUser!.lastName}`, "audio")}
              onVideoCall={() => call.startCall(activeRoom.otherUser!.id, `${activeRoom.otherUser!.firstName} ${activeRoom.otherUser!.lastName}`, "video")}
            />
          </div>
        )}
      </div>
    </DashShell>
  );
}

// ─── Room row ─────────────────────────────────────────────────────────────────

function RoomRow({
  room, active, presence, onSelect,
}: {
  room: ChatRoomCard;
  active: boolean;
  presence: { isOnline: (id: string) => boolean };
  onSelect: () => void;
}) {
  const online = room.otherUser ? presence.isOnline(room.otherUser.id) : false;
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-3 border-b p-3 text-left text-sm transition-colors
        ${active ? "bg-online/5 border-l-2 border-l-online" : "hover:bg-accent/50"}`}
    >
      <div className="relative shrink-0">
        {(room.otherUser as any)?.avatarUrl ? (
          <img src={(room.otherUser as any).avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-full grad-online text-sm font-semibold text-white">
            {room.otherUser
              ? initials(room.otherUser.firstName, room.otherUser.lastName)
              : (room.name[0] ?? "#")}
          </div>
        )}
        {room.otherUser && (
          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${online ? "bg-success" : "bg-muted-foreground/30"}`} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className={`truncate text-sm ${active ? "font-semibold" : "font-medium"}`}>
            {room.name || "Conversation"}
          </span>
          {room.lastMessage && (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {shortTime(room.lastMessage.createdAt)}
            </span>
          )}
        </div>
        <span className="truncate text-xs text-muted-foreground">
          {room.lastMessage?.body ?? (room.type === "COURSE" ? "Cours" : "Dire bonjour 👋")}
        </span>
      </div>
      {room.unread > 0 && (
        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full grad-online px-1.5 text-[10px] font-bold text-white">
          {room.unread > 9 ? "9+" : room.unread}
        </span>
      )}
    </button>
  );
}

// ─── Conversation ─────────────────────────────────────────────────────────────

function Conversation({
  room, meId, meName, presence,
  showInfoPanel, onToggleInfo,
  onBack, onAudioCall, onVideoCall,
}: {
  room: ChatRoomCard;
  meId: string;
  meName: string;
  presence: { isOnline: (id: string) => boolean };
  showInfoPanel: boolean;
  onToggleInfo: () => void;
  onBack: () => void;
  onAudioCall: () => void;
  onVideoCall: () => void;
}) {
  const qc = useQueryClient();
  const history = useOnlineRoomMessages(room.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed from history
  useEffect(() => {
    if (!history.data) return;
    seen.current = new Set(history.data.map(m => m.id));
    setMessages(history.data);
  }, [history.data]);

  // Join/leave socket room
  useEffect(() => {
    socketEmit("chat:join", room.id).catch(() => {});
    return () => { getSocket()?.emit("chat:leave", room.id); };
  }, [room.id]);

  // Live messages
  useSocketEvent<ChatMessage>("chat:message", msg => {
    if (msg.roomId !== room.id || seen.current.has(msg.id)) return;
    seen.current.add(msg.id);
    setMessages(prev => [...prev, msg]);
    // update room list preview
    qc.setQueryData<ChatRoomCard[]>(onlineChatKeys.rooms, prev =>
      prev?.map(r => r.id === room.id ? { ...r, lastMessage: { body: msg.body, createdAt: msg.createdAt, senderId: msg.senderId } } : r),
    );
  });

  // Typing indicator
  useSocketEvent<{ roomId: string; userId: string }>("chat:typing", t => {
    if (t.roomId !== room.id || t.userId === meId) return;
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 2500);
  });

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, typing]);

  const handleNewMessage = useCallback((msg: unknown) => {
    const m = msg as ChatMessage;
    if (seen.current.has(m.id)) return;
    seen.current.add(m.id);
    setMessages(prev => [...prev, m]);
  }, []);

  const handleTyping = useCallback(() => {
    getSocket()?.emit("chat:typing", room.id);
  }, [room.id]);

  const isPrivate = !!room.otherUser;
  const online = isPrivate && presence.isOnline(room.otherUser!.id);

  // Group messages by date
  const grouped = useMemo(() => {
    const groups: Array<{ date: string; items: ChatMessage[] }> = [];
    for (const m of messages) {
      const date = new Date(m.createdAt).toLocaleDateString("fr", { weekday: "long", day: "numeric", month: "long" });
      const last = groups[groups.length - 1];
      if (last?.date === date) last.items.push(m);
      else groups.push({ date, items: [m] });
    }
    return groups;
  }, [messages]);

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-card/80 px-4 py-3 backdrop-blur">
        {/* Mobile back */}
        <button onClick={onBack} className="md:hidden text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Avatar */}
        <div className="relative shrink-0">
          {(room.otherUser as any)?.avatarUrl ? (
            <img src={(room.otherUser as any).avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-full grad-online text-sm font-semibold text-white">
              {room.otherUser ? initials(room.otherUser.firstName, room.otherUser.lastName) : (room.name[0] ?? "#")}
            </div>
          )}
          {isPrivate && (
            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${online ? "bg-success" : "bg-muted-foreground/30"}`} />
          )}
        </div>

        {/* Name + status */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{room.name || "Conversation"}</div>
          {isPrivate && (
            <div className={`text-xs ${online ? "text-success" : "text-muted-foreground"}`}>
              {online ? "● En ligne" : "Hors ligne"}
            </div>
          )}
        </div>

        {/* Actions */}
        {isPrivate && (
          <div className="flex items-center gap-1">
            <button onClick={onAudioCall} title="Appel audio"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <Phone className="h-4 w-4" />
            </button>
            <button onClick={onVideoCall} title="Appel vidéo"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <Video className="h-4 w-4" />
            </button>
            <button onClick={onToggleInfo} title="Infos contact"
              className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${showInfoPanel ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
              <Info className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Messages — subtle dotted wallpaper for depth */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4"
        style={{
          backgroundImage: "radial-gradient(color-mix(in oklch, var(--color-online) 8%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        {history.isLoading ? (
          <div className="grid h-full place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="grid h-full place-items-center">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Aucun message — dites bonjour 👋</p>
            </div>
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="shrink-0 rounded-full bg-muted px-3 py-0.5 text-[11px] text-muted-foreground capitalize">
                  {group.date}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                {group.items.map(m => (
                  <MessageItem key={m.id} m={m} mine={m.senderId === meId} />
                ))}
              </div>
            </div>
          ))
        )}
        {typing && (
          <div className="flex items-end gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              {room.otherUser ? initials(room.otherUser.firstName, room.otherUser.lastName) : "?"}
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5">
              <span className="flex gap-1">
                {[0,1,2].map(i => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="relative">
        <MessageInput
          roomId={room.id}
          onMessageSent={handleNewMessage}
          onTyping={handleTyping}
        />
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const shortTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
