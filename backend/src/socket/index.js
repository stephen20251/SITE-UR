import { verifyAccessToken } from '../utils/jwt.js';
import { prisma } from '../database/prisma.js';
import * as chat from '../modules/chat/chat.service.js';
import { addPresence, removePresence, onlineUserIds } from './presence.js';

// In-memory whiteboard state per session (strokes array, reset on clear)
const boardState = new Map(); // sessionId → { strokes: [], background: 'white' }

function getBoardState(sessionId) {
  if (!boardState.has(sessionId)) {
    boardState.set(sessionId, {
      pages: [[]], pageIndex: 0, background: '#ffffff', allowStudents: false, doc: null,
      voiceOn: false, voiceTeacher: null, notes: '',
      participants: new Map(), // userId → { id, name, isTeacher, hand, micAllowed, speaking }
      chat: [], // last 100 room messages
      screenOn: false, screenTeacher: null,
      micGrants: new Set(), // student userIds allowed to speak
      poll: null, // { id, question, options[], votes: {userId: idx}, open }
    });
  }
  const st = boardState.get(sessionId);
  return st;
}

// Strokes of the currently displayed board page.
function activeStrokes(state) {
  if (!state.pages[state.pageIndex]) state.pages[state.pageIndex] = [];
  return state.pages[state.pageIndex];
}

// ── Board persistence: lazy DB load + debounced periodic save ──
const loadedBoards = new Set();
const dirtyBoards = new Set();

async function loadBoardState(sessionId) {
  const state = getBoardState(sessionId);
  if (loadedBoards.has(sessionId)) return state;
  loadedBoards.add(sessionId);
  try {
    const { prisma } = await import('../database/prisma.js');
    const row = await prisma.liveBoardSnapshot.findUnique({ where: { sessionId } });
    const d = row?.data;
    if (d && typeof d === 'object') {
      // Legacy snapshots stored a flat strokes array.
      state.pages = Array.isArray(d.pages) && d.pages.length
        ? d.pages.map((p) => (Array.isArray(p) ? p : []))
        : [Array.isArray(d.strokes) ? d.strokes : []];
      state.pageIndex = Math.min(Number(d.pageIndex) || 0, state.pages.length - 1);
      state.background = d.background ?? '#ffffff';
      state.allowStudents = Boolean(d.allowStudents);
      state.doc = d.doc ?? null;
      state.notes = d.notes ?? '';
      state.chat = Array.isArray(d.chat) ? d.chat : [];
      state.poll = d.poll ?? null;
    }
  } catch { /* best effort — a fresh board is fine */ }
  return state;
}

function scheduleSave(sessionId) {
  dirtyBoards.add(sessionId);
}

setInterval(async () => {
  if (dirtyBoards.size === 0) return;
  const batch = [...dirtyBoards];
  dirtyBoards.clear();
  const { prisma } = await import('../database/prisma.js');
  for (const sessionId of batch) {
    const st = boardState.get(sessionId);
    if (!st) continue;
    const data = {
      pages: st.pages, pageIndex: st.pageIndex, background: st.background,
      allowStudents: st.allowStudents, doc: st.doc, notes: st.notes, chat: st.chat, poll: st.poll,
    };
    // FK on LiveSession rejects garbage session ids silently.
    prisma.liveBoardSnapshot.upsert({
      where: { sessionId },
      create: { sessionId, data },
      update: { data },
    }).catch(() => {});
  }
}, 4000);

/**
 * Wires authentication, presence and chat handlers onto the Socket.io server.
 * Every connected socket joins its personal `user:<id>` room (used by the
 * notification + chat-notify fan-out) and opt-in `room:<id>` chat rooms.
 */
