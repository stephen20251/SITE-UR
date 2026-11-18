// Métadonnées fiables d'un fichier déposé : nom en UTF-8 (les accents arrivent en
// latin1 avec multer) et type MIME déduit de l'extension quand le navigateur envoie
// un type générique (fréquent sur téléphone : « application/octet-stream »).
import path from 'path';

const BY_EXT = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
  '.zip': 'application/zip', '.rar': 'application/vnd.rar', '.7z': 'application/x-7z-compressed',
};

const GENERIC = new Set(['', 'application/octet-stream', 'binary/octet-stream', 'application/x-unknown', 'application/unknown']);

export function utf8Name(name) {
  if (!name) return name;
  try {
    const fixed = Buffer.from(name, 'latin1').toString('utf8');
    // Ne garde la conversion que si elle produit un texte valide (pas de « � »).
    return fixed.includes('�') ? name : fixed;
  } catch {
    return name;
  }
}

export function mimeFor(name, mime) {
  const m = String(mime ?? '').toLowerCase();
  if (!GENERIC.has(m)) return m;
  return BY_EXT[path.extname(String(name ?? '')).toLowerCase()] ?? (m || 'application/octet-stream');
}

/** { name, mimeType } d'un fichier multer */
export function fileMeta(file, displayName) {
  const name = utf8Name(displayName || file.originalname);
  return { name, mimeType: mimeFor(file.originalname || name, file.mimetype) };
}
