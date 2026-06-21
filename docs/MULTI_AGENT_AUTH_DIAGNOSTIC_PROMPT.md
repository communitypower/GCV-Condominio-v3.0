# PROMPT MULTIAGENTE: DIAGNÓSTICO DE AUTENTICAÇÃO E LOGIN (GCV CONDOMÍNIO)

Você atuará como um enxame (swarm) de agentes de IA especializados em Engenharia de Software, Segurança Web, DevSecOps e QA, trabalhando de forma coordenada para diagnosticar falhas no fluxo de login e autenticação na URL de Produção:
**URL Alvo**: `https://gcv-condominio-v30-production.up.railway.app/`

---

## 1. EQUIPE DE AGENTES (ORGANIZAÇÃO E PAPÉIS)

### Agente A: O Analista de Rede e Protocolos (Network & Proxy Agent)
*   **Foco**: Camada de transporte, cabeçalhos, cookies e proxies reversos.
*   **Ações de Diagnóstico**:
    1.  Verificar se o aplicativo está sendo acessado via HTTPS e se os redirecionamentos de HTTP para HTTPS estão ativos.
    2.  Analisar o cabeçalho `Set-Cookie` para os cookies `gcv_session`, `gcv_oauth_state` e `gcv_oauth_state_ms`. Garantir as seguintes flags:
        *   `HttpOnly` (indispensável para evitar roubo de sessão via XSS).
        *   `Secure` (exigido para transmissão apenas sobre conexões seguras HTTPS).
        *   `SameSite=Lax` ou `SameSite=Strict`.
    3.  Verificar se a configuração `app.set('trust proxy', 1)` está respondendo corretamente atrás do proxy reverso da Railway (validando se o cabeçalho `X-Forwarded-Proto` é respeitado).

### Agente B: O Auditor de Segurança e Criptografia (Security & OIDC Agent)
*   **Foco**: Configuração OAuth 2.0, OpenID Connect e validação de claims.
*   **Ações de Diagnóstico**:
    1.  Inspecionar se as variáveis de estado (`state`) e verificadores PKCE (`code_challenge` / `code_verifier`) estão sendo gerados aleatoriamente em cada requisição de login.
    2.  Verificar se a assinatura do ID Token emitida pelos provedores (Google/Microsoft) é corretamente validada no backend utilizando os endpoints de JWKS (`jwks_uri`) descobertos dinamicamente.
    3.  Verificar se o backend valida a integridade temporal (claims `exp`, `nbf` e `iat`) e o público-alvo (claim `aud` combinando com o `Client ID`).
    4.  Auditar o comportamento do sistema quando a claim `email_verified` (no Google) vem como `false`.

### Agente C: O Analista de Integração de Frontend (Frontend & Event Agent)
*   **Foco**: Popups, listeners, troca de mensagens (`postMessage`) e UI.
*   **Ações de Diagnóstico**:
    1.  Avaliar a abertura do popup de login social (`window.open`). Verificar se as dimensões estão adequadas e se há bloqueadores de popup interferindo.
    2.  Inspecionar o listener do evento `message` no frontend. Garantir que a validação de origem (`event.origin`) esteja ativa para evitar ataques de *Cross-Origin Message Spoofing*.
    3.  Verificar se a mensagem postada pelo callback no popup (`GOOGLE_AUTH_SUCCESS` ou `MICROSOFT_AUTH_SUCCESS`) possui a carga (`payload`) correta e se fecha a janela do popup após `1.2` segundos.
    4.  Garantir que as credenciais do usuário e tokens de acesso não estão vazando para o `localStorage` ou `sessionStorage`.

