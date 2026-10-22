
"use client";

import { useState } from "react";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://sexchat-290c.onrender.com"
).replace(/\/$/, "");

export default function Home() {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loggedUser, setLoggedUser] = useState("");

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (mode === "register" && !adultConfirmed) {
      setMessage("Confirme que você tem 18 anos ou mais.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/v1/auth/${mode === "register" ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "register"
              ? { displayName, email, password, adultConfirmed }
              : { email, password }
          ),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Não foi possível concluir a operação.");
        return;
      }

      if (mode === "register") {
        setMessage(
          "Cadastro criado! A verificação de e-mail ainda precisa ser implementada. Você pode tentar entrar."
        );
        setMode("login");
        setPassword("");
      } else {
        setLoggedUser(data.user.displayName);
        setMessage("Login realizado com sucesso!");
        setPassword("");
      }
    } catch {
      setMessage(
        "Não foi possível conectar ao servidor. Tente novamente em instantes."
      );
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setLoggedUser("");
    setEmail("");
    setPassword("");
    setMessage("");
    setMode("login");
  }

  return (
    <main className="shell" id="inicio">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Sexchat início">
          <span className="brand-symbol">S</span>
          <span>SEX<span className="brand-light">CHAT</span></span>
        </a>

        <span className="adult-label">
          <span className="status-dot" />
          PLATAFORMA 18+
        </span>

        <a className="header-link" href="#conta">
          Minha conta ↗
        </a>
      </header>

      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow">
            <span className="live-dot" />
            NOVAS CONEXÕES COMEÇAM AQUI
          </div>

          <h1>
            Mais conexão.
            <br />
            Mais <span className="gradient-text">possibilidades.</span>
          </h1>

          <p className="hero-description">
            Conheça criadores e descubra novas formas de interação.
            Privacidade e respeito em primeiro lugar.
          </p>

          <div className="hero-actions">
            <a className="primary-button" href="#conta">
              Criar minha conta ↗
            </a>
            <a className="secondary-button" href="#sobre">
              Saiba mais ↓
            </a>
          </div>

          <div className="trust-note">
            <span>18+</span>
            <span className="trust-divider" />
            <span>Privacidade e respeito</span>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="art-glow" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-center">
            <div className="art-monogram">S</div>
            <div className="art-caption">CONEXÕES REAIS</div>
          </div>
          <div className="floating-card card-top">
            <span className="floating-icon">✦</span>
            <span>
              <strong>Novas possibilidades</strong>
              <small>Um espaço para descobrir</small>
            </span>
          </div>
          <div className="floating-card card-bottom">
            <span className="online-indicator" />
            <span>
              <strong>Segurança em foco</strong>
              <small>Respeito em cada interação</small>
            </span>
          </div>
        </div>
      </section>

      <section
        id="conta"
        style={{
          maxWidth: 460,
          margin: "40px auto 70px",
          padding: 28,
          border: "1px solid rgba(180,140,255,.25)",
          borderRadius: 20,
          background: "rgba(25,20,38,.8)",
          color: "#fff",
        }}
      >
        {loggedUser ? (
          <div>
            <h2>Olá, {loggedUser}!</h2>
            <p>Sua sessão foi iniciada.</p>
            <p>
              O chat e as demais funções ainda precisam ser implementados.
            </p>
            <button className="primary-button" onClick={logout}>
              Sair da conta
            </button>
          </div>
        ) : (
          <>
            <p className="section-kicker">SUA CONTA SEXCHAT</p>
            <h2 style={{ marginBottom: 20 }}>
              {mode === "register" ? "Crie sua conta" : "Bem-vindo de volta"}
            </h2>

            <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
              <button
                type="button"
                className={mode === "register" ? "primary-button" : "secondary-button"}
                onClick={() => {
                  setMode("register");
                  setMessage("");
                }}
              >
                Cadastrar
              </button>
              <button
                type="button"
                className={mode === "login" ? "primary-button" : "secondary-button"}
                onClick={() => {
                  setMode("login");
                  setMessage("");
                }}
              >
                Entrar
              </button>
            </div>

            <form onSubmit={submitForm}>
              {mode === "register" && (
                <label style={{ display: "block", marginBottom: 15 }}>
                  Nome de exibição
                  <input
                    required
                    minLength={2}
                    maxLength={60}
                    autoComplete="nickname"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Como quer ser chamado?"
                    style={fieldStyle}
                  />
                </label>
              )}

              <label style={{ display: "block", marginBottom: 15 }}>
                E-mail
                <input
                  required
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  style={fieldStyle}
                />
              </label>

              <label style={{ display: "block", marginBottom: 15 }}>
                Senha
                <input
                  required
                  type="password"
                  minLength={mode === "register" ? 12 : 1}
                  maxLength={72}
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === "register"
                      ? "Mínimo de 12 caracteres"
                      : "Digite sua senha"
                  }
                  style={fieldStyle}
                />
              </label>

              {mode === "register" && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    margin: "18px 0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={adultConfirmed}
                    onChange={(e) => setAdultConfirmed(e.target.checked)}
                    required
                    style={{ marginTop: 5 }}
                  />
                  <span>Confirmo que tenho 18 anos ou mais.</span>
                </label>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={loading}
                style={{ width: "100%", cursor: loading ? "wait" : "pointer" }}
              >
                {loading
                  ? "Aguarde..."
                  : mode === "register"
                    ? "Criar conta"
                    : "Entrar"}
              </button>
            </form>

            {message && (
              <p role="status" aria-live="polite" style={{ marginTop: 18 }}>
                {message}
              </p>
            )}

            <p style={{ fontSize: 12, opacity: 0.75, marginTop: 18 }}>
              A confirmação de idade é uma declaração e não substitui a
              verificação de idade. Não use uma senha que você já utiliza
              em outros serviços.
            </p>
          </>
        )}
      </section>

      <section className="about-section" id="sobre">
        <div className="about-mark">S<span>+</span></div>
        <div>
          <p className="section-kicker">NOSSO COMPROMISSO</p>
          <h2>Respeito não é opcional.</h2>
          <p>
            A plataforma está em construção. Verificação de idade, confirmação
            de e-mail, privacidade e controles de segurança precisam estar
            prontos antes da liberação pública de todos os recursos.
          </p>
        </div>
      </section>

      <footer className="footer">
        <a className="brand footer-brand" href="#inicio">
          <span className="brand-symbol">S</span>
          <span>SEX<span className="brand-light">CHAT</span></span>
        </a>
        <p>Exclusivamente para maiores de 18 anos.</p>
        <span className="footer-status">
          <span /> PROJETO EM DESENVOLVIMENTO
        </span>
      </footer>
    </main>
  );
}

const fieldStyle: React.CSSProperties = {
  display: "block",
  boxSizing: "border-box",
  width: "100%",
  marginTop: 7,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #514363",
  background: "#17121f",
  color: "#fff",
  fontSize: 16,
};

