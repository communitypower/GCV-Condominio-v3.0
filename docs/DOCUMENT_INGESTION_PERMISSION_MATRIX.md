# Matriz de permissoes de documentos e IA

Status: reflete a implementacao local atual. Revalidar antes de QA e producao.

## 1. Principios

- Toda rota exige sessao autenticada.
- `tenantGuard` deriva a conta do `condoId` e exige membership ativa.
- Permissao visual no frontend nao substitui autorizacao no backend.
- Documentos/chunks sao filtrados por condominio; RAG tambem filtra `accountId`.
- Morador so le documento `resident` e, havendo `unitId`, de unidade com vinculo ativo.
- Propostas sao rascunhos; sindico, gestor ou superuser pode aplicar.
- `system_admin` e o superuser global exigido pelo produto; seu acesso independe de membership e deve ser governado como privilegio elevado.

## 2. Matriz implementada

Legenda: `P` permitido, `C` condicionado ao escopo, `N` negado.

| Acao | system_admin | admin | syndic | manager | staff | council | accountant | resident | Outros |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Listar documentos | P* | P | P | P | P | P | P | C | C |
| Gerar URL/baixar | P* | P | P | P | P | P | P | C | C |
| Abrir catalogo | P* | N | P | P | P | N | N | N | N |
| Upload inicial | P* | N | P | P | P | N | N | N | N |
| Criar nova versao | P* | N | P | P | P | N | N | N | N |
| Cancelar/reprocessar | P* | N | P | P | P | N | N | N | N |
| Corrigir metadados/associacoes | P* | N | P | P | N | N | N | N | N |
| Soft delete auditado | P* | N | P | P | N | N | N | N | N |
| Consultar Assistente RAG | P* | N | P | P | P | P | N | N | N |
| Listar/criar/editar proposta | P* | N | P | P | P | P | N | N | N |
| Rejeitar proposta | P* | N | P | P | N | N | N | N | N |
| Aprovar/aplicar proposta | P* | N | P | P | N | N | N | N | N |

`*` `system_admin` recebe acesso global por requisito explicito de superuser. O bypass de membership e papel e intencional; exige controles compensatorios e nao constitui, isoladamente, bug ou gate impeditivo.

`C` Na leitura/download, residentes e demais papeis fora do grupo administrativo so acessam `requiredRole=resident`; se houver `unitId`, precisam de vinculo ativo com a unidade.

O papel enum `admin` nao e o `system_admin`. Ele le documentos como staff administrativo, mas nao esta incluido nas rotas novas de catalogo, upload, versao, metadados, exclusao ou IA.

## 3. Escopo por recurso

| Recurso | Filtro obrigatorio | Controle adicional |
|---|---|---|
| `Document` | `condominiumId`, `deletedAt=null` | ACL e associacoes validadas no mesmo condominio |
| `DocumentVersion` | documento do condominio | Prefixo fisico com conta/condominio |
| `DocumentChunk` | `accountId` e `condominiumId` | Documento nao excluido; `versionIds` opcionais |
| `AiProposal` | `condominiumId` | Papel e fingerprint por tenant/tipo |
| Plano aplicado | `condominiumId` | Equipamento no contexto; nasce `suspended` |
| OS aplicada | `condominiumId` | Unidade no contexto; nasce `reported` |
| Associacoes | edificio, unidade, equipamento, plano e OS | Todas pertencem ao condominio; unidade/edificio devem ser coerentes |
| Download | documento pertence ao `condoId` | ACL, URL HMAC por usuario/versao e expiracao de 5 min |
| Soft delete | documento pertence ao `condoId` | Sindico/gestor, `deletedAt` e `AuditEvent`; binario permanece retido |

## 4. Riscos de autorizacao

### Alto

- O superuser global concentra acesso a todos os tenants. Como requisito de produto, deve usar somente contas nominativas aprovadas, MFA no provedor, segredo de sessao forte, alertas, auditoria e revisao periodica de administradores.
- O papel enum `admin` le documentos, mas nao opera o novo catalogo. Confirmar se e papel legado ou se deve ter contrato explicito.
- `council_member` consulta RAG e cria/edita proposta, embora nao carregue arquivo nem aprove.
- `accountant` le documentos comuns, mas nao acessa catalogo/RAG. Validar categorias financeiras.
- `requiredRole` e um enum unico, nao uma politica hierarquica ou conjunto de permissoes.

### Medio

- Nao existe ACL por categoria, classificacao, finalidade ou periodo.
- Nao ha quatro olhos para propostas de alto risco.
- Consulta registra quantidade de fontes, mas nao justificativa de negocio para acesso privilegiado.

## 5. Controles alvo recomendados

| Capacidade | system_admin | syndic | manager | staff | council_member | accountant | resident |
|---|---|---|---|---|---|---|---|
| Administrar storage/configuracao | P global, nominal e auditado | N | N | N | N | N | N |
| Upload tecnico/administrativo | P global, auditado | P | P | Por categoria | N | Financeiro, se aprovado | N |
| Consultar documentos | P global, auditado | P | P | Por categoria | Governanca | Financeiro | Proprio/publico |
| Consultar RAG | P global, auditado | P | P | Sem PII | Governanca | Financeiro | Opcional/proprio |
| Criar rascunho operacional | P global, auditado | P | P | C | Opcional | N | N |
| Aprovar plano/OS | P global, auditado | P | Delegado | N | N | N | N |
| Soft delete | P global, auditado | P | P | N | N | N | N |
| Expurgo fisico | Dupla aprovacao | Solicita | Solicita | N | N | N | Solicita direito |

## 6. Testes obrigatorios

1. Sem sessao: `401` em todas as rotas.
2. Membership pendente/revogada: `403`.
3. Sindico A nao lista, baixa, indexa nem consulta chunks de B.
4. Trocar `condoId`, `docId`, `versionId` ou `proposalId` nao atravessa tenant.
5. Morador le documento geral `resident` e de sua unidade, nao de outra.
6. Morador nao abre catalogo, envia, reprocessa, consulta RAG ou cria proposta.
7. Staff lista, baixa, envia, versiona e reprocessa, mas nao altera ACL nem exclui.
8. Nova versao preserva documento/associacoes e incrementa `versionNumber`.
9. URL assinada pertence ao usuario e versao, funciona por cinco minutos e falha se alterada ou expirada.
10. Council member/accountant seguem politica aprovada por categoria.
11. Proposta so e aplicada por sindico/gestor ou superuser.
12. Proposta de outro tenant nao e editada, rejeitada ou aprovada por usuario comum.
13. Associacao fora do tenant e rejeitada; unidade e edificio conflitantes tambem.
14. Documento excluido nao aparece em listagem, download ou RAG e gera auditoria.
15. Chave fisica fora do prefixo retorna indisponibilidade.
16. Cadastro legado por caminho retorna `410`; manifesto e rejeitado e deve ser alinhado ao status HTTP oficial.
17. Superuser acessa tenants globalmente e suas operacoes sensiveis deixam evidencia.

## 7. Gate de aprovacao

Promocao para producao exige:

- decidir o destino do papel enum `admin` nas rotas documentais;
- manter cadastro nominal dos superusers, MFA, auditoria, alertas e revisao periodica;
- classificar categorias por sensibilidade e finalidade;
- passar testes de associacoes, versoes, URL assinada, soft delete, legado por caminho `410` e rejeicao de manifesto;
- passar testes negativos de tenant/papel em API e Playwright, preservando o bypass intencional do superuser;
- aprovar DPA, regiao, retencao e redacao de PII do provedor;
- operar soft delete, definir expurgo fisico, retencao e resposta a incidente.
