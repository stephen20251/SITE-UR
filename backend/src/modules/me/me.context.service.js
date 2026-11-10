// ─────────────────────────────────────────────────────────────────────────────
// /api/me/context — Single-call user context resolver.
//
// Returns everything the UI needs from one SQL-efficient traversal.
// Each role gets a context shaped around its organisational anchor:
//
//   STUDENT  → StudentProfile → Promotion → Mention → Department → Faculty → Campus
//   TEACHER  → TeacherProfile → Courses → Subjects → Groups/Promotions
//   PARENT   → ParentProfile → [ParentLink → StudentProfile → ...]
//   STAFF    → StaffProfile → Department → ...
//   SUPER_ADMIN → full university overview
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../../database/prisma.js';
import { ensureProfile } from './ensure-profile.js';

// ─── Shared selects ───────────────────────────────────────────────────────────

const CAMPUS_SEL = { id: true, name: true, code: true, city: true, country: true, email: true, phone: true, logoUrl: true };
const FACULTY_SEL = { id: true, name: true, code: true, deanName: true };
const DEPT_SEL   = { id: true, name: true, code: true };
const MENTION_SEL = { id: true, name: true, code: true, level: true, duration: true };
const PARCOURS_SEL = { id: true, name: true, code: true };
const ACAYEAR_SEL = { id: true, label: true, isCurrent: true, startDate: true, endDate: true };
const SEMESTER_SEL = { id: true, name: true, number: true, startDate: true, endDate: true, isActive: true };
const PROMO_SEL = { id: true, name: true, level: true };
const GROUP_SEL = { id: true, name: true, type: true };
const SUBJECT_SEL = { id: true, name: true, code: true, credits: true, weeklyHours: true };

// ─── Student context ──────────────────────────────────────────────────────────

async function studentContext(userId) {
  const sp = await prisma.studentProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, signatureUrl: true } },
      promotion: {
        include: {
          academicYear: { include: { campus: { select: CAMPUS_SEL } } },
          parcours:     { select: PARCOURS_SEL },
          mention: {
            include: {
              department: { include: { faculty: { include: { campus: { select: CAMPUS_SEL } } } } },
            },
          },
        },
      },
      group:   { select: GROUP_SEL },
      mention: { include: { department: { select: { ...DEPT_SEL, facultyId: true } } } },
      parentLinks: {
        include: {
          parent: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            },
          },
        },
      },
    },
  });

  if (!sp) return null;

  // Subjects for this student via promotion → courses → subject
  const courses = await prisma.course.findMany({
    where: { promotionId: sp.promotionId ?? undefined, status: 'PUBLISHED' },
    include: {
      subject: { select: SUBJECT_SEL },
      teachers: { include: { teacher: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } } },
    },
  });

  // Grade summary
  const grades = await prisma.grade.findMany({
    where: { studentId: sp.id },
    select: { value: true, maxValue: true, coefficient: true, isValidated: true },
  });
  const gradesSummary = computeGradeSummary(grades);

  // Attendance summary
  const att = await prisma.attendance.findMany({
    where: { studentId: sp.id },
    select: { status: true },
  });
  const attSummary = computeAttSummary(att);

  // Finance summary
  const invoices = await prisma.invoice.findMany({
    where: { studentId: sp.id },
    select: { status: true, amount: true },
  });
  const financeSummary = {
    pending:  invoices.filter((i) => i.status === 'PENDING' || i.status === 'PARTIAL' || i.status === 'OVERDUE').length,
    totalDue: invoices.filter((i) => i.status === 'PENDING' || i.status === 'PARTIAL').reduce((s, i) => s + i.amount, 0),
    overdue:  invoices.filter((i) => i.status === 'OVERDUE').length,
    currency: 'MGA',
  };

  // Notifications unread
  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });

  const promotion = sp.promotion;
  const mention   = sp.mention ?? promotion?.mention;
  const dept      = mention?.department;
  const faculty   = dept?.faculty ?? promotion?.mention?.department?.faculty;
  const campus    = promotion?.academicYear?.campus ?? faculty?.campus;

  return {
    role:  'STUDENT',
    user:  sp.user,
    profile: {
      id:             sp.id,
      matricule:      sp.matricule,
      enrollmentDate: sp.enrollmentDate,
      status:         sp.status,
      scholarship:    sp.scholarship,
      studyMode:      sp.studyMode,
    },
    // Full organisational chain
    campus:      campus ? pick(campus, CAMPUS_SEL) : null,
    faculty:     faculty ? pick(faculty, FACULTY_SEL) : null,
    department:  dept    ? pick(dept, DEPT_SEL)    : null,
    mention:     mention ? pick(mention, MENTION_SEL) : null,
    parcours:    promotion?.parcours ?? null,
    academicYear: promotion?.academicYear ? pick(promotion.academicYear, ACAYEAR_SEL) : null,
    semester:     await currentSemester(promotion?.academicYearId),
    promotion:   promotion ? pick(promotion, PROMO_SEL) : null,
    group:       sp.group,
    // Academic content
    subjects:    courses.map((c) => ({
      ...c.subject,
      courseId:  c.id,
      teachers:  c.teachers.map((ct) => ({ id: ct.teacher.id, ...ct.teacher.user, isMain: ct.isMain })),
    })),
    parents:     sp.parentLinks.map((l) => ({ id: l.parent.id, ...l.parent.user, relationship: l.parent.relationship })),
    // Summaries
    gradesSummary,
    attendanceSummary: attSummary,
    financeSummary,
    unreadNotifications: unreadCount,
  };
}

