import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  Send, Save, Calendar, ChevronDown, X, Plus, Upload,
  Bell, Monitor, MessageSquare, LayoutDashboard, Users,
  AlertTriangle, CheckCircle2, Megaphone,
} from "lucide-react";

export const Route = createFileRoute("/erp/annonces/creer")({
  component: CreerAnnonce,
});

type Mention = { id: string; name: string; code: string };
type Promotion = { id: string; name: string; level: string };
type UserItem = { id: string; firstName: string; lastName: string; email: string };

const CATEGORIES = [
  { v: "GENERAL",        l: "Général",       icon: <Megaphone size={14} /> },
  { v: "URGENT",         l: "Urgent",        icon: <AlertTriangle size={14} /> },
  { v: "EXAM",           l: "Examen",        icon: <CheckCircle2 size={14} /> },
  { v: "EVENT",          l: "Événement",     icon: <Calendar size={14} /> },
  { v: "MEETING",        l: "Réunion",       icon: <Users size={14} /> },
  { v: "SCHOLARSHIP",    l: "Bourse",        icon: <Bell size={14} /> },
  { v: "ADMINISTRATIVE", l: "Administratif", icon: <Megaphone size={14} /> },
];

const CHANNELS = [
  { v: "DASHBOARD",     l: "Tableau de bord",        icon: <LayoutDashboard size={16} /> },
  { v: "NOTIFICATION",  l: "Notification temps réel", icon: <Bell size={16} /> },
  { v: "MOBILE",        l: "Notification mobile",     icon: <Monitor size={16} /> },
  { v: "CHAT",          l: "Chat interne",            icon: <MessageSquare size={16} /> },
  { v: "CALENDAR",      l: "Calendrier",              icon: <Calendar size={16} /> },
];

const ROLE_OPTIONS = [
  { v: "STUDENT",     l: "Tous les étudiants" },
  { v: "TEACHER",     l: "Tous les enseignants" },
  { v: "PARENT",      l: "Tous les parents" },
  { v: "STAFF",       l: "Tout le personnel" },
  { v: "SUPER_ADMIN", l: "Administrateurs" },
];

