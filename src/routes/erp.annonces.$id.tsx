import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  ArrowLeft, Pin, Paperclip, MessageSquare, Eye, CheckCircle2,
  Download, Trash2, Send, Users, BarChart3, Clock, AlertTriangle,
  Calendar, Bell, Megaphone,
} from "lucide-react";
import { useErpAuth } from "./erp";

export const Route = createFileRoute("/erp/annonces/$id")({
  component: AnnouncementDetail,
});

type Author = { id: string; firstName: string; lastName: string; systemRole: string };
type Attachment = { id: string; name: string; url: string; mimeType: string; sizeBytes: number | null };
type Comment = { id: string; content: string; createdAt: string; author: Author };
type ReadEntry = { user: Author; seenAt: string | null; readAt: string | null; confirmedAt: string | null };
type Stats = {
  totalRecipients: number; seen: number; read: number; confirmed: number;
  unread: number; readRate: number; comments: number; attachmentDownloads: number;
  readers: ReadEntry[];
};
type Announcement = {
  id: string; title: string; content: string;
  category: string; priority: string; status: string; channels: string[];
  isPinned: boolean; publishAt: string; expiresAt: string | null;
  targetAll: boolean; targetRoles: string[]; authorId: string;
  author: Author;
  mention: { name: string } | null;
  promotion: { name: string; level: string } | null;
  attachments: Attachment[];
  reads: { seenAt: string | null; readAt: string | null; confirmedAt: string | null }[];
  comments: Comment[];
  _count: { reads: number; comments: number };
};

