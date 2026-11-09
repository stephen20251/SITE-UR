import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { getLetterTemplate } from './letters.templates.js';
import { env } from '../../config/env.js';

const API_URL = env.API_URL;

// ── Variable resolution ───────────────────────────────────────────────────────

function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtDT(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function resolveVars(templateId, inputs) {
  const vars = {};

  // System vars
  vars['today']      = fmt(new Date());
  vars['today_long'] = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Academic year (current)
  const year = await prisma.academicYear.findFirst({ where: { isCurrent: true }, select: { label: true } });
  vars['academicYear'] = year?.label ?? new Date().getFullYear() + '-' + (new Date().getFullYear() + 1);

  // Student
  if (inputs.studentId) {
    const sp = await prisma.studentProfile.findUnique({
      where: { id: inputs.studentId },
      include: {
        user: true,
        promotion: { include: { academicYear: true, mention: true } },
        mention: true,
        group: true,
      },
    });
    if (!sp) throw new HttpError(404, 'Étudiant introuvable');
    vars['student.fullName']  = `${sp.user.lastName.toUpperCase()} ${sp.user.firstName}`;
    vars['student.firstName'] = sp.user.firstName;
    vars['student.lastName']  = sp.user.lastName.toUpperCase();
    vars['student.matricule'] = sp.matricule ?? '—';
    vars['student.level']     = sp.promotion?.level ?? '—';
    vars['student.mention']   = sp.mention?.name ?? sp.promotion?.mention?.name ?? '—';
    vars['student.group']     = sp.group?.name ?? '—';
    vars['student.email']     = sp.user.email;
    vars['student.phone']     = sp.user.phone ?? '—';
    vars['student.birthDate'] = sp.enrollmentDate ? fmt(sp.enrollmentDate) : '—';
    vars['student.nationality'] = 'Malgache';
    if (sp.user.avatarUrl) {
      vars['student.photo'] = `<img src="${API_URL}${sp.user.avatarUrl}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;" alt="Photo">`;
    } else {
      vars['student.photo'] = '';
    }
    // Override academicYear from promotion if available
    if (sp.promotion?.academicYear?.label) vars['academicYear'] = sp.promotion.academicYear.label;
  }

  // Teacher
  if (inputs.teacherId) {
    const tp = await prisma.teacherProfile.findUnique({
      where: { id: inputs.teacherId },
      include: { user: true, mention: true },
    });
    if (!tp) throw new HttpError(404, 'Enseignant introuvable');
    vars['teacher.fullName']      = `${tp.user.lastName.toUpperCase()} ${tp.user.firstName}`;
    vars['teacher.firstName']     = tp.user.firstName;
    vars['teacher.lastName']      = tp.user.lastName.toUpperCase();
    vars['teacher.employeeId']    = tp.employeeId ?? '—';
    vars['teacher.specialization'] = tp.specialization ?? tp.mention?.name ?? 'Enseignant';
    vars['teacher.email']         = tp.user.email;
    vars['teacher.phone']         = tp.user.phone ?? '—';
  }

  // Staff
  if (inputs.staffId) {
    const sp = await prisma.staffProfile.findUnique({
      where: { id: inputs.staffId },
      include: { user: true, department: true },
    });
    if (!sp) throw new HttpError(404, 'Agent introuvable');
    vars['staff.fullName']   = `${sp.user.lastName.toUpperCase()} ${sp.user.firstName}`;
    vars['staff.firstName']  = sp.user.firstName;
    vars['staff.lastName']   = sp.user.lastName.toUpperCase();
    vars['staff.employeeId'] = sp.employeeId ?? '—';
    vars['staff.function']   = sp.office ?? sp.department?.name ?? 'Personnel';
    vars['staff.department'] = sp.department?.name ?? '—';
    vars['staff.email']      = sp.user.email;
    vars['staff.phone']      = sp.user.phone ?? '—';
  }

  // Semester
  if (inputs.semesterId) {
    const sem = await prisma.semester.findUnique({ where: { id: inputs.semesterId }, select: { name: true } });
    vars['semester.name'] = sem?.name ?? '—';
  }

  // Raw inputs (date fields, text fields)
  for (const [k, v] of Object.entries(inputs)) {
    if (!k.endsWith('Id') && v) {
      // Try to format if it looks like a datetime
      if (typeof v === 'string' && /\d{4}-\d{2}-\d{2}T/.test(v)) {
        vars[k] = fmtDT(v);
      } else {
        vars[k] = v;
      }
    }
  }

  return vars;
}

function replaceVars(body, vars) {
  return body.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? `<span style="color:#e53e3e">{{${key.trim()}}}</span>`);
}

