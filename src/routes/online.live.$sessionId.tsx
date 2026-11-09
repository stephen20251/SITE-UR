import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useEffect, useRef, useState, useCallback, useMemo,
} from "react";
import {
  ArrowLeft, Pencil, Minus, Square, Circle, Type, Eraser,
  Undo2, Redo2, Trash2, Download, ZoomIn, ZoomOut, RotateCcw,
  Users, Wifi, WifiOff, Eye, Loader2, Hand, FileUp, ChevronLeft, ChevronRight, X,
  Mic, MicOff, Volume2, ListOrdered,
} from "lucide-react";
import { toast } from "sonner";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useRequireOnline } from "@/components/online/shared";
import { getSocket, useSocketEvent } from "@/lib/socket";
import { API_ORIGIN } from "@/lib/env";

// pdfjs touches DOM globals (DOMMatrix) at import time, which crashes SSR —
// load it lazily on the client only, the first time a presentation is shown.
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsPromise;
}

const API_BASE = API_ORIGIN;
const absUrl = (u: string) => (u.startsWith("http") ? u : `${API_BASE}${u}`);

type BoardDoc = { url: string; page: number; numPages: number; kind?: "pdf" | "image" };
type Participant = {
  id: string; name: string; avatarUrl: string | null; isTeacher: boolean;
  hand: boolean; micAllowed?: boolean; speaking?: boolean;
};
type RoomMsg = { id: string; from: { id: string; name: string; isTeacher: boolean }; text: string; at: string };
type PanelTab = null | "notes" | "chat" | "people";
type PollPublic = { id: string; question: string; options: string[]; counts: number[]; total: number; open: boolean };

