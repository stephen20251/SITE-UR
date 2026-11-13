import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { corsOrigin } from './config/cors.js';
import { disconnectPrisma } from './database/prisma.js';
import { registerIO } from './realtime/events.js';
import { initSocket } from './socket/index.js';
import { startReminderJob } from './jobs/reminders.js';
import { startTuitionReminderJob } from './jobs/tuition-reminders.js';
import { startCleanupJob } from './jobs/cleanup.js';
import { syncCurriculumSubjects } from './modules/structure/subject-sync.js';

const app = createApp();
const server = http.createServer(app);

// ─── Socket.io (Phase 5: auth, presence, chat rooms, notifications) ───
// Même règle CORS que l'API HTTP (src/config/cors.js).
const io = new SocketIOServer(server, {
  cors: { origin: corsOrigin, credentials: true },
});

// Expose io to services (notifications, chat fan-out, course:published, …) without
// forcing them to import server.js — see src/realtime/events.js.
registerIO(io);
// Authentication + presence + chat handlers.
initSocket(io);

export { io };

server.listen(env.PORT, () => {
  console.log(`🚀 University System backend on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});

const shutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down...`);
  io.close();
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
};
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startReminderJob();
startTuitionReminderJob();
startCleanupJob();
// Rattache aux matières les cours du cursus créés avant la liaison cursus ↔ matières.
syncCurriculumSubjects().catch((err) => console.error('Liaison cursus ↔ matières :', err.message));
