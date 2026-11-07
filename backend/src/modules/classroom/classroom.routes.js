import { Router } from 'express';
import { authenticate, requireSystem } from '../../middlewares/auth.js';
import departmentsRoutes from './departments.routes.js';
import classesRoutes from './classes.routes.js';
import peopleRoutes from './people.routes.js';
import attendanceRoutes from './attendance.routes.js';
import gradesRoutes from './grades.routes.js';
import announcementsRoutes from './announcements.routes.js';
import meRoutes from './me.routes.js';
import reportsRoutes from './reports.routes.js';
import financeRoutes from './finance.routes.js';

// Aggregates the CLASSROOM subsystem under /api/classroom.
// Every route requires a valid JWT and a CLASSROOM-system user; finer role
// checks are applied per-route in the sub-routers.
const router = Router();
router.use(authenticate, requireSystem('CLASSROOM'));

router.use('/departments', departmentsRoutes);
router.use('/classes', classesRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/grades', gradesRoutes);
router.use('/announcements', announcementsRoutes);
router.use('/me', meRoutes);
router.use('/reports', reportsRoutes);
router.use('/finance', financeRoutes);
router.use('/', peopleRoutes); // /students, /teachers (distinct paths, no overlap)

export default router;
