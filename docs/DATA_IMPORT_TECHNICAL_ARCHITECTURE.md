# Arquitetura técnica da carga de dados

## Visão da solução

```mermaid
flowchart LR
    subgraph Sources[Fontes de dados]
        CSV[Arquivo CSV]
        JSON[Arquivo JSON]
        LEGACY[Banco legado]
        FILES[Acervo documental]
    end

    subgraph Preparation[Preparação externa]
        EXPORT[Exportação somente leitura]
        CLEAN[Sanitização e normalização]
        MANIFEST[Manifesto de documentos]
    end

    subgraph GCV[GCV Web Application]
        UI[Tela Carga de Dados]
        PARSER[Parser CSV / JSON]
        API[API de Importação]
        AUTH[Autenticação, perfil e tenant guard]
        VALIDATE[Validação estrutural]
        REFERENCES[Validação de referências]
        JOB[Controle do lote]
        APPLY[Aplicação idempotente]
        AUDIT[Auditoria]
    end

    subgraph Persistence[Persistência]
        POSTGRES[(PostgreSQL)]
        STORAGE[(Armazenamento documental)]
    end

    subgraph Domains[Domínios de destino]
        BUILDINGS[Edifícios]
        UNITS[Unidades]
        RESIDENTS[Moradores e vínculos]
        EQUIPMENT[Equipamentos]
        DOCUMENTS[Metadados de documentos]
    end

    CSV --> UI
    JSON --> UI
    LEGACY --> EXPORT --> CLEAN --> JSON
    FILES --> MANIFEST --> JSON
    FILES -. arquivo físico .-> STORAGE

    UI --> PARSER --> API
    AUTH --> API
    API --> VALIDATE --> REFERENCES --> JOB
    JOB -->|lote válido e confirmado| APPLY
    JOB -->|erros por linha e campo| UI
    APPLY --> BUILDINGS
    APPLY --> UNITS
    APPLY --> RESIDENTS
    APPLY --> EQUIPMENT
    APPLY --> DOCUMENTS
    BUILDINGS --> POSTGRES
    UNITS --> POSTGRES
    RESIDENTS --> POSTGRES
    EQUIPMENT --> POSTGRES
    DOCUMENTS --> POSTGRES
    DOCUMENTS -. caminho relativo .-> STORAGE
    APPLY --> AUDIT --> POSTGRES
    POSTGRES -->|status e resultado| UI
```

## Sequência de processamento

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Síndico ou gestor
    participant UI as Front-end React
    participant API as Express API
    participant Guard as Auth + Tenant Guard
    participant Validator as Validador
    participant DB as PostgreSQL / Prisma
    participant Audit as Auditoria

    Operator->>UI: Seleciona destino e arquivo
    UI->>UI: Converte CSV ou JSON em registros
    UI->>API: POST /imports/validate
    API->>Guard: Verifica sessão, perfil e condomínio
    Guard-->>API: Acesso autorizado
    API->>Validator: Valida campos, enums e caminhos
    Validator->>DB: Confere edifícios e unidades
    DB-->>Validator: Referências existentes
    Validator-->>API: Registros válidos e erros
    API->>DB: Persiste DataImportJob e relatório
    API-->>UI: Prévia do lote

    alt Lote contém erros
        UI-->>Operator: Exibe linha, campo e motivo
    else Lote válido
        Operator->>UI: Confirma aplicação
        UI->>API: POST /imports/:id/apply
        API->>Guard: Revalida autorização
        API->>DB: Marca lote como processing
        loop Cada registro
            API->>DB: Localiza pela chave natural
            alt Registro existente
                API->>DB: Atualiza registro
            else Registro novo
                API->>DB: Cria registro
            end
        end
        API->>Audit: Registra resultado e responsável
        Audit->>DB: Persiste evento
        API->>DB: Marca lote como completed
        API-->>UI: Retorna totais processados
    end
```

## Modelo de dados

```mermaid
erDiagram
    ACCOUNT ||--o{ CONDOMINIUM : possui
    CONDOMINIUM ||--o{ DATA_IMPORT_JOB : registra
    CONDOMINIUM ||--o{ BUILDING : possui
    BUILDING ||--o{ UNIT : possui
    UNIT ||--o{ UNIT_RELATIONSHIP : recebe
    PERSON ||--o{ UNIT_RELATIONSHIP : participa
    CONDOMINIUM ||--o{ EQUIPMENT : inventaria
    CONDOMINIUM ||--o{ DOCUMENT : organiza
    UNIT o|--o{ DOCUMENT : restringe
    DOCUMENT ||--o{ DOCUMENT_VERSION : versiona
    ACCOUNT ||--o{ AUDIT_EVENT : registra

    DATA_IMPORT_JOB {
        uuid id PK
        uuid condominiumId FK
        enum source
        enum entity
        enum status
        string fileName
        string createdByEmail
        int totalRows
        int validRows
        int invalidRows
        json payload
        json validationReport
        json result
        datetime completedAt
    }

    DOCUMENT {
        uuid id PK
        uuid condominiumId FK
        uuid unitId FK
        string title
        string category
        enum requiredRole
        string filePath
    }
```

## Estados do lote

```mermaid
stateDiagram-v2
    [*] --> draft: arquivo recebido
    draft --> draft: validação com erros
    draft --> validated: validação sem erros
    validated --> processing: confirmação do operador
    processing --> completed: registros aplicados e auditados
    processing --> failed: referência ou escrita rejeitada
    completed --> [*]
    failed --> [*]
```

## Controles técnicos

| Camada | Controle |
|---|---|
| Autenticação | Sessão assinada obrigatória |
| Autorização | Perfis `admin`, `syndic` ou `manager` |
| Isolamento | `tenantGuard` valida acesso ao condomínio |
| Entrada | Contrato Zod e limite de 1.000 registros |
| Integridade | Validação de tipos, enums, datas e referências |
| Idempotência | Chaves naturais por domínio reduzem duplicidades |
| Documentos | Caminhos relativos; caminhos absolutos e `..` são rejeitados |
| Rastreabilidade | Lote, responsável, resultado e evento de auditoria persistidos |
| Banco legado | Exportação somente leitura e sanitização fora da aplicação |
| Produção | Homologação em `dev` e `staging`, backup e aplicação do lote aprovado |

## Evolução prevista

Para volumes superiores ao limite do beta, o processamento deve migrar para uma fila assíncrona. O arquivo original passa a ser armazenado em object storage, o worker processa blocos com checkpoints e a interface acompanha progresso, rejeições e reconciliação sem manter uma requisição HTTP aberta.

```mermaid
flowchart LR
    UI[Front-end] --> API[API]
    API --> OBJECT[(Object Storage)]
    API --> QUEUE[[Fila de importação]]
    QUEUE --> WORKER[Worker]
    WORKER --> DB[(PostgreSQL)]
    WORKER --> DLQ[[Fila de falhas]]
    DB --> STATUS[API de status]
    STATUS --> UI
```
