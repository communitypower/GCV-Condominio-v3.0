import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Database, Download, FileJson, FilePenLine, FilePlus2, FileText, History, Loader2, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';

type ImportEntity = 'buildings' | 'units' | 'equipment' | 'residents' | 'documents';
type ImportSource = 'csv' | 'json' | 'database_snapshot' | 'document_manifest';
type UploadStatus = 'queued' | 'uploading' | 'processing' | 'completed' | 'partial' | 'failed' | 'cancelled';
type AssociationField = 'buildingId' | 'unitId' | 'equipmentId' | 'maintenancePlanId' | 'maintenanceTicketId';
interface DataImportsProps { condoId: string }
interface ValidationResult { id: string; status: string; totalRows: number; validRows: number; invalidRows: number; issues: { row: number; field: string; message: string }[] }
interface DocumentAssociations { buildingId?: string | null; unitId?: string | null; equipmentId?: string | null; maintenancePlanId?: string | null; maintenanceTicketId?: string | null }
interface UploadItem extends DocumentAssociations { id: string; file: File; category: string; requiredRole: string; progress: number; status: UploadStatus; error?: string; documentId?: string; versionId?: string }
interface DocumentVersion { id: string; versionNumber?: number; originalFileName: string; mimeType: string; sizeBytes: number; checksum: string; processingStatus: string; processingError?: string | null; createdAt: string; chunkCount: number }
interface CatalogDocument extends DocumentAssociations { id: string; title?: string; category?: string; requiredRole?: string; latestVersion?: DocumentVersion | null }
interface AssociationOption { id: string; name?: string; title?: string; number?: string; location?: string }
interface MetadataDraft { title: string; category: string; requiredRole: string }

const entityOptions: { value: ImportEntity; label: string; columns: string[] }[] = [
  { value: 'buildings', label: 'Edifícios', columns: ['name'] },
  { value: 'units', label: 'Unidades', columns: ['building', 'number', 'type', 'status', 'fractionalShare'] },
  { value: 'equipment', label: 'Equipamentos', columns: ['name', 'location', 'category', 'status', 'lastInspection', 'nextInspection', 'installDate'] },
  { value: 'residents', label: 'Moradores e vínculos', columns: ['building', 'unitNumber', 'name', 'email', 'phone', 'role'] },
];
const categories = [['technical', 'Técnico'], ['administrative', 'Administrativo'], ['financial', 'Financeiro'], ['contract', 'Contrato'], ['manual', 'Manual'], ['inspection', 'Laudo ou inspeção'], ['project', 'Projeto ou desenho'], ['resident', 'Documento de morador'], ['other', 'Outro']] as const;
const roles = [
  ['resident', 'Morador'],
  ['doorman', 'Portaria'],
  ['vendor', 'Fornecedor'],
  ['staff', 'Equipe operacional'],
  ['accountant', 'Contabilidade'],
  ['council_member', 'Conselho'],
  ['manager', 'Gestão predial'],
  ['syndic', 'Síndico'],
  ['admin', 'Administração'],
] as const;
const acceptedExtensions = ['pdf', 'docx', 'xlsx', 'csv', 'json', 'txt', 'png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff'];
const acceptValue = '.pdf,.docx,.xlsx,.csv,.json,.txt,.png,.jpg,.jpeg,.webp,.tif,.tiff,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/json,text/plain,image/*';
const statusLabels: Record<string, string> = { queued: 'Aguardando', uploading: 'Enviando', uploaded: 'Enviado', quarantine: 'Verificando', scanning: 'Verificando', extracting: 'Extraindo', classifying: 'Classificando', indexing: 'Indexando', indexed: 'Concluído', processing: 'Processando', ready: 'Concluído', completed: 'Concluído', partial: 'Parcial', failed: 'Falha', cancelled: 'Cancelado' };
const associationLabels: Record<AssociationField, string> = { buildingId: 'Edifício', unitId: 'Unidade', equipmentId: 'Equipamento', maintenancePlanId: 'Plano de manutenção', maintenanceTicketId: 'Ordem de serviço' };

