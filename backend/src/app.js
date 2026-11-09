import path from 'path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.js';

// Core
import authRoutes from './modules/auth/auth.routes.js';
import chatRoutes from './modules/chat/chat.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';

// Online subsystem (Coursera-like — untouched)
import onlineRoutes from './modules/online/online.routes.js';
import onlinePublicRoutes from './modules/online/online-public.routes.js';
import lmsAdminRoutes from './modules/online/lms-admin.routes.js';
import studioRoutes from './modules/online/studio.routes.js';
import paymentRoutes from './modules/online/payment.routes.js';
import pricingRoutes from './modules/online/pricing.routes.js';

// ERP modules
import adminRoutes from './modules/admin/admin.routes.js';
import classroomRoutes from './modules/classroom/classroom.routes.js';
import structureRoutes from './modules/structure/structure.routes.js';
import candidatesRoutes from './modules/candidates/candidates.routes.js';
import coursesRoutes from './modules/courses/courses.routes.js';
import gradesRoutes from './modules/grades/grades.routes.js';
import financeRoutes from './modules/finance/finance.routes.js';
import financeV2Routes from './modules/finance/finance-v2.routes.js';
import hrRoutes from './modules/hr/hr.routes.js';
import announcementsRoutes from './modules/announcements/announcements.routes.js';
import documentsRoutes from './modules/documents/documents.routes.js';
import lettersRoutes from './modules/letters/letters.routes.js';
import cardsRoutes from './modules/cards/cards.routes.js';
import scheduleRoutes from './modules/schedule/schedule.routes.js';
import erpChatRoutes from './modules/chat/erp-chat.routes.js';
import meContextRoutes from './modules/me/me.context.routes.js';
import meUploadRoutes from './modules/me/me.upload.routes.js';
import eventsRoutes from './modules/events/events.routes.js';
import newsRoutes from './modules/news/news.routes.js';
import facultyRoutes from './modules/faculty/faculty.routes.js';
import brandingRoutes from './modules/branding/branding.routes.js';
import inscriptionsRoutes from './modules/inscriptions/inscriptions.routes.js';
import affectationRoutes from './modules/affectation/affectation.routes.js';
import designerRoutes from './modules/designer/designer.routes.js';
import cursusRoutes from './modules/cursus/cursus.routes.js';
import { mediaRouter, blockProtectedUploads } from './modules/cursus/media.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  // CORS: the env allow-list, plus any localhost/127.0.0.1 port in dev — the
  // Vite dev server hops ports (5173 → 8081…) when its default is taken.
  const allowList = env.CORS_ORIGIN === '*' ? null : env.CORS_ORIGIN.split(',').map((s) => s.trim());
  app.use(cors({
    origin: allowList === null
      ? true
      : (origin, cb) => {
          const isLocal = origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
          cb(null, !origin || isLocal || allowList.includes(origin));
        },
    credentials: true,
  }));
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.use(rateLimit({ windowMs: 60_000, max: 500, standardHeaders: true, legacyHeaders: false }));

  app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now(), version: 'ERP v2.0' }));

  // Contenu des cours du cursus : pas d'accès direct, uniquement via /api/media (URL signée)
  app.use('/uploads/lessons', blockProtectedUploads);
  app.use('/api/media', mediaRouter);

  // Static uploads (avatars, signatures) — allow cross-origin loading for <img> tags
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(path.resolve('uploads')));

  // Auth
  app.use('/api/auth', authRoutes);

  // LMS Admin — accessible to SUPER_ADMIN regardless of system token
  app.use('/api/lms-admin', lmsAdminRoutes);

  // Online subsystem (isolated, JWT system=ONLINE required)
  app.use('/api/online/public', onlinePublicRoutes);
  app.use('/api/online/studio', studioRoutes);
  app.use('/api/online/payments', paymentRoutes);
  app.use('/api/online/pricing', pricingRoutes);
  app.use('/api/online', onlineRoutes);

  // ERP Classroom — University Management
  app.use('/api/classroom', classroomRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/structure', structureRoutes);
  app.use('/api/candidates', candidatesRoutes);
  app.use('/api/courses', coursesRoutes);
  app.use('/api/grades', gradesRoutes);
  app.use('/api/finance', financeRoutes);
  app.use('/api/finance/v2', financeV2Routes);
  app.use('/api/hr', hrRoutes);
  app.use('/api/cursus', cursusRoutes);

  // Documents & Letters
  app.use('/api/documents', documentsRoutes);
  app.use('/api/letters', lettersRoutes);
  app.use('/api/cards', cardsRoutes);
  app.use('/api/me', meContextRoutes);
  app.use('/api/me', meUploadRoutes);
  app.use('/api/branding', brandingRoutes);
  app.use('/api/designer', designerRoutes);
  app.use('/api/inscriptions', inscriptionsRoutes);
  app.use('/api/affectation', affectationRoutes);

  // Communication
  app.use('/api/announcements', announcementsRoutes);
  app.use('/api/events', eventsRoutes);
  app.use('/api/news', newsRoutes);
  app.use('/api/faculty', facultyRoutes);
  app.use('/api/schedule', scheduleRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/erp-chat', erpChatRoutes);
  app.use('/api/notifications', notificationsRoutes);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
  return app;
}
