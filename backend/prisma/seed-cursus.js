// ═══════════════════════════════════════════════════════════════
//  SEED — Cursus universitaire (ESM) — à lancer après seed.js
//  Idempotent : peut être relancé sans dupliquer les données.
//
//  • permissions + rôles (Responsable Info / Gestion, Responsable Présence)
//  • migration Chef de Mention / Responsable Pédagogique → Responsable <mention>
//  • tarifs d'écolage, plan du cursus L1 Informatique (8 mois)
//  • cours universitaires (mois 1 et 2) avec leçons, test étudiant, syllabus
//  • un cours « les deux » payant (attestation), emploi du temps L1 Info,
//    paiements d'écolage de démonstration, parts enseignants
// ═══════════════════════════════════════════════════════════════
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()
const PASSWORD = 'Password123!'

const NEW_PERMS = [
  { code: 'MANAGE_CURRICULUM',      label: 'Créer / modifier le cursus universitaire', module: 'CURSUS' },
  { code: 'SUPERVISE_COURSES',      label: 'Superviser le déroulement des cours',      module: 'CURSUS' },
  { code: 'VALIDATE_LEVEL_PASSAGE', label: 'Valider le passage au niveau supérieur',   module: 'CURSUS' },
  { code: 'TRACK_COURSES',          label: 'Suivi des séances et du syllabus',         module: 'CURSUS' },
  { code: 'MANAGE_TUITION',         label: "Gérer l'écolage mensuel",                  module: 'FINANCE' },
  { code: 'MANAGE_HR',              label: 'Gérer le personnel et les salaires',       module: 'HR' },
]

const RESPONSABLE_PERMS = ['CREATE_COURSE','EDIT_COURSE','DELETE_COURSE','PUBLISH_COURSE','APPROVE_COURSE',
  'ASSIGN_TEACHER','VIEW_COURSES','MANAGE_TIMETABLE','CREATE_EXAM','VIEW_STATISTICS','CREATE_SUBJECT',
  'VALIDATE_GRADES','PUBLISH_BULLETIN','GENERATE_REPORT','EXPORT_PDF','EXPORT_EXCEL','MANAGE_PROMOTION',
  'MANAGE_CURRICULUM','SUPERVISE_COURSES','VALIDATE_LEVEL_PASSAGE']

async function grant(roleName, codes, extra = {}) {
  const role = await prisma.role.upsert({
    where: { name: roleName },
    update: { ...(extra.color && { color: extra.color }), ...(extra.description && { description: extra.description }) },
    create: { name: roleName, description: extra.description ?? null, color: extra.color ?? null },
  })
  const perms = await prisma.permission.findMany({ where: { code: { in: codes } } })
  for (const p of perms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
      update: {}, create: { roleId: role.id, permissionId: p.id },
    })
  }
  return role
}

async function ensureUserRole(userId, roleId, scope = {}) {
  const data = { userId, roleId, mentionId: scope.mentionId ?? null, campusId: scope.campusId ?? null }
  const existing = await prisma.userRole.findFirst({ where: data })
  if (!existing) await prisma.userRole.create({ data })
}

const lesson = (title, body, minutes = 15) => ({ title, type: 'TEXT', body, duration: minutes * 60 })

async function upsertCourse(slug, data, modules, quizzes, syllabus) {
  const existing = await prisma.onlineCourse.findUnique({ where: { slug } })
  if (existing) return existing
  const course = await prisma.onlineCourse.create({
    data: {
      ...data, slug, status: 'PUBLISHED', publishedAt: new Date(), language: 'fr',
      modules: {
        create: modules.map((m, mi) => ({
          title: m.title, order: mi,
          lessons: { create: m.lessons.map((l, li) => ({ ...l, order: li, allowDownload: data.courseKind === 'CERTIFYING' })) },
        })),
      },
      syllabusItems: { create: syllabus.map((s, i) => ({ title: s[0], plannedHours: s[1], order: i })) },
    },
  })
  for (const q of quizzes) {
    await prisma.quiz.create({
      data: {
        courseId: course.id, title: q.title, audience: q.audience, passingScore: 60, isPublished: true,
        maxAttempts: 3, timeLimit: 15,
        questions: {
          create: q.questions.map((qq, i) => ({
            text: qq[0], type: 'MCQ_SINGLE', points: 1, order: i,
            options: { create: qq[1].map((o, oi) => ({ text: o, isCorrect: oi === qq[2] })) },
          })),
        },
      },
    })
  }
  return course
}

