# Preparação para Teste de Autenticação em Produção e Homologação (Staging)

Este guia descreve os passos necessários para configurar os provedores de identidade (Google e Microsoft) e o ambiente de nuvem do Google Cloud Platform (GCP) para testar os novos fluxos de autenticação social do GCV Condomínio.

---

## 1. Mapeamento de URLs e URIs de Redirecionamento (Redirect URIs)

Os fluxos do OAuth 2.0 e OpenID Connect exigem que todas as URIs de callback sejam previamente autorizadas nos painéis dos respectivos provedores.

### 1.1 Ambiente de Homologação (Staging)
* **URL do App**: `https://gcv-app-staging-jil5ryndmq-uc.a.run.app`
* **URI de Redirecionamento Google**: 
  `https://gcv-app-staging-jil5ryndmq-uc.a.run.app/api/v1/auth/google/callback`
* **URI de Redirecionamento Microsoft**: 
  `https://gcv-app-staging-jil5ryndmq-uc.a.run.app/api/v1/auth/microsoft/callback`

### 1.2 Ambiente de Produção (Production)
* **URL do App**: *[Substituir pela URL final de Produção, ex: `https://gcv-app-production-jil5ryndmq-uc.a.run.app`]*
* **URI de Redirecionamento Google**: 
  `[URL_DE_PRODUÇÃO]/api/v1/auth/google/callback`
* **URI de Redirecionamento Microsoft**: 
  `[URL_DE_PRODUÇÃO]/api/v1/auth/microsoft/callback`

---

## 2. Configurações nos Provedores de Identidade

### 2.1 Google Cloud Console (Autenticação Google)
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Selecione o projeto (ex: `poder-da-comunidade` ou correspondente de produção).
3. Vá para **APIs e Serviços** > **Tela de permissão OAuth** (OAuth Consent Screen):
   - Configure o tipo de aplicativo como **Externo** (ou Interno se apenas usuários da mesma organização forem logar).
   - Preencha as informações obrigatórias do aplicativo.
   - Adicione os escopos: `openid`, `https://www.googleapis.com/auth/userinfo.email` e `https://www.googleapis.com/auth/userinfo.profile`.
   - Em **Usuários de teste** (Test Users), adicione os e-mails de teste que serão usados durante a validação (obrigatório enquanto o app estiver em modo de publicação *Rascunho/Testing*).
4. Vá para **Credenciais** > **Criar Credenciais** > **ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**.
   - Nome: `GCV Condomínio - [Ambiente]`.
   - **Origens JavaScript autorizadas**: Adicione a URL base do App (sem a barra final).
   - **URIs de redirecionamento autorizadas**: Adicione a URI correspondente listada na Seção 1.
5. Salve e copie o **ID do cliente** e a **Chave secreta do cliente**.

