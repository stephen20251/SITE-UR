import { Router } from 'express';
import { prisma } from '../../database/prisma.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParam, listQuery, updateUserBody, changeRoleBody } from './users.schemas.js';

const router = Router();
const PUBLIC_FIELDS = {
  id: true, email: true, firstName: true, lastName: true, role: true,
  system: true, isActive: true, avatarUrl: true, phone: true,
  createdAt: true, updatedAt: true,
};

router.use(authenticate);

// List — admin only
router.get('/', requireRole('ADMIN'), validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const { page, limit, role, system, q } = req.query;
  const where = {
    deletedAt: null,
    ...(role   && { role }),
    ...(system && { system }),
    ...(q && {
      OR: [
        { email:     { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName:  { contains: q, mode: 'insensitive' } },
      ],
    }),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where, select: PUBLIC_FIELDS,
      skip: (page - 1) * limit, take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);
  res.json({ items, total, page, limit });
}));

// Get — admin or self
router.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  if (req.user.role !== 'ADMIN' && req.user.sub !== req.params.id) {
    throw new HttpError(403, 'Forbidden');
  }
  const user = await prisma.user.findFirst({
    where: { id: req.params.id, deletedAt: null },
    select: PUBLIC_FIELDS,
  });
  if (!user) throw new HttpError(404, 'User not found');
  res.json(user);
}));

// Update — admin or self
router.patch('/:id',
  validate({ params: idParam, body: updateUserBody }),
  asyncHandler(async (req, res) => {
    const isSelf  = req.user.sub === req.params.id;
    const isAdmin = req.user.role === 'ADMIN';
    if (!isSelf && !isAdmin) throw new HttpError(403, 'Forbidden');
    // Only admin can change isActive
    if (!isAdmin && 'isActive' in req.body) {
      throw new HttpError(403, 'Only admin can change isActive');
    }
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: req.body,
      select: PUBLIC_FIELDS,
    });
    res.json(updated);
  }),
);

// Soft delete — admin only
router.delete('/:id', requireRole('ADMIN'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await prisma.user.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date(), isActive: false },
  });
  res.status(204).end();
}));

// Change role — admin only
router.patch('/:id/role',
  requireRole('ADMIN'),
  validate({ params: idParam, body: changeRoleBody }),
  asyncHandler(async (req, res) => {
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: req.body.role },
      select: PUBLIC_FIELDS,
    });
    res.json(updated);
  }),
);

export default router;
