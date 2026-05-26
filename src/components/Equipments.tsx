import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Wrench, 
  Search, 
  Plus, 
  Filter, 
  ShieldCheck, 
  AlertTriangle, 
  FileEdit,
  Activity,
  Calendar
} from 'lucide-react';
import { Equipment } from '../types';

interface EquipmentsProps {
  equipments: Equipment[];
  onAddEquipment: (newEq: Equipment) => void;
  onUpdateEquipment: (updatedEq: Equipment) => void;
}

export default function Equipments({
  equipments,
  onAddEquipment,
  onUpdateEquipment
}: EquipmentsProps) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'operational' | 'alert' | 'critical' | 'maintenance'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEqForEdit, setSelectedEqForEdit] = useState<Equipment | null>(null);

  // New Equipment Form State
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newCategory, setNewCategory] = useState('Hidráulica');
  const [newStatus, setNewStatus] = useState<'operational' | 'alert' | 'critical' | 'maintenance'>('operational');
  const [newInstallDate, setNewInstallDate] = useState('2024-01-10');

  // Categories extracted dynamically from initial list
  const categories = Array.from(new Set(equipments.map(e => e.category)));

  // Filtered List
  const filtered = equipments.filter(eq => {
    const matchesSearch = eq.name.toLowerCase().includes(search.toLowerCase()) || 
                          eq.location.toLowerCase().includes(search.toLowerCase()) ||
                          eq.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || eq.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || eq.category === filterCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getStatusBadge = (status: Equipment['status']) => {
    switch(status) {
      case 'operational':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/25">✔ Operacional</span>;
      case 'alert':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/25">⚠ Alerta</span>;
      case 'critical':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/25">☠ Crítico</span>;
      case 'maintenance':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/25">⚙ Em Manutenção</span>;
    }
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newLocation.trim()) {
      alert('Favor preencher todos os campos.');
      return;
    }
    const newEq: Equipment = {
      id: `EQP-${String(equipments.length + 1).padStart(2, '0')}`,
      name: newName,
      location: newLocation,
      category: newCategory,
      status: newStatus,
      lastInspection: new Date().toISOString().split('T')[0],
      nextInspection: new Date(Date.now() + 60*24*60*60*1000).toISOString().split('T')[0], // 60 days in future
      installDate: newInstallDate
    };
    onAddEquipment(newEq);
    setShowAddForm(false);
    setNewName('');
    setNewLocation('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEqForEdit) {
      onUpdateEquipment(selectedEqForEdit);
      setSelectedEqForEdit(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
            <span className="text-[#10b981]"><Wrench className="w-8 h-8" /></span>
            Inventário de Equipamentos
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Gestão, inspeções e ciclos operacionais dos ativos prediais ativos</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#10b981] hover:bg-[#009267] text-white font-semibold text-xs rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Cadastrar Equipamento
        </button>
      </div>

      {/* Stats Counter Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#14161b] rounded-xl p-4 border border-zinc-850/60 text-center">
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Ativos Cadastrados</p>
          <p className="text-2xl font-bold text-white mt-1">{equipments.length}</p>
        </div>
        <div className="bg-[#14161b] rounded-xl p-4 border border-zinc-850/60 text-center border-l-2 border-l-[#10b981]">
          <p className="text-[10px] text-[#10b981] font-bold uppercase tracking-wider">Operacionais</p>
          <p className="text-2xl font-bold text-white mt-1">{equipments.filter(e => e.status === 'operational').length}</p>
        </div>
        <div className="bg-[#14161b] rounded-xl p-4 border border-zinc-850/60 text-center border-l-2 border-l-orange-500">
          <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">Alertas</p>
          <p className="text-2xl font-bold text-white mt-1">{equipments.filter(e => e.status === 'alert').length}</p>
        </div>
        <div className="bg-[#14161b] rounded-xl p-4 border border-zinc-850/60 text-center border-l-2 border-l-red-500">
          <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Críticos</p>
          <p className="text-2xl font-bold text-white mt-1">{equipments.filter(e => e.status === 'critical').length}</p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-[#14161b] rounded-xl p-4 border border-zinc-800 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 relative">
          <span className="absolute left-3.5 top-3.5 text-zinc-500"><Search className="w-4 h-4" /></span>
          <input
            type="text"
            placeholder="Pesquisar por equipamento pelo nome, localização ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0d0e12] border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-[#10b981] transition-all"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Status Select */}
          <div className="flex items-center gap-1.5 bg-[#0d0e12] border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={filterStatus}
              onChange={(e: any) => setFilterStatus(e.target.value)}
              className="bg-transparent text-white border-none py-0.5 focus:ring-0 cursor-pointer"
            >
              <option value="all">Filtro de Status</option>
              <option value="operational">✔ Operacional</option>
              <option value="alert">⚠ Alerta</option>
              <option value="critical">☠ Crítico</option>
              <option value="maintenance">⚙ Em Manutenção</option>
            </select>
          </div>

          {/* Category Select */}
          <div className="flex items-center gap-1.5 bg-[#0d0e12] border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs">
            <Activity className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-transparent text-white border-none py-0.5 focus:ring-0 cursor-pointer"
            >
              <option value="all">Filtro de Categoria</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(eq => (
          <div 
            key={eq.id}
            className="bg-[#14161b] rounded-xl p-5 border border-zinc-800/80 hover:border-zinc-700 hover:shadow-lg transition-all flex flex-col justify-between space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md">{eq.id}</span>
                <h3 className="font-bold text-base text-white mt-1.5 leading-snug">{eq.name}</h3>
                <p className="text-zinc-500 text-xs mt-0.5">{eq.location}</p>
              </div>
              <div>
                {getStatusBadge(eq.status)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-850/50 text-[11px] text-zinc-400">
              <div>
                <span className="text-zinc-500 block">Categoria</span>
                <span className="font-semibold text-zinc-350">{eq.category}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Instalação</span>
                <span className="font-semibold text-zinc-350">{new Date(eq.installDate).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="mt-1">
                <span className="text-zinc-500 block">Última Inspeção</span>
                <span className="font-semibold text-zinc-350">{new Date(eq.lastInspection).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="mt-1">
                <span className="text-zinc-500 block">Próxima Inspeção</span>
                <span className="font-semibold text-zinc-350 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#10b981]" />
                  {new Date(eq.nextInspection).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedEqForEdit(eq)}
                className="text-zinc-400 hover:text-[#10b981] text-xs font-semibold flex items-center gap-1"
              >
                <FileEdit className="w-3.5 h-3.5" />
                Editar Parâmetros
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center bg-[#14161b] rounded-xl border border-zinc-800 text-zinc-500">
            Nenhum equipamento localizado sob os filtros estabelecidos.
          </div>
        )}
      </div>

      {/* Modal: Cadastrar novo Equipamento */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#14161b] rounded-xl border border-zinc-800 p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#10b981]" />
                Registrar Novo Ativo Predial
              </h3>
              <button 
                onClick={() => setShowAddForm(false)}
                className="text-zinc-500 hover:text-white text-xs font-mono border border-zinc-800 px-2 py-1 rounded"
              >
                fechar [x]
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-zinc-400 block">Nome do Ativo / Equipamento</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder="EX: Pressurizador de Ar Reforçado Solar" 
                  className="w-full bg-[#0d0e12] border border-zinc-800 text-white rounded p-2.5 focus:outline-none focus:border-[#10b981]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Localização Detalhada</label>
                <input 
                  type="text" 
                  value={newLocation} 
                  onChange={(e) => setNewLocation(e.target.value)} 
                  placeholder="EX: Casa de Máquinas - Torre A - Subsolo 2" 
                  className="w-full bg-[#0d0e12] border border-zinc-800 text-white rounded p-2.5 focus:outline-none focus:border-[#10b981]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Categoria</label>
                  <select 
                    value={newCategory} 
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full p-2.5"
                  >
                    <option value="Hidráulica">Hidráulica</option>
                    <option value="Elétrica / Cabine">Elétrica / Cabine</option>
                    <option value="Alternadores">Alternadores</option>
                    <option value="Ventilação">Ventilação</option>
                    <option value="Transporte">Transporte</option>
                    <option value="Segurança">Segurança</option>
                    <option value="Serralheria IP">Serralheria IP</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 block">Status Operacional</label>
                  <select 
                    value={newStatus} 
                    onChange={(e: any) => setNewStatus(e.target.value)}
                    className="w-full p-2.5"
                  >
                    <option value="operational">✔ Operacional</option>
                    <option value="alert">⚠ Alerta</option>
                    <option value="critical">☠ Crítico</option>
                    <option value="maintenance">⚙ Em Manutenção</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Data de Instalação</label>
                <input 
                  type="date" 
                  value={newInstallDate} 
                  onChange={(e) => setNewInstallDate(e.target.value)} 
                  className="w-full bg-[#0d0e12] border border-zinc-800 text-white rounded p-2 focus:outline-none"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-[#10b981] hover:bg-[#009267] text-white rounded font-bold transition-all text-xs"
              >
                Concluir Cadastro e Ativação
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Equipamento Selecionado */}
      {selectedEqForEdit && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#14161b] rounded-xl border border-zinc-800 p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
              <h3 className="text-lg font-bold text-white">
                Editar Equipamento {selectedEqForEdit.id}
              </h3>
              <button 
                onClick={() => setSelectedEqForEdit(null)}
                className="text-zinc-500 hover:text-white font-mono text-sm"
              >
                [fechar]
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-zinc-400 block">Nome do Ativo</label>
                <input 
                  type="text" 
                  value={selectedEqForEdit.name} 
                  onChange={(e) => setSelectedEqForEdit({...selectedEqForEdit, name: e.target.value})} 
                  className="w-full bg-[#0d0e12] border border-zinc-800 text-white rounded p-2.5"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Localização</label>
                <input 
                  type="text" 
                  value={selectedEqForEdit.location} 
                  onChange={(e) => setSelectedEqForEdit({...selectedEqForEdit, location: e.target.value})} 
                  className="w-full bg-[#0d0e12] border border-zinc-800 text-white rounded p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Status Operacional</label>
                  <select 
                    value={selectedEqForEdit.status} 
                    onChange={(e: any) => setSelectedEqForEdit({...selectedEqForEdit, status: e.target.value})}
                    className="w-full p-2.5"
                  >
                    <option value="operational">✔ Operacional</option>
                    <option value="alert">⚠ Alerta</option>
                    <option value="critical">☠ Crítico</option>
                    <option value="maintenance">⚙ Em Manutenção</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 block">Categoria</label>
                  <input 
                    type="text" 
                    value={selectedEqForEdit.category} 
                    onChange={(e) => setSelectedEqForEdit({...selectedEqForEdit, category: e.target.value})} 
                    className="w-full bg-[#0d0e12] border border-zinc-800 text-white rounded p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Última Inspeção</label>
                  <input 
                    type="date" 
                    value={selectedEqForEdit.lastInspection} 
                    onChange={(e) => setSelectedEqForEdit({...selectedEqForEdit, lastInspection: e.target.value})} 
                    className="w-full bg-[#0d0e12] border border-zinc-800 text-white rounded p-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Próxima Inspeção</label>
                  <input 
                    type="date" 
                    value={selectedEqForEdit.nextInspection} 
                    onChange={(e) => setSelectedEqForEdit({...selectedEqForEdit, nextInspection: e.target.value})} 
                    className="w-full bg-[#0d0e12] border border-zinc-800 text-white rounded p-2"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-[#10b981] hover:bg-[#009267] text-white rounded font-bold transition-all"
              >
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
