import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { CONTACT } from "../lib/contact";
import {
  FileText, CheckCircle, Clock, XCircle, ChevronRight,
  Upload, School, AlertCircle, Send
} from "lucide-react";

export const Route = createFileRoute("/erp/candidat")({
  component: CandidatDashboard,
});

type Application = {
  id: string; status: string; level: string | null; submittedAt: string | null;
  createdAt: string; rejectionReason: string | null;
  mention: { name: string; code: string } | null;
};
type Mention = { id: string; name: string; code: string; department: { name: string } };

const STEPS = [
  { key: "DRAFT",        label: "Création du dossier", icon: <FileText size={16} /> },
  { key: "SUBMITTED",    label: "Dossier soumis",      icon: <Send size={16} /> },
  { key: "UNDER_REVIEW", label: "Examen du dossier",   icon: <Clock size={16} /> },
  { key: "ACCEPTED",     label: "Dossier accepté",      icon: <CheckCircle size={16} /> },
  { key: "ENROLLED",     label: "Inscription confirmée",icon: <School size={16} /> },
];
const STEP_ORDER = STEPS.map(s => s.key);

function CandidatDashboard() {
  const [application, setApplication] = useState<Application | null>(null);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState("L1");
  const [selectedMention, setSelectedMention] = useState("");

  useEffect(() => {
    Promise.all([
      api<{ application: Application | null }>("/candidates/my").catch(() => ({ application: null })),
      api<Mention[]>("/structure/mentions").catch(() => []),
    ]).then(([a, m]) => {
      setApplication(a.application);
      setMentions(m as Mention[]);
    }).finally(() => setLoading(false));
  }, []);

  const currentStep = application ? STEP_ORDER.indexOf(application.status) : -1;
  const isRejected = application?.status === "REJECTED";

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const app = await api<Application>("/candidates", {
        method: "POST",
        body: { level: selectedLevel, mentionId: selectedMention || null },
      });
      setApplication(app);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDossier = async () => {
    if (!application) return;
    setSubmitting(true);
    try {
      const updated = await api<Application>(`/candidates/${application.id}/submit`, { method: "PUT" });
      setApplication(updated);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0F1E3C] border-t-[#FFD166]" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ma candidature</h1>
        <p className="text-sm text-gray-500 mt-0.5">Suivez l'avancement de votre dossier d'admission.</p>
      </div>

      {/* No application yet */}
      {!application && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0F1E3C]">
              <FileText size={20} className="text-[#FFD166]" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Déposer ma candidature</h2>
              <p className="text-sm text-gray-500">Choisissez la mention et le niveau souhaités.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Niveau souhaité</label>
              <select value={selectedLevel} onChange={e => setSelectedLevel(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0F1E3C] focus:ring-2 focus:ring-[#0F1E3C]/10">
                {["L1", "L2", "L3", "M1", "M2"].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mention</label>
              <select value={selectedMention} onChange={e => setSelectedMention(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0F1E3C] focus:ring-2 focus:ring-[#0F1E3C]/10">
                <option value="">— Choisir une mention —</option>
                {mentions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full rounded-xl bg-[#0F1E3C] py-3 text-sm font-semibold text-white hover:bg-[#1B3A6B] transition-colors disabled:opacity-60">
            {submitting ? "Création…" : "Créer mon dossier"}
          </button>
        </div>
      )}

      {/* Application exists */}
      {application && (
        <>
          {/* Status banner */}
          {isRejected ? (
            <div className="flex items-start gap-3 rounded-2xl bg-red-50 border border-red-200 p-5">
              <XCircle size={20} className="shrink-0 text-red-500 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Dossier refusé</p>
                <p className="text-sm text-red-600 mt-1">{application.rejectionReason ?? "Votre dossier n'a pas été retenu."}</p>
                <button className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors">
                  Contacter l'admission
                </button>
              </div>
            </div>
          ) : application.status === "ENROLLED" ? (
            <div className="flex items-center gap-3 rounded-2xl bg-green-50 border border-green-200 p-5">
              <CheckCircle size={24} className="shrink-0 text-green-600" />
              <div>
                <p className="font-semibold text-green-800">Félicitations ! Vous êtes inscrit(e).</p>
                <p className="text-sm text-green-600 mt-0.5">Votre dossier est validé. Votre espace étudiant est maintenant actif.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl bg-blue-50 border border-blue-200 p-5">
              <Clock size={20} className="shrink-0 text-blue-600" />
              <p className="text-sm font-medium text-blue-800">Votre dossier est en cours de traitement.</p>
            </div>
          )}

          {/* Progress stepper */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-5">Progression du dossier</h2>
            <div className="space-y-4">
              {STEPS.map((step, idx) => {
                const done = idx < currentStep || (idx === currentStep && !isRejected);
                const active = idx === currentStep && !isRejected;
                return (
                  <div key={step.key} className="flex items-center gap-4">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                      isRejected && idx === currentStep ? "border-red-400 bg-red-50 text-red-500"
                      : done ? "border-green-500 bg-green-500 text-white"
                      : active ? "border-[#0F1E3C] bg-[#0F1E3C] text-white"
                      : "border-gray-200 bg-white text-gray-400"
                    }`}>
                      {done && idx < currentStep ? <CheckCircle size={14} /> : step.icon}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${done ? "text-gray-900" : "text-gray-400"}`}>{step.label}</p>
                      {active && !isRejected && (
                        <p className="text-xs text-[#0F1E3C] mt-0.5">En cours…</p>
                      )}
                    </div>
                    {idx < currentStep && <CheckCircle size={16} className="text-green-500 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Application details */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Détails de la candidature</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: "Mention demandée", value: application.mention?.name ?? "Non précisée" },
                { label: "Niveau", value: application.level ?? "—" },
                { label: "Créé le", value: new Date(application.createdAt).toLocaleDateString("fr-FR") },
                { label: "Soumis le", value: application.submittedAt ? new Date(application.submittedAt).toLocaleDateString("fr-FR") : "Non soumis" },
              ].map(d => (
                <div key={d.label} className="rounded-xl bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-400">{d.label}</p>
                  <p className="font-medium text-gray-900 mt-0.5">{d.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Pièces justificatives</h2>
            <div className="space-y-2">
              {[
                { label: "Baccalauréat ou équivalent", required: true },
                { label: "Relevés de notes", required: true },
                { label: "Pièce d'identité", required: true },
                { label: "Photo d'identité", required: true },
                { label: "Lettre de motivation", required: false },
              ].map(doc => (
                <div key={doc.label} className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 px-4 py-3 hover:border-gray-300 transition-colors cursor-pointer group">
                  <Upload size={15} className="shrink-0 text-gray-400 group-hover:text-[#0F1E3C] transition-colors" />
                  <span className="flex-1 text-sm text-gray-600">{doc.label}</span>
                  {doc.required && <span className="text-xs text-red-500 font-medium">Requis</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Submit button */}
          {application.status === "DRAFT" && (
            <button onClick={handleSubmitDossier} disabled={submitting}
              className="w-full rounded-2xl bg-[#0F1E3C] py-4 text-sm font-bold text-white hover:bg-[#1B3A6B] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              <Send size={16} />
              {submitting ? "Soumission en cours…" : "Soumettre mon dossier"}
            </button>
          )}
        </>
      )}

      {/* Info */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 flex items-start gap-3">
        <AlertCircle size={16} className="shrink-0 text-gray-400 mt-0.5" />
        <div className="text-sm text-gray-500">
          <p className="font-medium text-gray-700">Besoin d'aide ?</p>
          <p className="mt-0.5">Contactez le secrétariat à <a href={`mailto:${CONTACT.email}`} className="text-[#0F1E3C] font-medium hover:underline">{CONTACT.email}</a> ou appelez le <a href={CONTACT.phoneHref} className="font-medium hover:underline">{CONTACT.phone}</a>.</p>
        </div>
      </div>
    </div>
  );
}
