import React, { useState } from 'react';
import { FolderOpen, FileText, Search, Download, Eye } from 'lucide-react';

export default function Documentation() {
  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState<'all' | 'legal' | 'tech' | 'minutes'>('all');

  const docs = [
    { title: 'Regimento Interno Condominial', size: '2.4 MB', folder: 'legal', date: '2025-01-10' },
    { title: 'Ata de Assembleia Geral Extraordinária', size: '1.2 MB', folder: 'minutes', date: '2026-03-15' },
    { title: 'Convenção Geral de Constituição', size: '4.8 MB', folder: 'legal', date: '2020-05-15' },
    { title: 'Manual Técnico de Operação Gerador Cabinas', size: '10.5 MB', folder: 'tech', date: '2019-12-01' },
    { title: 'Planta Elétrica Unifilar - Revit BIM', size: '24.2 MB', folder: 'tech', date: '2020-03-30' },
    { title: 'Ata de Eleição do Corpo Diretivo', size: '0.9 MB', folder: 'minutes', date: '2026-04-10' },
    { title: 'Regulamentos de Uso do Salão de Festas', size: '1.1 MB', folder: 'legal', date: '2023-08-20' },
    { title: 'Manual de Hidráulica e Barramentos Técnicos', size: '6.7 MB', folder: 'tech', date: '2021-08-10' }
  ];

  const filtered = docs.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase());
    const matchesFolder = activeFolder === 'all' || d.folder === activeFolder;
    return matchesSearch && matchesFolder;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
          <span className="text-[#10b981]"><FolderOpen className="w-8 h-8" /></span>
          Biblioteca Digital de Documentação
        </h1>
        <p className="text-zinc-400 text-sm mt-1">Biblioteca centralizado de atas oficiais, regimentos internos, plantas e manuais técnicos prediais</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar inside Document tab */}
        <div className="bg-[#14161b] rounded-xl p-5 border border-zinc-800 space-y-3 h-fit">
          <span className="text-xs uppercase font-bold tracking-wider text-zinc-500 block mb-2">Pastas de Arquivos</span>
          <button 
            onClick={() => setActiveFolder('all')}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold block transition-colors ${activeFolder === 'all' ? 'bg-[#10b981] text-white' : 'text-zinc-350 hover:bg-zinc-800'}`}
          >
            📂 Todos os Documentos ({docs.length})
          </button>
          <button 
            onClick={() => setActiveFolder('legal')}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold block transition-colors ${activeFolder === 'legal' ? 'bg-[#10b981] text-white' : 'text-zinc-350 hover:bg-zinc-800'}`}
          >
            📜 Regimentos & Leis ({docs.filter(d => d.folder === 'legal').length})
          </button>
          <button 
            onClick={() => setActiveFolder('tech')}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold block transition-colors ${activeFolder === 'tech' ? 'bg-[#10b981] text-white' : 'text-zinc-350 hover:bg-zinc-800'}`}
          >
            📐 Plantas e Manuais Técnicos ({docs.filter(d => d.folder === 'tech').length})
          </button>
          <button 
            onClick={() => setActiveFolder('minutes')}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold block transition-colors ${activeFolder === 'minutes' ? 'bg-[#10b981] text-white' : 'text-zinc-350 hover:bg-zinc-800'}`}
          >
            📋 Atas de Reunião ({docs.filter(d => d.folder === 'minutes').length})
          </button>
        </div>

        {/* Document search and list body */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 text-zinc-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Pesquisar documentos por nome ou assunto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#14161b] border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-[#10b981]"
            />
          </div>

          <div className="bg-[#14161b] rounded-xl border border-zinc-800 overflow-hidden">
            <div className="divide-y divide-zinc-850">
              {filtered.map((d, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between hover:bg-zinc-850/30 transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0 pr-4">
                    <div className="w-10 h-10 rounded-lg bg-[#0d0e12] border border-zinc-800 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-white truncate">{d.title}</h3>
                      <div className="flex gap-3 text-[10px] text-zinc-500 font-mono mt-0.5">
                        <span>Tamanho: {d.size}</span>
                        <span>•</span>
                        <span>Upload: {new Date(d.date).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => alert(`Visualizando simulação do arquivo: ${d.title}`)}
                      className="p-1 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs font-semibold transition-all flex items-center gap-1 shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ler
                    </button>
                    <button 
                      onClick={() => alert(`Backup iniciado! Efetuando download de ${d.title} (${d.size})`)}
                      className="p-1.5 bg-[#10b981] hover:bg-emerald-600 text-white rounded transition-all shrink-0"
                      title="Download do arquivo"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="p-8 text-center text-zinc-500">
                  Nenhum arquivo encontrado sob os filtros.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
