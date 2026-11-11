import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  LayoutDashboard, Settings, Navigation, Layout, BookOpen, FolderTree,
  Image, Users, HelpCircle, Star, ChevronRight, ChevronDown, ChevronUp,
  Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, Copy, ArrowLeftRight,
  Check, X, Loader2, Search, Upload, Link2, Play, FileText, Film,
  Volume2, FileArchive, Tag, Globe, ToggleLeft, ToggleRight,
  GraduationCap, TrendingUp, Award, BookMarked, UserCog, ShieldCheck, ShieldOff,
  Calendar, Megaphone,
  RefreshCw, UserPlus, MoreVertical, Key, Crown,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { BackHomeButtons } from "@/components/nav-buttons";
import {
  useAdminPayments, usePaymentStats, useValidatePayment, useRefusePayment, useApproveRefund, useRejectRefund,
  useCoupons, useCreateCoupon, useUpdateCoupon, useDeleteCoupon,
  useAllPlans, useCreatePlan, useUpdatePlan, useDeletePlan,
  useAdminSubscriptions, useSubscriptionStats, useValidateSubscription, useRefuseSubscription,
  type CoursePayment, type SubscriptionPlan,
} from "@/lib/payments";
import { PaymentStatusBadge } from "@/components/online/payment-modal";
import {
  useLmsSettings, useUpdateSettings, useUploadLogo, useUploadBanner,
  useAdminNav, useCreateNavItem, useUpdateNavItem, useDeleteNavItem,
  useHomeSections, useUpdateHomeSection, useReorderHomeSections,
  useAdminCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  useAdminCourses, useAdminCreateCourse, useAdminUpdateCourse, useAdminDeleteCourse, useAdminDuplicateCourse,
  useAdminTeachers, useAdminUpdateTeacher,
  useAdminStudents,
  useAdminMedia, useUploadMedia, useAddMediaLink, useUpdateMedia, useDeleteMedia,
  useTestimonials, useCreateTestimonial, useUpdateTestimonial, useDeleteTestimonial, useUploadTestimonialPhoto,
  useFaqItems, useCreateFaqItem, useUpdateFaqItem, useDeleteFaqItem,
  useAdminDashboard,
  useAdminUsers, useAdminCreateUser, useAdminUpdateUser, useAdminToggleActive,
  useAdminResetPassword, useAdminDeleteUser,
  type LmsSettings, type NavItem, type OnlineCategory, type AdminCourse,
  type MediaFile, type Testimonial, type FaqItem, type AdminUser,
  useAdminCertificates, useAdminLiveSessions, useAdminAnnouncements, useAdminDeleteAnnouncement,
  useAdminReviews, useAdminSetReviewHidden, useAdminDeleteReview,
  type AdminLiveSession, type AdminAnnouncement, type AdminReview,
} from "@/lib/lms-admin";
import { certThemeFrom, CERT_DEFAULTS, type CertTheme } from "./online.certificate.$code";
import { API_ORIGIN } from "@/lib/env";
import { useQueryClient } from "@tanstack/react-query";
import { mediaUrl } from "@/components/online/mooc-card";

export const Route = createFileRoute("/online/admin")({
  component: AdminPanel,
});

type Tab =
  | "dashboard" | "settings" | "nav" | "homepage"
  | "courses" | "categories" | "media" | "teachers" | "students" | "faq" | "payments" | "coupons" | "subscriptions" | "certificates"
  | "livesessions" | "announcements" | "reviews" | "users";

const NAV_ITEMS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "dashboard",  label: "Tableau de bord",  icon: LayoutDashboard },
  { id: "settings",   label: "Paramètres site",   icon: Settings },
  { id: "nav",        label: "Navigation",         icon: Navigation },
  { id: "homepage",   label: "Page d'accueil",    icon: Layout },
  { id: "courses",    label: "Cours",              icon: BookOpen },
  { id: "categories", label: "Catégories",         icon: FolderTree },
  { id: "media",      label: "Médiathèque",        icon: Image },
  { id: "teachers",   label: "Enseignants",        icon: GraduationCap },
  { id: "students",   label: "Étudiants",         icon: Users },
  { id: "faq",        label: "FAQ & Avis",         icon: HelpCircle },
  { id: "payments",   label: "Paiements",           icon: TrendingUp },
  { id: "coupons",    label: "Codes promo",         icon: Tag },
  { id: "subscriptions", label: "Abonnements",     icon: Crown },
  { id: "certificates", label: "Certificats",       icon: Award },
  { id: "livesessions", label: "Sessions live",      icon: Calendar },
  { id: "announcements", label: "Annonces",          icon: Megaphone },
  { id: "reviews",      label: "Avis de cours",       icon: Star },
  { id: "users",      label: "Utilisateurs",        icon: UserCog },
];

