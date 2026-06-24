# GCV Condominio v3.0

Sistema web para gestao condominial, operacao predial e acompanhamento financeiro, com foco inicial em condominios brasileiros, sindicos profissionais e pequenas administradoras.

O projeto combina uma aplicacao React/Vite com API Express, PostgreSQL via Prisma, autenticacao local de desenvolvimento, trilha de auditoria, modulos operacionais e integracao opcional com IA Gemini.

> Status: base SaaS em evolucao. O ambiente local esta funcional; staging/producao possuem configuracoes de pipeline e container, mas uso com dados reais ainda depende dos gates de seguranca, autenticacao, isolamento de tenant e revisao operacional descritos em `docs/`.

## Principais Recursos

- Dashboard operacional do condominio
- Cadastro de condominios, blocos, unidades, moradores e usuarios
- Controle de manutencoes e planos preventivos
- Inventario de equipamentos prediais
- Acompanhamento de cobrancas e status financeiro
- Documentacao e controle de acesso a documentos
- Logs de auditoria para eventos relevantes
- Autenticacao local para desenvolvimento e testes
- Integracao opcional com Google Gemini para assistente de IA
- Pipeline CI/CD para build, staging e producao
- Deploy por container Docker
- Banco PostgreSQL com Prisma ORM

## Stack

- Frontend: React 19, Vite, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Banco: PostgreSQL 16
- ORM: Prisma
- Build: Vite + esbuild
- Runtime alvo: Node.js 24
- Infra local: Docker Compose
- Deploy: Docker, Cloud Run/GitHub Actions e configuracao Railway
- IA: Google Gemini via `@google/genai`

## Estrutura do Projeto

```text
.
|-- src/                    # Aplicacao React
|-- server/                 # Rotas e middlewares da API
|-- server.ts               # Entrada Express + Vite middleware
|-- prisma/                 # Schema, migrations e seed
|-- tests/                  # Testes/roteiros de validacao
|-- docs/                   # Planos, ADRs, seguranca e operacao
|-- scripts/                # Scripts auxiliares
|-- CHANGELOG.md            # Notas de release
|-- Dockerfile              # Build multi-stage para producao
|-- docker-compose.yml      # PostgreSQL local e app containerizado
|-- railway.json            # Configuracao Railway
`-- .github/workflows/      # CI/CD
```

## Ambientes

| Ambiente | Status | Finalidade |
| --- | --- | --- |
| Local development | Funcional | Desenvolvimento diario com Docker Compose e PostgreSQL local |
| Dev | Configurado | Integracao continua com dados sinteticos |
| Staging | Configurado | Ensaio de producao com dados sinteticos ou anonimizados |
| Production | Configurado, nao totalmente liberado | Beta controlado com Railway e aprovacao manual |

O codigo diferencia runtime de desenvolvimento e producao por `NODE_ENV`:

- `development`: usa Vite em modo middleware dentro do Express
- `staging` / `production`: serve os arquivos estaticos gerados em `dist`
- `staging` / `production`: bloqueiam metodos mutaveis cross-origin via protecao CSRF baseada em `Origin`/`APP_URL`

## Pre-requisitos

- Node.js 24 ou superior
- npm 10 ou superior
- Docker e Docker Compose
- Git

O projeto declara:

```json
{
  "engines": {
    "node": ">=24.0.0",
    "npm": ">=10.0.0"
  },
  "packageManager": "npm@11.8.0"
}
```

## Setup Local

Clone o repositorio:

```bash
git clone https://github.com/communitypower/GCV-Condominio-v3.0.git
cd GCV-Condominio-v3.0
```

Instale as dependencias:

```bash
npm install
```

Crie seus arquivos de ambiente locais:

```bash
cp .env.example .env
cp .env.example .env.local
```

Configure pelo menos a URL do banco local:

```env
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://gcv_user:gcv_password@localhost:5432/gcv_condominio?schema=public
SESSION_SECRET=gcv_local_dev_secret
BETA_ALLOWED_EMAILS=

GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
ENABLE_GITHUB_INTEGRATION=false
```

Suba o PostgreSQL local:

```bash
docker compose up -d db
```

Gere o Prisma Client e sincronize o schema:

```bash
npx prisma generate
npx prisma db push
```

Compile o projeto uma vez para gerar o seed bundle:

```bash
npm run build
```

Popule o banco:

```bash
npx prisma db seed
```

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/health
```

### Observacao para WSL

Se o `tsx` falhar tentando criar socket em um caminho como `/mnt/c/Users/.../Temp`, rode o servidor com:

```bash
export TMPDIR=/tmp
npm run dev
```

## Credenciais de Desenvolvimento

O seed cria usuarios sinteticos para testes locais:

| Perfil | Email | Senha |
| --- | --- | --- |
| Sindico | `sindico@gcv.com.br` | `sindico123` |
| Zelador/Gestor | `zelador@gcv.com.br` | `zelador123` |
| Moradores | emails do seed | `resident123` |

Essas credenciais sao apenas para desenvolvimento e demonstracao.

## Scripts Disponiveis

```bash
npm run dev      # Inicia Express + Vite middleware
npm run build    # Gera frontend, server bundle e seed bundle
npm run start    # Inicia dist/server.cjs sem aplicar migrations
npm run start:local # Aplica db push, seed e inicia dist/server.cjs
npm run lint     # Typecheck TypeScript
npm run check    # Typecheck, build e audit de dependencias
npm test         # Roda harness de OAuth
npm run test:api # Roda smoke tests de API contra BASE_URL
npm run clean    # Remove artefatos de build
```

## Banco de Dados

O schema principal fica em:

```text
prisma/schema.prisma
```

Comandos uteis:

```bash
npx prisma generate
npx prisma db push
npx prisma migrate deploy
npm run db:migrate:verify
npx prisma db seed
npx prisma studio
```

Use `db push` somente em desenvolvimento local. Em CI, staging e production, use migrations versionadas com `npm run db:migrate:deploy`; o gate `npm run db:migrate:verify` aplica as migrations, checa o status e compara o banco resultante com `prisma/schema.prisma`. Rode esse gate contra banco descartavel/limpo ou contra um ambiente que ja seja gerenciado por Prisma Migrate.

O Compose local usa:

```text
postgresql://gcv_user:gcv_password@localhost:5432/gcv_condominio?schema=public
```

## Variaveis de Ambiente

As variaveis esperadas estao documentadas em `.env.example`.

Principais:

| Variavel | Uso |
| --- | --- |
| `PORT` | Porta HTTP do servidor |
| `NODE_ENV` | Modo de execucao |
| `APP_URL` | URL publica/base da aplicacao |
| `DATABASE_URL` | Conexao PostgreSQL |
| `SESSION_SECRET` | Assinatura de cookies/sessao |
| `BETA_ALLOWED_EMAILS` | Allowlist de e-mails habilitados em staging/producao |
| `GEMINI_API_KEY` | Chave da API Gemini |
| `GEMINI_MODEL` | Modelo Gemini usado pelo assistente |
| `ENABLE_GITHUB_INTEGRATION` | Habilita/desabilita rotas GitHub/Gist |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth GitHub |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | OAuth Microsoft |

Nunca commite arquivos `.env`, `.env.local`, dumps de banco, backups ou segredos.

## API

As rotas principais usam prefixo:

```text
/api/v1
```

Exemplos:

- `/api/v1/auth`
- `/api/v1/condominiums`
- `/api/v1/accounts`
- `/api/gemini/chat`
- `/health`
- `/livez`
- `/readyz`
- `/metrics`

## CI/CD

O workflow principal fica em:

```text
.github/workflows/ci.yml
```

Fluxo atual:

