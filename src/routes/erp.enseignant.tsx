import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { BookOpen, Users, ClipboardList, PlusCircle, ChevronRight, Play, FileText } from "lucide-react";

export const Route = createFileRoute("/erp/enseignant")({
  component: EnseignantDashboard,
});

type Course = {
  id: string; title: string; status: string;
  subject: { name: string; code: string };
  promotion: { name: string; level: string };
  _count: { chapters: number; assignments: number };
};

const STATUS_CLS: Record<string, string> = {
  PUBLISHED: "bg-green-100 text-green-700",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
  DRAFT: "bg-gray-100 text-gray-500",
};

function EnseignantDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Course[]>("/courses").then(setCourses).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon espace enseignant</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez vos cours, notes et présences.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-[#0F1E3C] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1B3A6B] transition-colors">
          <PlusCircle size={16} /> Nouveau contenu
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Cours attribués", value: courses.length, icon: <BookOpen size={18} className="text-blue-600" />, bg: "bg-blue-50" },
          { label: "Chapitres publiés", value: courses.reduce((s, c) => s + c._count.chapters, 0), icon: <Play size={18} className="text-green-600" />, bg: "bg-green-50" },
          { label: "Devoirs créés", value: courses.reduce((s, c) => s + c._count.assignments, 0), icon: <FileText size={18} className="text-purple-600" />, bg: "bg-purple-50" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>{s.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Courses */}
      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <div className="col-span-2 flex h-40 items-center justify-center bg-white rounded-2xl border border-gray-100">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-[#0F1E3C] border-t-transparent" />
          </div>
        ) : courses.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center justify-center py-16 rounded-2xl bg-white border border-gray-100 text-gray-400">
            <BookOpen size={40} className="mb-3 opacity-40" />
            <p className="font-medium">Aucun cours assigné</p>
            <p className="text-sm mt-1">Le chef de mention vous assignera bientôt des cours.</p>
          </div>
        ) : courses.map(c => (
          <div key={c.id} className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
            <div className="bg-gradient-to-r from-[#0F1E3C] to-[#1B3A6B] px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-xs text-white/80 mb-2">{c.subject.code}</span>
                  <h3 className="text-white font-semibold leading-snug">{c.title}</h3>
                  <p className="text-white/60 text-sm mt-1">{c.promotion.level} · {c.promotion.name}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[c.status] ?? "bg-gray-100 text-gray-500"}`}>
                  {c.status === "PUBLISHED" ? "Publié" : c.status === "PENDING_APPROVAL" ? "En attente" : "Brouillon"}
                </span>
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <span className="flex items-center gap-1.5"><BookOpen size={14} /> {c._count.chapters} chapitres</span>
                <span className="flex items-center gap-1.5"><ClipboardList size={14} /> {c._count.assignments} devoirs</span>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 rounded-lg bg-[#0F1E3C]/5 py-2 text-xs font-medium text-[#0F1E3C] hover:bg-[#0F1E3C]/10 transition-colors">
                  Gérer le cours
                </button>
                <button className="flex-1 rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Faire l'appel
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Actions rapides</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Saisir les notes", icon: <ClipboardList size={18} />, cls: "from-blue-500 to-blue-600" },
            { label: "Faire l'appel", icon: <Users size={18} />, cls: "from-green-500 to-green-600" },
            { label: "Créer un quiz", icon: <FileText size={18} />, cls: "from-purple-500 to-purple-600" },
            { label: "Publier une annonce", icon: <BookOpen size={18} />, cls: "from-orange-500 to-orange-600" },
          ].map(a => (
            <button key={a.label} className={`flex flex-col items-center gap-2 rounded-xl bg-gradient-to-br ${a.cls} p-4 text-white hover:opacity-90 transition-opacity`}>
              <span className="rounded-lg bg-white/20 p-2">{a.icon}</span>
              <span className="text-xs font-medium text-center">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