async function main() {
  console.log('🎓 Seeding cursus universitaire...\n')

  // ── Permissions & rôles ─────────────────────────────────────
  for (const p of NEW_PERMS) {
    await prisma.permission.upsert({ where: { code: p.code }, update: {}, create: p })
  }
  const mInfo = await prisma.mention.findUnique({ where: { code: 'M-INFO' } })
  const mGest = await prisma.mention.findUnique({ where: { code: 'M-GEST' } })
  if (!mInfo || !mGest) throw new Error('Lancez d\'abord prisma/seed.js')

  const respInfo = await grant('Responsable Info', RESPONSABLE_PERMS, { color: '#7C3AED', description: 'Responsable de la mention Informatique' })
  const respGest = await grant('Responsable Gestion', RESPONSABLE_PERMS, { color: '#2563EB', description: 'Responsable de la mention Gestion' })
  const respPres = await grant('Responsable Présence', ['TAKE_ATTENDANCE', 'TRACK_COURSES', 'SUPERVISE_COURSES'], { color: '#0D9488', description: 'Appel et suivi des séances' })
  await grant('Secrétaire / Admissions', ['TAKE_ATTENDANCE', 'TRACK_COURSES', 'SUPERVISE_COURSES'])
  await grant('Comptabilité / Finance', ['MANAGE_TUITION', 'MANAGE_HR'])
  await grant('Super Administrateur', NEW_PERMS.map((p) => p.code))

  // Migration : Chef de Mention + Responsable Pédagogique → Responsable <mention>
  for (const oldName of ['Chef de Mention', 'Responsable Pédagogique']) {
    const old = await prisma.role.findUnique({ where: { name: oldName }, include: { userRoles: true } })
    if (!old) continue
    for (const ur of old.userRoles) {
      const target = ur.mentionId === mGest.id ? respGest : respInfo
      await ensureUserRole(ur.userId, target.id, { mentionId: ur.mentionId ?? mInfo.id })
    }
    await prisma.userRole.deleteMany({ where: { roleId: old.id } })
    await prisma.role.delete({ where: { id: old.id } })
    console.log(`  ↪ rôle « ${oldName} » fusionné dans Responsable Info / Gestion`)
  }
  console.log('✅ Rôles : Responsable Info, Responsable Gestion, Responsable Présence')

  // ── Responsable Présence (compte de démo) ───────────────────
  const campus = await prisma.campus.findFirst({ where: { code: 'UR-TANA' } })
  const presence = await prisma.user.upsert({
    where: { email: 'presence@ur.mg' }, update: {},
    create: {
      email: 'presence@ur.mg', passwordHash: await bcrypt.hash(PASSWORD, 10),
      firstName: 'Lova', lastName: 'RAVELOJAONA', systemRole: 'STAFF', isActive: true, emailVerified: true,
      staffProfile: { create: { employeeId: 'EMP-PRES-01', office: 'Bureau des présences' } },
    },
  })
  await ensureUserRole(presence.id, respPres.id, { campusId: campus?.id })

  // ── Tarifs d'écolage mensuel ────────────────────────────────
  for (const [mention, level, amount] of [
    [mInfo, 'L1', 150000], [mInfo, 'L2', 160000], [mInfo, 'L3', 170000],
    [mGest, 'L1', 120000], [mGest, 'L2', 130000],
  ]) {
    await prisma.tuitionSetting.upsert({
      where: { mentionId_level: { mentionId: mention.id, level } },
      update: {}, create: { mentionId: mention.id, level, monthlyAmount: amount },
    })
  }
  console.log('✅ Tarifs d\'écolage (L1 Info : 150 000 MGA / mois)')

  // ── Acteurs ─────────────────────────────────────────────────
  const t1 = await prisma.user.findUnique({ where: { email: 'prof.andriamananjara@ur.mg' } })
  const t2 = await prisma.user.findUnique({ where: { email: 'prof.rasoamahenina@ur.mg' } })
  const chef = await prisma.user.findUnique({ where: { email: 'chef.info@ur.mg' } })
  const subAlgo = await prisma.subject.findUnique({ where: { code: 'INF101' } })
  const subWeb = await prisma.subject.findUnique({ where: { code: 'INF102' } })
  const subBD = await prisma.subject.findUnique({ where: { code: 'INF201' } })

  // ── Cours universitaires L1 Info : mois 1 et 2 ──────────────
  const base = { mentionId: mInfo.id, cursusLevel: 'L1', courseKind: 'UNIVERSITY', price: 0, hasCertificate: false }
  const studentTest = (title, questions) => ({ title, audience: 'STUDENT', questions })

  const algo1 = await upsertCourse('cursus-l1-algorithmique-1', {
    ...base, teacherId: t1.id, title: 'Algorithmique I — Bases', subjectId: subAlgo?.id, cursusMonth: 1, totalHours: 30,
    description: 'Variables, conditions, boucles et premiers algorithmes.',
  }, [
    { title: 'Premiers pas', lessons: [lesson('Qu\'est-ce qu\'un algorithme ?', 'Un algorithme est une suite finie d\'instructions permettant de résoudre un problème.'), lesson('Variables et types', 'Entiers, réels, chaînes, booléens.')] },
    { title: 'Structures de contrôle', lessons: [lesson('Conditions', 'SI … ALORS … SINON'), lesson('Boucles', 'POUR, TANT QUE, RÉPÉTER')] },
  ], [studentTest('Test — Algorithmique I', [
    ['Une boucle POUR est adaptée quand…', ['le nombre d\'itérations est connu', 'on ne sait pas quand s\'arrêter', 'on veut une condition'], 0],
    ['Un booléen vaut…', ['VRAI ou FAUX', 'un entier', 'une chaîne'], 0],
  ])], [['Introduction à l\'algorithmique', 4], ['Variables et types', 4], ['Conditions', 6], ['Boucles', 8], ['Exercices de synthèse', 8]])

  const web1 = await upsertCourse('cursus-l1-web-1', {
    ...base, teacherId: t1.id, title: 'Programmation Web I — HTML & CSS', subjectId: subWeb?.id, cursusMonth: 1, totalHours: 30,
    description: 'Structure d\'une page web et mise en forme.',
  }, [
    { title: 'HTML', lessons: [lesson('Balises essentielles', 'html, head, body, h1, p, a, img'), lesson('Formulaires', 'form, input, label, button')] },
    { title: 'CSS', lessons: [lesson('Sélecteurs', 'Sélecteurs de type, classe, id'), lesson('Flexbox', 'display:flex, justify-content, align-items')] },
  ], [studentTest('Test — HTML & CSS', [
    ['Quelle balise crée un lien ?', ['<a>', '<link>', '<href>'], 0],
    ['Flexbox s\'active avec…', ['display: flex', 'position: flex', 'float: flex'], 0],
  ])], [['Structure HTML', 6], ['Formulaires', 6], ['Sélecteurs CSS', 6], ['Mise en page Flexbox', 6], ['Mini-projet', 6]])

  const bd1 = await upsertCourse('cursus-l1-bd-1', {
    ...base, teacherId: t2.id, title: 'Bases de Données I — Modélisation', subjectId: subBD?.id, cursusMonth: 1, totalHours: 24,
    description: 'Modèle conceptuel, entités, associations.',
  }, [
    { title: 'Modélisation', lessons: [lesson('Entités et attributs', 'Une entité représente un objet du réel.'), lesson('Associations et cardinalités', '1,1 — 0,n — 1,n')] },
  ], [studentTest('Test — Modélisation', [
    ['Une cardinalité 0,n signifie…', ['zéro ou plusieurs', 'exactement un', 'au moins deux'], 0],
  ])], [['Entités', 6], ['Associations', 6], ['Cardinalités', 6], ['Étude de cas', 6]])

  const algo2 = await upsertCourse('cursus-l1-algorithmique-2', {
    ...base, teacherId: t1.id, title: 'Algorithmique II — Tableaux et fonctions', subjectId: subAlgo?.id, cursusMonth: 2, totalHours: 30,
    relatedCourseIds: [algo1.id],
    description: 'Tableaux, fonctions et procédures. Suite de Algorithmique I.',
  }, [
    { title: 'Tableaux', lessons: [lesson('Déclarer un tableau', 'Tableau de N éléments'), lesson('Parcours', 'Boucle sur les indices')] },
    { title: 'Fonctions', lessons: [lesson('Fonctions et paramètres', 'Retourner une valeur')] },
  ], [studentTest('Test — Algorithmique II', [
    ['Le premier indice d\'un tableau est souvent…', ['0', '-1', '10'], 0],
  ])], [['Tableaux', 8], ['Parcours et recherche', 8], ['Fonctions', 8], ['Projet', 6]])

  const web2 = await upsertCourse('cursus-l1-web-2', {
    ...base, teacherId: t1.id, title: 'Programmation Web II — JavaScript', subjectId: subWeb?.id, cursusMonth: 2, totalHours: 30,
    relatedCourseIds: [web1.id],
    description: 'Interactivité côté client.',
  }, [
    { title: 'JavaScript', lessons: [lesson('Syntaxe', 'let, const, fonctions'), lesson('DOM', 'document.querySelector')] },
  ], [studentTest('Test — JavaScript', [
    ['Quel mot-clé déclare une constante ?', ['const', 'let', 'var'], 0],
  ])], [['Syntaxe JS', 8], ['DOM', 8], ['Événements', 8], ['Projet', 6]])

  // Cours « les deux » : dans le cursus L1 (mois 2) ET vendu comme cours certifiant.
  const excel = await upsertCourse('excel-analyse-donnees-pro', {
    ...base, courseKind: 'BOTH', credentialType: 'ATTESTATION', price: 50000, hasCertificate: true,
    teacherId: t2.id, title: 'Excel & analyse de données', cursusMonth: 2, totalHours: 20,
    description: 'Tableaux croisés dynamiques, formules et graphiques. Inclus dans le cursus L1, ouvert aux professionnels.',
  }, [
    { title: 'Formules', lessons: [lesson('RECHERCHEV / XLOOKUP', 'Rechercher une valeur'), lesson('SI imbriqués', 'Conditions multiples')] },
    { title: 'Analyse', lessons: [lesson('Tableaux croisés dynamiques', 'Synthétiser des données')] },
  ], [
    studentTest('Test étudiant — Excel', [['Un TCD sert à…', ['synthétiser des données', 'dessiner', 'envoyer des e-mails'], 0]]),
    { title: 'Test professionnel — Excel', audience: 'PUBLIC', questions: [['XLOOKUP remplace…', ['RECHERCHEV', 'SOMME', 'NB'], 0]] },
  ], [['Formules avancées', 6], ['TCD', 8], ['Graphiques', 6]])
  console.log('✅ Cours du cursus L1 Info (mois 1 : 3 cours · mois 2 : 3 cours dont 1 « les deux »)')

  // ── Plan du cursus L1 Info (8 mois, 3 cours / mois) ─────────
  const plan = [
    [1, 'Algorithmique I', t1, subAlgo, algo1], [1, 'Programmation Web I', t1, subWeb, web1], [1, 'Bases de Données I', t2, subBD, bd1],
    [2, 'Algorithmique II', t1, subAlgo, algo2], [2, 'Programmation Web II', t1, subWeb, web2], [2, 'Excel & analyse de données', t2, null, excel],
    [3, 'Algorithmique III — Récursivité', t1, subAlgo], [3, 'Bases de Données II — SQL', t2, subBD], [3, 'Architecture des ordinateurs', null, null],
    [4, 'Programmation Web III — PHP', t1, subWeb], [4, 'Mathématiques discrètes', null, null], [4, 'Anglais technique I', null, null],
    [5, 'Programmation orientée objet', t1, null], [5, 'Systèmes d\'exploitation', null, null], [5, 'Bases de Données III', t2, subBD],
    [6, 'Réseaux I', null, null], [6, 'Développement Mobile I', t2, null], [6, 'Anglais technique II', null, null],
    [7, 'Génie logiciel', null, null], [7, 'Framework web', t1, subWeb], [7, 'Statistiques', null, null],
    [8, 'Projet tutoré', t1, null], [8, 'Sécurité informatique', null, null], [8, 'Communication professionnelle', null, null],
  ]
  for (const [month, title, teacher, subject, course] of plan) {
    const exists = await prisma.curriculumEntry.findFirst({ where: { mentionId: mInfo.id, level: 'L1', month, title } })
    if (exists) continue
    await prisma.curriculumEntry.create({
      data: {
        mentionId: mInfo.id, level: 'L1', month, title,
        teacherId: teacher?.id ?? null, subjectId: subject?.id ?? null,
        courseId: course?.id ?? null, plannedHours: course?.totalHours ?? 30, createdById: chef.id,
      },
    })
  }
  console.log('✅ Plan du cursus L1 Informatique (24 cours sur 8 mois)')

  // ── Emploi du temps L1 Info (période publiée, S1) ───────────
  let period = await prisma.schedulePeriod.findFirst({ where: { mentionId: mInfo.id, name: 'EDT L1 Info — Cursus' } })
  if (!period) {
    period = await prisma.schedulePeriod.create({
      data: {
        mentionId: mInfo.id, semesterId: 'sem-s1-2024', name: 'EDT L1 Info — Cursus',
        status: 'PUBLISHED', publishedAt: new Date(), createdById: chef.id,
      },
    })
    const amphi = await prisma.room.findUnique({ where: { code: 'AMPHI-A' } })
    const labo = await prisma.room.findUnique({ where: { code: 'LABO-INFO-1' } })
    const slots = []
    for (const day of ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']) {
      slots.push({ day, startTime: '08:00', endTime: '10:00', teacherUserId: t1.id, subjectId: subAlgo?.id, subjectName: 'Algorithmique', roomId: amphi?.id, type: 'CM' })
      slots.push({ day, startTime: '10:15', endTime: '12:15', teacherUserId: t1.id, subjectId: subWeb?.id, subjectName: 'Programmation Web', roomId: labo?.id, type: 'TP' })
      slots.push({ day, startTime: '14:00', endTime: '16:00', teacherUserId: t2.id, subjectId: subBD?.id, subjectName: 'Base de Données', roomId: amphi?.id, type: 'CM' })
    }
    await prisma.scheduleSlot.createMany({
      data: slots.map((s) => ({ ...s, schedulePeriodId: period.id, promotionId: 'promo-l1-info-2024' })),
    })
  }
  console.log('✅ Emploi du temps L1 Info (3 séances / jour, lundi → samedi)')

  // ── Avancement : syllabus et séances déjà faites ────────────
  const secretaire = await prisma.user.findUnique({ where: { email: 'secretaire@ur.mg' } })
  const algoItems = await prisma.syllabusItem.findMany({ where: { courseId: algo1.id }, orderBy: { order: 'asc' } })
  if (!algoItems.some((i) => i.isDone)) {
    for (const it of algoItems.slice(0, 2)) {
      await prisma.syllabusItem.update({ where: { id: it.id }, data: { isDone: true, doneAt: new Date(), doneById: secretaire.id } })
    }
    const algoSlots = await prisma.scheduleSlot.findMany({ where: { schedulePeriodId: period.id, subjectId: subAlgo?.id }, take: 4 })
    for (const [i, s] of algoSlots.entries()) {
      const date = new Date(Date.UTC(2026, 9, 5 + i))
      await prisma.courseSessionLog.upsert({
        where: { slotId_date: { slotId: s.id, date } }, update: {},
        create: { slotId: s.id, date, hours: 2, courseId: algo1.id, checkedById: secretaire.id },
      })
    }
  }
  console.log('✅ Avancement Algorithmique I : 2/5 points du syllabus, 8 h effectuées')

  // ── Écolage de démonstration ────────────────────────────────
  const rakoto = await prisma.studentProfile.findFirst({ where: { user: { email: 'etudiant.rakoto@ur.mg' } } })
  const rabe = await prisma.studentProfile.findFirst({ where: { user: { email: 'etudiant.rabe@ur.mg' } } })
  const comptable = await prisma.user.findUnique({ where: { email: 'finance@ur.mg' } })
  if (rakoto && !(await prisma.tuitionPayment.findFirst({ where: { studentId: rakoto.id } }))) {
    await prisma.tuitionPayment.create({
      data: {
        studentId: rakoto.id, mentionId: mInfo.id, level: 'L1', month: 1, amount: 150000, method: 'CASH', source: 'CASHIER',
        status: 'VALIDATED', recordedById: comptable.id, validatedById: comptable.id, validatedAt: new Date(),
        receiptNumber: 'EC-DEMO-0001', note: 'Payé au guichet',
      },
    })
  }
  if (rabe && !(await prisma.tuitionPayment.findFirst({ where: { studentId: rabe.id } }))) {
    await prisma.tuitionPayment.create({
      data: {
        studentId: rabe.id, mentionId: mInfo.id, level: 'L1', month: 1, amount: 150000, method: 'MVOLA', source: 'STUDENT',
        senderNumber: '034 12 345 67', transactionRef: 'MVOLA-DEMO-7781', status: 'PENDING',
      },
    })
  }
  console.log('✅ Écolage : Rakoto (mois 1 payé), Rabe (mois 1 en attente de validation)')

  // ── Parts enseignants sur les ventes déjà validées ──────────
  const validated = await prisma.coursePayment.findMany({
    where: { status: 'VALIDATED', amount: { gt: 0 } },
    include: { course: { select: { teacherId: true } } },
  })
  for (const p of validated) {
    const share = Math.round(p.amount * 0.5 * 100) / 100
    await prisma.teacherEarning.upsert({
      where: { paymentId: p.id }, update: {},
      create: {
        teacherId: p.course.teacherId, courseId: p.courseId, paymentId: p.id,
        grossAmount: p.amount, teacherShare: share, universityShare: p.amount - share, currency: p.currency,
      },
    })
  }
  console.log(`✅ Parts enseignants (50 %) : ${validated.length} vente(s) reprise(s)`)

  console.log(`
  ──────────────────────────────────────────────
  COMPTES (mot de passe : ${PASSWORD})
    chef.info@ur.mg        → Responsable Info (plan du cursus, passage)
    chef.gestion@ur.mg     → Responsable Gestion
    resp.peda@ur.mg        → Responsable Info
    presence@ur.mg         → Responsable Présence (appel, suivi des cours)
    secretaire@ur.mg       → Secrétaire (inscriptions, appel, suivi)
    finance@ur.mg          → Comptabilité (écolage, personnel, salaires)
    etudiant.rakoto@ur.mg  → mois 1 payé
    etudiant.rabe@ur.mg    → mois 1 en attente
  ──────────────────────────────────────────────`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
