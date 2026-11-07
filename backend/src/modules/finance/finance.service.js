import { prisma } from '../../database/prisma.js'
import { HttpError } from '../../utils/asyncHandler.js'

export const listFees = async (req, res) => {
  const fees = await prisma.feeStructure.findMany({
    where: req.query.promotionId ? { promotionId: req.query.promotionId } : {},
    include: { promotion: { select: { id: true, name: true } }, academicYear: { select: { label: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(fees)
}

export const createFee = async (req, res) => {
  const fee = await prisma.feeStructure.create({ data: req.body })
  res.status(201).json(fee)
}

export const updateFee = async (req, res) => {
  const fee = await prisma.feeStructure.update({ where: { id: req.params.id }, data: req.body })
  res.json(fee)
}

export const listInvoices = async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query
  const where = {}
  if (status) where.status = status
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { student: { user: { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] } } },
    ]
  }
  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where, include: {
        student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        feeStructure: { select: { name: true } },
        payments: true,
      },
      skip: (Number(page) - 1) * Number(limit), take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
  ])
  res.json({ total, invoices })
}

export const myInvoices = async (req, res) => {
  const sp = await prisma.studentProfile.findUnique({ where: { userId: req.user.sub } })
  if (!sp) return res.json([])   // non-student roles have no personal invoices
  const invoices = await prisma.invoice.findMany({
    where: { studentId: sp.id },
    include: { payments: true, feeStructure: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(invoices)
}

export const getInvoice = async (req, res) => {
  const inv = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      student: { include: { user: { select: { firstName: true, lastName: true, email: true } }, promotion: true } },
      feeStructure: true, payments: true,
    },
  })
  if (!inv) throw new HttpError(404, 'Facture non trouvée')
  res.json(inv)
}

export const createInvoice = async (req, res) => {
  const count = await prisma.invoice.count()
  const invoiceNumber = `INV-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`
  const inv = await prisma.invoice.create({ data: { ...req.body, invoiceNumber } })
  res.status(201).json(inv)
}

export const bulkCreateInvoices = async (req, res) => {
  // Create invoices for all students in a promotion
  const { promotionId, feeStructureId, title, amount, currency, dueDate } = req.body
  const students = await prisma.studentProfile.findMany({ where: { promotionId, status: 'ACTIVE' } })
  const count = await prisma.invoice.count()

  const invoices = await prisma.$transaction(
    students.map((s, i) => prisma.invoice.create({
      data: {
        studentId: s.id, feeStructureId, title, amount, currency: currency ?? 'MGA',
        dueDate: new Date(dueDate),
        invoiceNumber: `INV-${new Date().getFullYear()}-${(count + i + 1).toString().padStart(4, '0')}`,
        status: 'PENDING',
      },
    }))
  )
  res.status(201).json({ created: invoices.length })
}

export const listPayments = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  const where = status ? { status } : {}
  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
        invoice: { select: { invoiceNumber: true, title: true } },
      },
      skip: (Number(page) - 1) * Number(limit), take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
  ])
  res.json({ total, payments })
}

export const recordPayment = async (req, res) => {
  const count = await prisma.payment.count()
  const receiptNumber = `REC-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`
  const payment = await prisma.payment.create({
    data: { ...req.body, receiptNumber, recordedBy: req.user.sub, paidAt: new Date(), status: 'PAID' },
  })
  // Update invoice status
  if (req.body.invoiceId) {
    const inv = await prisma.invoice.findUnique({ where: { id: req.body.invoiceId }, include: { payments: true } })
    if (inv) {
      const paid = inv.payments.reduce((sum, p) => sum + p.amount, 0) + req.body.amount
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { status: paid >= inv.amount ? 'PAID' : 'PARTIAL' },
      })
    }
  }
  res.status(201).json(payment)
}

export const validatePayment = async (req, res) => {
  const p = await prisma.payment.update({ where: { id: req.params.id }, data: { status: 'PAID' } })
  res.json(p)
}

export const cancelPayment = async (req, res) => {
  const p = await prisma.payment.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } })
  res.json(p)
}

export const financeSummary = async (req, res) => {
  const [totalInvoiced, totalPaid, pending, overdue] = await Promise.all([
    prisma.invoice.aggregate({ _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    prisma.invoice.count({ where: { status: 'PENDING' } }),
    prisma.invoice.count({ where: { status: 'OVERDUE' } }),
  ])
  res.json({
    totalInvoiced: totalInvoiced._sum.amount ?? 0,
    totalPaid: totalPaid._sum.amount ?? 0,
    pendingCount: pending,
    overdueCount: overdue,
    currency: 'MGA',
  })
}
