import { createFileRoute } from "@tanstack/react-router";
import { UsersManager } from "@/components/classroom/users-manager";

// Configuration → Utilisateurs : même gestion que le menu « Utilisateurs »
// (recherche, filtre par rôle, fiche de l'utilisateur au clic, rôles, mot de passe, blocage).
export const Route = createFileRoute("/classroom/config/utilisateurs")({ component: () => <UsersManager embedded /> });
