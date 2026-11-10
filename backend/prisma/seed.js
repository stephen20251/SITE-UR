// ═══════════════════════════════════════════════════════════════
//  SEED — Université Références ERP  (ESM)
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()
const ROUNDS = 10
const DEFAULT_PASSWORD = 'Password123!'

const hash = (p) => bcrypt.hash(p, ROUNDS)

async function main() {
  console.log('🌱 Seeding ERP Université Références...\n')

  // ── Permissions ──────────────────────────────────────────────
  const perms = [
    { code: 'MANAGE_CAMPUS',       label: 'Gérer les campus',                module: 'STRUCTURE' },
    { code: 'MANAGE_FACULTY',      label: 'Gérer les facultés',              module: 'STRUCTURE' },
    { code: 'MANAGE_DEPARTMENT',   label: 'Gérer les départements',          module: 'STRUCTURE' },
    { code: 'MANAGE_MENTION',      label: 'Gérer les mentions',              module: 'STRUCTURE' },
    { code: 'MANAGE_ACADEMIC_YEAR',label: 'Gérer les années universitaires', module: 'STRUCTURE' },
    { code: 'MANAGE_SEMESTER',     label: 'Gérer les semestres',             module: 'STRUCTURE' },
    { code: 'MANAGE_ROOM',         label: 'Gérer les salles',                module: 'STRUCTURE' },
    { code: 'CREATE_USER',         label: 'Créer un utilisateur',            module: 'USERS' },
    { code: 'EDIT_USER',           label: 'Modifier un utilisateur',         module: 'USERS' },
    { code: 'DELETE_USER',         label: 'Supprimer un utilisateur',        module: 'USERS' },
    { code: 'BLOCK_USER',          label: 'Bloquer / Réactiver',             module: 'USERS' },
    { code: 'RESET_PASSWORD',      label: 'Réinitialiser mot de passe',      module: 'USERS' },
    { code: 'ASSIGN_ROLE',         label: 'Attribuer un rôle',               module: 'USERS' },
    { code: 'VIEW_ALL_USERS',      label: 'Voir tous les utilisateurs',      module: 'USERS' },
    { code: 'CREATE_COURSE',       label: 'Créer un cours',                  module: 'COURSES' },
    { code: 'EDIT_COURSE',         label: 'Modifier un cours',               module: 'COURSES' },
    { code: 'DELETE_COURSE',       label: 'Supprimer un cours',              module: 'COURSES' },
    { code: 'PUBLISH_COURSE',      label: 'Publier un cours',                module: 'COURSES' },
    { code: 'APPROVE_COURSE',      label: 'Valider un cours',                module: 'COURSES' },
    { code: 'ASSIGN_TEACHER',      label: 'Affecter un enseignant',          module: 'COURSES' },
    { code: 'VIEW_COURSES',        label: 'Voir les cours',                  module: 'COURSES' },
    { code: 'CREATE_SUBJECT',      label: 'Créer une matière',               module: 'PEDAGOGY' },
    { code: 'MANAGE_PROMOTION',    label: 'Gérer les promotions',            module: 'PEDAGOGY' },
    { code: 'MANAGE_TIMETABLE',    label: 'Gérer les emplois du temps',      module: 'PEDAGOGY' },
    { code: 'CREATE_EXAM',         label: 'Créer des examens',               module: 'PEDAGOGY' },
    { code: 'VALIDATE_GRADES',     label: 'Valider les notes',               module: 'PEDAGOGY' },
    { code: 'PUBLISH_BULLETIN',    label: 'Publier les bulletins',           module: 'PEDAGOGY' },
    { code: 'VIEW_STATISTICS',     label: 'Voir les statistiques',           module: 'PEDAGOGY' },
    { code: 'ENTER_GRADES',        label: 'Saisir les notes',                module: 'GRADES' },
    { code: 'TAKE_ATTENDANCE',     label: "Faire l'appel",                   module: 'GRADES' },
    { code: 'CREATE_QUIZ',         label: 'Créer des quiz',                  module: 'GRADES' },
    { code: 'CREATE_ASSIGNMENT',   label: 'Créer des devoirs',               module: 'GRADES' },
    { code: 'GRADE_SUBMISSION',    label: 'Corriger les copies',             module: 'GRADES' },
    { code: 'VIEW_CANDIDATES',     label: 'Voir les candidatures',           module: 'ADMISSIONS' },
    { code: 'REVIEW_CANDIDATE',    label: 'Examiner un dossier',             module: 'ADMISSIONS' },
    { code: 'ACCEPT_CANDIDATE',    label: 'Accepter / Refuser',              module: 'ADMISSIONS' },
    { code: 'ENROLL_STUDENT',      label: 'Inscrire un étudiant',            module: 'ADMISSIONS' },
    { code: 'GENERATE_MATRICULE',  label: 'Générer un matricule',            module: 'ADMISSIONS' },
    { code: 'ISSUE_CERTIFICATE',   label: 'Délivrer une attestation',        module: 'ADMISSIONS' },
    { code: 'CREATE_FEE',          label: 'Créer des frais',                 module: 'FINANCE' },
    { code: 'CREATE_INVOICE',      label: 'Créer des factures',              module: 'FINANCE' },
    { code: 'RECORD_PAYMENT',      label: 'Enregistrer un paiement',         module: 'FINANCE' },
    { code: 'VALIDATE_PAYMENT',    label: 'Valider un paiement',             module: 'FINANCE' },
    { code: 'CANCEL_PAYMENT',      label: 'Annuler un paiement',             module: 'FINANCE' },
    { code: 'VIEW_FINANCE',        label: 'Voir les finances',               module: 'FINANCE' },
    { code: 'EXPORT_FINANCE',      label: 'Exporter les rapports financiers',module: 'FINANCE' },
    { code: 'GENERATE_REPORT',     label: 'Générer des rapports',            module: 'REPORTS' },
    { code: 'EXPORT_PDF',          label: 'Exporter PDF',                    module: 'REPORTS' },
    { code: 'EXPORT_EXCEL',        label: 'Exporter Excel',                  module: 'REPORTS' },
    { code: 'MANAGE_CURRICULUM',   label: 'Créer / modifier le cursus universitaire', module: 'CURSUS' },
    { code: 'SUPERVISE_COURSES',   label: 'Superviser le déroulement des cours',      module: 'CURSUS' },
    { code: 'VALIDATE_LEVEL_PASSAGE', label: 'Valider le passage au niveau supérieur', module: 'CURSUS' },
    { code: 'TRACK_COURSES',       label: 'Suivi des séances et du syllabus',          module: 'CURSUS' },
    { code: 'MANAGE_TUITION',      label: "Gérer l'écolage mensuel",                   module: 'FINANCE' },
    { code: 'MANAGE_HR',           label: 'Gérer le personnel et les salaires',        module: 'HR' },
  ]

  for (const p of perms) {
    await prisma.permission.upsert({ where: { code: p.code }, update: {}, create: p })
  }
  console.log(`✅ ${perms.length} permissions`)

  // ── Rôles ─────────────────────────────────────────────────────
  const RESPONSABLE_PERMS = ['CREATE_COURSE','EDIT_COURSE','DELETE_COURSE','PUBLISH_COURSE','APPROVE_COURSE',
    'ASSIGN_TEACHER','VIEW_COURSES','MANAGE_TIMETABLE','CREATE_EXAM','VIEW_STATISTICS','CREATE_SUBJECT',
    'VALIDATE_GRADES','PUBLISH_BULLETIN','GENERATE_REPORT','EXPORT_PDF','EXPORT_EXCEL','MANAGE_PROMOTION',
    'MANAGE_CURRICULUM','SUPERVISE_COURSES','VALIDATE_LEVEL_PASSAGE']
  const rolesDef = [
    { name: 'Super Administrateur', description: 'Accès complet', isSystem: true, color: '#DC2626',
      perms: perms.map(p => p.code) },
    // Chef de Mention + Responsable Pédagogique fusionnés : un Responsable par mention.
    { name: 'Responsable Info', description: 'Responsable de la mention Informatique', color: '#7C3AED',
      perms: RESPONSABLE_PERMS },
    { name: 'Responsable Gestion', description: 'Responsable de la mention Gestion', color: '#2563EB',
      perms: RESPONSABLE_PERMS },
    { name: 'Responsable Présence', description: 'Appel et suivi des séances', color: '#0D9488',
      perms: ['TAKE_ATTENDANCE','TRACK_COURSES','SUPERVISE_COURSES'] },
    { name: 'Secrétaire / Admissions', description: 'Admissions et dossiers', color: '#059669',
      perms: ['VIEW_CANDIDATES','REVIEW_CANDIDATE','ACCEPT_CANDIDATE','ENROLL_STUDENT',
              'GENERATE_MATRICULE','ISSUE_CERTIFICATE','EXPORT_PDF','EXPORT_EXCEL',
              'VIEW_ALL_USERS','CREATE_USER','EDIT_USER',
              'TAKE_ATTENDANCE','TRACK_COURSES','SUPERVISE_COURSES'] },
    { name: 'Comptabilité / Finance', description: 'Gestion financière', color: '#D97706',
      perms: ['CREATE_FEE','CREATE_INVOICE','RECORD_PAYMENT','VALIDATE_PAYMENT',
              'CANCEL_PAYMENT','VIEW_FINANCE','EXPORT_FINANCE','EXPORT_PDF','EXPORT_EXCEL',
              'GENERATE_REPORT','MANAGE_TUITION','MANAGE_HR'] },
    { name: 'Enseignant', description: 'Gestion des cours attribués', color: '#0891B2',
      perms: ['VIEW_COURSES','ENTER_GRADES','TAKE_ATTENDANCE','CREATE_QUIZ',
              'CREATE_ASSIGNMENT','GRADE_SUBMISSION'] },
  ]

  const roleMap = {}
  for (const r of rolesDef) {
    const { perms: rPerms, ...data } = r
    const role = await prisma.role.upsert({ where: { name: r.name }, update: { color: r.color }, create: data })
    roleMap[r.name] = role.id
    const permRecs = await prisma.permission.findMany({ where: { code: { in: rPerms } } })
    for (const perm of permRecs) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {}, create: { roleId: role.id, permissionId: perm.id },
      })
    }
  }
  console.log(`✅ ${rolesDef.length} rôles avec permissions`)

  // ── Campus ────────────────────────────────────────────────────
  const campus = await prisma.campus.upsert({
    where: { code: 'UR-TANA' }, update: {},
    create: {
      name: 'Université Références — Antananarivo', code: 'UR-TANA',
      address: 'Lot II M 85 Antanimena', city: 'Antananarivo',
      phone: '+261 20 22 XXX XX', email: 'contact@ur.mg',
    },
  })

  // Rooms
  for (const r of [
    { code: 'AMPHI-A', name: 'Amphithéâtre A', type: 'AMPHITHEATER', capacity: 200 },
    { code: 'AMPHI-B', name: 'Amphithéâtre B', type: 'AMPHITHEATER', capacity: 150 },
    { code: 'SALLE-101', name: 'Salle 101', type: 'CLASSROOM', capacity: 40 },
    { code: 'SALLE-102', name: 'Salle 102', type: 'CLASSROOM', capacity: 40 },
    { code: 'LABO-INFO-1', name: 'Labo Informatique 1', type: 'LAB', capacity: 30 },
    { code: 'LABO-INFO-2', name: 'Labo Informatique 2', type: 'LAB', capacity: 30 },
  ]) {
    await prisma.room.upsert({ where: { code: r.code }, update: {}, create: { ...r, campusId: campus.id } })
  }
  console.log(`✅ Campus + 6 salles`)

  // ── Structure universitaire ───────────────────────────────────
  const facST  = await prisma.faculty.upsert({ where: { code: 'FAC-ST' },  update: {}, create: { campusId: campus.id, name: 'Sciences de l’Ingénieur', code: 'FAC-ST' } })
  const facSEG = await prisma.faculty.upsert({ where: { code: 'FAC-SEG' }, update: {}, create: { campusId: campus.id, name: 'Sciences de la Société', code: 'FAC-SEG' } })
  const facLL  = await prisma.faculty.upsert({ where: { code: 'FAC-LL' },  update: {}, create: { campusId: campus.id, name: 'Formation pratique et professionnelle', code: 'FAC-LL' } })

  const deptInfo = await prisma.department.upsert({ where: { code: 'DEPT-INFO' }, update: {}, create: { facultyId: facST.id,  name: 'Département Informatique', code: 'DEPT-INFO' } })
  const deptGest = await prisma.department.upsert({ where: { code: 'DEPT-GEST' }, update: {}, create: { facultyId: facSEG.id, name: 'Département Gestion', code: 'DEPT-GEST' } })
  const deptAngl = await prisma.department.upsert({ where: { code: 'DEPT-ANGL' }, update: {}, create: { facultyId: facLL.id,  name: 'Département Anglais', code: 'DEPT-ANGL' } })

  const mInfo = await prisma.mention.upsert({ where: { code: 'M-INFO' }, update: {}, create: { departmentId: deptInfo.id, name: 'Informatique', code: 'M-INFO', level: 'Licence', duration: 3, description: 'Formation en informatique et développement logiciel' } })
  const mGest = await prisma.mention.upsert({ where: { code: 'M-GEST' }, update: {}, create: { departmentId: deptGest.id, name: 'Gestion',       code: 'M-GEST', level: 'Licence', duration: 3 } })
  const mAngl = await prisma.mention.upsert({ where: { code: 'M-ANGL' }, update: {}, create: { departmentId: deptAngl.id, name: 'Anglais',       code: 'M-ANGL', level: 'Licence', duration: 3 } })

  const pDevWeb  = await prisma.parcours.upsert({ where: { code: 'P-DEV-WEB' },  update: {}, create: { mentionId: mInfo.id, name: 'Développement Web & Mobile', code: 'P-DEV-WEB' } })
  const pReseaux = await prisma.parcours.upsert({ where: { code: 'P-RESEAUX' },  update: {}, create: { mentionId: mInfo.id, name: 'Réseaux & Systèmes',           code: 'P-RESEAUX' } })
  console.log(`✅ 3 facultés · 3 départements · 3 mentions · 2 parcours`)

  // ── Année universitaire ───────────────────────────────────────
  const year = await prisma.academicYear.upsert({
    where: { id: 'ay-2024-2025' }, update: { isCurrent: true },
    create: { id: 'ay-2024-2025', campusId: campus.id, label: '2024-2025', startDate: new Date('2024-10-01'), endDate: new Date('2025-06-30'), isCurrent: true },
  })
  const semS1 = await prisma.semester.upsert({
    where: { id: 'sem-s1-2024' }, update: {},
    create: { id: 'sem-s1-2024', academicYearId: year.id, name: 'S1', number: 1, startDate: new Date('2024-10-01'), endDate: new Date('2025-01-31') },
  })
  const semS2 = await prisma.semester.upsert({
    where: { id: 'sem-s2-2025' }, update: {},
    create: { id: 'sem-s2-2025', academicYearId: year.id, name: 'S2', number: 2, startDate: new Date('2025-02-01'), endDate: new Date('2025-06-30'), isActive: true },
  })
  console.log(`✅ Année 2024-2025 · S1 · S2`)

  // ── UE + Matières ─────────────────────────────────────────────
  const ue1 = await prisma.teachingUnit.create({ data: { semesterId: semS1.id, mentionId: mInfo.id, code: 'UE1-INFO-S1', name: 'Fondamentaux Informatique', credits: 6 } }).catch(async () => await prisma.teachingUnit.findFirst({ where: { code: 'UE1-INFO-S1' } }))

  for (const s of [
    { mentionId: mInfo.id, teachingUnitId: ue1.id, code: 'INF101', name: 'Algorithmique',     credits: 3, weeklyHours: 3 },
    { mentionId: mInfo.id, teachingUnitId: ue1.id, code: 'INF102', name: 'Programmation Web', credits: 3, weeklyHours: 3 },
    { mentionId: mInfo.id, code: 'INF201', name: 'Base de Données',       credits: 3, weeklyHours: 2 },
    { mentionId: mInfo.id, code: 'INF202', name: 'Développement Mobile',  credits: 3, weeklyHours: 2 },
    { mentionId: mGest.id, code: 'GES101', name: 'Comptabilité Générale', credits: 3, weeklyHours: 3 },
    { mentionId: mGest.id, code: 'GES102', name: 'Management',           credits: 3, weeklyHours: 2 },
    { mentionId: mAngl.id, code: 'ANG101', name: 'Anglais des Affaires', credits: 3, weeklyHours: 3 },
  ]) {
    await prisma.subject.upsert({ where: { code: s.code }, update: {}, create: s })
  }
  console.log(`✅ 1 UE · 7 matières`)

  // ── Promotions + groupes ──────────────────────────────────────
  const promoL1Info = await prisma.promotion.upsert({
    where: { id: 'promo-l1-info-2024' }, update: {},
    create: { id: 'promo-l1-info-2024', mentionId: mInfo.id, parcoursId: pDevWeb.id, academicYearId: year.id, name: 'L1 Informatique 2024-2025', level: 'L1', maxCapacity: 60 },
  })
  const promoL2Info = await prisma.promotion.upsert({
    where: { id: 'promo-l2-info-2024' }, update: {},
    create: { id: 'promo-l2-info-2024', mentionId: mInfo.id, parcoursId: pDevWeb.id, academicYearId: year.id, name: 'L2 Informatique 2024-2025', level: 'L2', maxCapacity: 50 },
  })
  const promoL3Info = await prisma.promotion.upsert({
    where: { id: 'promo-l3-info-2024' }, update: {},
    create: { id: 'promo-l3-info-2024', mentionId: mInfo.id, parcoursId: pReseaux.id, academicYearId: year.id, name: 'L3 Informatique 2024-2025', level: 'L3', maxCapacity: 40 },
  })
  const promoL1Gest = await prisma.promotion.upsert({
    where: { id: 'promo-l1-gest-2024' }, update: {},
    create: { id: 'promo-l1-gest-2024', mentionId: mGest.id, academicYearId: year.id, name: 'L1 Gestion 2024-2025', level: 'L1', maxCapacity: 50 },
  })
  const promoL2Gest = await prisma.promotion.upsert({
    where: { id: 'promo-l2-gest-2024' }, update: {},
    create: { id: 'promo-l2-gest-2024', mentionId: mGest.id, academicYearId: year.id, name: 'L2 Gestion 2024-2025', level: 'L2', maxCapacity: 40 },
  })
  const promoL1Angl = await prisma.promotion.upsert({
    where: { id: 'promo-l1-angl-2024' }, update: {},
    create: { id: 'promo-l1-angl-2024', mentionId: mAngl.id, academicYearId: year.id, name: 'L1 Anglais 2024-2025', level: 'L1', maxCapacity: 35 },
  })

  // Groupes L1 Info
  const grpA = await prisma.group.upsert({ where: { id: 'grp-l1-info-a' }, update: {}, create: { id: 'grp-l1-info-a', promotionId: promoL1Info.id, name: 'Groupe A', type: 'TD', maxCapacity: 30 } })
  const grpB = await prisma.group.upsert({ where: { id: 'grp-l1-info-b' }, update: {}, create: { id: 'grp-l1-info-b', promotionId: promoL1Info.id, name: 'Groupe B', type: 'TD', maxCapacity: 30 } })
  // Groupes L2 Info
  const grpL2A = await prisma.group.upsert({ where: { id: 'grp-l2-info-a' }, update: {}, create: { id: 'grp-l2-info-a', promotionId: promoL2Info.id, name: 'Groupe A', type: 'TD', maxCapacity: 25 } })
  const grpL2B = await prisma.group.upsert({ where: { id: 'grp-l2-info-b' }, update: {}, create: { id: 'grp-l2-info-b', promotionId: promoL2Info.id, name: 'Groupe B', type: 'TD', maxCapacity: 25 } })
  // Groupes L1 Gestion
  const grpGestA = await prisma.group.upsert({ where: { id: 'grp-l1-gest-a' }, update: {}, create: { id: 'grp-l1-gest-a', promotionId: promoL1Gest.id, name: 'Groupe A', type: 'TD', maxCapacity: 25 } })
  const grpGestB = await prisma.group.upsert({ where: { id: 'grp-l1-gest-b' }, update: {}, create: { id: 'grp-l1-gest-b', promotionId: promoL1Gest.id, name: 'Groupe B', type: 'TD', maxCapacity: 25 } })
  // Groupes L1 Anglais
  const grpAnglA = await prisma.group.upsert({ where: { id: 'grp-l1-angl-a' }, update: {}, create: { id: 'grp-l1-angl-a', promotionId: promoL1Angl.id, name: 'Groupe A', type: 'TD', maxCapacity: 35 } })
  console.log(`✅ 6 promotions · 7 groupes`)

  // ── Utilisateurs ──────────────────────────────────────────────
  const pw = await hash(DEFAULT_PASSWORD)

  async function upsertUserRole(userId, roleName, scope = {}) {
    const data = {
      userId, roleId: roleMap[roleName],
      mentionId: scope.mentionId ?? null,
      facultyId: scope.facultyId ?? null,
      departmentId: scope.departmentId ?? null,
      campusId: scope.campusId ?? null,
    }
    const existing = await prisma.userRole.findFirst({ where: data })
    if (!existing) await prisma.userRole.create({ data })
  }

  // ── Super Admin ──────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ur.mg' }, update: {},
    create: { email: 'admin@ur.mg', passwordHash: pw, firstName: 'Jean', lastName: 'RAKOTO',
      systemRole: 'SUPER_ADMIN', isActive: true, emailVerified: true,
      staffProfile: { create: { employeeId: 'EMP-001', departmentId: deptInfo.id, office: 'Direction Générale' } } },
  })
  await upsertUserRole(admin.id, 'Super Administrateur', { campusId: campus.id })

  // ── Chef de Mention Informatique ──────────────────────────────
  const chefInfo = await prisma.user.upsert({
    where: { email: 'chef.info@ur.mg' }, update: {},
    create: { email: 'chef.info@ur.mg', passwordHash: pw, firstName: 'Marie', lastName: 'RAZAFY',
      systemRole: 'STAFF', isActive: true, emailVerified: true,
      staffProfile: { create: { employeeId: 'EMP-002', departmentId: deptInfo.id, office: 'Bâtiment A, Bureau 12' } } },
  })
  await upsertUserRole(chefInfo.id, 'Responsable Info', { mentionId: mInfo.id })

  // ── Chef de Mention Gestion ───────────────────────────────────
  const chefGest = await prisma.user.upsert({
    where: { email: 'chef.gestion@ur.mg' }, update: {},
    create: { email: 'chef.gestion@ur.mg', passwordHash: pw, firstName: 'Noro', lastName: 'RAKOTOBE',
      systemRole: 'STAFF', isActive: true, emailVerified: true,
      staffProfile: { create: { employeeId: 'EMP-006', departmentId: deptGest.id, office: 'Bâtiment B, Bureau 5' } } },
  })
  await upsertUserRole(chefGest.id, 'Responsable Gestion', { mentionId: mGest.id })

  // ── Responsable Pédagogique ───────────────────────────────────
  const respPeda = await prisma.user.upsert({
    where: { email: 'resp.peda@ur.mg' }, update: {},
    create: { email: 'resp.peda@ur.mg', passwordHash: pw, firstName: 'Paul', lastName: 'RANDRIA',
      systemRole: 'STAFF', isActive: true, emailVerified: true,
      staffProfile: { create: { employeeId: 'EMP-003', departmentId: deptInfo.id, office: 'Bâtiment A, Bureau 10' } } },
  })
  await upsertUserRole(respPeda.id, 'Responsable Info', { mentionId: mInfo.id })

  // ── Secrétaire ────────────────────────────────────────────────
  const secretaire = await prisma.user.upsert({
    where: { email: 'secretaire@ur.mg' }, update: {},
    create: { email: 'secretaire@ur.mg', passwordHash: pw, firstName: 'Sophie', lastName: 'RAMIANDRISOA',
      systemRole: 'STAFF', isActive: true, emailVerified: true,
      staffProfile: { create: { employeeId: 'EMP-004', departmentId: deptInfo.id, office: 'Accueil — RDC' } } },
  })
  await upsertUserRole(secretaire.id, 'Secrétaire / Admissions', { campusId: campus.id })

  // ── Comptable ─────────────────────────────────────────────────
  const comptable = await prisma.user.upsert({
    where: { email: 'finance@ur.mg' }, update: {},
    create: { email: 'finance@ur.mg', passwordHash: pw, firstName: 'Hery', lastName: 'RAKOTONDRABE',
      systemRole: 'STAFF', isActive: true, emailVerified: true,
      staffProfile: { create: { employeeId: 'EMP-005', departmentId: deptInfo.id, office: 'Comptabilité — 1er étage' } } },
  })
  await upsertUserRole(comptable.id, 'Comptabilité / Finance', { campusId: campus.id })

  // ── Enseignant 1 — Dev Web (Informatique) ─────────────────────
  const teacher1 = await prisma.user.upsert({
    where: { email: 'prof.andriamananjara@ur.mg' }, update: {},
    create: { email: 'prof.andriamananjara@ur.mg', passwordHash: pw,
      firstName: 'Thierry', lastName: 'ANDRIAMANANJARA',
      systemRole: 'TEACHER', isActive: true, emailVerified: true,
      teacherProfile: { create: { employeeId: 'ENS-001', specialization: 'Développement Web & Mobile',
        bio: 'Docteur en informatique, 8 ans d\'expérience en développement web.', office: 'Labo Informatique 1',
        departmentId: deptInfo.id, mentionId: mInfo.id } } },
  })
  await upsertUserRole(teacher1.id, 'Enseignant', { mentionId: mInfo.id })

  // ── Enseignant 2 — Base de Données (Informatique) ─────────────
  const teacher2 = await prisma.user.upsert({
    where: { email: 'prof.rasoamahenina@ur.mg' }, update: {},
    create: { email: 'prof.rasoamahenina@ur.mg', passwordHash: pw,
      firstName: 'Lalao', lastName: 'RASOAMAHENINA',
      systemRole: 'TEACHER', isActive: true, emailVerified: true,
      teacherProfile: { create: { employeeId: 'ENS-002', specialization: 'Bases de Données & Systèmes',
        bio: 'Maître de conférences, spécialiste des SGBD relationnels et NoSQL.', office: 'Labo Informatique 2',
        departmentId: deptInfo.id, mentionId: mInfo.id } } },
  })
  await upsertUserRole(teacher2.id, 'Enseignant', { mentionId: mInfo.id })

  // ── Étudiant 1 — L1 Info, Groupe A ───────────────────────────
  const stu1 = await prisma.user.upsert({
    where: { email: 'etudiant.rakoto@ur.mg' }, update: {},
    create: { email: 'etudiant.rakoto@ur.mg', passwordHash: pw,
      firstName: 'Ny Aina', lastName: 'RAKOTO',
      systemRole: 'STUDENT', isActive: true, emailVerified: true,
      studentProfile: { create: { matricule: 'UR-2024-INFO-001',
        promotionId: promoL1Info.id, groupId: grpA.id, mentionId: mInfo.id,
        status: 'ACTIVE', enrollmentDate: new Date('2024-10-01'), scholarship: false } } },
  })

  // ── Étudiant 2 — L1 Info, Groupe A ───────────────────────────
  const stu2 = await prisma.user.upsert({
    where: { email: 'etudiant.rabe@ur.mg' }, update: {},
    create: { email: 'etudiant.rabe@ur.mg', passwordHash: pw,
      firstName: 'Fanja', lastName: 'RABE',
      systemRole: 'STUDENT', isActive: true, emailVerified: true,
      studentProfile: { create: { matricule: 'UR-2024-INFO-002',
        promotionId: promoL1Info.id, groupId: grpA.id, mentionId: mInfo.id,
        status: 'ACTIVE', enrollmentDate: new Date('2024-10-01'), scholarship: true } } },
  })

  // ── Étudiant 3 — L1 Gestion, Groupe A ───────────────────────────
  const stu3 = await prisma.user.upsert({
    where: { email: 'etudiant.raharison@ur.mg' }, update: {},
    create: { email: 'etudiant.raharison@ur.mg', passwordHash: pw,
      firstName: 'Soa', lastName: 'RAHARISON',
      systemRole: 'STUDENT', isActive: true, emailVerified: true,
      studentProfile: { create: { matricule: 'UR-2024-GEST-001',
        promotionId: promoL1Gest.id, groupId: grpGestA.id, mentionId: mGest.id,
        status: 'ACTIVE', enrollmentDate: new Date('2024-10-01'), scholarship: false } } },
  })

  // ── Étudiants supplémentaires — L1 Info Groupe A ─────────────
  const extraStudentsInfoA = [
    { email: 'stu.andrianina@ur.mg',   fn: 'Andrianina', ln: 'RANDRIA',      mat: 'UR-2024-INFO-003', grp: grpA },
    { email: 'stu.hery@ur.mg',         fn: 'Hery',        ln: 'RAKOTONDRABE', mat: 'UR-2024-INFO-004', grp: grpA },
    { email: 'stu.vola@ur.mg',         fn: 'Vola',        ln: 'RAZAFINDRAKOTO', mat: 'UR-2024-INFO-005', grp: grpA },
    { email: 'stu.sitraka@ur.mg',      fn: 'Sitraka',     ln: 'ANDRIAMASIMANANA', mat: 'UR-2024-INFO-006', grp: grpA },
    { email: 'stu.mamy@ur.mg',         fn: 'Mamy',        ln: 'RASENDRAHASINA', mat: 'UR-2024-INFO-007', grp: grpA },
    { email: 'stu.tantely@ur.mg',      fn: 'Tantely',     ln: 'RANAIVO',     mat: 'UR-2024-INFO-008', grp: grpA },
  ]
  // L1 Info Groupe B
  const extraStudentsInfoB = [
    { email: 'stu.miora@ur.mg',        fn: 'Miora',       ln: 'RABEMANANJARA', mat: 'UR-2024-INFO-009', grp: grpB },
    { email: 'stu.lanto@ur.mg',        fn: 'Lanto',       ln: 'RAKOTONIRINA', mat: 'UR-2024-INFO-010', grp: grpB },
    { email: 'stu.kanto@ur.mg',        fn: 'Kanto',       ln: 'ANDRIANTSOA',  mat: 'UR-2024-INFO-011', grp: grpB },
    { email: 'stu.haingo@ur.mg',       fn: 'Haingo',      ln: 'RATSIMBA',     mat: 'UR-2024-INFO-012', grp: grpB },
    { email: 'stu.tsiry@ur.mg',        fn: 'Tsiry',       ln: 'RASOLOFONDRAIBE', mat: 'UR-2024-INFO-013', grp: grpB },
    { email: 'stu.noel@ur.mg',         fn: 'Noël',        ln: 'RANDRIAMIHAJA', mat: 'UR-2024-INFO-014', grp: grpB },
  ]
  // L2 Info Groupe A
  const extraStudentsL2A = [
    { email: 'stu.feno@ur.mg',         fn: 'Feno',        ln: 'RAMAROSON',    mat: 'UR-2023-INFO-001', grp: grpL2A },
    { email: 'stu.rado@ur.mg',         fn: 'Rado',        ln: 'ANDRIAMAROLAHY', mat: 'UR-2023-INFO-002', grp: grpL2A },
    { email: 'stu.nivo@ur.mg',         fn: 'Nivo',        ln: 'RANDRIANARIMANANA', mat: 'UR-2023-INFO-003', grp: grpL2A },
    { email: 'stu.zo@ur.mg',           fn: 'Zo',          ln: 'RAKOTONDRAZA', mat: 'UR-2023-INFO-004', grp: grpL2A },
    { email: 'stu.toky@ur.mg',         fn: 'Toky',        ln: 'RASOANINDRINA', mat: 'UR-2023-INFO-005', grp: grpL2A },
  ]
  // L2 Info Groupe B
  const extraStudentsL2B = [
    { email: 'stu.liva@ur.mg',         fn: 'Liva',        ln: 'RANDRIANIRINA', mat: 'UR-2023-INFO-006', grp: grpL2B },
    { email: 'stu.soa@ur.mg',          fn: 'Soa',         ln: 'RAKOTOBE',     mat: 'UR-2023-INFO-007', grp: grpL2B },
    { email: 'stu.tina@ur.mg',         fn: 'Tina',        ln: 'RASOANIRINA',  mat: 'UR-2023-INFO-008', grp: grpL2B },
    { email: 'stu.fidy@ur.mg',         fn: 'Fidy',        ln: 'ANDRIAMBOLOLONA', mat: 'UR-2023-INFO-009', grp: grpL2B },
  ]
  // L1 Gestion
  const extraStudentsGest = [
    { email: 'stu.vatosoa@ur.mg',      fn: 'Vatosoa',     ln: 'ANDRIANTSIMAHAZO', mat: 'UR-2024-GEST-002', grp: grpGestA },
    { email: 'stu.mireille@ur.mg',     fn: 'Mireille',    ln: 'RAMAROSON',    mat: 'UR-2024-GEST-003', grp: grpGestA },
    { email: 'stu.david@ur.mg',        fn: 'David',       ln: 'RANDRIANASOLO', mat: 'UR-2024-GEST-004', grp: grpGestA },
    { email: 'stu.lalaina@ur.mg',      fn: 'Lalaina',     ln: 'RAZAFIMANDIMBY', mat: 'UR-2024-GEST-005', grp: grpGestB },
    { email: 'stu.mihanta@ur.mg',      fn: 'Mihanta',     ln: 'RANDRIANJAKA', mat: 'UR-2024-GEST-006', grp: grpGestB },
    { email: 'stu.diana@ur.mg',        fn: 'Diana',       ln: 'RATSIFANDRIHAMANANA', mat: 'UR-2024-GEST-007', grp: grpGestB },
  ]
  // L1 Anglais
  const extraStudentsAngl = [
    { email: 'stu.lova@ur.mg',         fn: 'Lova',        ln: 'ANDRIANOMENA',  mat: 'UR-2024-ANGL-001', grp: grpAnglA },
    { email: 'stu.vonjy@ur.mg',        fn: 'Vonjy',       ln: 'RAJOELINORO',   mat: 'UR-2024-ANGL-002', grp: grpAnglA },
    { email: 'stu.perle@ur.mg',        fn: 'Perle',       ln: 'RABEHARIVONY',  mat: 'UR-2024-ANGL-003', grp: grpAnglA },
    { email: 'stu.aina@ur.mg',         fn: 'Aina',        ln: 'RAZAFINDRABE',  mat: 'UR-2024-ANGL-004', grp: grpAnglA },
  ]

  const allExtra = [...extraStudentsInfoA, ...extraStudentsInfoB, ...extraStudentsL2A, ...extraStudentsL2B, ...extraStudentsGest, ...extraStudentsAngl]
  let extraCount = 0
  for (const s of allExtra) {
    const promoId = s.grp.promotionId
    const promotion = [promoL1Info, promoL2Info, promoL3Info, promoL1Gest, promoL2Gest, promoL1Angl].find(p => p.id === promoId)
    const mentionId = promotion?.mentionId ?? mInfo.id
    await prisma.user.upsert({
      where: { email: s.email }, update: {},
      create: { email: s.email, passwordHash: pw,
        firstName: s.fn, lastName: s.ln,
        systemRole: 'STUDENT', isActive: true, emailVerified: true,
        studentProfile: { create: { matricule: s.mat,
          promotionId: promoId, groupId: s.grp.id, mentionId,
          status: 'ACTIVE', enrollmentDate: new Date('2024-10-01'), scholarship: false } } },
    }).catch(() => null)
    extraCount++
  }
  console.log(`✅ ${extraCount} étudiants supplémentaires créés`)

  // ── Parent 1 — Père de Ny Aina RAKOTO ────────────────────────
  const parent1 = await prisma.user.upsert({
    where: { email: 'parent.rakoto@gmail.com' }, update: {},
    create: { email: 'parent.rakoto@gmail.com', passwordHash: pw,
      firstName: 'Jean-Pierre', lastName: 'RAKOTO',
      systemRole: 'PARENT', isActive: true, emailVerified: true,
      parentProfile: { create: { relationship: 'Père', occupation: 'Ingénieur' } } },
  })

  // ── Parent 2 — Mère de Fanja RABE ────────────────────────────
  const parent2 = await prisma.user.upsert({
    where: { email: 'parent.rabe@gmail.com' }, update: {},
    create: { email: 'parent.rabe@gmail.com', passwordHash: pw,
      firstName: 'Voahary', lastName: 'RABE',
      systemRole: 'PARENT', isActive: true, emailVerified: true,
      parentProfile: { create: { relationship: 'Mère', occupation: 'Enseignante' } } },
  })

  // ── Candidat ──────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: 'candidat.demo@gmail.com' }, update: {},
    create: { email: 'candidat.demo@gmail.com', passwordHash: pw,
      firstName: 'Mika', lastName: 'ANDRIAMAHEFA',
      systemRole: 'CANDIDATE', isActive: true, emailVerified: false,
      candidateProfile: { create: { mentionId: mInfo.id, level: 'L1', status: 'SUBMITTED',
        submittedAt: new Date(), registrationFee: 50000, feeStatus: 'PAID' } } },
  })

  console.log(`✅ 13 utilisateurs créés`)

  // ── ParentLinks ───────────────────────────────────────────────
  const s1Profile  = await prisma.studentProfile.findUnique({ where: { userId: stu1.id } })
  const s2Profile  = await prisma.studentProfile.findUnique({ where: { userId: stu2.id } })
  const s3Profile  = await prisma.studentProfile.findUnique({ where: { userId: stu3.id } })
  const pp1        = await prisma.parentProfile.findUnique({ where: { userId: parent1.id } })
  const pp2        = await prisma.parentProfile.findUnique({ where: { userId: parent2.id } })

  if (s1Profile && pp1) {
    await prisma.parentLink.upsert({
      where: { parentId_studentId: { parentId: pp1.id, studentId: s1Profile.id } },
      update: {}, create: { parentId: pp1.id, studentId: s1Profile.id },
    })
  }
  if (s2Profile && pp2) {
    await prisma.parentLink.upsert({
      where: { parentId_studentId: { parentId: pp2.id, studentId: s2Profile.id } },
      update: {}, create: { parentId: pp2.id, studentId: s2Profile.id },
    })
  }
  console.log(`✅ ParentLinks créés`)

  // ── Finance ───────────────────────────────────────────────────
  const fee = await prisma.feeStructure.create({
    data: { promotionId: promoL1Info.id, academicYearId: year.id,
      name: 'Frais de scolarité S2 2025', amount: 750000, currency: 'MGA', dueDate: new Date('2025-03-01') },
  }).catch(() => null)

  const feeGest = await prisma.feeStructure.create({
    data: { promotionId: promoL1Gest.id, academicYearId: year.id,
      name: 'Frais de scolarité S2 2025 — Gestion', amount: 700000, currency: 'MGA', dueDate: new Date('2025-03-01') },
  }).catch(() => null)

  if (fee && s1Profile) {
    const inv = await prisma.invoice.upsert({
      where: { invoiceNumber: 'INV-2025-001' }, update: {},
      create: { studentId: s1Profile.id, feeStructureId: fee.id, invoiceNumber: 'INV-2025-001',
        title: 'Frais S2 2025 — Ny Aina RAKOTO', amount: 750000, currency: 'MGA',
        dueDate: new Date('2025-03-01'), status: 'PAID' },
    })
    await prisma.payment.create({
      data: { studentId: s1Profile.id, invoiceId: inv.id, amount: 750000, currency: 'MGA',
        method: 'MOBILE', receiptNumber: 'REC-2025-001', status: 'PAID',
        paidAt: new Date('2025-02-15'), recordedBy: comptable.id },
    }).catch(() => null)
  }
  if (fee && s2Profile) {
    await prisma.invoice.upsert({
      where: { invoiceNumber: 'INV-2025-002' }, update: {},
      create: { studentId: s2Profile.id, feeStructureId: fee.id, invoiceNumber: 'INV-2025-002',
        title: 'Frais S2 2025 — Fanja RABE', amount: 750000, currency: 'MGA',
        dueDate: new Date('2025-03-01'), status: 'PENDING' },
    }).catch(() => null)
  }
  if (feeGest && s3Profile) {
    await prisma.invoice.upsert({
      where: { invoiceNumber: 'INV-2025-003' }, update: {},
      create: { studentId: s3Profile.id, feeStructureId: feeGest.id, invoiceNumber: 'INV-2025-003',
        title: 'Frais S2 2025 — Soa RAHARISON', amount: 700000, currency: 'MGA',
        dueDate: new Date('2025-03-15'), status: 'OVERDUE' },
    }).catch(() => null)
  }
  console.log(`✅ Finance (frais + factures + paiement)`)

  // ── Cours + Chapitres ─────────────────────────────────────────
  const subWeb  = await prisma.subject.findUnique({ where: { code: 'INF102' } })
  const subAlgo = await prisma.subject.findUnique({ where: { code: 'INF101' } })
  const subBD   = await prisma.subject.findUnique({ where: { code: 'INF201' } })
  const subGes1 = await prisma.subject.findUnique({ where: { code: 'GES101' } })
  const t1p     = await prisma.teacherProfile.findUnique({ where: { userId: teacher1.id } })
  const t2p     = await prisma.teacherProfile.findUnique({ where: { userId: teacher2.id } })

  if (subWeb && t1p) {
    await prisma.course.create({
      data: {
        subjectId: subWeb.id, promotionId: promoL1Info.id,
        title: 'Programmation Web — L1 Info 2025',
        description: 'HTML · CSS · JavaScript · React · Node.js',
        status: 'PUBLISHED', createdBy: teacher1.id, approvedBy: chefInfo.id, approvedAt: new Date(),
        teachers: { create: { teacherId: t1p.id, isMain: true, assignedBy: chefInfo.id } },
        chapters: {
          create: [
            { title: 'Chapitre 1 — HTML & CSS', order: 1, isPublished: true,
              resources: { create: [
                { title: 'Introduction HTML', type: 'DOCUMENT', url: '/files/html-intro.pdf', order: 1, isPublished: true },
                { title: 'CSS Box Model (vidéo)', type: 'VIDEO', url: '/videos/css-box.mp4', duration: 1800, order: 2, isPublished: true },
              ]}},
            { title: 'Chapitre 2 — JavaScript ES6+', order: 2, isPublished: true,
              resources: { create: [
                { title: 'Variables & Types', type: 'DOCUMENT', url: '/files/js-vars.pdf', order: 1, isPublished: true },
                { title: 'Fonctions Arrow', type: 'VIDEO', url: '/videos/js-arrow.mp4', duration: 900, order: 2, isPublished: true },
              ]}},
          ],
        },
      },
    }).catch(() => null)
  }

  if (subBD && t2p) {
    await prisma.course.create({
      data: {
        subjectId: subBD.id, promotionId: promoL1Info.id,
        title: 'Base de Données — L1 Info 2025',
        description: 'SQL · PostgreSQL · Modélisation relationnelle',
        status: 'PUBLISHED', createdBy: teacher2.id, approvedBy: chefInfo.id, approvedAt: new Date(),
        teachers: { create: { teacherId: t2p.id, isMain: true, assignedBy: chefInfo.id } },
      },
    }).catch(() => null)
  }
  console.log(`✅ Cours créés`)

  // ── Emploi du temps (avec FK enseignant et matière) ───────────
  const room101  = await prisma.room.findUnique({ where: { code: 'SALLE-101' } })
  const amphi    = await prisma.room.findUnique({ where: { code: 'AMPHI-A' } })
  for (const e of [
    { day: 'MONDAY',    startTime: '08:00', endTime: '10:00', subjectName: 'Algorithmique',     subjectId: subAlgo?.id, teacherId: t1p?.id, teacherName: 'T. Andriamananjara', type: 'CM', color: '#7C3AED', roomId: amphi?.id },
    { day: 'MONDAY',    startTime: '10:00', endTime: '12:00', subjectName: 'Programmation Web', subjectId: subWeb?.id,  teacherId: t1p?.id, teacherName: 'T. Andriamananjara', type: 'CM', color: '#2563EB', roomId: amphi?.id },
    { day: 'TUESDAY',   startTime: '08:00', endTime: '10:00', subjectName: 'Base de Données',   subjectId: subBD?.id,   teacherId: t2p?.id, teacherName: 'L. Rasoamahenina',  type: 'CM', color: '#059669', roomId: amphi?.id },
    { day: 'WEDNESDAY', startTime: '08:00', endTime: '10:00', subjectName: 'Programmation Web', subjectId: subWeb?.id,  teacherId: t1p?.id, teacherName: 'T. Andriamananjara', type: 'TD', color: '#2563EB', roomId: room101?.id },
    { day: 'THURSDAY',  startTime: '14:00', endTime: '16:00', subjectName: 'Algorithmique',     subjectId: subAlgo?.id, teacherId: t1p?.id, teacherName: 'T. Andriamananjara', type: 'TD', color: '#7C3AED', roomId: room101?.id },
    { day: 'FRIDAY',    startTime: '08:00', endTime: '10:00', subjectName: 'Base de Données',   subjectId: subBD?.id,   teacherId: t2p?.id, teacherName: 'L. Rasoamahenina',  type: 'TP', color: '#059669', roomId: room101?.id },
  ]) {
    await prisma.timetableEntry.create({
      data: { ...e, semesterId: semS2.id, promotionId: promoL1Info.id },
    }).catch(() => null)
  }
  console.log(`✅ Emploi du temps (6 créneaux avec FK)`)

  // ── Notes (Étudiant 1) ────────────────────────────────────────
  if (s1Profile && subAlgo && subWeb && subBD && t1p && t2p) {
    const grades1 = [
      { studentId: s1Profile.id, subjectId: subAlgo.id, teacherId: t1p.id, semesterId: semS1.id, type: 'MIDTERM',    value: 14.5, maxValue: 20, coefficient: 1 },
      { studentId: s1Profile.id, subjectId: subAlgo.id, teacherId: t1p.id, semesterId: semS1.id, type: 'FINAL',      value: 16,   maxValue: 20, coefficient: 2 },
      { studentId: s1Profile.id, subjectId: subWeb.id,  teacherId: t1p.id, semesterId: semS1.id, type: 'CONTINUOUS', value: 17,   maxValue: 20, coefficient: 1 },
      { studentId: s1Profile.id, subjectId: subWeb.id,  teacherId: t1p.id, semesterId: semS1.id, type: 'FINAL',      value: 15,   maxValue: 20, coefficient: 2 },
      { studentId: s1Profile.id, subjectId: subBD.id,   teacherId: t2p.id, semesterId: semS1.id, type: 'MIDTERM',    value: 13,   maxValue: 20, coefficient: 1 },
      { studentId: s1Profile.id, subjectId: subBD.id,   teacherId: t2p.id, semesterId: semS1.id, type: 'FINAL',      value: 15.5, maxValue: 20, coefficient: 2 },
      // S2
      { studentId: s1Profile.id, subjectId: subAlgo.id, teacherId: t1p.id, semesterId: semS2.id, type: 'CONTINUOUS', value: 15,   maxValue: 20, coefficient: 1 },
      { studentId: s1Profile.id, subjectId: subWeb.id,  teacherId: t1p.id, semesterId: semS2.id, type: 'CONTINUOUS', value: 18,   maxValue: 20, coefficient: 1 },
    ]
    for (const g of grades1) {
      await prisma.grade.create({
        data: { ...g, isValidated: true, validatedBy: respPeda.id },
      }).catch(() => null)
    }
  }

  // ── Notes (Étudiant 2) ────────────────────────────────────────
  if (s2Profile && subAlgo && subWeb && t1p) {
    const grades2 = [
      { studentId: s2Profile.id, subjectId: subAlgo.id, teacherId: t1p.id, semesterId: semS1.id, type: 'MIDTERM',    value: 11, maxValue: 20, coefficient: 1 },
      { studentId: s2Profile.id, subjectId: subAlgo.id, teacherId: t1p.id, semesterId: semS1.id, type: 'FINAL',      value: 12, maxValue: 20, coefficient: 2 },
      { studentId: s2Profile.id, subjectId: subWeb.id,  teacherId: t1p.id, semesterId: semS1.id, type: 'CONTINUOUS', value: 14, maxValue: 20, coefficient: 1 },
      { studentId: s2Profile.id, subjectId: subWeb.id,  teacherId: t1p.id, semesterId: semS1.id, type: 'FINAL',      value: 13, maxValue: 20, coefficient: 2 },
    ]
    for (const g of grades2) {
      await prisma.grade.create({ data: { ...g, isValidated: true, validatedBy: respPeda.id } }).catch(() => null)
    }
  }

  // ── Notes (Étudiant 3 — Gestion) ─────────────────────────────
  if (s3Profile && subGes1) {
    await prisma.grade.create({
      data: { studentId: s3Profile.id, subjectId: subGes1.id, semesterId: semS1.id,
        type: 'FINAL', value: 14, maxValue: 20, coefficient: 1, isValidated: false },
    }).catch(() => null)
  }
  console.log(`✅ Notes créées (3 étudiants)`)

  // ── Présences (Étudiant 1, S2) ────────────────────────────────
  const attendanceDates = [
    new Date('2025-02-03'), new Date('2025-02-10'), new Date('2025-02-17'),
    new Date('2025-02-24'), new Date('2025-03-03'), new Date('2025-03-10'),
  ]
  if (s1Profile && subAlgo) {
    const statuses = ['PRESENT','PRESENT','PRESENT','LATE','PRESENT','ABSENT']
    for (let i = 0; i < attendanceDates.length; i++) {
      await prisma.attendance.create({
        data: { studentId: s1Profile.id, subjectId: subAlgo.id, semesterId: semS2.id,
          date: attendanceDates[i], status: statuses[i], teacherId: t1p?.id },
      }).catch(() => null)
    }
  }
  console.log(`✅ Présences créées`)

  // ── Annonces ──────────────────────────────────────────────────
  await prisma.announcement.create({
    data: { campusId: campus.id, authorId: admin.id, isPinned: true,
      title: 'Bienvenue — Année universitaire 2024-2025',
      content: 'Nous vous souhaitons la bienvenue. Les cours du S2 débutent le 3 février 2025. Bonne année universitaire à tous.' },
  }).catch(() => null)
  await prisma.announcement.create({
    data: { campusId: campus.id, authorId: chefInfo.id, category: 'ACADEMIC',
      title: 'Planning des examens S2 — Informatique',
      content: 'Les examens de fin de semestre S2 se tiendront du 9 au 20 juin 2025. Le planning détaillé sera affiché 3 semaines avant.' },
  }).catch(() => null)
  await prisma.announcement.create({
    data: { campusId: campus.id, authorId: secretaire.id, category: 'ADMINISTRATIVE',
      title: 'Renouvellement des cartes étudiantes',
      content: 'Les étudiants doivent se présenter au secrétariat avec une photo d\'identité pour renouveler leur carte étudiante avant le 15 mars 2025.' },
  }).catch(() => null)
  console.log(`✅ Annonces créées`)

  // ── Notifications ─────────────────────────────────────────────
  if (s1Profile) {
    await prisma.notification.create({
      data: { userId: stu1.id, title: 'Bienvenue, Ny Aina !', message: 'Votre compte étudiant est actif. Bonne rentrée universitaire 2024-2025.', type: 'INFO', isRead: false },
    }).catch(() => null)
    await prisma.notification.create({
      data: { userId: stu1.id, title: 'Note publiée — Algorithmique', message: 'Votre note de FINAL en Algorithmique a été validée : 16/20.', type: 'GRADE', isRead: false },
    }).catch(() => null)
  }
  await prisma.notification.create({
    data: { userId: admin.id, title: 'Candidature reçue', message: 'Un nouveau dossier de candidature a été soumis pour L1 Informatique.', type: 'INFO', isRead: false },
  }).catch(() => null)

  console.log(`✅ Notifications créées`)

  console.log(`
═══════════════════════════════════════════════════════════════
✅ SEED TERMINÉ — ERP Université Références
═══════════════════════════════════════════════════════════════

📋 Comptes de démonstration  (mot de passe: Password123!)

  ADMINISTRATION
    admin@ur.mg                     → Super Administrateur
    chef.info@ur.mg                 → Responsable Info
    chef.gestion@ur.mg              → Responsable Gestion
    resp.peda@ur.mg                 → Responsable Info
    secretaire@ur.mg                → Secrétaire / Admissions
    finance@ur.mg                   → Comptabilité / Finance

  ENSEIGNANTS
    prof.andriamananjara@ur.mg      → Dev Web & Algorithmique
    prof.rasoamahenina@ur.mg        → Base de Données

  ÉTUDIANTS
    etudiant.rakoto@ur.mg           → L1 Informatique (Groupe A)
    etudiant.rabe@ur.mg             → L1 Informatique (Groupe A)
    etudiant.raharison@ur.mg        → L1 Gestion

  PARENTS
    parent.rakoto@gmail.com         → Père de Ny Aina RAKOTO
    parent.rabe@gmail.com           → Mère de Fanja RABE

  CANDIDAT
    candidat.demo@gmail.com         → Candidat (dossier soumis)
`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
