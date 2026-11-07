import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import { prisma } from '../../database/prisma.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';
import { isProtectedCourse, verifyMediaToken } from './cursus.access.js';

// Contenu des cours du cursus : non téléchargeable, non partageable.
// Les fichiers ne sont servis qu'au travers d'une URL signée, courte durée,
// liée à l'utilisateur (délivrée par la fiche du cours après contrôle d'accès).
const UPLOADS = path.resolve('uploads');

function localPath(url) {
  if (!url?.startsWith('/uploads/')) return null;
  const p = path.resolve(UPLOADS, url.slice('/uploads/'.length));
  return p.startsWith(UPLOADS) && fs.existsSync(p) ? p : null;
}

function sendInline(res, file, mimeType) {
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (mimeType) res.type(mimeType);
  res.sendFile(file); // gère les requêtes Range (lecture vidéo)
}

export const mediaRouter = Router();

mediaRouter.get('/:kind/:id', asyncHandler(async (req, res) => {
  const { kind, id } = req.params;
  try {
    verifyMediaToken(String(req.query.t ?? ''), kind, id);
  } catch {
    throw new HttpError(403, 'Lien expiré ou invalide — rouvrez la leçon.');
  }
  let url = null;
  let mimeType = null;
  if (kind === 'f') {
    const f = await prisma.lessonFile.findUnique({ where: { id }, select: { url: true, mimeType: true } });
    url = f?.url; mimeType = f?.mimeType;
  } else if (kind === 'l') {
    const l = await prisma.onlineLesson.findUnique({ where: { id }, select: { contentUrl: true } });
    url = l?.contentUrl;
  }
  const file = localPath(url);
  if (!file) throw new HttpError(404, 'Fichier introuvable');
  sendInline(res, file, mimeType);
}));

// Bloque l'accès direct (/uploads/lessons/…) aux fichiers des cours protégés.
export async function blockProtectedUploads(req, res, next) {
  try {
    const url = `/uploads/lessons${decodeURIComponent(req.path)}`;
    const [file, lesson] = await Promise.all([
      prisma.lessonFile.findFirst({
        where: { url },
        select: { allowDownload: true, lesson: { select: { module: { select: { course: { select: { courseKind: true } } } } } } },
      }),
      prisma.onlineLesson.findFirst({
        where: { contentUrl: url },
        select: { allowDownload: true, module: { select: { course: { select: { courseKind: true } } } } },
      }),
    ]);
    const course = file?.lesson.module.course ?? lesson?.module.course;
    const locked = (course && isProtectedCourse(course)) || file?.allowDownload === false || lesson?.allowDownload === false;
    if (locked) return res.status(403).json({ error: 'Contenu protégé : accessible uniquement depuis la plateforme.' });
    next();
  } catch (e) {
    next(e);
  }
}
