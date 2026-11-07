/**
 * CallOverlay — WebRTC audio/video call UI.
 *
 * WebRTC signaling via Socket.io:
 *   Caller: call:offer → callee
 *   Callee: call:answer → caller
 *   Both:   call:ice ← ICE candidates
 *   Either: call:end → other side
 *
 * STUN: Google public servers (works on same network & most internet connections).
 * For production, add a TURN server for symmetric NAT traversal.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff,
  MonitorUp, X, Loader2,
} from "lucide-react";
import { getSocket } from "@/lib/socket";
import { initials } from "@/components/online/shared";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

type CallState = "idle" | "calling" | "incoming" | "active" | "ended";
type CallType = "audio" | "video";

export type CallPayload = {
  from: string;
  callerName: string;
  offer: RTCSessionDescriptionInit;
  callType: CallType;
};

export function useCallOverlay(myName: string) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callType, setCallType] = useState<CallType>("video");
  const [incoming, setIncoming] = useState<CallPayload | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState<string>("");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    setCallState("idle");
    setIncoming(null);
    setPeerId(null);
  }, []);

  const createPeerConnection = useCallback((targetId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = e => {
      if (e.candidate) {
        getSocket()?.emit("call:ice", { to: targetId, candidate: e.candidate });
      }
    };

    pc.ontrack = e => {
      if (remoteRef.current && e.streams[0]) {
        remoteRef.current.srcObject = e.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        cleanup();
      }
    };

    return pc;
  }, [cleanup]);

  const attachLocalStream = useCallback(async (type: CallType) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video",
    });
    localStreamRef.current = stream;
    if (localRef.current) {
      localRef.current.srcObject = stream;
    }
    return stream;
  }, []);

  // ── Initiate a call ────────────────────────────────────────────────────────
  const startCall = useCallback(async (targetId: string, targetName: string, type: CallType) => {
    setCallState("calling");
    setCallType(type);
    setPeerId(targetId);
    setPeerName(targetName);

    const pc = createPeerConnection(targetId);
    const stream = await attachLocalStream(type).catch(() => null);
    if (!stream) { cleanup(); return; }
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    getSocket()?.emit("call:offer", { to: targetId, offer, callType: type, callerName: myName });
  }, [createPeerConnection, attachLocalStream, cleanup, myName]);

  // ── Accept incoming call ───────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!incoming) return;
    setCallState("active");

    const pc = createPeerConnection(incoming.from);
    setPeerId(incoming.from);
    setPeerName(incoming.callerName);
    setCallType(incoming.callType);

    const stream = await attachLocalStream(incoming.callType).catch(() => null);
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(incoming.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    getSocket()?.emit("call:answer", { to: incoming.from, answer });
    setIncoming(null);
  }, [incoming, createPeerConnection, attachLocalStream]);

  // ── Reject / end ──────────────────────────────────────────────────────────
  const rejectCall = useCallback(() => {
    if (incoming) getSocket()?.emit("call:reject", { to: incoming.from });
    cleanup();
  }, [incoming, cleanup]);

  const endCall = useCallback(() => {
    if (peerId) getSocket()?.emit("call:end", { to: peerId });
    cleanup();
  }, [peerId, cleanup]);

  // ── Controls ───────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  }, []);

  const toggleCam = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOff(c => !c);
  }, []);

  const shareScreen = useCallback(async () => {
    try {
      const screen = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
      const track = screen.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find(s => s.track?.kind === "video");
      if (sender) sender.replaceTrack(track);
      track.onended = () => {
        const camTrack = localStreamRef.current?.getVideoTracks()[0];
        if (sender && camTrack) sender.replaceTrack(camTrack);
      };
    } catch {}
  }, []);

  // ── Socket event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onIncoming = (payload: CallPayload) => {
      setIncoming(payload);
      setCallState("incoming");
    };

    const onAnswered = async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState("active");
    };

    const onIce = async ({ candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };

    const onRejected = () => { setCallState("ended"); setTimeout(cleanup, 2000); };
    const onEnded    = () => { setCallState("ended"); setTimeout(cleanup, 2000); };

    socket.on("call:incoming", onIncoming);
    socket.on("call:answered", onAnswered);
    socket.on("call:ice",      onIce);
    socket.on("call:rejected", onRejected);
    socket.on("call:ended",    onEnded);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:answered", onAnswered);
      socket.off("call:ice",      onIce);
      socket.off("call:rejected", onRejected);
      socket.off("call:ended",    onEnded);
    };
  }, [cleanup]);

  return {
    callState, callType, incoming, peerId, peerName,
    muted, camOff,
    localRef, remoteRef,
    startCall, acceptCall, rejectCall, endCall,
    toggleMute, toggleCam, shareScreen,
  };
}

// ─── UI ──────────────────────────────────────────────────────────────────────

export function CallOverlay({
  ctrl,
}: {
  ctrl: ReturnType<typeof useCallOverlay>;
}) {
  const {
    callState, callType, incoming, peerName,
    muted, camOff,
    localRef, remoteRef,
    acceptCall, rejectCall, endCall,
    toggleMute, toggleCam, shareScreen,
  } = ctrl;

  if (callState === "idle") return null;

  // ── Incoming call ─────────────────────────────────────────────────────────
  if (callState === "incoming" && incoming) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-80 rounded-2xl border bg-card p-6 shadow-2xl text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full grad-online text-xl font-bold text-white">
            {initials(incoming.callerName.split(" ")[0], incoming.callerName.split(" ")[1])}
          </div>
          <h3 className="text-lg font-semibold">{incoming.callerName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {incoming.callType === "video" ? "📹 Appel vidéo" : "📞 Appel audio"} entrant…
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={rejectCall}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive/10 py-3 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
            >
              <PhoneOff className="h-4 w-4" /> Refuser
            </button>
            <button
              onClick={acceptCall}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl grad-online py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Phone className="h-4 w-4" /> Répondre
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Calling (outgoing, not yet answered) ──────────────────────────────────
  if (callState === "calling") {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="text-center text-white">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin opacity-60" />
          <p className="text-lg font-medium">Appel de {peerName}…</p>
          <p className="mt-1 text-sm opacity-60">En attente de réponse</p>
          <button onClick={endCall} className="mt-8 flex items-center gap-2 mx-auto rounded-full bg-destructive px-6 py-3 text-sm font-medium hover:bg-destructive/90">
            <PhoneOff className="h-4 w-4" /> Annuler
          </button>
        </div>
      </div>
    );
  }

  // ── Active call ───────────────────────────────────────────────────────────
  if (callState === "active") {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col bg-black">
        {/* Remote video (full screen) */}
        <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />

        {/* Local video (PiP) */}
        {callType === "video" && (
          <video
            ref={localRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-24 right-4 h-32 w-24 rounded-xl object-cover border-2 border-white/30 shadow-lg"
          />
        )}

        {/* Header */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="text-white">
            <p className="text-sm font-medium">{peerName}</p>
            <p className="text-xs opacity-60">{callType === "video" ? "Appel vidéo" : "Appel audio"}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-4 p-6 bg-gradient-to-t from-black/60 to-transparent">
          <button onClick={toggleMute} title={muted ? "Activer le micro" : "Couper le micro"}
            className={`grid h-12 w-12 place-items-center rounded-full border-2 transition-colors ${muted ? "bg-white/20 border-white/40 text-white" : "bg-white/10 border-white/20 text-white hover:bg-white/20"}`}>
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {callType === "video" && (
            <button onClick={toggleCam} title={camOff ? "Activer la caméra" : "Désactiver la caméra"}
              className={`grid h-12 w-12 place-items-center rounded-full border-2 transition-colors ${camOff ? "bg-white/20 border-white/40 text-white" : "bg-white/10 border-white/20 text-white hover:bg-white/20"}`}>
              {camOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </button>
          )}

          {callType === "video" && (
            <button onClick={shareScreen} title="Partager l'écran"
              className="grid h-12 w-12 place-items-center rounded-full border-2 border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors">
              <MonitorUp className="h-5 w-5" />
            </button>
          )}

          <button onClick={endCall} title="Terminer l'appel"
            className="grid h-14 w-14 place-items-center rounded-full bg-destructive text-white shadow-lg hover:bg-destructive/90 transition-colors">
            <PhoneOff className="h-6 w-6" />
          </button>
        </div>
      </div>
    );
  }

  // ── Call ended ─────────────────────────────────────────────────────────────
  if (callState === "ended") {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="text-center text-white">
          <X className="mx-auto mb-3 h-10 w-10 opacity-60" />
          <p className="text-sm opacity-80">Appel terminé</p>
        </div>
      </div>
    );
  }

  return null;
}
