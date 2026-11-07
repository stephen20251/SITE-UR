// Lightweight Socket.io registry.
//
// Services need to push realtime events but must not import server.js (that would
// create a circular dependency: server → app → routes → service → server).
// Instead server.js calls registerIO(io) once at bootstrap, and services emit
// through these best-effort helpers. If io is not registered (e.g. unit tests),
// every emit is a safe no-op.

let io = null;

export const registerIO = (instance) => {
  io = instance;
};

export const getIO = () => io;

export const emitToUser = (userId, event, payload) => {
  io?.to(`user:${userId}`).emit(event, payload);
};

export const emitToRoom = (room, event, payload) => {
  io?.to(room).emit(event, payload);
};

export const broadcast = (event, payload) => {
  io?.emit(event, payload);
};
