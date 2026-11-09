/**
 * cursus.access.js — règles du cursus universitaire
 *
 * Une année = 8 mois d'écolage (2 semestres de 4 mois), 2 à 4 cours par mois.
 * Semestres numérotés sur tout le cursus : L1 = S1-S2, L2 = S3-S4, L3 = S5-S6, M1 = S7-S8, M2 = S9-S10.
 * Un étudiant accède aux cours universitaires de SA mention et de SON niveau pour
 * un mois donné uniquement si l'écolage de ce mois est VALIDÉ. Les non-étudiants ne
 * peuvent que visualiser le cursus (présentation, programme) : pour y accéder, ils
 * candidatent à l'UR. Un cours « les deux » reste achetable comme cours certifiant. Il ne peut payer
 * le mois N+1 que lorsque le mois N est payé ET que tous ses cours sont terminés
 * à 100 % (leçons + test).
 *
 * Mode d'étude : les vidéos du cursus sont réservées aux étudiants EN_LIGNE.
 * L'étudiant PRESENTIEL suit le cours en salle : il garde les documents et les
 * tests, mais ni les vidéos ni les enregistrements. Son avancement en ligne ne
 * conditionne donc ni le paiement du mois suivant ni le passage de niveau.
 */
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/prisma.js';
import { env } from '../../config/env.js';

export const LEVELS = ['L1', 'L2', 'L3', 'M1', 'M2'];
export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8];
export const MAX_COURSES_PER_MONTH = 4;
export const MIN_COURSES_PER_MONTH = 2;

export const CURSUS_KINDS = ['UNIVERSITY', 'BOTH'];     // visibles dans le cursus universitaire
export const CERTIFYING_KINDS = ['CERTIFYING', 'BOTH']; // visibles dans le catalogue certifiant

export const isCursusCourse = (course) => CURSUS_KINDS.includes(course?.courseKind);
// Contenu protégé (non téléchargeable / non partageable) : tout cours du cursus.
export const isProtectedCourse = (course) => isCursusCourse(course);

export const STUDY_MODES = ['PRESENTIEL', 'EN_LIGNE'];

// Vidéo : leçon de type VIDEO, ou lien / fichier vidéo déposé sous un autre type.
const VIDEO_LINK = /(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|drive\.google\.com\/file)|\.(mp4|webm|mov|m4v|mkv|avi)(\?|$)/i;
export const isVideoLesson = (lesson) => lesson?.type === 'VIDEO' || VIDEO_LINK.test(lesson?.contentUrl ?? '');
export const isVideoFile = (file) => Boolean(file?.mimeType?.startsWith('video/'));
// Une leçon en « aperçu gratuit » est publique : elle n'est donc pas réservée.
export const isReservedVideoLesson = (lesson) => isVideoLesson(lesson) && !lesson.isPreview;

export const semesterOfMonth = (month) => (month <= 4 ? 1 : 2);
// Numéro de semestre sur l'ensemble du cursus : L1 → S1/S2, L2 → S3/S4…
export const semesterNumber = (level, month) =>
  Math.max(0, LEVELS.indexOf(level)) * 2 + semesterOfMonth(month ?? 1);
export const nextLevel = (level) => LEVELS[LEVELS.indexOf(level) + 1] ?? null;

// ─── Profil étudiant (niveau + mention) ──────────────────────────────────────
export async function getStudentCursusProfile(userId) {
  const sp = await prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      id: true, userId: true, mentionId: true, status: true, matricule: true, studyMode: true,
      promotion: { select: { id: true, name: true, level: true, mentionId: true, academicYearId: true } },
      mention: { select: { id: true, name: true, code: true } },
    },
  });
  if (!sp) return null;
  return {
    ...sp,
    level: sp.promotion?.level ?? null,
    mentionId: sp.mentionId ?? sp.promotion?.mentionId ?? null,
  };
}

// Cours universitaires publiés d'un mois (mention + niveau).
export function cursusCoursesWhere(mentionId, level, month) {
  return {
    status: 'PUBLISHED',
    courseKind: { in: CURSUS_KINDS },
    cursusLevel: level,
    ...(month != null && { cursusMonth: month }),
    OR: [{ mentionId }, { mentionId: null }],
  };
}

export async function validatedMonths(studentProfileId, level) {
  const rows = await prisma.tuitionPayment.findMany({
    where: { studentId: studentProfileId, level, status: 'VALIDATED' },
    select: { month: true },
  });
  return new Set(rows.map((r) => r.month));
}

// Tous les cours du mois sont-ils terminés (completedAt posé) par l'étudiant ?
export async function monthCompleted(userId, mentionId, level, month) {
  const courses = await prisma.onlineCourse.findMany({
    where: cursusCoursesWhere(mentionId, level, month),
    select: { id: true },
  });
  if (courses.length === 0) return true; // rien à faire ce mois-là
  const done = await prisma.enrollment.count({
    where: { studentId: userId, courseId: { in: courses.map((c) => c.id) }, completedAt: { not: null } },
  });
  return done >= courses.length;
}

/**
 * Peut-on payer le mois `month` ?
 * → mois 1 toujours ; sinon mois précédent VALIDÉ + tous ses cours à 100 %
 *   (en présentiel, le mois précédent VALIDÉ suffit : le cours se suit en salle).
 */
