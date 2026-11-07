import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, primaryRoleName } from "@/lib/auth";
import type { ClassroomRole } from "@/lib/auth";
import type { ScheduleSlot, DayOfWeek, DAY_INDEX } from "@/lib/classroom";

// Classroom systemRole values returned by the backend
export type ClassroomSystemRole =
  | "STUDENT" | "TEACHER" | "PARENT" | "CANDIDATE"
  | "STAFF" | "SUPER_ADMIN";

// Chef de Mention + Responsable Pédagogique fusionnés en « Responsable <mention> »
// (Responsable Info, Responsable Gestion…). « Responsable Présence » est distinct.
export const PRESENCE_ROLE = "Responsable Présence";
export const isPresenceRole = (roleName = "") => roleName === PRESENCE_ROLE;
export const isMentionResponsible = (roleName = "") =>
  (roleName.startsWith("Responsable ") && !isPresenceRole(roleName)) || roleName.includes("Chef de Mention");
// Libellé affiché d'un rôle : Chef de Mention et Responsable <mention> → « Responsable Pédagogique »
export const displayRoleName = (roleName = "") =>
  isMentionResponsible(roleName) ? "Responsable Pédagogique" : roleName;
export const isFinanceRole = (roleName = "") =>
  roleName.includes("Comptabilité") || roleName.includes("Trésorier") || roleName.includes("Finance");

export function classroomDashboard(systemRole: string, roles: ClassroomRole[] = []): string {
  if (systemRole === "SUPER_ADMIN") return "/classroom/admin";
  if (systemRole === "STUDENT")     return "/classroom/student";
  if (systemRole === "TEACHER")     return "/classroom/teacher";
  if (systemRole === "PARENT")      return "/classroom/parent";
  if (systemRole === "CANDIDATE")   return "/classroom/candidat";
  if (systemRole === "STAFF") {
    const rn = primaryRoleName(roles);
    if (isPresenceRole(rn))                     return "/classroom/appel";
    if (isMentionResponsible(rn))               return "/classroom/chef-mention";
    if (rn.includes("Secrétaire"))              return "/classroom/secretaire";
    if (rn.includes("Comptabilité"))            return "/classroom/comptabilite";
    return "/classroom/admin";
  }
  return "/classroom/admin";
}

export function useRequireClassroom(allowed?: string[]) {
  const { user, roles, ready } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!ready) return;
    const isOnline = user?.systemRole === "STUDENT_ONLINE" || user?.systemRole === "TEACHER_ONLINE";
    if (!user || isOnline) {
      navigate({ to: "/classroom" });
      return;
    }
    if (allowed && !allowed.includes(user.systemRole)) {
      navigate({ to: classroomDashboard(user.systemRole, roles) });
    }
  }, [ready, user, roles, JSON.stringify(allowed)]);
  return { user, roles, ready };
}

export const isStaff = (role?: string) => role === "STAFF" || role === "SUPER_ADMIN";

// ─── Weekly grid (uses real ScheduleSlot from /api/schedule/my-schedule) ───

const DAY_ORDER: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Lun", TUESDAY: "Mar", WEDNESDAY: "Mer",
  THURSDAY: "Jeu", FRIDAY: "Ven", SATURDAY: "Sam", SUNDAY: "Dim",
};
const HOURS = ["07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18"];
const HOUR0 = 7;
const ROW = 64;

const toFloat = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
};

// Deterministic color based on course title
const SLOT_COLORS = [
  "grad-classroom text-white",
  "bg-blue-500 text-white",
  "bg-purple-500 text-white",
  "bg-emerald-500 text-white",
  "bg-orange-500 text-white",
  "bg-pink-500 text-white",
  "bg-teal-500 text-white",
  "bg-indigo-500 text-white",
];
function slotColor(title: string) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) & 0xffff;
  return SLOT_COLORS[h % SLOT_COLORS.length];
}

export function WeekGrid({ slots, onSlotClick }: { slots: ScheduleSlot[]; onSlotClick?: (s: ScheduleSlot) => void }) {
  // Detect which days have at least one slot, show Sat/Sun if needed
  const activeDays = DAY_ORDER.filter((d) => slots.some((s) => s.day === d));
  const days = activeDays.length ? activeDays : DAY_ORDER;

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-elegant">
      <div style={{ minWidth: `${60 + days.length * 140}px` }}>
        <div className="grid border-b text-xs text-muted-foreground" style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(0,1fr))` }}>
          <div className="p-3" />
          {days.map((d) => <div key={d} className="border-l p-3 font-semibold text-foreground">{DAY_LABELS[d]}</div>)}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(0,1fr))` }}>
          <div>
            {HOURS.map((h) => <div key={h} className="h-16 border-b px-2 py-1 text-[10px] text-muted-foreground">{h}:00</div>)}
          </div>
          {days.map((day) => (
            <div key={day} className="relative border-l">
              {HOURS.map((h) => <div key={h} className="h-16 border-b" />)}
              {slots
                .filter((s) => s.day === day)
                .map((s) => {
                  const title = s.subjectName ?? s.course?.title ?? "Cours";
                  const top = (toFloat(s.startTime) - HOUR0) * ROW + 3;
                  const height = Math.max(28, (toFloat(s.endTime) - toFloat(s.startTime)) * ROW - 6);
                  return (
                    <button
                      key={s.id}
                      onClick={() => onSlotClick?.(s)}
                      className={`absolute left-1.5 right-1.5 overflow-hidden rounded-xl p-2.5 text-left text-xs shadow-elegant ${slotColor(title)} ${onSlotClick ? "cursor-pointer hover:brightness-105" : ""}`}
                      style={{ top, height }}
                    >
                      <div className="truncate font-semibold">{title}{s.type ? ` · ${s.type}` : ""}</div>
                      <div className="truncate opacity-90">{s.startTime}–{s.endTime}{s.room ? ` · ${s.room.name}` : ""}</div>
                      {(s.promotion || s.group) && <div className="truncate opacity-75">{[s.promotion?.name, s.group?.name].filter(Boolean).join(" · ")}</div>}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const dayName = (d: DayOfWeek) => DAY_LABELS[d] ?? d;
