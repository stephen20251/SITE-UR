import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { TEMPLATES, getTemplate } from './documents.templates.js';
import { generate } from './documents.service.js';
import { prisma } from '../../database/prisma.js';
import { isSemesterFinished, staffRoleKeys } from '../../utils/roles.js';

const r = Router();
r.use(authenticate);

// Clés de rôle de l'appelant, calculées depuis ses rôles en base (le nom du rôle
// n'est pas dans le jeton).
async function roleKeysOf(req) {
  const { systemRole, sub } = req.user;
  if (systemRole !== 'STAFF') return staffRoleKeys(systemRole);
  const urs = await prisma.userRole.findMany({ where: { userId: sub }, select: { role: { select: { name: true } } } });
  const keys = new Set(urs.flatMap((u) => staffRoleKeys(systemRole, u.role.name)));
  if (!keys.size) keys.add('STAFF');
  return [...keys];
}

async function allowedTemplates(req) {
  const keys = await roleKeysOf(req);
  return TEMPLATES.filter((t) => t.allowedRoles.some((r) => keys.includes(r)));
}

// Un étudiant ne peut générer que ses propres documents
async function assertInputsAllowed(req, inputs) {
  if (req.user.systemRole !== 'STUDENT') return;
  const sp = await prisma.studentProfile.findUnique({ where: { userId: req.user.sub }, select: { id: true } });
  if (inputs?.studentId && inputs.studentId !== sp?.id) {
    const e = new Error('Vous ne pouvez générer que vos propres documents'); e.status = 403; throw e;
  }
  // Notes d'un semestre (bulletin, relevé, attestation) : seulement une fois le semestre terminé
  if (inputs?.semesterId) {
    const sem = await prisma.semester.findUnique({ where: { id: inputs.semesterId }, select: { endDate: true, isActive: true, name: true } });
    if (!isSemesterFinished(sem)) {
      const e = new Error(`Les notes du ${sem?.name ?? 'semestre'} seront disponibles une fois le semestre terminé`); e.status = 403; throw e;
    }
  }
}

// GET /api/documents/templates — list available templates for the user's role
r.get('/templates', asyncHandler(async (req, res) => {
  res.json(await allowedTemplates(req));
}));

// GET /api/documents/templates/:id — single template metadata
r.get('/templates/:id', asyncHandler(async (req, res) => {
  const tpl = getTemplate(req.params.id);
  if (!tpl) return res.status(404).json({ error: 'Modèle introuvable' });
  res.json(tpl);
}));

// GET /api/documents/students — hierarchical student list for bulk generation
// Query: academicYearId?, mentionId?, level?, groupId?, promotionId?
r.get('/students', asyncHandler(async (req, res) => {
  const { academicYearId, mentionId, level, groupId, promotionId } = req.query;

  const where = { status: 'ACTIVE' };

  if (promotionId) {
    where.promotionId = promotionId;
  } else {
    // Build promotion filter from hierarchical params
    const promotionWhere = {};
    if (academicYearId) promotionWhere.academicYearId = academicYearId;
    if (mentionId)      promotionWhere.mentionId      = mentionId;
    if (level)          promotionWhere.level          = level;
    if (Object.keys(promotionWhere).length > 0) {
      const promotions = await prisma.promotion.findMany({
        where: promotionWhere,
        select: { id: true },
      });
      where.promotionId = { in: promotions.map((p) => p.id) };
    }
  }

  if (groupId) where.groupId = groupId;

  const students = await prisma.studentProfile.findMany({
    where,
    include: {
      user:      { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      promotion: { select: { id: true, name: true, level: true, mentionId: true, academicYearId: true,
                             mention: { select: { name: true } },
                             academicYear: { select: { label: true } } } },
      group:     { select: { id: true, name: true } },
    },
    orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
  });

  res.json(students);
}));

// POST /api/documents/generate/:templateId — generate document HTML (single)
r.post('/generate/:templateId', asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const tpl = getTemplate(templateId);
  if (!tpl) return res.status(404).json({ error: 'Modèle introuvable' });
  if (!(await allowedTemplates(req)).some((t) => t.id === templateId)) {
    return res.status(403).json({ error: "Vous n'avez pas accès à ce document" });
  }
  try { await assertInputsAllowed(req, req.body); } catch (e) { return res.status(403).json({ error: e.message }); }

  const html = await generate(templateId, req.body, req.user);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// POST /api/documents/generate-bulk/:templateId — generate multiple documents
// Body: { items: Array<inputs>, separator?: boolean }
// Returns: concatenated HTML pages (one per student)
r.post('/generate-bulk/:templateId', asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const tpl = getTemplate(templateId);
  if (!tpl) return res.status(404).json({ error: 'Modèle introuvable' });

  if (!(await allowedTemplates(req)).some((t) => t.id === templateId)) {
    return res.status(403).json({ error: "Vous n'avez pas accès à ce document" });
  }
  const items = req.body.items;
  if (req.user.systemRole === 'STUDENT') return res.status(403).json({ error: 'Génération groupée réservée au personnel' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Aucun élément à générer' });
  }
  if (items.length > 500) {
    return res.status(400).json({ error: 'Maximum 500 documents par génération' });
  }

  // Generate all documents and concatenate with page-break CSS
  const pages = await Promise.all(
    items.map((inputs) => generate(templateId, inputs, req.user))
  );

  const combined = pages
    .map((html, i) => {
      // Extract body content from each HTML document
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const content = bodyMatch ? bodyMatch[1] : html;
      return `<div class="doc-page" style="${i < pages.length - 1 ? 'page-break-after:always;' : ''}">${content}</div>`;
    })
    .join('\n');

  // Take the base HTML structure (head/styles) from the first document
  const firstHead = pages[0].match(/<head[^>]*>([\s\S]*)<\/head>/i)?.[0] ?? '<head></head>';
  const result = `<!DOCTYPE html><html lang="fr">${firstHead}<body style="margin:0;padding:0;">${combined}</body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(result);
}));

export default r;
