import { env } from './env.js';

// Origines autorisées à appeler l'API (HTTP et Socket.io) : la liste CORS_ORIGIN.
// En développement, tout port de localhost est accepté aussi : le serveur Vite
// change de port (8080 → 8081…) quand le sien est pris.
const allowList = env.CORS_ORIGIN.trim() === '*' ? null : env.CORS_ORIGIN.split(',').map((s) => s.trim().replace(/\/+$/, ''));
const devLocal = env.NODE_ENV !== 'production';

export const corsOrigin = allowList === null
  ? true
  : (origin, cb) => {
      const isLocal = devLocal && origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      cb(null, !origin || isLocal || allowList.includes(origin));
    };