const CATEGORY_STYLE: Record<string, { label: string; cls: string }> = {
  GENERAL:        { label: "Général",       cls: "bg-gray-100 text-gray-600" },
  URGENT:         { label: "Urgent",        cls: "bg-red-100 text-red-700" },
  EXAM:           { label: "Examen",        cls: "bg-purple-100 text-purple-700" },
  EVENT:          { label: "Événement",     cls: "bg-blue-100 text-blue-700" },
  MEETING:        { label: "Réunion",       cls: "bg-yellow-100 text-yellow-700" },
  SCHOLARSHIP:    { label: "Bourse",        cls: "bg-green-100 text-green-700" },
  ADMINISTRATIVE: { label: "Administratif", cls: "bg-orange-100 text-orange-700" },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fileIcon(mime: string) {
  if (mime.includes("pdf")) return "📄";
  if (mime.includes("image")) return "🖼️";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  if (mime.includes("sheet") || mime.includes("excel")) return "📊";
  return "📎";
}

export default function AnnouncementDetail() {
  const { id } = Route.useParams();
  const { user } = useErpAuth();
  const nav = useNavigate();

  const [ann, setAnn] = useState<Announcement | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const isAdmin = user?.systemRole === "SUPER_ADMIN" || user?.systemRole === "STAFF";
  const isAuthor = ann?.authorId === user?.id;

  useEffect(() => {
    api<Announcement>(`/announcements/${id}`)
      .then((a) => {
        setAnn(a);
        setConfirmed(!!a.reads?.[0]?.confirmedAt);
      })
      .catch(() => nav({ to: "/erp/annonces" }))
      .finally(() => setLoading(false));
  }, [id]);

  async function loadStats() {
    if (stats) { setShowStats(!showStats); return; }
    const s = await api<Stats>(`/announcements/${id}/stats`);
    setStats(s);
    setShowStats(true);
  }

  async function handleConfirm() {
    await api(`/announcements/${id}/confirm`, { method: "POST" });
    setConfirmed(true);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSendingComment(true);
    try {
      const c = await api<Comment>(`/announcements/${id}/comments`, {
        method: "POST",
        body: { content: newComment },
      });
      setAnn((prev) => prev ? { ...prev, comments: [...prev.comments, c], _count: { ...prev._count, comments: prev._count.comments + 1 } } : prev);
      setNewComment("");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSendingComment(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!confirm("Supprimer ce commentaire ?")) return;
    await api(`/announcements/comments/${commentId}`, { method: "DELETE" });
    setAnn((prev) => prev ? {
      ...prev,
      comments: prev.comments.filter((c) => c.id !== commentId),
      _count: { ...prev._count, comments: prev._count.comments - 1 },
    } : prev);
  }

  async function deleteAnnouncement() {
    if (!confirm("Supprimer cette annonce définitivement ?")) return;
    await api(`/announcements/${id}`, { method: "DELETE" });
    nav({ to: "/erp/annonces" });
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0F1E3C] border-t-[#FFD166]" />
    </div>
  );
  if (!ann) return null;

  const cat = CATEGORY_STYLE[ann.category] ?? CATEGORY_STYLE.GENERAL;
  const isRead = !!ann.reads?.[0]?.readAt;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link to="/erp/annonces" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#0F1E3C] transition-colors">
        <ArrowLeft size={15} /> Retour aux annonces
      </Link>

      {/* Main card */}
      <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${ann.priority === "CRITICAL" ? "border-red-200" : "border-gray-100"}`}>
        {/* Priority banner */}
        {ann.priority !== "NORMAL" && (
          <div className={`px-6 py-3 text-xs font-bold uppercase tracking-widest ${ann.priority === "CRITICAL" ? "bg-red-600 text-white" : "bg-orange-500 text-white"}`}>
            {ann.priority === "CRITICAL" ? "⚠️ Annonce critique" : "⚡ Annonce importante"}
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${cat.cls}`}>
              {cat.label}
            </span>
            {ann.isPinned && <span className="text-sm">📌</span>}
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              ann.status === "PUBLISHED" ? "bg-green-100 text-green-700"
              : ann.status === "SCHEDULED" ? "bg-blue-100 text-blue-700"
              : ann.status === "DRAFT" ? "bg-gray-100 text-gray-500"
              : "bg-red-100 text-red-600"
            }`}>
              {ann.status === "PUBLISHED" ? "Publié" : ann.status === "SCHEDULED" ? "Programmé" : ann.status === "DRAFT" ? "Brouillon" : "Archivé"}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900">{ann.title}</h1>

          {/* Author + date */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F1E3C] text-xs font-bold text-[#FFD166]">
              {ann.author.firstName[0]}{ann.author.lastName[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{ann.author.firstName} {ann.author.lastName}</p>
              <p className="text-xs text-gray-400">{fmt(ann.publishAt)}</p>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1 text-xs text-gray-400">
              <span className="flex items-center gap-1"><Users size={11} />
                {ann.targetAll ? "Tous" : ann.mention?.name ?? ann.promotion?.name ?? ann.targetRoles.join(", ")}
              </span>
              {ann.expiresAt && (
                <span className="flex items-center gap-1 text-orange-500"><Clock size={11} /> Expire le {new Date(ann.expiresAt).toLocaleDateString("fr-FR")}</span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap border-t border-gray-50 pt-5">
            {ann.content}
          </div>

          {/* Attachments */}
          {ann.attachments.length > 0 && (
            <div className="space-y-2 border-t border-gray-50 pt-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700"><Paperclip size={14} /> Pièces jointes</p>
              {ann.attachments.map((att) => (
                <a key={att.id} href={att.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 px-4 py-3 hover:border-[#0F1E3C] hover:bg-gray-50 transition-all group">
                  <span className="text-lg">{fileIcon(att.mimeType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{att.name}</p>
                    {att.sizeBytes && <p className="text-xs text-gray-400">{(att.sizeBytes / 1024).toFixed(0)} KB</p>}
                  </div>
                  <Download size={14} className="shrink-0 text-gray-300 group-hover:text-[#0F1E3C] transition-colors" />
                </a>
              ))}
            </div>
          )}

          {/* Read confirmation */}
          {!confirmed && (
            <div className="rounded-xl border border-[#0F1E3C]/20 bg-[#0F1E3C]/5 p-4 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-[#0F1E3C] shrink-0" />
              <p className="text-sm text-[#0F1E3C] flex-1">Confirmez la lecture de cette annonce.</p>
              <button onClick={handleConfirm}
                className="shrink-0 rounded-lg bg-[#0F1E3C] px-4 py-2 text-xs font-bold text-white hover:bg-[#1B3A6B] transition-colors">
                J'ai lu ✓
              </button>
            </div>
          )}
          {confirmed && (
            <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
              <CheckCircle2 size={16} /> Lecture confirmée
            </div>
          )}
        </div>
      </div>

      {/* Stats (admin / author) */}
      {(isAdmin || isAuthor) && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <button onClick={loadStats}
            className="flex w-full items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900"><BarChart3 size={18} /> Statistiques</h2>
            <span className="text-xs text-gray-400">{showStats ? "Masquer" : "Afficher"}</span>
          </button>

          {showStats && stats && (
            <div className="border-t border-gray-50 p-6 space-y-5">
              {/* KPI row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Destinataires", value: stats.totalRecipients, color: "text-gray-900" },
                  { label: "Lus",           value: stats.read,            color: "text-green-600" },
                  { label: "Non lus",       value: stats.unread,          color: "text-orange-500" },
                  { label: "Taux de lecture", value: `${stats.readRate}%`, color: "text-[#0F1E3C]" },
                ].map((k) => (
                  <div key={k.label} className="rounded-xl bg-gray-50 p-4 text-center">
                    <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>Taux de lecture</span><span>{stats.readRate}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-[#0F1E3C] transition-all" style={{ width: `${stats.readRate}%` }} />
                </div>
              </div>

              {/* Readers table */}
              {stats.readers.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-50 text-xs text-gray-400">
                        <th className="px-4 py-2.5 text-left">Utilisateur</th>
                        <th className="px-4 py-2.5 text-center">Lu</th>
                        <th className="px-4 py-2.5 text-left">Heure</th>
                        <th className="px-4 py-2.5 text-center">Confirmé</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {stats.readers.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-gray-900">{r.user.firstName} {r.user.lastName}</td>
                          <td className="px-4 py-3 text-center">
                            {r.readAt ? <span className="text-green-500">✅</span> : <span className="text-gray-300">❌</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {r.readAt ? new Date(r.readAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {r.confirmedAt ? <CheckCircle2 size={14} className="text-green-500 mx-auto" /> : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Comments */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-50 px-6 py-4">
          <MessageSquare size={17} />
          <h2 className="font-semibold text-gray-900">Commentaires</h2>
          <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{ann._count.comments}</span>
        </div>

        <div className="divide-y divide-gray-50">
          {ann.comments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <MessageSquare size={28} className="mb-2 opacity-30" />
              <p className="text-sm">Aucun commentaire pour le moment.</p>
            </div>
          )}
          {ann.comments.map((c) => (
            <div key={c.id} className="px-6 py-4 flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F1E3C] text-xs font-bold text-[#FFD166]">
                {c.author.firstName[0]}{c.author.lastName[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-900">{c.author.firstName} {c.author.lastName}</p>
                  <span className="text-xs text-gray-400">{fmt(c.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700">{c.content}</p>
              </div>
              {(c.author.id === user?.id || isAdmin) && (
                <button onClick={() => deleteComment(c.id)}
                  className="shrink-0 self-start rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Comment form */}
        <div className="border-t border-gray-50 px-6 py-4">
          <form onSubmit={submitComment} className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F1E3C] text-xs font-bold text-[#FFD166]">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex flex-1 gap-2">
              <input value={newComment} onChange={(e) => setNewComment(e.target.value)}
                placeholder="Écrire un commentaire…"
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm outline-none focus:border-[#0F1E3C] focus:ring-2 focus:ring-[#0F1E3C]/10" />
              <button type="submit" disabled={sendingComment || !newComment.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-[#0F1E3C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1B3A6B] transition-colors disabled:opacity-60">
                <Send size={14} />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Danger zone */}
      {(isAdmin || isAuthor) && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-red-800 text-sm">Zone de danger</p>
            <p className="text-xs text-red-500 mt-0.5">La suppression est irréversible.</p>
          </div>
          <button onClick={deleteAnnouncement}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors">
            <Trash2 size={15} /> Supprimer
          </button>
        </div>
      )}
    </div>
  );
}