### 2.2 Portal do Azure (Autenticação Microsoft)
1. Acesse o [Microsoft Entra Admin Center](https://entra.microsoft.com/) ou o Portal do Azure.
2. Vá para **Identity** > **Applications** > **App registrations** > **New registration**:
   - Nome: `GCV Condomínio - [Ambiente]`.
   - **Supported account types**: Selecione `Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)` para permitir e-mails corporativos e pessoais (@outlook.com, @hotmail.com).
   - **Redirect URI (optional)**: Selecione **Web** e adicione a URI de redirecionamento da Microsoft listada na Seção 1.
3. Clique em **Register**.
4. Copie o **Application (client) ID**.
5. Vá em **Certificates & secrets** > **Client secrets** > **New client secret**:
   - Descrição: `GCV Auth Secret`.
   - Expiração: Escolha o prazo desejado.
   - Clique em **Add** e copie **imediatamente** o **Value** da chave gerada (ela não será mostrada novamente).

---

## 3. Provisionamento de Segredos no GCP Secret Manager

Os segredos devem ser armazenados de forma segura no **GCP Secret Manager** para cada ambiente (staging e production) e injetados como variáveis de ambiente nos serviços do Cloud Run.

Configure os seguintes segredos no Secret Manager:

| Nome do Segredo no GCP | Variável de Ambiente Correspondente | Valor Esperado |
| --- | --- | --- |
| `SESSION_SECRET` | `SESSION_SECRET` | Uma string longa e segura usada para assinar os cookies de sessão. |
| `GOOGLE_CLIENT_ID` | `GOOGLE_CLIENT_ID` | O ID do cliente obtido no console do Google. |
| `GOOGLE_CLIENT_SECRET` | `GOOGLE_CLIENT_SECRET` | A chave secreta obtida no console do Google. |
| `MICROSOFT_CLIENT_ID` | `MICROSOFT_CLIENT_ID` | O ID de aplicativo obtido no painel da Microsoft. |
| `MICROSOFT_CLIENT_SECRET` | `MICROSOFT_CLIENT_SECRET` | A chave secreta (secret value) obtida no painel da Microsoft. |
| `MICROSOFT_TENANT_ID` | `MICROSOFT_TENANT_ID` | Defina como `common` (ou omita para usar o padrão). |

> [!IMPORTANT]
> Garanta que a conta de serviço do Cloud Run de cada ambiente (ex: `gcv-cloudrun-sa-staging`) possua a permissão de **Leitor de Segredos do Secret Manager** (`roles/secretmanager.secretAccessor`) nas respectivas chaves.

---

## 4. Cadastro Prévio dos E-mails de Teste

Para fins de segurança e controle de acessos, **apenas pessoas cadastradas previamente no banco de dados** do condomínio podem se registrar/autenticar. Se um usuário tentar logar com um e-mail do Google/Microsoft que não esteja registrado, ele receberá um erro `403 Acesso Não Autorizado`.

### Como registrar um testador no banco de dados:
Antes de iniciar o teste no ambiente implantado, insira um registro na tabela `Person` utilizando o e-mail exato do testador (a conta Google ou Microsoft que ele usará).

Você pode fazer isso executando um script SQL no banco PostgreSQL de homologação/produção, ou executando uma query pelo Prisma.

Exemplo SQL:
```sql
INSERT INTO "Person" (id, name, email, phone, "createdAt", "updatedAt")
VALUES (
  'test-person-id-1',
  'Nome do Testador',
  'e-mail.do.testador@gmail.com', -- Substituir pelo e-mail real do testador
  '11999999999',
  NOW(),
  NOW()
);
```

Após esse insert, quando o testador clicar em "Continuar com Google" ou "Continuar com Microsoft", o backend detectará o registro em `Person`, criará automaticamente a conta `User` e a associação de vínculo `OauthAccount`, autorizando a sessão do usuário.

---

## 5. Checklist de Homologação Pós-implantação

Execute a seguinte lista de verificação após realizar o deploy do container atualizado no Cloud Run:

- [ ] **Acesso ao Portal**: Acesse a URL do aplicativo e verifique se os botões "Continuar com Google" e "Continuar com Microsoft" aparecem estilizados no formulário de login.
- [ ] **Esconder Presets**: Confirme que o painel lateral de desenvolvedor ("Acesso de Testes") **não** é exibido nos ambientes de staging/produção (só deve aparecer localmente).
- [ ] **Teste de Redirecionamento**: Clique em um dos botões sociais e certifique-se de que a janela popup abre e redireciona corretamente para a página de consentimento do provedor de identidade.
- [ ] **Segurança de Cookies**: Abra o Developer Tools do navegador, tente logar e verifique se o cookie `gcv_session` possui as flags `HttpOnly`, `Secure` (somente HTTPS) e `SameSite=Lax` configuradas.
- [ ] **Auditoria**: Verifique no banco de dados se os vínculos de `OauthAccount` foram corretamente persistidos e se as entradas de logs de auditoria de login foram geradas.
