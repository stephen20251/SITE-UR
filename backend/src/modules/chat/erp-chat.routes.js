import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middlewares/auth.js';
import * as svc from './erp-chat.service.js';
import { UPLOADS_DIR } from '../../config/paths.js';

const router = Router();
router.use(authenticate);

// ── File upload for chat messages ──────────────────────────────────────────────

const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOADS_DIR, 'chat');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user.sub}-${Date.now()}${ext}`);
  },
});

const chatUpload = multer({
  storage: chatStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Type de fichier non supporté'));
  },
});

// ERP contacts eligible for DM (role-aware)
router.get('/contacts', asyncHandler(async (req, res) => {
  res.json(await svc.listErpContacts(req.user.sub, req.query.q ?? ''));
}));

// Unread count across all ERP rooms
router.get('/unread-count', asyncHandler(async (req, res) => {
  const rooms = await svc.listErpRooms(req.user.sub);
  const count = rooms.reduce((s, r) => s + (r.unread ?? 0), 0);
  res.json({ count });
}));

// List all ERP rooms for the calling user
router.get('/rooms', asyncHandler(async (req, res) => {
  res.json(await svc.listErpRooms(req.user.sub));
}));

// Messages in a room (paginated)
router.get('/rooms/:roomId/messages', asyncHandler(async (req, res) => {
  res.json(await svc.getMessages(req.user.sub, req.params.roomId, req.query));
}));

// Send a message (REST fallback — primary path is Socket.IO)
router.post('/rooms/:roomId/messages', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.sendMessage(req.user.sub, req.params.roomId, req.body));
}));

// Upload a file and send as message
router.post('/rooms/:roomId/upload', chatUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  const fileUrl  = `/uploads/chat/${req.file.filename}`;
  const fileType = req.file.mimetype;
  const fileName = req.file.originalname;
  const body     = req.body.body ?? '';
  const message  = await svc.sendMessage(req.user.sub, req.params.roomId, { body, fileUrl, fileType, fileName });
  res.status(201).json(message);
}));

// Mark room as read
router.post('/rooms/:roomId/read', asyncHandler(async (req, res) => {
  res.json(await svc.markRead(req.user.sub, req.params.roomId));
}));

// Pinned messages
router.get('/rooms/:roomId/pinned', asyncHandler(async (req, res) => {
  res.json(await svc.getPinned(req.user.sub, req.params.roomId));
}));

// Search messages in a room
router.get('/rooms/:roomId/search', asyncHandler(async (req, res) => {
  res.json(await svc.searchMessages(req.user.sub, req.params.roomId, req.query.q));
}));

// Toggle pin on a message
router.post('/messages/:messageId/pin', asyncHandler(async (req, res) => {
  res.json(await svc.togglePin(req.user.sub, req.params.messageId));
}));

// Open / get-or-create a DM with another user
router.post('/dm/:userId', asyncHandler(async (req, res) => {
  res.json(await svc.getOrCreateDM(req.user.sub, req.params.userId));
}));

// Get or create a class room (promotion or group)
router.post('/class-room', asyncHandler(async (req, res) => {
  const { promotionId, groupId } = req.body;
  res.json(await svc.getOrCreateClassRoom(req.user.sub, promotionId, groupId));
}));

// Create an admin / broadcast room with explicit member list
router.post('/admin-room', asyncHandler(async (req, res) => {
  const { name, memberIds } = req.body;
  res.json(await svc.getOrCreateAdminRoom(req.user.sub, name, memberIds ?? []));
}));

export default router;
