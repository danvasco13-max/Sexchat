"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type Participant, type RemoteTrackPublication } from "livekit-client";

type LiveRoom = { id: string; title: string; creator: { displayName: string } };
type Props = { token: string; apiUrl: string };

export default function LiveBroadcast({ token, apiUrl }: Props) {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [title, setTitle] = useState("");
  const [current, setCurrent] = useState<LiveRoom | null>(null);
  const [host, setHost] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  const request = useCallback(async (path: string, options?: RequestInit) => {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Falha na transmissão.");
    return data;
  }, [apiUrl, token]);

  const refresh = useCallback(async () => {
    try { setRooms(await request("/v1/rooms")); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar salas."); }
  }, [request]);
  useEffect(() => { void refresh(); }, [refresh]);

  const leave = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) await room.disconnect();
    if (mediaRef.current) mediaRef.current.replaceChildren();
    setCurrent(null); setConnected(false); setHost(false);
  }, []);
  useEffect(() => () => { void roomRef.current?.disconnect(); }, []);

  async function join(roomInfo: LiveRoom) {
    setBusy(true); setError("");
    try {
      await leave();
      const credentials = await request(`/v1/rooms/${encodeURIComponent(roomInfo.id)}/token`, { method: "POST" });
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      const attachTrack = (track: { kind: Track.Kind; attach: () => HTMLElement }, participant: Participant) => {
        if (track.kind !== Track.Kind.Video && track.kind !== Track.Kind.Audio) return;
        const element = track.attach();
        element.setAttribute("data-participant", participant.identity);
        element.setAttribute("data-kind", track.kind);
        if (element instanceof HTMLVideoElement) { element.autoplay = true; element.playsInline = true; }
        mediaRef.current?.appendChild(element);
      };
      const detachTrack = (publication: RemoteTrackPublication, participant: Participant) => {
        mediaRef.current?.querySelectorAll(`[data-participant="${CSS.escape(participant.identity)}"]`).forEach(el => {
          if (el.getAttribute("data-kind") === publication.kind) el.remove();
        });
      };
      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => attachTrack(track, participant));
      room.on(RoomEvent.TrackUnsubscribed, (_track, publication, participant) => detachTrack(publication, participant));
      room.on(RoomEvent.Disconnected, () => { setConnected(false); });
      await room.connect(credentials.url, credentials.token);
      setCurrent(roomInfo); setHost(credentials.isHost); setConnected(true);
      if (credentials.isHost) {
        try {
          await room.localParticipant.enableCameraAndMicrophone();
          const video = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
          if (video) {
            const element = video.attach();
            if (element instanceof HTMLVideoElement) { element.muted = true; element.playsInline = true; }
            mediaRef.current?.appendChild(element);
          }
        } catch { setError("Permita câmera e microfone no navegador para transmitir."); }
      }
      room.remoteParticipants.forEach(participant => participant.trackPublications.forEach(pub => {
        if (pub.track) attachTrack(pub.track, participant);
      }));
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível entrar."); await leave(); }
    finally { setBusy(false); }
  }

  async function create() {
    setBusy(true); setError("");
    try {
      const room = await request("/v1/rooms", { method: "POST", body: JSON.stringify({ title }) });
      await refresh();
      await join({ ...room, creator: { displayName: "Você" } });
      setTitle("");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar a sala."); }
    finally { setBusy(false); }
  }

  async function end() {
    try { if (host && current) await request(`/v1/rooms/${encodeURIComponent(current.id)}/end`, { method: "POST" }); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível encerrar a sala."); }
    await leave(); void refresh();
  }

  return (
    <section style={{ marginTop: 30, borderTop: "1px solid #514363", paddingTop: 18 }}>
      <h3>Transmissões ao vivo</h3>
      <p>Para transmitir é preciso ter conta de criador aprovada e idade e identidade verificadas. Espectadores também precisam ter idade verificada.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input aria-label="Título da transmissão" value={title} maxLength={160} onChange={e => setTitle(e.target.value)} placeholder="Título da sua transmissão" style={{ padding: 10, borderRadius: 8, flex: 1 }} />
        <button type="button" className="secondary-button" disabled={busy || title.trim().length < 3} onClick={() => void create()}>Iniciar live</button>
      </div>
      <button type="button" className="secondary-button" onClick={() => void refresh()}>Atualizar salas</button>
      {!rooms.length && <p>Nenhuma transmissão pública no momento.</p>}
      {rooms.map(room => <div key={room.id} style={{ marginTop: 10 }}><button type="button" className="secondary-button" disabled={busy} onClick={() => void join(room)}>{room.title} — {room.creator.displayName}</button></div>)}
      <div style={{ marginTop: 18, display: current ? "block" : "none" }}>
        <h4>{current?.title} {connected ? "• Conectado" : "• Desconectado"}</h4>
        <div ref={mediaRef} style={{ display: "grid", gap: 8, background: "#08060e", minHeight: 180, borderRadius: 10, overflow: "hidden" }} />
        <button type="button" className="secondary-button" style={{ marginTop: 12 }} onClick={() => void end()}>{host ? "Encerrar transmissão" : "Sair da sala"}</button>
      </div>
      {error && <p role="alert" style={{ color: "#ff9e9e" }}>{error}</p>}
      <p style={{ fontSize: 12, opacity: .8 }}>O vídeo depende de um servidor LiveKit configurado. Este módulo não inclui pagamentos, gravações ou moderação automática.</p>
    </section>
  );
}
