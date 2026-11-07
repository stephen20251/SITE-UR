/**
 * ContactPanel — right sidebar showing contact info + quick actions.
 */
import { Mail, Phone, Video, X } from "lucide-react";
import type { ChatRoomCard } from "@/lib/chat";
import { initials } from "@/components/online/shared";

const ROLE_LABEL: Record<string, string> = {
  STUDENT_ONLINE: "Étudiant(e)",
  TEACHER_ONLINE: "Enseignant(e)",
  SUPER_ADMIN: "Administrateur LMS",
};

export function ContactPanel({
  room,
  isOnline,
  onClose,
  onAudioCall,
  onVideoCall,
}: {
  room: ChatRoomCard;
  isOnline: boolean;
  onClose: () => void;
  onAudioCall: () => void;
  onVideoCall: () => void;
}) {
  const u = room.otherUser;
  if (!u) return null;

  return (
    <div className="flex flex-col border-l bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informations</span>
        <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-accent text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-3 p-6 border-b">
        <div className="relative">
          {(u as any).avatarUrl ? (
            <img src={(u as any).avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-full grad-online text-2xl font-bold text-white">
              {initials(u.firstName, u.lastName)}
            </div>
          )}
          <span className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-card ${isOnline ? "bg-success" : "bg-muted-foreground/30"}`} />
        </div>
        <div className="text-center">
          <div className="font-semibold">{u.firstName} {u.lastName}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{ROLE_LABEL[u.role] ?? u.role}</div>
          <div className={`mt-1 text-xs font-medium ${isOnline ? "text-success" : "text-muted-foreground"}`}>
            {isOnline ? "● En ligne" : "Hors ligne"}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="p-4 border-b">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions rapides</p>
        <div className="flex gap-2">
          <button
            onClick={onAudioCall}
            title="Appel audio"
            className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-medium hover:bg-accent transition-colors"
          >
            <Phone className="h-5 w-5 text-online" />
            Audio
          </button>
          <button
            onClick={onVideoCall}
            title="Appel vidéo"
            className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-medium hover:bg-accent transition-colors"
          >
            <Video className="h-5 w-5 text-online" />
            Vidéo
          </button>
        </div>
      </div>

      {/* Role badge */}
      <div className="p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rôle</p>
        <span className="rounded-full bg-online/10 px-3 py-1 text-xs font-medium text-online">
          {ROLE_LABEL[u.role] ?? u.role}
        </span>
      </div>
    </div>
  );
}
