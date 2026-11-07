import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useErpAuth } from "./erp";
import { BookOpen, Users, CheckCircle, Clock, PlusCircle, ChevronRight, Eye, Star } from "lucide-react";

export const Route = createFileRoute("/erp/chef-mention")({
  component: ChefMentionDashboard,
});

type Course = {
  id: string; title: string; status: string;
  subject: { name: string; code: string };
  promotion: { name: string; level: string };
  teachers: { teacher: { user: { firstName: string; lastName: string } }; isMain: boolean }[];
  _count: { chapters: number; assignments: number };
};

const STATUS_STYLE: Record<string, string> = {
  PUBLISHED: "bg-green-100 text-green-700",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
  DRAFT: "bg-gray-100 text-gray-500",
  ARCHIVED: "bg-red-100 text-red-500",
};
const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Publié", PENDING_APPROVAL: "En attente", DRAFT: "Brouillon", ARCHIVED: "Archivé",
};

function ChefMentionDashboard() {
  const { roles } = useErpAuth();
  const mentionName = roles[0]?.scope?.mentionName ?? "Ma Mention";
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Course[]>("/courses").then(setCourses).catch(console.error).finally(() => setLoading(false));
  }, []);

  const published = courses.filter(c => c.status === "PUBLISHED").length;
  const pending = courses.filter(c => c.status === "PENDING_APPROVAL").length;
  const draft = courses.filter(c => c.status === "DRAFT").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 mb-2">
            <Star size={12} className="text-purple-600 fill-purple-600" />
            <span className="text-xs font-semibold text-purple-700">Chef de Mention — {mentionName}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des cours</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mention {mentionName} · Année 2024-2025</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-[#0F1E3C] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1B3A6B] transition-colors">
          <PlusCircle size={16} /> Nouveau cours
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total cours", value: courses.length, icon: <BookOpen size={18} className="text-blue-600" />, bg: "bg-blue-50" },
          { label: "Publiés", value: published, icon: <CheckCircle size={18} className="text-green-600" />, bg: "bg-green-50" },
          { label: "En attente", value: pending, icon: <Clock size={18} className="text-yellow-600" />, bg: "bg-yellow-50" },
          { label: "Brouillons", value: draft, icon: <BookOpen size={18} className="text-gray-400" />, bg: "bg-gray-50" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>{s.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Courses list */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Cours de la mention</h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{courses.length} cours</span>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-[#0F1E3C] border-t-transparent" />
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <BookOpen size={40} className="mb-3 opacity-40" />
            <p className="font-medium">Aucun cours créé</p>
            <p className="text-sm mt-1">Créez le premier cours de votre mention.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  {["Cours", "Matière", "Promotion", "Enseignant", "Statut", ""].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {courses.map(c => {
                  const mainTeacher = c.teachers.find(t => t.isMain) ?? c.teachers[0];
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-900">{c.title}</p>
                        <p className="text-xs text-gray-400">{c._count.chapters} chapitres · {c._count.assignments} devoirs</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {c.subject.code}
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">{c.subject.name}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-gray-700">{c.promotion.level}</p>
                        <p className="text-xs text-gray-400">{c.promotion.name}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">
                        {mainTeacher ? `${mainTeacher.teacher.user.firstName} ${mainTeacher.teacher.user.lastName}` : (
                          <span className="text-red-400 text-xs">Non affecté</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status] ?? ""}`}>
                          {STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-blue-600 hover:border-blue-200 transition-colors"><Eye size={14} /></button>
                          {c.status === "PENDING_APPROVAL" && (
                            <button className="rounded-lg bg-green-50 border border-green-200 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors">Valider</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Affectation enseignants */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0F1E3C] to-[#1B3A6B] p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Gestion des enseignants</h3>
            <p className="text-white/60 text-sm mt-1">Affectez les enseignants à leurs cours.</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl bg-[#FFD166] px-4 py-2 text-sm font-bold text-[#0F1E3C] hover:bg-yellow-300 transition-colors">
            <Users size={15} /> Gérer <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
