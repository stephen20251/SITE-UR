import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, Eye, EyeOff, AlertCircle, ArrowLeft } from "lucide-react";
import { erpLogin, dashboardPath } from "../lib/erp";

export const Route = createFileRoute("/erp/login")({
  component: ErpLogin,
});

function ErpLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = await erpLogin(email, password);
      const roleName = payload.roles[0]?.roleName ?? "";
      navigate({ to: dashboardPath(payload.user.systemRole, roleName) as any });
    } catch (err: any) {
      setError(err.message ?? "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] flex-col bg-[#0F1E3C] relative overflow-hidden">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #FFD166 0%, transparent 60%), radial-gradient(circle at 80% 20%, #2563EB 0%, transparent 50%)" }} />
        <div className="relative flex flex-col h-full p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFD166]">
              <GraduationCap size={22} className="text-[#0F1E3C]" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">Université Références</p>
              <p className="text-white/50 text-xs">ERP — Système de Gestion</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-4xl font-bold text-white leading-tight">
              Gérez votre<br />
              <span className="text-[#FFD166]">université</span><br />
              en toute simplicité.
            </h2>
            <p className="mt-4 text-white/60 text-base max-w-xs">
              Plateforme ERP universitaire — RBAC dynamique, multi-campus, multi-mention.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-3">
              {[
                { n: "49", l: "permissions" },
                { n: "6", l: "rôles" },
                { n: "3", l: "mentions" },
                { n: "11", l: "utilisateurs" },
              ].map(s => (
                <div key={s.l} className="rounded-xl bg-white/[0.07] p-4">
                  <p className="text-2xl font-bold text-[#FFD166]">{s.n}</p>
                  <p className="text-white/60 text-sm capitalize">{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/30 text-xs">© 2025 Université Références · Tous droits réservés</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-8 transition-colors">
            <ArrowLeft size={14} /> Retour à l'accueil
          </Link>

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F1E3C]">
              <GraduationCap size={18} className="text-[#FFD166]" />
            </div>
            <p className="font-bold text-gray-900">Université Références</p>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">Connexion à l'ERP</h1>
          <p className="mt-1 text-sm text-gray-500">Accédez à votre espace selon votre rôle.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse e-mail</label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.mg"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#0F1E3C] focus:ring-2 focus:ring-[#0F1E3C]/10 transition-all"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
                <a href="/mot-de-passe-oublie" className="text-xs font-medium text-[#0F1E3C] hover:underline">Mot de passe oublié ?</a>
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"} required value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-12 text-sm text-gray-900 outline-none focus:border-[#0F1E3C] focus:ring-2 focus:ring-[#0F1E3C]/10 transition-all"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full rounded-xl bg-[#0F1E3C] py-3 text-sm font-semibold text-white transition-all hover:bg-[#1B3A6B] disabled:opacity-60 active:scale-[0.98]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Connexion…
                </span>
              ) : "Se connecter"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
