# Onboarding e Gestão de Acessos

## Objetivo

Este documento descreve o fluxo implementado para entrada de condomínios, síndicos e moradores no GCV. A autorização é baseada em memberships ativas e escopo de condomínio. A allowlist beta permanece apenas como compatibilidade temporária e não é mais necessária para usuários provisionados.

## Papéis e responsabilidades

### Administrador do sistema

- Identificado por `User.isSystemAdmin` ou, para bootstrap operacional, por `SYSTEM_ADMIN_EMAILS`.
- Cria conta, condomínio e primeiro vínculo do síndico em uma transação.
- Não recebe automaticamente acesso aos dados operacionais do cliente.
- A operação gera convite e eventos de auditoria vinculados à nova conta e condomínio.

### Síndico e administração do condomínio

- Gerenciam blocos, unidades, moradores e convites somente no condomínio autorizado.
- Podem criar, reenviar e cancelar convites.
- Podem revogar um acesso ativo, encerrando também o vínculo com a unidade.
- Importações de moradores usam o mesmo lifecycle de convite do cadastro individual.

### Morador

- Recebe um link com token de uso único.
- Confirma seus dados e cria uma senha ou entra na conta existente.
- A membership e o vínculo com a unidade ficam ativos somente após o aceite.
- Enxerga somente suas unidades, cobranças, documentos e chamados autorizados.

## Estados

### Membership

| Estado | Significado |
| --- | --- |
| `pending` | Identidade criada, acesso ainda não aceito |
| `active` | Acesso autorizado |
| `revoked` | Acesso removido |

### Invitation

| Estado | Significado |
| --- | --- |
| `pending` | Convite criado e aguardando entrega |
| `sent` | Link disponibilizado ao destinatário |
| `accepted` | Vínculo confirmado |
| `expired` | Prazo encerrado |
| `cancelled` | Convite cancelado antes do aceite |
| `revoked` | Acesso anteriormente concedido foi removido |

## Segurança

- Tokens possuem 256 bits de entropia e apenas o hash SHA-256 é persistido.
- Reenvio invalida imediatamente o token anterior.
- Convites expiram em 72 horas por padrão.
- E-mails são comparados de forma case-insensitive e protegidos por índices únicos.
- O banco valida que `Membership.accountId` corresponde ao condomínio informado.
- Relacionamentos ativos duplicados e memberships duplicadas no escopo da conta são bloqueados.
- Papéis são avaliados no condomínio ativo; um papel administrativo em outro tenant não concede privilégios.
- Endpoints E2E retornam `404` em produção, independentemente da feature flag.

## Entrega de convites

Sem configuração externa, a API devolve o link para envio manual pela central de acessos.

Para integrar um provedor de e-mail:

```env
INVITATION_EMAIL_WEBHOOK_URL=https://seu-servico.example.com/send-invitation
INVITATION_EMAIL_WEBHOOK_TOKEN=<segredo>
```

O webhook recebe o destinatário, nome, identificador do convite e URL de aceite. O token do webhook e o hash do convite nunca são enviados ao frontend.

## Bootstrap do administrador

No Railway, configure:

```env
SYSTEM_ADMIN_EMAILS=administrador@empresa.com
```

Após o primeiro acesso, a tela **Plataforma > Onboarding** permite criar o cliente e convidar o síndico. A coluna `User.isSystemAdmin` pode posteriormente ser usada como fonte permanente, removendo o e-mail da variável de bootstrap.

## APIs principais

```text
POST /api/v1/onboarding/system/condominiums
GET  /api/v1/onboarding/invitations/:token
POST /api/v1/onboarding/invitations/:token/accept
POST /api/v1/onboarding/invitations/:token/accept-existing

GET  /api/v1/condominiums/:condoId/invitations
POST /api/v1/condominiums/:condoId/invitations
POST /api/v1/condominiums/:condoId/invitations/:id/resend
POST /api/v1/condominiums/:condoId/invitations/:id/cancel
POST /api/v1/condominiums/:condoId/invitations/:id/revoke
```

## Próximas evoluções

- Substituir webhook genérico por provedor transacional com fila, retentativas e dead-letter queue.
- Adicionar recuperação de senha e autenticação multifator para administradores.
- Implementar transferência de morador entre unidades como operação própria.
- Criar histórico append-only específico de mudanças de perfil e unidade.
- Executar E2E de convite real no staging antes da promoção para produção.
