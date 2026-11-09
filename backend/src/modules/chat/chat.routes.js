import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { onlineUserIds } from '../../socket/presence.js';
import { roomIdParam, courseIdParam, userIdParam, messagesQuery, sendMessageBody } from './chat.schemas.js';
import * as svc from './chat.service.js';
import { uploadsPath } from '../../config/paths.js';

const router = Router();
router.use(authenticate);

// ─── Upload setup ──────────────────────────────────────────────────────────
const chatUploadDir = uploadsPath('chat');
if (!fs.existsSync(chatUploadDir)) fs.mkdirSync(chatUploadDir, { recursive: true });

const chatUpload = multer({
  storage: multer.diskStorage({
    destination: chatUploadDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `chat-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// ─── Rooms ─────────────────────────────────────────────────────────────────
router.get('/rooms', asyncHandler(async (req, res) => {
  res.json(await svc.listRooms(req.user.sub));
}));

router.get('/presence', asyncHandler(async (req, res) => {
  res.json({ online: onlineUserIds() });
}));

// ─── LMS contact list (role-aware) ─────────────────────────────────────────
router.get('/lms-contacts', asyncHandler(async (req, res) => {
  res.json(await svc.lmsContactList(req.user.sub, req.query.q ?? ''));
}));

// ─── Room creation ─────────────────────────────────────────────────────────
router.post('/courses/:courseId/room', validate({ params: courseIdParam }), asyncHandler(async (req, res) => {
  res.json(await svc.getOrCreateCourseRoom(req.user.sub, req.params.courseId));
}));

router.post('/private/:userId', validate({ params: userIdParam }), asyncHandler(async (req, res) => {
  res.json(await svc.getOrCreatePrivateRoom(req.user.sub, req.params.userId));
}));

// ─── Messages ──────────────────────────────────────────────────────────────
router.get('/rooms/:roomId/messages', validate({ params: roomIdParam, query: messagesQuery }), asyncHandler(async (req, res) => {
  res.json(await svc.getMessages(req.user.sub, req.params.roomId, req.query));
}));

router.post('/rooms/:roomId/messages', validate({ params: roomIdParam, body: sendMessageBody }), asyncHandler(async (req, res) => {
  res.status(201).json(await svc.sendMessage(req.user.sub, req.params.roomId, req.body.body));
}));

// ─── File upload ───────────────────────────────────────────────────────────
router.post(
  '/rooms/:roomId/upload',
  validate({ params: roomIdParam }),
  chatUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const url = `/uploads/chat/${req.file.filename}`;
    const msg = await svc.sendMessage(
      req.user.sub,
      req.params.roomId,
      req.body.body ?? '',
      url,
      req.file.mimetype,
      req.file.originalname,
    );
    res.status(201).json(msg);
  }),
);

// ─── Read receipt ──────────────────────────────────────────────────────────
router.post('/rooms/:roomId/read', validate({ params: roomIdParam }), asyncHandler(async (req, res) => {
  res.json(await svc.markRead(req.user.sub, req.params.roomId));
}));

export default router;