export default function CreerAnnonce() {
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [priority, setPriority] = useState("NORMAL");
  const [channels, setChannels] = useState<string[]>(["DASHBOARD", "NOTIFICATION"]);
  const [isPinned, setIsPinned] = useState(false);
  const [publishMode, setPublishMode] = useState<"now" | "scheduled">("now");
  const [publishAt, setPublishAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  // Recipients
  const [targetAll, setTargetAll] = useState(false);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [mentionId, setMentionId] = useState("");
  const [promotionId, setPromotionId] = useState("");

  // Data
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<"DRAFT" | "PUBLISHED" | "SCHEDULED">("PUBLISHED");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Mention[]>("/structure/mentions").catch(() => []),
      api<Promotion[]>("/structure/promotions").catch(() => []),
    ]).then(([m, p]) => {
      setMentions(m as Mention[]);
      setPromotions(p as Promotion[]);
    });
  }, []);

  function toggleChannel(v: string) {
    setChannels((prev) => prev.includes(v) ? prev.filter((c) => c !== v) : [...prev, v]);
  }

  function toggleRole(v: string) {
    setTargetRoles((prev) => prev.includes(v) ? prev.filter((r) => r !== v) : [...prev, v]);
  }

  async function submit(status: "DRAFT" | "PUBLISHED" | "SCHEDULED") {
    if (!title.trim()) { setError("Le titre est requis"); return; }
    if (!content.trim()) { setError("Le contenu est requis"); return; }
    if (!targetAll && !targetRoles.length && !mentionId && !promotionId) {
      setError("Choisissez au moins un destinataire");
      return;
    }
    setSaving(true);
    setSaveMode(status);
    setError(null);
    try {
      const ann = await api<{ id: string }>("/announcements", {
        method: "POST",
        body: {
          title, content, category, priority, channels, isPinned, status,
          publishAt: publishMode === "scheduled" && publishAt ? publishAt : new Date().toISOString(),
          expiresAt: expiresAt || null,
          targetAll,
          targetRoles,
          mentionId: mentionId || null,
          promotionId: promotionId || null,
        },
      });
      nav({ to: "/erp/annonces/$id", params: { id: ann.id } });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle annonce</h1>
          <p className="text-sm text-gray-500 mt-0.5">Créez et diffusez une annonce à vos destinataires.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* 1 — Contenu */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F1E3C] text-[11px] font-bold text-white">1</span>
          Contenu de l'annonce
        </h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Titre <span className="text-red-500">*</span></label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex : Examens finaux du semestre 2"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0F1E3C] focus:ring-2 focus:ring-[#0F1E3C]/10" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Contenu <span className="text-red-500">*</span></label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            rows={6} placeholder="Rédigez votre annonce ici…"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0F1E3C] focus:ring-2 focus:ring-[#0F1E3C]/10 resize-y" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Catégorie</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0F1E3C]">
              {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Priorité</label>
            <div className="flex gap-2">
              {[
                { v: "NORMAL",    l: "Normale",    cls: "border-gray-200 text-gray-700" },
                { v: "IMPORTANT", l: "Importante", cls: "border-orange-300 text-orange-700" },
                { v: "CRITICAL",  l: "Critique",   cls: "border-red-300 text-red-700" },
              ].map((p) => (
                <button key={p.v} type="button" onClick={() => setPriority(p.v)}
                  className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-all ${priority === p.v ? `${p.cls} bg-opacity-10 ring-2 ring-current/20 shadow-sm` : "border-gray-100 text-gray-400 hover:border-gray-200"}`}>
                  {p.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setIsPinned(!isPinned)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all ${isPinned ? "border-[#FFD166] bg-[#FFD166]/10 text-[#0F1E3C]" : "border-gray-200 text-gray-500"}`}>
            📌 {isPinned ? "Épinglée" : "Épingler l'annonce"}
          </button>
        </div>
      </section>

      {/* 2 — Destinataires */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F1E3C] text-[11px] font-bold text-white">2</span>
          Destinataires
        </h2>

        {/* All toggle */}
        <button type="button" onClick={() => { setTargetAll(!targetAll); if (!targetAll) { setTargetRoles([]); setMentionId(""); setPromotionId(""); } }}
          className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${targetAll ? "border-[#0F1E3C] bg-[#0F1E3C]/5 text-[#0F1E3C]" : "border-gray-200 text-gray-600"}`}>
          <div className={`flex h-5 w-5 items-center justify-center rounded border-2 text-xs ${targetAll ? "border-[#0F1E3C] bg-[#0F1E3C] text-white" : "border-gray-300"}`}>
            {targetAll && "✓"}
          </div>
          Tous les utilisateurs
        </button>

        {!targetAll && (
          <>
            {/* Roles */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Par rôle</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ROLE_OPTIONS.map((r) => (
                  <button key={r.v} type="button" onClick={() => toggleRole(r.v)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${targetRoles.includes(r.v) ? "border-[#0F1E3C] bg-[#0F1E3C]/5 text-[#0F1E3C] font-medium" : "border-gray-200 text-gray-600"}`}>
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${targetRoles.includes(r.v) ? "border-[#0F1E3C] bg-[#0F1E3C] text-white text-[10px]" : "border-gray-300"}`}>
                      {targetRoles.includes(r.v) && "✓"}
                    </div>
                    {r.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Mention */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mention spécifique</label>
                <select value={mentionId} onChange={(e) => { setMentionId(e.target.value); if (e.target.value) setPromotionId(""); }}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0F1E3C]">
                  <option value="">— Toutes les mentions —</option>
                  {mentions.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Promotion spécifique</label>
                <select value={promotionId} onChange={(e) => { setPromotionId(e.target.value); if (e.target.value) setMentionId(""); }}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0F1E3C]">
                  <option value="">— Toutes les promotions —</option>
                  {promotions.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.level}</option>)}
                </select>
              </div>
            </div>
          </>
        )}
      </section>

      {/* 3 — Canaux */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F1E3C] text-[11px] font-bold text-white">3</span>
          Canaux de diffusion
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHANNELS.map((ch) => (
            <button key={ch.v} type="button" onClick={() => toggleChannel(ch.v)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all ${channels.includes(ch.v) ? "border-[#0F1E3C] bg-[#0F1E3C]/5 text-[#0F1E3C] font-medium" : "border-gray-200 text-gray-600"}`}>
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] ${channels.includes(ch.v) ? "border-[#0F1E3C] bg-[#0F1E3C] text-white" : "border-gray-300"}`}>
                {channels.includes(ch.v) && "✓"}
              </div>
              <span className="text-[#0F1E3C]/60">{ch.icon}</span>
              {ch.l}
            </button>
          ))}
        </div>
      </section>

      {/* 4 — Publication */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F1E3C] text-[11px] font-bold text-white">4</span>
          Publication
        </h2>
        <div className="space-y-3">
          <button type="button" onClick={() => setPublishMode("now")}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${publishMode === "now" ? "border-[#0F1E3C] bg-[#0F1E3C]/5 text-[#0F1E3C]" : "border-gray-200 text-gray-600"}`}>
            <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${publishMode === "now" ? "border-[#0F1E3C]" : "border-gray-300"}`}>
              {publishMode === "now" && <div className="h-2 w-2 rounded-full bg-[#0F1E3C]" />}
            </div>
            Publier maintenant
          </button>
          <button type="button" onClick={() => setPublishMode("scheduled")}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${publishMode === "scheduled" ? "border-[#0F1E3C] bg-[#0F1E3C]/5 text-[#0F1E3C]" : "border-gray-200 text-gray-600"}`}>
            <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${publishMode === "scheduled" ? "border-[#0F1E3C]" : "border-gray-300"}`}>
              {publishMode === "scheduled" && <div className="h-2 w-2 rounded-full bg-[#0F1E3C]" />}
            </div>
            Programmer la publication
          </button>
          {publishMode === "scheduled" && (
            <input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0F1E3C] focus:ring-2 focus:ring-[#0F1E3C]/10" />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Date d'expiration (optionnel)</label>
          <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0F1E3C]" />
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <button type="button" onClick={() => submit("DRAFT")} disabled={saving}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60">
          <Save size={16} />
          {saving && saveMode === "DRAFT" ? "Sauvegarde…" : "Enregistrer brouillon"}
        </button>
        <button type="button"
          onClick={() => submit(publishMode === "scheduled" && publishAt && new Date(publishAt) > new Date() ? "SCHEDULED" : "PUBLISHED")}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0F1E3C] px-5 py-3 text-sm font-bold text-white hover:bg-[#1B3A6B] transition-colors disabled:opacity-60">
          <Send size={16} />
          {saving && saveMode !== "DRAFT" ? "Publication…" : publishMode === "scheduled" ? "Programmer" : "Publier maintenant"}
        </button>
      </div>
    </div>
  );
}