function AdminPanel() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");

  if (!ready) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  // Pas (ou plus) connecté : la session a pu expirer, on propose de se reconnecter.
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold">Connexion requise</p>
          <p className="mt-2 text-sm text-muted-foreground">Votre session a expiré ou vous n'êtes pas connecté. Reconnectez-vous avec votre compte Super Admin pour continuer.</p>
          <Link to="/online/login" className="mt-5 inline-flex rounded-lg grad-online px-4 py-2 text-sm font-medium text-white">Se reconnecter</Link>
        </div>
      </div>
    );
  }

  if (user.systemRole !== "SUPER_ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-bold text-destructive">403</div>
          <p className="mt-2 text-muted-foreground">Accès réservé aux Super Admins.</p>
          <Link to="/online" className="mt-4 inline-block text-sm text-online hover:underline">← Retour</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r bg-card">
        <div className="border-b p-4">
          <Link to="/online" className="flex items-center gap-2 text-sm font-semibold text-online">
            <BookMarked className="h-4 w-4" />
            UR Online
          </Link>
          <div className="mt-0.5 text-xs text-muted-foreground">Administration LMS</div>
        </div>
        <nav className="p-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition
                ${tab === id
                  ? "bg-online/10 font-medium text-online"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
        <div className="border-t p-3">
          <BackHomeButtons home="/online" className="mb-2" />
          {/* Accès à l'administration de l'université (cursus, écolage, utilisateurs…) */}
          <Link to="/classroom/admin" className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-online hover:bg-online/10">
            <ExternalLink className="h-3.5 w-3.5" /> Administration UR
          </Link>
          <Link to="/online" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent">
            <ExternalLink className="h-3.5 w-3.5" /> Voir le site
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="border-b bg-card px-6 py-3">
          <h1 className="text-sm font-semibold">{NAV_ITEMS.find(n => n.id === tab)?.label}</h1>
        </div>
        <div className="p-6">
          {tab === "dashboard"  && <DashboardTab />}
          {tab === "settings"   && <SettingsTab />}
          {tab === "nav"        && <NavTab />}
          {tab === "homepage"   && <HomepageTab />}
          {tab === "courses"    && <CoursesTab />}
          {tab === "categories" && <CategoriesTab />}
          {tab === "media"      && <MediaTab />}
          {tab === "teachers"   && <TeachersTab />}
          {tab === "students"   && <StudentsTab />}
          {tab === "faq"        && <FaqTab />}
          {tab === "payments"   && <PaymentsTab />}
          {tab === "coupons"    && <CouponsTab />}
          {tab === "subscriptions" && <SubscriptionsTab />}
          {tab === "certificates" && <CertificatesTab />}
          {tab === "livesessions" && <LiveSessionsAdminTab />}
          {tab === "announcements" && <AnnouncementsAdminTab />}
          {tab === "reviews" && <ReviewsAdminTab />}
          {tab === "users"      && <UsersTab />}
        </div>
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Dashboard
// ══════════════════════════════════════════════════════════════════════════════

function DashboardTab() {
  const { data, isLoading } = useAdminDashboard();
  const payStats = usePaymentStats();
  const subStats = useSubscriptionStats();

  if (isLoading) return <Spinner />;
  if (!data) return null;

  const stats = [
    { label: "Cours total",       value: data.courses,      icon: BookOpen,      color: "text-online",   bg: "bg-online/10" },
    { label: "Étudiants",        value: data.students,     icon: Users,         color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Enseignants",      value: data.teachers,     icon: GraduationCap, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Inscriptions",     value: data.enrollments,  icon: TrendingUp,    color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Certificats",      value: data.certificates, icon: Award,         color: "text-yellow-500", bg: "bg-yellow-500/10" },
  ];

  const fmtMga = (n: number) => `${n.toLocaleString("fr-FR")} MGA`;
  const alerts = [
    { label: "paiement(s) à valider", value: payStats.data?.pending ?? 0 },
    { label: "remboursement(s) demandé(s)", value: payStats.data?.refundRequested ?? 0 },
    { label: "abonnement(s) à confirmer", value: subStats.data?.pendingValidation ?? 0 },
  ].filter((a) => a.value > 0);

  return (
    <div className="space-y-6">
      {/* Bandeau revenus */}
      <div className="relative overflow-hidden rounded-2xl grad-online p-6 text-white shadow-glow">
        <div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/60">Revenus encaissés (cours)</div>
            <div className="mt-1 text-3xl font-black tracking-tight">{fmtMga(payStats.data?.totalValidated ?? 0)}</div>
            <div className="mt-1 text-xs text-white/60">{payStats.data?.validated ?? 0} paiement(s) validé(s)</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/60">Revenus abonnements</div>
            <div className="mt-1 text-2xl font-extrabold tracking-tight">{fmtMga(subStats.data?.revenue ?? 0)}</div>
            <div className="mt-1 text-xs text-white/60">{subStats.data?.active ?? 0} abonnement(s) actif(s)</div>
          </div>
          <div className="min-w-52">
            {alerts.length > 0 ? (
              <div className="rounded-xl bg-amber-400/20 p-3 backdrop-blur">
                <div className="text-xs font-bold text-amber-200">⚠ Actions requises</div>
                {alerts.map((a) => (
                  <div key={a.label} className="mt-1 text-xs text-white/90">
                    <span className="font-bold">{a.value}</span> {a.label}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-white/10 p-3 text-xs text-white/80 backdrop-blur">
                ✓ Aucune action en attente
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl border bg-card p-4 shadow-elegant">
            <div className={`inline-flex rounded-xl p-2 ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="mt-3 text-2xl font-extrabold tracking-tight">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium">Cours par statut</h3>
          {(() => {
            const t = data.coursesByStatus.published + data.coursesByStatus.draft + data.coursesByStatus.archived;
            return t > 0 ? (
              <div className="mb-3 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
                <div className="bg-green-500" style={{ width: `${(data.coursesByStatus.published / t) * 100}%` }} />
                <div className="bg-yellow-500" style={{ width: `${(data.coursesByStatus.draft / t) * 100}%` }} />
                <div className="bg-muted-foreground/30" style={{ width: `${(data.coursesByStatus.archived / t) * 100}%` }} />
              </div>
            ) : null;
          })()}
          <div className="space-y-2">
            {[
              { label: "Publiés",   value: data.coursesByStatus.published, color: "bg-green-500" },
              { label: "Brouillons", value: data.coursesByStatus.draft,    color: "bg-yellow-500" },
              { label: "Archivés",  value: data.coursesByStatus.archived,  color: "bg-muted" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${color}`} />
                <span className="flex-1 text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium">Inscriptions récentes</h3>
          <div className="space-y-2">
            {data.recentEnrollments.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2">
                <span className="flex-1 truncate text-xs text-muted-foreground">{e.course.title}</span>
                <span className="shrink-0 text-xs font-medium">{Math.round(e.progress)}%</span>
              </div>
            ))}
            {data.recentEnrollments.length === 0 && (
              <p className="text-xs text-muted-foreground">Aucune inscription récente</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Settings
// ══════════════════════════════════════════════════════════════════════════════

const API_BASE = API_ORIGIN;
function settingsMediaUrl(path?: string | null) {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

function SettingsTab() {
  const { data, isLoading } = useLmsSettings();
  const update = useUpdateSettings();
  const uploadLogo = useUploadLogo();
  const uploadBanner = useUploadBanner();
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Partial<LmsSettings>>({});
  const merged = { ...data, ...form } as LmsSettings;

  const set = (k: keyof LmsSettings, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function save() {
    try {
      await update.mutateAsync(form);
      setForm({});
      toast.success("Paramètres sauvegardés");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    }
  }

  async function handleLogoUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await uploadLogo.mutateAsync(fd);
      toast.success("Logo mis à jour");
      setForm((p) => ({ ...p, logoUrl: res.url }));
    } catch {
      toast.error("Erreur upload logo");
    }
  }

  async function handleBannerUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await uploadBanner.mutateAsync(fd);
      toast.success("Bannière mise à jour");
      setForm((p) => ({ ...p, bannerUrl: res.url }));
    } catch {
      toast.error("Erreur upload bannière");
    }
  }

  if (isLoading) return <Spinner />;

  const sections: Array<{ title: string; fields: Array<{ key: keyof LmsSettings; label: string; type?: string }> }> = [
    {
      title: "Identité de la plateforme",
      fields: [
        { key: "platformName",        label: "Nom de la plateforme" },
        { key: "platformTagline",     label: "Tagline (sous-titre)" },
        { key: "platformDescription", label: "Description courte" },
        { key: "logoUrl",             label: "URL du logo" },
        { key: "faviconUrl",          label: "URL du favicon" },
        { key: "bannerSubtitle",      label: "Sous-titre de bannière" },
      ],
    },
    {
      title: "Couleurs",
      fields: [
        { key: "primaryColor",   label: "Couleur principale",  type: "color" },
        { key: "secondaryColor", label: "Couleur secondaire",  type: "color" },
        { key: "accentColor",    label: "Couleur d'accent",   type: "color" },
      ],
    },
    {
      title: "Réseaux sociaux",
      fields: [
        { key: "socialFacebook",  label: "Facebook URL" },
        { key: "socialTwitter",   label: "Twitter / X URL" },
        { key: "socialLinkedin",  label: "LinkedIn URL" },
        { key: "socialYoutube",   label: "YouTube URL" },
        { key: "socialInstagram", label: "Instagram URL" },
      ],
    },
    {
      title: "SEO & Meta",
      fields: [
        { key: "metaTitle",       label: "Titre SEO" },
        { key: "metaDescription", label: "Meta description" },
        { key: "metaKeywords",    label: "Mots-clés (séparés par virgule)" },
      ],
    },
    {
      title: "Paramètres régionaux",
      fields: [
        { key: "defaultLanguage", label: "Langue par défaut" },
        { key: "defaultCurrency", label: "Devise" },
        { key: "timezone",        label: "Fuseau horaire" },
        { key: "footerText",      label: "Texte du pied de page" },
      ],
    },
    {
      title: "Paiements Mobile Money",
      fields: [
        { key: "mvolaNom",            label: "MVola — Nom du bénéficiaire" },
        { key: "mvolaNumero",         label: "MVola — Numéro" },
        { key: "orangeMoneyNom",      label: "Orange Money — Nom" },
        { key: "orangeMoneyNumero",   label: "Orange Money — Numéro" },
        { key: "airtelMoneyNom",      label: "Airtel Money — Nom" },
        { key: "airtelMoneyNumero",   label: "Airtel Money — Numéro" },
      ],
    },
  ];

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── Logo & Banner upload ── */}
      <div className="rounded-xl border bg-card p-5 space-y-5">
        <h3 className="text-sm font-semibold">Médias de la plateforme</h3>

        {/* Logo */}
        <div>
          <div className="mb-2 text-xs text-muted-foreground">Logo (PNG/SVG recommandé)</div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-32 items-center justify-center overflow-hidden rounded-xl border bg-muted">
              {merged.logoUrl ? (
                <img
                  src={settingsMediaUrl(merged.logoUrl)}
                  alt="Logo"
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <GraduationCap className="h-8 w-8 text-muted-foreground/30" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => logoRef.current?.click()}
                disabled={uploadLogo.isPending}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-60"
              >
                {uploadLogo.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {uploadLogo.isPending ? "Upload…" : "Changer le logo"}
              </button>
              {merged.logoUrl && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                  {merged.logoUrl}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Banner */}
        <div>
          <div className="mb-2 text-xs text-muted-foreground">Image de bannière (hero du catalogue)</div>
          <div className="overflow-hidden rounded-xl border bg-muted aspect-[3/1] relative mb-3">
            {merged.bannerUrl ? (
              <img
                src={settingsMediaUrl(merged.bannerUrl)}
                alt="Bannière"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/30">
                <Image className="h-12 w-12" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={bannerRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBannerUpload(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => bannerRef.current?.click()}
              disabled={uploadBanner.isPending}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-60"
            >
              {uploadBanner.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploadBanner.isPending ? "Upload…" : "Changer la bannière"}
            </button>
            {merged.bannerUrl && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                {merged.bannerUrl}
              </span>
            )}
          </div>
        </div>
      </div>

      {sections.map(({ title, fields }) => (
        <div key={title} className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">{title}</h3>
          <div className="space-y-3">
            {fields.map(({ key, label, type }) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
                {type === "color" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={merged[key] || "#6366f1"}
                      onChange={(e) => set(key, e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border bg-background p-1"
                    />
                    <input
                      type="text"
                      value={merged[key] || ""}
                      onChange={(e) => set(key, e.target.value)}
                      className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={merged[key] || ""}
                    onChange={(e) => set(key, e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={save}
        disabled={update.isPending || Object.keys(form).length === 0}
        className="flex items-center gap-2 rounded-lg grad-online px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Sauvegarder les paramètres
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Navigation
// ══════════════════════════════════════════════════════════════════════════════

function NavTab() {
  const { data: items = [], isLoading } = useAdminNav();
  const createItem = useCreateNavItem();
  const updateItem = useUpdateNavItem();
  const deleteItem = useDeleteNavItem();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", url: "", icon: "", parentId: "", openInTab: false, roles: "" });

  function resetForm() { setForm({ label: "", url: "", icon: "", parentId: "", openInTab: false, roles: "" }); setShowForm(false); setEditId(null); }

  async function handleSave() {
    const data = { ...form, roles: form.roles ? form.roles.split(",").map(s => s.trim()) : [], parentId: form.parentId || undefined };
    try {
      if (editId) {
        await updateItem.mutateAsync({ id: editId, data });
        toast.success("Élément mis à jour");
      } else {
        await createItem.mutateAsync(data);
        toast.success("Élément ajouté");
      }
      resetForm();
    } catch {
      toast.error("Erreur");
    }
  }

  async function startEdit(item: NavItem) {
    setEditId(item.id);
    setForm({ label: item.label, url: item.url ?? "", icon: item.icon ?? "", parentId: item.parentId ?? "", openInTab: item.openInTab, roles: item.roles.join(", ") });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cet élément de navigation ?")) return;
    await deleteItem.mutateAsync(id);
    toast.success("Supprimé");
  }

  async function toggleActive(item: NavItem) {
    await updateItem.mutateAsync({ id: item.id, data: { isActive: !item.isActive } });
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} élément(s) de navigation</p>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-lg grad-online px-3 py-1.5 text-xs font-medium text-white">
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">{editId ? "Modifier" : "Nouvel élément"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Label *</label>
              <input value={form.label} onChange={e => setForm(p => ({...p, label: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Accueil" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">URL</label>
              <input value={form.url} onChange={e => setForm(p => ({...p, url: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="/online" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Icône (nom Lucide)</label>
              <input value={form.icon} onChange={e => setForm(p => ({...p, icon: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="BookOpen" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Parent (ID)</label>
              <select value={form.parentId} onChange={e => setForm(p => ({...p, parentId: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                <option value="">— Aucun (niveau racine) —</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Rôles visibles (séparés par virgule)</label>
              <input value={form.roles} onChange={e => setForm(p => ({...p, roles: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="STUDENT_ONLINE, TEACHER_ONLINE" />
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={form.openInTab} onChange={e => setForm(p => ({...p, openInTab: e.target.checked}))} className="rounded" />
                Ouvrir dans un nouvel onglet
              </label>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleSave} disabled={!form.label || createItem.isPending || updateItem.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-60">
              {(createItem.isPending || updateItem.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Check className="h-3.5 w-3.5" /> {editId ? "Mettre à jour" : "Créer"}
            </button>
            <button onClick={resetForm} className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card divide-y">
        {items.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">Aucun élément de navigation. Ajoutez-en un.</div>
        )}
        {items.map((item) => (
          <div key={item.id}>
            <div className="flex items-center gap-3 p-3">
              <button onClick={() => toggleActive(item)} className="shrink-0">
                {item.isActive
                  ? <ToggleRight className="h-5 w-5 text-online" />
                  : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.label}</div>
                {item.url && <div className="text-xs text-muted-foreground truncate">{item.url}</div>}
              </div>
              {item.openInTab && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />}
              {item.roles.length > 0 && (
                <div className="flex gap-1">
                  {item.roles.map(r => <span key={r} className="rounded bg-muted px-1.5 py-0.5 text-xs">{r}</span>)}
                </div>
              )}
              <div className="flex items-center gap-1">
                <button onClick={() => startEdit(item)} className="rounded p-1 hover:bg-accent">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(item.id)} className="rounded p-1 hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            </div>
            {item.children.length > 0 && (
              <div className="border-t bg-muted/30">
                {item.children.map((child) => (
                  <div key={child.id} className="flex items-center gap-3 border-b px-3 py-2 last:border-0">
                    <span className="w-6 shrink-0 text-muted-foreground">↳</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{child.label}</div>
                      {child.url && <div className="text-xs text-muted-foreground truncate">{child.url}</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(child)} className="rounded p-1 hover:bg-accent">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleDelete(child.id)} className="rounded p-1 hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Homepage Sections
// ══════════════════════════════════════════════════════════════════════════════

const SECTION_LABELS: Record<string, string> = {
  HERO:         "Héro / Bannière principale",
  CATEGORIES:   "Catégories",
  COURSES:      "Cours populaires",
  TEACHERS:     "Nos enseignants",
  PATHS:        "Parcours d'apprentissage",
  LIVE:         "Sessions live",
  TESTIMONIALS: "Témoignages",
  FAQ:          "FAQ",
};

function HomepageTab() {
  const { data: sections = [], isLoading } = useHomeSections();
  const update = useUpdateHomeSection();
  const reorder = useReorderHomeSections();

  async function toggleSection(id: string, isActive: boolean) {
    await update.mutateAsync({ id, data: { isActive: !isActive } });
    toast.success(isActive ? "Section désactivée" : "Section activée");
  }

  async function moveSection(id: string, direction: "up" | "down") {
    const idx = sections.findIndex(s => s.id === id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sections.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const reordered = [...sections];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    await reorder.mutateAsync(reordered.map((s, i) => ({ id: s.id, order: i })));
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-muted-foreground">
        Activez, désactivez et réordonnez les sections de la page d'accueil publique.
      </p>
      <div className="rounded-xl border bg-card divide-y">
        {sections.map((section, idx) => (
          <div key={section.id} className="flex items-center gap-3 p-3">
            <button onClick={() => toggleSection(section.id, section.isActive)}>
              {section.isActive
                ? <ToggleRight className="h-5 w-5 text-online" />
                : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
            </button>
            <div className="flex-1">
              <div className="text-sm font-medium">{SECTION_LABELS[section.type] || section.type}</div>
              <div className="text-xs text-muted-foreground">{section.isActive ? "Visible" : "Masquée"}</div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => moveSection(section.id, "up")} disabled={idx === 0}
                className="rounded p-1 hover:bg-accent disabled:opacity-30">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => moveSection(section.id, "down")} disabled={idx === sections.length - 1}
                className="rounded p-1 hover:bg-accent disabled:opacity-30">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Courses
// ══════════════════════════════════════════════════════════════════════════════

function CoursesTab() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data, isLoading } = useAdminCourses({ page, q: submittedQ, status: statusFilter || undefined });
  const updateCourse = useAdminUpdateCourse();
  const deleteCourse = useAdminDeleteCourse();
  const duplicateCourse = useAdminDuplicateCourse();

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Supprimer « ${title} » et tout son contenu ?`)) return;
    await deleteCourse.mutateAsync(id);
    toast.success("Cours supprimé");
  }

  async function handleDuplicate(id: string) {
    await duplicateCourse.mutateAsync(id);
    toast.success("Cours dupliqué en brouillon");
  }

  async function handleTogglePublish(c: AdminCourse) {
    const newStatus = c.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    await updateCourse.mutateAsync({ id: c.id, data: { status: newStatus, ...(newStatus === "PUBLISHED" ? { publishedAt: new Date().toISOString() } : {}) } });
    toast.success(newStatus === "PUBLISHED" ? "Cours publié" : "Dépublié");
  }

  async function handleToggleFeatured(c: AdminCourse) {
    await updateCourse.mutateAsync({ id: c.id, data: { isFeatured: !c.isFeatured } });
    toast.success(c.isFeatured ? "Retiré des favoris" : "Mis en avant");
  }

  const StatusBadge = ({ status }: { status: string }) => (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
      status === "PUBLISHED" ? "bg-green-500/10 text-green-600"
        : status === "DRAFT" ? "bg-yellow-500/10 text-yellow-600"
        : "bg-muted text-muted-foreground"
    }`}>{status === "PUBLISHED" ? "Publié" : status === "DRAFT" ? "Brouillon" : "Archivé"}</span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={e => { e.preventDefault(); setSubmittedQ(q); setPage(1); }} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…"
              className="h-8 rounded-lg border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </form>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-8 rounded-lg border bg-background px-2 text-sm outline-none">
          <option value="">Tous les statuts</option>
          <option value="PUBLISHED">Publiés</option>
          <option value="DRAFT">Brouillons</option>
          <option value="ARCHIVED">Archivés</option>
        </select>
        <div className="ml-auto">
          <button onClick={() => setWizardOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg grad-online px-3 text-xs font-medium text-white">
            <Plus className="h-3.5 w-3.5" /> Nouveau cours
          </button>
        </div>
      </div>

      {isLoading ? <Spinner /> : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Cours</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Enseignant</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Inscrits</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.items.map((course) => (
                <tr key={course.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{course.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {course.category?.name ?? "—"} · {course._count.modules} modules
                      {course.isFeatured && <span className="ml-1 text-yellow-500">★</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {course.teacher.firstName} {course.teacher.lastName}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={course.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{course._count.enrollments}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Studio — primary action */}
                      <Link to="/online/studio/$id" params={{ id: course.id }}
                        title="Ouvrir le Studio"
                        className="flex items-center gap-1 rounded-lg bg-online/10 px-2 py-1 text-[10px] font-medium text-online hover:bg-online/20">
                        <GraduationCap className="h-3 w-3" /> Studio
                      </Link>
                      <button title={course.status === "PUBLISHED" ? "Dépublier" : "Publier"}
                        onClick={() => handleTogglePublish(course)} className="rounded p-1 hover:bg-accent">
                        {course.status === "PUBLISHED"
                          ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                          : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                      <button title="Mettre en avant" onClick={() => handleToggleFeatured(course)}
                        className="rounded p-1 hover:bg-accent">
                        <Star className={`h-3.5 w-3.5 ${course.isFeatured ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                      </button>
                      <button title="Dupliquer" onClick={() => handleDuplicate(course.id)} className="rounded p-1 hover:bg-accent">
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <Link to="/online/course/$id" params={{ id: course.id }}
                        title="Voir le cours public" className="rounded p-1 hover:bg-accent inline-flex">
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </Link>
                      <button title="Supprimer" onClick={() => handleDelete(course.id, course.title)}
                        className="rounded p-1 hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun cours</td></tr>
              )}
            </tbody>
          </table>
          {data && data.total > 20 && (
            <div className="border-t p-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{data.total} cours au total</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="rounded border px-2 py-1 hover:bg-accent disabled:opacity-40">Préc.</button>
                <button disabled={page * 20 >= data.total} onClick={() => setPage(p => p + 1)}
                  className="rounded border px-2 py-1 hover:bg-accent disabled:opacity-40">Suiv.</button>
              </div>
            </div>
          )}
        </div>
      )}

      {wizardOpen && (
        <AdminCourseWizard
          onClose={() => setWizardOpen(false)}
          onCreated={(id) => {
            setWizardOpen(false);
            navigate({ to: "/online/studio/$id", params: { id } });
          }}
        />
      )}
    </div>
  );
}

// ── Wizard création cours (Admin) ─────────────────────────────────────────────

type AdminWizardForm = {
  title: string; subtitle: string; description: string;
  language: string; level: string; categoryId: string; tags: string;
  teacherId: string; isFeatured: boolean;
};

function AdminCourseWizard({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { data: categories = [] } = useAdminCategories();
  const { data: teachers } = useAdminTeachers({ limit: 100 } as any);
  const createCourse = useAdminCreateCourse();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<AdminWizardForm>({
    title: "", subtitle: "", description: "",
    language: "fr", level: "", categoryId: "", tags: "",
    teacherId: "", isFeatured: false,
  });

  const set = (k: keyof AdminWizardForm, v: any) => setForm(p => ({ ...p, [k]: v }));
  const flatCats = categories.flatMap(c => [c, ...(c.children ?? [])]);

  const STEPS = ["Contenu du cours", "Classement & Tags", "Paramètres admin"];

  const canNext1 = form.title.trim().length >= 3;
  const canSubmit = canNext1 && !!form.teacherId;

  async function handleSubmit() {
    if (!canSubmit) return;
    try {
      const result = await createCourse.mutateAsync({
        title: form.title,
        subtitle: form.subtitle || undefined,
        description: form.description || undefined,
        language: form.language,
        level: (form.level || undefined) as any,
        categoryId: form.categoryId || undefined,
        tags: form.tags.split(",").map(s => s.trim()).filter(Boolean) as any,
        teacherId: form.teacherId,
        isFeatured: form.isFeatured,
      } as any);
      toast.success("Cours créé — ouverture du Studio");
      onCreated((result as any).id);
    } catch {
      toast.error("Erreur lors de la création");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Nouveau cours · Étape {step} / {STEPS.length}</p>
            <h2 className="text-sm font-semibold">{STEPS[step - 1]}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        {/* Progress */}
        <div className="h-1 w-full bg-muted">
          <div className="h-full grad-online transition-all" style={{ width: `${(step / STEPS.length) * 100}%` }} />
        </div>

        {/* Steps */}
        <div className="p-6 space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Titre du cours *</label>
                <input value={form.title} onChange={e => set("title", e.target.value)} autoFocus
                  placeholder="Ex : Introduction à la programmation Python"
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Sous-titre</label>
                <input value={form.subtitle} onChange={e => set("subtitle", e.target.value)}
                  placeholder="Phrase d'accroche courte"
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Description</label>
                <textarea value={form.description} onChange={e => set("description", e.target.value)}
                  rows={4} placeholder="Décrivez ce que les apprenants vont acquérir…"
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Langue</label>
                  <select value={form.language} onChange={e => set("language", e.target.value)}
                    className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="mg">Malagasy</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Niveau</label>
                  <select value={form.level} onChange={e => set("level", e.target.value)}
                    className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                    <option value="">— Non spécifié —</option>
                    <option value="BEGINNER">Débutant</option>
                    <option value="INTERMEDIATE">Intermédiaire</option>
                    <option value="ADVANCED">Avancé</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Catégorie</label>
                <select value={form.categoryId} onChange={e => set("categoryId", e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                  <option value="">— Aucune —</option>
                  {flatCats.map(c => (
                    <option key={c.id} value={c.id}>{(c as any).parentId ? `  ↳ ${c.name}` : c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tags (séparés par des virgules)</label>
                <input value={form.tags} onChange={e => set("tags", e.target.value)}
                  placeholder="Python, Débutant, Programmation…"
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Enseignant responsable *</label>
                <select value={form.teacherId} onChange={e => set("teacherId", e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                  <option value="">— Sélectionner un enseignant —</option>
                  {teachers?.items.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">L'enseignant aura accès au Studio pour ce cours.</p>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-accent">
                <input type="checkbox" checked={form.isFeatured} onChange={e => set("isFeatured", e.target.checked)} className="mt-0.5 rounded" />
                <div>
                  <div className="text-sm font-medium">Mettre en avant sur la page d'accueil ★</div>
                  <div className="text-xs text-muted-foreground">Le cours apparaîtra dans la section "Cours vedettes".</div>
                </div>
              </label>
              {/* Summary */}
              <div className="rounded-xl border bg-muted/30 p-3 space-y-1 text-xs text-muted-foreground">
                <div className="font-medium text-foreground mb-1">Récapitulatif</div>
                <div><span className="font-medium">Titre :</span> {form.title}</div>
                {form.subtitle && <div><span className="font-medium">Sous-titre :</span> {form.subtitle}</div>}
                <div><span className="font-medium">Langue :</span> {form.language.toUpperCase()} · <span className="font-medium">Niveau :</span> {form.level || "Non spécifié"}</div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">
            {step > 1 ? "Retour" : "Annuler"}
          </button>
          {step < STEPS.length ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext1}
              className="rounded-lg grad-online px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
              Suivant →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={!canSubmit || createCourse.isPending}
              className="flex items-center gap-2 rounded-lg grad-online px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
              {createCourse.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
              Créer et ouvrir le Studio
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Categories
// ══════════════════════════════════════════════════════════════════════════════

function CategoriesTab() {
  const { data: cats = [], isLoading } = useAdminCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const del = useDeleteCategory();
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", icon: "", color: "#6366f1", parentId: "" });

  const COLORS = ["#6366f1","#a855f7","#ec4899","#f97316","#eab308","#22c55e","#14b8a6","#3b82f6"];

  function resetForm() { setForm({ name: "", description: "", icon: "", color: "#6366f1", parentId: "" }); setShowForm(false); setEditId(null); }

  async function handleSave() {
    const data = { ...form, parentId: form.parentId || undefined };
    try {
      if (editId) {
        await update.mutateAsync({ id: editId, data });
        toast.success("Catégorie mise à jour");
      } else {
        await create.mutateAsync(data as any);
        toast.success("Catégorie créée");
      }
      resetForm();
    } catch { toast.error("Erreur"); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer la catégorie "${name}" ?`)) return;
    await del.mutateAsync(id);
    toast.success("Supprimée");
  }

  function startEdit(c: OnlineCategory) {
    setEditId(c.id);
    setForm({ name: c.name, description: c.description ?? "", icon: c.icon ?? "", color: c.color ?? "#6366f1", parentId: c.parentId ?? "" });
    setShowForm(true);
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{cats.length} catégorie(s) racine</p>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-lg grad-online px-3 py-1.5 text-xs font-medium text-white">
          <Plus className="h-3.5 w-3.5" /> Nouvelle catégorie
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">{editId ? "Modifier la catégorie" : "Nouvelle catégorie"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Nom *</label>
              <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Icône (emoji ou nom)</label>
              <input value={form.icon} onChange={e => setForm(p => ({...p, icon: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="💻 ou Code" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">Description</label>
              <input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Couleur</label>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(p => ({...p, color: c}))}
                    style={{ backgroundColor: c }}
                    className={`h-6 w-6 rounded-full transition ${form.color === c ? "ring-2 ring-ring ring-offset-2" : ""}`} />
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Catégorie parent</label>
              <select value={form.parentId} onChange={e => setForm(p => ({...p, parentId: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                <option value="">— Aucune (niveau racine) —</option>
                {cats.filter(c => c.id !== editId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleSave} disabled={!form.name || create.isPending || update.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-60">
              <Check className="h-3.5 w-3.5" /> {editId ? "Mettre à jour" : "Créer"}
            </button>
            <button onClick={resetForm} className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">Annuler</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {cats.map(cat => (
          <div key={cat.id} className="rounded-xl border bg-card">
            <div className="flex items-center gap-3 p-3">
              <div className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-lg"
                style={{ backgroundColor: (cat.color ?? "#6366f1") + "20" }}>
                {cat.icon || <Tag className="h-4 w-4" style={{ color: cat.color ?? "#6366f1" }} />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{cat.name}</div>
                <div className="text-xs text-muted-foreground">{cat._count.courses} cours · {cat.children.length} sous-catégories</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => startEdit(cat)} className="rounded p-1 hover:bg-accent">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(cat.id, cat.name)} className="rounded p-1 hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            </div>
            {cat.children.length > 0 && (
              <div className="border-t divide-y bg-muted/20">
                {cat.children.map(sub => (
                  <div key={sub.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-8 text-center text-muted-foreground text-xs">↳</span>
                    <div className="flex-1 text-sm">{sub.name}</div>
                    <span className="text-xs text-muted-foreground">{sub._count.courses} cours</span>
                    <button onClick={() => startEdit(sub)} className="rounded p-1 hover:bg-accent">
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDelete(sub.id, sub.name)} className="rounded p-1 hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {cats.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aucune catégorie. Créez-en une pour organiser les cours.
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Media Library
// ══════════════════════════════════════════════════════════════════════════════

const TYPE_ICON: Record<string, React.ElementType> = {
  IMAGE: Image, VIDEO: Film, AUDIO: Volume2, PDF: FileText,
  DOCUMENT: FileText, ZIP: FileArchive, LINK: Link2, CODE: FileText,
};

const TYPE_LABELS: Record<string, string> = {
  IMAGE: "Images", VIDEO: "Vidéos", AUDIO: "Audio", PDF: "PDFs",
  DOCUMENT: "Documents", ZIP: "Archives", LINK: "Liens", CODE: "Code",
};

function MediaTab() {
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkForm, setLinkForm] = useState({ name: "", url: "", type: "LINK" });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useAdminMedia({ page, q: submittedQ, type: typeFilter || undefined });
  const uploadMedia = useUploadMedia();
  const addLink = useAddMediaLink();
  const updateMedia = useUpdateMedia();
  const deleteMedia = useDeleteMedia();

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        await uploadMedia.mutateAsync(fd);
        toast.success(`${file.name} uploadé`);
      } catch { toast.error(`Erreur upload ${file.name}`); }
    }
  }, [uploadMedia]);

  async function handleAddLink() {
    if (!linkForm.name || !linkForm.url) return toast.error("Nom et URL requis");
    try {
      await addLink.mutateAsync(linkForm);
      toast.success("Lien ajouté");
      setShowLinkForm(false);
      setLinkForm({ name: "", url: "", type: "LINK" });
    } catch { toast.error("Erreur"); }
  }

  async function handleRename(id: string) {
    if (!renameVal.trim()) return;
    await updateMedia.mutateAsync({ id, name: renameVal.trim() });
    setRenamingId(null);
    toast.success("Renommé");
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce fichier ?")) return;
    await deleteMedia.mutateAsync(id);
    toast.success("Supprimé");
  }

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={e => { e.preventDefault(); setSubmittedQ(q); setPage(1); }} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…"
              className="h-8 rounded-lg border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </form>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="h-8 rounded-lg border bg-background px-2 text-sm outline-none">
          <option value="">Tous les types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <input ref={fileInputRef} type="file" multiple className="hidden"
            onChange={e => handleUpload(e.target.files)} />
          <button onClick={() => fileInputRef.current?.click()}
            className="flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs hover:bg-accent">
            <Upload className="h-3.5 w-3.5" /> Uploader
          </button>
          <button onClick={() => setShowLinkForm(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg grad-online px-3 text-xs font-medium text-white">
            <Link2 className="h-3.5 w-3.5" /> Ajouter un lien
          </button>
        </div>
      </div>

      {uploadMedia.isPending && (
        <div className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-online" />
          Upload en cours…
        </div>
      )}

      {showLinkForm && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Ajouter un lien externe</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Nom *</label>
              <input value={linkForm.name} onChange={e => setLinkForm(p => ({...p, name: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">URL *</label>
              <input value={linkForm.url} onChange={e => setLinkForm(p => ({...p, url: e.target.value}))}
                type="url" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Type</label>
              <select value={linkForm.type} onChange={e => setLinkForm(p => ({...p, type: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none">
                <option value="LINK">Lien externe</option>
                <option value="VIDEO">Vidéo (YouTube/Vimeo)</option>
                <option value="PDF">PDF externe</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleAddLink} disabled={addLink.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-60">
              <Check className="h-3.5 w-3.5" /> Ajouter
            </button>
            <button onClick={() => setShowLinkForm(false)} className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">Annuler</button>
          </div>
        </div>
      )}

      {isLoading ? <Spinner /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.items.map((file) => {
              const TypeIcon = TYPE_ICON[file.type] ?? FileText;
              const isRenaming = renamingId === file.id;
              return (
                <div key={file.id} className="group rounded-xl border bg-card p-3 hover:shadow-elegant transition">
                  <div className="mb-2 flex items-start gap-2">
                    <div className="shrink-0 rounded-lg bg-online/10 p-2">
                      <TypeIcon className="h-4 w-4 text-online" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <input value={renameVal} onChange={e => setRenameVal(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleRename(file.id); if (e.key === "Escape") setRenamingId(null); }}
                          autoFocus
                          className="w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring" />
                      ) : (
                        <div className="truncate text-xs font-medium">{file.name}</div>
                      )}
                      <div className="text-xs text-muted-foreground">{formatSize(file.size)} · {file.type}</div>
                    </div>
                  </div>
                  {file.type === "IMAGE" && (
                    <div className="mb-2 aspect-video overflow-hidden rounded-lg bg-muted">
                      <img src={`${API_ORIGIN}${file.url.startsWith('/') ? '' : '/'}${file.url}`} alt={file.name}
                        className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    {isRenaming ? (
                      <>
                        <button onClick={() => handleRename(file.id)} className="flex-1 rounded border bg-foreground py-1 text-xs font-medium text-background">OK</button>
                        <button onClick={() => setRenamingId(null)} className="flex-1 rounded border py-1 text-xs">Annuler</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setRenamingId(file.id); setRenameVal(file.name); }}
                          className="flex-1 rounded border py-1 text-xs hover:bg-accent">
                          <Pencil className="mx-auto h-3 w-3" />
                        </button>
                        <a href={`${API_ORIGIN}${file.url}`} target="_blank" rel="noopener noreferrer"
                          className="flex-1 rounded border py-1 text-xs hover:bg-accent flex items-center justify-center">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <button onClick={() => { navigator.clipboard.writeText(`${API_ORIGIN}${file.url}`); toast.success("URL copiée"); }}
                          className="flex-1 rounded border py-1 text-xs hover:bg-accent">
                          <Copy className="mx-auto h-3 w-3" />
                        </button>
                        <button onClick={() => handleDelete(file.id)} className="flex-1 rounded border py-1 text-xs hover:bg-destructive/10">
                          <Trash2 className="mx-auto h-3 w-3 text-destructive" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {data?.items.length === 0 && (
              <div className="col-span-4 rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
                Médiathèque vide. Uploadez des fichiers ou ajoutez des liens.
              </div>
            )}
          </div>
          {data && data.total > 24 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{data.total} fichier(s)</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded border px-2 py-1 hover:bg-accent disabled:opacity-40">Préc.</button>
                <button disabled={page * 24 >= data.total} onClick={() => setPage(p => p + 1)} className="rounded border px-2 py-1 hover:bg-accent disabled:opacity-40">Suiv.</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Teachers
// ══════════════════════════════════════════════════════════════════════════════

function TeachersTab() {
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminTeachers({ page, q: submittedQ });
  const updateTeacher = useAdminUpdateTeacher();
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", avatarUrl: "", isActive: true, systemRole: "TEACHER_ONLINE" });

  async function handleSave() {
    if (!editId) return;
    try {
      await updateTeacher.mutateAsync({ id: editId, data: form as any });
      toast.success("Enseignant mis à jour");
      setEditId(null);
    } catch { toast.error("Erreur"); }
  }

  function startEdit(t: any) {
    setEditId(t.id);
    setForm({ firstName: t.firstName, lastName: t.lastName, avatarUrl: t.avatarUrl ?? "", isActive: t.isActive, systemRole: t.systemRole });
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <form onSubmit={e => { e.preventDefault(); setSubmittedQ(q); setPage(1); }} className="flex-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un enseignant…"
              className="h-8 w-full rounded-lg border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </form>
      </div>

      {editId && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Modifier l'enseignant</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs text-muted-foreground">Prénom</label>
              <input value={form.firstName} onChange={e => setForm(p => ({...p, firstName: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" /></div>
            <div><label className="mb-1 block text-xs text-muted-foreground">Nom</label>
              <input value={form.lastName} onChange={e => setForm(p => ({...p, lastName: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" /></div>
            <div className="col-span-2"><label className="mb-1 block text-xs text-muted-foreground">URL Avatar</label>
              <input value={form.avatarUrl} onChange={e => setForm(p => ({...p, avatarUrl: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" /></div>
            <div><label className="mb-1 block text-xs text-muted-foreground">Rôle système</label>
              <select value={form.systemRole} onChange={e => setForm(p => ({...p, systemRole: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none">
                <option value="TEACHER_ONLINE">TEACHER_ONLINE</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                <option value="STUDENT_ONLINE">STUDENT_ONLINE</option>
              </select></div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({...p, isActive: e.target.checked}))} className="rounded" />
                Compte actif
              </label>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleSave} disabled={updateTeacher.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-60">
              <Check className="h-3.5 w-3.5" /> Sauvegarder
            </button>
            <button onClick={() => setEditId(null)} className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">Annuler</button>
          </div>
        </div>
      )}

      {isLoading ? <Spinner /> : (
        <div className="rounded-xl border bg-card divide-y">
          {data?.items.map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-3">
              <div className="h-9 w-9 shrink-0 rounded-full grad-online flex items-center justify-center text-xs font-semibold text-white">
                {t.avatarUrl
                  ? <img src={t.avatarUrl} className="h-full w-full rounded-full object-cover" />
                  : `${t.firstName[0]}${t.lastName[0]}`}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{t.firstName} {t.lastName}</div>
                <div className="text-xs text-muted-foreground">{t.email} · {t._count.onlineCourses} cours</div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${t.isActive ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                {t.isActive ? "Actif" : "Inactif"}
              </span>
              <button onClick={() => startEdit(t)} className="rounded p-1 hover:bg-accent">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
          {data?.items.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Aucun enseignant</div>}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Students
// ══════════════════════════════════════════════════════════════════════════════

function StudentsTab() {
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminStudents({ page, q: submittedQ });

  return (
    <div className="space-y-4 max-w-3xl">
      <form onSubmit={e => { e.preventDefault(); setSubmittedQ(q); setPage(1); }}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un étudiant…"
            className="h-8 w-full rounded-lg border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </form>
      {isLoading ? <Spinner /> : (
        <div className="rounded-xl border bg-card divide-y">
          {data?.items.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                {s.firstName[0]}{s.lastName[0]}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{s.firstName} {s.lastName}</div>
                <div className="text-xs text-muted-foreground">{s.email}</div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${s.isActive ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                {s.isActive ? "Actif" : "Inactif"}
              </span>
              <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("fr")}</span>
            </div>
          ))}
          {data?.items.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Aucun étudiant</div>}
        </div>
      )}
      {data && data.total > 20 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{data.total} étudiant(s)</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded border px-2 py-1 hover:bg-accent disabled:opacity-40">Préc.</button>
            <button disabled={page * 20 >= data.total} onClick={() => setPage(p => p + 1)} className="rounded border px-2 py-1 hover:bg-accent disabled:opacity-40">Suiv.</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FAQ & Témoignages
// ══════════════════════════════════════════════════════════════════════════════

function FaqTab() {
  const [subTab, setSubTab] = useState<"faq" | "testimonials">("faq");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["faq", "testimonials"] as const).map((t) => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              subTab === t ? "bg-online text-white" : "border hover:bg-accent text-muted-foreground"}`}>
            {t === "faq" ? "FAQ" : "Témoignages"}
          </button>
        ))}
      </div>
      {subTab === "faq" ? <FaqList /> : <TestimonialList />}
    </div>
  );
}

function FaqList() {
  const { data: items = [], isLoading } = useFaqItems();
  const create = useCreateFaqItem();
  const update = useUpdateFaqItem();
  const del = useDeleteFaqItem();
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ question: "", answer: "" });

  function resetForm() { setForm({ question: "", answer: "" }); setShowForm(false); setEditId(null); }

  async function handleSave() {
    try {
      if (editId) {
        await update.mutateAsync({ id: editId, data: form });
        toast.success("Question mise à jour");
      } else {
        await create.mutateAsync(form);
        toast.success("Question ajoutée");
      }
      resetForm();
    } catch { toast.error("Erreur"); }
  }

  async function toggleActive(item: FaqItem) {
    await update.mutateAsync({ id: item.id, data: { isActive: !item.isActive } });
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-3">
      <button onClick={() => { resetForm(); setShowForm(true); }}
        className="flex items-center gap-1.5 rounded-lg grad-online px-3 py-1.5 text-xs font-medium text-white">
        <Plus className="h-3.5 w-3.5" /> Nouvelle question
      </button>

      {showForm && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">{editId ? "Modifier" : "Nouvelle question FAQ"}</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Question *</label>
              <input value={form.question} onChange={e => setForm(p => ({...p, question: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Réponse *</label>
              <textarea value={form.answer} onChange={e => setForm(p => ({...p, answer: e.target.value}))} rows={3}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleSave} disabled={!form.question || !form.answer}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-60">
              <Check className="h-3.5 w-3.5" /> {editId ? "Mettre à jour" : "Créer"}
            </button>
            <button onClick={resetForm} className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">Annuler</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card divide-y">
        {items.map((item) => (
          <div key={item.id} className="p-3">
            <div className="flex items-start gap-2">
              <button onClick={() => toggleActive(item)} className="mt-0.5 shrink-0">
                {item.isActive
                  ? <ToggleRight className="h-4 w-4 text-online" />
                  : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
              </button>
              <div className="flex-1">
                <div className="text-sm font-medium">{item.question}</div>
                <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.answer}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditId(item.id); setForm({ question: item.question, answer: item.answer }); setShowForm(true); }}
                  className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                <button onClick={() => { if (confirm("Supprimer ?")) del.mutateAsync(item.id).then(() => toast.success("Supprimé")); }}
                  className="rounded p-1 hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Aucune question FAQ.</div>}
      </div>
    </div>
  );
}

function TestimonialList() {
  const { data: items = [], isLoading } = useTestimonials();
  const create = useCreateTestimonial();
  const update = useUpdateTestimonial();
  const del = useDeleteTestimonial();
  const uploadPhoto = useUploadTestimonialPhoto();
  const qc = useQueryClient();
  const photoInput = useRef<HTMLInputElement>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", content: "", rating: 5, avatar: "" });

  function resetForm() { setForm({ name: "", role: "", content: "", rating: 5, avatar: "" }); setShowForm(false); setEditId(null); }

  async function onPhoto(file?: File) {
    if (!file) return;
    try {
      const { url } = await uploadPhoto.mutateAsync(file);
      setForm((p) => ({ ...p, avatar: url }));
      toast.success("Photo ajoutée : pensez à enregistrer");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Envoi de la photo impossible"); }
    finally { if (photoInput.current) photoInput.current.value = ""; }
  }

  async function handleSave() {
    try {
      if (editId) {
        await update.mutateAsync({ id: editId, data: form });
        toast.success("Mis à jour");
      } else {
        await create.mutateAsync(form);
        toast.success("Témoignage ajouté");
      }
      resetForm();
      qc.invalidateQueries({ queryKey: ["public", "testimonials"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Enregistrement impossible"); }
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-3">
      <button onClick={() => { resetForm(); setShowForm(true); }}
        className="flex items-center gap-1.5 rounded-lg grad-online px-3 py-1.5 text-xs font-medium text-white">
        <Plus className="h-3.5 w-3.5" /> Ajouter un témoignage
      </button>

      {showForm && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">{editId ? "Modifier" : "Nouveau témoignage"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs text-muted-foreground">Nom *</label>
              <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" /></div>
            <div><label className="mb-1 block text-xs text-muted-foreground">Rôle / Titre</label>
              <input value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Étudiant en informatique" /></div>
            <div className="col-span-2"><label className="mb-1 block text-xs text-muted-foreground">Photo du témoin</label>
              <div className="flex items-center gap-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-lg font-semibold text-muted-foreground ring-2 ring-border">
                  {form.avatar ? <img src={mediaUrl(form.avatar)} alt="" className="h-full w-full object-cover" /> : (form.name[0]?.toUpperCase() || "?")}
                </div>
                <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
                <button type="button" onClick={() => photoInput.current?.click()} disabled={uploadPhoto.isPending}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60">
                  {uploadPhoto.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {form.avatar ? "Changer la photo" : "Téléverser une photo"}
                </button>
                {form.avatar && (
                  <button type="button" onClick={() => setForm((p) => ({ ...p, avatar: "" }))}
                    className="rounded-lg px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10">Retirer</button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">JPG, PNG ou WebP, 5 Mo maximum. Une photo carrée, visage centré, rend le mieux.</p>
            </div>
            <div><label className="mb-1 block text-xs text-muted-foreground">Note (1–5)</label>
              <input type="number" min={1} max={5} value={form.rating} onChange={e => setForm(p => ({...p, rating: Number(e.target.value)}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" /></div>
            <div className="col-span-2"><label className="mb-1 block text-xs text-muted-foreground">Témoignage *</label>
              <textarea value={form.content} onChange={e => setForm(p => ({...p, content: e.target.value}))} rows={3}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" /></div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleSave} disabled={!form.name || !form.content}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-60">
              <Check className="h-3.5 w-3.5" /> {editId ? "Mettre à jour" : "Créer"}
            </button>
            <button onClick={resetForm} className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">Annuler</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                {item.avatar ? <img src={mediaUrl(item.avatar)} alt="" className="h-full w-full rounded-full object-cover" /> : item.name[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.name}</span>
                  {item.role && <span className="text-xs text-muted-foreground">{item.role}</span>}
                  <span className="text-xs text-yellow-500">{"★".repeat(item.rating)}</span>
                  {!item.isActive && <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Masqué</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.content}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => update.mutateAsync({ id: item.id, data: { isActive: !item.isActive } })}
                  className="rounded p-1 hover:bg-accent">
                  {item.isActive ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
                <button onClick={() => { setEditId(item.id); setForm({ name: item.name, role: item.role ?? "", content: item.content, rating: item.rating, avatar: item.avatar ?? "" }); setShowForm(true); }}
                  className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                <button onClick={() => { if (confirm("Supprimer ?")) del.mutateAsync(item.id).then(() => toast.success("Supprimé")); }}
                  className="rounded p-1 hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Aucun témoignage.</div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Payments
// ══════════════════════════════════════════════════════════════════════════════

const API_BASE_PAY = API_ORIGIN;
function payMediaUrl(path?: string | null) {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_BASE_PAY}${path}`;
}

const STATUS_TABS = ["all", "PENDING", "VALIDATED", "REFUND_REQUESTED", "REFUSED", "REFUNDED"] as const;
type StatusTab = typeof STATUS_TABS[number];
const STATUS_TAB_LABEL: Record<StatusTab, string> = {
  all: "Tous", PENDING: "En attente", VALIDATED: "Validés",
  REFUND_REQUESTED: "Remb. demandés", REFUSED: "Refusés", REFUNDED: "Remboursés",
};

function PaymentsTab() {
  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");
  const [refuseId, setRefuseId] = useState<string | null>(null);
  const [refuseReason, setRefuseReason] = useState("");
  const [screenshotOpen, setScreenshotOpen] = useState<string | null>(null);

  const stats = usePaymentStats();
  const payments = useAdminPayments({ status: statusFilter === "all" ? undefined : statusFilter });
  const validate = useValidatePayment();
  const refuse = useRefusePayment();
  const approveRefund = useApproveRefund();
  const rejectRefund = useRejectRefund();

  async function handleValidate(id: string) {
    try {
      await validate.mutateAsync(id);
      toast.success("Paiement validé — étudiant inscrit automatiquement");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function handleApproveRefund(id: string) {
    if (!confirm("Approuver le remboursement ? L'accès au cours sera retiré.")) return;
    try {
      await approveRefund.mutateAsync(id);
      toast.success("Remboursement approuvé — accès retiré");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function handleRejectRefund(id: string) {
    try {
      await rejectRefund.mutateAsync({ id });
      toast.success("Demande de remboursement refusée");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function handleRefuse() {
    if (!refuseId) return;
    try {
      await refuse.mutateAsync({ id: refuseId, reason: refuseReason });
      toast.success("Paiement refusé");
      setRefuseId(null);
      setRefuseReason("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  const s = stats.data;

  return (
    <div className="space-y-6">
      {/* Stats */}
      {s && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="En attente" value={s.pending} color="text-amber-600" />
          <StatCard label="Validés" value={s.validated} color="text-green-600" />
          <StatCard label="Remb. demandés" value={s.refundRequested} color="text-orange-600" />
          <StatCard label="Remboursés" value={s.refunded} color="text-purple-600" />
          <StatCard label="Total validé (MGA)" value={s.totalValidated.toLocaleString("fr-FR")} color="text-online" />
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === st ? "grad-online text-white" : "border hover:bg-muted/60"
            }`}
          >
            {STATUS_TAB_LABEL[st]}
            {st === "PENDING" && s?.pending ? ` (${s.pending})` : ""}
            {st === "REFUND_REQUESTED" && s?.refundRequested ? ` (${s.refundRequested})` : ""}
          </button>
        ))}
      </div>

      {/* Table */}
      {payments.isLoading ? (
        <Spinner />
      ) : (payments.data?.items ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Aucun paiement{statusFilter !== "all" ? " dans cette catégorie" : ""}.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  {["Étudiant", "Cours", "Montant", "Méthode", "Référence", "Date", "Statut", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {(payments.data?.items ?? []).map((p) => (
                  <PaymentRow
                    key={p.id}
                    p={p}
                    onValidate={() => handleValidate(p.id)}
                    onRefuse={() => { setRefuseId(p.id); setRefuseReason(""); }}
                    onApproveRefund={() => handleApproveRefund(p.id)}
                    onRejectRefund={() => handleRejectRefund(p.id)}
                    onViewScreenshot={() => setScreenshotOpen(p.screenshotUrl)}
                    validating={validate.isPending}
                    refunding={approveRefund.isPending || rejectRefund.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Refuse modal */}
      {refuseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRefuseId(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl">
            <h3 className="font-semibold">Refuser le paiement</h3>
            <p className="mt-1 text-sm text-muted-foreground">Indiquez la raison du refus (optionnel)</p>
            <textarea
              value={refuseReason}
              onChange={(e) => setRefuseReason(e.target.value)}
              rows={3}
              placeholder="Référence incorrecte, montant insuffisant…"
              className="mt-3 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setRefuseId(null)}
                className="flex-1 rounded-lg border py-2 text-sm hover:bg-accent"
              >
                Annuler
              </button>
              <button
                onClick={handleRefuse}
                disabled={refuse.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {refuse.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Refuser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot lightbox */}
      {screenshotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setScreenshotOpen(null)}>
          <div className="absolute inset-0 bg-black/80" />
          <img src={payMediaUrl(screenshotOpen)} alt="Capture" className="relative max-h-[80vh] max-w-[90vw] rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}

function PaymentRow({
  p, onValidate, onRefuse, onApproveRefund, onRejectRefund, onViewScreenshot, validating, refunding,
}: {
  p: CoursePayment;
  onValidate: () => void;
  onRefuse: () => void;
  onApproveRefund: () => void;
  onRejectRefund: () => void;
  onViewScreenshot: () => void;
  validating: boolean;
  refunding: boolean;
}) {
  const METHOD_LABEL: Record<string, string> = {
    MVOLA: "MVola", ORANGE_MONEY: "Orange Money", AIRTEL_MONEY: "Airtel Money", CARD: "Carte",
  };
  return (
    <tr className="hover:bg-muted/20">
      <td className="px-4 py-3">
        <div className="font-medium">{p.student?.firstName} {p.student?.lastName}</div>
        <div className="text-xs text-muted-foreground">{p.student?.email}</div>
      </td>
      <td className="px-4 py-3">
        <div className="max-w-[140px] truncate text-sm">{p.course?.title}</div>
      </td>
      <td className="px-4 py-3 font-semibold">
        {p.amount.toLocaleString("fr-FR")} {p.currency}
        {p.couponCode && (
          <div className="text-[10px] font-normal text-emerald-600">
            🏷 {p.couponCode} (−{(p.discountAmount ?? 0).toLocaleString("fr-FR")})
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {METHOD_LABEL[p.method] ?? p.method}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="font-mono text-xs">{p.reference}</div>
        <div className="text-xs text-muted-foreground">{p.transactionRef}</div>
        <div className="text-xs text-muted-foreground">Exp: {p.senderNumber}</div>
        {p.screenshotUrl && (
          <button onClick={onViewScreenshot} className="mt-0.5 text-xs text-online hover:underline">
            Voir capture
          </button>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {new Date(p.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
      </td>
      <td className="px-4 py-3">
        <PaymentStatusBadge status={p.status} />
        {p.refusedReason && (
          <div className="mt-1 text-xs text-muted-foreground">{p.refusedReason}</div>
        )}
        {p.status === "REFUND_REQUESTED" && p.refundReason && (
          <div className="mt-1 text-xs italic text-muted-foreground">« {p.refundReason} »</div>
        )}
      </td>
      <td className="px-4 py-3">
        {p.status === "PENDING" && (
          <div className="flex gap-1.5">
            <button
              onClick={onValidate}
              disabled={validating}
              className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              <Check className="h-3 w-3" /> Valider
            </button>
            <button
              onClick={onRefuse}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              <X className="h-3 w-3" /> Refuser
            </button>
          </div>
        )}
        {p.status === "REFUND_REQUESTED" && (
          <div className="flex gap-1.5">
            <button
              onClick={onApproveRefund}
              disabled={refunding}
              className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
            >
              <Check className="h-3 w-3" /> Rembourser
            </button>
            <button
              onClick={onRejectRefund}
              disabled={refunding}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-accent disabled:opacity-60"
            >
              <X className="h-3 w-3" /> Refuser
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Coupons Tab ──────────────────────────────────────────────────────────────

function CouponsTab() {
  const { data: coupons = [], isLoading } = useCoupons();
  const create = useCreateCoupon();
  const update = useUpdateCoupon();
  const del = useDeleteCoupon();

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [discountValue, setDiscountValue] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  async function handleCreate() {
    if (!code.trim() || !discountValue) { toast.error("Code et valeur requis"); return; }
    try {
      await create.mutateAsync({
        code: code.trim(),
        discountType,
        discountValue: Number(discountValue),
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
        expiresAt: expiresAt || null,
      });
      toast.success("Code promo créé");
      setCode(""); setDiscountValue(""); setMaxRedemptions(""); setExpiresAt("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="rounded-2xl border bg-card p-5 shadow-elegant">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Tag className="h-4 w-4 text-online" /> Nouveau code promo (plateforme)
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE"
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-online/40" />
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "PERCENT" | "FIXED")}
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-online/40">
            <option value="PERCENT">Pourcentage (%)</option>
            <option value="FIXED">Montant fixe</option>
          </select>
          <input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
            placeholder={discountType === "PERCENT" ? "20" : "10000"}
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-online/40" />
          <input type="number" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="Max utilisations (illimité)"
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-online/40" />
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-online/40" />
        </div>
        <button onClick={handleCreate} disabled={create.isPending}
          className="mt-3 inline-flex items-center gap-2 rounded-lg grad-online px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <Spinner />
      ) : coupons.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">Aucun code promo.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>{["Code", "Remise", "Portée", "Utilisations", "Expire", "Actif", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono font-bold">{c.code}</td>
                  <td className="px-4 py-3">{c.discountType === "PERCENT" ? `${c.discountValue}%` : `${c.discountValue.toLocaleString("fr-FR")} MGA`}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.course ? c.course.title : "Tous les cours"}</td>
                  <td className="px-4 py-3">{c.redeemedCount}{c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => update.mutate({ id: c.id, isActive: !c.isActive })}
                      className={c.isActive ? "text-green-600" : "text-muted-foreground"}>
                      {c.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { if (confirm(`Supprimer le code ${c.code} ?`)) del.mutate(c.id); }}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-elegant">
      <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-online" />
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  STUDENT_ONLINE:  { label: "Étudiant",      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  TEACHER_ONLINE:  { label: "Enseignant",    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  SUPER_ADMIN:     { label: "Super Admin",   color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

function UsersTab() {
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [tempPasswordResult, setTempPasswordResult] = useState<{ id: string; name: string; pw: string } | null>(null);

  const { data, isLoading } = useAdminUsers({ page, q, role: roleFilter, status: statusFilter });
  const toggleActive = useAdminToggleActive();
  const resetPw = useAdminResetPassword();
  const deleteUser = useAdminDeleteUser();

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  async function handleToggle(u: AdminUser) {
    await toggleActive.mutateAsync(u.id);
    toast.success(u.isActive ? `${u.firstName} désactivé` : `${u.firstName} activé`);
  }

  async function handleReset(u: AdminUser) {
    const res = await resetPw.mutateAsync(u.id);
    setTempPasswordResult({ id: u.id, name: `${u.firstName} ${u.lastName}`, pw: res.tempPassword });
    toast.success("Mot de passe réinitialisé");
  }

  async function handleDelete(u: AdminUser) {
    if (!confirm(`Désactiver définitivement ${u.firstName} ${u.lastName} ?`)) return;
    await deleteUser.mutateAsync(u.id);
    toast.success("Utilisateur désactivé");
  }

  function fmtDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <div className="space-y-4">
      {/* Temp password modal */}
      {tempPasswordResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl">
            <h3 className="mb-1 font-bold">Mot de passe temporaire</h3>
            <p className="mb-4 text-sm text-muted-foreground">{tempPasswordResult.name}</p>
            <div className="flex items-center gap-2 rounded-xl border bg-muted/50 px-4 py-3 font-mono text-lg font-bold tracking-widest">
              {tempPasswordResult.pw}
              <button
                onClick={() => { navigator.clipboard.writeText(tempPasswordResult.pw); toast.success("Copié !"); }}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Communiquez ce mot de passe à l'utilisateur. Il devra le changer à sa première connexion.</p>
            <button
              onClick={() => setTempPasswordResult(null)}
              className="mt-4 w-full rounded-xl grad-online py-2 text-sm font-semibold text-white"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Create user modal */}
      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} />
      )}

      {/* Edit role modal */}
      {editUser && (
        <EditRoleModal user={editUser} onClose={() => setEditUser(null)} />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            placeholder="Chercher un utilisateur…"
            className="w-full rounded-xl border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-online/40"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-online/40"
        >
          <option value="">Tous les rôles</option>
          <option value="STUDENT_ONLINE">Étudiants</option>
          <option value="TEACHER_ONLINE">Enseignants</option>
          <option value="SUPER_ADMIN">Super Admins</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-online/40"
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
        </select>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-xl grad-online px-4 py-2 text-sm font-semibold text-white"
        >
          <UserPlus className="h-4 w-4" /> Créer
        </button>
      </div>

      {/* Stats */}
      {data && (
        <div className="text-sm text-muted-foreground">
          {data.total} utilisateur{data.total !== 1 ? "s" : ""} trouvé{data.total !== 1 ? "s" : ""}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Utilisateur</th>
              <th className="px-4 py-3 text-left font-medium">Rôle</th>
              <th className="px-4 py-3 text-left font-medium">Statut</th>
              <th className="px-4 py-3 text-left font-medium">Dernière connexion</th>
              <th className="px-4 py-3 text-left font-medium">Créé le</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-online" /></td></tr>
            ) : (data?.items ?? []).length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Aucun utilisateur trouvé</td></tr>
            ) : (
              (data?.items ?? []).map(u => {
                const rl = ROLE_LABELS[u.systemRole] ?? { label: u.systemRole, color: "bg-muted text-muted-foreground" };
                return (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full grad-online text-[11px] font-bold text-white">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div>
                          <div className="font-medium">{u.firstName} {u.lastName}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${rl.color}`}>
                        {rl.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <ShieldCheck className="h-3 w-3" /> Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <ShieldOff className="h-3 w-3" /> Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(u.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title={u.isActive ? "Désactiver" : "Activer"}
                          onClick={() => handleToggle(u)}
                          disabled={toggleActive.isPending}
                          className={`grid h-7 w-7 place-items-center rounded-lg transition-colors ${u.isActive ? "hover:bg-red-100 hover:text-red-600" : "hover:bg-green-100 hover:text-green-600"}`}
                        >
                          {u.isActive ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                        </button>
                        <button
                          title="Changer de rôle"
                          onClick={() => setEditUser(u)}
                          className="grid h-7 w-7 place-items-center rounded-lg hover:bg-accent transition-colors"
                        >
                          <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          title="Réinitialiser le mot de passe"
                          onClick={() => handleReset(u)}
                          disabled={resetPw.isPending}
                          className="grid h-7 w-7 place-items-center rounded-lg hover:bg-accent transition-colors"
                        >
                          <Key className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          title="Désactiver définitivement"
                          onClick={() => handleDelete(u)}
                          disabled={deleteUser.isPending}
                          className="grid h-7 w-7 place-items-center rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-sm text-muted-foreground">Page {page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const create = useAdminCreateUser();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", systemRole: "STUDENT_ONLINE" });
  const [result, setResult] = useState<{ name: string; pw: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await create.mutateAsync(form);
    setResult({ name: `${res.firstName} ${res.lastName}`, pw: res.tempPassword! });
    toast.success("Utilisateur créé");
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl">
          <h3 className="mb-1 font-bold">Compte créé !</h3>
          <p className="mb-4 text-sm text-muted-foreground">{result.name}</p>
          <div className="flex items-center gap-2 rounded-xl border bg-muted/50 px-4 py-3 font-mono text-lg font-bold tracking-widest">
            {result.pw}
            <button onClick={() => { navigator.clipboard.writeText(result.pw); toast.success("Copié !"); }} className="ml-auto text-muted-foreground hover:text-foreground">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Mot de passe temporaire. À communiquer à l'utilisateur.</p>
          <button onClick={onClose} className="mt-4 w-full rounded-xl grad-online py-2 text-sm font-semibold text-white">Fermer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="font-bold">Créer un utilisateur</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Prénom *</label>
              <input value={form.firstName} onChange={e => setForm(p => ({...p, firstName: e.target.value}))} required placeholder="Marie" className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-online/40" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Nom *</label>
              <input value={form.lastName} onChange={e => setForm(p => ({...p, lastName: e.target.value}))} required placeholder="Dupont" className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-online/40" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Email *</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} required placeholder="marie@exemple.com" className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-online/40" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Rôle *</label>
            <select value={form.systemRole} onChange={e => setForm(p => ({...p, systemRole: e.target.value}))} className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-online/40">
              <option value="STUDENT_ONLINE">Étudiant</option>
              <option value="TEACHER_ONLINE">Enseignant</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border py-2 text-sm hover:bg-accent">Annuler</button>
            <button type="submit" disabled={create.isPending} className="flex-1 rounded-xl grad-online py-2 text-sm font-semibold text-white disabled:opacity-60">
              {create.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditRoleModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const update = useAdminUpdateUser();
  const [systemRole, setSystemRole] = useState(user.systemRole);

  async function handleSave() {
    await update.mutateAsync({ id: user.id, data: { systemRole } });
    toast.success("Rôle mis à jour");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="font-bold">Changer le rôle</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-6">
          <div className="text-sm text-muted-foreground">{user.firstName} {user.lastName} — <span className="font-medium text-foreground">{user.email}</span></div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Nouveau rôle</label>
            <select value={systemRole} onChange={e => setSystemRole(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-online/40">
              <option value="STUDENT_ONLINE">Étudiant</option>
              <option value="TEACHER_ONLINE">Enseignant</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-xl border py-2 text-sm hover:bg-accent">Annuler</button>
            <button onClick={handleSave} disabled={update.isPending} className="flex-1 rounded-xl grad-online py-2 text-sm font-semibold text-white disabled:opacity-60">
              {update.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Subscriptions (plans + student subscriptions)
// ══════════════════════════════════════════════════════════════════════════════

function SubscriptionsTab() {
  const stats = useSubscriptionStats();
  const plans = useAllPlans();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const subs = useAdminSubscriptions({ status: statusFilter || undefined });
  const validate = useValidateSubscription();
  const refuse = useRefuseSubscription();
  const [showPlanForm, setShowPlanForm] = useState(false);
  const DEFAULT_FEATURES = "Tous les cours du catalogue\nNouveaux cours débloqués automatiquement\nCertificats vérifiables inclus\nSessions live + tableau interactif\nQuiz, devoirs et forum illimités";
  const EMPTY_PLAN_FORM = { name: "", description: "", price: "", durationDays: "30", isFeatured: false, features: DEFAULT_FEATURES };
  const [form, setForm] = useState(EMPTY_PLAN_FORM);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  function startEditPlan(p: SubscriptionPlan) {
    setEditingPlanId(p.id);
    setForm({
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      durationDays: String(p.durationDays),
      isFeatured: p.isFeatured,
      features: (p.features?.length ? p.features : DEFAULT_FEATURES.split("\n")).join("\n"),
    });
    setShowPlanForm(true);
  }

  async function submitPlan() {
    if (!form.name.trim() || !form.price || !form.durationDays) { toast.error("Champs requis manquants"); return; }
    const payload = {
      name: form.name.trim(), description: form.description.trim() || undefined,
      price: Number(form.price), durationDays: Number(form.durationDays), isFeatured: form.isFeatured,
      features: form.features.split("\n").map((f) => f.trim()).filter(Boolean),
    };
    try {
      if (editingPlanId) {
        await updatePlan.mutateAsync({ id: editingPlanId, ...payload });
        toast.success("Offre mise à jour");
      } else {
        await createPlan.mutateAsync(payload);
        toast.success("Offre créée");
      }
      setForm(EMPTY_PLAN_FORM);
      setEditingPlanId(null);
      setShowPlanForm(false);
    } catch { toast.error("Erreur"); }
  }

  const s = stats.data;
  const STAT_CARDS = [
    { label: "Abonnés actifs", value: s?.active ?? 0, color: "text-green-600" },
    { label: "À valider", value: s?.pendingValidation ?? 0, color: "text-amber-600" },
    { label: "Expirés", value: s?.expired ?? 0, color: "text-muted-foreground" },
    { label: "Revenus", value: `${(s?.revenue ?? 0).toLocaleString("fr-FR")} MGA`, color: "text-online" },
  ];

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-5 shadow-elegant">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className={`mt-1 text-2xl font-extrabold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Plans */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Offres d'abonnement</h3>
          <button onClick={() => setShowPlanForm((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg grad-online px-3 py-1.5 text-sm font-medium text-white">
            <Plus className="h-4 w-4" /> Nouvelle offre
          </button>
        </div>

        {showPlanForm && (
          <div className="mb-4 grid gap-3 rounded-2xl border bg-card p-4 shadow-elegant sm:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nom (ex: Mensuel)" className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description" className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} type="number" placeholder="Prix (MGA)" className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input value={form.durationDays} onChange={(e) => setForm((p) => ({ ...p, durationDays: e.target.value }))} type="number" placeholder="Durée (jours)" className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Avantages affichés sur la carte (un par ligne — modifiez librement)
              </label>
              <textarea
                value={form.features}
                onChange={(e) => setForm((p) => ({ ...p, features: e.target.value }))}
                rows={5}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder={"Ex :\nTous les cours du catalogue\nSupport prioritaire\n…"}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Ces lignes apparaissent avec une coche ✓ sur la page Abonnement des étudiants (max 10).</p>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((p) => ({ ...p, isFeatured: e.target.checked }))} /> Mettre en avant</label>
            <div className="flex gap-2">
              <button onClick={submitPlan} disabled={createPlan.isPending || updatePlan.isPending} className="rounded-lg grad-online px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                {editingPlanId ? "Enregistrer" : "Créer"}
              </button>
              <button onClick={() => { setShowPlanForm(false); setEditingPlanId(null); setForm(EMPTY_PLAN_FORM); }} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Annuler</button>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(plans.data ?? []).map((p: SubscriptionPlan) => (
            <div key={p.id} className={`rounded-2xl border bg-card p-4 shadow-elegant ${!p.isActive ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{p.name} {p.isFeatured && <span className="text-amber-500">★</span>}</div>
                  <div className="text-xs text-muted-foreground">{p.price.toLocaleString("fr-FR")} {p.currency} · {p.durationDays}j</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEditPlan(p)} title="Modifier (prix, avantages…)" className="rounded p-1 hover:bg-accent">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => updatePlan.mutate({ id: p.id, isActive: !p.isActive })} title={p.isActive ? "Désactiver" : "Activer"} className="rounded p-1 hover:bg-accent">
                    {p.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  <button onClick={() => { if (confirm("Supprimer / désactiver cette offre ?")) deletePlan.mutate(p.id); }} className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {(p.features?.length ?? 0) > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {p.features!.slice(0, 3).map((f) => (
                    <li key={f} className="truncate text-[11px] text-muted-foreground">✓ {f}</li>
                  ))}
                  {p.features!.length > 3 && <li className="text-[11px] text-muted-foreground">… +{p.features!.length - 3}</li>}
                </ul>
              )}
              <div className="mt-2 text-xs text-muted-foreground">{p._count?.subscriptions ?? 0} abonnement(s)</div>
            </div>
          ))}
          {(plans.data ?? []).length === 0 && <div className="text-sm text-muted-foreground">Aucune offre.</div>}
        </div>
      </div>

      {/* Subscriptions list */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Abonnements souscrits</h3>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring">
            <option value="">Tous</option>
            <option value="ACTIVE">Actifs</option>
            <option value="REFUSED">Refusés</option>
            <option value="EXPIRED">Expirés</option>
          </select>
        </div>
        <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant divide-y">
          {(subs.data?.items ?? []).map((sub) => (
            <div key={sub.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{sub.student?.firstName} {sub.student?.lastName} <span className="text-muted-foreground">· {sub.plan.name}</span></div>
                <div className="text-xs text-muted-foreground">{sub.reference} · {sub.amount.toLocaleString("fr-FR")} MGA · {sub.method}{sub.expiresAt ? ` · expire ${new Date(sub.expiresAt).toLocaleDateString("fr-FR")}` : ""}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sub.status === "ACTIVE" ? "bg-green-500/10 text-green-600" : sub.status === "REFUSED" ? "bg-red-500/10 text-red-600" : "bg-muted text-muted-foreground"}`}>{sub.status}</span>
                {sub.status === "ACTIVE" && (
                  <>
                    <button onClick={() => validate.mutate(sub.id)} className="rounded-lg border border-green-300 px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20">Valider</button>
                    <button onClick={() => { const r = prompt("Motif du refus ?") ?? undefined; refuse.mutate({ id: sub.id, reason: r }); }} className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">Refuser</button>
                  </>
                )}
              </div>
            </div>
          ))}
          {(subs.data?.items ?? []).length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Aucun abonnement.</div>}
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// Certificates registry
// ══════════════════════════════════════════════════════════════════════════════

function CertificatesTab() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const certs = useAdminCertificates({ page, q: q || undefined });
  const data = certs.data;
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [showTheme, setShowTheme] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Registre des certificats</h3>
          <p className="text-xs text-muted-foreground">
            Tous les certificats délivrés par la plateforme — vérifiables publiquement par leur code.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTheme((v) => !v)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition ${showTheme ? "grad-online text-white" : "border hover:bg-accent"}`}
          >
            <Pencil className="h-3.5 w-3.5" /> Apparence du certificat
          </button>
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Rechercher par code ou cours…"
            className="h-9 w-64 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {showTheme && <CertThemeEditor sampleCode={data?.items?.[0]?.code ?? null} />}

      {/* Aperçu visuel plein écran (identique à ce que voit l'étudiant) */}
      {previewCode && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-4 backdrop-blur-sm" onClick={() => setPreviewCode(null)}>
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-2xl bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <div className="text-sm font-semibold">Aperçu — <span className="font-mono text-amber-600">{previewCode}</span></div>
              <div className="flex items-center gap-2">
                <a href={`/online/certificate/${encodeURIComponent(previewCode)}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs hover:bg-accent">
                  <ExternalLink className="h-3 w-3" /> Ouvrir dans un onglet
                </a>
                <button onClick={() => setPreviewCode(null)} className="rounded-lg p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <iframe src={`/online/certificate/${encodeURIComponent(previewCode)}`} title="Certificat" className="w-full flex-1 border-0" />
          </div>
        </div>
      )}

      {certs.isLoading ? (
        <Spinner />
      ) : (data?.items ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Aucun certificat{q && <> pour « {q} »</>}.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="p-3">Code</th>
                <th className="p-3">Étudiant</th>
                <th className="p-3">Cours</th>
                <th className="p-3">Progression</th>
                <th className="p-3">Délivré le</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data!.items.map((c: import("@/lib/lms-admin").AdminCertificate) => (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3">
                    <span className="rounded bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-amber-600">{c.code}</span>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{c.student.firstName} {c.student.lastName}</div>
                    <div className="text-xs text-muted-foreground">{c.student.email}</div>
                  </td>
                  <td className="max-w-52 truncate p-3">{c.course.title}</td>
                  <td className="p-3">{c.progress != null ? `${Math.round(c.progress)}%` : "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(c.issuedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setPreviewCode(c.code)}
                      className="inline-flex items-center gap-1 rounded-lg border border-online/40 bg-online/5 px-2.5 py-1 text-xs font-medium text-online hover:bg-online/10"
                    >
                      <Eye className="h-3 w-3" /> Aperçu
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data!.total > data!.limit && (
            <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
              <span>{data!.total} certificat(s)</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">←</button>
                <span className="py-1">Page {page}</span>
                <button disabled={page * data!.limit >= data!.total} onClick={() => setPage((p) => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">→</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// Live sessions registry
// ══════════════════════════════════════════════════════════════════════════════

const SESSION_STATUS: Record<string, { label: string; cls: string }> = {
  SCHEDULED: { label: "Planifiée", cls: "bg-blue-500/10 text-blue-600" },
  LIVE:      { label: "En direct", cls: "bg-green-500/10 text-green-600" },
  DONE:      { label: "Terminée", cls: "bg-muted text-muted-foreground" },
  CANCELLED: { label: "Annulée", cls: "bg-red-500/10 text-red-600" },
};

function LiveSessionsAdminTab() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const sessions = useAdminLiveSessions({ page, q: q || undefined });
  const data = sessions.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Toutes les sessions live</h3>
          <p className="text-xs text-muted-foreground">Chaque session dispose de son tableau interactif collaboratif.</p>
        </div>
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Rechercher par titre ou cours…"
          className="h-9 w-64 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {sessions.isLoading ? <Spinner /> : (data?.items ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Aucune session.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant divide-y">
          {data!.items.map((s: AdminLiveSession) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Calendar className="h-4 w-4 shrink-0 text-online" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{s.title}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${(SESSION_STATUS[s.status] ?? SESSION_STATUS.SCHEDULED).cls}`}>
                    {(SESSION_STATUS[s.status] ?? SESSION_STATUS.SCHEDULED).label}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.course.title} · {s.teacher.firstName} {s.teacher.lastName} · {new Date(s.scheduledAt).toLocaleString("fr-FR")} · {s.durationMin} min
                </div>
              </div>
              <a href={`/online/live/${s.id}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-online/30 bg-online/5 px-2.5 py-1.5 text-xs font-medium text-online hover:bg-online/10">
                <ExternalLink className="h-3 w-3" /> Tableau
              </a>
            </div>
          ))}
        </div>
      )}
      {data && data.total > data.limit && (
        <div className="flex justify-end gap-2 text-xs">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">←</button>
          <span className="py-1">Page {page}</span>
          <button disabled={page * data.limit >= data.total} onClick={() => setPage((p) => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">→</button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Announcements registry
// ══════════════════════════════════════════════════════════════════════════════

function AnnouncementsAdminTab() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const list = useAdminAnnouncements({ page, q: q || undefined });
  const del = useAdminDeleteAnnouncement();
  const data = list.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Annonces de cours</h3>
          <p className="text-xs text-muted-foreground">Toutes les annonces publiées par les enseignants (les inscrits sont notifiés).</p>
        </div>
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Rechercher…"
          className="h-9 w-64 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {list.isLoading ? <Spinner /> : (data?.items ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Aucune annonce.</div>
      ) : (
        <div className="space-y-3">
          {data!.items.map((a: AdminAnnouncement) => (
            <div key={a.id} className="rounded-2xl border bg-card p-4 shadow-elegant">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {a.isPinned && <span className="text-online">📌</span>}
                    <span className="text-sm font-semibold">{a.title}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {a.course.title}{a.author ? ` · ${a.author.firstName} ${a.author.lastName}` : ""} · {new Date(a.createdAt).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                <button
                  onClick={async () => { if (confirm("Supprimer cette annonce ?")) { await del.mutateAsync(a.id); toast.success("Annonce supprimée"); } }}
                  className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                ><Trash2 className="h-4 w-4" /></button>
              </div>
              <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Reviews moderation
// ══════════════════════════════════════════════════════════════════════════════

function ReviewsAdminTab() {
  const [q, setQ] = useState("");
  const [hiddenFilter, setHiddenFilter] = useState<"" | "false" | "true">("");
  const [page, setPage] = useState(1);
  const list = useAdminReviews({ page, q: q || undefined, hidden: hiddenFilter === "" ? undefined : hiddenFilter === "true" });
  const setHidden = useAdminSetReviewHidden();
  const del = useAdminDeleteReview();
  const data = list.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Modération des avis</h3>
          <p className="text-xs text-muted-foreground">Tous les avis étudiants de la plateforme — masquez ou supprimez les avis inappropriés.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={hiddenFilter} onChange={(e) => { setHiddenFilter(e.target.value as typeof hiddenFilter); setPage(1); }}
            className="h-9 rounded-lg border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring">
            <option value="">Tous</option>
            <option value="false">Visibles</option>
            <option value="true">Masqués</option>
          </select>
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Rechercher…"
            className="h-9 w-56 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      {list.isLoading ? <Spinner /> : (data?.items ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Aucun avis.</div>
      ) : (
        <div className="space-y-3">
          {data!.items.map((r: AdminReview) => (
            <div key={r.id} className={`rounded-2xl border bg-card p-4 shadow-elegant ${r.isHidden ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </span>
                    <span className="text-sm font-medium">{r.student.firstName} {r.student.lastName}</span>
                    <span className="text-xs text-muted-foreground">· {r.course.title} · {new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
                    {r.isHidden && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600">Masqué</span>}
                  </div>
                  {r.comment && <p className="mt-1.5 text-sm">{r.comment}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setHidden.mutate({ id: r.id, isHidden: !r.isHidden })}
                    title={r.isHidden ? "Réafficher" : "Masquer"}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent"
                  >{r.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                  <button
                    onClick={async () => { if (confirm("Supprimer définitivement cet avis ?")) { await del.mutateAsync(r.id); toast.success("Avis supprimé"); } }}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  ><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Certificate appearance editor (texts + colors + live preview) ────────────

function CertThemeEditor({ sampleCode }: { sampleCode: string | null }) {
  const settings = useLmsSettings();
  const update = useUpdateSettings();
  const [t, setT] = useState<CertTheme>(CERT_DEFAULTS);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (settings.data && !seeded) {
      setT(certThemeFrom(settings.data));
      setSeeded(true);
    }
  }, [settings.data, seeded]);

  const set = (k: keyof CertTheme, v: string) => setT((p) => ({ ...p, [k]: v }));

  async function save() {
    try {
      await update.mutateAsync({
        certInstitution: t.institution, certTitle: t.title, certSubtitle: t.subtitle,
        certAwardText: t.award, certCompleteText: t.complete,
        certBgFrom: t.bgFrom, certBgMid: t.bgMid, certAccent: t.accent,
      } as Record<string, string>);
      toast.success("Apparence du certificat enregistrée — visible par tous les étudiants");
    } catch { toast.error("Erreur d'enregistrement"); }
  }

  const inp = "h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="grid gap-5 rounded-2xl border bg-card p-5 shadow-elegant lg:grid-cols-2">
      {/* Form */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Textes du certificat</h4>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Institution</label>
          <input value={t.institution} onChange={(e) => set("institution", e.target.value)} className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Titre principal</label>
            <input value={t.title} onChange={(e) => set("title", e.target.value)} className={inp} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Sous-titre</label>
            <input value={t.subtitle} onChange={(e) => set("subtitle", e.target.value)} className={inp} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Mention « décerné à »</label>
            <input value={t.award} onChange={(e) => set("award", e.target.value)} className={inp} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Mention « pour avoir complété »</label>
            <input value={t.complete} onChange={(e) => set("complete", e.target.value)} className={inp} />
          </div>
        </div>

        <h4 className="pt-2 text-sm font-semibold">Couleurs</h4>
        <div className="grid grid-cols-3 gap-3">
          {([
            ["bgFrom", "Fond principal"],
            ["bgMid", "Fond secondaire"],
            ["accent", "Accent (or)"],
          ] as [keyof CertTheme, string][]).map(([k, label]) => (
            <div key={k}>
              <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={t[k]} onChange={(e) => set(k, e.target.value)} className="h-9 w-12 cursor-pointer rounded border bg-background p-0.5" />
                <input value={t[k]} onChange={(e) => set(k, e.target.value)} className="h-9 w-full rounded-lg border bg-background px-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button onClick={save} disabled={update.isPending}
            className="inline-flex items-center gap-2 rounded-lg grad-online px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer
          </button>
          <button onClick={() => setT(CERT_DEFAULTS)} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Réinitialiser</button>
          {sampleCode && (
            <a href={`/online/certificate/${encodeURIComponent(sampleCode)}`} target="_blank" rel="noopener noreferrer"
              className="ml-auto text-xs text-online hover:underline">Tester sur un vrai certificat →</a>
          )}
        </div>
      </div>

      {/* Live preview */}
      <div>
        <h4 className="mb-2 text-sm font-semibold">Aperçu en direct</h4>
        <div
          className="relative w-full overflow-hidden rounded-xl"
          style={{
            aspectRatio: "1.414 / 1",
            background: `linear-gradient(135deg, ${t.bgFrom} 0%, ${t.bgMid} 30%, ${t.bgFrom} 60%, #1e1008 100%)`,
          }}
        >
          <div className="absolute inset-2 rounded-lg" style={{ border: `2px solid ${t.accent}99` }} />
          <div className="absolute inset-3 rounded-lg" style={{ border: `1px solid ${t.accent}4d` }} />
          <div className="relative z-10 flex h-full flex-col items-center justify-between px-8 py-5 text-center">
            <div>
              <div className="mx-auto grid h-9 w-9 place-items-center rounded-full text-base"
                style={{ background: `linear-gradient(135deg, ${t.accent}, #f5d776, #b8962e)` }}>🏅</div>
              <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.25em]" style={{ color: t.accent }}>
                {t.institution}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-light uppercase tracking-widest text-white/70">{t.subtitle}</div>
              <div className="text-2xl font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>{t.title}</div>
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-widest text-white/60">{t.award}</div>
              <div className="text-sm font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>Prénom NOM</div>
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-widest text-white/60">{t.complete}</div>
              <div className="text-[11px] font-semibold" style={{ color: t.accent }}>Titre du cours</div>
            </div>
            <div className="flex w-full items-end justify-between">
              <div className="text-[7px] text-white/60">17 juillet 2026</div>
              <div className="grid h-8 w-8 place-items-center rounded-full text-[6px] font-black uppercase text-yellow-900"
                style={{ background: `linear-gradient(135deg, ${t.accent}, #f5d776, #b8962e)` }}>UR</div>
              <div className="h-7 w-7 rounded bg-white p-0.5">
                <div className="h-full w-full" style={{ background: `repeating-conic-gradient(${t.bgMid} 0% 25%, white 0% 50%)`, backgroundSize: "4px 4px" }} />
              </div>
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          L'aperçu se met à jour en direct. Après « Enregistrer », tous les certificats (existants et futurs) adoptent cette apparence.
        </p>
      </div>
    </div>
  );
}
