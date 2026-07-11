import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Plus, Trash2 } from 'lucide-react';
import { Announcement } from '../types';

interface NotificationsProps {
  condoId: string;
}

async function readError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  return payload?.error || fallback;
}

export default function Notifications({ condoId }: NotificationsProps) {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<Announcement['type']>('announcement');

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/condominiums/${condoId}/announcements`);
      if (!response.ok) throw new Error(await readError(response, 'Erro ao carregar comunicados.'));
      setList(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar comunicados.');
    } finally {
      setLoading(false);
    }
  }, [condoId]);

  useEffect(() => { void loadAnnouncements(); }, [loadAnnouncements]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/condominiums/${condoId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), type }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Erro ao criar comunicado.'));
      await loadAnnouncements();
      setShowAdd(false);
      setTitle('');
      setBody('');
      setType('announcement');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar comunicado.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/v1/condominiums/${condoId}/announcements/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await readError(response, 'Erro ao remover comunicado.'));
      setList(current => current.filter(item => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover comunicado.');
    } finally {
      setRemovingId(null);
    }
  };

  const getTypeStyle = (value: Announcement['type']) => value === 'urgent'
    ? 'bg-red-500/10 border-red-500/25 text-red-400'
    : value === 'system'
      ? 'bg-[#10b981]/10 border-[#10b981]/20 text-[#10b981]'
      : 'bg-sky-500/10 border-sky-500/20 text-sky-400';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2"><Bell className="w-8 h-8 text-[#10b981]" />Comunicados & Notificações Gerais</h1>
          <p className="text-zinc-400 text-sm mt-1">Comunicados oficiais registrados para o condomínio ativo</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-emerald-600 text-white font-bold text-xs rounded-lg"><Plus className="w-4 h-4" />Disparar Comunicado</button>
      </div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {loading && <div className="p-6 text-center text-sm text-zinc-400">Carregando comunicados...</div>}
      {!loading && !error && list.length === 0 && <div className="rounded-lg border border-zinc-800 bg-[#14161b] p-6 text-center text-sm text-zinc-400">Nenhum comunicado publicado.</div>}
      <div className="space-y-4">
        {list.map(item => (
          <div key={item.id} className="p-5 bg-[#14161b] rounded-xl border border-zinc-800 flex justify-between items-start gap-4">
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${getTypeStyle(item.type)}`}>{item.type === 'urgent' ? 'Urgente' : item.type === 'system' ? 'Sistema' : 'Comunicado'}</span><span className="text-[10px] text-zinc-500 font-mono">{new Date(item.createdAt).toLocaleDateString('pt-BR')}</span></div>
              <h3 className="font-bold text-base text-white">{item.title}</h3><p className="text-zinc-300 text-xs leading-relaxed">{item.body}</p>
            </div>
            <button aria-label="Remover comunicado" disabled={removingId !== null} onClick={() => handleRemove(item.id)} className="text-zinc-500 hover:text-red-400 p-1.5"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      {showAdd && <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"><div className="bg-[#14161b] rounded-xl border border-zinc-800 p-6 w-full max-w-md space-y-4"><div className="flex justify-between border-b border-zinc-800 pb-2"><h3 className="text-lg font-bold text-white">Lançar Comunicado</h3><button onClick={() => setShowAdd(false)} className="text-zinc-400 text-xs">Fechar</button></div><form onSubmit={handleCreate} className="space-y-4 text-xs font-semibold"><input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Título" className="w-full bg-[#0d0e12] border border-zinc-800 text-white rounded p-2" /><textarea value={body} onChange={e => setBody(e.target.value)} required rows={4} placeholder="Descrição" className="w-full bg-[#0d0e12] border border-zinc-800 text-white rounded p-2" /><select value={type} onChange={e => setType(e.target.value as Announcement['type'])} className="w-full p-2.5"><option value="announcement">Comunicado geral</option><option value="urgent">Urgente</option><option value="system">Informativo de sistema</option></select><button disabled={submitting} type="submit" className="w-full py-2.5 bg-[#10b981] text-white font-bold uppercase rounded">{submitting ? 'Publicando...' : 'Publicar'}</button></form></div></div>}
    </div>
  );
}