// One RTCPeerConnection per listening student (teacher side).
const RTC_CONFIG: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export const Route = createFileRoute("/online/live/$sessionId")({
  component: Blackboard,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = "pen" | "line" | "arrow" | "rect" | "circle" | "text" | "eraser";
type Color = string;

interface Point { x: number; y: number }

interface Stroke {
  id?: string;
  tool: Tool;
  color: Color;
  width: number;
  points: Point[];       // pen/eraser: polyline; others: [start, end]
  text?: string;         // tool === 'text'
  fill?: boolean;
  opacity: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS: Color[] = [
  "#000000", "#ffffff", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4",
];

const WIDTHS = [2, 4, 6, 10, 16];

const TOOL_CFG: Record<Tool, { icon: React.ElementType; label: string; key: string }> = {
  pen:    { icon: Pencil, label: "Crayon",     key: "p" },
  line:   { icon: Minus,  label: "Ligne",      key: "l" },
  arrow:  { icon: ArrowLeft, label: "Flèche",  key: "a" },
  rect:   { icon: Square, label: "Rectangle",  key: "r" },
  circle: { icon: Circle, label: "Cercle",     key: "c" },
  text:   { icon: Type,   label: "Texte",      key: "t" },
  eraser: { icon: Eraser, label: "Gomme",      key: "e" },
};

// ─── Canvas renderer ─────────────────────────────────────────────────────────

function renderStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (!s.points.length) return;
  ctx.save();
  ctx.globalAlpha = s.opacity;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const [a, b] = [s.points[0], s.points[s.points.length - 1]];

  if (s.tool === "pen" || s.tool === "eraser") {
    if (s.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    for (let i = 1; i < s.points.length; i++) {
      const mid = {
        x: (s.points[i - 1].x + s.points[i].x) / 2,
        y: (s.points[i - 1].y + s.points[i].y) / 2,
      };
      ctx.quadraticCurveTo(s.points[i - 1].x, s.points[i - 1].y, mid.x, mid.y);
    }
    ctx.stroke();
  } else if (s.tool === "line") {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  } else if (s.tool === "arrow") {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const angle = Math.atan2(dy, dx);
    const len = Math.hypot(dx, dy);
    const head = Math.min(20, len * 0.3);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  } else if (s.tool === "rect") {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);
    if (s.fill) ctx.fillRect(x, y, w, h);
    else ctx.strokeRect(x, y, w, h);
  } else if (s.tool === "circle") {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.abs(b.x - a.x) / 2;
    const ry = Math.abs(b.y - a.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    if (s.fill) ctx.fill(); else ctx.stroke();
  } else if (s.tool === "text" && s.text) {
    ctx.font = `${s.width * 5}px sans-serif`;
    ctx.fillText(s.text, a.x, a.y);
  }

  ctx.restore();
}

function redrawAll(ctx: CanvasRenderingContext2D, strokes: Stroke[], bg: string | null) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  // When a presentation is displayed underneath, the drawing layer stays
  // transparent so annotations sit on top of the slide.
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }
  for (const s of strokes) renderStroke(ctx, s);
}

// ─── Main component ───────────────────────────────────────────────────────────

function Blackboard() {
  const { sessionId: baseSessionId } = Route.useParams();
  const { user, ready } = useRequireOnline();

  // Breakout support: every socket emit targets the ACTIVE room (main session
  // or a "<id>::gN" sub-group board). Existing code keeps using `sessionId`.
  const [room, setRoom] = useState(baseSessionId);
  const sessionId = room;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool]       = useState<Tool>("pen");
  const [color, setColor]     = useState<Color>("#000000");
  const [width, setWidth]     = useState(4);
  const [opacity, setOpacity] = useState(1);
  const [fill, setFill]       = useState(false);
  const [bg, setBg]           = useState("#ffffff");

  const [strokes, setStrokes]   = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [drawing, setDrawing]   = useState(false);
  const [current, setCurrent]   = useState<Stroke | null>(null);

  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textVal, setTextVal]     = useState("");

  const [connected, setConnected] = useState(false);
  const [viewers, setViewers]     = useState(0);
  const [zoom, setZoom]           = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Collaborative room state (server-authoritative)
  const [serverTeacher, setServerTeacher] = useState<boolean | null>(null);
  const [allowStudents, setAllowStudents] = useState(false);
  const [doc, setDoc] = useState<BoardDoc | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Live voice (teacher mic → students)
  const [voiceOn, setVoiceOn] = useState(false);        // room-wide broadcast state
  const [micActive, setMicActive] = useState(false);    // teacher: mic capturing
  const [audioBlocked, setAudioBlocked] = useState(false); // student: autoplay blocked
  const micStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map()); // teacher: per-student
  const studentPcRef = useRef<RTCPeerConnection | null>(null);        // student: single pc
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Shared summary panel ("sommaire") + side panel tabs
  const [notes, setNotes] = useState("");
  const [panel, setPanel] = useState<PanelTab>(null);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Screen share (teacher's screen → students)
  const [screenOn, setScreenOn] = useState(false);        // room-wide state
  const [screenActive, setScreenActive] = useState(false); // teacher capturing
  const [screenHidden, setScreenHidden] = useState(false); // student local toggle
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const studentScreenPcRef = useRef<RTCPeerConnection | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // Student microphone (floor granted by the teacher)
  const [speaking, setSpeaking] = useState(false);
  const micMyStreamRef = useRef<MediaStream | null>(null);
  const micPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());      // me as speaker
  const micListenPcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());  // speakers I hear
  const micAudioRef = useRef<HTMLAudioElement>(null);

  // Live poll
  const [poll, setPoll] = useState<PollPublic | null>(null);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [pollModal, setPollModal] = useState(false);
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState("");

  // Laser pointer
  const [laserMode, setLaserMode] = useState(false);          // teacher tool
  const [laser, setLaserDot] = useState<Point | null>(null);  // remote dot
  const laserLastSent = useRef(0);

  // Multiple boards (flipchart pages) + breakout
  const [boardCount, setBoardCount] = useState(1);
  const [boardIndex, setBoardIndex] = useState(0);
  const [breakoutGroup, setBreakoutGroup] = useState<number | null>(null); // student: my group
  const [breakoutActive, setBreakoutActive] = useState(false);             // teacher indicator

  // Participants / hand raise / room chat
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMsgs, setChatMsgs] = useState<RoomMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadChat, setUnreadChat] = useState(0);
  const panelRef = useRef<PanelTab>(null);
  panelRef.current = panel;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const myHand = participants.find((p) => p.id === user?.id)?.hand ?? false;
  const handsUp = participants.filter((p) => p.hand);

  const roleGuess = user?.role === "TEACHER_ONLINE" || user?.systemRole === "SUPER_ADMIN";
  const isTeacher = serverTeacher ?? roleGuess;
  const canDraw = isTeacher || allowStudents;

  // ── Socket setup ──────────────────────────────────────────────────────────

  useEffect(() => {
    const s = getSocket();
    if (!s || !sessionId) return;

    s.emit("board:join", sessionId, (res: {
      ok: boolean; strokes: Stroke[]; background: string;
      allowStudents?: boolean; doc?: BoardDoc | null; isTeacher?: boolean;
      voiceOn?: boolean; notes?: string; participants?: Participant[]; chat?: RoomMsg[];
      screenOn?: boolean; poll?: PollPublic | null; myVote?: number | null;
      boardCount?: number; boardIndex?: number;
    }) => {
      if (res?.ok) {
        setConnected(true);
        setStrokes(res.strokes ?? []);
        setRedoStack([]);
        setCurrent(null);
        if (res.background) setBg(res.background);
        setAllowStudents(Boolean(res.allowStudents));
        setDoc(res.doc ?? null);
        if (typeof res.isTeacher === "boolean") setServerTeacher(res.isTeacher);
        setVoiceOn(Boolean(res.voiceOn));
        setNotes(res.notes ?? "");
        setParticipants(res.participants ?? []);
        setChatMsgs(res.chat ?? []);
        setScreenOn(Boolean(res.screenOn));
        setPoll(res.poll ?? null);
        setMyVote(res.myVote ?? null);
        setBoardCount(res.boardCount ?? 1);
        setBoardIndex(res.boardIndex ?? 0);
        if (res.notes) setPanel("notes");
        // Late joiner while the teacher is already streaming → hop on.
        if (res.voiceOn && !res.isTeacher) s.emit("voice:join", { sessionId });
        if (res.screenOn && !res.isTeacher) s.emit("screen:join", { sessionId });
      }
    });

    return () => {
      s.emit("board:leave", sessionId);
      stopAllVoice();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    const s = getSocket();
    setConnected(!!s?.connected);
  }, []);

  // Receive strokes from teacher
  useSocketEvent<Stroke>("board:stroke", (stroke) => {
    setStrokes(prev => [...prev, stroke]);
    setRedoStack([]);
  });

  // Receive clear
  useSocketEvent<void>("board:clear", () => {
    setStrokes([]);
    setRedoStack([]);
  });

  // Receive full sync
  useSocketEvent<{ strokes: Stroke[] }>("board:sync", ({ strokes: ss }) => {
    setStrokes(ss ?? []);
  });

  // Teacher toggled collaborative writing
  useSocketEvent<{ allowStudents: boolean }>("board:permission", ({ allowStudents: v }) => {
    setAllowStudents(v);
    if (!isTeacher) toast(v ? "✍️ L'enseignant vous autorise à écrire" : "✋ Écriture désactivée par l'enseignant");
  });

  // Presentation set / cleared
  useSocketEvent<BoardDoc | null>("board:doc", (d) => setDoc(d ?? null));

  // Presentation page flipped
  useSocketEvent<{ page: number }>("board:page", ({ page }) => {
    setDoc((prev) => (prev ? { ...prev, page } : prev));
  });

  // ── Live voice: signaling ─────────────────────────────────────────────────

  function stopAllVoice() {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    studentPcRef.current?.close();
    studentPcRef.current = null;
    setMicActive(false);
  }

  // Teacher toggled the broadcast (received by everyone, incl. late state)
  useSocketEvent<{ on: boolean }>("board:voice", ({ on }) => {
    setVoiceOn(on);
    if (!isTeacher) {
      if (on) {
        const s = getSocket();
        if (s) s.emit("voice:join", { sessionId });
        toast("🎙️ L'enseignant a activé sa voix");
      } else {
        studentPcRef.current?.close();
        studentPcRef.current = null;
      }
    }
  });

  // TEACHER: a student wants the audio → open a peer connection towards them.
  useSocketEvent<{ from: string }>("voice:join", async ({ from }) => {
    if (!isTeacher || !micStreamRef.current) return;
    const s = getSocket();
    if (!s) return;
    peersRef.current.get(from)?.close();
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(from, pc);
    micStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, micStreamRef.current!));
    pc.onicecandidate = (e) => {
      if (e.candidate) s.emit("voice:signal", { to: from, data: { ice: e.candidate } });
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    s.emit("voice:signal", { to: from, data: { sdp: pc.localDescription } });
  });

  // BOTH sides: SDP / ICE relay.
  useSocketEvent<{ from: string; data: { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit } }>(
    "voice:signal",
    async ({ from, data }) => {
      const s = getSocket();
      if (!s) return;
      if (isTeacher) {
        const pc = peersRef.current.get(from);
        if (!pc) return;
        if (data.sdp) await pc.setRemoteDescription(data.sdp).catch(() => {});
        if (data.ice) await pc.addIceCandidate(data.ice).catch(() => {});
        return;
      }
      // Student: the offer creates (or replaces) the single listening connection.
      if (data.sdp && data.sdp.type === "offer") {
        studentPcRef.current?.close();
        const pc = new RTCPeerConnection(RTC_CONFIG);
        studentPcRef.current = pc;
        pc.onicecandidate = (e) => {
          if (e.candidate) s.emit("voice:signal", { to: from, data: { ice: e.candidate } });
        };
        pc.ontrack = (e) => {
          const el = remoteAudioRef.current;
          if (!el) return;
          el.srcObject = e.streams[0];
          el.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
        };
        await pc.setRemoteDescription(data.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        s.emit("voice:signal", { to: from, data: { sdp: pc.localDescription } });
      } else if (data.ice) {
        await studentPcRef.current?.addIceCandidate(data.ice).catch(() => {});
      }
    },
  );

  // TEACHER: start / stop the microphone broadcast.
  async function toggleMic() {
    const s = getSocket();
    if (!s) return;
    if (micActive) {
      stopAllVoice();
      s.emit("board:voice", { sessionId, on: false });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicActive(true);
      s.emit("board:voice", { sessionId, on: true });
      toast.success("🎙️ Micro activé — les élèves vous entendent");
    } catch {
      toast.error("Micro refusé — autorisez le microphone dans le navigateur");
    }
  }

  // ── Screen share: signaling ───────────────────────────────────────────────

  function stopScreen() {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    screenPeersRef.current.forEach((pc) => pc.close());
    screenPeersRef.current.clear();
    setScreenActive(false);
  }

  useSocketEvent<{ on: boolean }>("board:screen", ({ on }) => {
    setScreenOn(on);
    if (!isTeacher) {
      if (on) {
        const s = getSocket();
        if (s) s.emit("screen:join", { sessionId });
        toast("🖥️ L'enseignant partage son écran");
      } else {
        studentScreenPcRef.current?.close();
        studentScreenPcRef.current = null;
      }
    }
  });

  useSocketEvent<{ from: string }>("screen:join", async ({ from }) => {
    if (!isTeacher || !screenStreamRef.current) return;
    const s = getSocket();
    if (!s) return;
    screenPeersRef.current.get(from)?.close();
    const pc = new RTCPeerConnection(RTC_CONFIG);
    screenPeersRef.current.set(from, pc);
    screenStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, screenStreamRef.current!));
    pc.onicecandidate = (e) => { if (e.candidate) s.emit("screen:signal", { to: from, data: { ice: e.candidate } }); };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    s.emit("screen:signal", { to: from, data: { sdp: pc.localDescription } });
  });

  useSocketEvent<{ from: string; data: { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit } }>(
    "screen:signal",
    async ({ from, data }) => {
      const s = getSocket();
      if (!s) return;
      if (isTeacher) {
        const pc = screenPeersRef.current.get(from);
        if (!pc) return;
        if (data.sdp) await pc.setRemoteDescription(data.sdp).catch(() => {});
        if (data.ice) await pc.addIceCandidate(data.ice).catch(() => {});
        return;
      }
      if (data.sdp && data.sdp.type === "offer") {
        studentScreenPcRef.current?.close();
        const pc = new RTCPeerConnection(RTC_CONFIG);
        studentScreenPcRef.current = pc;
        pc.onicecandidate = (e) => { if (e.candidate) s.emit("screen:signal", { to: from, data: { ice: e.candidate } }); };
        pc.ontrack = (e) => {
          const el = screenVideoRef.current;
          if (el) { el.srcObject = e.streams[0]; el.play().catch(() => {}); }
        };
        await pc.setRemoteDescription(data.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        s.emit("screen:signal", { to: from, data: { sdp: pc.localDescription } });
      } else if (data.ice) {
        await studentScreenPcRef.current?.addIceCandidate(data.ice).catch(() => {});
      }
    },
  );

  async function toggleScreen() {
    const s = getSocket();
    if (!s) return;
    if (screenActive) {
      stopScreen();
      s.emit("board:screen", { sessionId, on: false });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      setScreenActive(true);
      s.emit("board:screen", { sessionId, on: true });
      // Browser-native "stop sharing" bar also ends the broadcast.
      stream.getVideoTracks()[0].onended = () => {
        stopScreen();
        s.emit("board:screen", { sessionId, on: false });
      };
      toast.success("🖥️ Écran partagé avec la classe");
    } catch {
      toast.error("Partage d'écran annulé ou refusé");
    }
  }

  // ── Student microphone (floor) ────────────────────────────────────────────

  const meP = participants.find((p) => p.id === user?.id);
  const micAllowedMe = Boolean(meP?.micAllowed);

  useSocketEvent<{ allowed: boolean }>("board:micgrant", ({ allowed }) => {
    if (allowed) toast.success("🎤 L'enseignant vous donne la parole — cliquez sur « Parler »");
    else {
      toast("🎤 Parole retirée");
      stopSpeaking(false);
    }
  });

  useSocketEvent<{ userId: string; name: string; on: boolean }>("board:micon", ({ userId: uid, name, on }) => {
    if (uid === user?.id) return;
    const s = getSocket();
    if (on) {
      if (s) s.emit("mic:join", { speaker: uid });
      toast(`🎤 ${name} a la parole`);
    } else {
      micListenPcsRef.current.get(uid)?.close();
      micListenPcsRef.current.delete(uid);
    }
  });

  // Speaker side: a listener wants my audio.
  useSocketEvent<{ from: string }>("mic:join", async ({ from }) => {
    if (!micMyStreamRef.current) return;
    const s = getSocket();
    if (!s) return;
    micPeersRef.current.get(from)?.close();
    const pc = new RTCPeerConnection(RTC_CONFIG);
    micPeersRef.current.set(from, pc);
    micMyStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, micMyStreamRef.current!));
    pc.onicecandidate = (e) => { if (e.candidate) s.emit("mic:signal", { to: from, data: { ice: e.candidate } }); };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    s.emit("mic:signal", { to: from, data: { sdp: pc.localDescription } });
  });

  useSocketEvent<{ from: string; data: { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit } }>(
    "mic:signal",
    async ({ from, data }) => {
      const s = getSocket();
      if (!s) return;
      if (data.sdp?.type === "offer") {
        // I'm a listener: answer the speaker.
        micListenPcsRef.current.get(from)?.close();
        const pc = new RTCPeerConnection(RTC_CONFIG);
        micListenPcsRef.current.set(from, pc);
        pc.onicecandidate = (e) => { if (e.candidate) s.emit("mic:signal", { to: from, data: { ice: e.candidate } }); };
        pc.ontrack = (e) => {
          const el = micAudioRef.current;
          if (el) { el.srcObject = e.streams[0]; el.play().catch(() => {}); }
        };
        await pc.setRemoteDescription(data.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        s.emit("mic:signal", { to: from, data: { sdp: pc.localDescription } });
      } else if (data.sdp?.type === "answer") {
        await micPeersRef.current.get(from)?.setRemoteDescription(data.sdp).catch(() => {});
      } else if (data.ice) {
        const pc = micPeersRef.current.get(from) ?? micListenPcsRef.current.get(from);
        await pc?.addIceCandidate(data.ice).catch(() => {});
      }
    },
  );

  function stopSpeaking(emit = true) {
    micMyStreamRef.current?.getTracks().forEach((t) => t.stop());
    micMyStreamRef.current = null;
    micPeersRef.current.forEach((pc) => pc.close());
    micPeersRef.current.clear();
    setSpeaking(false);
    if (emit) {
      const s = getSocket();
      if (s) s.emit("board:micon", { sessionId, on: false });
    }
  }

  async function toggleSpeak() {
    const s = getSocket();
    if (!s) return;
    if (speaking) { stopSpeaking(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micMyStreamRef.current = stream;
      setSpeaking(true);
      s.emit("board:micon", { sessionId, on: true });
      toast.success("🎤 Vous avez la parole — toute la salle vous entend");
    } catch {
      toast.error("Micro refusé — autorisez le microphone dans le navigateur");
    }
  }

  function grantMic(targetId: string, allowed: boolean) {
    const s = getSocket();
    if (s) s.emit("board:micgrant", { sessionId, userId: targetId, allowed });
  }

  // ── Live poll ─────────────────────────────────────────────────────────────

  useSocketEvent<PollPublic | null>("board:poll", (p) => {
    setPoll((prev) => {
      if (p && (!prev || prev.id !== p.id)) setMyVote(null);
      return p;
    });
  });

  function launchPoll() {
    const options = pollOpts.split("\n").map((o) => o.trim()).filter(Boolean);
    if (!pollQ.trim() || options.length < 2) { toast.error("Question + au moins 2 options (une par ligne)"); return; }
    const s = getSocket();
    if (s) s.emit("board:poll", { sessionId, question: pollQ, options });
    setPollModal(false);
    setPollQ(""); setPollOpts("");
  }

  function vote(i: number) {
    if (!poll?.open) return;
    setMyVote(i);
    const s = getSocket();
    if (s) s.emit("board:vote", { sessionId, index: i });
  }

  // ── Laser pointer ─────────────────────────────────────────────────────────

  useSocketEvent<{ x: number; y: number; on: boolean }>("board:laser", ({ x, y, on }) => {
    setLaserDot(on ? { x, y } : null);
  });

  function emitLaser(e: React.MouseEvent, on: boolean) {
    if (!isTeacher || !laserMode) return;
    const now = Date.now();
    if (on && now - laserLastSent.current < 40) return;
    laserLastSent.current = now;
    const pt = canvasPoint(e);
    const s = getSocket();
    if (s) s.emit("board:laser", { sessionId, x: pt.x, y: pt.y, on });
  }

  // ── Multiple boards (flipchart) ───────────────────────────────────────────

  useSocketEvent<{ boardCount: number; boardIndex: number; strokes: Stroke[] }>("board:board", (b) => {
    setBoardCount(b.boardCount);
    setBoardIndex(b.boardIndex);
    setStrokes(b.strokes ?? []);
    setRedoStack([]);
    setCurrent(null);
  });

  function switchBoard(action: "add" | "switch", index?: number) {
    const s = getSocket();
    if (s) s.emit("board:board", { sessionId, action, index });
  }

  // ── Breakout rooms ────────────────────────────────────────────────────────

  useSocketEvent<{ room: string | null; group?: number }>("board:breakout", ({ room: target, group }) => {
    stopAllVoice();
    stopScreen();
    stopSpeaking(false);
    if (target) {
      setBreakoutGroup(group ?? null);
      setRoom(target);
      toast.success(`👥 Vous rejoignez le groupe ${group}`);
    } else {
      setBreakoutGroup(null);
      setRoom(baseSessionId);
      toast("↩️ Retour à la salle principale");
    }
  });

  useSocketEvent<{ active: boolean; groups?: number }>("board:breakout-info", ({ active }) => {
    setBreakoutActive(active);
  });

  function startBreakout(n: number) {
    const s = getSocket();
    if (s) s.emit("board:breakout-start", { sessionId: baseSessionId, groups: n });
    setBreakoutActive(true);
    toast.success(`Sous-groupes créés (${n})`);
  }

  function stopBreakout() {
    const s = getSocket();
    if (s) s.emit("board:breakout-stop", { sessionId: baseSessionId });
    setBreakoutActive(false);
  }

  function visitRoom(target: string, label: string) {
    setRoom(target);
    toast(`👁 ${label}`);
  }

  // ── Shared summary ("sommaire") ───────────────────────────────────────────

  useSocketEvent<{ notes: string }>("board:notes", ({ notes: n }) => {
    setNotes(n);
    if (n && panelRef.current === null) setPanel("notes");
  });

  // ── Participants / hand / room chat ───────────────────────────────────────

  useSocketEvent<Participant[]>("board:participants", (list) => {
    setParticipants(list ?? []);
  });

  useSocketEvent<{ name: string }>("board:hand", ({ name }) => {
    if (isTeacher) toast(`✋ ${name} lève la main`);
  });

  useSocketEvent<RoomMsg>("board:chat", (msg) => {
    setChatMsgs((prev) => [...prev.slice(-99), msg]);
    if (panelRef.current !== "chat") setUnreadChat((n) => n + 1);
  });

  // Autoscroll chat + clear unread when the chat tab is open
  useEffect(() => {
    if (panel === "chat") {
      setUnreadChat(0);
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [panel, chatMsgs.length]);

  function toggleHand() {
    const s = getSocket();
    if (s) s.emit("board:hand", { sessionId, up: !myHand });
  }

  function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    const s = getSocket();
    if (s) s.emit("board:chat", { sessionId, text });
    setChatInput("");
  }

  function onNotesChange(v: string) {
    setNotes(v);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      const s = getSocket();
      if (s) s.emit("board:notes", { sessionId, notes: v });
    }, 350);
  }

  // ── Canvas rendering ──────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    redrawAll(ctx, strokes, doc ? null : bg);
    if (current) renderStroke(ctx, current);
  }, [strokes, current, bg, doc]);

  // ── Presentation rendering (PDF page → background canvas) ────────────────
  const pdfRef = useRef<{ url: string; pdf: PDFDocumentProxy } | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function render() {
      const bgCanvas = bgCanvasRef.current;
      const container = containerRef.current;
      if (!bgCanvas || !container) return;
      const ctx2 = bgCanvas.getContext("2d");
      if (!ctx2) return;
      const { width: cw, height: ch } = container.getBoundingClientRect();
      bgCanvas.width = Math.floor(cw);
      bgCanvas.height = Math.floor(ch);
      ctx2.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      if (!doc) return;
      // Image share: draw it directly, fit-contain centered.
      if (doc.kind === "image") {
        const img = new window.Image();
        img.onload = () => {
          if (cancelled) return;
          const scale = Math.min(cw / img.width, ch / img.height);
          const w = img.width * scale, h = img.height * scale;
          const ox = (cw - w) / 2, oy = (ch - h) / 2;
          ctx2.fillStyle = "#ffffff";
          ctx2.fillRect(ox, oy, w, h);
          ctx2.drawImage(img, ox, oy, w, h);
        };
        img.onerror = () => { if (!cancelled) toast.error("Impossible d'afficher l'image"); };
        img.src = absUrl(doc.url);
        return;
      }
      try {
        if (!pdfRef.current || pdfRef.current.url !== doc.url) {
          const pdfjs = await loadPdfjs();
          const pdf = await pdfjs.getDocument({ url: absUrl(doc.url) }).promise;
          pdfRef.current = { url: doc.url, pdf };
        }
        if (cancelled) return;
        const page = await pdfRef.current.pdf.getPage(doc.page);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        // Fit-contain inside the container, centered.
        const scale = Math.min(cw / base.width, ch / base.height);
        const viewport = page.getViewport({ scale });
        const off = document.createElement("canvas");
        off.width = Math.max(1, Math.floor(viewport.width));
        off.height = Math.max(1, Math.floor(viewport.height));
        await page.render({ canvas: off, viewport }).promise;
        if (cancelled) return;
        const offX = (cw - viewport.width) / 2;
        const offY = (ch - viewport.height) / 2;
        ctx2.fillStyle = "#ffffff";
        ctx2.fillRect(offX, offY, viewport.width, viewport.height);
        ctx2.drawImage(off, offX, offY);
      } catch {
        if (!cancelled) toast.error("Impossible d'afficher la présentation");
      }
    }
    render();
    return () => { cancelled = true; };
  }, [doc]);

  // Resize canvas to container
  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const { width, height } = container.getBoundingClientRect();
      canvas.width = Math.floor(width);
      canvas.height = Math.floor(height);
      const ctx = canvas.getContext("2d");
      if (ctx) redrawAll(ctx, strokes, bg);
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pointer event helpers ─────────────────────────────────────────────────

  function canvasPoint(e: React.MouseEvent | React.TouchEvent): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    if (!canDraw || laserMode) return;
    if (tool === "text") {
      const pt = canvasPoint(e);
      setTextInput(pt);
      setTextVal("");
      return;
    }
    const pt = canvasPoint(e);
    const stroke: Stroke = { tool, color, width, opacity, fill, points: [pt] };
    setCurrent(stroke);
    setDrawing(true);
  }

  function moveDraw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing || !current || !canDraw) return;
    const pt = canvasPoint(e);

    if (tool === "pen" || tool === "eraser") {
      setCurrent(prev => prev ? { ...prev, points: [...prev.points, pt] } : null);
    } else {
      // Shape tools: keep only start + current end
      setCurrent(prev => prev ? { ...prev, points: [prev.points[0], pt] } : null);
    }
  }

  function endDraw() {
    if (!drawing || !current || !canDraw) return;
    setDrawing(false);
    if (current.points.length < 2 && tool !== "pen") {
      setCurrent(null);
      return;
    }
    const finished = { ...current };
    setStrokes(prev => [...prev, finished]);
    setRedoStack([]);
    setCurrent(null);
    // Broadcast
    const s = getSocket();
    if (s) s.emit("board:stroke", { sessionId, stroke: finished });
  }

  // ── Text input confirm ────────────────────────────────────────────────────

  function confirmText() {
    if (!textInput || !textVal.trim()) { setTextInput(null); return; }
    const stroke: Stroke = {
      tool: "text", color, width, opacity, fill,
      points: [textInput],
      text: textVal.trim(),
    };
    setStrokes(prev => [...prev, stroke]);
    setRedoStack([]);
    const s = getSocket();
    if (s) s.emit("board:stroke", { sessionId, stroke });
    setTextInput(null);
    setTextVal("");
  }

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  function undo() {
    if (!canDraw || strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setStrokes(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, last]);
    const s = getSocket();
    if (s) s.emit("board:undo", { sessionId });
  }

  function redo() {
    if (!canDraw || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setStrokes(prev => [...prev, next]);
    const s = getSocket();
    if (s) s.emit("board:stroke", { sessionId, stroke: next });
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  function clearBoard() {
    if (!isTeacher) return;
    if (!confirm("Effacer tout le tableau ?")) return;
    setStrokes([]);
    setRedoStack([]);
    const s = getSocket();
    if (s) s.emit("board:clear", { sessionId });
  }

  // ── Collaboration & presentation controls (teacher) ──────────────────────

  function togglePermission() {
    if (!isTeacher) return;
    const s = getSocket();
    if (s) s.emit("board:permission", { sessionId, allowStudents: !allowStudents });
  }

  function goToPage(page: number) {
    if (!isTeacher || !doc) return;
    const p = Math.max(1, Math.min(page, doc.numPages));
    const s = getSocket();
    if (s) s.emit("board:page", { sessionId, page: p });
  }

  function closePresentation() {
    if (!isTeacher) return;
    const s = getSocket();
    if (s) s.emit("board:doc", { sessionId, url: null });
  }

  async function uploadPresentation(file: File) {
    if (!isTeacher) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const tok = localStorage.getItem("us.accessToken");
      const res = await fetch(`${API_BASE}/api/online/live-sessions/${sessionId}/presentation`, {
        method: "POST",
        headers: tok ? { Authorization: `Bearer ${tok}` } : undefined,
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? `Erreur ${res.status}`);
      }
      const { url, kind } = await res.json();
      const s = getSocket();
      if (kind === "image") {
        if (s) s.emit("board:doc", { sessionId, url, numPages: 1, kind: "image" });
        toast.success("Image partagée avec la classe");
      } else {
        // Count pages client-side, then share the doc with the room.
        const pdfjs = await loadPdfjs();
        const pdf = await pdfjs.getDocument({ url: absUrl(url) }).promise;
        if (s) s.emit("board:doc", { sessionId, url, numPages: pdf.numPages, kind: "pdf" });
        toast.success(`Présentation partagée (${pdf.numPages} page${pdf.numPages > 1 ? "s" : ""})`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'envoi de la présentation");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Download ──────────────────────────────────────────────────────────────

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `tableau-${sessionId}-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); redo(); }
      if (e.key === "y" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); redo(); }
      if (!e.ctrlKey && !e.metaKey) {
        const match = Object.entries(TOOL_CFG).find(([, v]) => v.key === e.key);
        if (match) setTool(match[0] as Tool);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, redoStack]);

  if (!ready || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#1a1a2e] select-none">

      {/* ── Top toolbar ── */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-[#16213e] px-3">
        <Link to="/online/teacher" className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour
        </Link>

        <div className="h-4 w-px bg-white/10 mx-1" />

        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`} />
          <span className="text-xs text-white/60">{connected ? "Connecté" : "Déconnecté"}</span>
        </div>

        {!isTeacher && (
          allowStudents ? (
            <div className="flex items-center gap-1 rounded-md bg-green-500/20 px-2 py-1 text-[10px] font-medium text-green-400">
              <Pencil className="h-3 w-3" /> Écriture autorisée
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-1 text-[10px] font-medium text-amber-400">
              <Eye className="h-3 w-3" /> Vue étudiant — lecture seule
            </div>
          )
        )}

        {/* Teacher: allow students to write */}
        {isTeacher && (
          <button
            onClick={togglePermission}
            title={allowStudents ? "Bloquer l'écriture des élèves" : "Autoriser les élèves à écrire"}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
              allowStudents
                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                : "border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Hand className="h-3.5 w-3.5" />
            {allowStudents ? "Élèves : écriture ON" : "Élèves : lecture seule"}
          </button>
        )}

        {/* Presentation controls */}
        {isTeacher && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPresentation(f); }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Partager un PDF ou une image (PowerPoint : exportez en PDF)"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/60 hover:bg-white/10 hover:text-white transition disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
              Présentation
            </button>
            {/* Voice broadcast */}
            <button
              onClick={toggleMic}
              title={micActive ? "Couper le micro" : "Activer le micro — les élèves vous entendront"}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                micActive
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {micActive ? <Mic className="h-3.5 w-3.5 animate-pulse" /> : <MicOff className="h-3.5 w-3.5" />}
              {micActive ? "Micro ON" : "Micro"}
            </button>
            {/* Screen share */}
            <button
              onClick={toggleScreen}
              title={screenActive ? "Arrêter le partage d'écran" : "Partager votre écran avec la classe"}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                screenActive
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              🖥️ {screenActive ? "Écran ON" : "Écran"}
            </button>
            {/* Poll */}
            <button
              onClick={() => setPollModal(true)}
              title="Lancer un sondage éclair"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/60 hover:bg-white/10 hover:text-white transition"
            >
              📊 Sondage
            </button>
            {/* Breakout */}
            {room === baseSessionId ? (
              !breakoutActive ? (
                <div className="group relative">
                  <button className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/60 hover:bg-white/10 hover:text-white transition">
                    👥 Sous-groupes
                  </button>
                  <div className="absolute left-0 top-full z-30 hidden gap-1 rounded-lg bg-[#0f1830] p-1 shadow-xl group-hover:flex">
                    {[2, 3, 4].map((n) => (
                      <button key={n} onClick={() => startBreakout(n)}
                        className="rounded px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10">{n}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <button onClick={stopBreakout}
                    className="flex items-center gap-1.5 rounded-lg bg-purple-500/25 px-2.5 py-1.5 text-[11px] font-medium text-purple-300 hover:bg-purple-500/35 transition">
                    👥 Terminer les groupes
                  </button>
                  {[1, 2, 3, 4].map((g) => (
                    <button key={g} onClick={() => visitRoom(`${baseSessionId}::g${g}`, `Visite du groupe ${g}`)}
                      className="rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-white/50 hover:bg-white/10 hover:text-white transition">
                      G{g}
                    </button>
                  ))}
                </>
              )
            ) : (
              <button onClick={() => visitRoom(baseSessionId, "Salle principale")}
                className="flex items-center gap-1.5 rounded-lg bg-purple-500/25 px-2.5 py-1.5 text-[11px] font-medium text-purple-300 hover:bg-purple-500/35 transition">
                ↩️ Salle principale
              </button>
            )}
          </>
        )}

        {/* Student: speak button when the teacher granted the floor */}
        {!isTeacher && micAllowedMe && (
          <button
            onClick={toggleSpeak}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
              speaking ? "animate-pulse bg-red-500/25 text-red-300" : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
            }`}
          >
            <Mic className="h-3.5 w-3.5" /> {speaking ? "Parole ON — couper" : "Parler"}
          </button>
        )}

        {/* Student: live audio indicator + autoplay unblock */}
        {!isTeacher && voiceOn && (
          <button
            onClick={() => {
              const el = remoteAudioRef.current;
              if (el) { el.muted = false; el.play().then(() => setAudioBlocked(false)).catch(() => {}); }
            }}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
              audioBlocked
                ? "animate-pulse bg-blue-500/30 text-blue-300 hover:bg-blue-500/40"
                : "bg-green-500/15 text-green-400"
            }`}
            title={audioBlocked ? "Cliquez pour entendre le prof" : "Voix du prof en direct"}
          >
            <Volume2 className="h-3.5 w-3.5" />
            {audioBlocked ? "🔇 Cliquez pour écouter" : "Voix du prof"}
          </button>
        )}

        {/* Student: raise hand */}
        {!isTeacher && (
          <button
            onClick={toggleHand}
            title={myHand ? "Baisser la main" : "Lever la main pour intervenir"}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
              myHand ? "animate-pulse bg-amber-500/25 text-amber-300" : "border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            ✋ {myHand ? "Main levée" : "Lever la main"}
          </button>
        )}

        {/* Side panel tabs: sommaire / chat / participants */}
        <button
          onClick={() => setPanel(panel === "notes" ? null : "notes")}
          title="Sommaire du cours (partagé en direct)"
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
            panel === "notes" ? "bg-blue-500/20 text-blue-300" : "border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          <ListOrdered className="h-3.5 w-3.5" /> Sommaire
        </button>
        <button
          onClick={() => setPanel(panel === "chat" ? null : "chat")}
          title="Chat de la salle"
          className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
            panel === "chat" ? "bg-blue-500/20 text-blue-300" : "border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          💬 Chat
          {unreadChat > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {unreadChat > 9 ? "9+" : unreadChat}
            </span>
          )}
        </button>
        <button
          onClick={() => setPanel(panel === "people" ? null : "people")}
          title="Participants"
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
            panel === "people" ? "bg-blue-500/20 text-blue-300" : "border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Users className="h-3.5 w-3.5" /> {participants.length}
          {handsUp.length > 0 && <span className="text-amber-400">✋{handsUp.length}</span>}
        </button>

        {/* Page navigation (visible to everyone when a doc is shared) */}
        {doc && (
          <div className="flex items-center gap-1 rounded-lg bg-white/5 px-1.5 py-1">
            {isTeacher && (
              <button onClick={() => goToPage(doc.page - 1)} disabled={doc.page <= 1}
                className="grid h-6 w-6 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            )}
            <span className="px-1 text-[11px] text-white/70">Diapo {doc.page}/{doc.numPages}</span>
            {isTeacher && (
              <>
                <button onClick={() => goToPage(doc.page + 1)} disabled={doc.page >= doc.numPages}
                  className="grid h-6 w-6 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button onClick={closePresentation} title="Fermer la présentation"
                  className="grid h-6 w-6 place-items-center rounded text-red-400/60 hover:bg-red-500/20 hover:text-red-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        )}

        <span className="flex-1" />

        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="grid h-7 w-7 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white transition">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <span className="text-[11px] text-white/50 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="grid h-7 w-7 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white transition">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setZoom(1)} className="grid h-7 w-7 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white transition" title="Réinitialiser le zoom">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {isTeacher && (
          <button onClick={download} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition">
            <Download className="h-3.5 w-3.5" /> Exporter
          </button>
        )}
      </header>

      {/* ── Body: sidebar + canvas ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left toolbar (anyone allowed to draw) */}
        {canDraw && (
          <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-white/10 bg-[#16213e] py-3 overflow-y-auto">

            {/* Tools */}
            {(Object.keys(TOOL_CFG) as Tool[]).map((t) => {
              const cfg = TOOL_CFG[t];
              const Icon = cfg.icon;
              return (
                <button
                  key={t}
                  title={`${cfg.label} (${cfg.key})`}
                  onClick={() => setTool(t)}
                  className={`grid h-10 w-10 place-items-center rounded-xl transition ${
                    tool === t
                      ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                      : "text-white/50 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}

            {/* Laser pointer — teacher only */}
            {isTeacher && (
              <button
                title="Pointeur laser (les élèves voient où vous pointez)"
                onClick={() => setLaserMode((v) => !v)}
                className={`grid h-10 w-10 place-items-center rounded-xl transition ${
                  laserMode ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "text-white/50 hover:bg-white/10 hover:text-white"
                }`}
              >
                🔴
              </button>
            )}

            <div className="my-1 w-8 border-t border-white/10" />

            {/* Undo / Redo */}
            <button onClick={undo} disabled={strokes.length === 0} title="Annuler (Ctrl+Z)"
              className="grid h-10 w-10 place-items-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white transition disabled:opacity-30">
              <Undo2 className="h-4 w-4" />
            </button>
            <button onClick={redo} disabled={redoStack.length === 0} title="Rétablir (Ctrl+Y)"
              className="grid h-10 w-10 place-items-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white transition disabled:opacity-30">
              <Redo2 className="h-4 w-4" />
            </button>

            {/* Clear — teacher only */}
            {isTeacher && (
              <>
                <div className="my-1 w-8 border-t border-white/10" />
                <button onClick={clearBoard} title="Effacer tout"
                  className="grid h-10 w-10 place-items-center rounded-xl text-red-400/60 hover:bg-red-500/20 hover:text-red-400 transition">
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </aside>
        )}

        {/* Canvas area */}
        <div className="relative flex-1 overflow-hidden" ref={containerRef}
          style={{ background: doc ? "#0f172a" : bg }}
        >
          {/* Presentation layer (PDF page) — annotations are drawn on top */}
          <canvas
            ref={bgCanvasRef}
            className="pointer-events-none absolute inset-0"
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 touch-none"
            style={{
              cursor: !canDraw ? "default"
                : tool === "eraser" ? "cell"
                : tool === "text" ? "text"
                : "crosshair",
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
            onMouseDown={canDraw ? startDraw : undefined}
            onMouseMove={canDraw ? (e) => { emitLaser(e, true); moveDraw(e); } : undefined}
            onMouseUp={canDraw ? endDraw : undefined}
            onMouseLeave={canDraw ? (e) => { emitLaser(e, false); endDraw(); } : undefined}
            onTouchStart={canDraw ? (e) => { e.preventDefault(); startDraw(e); } : undefined}
            onTouchMove={canDraw ? (e) => { e.preventDefault(); moveDraw(e); } : undefined}
            onTouchEnd={canDraw ? endDraw : undefined}
          />

          {/* Text input overlay */}
          {textInput && canDraw && (
            <div
              className="absolute"
              style={{ left: textInput.x * zoom, top: textInput.y * zoom }}
            >
              <input
                autoFocus
                value={textVal}
                onChange={e => setTextVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); confirmText(); }
                  if (e.key === "Escape") { setTextInput(null); setTextVal(""); }
                }}
                onBlur={confirmText}
                className="rounded border-none bg-transparent text-base outline-none"
                style={{
                  color,
                  fontSize: `${width * 5}px`,
                  minWidth: 80,
                  fontFamily: "sans-serif",
                  caretColor: color,
                }}
                placeholder="Tapez ici…"
              />
            </div>
          )}

          {/* Student read-only overlay */}
          {!canDraw && (
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-sm">
              <Eye className="h-3.5 w-3.5 text-white/70" />
              <span className="text-xs text-white/70">Mode lecture</span>
            </div>
          )}

          {/* Breakout banner */}
          {breakoutGroup != null && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-purple-500/90 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
              👥 Groupe {breakoutGroup} — travaillez ensemble sur ce tableau
            </div>
          )}

          {/* Remote laser pointer */}
          {laser && (
            <div
              className="pointer-events-none absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: laser.x * zoom,
                top: laser.y * zoom,
                background: "radial-gradient(circle, rgba(239,68,68,1) 30%, rgba(239,68,68,0.35) 60%, transparent 70%)",
                boxShadow: "0 0 12px 4px rgba(239,68,68,0.6)",
              }}
            />
          )}

          {/* Teacher's shared screen (students) */}
          {!isTeacher && screenOn && (
            <div className={`absolute inset-0 z-10 bg-black ${screenHidden ? "pointer-events-none opacity-0" : ""}`}>
              <video ref={screenVideoRef} autoPlay playsInline className="h-full w-full object-contain" />
            </div>
          )}
          {!isTeacher && screenOn && (
            <button
              onClick={() => setScreenHidden((v) => !v)}
              className="absolute bottom-3 right-3 z-20 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/80"
            >
              {screenHidden ? "🖥️ Voir l'écran du prof" : "✏️ Voir le tableau"}
            </button>
          )}

          {/* Board tabs (flipchart pages) */}
          <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1 rounded-xl bg-black/50 p-1 backdrop-blur">
            {Array.from({ length: boardCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => isTeacher && switchBoard("switch", i)}
                disabled={!isTeacher}
                title={isTeacher ? `Aller au tableau ${i + 1}` : `Tableau ${i + 1}`}
                className={`grid h-7 w-7 place-items-center rounded-lg text-[11px] font-semibold transition ${
                  i === boardIndex ? "bg-blue-500 text-white" : "text-white/60 hover:bg-white/10"
                } ${!isTeacher ? "cursor-default" : ""}`}
              >
                {i + 1}
              </button>
            ))}
            {isTeacher && boardCount < 10 && (
              <button
                onClick={() => switchBoard("add")}
                title="Nouveau tableau"
                className="grid h-7 w-7 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                +
              </button>
            )}
          </div>

          {/* Live poll card */}
          {poll && (
            <div className="absolute bottom-14 left-1/2 z-20 w-80 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#16213e]/95 p-4 shadow-2xl backdrop-blur">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  📊 Sondage {poll.open ? "en cours" : "terminé"}
                </span>
                {isTeacher && (
                  <div className="flex gap-1">
                    {poll.open && (
                      <button onClick={() => { const s = getSocket(); if (s) s.emit("board:poll-close", { sessionId }); }}
                        className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/20">Clôturer</button>
                    )}
                    <button onClick={() => { const s = getSocket(); if (s) s.emit("board:poll-clear", { sessionId }); }}
                      className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/20">Fermer</button>
                  </div>
                )}
              </div>
              <div className="mb-2 text-sm font-semibold text-white">{poll.question}</div>
              <div className="space-y-1.5">
                {poll.options.map((opt, i) => {
                  const pct = poll.total ? Math.round((poll.counts[i] / poll.total) * 100) : 0;
                  const showResults = myVote != null || !poll.open || isTeacher;
                  return (
                    <button
                      key={i}
                      onClick={() => !isTeacher && vote(i)}
                      disabled={isTeacher || !poll.open}
                      className={`relative w-full overflow-hidden rounded-lg border px-3 py-1.5 text-left text-xs transition ${
                        myVote === i ? "border-blue-400 text-white" : "border-white/10 text-white/80"
                      } ${!isTeacher && poll.open ? "hover:border-blue-400/60" : "cursor-default"}`}
                    >
                      {showResults && (
                        <div className="absolute inset-y-0 left-0 bg-blue-500/25 transition-all" style={{ width: `${pct}%` }} />
                      )}
                      <span className="relative flex items-center justify-between">
                        <span>{myVote === i && "✓ "}{opt}</span>
                        {showResults && <span className="font-semibold">{pct}% ({poll.counts[i]})</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 text-[10px] text-white/40">{poll.total} vote{poll.total !== 1 ? "s" : ""}</div>
            </div>
          )}
        </div>

        {/* Right panel: settings (anyone allowed to draw) */}
        {canDraw && (
          <aside className="flex w-52 shrink-0 flex-col gap-4 border-l border-white/10 bg-[#16213e] p-3 overflow-y-auto">

            {/* Color palette */}
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Couleur</div>
              <div className="grid grid-cols-5 gap-1.5">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`h-8 w-8 rounded-lg border-2 transition ${
                      color === c ? "border-blue-400 scale-110" : "border-transparent hover:border-white/30"
                    }`}
                    style={{ background: c, boxShadow: c === "#ffffff" ? "inset 0 0 0 1px rgba(255,255,255,0.2)" : undefined }}
                  />
                ))}
              </div>
              {/* Custom color */}
              <div className="mt-2 flex items-center gap-2">
                <label className="text-[10px] text-white/40">Perso.</label>
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="h-7 w-14 cursor-pointer rounded border-0 bg-transparent"
                />
              </div>
            </div>

            {/* Stroke width */}
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Épaisseur</div>
              <div className="flex items-center gap-2">
                {WIDTHS.map(w => (
                  <button
                    key={w}
                    onClick={() => setWidth(w)}
                    className={`flex h-8 flex-1 items-center justify-center rounded-lg border transition ${
                      width === w ? "border-blue-400 bg-blue-500/20" : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <div
                      className="rounded-full bg-white"
                      style={{ width: w, height: w }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity */}
            <div>
              <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-white/40">
                <span>Opacité</span>
                <span className="text-white/60">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range" min={0.1} max={1} step={0.05}
                value={opacity}
                onChange={e => setOpacity(Number(e.target.value))}
                className="w-full accent-blue-400"
              />
            </div>

            {/* Fill toggle (for shapes) */}
            {(tool === "rect" || tool === "circle") && (
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Remplissage</div>
                <button
                  onClick={() => setFill(f => !f)}
                  className={`flex w-full items-center justify-center rounded-lg border py-2 text-xs transition ${
                    fill ? "border-blue-400 bg-blue-500/20 text-blue-300" : "border-white/10 text-white/50 hover:border-white/30"
                  }`}
                >
                  {fill ? "Plein" : "Contour"}
                </button>
              </div>
            )}

            {/* Background color — teacher only */}
            {isTeacher && (
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Fond</div>
              <div className="grid grid-cols-3 gap-1.5">
                {["#ffffff", "#1a1a2e", "#fef9c3", "#dcfce7", "#dbeafe", "#fce7f3"].map(c => (
                  <button
                    key={c}
                    onClick={() => setBg(c)}
                    className={`h-9 rounded-lg border-2 transition ${
                      bg === c ? "border-blue-400 scale-105" : "border-white/10 hover:border-white/30"
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            )}

            {/* Keyboard shortcuts */}
            <div className="mt-auto">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Raccourcis</div>
              <div className="space-y-1 text-[10px] text-white/30">
                {(Object.entries(TOOL_CFG) as [Tool, typeof TOOL_CFG[Tool]][]).map(([, cfg]) => (
                  <div key={cfg.key} className="flex items-center justify-between">
                    <span>{cfg.label}</span>
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/50">{cfg.key}</kbd>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <span>Annuler</span>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/50">Ctrl+Z</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Rétablir</span>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/50">Ctrl+Y</kbd>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* ── Side panel: Sommaire / Chat / Participants ── */}
        {panel && (
          <aside className="flex w-72 shrink-0 flex-col border-l border-white/10 bg-[#16213e]">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
                {panel === "notes" && <><ListOrdered className="h-3.5 w-3.5 text-blue-400" /> Sommaire du cours</>}
                {panel === "chat" && <>💬 Chat de la salle</>}
                {panel === "people" && <><Users className="h-3.5 w-3.5 text-blue-400" /> Participants ({participants.length})</>}
              </div>
              <button onClick={() => setPanel(null)} className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Sommaire */}
            {panel === "notes" && (isTeacher ? (
              <>
                <textarea
                  value={notes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder={"Plan de la séance, points clés, liens…\n\n1. Introduction\n2. …\n\nLes élèves voient ce texte en direct."}
                  className="flex-1 resize-none bg-transparent p-3 text-sm leading-relaxed text-white/90 placeholder:text-white/25 outline-none"
                />
                <div className="border-t border-white/10 px-3 py-1.5 text-[10px] text-white/30">
                  Synchronisé en direct avec les élèves
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto whitespace-pre-wrap p-3 text-sm leading-relaxed text-white/90">
                {notes || <span className="text-white/30">L'enseignant n'a encore rien écrit.</span>}
              </div>
            ))}

            {/* Room chat */}
            {panel === "chat" && (
              <>
                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  {chatMsgs.length === 0 && (
                    <p className="pt-4 text-center text-xs text-white/30">Aucun message. Posez votre question !</p>
                  )}
                  {chatMsgs.map((m) => (
                    <div key={m.id} className={`rounded-lg px-2.5 py-1.5 text-xs ${m.from.id === user?.id ? "ml-4 bg-blue-500/20" : "mr-4 bg-white/5"}`}>
                      <div className="mb-0.5 flex items-center gap-1 text-[10px]">
                        <span className={m.from.isTeacher ? "font-semibold text-green-400" : "font-medium text-white/50"}>
                          {m.from.isTeacher ? "👨‍🏫 " : ""}{m.from.name}
                        </span>
                        <span className="text-white/25">{new Date(m.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed text-white/90">{m.text}</div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="flex items-center gap-1.5 border-t border-white/10 p-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                    placeholder="Votre message…"
                    className="min-w-0 flex-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 outline-none focus:bg-white/10"
                  />
                  <button onClick={sendChat} disabled={!chatInput.trim()}
                    className="rounded-lg bg-blue-500 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40">
                    Envoyer
                  </button>
                </div>
              </>
            )}

            {/* Participants */}
            {panel === "people" && (
              <div className="flex-1 overflow-y-auto p-2">
                {[...participants].sort((a, b) => Number(b.isTeacher) - Number(a.isTeacher) || Number(b.hand) - Number(a.hand)).map((p) => (
                  <div key={p.id} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${p.hand ? "bg-amber-500/10" : ""}`}>
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-[10px] font-bold text-white">
                      {p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-white/90">
                        {p.name}{p.id === user?.id && <span className="text-white/40"> (vous)</span>}
                      </div>
                      <div className="text-[10px] text-white/40">
                        {p.isTeacher ? "👨‍🏫 Enseignant" : "Étudiant"}
                        {p.speaking && <span className="ml-1 text-green-400">🔊 parle</span>}
                      </div>
                    </div>
                    {p.hand && <span className="animate-bounce text-base">✋</span>}
                    {/* Teacher: grant / revoke the floor */}
                    {isTeacher && !p.isTeacher && (
                      <button
                        onClick={() => grantMic(p.id, !p.micAllowed)}
                        title={p.micAllowed ? "Retirer la parole" : "Donner la parole"}
                        className={`shrink-0 rounded-lg px-1.5 py-1 text-sm transition ${
                          p.micAllowed ? "bg-green-500/20 hover:bg-green-500/30" : "opacity-40 hover:bg-white/10 hover:opacity-100"
                        }`}
                      >
                        🎤
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Teacher's live audio (students) + speaking student's audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      <audio ref={micAudioRef} autoPlay playsInline className="hidden" />

      {/* Poll creation modal (teacher) */}
      {pollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#16213e] p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">📊 Sondage éclair</h2>
              <button onClick={() => setPollModal(false)} className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              value={pollQ}
              onChange={(e) => setPollQ(e.target.value)}
              placeholder="Votre question…"
              className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:bg-white/10"
              autoFocus
            />
            <textarea
              value={pollOpts}
              onChange={(e) => setPollOpts(e.target.value)}
              rows={4}
              placeholder={"Une option par ligne :\nOui\nNon\nJe ne sais pas"}
              className="mt-2 w-full resize-none rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:bg-white/10"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setPollModal(false)} className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/60 hover:bg-white/10">Annuler</button>
              <button onClick={launchPoll} className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600">Lancer le sondage</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
