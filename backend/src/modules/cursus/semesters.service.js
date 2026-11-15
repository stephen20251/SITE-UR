// Semestres du cursus en présentiel — propres à chaque mention et à chaque niveau.
// Chaque mention les crée, les nomme et choisit les mois qu'ils couvrent (1 à 8) ;
// les cours du cursus (rangés par mois, l'écolage restant mensuel) s'y regroupent.
// Le Super Admin voit et modifie tout ; un Responsable pédagogique uniquement sa mention.
import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { assertStaffMention } from '../../middlewares/rbac.js';
import { LEVELS, MONTHS } from './cursus.access.js';

const LAST_MONTH = MONTHS[MONTHS.length - 1];

// Semestres par défaut tant que la mention n'a pas défini les siens : S1 / S2 de l'année.
export function defaultSemesters(level) {
  const base = Math.max(0, LEVELS.indexOf(level)) * 2;
  return [
    { id: null, name: `S${base + 1}`, startMonth: 1, endMonth: 4, description: null, isDefault: true },
    { id: null, name: `S${base + 2}`, startMonth: 5, endMonth: LAST_MONTH, description: null, isDefault: true },
  ];
}

// Semestres d'une mention et d'un niveau (ceux de la mention, sinon ceux par défaut).
export async function semestersFor(mentionId, level) {
  if (!mentionId || !level) return defaultSemesters(level);
  const rows = await prisma.cursusSemester.findMany({
    where: { mentionId, level },
    orderBy: [{ startMonth: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.length ? rows.map((r) => ({ ...r, isDefault: false })) : defaultSemesters(level);
}

// Semestre d'un mois (null si aucun semestre ne couvre ce mois).
export function semesterOfMonthIn(semesters, month) {
  return semesters.find((s) => month >= s.startMonth && month <= s.endMonth) ?? null;
}

function clean(body, current = {}) {
  const name = String(body.name ?? current.name ?? '').trim();
  if (!name) throw new HttpError(400, 'Donnez un nom au semestre');
  if (name.length > 80) throw new HttpError(400, 'Nom du semestre trop long (80 caractères maximum)');
  const startMonth = Number(body.startMonth ?? current.startMonth);
  const endMonth = Number(body.endMonth ?? current.endMonth);
  if (!Number.isInteger(startMonth) || !Number.isInteger(endMonth) || startMonth < 1 || endMonth > LAST_MONTH || startMonth > endMonth) {
    throw new HttpError(400, `Choisissez les mois du semestre entre 1 et ${LAST_MONTH} (mois de début ≤ mois de fin)`);
  }
  const description = body.description !== undefined ? (String(body.description ?? '').trim() || null) : (current.description ?? null);
  return { name, startMonth, endMonth, description };
}

async function assertNoOverlap(mentionId, level, { startMonth, endMonth }, excludeId = null) {
  const others = await prisma.cursusSemester.findMany({ where: { mentionId, level, ...(excludeId && { id: { not: excludeId } }) } });
  const clash = others.find((o) => startMonth <= o.endMonth && endMonth >= o.startMonth);
  if (clash) {
    throw new HttpError(409, `Ces mois chevauchent le semestre « ${clash.name} » (mois ${clash.startMonth} à ${clash.endMonth})`);
  }
}

export async function listSemesters(req, { mentionId, level }) {
  if (!mentionId || !level) throw new HttpError(400, 'mentionId et level requis');
  await assertStaffMention(req, mentionId);
  return semestersFor(mentionId, level);
}

export async function createSemester(req, body) {
  const { mentionId, level } = body ?? {};
  if (!mentionId || !LEVELS.includes(level)) throw new HttpError(400, 'Mention et niveau requis');
  await assertStaffMention(req, mentionId);
  const data = clean(body);
  await assertNoOverlap(mentionId, level, data);
  return prisma.cursusSemester.create({ data: { ...data, mentionId, level, createdById: req.user.sub } });
}

export async function updateSemester(req, id, body) {
  const current = await prisma.cursusSemester.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, 'Semestre introuvable');
  await assertStaffMention(req, current.mentionId);
  const data = clean(body ?? {}, current);
  await assertNoOverlap(current.mentionId, current.level, data, id);
  return prisma.cursusSemester.update({ where: { id }, data });
}

export async function deleteSemester(req, id) {
  const current = await prisma.cursusSemester.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, 'Semestre introuvable');
  await assertStaffMention(req, current.mentionId);
  await prisma.cursusSemester.delete({ where: { id } });
  return { ok: true };
}

// Crée les semestres par défaut (S1 / S2) pour qu'une mention puisse ensuite les renommer.
export async function initSemesters(req, { mentionId, level }) {
  if (!mentionId || !LEVELS.includes(level)) throw new HttpError(400, 'Mention et niveau requis');
  await assertStaffMention(req, mentionId);
  if (await prisma.cursusSemester.count({ where: { mentionId, level } })) return semestersFor(mentionId, level);
  for (const s of defaultSemesters(level)) {
    await prisma.cursusSemester.create({ data: { mentionId, level, name: s.name, startMonth: s.startMonth, endMonth: s.endMonth, createdById: req.user.sub } });
  }
  return semestersFor(mentionId, level);
}

// Tous les semestres d'une mention, niveau par niveau (L1 → M2) : S1…S10 par défaut.
export async function allSemesters(req, { mentionId }) {
  if (!mentionId) throw new HttpError(400, 'mentionId requis');
  await assertStaffMention(req, mentionId);
  const mention = await prisma.mention.findUnique({ where: { id: mentionId }, select: { id: true, name: true, code: true } });
  if (!mention) throw new HttpError(404, 'Mention introuvable');
  const levels = [];
  for (const level of LEVELS) levels.push({ level, semesters: await semestersFor(mentionId, level) });
  return { mention, levels };
}

// Crée d'un coup les semestres de tous les niveaux (S1 à S10) d'une mention, pour les renommer ensuite.
export async function initAllSemesters(req, { mentionId }) {
  if (!mentionId) throw new HttpError(400, 'mentionId requis');
  await assertStaffMention(req, mentionId);
  for (const level of LEVELS) {
    if (await prisma.cursusSemester.count({ where: { mentionId, level } })) continue;
    for (const s of defaultSemesters(level)) {
      await prisma.cursusSemester.create({ data: { mentionId, level, name: s.name, startMonth: s.startMonth, endMonth: s.endMonth, createdById: req.user.sub } });
    }
  }
  return allSemesters(req, { mentionId });
}
