import React, { useState } from 'react';
import { Activity, Search, Plus, User, Clock, CheckCircle } from 'lucide-react';
import { OperationLog } from '../types';

interface OperationLogsProps {
  logs: OperationLog[];
  onAddLog: (newLog: OperationLog) => void;
}

export default function OperationLogs({
  logs,
  onAddLog
}: OperationLogsProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'tech' | 'admin' | 'security'>('tech');

  const filteredLogs = logs.filter(l => {
    const matchesSearch = l.title.toLowerCase().includes(search.toLowerCase()) || 
                          l.content.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || l.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('Favor preencher o log.');
      return;
    }
    const newLog: OperationLog = {
      id: `LOG-${String(logs.length + 1).padStart(2, '0')}`,
      title,
      content,
      author: 'Cassiano Marins', // Administrator matching picture profile
      createdAt: new Date().toISOString(),
      type
    };
    onAddLog(newLog);
    setShowAdd(false);
    setTitle('');
    setContent('');
  };

  const getLogTypeBadge = (t: 'tech' | 'admin' | 'security') => {
    switch(t) {
      case 'tech': return <span className="bg-sky-550/10 text-sky-400 border border-sky-500/10 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Técnico</span>;
      case 'admin': return <span className="bg-green-500/10 text-emerald-400 border border-green-500/15 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Admin</span>;
      case 'security': return <span className="bg-orange-500/10 text-orange-400 border border-orange-500/15 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Segurança</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
            <span className="text-[#10b981]"><Activity className="w-8 h-8" /></span>
            Logs de Operação Predial
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Registros técnicos, rondas de segurança e anotações administrativas de rotina</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Registrar Entrada de Log
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-[#14161b] rounded-xl p-4 border border-zinc-800 flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 relative w-full">
          <Search className="absolute left-3 top-3 text-zinc-500 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Pesquisar registros de ocorrências por palavras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0d0e12] border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-[#10b981]"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-[#0d0e12] border border-zinc-800 text-white rounded-lg px-4 py-2.5 text-xs focus:ring-1 focus:ring-[#10b981] focus:outline-none w-full md:w-auto"
        >
          <option value="all">Todas as Ocorrências</option>
          <option value="tech">Manutenções Técnicas</option>
          <option value="admin">Leituras e Leitores Admin</option>
          <option value="security">Rondas de Portaria / Segurança</option>
        </select>
      </div>

      {/* Logs stack */}
      <div className="space-y-4">
        {filteredLogs.map(l => (
          <div key={l.id} className="bg-[#14161b] rounded-xl border border-zinc-850 p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-mono text-zinc-500 font-bold block">{l.id}</span>
                <h3 className="font-bold text-base text-white">{l.title}</h3>
              </div>
              <div>{getLogTypeBadge(l.type)}</div>
            </div>

            <p className="text-zinc-300 text-xs leading-relaxed">{l.content}</p>

            <div className="pt-2 border-t border-zinc-850/50 flex flex-wrap items-center justify-between text-[11px] text-zinc-500">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-zinc-500" />
                <span>Registrado por: <strong className="text-zinc-400">{l.author}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(l.createdAt).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          </div>
        ))}

        {filteredLogs.length === 0 && (
          <div className="py-12 text-center text-zinc-500 bg-[#14161b] rounded-xl border border-zinc-800">
            Nenhum registro de log encontrado por estes critérios.
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#14161b] rounded-xl border border-zinc-800 p-6 w-full max-w-md space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-zinc-855 pb-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                <Activity className="text-[#10b981] w-5 h-5" /> Adicionar Log Operacional
              </h3>
              <button onClick={() => setShowAdd(false)} className="text-zinc-500 text-xs font-mono border border-zinc-850 px-2 py-0.5 rounded">fechar</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-zinc-400 block">Título do Log</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="EX: Leitura Bimestral de Gás GLP Comum"
                  className="w-full bg-[#0d0e12] border border-zinc-800 text-white rounded p-2 focus:outline-none focus:border-[#10b981]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Descrição e Ocorrência</label>
                <textarea 
                  value={content} 
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Detalhamento técnico da operação realizada..."
                  rows={4}
                  className="w-full bg-[#0d0e12] border border-zinc-800 text-white rounded p-2 focus:outline-none focus:border-[#10b981]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Setor / Subtipo</label>
                <select 
                  value={type} 
                  onChange={(e: any) => setType(e.target.value)}
                  className="w-full p-2.5"
                >
                  <option value="tech">Manutenção Técnica / Elétrica ou Hidráulica</option>
                  <option value="admin">Leitura / Anotação Administrativa</option>
                  <option value="security">Controle de Portaria / Ronda Ativa</option>
                </select>
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-[#10b981] text-white font-bold uppercase rounded hover:bg-emerald-600 transition-colors"
              >
                Salvar no Livro de Ocorrências
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