1. Pull requests e pushes em `main` executam install, audit, typecheck e build.
2. O job `api-smoke` sobe PostgreSQL 16, valida migrations em banco limpo, roda seed e executa smoke tests de API.
3. Os smoke tests cobrem auth/tenant isolation, documentos, fluxos operacionais e flags de IA/GitHub/demo.
4. O workflow de seguranca executa Gitleaks e CodeQL em PRs, pushes, tags `v*` e agenda semanal.
5. Tags `v*` tambem passam pelos gates de CI.
6. Deploy oficial de beta controlado deve ser feito via Railway, usando ambientes isolados.
7. O workflow antigo de Cloud Run foi removido do caminho automatico para evitar deploy em plataforma divergente.

## Deploy

### Docker

Build local:

```bash
docker build -t gcv-condominio .
```

Run local:

```bash
docker run --rm -p 3000:3000 --env-file .env gcv-condominio
```

### Docker Compose

Para subir banco e app containerizado:

```bash
docker compose up --build
```

O servico `app` do Compose aplica migrations versionadas e seed antes do start. Ele usa valores locais seguros para OAuth e feature flags quando essas variaveis nao existem no `.env`.

### Railway

O arquivo `railway.json` define:

- builder via Dockerfile
- `preDeployCommand`: `npm run db:migrate:deploy`
- `startCommand`: `npm run start`
- healthcheck em `/readyz`

Ambientes oficiais para fechamento do beta:

- `dev`
- `staging`
- `production`

Consulte `docs/RAILWAY_OPERATIONS_RUNBOOK.md` antes de operar staging ou producao.
Use `docs/BETA_GO_NO_GO_CHECKLIST.md` antes de promover qualquer tag beta.

## Backup e Restore

Backup logico manual:

```bash
DATABASE_URL="postgresql://..." scripts/db_backup.sh
```

Restore em banco descartavel de recuperacao:

```bash
RECOVERY_DATABASE_URL="postgresql://..." scripts/db_restore_verify.sh backups/gcv-backup-YYYYMMDD-HHMMSS.dump
```

Nunca restaure diretamente sobre producao sem validar primeiro em banco de recuperacao.

## Maturidade e Riscos Conhecidos

Este repositorio ja avancou alem de um prototipo visual, mas ainda ha pontos que devem ser tratados antes de operar dados reais de clientes:

- Validar estrategia final de autenticacao gerenciada
- Garantir isolamento multi-tenant em todas as rotas
- Ampliar testes automatizados e e2e
- Rever fluxo de documentos e LGPD
- Desabilitar exportacoes GitHub/Gist em producao
- Controlar o envio de dados para IA
- Revisar secrets, backups, restore e incident response
- Executar revisao de seguranca antes de producao paga

Consulte especialmente:

- `docs/GCV_SAAS_IMPLEMENTATION_MASTER_PLAN.md`
- `docs/DEVOPS_PIPELINE_AND_OPERATIONS_PLAN.md`
- `docs/SECURITY_REVIEW_AND_PENTEST_PLAN.md`
- `docs/INCIDENT_RESPONSE_RUNBOOK.md`
- `docs/RAILWAY_OPERATIONS_RUNBOOK.md`
- `docs/PRODUCT_CLOSURE_PLAN.md`
- `docs/PRODUCT_CLOSURE_STATUS.md`
- `docs/BETA_GO_NO_GO_CHECKLIST.md`
- `docs/RESTORE_DRILL_LOG.md`
- `docs/adr/`

## Desenvolvimento

Recomendacoes para contribuicoes:

- Use Node.js 24
- Rode `npm run lint` antes de abrir PR
- Rode `npm run build` antes de deploy
- Rode `npm run check` antes de abrir PR quando possivel
- Use `npm run test:api` apenas contra banco descartavel ou ambiente de teste seedado
- Mantenha alteracoes pequenas e rastreaveis
- Prefira migrations Prisma para mudancas persistentes de schema
- Nao introduza dados reais em seeds, docs, screenshots ou testes
- Documente decisoes arquiteturais relevantes em ADRs

## Licenca

Este repositorio ainda nao declara uma licenca publica. Antes de reutilizar, distribuir ou vender partes do codigo, defina a licenca do projeto com os mantenedores.
