import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Check, Trash2, Reply, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type CommentAuthor = { firstName: string; lastName: string; systemRole: string; avatarUrl?: string | null };
type Comment = {
  id: string;
  content: string;
  isAdminNote: boolean;
  resolved: boolean;
  createdAt: string;
  author: CommentAuthor;
  replies: Comment[];
  parentId: string | null;
};

const inp = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function CourseComments({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newText, setNewText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["course-comments", courseId],
    queryFn: () => api<Comment[]>(`/online/studio/courses/${courseId}/comments`),
  });

  const add = useMutation({
    mutationFn: (body: { content: string; parentId?: string }) =>
      api(`/online/studio/courses/${courseId}/comments`, { method: "POST", body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["course-comments", courseId] }); setNewText(""); setReplyText(""); setReplyTo(null); },
    onError: () => toast.error("Erreur"),
  });

  const resolve = useMutation({
    mutationFn: (commentId: string) =>
      api(`/online/studio/comments/${commentId}/resolve`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course-comments", courseId] }),
  });

  const del = useMutation({
    mutationFn: (commentId: string) =>
      api(`/online/studio/comments/${commentId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course-comments", courseId] }),
  });

  return (
    <div className="max-w-xl space-y-4">
      {/* New comment */}
      <div className="rounded-xl border bg-card p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Nouveau commentaire</p>
        <textarea value={newText} onChange={e => setNewText(e.target.value)}
          rows={3} className={`${inp} resize-none`}
          placeholder="Laissez un commentaire, une note de révision…" />
        <button onClick={() => add.mutate({ content: newText })} disabled={!newText.trim() || add.isPending}
          className="flex items-center gap-2 rounded-lg grad-online px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
          Envoyer
        </button>
      </div>

      {/* Comments list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : comments.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Aucun commentaire.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map(c => (
            <CommentCard key={c.id} comment={c}
              currentUserId={user?.id}
              onReply={() => setReplyTo(c.id)}
              onResolve={() => resolve.mutate(c.id)}
              onDelete={() => del.mutate(c.id)}
              replyOpen={replyTo === c.id}
              replyText={replyText}
              onReplyTextChange={setReplyText}
              onSubmitReply={() => { if (replyText.trim()) add.mutate({ content: replyText, parentId: c.id }); }}
              adding={add.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentCard({
  comment: c, currentUserId, onReply, onResolve, onDelete,
  replyOpen, replyText, onReplyTextChange, onSubmitReply, adding,
}: {
  comment: Comment;
  currentUserId?: string;
  onReply: () => void;
  onResolve: () => void;
  onDelete: () => void;
  replyOpen: boolean;
  replyText: string;
  onReplyTextChange: (v: string) => void;
  onSubmitReply: () => void;
  adding: boolean;
}) {
  const isAdmin = c.author.systemRole === "SUPER_ADMIN";
  const inp = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${c.resolved ? "opacity-60" : ""} ${c.isAdminNote ? "border-online/30 bg-online/5" : "bg-card"}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isAdmin ? "bg-online text-white" : "bg-muted text-muted-foreground"}`}>
          {c.author.firstName[0]}{c.author.lastName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{c.author.firstName} {c.author.lastName}</span>
            {isAdmin && (
              <span className="flex items-center gap-0.5 rounded-full bg-online/10 px-2 py-0.5 text-[10px] font-medium text-online">
                <ShieldCheck className="h-2.5 w-2.5" /> Admin
              </span>
            )}
            {c.resolved && <span className="text-[10px] text-green-600">✓ Résolu</span>}
          </div>
          <p className="mt-1 text-sm">{c.content}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleString("fr")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!c.resolved && (
            <button onClick={onResolve} className="rounded p-1 text-muted-foreground hover:bg-accent" title="Marquer résolu">
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onReply} className="rounded p-1 text-muted-foreground hover:bg-accent">
            <Reply className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Replies */}
      {c.replies.length > 0 && (
        <div className="ml-11 space-y-2 border-l-2 border-muted pl-3">
          {c.replies.map(r => (
            <div key={r.id} className="flex items-start gap-2">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${r.author.systemRole === "SUPER_ADMIN" ? "bg-online text-white" : "bg-muted text-muted-foreground"}`}>
                {r.author.firstName[0]}{r.author.lastName[0]}
              </div>
              <div>
                <span className="text-xs font-medium">{r.author.firstName} {r.author.lastName}</span>
                <p className="text-xs text-muted-foreground">{r.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      {replyOpen && (
        <div className="ml-11 flex gap-2">
          <input value={replyText} onChange={e => onReplyTextChange(e.target.value)}
            className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
            placeholder="Votre réponse…" autoFocus />
          <button onClick={onSubmitReply} disabled={!replyText.trim() || adding}
            className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50">
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Répondre"}
          </button>
        </div>
      )}
    </div>
  );
}