// ─── Teacher context ──────────────────────────────────────────────────────────

async function teacherContext(userId) {
  const tp = await prisma.teacherProfile.findUnique({
    where: { userId },
    include: {
      user:       { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, signatureUrl: true } },
      department: { include: { faculty: { include: { campus: { select: CAMPUS_SEL } } } } },
      mention:    { select: MENTION_SEL },
      courseTeachers: {
        include: {
          course: {
            include: {
              subject:   { select: SUBJECT_SEL },
              promotion: {
                include: {
                  mention: {
                    include: { department: { include: { faculty: { select: { ...FACULTY_SEL, campusId: true } } } } },
                  },
                  academicYear: { select: ACAYEAR_SEL },
                },
              },
              _count: { select: { chapters: true } },
            },
          },
        },
      },
    },
  });

  if (!tp) return null;

  const courses  = tp.courseTeachers.map((ct) => ct.course);
  const promotionIds = [...new Set(courses.map((c) => c.promotionId))];

  // Students across all promotions the teacher teaches
  const studentCount = await prisma.studentProfile.count({
    where: { promotionId: { in: promotionIds } },
  });

  // Groups
  const groups = await prisma.group.findMany({
    where: { promotionId: { in: promotionIds } },
    select: { ...GROUP_SEL, promotionId: true, _count: { select: { students: true } } },
  });

  // Unread notifications
  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });

  // Derive campus/faculty/dept from courses if not set on profile
  const firstPromotion = courses[0]?.promotion;
  const mention  = tp.mention ?? firstPromotion?.mention ?? null;
  const dept     = tp.department ?? mention?.department ?? null;
  const faculty  = dept?.faculty ?? null;
  const campus   = faculty?.campus ?? null;

  return {
    role:  'TEACHER',
    user:  tp.user,
    profile: {
      id:             tp.id,
      employeeId:     tp.employeeId,
      specialization: tp.specialization,
      bio:            tp.bio,
      office:         tp.office,
      academicTitle:   tp.academicTitle,
      highestDegree:   tp.highestDegree,
      yearsExperience: tp.yearsExperience,
      cvFileName:      tp.cvFileName,
      cvUpdatedAt:     tp.cvUpdatedAt,
    },
    campus,
    faculty:  faculty ? pick(faculty, FACULTY_SEL) : null,
    department: dept  ? pick(dept, DEPT_SEL)       : null,
    mention:  mention ? pick(mention, MENTION_SEL) : null,
    courses: courses.map((c) => ({
      id:          c.id,
      title:       c.title,
      status:      c.status,
      subject:     c.subject,
      promotion:   c.promotion ? pick(c.promotion, PROMO_SEL) : null,
      mention:     c.promotion?.mention ? pick(c.promotion.mention, MENTION_SEL) : null,
      academicYear: c.promotion?.academicYear ?? null,
      chaptersCount: c._count.chapters,
    })),
    groups,
    studentCount,
    unreadNotifications: unreadCount,
  };
}

