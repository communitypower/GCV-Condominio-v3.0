# Runbook de ingestao documental e IA

Status: operacao local e preparacao de QA. Nao autoriza publicacao em producao.

## 1. Pre-requisitos

- Node.js 24+ e npm 10+.
- PostgreSQL isolado para o ambiente.
- Migrations documentais e de seguranca de `20260821000000` ate `20260821050000` aplicadas.
- Diretorio privado e persistente para documentos.
- Membership ativa e papel autorizado para o operador.
- Dados sinteticos em local e QA ate os gates de seguranca e LGPD.

## 2. Variaveis

| Variavel | Obrigatoria | Exemplo QA | Observacao |
|---|---|---|---|
| `DOCUMENT_STORAGE_PATH` | Sim | `/data/gcv-documents` | Em Compose e `/app/uploads`; no Railway deve apontar para o volume montado |
| `ENABLE_DOCUMENT_INGESTION` | Sim para carga | `true` | Quando `false`, upload, novas versoes e reprocessamento retornam `403` e a entrada some da interface |
| `DOCUMENT_MAX_FILE_SIZE_BYTES` | Nao | `20971520` | Padrao 20 MiB por arquivo; maximo de oito por requisicao |
| `DOCUMENT_MAX_REQUEST_SIZE_BYTES` | Nao | `41943040` | Limite agregado de um envio |
| `DOCUMENT_MAX_ARCHIVE_UNCOMPRESSED_BYTES` | Nao | `104857600` | Protecao contra expansao excessiva de DOCX/XLSX |
| `DOCUMENT_MAX_TENANT_STORAGE_BYTES` | Nao | `1073741824` | Quota inicial de armazenamento por condominio |
| `DOCUMENT_RETENTION_DAYS` | Nao | `30` | Carencia apos soft delete antes de elegibilidade para expurgo |
| `DOCUMENT_PROCESSING_CONCURRENCY` | Nao | `2` | Limita extracoes simultaneas no processo web |
| `DOCUMENT_ANTIVIRUS_URL` / `DOCUMENT_ANTIVIRUS_TOKEN` | Para scan real | segredo QA | Endpoint HTTP deve responder `clean` ou `infected`; sem ele o status e `unavailable` |
| `DOCUMENT_OCR_URL` / `DOCUMENT_OCR_TOKEN` | Para OCR | segredo QA | Endpoint HTTP para imagens e PDFs sem camada de texto |
| `ENABLE_AI_ASSISTANT` | Para IA | `true` | Manter `false` ate storage, ACL e LGPD serem validados |
| `AI_PROVIDER` | Para IA | `gemini_api` ou `vertex_ai` | Padrao `gemini_api` |
| `GEMINI_MODEL` | Para IA | `<modelo-aprovado>` | Validar disponibilidade e custo |
| `GEMINI_API_KEY` | Gemini API | segredo Railway | Nunca registrar ou commitar |
| `GOOGLE_CLOUD_PROJECT` | Vertex AI | `gcv-qa` | Obrigatoria com `vertex_ai` |
| `GOOGLE_CLOUD_LOCATION` | Vertex AI | `us-central1` | Avaliar residencia e transferencia de dados |
| `DATABASE_URL` | Sim | referencia PostgreSQL QA | Isolada por ambiente |

Vertex AI tambem requer credencial Google compativel com ADC. Nao colocar JSON de service account no repositorio; usar secret ou identidade do ambiente.

## 3. Inicializacao local

```bash
cd /mnt/c/projects/gcv3
npm ci
docker compose up -d --build
docker compose ps
```

O servico `app` usa `DOCUMENT_STORAGE_PATH=/app/uploads` e o named volume `document_storage:/app/uploads`. O comando de inicializacao aplica migrations e seed antes de iniciar a aplicacao. Para executar o app fora do container, use `DOCUMENT_STORAGE_PATH="$PWD/uploads" npm run dev` depois de subir o banco e aplicar as migrations.

Sem IA:

```bash
export ENABLE_AI_ASSISTANT=false
```

Com Gemini API em desenvolvimento controlado:

```bash
export ENABLE_AI_ASSISTANT=true
export AI_PROVIDER=gemini_api
export GEMINI_API_KEY='<secret-local-nao-versionado>'
export GEMINI_MODEL='<modelo-aprovado>'
```

Verificacoes:

```bash
curl -fsS http://localhost:3000/health
curl -fsS http://localhost:3000/livez
curl -fsS http://localhost:3000/readyz
docker compose exec app find /app/uploads -maxdepth 10 -type f
docker volume ls
```

No modo Compose, inspecione o volume retornado por `docker volume ls`; seu nome inclui o prefixo do projeto Compose.

## 4. Railway QA

### 4.1 Volume persistente

Acao externa no painel Railway:

