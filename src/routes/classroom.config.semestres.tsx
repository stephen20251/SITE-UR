import { createFileRoute } from "@tanstack/react-router";
import { SemestresManager } from "@/components/classroom/semesters";

// Configuration de l'université → Semestres : chaque mention crée et nomme ses
// semestres (S1 à S10, L1 → M2) ; les UE de « Matières & UE » s'y rangent.
export const Route = createFileRoute("/classroom/config/semestres")({ component: () => <SemestresManager embedded /> });
