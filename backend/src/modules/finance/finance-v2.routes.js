import { Router } from 'express';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middlewares/auth.js';
import { requireAnyPermission } from '../../middlewares/rbac.js';
import { PrismaClient } from '@prisma/client';
import {
  generateReceiptNumber,
  recalculateAccountItemStatus,
  createStudentAccount,
  applyFeeGridsToAccount,
  auditLog,
} from './finance-v2.service.js';

const prisma = new PrismaClient();
const r = Router();
r.use(authenticate);
// Réservé à la comptabilité / administration : un étudiant ou un parent ne voit
// que ses propres paiements via /api/cursus/me et /api/cursus/parent/children.
r.use(requireAnyPermission('VIEW_FINANCE', 'MANAGE_TUITION'));

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function paginate(query) {
  const page = Math.max(1, parseInt(query.page ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

// ─────────────────────────────────────────────────────────────
// SETTINGS — Fee Types
// ─────────────────────────────────────────────────────────────
r.get('/settings/fee-types', asyncHandler(async (req, res) => {
  const items = await prisma.financeFeeType.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });
  res.json(items);
}));

r.post('/settings/fee-types', asyncHandler(async (req, res) => {
  const { name, code, category, mandatory, active, order } = req.body;
  if (!name || !code) throw new HttpError(400, 'name et code sont requis');
  const item = await prisma.financeFeeType.create({
    data: { name, code, category, mandatory, active, order: order ?? 0 },
  });
  await auditLog({ action: 'CREATE', entityType: 'FinanceFeeType', entityId: item.id, userId: req.user.sub, description: `Création type de frais: ${name}` });
  res.status(201).json(item);
}));

r.put('/settings/fee-types/:id', asyncHandler(async (req, res) => {
  const { name, code, category, mandatory, active, order } = req.body;
  const item = await prisma.financeFeeType.update({
    where: { id: req.params.id },
    data: { name, code, category, mandatory, active, order },
  });
  res.json(item);
}));

r.delete('/settings/fee-types/:id', asyncHandler(async (req, res) => {
  await prisma.financeFeeType.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

// ─────────────────────────────────────────────────────────────
// SETTINGS — Payment Methods
// ─────────────────────────────────────────────────────────────
r.get('/settings/payment-methods', asyncHandler(async (req, res) => {
  const items = await prisma.financePaymentMethod.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });
  res.json(items);
}));

r.post('/settings/payment-methods', asyncHandler(async (req, res) => {
  const { name, code, description, active, order } = req.body;
  if (!name || !code) throw new HttpError(400, 'name et code sont requis');
  const item = await prisma.financePaymentMethod.create({
    data: { name, code, description, active, order: order ?? 0 },
  });
  res.status(201).json(item);
}));

r.put('/settings/payment-methods/:id', asyncHandler(async (req, res) => {
  const { name, code, description, active, order } = req.body;
  const item = await prisma.financePaymentMethod.update({
    where: { id: req.params.id },
    data: { name, code, description, active, order },
  });
  res.json(item);
}));

r.delete('/settings/payment-methods/:id', asyncHandler(async (req, res) => {
  await prisma.financePaymentMethod.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

// ─────────────────────────────────────────────────────────────
// SETTINGS — Penalties
// ─────────────────────────────────────────────────────────────
r.get('/settings/penalties', asyncHandler(async (req, res) => {
  const items = await prisma.financePenalty.findMany({ orderBy: { name: 'asc' } });
  res.json(items);
}));

r.post('/settings/penalties', asyncHandler(async (req, res) => {
  const { name, code, amount, percent, triggerDays, active } = req.body;
  if (!name || !code) throw new HttpError(400, 'name et code sont requis');
  const item = await prisma.financePenalty.create({
    data: { name, code, amount, percent, triggerDays: triggerDays ?? 0, active },
  });
  res.status(201).json(item);
}));

r.put('/settings/penalties/:id', asyncHandler(async (req, res) => {
  const { name, code, amount, percent, triggerDays, active } = req.body;
  const item = await prisma.financePenalty.update({
    where: { id: req.params.id },
    data: { name, code, amount, percent, triggerDays, active },
  });
  res.json(item);
}));

r.delete('/settings/penalties/:id', asyncHandler(async (req, res) => {
  await prisma.financePenalty.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

// ─────────────────────────────────────────────────────────────
// SETTINGS — Discounts
// ─────────────────────────────────────────────────────────────
r.get('/settings/discounts', asyncHandler(async (req, res) => {
  const items = await prisma.financeDiscount.findMany({ orderBy: { name: 'asc' } });
  res.json(items);
}));

r.post('/settings/discounts', asyncHandler(async (req, res) => {
  const { name, code, amount, percent, description, active } = req.body;
  if (!name || !code) throw new HttpError(400, 'name et code sont requis');
  const item = await prisma.financeDiscount.create({
    data: { name, code, amount, percent, description, active },
  });
  res.status(201).json(item);
}));

r.put('/settings/discounts/:id', asyncHandler(async (req, res) => {
  const { name, code, amount, percent, description, active } = req.body;
  const item = await prisma.financeDiscount.update({
    where: { id: req.params.id },
    data: { name, code, amount, percent, description, active },
  });
  res.json(item);
}));

r.delete('/settings/discounts/:id', asyncHandler(async (req, res) => {
  await prisma.financeDiscount.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

// ─────────────────────────────────────────────────────────────
// SETTINGS — Scholarships
// ─────────────────────────────────────────────────────────────
r.get('/settings/scholarships', asyncHandler(async (req, res) => {
  const items = await prisma.financeScholarship.findMany({ orderBy: { name: 'asc' } });
  res.json(items);
}));

r.post('/settings/scholarships', asyncHandler(async (req, res) => {
  const { name, code, coverageType, coverageValue, description, active } = req.body;
  if (!name || !code) throw new HttpError(400, 'name et code sont requis');
  if (coverageValue == null) throw new HttpError(400, 'coverageValue est requis');
  const item = await prisma.financeScholarship.create({
    data: { name, code, coverageType: coverageType ?? 'PERCENT', coverageValue, description, active },
  });
  res.status(201).json(item);
}));

r.put('/settings/scholarships/:id', asyncHandler(async (req, res) => {
  const { name, code, coverageType, coverageValue, description, active } = req.body;
  const item = await prisma.financeScholarship.update({
    where: { id: req.params.id },
    data: { name, code, coverageType, coverageValue, description, active },
  });
  res.json(item);
}));

r.delete('/settings/scholarships/:id', asyncHandler(async (req, res) => {
  await prisma.financeScholarship.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

// ─────────────────────────────────────────────────────────────
// FEE GRIDS
// ─────────────────────────────────────────────────────────────
r.get('/fee-grids', asyncHandler(async (req, res) => {
  const { academicYearId, mentionId, promotionId } = req.query;
  const where = {};
  if (academicYearId) where.academicYearId = academicYearId;
  if (mentionId) where.mentionId = mentionId;
  if (promotionId) where.promotionId = promotionId;

  const grids = await prisma.financeFeeGrid.findMany({
    where,
    include: {
      academicYear: { select: { id: true, label: true } },
      mention: { select: { id: true, name: true } },
      promotion: { select: { id: true, name: true } },
      items: {
        include: { feeType: { select: { id: true, name: true, code: true } } },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(grids);
}));

r.post('/fee-grids', asyncHandler(async (req, res) => {
  const { name, academicYearId, mentionId, promotionId, active, items } = req.body;
  if (!name || !academicYearId) throw new HttpError(400, 'name et academicYearId sont requis');

  const grid = await prisma.financeFeeGrid.create({
    data: {
      name,
      academicYearId,
      mentionId: mentionId ?? null,
      promotionId: promotionId ?? null,
      active: active ?? true,
      items: items && items.length > 0
        ? {
            create: items.map((it, idx) => ({
              feeTypeId: it.feeTypeId,
              amount: it.amount,
              currency: it.currency ?? 'MGA',
              frequency: it.frequency ?? 'ONCE',
              dueDate: it.dueDate ? new Date(it.dueDate) : null,
              isOptional: it.isOptional ?? false,
              order: it.order ?? idx,
            })),
          }
        : undefined,
    },
    include: {
      items: { include: { feeType: { select: { id: true, name: true, code: true } } } },
      academicYear: { select: { id: true, label: true } },
      mention: { select: { id: true, name: true } },
      promotion: { select: { id: true, name: true } },
    },
  });

  await auditLog({ action: 'CREATE', entityType: 'FinanceFeeGrid', entityId: grid.id, userId: req.user.sub, description: `Création grille tarifaire: ${name}` });
  res.status(201).json(grid);
}));

r.get('/fee-grids/:id', asyncHandler(async (req, res) => {
  const grid = await prisma.financeFeeGrid.findUnique({
    where: { id: req.params.id },
    include: {
      academicYear: { select: { id: true, label: true } },
      mention: { select: { id: true, name: true } },
      promotion: { select: { id: true, name: true } },
      items: {
        include: { feeType: { select: { id: true, name: true, code: true, category: true } } },
        orderBy: { order: 'asc' },
      },
    },
  });
  if (!grid) throw new HttpError(404, 'Grille tarifaire non trouvée');
  res.json(grid);
}));

r.put('/fee-grids/:id', asyncHandler(async (req, res) => {
  const { name, academicYearId, mentionId, promotionId, active } = req.body;
  const grid = await prisma.financeFeeGrid.update({
    where: { id: req.params.id },
    data: { name, academicYearId, mentionId, promotionId, active },
  });
  res.json(grid);
}));

r.delete('/fee-grids/:id', asyncHandler(async (req, res) => {
  await prisma.financeFeeGrid.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

// Add item to grid
r.post('/fee-grids/:id/items', asyncHandler(async (req, res) => {
  const { feeTypeId, amount, currency, frequency, dueDate, isOptional, order } = req.body;
  if (!feeTypeId || amount == null) throw new HttpError(400, 'feeTypeId et amount sont requis');

  const grid = await prisma.financeFeeGrid.findUnique({ where: { id: req.params.id } });
  if (!grid) throw new HttpError(404, 'Grille tarifaire non trouvée');

  const item = await prisma.financeFeeGridItem.create({
    data: {
      feeGridId: req.params.id,
      feeTypeId,
      amount,
      currency: currency ?? 'MGA',
      frequency: frequency ?? 'ONCE',
      dueDate: dueDate ? new Date(dueDate) : null,
      isOptional: isOptional ?? false,
      order: order ?? 0,
    },
    include: { feeType: { select: { id: true, name: true, code: true } } },
  });
  res.status(201).json(item);
}));

// Update grid item
r.put('/fee-grids/:id/items/:itemId', asyncHandler(async (req, res) => {
  const { amount, currency, frequency, dueDate, isOptional, order } = req.body;
  const item = await prisma.financeFeeGridItem.update({
    where: { id: req.params.itemId },
    data: { amount, currency, frequency, dueDate: dueDate ? new Date(dueDate) : undefined, isOptional, order },
    include: { feeType: { select: { id: true, name: true, code: true } } },
  });
  res.json(item);
}));

// Delete grid item
r.delete('/fee-grids/:id/items/:itemId', asyncHandler(async (req, res) => {
  await prisma.financeFeeGridItem.delete({ where: { id: req.params.itemId } });
  res.status(204).end();
}));

// Apply grid to all students in matching promotion
r.post('/fee-grids/:id/apply', asyncHandler(async (req, res) => {
  const grid = await prisma.financeFeeGrid.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!grid) throw new HttpError(404, 'Grille tarifaire non trouvée');
  if (!grid.items.length) throw new HttpError(400, 'La grille ne contient aucun élément');

  // Find students matching the grid scope
  const studentWhere = {};
  if (grid.promotionId) studentWhere.promotionId = grid.promotionId;
  else if (grid.mentionId) studentWhere.mentionId = grid.mentionId;
  studentWhere.status = 'ACTIVE';

  const students = await prisma.studentProfile.findMany({ where: studentWhere });
  if (!students.length) {
    return res.json({ applied: 0, skipped: 0, message: 'Aucun étudiant trouvé' });
  }

  let applied = 0;
  let skipped = 0;

  for (const student of students) {
    // Ensure student account exists
    const account = await createStudentAccount(student.id);

    for (const gridItem of grid.items) {
      // Check if this item already exists for this student (same gridItemId)
      const exists = await prisma.financeAccountItem.findFirst({
        where: { accountId: account.id, gridItemId: gridItem.id },
      });
      if (exists) { skipped++; continue; }

      // Get fee type for label
      const feeType = await prisma.financeFeeType.findUnique({ where: { id: gridItem.feeTypeId } });

      await prisma.financeAccountItem.create({
        data: {
          accountId: account.id,
          feeTypeId: gridItem.feeTypeId,
          gridItemId: gridItem.id,
          label: feeType?.name ?? 'Frais',
          amount: gridItem.amount,
          currency: gridItem.currency,
          dueDate: gridItem.dueDate,
          academicYearId: grid.academicYearId,
          status: 'UNPAID',
        },
      });
      applied++;
    }
  }

  await auditLog({
    action: 'APPLY_GRID',
    entityType: 'FinanceFeeGrid',
    entityId: grid.id,
    userId: req.user.sub,
    description: `Application grille "${grid.name}": ${applied} frais créés, ${skipped} ignorés`,
  });

  res.json({ applied, skipped, students: students.length });
}));

// ─────────────────────────────────────────────────────────────
// STUDENT ACCOUNTS
// ─────────────────────────────────────────────────────────────
r.get('/accounts', asyncHandler(async (req, res) => {
  const { search, mentionId, promotionId, groupId, academicYearId } = req.query;
  const { skip, take, page, limit } = paginate(req.query);

  // Source of truth: all ACTIVE students from the academic system.
  // Finance accounts are created lazily; students without one still appear.
  const where = { status: 'ACTIVE' };
  if (mentionId)    where.mentionId    = mentionId;
  if (promotionId)  where.promotionId  = promotionId;
  if (groupId)      where.groupId      = groupId;
  if (search) {
    where.OR = [
      { matricule:    { contains: search, mode: 'insensitive' } },
      { user: { firstName: { contains: search, mode: 'insensitive' } } },
      { user: { lastName:  { contains: search, mode: 'insensitive' } } },
    ];
  }

  const itemWhere = academicYearId ? { academicYearId } : undefined;

  const [total, students] = await Promise.all([
    prisma.studentProfile.count({ where }),
    prisma.studentProfile.findMany({
      where,
      include: {
        user:      { select: { firstName: true, lastName: true, email: true } },
        promotion: { select: { id: true, name: true,
          academicYear: { select: { id: true, label: true } } } },
        mention:   { select: { id: true, name: true } },
        group:     { select: { id: true, name: true } },
        financeAccount: {
          include: {
            items: {
              where: itemWhere,
              select: { amount: true, amountPaid: true, status: true },
            },
          },
        },
      },
      skip,
      take,
      orderBy: [
        { promotion: { name: 'asc' } },
        { user: { lastName: 'asc' } },
      ],
    }),
  ]);

  const data = students.map((s) => {
    const items = s.financeAccount?.items ?? [];
    const totalDue  = items.reduce((sum, i) => sum + i.amount, 0);
    const totalPaid = items.reduce((sum, i) => sum + i.amountPaid, 0);
    const remaining = totalDue - totalPaid;
    const payStatus = totalDue === 0 ? 'NO_FEES'
      : remaining <= 0 ? 'PAID'
      : totalPaid > 0  ? 'PARTIAL'
      : 'UNPAID';
    return {
      studentId:  s.id,
      matricule:  s.matricule,
      firstName:  s.user.firstName,
      lastName:   s.user.lastName,
      email:      s.user.email,
      mention:    s.mention,
      promotion:  s.promotion,
      group:      s.group,
      status:     s.status,
      hasAccount: !!s.financeAccount,
      accountId:  s.financeAccount?.id ?? null,
      summary:    { totalDue, totalPaid, remaining, payStatus },
    };
  });

  res.json({ total, page, limit, data });
}));

r.get('/accounts/:studentId', asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  // Verify the student exists in the academic system
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: {
      id: true, matricule: true, status: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      promotion: { select: { id: true, name: true, academicYear: { select: { id: true, label: true } } } },
      mention: { select: { id: true, name: true } },
      group:   { select: { id: true, name: true } },
    },
  });
  if (!student) throw new HttpError(404, 'Étudiant introuvable dans le système académique');

  // Auto-create the finance account if it doesn't exist yet
  const account = await createStudentAccount(studentId);

  const fullAccount = await prisma.financeStudentAccount.findUnique({
    where: { id: account.id },
    include: {
      items: {
        include: {
          feeType: { select: { id: true, name: true, code: true, category: true } },
          transactions: { orderBy: { paidAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const totalExpected = fullAccount.items.reduce((s, i) => s + (i.amount ?? 0), 0);
  const totalPaid     = fullAccount.items.reduce((s, i) => s + (i.amountPaid ?? 0), 0);
  res.json({ ...fullAccount, student, summary: { totalExpected, totalPaid, totalUnpaid: totalExpected - totalPaid } });
}));

r.post('/accounts', asyncHandler(async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) throw new HttpError(400, 'studentId est requis');

  const student = await prisma.studentProfile.findUnique({ where: { id: studentId } });
  if (!student) throw new HttpError(404, 'Étudiant non trouvé');

  const existing = await prisma.financeStudentAccount.findUnique({ where: { studentId } });
  if (existing) return res.status(200).json({ ...existing, alreadyExisted: true });

  const account = await prisma.financeStudentAccount.create({ data: { studentId } });
  res.status(201).json(account);
}));

r.post('/accounts/bulk-create', asyncHandler(async (req, res) => {
  const { promotionId, mentionId } = req.body;
  if (!promotionId && !mentionId) throw new HttpError(400, 'promotionId ou mentionId est requis');

  const where = { status: 'ACTIVE' };
  if (promotionId) where.promotionId = promotionId;
  else where.mentionId = mentionId;

  const students = await prisma.studentProfile.findMany({ where });
  let created = 0;
  let skipped = 0;

  for (const student of students) {
    const exists = await prisma.financeStudentAccount.findUnique({ where: { studentId: student.id } });
    if (exists) { skipped++; continue; }
    await createStudentAccount(student.id);
    created++;
  }

  res.json({ created, skipped, total: students.length });
}));

// Synchronise les frais de toutes les grilles actives sur tous les comptes étudiants existants
r.post('/accounts/sync-fees', asyncHandler(async (req, res) => {
  const students = await prisma.studentProfile.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });

  let totalApplied = 0;
  for (const s of students) {
    const account = await createStudentAccount(s.id);
    const applied = await applyFeeGridsToAccount(account.id, s.id);
    totalApplied += applied;
  }

  res.json({ students: students.length, itemsCreated: totalApplied });
}));

// ─────────────────────────────────────────────────────────────
// ACCOUNT ITEMS
// ─────────────────────────────────────────────────────────────
r.post('/accounts/:studentId/items', asyncHandler(async (req, res) => {
  const { feeTypeId, label, amount, currency, dueDate, notes, academicYearId } = req.body;
  if (!feeTypeId || !label || amount == null) throw new HttpError(400, 'feeTypeId, label et amount sont requis');

  const account = await prisma.financeStudentAccount.findUnique({
    where: { studentId: req.params.studentId },
  });
  if (!account) throw new HttpError(404, 'Compte financier non trouvé — créez-le d\'abord');

  const item = await prisma.financeAccountItem.create({
    data: {
      accountId: account.id,
      feeTypeId,
      label,
      amount,
      currency: currency ?? 'MGA',
      dueDate: dueDate ? new Date(dueDate) : null,
      notes,
      academicYearId: academicYearId ?? null,
      status: 'UNPAID',
    },
    include: { feeType: { select: { id: true, name: true, code: true } } },
  });
  res.status(201).json(item);
}));

r.patch('/accounts/:studentId/items/:itemId', asyncHandler(async (req, res) => {
  const { label, amount, dueDate, notes } = req.body;
  const item = await prisma.financeAccountItem.update({
    where: { id: req.params.itemId },
    data: {
      label,
      amount,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes,
    },
  });
  res.json(item);
}));

r.delete('/accounts/:studentId/items/:itemId', asyncHandler(async (req, res) => {
  await prisma.financeAccountItem.delete({ where: { id: req.params.itemId } });
  res.status(204).end();
}));

r.patch('/accounts/:studentId/items/:itemId/not-applicable', asyncHandler(async (req, res) => {
  const item = await prisma.financeAccountItem.update({
    where: { id: req.params.itemId },
    data: { status: 'NOT_APPLICABLE' },
  });
  await auditLog({
    action: 'NOT_APPLICABLE',
    entityType: 'FinanceAccountItem',
    entityId: item.id,
    userId: req.user.sub,
    description: `Article marqué NON_APPLICABLE: ${item.label}`,
  });
  res.json(item);
}));

// ─────────────────────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────────────────────
r.get('/payments', asyncHandler(async (req, res) => {
  const { status, method, search, dateFrom, dateTo } = req.query;
  const { skip, take, page, limit } = paginate(req.query);

  const where = {};
  if (method) where.method = method;

  // Date range filter on paidAt
  if (dateFrom || dateTo) {
    where.paidAt = {};
    if (dateFrom) where.paidAt.gte = new Date(dateFrom);
    if (dateTo) where.paidAt.lte = new Date(dateTo);
  }

  // Status filter applies to the accountItem
  const itemWhere = {};
  if (status) itemWhere.status = status;

  if (search) {
    itemWhere.OR = [
      { label: { contains: search, mode: 'insensitive' } },
      { account: { student: { matricule: { contains: search, mode: 'insensitive' } } } },
      { account: { student: { user: { firstName: { contains: search, mode: 'insensitive' } } } } },
      { account: { student: { user: { lastName: { contains: search, mode: 'insensitive' } } } } },
    ];
  }

  if (Object.keys(itemWhere).length) {
    where.accountItem = itemWhere;
  }

  const [total, transactions] = await Promise.all([
    prisma.financeTransaction.count({ where }),
    prisma.financeTransaction.findMany({
      where,
      include: {
        accountItem: {
          select: {
            id: true, label: true, amount: true, amountPaid: true, status: true, currency: true,
            account: {
              select: {
                student: {
                  select: {
                    id: true, matricule: true,
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
      skip,
      take,
      orderBy: { paidAt: 'desc' },
    }),
  ]);

  res.json({ total, page, limit, data: transactions });
}));

r.post('/payments', asyncHandler(async (req, res) => {
  const { accountItemId, amount, method, reference, notes } = req.body;
  if (!accountItemId || amount == null) throw new HttpError(400, 'accountItemId et amount sont requis');
  if (amount <= 0) throw new HttpError(400, 'Le montant doit être positif');

  const result = await prisma.$transaction(async (tx) => {
    const accountItem = await tx.financeAccountItem.findUnique({
      where: { id: accountItemId },
    });
    if (!accountItem) throw new HttpError(404, 'Article financier non trouvé');
    if (accountItem.status === 'NOT_APPLICABLE') throw new HttpError(400, 'Cet article est marqué non applicable');
    if (accountItem.status === 'REFUNDED') throw new HttpError(400, 'Cet article a été remboursé');

    // Create the transaction
    const transaction = await tx.financeTransaction.create({
      data: {
        accountItemId,
        amount,
        currency: accountItem.currency,
        method: method ?? 'CASH',
        reference: reference ?? null,
        notes: notes ?? null,
        recordedById: req.user.sub,
        paidAt: new Date(),
      },
    });

    // Update amountPaid on the account item
    const newAmountPaid = (accountItem.amountPaid ?? 0) + amount;
    const newStatus = recalculateAccountItemStatus({ ...accountItem, amountPaid: newAmountPaid });

    const updatedItem = await tx.financeAccountItem.update({
      where: { id: accountItemId },
      data: { amountPaid: newAmountPaid, status: newStatus },
    });

    return { transaction, accountItem: updatedItem };
  });

  await auditLog({
    action: 'RECORD_PAYMENT',
    entityType: 'FinanceTransaction',
    entityId: result.transaction.id,
    userId: req.user.sub,
    description: `Paiement enregistré: ${amount} ${result.accountItem.currency} pour "${result.accountItem.label}"`,
  });

  res.status(201).json(result);
}));

r.patch('/payments/:transactionId/validate', asyncHandler(async (req, res) => {
  const transaction = await prisma.financeTransaction.findUnique({
    where: { id: req.params.transactionId },
    include: { accountItem: true },
  });
  if (!transaction) throw new HttpError(404, 'Transaction non trouvée');

  const accountItem = transaction.accountItem;
  if (accountItem.status === 'VALIDATED') throw new HttpError(400, 'Déjà validé');

  // Generate receipt number if not yet set
  let receiptNumber = accountItem.receiptNumber;
  if (!receiptNumber) {
    receiptNumber = await generateReceiptNumber();
  }

  const updatedItem = await prisma.financeAccountItem.update({
    where: { id: accountItem.id },
    data: {
      status: 'VALIDATED',
      validatedById: req.user.sub,
      validatedAt: new Date(),
      receiptNumber,
    },
  });

  await auditLog({
    action: 'VALIDATE',
    entityType: 'FinanceAccountItem',
    entityId: accountItem.id,
    userId: req.user.sub,
    description: `Paiement validé — reçu ${receiptNumber}`,
  });

  res.json({ transaction, accountItem: updatedItem });
}));

r.patch('/payments/:transactionId/refuse', asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const transaction = await prisma.financeTransaction.findUnique({
    where: { id: req.params.transactionId },
    include: { accountItem: true },
  });
  if (!transaction) throw new HttpError(404, 'Transaction non trouvée');

  const updatedItem = await prisma.financeAccountItem.update({
    where: { id: transaction.accountItemId },
    data: { status: 'REFUSED', refusedReason: reason ?? null },
  });

  await auditLog({
    action: 'REFUSE',
    entityType: 'FinanceAccountItem',
    entityId: transaction.accountItemId,
    userId: req.user.sub,
    description: `Paiement refusé: ${reason ?? 'Sans motif'}`,
  });

  res.json({ transaction, accountItem: updatedItem });
}));

r.patch('/payments/:transactionId/refund', asyncHandler(async (req, res) => {
  const transaction = await prisma.financeTransaction.findUnique({
    where: { id: req.params.transactionId },
    include: { accountItem: true },
  });
  if (!transaction) throw new HttpError(404, 'Transaction non trouvée');

  const updatedItem = await prisma.financeAccountItem.update({
    where: { id: transaction.accountItemId },
    data: { status: 'REFUNDED', amountPaid: 0 },
  });

  await auditLog({
    action: 'REFUND',
    entityType: 'FinanceAccountItem',
    entityId: transaction.accountItemId,
    userId: req.user.sub,
    description: `Remboursement: ${transaction.amount} ${transaction.currency}`,
  });

  res.json({ transaction, accountItem: updatedItem });
}));

r.post('/payments/:transactionId/receipt', asyncHandler(async (req, res) => {
  const transaction = await prisma.financeTransaction.findUnique({
    where: { id: req.params.transactionId },
    include: { accountItem: true },
  });
  if (!transaction) throw new HttpError(404, 'Transaction non trouvée');

  const accountItem = transaction.accountItem;
  let receiptNumber = accountItem.receiptNumber;
  if (!receiptNumber) {
    receiptNumber = await generateReceiptNumber();
  }

  const updatedItem = await prisma.financeAccountItem.update({
    where: { id: accountItem.id },
    data: {
      status: 'RECEIPT_ISSUED',
      receiptNumber,
      receiptIssuedAt: new Date(),
    },
  });

  await auditLog({
    action: 'ISSUE_RECEIPT',
    entityType: 'FinanceAccountItem',
    entityId: accountItem.id,
    userId: req.user.sub,
    description: `Reçu émis: ${receiptNumber}`,
  });

  res.json({ transaction, accountItem: updatedItem, receiptNumber });
}));

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────
r.get('/dashboard', asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalExpectedAgg,
    totalPaidAgg,
    pendingValidation,
    paymentsToday,
    paymentsWeek,
    paymentsMonth,
    byMentionRaw,
    byMethodRaw,
    overdueItems,
    recentPayments,
  ] = await Promise.all([
    // Total expected across all items (excluding NOT_APPLICABLE)
    prisma.financeAccountItem.aggregate({
      where: { status: { not: 'NOT_APPLICABLE' } },
      _sum: { amount: true },
    }),
    // Total paid
    prisma.financeAccountItem.aggregate({
      _sum: { amountPaid: true },
    }),
    // Items recorded but not yet validated
    prisma.financeAccountItem.count({ where: { status: 'RECORDED' } }),
    // Transactions today
    prisma.financeTransaction.aggregate({
      where: { paidAt: { gte: startOfDay } },
      _sum: { amount: true },
      _count: true,
    }),
    // Transactions this week
    prisma.financeTransaction.aggregate({
      where: { paidAt: { gte: startOfWeek } },
      _sum: { amount: true },
      _count: true,
    }),
    // Transactions this month
    prisma.financeTransaction.aggregate({
      where: { paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
      _count: true,
    }),
    // By mention: group account items by student mention
    prisma.financeAccountItem.groupBy({
      by: ['academicYearId'],
      _sum: { amount: true, amountPaid: true },
    }),
    // By payment method
    prisma.financeTransaction.groupBy({
      by: ['method'],
      _sum: { amount: true },
      _count: true,
    }),
    // Overdue items: unpaid items with dueDate in the past
    prisma.financeAccountItem.count({
      where: { status: 'UNPAID', dueDate: { lt: now } },
    }),
    // Recent payments
    prisma.financeTransaction.findMany({
      take: 10,
      orderBy: { paidAt: 'desc' },
      include: {
        accountItem: {
          select: {
            label: true, currency: true,
            account: {
              select: {
                student: {
                  select: {
                    matricule: true,
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const totalExpected = totalExpectedAgg._sum.amount ?? 0;
  const totalPaid = totalPaidAgg._sum.amountPaid ?? 0;

  res.json({
    totalExpected,
    totalPaid,
    totalUnpaid: totalExpected - totalPaid,
    paymentsToday: { amount: paymentsToday._sum.amount ?? 0, count: paymentsToday._count },
    paymentsWeek: { amount: paymentsWeek._sum.amount ?? 0, count: paymentsWeek._count },
    paymentsMonth: { amount: paymentsMonth._sum.amount ?? 0, count: paymentsMonth._count },
    pendingValidation,
    byAcademicYear: byMentionRaw,
    byMethod: byMethodRaw.map((m) => ({ method: m.method, amount: m._sum.amount ?? 0, count: m._count })),
    overdueItems,
    recentPayments,
  });
}));

// ─────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────
r.get('/reports/by-student', asyncHandler(async (req, res) => {
  const { search, promotionId, mentionId, academicYearId } = req.query;
  const { skip, take, page, limit } = paginate(req.query);

  const studentWhere = { status: 'ACTIVE' };
  if (promotionId) studentWhere.promotionId = promotionId;
  if (mentionId) studentWhere.mentionId = mentionId;
  if (search) {
    studentWhere.OR = [
      { matricule: { contains: search, mode: 'insensitive' } },
      { user: { firstName: { contains: search, mode: 'insensitive' } } },
      { user: { lastName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const itemWhere = {};
  if (academicYearId) itemWhere.academicYearId = academicYearId;

  const [total, accounts] = await Promise.all([
    prisma.financeStudentAccount.count({ where: { student: studentWhere } }),
    prisma.financeStudentAccount.findMany({
      where: { student: studentWhere },
      include: {
        student: {
          select: {
            id: true, matricule: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            promotion: { select: { id: true, name: true } },
            mention: { select: { id: true, name: true } },
          },
        },
        items: {
          where: Object.keys(itemWhere).length ? itemWhere : undefined,
          select: { amount: true, amountPaid: true, status: true, currency: true },
        },
      },
      skip,
      take,
    }),
  ]);

  const data = accounts.map((acc) => {
    const expected = acc.items.reduce((s, i) => s + (i.amount ?? 0), 0);
    const paid = acc.items.reduce((s, i) => s + (i.amountPaid ?? 0), 0);
    const byStatus = {};
    for (const item of acc.items) {
      byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
    }
    return {
      student: acc.student,
      totalExpected: expected,
      totalPaid: paid,
      totalUnpaid: expected - paid,
      collectionRate: expected > 0 ? Math.round((paid / expected) * 10000) / 100 : 0,
      itemCount: acc.items.length,
      byStatus,
    };
  });

  res.json({ total, page, limit, data });
}));

r.get('/reports/by-fee-type', asyncHandler(async (req, res) => {
  const { academicYearId } = req.query;
  const itemWhere = { status: { not: 'NOT_APPLICABLE' } };
  if (academicYearId) itemWhere.academicYearId = academicYearId;

  const feeTypes = await prisma.financeFeeType.findMany({
    where: { active: true },
    orderBy: { order: 'asc' },
  });

  const results = await Promise.all(
    feeTypes.map(async (ft) => {
      const agg = await prisma.financeAccountItem.aggregate({
        where: { ...itemWhere, feeTypeId: ft.id },
        _sum: { amount: true, amountPaid: true },
        _count: true,
      });
      return {
        feeType: { id: ft.id, name: ft.name, code: ft.code, category: ft.category },
        totalExpected: agg._sum.amount ?? 0,
        totalPaid: agg._sum.amountPaid ?? 0,
        totalUnpaid: (agg._sum.amount ?? 0) - (agg._sum.amountPaid ?? 0),
        studentCount: agg._count,
        collectionRate: agg._sum.amount
          ? Math.round(((agg._sum.amountPaid ?? 0) / agg._sum.amount) * 10000) / 100
          : 0,
      };
    })
  );

  res.json(results.filter((r) => r.studentCount > 0));
}));

r.get('/reports/collection-rate', asyncHandler(async (req, res) => {
  const { academicYearId, promotionId } = req.query;

  const studentWhere = { status: 'ACTIVE' };
  if (promotionId) studentWhere.promotionId = promotionId;

  const itemWhere = { status: { not: 'NOT_APPLICABLE' } };
  if (academicYearId) itemWhere.academicYearId = academicYearId;

  // Compute per-promotion aggregation if no specific promotion
  if (!promotionId) {
    const promotions = await prisma.promotion.findMany({
      select: { id: true, name: true, mention: { select: { name: true } } },
    });

    const rows = await Promise.all(
      promotions.map(async (promo) => {
        const agg = await prisma.financeAccountItem.aggregate({
          where: {
            ...itemWhere,
            account: { student: { promotionId: promo.id } },
          },
          _sum: { amount: true, amountPaid: true },
          _count: true,
        });
        return {
          promotion: { id: promo.id, name: promo.name, mention: promo.mention?.name },
          totalExpected: agg._sum.amount ?? 0,
          totalPaid: agg._sum.amountPaid ?? 0,
          totalUnpaid: (agg._sum.amount ?? 0) - (agg._sum.amountPaid ?? 0),
          studentCount: agg._count,
          collectionRate: agg._sum.amount
            ? Math.round(((agg._sum.amountPaid ?? 0) / agg._sum.amount) * 10000) / 100
            : 0,
        };
      })
    );

    return res.json(rows.filter((r) => r.studentCount > 0));
  }

  // Single promotion detail
  const agg = await prisma.financeAccountItem.aggregate({
    where: {
      ...itemWhere,
      account: { student: { promotionId } },
    },
    _sum: { amount: true, amountPaid: true },
    _count: true,
  });

  res.json({
    promotionId,
    academicYearId: academicYearId ?? null,
    totalExpected: agg._sum.amount ?? 0,
    totalPaid: agg._sum.amountPaid ?? 0,
    totalUnpaid: (agg._sum.amount ?? 0) - (agg._sum.amountPaid ?? 0),
    studentCount: agg._count,
    collectionRate: agg._sum.amount
      ? Math.round(((agg._sum.amountPaid ?? 0) / agg._sum.amount) * 10000) / 100
      : 0,
  });
}));

// ─────────────────────────────────────────────────────────────
// SETTINGS — Categories, Currencies, Accounting Accounts, Cash Registers, Fiscal Years
// ─────────────────────────────────────────────────────────────

function makeCrudRoutes(path, model, orderBy = [{ name: 'asc' }]) {
  r.get(path, asyncHandler(async (req, res) => {
    res.json(await prisma[model].findMany({ orderBy }));
  }));
  r.post(path, asyncHandler(async (req, res) => {
    res.status(201).json(await prisma[model].create({ data: req.body }));
  }));
  r.put(`${path}/:id`, asyncHandler(async (req, res) => {
    res.json(await prisma[model].update({ where: { id: req.params.id }, data: req.body }));
  }));
  r.delete(`${path}/:id`, asyncHandler(async (req, res) => {
    await prisma[model].delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }));
}

makeCrudRoutes('/settings/categories',           'financeFeeCategory',       [{ order: 'asc' }, { name: 'asc' }]);
makeCrudRoutes('/settings/currencies',           'financeCurrency',          [{ name: 'asc' }]);
makeCrudRoutes('/settings/accounting-accounts',  'financeAccountingAccount', [{ code: 'asc' }]);
makeCrudRoutes('/settings/cash-registers',       'financeCashRegister',      [{ name: 'asc' }]);
makeCrudRoutes('/settings/fiscal-years',         'financeFiscalYear',        [{ startDate: 'desc' }]);

// Default currency (for display)
r.get('/settings/currencies/default', asyncHandler(async (req, res) => {
  const cur = await prisma.financeCurrency.findFirst({ where: { isDefault: true } });
  res.json(cur ?? { code: 'MGA', symbol: 'Ar', name: 'Ariary malgache' });
}));

// ─────────────────────────────────────────────────────────────
// INTEGRATION — Check payment status for other modules
// ─────────────────────────────────────────────────────────────

// Called by other modules to check if a student can proceed (exams, cards, diplomas)
r.get('/check/:studentId', asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { feeTypeCode, strict } = req.query;

  const account = await prisma.financeStudentAccount.findUnique({
    where: { studentId },
    include: {
      items: {
        include: { feeType: { select: { code: true, name: true, mandatory: true } } },
      },
    },
  });

  if (!account) return res.json({ allowed: !strict, reason: 'Aucun compte financier', items: [] });

  let items = account.items.filter(i => i.status !== 'NOT_APPLICABLE');

  if (feeTypeCode) {
    items = items.filter(i => i.feeType?.code === feeTypeCode);
  } else {
    items = items.filter(i => i.feeType?.mandatory);
  }

  const unpaid = items.filter(i => !['VALIDATED', 'RECEIPT_ISSUED'].includes(i.status));
  const allowed = unpaid.length === 0;

  res.json({
    allowed,
    reason: allowed ? null : `${unpaid.length} frais obligatoire(s) non payé(s)`,
    unpaidCount: unpaid.length,
    items: items.map(i => ({
      label: i.label, feeType: i.feeType?.name, status: i.status, amount: i.amount, amountPaid: i.amountPaid,
    })),
  });
}));

// Audit log
r.get('/audit', asyncHandler(async (req, res) => {
  const { limit = '100', page = '1' } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const logs = await prisma.financeAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit, 10),
    skip,
  });
  res.json(logs);
}));

// Auto-create account on enrollment (called from inscriptions module)
r.post('/accounts/auto-create/:studentId', asyncHandler(async (req, res) => {
  const account = await createStudentAccount(req.params.studentId);
  await auditLog({ action: 'AUTO_CREATE_ACCOUNT', entityType: 'FinanceStudentAccount', entityId: account.id, userId: req.user?.id, description: 'Compte créé automatiquement à l\'inscription' });
  res.status(201).json(account);
}));

export default r;
