
const features = [
  {
    icon: "◉",
    number: "01",
    title: "Seu espaço",
    description:
      "Uma experiência pensada para perfis, conexões e descoberta de novos criadores.",
  },
  {
    icon: "▣",
    number: "02",
    title: "Salas ao vivo",
    description:
      "Uma área preparada para futuras experiências de vídeo e interação em tempo real.",
  },
  {
    icon: "✦",
    number: "03",
    title: "Apoie criadores",
    description:
      "Uma estrutura planejada para assinaturas e apoio aos criadores.",
  },
  {
    icon: "⬡",
    number: "04",
    title: "Segurança primeiro",
    description:
      "Privacidade, moderação, consentimento e verificação de idade como prioridades.",
  },
];

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Sexchat início">
          <span className="brand-symbol">S</span>
          <span>SEX<span className="brand-light">CHAT</span></span>
        </a>

        <span className="adult-label">
          <span className="status-dot" />
          PLATAFORMA 18+
        </span>

        <a className="header-link" href="#recursos">
          Conheça o projeto <span>↗</span>
        </a>
      </header>

      <section className="hero" id="inicio">
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
            Um espaço digital para conhecer criadores e descobrir novas
            formas de interação. Uma experiência em desenvolvimento,
            com privacidade e respeito em primeiro lugar.
          </p>

          <div className="hero-actions">
            <a className="primary-button" href="#recursos">
              Explorar plataforma <span>↗</span>
            </a>
            <a className="secondary-button" href="#sobre">
              Saiba mais <span>↓</span>
            </a>
          </div>

          <div className="trust-note">
            <span>18+</span>
            <span className="trust-divider" />
            <span>Privacidade e respeito</span>
            <span className="trust-divider" />
            <span>Em desenvolvimento</span>
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

        <div className="hero-index">
          <span>01</span>
          <span className="index-line" />
          <span>SEXCHAT</span>
        </div>
      </section>

      <section className="features-section" id="recursos">
        <div className="section-heading">
          <div>
            <p className="section-kicker">UM NOVO ESPAÇO DIGITAL</p>
            <h2>Feito para novas <span>possibilidades.</span></h2>
          </div>
          <p className="section-description">
            Conheça os pilares planejados para a plataforma.
          </p>
        </div>

        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.number}>
              <div className="feature-top">
                <span className="feature-icon">{feature.icon}</span>
                <span className="feature-number">{feature.number}</span>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <span className="feature-status">
                <span /> EM DESENVOLVIMENTO
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section" id="sobre">
        <div className="about-mark">S<span>+</span></div>
        <div>
          <p className="section-kicker">NOSSO COMPROMISSO</p>
          <h2>Respeito não é opcional.</h2>
          <p>
            A plataforma está em construção. Recursos interativos só serão
            disponibilizados após a implementação dos controles necessários
            de segurança, privacidade, verificação de idade e consentimento.
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
