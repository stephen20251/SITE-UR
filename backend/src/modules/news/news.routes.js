// ─────────────────────────────────────────────────────────────────────────────
// Page « Actualités » du site.
//   GET    /api/news/public             → contenu de la page (sans authentification)
//   GET    /api/news/public/archives    → anciennes publications (?year&category&q&page)
//   GET    /api/news/public/:slug       → une actualité
//   GET    /api/news                    → toutes les actualités (gestion)
//   POST   /api/news                    → créer
//   PATCH  /api/news/:id                → modifier
//   DELETE /api/news/:id                → supprimer
//   POST   /api/news/:id/image          → image de l'actualité
// Gestion réservée au Super administrateur.
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { prisma } from '../../database/prisma.js';
import { authenticate } from '../../middlewares/auth.js';
import { requireSystemRole } from '../../middlewares/rbac.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';
import { uniqueSlug } from '../../utils/slug.js';

const r = Router();
const UPLOAD_DIR = path.resolve('uploads', 'news');
const CATEGORIES = ['ACTUALITE', 'ANNONCE_OFFICIELLE', 'CONFERENCE', 'SOUTENANCE', 'PUBLICATION', 'RESULTAT', 'ACTIVITE'];
// Une publication passe aux archives après 12 mois, ou quand l'admin l'y place.
const ARCHIVE_AFTER_MONTHS = 12;

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); cb(null, UPLOAD_DIR); },
    filename: (req, file, cb) => cb(null, `${req.params.id}-${Date.now()}${path.extname(file.originalname).toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, 'Image JPEG, PNG ou WebP uniquement'));
  },
});

const removeFile = (url) => {
  if (url?.startsWith('/uploads/news/')) fs.unlink(path.resolve(url.slice(1)), () => {});
};

function parseInput(b, partial = false) {
  const data = {};
  const str = (v, max) => (v === null || v === undefined ? null : String(v).trim().slice(0, max) || null);
  const date = (v, field) => {
    if (v === null || v === '' || v === undefined) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, `Date invalide : ${field}`);
    return d;
  };
  if (!partial || b.title !== undefined) {
    data.title = str(b.title, 200);
    if (!data.title) throw new HttpError(400, 'Le titre est obligatoire');
  }
  if (!partial || b.body !== undefined) {
    data.body = str(b.body, 20000);
    if (!data.body) throw new HttpError(400, 'Le contenu est obligatoire');
  }
  if (b.category !== undefined) {
    if (!CATEGORIES.includes(b.category)) throw new HttpError(400, 'Rubrique invalide');
    data.category = b.category;
  }
  if (b.excerpt !== undefined) data.excerpt = str(b.excerpt, 400);
  if (b.authors !== undefined) data.authors = str(b.authors, 300);
  if (b.location !== undefined) data.location = str(b.location, 160);
  if (b.eventAt !== undefined) data.eventAt = date(b.eventAt, 'date de l\'événement');
  if (b.publishedAt !== undefined) data.publishedAt = date(b.publishedAt, 'date de publication');
  if (b.linkUrl !== undefined) {
    data.linkUrl = str(b.linkUrl, 500);
    // Affiché comme lien cliquable : uniquement http(s).
    if (data.linkUrl && !/^https?:\/\//i.test(data.linkUrl)) throw new HttpError(400, 'Le lien doit commencer par http:// ou https://');
  }
  for (const k of ['isFeatured', 'isPublished', 'isArchived']) {
    if (b[k] !== undefined) data[k] = Boolean(b[k]);
  }
  return data;
}

// ── Public ────────────────────────────────────────────────────────────────────
const SUMMARY = {
  id: true, slug: true, title: true, excerpt: true, imageUrl: true, category: true,
  authors: true, location: true, eventAt: true, linkUrl: true, isFeatured: true, publishedAt: true,
};
const visible = (now = new Date()) => ({ isPublished: true, publishedAt: { lte: now } });
const archiveCutoff = (now = new Date()) => {
  const d = new Date(now);
  d.setMonth(d.getMonth() - ARCHIVE_AFTER_MONTHS);
  return d;
};
const archivedWhere = (now = new Date()) => ({
  ...visible(now),
  OR: [{ isArchived: true }, { publishedAt: { lt: archiveCutoff(now) } }],
});

r.get('/public', asyncHandler(async (req, res) => {
  const now = new Date();
  const [active, archiveCount] = await Promise.all([
    prisma.newsArticle.findMany({
      where: { isPublished: true, isArchived: false, publishedAt: { lte: now, gte: archiveCutoff(now) } },
      orderBy: { publishedAt: 'desc' },
      select: SUMMARY,
      take: 200,
    }),
    prisma.newsArticle.count({ where: archivedWhere(now) }),
  ]);
  const featured = active.find((a) => a.isFeatured) ?? active[0] ?? null;
  const others = active.filter((a) => a.id !== featured?.id);
  const inCategory = (...cats) => others.filter((a) => cats.includes(a.category)).slice(0, 6);
  res.json({
    featured,
    latest: others.slice(0, 6),
    officialAnnouncements: inCategory('ANNONCE_OFFICIELLE'),
    conferences: inCategory('CONFERENCE', 'SOUTENANCE'),
    publications: inCategory('PUBLICATION'),
    results: inCategory('RESULTAT'),
    activities: inCategory('ACTIVITE'),
    archiveCount,
  });
}));

r.get('/public/archives', asyncHandler(async (req, res) => {
  const now = new Date();
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = 12;
  const year = Number(req.query.year);
  const q = String(req.query.q ?? '').trim();
  const and = [];
  if (year) and.push({ publishedAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } });
  if (CATEGORIES.includes(req.query.category)) and.push({ category: req.query.category });
  if (q) and.push({ OR: [{ title: { contains: q, mode: 'insensitive' } }, { excerpt: { contains: q, mode: 'insensitive' } }] });
  const where = { ...archivedWhere(now), ...(and.length && { AND: and }) };
  const [items, total, dates] = await Promise.all([
    prisma.newsArticle.findMany({ where, orderBy: { publishedAt: 'desc' }, select: SUMMARY, skip: (page - 1) * limit, take: limit }),
    prisma.newsArticle.count({ where }),
    prisma.newsArticle.findMany({ where: archivedWhere(now), select: { publishedAt: true } }),
  ]);
  const years = [...new Set(dates.map((d) => d.publishedAt.getUTCFullYear()))].sort((a, b) => b - a);
  res.json({ items, total, page, limit, years });
}));

r.get('/public/:slug', asyncHandler(async (req, res) => {
  const now = new Date();
  const article = await prisma.newsArticle.findFirst({ where: { slug: req.params.slug, ...visible(now) } });
  if (!article) throw new HttpError(404, 'Actualité introuvable');
  const related = await prisma.newsArticle.findMany({
    where: { ...visible(now), category: article.category, id: { not: article.id } },
    orderBy: { publishedAt: 'desc' },
    select: SUMMARY,
    take: 3,
  });
  res.json({ article, related });
}));

// ── Gestion ───────────────────────────────────────────────────────────────────
const manage = [authenticate, requireSystemRole('SUPER_ADMIN')];

const findOr404 = async (id) => {
  const article = await prisma.newsArticle.findUnique({ where: { id } });
  if (!article) throw new HttpError(404, 'Actualité introuvable');
  return article;
};

// Une seule actualité « à la une » ; à la première publication, la date est fixée.
async function save(id, data, createdById) {
  const publishedAt = data.isPublished && !data.publishedAt ? new Date() : data.publishedAt;
  const payload = { ...data, ...(publishedAt !== undefined && { publishedAt }) };
  return prisma.$transaction(async (tx) => {
    const article = id
      ? await tx.newsArticle.update({ where: { id }, data: payload })
      : await tx.newsArticle.create({ data: { ...payload, slug: uniqueSlug(data.title), createdById } });
    if (data.isFeatured) {
      await tx.newsArticle.updateMany({ where: { isFeatured: true, id: { not: article.id } }, data: { isFeatured: false } });
    }
    return article;
  });
}

r.get('/', ...manage, asyncHandler(async (req, res) => {
  res.json(await prisma.newsArticle.findMany({ orderBy: [{ publishedAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }] }));
}));

r.post('/', ...manage, asyncHandler(async (req, res) => {
  res.status(201).json(await save(null, parseInput(req.body ?? {}), req.user.sub));
}));

r.patch('/:id', ...manage, asyncHandler(async (req, res) => {
  const current = await findOr404(req.params.id);
  const data = parseInput(req.body ?? {}, true);
  // Republier garde la date d'origine, sauf si une nouvelle date est indiquée.
  if (data.isPublished && !data.publishedAt && current.publishedAt) data.publishedAt = current.publishedAt;
  res.json(await save(current.id, data));
}));

r.delete('/:id', ...manage, asyncHandler(async (req, res) => {
  const current = await findOr404(req.params.id);
  await prisma.newsArticle.delete({ where: { id: current.id } });
  removeFile(current.imageUrl);
  res.json({ ok: true });
}));

r.post('/:id/image', ...manage, asyncHandler(async (req, res, next) => {
  await findOr404(req.params.id);
  next();
}), upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Aucune image fournie');
  const current = await findOr404(req.params.id);
  removeFile(current.imageUrl);
  res.json(await prisma.newsArticle.update({ where: { id: current.id }, data: { imageUrl: `/uploads/news/${req.file.filename}` } }));
}));

r.delete('/:id/image', ...manage, asyncHandler(async (req, res) => {
  const current = await findOr404(req.params.id);
  removeFile(current.imageUrl);
  res.json(await prisma.newsArticle.update({ where: { id: current.id }, data: { imageUrl: null } }));
}));

export default r;
