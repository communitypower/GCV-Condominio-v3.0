import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Database, Download, FileJson, History, Loader2, Upload } from 'lucide-react';

type ImportEntity = 'buildings' | 'units' | 'equipment' | 'residents' | 'documents';
type ImportSource = 'csv' | 'json' | 'database_snapshot' | 'document_manifest';

interface DataImportsProps { condoId: string }

interface ValidationResult {
  id: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  issues: { row: number; field: string; message: string }[];
}

const entityOptions: { value: ImportEntity; label: string; columns: string[] }[] = [
  { value: 'buildings', label: 'Edifícios', columns: ['name'] },
  { value: 'units', label: 'Unidades', columns: ['building', 'number', 'type', 'status', 'fractionalShare'] },
  { value: 'equipment', label: 'Equipamentos', columns: ['name', 'location', 'category', 'status', 'lastInspection', 'nextInspection', 'installDate'] },
  { value: 'residents', label: 'Moradores e vínculos', columns: ['building', 'unitNumber', 'name', 'email', 'phone', 'role'] },
  { value: 'documents', label: 'Documentos', columns: ['title', 'category', 'filePath', 'requiredRole', 'building', 'unitNumber'] },
];

function parseCsv(content: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === '"' && quoted && content[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && content[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const [headers = [], ...values] = rows;
  return values.map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] ?? ''])));
}

export default function DataImports({ condoId }: DataImportsProps) {
  const [entity, setEntity] = useState<ImportEntity>('buildings');
  const [source, setSource] = useState<ImportSource>('csv');
  const [fileName, setFileName] = useState('');
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => entityOptions.find((item) => item.value === entity)!, [entity]);

  const downloadTemplate = () => {
    const sample = Object.fromEntries(selected.columns.map((column) => [column, '']));
    const blob = new Blob([JSON.stringify({ entity, records: [sample] }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gcv-${entity}-modelo.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const loadHistory = useCallback(async () => {
    const response = await fetch(`/api/v1/condominiums/${condoId}/imports`);
    if (response.ok) setHistory(await response.json());
  }, [condoId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError(''); setValidation(null); setFileName(file.name);
    try {
      const content = await file.text();
      const parsed = file.name.toLowerCase().endsWith('.csv')
        ? parseCsv(content)
        : JSON.parse(content);
      const normalized = Array.isArray(parsed) ? parsed : parsed.records;
      if (!Array.isArray(normalized) || normalized.length === 0) throw new Error('O arquivo deve conter ao menos um registro.');
      if (normalized.length > 1000) throw new Error('O limite por lote é de 1.000 registros.');
      setSource(file.name.toLowerCase().endsWith('.csv') ? 'csv' : entity === 'documents' ? 'document_manifest' : 'database_snapshot');
      setRecords(normalized);
    } catch (caught) {
      setRecords([]);
      setError(caught instanceof Error ? caught.message : 'Não foi possível ler o arquivo.');
    }
  };

  const validate = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/v1/condominiums/${condoId}/imports/validate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, entity, fileName, records }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao validar o lote.');
      setValidation(data);
      await loadHistory();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Falha ao validar o lote.'); }
    finally { setBusy(false); }
  };

  const apply = async () => {
    if (!validation) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/v1/condominiums/${condoId}/imports/${validation.id}/apply`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao aplicar o lote.');
      setRecords([]); setValidation(null); setFileName('');
      await loadHistory();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Falha ao aplicar o lote.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6" data-testid="data-imports-page">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Database className="w-7 h-7 text-emerald-400" />Carga de Dados</h1>
        <p className="text-sm text-zinc-400 mt-1">Importação controlada de cadastros, bases legadas e acervos documentais.</p>
      </div>

      <section className="bg-[#14161b] border border-zinc-800 rounded-lg p-5 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-xs font-semibold text-zinc-300">Estrutura de destino
            <select value={entity} onChange={(event) => { setEntity(event.target.value as ImportEntity); setRecords([]); setValidation(null); }} className="block mt-2 w-full rounded-md border p-2.5">
              {entityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <div className="text-xs font-semibold text-zinc-300">Colunas esperadas
            <div className="mt-2 min-h-10 flex flex-wrap gap-2">{selected.columns.map((column) => <code key={column} className="bg-zinc-900 border border-zinc-700 px-2 py-1 rounded text-emerald-300">{column}</code>)}</div>
            <button onClick={downloadTemplate} className="mt-2 text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Baixar modelo JSON</button>
          </div>
        </div>

        <label className="border border-dashed border-zinc-600 hover:border-emerald-500 rounded-lg min-h-32 flex flex-col items-center justify-center cursor-pointer bg-zinc-950/30">
          <Upload className="w-6 h-6 text-emerald-400 mb-2" />
          <span className="text-sm font-semibold text-white">Selecionar CSV ou JSON</span>
          <span className="text-xs text-zinc-500 mt-1">{fileName || 'Até 1.000 registros por lote'}</span>
          <input data-testid="data-import-file" type="file" accept=".csv,.json,application/json,text/csv" className="sr-only" onChange={(event) => handleFile(event.target.files?.[0])} />
        </label>

        {records.length > 0 && <div className="flex items-center justify-between border-t border-zinc-800 pt-4"><span className="text-sm text-zinc-300"><strong className="text-white">{records.length}</strong> registros carregados</span><button data-testid="validate-import" onClick={validate} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-md flex items-center gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}Validar lote</button></div>}

        {validation && <div className={`border rounded-lg p-4 ${validation.invalidRows ? 'border-amber-700 bg-amber-950/20' : 'border-emerald-800 bg-emerald-950/20'}`}>
          <div className="flex items-start gap-3">{validation.invalidRows ? <AlertCircle className="text-amber-400 shrink-0" /> : <CheckCircle2 className="text-emerald-400 shrink-0" />}<div className="flex-1"><p className="text-sm font-bold text-white">{validation.validRows} válidos, {validation.invalidRows} com erro</p>{validation.issues.slice(0, 8).map((issue, index) => <p key={`${issue.row}-${issue.field}-${index}`} className="text-xs text-amber-200 mt-1">Linha {issue.row}, {issue.field}: {issue.message}</p>)}</div>{validation.invalidRows === 0 && <button data-testid="apply-import" onClick={apply} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-md">Aplicar importação</button>}</div>
        </div>}
        {error && <p role="alert" className="text-sm text-red-300 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</p>}
      </section>

      <section className="bg-[#14161b] border border-zinc-800 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2"><History className="w-4 h-4 text-emerald-400" /><h2 className="text-sm font-bold text-white">Histórico de importações</h2></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-zinc-500 border-b border-zinc-800"><tr><th className="p-4">Data</th><th className="p-4">Destino</th><th className="p-4">Origem</th><th className="p-4">Registros</th><th className="p-4">Status</th><th className="p-4">Responsável</th></tr></thead><tbody className="divide-y divide-zinc-800">{history.map((job) => <tr key={job.id} className="text-zinc-300"><td className="p-4 whitespace-nowrap">{new Date(job.createdAt).toLocaleString('pt-BR')}</td><td className="p-4">{entityOptions.find((item) => item.value === job.entity)?.label}</td><td className="p-4">{job.fileName || job.source}</td><td className="p-4">{job.validRows}/{job.totalRows}</td><td className="p-4"><span className="uppercase text-[10px] font-bold text-emerald-300">{job.status}</span></td><td className="p-4">{job.createdByEmail}</td></tr>)}</tbody></table>{history.length === 0 && <div className="p-8 text-center text-zinc-500 text-sm">Nenhuma importação registrada.</div>}</div>
      </section>
    </div>
  );
}
