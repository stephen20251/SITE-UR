// ═══════════════════════════════════════════════════════════════
//  SEED ONLINE — LMS Université Références  (ESM)
//  30 étudiants · 8 enseignants · 20 cours · 120 leçons
//  30 quizzes · 20 devoirs · 15 sessions live · 10 certificats
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();
const ROUNDS = 10;
const DEFAULT_PASSWORD = 'Password123!';
const hash = (p) => bcrypt.hash(p, ROUNDS);

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  console.log('🌱 Seeding Online LMS…\n');
  const pw = await hash(DEFAULT_PASSWORD);

  // ── 8 Enseignants Online ─────────────────────────────────────
  const teacherDefs = [
    { email: 'teacher.online1@ur.mg', fn: 'Thierry',  ln: 'ANDRIANINA' },
    { email: 'teacher.online2@ur.mg', fn: 'Lalao',    ln: 'RASOAHERY' },
    { email: 'teacher.online3@ur.mg', fn: 'Hery',     ln: 'RAKOTONDRAVAO' },
    { email: 'teacher.online4@ur.mg', fn: 'Vola',     ln: 'RAZAFIMANDIMBY' },
    { email: 'teacher.online5@ur.mg', fn: 'Mamy',     ln: 'RANDRIANIRINA' },
    { email: 'teacher.online6@ur.mg', fn: 'Nivo',     ln: 'ANDRIAMAHEFA' },
    { email: 'teacher.online7@ur.mg', fn: 'Fanja',    ln: 'RABEMANANJARA' },
    { email: 'teacher.online8@ur.mg', fn: 'Toky',     ln: 'RANARISON' },
  ];
  const teachers = [];
  for (const t of teacherDefs) {
    const u = await prisma.user.upsert({
      where: { email: t.email }, update: {},
      create: { email: t.email, passwordHash: pw, firstName: t.fn, lastName: t.ln,
        systemRole: 'TEACHER_ONLINE', isActive: true, emailVerified: true },
    });
    teachers.push(u);
  }
  console.log(`✅ ${teachers.length} enseignants online`);

  // ── 30 Étudiants Online ──────────────────────────────────────
  const studentDefs = [
    { email: 'student.online1@ur.mg',  fn: 'Anjara',   ln: 'RAKOTO' },
    { email: 'student.online2@ur.mg',  fn: 'Beby',     ln: 'RABE' },
    { email: 'student.online3@ur.mg',  fn: 'Cédric',   ln: 'RANDRIA' },
    { email: 'student.online4@ur.mg',  fn: 'Diana',    ln: 'RAMAROSON' },
    { email: 'student.online5@ur.mg',  fn: 'Edgar',    ln: 'RAZAFY' },
    { email: 'student.online6@ur.mg',  fn: 'Feno',     ln: 'ANDRIANINA' },
    { email: 'student.online7@ur.mg',  fn: 'Gina',     ln: 'RAKOTOBE' },
    { email: 'student.online8@ur.mg',  fn: 'Haja',     ln: 'RAKOTONDRABE' },
    { email: 'student.online9@ur.mg',  fn: 'Irina',    ln: 'RANDRIANASOLO' },
    { email: 'student.online10@ur.mg', fn: 'Jules',    ln: 'RASOANINDRINA' },
    { email: 'student.online11@ur.mg', fn: 'Kanto',    ln: 'ANDRIAMASIMANANA' },
    { email: 'student.online12@ur.mg', fn: 'Lova',     ln: 'RASOANIRINA' },
    { email: 'student.online13@ur.mg', fn: 'Miora',    ln: 'RATSIMBA' },
    { email: 'student.online14@ur.mg', fn: 'Noro',     ln: 'RAKOTONIRINA' },
    { email: 'student.online15@ur.mg', fn: 'Onja',     ln: 'ANDRIAMBOLOLONA' },
    { email: 'student.online16@ur.mg', fn: 'Paul',     ln: 'RANAIVO' },
    { email: 'student.online17@ur.mg', fn: 'Quincy',   ln: 'RABEHARIVONY' },
    { email: 'student.online18@ur.mg', fn: 'Rosa',     ln: 'RANDRIANIANJA' },
    { email: 'student.online19@ur.mg', fn: 'Sami',     ln: 'RAZANATSOA' },
    { email: 'student.online20@ur.mg', fn: 'Tiana',    ln: 'RAKOTOMALALA' },
    { email: 'student.online21@ur.mg', fn: 'Unio',     ln: 'ANDRIANTSIMAHAZO' },
    { email: 'student.online22@ur.mg', fn: 'Vola',     ln: 'RASAMOELY' },
    { email: 'student.online23@ur.mg', fn: 'Wendy',    ln: 'RATSIFANDRIHA' },
    { email: 'student.online24@ur.mg', fn: 'Xavier',   ln: 'RAKOTOARISON' },
    { email: 'student.online25@ur.mg', fn: 'Yasmine',  ln: 'RANDRIANARIVO' },
    { email: 'student.online26@ur.mg', fn: 'Zo',       ln: 'ANDRIAMAHEFA' },
    { email: 'student.online27@ur.mg', fn: 'Ando',     ln: 'RASOLOARIVONY' },
    { email: 'student.online28@ur.mg', fn: 'Bako',     ln: 'RAKOTOVAO' },
    { email: 'student.online29@ur.mg', fn: 'Cyna',     ln: 'RAZAFIMAHEFA' },
    { email: 'student.online30@ur.mg', fn: 'Dina',     ln: 'ANDRIANTSOA' },
  ];
  const students = [];
  for (const s of studentDefs) {
    const u = await prisma.user.upsert({
      where: { email: s.email }, update: {},
      create: { email: s.email, passwordHash: pw, firstName: s.fn, lastName: s.ln,
        systemRole: 'STUDENT_ONLINE', isActive: true, emailVerified: true },
    });
    students.push(u);
  }
  console.log(`✅ ${students.length} étudiants online`);

  // ── 20 Cours ────────────────────────────────────────────────
  const courseDefs = [
    { title: 'JavaScript Avancé',              desc: 'ES6+, Promises, async/await, design patterns avancés',                  teacherIdx: 0 },
    { title: 'React & TypeScript',             desc: 'Hooks, Context, state management avec TypeScript strict',               teacherIdx: 1 },
    { title: 'Node.js & Express',              desc: 'APIs REST, middlewares, authentification JWT, tests',                   teacherIdx: 2 },
    { title: 'Base de Données SQL',            desc: 'SQL avancé, PostgreSQL, modélisation, optimisation des requêtes',       teacherIdx: 3 },
    { title: 'Python pour les Débutants',      desc: 'Variables, boucles, fonctions, bibliothèques Python essentielles',     teacherIdx: 4 },
    { title: 'Machine Learning Fondamentaux',  desc: 'Algorithmes ML, scikit-learn, évaluation et déploiement de modèles',   teacherIdx: 5 },
    { title: 'Développement Mobile Flutter',   desc: 'Dart, widgets Flutter, navigation, gestion de l\'état',                teacherIdx: 6 },
    { title: 'UI/UX Design',                   desc: 'Figma, design systems, prototypage, tests utilisateurs',                teacherIdx: 7 },
    { title: 'Marketing Digital',              desc: 'SEO, réseaux sociaux, Google Ads, e-mail marketing, analytics',        teacherIdx: 0 },
    { title: 'Excel & Analyse de Données',     desc: 'Formules avancées, tableaux croisés, Power Query, visualisations',     teacherIdx: 1 },
    { title: 'Comptabilité Générale',          desc: 'Bilan, compte de résultat, écritures comptables, fiscalité',           teacherIdx: 2 },
    { title: 'Entrepreneuriat',                desc: 'Business plan, pitch, financement, growth hacking, legal startup',     teacherIdx: 3 },
    { title: 'Communication en Anglais',       desc: 'Oral professionnel, présentations, rédaction en anglais',               teacherIdx: 4 },
    { title: 'Photographie Numérique',         desc: 'Composition, lumière, retouche Lightroom et Photoshop',                teacherIdx: 5 },
    { title: 'Montage Vidéo',                  desc: 'Premiere Pro, DaVinci Resolve, motion design, color grading',          teacherIdx: 6 },
    { title: 'Dessin Numérique',               desc: 'Procreate, Illustrator, concept art, illustration vectorielle',        teacherIdx: 7 },
    { title: 'Gestion de Projet',              desc: 'Agile, Scrum, Kanban, gestion des risques, outils PM',                 teacherIdx: 0 },
    { title: 'Cybersécurité',                  desc: 'OWASP Top 10, tests de pénétration, sécurité réseau et web',           teacherIdx: 1 },
    { title: 'DevOps & CI/CD',                 desc: 'GitHub Actions, pipelines CI/CD, Infrastructure as Code',              teacherIdx: 2 },
    { title: 'Docker & Kubernetes',            desc: 'Conteneurs Docker, orchestration K8s, déploiement cloud',              teacherIdx: 3 },
  ];

  const createdCourses = [];
  for (const cd of courseDefs) {
    const teacher = teachers[cd.teacherIdx];
    const existing = await prisma.onlineCourse.findFirst({
      where: { title: cd.title, teacherId: teacher.id },
    });
    if (existing) { createdCourses.push(existing); continue; }
    const slug = slugify(cd.title) + '-' + crypto.randomBytes(3).toString('hex');
    const course = await prisma.onlineCourse.create({
      data: {
        title: cd.title, slug, description: cd.desc, status: 'PUBLISHED',
        publishedAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000),
        teacherId: teacher.id,
      },
    });
    createdCourses.push(course);
  }
  console.log(`✅ ${createdCourses.length} cours`);

  // ── Modules & 6 Leçons par cours (3 VIDEO + 2 PDF + 1 TEXT = 120 total) ──
  const allLessons = []; // [{ courseId, id }]
  const lessonsByCourse = new Map();

  for (const course of createdCourses) {
    const existingCount = await prisma.onlineModule.count({ where: { courseId: course.id } });
    if (existingCount > 0) {
      const existing = await prisma.onlineLesson.findMany({
        where: { module: { courseId: course.id } }, select: { id: true },
      });
      for (const l of existing) {
        allLessons.push({ courseId: course.id, id: l.id });
        if (!lessonsByCourse.has(course.id)) lessonsByCourse.set(course.id, []);
        lessonsByCourse.get(course.id).push(l.id);
      }
      continue;
    }

    const mod1 = await prisma.onlineModule.create({
      data: { courseId: course.id, title: 'Module 1 — Fondamentaux', order: 1 },
    });
    const mod2 = await prisma.onlineModule.create({
      data: { courseId: course.id, title: 'Module 2 — Pratique Avancée', order: 2 },
    });

    const lessonDefs = [
      { moduleId: mod1.id, order: 1, type: 'VIDEO', title: `${course.title} — Introduction`,      duration: 600, contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { moduleId: mod1.id, order: 2, type: 'PDF',   title: 'Guide de référence complet',           contentUrl: 'https://example.com/guide.pdf' },
      { moduleId: mod1.id, order: 3, type: 'TEXT',  title: 'Résumé et points clés du module 1',    body: `Points essentiels du module 1 de ${course.title}. Assurez-vous de maîtriser ces concepts avant de passer au module suivant.` },
      { moduleId: mod2.id, order: 1, type: 'VIDEO', title: 'Cas pratique 1 — Exercice guidé',      duration: 900, contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { moduleId: mod2.id, order: 2, type: 'VIDEO', title: 'Cas pratique 2 — Projet complet',      duration: 1200, contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { moduleId: mod2.id, order: 3, type: 'PDF',   title: 'Exercices pratiques et corrigés',      contentUrl: 'https://example.com/exercices.pdf' },
    ];

    if (!lessonsByCourse.has(course.id)) lessonsByCourse.set(course.id, []);
    for (const ld of lessonDefs) {
      const lesson = await prisma.onlineLesson.create({ data: ld });
      allLessons.push({ courseId: course.id, id: lesson.id });
      lessonsByCourse.get(course.id).push(lesson.id);
    }
  }
  console.log(`✅ ${allLessons.length} leçons (${createdCourses.length} cours × 6)`);

  // ── 30 Quizzes (premiers 10 cours → 2 quiz ; derniers 10 → 1 quiz) ──
  const createdQuizzes = []; // [{ courseId, quizId }]
  for (let i = 0; i < createdCourses.length; i++) {
    const course = createdCourses[i];
    const quizCount = i < 10 ? 2 : 1; // 10×2 + 10×1 = 30

    for (let q = 0; q < quizCount; q++) {
      const quizTitle = `Quiz ${q + 1} — ${course.title.substring(0, 30)}`;
      const existing = await prisma.quiz.findFirst({ where: { courseId: course.id, title: quizTitle } });
      if (existing) { createdQuizzes.push({ courseId: course.id, quizId: existing.id }); continue; }

      const quiz = await prisma.quiz.create({
        data: {
          courseId: course.id,
          title: quizTitle,
          description: `Évaluez votre compréhension de ${course.title} — partie ${q + 1}`,
          passingScore: 60,
          questions: {
            create: [
              {
                text: `Quel est le concept fondamental de ${course.title} ?`,
                type: 'MCQ_SINGLE', points: 1, order: 1,
                options: { create: [
                  { text: 'La réponse correcte',         isCorrect: true,  order: 1 },
                  { text: 'Une réponse incorrecte',      isCorrect: false, order: 2 },
                  { text: 'Une autre réponse incorrecte', isCorrect: false, order: 3 },
                ]},
              },
              {
                text: 'Quelle affirmation est vraie ?',
                type: 'MCQ_SINGLE', points: 1, order: 2,
                options: { create: [
                  { text: 'Affirmation correcte',   isCorrect: true,  order: 1 },
                  { text: 'Affirmation incorrecte', isCorrect: false, order: 2 },
                  { text: 'Autre option fausse',    isCorrect: false, order: 3 },
                ]},
              },
            ],
          },
        },
      });
      createdQuizzes.push({ courseId: course.id, quizId: quiz.id });
    }
  }
  console.log(`✅ ${createdQuizzes.length} quizzes`);

  // ── 20 Devoirs (1 par cours) ─────────────────────────────────
  const createdAssignments = []; // [{ courseId, assignmentId }]
  for (const course of createdCourses) {
    const existing = await prisma.onlineAssignment.findFirst({ where: { courseId: course.id } });
    if (existing) { createdAssignments.push({ courseId: course.id, assignmentId: existing.id }); continue; }
    const a = await prisma.onlineAssignment.create({
      data: {
        courseId: course.id,
        title: `Projet pratique — ${course.title}`,
        description: `Réalisez un projet complet démontrant votre maîtrise des concepts de ${course.title}. Soumettez votre travail avant la date limite.`,
        dueDate: new Date(Date.now() + 14 * 86400000),
        maxScore: 100,
        status: 'OPEN',
      },
    });
    createdAssignments.push({ courseId: course.id, assignmentId: a.id });
  }
  console.log(`✅ ${createdAssignments.length} devoirs`);

  // ── 15 Sessions Live ─────────────────────────────────────────
  let sessionCount = 0;
  for (let i = 0; i < 15; i++) {
    const course = createdCourses[i];
    const teacher = teachers[courseDefs[i].teacherIdx];
    const existing = await prisma.liveSession.findFirst({ where: { courseId: course.id } });
    if (existing) { sessionCount++; continue; }
    await prisma.liveSession.create({
      data: {
        courseId: course.id, teacherId: teacher.id,
        title: `Session Live — ${course.title}`,
        scheduledAt: new Date(Date.now() + (i + 3) * 86400000),
        durationMin: 90,
        link: 'https://meet.google.com/abc-defg-hij',
        status: 'SCHEDULED',
      },
    });
    sessionCount++;
  }
  console.log(`✅ ${sessionCount} sessions live`);

  // ── Inscriptions & Progression ───────────────────────────────
  // 10 étudiants "diplômés" : 100% leçons + quiz passé + devoir rendu → certificat
  const CERT_COUNT = 10;
  let enrollmentCount = 0;
  let certCount = 0;

  for (let i = 0; i < CERT_COUNT; i++) {
    const student = students[i];
    const course = createdCourses[i]; // chaque diplômé termine un cours différent
    const courseLessons = lessonsByCourse.get(course.id) ?? [];

    // Inscription
    let enrollment = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
    });
    if (!enrollment) {
      enrollment = await prisma.enrollment.create({
        data: {
          studentId: student.id, courseId: course.id,
          progress: 100,
          completedAt: new Date(Date.now() - (CERT_COUNT - i) * 86400000),
          lastVisitedAt: new Date(Date.now() - i * 3600000),
        },
      });
      enrollmentCount++;
    }

    // Toutes les leçons terminées
    for (const lessonId of courseLessons) {
      await prisma.onlineLessonProgress.upsert({
        where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
        update: {},
        create: { enrollmentId: enrollment.id, lessonId, completed: true, completedAt: new Date(Date.now() - 3 * 86400000) },
      });
    }

    // Tous les quizzes passés
    const courseQuizIds = createdQuizzes.filter(q => q.courseId === course.id).map(q => q.quizId);
    for (const quizId of courseQuizIds) {
      const already = await prisma.onlineQuizAttempt.findFirst({ where: { quizId, studentId: student.id, passed: true } });
      if (!already) {
        await prisma.onlineQuizAttempt.create({
          data: { quizId, studentId: student.id, score: 2, maxScore: 2, passed: true, submittedAt: new Date(Date.now() - 4 * 86400000), answers: [] },
        });
      }
    }

    // Tous les devoirs soumis
    const courseAssignmentIds = createdAssignments.filter(a => a.courseId === course.id).map(a => a.assignmentId);
    for (const assignmentId of courseAssignmentIds) {
      await prisma.onlineSubmission.upsert({
        where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
        update: {},
        create: { assignmentId, studentId: student.id, content: 'Projet complet soumis.', status: 'SUBMITTED', submittedAt: new Date(Date.now() - 5 * 86400000) },
      });
    }

    // Certificat
    await prisma.onlineCertificate.upsert({
      where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
      update: {},
      create: {
        studentId: student.id, courseId: course.id, enrollmentId: enrollment.id,
        code: `CERT-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
        issuedAt: new Date(Date.now() - (CERT_COUNT - i) * 86400000),
      },
    });
    certCount++;
  }

  // Les 10 diplômés sont aussi inscrits dans 2-3 cours en cours
  for (let i = 0; i < CERT_COUNT; i++) {
    const student = students[i];
    for (let offset = 1; offset <= 2; offset++) {
      const course = createdCourses[(i + 10 + offset) % 20];
      const existing = await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
      });
      if (!existing) {
        const progress = 20 + Math.floor(Math.random() * 60);
        const enrollment = await prisma.enrollment.create({
          data: { studentId: student.id, courseId: course.id, progress, lastVisitedAt: new Date(Date.now() - Math.random() * 7 * 86400000) },
        });
        enrollmentCount++;
        const courseLessons = lessonsByCourse.get(course.id) ?? [];
        const doneCount = Math.floor(courseLessons.length * progress / 100);
        for (let l = 0; l < doneCount; l++) {
          await prisma.onlineLessonProgress.upsert({
            where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: courseLessons[l] } },
            update: {},
            create: { enrollmentId: enrollment.id, lessonId: courseLessons[l], completed: true, completedAt: new Date() },
          }).catch(() => null);
        }
      }
    }
  }

  // Les 20 autres étudiants : 3-4 cours en cours
  for (let i = CERT_COUNT; i < 30; i++) {
    const student = students[i];
    const start = (i * 3) % 20;
    const courseSlice = [
      createdCourses[start % 20],
      createdCourses[(start + 1) % 20],
      createdCourses[(start + 2) % 20],
      createdCourses[(start + 3) % 20],
    ];
    for (const course of courseSlice) {
      const existing = await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
      });
      if (!existing) {
        const progress = Math.floor(Math.random() * 75) + 5;
        const enrollment = await prisma.enrollment.create({
          data: { studentId: student.id, courseId: course.id, progress, lastVisitedAt: new Date(Date.now() - Math.random() * 14 * 86400000) },
        });
        enrollmentCount++;
        const courseLessons = lessonsByCourse.get(course.id) ?? [];
        const doneCount = Math.floor(courseLessons.length * progress / 100);
        for (let l = 0; l < doneCount; l++) {
          await prisma.onlineLessonProgress.upsert({
            where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: courseLessons[l] } },
            update: {},
            create: { enrollmentId: enrollment.id, lessonId: courseLessons[l], completed: true, completedAt: new Date() },
          }).catch(() => null);
        }
      }
    }
  }

  console.log(`✅ ~${enrollmentCount} inscriptions · ${certCount} certificats`);

  // ── 4 Parcours d'Apprentissage ────────────────────────────────
  const pathDefs = [
    { title: 'Parcours Développeur Full-Stack', desc: 'JavaScript → React → Node.js → Docker & Kubernetes', courseIdxs: [0, 1, 2, 19] },
    { title: 'Parcours Data & IA',              desc: 'Python → Machine Learning → Excel & Analyse de Données', courseIdxs: [4, 5, 9] },
    { title: 'Parcours Designer',               desc: 'UI/UX → Photographie → Montage Vidéo → Dessin Numérique', courseIdxs: [7, 13, 14, 15] },
    { title: 'Parcours Entrepreneur Digital',   desc: 'Entrepreneuriat → Marketing Digital → Comptabilité → Gestion de Projet', courseIdxs: [11, 8, 10, 16] },
  ];
  for (const pd of pathDefs) {
    const existing = await prisma.learningPath.findFirst({ where: { title: pd.title } });
    if (existing) continue;
    await prisma.learningPath.create({
      data: {
        title: pd.title, description: pd.desc, status: 'PUBLISHED',
        createdBy: teachers[0].id,
        steps: { create: pd.courseIdxs.map((courseIdx, order) => ({ courseId: createdCourses[courseIdx].id, order: order + 1 })) },
      },
    });
  }
  console.log(`✅ 4 parcours d'apprentissage`);

  // ── Activités récentes ────────────────────────────────────────
  for (let i = 0; i < 20; i++) {
    const student = students[i % 30];
    const course = createdCourses[i % 20];
    await prisma.learningActivity.create({
      data: {
        studentId: student.id, courseId: course.id, action: i % 3 === 0 ? 'lesson_complete' : 'lesson_open',
        createdAt: new Date(Date.now() - Math.random() * 5 * 86400000),
      },
    }).catch(() => null);
  }
  console.log(`✅ Activités d'apprentissage`);

  console.log(`
═══════════════════════════════════════════════════════════════
✅ SEED ONLINE TERMINÉ
═══════════════════════════════════════════════════════════════

📋 Comptes Online  (mot de passe: Password123!)

  ENSEIGNANTS ONLINE
    teacher.online1@ur.mg  →  Thierry ANDRIANINA     (JS Avancé, Marketing, Gestion de Projet)
    teacher.online2@ur.mg  →  Lalao RASOAHERY        (React, Excel, Cybersécurité)
    teacher.online3@ur.mg  →  Hery RAKOTONDRAVAO     (Node.js, Comptabilité, DevOps)
    teacher.online4@ur.mg  →  Vola RAZAFIMANDIMBY    (SQL, Entrepreneuriat, Docker)
    teacher.online5@ur.mg  →  Mamy RANDRIANIRINA     (Python, Anglais, Photographie)
    teacher.online6@ur.mg  →  Nivo ANDRIAMAHEFA      (ML, Montage Vidéo)
    teacher.online7@ur.mg  →  Fanja RABEMANANJARA    (Flutter, Dessin Numérique)
    teacher.online8@ur.mg  →  Toky RANARISON         (UI/UX)

  ÉTUDIANTS ONLINE (certifiés)
    student.online1@ur.mg  →  Anjara RAKOTO       ✅ JavaScript Avancé
    student.online2@ur.mg  →  Beby RABE           ✅ React & TypeScript
    student.online3@ur.mg  →  Cédric RANDRIA      ✅ Node.js & Express
    student.online4@ur.mg  →  Diana RAMAROSON     ✅ Base de Données SQL
    student.online5@ur.mg  →  Edgar RAZAFY        ✅ Python pour les Débutants
    student.online6@ur.mg  →  Feno ANDRIANINA     ✅ Machine Learning
    student.online7@ur.mg  →  Gina RAKOTOBE       ✅ Développement Mobile Flutter
    student.online8@ur.mg  →  Haja RAKOTONDRABE   ✅ UI/UX Design
    student.online9@ur.mg  →  Irina RANDRIANASOLO ✅ Marketing Digital
    student.online10@ur.mg →  Jules RASOANINDRINA ✅ Excel & Analyse de Données
    ...+ 20 étudiants en cours

  📊 Stats : 20 cours · 120 leçons · 30 quizzes · 20 devoirs · 15 sessions live · 10 certificats · 4 parcours
`);
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect());
