import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Search, Send, Loader2, UserPlus, ArrowLeft, Users, GraduationCap, Building2, ChevronRight, Paperclip, FileText, Download, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useRequireClassroom } from "@/components/classroom/shared";
import {
  useErpRooms, useRoomMessages, useOpenDM, useMarkRoomRead, useErpContacts, useSendChatFile,
  chatKeys, type ChatRoomCard, type ChatMessage, type ErpContact,
} from "@/lib/chat";
import { getSocket, socketEmit, useSocketEvent, useSocketConnected } from "@/lib/socket";
import { API_ORIGIN } from "@/lib/env";

export const Route = createFileRoute("/classroom/chat")({
  validateSearch: (s): { room?: string } => ({ room: typeof s.room === "string" ? s.room : undefined }),
  component: ChatPage,
});

const API_URL = API_ORIGIN;
const shortTime = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

function UserAvatar({ url, initials, size = 10 }: { url?: string | null; initials: string; size?: number }) {
  const cls = `h-${size} w-${size} shrink-0 rounded-full`;
  if (url) {
    const src = url.startsWith("http") ? url : `${API_URL}${url}`;
    return <img src={src} alt={initials} className={`${cls} object-cover`} />;
  }
  return (
    <div className={`flex ${cls} items-center justify-center grad-classroom text-xs font-bold text-white`}>
      {initials.slice(0, 2).toUpperCase()}
    </div>
  );
}

function roleIcon(systemRole: string) {
  if (systemRole === "STUDENT") return <GraduationCap size={12} className="text-classroom" />;
  if (systemRole === "TEACHER") return <Users size={12} className="text-amber-500" />;
  return <Building2 size={12} className="text-muted-foreground" />;
}