1. Abra o ambiente `staging`.
2. Abra o servico da aplicacao, nao o PostgreSQL.
3. Crie um volume dedicado a documentos.
4. Monte-o em `/data/gcv-documents`.
5. Defina `DOCUMENT_STORAGE_PATH=/data/gcv-documents`.
6. Confirme que o volume pertence apenas ao servico e ambiente de QA.

Nao reutilize volume entre dev, staging e producao.

### 4.2 IA

Escolha um modo no servico de QA:

```text
ENABLE_AI_ASSISTANT=true
AI_PROVIDER=gemini_api
GEMINI_API_KEY=<secret>
GEMINI_MODEL=<modelo-aprovado>
```

ou:

```text
ENABLE_AI_ASSISTANT=true
AI_PROVIDER=vertex_ai
GOOGLE_CLOUD_PROJECT=<project-id>
GOOGLE_CLOUD_LOCATION=<regiao-aprovada>
GEMINI_MODEL=<modelo-aprovado>
```

Sem gates aprovados, mantenha `ENABLE_DOCUMENT_INGESTION=false` e `ENABLE_AI_ASSISTANT=false`. O catalogo e downloads ja liberados permanecem consultaveis; novas cargas, reprocessamento, consulta e geracao retornam `403` controlado.

### 4.3 Migration e deploy

Configuracao esperada do servico:

```text
Pre-deploy: npm run db:migrate:deploy
Start: npm run start
Healthcheck: /readyz
```

Antes da publicacao em QA:

```bash
npm run lint
npm run build
npm test
npm run test:api
```

Depois do deploy:

```bash
export QA_URL='https://gcv-app-staging-staging.up.railway.app'
curl -fsS "$QA_URL/health"
curl -fsS "$QA_URL/livez"
curl -fsS "$QA_URL/readyz"
```

### 4.4 Prova de persistencia

1. Envie um TXT sintetico com marcador unico.
2. Aguarde `indexed` no catalogo.
3. Envie uma segunda versao e confirme incremento, checksum e novos chunks.
4. Gere o link de download e confirme sucesso antes e falha depois de cinco minutos.
5. Consulte o marcador no assistente e valide as citacoes.
6. Registre IDs, checksums, chunks e horario.
7. Execute um redeploy normal do app.
8. Repita download e consulta.
9. Se o binario sumir, bloqueie G1 e revise a montagem.

## 5. Operacao da API

As rotas exigem cookie de sessao, `tenantGuard` e os papeis da matriz.

| Operacao | Metodo e rota |
|---|---|
| Upload | `POST /api/v1/condominiums/:condoId/documents/upload` |
| Nova versao | `POST /api/v1/condominiums/:condoId/documents/:docId/versions` |
| Catalogo | `GET /api/v1/condominiums/:condoId/documents/catalog` |
| Gerar link de download | `GET /api/v1/condominiums/:condoId/documents/:docId/download-url` |
| Reprocessar | `POST /api/v1/condominiums/:condoId/documents/:docId/retry` |
| Cancelar | `POST /api/v1/condominiums/:condoId/documents/:docId/cancel` |
| Corrigir metadados/associacoes | `PATCH /api/v1/condominiums/:condoId/documents/:docId` |
| Soft delete auditado | `DELETE /api/v1/condominiums/:condoId/documents/:docId` |
| Retencao e bloqueio legal | `PATCH /api/v1/condominiums/:condoId/documents/:docId/retention` |
| Consultar IA | `POST /api/v1/condominiums/:condoId/assistant/query` |
| Criar/listar propostas | `POST/GET /api/v1/condominiums/:condoId/assistant/proposals` |
| Editar rascunho | `PATCH /api/v1/condominiums/:condoId/assistant/proposals/:id` |
| Rejeitar/aprovar | `POST .../:id/reject` ou `POST .../:id/approve` |

Associacoes aceitas no upload e no `PATCH`: `buildingId`, `unitId`, `equipmentId`, `maintenancePlanId` e `maintenanceTicketId`. Cada referencia e validada contra o condominio ativo; unidade e edificio informados juntos tambem precisam ser coerentes.

O `download-url` retorna link HMAC valido por cinco minutos, vinculado ao usuario, condominio, documento e versao mais recente. O download continua exigindo sessao e ACL. Nao e URL de object storage e nao deve ser compartilhado.

Contratos legados:

- `POST /documents` por caminho retorna `410 DOCUMENT_UPLOAD_REQUIRED`.
- Manifestos documentais baseados em caminho foram descontinuados. No estado atual, `/imports/validate` responde `201` com lote `draft` invalido e a aplicacao fica bloqueada; o retorno `410` ainda precisa ser alinhado no codigo se for o contrato oficial. Use a aba Arquivos e o upload autenticado.

Estados:

- `indexed`: extracao e chunks concluidos.
- `partial`: armazenado, mas incompleto; esperado para imagens ou PDFs sem texto quando OCR nao esta configurado.
- `failed`: revisar `processingError` antes de repetir.
- `cancelled`: pode ser repetido; cancelamento nao remove o binario.
- `scanStatus=unavailable`: falha fechada em staging/producao; o arquivo permanece em quarentena e nao e extraido, indexado ou baixado.

## 6. Reprocessamento e incidentes

### Falha de extracao

1. Confirme que o arquivo existe no volume.
2. Confira MIME, tamanho e extensao no catalogo.
3. Consulte logs sem copiar conteudo para tickets publicos.
4. Corrija configuracao ou parser.
5. Use `retry` apenas para `failed`, `partial` ou `cancelled`.
6. Confirme que chunks anteriores foram substituidos, nao duplicados.

### Binario ausente

1. Desabilite a IA para evitar respostas incompletas.
2. Preserve metadados e evidencias.
3. Verifique montagem, caminho e redeploys.
4. Restaure volume/objeto de backup validado.
5. Reprocesse e compare checksum.
6. Registre tenants e titulares potencialmente afetados.

### Provedor de IA indisponivel

1. Confirme flag, provedor, modelo e credenciais.
2. Verifique quota, regiao e status do provedor.
3. Mantenha upload e catalogo operacionais.
4. Nao aprove proposta incompleta; falha de geracao deve retornar `502`.
5. Rotacione credenciais se houver suspeita de exposicao.

### Malware ou prompt injection

1. Desabilite a IA ou remova logicamente o documento do fluxo.
2. Preserve checksum, IDs, logs e responsavel pelo upload.
3. Isole o binario; nao o abra sem protecao.
4. Acione seguranca e incidente/LGPD.
5. Reindexe apenas com liberacao documentada.

## 7. Rollback

### Aplicacao

- Reverta o codigo para a imagem anterior sem reverter a migration aditiva.
- Use `ENABLE_AI_ASSISTANT=false` como primeira contencao.
- Nunca use `prisma db push` em Railway.

### Banco e arquivos

- A migration `20260821000000` cria enums, colunas e tabelas; a `20260821010000` adiciona associacoes e indices. Rollback destrutivo elimina chunks, propostas ou vinculos documentais.
- Em QA, restaurar backup completo e o volume correspondente e mais seguro que SQL reverso parcial.
- Em producao, use forward-fix ou banco de recuperacao; nao remova tabelas durante incidente.
- Banco e volume devem voltar ao mesmo ponto logico. Metadado sem binario fica indisponivel.

### Proposta aplicada incorretamente

- A aprovacao cria plano `suspended` ou OS `reported`; nao ativa execucao automatica.
- Revise `AuditEvent`, proposta e citacoes.
- Cancele a OS ou mantenha o plano suspenso pelo fluxo operacional.
- Nao edite `appliedEntityId` manualmente sem correcao auditada.

## 8. Retencao e exclusao

O soft delete auditado esta implementado para sindico e gestor. `DELETE /documents/:docId` define `deletedAt`, remove o documento das listagens, bloqueia download e o exclui da recuperacao RAG. A carencia e controlada por `retentionUntil`; `legalHold=true` impede expurgo.

1. Defina por categoria base legal, prazo, bloqueio legal e aprovador.
2. Trate documentos de moradores e financeiros como confidenciais.
3. Confirme o `204`, o `AuditEvent` e a ausencia em listagem, download e RAG apos o soft delete.
4. Execute `npm run documents:purge:dry-run` e revise a lista elegivel.
5. Para executar, defina `DOCUMENT_PURGE_CONFIRM=PURGE_EXPIRED_DOCUMENTS` e rode `npm run documents:purge` em janela controlada.
6. O expurgo remove o binario e derivados transacionais, preserva o tombstone auditavel do documento e registra falhas para repeticao idempotente.
7. Backups devem ter prazo e expiracao documentados; o expurgo no banco nao apaga imediatamente copias dentro da retencao do backup.
8. Pedidos de titular exigem busca e revisao juridica antes do expurgo.

Baseline proposto para QA: remover dados sinteticos em ate 30 dias. Prazos de producao dependem de aprovacao do controlador e juridico por categoria.

## 9. Evidencias de gate

Registrar:

- ambiente, commit e migration;
- operador e horario;
- ID/checksum do arquivo sintetico;
- associacoes e numeros das versoes;
- status de scan/processamento;
- chunks e citacoes;
- validade do download assinado e soft delete auditado;
- acessos permitidos e negados;
- redeploy e prova de persistencia;
- proposta, decisao humana e entidade aplicada;
- backup/restore de banco e volume;
- riscos aceitos, responsavel e validade.

Producao permanece bloqueada ate autorizacao explicita e conclusao dos gates da arquitetura tecnica.
