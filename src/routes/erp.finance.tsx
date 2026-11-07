import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { CreditCard, TrendingUp, TrendingDown, Clock, CheckCircle, Download, PlusCircle, Search } from "lucide-react";

export const Route = createFileRoute("/erp/finance")({
  component: FinanceDashboard,
});

type Summary = { totalInvoiced: number; totalPaid: number; pendingCount: number; overdueCount: number; currency: string };
type Payment = {
  id: string; amount: number; currency: string; method: string;
  status: string; paidAt: string | null; createdAt: string;
  student: { user: { firstName: string; lastName: string } };
  invoice: { invoiceNumber: string; title: string } | null;
  receiptNumber: string | null;
};

const fmt = (n: number) => new Intl.NumberFormat("fr-MG").format(n);
const METHOD_LABEL: Record<string, string> = { CASH: "Espèces", TRANSFER: "Virement", MOBILE: "Mobile Money" };
const STATUS_CLS: Record<string, string> = {
  PAID: "bg-green-100 text-green-700", PENDING: "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-red-100 text-red-600", PARTIAL: "bg-blue-100 text-blue-700",
};

function FinanceDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<Summary>("/finance/summary"),
      api<{ total: number; payments: Payment[] }>("/finance/payments?limit=10"),
    ]).then(([s, p]) => {
      setSummary(s);
      setPayments(p.payments);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const collected = summary ? ((summary.totalPaid / (summary.totalInvoiced || 1)) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comptabilité & Finance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Année universitaire 2024-2025</p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Download size={15} /> Exporter
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-[#0F1E3C] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B3A6B] transition-colors">
            <PlusCircle size={15} /> Enregistrer paiement
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-br from-[#0F1E3C] to-[#1B3A6B] p-5 text-white">
          <TrendingUp size={20} className="text-[#FFD166] mb-3" />
          <p className="text-2xl font-bold">{summary ? fmt(summary.totalPaid) : "—"}</p>
          <p className="text-white/60 text-sm">MGA perçus</p>
          <div className="mt-2 h-1.5 rounded-full bg-white/20">
            <div className="h-1.5 rounded-full bg-[#FFD166]" style={{ width: `${collected}%` }} />
          </div>
          <p className="text-white/50 text-xs mt-1">{collected}% de l'objectif</p>
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
          <CreditCard size={20} className="text-blue-600 mb-3" />
          <p className="text-2xl font-bold text-gray-900">{summary ? fmt(summary.totalInvoiced) : "—"}</p>
          <p className="text-sm text-gray-500">MGA facturés</p>
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
          <Clock size={20} className="text-yellow-500 mb-3" />
          <p className="text-2xl font-bold text-gray-900">{summary?.pendingCount ?? "—"}</p>
          <p className="text-sm text-gray-500">Factures en attente</p>
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
          <TrendingDown size={20} className="text-red-500 mb-3" />
          <p className="text-2xl font-bold text-gray-900">{summary?.overdueCount ?? "—"}</p>
          <p className="text-sm text-gray-500">Impayés</p>
        </div>
      </div>

      {/* Payments table */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Paiements récents</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder="Rechercher…" className="rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-[#0F1E3C] w-48" />
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-[#0F1E3C] border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  {["Étudiant", "Référence", "Montant", "Mode", "Statut", "Date", "Actions"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-gray-900">{p.student.user.firstName} {p.student.user.lastName}</p>
                      {p.invoice && <p className="text-xs text-gray-400">{p.invoice.invoiceNumber}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{p.receiptNumber ?? "—"}</code>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-gray-900">{fmt(p.amount)}</p>
                      <p className="text-xs text-gray-400">{p.currency}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-600">{METHOD_LABEL[p.method] ?? p.method}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLS[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {p.status === "PAID" && <CheckCircle size={11} />}
                        {p.status === "PAID" ? "Payé" : p.status === "PENDING" ? "En attente" : p.status === "CANCELLED" ? "Annulé" : p.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <button className="text-xs text-blue-600 hover:underline">Reçu</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Créer une structure de frais", icon: <PlusCircle size={16} />, cls: "bg-blue-600" },
          { label: "Générer des factures en masse", icon: <CreditCard size={16} />, cls: "bg-purple-600" },
          { label: "Rapport financier PDF", icon: <Download size={16} />, cls: "bg-green-600" },
        ].map(a => (
          <button key={a.label} className={`flex items-center gap-3 rounded-2xl ${a.cls} p-4 text-white hover:opacity-90 transition-opacity`}>
            <span className="rounded-lg bg-white/20 p-2">{a.icon}</span>
            <span className="text-sm font-medium">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
