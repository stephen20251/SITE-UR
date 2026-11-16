import { createFileRoute } from "@tanstack/react-router";
import { useRequireClassroom } from "@/components/classroom/shared";
import { Loading } from "@/components/classroom/cursus-ui";
import { SemestresManager } from "@/components/classroom/semesters";

export const Route = createFileRoute("/classroom/semestres")({ component: SemestresPage });

// Semestres du cursus en présentiel, propres à chaque mention (S1 à S10, L1 → M2).
function SemestresPage() {
  const { user, ready } = useRequireClassroom(["STAFF", "SUPER_ADMIN"]);
  if (!ready || !user) return <Loading />;
  return <SemestresManager />;
}
