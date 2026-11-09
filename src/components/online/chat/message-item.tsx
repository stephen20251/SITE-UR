/**
 * MessageItem — renders a chat message including text, images, files, audio, video.
 */
import { useState } from "react";
import { Download, FileText, Film, Volume2, File, Archive, Image as ImageIcon, X } from "lucide-react";
import type { ChatMessage } from "@/lib/chat";
import { initials } from "@/components/online/shared";
import { API_ORIGIN } from "@/lib/env";

const BASE = API_ORIGIN;

function fileIcon(mime: string | null | undefined) {
  if (!mime) return File;
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return Film;
  if (mime.startsWith("audio/")) return Volume2;
  if (mime === "application/pdf") return FileText;
  if (mime.includes("zip") || mime.includes("rar")) return Archive;
  return File;
}

function formatBytes(n?: number) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90" onClick={onClose}>
      <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
        <X className="h-5 w-5" />
      </button>
      <img src={src} alt="" className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" onClick={e => e.stopPropagation()} />
    </div>
  );
}

export function MessageItem({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  const hasFile = !!m.fileUrl;
  const isImage = m.fileType?.startsWith("image/");
  const isVideo = m.fileType?.startsWith("video/");
  const isAudio = m.fileType?.startsWith("audio/");
  const fileUrl = m.fileUrl ? `${BASE}${m.fileUrl}` : null;
  const Icon = fileIcon(m.fileType);

  return (
    <>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      <div className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
        {/* Avatar */}
        {!mine && (
          <div className="shrink-0 self-end">
            {m.sender.avatarUrl ? (
              <img src={m.sender.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full grad-online text-xs font-semibold text-white">
                {initials(m.sender.firstName, m.sender.lastName)}
              </div>
            )}
          </div>
        )}

        {/* Bubble */}
        <div className={`max-w-[72%] ${mine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
          {!mine && (
            <span className="ml-1 text-[10px] font-semibold text-muted-foreground">
              {m.sender.firstName} {m.sender.lastName}
            </span>
          )}

          {/* Image */}
          {hasFile && isImage && fileUrl && (
            <button
              onClick={() => setLightbox(fileUrl)}
              className={`overflow-hidden rounded-2xl ${mine ? "rounded-tr-sm" : "rounded-tl-sm"} max-w-xs`}
            >
              <img src={fileUrl} alt={m.fileName ?? "image"} className="block max-h-56 w-full object-cover hover:opacity-90 transition-opacity" />
            </button>
          )}

          {/* Video */}
          {hasFile && isVideo && fileUrl && (
            <div className={`overflow-hidden rounded-2xl ${mine ? "rounded-tr-sm" : "rounded-tl-sm"} max-w-xs`}>
              <video src={fileUrl} controls className="block max-h-48 w-full" />
            </div>
          )}

          {/* Audio */}
          {hasFile && isAudio && fileUrl && (
            <div className={`rounded-2xl ${mine ? "rounded-tr-sm grad-online text-white" : "rounded-tl-sm bg-muted"} px-3 py-2`}>
              <audio src={fileUrl} controls className="w-56 max-w-full" />
            </div>
          )}

          {/* Generic file */}
          {hasFile && !isImage && !isVideo && !isAudio && fileUrl && (
            <a
              href={fileUrl}
              download={m.fileName ?? "fichier"}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm ${mine ? "rounded-tr-sm grad-online text-white border-transparent" : "rounded-tl-sm bg-muted border-border"} max-w-xs`}
            >
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${mine ? "bg-white/20" : "bg-background"}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{m.fileName ?? "Fichier"}</div>
              </div>
              <Download className="h-4 w-4 shrink-0 opacity-70" />
            </a>
          )}

          {/* Text body (even when file exists, body might be non-empty) */}
          {(m.body && (!hasFile || (m.body !== (m.fileName ?? "Fichier")))) && (
            <div className={`rounded-2xl px-4 py-2.5 text-sm ${mine ? "rounded-tr-sm grad-online text-white" : "rounded-tl-sm bg-muted"}`}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
            </div>
          )}

          <span className={`mt-0.5 text-[10px] text-muted-foreground ${mine ? "text-right mr-1" : "ml-1"}`}>
            {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </>
  );
}
