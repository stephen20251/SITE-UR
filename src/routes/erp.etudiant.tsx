import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { BookOpen, TrendingUp, CreditCard, Calendar, ClipboardList, CheckCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/erp/etudiant")({
  component: EtudiantDashboard,
});

type Bulletin = {
  academicYear: string; semester: string; average: number | null; gpa: number | null;
  earnedCredits: number; totalCredits: number;
  subjects: { name: string; code: string; grade: number | null; coefficient: number; isPassed: boolean | null }[];
};
type Course = { id: string; title: string; subject: { name: string; code: string }; _count: { chapters: number } };
type Invoice = { id: string; invoiceNumber: string; title: string; totalAmount: number; dueDate: string; status: string; currency: string };

const STATUS_CLS: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  OVERDUE: "bg-red-100 text-red-600",
};
const fmt = (n: number) => new Intl.NumberFormat("fr-MG").format(n);

function EtudiantDashboard() {
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const me = JSON.parse(localStorage.getItem("erp.user") ?? "{}");
    Promise.all([
      api<Course[]>("/courses").catch(() => []),
      api<Invoice[]>("/finance/my-invoices").catch(() => []),
    ]).then(([c, inv]) => {
      setCourses(c as Course[]);
      setInvoices(inv as Invoice[]);
    }).finally(() => setLoading(false));
  }, []);

  const pendingInvoices = invoices.filter(i => i.status !== "PAID");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mon espace étudiant</h1>
        <p className="text-sm text-gray-500 mt-0.5">Suivez vos cours, notes et paiements.</p>
      </div>

      {/* Alert unpaid invoices */}
      {pendingInvoices.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4">
          <Clock size={20} className="shrink-0 text-orange-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-800">
              {pendingInvoices.length} facture{pendingInvoices.length > 1 ? "s" : ""} en attente de paiement
            </p>
            <p className="text-xs text-orange-600">Réglez vos frais pour conserver l'accès complet à vos cours.</p>
          </div>
          <button className="shrink-0 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 transition-colors">
            Payer maintenant
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Cours inscrits", value: courses.length, icon: <BookOpen size={18} className="text-blue-600" />, bg: "bg-blue-50" },
          { label: "Moyenne générale", value: bulletin?.average != null ? `${bulletin.average.toFixed(2)}/20` : "—", icon: <TrendingUp size={18} className="text-green-600" />, bg: "bg-green-50" },
          { label: "Crédits obtenus", value: bulletin ? `${bulletin.earnedCredits}/${bulletin.totalCredits}` : "—", icon: <CheckCircle size={18} className="text-purple-600" />, bg: "bg-purple-50" },
          { label: "Factures impayées", value: pendingInvoices.length, icon: <CreditCard size={18} className="text-orange-500" />, bg: "bg-orange-50" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>{s.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* My courses */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Mes cours</h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{courses.length}</span>
          </div>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-[#0F1E3C] border-t-transparent" />
            </div>
          ) : courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <BookOpen size={36} className="mb-2 opacity-40" />
              <p className="text-sm">Aucun cours assigné pour le moment</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {courses.map(c => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors cursor-pointer group">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0F1E3C] text-xs font-bold text-[#FFD166]">
                    {c.subject.code.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-[#0F1E3C] transition-colors">{c.title}</p>
                    <p className="text-xs text-gray-400">{c.subject.name} · {c._count.chapters} chapitres</p>
                  </div>
                  <button className="shrink-0 rounded-lg bg-[#0F1E3C]/5 px-3 py-1.5 text-xs font-medium text-[#0F1E3C] opacity-0 group-hover:opacity-100 transition-opacity">
                    Accéder
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invoices + quick links */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Mes factures</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {invoices.slice(0, 4).map(inv => (
                <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{inv.title}</p>
                    <p className="text-xs text-gray-400">{inv.invoiceNumber}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{fmt(inv.totalAmount)}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLS[inv.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {inv.status === "PAID" ? "Payé" : inv.status === "PENDING" ? "En attente" : inv.status}
                    </span>
                  </div>
                </div>
              ))}
              {invoices.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <CreditCard size={28} className="mb-2 opacity-40" />
                  <p className="text-xs">Aucune facture</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-[#0F1E3C] to-[#1B3A6B] p-5 text-white">
            <Calendar size={20} className="text-[#FFD166] mb-3" />
            <h3 className="font-semibold">Emploi du temps</h3>
            <p className="text-white/60 text-sm mt-1">Consultez votre planning de cours.</p>
            <button className="mt-4 w-full rounded-lg bg-[#FFD166] py-2 text-xs font-bold text-[#0F1E3C] hover:bg-yellow-300 transition-colors">
              Voir le planning
            </button>
          </div>

          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList size={16} className="text-gray-500" />
              <h3 className="font-semibold text-gray-900 text-sm">Mes notes</h3>
            </div>
            {bulletin ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Moyenne</span>
                  <span className="font-bold text-gray-900">{bulletin.average?.toFixed(2)}/20</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">GPA</span>
                  <span className="font-bold text-gray-900">{bulletin.gpa?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Crédits</span>
                  <span className="font-bold text-gray-900">{bulletin.earnedCredits}/{bulletin.totalCredits}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Notes non disponibles</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