function ContactPicker({ onSelect, onClose }: { onSelect: (c: ErpContact) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const contacts = useErpContacts(q);
  const items = contacts.data ?? [];
  const grouped = items.reduce<Record<string, ErpContact[]>>((acc, c) => { (acc[c.group] ??= []).push(c); return acc; }, {});

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
        </button>
        <span className="font-semibold text-sm">Nouvelle conversation</span>
      </div>
      <div className="px-3 py-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, matricule, fonction…"
            className="w-full rounded-xl bg-gray-50 pl-8 pr-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-classroom/20 dark:bg-gray-800"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {contacts.isLoading ? (
          <div className="flex justify-center pt-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{q ? "Aucun résultat" : "Aucun contact disponible"}</p>
        ) : (
          Object.entries(grouped).map(([group, members]) => (
            <div key={group}>
              <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-gray-50 dark:bg-gray-800/50">{group}</p>
              {members.map((c) => (
                <button key={c.id} onClick={() => onSelect(c)}
                  className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800 transition-colors">
                  <UserAvatar url={c.avatarUrl} initials={`${c.firstName[0]}${c.lastName[0]}`} size={10} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.lastName.toUpperCase()} {c.firstName}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">{roleIcon(c.systemRole)} {c.subtitle}</p>
                  </div>
                  <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ChatPage() {
  const { user, ready } = useRequireClassroom();
  const { room: roomParam } = Route.useSearch();
  const qc = useQueryClient();
  const enabled = ready && !!user;

  const rooms    = useErpRooms(enabled);
  const openDM   = useOpenDM();
  const markRead = useMarkRoomRead();

  const [activeId,   setActiveId]   = useState<string | null>(roomParam ?? null);
  const [search,     setSearch]     = useState("");
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (activeId || !rooms.data?.length) return;
    setActiveId(roomParam ?? rooms.data[0].id);
  }, [rooms.data]);

  useSocketEvent<ChatMessage>("chat:message", (msg) => {
    qc.setQueryData<ChatRoomCard[]>(chatKeys.erpRooms, (prev) => {
      if (!prev) return prev;
      return prev
        .map((r) => r.id === msg.roomId
          ? { ...r, lastMessage: { body: msg.body, createdAt: msg.createdAt, senderId: msg.senderId }, unread: r.id === activeId ? 0 : r.unread + 1 }
          : r)
        .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
    });
  });

  if (!ready || !user) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const roomList    = rooms.data ?? [];
  const activeRoom  = roomList.find((r) => r.id === activeId) ?? null;
  const filtered    = search ? roomList.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())) : roomList;
  const totalUnread = roomList.reduce((s, r) => s + r.unread, 0);

  function selectRoom(id: string) {
    setActiveId(id);
    setShowPicker(false);
    const room = roomList.find((r) => r.id === id);
    if ((room?.unread ?? 0) > 0) {
      qc.setQueryData<ChatRoomCard[]>(chatKeys.erpRooms, (prev) => prev?.map((r) => (r.id === id ? { ...r, unread: 0 } : r)));
      markRead.mutate(id);
    }
  }

  async function startDM(contact: ErpContact) {
    try {
      const room = await openDM.mutateAsync(contact.id);
      setActiveId(room.id);
      setShowPicker(false);
    } catch { toast.error("Impossible d'ouvrir la conversation"); }
  }

  return (
    <div className="-m-4 lg:-m-6 flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Sidebar */}
      <div className={`flex w-full flex-col border-r border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 lg:w-80 lg:shrink-0 ${activeId && !showPicker ? "hidden lg:flex" : "flex"}`}>
        {showPicker ? (
          <ContactPicker onSelect={startDM} onClose={() => setShowPicker(false)} />
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-4 dark:border-gray-800">
              <MessageSquare size={18} className="text-classroom" />
              <span className="font-bold text-gray-900 dark:text-white">Messages</span>
              {totalUnread > 0 && (
                <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
              <button onClick={() => setShowPicker(true)}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent transition-colors" title="Nouvelle conversation">
                <UserPlus size={15} className="text-classroom" />
              </button>
            </div>
            <div className="px-3 py-3">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une conversation…"
                  className="w-full rounded-xl bg-gray-50 pl-8 pr-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-classroom/20 transition-all dark:bg-gray-800 dark:focus:bg-gray-700" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {rooms.isLoading ? (
                <div className="flex justify-center pt-10"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <MessageSquare size={32} className="mb-2" />
                  <p className="text-sm">{search ? "Aucun résultat" : "Aucune conversation"}</p>
                  {!search && (
                    <button onClick={() => setShowPicker(true)}
                      className="mt-3 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium text-classroom hover:bg-classroom/5 transition-colors">
                      <UserPlus size={13} /> Démarrer une conversation
                    </button>
                  )}
                </div>
              ) : (
                filtered.map((r) => {
                  const ini = r.otherUser ? `${r.otherUser.firstName[0]}${r.otherUser.lastName[0]}` : (r.name[0] ?? "#");
                  return (
                    <button key={r.id} onClick={() => selectRoom(r.id)}
                      className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors dark:border-gray-800 ${r.id === activeId ? "bg-classroom/5" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                      <div className="relative shrink-0">
                        <UserAvatar url={r.otherUser?.avatarUrl} initials={ini} size={10} />
                        {r.unread > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                            {r.unread > 9 ? "9+" : r.unread}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate text-sm ${r.unread > 0 ? "font-bold text-gray-900 dark:text-white" : "font-medium text-gray-700 dark:text-gray-300"}`}>{r.name || "Conversation"}</p>
                          {r.lastMessage && <span className="shrink-0 text-[10px] text-gray-400">{shortTime(r.lastMessage.createdAt)}</span>}
                        </div>
                        <p className={`mt-0.5 truncate text-xs ${r.unread > 0 ? "font-medium text-gray-700 dark:text-gray-300" : "text-gray-400"}`}>{r.lastMessage?.body ?? "Dites bonjour 👋"}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Conversation panel */}
      <div className={`flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 ${activeId ? "flex" : "hidden lg:flex"}`}>
        {activeRoom ? (
          <Conversation key={activeRoom.id} room={activeRoom} meId={user.id} onBack={() => setActiveId(null)} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare size={48} className="mb-3" />
            <p className="font-medium text-gray-500">Sélectionnez une conversation</p>
            <p className="text-sm mt-1">Ou démarrez-en une nouvelle.</p>
            <button onClick={() => setShowPicker(true)}
              className="mt-4 flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium text-classroom hover:bg-classroom/5 transition-colors">
              <UserPlus size={16} /> Nouveau message
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── File/image attachment preview ─────────────────────────────────────────────

function FileAttachment({ msg, mine }: { msg: ChatMessage; mine: boolean }) {
  if (!msg.fileUrl) return null;
  const url      = `${API_URL}${msg.fileUrl}`;
  const isImage  = msg.fileType?.startsWith("image/");
  const isPdf    = msg.fileType === "application/pdf";
  const baseCls  = mine ? "bg-white/20 border-white/30" : "bg-gray-100 border-gray-200 dark:bg-gray-700 dark:border-gray-600";

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
        <img src={url} alt={msg.fileName ?? "Image"} className="max-w-[260px] max-h-[200px] rounded-xl object-cover border border-white/20" />
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" download={msg.fileName ?? true}
      className={`mt-1.5 flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-opacity hover:opacity-80 ${baseCls}`}>
      {isPdf ? <FileText size={16} className="shrink-0" /> : <Download size={16} className="shrink-0" />}
      <span className="truncate max-w-[180px]">{msg.fileName ?? "Fichier"}</span>
    </a>
  );
}

// ── Conversation ──────────────────────────────────────────────────────────────

function Conversation({ room, meId, onBack }: { room: ChatRoomCard; meId: string; onBack: () => void }) {
  const history     = useRoomMessages(room.id);
  const sendFile    = useSendChatFile();
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const seen        = useRef<Set<string>>(new Set());
  const [draft,     setDraft]     = useState("");
  const [sending,   setSending]   = useState(false);
  const [typing,    setTyping]    = useState(false);
  const [pendingFile, setPending] = useState<File | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const isConnected = useSocketConnected();

  useEffect(() => {
    if (!history.data) return;
    seen.current = new Set(history.data.map((m) => m.id));
    setMessages(history.data);
  }, [history.data]);

  useEffect(() => {
    socketEmit("chat:join", room.id).catch(() => {});
    return () => { getSocket()?.emit("chat:leave", room.id); };
  }, [room.id]);

  useSocketEvent<ChatMessage>("chat:message", (msg) => {
    if (msg.roomId !== room.id || seen.current.has(msg.id)) return;
    seen.current.add(msg.id);
    setMessages((prev) => [...prev, msg]);
  });

  useSocketEvent<{ roomId: string; userId: string }>("chat:typing", (t) => {
    if (t.roomId !== room.id || t.userId === meId) return;
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 2500);
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();

    // File upload takes priority
    if (pendingFile) {
      setSending(true);
      try {
        const msg = await sendFile.mutateAsync({ roomId: room.id, file: pendingFile, body: text });
        if (!seen.current.has(msg.id)) { seen.current.add(msg.id); setMessages((prev) => [...prev, msg]); }
        setPending(null); setDraft("");
      } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur upload"); }
      finally { setSending(false); }
      return;
    }

    if (!text) return;
    setDraft("");
    setSending(true);
    try {
      const res = await socketEmit<{ ok: boolean; error?: string; message?: ChatMessage }>("chat:message", { roomId: room.id, body: text });
      if (!res?.ok) throw new Error(res?.error || "Send failed");
    } catch {
      try {
        const msg = await api<ChatMessage>(`/erp-chat/rooms/${room.id}/messages`, { method: "POST", body: { body: text } });
        if (!seen.current.has(msg.id)) { seen.current.add(msg.id); setMessages((prev) => [...prev, msg]); }
      } catch { toast.error("Message non envoyé"); setDraft(text); }
    } finally { setSending(false); }
  }

  function onType(v: string) { setDraft(v); getSocket()?.emit("chat:typing", room.id); }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast.error("Fichier trop grand (max 20 Mo)"); return; }
    setPending(f);
    e.target.value = "";
  }

  const headerIni = room.otherUser
    ? `${room.otherUser.firstName[0]}${room.otherUser.lastName[0]}`
    : (room.name[0] ?? "#");

  return (
    <div className="flex min-h-0 min-w-0 flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 shrink-0">
        <button onClick={onBack} className="mr-1 text-muted-foreground hover:text-foreground lg:hidden"><ArrowLeft size={18} /></button>
        <UserAvatar url={room.otherUser?.avatarUrl} initials={headerIni} size={10} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900 dark:text-white">{room.name || "Conversation"}</p>
          <p className="text-xs text-muted-foreground">
            {room.members.length} membre{room.members.length === 1 ? "" : "s"}
            {isConnected && <span className="text-emerald-500"> · ● en direct</span>}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {history.isLoading ? (
          <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Aucun message — dites bonjour !</p>
        ) : (
          messages.map((m, i) => {
            if (m.isSystem) return (
              <div key={m.id} className="flex justify-center my-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] text-muted-foreground dark:bg-gray-800">{m.body}</span>
              </div>
            );
            const mine     = m.senderId === meId;
            const prevSame = i > 0 && messages[i - 1].senderId === m.senderId && !messages[i - 1].isSystem;
            const senderName = m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : "Inconnu";
            const senderIni  = m.sender ? `${m.sender.firstName[0]}${m.sender.lastName[0]}` : "?";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "gap-2"} ${prevSame ? "mt-0.5" : "mt-3"}`}>
                {!mine && !prevSame && <UserAvatar url={m.sender?.avatarUrl} initials={senderIni} size={8} />}
                {!mine && prevSame && <div className="w-8 shrink-0" />}
                <div className="max-w-[75%]">
                  {!mine && !prevSame && <p className="mb-0.5 text-xs font-semibold text-gray-600 dark:text-gray-400">{senderName}</p>}
                  <div className={`rounded-2xl px-4 py-2.5 text-sm ${mine ? "grad-classroom text-white rounded-br-sm" : "bg-white border border-gray-100 text-gray-900 rounded-bl-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"}`}>
                    {m.body && !m.fileUrl && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    {m.body && m.fileUrl && <p className="whitespace-pre-wrap break-words text-sm mb-1">{m.body}</p>}
                    <FileAttachment msg={m} mine={mine} />
                    <p className={`mt-1 text-[10px] ${mine ? "opacity-70 text-right" : "text-gray-400"}`}>{shortTime(m.createdAt)}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {typing && <p className="text-xs italic text-muted-foreground pl-10">En train d'écrire…</p>}
      </div>

      {/* File preview bar */}
      {pendingFile && (
        <div className="flex items-center gap-2 border-t bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm">
          {pendingFile.type.startsWith("image/")
            ? <ImageIcon size={16} className="text-blue-500 shrink-0" />
            : <FileText size={16} className="text-blue-500 shrink-0" />}
          <span className="truncate flex-1 text-blue-700 dark:text-blue-300">{pendingFile.name}</span>
          <span className="text-xs text-blue-500">{(pendingFile.size / 1024).toFixed(0)} Ko</span>
          <button onClick={() => setPending(null)} className="text-blue-400 hover:text-blue-600 ml-1"><X size={14} /></button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={send} className="border-t border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 shrink-0">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
          <input ref={fileRef} type="file" className="hidden" onChange={onFileChange}
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-classroom hover:bg-classroom/10 transition-colors">
            <Paperclip size={16} />
          </button>
          <input value={draft} onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e as unknown as React.FormEvent); } }}
            placeholder={pendingFile ? "Ajouter un message (optionnel)…" : "Écrivez un message…"}
            className="flex-1 bg-transparent px-2 text-sm outline-none dark:text-white" />
          <button type="submit" disabled={sending || (!draft.trim() && !pendingFile)}
            className="flex h-9 w-9 items-center justify-center rounded-lg grad-classroom text-white disabled:opacity-50 transition-opacity">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
