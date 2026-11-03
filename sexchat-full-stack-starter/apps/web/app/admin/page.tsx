
"use client";

import { useEffect, useState } from "react";

type Application = {
  userId: string;
  bio: string | null;
  createdAt: string;
  applicationStatus: string;
  user: {
    displayName: string;
    ageVerification: string;
    identityVerification: string;
  };
};

export default function AdminPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [token, setToken] = useState("");
  useEffect(() => {
  const savedToken = sessionStorage.getItem("sexchat_admin_session");

  if (savedToken) {
    setToken(savedToken);
  }
}, []);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const api =
    process.env.NEXT_PUBLIC_API_URL ||
    "https://sexchat-290c.onrender.com";

  async function loadApplications(authToken: string) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${api}/v1/admin/creator-applications`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? "Acesso restrito a administradores."
            : "Não foi possível carregar as solicitações."
        );
      }

      const data = await response.json();
      setApplications(data);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Erro inesperado."
      );
    } finally {
      setLoading(false);
    }
  }

  async function review(userId: string, decision: "APPROVE" | "REJECT") {
    const note = window.prompt(
      decision === "APPROVE"
        ? "Observação da aprovação (opcional):"
        : "Motivo da rejeição:"
    );

    if (note === null) return;

    if (!window.confirm("Confirma esta decisão?")) return;

    try {
      const response = await fetch(
        `${api}/v1/admin/creator-applications/${encodeURIComponent(userId)}/review`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ decision, note }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Não foi possível revisar.");
      }

      setMessage("Solicitação analisada com sucesso.");
      await loadApplications(token);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Erro inesperado."
      );
    }
  }

  return (
    <main style={{ maxWidth: 850, margin: "40px auto", padding: 20 }}>
      <h1>Painel Administrativo — Sexchat</h1>
      <p>Gerenciamento de solicitações de criadores.</p>

      <p>
        Utilize uma sessão autenticada de administrador.
        A aprovação exige verificação real de idade e identidade.
      </p>

      <label htmlFor="admin-token">Token de sessão</label>
      <input
        id="admin-token"
        type="password"
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder="Cole seu token de acesso"
        style={{ width: "100%", padding: 12, marginTop: 8 }}
      />

      <button
        onClick={() => loadApplications(token)}
        disabled={!token || loading}
        style={{ marginTop: 16, padding: 12 }}
      >
        {loading ? "Carregando..." : "Carregar solicitações"}
      </button>

      {message && <p role="status">{message}</p>}

      {applications.length === 0 && !loading && (
        <p>Nenhuma solicitação carregada.</p>
      )}

      {applications.map((application) => {
        const verified =
          application.user.ageVerification === "VERIFIED" &&
          application.user.identityVerification === "VERIFIED";

        return (
          <section
            key={application.userId}
            style={{
              border: "1px solid #555",
              borderRadius: 12,
              padding: 20,
              marginTop: 20,
            }}
          >
            <h2>{application.user.displayName}</h2>
            <p>{application.bio}</p>
            <p>Situação: {application.applicationStatus}</p>
            <p>Idade: {application.user.ageVerification}</p>
            <p>Identidade: {application.user.identityVerification}</p>

            <button
              disabled={!verified}
              onClick={() => review(application.userId, "APPROVE")}
            >
              Aprovar
            </button>{" "}
            <button
              onClick={() => review(application.userId, "REJECT")}
            >
              Rejeitar
            </button>

            {!verified && (
              <p>
                Aprovação bloqueada: verificação de idade e identidade
                pendente.
              </p>
            )}
          </section>
        );
      })}
    </main>
  );
}
