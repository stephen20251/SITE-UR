import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  Bell, Pin, Plus, Filter, Search, Eye, MessageSquare,
  Paperclip, Clock, AlertTriangle, Calendar, Users, Megaphone,
  ChevronRight, CheckCircle2,
} from "lucide-react";
import { useErpAuth } from "./erp";

export const Route = createFileRoute("/erp/annonces/")({
  component: AnnoncesPage,
});

type Author = { id: string; firstName: string; lastName: string; systemRole: string };
type Announcement = {
  id: string; title: string; content: string;
  category: string; priority: string; status: string; channels: string[];
  isPinned: boolean; publishAt: string; expiresAt: string | null;
  targetAll: boolean; targetRoles: string[]; mentionId: string | null; promotionId: string | null;
  author: Author;
  mention: { name: string; code: string } | null;
  promotion: { name: string; level: string } | null;
  attachments: { id: string; name: string; mimeType: string }[];
  reads: { seenAt: string | null; readAt: string | null }[];
  _count: { reads: number; comments: number };
};

const CATEGORY_STYLE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  GENERAL:        { label: "Général",       cls: "bg-gray-100 text-gray-600",    icon: <Megaphone size={11} /> },
  URGENT:         { label: "Urgent",        cls: "bg-red-100 text-red-700",      icon: <AlertTriangle size={11} /> },
  EXAM:           { label: "Examen",        cls: "bg-purple-100 text-purple-700",icon: <CheckCircle2 size={11} /> },
  EVENT:          { label: "Événement",     cls: "bg-blue-100 text-blue-700",    icon: <Calendar size={11} /> },
  MEETING:        { label: "Réunion",       cls: "bg-yellow-100 text-yellow-700",icon: <Users size={11} /> },
  SCHOLARSHIP:    { label: "Bourse",        cls: "bg-green-100 text-green-700",  icon: <Bell size={11} /> },
  ADMINISTRATIVE: { label: "Administratif", cls: "bg-orange-100 text-orange-700",icon: <Megaphone size={11} /> },
};

const PRIORITY_DOT: Record<string, string> = {
  NORMAL:    "bg-gray-400",
  IMPORTANT: "bg-orange-400",
  CRITICAL:  "bg-red-500 animate-pulse",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

function targetLabel(ann: Announcement) {
  if (ann.targetAll) return "Tous les utilisateurs";
  if (ann.mention) return ann.mention.name;
  if (ann.promotion) return `${ann.promotion.name} — ${ann.promotion.level}`;
  if (ann.targetRoles.length) return ann.targetRoles.join(", ");
  return "—";
}

export default function AnnoncesPage() {
  const { user, roles } = useErpAuth();
  const isAdmin = user?.systemRole === "SUPER_ADMIN" || user?.systemRole === "STAFF";

  const [items, setItems] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStatus, setFilterStatus] = useState(isAdmin ? "" : "PUBLISHED");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCat) params.set("category", filterCat);
    if (filterStatus) params.set("status", filterStatus);
    api<{ total: number; items: Announcement[] }>(`/announcements?${params}`)
      .then((r) => { setItems(r.items); setTotal(r.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filterCat, filterStatus]);

  const displayed = search
    ? items.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase()))
    : items;

  const pinned = displayed.filter((a) => a.isPinned);
  const unpinned = displayed.filter((a) => !a.isPinned);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Annonces</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} annonce{total !== 1 ? "s" : ""}</p>
        </div>
        {isAdmin && (
          <Link to="/erp/annonces/creer"
            className="flex items-center gap-2 rounded-xl bg-[#0F1E3C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1B3A6B] transition-colors">
            <Plus size={16} />
            Nouvelle annonce
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#0F1E3C] focus:ring-2 focus:ring-[#0F1E3C]/10" />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-[#0F1E3C]">
          <option value="">Toutes catégories</option>
          {Object.entries(CATEGORY_STYLE).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {isAdmin && (
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-[#0F1E3C]">
            <option value="">Tous statuts</option>
            <option value="DRAFT">Brouillon</option>
            <option value="SCHEDULED">Programmé</option>
            <option value="PUBLISHED">Publié</option>
            <option value="ARCHIVED">Archivé</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0F1E3C] border-t-[#FFD166]" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16 text-gray-400">
          <Megaphone size={40} className="mb-3 opacity-30" />
          <p className="font-medium">Aucune annonce</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pinned */}
          {pinned.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <Pin size={12} /> Épinglées
              </p>
              {pinned.map((ann) => <AnnouncementCard key={ann.id} ann={ann} isAdmin={isAdmin} />)}
            </div>
          )}
          {/* Regular */}
          {unpinned.map((ann) => <AnnouncementCard key={ann.id} ann={ann} isAdmin={isAdmin} />)}
        </div>
      )}
    </div>
  );
}

function AnnouncementCard({ ann, isAdmin }: { ann: Announcement; isAdmin: boolean }) {
  const cat = CATEGORY_STYLE[ann.category] ?? CATEGORY_STYLE.GENERAL;
  const isRead = ann.reads?.length > 0 && ann.reads[0].readAt != null;

  return (
    <Link to="/erp/annonces/$id" params={{ id: ann.id }}
      className={`block rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-all group ${ann.priority === "CRITICAL" ? "border-red-200" : "border-gray-100"}`}>
      <div className="flex items-start gap-4">
        {/* Priority dot */}
        <div className="mt-1.5 flex shrink-0 flex-col items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${PRIORITY_DOT[ann.priority]}`} />
          {ann.isPinned && <Pin size={12} className="text-[#FFD166]" />}
        </div>

        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cat.cls}`}>
              {cat.icon} {cat.label}
            </span>
            {isAdmin && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                ann.status === "PUBLISHED" ? "bg-green-100 text-green-700"
                : ann.status === "SCHEDULED" ? "bg-blue-100 text-blue-700"
                : ann.status === "DRAFT" ? "bg-gray-100 text-gray-500"
                : "bg-red-100 text-red-600"
              }`}>
                {ann.status === "PUBLISHED" ? "Publié" : ann.status === "SCHEDULED" ? "Programmé" : ann.status === "DRAFT" ? "Brouillon" : "Archivé"}
              </span>
            )}
            <span className="text-xs text-gray-400 ml-auto">{timeAgo(ann.publishAt)}</span>
          </div>

          {/* Title */}
          <h3 className={`font-semibold text-gray-900 group-hover:text-[#0F1E3C] transition-colors ${!isRead ? "font-bold" : ""}`}>
            {!isRead && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#0F1E3C] align-middle" />}
            {ann.title}
          </h3>

          {/* Excerpt */}
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{ann.content.replace(/<[^>]*>/g, "")}</p>

          {/* Footer */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-400">
            <span>{ann.author.firstName} {ann.author.lastName}</span>
            <span className="flex items-center gap-1"><Users size={11} /> {targetLabel(ann)}</span>
            <span className="flex items-center gap-1"><Eye size={11} /> {ann._count.reads}</span>
            <span className="flex items-center gap-1"><MessageSquare size={11} /> {ann._count.comments}</span>
            {ann.attachments.length > 0 && (
              <span className="flex items-center gap-1"><Paperclip size={11} /> {ann.attachments.length}</span>
            )}
            {ann.expiresAt && (
              <span className="flex items-center gap-1 text-orange-500"><Clock size={11} /> Exp. {new Date(ann.expiresAt).toLocaleDateString("fr-FR")}</span>
            )}
          </div>
        </div>

        <ChevronRight size={16} className="shrink-0 text-gray-300 group-hover:text-[#0F1E3C] transition-colors mt-1" />
      </div>
    </Link>
  );
}
