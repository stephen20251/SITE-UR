import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { LETTER_TEMPLATES, getLetterTemplate } from './letters.templates.js';
import { generateLetter, archiveLetter, listHistory, getDocument } from './letters.service.js';
import { prisma } from '../../database/prisma.js';
import { isMentionResponsible } from '../../utils/roles.js';

const r = Router();
r.use(authenticate);

function roleKey(user) {
  const role = user.roleName ?? '';
  if (user.systemRole === 'SUPER_ADMIN')   return 'SUPER_ADMIN';
  if (user.systemRole === 'TEACHER')       return 'TEACHER';
  if (user.systemRole === 'STUDENT')       return 'STUDENT';
  if (role.includes('Secrétaire'))         return 'SECRETAIRE';
  if (role.includes('Comptabilité'))       return 'COMPTABILITE';
  if (isMentionResponsible(role))          return 'CHEF_MENTION';
  return 'STAFF';
}

// GET /api/letters/teachers — person picker
r.get('/teachers', asyncHandler(async (req, res) => {
  const { q = '' } = req.query;
  const teachers = await prisma.teacherProfile.findMany({
    where: q ? {
      user: { OR: [
        { firstName: { contains: q } },
        { lastName:  { contains: q } },
      ]},
    } : {},
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, mention: { select: { name: true } } },
    take: 30,
  });
  res.json(teachers.map((t) => ({
    id: t.id,
    fullName: `${t.user.lastName.toUpperCase()} ${t.user.firstName}`,
    email: t.user.email,
    specialization: t.specialization ?? t.mention?.name ?? 'Enseignant',
    employeeId: t.employeeId,
  })));
}));

// GET /api/letters/staff — person picker
r.get('/staff', asyncHandler(async (req, res) => {
  const { q = '' } = req.query;
  const staff = await prisma.staffProfile.findMany({
    where: q ? {
      user: { OR: [
        { firstName: { contains: q } },
        { lastName:  { contains: q } },
      ]},
    } : {},
    include: {
      user:       { select: { id: true, firstName: true, lastName: true, email: true } },
      department: { select: { name: true } },
    },
    take: 30,
  });
  res.json(staff.map((s) => ({
    id: s.id,
    fullName:   `${s.user.lastName.toUpperCase()} ${s.user.firstName}`,
    email:      s.user.email,
    department: s.department?.name ?? '—',
    office:     s.office ?? '—',
    employeeId: s.employeeId,
  })));
}));

// GET /api/letters/templates
r.get('/templates', asyncHandler(async (req, res) => {
  const rk = roleKey(req.user);
  // Un Responsable de mention cumule les modèles CHEF_MENTION et RESP_PEDA.
  const keys = rk === 'CHEF_MENTION' ? ['CHEF_MENTION', 'RESP_PEDA'] : [rk];
  res.json(LETTER_TEMPLATES.filter((t) => t.allowedRoles.some((r) => keys.includes(r))));
}));

// GET /api/letters/templates/:id
r.get('/templates/:id', asyncHandler(async (req, res) => {
  const tpl = getLetterTemplate(req.params.id);
  if (!tpl) return res.status(404).json({ error: 'Modèle introuvable' });
  res.json(tpl);
}));

// POST /api/letters/preview/:templateId — generate preview HTML (no archiving)
r.post('/preview/:templateId', asyncHandler(async (req, res) => {
  const { html } = await generateLetter(req.params.templateId, req.body, req.user);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// POST /api/letters/generate/:templateId — generate + archive
r.post('/generate/:templateId', asyncHandler(async (req, res) => {
  const { html, docNo } = await generateLetter(req.params.templateId, req.body, req.user);
  // Archive asynchronously (don't block the response)
  archiveLetter(req.params.templateId, req.body, html, docNo, req.user.sub).catch(console.error);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// GET /api/letters/history — list generated documents for current user
r.get('/history', asyncHandler(async (req, res) => {
  const { page, limit, moduleType } = req.query;
  res.json(await listHistory(req.user.sub, { moduleType, page: Number(page ?? 1), limit: Number(limit ?? 20) }));
}));

// GET /api/letters/history/:id — fetch one archived document
r.get('/history/:id', asyncHandler(async (req, res) => {
  const doc = await getDocument(req.params.id, req.user.sub);
  if (req.query.html) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(doc.content);
  }
  res.json(doc);
}));

export default r;
