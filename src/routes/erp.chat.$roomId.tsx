import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useErpAuth } from "./erp";
import { getSocket, useSocketEvent } from "../lib/socket";
import {
  ArrowLeft, Send, Pin, Search,
  Bot, CheckCheck, Check,
  X, Loader2, File, Image as ImageIcon, Download, MessageSquare,
} from "lucide-react";

export const Route = createFileRoute("/erp/chat/$roomId")({ component: RoomView });

type Msg = {
  id: string; roomId: string; senderId: string; body: string;
  fileUrl?: string | null; fileType?: string | null; fileName?: string | null;
  isPinned: boolean; isSystem: boolean; isRead: boolean; createdAt: string;
  sender: { id: string; firstName: string; lastName: string; avatarUrl?: string | null };
};
type Room = { id: string; name: string; type: string; isPrivate: boolean; members: any[]; otherUser: any };

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

const FILE_ICON: Record<string, string> = {
  pdf: "text-red-500",
  image: "text-blue-500",
  word: "text-blue-700",
  default: "text-gray-500",
};

export default function RoomView() {
  const { roomId } = Route.useParams();
  const { user } = useErpAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [pinned, setPinned] = useState<Msg[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Msg[]>([]);
  const [typing, setTyping] = useState<string[]>([]); // user IDs typing
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load room + messages
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setRoom(null);
    Promise.all([
      api<Msg[]>(`/erp-chat/rooms/${roomId}/messages`),
    ]).then(([msgs]) => {
      setMessages(msgs);
      // Room info from first message or fallback
    }).catch(console.error).finally(() => setLoading(false));

    // Join socket room
    const s = getSocket();
    if (s) {
      s.emit("chat:join", roomId, () => {});
      s.emit("chat:read", roomId);
    }

    return () => {
      if (s) s.emit("chat:leave", roomId);
    };
  }, [roomId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Real-time incoming messages
  useSocketEvent<Msg>("chat:message", (msg) => {
    if (msg.roomId !== roomId) return;
    setMessages((prev) => {
      if (prev.find((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    const s = getSocket();
    if (s) s.emit("chat:read", roomId);
  });

  // Typing indicators
  useSocketEvent<{ roomId: string; userId: string }>("chat:typing", (p) => {
    if (p.roomId !== roomId || p.userId === user?.id) return;
    setTyping((prev) => prev.includes(p.userId) ? prev : [...prev, p.userId]);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping([]), 3000);
  });

  // Pin updates
  useSocketEvent<{ messageId: string; isPinned: boolean }>("chat:pin", (p) => {
    setMessages((prev) => prev.map((m) => m.id === p.messageId ? { ...m, isPinned: p.isPinned } : m));
  });

  async function send() {
    if (!body.trim() || sending) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    try {
      const s = getSocket();
      if (s?.connected) {
        s.emit("chat:message", { roomId, body: text }, (ack: any) => {
          if (!ack?.ok) console.error("Send failed:", ack?.error);
        });
      } else {
        const msg = await api<Msg>(`/erp-chat/rooms/${roomId}/messages`, { method: "POST", body: { body: text } });
        setMessages((prev) => [...prev, msg]);
      }
    } catch {}
    setSending(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); return; }
    // typing event
    const s = getSocket();
    if (s) s.emit("chat:typing", roomId);
  }

  async function togglePin(msgId: string) {
    await api(`/erp-chat/messages/${msgId}/pin`, { method: "POST" });
  }

  async function loadPinned() {
    const p = await api<Msg[]>(`/erp-chat/rooms/${roomId}/pinned`);
    setPinned(p);
    setShowPinned(true);
  }

  async function doSearch(q: string) {
    setSearchQ(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const r = await api<Msg[]>(`/erp-chat/rooms/${roomId}/search?q=${encodeURIComponent(q)}`);
    setSearchResults(r);
  }

  // Group messages by date
  const grouped: { date: string; msgs: Msg[] }[] = [];
  messages.forEach((m) => {
    const d = new Date(m.createdAt).toDateString();
    const last = grouped[grouped.length - 1];
    if (last?.date === d) last.msgs.push(m);
    else grouped.push({ date: d, msgs: [m] });
  });

  const roomName = room?.name ?? "Conversation";

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
        <Link to="/erp/chat" className="lg:hidden text-gray-400 hover:text-[#0F1E3C] transition-colors mr-1">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F1E3C] text-[10px] font-bold text-[#FFD166] shrink-0">
          {initials(roomName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{roomName}</p>
          {typing.length > 0 ? (
            <p className="text-xs text-blue-500 animate-pulse">En train d'écrire…</p>
          ) : (
            <p className="text-xs text-gray-400">
              {messages.length > 0 ? `${messages.length} message${messages.length > 1 ? "s" : ""}` : "Aucun message"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSearch(!showSearch)}
            className={`rounded-xl p-2 transition-colors ${showSearch ? "bg-[#0F1E3C] text-white" : "text-gray-400 hover:bg-gray-50 hover:text-[#0F1E3C]"}`}>
            <Search size={16} />
          </button>
          <button onClick={loadPinned}
            className={`rounded-xl p-2 transition-colors ${showPinned ? "bg-[#0F1E3C] text-white" : "text-gray-400 hover:bg-gray-50 hover:text-[#0F1E3C]"}`}>
            <Pin size={16} />
          </button>
        </div>
      </div>

      {/* ── Search bar ─────────────────────────────────────────── */}
      {showSearch && (
        <div className="border-b border-gray-100 bg-white px-4 py-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={searchQ} onChange={(e) => doSearch(e.target.value)}
              placeholder='Rechercher "examen", "devoir"…'
              className="w-full rounded-xl bg-gray-50 pl-8 pr-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#0F1E3C]/10" autoFocus />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 space-y-1 pb-1 max-h-48 overflow-y-auto">
              <p className="text-[10px] text-gray-400 mb-1">{searchResults.length} résultat{searchResults.length > 1 ? "s" : ""}</p>
              {searchResults.map((m) => (
                <div key={m.id} className="rounded-xl bg-yellow-50 border border-yellow-100 px-3 py-2 text-sm">
                  <p className="text-[11px] font-medium text-yellow-700 mb-0.5">{m.sender.firstName} · {fmtTime(m.createdAt)}</p>
                  <p className="text-gray-700">{m.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Pinned panel ───────────────────────────────────────── */}
      {showPinned && (
        <div className="border-b border-gray-100 bg-amber-50 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-amber-700 flex items-center gap-1"><Pin size={12} /> Messages épinglés</p>
            <button onClick={() => setShowPinned(false)} className="text-gray-400"><X size={14} /></button>
          </div>
          {pinned.length === 0 ? (
            <p className="text-xs text-gray-400">Aucun message épinglé.</p>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {pinned.map((m) => (
                <div key={m.id} className="flex items-start gap-2 rounded-xl bg-white border border-amber-100 px-3 py-2">
                  <Pin size={11} className="text-amber-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-gray-600">{m.sender.firstName} {m.sender.lastName}</p>
                    <p className="text-sm text-gray-800 truncate">{m.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Messages ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-gray-300">
            <MessageSquare size={40} className="mb-2" />
            <p className="text-sm font-medium text-gray-400">Aucun message. Soyez le premier à écrire !</p>
          </div>
        ) : (
          grouped.map(({ date, msgs }) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 border-t border-gray-100" />
                <span className="text-[11px] font-medium text-gray-400 bg-[#F8FAFC] px-2">{fmtDate(msgs[0].createdAt)}</span>
                <div className="flex-1 border-t border-gray-100" />
              </div>

              {msgs.map((m, i) => {
                const isMe = m.senderId === user?.id;
                const prevMsg = i > 0 ? msgs[i - 1] : null;
                const sameAsPrev = prevMsg?.senderId === m.senderId && !m.isSystem;
                return (
                  <MessageBubble key={m.id} msg={m} isMe={isMe} grouped={sameAsPrev} onPin={() => togglePin(m.id)} />
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 bg-white px-4 py-3">
        <div className="flex items-end gap-3">
          <div className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 focus-within:border-[#0F1E3C] focus-within:bg-white transition-all">
            <textarea
              ref={inputRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Écrire un message… (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)"
              className="w-full resize-none bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              style={{ maxHeight: "120px", overflowY: "auto" }}
            />
          </div>
          <button
            onClick={send}
            disabled={!body.trim() || sending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0F1E3C] text-white hover:bg-[#1B3A6B] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-gray-300 px-1">
          Entrée pour envoyer · Maj+Entrée pour sauter une ligne
        </p>
      </div>
    </div>
  );
}

// ─── Message bubble ─────────────────────────────────────────────────────────

function MessageBubble({ msg, isMe, grouped, onPin }: { msg: Msg; isMe: boolean; grouped: boolean; onPin: () => void }) {
  const [hover, setHover] = useState(false);

  if (msg.isSystem) {
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <div className="rounded-xl bg-[#0F1E3C]/5 border border-[#0F1E3C]/10 px-4 py-2 text-xs text-[#0F1E3C]/70 flex items-center gap-1.5 max-w-md text-center">
          <Bot size={12} className="shrink-0 text-[#0F1E3C]" />{msg.body}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""} ${grouped ? "mt-0.5" : "mt-3"}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Avatar */}
      {!isMe && (
        <div className={`shrink-0 ${grouped ? "invisible" : ""}`}>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0F1E3C] text-[9px] font-bold text-[#FFD166]">
            {initials(`${msg.sender.firstName} ${msg.sender.lastName}`)}
          </div>
        </div>
      )}

      <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[70%]`}>
        {/* Sender name */}
        {!grouped && !isMe && (
          <p className="mb-1 text-[11px] font-semibold text-gray-500 px-1">
            {msg.sender.firstName} {msg.sender.lastName}
          </p>
        )}

        {/* Bubble */}
        <div className="relative group">
          {msg.fileUrl ? (
            <FileBubble msg={msg} isMe={isMe} />
          ) : (
            <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
              isMe
                ? "rounded-br-sm bg-[#0F1E3C] text-white"
                : "rounded-bl-sm bg-white border border-gray-100 text-gray-800"
            } ${msg.isPinned ? "ring-2 ring-amber-400/60" : ""}`}>
              <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>
            </div>
          )}

          {/* Pinned indicator */}
          {msg.isPinned && (
            <span className="absolute -top-2 left-2 flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-white">
              <Pin size={8} /> Épinglé
            </span>
          )}

          {/* Actions on hover */}
          {hover && (
            <button onClick={onPin}
              className={`absolute top-1 ${isMe ? "left-0 -translate-x-full -ml-1" : "right-0 translate-x-full ml-1"} opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm text-gray-400 hover:text-amber-500 hover:border-amber-200 transition-all`}>
              <Pin size={12} />
            </button>
          )}
        </div>

        {/* Timestamp + read status */}
        <div className={`mt-0.5 flex items-center gap-1 px-1 ${isMe ? "flex-row-reverse" : ""}`}>
          <span className="text-[10px] text-gray-400">{fmtTime(msg.createdAt)}</span>
          {isMe && (
            msg.isRead
              ? <CheckCheck size={11} className="text-blue-500" />
              : <Check size={11} className="text-gray-300" />
          )}
        </div>
      </div>
    </div>
  );
}

function FileBubble({ msg, isMe }: { msg: Msg; isMe: boolean }) {
  const colorCls = FILE_ICON[msg.fileType ?? "default"] ?? FILE_ICON.default;
  const FileIcon = msg.fileType === "image" ? ImageIcon : File;
  return (
    <a href={msg.fileUrl!} target="_blank" rel="noopener noreferrer"
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm hover:shadow-md transition-shadow ${
        isMe ? "bg-[#0F1E3C] border-transparent text-white" : "bg-white border-gray-100 text-gray-800"
      }`}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isMe ? "bg-white/10" : "bg-gray-50"}`}>
        <FileIcon size={16} className={isMe ? "text-white" : colorCls} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{msg.fileName ?? "Fichier"}</p>
        <p className={`text-[11px] ${isMe ? "text-white/60" : "text-gray-400"}`}>{msg.fileType?.toUpperCase() ?? "FICHIER"}</p>
      </div>
      <Download size={14} className={isMe ? "text-white/60" : "text-gray-400"} />
    </a>
  );
}

