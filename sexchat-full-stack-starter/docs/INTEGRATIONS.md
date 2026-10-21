# Integrações pendentes
## LiveKit
Nunca enviar LIVEKIT_API_SECRET ao navegador. O servidor emite tokens de curta duração somente após autorização de conta, idade, sala, assinatura e estado de banimento.

## Pagamentos
Não escolher provedor até obter aprovação escrita para conteúdo adulto, créditos virtuais, assinaturas e repasse a criadores. Não armazenar cartões. O servidor determina preços; webhooks são validados e idempotentes. Definir reembolsos, chargebacks, taxas, saques e saldo negativo.

## Carteira
Usar ledger imutável com chave de idempotência; executar débito/crédito em transação atômica. Nunca confiar em saldo enviado pelo navegador.

## Painel admin
Separar moderador de administrador; exigir MFA; registrar ações de conta, sala, denúncia, transação e saque; pedir confirmação para ações destrutivas.