// ─── Parent context ───────────────────────────────────────────────────────────

async function parentContext(userId) {
  const pp = await prisma.parentProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, signatureUrl: true } },
      parentLinks: {
        include: {
          student: {
            include: {
              user:      { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, signatureUrl: true } },
              promotion: {
                include: {
                  academicYear: { select: ACAYEAR_SEL },
                  mention: {
                    include: { department: { include: { faculty: { include: { campus: { select: CAMPUS_SEL } } } } } },
                  },
                  parcours: { select: PARCOURS_SEL },
                },
              },
              group:   { select: GROUP_SEL },
              mention: { select: MENTION_SEL },
              // Quick summaries
              grades:  {
                select: { value: true, maxValue: true, coefficient: true },
                orderBy: { createdAt: 'desc' },
                take: 20,
              },
              attendances: {
                select: { status: true },
                orderBy: { date: 'desc' },
                take: 50,
              },
              invoices: {
                where: { status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
                select: { id: true, title: true, amount: true, status: true, dueDate: true },
              },
            },
          },
        },
      },
    },
  });

  if (!pp) return null;

  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });

  return {
    role:  'PARENT',
    user:  pp.user,
    profile: { id: pp.id, occupation: pp.occupation, relationship: pp.relationship },
    children: pp.parentLinks.map((l) => {
      const sp = l.student;
      return {
        studentProfileId: sp.id,
        user:      sp.user,
        matricule: sp.matricule,
        status:    sp.status,
        promotion: sp.promotion ? pick(sp.promotion, PROMO_SEL) : null,
        academicYear: sp.promotion?.academicYear ?? null,
        mention:   sp.mention ?? sp.promotion?.mention ?? null,
        parcours:  sp.promotion?.parcours ?? null,
        group:     sp.group,
        faculty:   sp.promotion?.mention?.department?.faculty ? pick(sp.promotion.mention.department.faculty, FACULTY_SEL) : null,
        campus:    sp.promotion?.mention?.department?.faculty?.campus ?? null,
        gradesSummary:     computeGradeSummary(sp.grades),
        attendanceSummary: computeAttSummary(sp.attendances),
        pendingInvoices:   sp.invoices,
      };
    }),
    unreadNotifications: unreadCount,
  };
}

// ─── Staff context ────────────────────────────────────────────────────────────

async function staffContext(userId) {
  const staff = await prisma.staffProfile.findUnique({
    where: { userId },
    include: {
      user:       { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, signatureUrl: true } },
      department: { include: { faculty: { include: { campus: { select: CAMPUS_SEL } } } } },
    },
  });

  // University-wide stats
  const [students, teachers, pendingCandidates, activeMentions] = await Promise.all([
    prisma.studentProfile.count({ where: { status: 'ACTIVE' } }),
    prisma.teacherProfile.count(),
    prisma.candidate.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.mention.count({ where: { isActive: true } }),
  ]);

  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });

  return {
    role:  'STAFF',
    user:  staff?.user ?? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, signatureUrl: true } }),
    profile: staff ? { id: staff.id, employeeId: staff.employeeId, office: staff.office } : null,
    department: staff?.department ?? null,
    faculty:    staff?.department?.faculty ?? null,
    campus:     staff?.department?.faculty?.campus ?? null,
    stats: { students, teachers, pendingCandidates, activeMentions },
    unreadNotifications: unreadCount,
  };
}

