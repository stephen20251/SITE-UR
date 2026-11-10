import { createFileRoute, Outlet } from "@tanstack/react-router";

// Le thème clair / sombre est géré pour tout le site public dans __root.tsx.
export const Route = createFileRoute("/online")({
  component: () => <Outlet />,
});
