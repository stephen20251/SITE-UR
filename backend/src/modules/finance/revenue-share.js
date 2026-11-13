// Répartition des ventes de cours payants entre l'enseignant et l'université.
// Le pourcentage enseignant est réglé par le Super administrateur (Écolage →
// Parts enseignants) et conservé dans LmsSetting ; l'université reçoit le reste.
// Chaque vente garde la répartition en vigueur au moment de sa validation.
import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';

const KEY = 'teacherSharePercent';
export const DEFAULT_TEACHER_SHARE_PERCENT = 25;

export async function getTeacherSharePercent() {
  const row = await prisma.lmsSetting.findUnique({ where: { key: KEY } });
  const n = Number(row?.value);
  return row && Number.isFinite(n) && n >= 0 && n <= 100 ? n : DEFAULT_TEACHER_SHARE_PERCENT;
}

export async function setTeacherSharePercent(value) {
  const n = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new HttpError(400, 'Le pourcentage enseignant doit être compris entre 0 et 100');
  await prisma.lmsSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: String(n) }, update: { value: String(n) } });
  return shareInfo(n);
}

export const shareInfo = (teacherPercent) => ({
  teacherPercent,
  universityPercent: Math.round((100 - teacherPercent) * 100) / 100,
});
