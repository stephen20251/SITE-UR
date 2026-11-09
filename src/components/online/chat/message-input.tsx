/**
 * MessageInput — rich input: text, emoji, file attach, drag-and-drop.
 */
import { useRef, useState, useCallback, useEffect } from "react";
import { Send, Paperclip, Smile, X, Loader2 } from "lucide-react";
import { API_ORIGIN } from "@/lib/env";

// Curated emoji palette (no external dependency)
const EMOJI_ROWS = [
  ["😀","😂","🤣","😊","😍","🥰","😎","🤔","😅","😭","😤","🥺","😱","🤩","😴","🥳"],
  ["👍","👎","👏","🙌","🤝","🤜","💪","✌️","🫶","❤️","🧡","💛","💚","💙","💜","🖤"],
  ["🎉","🎊","🔥","✨","💫","⭐","🌟","💥","❗","❓","💯","🆙","📌","📎","🔗","📝"],
  ["📚","🎓","📖","🏆","🥇","🎯","💡","🔑","🛡️","⚙️","🖥️","📱","💻","🎵","🎤","🎬"],
];

type UploadState = {
  progress: number;
  name: string;
  xhr: XMLHttpRequest;
};

export function MessageInput({
  roomId,
  onMessageSent,
  onTyping,
  disabled = false,
}: {
  roomId: string;
  onMessageSent: (msg: unknown) => void;
  onTyping?: () => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [dragging, setDragging] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 128) + "px";
  }, [draft]);

  const insertEmoji = (emoji: string) => {
    setDraft(d => d + emoji);
    setEmojiOpen(false);
    textRef.current?.focus();
  };

  const sendText = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    try {
      const tok = localStorage.getItem("us.accessToken");
      const res = await fetch(`${API_ORIGIN}/api/chat/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ body: text }),
      });
      const msg = await res.json();
      if (!res.ok) throw new Error(msg.error ?? "Erreur");
      onMessageSent(msg);
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  }, [draft, roomId, onMessageSent, sending]);

  const uploadFile = useCallback((file: File) => {
    const tok = localStorage.getItem("us.accessToken");
    const fd = new FormData();
    fd.append("file", file);
    if (draft.trim()) { fd.append("body", draft.trim()); setDraft(""); }

    const xhr = new XMLHttpRequest();
    setUpload({ progress: 0, name: file.name, xhr });

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) setUpload(u => u ? { ...u, progress: Math.round((e.loaded / e.total) * 100) } : null);
    };
    xhr.onload = () => {
      setUpload(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        try { onMessageSent(JSON.parse(xhr.responseText)); } catch {}
      }
    };
    xhr.onerror = () => setUpload(null);

    xhr.open("POST", `${API_ORIGIN}/api/chat/rooms/${roomId}/upload`);
    if (tok) xhr.setRequestHeader("Authorization", `Bearer ${tok}`);
    xhr.send(fd);
  }, [roomId, draft, onMessageSent]);

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    uploadFile(files[0]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); }
  };

  return (
    <div
      className={`border-t transition-colors ${dragging ? "bg-online/5 border-online" : "bg-background"}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
    >
      {/* Upload progress bar */}
      {upload && (
        <div className="border-b px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="flex-1 truncate text-xs text-muted-foreground">{upload.name}</span>
            <span className="text-xs font-medium text-online">{upload.progress}%</span>
            <button onClick={() => { upload.xhr.abort(); setUpload(null); }} className="rounded p-0.5 hover:text-destructive">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-online transition-all" style={{ width: `${upload.progress}%` }} />
          </div>
        </div>
      )}

      {/* Drag overlay hint */}
      {dragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-b-2xl bg-online/10 border-2 border-dashed border-online pointer-events-none">
          <p className="text-sm font-medium text-online">Déposer le fichier ici</p>
        </div>
      )}

      {/* Emoji picker */}
      {emojiOpen && (
        <div className="border-b p-3">
          <div className="space-y-1">
            {EMOJI_ROWS.map((row, i) => (
              <div key={i} className="flex flex-wrap gap-0.5">
                {row.map(e => (
                  <button key={e} onClick={() => insertEmoji(e)} className="rounded p-1 text-lg hover:bg-accent leading-none">
                    {e}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 p-3">
        {/* Emoji toggle */}
        <button
          type="button"
          onClick={() => setEmojiOpen(o => !o)}
          disabled={disabled}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors hover:bg-accent disabled:opacity-40 ${emojiOpen ? "bg-accent" : ""}`}
          title="Emojis"
        >
          <Smile className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* File attach */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || !!upload}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors hover:bg-accent disabled:opacity-40"
          title="Joindre un fichier"
        >
          <Paperclip className="h-4 w-4 text-muted-foreground" />
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z"
          onChange={e => handleFiles(e.target.files)}
        />

        {/* Textarea */}
        <textarea
          ref={textRef}
          value={draft}
          onChange={e => { setDraft(e.target.value); onTyping?.(); }}
          onKeyDown={onKeyDown}
          disabled={disabled}
          rows={1}
          placeholder="Écrire un message… (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)"
          className="min-h-[36px] flex-1 resize-none overflow-hidden rounded-xl border bg-muted/40 px-3 py-2 text-sm outline-none focus:bg-background focus:ring-2 focus:ring-ring disabled:opacity-40"
        />

        {/* Send */}
        <button
          type="button"
          onClick={sendText}
          disabled={disabled || sending || !draft.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl grad-online text-white disabled:opacity-40 transition-opacity"
          title="Envoyer"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
