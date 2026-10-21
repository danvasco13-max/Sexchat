# Sexchat — base full-stack inicial

Esta é uma base de desenvolvimento, NÃO uma plataforma pronta para produção. O Netlify pode hospedar o front-end; a API, PostgreSQL, vídeo e pagamentos precisam de serviços próprios.

## Stack
- Web: Next.js
- API: Node.js + Express + TypeScript + Socket.IO
- Banco: PostgreSQL + Prisma
- Vídeo: LiveKit (configuração e credenciais necessárias)
- Pagamentos: adaptador ainda não conectado; escolha fornecedor que aprove explicitamente conteúdo adulto e repasses a criadores.

## Executar localmente
1. Instale Node.js 20+ e Docker.
2. `docker compose up -d db`
3. Em `apps/api`: `cp ../../.env.example .env`, `npm install`, `npm run dev`
4. Em `apps/web`: `npm install`, `npm run dev`
5. API: `http://localhost:4000/health`; Web: `http://localhost:3000`.

## Importante
Cadastro/login, tokens de vídeo, chat real e checkout estão desativados até a integração segura. Antes de produção: autenticação robusta, verificação real de idade/identidade, consentimento, moderação, pagamentos aprovados, testes de segurança, backups, LGPD e revisão jurídica. Uma caixa “tenho 18 anos” não verifica idade. Nunca permita menores ou conteúdo íntimo sem consentimento.
Veja `docs/ROADMAP.md` e `docs/SECURITY.md`.
