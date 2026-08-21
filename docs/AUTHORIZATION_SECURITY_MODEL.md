# Modelo de Autorização e Segurança

## Princípios

1. Autenticação identifica o usuário; não concede acesso a tenant.
2. Toda operação de tenant exige membership `active` no `accountId` e `condominiumId` corretos.
3. O papel é validado no backend depois da resolução do escopo pelo `tenantGuard`.
4. Controles ocultos no frontend são apenas UX e repetem as decisões do backend.
5. Recursos inexistentes retornam `404`; recursos existentes fora do tenant retornam `403`.
6. Convites são o único caminho para ativar vínculos de síndicos e moradores.

## Identidades e escopos

| Conceito | Responsabilidade |
| --- | --- |
| `User` | Credencial e identidade autenticável global |
| `Person` | Dados pessoais compartilhados pela identidade |
| `Account` | Cliente e fronteira superior do tenant |
| `Condominium` | Escopo operacional dentro da conta |
| `Membership` | Papel e estado do acesso ao tenant |
| `UnitRelationship` | Vínculo do morador com uma unidade |
| `Invitation` | Ativação expiráveis, revogável e de uso único |
| `AuditEvent` | Evidência do ator, tenant, entidade, ação e resultado |

## Decisão de acesso

```text
sessão válida
  -> usuário existente
  -> membership ativa
  -> accountId/condominiumId compatíveis
  -> papel explicitamente autorizado
  -> filtro de recurso por tenant/unidade
```

Administradores da plataforma seguem uma trilha separada. Apenas os dois e-mails aprovados, também marcados no banco, acessam o onboarding de clientes. Eles precisam receber uma membership explícita para acessar dados operacionais de qualquer condomínio.

## Convites

- O token aleatório é entregue uma vez e somente seu hash SHA-256 é persistido.
- O reenvio troca o token e invalida imediatamente o anterior.
- O aceite ativa a membership e, para moradores, cria o vínculo com a unidade na mesma transação.
- Cancelamento impede o primeiro acesso.
- Revogação encerra membership e vínculo de unidade.
- A inspeção de um convite vencido persiste o estado `expired` e retorna HTTP `410`.
- Síndicos só podem emitir convites com papel `resident` no próprio condomínio.
- Convites de `syndic` são emitidos somente pelo onboarding da plataforma.

## Auditoria mínima

Os fluxos de onboarding e convite registram criação de conta/condomínio, criação, reenvio, aceite, cancelamento e revogação. Cada evento inclui o usuário responsável, e-mail, data, conta, condomínio, entidade, identificador, ação, descrição e endereço IP quando disponível.

Não há endpoint genérico para alteração direta de papel. Uma futura alteração de papel deve ser uma operação dedicada, transacional e auditada; atualizar `Membership.role` diretamente é proibido operacionalmente.

## Verificação

```bash
npm run lint
npm run build
npm run test:access

# Com um servidor isolado em NODE_ENV=test:
BASE_URL=http://localhost:3201/api/v1 npm run test:api:auth

# Fluxos visuais locais:
npm run test:e2e -- tests/e2e/onboarding-access.spec.ts
```

## Riscos residuais conhecidos

- A CLI Prisma `6.19.3` depende de `deepmerge-ts 7.1.5`, versão sinalizada pelo `npm audit`. A correção automática disponível exige downgrade forçado do Prisma e não deve ser aplicada sem uma rodada própria de compatibilidade. O pacote é usado pelo ferramental de configuração/migration, não pelo fluxo HTTP da aplicação.
- O bundle principal do frontend ainda excede 500 kB antes de gzip. Separação por rota com imports dinâmicos deve ser tratada como melhoria de performance, sem misturar essa alteração com a autorização.
- OAuth real precisa de validação manual em QA porque Google e Microsoft podem exigir interação humana e credenciais externas.
