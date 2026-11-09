import { HttpError } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

// eslint-disable-next-line no-unused-vars
export function errorMiddleware(err, req, res, next) {
  if (err?.name === 'ZodError') {
    return res.status(400).json({ error: 'ValidationError', details: err.flatten?.() ?? err.errors });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  // Erreurs métier levées sous forme d'objet simple : throw { status, message }
  if (err && !(err instanceof Error) && Number.isInteger(err.status) && err.message) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  if (err?.name === 'MulterError') {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux' : err.message });
  }
  // Prisma known errors
  if (err?.code === 'P2002') {
    return res.status(409).json({ error: 'Unique constraint violation', details: err.meta });
  }
  if (err?.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }
  console.error('[error]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    ...(env.NODE_ENV !== 'production' && { message: err?.message }),
  });
}

export function notFoundMiddleware(req, res) {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
}
