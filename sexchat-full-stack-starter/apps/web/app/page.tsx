export default function Home() {
 return <main className="shell">
  <header><a className="brand" href="#"><span>SEX</span>CHAT</a><b>18+ • SOMENTE ADULTOS</b></header>
  <section className="hero"><p className="eyebrow">AO VIVO • CONEXÕES • CRIADORES</p>
   <h1>Seu próximo encontro<br/><span>começa aqui.</span></h1>
   <p>Base de interface do Sexchat. Cadastro, vídeo, chat e pagamentos permanecem desativados até a integração e validação de segurança.</p>
   <a className="primary" href="https://sexchat-888.netlify.app/">Abrir site publicado</a>
  </section>
  <section className="grid">
   {[
    ['◉','Contas seguras','Cadastro, recuperação e permissões por função.'],
    ['▣','Salas ao vivo','Vídeo com tokens curtos e controle de acesso.'],
    ['✦','Moedas e gorjetas','Ledger auditável, assinaturas e webhooks.'],
    ['⬡','Proteção e moderação','Verificação 18+, denúncias e painel administrativo.']
   ].map(([icon,title,desc])=><article key={title}><i>{icon}</i><h2>{title}</h2><p>{desc}</p><small>INTEGRAÇÃO PENDENTE</small></article>)}
  </section>
  <footer>Exclusivamente para adultos. Não publique conteúdo sem consentimento e autorização de todas as pessoas envolvidas.</footer>
 </main>;
}