// ── Number sequence ───────────────────────────────────────────────────────────

async function nextDocNumber(prefix) {
  const year = new Date().getFullYear();
  const count = await prisma.generatedDocument.count({
    where: { number: { startsWith: `${prefix}-${year}` } },
  });
  return `${prefix}-${year}-${String(count + 1).padStart(6, '0')}`;
}

function templatePrefix(templateId) {
  if (templateId.includes('certificat'))   return 'CERT';
  if (templateId.includes('attestation'))  return 'ATTEST';
  if (templateId.includes('convocation'))  return 'CONV';
  if (templateId.includes('avertissement')) return 'AVERT';
  if (templateId.includes('felicitations')) return 'FELIC';
  if (templateId.includes('affectation'))  return 'AFF';
  if (templateId.includes('decision'))     return 'DEC';
  if (templateId.includes('ordre'))        return 'OM';
  if (templateId.includes('lettre'))       return 'LTR';
  return 'DOC';
}

// ── Signatory block ───────────────────────────────────────────────────────────

async function signatoryBlock(signatoryRoles) {
  if (!signatoryRoles?.length) return '';
  // Find users with roles matching signatoryRoles (simplified — find by roleName)
  const roles = await prisma.userRole.findMany({
    where: { role: { name: { in: signatoryRoles } } },
    include: {
      user: { select: { firstName: true, lastName: true, signatureUrl: true } },
      role: { select: { name: true } },
    },
    take: 3,
  });

  if (!roles.length) return '';

  const blocks = roles.map((ur) => {
    const sigImg = ur.user.signatureUrl
      ? `<img src="${API_URL}${ur.user.signatureUrl}" style="height:60px;margin-bottom:4px;" alt="Signature">`
      : '<div style="height:60px;border-bottom:1px solid #333;width:120px;margin-bottom:4px;"></div>';
    return `<div style="text-align:center;min-width:160px;">
      ${sigImg}
      <div style="font-weight:600;font-size:0.85em;">${ur.user.lastName.toUpperCase()} ${ur.user.firstName}</div>
      <div style="font-size:0.75em;color:#666;">${ur.role.name}</div>
    </div>`;
  });

  return `<div style="display:flex;gap:48px;justify-content:flex-end;margin-top:48px;">${blocks.join('')}</div>`;
}

// ── Generate HTML letter ──────────────────────────────────────────────────────

