"use client";
import { useEffect, useState } from "react";

type Status = { role: string; status: string; ageVerification: string; identityVerification: string;
  profile: null | { bio: string | null; applicationStatus: string; applicationNote: string | null } };
export default function CreatorApplication({ token, apiUrl }: { token: string; apiUrl: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [bio, setBio] = useState("");
  const [terms, setTerms] = useState(false);
  const [adult, setAdult] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      const r = await fetch(`${apiUrl}/v1/creator/application`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Erro ao consultar solicitação.");
      setStatus(data);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Falha na conexão."); }
  }
  useEffect(() => { if (token) void refresh(); }, [token]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const r = await fetch(`${apiUrl}/v1/creator/application`, { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio, termsAccepted: terms, adultDeclaration: adult }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Falha ao solicitar cadastro.");
      setMessage(data.message); await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Falha na conexão."); }
    finally { setBusy(false); }
  }
  return <section style={{ border: "1px solid #514363", padding: 16, borderRadius: 12, marginTop: 24 }}>
    <h3>Quero ser criador</h3>
    <p>Solicite a análise da sua conta. O envio não autoriza transmissões e não comprova idade ou identidade.</p>
    {status && <><p><strong>Situação:</strong> {status.profile?.applicationStatus || "NOT_STARTED"}</p>
      <p>Idade: {status.ageVerification} | Identidade: {status.identityVerification}</p>
      {status.profile?.applicationNote && <p>Observação da análise: {status.profile.applicationNote}</p>}</>}
    {(!status?.profile || ["NOT_STARTED", "REJECTED"].includes(status.profile.applicationStatus)) &&
      <form onSubmit={submit}>
        <label htmlFor="creator-bio">Apresentação (20 a 1000 caracteres)</label>
        <textarea id="creator-bio" value={bio} onChange={e => setBio(e.target.value)} minLength={20} maxLength={1000} required
          style={{ width: "100%", minHeight: 95, margin: "8px 0", color: "#111", padding: 8 }} />
        <label style={{ display: "block", marginBottom: 8 }}><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} required /> Declaro ter 18 anos ou mais (declaração não substitui verificação).</label>
        <label style={{ display: "block", marginBottom: 12 }}><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} required /> Aceito os termos aplicáveis à solicitação de criador.</label>
        <button className="primary-button" disabled={busy} type="submit">{busy ? "Enviando..." : "Solicitar análise"}</button>
      </form>}
    <button type="button" className="secondary-button" style={{ marginTop: 12 }} onClick={() => void refresh()}>Atualizar situação</button>
    {message && <p role="status">{message}</p>}
    <p style={{ fontSize: 13 }}>A verificação de documentos e idade ainda precisa de integração com um provedor apropriado; não envie documentos pelo chat.</p>
  </section>;
}
