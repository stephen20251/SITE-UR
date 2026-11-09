import { Router } from 'express';
import { authenticate, requireSystem, requireRole } from '../../middlewares/auth.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';
import { prisma } from '../../database/prisma.js';
import { slugify } from '../../utils/slug.js';
import coursesRoutes from './courses.routes.js';
import curriculumRoutes from './curriculum.routes.js';
import enrollmentRoutes from './enrollment.routes.js';
import quizzesRoutes from './quizzes.routes.js';
import liveSessionsRoutes from './live-sessions.routes.js';
import assignmentsRoutes from './assignments.routes.js';
import learningPathsRoutes from './learning-paths.routes.js';
import activityRoutes from './activity.routes.js';
import reviewsRoutes from './reviews.routes.js';
import qaRoutes from './qa.routes.js';
import notesRoutes from './notes.routes.js';
import wishlistRoutes from './wishlist.routes.js';
import couponRoutes from './coupon.routes.js';
import subscriptionRoutes from './subscription.routes.js';
import announcementsRoutes from './announcements.routes.js';

const router = Router();

router.use(authenticate, requireSystem('ONLINE'));

// Catégorie saisie par l'enseignant (« Autre ») : réutilise une catégorie existante
// du même nom, sinon la crée.
router.post('/categories', requireRole('TEACHER_ONLINE'), asyncHandler(async (req, res) => {
  const name = String(req.body?.name ?? '').trim().slice(0, 60);
  if (name.length < 2) throw new HttpError(400, 'Nom de catégorie trop court');
  const slug = slugify(name);
  const existing = await prisma.onlineCategory.findFirst({
    where: { OR: [{ slug }, { name: { equals: name } }] },
  });
  res.status(existing ? 200 : 201).json(existing ?? await prisma.onlineCategory.create({ data: { name, slug, icon: '📘' } }));
}));

router.use('/courses', coursesRoutes);
router.use('/', curriculumRoutes);
router.use('/', enrollmentRoutes);
router.use('/', quizzesRoutes);
router.use('/', liveSessionsRoutes);
router.use('/', assignmentsRoutes);
router.use('/', learningPathsRoutes);
router.use('/', activityRoutes);
router.use('/', reviewsRoutes);
router.use('/', qaRoutes);
router.use('/', notesRoutes);
router.use('/', wishlistRoutes);
router.use('/', couponRoutes);
router.use('/', subscriptionRoutes);
router.use('/', announcementsRoutes);

export default router;
