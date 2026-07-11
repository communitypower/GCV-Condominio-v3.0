# Carga de dados e organização documental

O desenho completo dos componentes, sequência, entidades e estados está em [Arquitetura técnica da carga de dados](DATA_IMPORT_TECHNICAL_ARCHITECTURE.md).

## Objetivo

O módulo **Carga de Dados** recebe lotes controlados, valida a estrutura antes da escrita e mantém histórico por condomínio. A aplicação não recebe credenciais de bancos legados e não executa SQL fornecido pelo usuário.

## Fontes aceitas

- **CSV:** primeira linha com os nomes exatos das colunas exibidas na tela.
- **JSON:** uma lista de objetos ou `{ "records": [...] }`.
- **Snapshot de banco existente:** exportação previamente normalizada para o mesmo formato JSON. A extração e a sanitização ocorrem fora do GCV.
- **Manifesto documental:** JSON com metadados e caminhos relativos de arquivos já enviados ao armazenamento autorizado.

Cada lote aceita até 1.000 registros. A validação cria um histórico, mas os dados de negócio só são alterados após a ação **Aplicar importação**.

## Ordem recomendada

1. Edifícios.
2. Unidades.
3. Moradores e vínculos.
4. Equipamentos.
5. Documentos.

Essa ordem resolve as dependências entre edifício, unidade, pessoa e documento. Reprocessamentos são idempotentes pelas chaves naturais descritas abaixo.

## Chaves e estruturas

| Destino | Chave de correspondência | Campos obrigatórios |
|---|---|---|
| Edifícios | nome dentro do condomínio | `name` |
| Unidades | edifício + número | `building`, `number`, `type`, `status`, `fractionalShare` |
| Equipamentos | nome + localização | `name`, `location`, `category`, `status`, datas de inspeção/instalação |
| Moradores | e-mail; vínculo por edifício + unidade | `building`, `unitNumber`, `name`, `email`, `phone`, `role` |
| Documentos | título + caminho | `title`, `category`, `filePath` |

Valores de enumeração permanecem em inglês para compatibilidade com a API:

- Unidade: `apartment`, `house`, `penthouse`; status `occupied`, `vacant`, `maintenance`.
- Vínculo: `owner`, `tenant`, `dependent`, `authorized_contact`.
- Equipamento: `operational`, `alert`, `critical`, `maintenance`.
- Acesso documental: `admin`, `syndic`, `manager`, `council_member`, `accountant`, `doorman`, `resident`, `vendor`.

## Taxonomia documental

Categorias recomendadas para organização e pesquisa:

- `legal`: convenção, regimento, procurações e legislação aplicável.
- `minutes`: atas de assembleia, conselho e reuniões.
- `technical`: plantas, projetos, laudos, ART/RRT, manuais e garantias.
- `maintenance`: relatórios de inspeção, PMOC, AVCB e certificados.
- `administrative`: contratos, políticas, comunicados e correspondências.
- `financial`: balancetes, notas fiscais, orçamento e prestação de contas.
- `resident`: documentos vinculados a uma unidade.

Arquivos físicos devem residir sob `DOCUMENT_STORAGE_PATH` (padrão `uploads/`). O manifesto usa caminhos relativos, por exemplo `uploads/technical/elevador/manual.pdf`. Caminhos absolutos ou contendo `..` são rejeitados.

## Operação com banco existente

1. Produza uma exportação somente leitura no banco de origem.
2. Remova segredos, senhas, tokens, dados bancários desnecessários e dados pessoais fora do escopo.
3. Transforme nomes e valores para o contrato da tabela acima.
4. Importe primeiro em `dev`, depois em `staging`.
5. Compare totais, vínculos e amostras; registre a aprovação.
6. Faça backup de produção e aplique o mesmo arquivo aprovado.
7. Preserve o identificador do lote e o relatório no histórico de auditoria.

Para bases grandes, a evolução prevista é um processo assíncrono com armazenamento de objetos e fila. O limite atual mantém a operação previsível durante o beta.
