# Roadmap
1. Fundação: ambientes separados, PostgreSQL gerenciado, migrações, backups, logs e monitoramento.
2. Contas: provedor de identidade, verificação de e-mail, recuperação segura, MFA para administradores e papéis USER/CREATOR/MODERATOR/ADMIN.
3. Segurança: verificação efetiva de idade e identidade, consentimento documentado, regras de conteúdo, denúncias, bloqueios e processo de remoção.
4. Vídeo: configurar LiveKit; emitir tokens curtos no servidor somente após validar conta, idade, estado da sala, permissões e assinatura.
5. Chat: autenticação Socket.IO, autorização por sala, persistência, limites de frequência e moderação.
6. Dinheiro: aprovação escrita do adquirente para conteúdo adulto, moedas, recorrência e repasses; checkout hospedado; webhooks assinados/idempotentes; ledger e reconciliação.
7. Admin: permissões mínimas, MFA, trilha de auditoria, moderação, saques e suporte.
8. Pré-lançamento: revisão jurídica (LGPD e regras brasileiras), testes de penetração/carga, plano de incidentes e lançamento gradual.