// ─── Compte sans fiche universitaire (candidat, compte en ligne) ────────────
// Seulement l'identité du compte : aucune statistique de l'université ni rattachement.
async function basicContext(userId, role) {
  const [user, unreadCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { role, user, profile: null, unreadNotifications: unreadCount };
}

// ─── Admin context ────────────────────────────────────────────────────────────

async function adminContext(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, signatureUrl: true },
  });

  const [
    campuses, faculties, departments, mentions,
    totalStudents, totalTeachers, activeStudents,
    pendingCandidates, totalCourses,
  ] = await Promise.all([
    prisma.campus.count(),
    prisma.faculty.count(),
    prisma.department.count(),
    prisma.mention.count({ where: { isActive: true } }),
    prisma.studentProfile.count(),
    prisma.teacherProfile.count(),
    prisma.studentProfile.count({ where: { status: 'ACTIVE' } }),
    prisma.candidate.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.course.count({ where: { status: 'PUBLISHED' } }),
  ]);

  const currentYear = await prisma.academicYear.findFirst({
    where: { isCurrent: true },
    include: { campus: { select: CAMPUS_SEL }, semesters: { select: SEMESTER_SEL } },
  });

  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });

  return {
    role: 'SUPER_ADMIN',
    user,
    currentAcademicYear: currentYear,
    stats: {
      campuses, faculties, departments, mentions,
      totalStudents, activeStudents, totalTeachers,
      pendingCandidates, totalCourses,
    },
    unreadNotifications: unreadCount,
  };
}

// ─── Main resolver ────────────────────────────────────────────────────────────

export async function resolveContext(user) {
  // Compte créé sans fiche de profil : on la crée avant de lire le contexte.
  await ensureProfile(user.sub, user.systemRole);
  const ctx = await roleContext(user);
  if (!ctx) return null;
  return { ...ctx, account: await accountInfo(user.sub) };
}

function roleContext(user) {
  switch (user.systemRole) {
    case 'STUDENT':        return studentContext(user.sub);
    case 'TEACHER':        return teacherContext(user.sub);
    // Comptes online : fiche universitaire seulement s'ils en ont une
    case 'STUDENT_ONLINE': return studentContext(user.sub).then((c) => c ?? basicContext(user.sub, 'ONLINE'));
    case 'TEACHER_ONLINE': return teacherContext(user.sub).then((c) => c ?? basicContext(user.sub, 'ONLINE'));
    case 'CANDIDATE':      return basicContext(user.sub, 'CANDIDATE');
    case 'PARENT':         return parentContext(user.sub);
    case 'SUPER_ADMIN':    return adminContext(user.sub);
    default:               return staffContext(user.sub);
  }
}

// Informations du compte communes à tous les rôles (bloc « Mes informations »).
async function accountInfo(userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      phone: true, createdAt: true, lastLoginAt: true, systemRole: true,
      userRoles: { select: { role: { select: { name: true } }, mention: { select: { name: true } } } },
    },
  });
  return {
    phone:       u?.phone ?? null,
    createdAt:   u?.createdAt ?? null,
    lastLoginAt: u?.lastLoginAt ?? null,
    systemRole:  u?.systemRole ?? null,
    roles:       (u?.userRoles ?? []).map((r) => (r.mention ? `${r.role.name} — ${r.mention.name}` : r.role.name)),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pick(obj, shape) {
  if (!obj) return null;
  const keys = typeof shape === 'object' ? Object.keys(shape) : shape;
  return Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));
}

function computeGradeSummary(grades) {
  if (!grades.length) return { count: 0, average: null, percentage: null };
  const weighted   = grades.reduce((s, g) => s + g.value * (g.coefficient ?? 1), 0);
  const totalCoeff = grades.reduce((s, g) => s + (g.coefficient ?? 1), 0);
  const avg        = totalCoeff > 0 ? weighted / totalCoeff : 0;
  const max        = grades[0]?.maxValue ?? 20;
  return { count: grades.length, average: Math.round(avg * 100) / 100, percentage: Math.round((avg / max) * 100) };
}

function computeAttSummary(records) {
  const total   = records.length;
  const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const absent  = records.filter((r) => r.status === 'ABSENT').length;
  return { total, present, absent, rate: total > 0 ? Math.round((present / total) * 100) : null };
}

async function currentSemester(academicYearId) {
  if (!academicYearId) return null;
  return prisma.semester.findFirst({
    where: { academicYearId, isActive: true },
    select: SEMESTER_SEL,
  });
}
