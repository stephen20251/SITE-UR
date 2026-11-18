// Remise en ordre des fichiers déjà déposés (exécuté au démarrage, idempotent) :
//  - un PDF enregistré comme « document » (type générique envoyé par un téléphone)
//    redevient un PDF, lisible dans le lecteur de cours ;
//  - le type MIME générique d'une pièce jointe est déduit de son extension ;
//  - les noms aux accents abîmés (« CoursÃ©.pdf ») sont réparés.
import path from 'path';
import { prisma } from '../../database/prisma.js';
import { mimeFor, utf8Name } from '../../utils/upload-meta.js';

const looksMangled = (s) => /Ã.|Â./.test(s ?? '');

export async function syncLessonContent() {
  let lessons = 0;
  let files = 0;

  const docs = await prisma.onlineLesson.findMany({
    where: { type: 'DOCUMENT', contentUrl: { not: null } },
    select: { id: true, contentUrl: true },
  });
  for (const l of docs) {
    const ext = path.extname(l.contentUrl.split('?')[0]).toLowerCase();
    const type = ext === '.pdf' ? 'PDF' : /^\.(jpe?g|png|gif|webp)$/.test(ext) ? 'IMAGE' : /^\.(mp3|wav|m4a|ogg)$/.test(ext) ? 'AUDIO' : null;
    if (type) { await prisma.onlineLesson.update({ where: { id: l.id }, data: { type } }); lessons += 1; }
  }

  const candidates = await prisma.lessonFile.findMany({
    where: { OR: [{ mimeType: { in: ['application/octet-stream', 'binary/octet-stream', ''] } }, { name: { contains: 'Ã' } }, { name: { contains: 'Â' } }] },
    select: { id: true, name: true, url: true, mimeType: true },
  });
  for (const f of candidates) {
    const name = looksMangled(f.name) ? utf8Name(f.name) : f.name;
    const mimeType = mimeFor(f.name || f.url, f.mimeType);
    if (name !== f.name || mimeType !== f.mimeType) {
      await prisma.lessonFile.update({ where: { id: f.id }, data: { name, mimeType } });
      files += 1;
    }
  }
  if (lessons || files) console.log(`📎 Fichiers des cours : ${lessons} leçon(s) et ${files} pièce(s) jointe(s) remises en ordre`);
  return { lessons, files };
}
