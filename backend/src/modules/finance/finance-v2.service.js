import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Generate a unique receipt number: REC-{YEAR}-{000001}
 */
export async function generateReceiptNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.financeAccountItem.count({
    where: { receiptNumber: { not: null } },
  });
  return `REC-${year}-${(count + 1).toString().padStart(6, '0')}`;
}

/**
 * Recalculate the status of a FinanceAccountItem based on amountPaid vs amount.
 * Call this after updating amountPaid on an item.
 * Returns the new FinanceItemStatus string.
 */
export function recalculateAccountItemStatus(item) {
  if (item.status === 'NOT_APPLICABLE' || item.status === 'REFUNDED') {
    return item.status;
  }
  const paid = item.amountPaid ?? 0;
  const total = item.amount ?? 0;
  if (paid <= 0) return 'UNPAID';
  if (paid >= total) return 'RECORDED';
  // Partial payment: keep UNPAID until full
  return 'UNPAID';
}

/**
 * Create a FinanceStudentAccount for a student if it doesn't exist yet.
 * On first creation, auto-apply any matching fee grids (by promotion/mention/year).
 * Returns the account (existing or newly created).
 */
export async function createStudentAccount(studentId) {
  const existing = await prisma.financeStudentAccount.findUnique({ where: { studentId } });
  if (existing) return existing;

  const account = await prisma.financeStudentAccount.create({ data: { studentId } });

  // Auto-apply matching fee grids
  await applyFeeGridsToAccount(account.id, studentId);

  return account;
}

/**
 * Find and apply all matching fee grids to one student account.
 * Skips grid items already applied (deduped by gridItemId).
 */
export async function applyFeeGridsToAccount(accountId, studentId) {
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { mentionId: true, promotionId: true, promotion: { select: { academicYearId: true } } },
  });
  if (!student?.promotion?.academicYearId) return 0;

  const grids = await prisma.financeFeeGrid.findMany({
    where: {
      academicYearId: student.promotion.academicYearId,
      active: true,
      OR: [
        { promotionId: student.promotionId },
        { mentionId: student.mentionId, promotionId: null },
        { mentionId: null, promotionId: null },
      ],
    },
    include: { items: true },
  });

  let applied = 0;
  for (const grid of grids) {
    for (const gridItem of grid.items) {
      const exists = await prisma.financeAccountItem.findFirst({
        where: { accountId, gridItemId: gridItem.id },
      });
      if (exists) continue;
      const feeType = await prisma.financeFeeType.findUnique({ where: { id: gridItem.feeTypeId } });
      await prisma.financeAccountItem.create({
        data: {
          accountId,
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
  return applied;
}

/**
 * Write a finance audit log entry.
 */
export async function auditLog({ action, entityType, entityId, userId, description }) {
  return prisma.financeAuditLog.create({
    data: { action, entityType, entityId, userId: userId ?? null, description: description ?? null },
  });
}
