import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { registerSchema, registerCandidateSchema, loginSchema, refreshSchema, forgotPasswordSchema } from './auth.schemas.js';
import * as svc from './auth.service.js';
import { prisma } from '../../database/prisma.js';

const router = Router();

const tooMany = (what) => ({ error: `Trop de tentatives de ${what} en peu de temps. Patientez quelques minutes puis réessayez.` });
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany('connexion'),
});
// Inscription : un établissement peut inscrire beaucoup d'élèves depuis le même réseau.
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany('création de compte'),
});
// Connexion : compté par adresse e-mail (et non par réseau partagé).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}|${String(req.body?.email ?? '').toLowerCase().trim()}`,
  message: tooMany('connexion'),
});

router.post('/register', signupLimiter, validate({ body: registerSchema }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.register(req.body));
}));

router.post('/register-candidate', signupLimiter, validate({ body: registerCandidateSchema }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.registerCandidate(req.body));
}));

// Liste publique des mentions (formulaire de candidature)
router.get('/mentions', asyncHandler(async (req, res) => {
  res.json(await prisma.mention.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true, level: true }, orderBy: { name: 'asc' } }));
}));

router.post('/login', loginLimiter, validate({ body: loginSchema }), asyncHandler(async (req, res) => {
  res.json(await svc.login(req.body));
}));

router.post('/refresh', validate({ body: refreshSchema }), asyncHandler(async (req, res) => {
  res.json(await svc.refresh(req.body.refreshToken));
}));

router.post('/logout', validate({ body: refreshSchema }), asyncHandler(async (req, res) => {
  res.json(await svc.logout(req.body.refreshToken));
}));

// Mot de passe : changement (connecté), oubli (lien par e-mail), réinitialisation
router.post('/change-password', authenticate, authLimiter, asyncHandler(async (req, res) => {
  res.json(await svc.changePassword(req.user.sub, req.body ?? {}));
}));

router.post('/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), asyncHandler(async (req, res) => {
  res.json(await svc.forgotPassword(req.body.email));
}));

router.post('/reset-password', authLimiter, asyncHandler(async (req, res) => {
  res.json(await svc.resetPassword(req.body ?? {}));
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json(await svc.me(req.user.sub));
}));

export default router;
