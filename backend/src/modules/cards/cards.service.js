import { PrismaClient } from '@prisma/client';
import { getCardTemplate, CARD_TEMPLATES } from './cards.templates.js';
import { resolveBrandingVars } from '../branding/branding.service.js';
import { env } from '../../config/env.js';

const prisma = new PrismaClient();
const BASE_URL = env.API_URL;

// ── Resolve student vars from DB ───────────────────────────────────────────────

async function resolveStudentVars(studentId) {
  const sp = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
      promotion: {
        select: {
          name: true, level: true,
          mention: { select: { name: true } },
          academicYear: { select: { label: true } },
        },
      },
    },
  });
  if (!sp) throw new Error('Étudiant introuvable');

  const fullName    = `${sp.user.lastName.toUpperCase()} ${sp.user.firstName}`;
  const photoUrl    = sp.user.avatarUrl ? `${BASE_URL}${sp.user.avatarUrl}` : '';
  const mention     = sp.promotion?.mention?.name ?? '';
  const level       = sp.promotion?.level ?? '';
  const academicYear = sp.promotion?.academicYear?.label ?? '';
  const matricule   = sp.matricule ?? '—';

  const qrData = `UR:${sp.id}:${matricule}`;
  const qrUrl  = `${BASE_URL}/api/cards/qr?data=${encodeURIComponent(qrData)}`;

  // Merge branding vars
  const brandingVars = await resolveBrandingVars();

  return {
    ...brandingVars,
    'student.fullName':    fullName,
    'student.photo':       photoUrl,
    'student.mention':     mention,
    'student.level':       level,
    'student.matricule':   matricule,
    'student.qrCode':      qrUrl,
    'academicYear':        academicYear,
    'signatory.signature': brandingVars['school.signature'] ?? '',
    'student.program':     mention,
  };
}

// ── Replace {{vars}} in template HTML ─────────────────────────────────────────

function replaceVars(html, vars) {
  return html.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? '');
}

// ── Generate card HTML (recto + verso) ────────────────────────────────────────

export async function generateCard(templateId, studentId) {
  const tpl = getCardTemplate(templateId);
  if (!tpl) throw new Error('Modèle introuvable : ' + templateId);

  const vars  = await resolveStudentVars(studentId);
  const recto = replaceVars(tpl.recto, vars);
  const verso  = replaceVars(tpl.verso, vars);

  return { recto, verso, student: vars };
}

// ── Generate bulk cards (array of studentIds) ─────────────────────────────────

export async function generateBulkCards(templateId, studentIds) {
  const tpl = getCardTemplate(templateId);
  if (!tpl) throw new Error('Modèle introuvable : ' + templateId);

  const results = await Promise.all(
    studentIds.map(async (id) => {
      try {
        const vars = await resolveStudentVars(id);
        return {
          id,
          name: vars['student.fullName'],
          recto: replaceVars(tpl.recto, vars),
          verso: replaceVars(tpl.verso, vars),
        };
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean);
}

// ── Archive generated card ─────────────────────────────────────────────────────

export async function archiveCard(templateId, studentId, generatedBy) {
  const tpl = getCardTemplate(templateId);
  if (!tpl) return null;

  const sp = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!sp) return null;

  const year = new Date().getFullYear();
  const count = await prisma.generatedDocument.count({ where: { moduleType: 'CARD', number: { startsWith: `CARD-${year}-` } } });
  const number = `CARD-${year}-${String(count + 1).padStart(6, '0')}`;

  return prisma.generatedDocument.create({
    data: {
      number,
      templateId,
      templateName: tpl.name,
      category: 'CARD',
      moduleType: 'CARD',
      recipientType: 'STUDENT',
      recipientId: studentId,
      recipientName: `${sp.user.lastName} ${sp.user.firstName}`,
      content: '',
      inputs: JSON.stringify({ studentId }),
      generatedBy,
      status: 'ACTIVE',
    },
  });
}

export { CARD_TEMPLATES, getCardTemplate };
