import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/classroom/planning")({
  component: () => <Outlet />,
});