export async function generateLetter(templateId, inputs, requestUser) {
  const tpl = getLetterTemplate(templateId);
  if (!tpl) throw new HttpError(404, 'Modèle introuvable');

  const vars    = await resolveVars(templateId, inputs);
  const body    = replaceVars(tpl.body, vars);
  const sigHtml = await signatoryBlock(tpl.signatoryRoles);
  const docNo   = await nextDocNumber(templatePrefix(templateId));
  const today   = vars['today_long'];

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${tpl.name}</title>
<style>
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.7; color: #1a1a1a; margin: 0; background: #fff; }
  .page { max-width: 794px; margin: 0 auto; padding: 32px 48px; min-height: 1123px; position: relative; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a365d; padding-bottom: 16px; margin-bottom: 24px; }
  .header-left img { height: 64px; }
  .header-center { text-align: center; flex: 1; padding: 0 24px; }
  .header-center h1 { font-size: 1em; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0; color: #1a365d; }
  .header-center p { font-size: 0.8em; margin: 2px 0; color: #555; }
  .doc-meta { display: flex; justify-content: space-between; margin-bottom: 32px; font-size: 0.9em; color: #555; }
  .doc-number { font-weight: 600; color: #1a365d; }
  .doc-title { text-align: center; margin: 32px 0; }
  .doc-title h2 { font-size: 1.3em; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; display: inline-block; padding: 8px 24px; border: 2px solid #1a365d; color: #1a365d; }
  .doc-body { margin: 0 0 32px; }
  .doc-body p { margin: 0 0 12px; text-align: justify; }
  .doc-body blockquote { border-left: 4px solid #2d3748; padding-left: 16px; margin: 16px 0; font-style: italic; }
  .footer { position: absolute; bottom: 32px; left: 48px; right: 48px; border-top: 1px solid #ccc; padding-top: 8px; display: flex; justify-content: space-between; font-size: 0.75em; color: #999; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-left">
      <img src="${API_URL}/uploads/logo.png" alt="Logo UR" onerror="this.style.display='none'">
    </div>
    <div class="header-center">
      <h1>Université de Référence</h1>
      <p>Direction des Affaires Académiques</p>
      <p>Antananarivo, Madagascar</p>
    </div>
    <div style="min-width:80px;text-align:right;font-size:0.8em;color:#555;">
      <div>Tél : +261 20 22 XXX XX</div>
      <div>contact@ur.mg</div>
    </div>
  </div>

  <div class="doc-meta">
    <span class="doc-number">N° ${docNo}</span>
    <span>Antananarivo, le ${today}</span>
  </div>

  <div class="doc-title">
    <h2>${tpl.name.toUpperCase()}</h2>
  </div>

  <div class="doc-body">
    ${body}
  </div>

  ${sigHtml}

  <div class="footer">
    <span>Université de Référence — Document officiel</span>
    <span>N° ${docNo} — ${today}</span>
  </div>
</div>
</body>
</html>`;

  return { html, docNo, tpl, vars };
}

// ── Archive a generated letter ────────────────────────────────────────────────

export async function archiveLetter(templateId, inputs, html, docNo, generatedBy) {
  const tpl = getLetterTemplate(templateId);
  if (!tpl) return null;

  let recipientName = inputs.agent ?? inputs.destinataire ?? 'Inconnu';
  if (inputs.studentId) {
    const sp = await prisma.studentProfile.findUnique({ where: { id: inputs.studentId }, include: { user: true } });
    if (sp?.user) recipientName = sp.user.lastName + ' ' + sp.user.firstName;
  } else if (inputs.teacherId) {
    const tp = await prisma.teacherProfile.findUnique({ where: { id: inputs.teacherId }, include: { user: true } });
    if (tp?.user) recipientName = tp.user.lastName + ' ' + tp.user.firstName;
  }

  const recipientType = inputs.studentId ? 'STUDENT' : inputs.teacherId ? 'TEACHER' : 'STAFF';
  const recipientId   = inputs.studentId ?? inputs.teacherId ?? generatedBy;

  return prisma.generatedDocument.create({
    data: {
      number: docNo,
      templateId,
      templateName: tpl.name,
      category: tpl.category,
      moduleType: 'LETTER',
      recipientType,
      recipientId,
      recipientName,
      content: html,
      inputs: JSON.stringify(inputs),
      generatedBy,
    },
  });
}

// ── List history ──────────────────────────────────────────────────────────────

export async function listHistory(userId, { moduleType, page = 1, limit = 20 } = {}) {
  const where = { generatedBy: userId, moduleType: moduleType ?? { in: ['LETTER', 'DOCUMENT', 'CARD'] } };
  const [total, items] = await Promise.all([
    prisma.generatedDocument.count({ where }),
    prisma.generatedDocument.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, number: true, templateName: true, category: true, moduleType: true,
        recipientName: true, recipientType: true, generatedAt: true, status: true,
        author: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);
  return { total, page, limit, items };
}

export async function getDocument(id, userId) {
  const doc = await prisma.generatedDocument.findUnique({ where: { id } });
  if (!doc) throw new HttpError(404, 'Document introuvable');
  // Allow own documents or SUPER_ADMIN (caller checks role separately)
  if (doc.generatedBy !== userId) throw new HttpError(403, 'Accès refusé');
  return doc;
}
