import { prisma } from '../../database/prisma.js';
import { HttpError } from '../../utils/asyncHandler.js';
import { randomUUID } from 'crypto';

// ─── Fee structures ───

export function listFees() {
  return prisma.feeStructure.findMany({ orderBy: [{ academicYear: 'desc' }, { name: 'asc' }] });
}

export function createFee(data) {
  return prisma.feeStructure.create({ data });
}

export function deleteFee(id) {
  return prisma.feeStructure.delete({ where: { id } });
}

// ─── Payments ───

const STUDENT_INCLUDE = {
  student: { select: { id: true, firstName: true, lastName: true, email: true } },
  fee: { select: { id: true, name: true, academicYear: true, amount: true, currency: true } },
};

export async function myPayments(user) {
  // student sees their own; parent sees children's payments
  if (user.role === 'STUDENT_CLASSROOM') {
    return prisma.payment.findMany({
      where: { studentId: user.sub },
      include: STUDENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }
  if (user.role === 'PARENT') {
    const links = await prisma.parentLink.findMany({
      where: { parentId: user.sub },
      select: { childId: true },
    });
    const childIds = links.map((l) => l.childId);
    return prisma.payment.findMany({
      where: { studentId: { in: childIds } },
      include: STUDENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }
  throw new HttpError(403, 'Forbidden');
}

export function listPayments({ studentId, status, page = 1, limit = 50 }) {
  const skip = (page - 1) * limit;
  const where = {
    ...(studentId ? { studentId } : {}),
    ...(status ? { status } : {}),
  };
  return Promise.all([
    prisma.payment.findMany({ where, include: STUDENT_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.payment.count({ where }),
  ]).then(([items, total]) => ({ items, total, page, limit }));
}

export async function createPayment(data) {
  const invoiceNumber = `INV-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  return prisma.payment.create({
    data: { ...data, invoiceNumber, dueDate: data.dueDate ? new Date(data.dueDate) : undefined },
    include: STUDENT_INCLUDE,
  });
}

export async function updatePayment(id, patch) {
  const pay = await prisma.payment.findUnique({ where: { id } });
  if (!pay) throw new HttpError(404, 'Payment not found');
  return prisma.payment.update({
    where: { id },
    data: {
      ...patch,
      paidAt: patch.paidAt ? new Date(patch.paidAt) : patch.status === 'PAID' ? new Date() : undefined,
    },
    include: STUDENT_INCLUDE,
  });
}

export function financeOverview() {
  return Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID' } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } } }),
    prisma.payment.count({ where: { status: 'OVERDUE' } }),
    prisma.payment.count(),
  ]).then(([paid, pending, overdue, total]) => ({
    totalPaid: paid._sum.amount ?? 0,
    totalPending: pending._sum.amount ?? 0,
    overdueCount: overdue,
    totalPayments: total,
  }));
}
