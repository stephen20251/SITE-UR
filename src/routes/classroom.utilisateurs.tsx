import { createFileRoute } from "@tanstack/react-router";
import { useRequireClassroom } from "@/components/classroom/shared";
import { UsersManager } from "@/components/classroom/users-manager";

export const Route = createFileRoute("/classroom/utilisateurs")({ component: UtilisateursPage });

function UtilisateursPage() {
  const { user, ready } = useRequireClassroom(["SUPER_ADMIN"]);
  if (!ready || !user) return null;
  return <UsersManager />;
}
