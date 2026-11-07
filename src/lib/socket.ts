import { io, type Socket } from "socket.io-client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { tokenStore, refreshAccessToken, API_BASE } from "./api";

// Socket.io connects to the server root, not the /api prefix.
const SOCKET_URL = API_BASE.replace(/\/api\/?$/, "");

let socket: Socket | null = null;

// ─── tiny connection store so hooks can re-subscribe on (re)connect ───
let connected = false;
const listeners = new Set<() => void>();
function setConnected(v: boolean) {
  connected = v;
  listeners.forEach((l) => l());
}

export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null; // never on the server
  const token = tokenStore.access;
  if (!token) return null;

  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", async (err) => {
      // On auth failure, refresh the access token once and retry.
      if (/token/i.test(err.message)) {
        const fresh = await refreshAccessToken();
        if (fresh && socket) {
          socket.auth = { token: fresh };
          socket.connect();
        }
      }
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
    setConnected(false);
  }
}

export function useSocketConnected() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => connected,
    () => false,
  );
}

/** Subscribe a component to a socket event; re-binds when the socket reconnects. */
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  const isConnected = useSocketConnected();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const fn = (payload: T) => ref.current(payload);
    s.on(event, fn as (...args: unknown[]) => void);
    return () => {
      s.off(event, fn as (...args: unknown[]) => void);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, isConnected]);
}

/** Emit with an optional ack callback (rejects on timeout). */
export function socketEmit<T = unknown>(event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    if (!s) return reject(new Error("Socket not connected"));
    s.timeout(8000).emit(event, payload, (err: Error | null, res: T) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}
