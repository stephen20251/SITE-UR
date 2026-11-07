import { Router } from 'express';
import QRCode from 'qrcode';
import { authenticate } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { CARD_TEMPLATES, generateCard, generateBulkCards, archiveCard } from './cards.service.js';

const r = Router();
r.use(authenticate);

// GET /api/cards/templates — list all card templates
r.get('/templates', asyncHandler(async (req, res) => {
  res.json(CARD_TEMPLATES.map(({ id, name, thumbnail, style }) => ({ id, name, thumbnail, style })));
}));

// GET /api/cards/qr?data=... — generate QR code as PNG
r.get('/qr', asyncHandler(async (req, res) => {
  const data = String(req.query.data ?? 'UR');
  const buf  = await QRCode.toBuffer(data, { width: 200, margin: 1, color: { dark: '#000', light: '#fff0' } });
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public,max-age=86400');
  res.send(buf);
}));

// POST /api/cards/preview/:templateId — preview for one student (no archive)
r.post('/preview/:templateId', asyncHandler(async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ error: 'studentId requis' });
  const card = await generateCard(req.params.templateId, studentId);
  res.json(card);
}));

// POST /api/cards/generate/:templateId — generate + archive one card
r.post('/generate/:templateId', asyncHandler(async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ error: 'studentId requis' });
  const card = await generateCard(req.params.templateId, studentId);
  archiveCard(req.params.templateId, studentId, req.user.sub).catch(() => {});
  res.json(card);
}));

// POST /api/cards/generate-bulk/:templateId — generate many cards
r.post('/generate-bulk/:templateId', asyncHandler(async (req, res) => {
  const { studentIds } = req.body;
  if (!Array.isArray(studentIds) || !studentIds.length) return res.status(400).json({ error: 'studentIds requis' });
  const cards = await generateBulkCards(req.params.templateId, studentIds);
  // Archive asynchronously
  cards.forEach((c) => archiveCard(req.params.templateId, c.id, req.user.sub).catch(() => {}));
  res.json(cards);
}));

export default r;