function parseCsv(content: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === '"' && quoted && content[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && content[index + 1] === '\n') index += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  const [headers = [], ...values] = rows;
  return values.map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] ?? ''])));
}
function formatBytes(value = 0) { if (value < 1024) return `${value} B`; if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1048576).toFixed(1)} MB`; }
async function readError(response: Response, fallback: string) { const data = await response.json().catch(() => null); return data?.error || fallback; }

export default function DataImports({ condoId }: DataImportsProps) {
  const [mode, setMode] = useState<'files' | 'bases'>('files');
  const [category, setCategory] = useState('technical');
  const [requiredRole, setRequiredRole] = useState('staff');
  const [associationField, setAssociationField] = useState<AssociationField | ''>('');
  const [associationId, setAssociationId] = useState('');
  const [associationOptions, setAssociationOptions] = useState<Record<AssociationField, AssociationOption[]>>({ buildingId: [], unitId: [], equipmentId: [], maintenancePlanId: [], maintenanceTicketId: [] });
  const [associationError, setAssociationError] = useState('');
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogDocument[]>([]);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [metadataDraft, setMetadataDraft] = useState<MetadataDraft>({ title: '', category: 'other', requiredRole: 'resident' });
  const [catalogAction, setCatalogAction] = useState('');
  const xhrById = useRef(new Map<string, XMLHttpRequest>());

  const [entity, setEntity] = useState<ImportEntity>('buildings');
  const [source, setSource] = useState<ImportSource>('csv');
  const [fileName, setFileName] = useState('');
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => entityOptions.find((item) => item.value === entity)!, [entity]);
  const overallProgress = useMemo(() => queue.length ? Math.round(queue.reduce((sum, item) => sum + item.progress, 0) / queue.length) : 0, [queue]);
  const filteredCatalog = useMemo(() => {
    const term = catalogSearch.trim().toLocaleLowerCase('pt-BR');
    return term ? catalog.filter((document) => [document.title, document.category, document.latestVersion?.originalFileName, document.latestVersion?.checksum].some((value) => value?.toLocaleLowerCase('pt-BR').includes(term))) : catalog;
  }, [catalog, catalogSearch]);
  const selectedAssociationOptions = associationField ? associationOptions[associationField] : [];

  const optionLabel = (option: AssociationOption) => {
    const primary = option.name || option.title || option.number || option.id;
    return option.location ? `${primary} · ${option.location}` : primary;
  };

  const associationLabel = (field: AssociationField, id?: string | null) => {
    if (!id) return '';
    const option = associationOptions[field].find((item) => item.id === id);
    return `${associationLabels[field]}: ${option ? optionLabel(option) : id}`;
  };
  const associationSummary = (value: DocumentAssociations) => (Object.keys(associationLabels) as AssociationField[])
    .map((field) => associationLabel(field, value[field]))
    .filter(Boolean);

  const loadCatalog = useCallback(async (quiet = false) => {
    if (!condoId) return; if (!quiet) setCatalogBusy(true);
    try {
      const response = await fetch(`/api/v1/condominiums/${condoId}/documents/catalog`);
      if (!response.ok) throw new Error(await readError(response, 'Falha ao carregar o catálogo.'));
      const data = await response.json(); const documents: CatalogDocument[] = Array.isArray(data) ? data : data.documents || [];
      setCatalog(documents); setCatalogError('');
      setQueue((current) => current.map((item) => {
        const document = documents.find((entry) => entry.id === item.documentId || entry.latestVersion?.id === item.versionId);
        if (!document?.latestVersion) return item;
        const processing = document.latestVersion.processingStatus;
        const status: UploadStatus = processing === 'failed' ? 'failed' : processing === 'partial' ? 'partial' : ['indexed', 'ready', 'completed'].includes(processing) ? 'completed' : 'processing';
        return { ...item, status, progress: ['completed', 'partial'].includes(status) ? 100 : Math.max(item.progress, 95), error: document.latestVersion.processingError || undefined };
      }));
    } catch (caught) { if (!quiet) setCatalogError(caught instanceof Error ? caught.message : 'Falha ao carregar o catálogo.'); }
    finally { if (!quiet) setCatalogBusy(false); }
  }, [condoId]);
  const loadHistory = useCallback(async () => { if (!condoId) return; const response = await fetch(`/api/v1/condominiums/${condoId}/imports`); if (response.ok) setHistory(await response.json()); }, [condoId]);
  const loadAssociationOptions = useCallback(async () => {
    if (!condoId) return;
    setAssociationError('');
    try {
      const endpoints: [AssociationField, string][] = [
        ['buildingId', 'buildings'],
        ['unitId', 'units'],
        ['equipmentId', 'equipment'],
        ['maintenancePlanId', 'plans'],
        ['maintenanceTicketId', 'tickets'],
      ];
      const responses = await Promise.all(endpoints.map(([, endpoint]) => fetch(`/api/v1/condominiums/${condoId}/${endpoint}`)));
      const failed = responses.find((response) => !response.ok);
      if (failed) throw new Error(await readError(failed, 'Não foi possível carregar as opções de associação.'));
      const payloads = await Promise.all(responses.map((response) => response.json()));
      setAssociationOptions(Object.fromEntries(endpoints.map(([field], index) => [field, Array.isArray(payloads[index]) ? payloads[index] : []])) as Record<AssociationField, AssociationOption[]>);
    } catch (caught) {
      setAssociationError(caught instanceof Error ? caught.message : 'Não foi possível carregar as opções de associação.');
    }
  }, [condoId]);

  useEffect(() => { setAssociationId(''); setEditingId(''); loadCatalog(); loadHistory(); loadAssociationOptions(); }, [condoId, loadCatalog, loadHistory, loadAssociationOptions]);
  useEffect(() => {
    const queueProcessing = queue.some((item) => item.status === 'processing');
    const catalogProcessing = catalog.some((document) => document.latestVersion && !['indexed', 'ready', 'completed', 'failed', 'partial', 'cancelled'].includes(document.latestVersion.processingStatus));
    if (!queueProcessing && !catalogProcessing) return;
    const timer = window.setInterval(() => loadCatalog(true), 4000);
    return () => window.clearInterval(timer);
  }, [queue, catalog, loadCatalog]);
  useEffect(() => () => { xhrById.current.forEach((xhr) => xhr.abort()); xhrById.current.clear(); }, []);

  const updateQueue = (id: string, patch: Partial<UploadItem>) => setQueue((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const uploadItem = (item: UploadItem) => {
    const xhr = new XMLHttpRequest(); xhrById.current.set(item.id, xhr); updateQueue(item.id, { status: 'uploading', progress: 0, error: undefined });
    xhr.open('POST', `/api/v1/condominiums/${condoId}/documents/upload`); xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) updateQueue(item.id, { progress: Math.min(90, Math.round(event.loaded / event.total * 90)) }); };
    xhr.onload = () => {
      xhrById.current.delete(item.id); let data: any = null; try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { data = null; }
      if (xhr.status < 200 || xhr.status >= 300) {
        const itemError = data?.errors?.find((entry: any) => entry?.fileName === item.file.name) || data?.errors?.[0];
        updateQueue(item.id, { status: 'failed', error: data?.error || itemError?.message || `Falha no upload (${xhr.status}).` });
        return;
      }
      const uploaded = data?.uploads?.[0] || data?.document || data?.documents?.[0] || data;
      updateQueue(item.id, { status: 'processing', progress: 95, documentId: uploaded?.id || uploaded?.documentId, versionId: uploaded?.latestVersion?.id || uploaded?.versionId }); loadCatalog(true);
    };
    xhr.onerror = () => { xhrById.current.delete(item.id); updateQueue(item.id, { status: 'failed', error: 'Falha de rede durante o upload.' }); };
    xhr.onabort = () => { xhrById.current.delete(item.id); updateQueue(item.id, { status: 'cancelled', error: undefined }); };
    const form = new FormData();
    form.append('files', item.file, item.file.name);
    form.append('category', item.category);
    form.append('requiredRole', item.requiredRole);
    (Object.keys(associationLabels) as AssociationField[]).forEach((field) => { if (item[field]) form.append(field, item[field]!); });
    xhr.send(form);
  };
  const addFiles = (files: File[]) => {
    const accepted: UploadItem[] = []; const rejected: UploadItem[] = [];
    const frozenAssociation = associationField && associationId ? { [associationField]: associationId } : {};
    files.forEach((file) => { const item: UploadItem = { id: crypto.randomUUID(), file, category, requiredRole, ...frozenAssociation, progress: 0, status: 'queued' }; const extension = file.name.split('.').pop()?.toLowerCase() || ''; (acceptedExtensions.includes(extension) ? accepted : rejected).push(acceptedExtensions.includes(extension) ? item : { ...item, status: 'failed', error: 'Formato não permitido.' }); });
    setQueue((current) => [...current, ...accepted, ...rejected]); accepted.forEach(uploadItem);
  };
  const retryProcessing = async (documentId: string) => {
    setCatalogAction(`retry-${documentId}`); setCatalogError(''); try { const response = await fetch(`/api/v1/condominiums/${condoId}/documents/${documentId}/retry`, { method: 'POST' }); if (!response.ok) throw new Error(await readError(response, 'Não foi possível reprocessar o documento.')); await loadCatalog(); }
    catch (caught) { setCatalogError(caught instanceof Error ? caught.message : 'Não foi possível reprocessar o documento.'); }
    finally { setCatalogAction(''); }
  };
  const beginEdit = (document: CatalogDocument) => {
    setEditingId(document.id);
    setMetadataDraft({ title: document.title || '', category: document.category || 'other', requiredRole: document.requiredRole || 'resident' });
    setCatalogError('');
  };
  const saveMetadata = async (documentId: string) => {
    setCatalogAction(`edit-${documentId}`); setCatalogError('');
    try {
      const response = await fetch(`/api/v1/condominiums/${condoId}/documents/${documentId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadataDraft),
      });
      if (!response.ok) throw new Error(await readError(response, 'Não foi possível atualizar os metadados.'));
      setEditingId(''); await loadCatalog();
    } catch (caught) { setCatalogError(caught instanceof Error ? caught.message : 'Não foi possível atualizar os metadados.'); }
    finally { setCatalogAction(''); }
  };
  const uploadNewVersion = async (document: CatalogDocument, file?: File) => {
    if (!file) return;
    setCatalogAction(`version-${document.id}`); setCatalogError('');
    try {
      const form = new FormData(); form.append('file', file, file.name);
      const response = await fetch(`/api/v1/condominiums/${condoId}/documents/${document.id}/versions`, { method: 'POST', body: form });
      if (!response.ok) throw new Error(await readError(response, 'Não foi possível enviar a nova versão.'));
      await loadCatalog();
    } catch (caught) { setCatalogError(caught instanceof Error ? caught.message : 'Não foi possível enviar a nova versão.'); }
    finally { setCatalogAction(''); }
  };
  const deleteDocument = async (document: CatalogDocument) => {
    const title = document.title || document.latestVersion?.originalFileName || 'este documento';
    if (!window.confirm(`Excluir “${title}”? A remoção será registrada na auditoria.`)) return;
    setCatalogAction(`delete-${document.id}`); setCatalogError('');
    try {
      const response = await fetch(`/api/v1/condominiums/${condoId}/documents/${document.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await readError(response, 'Não foi possível excluir o documento.'));
      setCatalog((current) => current.filter((item) => item.id !== document.id));
      if (editingId === document.id) setEditingId('');
    } catch (caught) { setCatalogError(caught instanceof Error ? caught.message : 'Não foi possível excluir o documento.'); }
    finally { setCatalogAction(''); }
  };

  const downloadTemplate = () => { const sample = Object.fromEntries(selected.columns.map((column) => [column, ''])); const blob = new Blob([JSON.stringify({ entity, records: [sample] }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `gcv-${entity}-modelo.json`; link.click(); URL.revokeObjectURL(link.href); };
  const handleFile = async (file?: File) => {
    if (!file) return; setError(''); setValidation(null); setFileName(file.name);
    try { const content = await file.text(); const parsed = file.name.toLowerCase().endsWith('.csv') ? parseCsv(content) : JSON.parse(content); const normalized = Array.isArray(parsed) ? parsed : parsed.records; if (!Array.isArray(normalized) || !normalized.length) throw new Error('O arquivo deve conter ao menos um registro.'); if (normalized.length > 1000) throw new Error('O limite por lote é de 1.000 registros.'); setSource(file.name.toLowerCase().endsWith('.csv') ? 'csv' : entity === 'documents' ? 'document_manifest' : 'database_snapshot'); setRecords(normalized); }
    catch (caught) { setRecords([]); setError(caught instanceof Error ? caught.message : 'Não foi possível ler o arquivo.'); }
  };
  const validate = async () => { setBusy(true); setError(''); try { const response = await fetch(`/api/v1/condominiums/${condoId}/imports/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, entity, fileName, records }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Falha ao validar o lote.'); setValidation(data); await loadHistory(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Falha ao validar o lote.'); } finally { setBusy(false); } };
  const apply = async () => { if (!validation) return; setBusy(true); setError(''); try { const response = await fetch(`/api/v1/condominiums/${condoId}/imports/${validation.id}/apply`, { method: 'POST' }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Falha ao aplicar o lote.'); setRecords([]); setValidation(null); setFileName(''); await loadHistory(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Falha ao aplicar o lote.'); } finally { setBusy(false); } };

  return <div className="space-y-6 w-full min-w-0 max-w-full overflow-x-hidden" data-testid="data-imports-page">
    <div><h1 className="text-3xl font-bold text-white flex items-center gap-3"><Database className="w-7 h-7 text-emerald-400" />Carga de Dados</h1><p className="text-sm text-zinc-400 mt-1">Envio de documentos e importação controlada de bases do condomínio.</p></div>
    <div role="tablist" aria-label="Tipo de carga" className="inline-flex bg-[#14161b] border border-zinc-800 p-1 rounded-lg">
      <button role="tab" aria-selected={mode === 'files'} onClick={() => setMode('files')} className={`px-4 py-2 rounded-md text-sm font-semibold ${mode === 'files' ? 'bg-emerald-950 text-emerald-300' : 'text-zinc-400 hover:text-white'}`}>Arquivos</button>
      <button role="tab" aria-selected={mode === 'bases'} onClick={() => setMode('bases')} className={`px-4 py-2 rounded-md text-sm font-semibold ${mode === 'bases' ? 'bg-emerald-950 text-emerald-300' : 'text-zinc-400 hover:text-white'}`}>Bases</button>
    </div>

    {mode === 'files' ? <div role="tabpanel" className="space-y-6">
      <section className="bg-[#14161b] border border-zinc-800 rounded-lg p-5 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-xs font-semibold text-zinc-300">Categoria<select value={category} onChange={(event) => setCategory(event.target.value)} className="block mt-2 w-full rounded-md border p-2.5">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs font-semibold text-zinc-300">Acesso mínimo<select value={requiredRole} onChange={(event) => setRequiredRole(event.target.value)} className="block mt-2 w-full rounded-md border p-2.5">{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <fieldset className="border-t border-zinc-800 pt-4">
          <legend className="text-xs font-semibold text-zinc-300 pr-2">Associação opcional</legend>
          <p className="text-xs text-zinc-400 mt-1 mb-3">Vincule os próximos arquivos a um objeto operacional do condomínio.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-zinc-300">Tipo de vínculo<select value={associationField} onChange={(event) => { setAssociationField(event.target.value as AssociationField | ''); setAssociationId(''); }} className="block mt-1.5 w-full rounded-md border p-2.5"><option value="">Sem associação</option>{(Object.keys(associationLabels) as AssociationField[]).map((field) => <option key={field} value={field}>{associationLabels[field]}</option>)}</select></label>
            <label className="text-xs text-zinc-300">Registro<select value={associationId} onChange={(event) => setAssociationId(event.target.value)} disabled={!associationField} className="block mt-1.5 w-full rounded-md border p-2.5 disabled:opacity-50"><option value="">{associationField ? 'Selecione um registro' : 'Escolha primeiro o tipo'}</option>{selectedAssociationOptions.map((option) => <option key={option.id} value={option.id}>{optionLabel(option)}</option>)}</select></label>
          </div>
          {associationField && !selectedAssociationOptions.length && !associationError && <p className="text-xs text-amber-300 mt-2">Nenhum registro disponível para este tipo de vínculo.</p>}
          {associationError && <p role="alert" className="text-xs text-red-300 mt-2">{associationError}</p>}
        </fieldset>
        <label data-testid="document-drop-zone" onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={(event) => { event.preventDefault(); if (event.currentTarget === event.target) setDragActive(false); }} onDrop={(event) => { event.preventDefault(); setDragActive(false); addFiles(Array.from(event.dataTransfer.files)); }} className={`border border-dashed rounded-lg min-h-40 flex flex-col items-center justify-center cursor-pointer bg-zinc-950/30 px-6 text-center focus-within:ring-2 focus-within:ring-emerald-500 ${dragActive ? 'border-emerald-400 bg-emerald-950/20' : 'border-zinc-600 hover:border-emerald-500'}`}>
          <Upload className="w-7 h-7 text-emerald-400 mb-3" /><span className="text-sm font-semibold text-white">Arraste arquivos aqui ou selecione no computador</span><span className="text-xs text-zinc-400 mt-2">PDF, DOCX, XLSX, CSV, JSON, TXT e imagens. Selecione vários arquivos de uma vez.</span>
          <input data-testid="document-file-input" type="file" multiple accept={acceptValue} className="sr-only" onChange={(event) => { addFiles(Array.from(event.target.files || [])); event.currentTarget.value = ''; }} />
        </label>
        {queue.length > 0 && <div className="space-y-3" aria-live="polite">
          <div className="flex items-center justify-between text-xs text-zinc-300"><span>{queue.length} arquivo(s) na fila</span><strong>{overallProgress}%</strong></div><div className="h-1.5 rounded bg-zinc-800 overflow-hidden" role="progressbar" aria-label="Progresso total" aria-valuenow={overallProgress} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-emerald-500 transition-all" style={{ width: `${overallProgress}%` }} /></div>
          <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg overflow-hidden">{queue.map((item) => <li key={item.id} className="p-3 bg-zinc-950/25 flex items-center gap-3"><FileText className="w-4 h-4 text-zinc-400 shrink-0" /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><span className="text-sm text-white truncate">{item.file.name}</span><span className="text-xs text-zinc-400 shrink-0">{statusLabels[item.status] || item.status}</span></div>{associationSummary(item).map((label) => <span key={label} className="block text-[11px] text-sky-300 mt-1 truncate">{label}</span>)}<div className="h-1 mt-2 rounded bg-zinc-800 overflow-hidden"><div className={`h-full transition-all ${item.status === 'failed' ? 'bg-red-500' : item.status === 'partial' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${item.progress}%` }} /></div>{item.error && <p className="text-xs text-red-300 mt-1">{item.error}</p>}</div>{item.status === 'uploading' && <button type="button" onClick={() => xhrById.current.get(item.id)?.abort()} title="Cancelar upload" aria-label={`Cancelar upload de ${item.file.name}`} className="p-2 text-zinc-400 hover:text-red-300"><X className="w-4 h-4" /></button>}{['failed', 'cancelled'].includes(item.status) && <button type="button" onClick={() => uploadItem(item)} title="Tentar novamente" aria-label={`Tentar upload de ${item.file.name} novamente`} className="p-2 text-zinc-400 hover:text-emerald-300"><RefreshCw className="w-4 h-4" /></button>}</li>)}</ul>
        </div>}
      </section>
      <section className="bg-[#14161b] border border-zinc-800 rounded-lg overflow-hidden min-w-0 max-w-full">
        <div className="px-5 py-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-white">Catálogo documental</h2><p className="text-xs text-zinc-400 mt-1">Conteúdo enviado, processamento e disponibilidade para consulta.</p></div><div className="flex items-center gap-2 w-full sm:w-auto"><label className="relative flex-1"><span className="sr-only">Buscar documentos</span><Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" /><input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Buscar documento" className="w-full rounded-md border pl-9 pr-3 py-2 text-xs" /></label><button type="button" onClick={() => loadCatalog()} title="Atualizar catálogo" aria-label="Atualizar catálogo" className="p-2 text-zinc-400 hover:text-emerald-300"><RefreshCw className={`w-4 h-4 ${catalogBusy ? 'animate-spin' : ''}`} /></button></div></div>
        {catalogError && <p role="alert" className="m-4 text-sm text-red-300 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{catalogError}</p>}
        <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-xs"><thead className="text-zinc-400 border-b border-zinc-800"><tr><th className="p-4">Documento</th><th className="p-4">Categoria e acesso</th><th className="p-4">Associações</th><th className="p-4">Processamento</th><th className="p-4">Conteúdo</th><th className="p-4">Enviado em</th><th className="p-4">Ações</th></tr></thead><tbody className="divide-y divide-zinc-800">{filteredCatalog.map((document) => {
          const version = document.latestVersion;
          const failed = version?.processingStatus === 'failed' || version?.processingStatus === 'partial';
          const complete = ['indexed', 'ready', 'completed'].includes(version?.processingStatus || '');
          const associations = associationSummary(document);
          const actionPending = Boolean(catalogAction);
          return <React.Fragment key={document.id}>
            <tr className="text-zinc-300 align-top">
              <td className="p-4"><strong className="text-white block max-w-xs truncate">{document.title || version?.originalFileName || 'Sem título'}</strong><span className="text-zinc-500">{version ? `Versão ${version.versionNumber || '-'} · ${formatBytes(version.sizeBytes)} · ${version.mimeType || 'tipo não informado'}` : 'Sem versão'}</span></td>
              <td className="p-4"><span className="block">{categories.find(([value]) => value === document.category)?.[1] || document.category || 'Outro'}</span><span className="text-zinc-500">{roles.find(([value]) => value === document.requiredRole)?.[1] || document.requiredRole || 'Não informado'}</span></td>
              <td className="p-4 max-w-xs">{associations.length ? associations.map((label) => <span key={label} className="block text-sky-300 mb-1 break-words">{label}</span>) : <span className="text-zinc-500">Sem associação</span>}</td>
              <td className="p-4"><span className={`font-bold ${failed ? 'text-amber-300' : complete ? 'text-emerald-300' : 'text-sky-300'}`}>{statusLabels[version?.processingStatus || 'queued'] || version?.processingStatus}</span>{version?.processingError && <span className="block text-red-300 mt-1 max-w-xs">{version.processingError}</span>}</td>
              <td className="p-4">{version?.chunkCount || 0} trecho(s)</td>
              <td className="p-4 whitespace-nowrap">{version?.createdAt ? new Date(version.createdAt).toLocaleString('pt-BR') : '-'}</td>
              <td className="p-4"><div className="flex flex-wrap gap-1.5">
                {failed && <button type="button" disabled={actionPending} onClick={() => retryProcessing(document.id)} className="p-2 text-emerald-300 hover:bg-emerald-950/40 rounded disabled:opacity-50" title="Reprocessar documento" aria-label={`Reprocessar ${document.title}`}><RefreshCw className="w-4 h-4" /></button>}
                <button type="button" disabled={actionPending} onClick={() => editingId === document.id ? setEditingId('') : beginEdit(document)} className="p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded disabled:opacity-50" title="Corrigir metadados" aria-label={`Corrigir metadados de ${document.title}`}><FilePenLine className="w-4 h-4" /></button>
                <label className={`p-2 text-zinc-300 hover:text-emerald-300 hover:bg-zinc-800 rounded cursor-pointer ${actionPending ? 'opacity-50 pointer-events-none' : ''}`} title="Enviar nova versão"><FilePlus2 className="w-4 h-4" /><input type="file" accept={acceptValue} aria-label={`Enviar nova versão de ${document.title}`} className="sr-only" disabled={actionPending} onChange={(event) => { uploadNewVersion(document, event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
                <button type="button" disabled={actionPending} onClick={() => deleteDocument(document)} className="p-2 text-zinc-400 hover:text-red-300 hover:bg-red-950/30 rounded disabled:opacity-50" title="Excluir documento" aria-label={`Excluir ${document.title}`}><Trash2 className="w-4 h-4" /></button>
              </div>{catalogAction.endsWith(document.id) && <span role="status" className="flex items-center gap-1 text-zinc-400 mt-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Processando...</span>}</td>
            </tr>
            {editingId === document.id && <tr className="bg-zinc-950/40"><td colSpan={7} className="p-4">
              <form onSubmit={(event) => { event.preventDefault(); saveMetadata(document.id); }} className="grid sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_1fr_1fr_auto] gap-3 items-end" aria-label={`Correção de metadados de ${document.title}`}>
                <label className="text-xs text-zinc-300">Título<input required maxLength={180} value={metadataDraft.title} onChange={(event) => setMetadataDraft((current) => ({ ...current, title: event.target.value }))} className="block mt-1.5 w-full rounded-md border p-2.5" /></label>
                <label className="text-xs text-zinc-300">Categoria<select value={metadataDraft.category} onChange={(event) => setMetadataDraft((current) => ({ ...current, category: event.target.value }))} className="block mt-1.5 w-full rounded-md border p-2.5">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-xs text-zinc-300">Acesso mínimo<select value={metadataDraft.requiredRole} onChange={(event) => setMetadataDraft((current) => ({ ...current, requiredRole: event.target.value }))} className="block mt-1.5 w-full rounded-md border p-2.5">{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <div className="flex gap-2"><button type="button" onClick={() => setEditingId('')} className="px-3 py-2.5 border border-zinc-700 text-zinc-300 rounded-md hover:text-white">Cancelar</button><button type="submit" disabled={catalogAction === `edit-${document.id}`} className="px-3 py-2.5 bg-emerald-600 text-white font-bold rounded-md hover:bg-emerald-500 disabled:opacity-50">Salvar</button></div>
              </form>
            </td></tr>}
          </React.Fragment>;
        })}</tbody></table>
          {!catalogBusy && !filteredCatalog.length && <div className="p-10 text-center"><FileText className="w-6 h-6 text-zinc-600 mx-auto mb-2" /><p className="text-sm text-zinc-400">{catalogSearch ? 'Nenhum documento corresponde à busca.' : 'Nenhum documento carregado.'}</p></div>}{catalogBusy && !catalog.length && <div className="p-10 flex justify-center text-zinc-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Carregando catálogo...</div>}
        </div>
      </section>
    </div> : <div role="tabpanel" className="space-y-6">
      <section className="bg-[#14161b] border border-zinc-800 rounded-lg p-5 space-y-5">
        <div className="grid md:grid-cols-2 gap-4"><label className="text-xs font-semibold text-zinc-300">Estrutura de destino<select value={entity} onChange={(event) => { setEntity(event.target.value as ImportEntity); setRecords([]); setValidation(null); }} className="block mt-2 w-full rounded-md border p-2.5">{entityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><div className="text-xs font-semibold text-zinc-300">Colunas esperadas<div className="mt-2 min-h-10 flex flex-wrap gap-2">{selected.columns.map((column) => <code key={column} className="bg-zinc-900 border border-zinc-700 px-2 py-1 rounded text-emerald-300">{column}</code>)}</div><button onClick={downloadTemplate} className="mt-2 text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Baixar modelo JSON</button></div></div>
        <label className="border border-dashed border-zinc-600 hover:border-emerald-500 rounded-lg min-h-32 flex flex-col items-center justify-center cursor-pointer bg-zinc-950/30"><Upload className="w-6 h-6 text-emerald-400 mb-2" /><span className="text-sm font-semibold text-white">Selecionar CSV ou JSON</span><span className="text-xs text-zinc-400 mt-1">{fileName || 'Até 1.000 registros por lote'}</span><input data-testid="data-import-file" type="file" accept=".csv,.json,application/json,text/csv" className="sr-only" onChange={(event) => handleFile(event.target.files?.[0])} /></label>
        {records.length > 0 && <div className="flex items-center justify-between border-t border-zinc-800 pt-4"><span className="text-sm text-zinc-300"><strong className="text-white">{records.length}</strong> registros carregados</span><button data-testid="validate-import" onClick={validate} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-md flex items-center gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}Validar lote</button></div>}
        {validation && <div className={`border rounded-lg p-4 ${validation.invalidRows ? 'border-amber-700 bg-amber-950/20' : 'border-emerald-800 bg-emerald-950/20'}`}><div className="flex items-start gap-3">{validation.invalidRows ? <AlertCircle className="text-amber-400 shrink-0" /> : <CheckCircle2 className="text-emerald-400 shrink-0" />}<div className="flex-1"><p className="text-sm font-bold text-white">{validation.validRows} válidos, {validation.invalidRows} com erro</p>{validation.issues.slice(0, 8).map((issue, index) => <p key={`${issue.row}-${issue.field}-${index}`} className="text-xs text-amber-200 mt-1">Linha {issue.row}, {issue.field}: {issue.message}</p>)}</div>{validation.invalidRows === 0 && <button data-testid="apply-import" onClick={apply} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-md">Aplicar importação</button>}</div></div>}{error && <p role="alert" className="text-sm text-red-300 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</p>}
      </section>
      <section className="bg-[#14161b] border border-zinc-800 rounded-lg overflow-hidden"><div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2"><History className="w-4 h-4 text-emerald-400" /><h2 className="text-sm font-bold text-white">Histórico de importações</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-zinc-400 border-b border-zinc-800"><tr><th className="p-4">Data</th><th className="p-4">Destino</th><th className="p-4">Origem</th><th className="p-4">Registros</th><th className="p-4">Status</th><th className="p-4">Responsável</th></tr></thead><tbody className="divide-y divide-zinc-800">{history.map((job) => <tr key={job.id} className="text-zinc-300"><td className="p-4 whitespace-nowrap">{new Date(job.createdAt).toLocaleString('pt-BR')}</td><td className="p-4">{entityOptions.find((item) => item.value === job.entity)?.label}</td><td className="p-4">{job.fileName || job.source}</td><td className="p-4">{job.validRows}/{job.totalRows}</td><td className="p-4"><span className="uppercase text-[10px] font-bold text-emerald-300">{job.status}</span></td><td className="p-4">{job.createdByEmail}</td></tr>)}</tbody></table>{!history.length && <div className="p-8 text-center text-zinc-400 text-sm">Nenhuma importação registrada.</div>}</div></section>
    </div>}
  </div>;
}
