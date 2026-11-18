// Règles de progression des cours, réglables par le Super Admin
// (Configuration de l'université → Progression des cours). Valeurs par défaut :
// le comportement historique de la plateforme.
import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';

export const DEFAULT_RULES = {
  // Leçons à terminer pour qu'un cours compte comme terminé (en %)
  cursusLessonThreshold: 100,     // cours du cursus universitaire
  certifyingLessonThreshold: 80,  // cours certifiants
  // Activités exigées en plus des leçons
  requireQuizzes: true,           // tous les quiz du cours réussis
  requireAssignments: true,       // tous les devoirs ouverts rendus
  // Quiz et devoirs ouverts seulement quand les leçons sont terminées
  activitiesAfterLessons: false,
  // Étudiant en ligne : le mois N ne se paie qu'une fois les cours du mois N-1 terminés
  monthGate: true,
  // Espace étudiant : montrer les cours des mois pas encore payés (verrouillés)
  showLockedCourses: true,
  // Espace étudiant : montrer le pourcentage de progression de chaque cours
  showCourseProgress: true,
};

const KEY = 'progressRules';
let cache = null;
let cacheAt = 0;

export async function getProgressRules() {
  if (cache && Date.now() - cacheAt < 30_000) return cache;
  const row = await prisma.lmsSetting.findUnique({ where: { key: KEY } }).catch(() => null);
  let stored = {};
  try { stored = row?.value ? JSON.parse(row.value) : {}; } catch { stored = {}; }
  cache = { ...DEFAULT_RULES, ...stored };
  cacheAt = Date.now();
  return cache;
}

export async function setProgressRules(patch = {}) {
  const current = await getProgressRules();
  const next = { ...current };
  for (const key of ['cursusLessonThreshold', 'certifyingLessonThreshold']) {
    if (patch[key] === undefined) continue;
    const v = Number(patch[key]);
    if (!Number.isFinite(v) || v < 1 || v > 100) throw new HttpError(400, 'Le seuil des leçons doit être compris entre 1 et 100 %');
    next[key] = Math.round(v);
  }
  for (const key of ['requireQuizzes', 'requireAssignments', 'activitiesAfterLessons', 'monthGate', 'showLockedCourses', 'showCourseProgress']) {
    if (patch[key] !== undefined) next[key] = patch[key] === true || patch[key] === 'true';
  }
  await prisma.lmsSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  cache = next;
  cacheAt = Date.now();
  return next;
}
