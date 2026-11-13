// « Mes informations » : tout ce qui concerne le compte connecté, selon son rôle.
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, GraduationCap, Mail, Phone, ShieldCheck, User, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtMGA, useMyCursus, useMyEarnings } from "@/lib/cursus";
import { useMyCourses } from "@/lib/online";

const ROLE_LABEL: Record<string, string> = {
  STUDENT: "Étudiant(e) de l'Université Références",
  TEACHER: "Enseignant(e) de l'Université Références",
  STUDENT_ONLINE: "Apprenant(e) en ligne",
  TEACHER_ONLINE: "Enseignant(e) en ligne",
  SUPER_ADMIN: "Super Administrateur",
};
export const roleLabel = (systemRole?: string) => ROLE_LABEL[systemRole ?? ""] ?? systemRole ?? "";

type Me = { user: { email: string; phone?: string | null; createdAt?: string; lastLoginAt?: string | null } };

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: string | number | null }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-online" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{value || "—"}</div>
      </div>
    </div>
  );
}

export function MyInfoCard() {
  const { user } = useAuth();
  const role = user?.systemRole;
  const isTeacher = role === "TEACHER" || role === "TEACHER_ONLINE";
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: () => api<Me>("/auth/me"), enabled: !!user });
  const cursus = useMyCursus(role === "STUDENT");
  const courses = useMyCourses(undefined, { enabled: isTeacher });
  const earnings = useMyEarnings(isTeacher);
  if (!user) return null;
  const u = me.data?.user;

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-elegant">
      <h2 className="flex items-center gap-2 text-lg font-bold"><User className="h-5 w-5 text-online" /> Mes informations</h2>
      <div className="mt-3 grid gap-x-8 divide-y sm:grid-cols-2 sm:divide-y-0">
        <div className="divide-y">
          <Row icon={User} label="Nom complet" value={`${user.firstName} ${user.lastName}`} />
          <Row icon={Mail} label="Adresse e-mail" value={u?.email ?? user.email} />
          <Row icon={Phone} label="Téléphone" value={u?.phone ?? user.phone} />
        </div>
        <div className="divide-y">
          <Row icon={ShieldCheck} label="Rôle" value={roleLabel(role)} />
          <Row icon={BookOpen} label="Membre depuis" value={u?.createdAt ? new Date(u.createdAt).toLocaleDateString("fr-FR") : null} />
          {u?.lastLoginAt && <Row icon={BookOpen} label="Dernière connexion" value={new Date(u.lastLoginAt).toLocaleString("fr-FR")} />}
        </div>
      </div>

      {role === "STUDENT" && cursus.data && (
        <div className="mt-5 rounded-xl border bg-online/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><GraduationCap className="h-4 w-4 text-online" /> Dossier universitaire</div>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
            <div><div className="text-xs text-muted-foreground">Matricule</div><div className="font-medium">{cursus.data.student.matricule}</div></div>
            <div><div className="text-xs text-muted-foreground">Mention</div><div className="font-medium">{cursus.data.student.mention?.name ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Niveau · promotion</div><div className="font-medium">{cursus.data.student.level ?? "—"} · {cursus.data.student.promotion?.name ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Écolage</div><div className="font-medium">{cursus.data.paidCount}/8 mois payés</div></div>
          </div>
          <Link to="/classroom/cursus" className="mt-3 inline-block text-xs font-semibold text-online hover:underline">Voir mon cursus et l'écolage →</Link>
        </div>
      )}

      {isTeacher && (
        <div className="mt-5 rounded-xl border bg-online/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Wallet className="h-4 w-4 text-online" /> Activité d'enseignant</div>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div><div className="text-xs text-muted-foreground">Cours créés</div><div className="font-medium">{courses.data?.total ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Gains à verser{earnings.data?.sharePercent != null ? ` (${earnings.data.sharePercent} %)` : ""}</div><div className="font-medium">{fmtMGA(earnings.data?.pending ?? 0)}</div></div>
            <div><div className="text-xs text-muted-foreground">Gains déjà versés</div><div className="font-medium">{fmtMGA(earnings.data?.paid ?? 0)}</div></div>
          </div>
          <Link to="/online/teacher" className="mt-3 inline-block text-xs font-semibold text-online hover:underline">Ouvrir mon studio →</Link>
        </div>
      )}

      {role === "SUPER_ADMIN" && (
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <Link to="/online/admin" className="rounded-lg border px-3 py-2 hover:bg-accent">Administration en ligne</Link>
          <Link to="/classroom/admin" className="rounded-lg border px-3 py-2 hover:bg-accent">Administration UR</Link>
        </div>
      )}
    </section>
  );
}
