import React, { useState } from 'react';
import { Bell, Search, Plus, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  date: string;
  type: 'urgent' | 'announcement' | 'system';
}

export default function Notifications() {
  const [list, setList] = useState<NotificationItem[]>([
    {
      id: 'NT-01',
      title: 'Limpeza Semestral Reservatório d\'Água',
      body: 'Comunicamos que no dia 28/05/2026 haverá a lavagem geral das caixas d\'água da Torre A. Solicitamos o uso consciente no período.',
      date: '2026-05-24',
      type: 'urgent'
    },
    {
      id: 'NT-02',
      title: 'Manutenção Preventiva Semanal Elevador B-1',
      body: 'Interrupção temporária do elevador social da Torre B na terça-feira das 14h às 16h para reprogramação das chaves térmicas.',
      date: '2026-05-25',
      type: 'announcement'
    },
    {
      id: 'NT-03',
      title: 'Rateio de Reforma Concluído',
      body: 'Aprovada quitação final da parcela 10/10 da reforma estrutural da rampa de garagens principal.',
      date: '2026-05-22',
      type: 'system'
    }
  ]);

  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<'urgent' | 'announcement' | 'system'>('announcement');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      alert('Favor preencher a notificação.');
      return;
    }
    const newAnn: NotificationItem = {
      id: `NT-${String(list.length + 1).padStart(2, '0')}`,
      title,
      body,
      date: new Date().toISOString().split('T')[0],
      type
    };
    setList([newAnn, ...list]);
    setShowAdd(false);
    setTitle('');
    setBody('');
  };

  const handleRemove = (id: string) => {
    setList(list.filter(n => n.id !== id));
  };

  const getTypeStyle = (t: NotificationItem['type']) => {
    switch (t) {
      case 'urgent': return 'bg-red-500/10 border-red-500/25 text-red-400';
      case 'announcement': return 'bg-sky-500/10 border-sky-500/20 text-sky-400';
      case 'system': return 'bg-[#10b981]/10 border-[#10b981]/20 text-[#10b981]';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
            <span className="text-[#10b981]"><Bell className="w-8 h-8" /></span>
            Comunicados & Notificações Gerais
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Dispare notícias de recalques, cortes elétricos ou regimentos da convenção diretamente</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Disparar Comunicado
        </button>
      </div>

      <div className="space-y-4">
        {list.map(n => (
          <div key={n.id} className="p-5 bg-[#14161b] rounded-xl border border-zinc-800 space-y-3 shadow-md flex justify-between items-start gap-4">
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${getTypeStyle(n.type)}`}>
                  {n.type === 'urgent' ? '🚨 Urgente' : n.type === 'system' ? '⚙ Sistema' : '📣 Comunicado'}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">{n.id} • {new Date(n.date).toLocaleDateString('pt-BR')}</span>
              </div>
              <h3 className="font-bold text-base text-white">{n.title}</h3>
              <p className="text-zinc-300 text-xs leading-relaxed">{n.body}</p>
            </div>

            <button
              onClick={() => handleRemove(n.id)}
              className="text-zinc-650 hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#14161b] rounded-xl border border-zinc-800 p-6 w-full max-w-md space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-1">
                <Bell className="w-5 h-5 text-[#10b981]" />
                Lançar Comunicado Mural
              </h3>
              <button onClick={() => setShowAdd(false)} className="text-zinc-500 text-xs font-mono">fechar</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-zinc-400 block">Título do Assunto</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="EX: Interrupção Temporária de Energia Elétrica"
                  className="w-full bg-[#0d0e12] border border-zinc-850 text-white rounded p-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Corpo / Descrição do Alerta</label>
                <textarea 
                  value={body} 
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Instruções aos moradores, horários e observações..."
                  rows={4}
                  className="w-full bg-[#0d0e12] border border-zinc-850 text-white rounded p-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Tipo de Alerta</label>
                <select 
                  value={type} 
                  onChange={(e: any) => setType(e.target.value)}
                  className="w-full p-2.5"
                >
                  <option value="announcement">📣 Comunicado Geral (Padrão)</option>
                  <option value="urgent">🚨 Urgente (Destaque de atenção)</option>
                  <option value="system">⚙ Informativo de Sistema</option>
                </select>
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-[#10b981] text-white font-bold uppercase rounded hover:bg-[#009267] transition-colors"
              >
                Disparar para Contatos
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