export function initSocket(io) {
  // ── Handshake auth ──
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Missing auth token'));
      socket.user = verifyAccessToken(token);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.sub;
    socket.join(`user:${userId}`);

    const cameOnline = addPresence(userId) === 1;
    socket.emit('connected', { userId, online: onlineUserIds() });
    if (cameOnline) io.emit('presence:update', { userId, online: true });

    // Join a chat room (membership enforced server-side).
    socket.on('chat:join', async (roomId, ack) => {
      try {
        await chat.assertMember(roomId, userId);
        socket.join(`room:${roomId}`);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on('chat:leave', (roomId) => {
      socket.leave(`room:${roomId}`);
    });

    // Send a message → persisted + fanned out by the chat service.
    socket.on('chat:message', async (payload, ack) => {
      try {
        const message = await chat.sendMessage(userId, payload?.roomId, payload?.body);
        ack?.({ ok: true, message });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    // Ephemeral typing indicator (not persisted).
    socket.on('chat:typing', (roomId) => {
      socket.to(`room:${roomId}`).emit('chat:typing', { roomId, userId });
    });

    socket.on('chat:read', (roomId) => {
      chat.markRead(userId, roomId).catch(() => {});
    });

    // ── WebRTC call signaling ───────────────────────────────────────────────
    // Caller sends offer → callee gets call:incoming
    socket.on('call:offer', ({ to, offer, callType, callerName }) => {
      io.to(`user:${to}`).emit('call:incoming', {
        from: userId,
        callerName: callerName ?? 'Quelqu\'un',
        offer,
        callType, // 'audio' | 'video'
      });
    });

    // Callee accepts → caller gets call:answered
    socket.on('call:answer', ({ to, answer }) => {
      io.to(`user:${to}`).emit('call:answered', { from: userId, answer });
    });

    // ICE candidate exchange
    socket.on('call:ice', ({ to, candidate }) => {
      io.to(`user:${to}`).emit('call:ice', { from: userId, candidate });
    });

    // Callee rejects
    socket.on('call:reject', ({ to }) => {
      io.to(`user:${to}`).emit('call:rejected', { from: userId });
    });

    // Either side ends the call
    socket.on('call:end', ({ to }) => {
      io.to(`user:${to}`).emit('call:ended', { from: userId });
    });

    // ── Whiteboard (blackboard) ────────────────────────────────────────────────
    // Server-side truth for who owns a board: the live session's teacher (or a
    // super admin). Cached on the socket per session after board:join.
    const teacherOf = new Set();
    async function isBoardTeacher(sessionId) {
      if (teacherOf.has(sessionId)) return true;
      if (socket.user.systemRole === 'SUPER_ADMIN' || socket.user.role === 'SUPER_ADMIN') {
        teacherOf.add(sessionId);
        return true;
      }
      // Breakout rooms ("<id>::gN") belong to the base session's teacher.
      const baseId = String(sessionId).split('::')[0];
      const session = await prisma.liveSession.findUnique({
        where: { id: baseId },
        select: { teacherId: true },
      }).catch(() => null);
      if (session?.teacherId === userId) { teacherOf.add(sessionId); return true; }
      return false;
    }
    function canWrite(sessionId) {
      return teacherOf.has(sessionId) || getBoardState(sessionId).allowStudents;
    }

    // Rooms this socket joined — used to clean up presence on disconnect.
    const joinedBoards = new Set();

    function roster(state) {
      return [...state.participants.values()];
    }
    function publicPoll(state) {
      if (!state.poll) return null;
      const counts = state.poll.options.map(() => 0);
      for (const v of Object.values(state.poll.votes)) if (counts[v] !== undefined) counts[v] += 1;
      return {
        id: state.poll.id,
        question: state.poll.question,
        options: state.poll.options,
        counts,
        total: Object.keys(state.poll.votes).length,
        open: state.poll.open,
      };
    }
    function removeParticipant(sessionId) {
      const state = getBoardState(sessionId);
      if (state.participants.delete(userId)) {
        io.to(`board:${sessionId}`).emit('board:participants', roster(state));
      }
    }

    // Join a session's board room. Sends current board state to the joining user.
    socket.on('board:join', async (sessionId, ack) => {
      socket.join(`board:${sessionId}`);
      joinedBoards.add(sessionId);
      const isTeacher = await isBoardTeacher(sessionId);
      const state = await loadBoardState(sessionId);
      // Register the participant with a display name (JWT carries no name).
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, avatarUrl: true },
      }).catch(() => null);
      state.participants.set(userId, {
        id: userId,
        name: u ? `${u.firstName} ${u.lastName}` : 'Utilisateur',
        avatarUrl: u?.avatarUrl ?? null,
        isTeacher,
        hand: false,
        micAllowed: state.micGrants.has(userId),
        speaking: false,
      });
      io.to(`board:${sessionId}`).emit('board:participants', roster(state));
      ack?.({
        ok: true,
        strokes: activeStrokes(state),
        boardCount: state.pages.length,
        boardIndex: state.pageIndex,
        background: state.background,
        allowStudents: state.allowStudents,
        doc: state.doc,
        voiceOn: state.voiceOn,
        notes: state.notes,
        participants: roster(state),
        chat: state.chat,
        screenOn: state.screenOn,
        poll: publicPoll(state),
        myVote: state.poll?.votes?.[userId] ?? null,
        isTeacher,
      });
    });

    socket.on('board:leave', (sessionId) => {
      socket.leave(`board:${sessionId}`);
      joinedBoards.delete(sessionId);
      removeParticipant(sessionId);
    });

    // Raise / lower hand (students) — roster refresh + transient ping for toasts.
    socket.on('board:hand', ({ sessionId, up }) => {
      const state = getBoardState(sessionId);
      const p = state.participants.get(userId);
      if (!p) return;
      p.hand = Boolean(up);
      io.to(`board:${sessionId}`).emit('board:participants', roster(state));
      if (p.hand) io.to(`board:${sessionId}`).emit('board:hand', { name: p.name });
    });

    // Room chat (ephemeral, in-memory, capped at 100 messages).
    socket.on('board:chat', ({ sessionId, text }) => {
      const body = String(text ?? '').trim().slice(0, 1000);
      if (!body) return;
      const state = getBoardState(sessionId);
      const p = state.participants.get(userId);
      const msg = {
        id: `${userId}-${Date.now()}`,
        from: { id: userId, name: p?.name ?? 'Utilisateur', isTeacher: p?.isTeacher ?? false },
        text: body,
        at: new Date().toISOString(),
      };
      state.chat.push(msg);
      if (state.chat.length > 100) state.chat.shift();
      scheduleSave(sessionId);
      io.to(`board:${sessionId}`).emit('board:chat', msg);
    });

    // Draw a stroke → persist + broadcast. Teacher always; students only when
    // the teacher has enabled collaborative writing.
    socket.on('board:stroke', ({ sessionId, stroke }) => {
      if (!canWrite(sessionId)) return;
      const state = getBoardState(sessionId);
      const strokes = activeStrokes(state);
      strokes.push({ ...stroke, id: `${userId}-${Date.now()}-${strokes.length}`, userId });
      scheduleSave(sessionId);
      // Broadcast to everyone else in the room (not the sender)
      socket.to(`board:${sessionId}`).emit('board:stroke', stroke);
    });

    // Teacher toggles whether students may write on the board.
    socket.on('board:permission', async ({ sessionId, allowStudents }) => {
      if (!(await isBoardTeacher(sessionId))) return;
      const state = getBoardState(sessionId);
      state.allowStudents = Boolean(allowStudents);
      scheduleSave(sessionId);
      io.to(`board:${sessionId}`).emit('board:permission', { allowStudents: state.allowStudents });
    });

    // Teacher sets the shared presentation (PDF url + page count).
    socket.on('board:doc', async ({ sessionId, url, numPages, kind }) => {
      if (!(await isBoardTeacher(sessionId))) return;
      const state = getBoardState(sessionId);
      state.doc = url
        ? { url, page: 1, numPages: Number(numPages) || 1, kind: kind === 'image' ? 'image' : 'pdf' }
        : null;
      scheduleSave(sessionId);
      io.to(`board:${sessionId}`).emit('board:doc', state.doc);
    });

    // ── Live voice (teacher mic → students, WebRTC mesh) ─────────────────────
    // Teacher toggles the broadcast; students then ask to join and the pair
    // exchanges SDP/ICE through voice:signal relays.
    socket.on('board:voice', async ({ sessionId, on }) => {
      if (!(await isBoardTeacher(sessionId))) return;
      const state = getBoardState(sessionId);
      state.voiceOn = Boolean(on);
      state.voiceTeacher = on ? userId : null;
      io.to(`board:${sessionId}`).emit('board:voice', { on: state.voiceOn });
    });

    // Student asks to receive the teacher's audio.
    socket.on('voice:join', ({ sessionId }) => {
      const state = getBoardState(sessionId);
      if (!state.voiceOn || !state.voiceTeacher) return;
      io.to(`user:${state.voiceTeacher}`).emit('voice:join', { sessionId, from: userId });
    });

    // Generic WebRTC signaling relay (offer / answer / ICE) between two users.
    socket.on('voice:signal', ({ to, data }) => {
      if (!to) return;
      io.to(`user:${to}`).emit('voice:signal', { from: userId, data });
    });

    // ── Screen share (teacher's screen → students, WebRTC mesh) ──────────────
    socket.on('board:screen', async ({ sessionId, on }) => {
      if (!(await isBoardTeacher(sessionId))) return;
      const state = getBoardState(sessionId);
      state.screenOn = Boolean(on);
      state.screenTeacher = on ? userId : null;
      io.to(`board:${sessionId}`).emit('board:screen', { on: state.screenOn });
    });

    socket.on('screen:join', ({ sessionId }) => {
      const state = getBoardState(sessionId);
      if (!state.screenOn || !state.screenTeacher) return;
      io.to(`user:${state.screenTeacher}`).emit('screen:join', { sessionId, from: userId });
    });

    socket.on('screen:signal', ({ to, data }) => {
      if (!to) return;
      io.to(`user:${to}`).emit('screen:signal', { from: userId, data });
    });

    // ── Student microphone (teacher grants the floor) ───────────────────────
    socket.on('board:micgrant', async ({ sessionId, userId: target, allowed }) => {
      if (!(await isBoardTeacher(sessionId))) return;
      const state = getBoardState(sessionId);
      if (allowed) state.micGrants.add(target);
      else state.micGrants.delete(target);
      const p = state.participants.get(target);
      if (p) { p.micAllowed = Boolean(allowed); if (!allowed) p.speaking = false; }
      io.to(`board:${sessionId}`).emit('board:participants', roster(state));
      io.to(`user:${target}`).emit('board:micgrant', { sessionId, allowed: Boolean(allowed) });
    });

    // Speaker (granted student or teacher) turns their mic on/off.
    socket.on('board:micon', ({ sessionId, on }) => {
      const state = getBoardState(sessionId);
      const p = state.participants.get(userId);
      if (!p) return;
      if (!p.isTeacher && !state.micGrants.has(userId)) return;
      p.speaking = Boolean(on);
      io.to(`board:${sessionId}`).emit('board:participants', roster(state));
      io.to(`board:${sessionId}`).emit('board:micon', { userId, name: p.name, on: Boolean(on) });
    });

    socket.on('mic:join', ({ speaker }) => {
      if (!speaker) return;
      io.to(`user:${speaker}`).emit('mic:join', { from: userId });
    });

    socket.on('mic:signal', ({ to, data }) => {
      if (!to) return;
      io.to(`user:${to}`).emit('mic:signal', { from: userId, data });
    });

    // ── Laser pointer (teacher) — volatile, high-frequency, not persisted ────
    socket.on('board:laser', ({ sessionId, x, y, on }) => {
      if (!teacherOf.has(sessionId)) return; // populated at board:join
      socket.to(`board:${sessionId}`).volatile.emit('board:laser', { x, y, on: Boolean(on) });
    });

    // ── Multiple boards (flipchart pages, teacher-controlled) ───────────────
    socket.on('board:board', async ({ sessionId, action, index }) => {
      if (!(await isBoardTeacher(sessionId))) return;
      const state = getBoardState(sessionId);
      if (action === 'add' && state.pages.length < 10) {
        state.pages.push([]);
        state.pageIndex = state.pages.length - 1;
      } else if (action === 'switch') {
        const i = Number(index);
        if (!(i >= 0 && i < state.pages.length)) return;
        state.pageIndex = i;
      } else return;
      scheduleSave(sessionId);
      io.to(`board:${sessionId}`).emit('board:board', {
        boardCount: state.pages.length,
        boardIndex: state.pageIndex,
        strokes: activeStrokes(state),
      });
    });

    // ── Breakout rooms (sub-group boards) ────────────────────────────────────
    socket.on('board:breakout-start', async ({ sessionId, groups }) => {
      if (!(await isBoardTeacher(sessionId))) return;
      const state = getBoardState(sessionId);
      const n = Math.max(2, Math.min(Number(groups) || 2, 6));
      const students = roster(state).filter((p) => !p.isTeacher);
      // Round-robin assignment; group boards allow writing by default.
      const assignment = {};
      students.forEach((p, i) => { assignment[p.id] = (i % n) + 1; });
      for (let g = 1; g <= n; g++) {
        const gs = getBoardState(`${sessionId}::g${g}`);
        gs.allowStudents = true;
      }
      state.breakout = { groups: n, assignment };
      for (const [uid, g] of Object.entries(assignment)) {
        io.to(`user:${uid}`).emit('board:breakout', { room: `${sessionId}::g${g}`, group: g, groups: n });
      }
      io.to(`board:${sessionId}`).emit('board:breakout-info', { active: true, groups: n });
    });

    socket.on('board:breakout-stop', async ({ sessionId }) => {
      if (!(await isBoardTeacher(sessionId))) return;
      const state = getBoardState(sessionId);
      state.breakout = null;
      // Everyone in the main room and every group room is sent home.
      io.to(`board:${sessionId}`).emit('board:breakout', { room: null });
      for (let g = 1; g <= 6; g++) {
        io.to(`board:${sessionId}::g${g}`).emit('board:breakout', { room: null });
      }
    });

    // ── Live polls ───────────────────────────────────────────────────────────
    socket.on('board:poll', async ({ sessionId, question, options }) => {
      if (!(await isBoardTeacher(sessionId))) return;
      const state = getBoardState(sessionId);
      const opts = (Array.isArray(options) ? options : [])
        .map((o) => String(o).trim().slice(0, 100)).filter(Boolean).slice(0, 6);
      if (!question || opts.length < 2) return;
      state.poll = {
        id: Date.now().toString(36),
        question: String(question).trim().slice(0, 300),
        options: opts,
        votes: {},
        open: true,
      };
      scheduleSave(sessionId);
      io.to(`board:${sessionId}`).emit('board:poll', publicPoll(state));
    });

    socket.on('board:vote', ({ sessionId, index }) => {
      const state = getBoardState(sessionId);
      if (!state.poll?.open) return;
      const i = Number(index);
      if (!(i >= 0 && i < state.poll.options.length)) return;
      state.poll.votes[userId] = i;
      scheduleSave(sessionId);
      io.to(`board:${sessionId}`).emit('board:poll', publicPoll(state));
    });

    socket.on('board:poll-close', async ({ sessionId }) => {
      if (!(await isBoardTeacher(sessionId))) return;
      const state = getBoardState(sessionId);
      if (!state.poll) return;
      state.poll.open = false;
      scheduleSave(sessionId);
      io.to(`board:${sessionId}`).emit('board:poll', publicPoll(state));
    });

    socket.on('board:poll-clear', async ({ sessionId }) => {
      if (!(await isBoardTeacher(sessionId))) return;
      const state = getBoardState(sessionId);
      state.poll = null;
      scheduleSave(sessionId);
      io.to(`board:${sessionId}`).emit('board:poll', null);
    });

    // ── Shared summary notes ("sommaire") — teacher writes, everyone reads ──
    socket.on('board:notes', async ({ sessionId, notes }) => {
      if (!(await isBoardTeacher(sessionId))) return;
      const state = getBoardState(sessionId);
      state.notes = String(notes ?? '').slice(0, 20000);
      scheduleSave(sessionId);
      socket.to(`board:${sessionId}`).emit('board:notes', { notes: state.notes });
    });

    // Teacher flips a presentation page — everyone follows.
    socket.on('board:page', async ({ sessionId, page }) => {
      if (!(await isBoardTeacher(sessionId))) return;
      const state = getBoardState(sessionId);
      if (!state.doc) return;
      const p = Math.max(1, Math.min(Number(page) || 1, state.doc.numPages));
      state.doc.page = p;
      scheduleSave(sessionId);
      io.to(`board:${sessionId}`).emit('board:page', { page: p });
    });

    // Undo last stroke by the sender
    socket.on('board:undo', ({ sessionId }) => {
      const state = getBoardState(sessionId);
      const strokes = activeStrokes(state);
      // Remove last stroke from this user
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (strokes[i].userId === userId || strokes[i].id?.startsWith(userId)) {
          strokes.splice(i, 1);
          break;
        }
      }
      scheduleSave(sessionId);
      io.to(`board:${sessionId}`).emit('board:sync', { strokes });
    });

    // Clear the entire board (teacher only — enforced server-side)
    socket.on('board:clear', async ({ sessionId }) => {
      if (!(await isBoardTeacher(sessionId))) return;
      const state = getBoardState(sessionId);
      state.pages[state.pageIndex] = [];
      scheduleSave(sessionId);
      io.to(`board:${sessionId}`).emit('board:clear');
    });

    // Request full state (for late joiners)
    socket.on('board:request-sync', ({ sessionId }, ack) => {
      const state = getBoardState(sessionId);
      ack?.({ strokes: activeStrokes(state), background: state.background });
    });

    socket.on('disconnect', () => {
      // Drop this user from every board roster they were in.
      for (const sessionId of joinedBoards) removeParticipant(sessionId);
      const remaining = removePresence(userId);
      if (remaining === 0) io.emit('presence:update', { userId, online: false });
    });
  });
}