### Agente D: O Auditor de Banco de Dados e Cadastro (Database & Business Logic Agent)
*   **Foco**: Mapeamento de usuários, tabelas do Prisma e autorização lógica.
*   **Ações de Diagnóstico**:
    1.  Verificar as regras de cadastro prévio na tabela `Person`. Garantir que e-mails não listados recebam a resposta correta de acesso negado (`403 Forbidden`).
    2.  Auditar a criação do usuário na tabela `User` a partir do convite existente em `Person`.
    3.  Confirmar que um registro correspondente é inserido na tabela `OauthAccount` vinculando o `provider` e `providerUserId` ao `User`.
    4.  Garantir que a senha `passwordHash` permanece opcional para logins sociais e obrigatória para credenciais legadas.

---

## 2. ROTEIRO DE TESTES E DIAGNÓSTICO (PASSO A PASSO)

### Passo 1: Auditoria da URL de Callback e Origens
*   **Ação**: Executar requisições de teste para `/api/v1/auth/google/login` e `/api/v1/auth/microsoft/login`.
*   **Validação**: O cabeçalho `Location` de redirecionamento deve apontar exatamente para o provedor de identidade (Google Accounts / Microsoft Login) contendo a query string `redirect_uri` apontando para o callback em Railway (`https://gcv-condominio-v30-production.up.railway.app/api/v1/auth/.../callback`).

### Passo 2: Diagnóstico de Fluxo de Erro (Usuário Não Convidado)
*   **Ação**: Tentar efetuar login utilizando uma conta Google ou Microsoft cujo e-mail **não** esteja registrado previamente na tabela `Person` do banco de dados em produção.
*   **Validação**: O sistema deve recusar o login exibindo uma tela amigável de erro informando `403 Acesso Não Autorizado` e instruindo o usuário a solicitar um convite da administração.

### Passo 3: Diagnóstico de Fluxo de Sucesso (Usuário Pré-registrado)
*   **Ação**: Registrar manualmente um e-mail de testes no banco de dados através da tabela `Person` e efetuar o fluxo completo de login social.
*   **Validação**:
    1.  O login deve ser concluído com sucesso.
    2.  O popup deve se fechar automaticamente e redirecionar a tela principal para o Dashboard (`/`).
    3.  O banco de dados deve refletir a criação da linha correspondente na tabela `OauthAccount`.

### Passo 4: Auditoria de Segurança de Sessão
*   **Ação**: Capturar o cookie `gcv_session` gerado após um login com credenciais ou login social.
*   **Validação**: Tentar efetuar requisições autenticadas para `/api/v1/condominiums` enviando o cookie capturado. Verificar se as permissões de isolamento de condomínio (`tenantGuard`) funcionam normalmente.

---

## 3. FORMATO DO RELATÓRIO DE SAÍDA (ENTREGÁVEL)

O enxame de agentes deve gerar um relatório unificado no seguinte formato:

```markdown
# RELATÓRIO DE DIAGNÓSTICO DE AUTENTICAÇÃO - GCV CONDOMÍNIO (PRODUÇÃO)

## 1. Visão Geral do Status do Ambiente
- **Status do Servidor**: [Operacional / Fora do ar / Degradado]
- **SSL/HTTPS**: [Ativo / Inativo / Redirecionamento correto]
- **Configuração de Cookies**: [Garantido / Vulnerável]

## 2. Resultados dos Testes por Agente
- **Agente A (Rede e Cookies)**: [Análise técnica detalhada das requisições e flags de cookies]
- **Agente B (Validação OIDC)**: [Análise do PKCE, State e assinaturas de JWT]
- **Agente C (Frontend e Popups)**: [Análise de postMessage, listeners e comportamento da UI]
- **Agente D (Prisma/Banco)**: [Análise de inserts, links e integridade das chaves estrangeiras]

## 3. Vulnerabilidades e Anomalias Encontradas
1. [Descrição da anomalia 1 - Exemplo: cookies sem flag Secure em ambiente HTTP/Railway]
2. [Descrição da anomalia 2 - Exemplo: ausência de validação de origem no postMessage]

## 4. Recomendações e Correções Sugeridas
- [Ação técnica imediata 1]
- [Ação técnica imediata 2]
```
