import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { authenticate } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getBranding, updateBranding } from './branding.service.js';
import { UPLOADS_DIR } from '../../config/paths.js';

const r = Router();
r.use(authenticate);

// ── Multer setup ───────────────────────────────────────────────────────────────


function brandingStorage(subfolder) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOADS_DIR, 'branding', subfolder);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${subfolder}-${Date.now()}${ext}`);
    },
  });
}

function imageUpload(subfolder) {
  return multer({
    storage: brandingStorage(subfolder),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = /^image\/(jpeg|png|webp|svg\+xml|gif)$/.test(file.mimetype);
      cb(ok ? null : new Error('Type de fichier non autorisé'), ok);
    },
  });
}

// ── GET branding ───────────────────────────────────────────────────────────────

r.get('/', asyncHandler(async (req, res) => {
  res.json(await getBranding());
}));

// ── PATCH branding (text fields: colors, name, etc.) ──────────────────────────

r.patch('/', asyncHandler(async (req, res) => {
  const allowed = [
    'name','shortName','sigle','establishmentType','address','city','country','phone','email','website','yearCreated',
    'primaryColor','secondaryColor','accentColor','fontFamily',
    'rectorName','rectorTitle',
    'documentPrefix','qrCodeEnabled',
  ];
  const data = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }
  res.json(await updateBranding(data));
}));

// ── Asset upload endpoints ─────────────────────────────────────────────────────

function assetRoute(urlField, subfolder) {
  r.post(`/upload/${subfolder}`, imageUpload(subfolder).single('file'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    const url = `/uploads/branding/${subfolder}/${req.file.filename}`;
    const branding = await updateBranding({ [urlField]: url });
    res.json({ url, branding });
  }));
}

assetRoute('logoUrl',          'logo');
assetRoute('secondaryLogoUrl', 'secondary-logo');
assetRoute('backgroundUrl',    'background');
assetRoute('watermarkUrl',     'watermark');
assetRoute('stampUrl',         'stamp');
assetRoute('signatureUrl',     'signature');
assetRoute('iconUrl',          'icon');

export default r;
