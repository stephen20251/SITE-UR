import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { registerSchema, registerCandidateSchema, loginSchema, refreshSchema } from './auth.schemas.js';
import * as svc from './auth.service.js';
import { prisma } from '../../database/prisma.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.register(req.body));
}));

router.post('/register-candidate', authLimiter, validate({ body: registerCandidateSchema }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.registerCandidate(req.body));
}));

// Liste publique des mentions (formulaire de candidature)
router.get('/mentions', asyncHandler(async (req, res) => {
  res.json(await prisma.mention.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true, level: true }, orderBy: { name: 'asc' } }));
}));

router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(async (req, res) => {
  res.json(await svc.login(req.body));
}));

router.post('/refresh', validate({ body: refreshSchema }), asyncHandler(async (req, res) => {
  res.json(await svc.refresh(req.body.refreshToken));
}));

router.post('/logout', validate({ body: refreshSchema }), asyncHandler(async (req, res) => {
  res.json(await svc.logout(req.body.refreshToken));
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json(await svc.me(req.user.sub));
}));

export default router;
