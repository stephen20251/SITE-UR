import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { getTemplate } from './documents.templates.js';

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchStudent(studentId) {
  const sp = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      user:      true,
      promotion: { include: { academicYear: { include: { campus: true } }, parcours: true } },
      mention:   { include: { department: true } },
      group:     true,
    },
  });
  if (!sp) throw new HttpError(404, 'Étudiant introuvable');
  return sp;
}

async function fetchTeacher(teacherId) {
  const tp = await prisma.teacherProfile.findUnique({
    where: { id: teacherId },
    include: { user: true },
  });
  if (!tp) throw new HttpError(404, 'Enseignant introuvable');
  return tp;
}

async function fetchBulletinData(studentId, semesterId) {
  const grades = await prisma.grade.findMany({
    where: { studentId, semesterId },
    include: { subject: { select: { name: true, code: true, credits: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const bySubject = new Map();
  for (const g of grades) {
    if (!bySubject.has(g.subjectId)) bySubject.set(g.subjectId, { subject: g.subject, grades: [] });
    bySubject.get(g.subjectId).grades.push(g);
  }

  let totalCredits = 0, earnedCredits = 0, weightedSum = 0;
  const results = [...bySubject.values()].map(({ subject, grades: sg }) => {
    const weighted   = sg.reduce((s, g) => s + g.value * g.coefficient, 0);
    const totalCoeff = sg.reduce((s, g) => s + g.coefficient, 0);
    const avg        = totalCoeff > 0 ? weighted / totalCoeff : 0;
    totalCredits  += subject.credits;
    if (avg >= 10) earnedCredits += subject.credits;
    weightedSum   += avg * subject.credits;
    return { subject, grades: sg, average: Math.round(avg * 100) / 100 };
  });

  const gpa = totalCredits > 0 ? Math.round(weightedSum / totalCredits * 100) / 100 : 0;
  return { results, summary: { gpa, totalCredits, earnedCredits, passed: gpa >= 10 } };
}

async function fetchAttendanceStats(studentId, semesterId) {
  const semester = semesterId
    ? await prisma.semester.findUnique({ where: { id: semesterId }, select: { startDate: true, endDate: true } })
    : null;

  const where = { studentId };
  if (semester) {
    where.date = { gte: semester.startDate, lte: semester.endDate };
  }

  const records = await prisma.attendance.findMany({ where, orderBy: { date: 'asc' } });
  const total   = records.length;
  const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const absent  = records.filter((r) => r.status === 'ABSENT').length;
  const rate    = total > 0 ? Math.round((present / total) * 100) : null;
  return { records, total, present, absent, rate };
}

async function fetchCurrentAcademicYear(campusId) {
  return prisma.academicYear.findFirst({
    where: campusId ? { campusId, isCurrent: true } : { isCurrent: true },
    include: { campus: true },
  });
}

async function fetchSemester(semesterId) {
  return prisma.semester.findUnique({ where: { id: semesterId } });
}

// Paiement à imprimer : ancien système (Payment), ou écolage mensuel (TuitionPayment)
// recherché par id ou numéro de reçu ; à défaut, dernier écolage validé de l'étudiant.
async function fetchPayment(paymentId, studentId) {
  const ref = (paymentId ?? '').trim();
  if (ref) {
    const legacy = await prisma.payment.findUnique({
      where: { id: ref },
      include: { invoice: { include: { feeStructure: true } } },
    }).catch(() => null);
    if (legacy) return legacy;
  }
  const tuition = await prisma.tuitionPayment.findFirst({
    where: ref
      ? { OR: [{ id: ref }, { receiptNumber: ref }] }
      : { studentId, status: 'VALIDATED' },
    orderBy: { validatedAt: 'desc' },
  });
  if (!tuition) return null;
  return {
    studentId: tuition.studentId,
    receiptNumber: tuition.receiptNumber,
    amount: tuition.amount,
    currency: tuition.currency,
    method: tuition.method === 'CASH' ? 'Espèces (bureau)' : tuition.method,
    reference: tuition.transactionRef ?? tuition.receiptNumber,
    paidAt: tuition.validatedAt ?? tuition.createdAt,
    invoice: { title: `Écolage ${tuition.level} — mois ${tuition.month}` },
  };
}

// ─── Document number generator ────────────────────────────────────────────────

function docNumber(prefix) {
  const now  = new Date();
  const year = now.getFullYear();
  const seq  = String(now.getTime()).slice(-6);
  return `${prefix}-${year}-${seq}`;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmtDate(d = new Date(), locale = 'fr-FR') {
  return new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtDateTime(d) {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── HTML base styles ─────────────────────────────────────────────────────────

const BASE_CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Times New Roman',Georgia,serif;font-size:12pt;color:#1a1a1a;background:#fff}
  h1{font-size:16pt;font-weight:bold;text-align:center;letter-spacing:.05em}
  h2{font-size:13pt;font-weight:bold;text-align:center;margin:12pt 0;letter-spacing:.08em;text-transform:uppercase}
  h3{font-size:11pt;font-weight:bold;margin-bottom:6pt}
  p{margin-bottom:8pt;line-height:1.6;text-align:justify}
  .page{width:210mm;min-height:297mm;padding:20mm 25mm;margin:0 auto;position:relative}
  .header{text-align:center;border-bottom:2px solid #1a1a1a;padding-bottom:12pt;margin-bottom:20pt}
  .univ-name{font-size:14pt;font-weight:bold;text-transform:uppercase;letter-spacing:.1em}
  .univ-subtitle{font-size:10pt;color:#444;margin-top:3pt}
  .doc-title{background:#1a1a1a;color:#fff;padding:8pt 20pt;text-align:center;font-size:14pt;font-weight:bold;letter-spacing:.15em;margin:20pt 0}
  .doc-number{text-align:right;font-size:9pt;color:#666;margin-bottom:4pt;font-family:monospace}
  .body-text{margin:20pt 0;line-height:1.8}
  .info-block{background:#f8f8f8;border-left:3px solid #1a1a1a;padding:12pt 16pt;margin:16pt 0}
  .info-row{display:flex;gap:8pt;margin-bottom:6pt;font-size:11pt}
  .info-label{font-weight:bold;min-width:140pt;color:#444}
  .info-value{flex:1}
  table{width:100%;border-collapse:collapse;margin:12pt 0;font-size:10pt}
  th{background:#1a1a1a;color:#fff;padding:6pt 8pt;text-align:left;font-weight:bold}
  td{padding:5pt 8pt;border-bottom:1px solid #ddd}
  tr:nth-child(even) td{background:#f8f8f8}
  .grade-pass{color:#166534;font-weight:bold}
  .grade-fail{color:#991b1b;font-weight:bold}
  .footer{position:absolute;bottom:15mm;left:25mm;right:25mm;border-top:1px solid #aaa;padding-top:8pt;text-align:center;font-size:9pt;color:#666}
  .signature-area{display:flex;justify-content:space-between;margin-top:40pt}
  .signature-box{text-align:center;min-width:120pt}
  .signature-line{border-bottom:1px solid #1a1a1a;width:120pt;margin:0 auto 4pt}
  .seal-area{width:80pt;height:80pt;border:2px solid #aaa;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:8pt;color:#aaa;text-align:center}
  .summary-box{border:2px solid #1a1a1a;padding:12pt 20pt;margin:20pt 0;text-align:center}
  .summary-gpa{font-size:22pt;font-weight:bold}
  .result-badge{display:inline-block;padding:4pt 16pt;border-radius:4pt;font-weight:bold;font-size:11pt;margin-top:6pt}
  .badge-pass{background:#dcfce7;color:#166534;border:1px solid #166534}
  .badge-fail{background:#fee2e2;color:#991b1b;border:1px solid #991b1b}
  @media print{
    body{margin:0}
    .page{padding:15mm 20mm}
    .no-print{display:none}
  }
`;

function htmlDoc(title, body, docNum = '') {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<div class="no-print" style="background:#f0f0f0;padding:10px;text-align:center;font-family:sans-serif;font-size:12px;gap:8px;display:flex;justify-content:center;align-items:center">
  <span>Aperçu du document</span>
  <button onclick="window.print()" style="background:#1a1a1a;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">🖨️ Imprimer / Télécharger PDF</button>
</div>
<div class="page">
${docNum ? `<div class="doc-number">N° ${docNum}</div>` : ''}
${body}
</div>
</body>
</html>`;
}

function universityHeader(campus) {
  const name = campus?.name ?? 'UNIVERSITÉ RÉFÉRENCES';
  const city = campus?.city ?? 'Madagascar';
  return `<div class="header">
    <div class="univ-name">${name}</div>
    <div class="univ-subtitle">${city} — République de Madagascar</div>
    <div class="univ-subtitle" style="margin-top:4pt">Tél: ${campus?.phone ?? '—'} | ${campus?.email ?? '—'}</div>
  </div>`;
}

function signatureArea(issuer, sealed = true) {
  return `<div class="signature-area">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div style="font-size:9pt;color:#666">Le signataire</div>
      <div style="font-size:10pt;font-weight:bold;margin-top:4pt">${issuer}</div>
    </div>
    ${sealed ? `<div class="signature-box">
      <div class="seal-area">Cachet<br>officiel</div>
    </div>` : ''}
    <div class="signature-box">
      <div style="font-size:9pt;color:#666">Date de délivrance</div>
      <div style="font-size:10pt;margin-top:4pt">${fmtDate()}</div>
    </div>
  </div>`;
}

// ─── Template renderers ───────────────────────────────────────────────────────

async function renderCarteEtudiant(inputs) {
  const sp = await fetchStudent(inputs.studentId);
  const { user, promotion, mention, group } = sp;

  const cardCSS = `
    body{background:#eee;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif}
    .card{width:85.6mm;height:54mm;background:linear-gradient(135deg,#1a3a6e 0%,#2563eb 60%,#1e40af 100%);border-radius:8pt;overflow:hidden;position:relative;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,.3)}
    .card-header{padding:5mm 5mm 2mm;display:flex;align-items:center;gap:4mm}
    .card-logo{width:12mm;height:12mm;background:rgba(255,255,255,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:8pt;flex-shrink:0}
    .card-univ{font-size:6pt;font-weight:bold;letter-spacing:.05em;line-height:1.3}
    .card-body{padding:0 5mm;display:flex;gap:4mm;align-items:flex-start}
    .card-photo{width:16mm;height:20mm;background:rgba(255,255,255,.15);border:1.5pt solid rgba(255,255,255,.4);border-radius:4pt;display:flex;align-items:center;justify-content:center;font-size:7pt;color:rgba(255,255,255,.6);flex-shrink:0;font-weight:bold}
    .card-info{flex:1;font-size:6.5pt}
    .card-name{font-size:9pt;font-weight:bold;margin-bottom:2mm;line-height:1.2}
    .card-row{margin-bottom:1mm;opacity:.9}
    .card-label{opacity:.7;margin-right:1mm}
    .card-footer{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.25);padding:2mm 5mm;display:flex;justify-content:space-between;align-items:center;font-size:5.5pt}
    .card-matricule{font-family:monospace;font-size:7pt;font-weight:bold;letter-spacing:.05em}
    .qr-placeholder{width:12mm;height:12mm;background:rgba(255,255,255,.9);border-radius:2pt;display:flex;align-items:center;justify-content:center}
    .qr-inner{width:10mm;height:10mm;background:repeating-linear-gradient(45deg,#1a3a6e 0,#1a3a6e 1mm,transparent 1mm,transparent 2mm);opacity:.8}
    .no-print{position:fixed;top:0;left:0;right:0;background:#f0f0f0;padding:10px;text-align:center;font-family:sans-serif;font-size:12px;display:flex;justify-content:center;align-items:center;gap:8px;z-index:100}
    @media print{.no-print{display:none}body{background:#fff}}
  `;

  const initial = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  const academicYear = promotion?.academicYear?.label ?? new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Carte étudiant — ${user.firstName} ${user.lastName}</title>
<style>${cardCSS}</style></head>
<body>
<div class="no-print">
  <span>Carte étudiant (format PVC 85.6×54mm)</span>
  <button onclick="window.print()" style="background:#1a3a6e;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer">🖨️ Imprimer</button>
</div>
<div class="card">
  <div class="card-header">
    <div class="card-logo">UR</div>
    <div class="card-univ">UNIVERSITÉ RÉFÉRENCES<br>MADAGASCAR<br><span style="opacity:.7">CARTE D'ÉTUDIANT</span></div>
  </div>
  <div class="card-body">
    <div class="card-photo">${initial}</div>
    <div class="card-info">
      <div class="card-name">${user.firstName}<br>${user.lastName.toUpperCase()}</div>
      <div class="card-row"><span class="card-label">Mention:</span>${mention?.name ?? '—'}</div>
      <div class="card-row"><span class="card-label">Niveau:</span>${promotion?.level ?? '—'}</div>
      <div class="card-row"><span class="card-label">Parcours:</span>${promotion?.name ?? '—'}</div>
      ${group ? `<div class="card-row"><span class="card-label">Groupe:</span>${group.name}</div>` : ''}
      <div class="card-row"><span class="card-label">A.U.:</span>${academicYear}</div>
    </div>
  </div>
  <div class="card-footer">
    <div>
      <div class="card-matricule">${sp.matricule ?? 'N/A'}</div>
      <div style="opacity:.7;margin-top:1mm">Validité: ${academicYear}</div>
    </div>
    <div class="qr-placeholder"><div class="qr-inner"></div></div>
  </div>
</div>
</body></html>`;
}

async function renderCertificatScolarite(inputs, issuer) {
  const sp      = await fetchStudent(inputs.studentId);
  const { user, promotion, mention } = sp;
  const campus  = promotion?.academicYear?.campus;
  const num     = docNumber('CS');
  const year    = promotion?.academicYear?.label ?? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

  return htmlDoc(`Certificat de scolarité — ${user.firstName} ${user.lastName}`, `
    ${universityHeader(campus)}
    <div class="doc-title">CERTIFICAT DE SCOLARITÉ</div>
    <div class="doc-number">Réf. ${num}</div>
    <div class="body-text">
      <p>Je soussigné(e), <strong>${issuer}</strong>, au nom de l'Université Références, certifie que :</p>
    </div>
    <div class="info-block">
      <div class="info-row"><span class="info-label">Nom et Prénom :</span><span class="info-value"><strong>${user.lastName.toUpperCase()} ${user.firstName}</strong></span></div>
      <div class="info-row"><span class="info-label">Numéro matricule :</span><span class="info-value">${sp.matricule ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">E-mail :</span><span class="info-value">${user.email}</span></div>
      <div class="info-row"><span class="info-label">Mention :</span><span class="info-value">${mention?.name ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">Parcours / Niveau :</span><span class="info-value">${promotion?.name ?? '—'} — ${promotion?.level ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">Année universitaire :</span><span class="info-value">${year}</span></div>
      <div class="info-row"><span class="info-label">Statut :</span><span class="info-value"><strong>Régulièrement inscrit(e)</strong></span></div>
    </div>
    <div class="body-text">
      <p>Ce certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit.</p>
      <p>Fait à ${campus?.city ?? 'Antananarivo'}, le ${fmtDate()}</p>
    </div>
    ${signatureArea(issuer)}
    <div class="footer">Université Références — Document officiel — ${campus?.address ?? ''} — ${campus?.email ?? ''}</div>
  `, num);
}

async function renderAttestationInscription(inputs, issuer) {
  const sp      = await fetchStudent(inputs.studentId);
  const { user, promotion, mention, group } = sp;
  const campus  = promotion?.academicYear?.campus;
  const num     = docNumber('AI');
  const year    = promotion?.academicYear?.label ?? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

  return htmlDoc(`Attestation d'inscription — ${user.firstName} ${user.lastName}`, `
    ${universityHeader(campus)}
    <div class="doc-title">ATTESTATION D'INSCRIPTION</div>
    <div class="doc-number">Réf. ${num}</div>
    <div class="body-text">
      <p>L'Université Références atteste que l'étudiant(e) dont l'identité suit est dûment inscrit(e) pour l'année universitaire <strong>${year}</strong> :</p>
    </div>
    <div class="info-block">
      <div class="info-row"><span class="info-label">Nom complet :</span><span class="info-value"><strong>${user.lastName.toUpperCase()} ${user.firstName}</strong></span></div>
      <div class="info-row"><span class="info-label">Matricule :</span><span class="info-value">${sp.matricule ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">Mention :</span><span class="info-value">${mention?.name ?? '—'} (${mention?.code ?? '—'})</span></div>
      <div class="info-row"><span class="info-label">Parcours :</span><span class="info-value">${promotion?.name ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">Niveau :</span><span class="info-value">${promotion?.level ?? '—'}</span></div>
      ${group ? `<div class="info-row"><span class="info-label">Groupe :</span><span class="info-value">${group.name}</span></div>` : ''}
      <div class="info-row"><span class="info-label">Date d'inscription :</span><span class="info-value">${sp.enrollmentDate ? fmtDate(sp.enrollmentDate) : '—'}</span></div>
    </div>
    <div class="body-text">
      <p>Cette attestation est établie pour les besoins administratifs et légaux de l'intéressé(e).</p>
      <p>Fait à ${campus?.city ?? 'Antananarivo'}, le ${fmtDate()}</p>
    </div>
    ${signatureArea(issuer)}
    <div class="footer">Université Références — Document officiel — ${num}</div>
  `, num);
}

async function renderAttestationFrequentation(inputs, issuer) {
  const sp      = await fetchStudent(inputs.studentId);
  const { user, promotion, mention } = sp;
  const campus  = promotion?.academicYear?.campus;
  const semester = inputs.semesterId ? await fetchSemester(inputs.semesterId) : null;
  const att     = await fetchAttendanceStats(sp.id, inputs.semesterId);
  const num     = docNumber('AF');

  return htmlDoc(`Attestation de fréquentation — ${user.firstName} ${user.lastName}`, `
    ${universityHeader(campus)}
    <div class="doc-title">ATTESTATION DE FRÉQUENTATION</div>
    <div class="doc-number">Réf. ${num}</div>
    <div class="body-text">
      <p>Je soussigné(e), <strong>${issuer}</strong>, certifie que l'étudiant(e) :</p>
    </div>
    <div class="info-block">
      <div class="info-row"><span class="info-label">Nom complet :</span><span class="info-value"><strong>${user.lastName.toUpperCase()} ${user.firstName}</strong></span></div>
      <div class="info-row"><span class="info-label">Matricule :</span><span class="info-value">${sp.matricule ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">Mention / Niveau :</span><span class="info-value">${mention?.name ?? '—'} — ${promotion?.level ?? '—'}</span></div>
      ${semester ? `<div class="info-row"><span class="info-label">Période :</span><span class="info-value">${semester.name}</span></div>` : ''}
    </div>
    <div class="body-text">
      <p>a fréquenté régulièrement les cours${semester ? ` durant le semestre <strong>${semester.name}</strong>` : ''} avec le bilan d'assiduité suivant :</p>
    </div>
    ${att.total > 0 ? `
    <div class="summary-box">
      <div class="summary-gpa" style="color:${(att.rate ?? 0) >= 80 ? '#166534' : '#991b1b'}">${att.rate ?? 0}%</div>
      <div style="font-size:10pt;color:#666;margin-top:4pt">Taux de présence</div>
      <div style="margin-top:8pt;font-size:10pt">${att.present} séances présent(e) sur ${att.total} séances</div>
    </div>` : '<p style="text-align:center;color:#666">Aucune donnée de présence enregistrée.</p>'}
    <div class="body-text">
      <p>Ce document est délivré à l'intéressé(e) pour servir et valoir ce que de droit.</p>
      <p>Fait à ${campus?.city ?? 'Antananarivo'}, le ${fmtDate()}</p>
    </div>
    ${signatureArea(issuer)}
    <div class="footer">Université Références — Document officiel — ${num}</div>
  `, num);
}

async function renderReleveNotes(inputs, issuer) {
  const sp       = await fetchStudent(inputs.studentId);
  const { user, promotion, mention } = sp;
  const campus   = promotion?.academicYear?.campus;
  const semester = inputs.semesterId ? await fetchSemester(inputs.semesterId) : null;
  const bulletin = await fetchBulletinData(sp.id, inputs.semesterId);
  const num      = docNumber('RN');

  const rows = bulletin.results.map((r) => {
    const passing = r.average >= 10;
    const max     = r.grades[0]?.maxValue ?? 20;
    const gradeDetail = r.grades.map((g) => `${g.type}: ${g.value}/${g.maxValue}${g.coefficient !== 1 ? `×${g.coefficient}` : ''}`).join(' | ');
    return `<tr>
      <td>${r.subject.name}</td>
      <td style="text-align:center">${r.subject.code}</td>
      <td style="text-align:center">${r.subject.credits}</td>
      <td style="text-align:center">${gradeDetail}</td>
      <td style="text-align:center" class="${passing ? 'grade-pass' : 'grade-fail'}">${r.average.toFixed(2)}/${max}</td>
    </tr>`;
  }).join('');

  return htmlDoc(`Relevé de notes — ${user.firstName} ${user.lastName}`, `
    ${universityHeader(campus)}
    <div class="doc-title">RELEVÉ DE NOTES</div>
    <div class="doc-number">Réf. ${num}</div>
    <div class="info-block">
      <div class="info-row"><span class="info-label">Nom complet :</span><span class="info-value"><strong>${user.lastName.toUpperCase()} ${user.firstName}</strong></span></div>
      <div class="info-row"><span class="info-label">Matricule :</span><span class="info-value">${sp.matricule ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">Mention :</span><span class="info-value">${mention?.name ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">Parcours / Niveau :</span><span class="info-value">${promotion?.name ?? '—'} — ${promotion?.level ?? '—'}</span></div>
      ${semester ? `<div class="info-row"><span class="info-label">Semestre :</span><span class="info-value">${semester.name}</span></div>` : ''}
    </div>
    <table>
      <thead><tr>
        <th>Matière</th><th style="text-align:center">Code</th><th style="text-align:center">Crédits</th>
        <th style="text-align:center">Détail</th><th style="text-align:center">Moyenne</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#666">Aucune note enregistrée</td></tr>'}</tbody>
    </table>
    ${bulletin.results.length > 0 ? `
    <div class="summary-box">
      <div style="font-size:10pt;color:#666">Moyenne générale</div>
      <div class="summary-gpa" style="color:${bulletin.summary.passed ? '#166534' : '#991b1b'}">${bulletin.summary.gpa.toFixed(2)}</div>
      <div style="margin-top:6pt;font-size:10pt">Crédits obtenus : <strong>${bulletin.summary.earnedCredits}/${bulletin.summary.totalCredits}</strong></div>
      <div class="result-badge ${bulletin.summary.passed ? 'badge-pass' : 'badge-fail'}">${bulletin.summary.passed ? '✓ VALIDÉ' : '✗ AJOURNÉ'}</div>
    </div>` : ''}
    <div class="body-text" style="margin-top:20pt">
      <p>Fait à ${campus?.city ?? 'Antananarivo'}, le ${fmtDate()}</p>
    </div>
    ${signatureArea(issuer)}
    <div class="footer">Université Références — Document officiel — ${num}</div>
  `, num);
}

async function renderBulletin(inputs, issuer) {
  const sp       = await fetchStudent(inputs.studentId);
  const { user, promotion, mention, group } = sp;
  const campus   = promotion?.academicYear?.campus;
  const semester = inputs.semesterId ? await fetchSemester(inputs.semesterId) : null;
  const bulletin = await fetchBulletinData(sp.id, inputs.semesterId);
  const att      = await fetchAttendanceStats(sp.id, inputs.semesterId);
  const num      = docNumber('BUL');
  const year     = promotion?.academicYear?.label ?? `${new Date().getFullYear()}`;

  const rows = bulletin.results.map((r) => {
    const passing = r.average >= 10;
    const max     = r.grades[0]?.maxValue ?? 20;
    const gradeDetail = r.grades.map((g) => `${g.type} ${g.value}/${g.maxValue}`).join(', ');
    return `<tr>
      <td>${r.subject.name} <span style="color:#666;font-size:9pt">(${r.subject.code})</span></td>
      <td style="text-align:center">${r.subject.credits}</td>
      <td style="text-align:center;font-size:9pt">${gradeDetail}</td>
      <td style="text-align:center;font-weight:bold" class="${passing ? 'grade-pass' : 'grade-fail'}">${r.average.toFixed(2)}</td>
      <td style="text-align:center">${passing ? r.subject.credits : 0}</td>
    </tr>`;
  }).join('');

  return htmlDoc(`Bulletin — ${user.firstName} ${user.lastName}`, `
    ${universityHeader(campus)}
    <div style="text-align:center;margin-bottom:4pt;font-size:10pt">Bulletin de notes semestriel</div>
    <div class="doc-title">BULLETIN ${semester ? `— ${semester.name.toUpperCase()}` : ''}</div>
    <div style="display:flex;justify-content:space-between;gap:16pt;margin:16pt 0">
      <div class="info-block" style="flex:1">
        <div class="info-row"><span class="info-label">Nom :</span><span class="info-value"><strong>${user.lastName.toUpperCase()} ${user.firstName}</strong></span></div>
        <div class="info-row"><span class="info-label">Matricule :</span><span class="info-value">${sp.matricule ?? '—'}</span></div>
        <div class="info-row"><span class="info-label">Mention :</span><span class="info-value">${mention?.name ?? '—'}</span></div>
        <div class="info-row"><span class="info-label">Niveau :</span><span class="info-value">${promotion?.level ?? '—'}</span></div>
        ${group ? `<div class="info-row"><span class="info-label">Groupe :</span><span class="info-value">${group.name}</span></div>` : ''}
        <div class="info-row"><span class="info-label">Année :</span><span class="info-value">${year}</span></div>
      </div>
      ${att.total > 0 ? `<div style="text-align:center;min-width:80pt">
        <div style="font-size:9pt;color:#666">Assiduité</div>
        <div style="font-size:20pt;font-weight:bold;color:${(att.rate ?? 0) >= 80 ? '#166534' : '#991b1b'}">${att.rate}%</div>
        <div style="font-size:8pt;color:#666">${att.present}/${att.total} séances</div>
      </div>` : ''}
    </div>
    <table>
      <thead><tr>
        <th>Unité d'enseignement / Matière</th>
        <th style="text-align:center">Crédits</th>
        <th style="text-align:center">Notes</th>
        <th style="text-align:center">Moyenne</th>
        <th style="text-align:center">Crédits obtenus</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:12pt;color:#666">Aucune note disponible pour ce semestre</td></tr>'}</tbody>
    </table>
    ${bulletin.results.length > 0 ? `
    <div class="summary-box">
      <div style="display:flex;justify-content:center;gap:40pt;align-items:center">
        <div style="text-align:center">
          <div style="font-size:9pt;color:#666">Moyenne générale</div>
          <div class="summary-gpa" style="color:${bulletin.summary.passed ? '#166534' : '#991b1b'}">${bulletin.summary.gpa.toFixed(2)}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:9pt;color:#666">Crédits capitalisés</div>
          <div class="summary-gpa" style="font-size:18pt">${bulletin.summary.earnedCredits}/${bulletin.summary.totalCredits}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:9pt;color:#666">Résultat</div>
          <div class="result-badge ${bulletin.summary.passed ? 'badge-pass' : 'badge-fail'}" style="margin-top:6pt">
            ${bulletin.summary.passed ? '✓ ADMIS(E)' : '✗ AJOURNÉ(E)'}
          </div>
        </div>
      </div>
    </div>` : ''}
    <div style="margin-top:20pt"><p>Délivré le ${fmtDate()} par ${issuer}</p></div>
    ${signatureArea(issuer)}
    <div class="footer">Université Références — Bulletin officiel — Réf. ${num}</div>
  `, num);
}

async function renderAttestationReussite(inputs, issuer) {
  const sp       = await fetchStudent(inputs.studentId);
  const { user, promotion, mention } = sp;
  const campus   = promotion?.academicYear?.campus;
  const semester = inputs.semesterId ? await fetchSemester(inputs.semesterId) : null;
  const bulletin = await fetchBulletinData(sp.id, inputs.semesterId);
  const num      = docNumber('AR');

  if (bulletin.results.length > 0 && !bulletin.summary.passed) {
    throw new HttpError(400, "L'étudiant n'a pas validé ce semestre (moyenne < 10)");
  }

  return htmlDoc(`Attestation de réussite — ${user.firstName} ${user.lastName}`, `
    ${universityHeader(campus)}
    <div class="doc-title">ATTESTATION DE RÉUSSITE</div>
    <div class="doc-number">Réf. ${num}</div>
    <div class="body-text">
      <p>Je soussigné(e), <strong>${issuer}</strong>, certifie que l'étudiant(e) :</p>
    </div>
    <div class="info-block">
      <div class="info-row"><span class="info-label">Nom complet :</span><span class="info-value"><strong>${user.lastName.toUpperCase()} ${user.firstName}</strong></span></div>
      <div class="info-row"><span class="info-label">Matricule :</span><span class="info-value">${sp.matricule ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">Mention :</span><span class="info-value">${mention?.name ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">Niveau :</span><span class="info-value">${promotion?.level ?? '—'}</span></div>
      ${semester ? `<div class="info-row"><span class="info-label">Semestre :</span><span class="info-value">${semester.name}</span></div>` : ''}
    </div>
    <div class="body-text">
      <p>a <strong>validé</strong> avec succès ${semester ? `le semestre <strong>${semester.name}</strong>` : "l'année universitaire en cours"} avec les résultats suivants :</p>
    </div>
    <div class="summary-box">
      <div class="summary-gpa" style="color:#166534">${bulletin.summary.gpa.toFixed(2)}</div>
      <div style="font-size:10pt;color:#666;margin-top:4pt">Moyenne générale</div>
      <div style="margin-top:8pt;font-size:10pt">Crédits capitalisés : <strong>${bulletin.summary.earnedCredits}/${bulletin.summary.totalCredits}</strong></div>
      <div class="result-badge badge-pass" style="margin-top:10pt;font-size:12pt">✓ ADMIS(E)</div>
    </div>
    <div class="body-text">
      <p>Ce document atteste la réussite de l'étudiant(e) et est délivré pour servir et valoir ce que de droit.</p>
      <p>Fait à ${campus?.city ?? 'Antananarivo'}, le ${fmtDate()}</p>
    </div>
    ${signatureArea(issuer)}
    <div class="footer">Université Références — Document officiel — ${num}</div>
  `, num);
}

async function renderRecuPaiement(inputs, issuer) {
  const payment = await fetchPayment(inputs.paymentId, inputs.studentId);
  if (!payment) throw new HttpError(404, 'Aucun paiement validé trouvé pour cet étudiant');

  const sp      = await fetchStudent(payment.studentId);
  const { user, promotion, mention } = sp;
  const campus  = promotion?.academicYear?.campus;
  const num     = payment.receiptNumber ?? docNumber('REC');
  const amount  = new Intl.NumberFormat('fr-MG').format(payment.amount);
  const currency = payment.currency ?? 'MGA';

  return htmlDoc(`Reçu de paiement — ${user.firstName} ${user.lastName}`, `
    ${universityHeader(campus)}
    <div class="doc-title">REÇU DE PAIEMENT</div>
    <div class="doc-number">Reçu N° ${num}</div>
    <div class="info-block">
      <div class="info-row"><span class="info-label">Étudiant :</span><span class="info-value"><strong>${user.lastName.toUpperCase()} ${user.firstName}</strong></span></div>
      <div class="info-row"><span class="info-label">Matricule :</span><span class="info-value">${sp.matricule ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">Mention / Niveau :</span><span class="info-value">${mention?.name ?? '—'} — ${promotion?.level ?? '—'}</span></div>
    </div>
    <table style="margin-top:16pt">
      <thead><tr><th>Désignation</th><th style="text-align:right">Montant (${currency})</th></tr></thead>
      <tbody>
        <tr>
          <td>${payment.invoice?.title ?? payment.invoice?.feeStructure?.name ?? 'Frais universitaires'}</td>
          <td style="text-align:right;font-weight:bold">${amount} ${currency}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr style="background:#1a1a1a;color:#fff">
          <td style="font-weight:bold">TOTAL REÇU</td>
          <td style="text-align:right;font-weight:bold;font-size:13pt">${amount} ${currency}</td>
        </tr>
      </tfoot>
    </table>
    <div class="info-block" style="margin-top:16pt">
      <div class="info-row"><span class="info-label">Mode de paiement :</span><span class="info-value">${payment.method ?? 'CASH'}</span></div>
      <div class="info-row"><span class="info-label">Référence :</span><span class="info-value">${payment.reference ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">Date de paiement :</span><span class="info-value">${payment.paidAt ? fmtDate(payment.paidAt) : fmtDate()}</span></div>
      <div class="info-row"><span class="info-label">Enregistré par :</span><span class="info-value">${issuer}</span></div>
    </div>
    <div class="body-text" style="margin-top:16pt;font-size:10pt;color:#666;text-align:center">
      <p>Ce reçu est un document officiel. Conservez-le précieusement.</p>
    </div>
    ${signatureArea(issuer, true)}
    <div class="footer">Université Références — Service financier — ${num}</div>
  `, num);
}

async function renderAttestationService(inputs, issuer) {
  const tp      = await fetchTeacher(inputs.teacherId);
  const { user } = tp;
  const num     = docNumber('AS');

  return htmlDoc(`Attestation de service — ${user.firstName} ${user.lastName}`, `
    <div class="header">
      <div class="univ-name">UNIVERSITÉ RÉFÉRENCES</div>
      <div class="univ-subtitle">République de Madagascar</div>
    </div>
    <div class="doc-title">ATTESTATION DE SERVICE</div>
    <div class="doc-number">Réf. ${num}</div>
    <div class="body-text">
      <p>Je soussigné(e), <strong>${issuer}</strong>, certifie que :</p>
    </div>
    <div class="info-block">
      <div class="info-row"><span class="info-label">Nom et Prénom :</span><span class="info-value"><strong>${user.lastName.toUpperCase()} ${user.firstName}</strong></span></div>
      ${tp.employeeId ? `<div class="info-row"><span class="info-label">Numéro employé :</span><span class="info-value">${tp.employeeId}</span></div>` : ''}
      <div class="info-row"><span class="info-label">Spécialisation :</span><span class="info-value">${tp.specialization ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">Bureau :</span><span class="info-value">${tp.office ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">E-mail :</span><span class="info-value">${user.email}</span></div>
    </div>
    <div class="body-text">
      <p>est actuellement en service à l'Université Références en qualité d'<strong>Enseignant(e)</strong> pour l'année universitaire ${new Date().getFullYear()}-${new Date().getFullYear() + 1}.</p>
      <p>Cette attestation est délivrée à la demande de l'intéressé(e) pour servir et valoir ce que de droit.</p>
      <p>Fait à Antananarivo, le ${fmtDate()}</p>
    </div>
    ${signatureArea(issuer)}
    <div class="footer">Université Références — Ressources Humaines — ${num}</div>
  `, num);
}

async function renderCertificatTravail(inputs, issuer) {
  const tp      = await fetchTeacher(inputs.teacherId);
  const { user } = tp;
  const num     = docNumber('CT');

  return htmlDoc(`Certificat de travail — ${user.firstName} ${user.lastName}`, `
    <div class="header">
      <div class="univ-name">UNIVERSITÉ RÉFÉRENCES</div>
      <div class="univ-subtitle">République de Madagascar — Service des Ressources Humaines</div>
    </div>
    <div class="doc-title">CERTIFICAT DE TRAVAIL</div>
    <div class="doc-number">Réf. ${num}</div>
    <div class="body-text">
      <p>L'Université Références certifie que :</p>
    </div>
    <div class="info-block">
      <div class="info-row"><span class="info-label">Nom et Prénom :</span><span class="info-value"><strong>${user.lastName.toUpperCase()} ${user.firstName}</strong></span></div>
      ${tp.employeeId ? `<div class="info-row"><span class="info-label">Numéro employé :</span><span class="info-value">${tp.employeeId}</span></div>` : ''}
      <div class="info-row"><span class="info-label">Fonction :</span><span class="info-value">Enseignant(e)</span></div>
      <div class="info-row"><span class="info-label">Spécialisation :</span><span class="info-value">${tp.specialization ?? '—'}</span></div>
    </div>
    <div class="body-text">
      <p>a exercé ses fonctions au sein de l'Université Références. Ce document lui est délivré pour servir et valoir ce que de droit.</p>
      <p>Fait à Antananarivo, le ${fmtDate()}</p>
    </div>
    ${signatureArea(issuer)}
    <div class="footer">Université Références — Ressources Humaines — ${num}</div>
  `, num);
}

async function renderConvocation(inputs, issuer) {
  const sp      = await fetchStudent(inputs.studentId);
  const { user, promotion, mention } = sp;
  const campus  = promotion?.academicYear?.campus;
  const num     = docNumber('CONV');
  const subject = inputs.subject ?? 'Convocation';
  const date    = inputs.date ? fmtDateTime(inputs.date) : '—';
  const location = inputs.location ?? 'Secrétariat';

  return htmlDoc(`Convocation — ${user.firstName} ${user.lastName}`, `
    ${universityHeader(campus)}
    <div class="doc-title">CONVOCATION</div>
    <div class="doc-number">Réf. ${num}</div>
    <div style="margin:20pt 0">
      <p><strong>À :</strong> ${user.lastName.toUpperCase()} ${user.firstName}</p>
      <p><strong>Matricule :</strong> ${sp.matricule ?? '—'}</p>
      <p><strong>Mention :</strong> ${mention?.name ?? '—'} — ${promotion?.level ?? '—'}</p>
    </div>
    <div class="body-text">
      <p>Vous êtes convoqué(e) par la présente pour <strong>${subject}</strong>.</p>
    </div>
    <div class="info-block">
      <div class="info-row"><span class="info-label">Date et heure :</span><span class="info-value"><strong>${date}</strong></span></div>
      <div class="info-row"><span class="info-label">Lieu :</span><span class="info-value"><strong>${location}</strong></span></div>
      <div class="info-row"><span class="info-label">Objet :</span><span class="info-value">${subject}</span></div>
    </div>
    <div class="body-text">
      <p>Votre présence est <strong>obligatoire</strong>. En cas d'impossibilité, veuillez contacter le secrétariat dans les meilleurs délais.</p>
      <p>Fait à ${campus?.city ?? 'Antananarivo'}, le ${fmtDate()}</p>
    </div>
    ${signatureArea(issuer, false)}
    <div class="footer">Université Références — ${num}</div>
  `, num);
}

async function renderLettreOfficielle(inputs, issuer) {
  const num = docNumber('LO');
  return htmlDoc('Lettre officielle', `
    <div class="header">
      <div class="univ-name">UNIVERSITÉ RÉFÉRENCES</div>
      <div class="univ-subtitle">République de Madagascar</div>
    </div>
    <div style="text-align:right;margin:16pt 0;font-size:10pt">
      <div>Antananarivo, le ${fmtDate()}</div>
      <div style="margin-top:4pt">Réf. : ${num}</div>
    </div>
    <div style="margin-bottom:16pt">
      <div>À :</div>
      <div style="font-weight:bold;margin-top:4pt">${inputs.recipientName ?? '—'}</div>
    </div>
    <div style="margin-bottom:16pt">
      <div><strong>Objet :</strong> ${inputs.subject ?? '—'}</div>
    </div>
    <div class="body-text" style="white-space:pre-line">${inputs.body ?? ''}</div>
    <div style="margin-top:30pt">
      <p>Veuillez agréer, Madame/Monsieur, l'expression de nos salutations distinguées.</p>
    </div>
    ${signatureArea(issuer, true)}
    <div class="footer">Université Références — Courrier officiel — ${num}</div>
  `, num);
}

// ─── Main generate function ───────────────────────────────────────────────────

export async function generate(templateId, inputs, generatedBy) {
  const issuer = generatedBy
    ? `${generatedBy.firstName} ${generatedBy.lastName}`
    : 'L\'Administration';

  switch (templateId) {
    case 'carte-etudiant':          return renderCarteEtudiant(inputs);
    case 'certificat-scolarite':    return renderCertificatScolarite(inputs, issuer);
    case 'attestation-inscription': return renderAttestationInscription(inputs, issuer);
    case 'attestation-frequentation': return renderAttestationFrequentation(inputs, issuer);
    case 'releve-notes':            return renderReleveNotes(inputs, issuer);
    case 'bulletin':                return renderBulletin(inputs, issuer);
    case 'attestation-reussite':    return renderAttestationReussite(inputs, issuer);
    case 'recu-paiement':           return renderRecuPaiement(inputs, issuer);
    case 'attestation-service':     return renderAttestationService(inputs, issuer);
    case 'certificat-travail':      return renderCertificatTravail(inputs, issuer);
    case 'convocation':             return renderConvocation(inputs, issuer);
    case 'lettre-officielle':       return renderLettreOfficielle(inputs, issuer);
    default:
      throw new HttpError(404, `Modèle de document inconnu : ${templateId}`);
  }
}
