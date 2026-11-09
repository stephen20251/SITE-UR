// Dossiers des fichiers déposés (vidéos, documents, photos, CV…).
// En production, placez-les HORS du dossier de l'application : un nouveau déploiement
// depuis Git remplace ce dossier et effacerait les fichiers.
//   UPLOADS_DIR          fichiers servis sous /uploads (défaut : ./uploads)
//   PRIVATE_UPLOADS_DIR  fichiers jamais publics : CV, pièces de candidature (défaut : ./private-uploads)
import path from 'path';

export const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || 'uploads');
export const PRIVATE_UPLOADS_DIR = path.resolve(process.env.PRIVATE_UPLOADS_DIR || 'private-uploads');

export const uploadsPath = (...parts) => path.join(UPLOADS_DIR, ...parts);
export const privatePath = (...parts) => path.join(PRIVATE_UPLOADS_DIR, ...parts);

// « /uploads/avatars/x.jpg » → chemin sur le disque ; null si l'adresse sort du dossier.
export function fileFromUploadUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return null;
  const file = path.resolve(UPLOADS_DIR, decodeURIComponent(url.slice('/uploads/'.length)));
  return file.startsWith(UPLOADS_DIR + path.sep) ? file : null;
}