export async function canPayMonth(profile, month) {
  if (!profile?.level) return { ok: false, reason: "Aucune promotion (niveau) n'est associée à votre dossier." };
  if (!MONTHS.includes(month)) return { ok: false, reason: 'Mois invalide (1 à 8).' };
  const paid = await validatedMonths(profile.id, profile.level);
  if (paid.has(month)) return { ok: false, reason: 'Ce mois est déjà payé.' };
  if (month === 1) return { ok: true };
  if (!paid.has(month - 1)) return { ok: false, reason: `Le mois ${month - 1} doit d'abord être payé.` };
  if (profile.studyMode === 'PRESENTIEL') return { ok: true };
  const done = await monthCompleted(profile.userId, profile.mentionId, profile.level, month - 1);
  if (!done) return { ok: false, reason: `Terminez d'abord à 100 % tous les cours du mois ${month - 1}.` };
  return { ok: true };
}

/**
 * Accès d'un utilisateur à un cours du cursus.
 * Retourne { applies, accessible, reason, month, level, studyMode, videosReserved }.
 *  - videosReserved=true : étudiant en présentiel, les vidéos du cours lui sont fermées
 *  - applies=false : le cursus ne concerne pas ce couple (cours certifiant, cours
 *    « les deux » hors cursus) → accès comme un cours en ligne (gratuit ou payant)
 *  - reason : 'not_student' | 'not_in_cursus' | 'tuition_unpaid' | 'related_incomplete'
 */
export async function cursusAccess(user, course) {
  if (!isCursusCourse(course)) return { applies: false };
  if (user?.role !== 'STUDENT') {
    // Non-étudiant : cursus universitaire en lecture seule (il doit candidater à l'UR).
    return course.courseKind === 'UNIVERSITY'
      ? { applies: true, accessible: false, reason: 'not_student', month: course.cursusMonth, level: course.cursusLevel }
      : { applies: false };
  }

  const profile = await getStudentCursusProfile(user.sub);
  const inCursus = profile
    && course.cursusLevel === profile.level
    && (!course.mentionId || course.mentionId === profile.mentionId);
  const studyMode = profile?.studyMode ?? null;
  const presentiel = studyMode === 'PRESENTIEL';

  if (!inCursus) {
    // Cours d'un niveau déjà terminé : l'étudiant garde l'accès s'il y était inscrit.
    const past = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: user.sub, courseId: course.id } },
      select: { id: true },
    });
    // Un cours « les deux » hors cursus a pu être acheté comme cours certifiant :
    // il reste entier, vidéos comprises.
    if (past) return { applies: true, accessible: true, inCursus: false, studyMode, videosReserved: presentiel && course.courseKind === 'UNIVERSITY' };
    if (course.courseKind === 'BOTH') return { applies: false };
    return { applies: true, accessible: false, reason: 'not_in_cursus', month: course.cursusMonth, level: course.cursusLevel };
  }

  const paid = await validatedMonths(profile.id, profile.level);
  if (!paid.has(course.cursusMonth)) {
    return { applies: true, accessible: false, reason: 'tuition_unpaid', month: course.cursusMonth, level: profile.level, inCursus: true, studyMode, videosReserved: presentiel };
  }

  // Cours liés à terminer d'abord : règle du parcours en ligne uniquement.
  if (!presentiel && course.relatedCourseIds?.length) {
    const done = await prisma.enrollment.count({
      where: { studentId: user.sub, courseId: { in: course.relatedCourseIds }, completedAt: { not: null } },
    });
    if (done < course.relatedCourseIds.length) {
      return { applies: true, accessible: false, reason: 'related_incomplete', month: course.cursusMonth, level: profile.level, inCursus: true, studyMode, videosReserved: false };
    }
  }

  return { applies: true, accessible: true, month: course.cursusMonth, level: profile.level, inCursus: true, studyMode, videosReserved: presentiel };
}

// Inscription « cursus » d'un étudiant : seuil 100 % + tests réservés aux étudiants.
export async function isCursusEnrollment(studentUserId, course) {
  if (!isCursusCourse(course)) return false;
  const u = await prisma.user.findUnique({ where: { id: studentUserId }, select: { systemRole: true } });
  if (u?.systemRole !== 'STUDENT') return false;
  if (course.courseKind === 'UNIVERSITY') return true;
  const profile = await getStudentCursusProfile(studentUserId);
  return Boolean(profile && course.cursusLevel === profile.level
    && (!course.mentionId || course.mentionId === profile.mentionId));
}

// Tests visibles / requis selon le public : étudiants du cursus ou non-étudiants.
// Si l'enseignant n'a prévu aucun test pour les non-étudiants, ils passent le test
// des étudiants (pas de certificat sans test). `existing` = publics des tests du cours.
export const quizAudiences = (cursus, existing) => {
  if (cursus) return ['ALL', 'STUDENT'];
  if (existing && existing.length && !existing.some((a) => a === 'ALL' || a === 'PUBLIC')) return ['ALL', 'PUBLIC', 'STUDENT'];
  return ['ALL', 'PUBLIC'];
};

// ─── Liens média signés (contenu non téléchargeable) ─────────────────────────
// <video>/<iframe> ne peuvent pas envoyer d'en-tête Authorization : on signe
// une URL courte durée liée à l'utilisateur et au fichier.
// `download` autorise en plus le téléchargement (?dl=1) : support autorisé par
// l'enseignant, pour un étudiant en ligne.
const MEDIA_TTL = '3h';
export function signMediaUrl(userId, kind, id, { download = false } = {}) {
  const t = jwt.sign({ sub: userId, k: kind, id, typ: 'media', ...(download && { dl: true }) }, env.JWT_ACCESS_SECRET, { expiresIn: MEDIA_TTL });
  return `/api/media/${kind}/${id}?t=${t}`;
}
export function verifyMediaToken(token, kind, id) {
  const p = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (p.typ !== 'media' || p.k !== kind || p.id !== id) throw new Error('Jeton média invalide');
  return p;
}
