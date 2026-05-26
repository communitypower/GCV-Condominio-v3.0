/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  Building, 
  Users, 
  Mail, 
  Phone, 
  Edit3, 
  X, 
  Wrench, 
  Check, 
  AlertCircle, 
  Plus, 
  ChevronRight, 
  Receipt,
  UserCheck,
  TrendingUp
} from 'lucide-react';
import { Unit, UnitType, UnitStatus, Billing, MaintenanceRequest } from '../types';

interface ResidencesProps {
  units: Unit[];
  billings: Billing[];
  maintenanceRequests: MaintenanceRequest[];
  onUpdateUnit: (updatedUnit: Unit) => void;
  onAddUnit: (newUnit: Unit) => void;
}

export default function Residences({
  units,
  billings,
  maintenanceRequests,
  onUpdateUnit,
  onAddUnit,
}: ResidencesProps) {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [blockFilter, setBlockFilter] = useState<string>('all');

  // Selected unit details modal/drawer state
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [unitType, setUnitType] = useState<UnitType>('apartment');
  const [unitStatus, setUnitStatus] = useState<UnitStatus>('occupied');
  const [fractionalShare, setFractionalShare] = useState(0.008);

  // Add unit state
  const [isAdding, setIsAdding] = useState(false);
  const [newId, setNewId] = useState('');
  const [newBlock, setNewBlock] = useState('Bloco A');
  const [newNumber, setNewNumber] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newType, setNewType] = useState<UnitType>('apartment');
  const [newStatus, setNewStatus] = useState<UnitStatus>('occupied');

  const openUnitDetails = (unit: Unit) => {
    setSelectedUnit(unit);
    setIsEditing(false);
    setOwnerName(unit.ownerName);
    setOwnerEmail(unit.ownerEmail);
    setOwnerPhone(unit.ownerPhone);
    setUnitType(unit.type);
    setUnitStatus(unit.status);
    setFractionalShare(unit.fractionalShare);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;

    const updated: Unit = {
      ...selectedUnit,
      ownerName,
      ownerEmail,
      ownerPhone,
      type: unitType,
      status: unitStatus,
      fractionalShare,
    };

    onUpdateUnit(updated);
    setSelectedUnit(updated);
    setIsEditing(false);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newNumber) {
      alert('Favor preencher o identificador único e o número da unidade.');
      return;
    }

    const calculatedFraction = newType === 'penthouse' ? 0.016 : newType === 'house' ? 0.024 : 0.008;

    const unitToAdd: Unit = {
      id: newId,
      block: newBlock,
      number: newNumber,
      ownerName: newOwner || 'Proprietário Não Registrado',
      ownerEmail: newEmail || 'email@indisponivel.com',
      ownerPhone: newPhone || '(11) ---- -----',
      type: newType,
      status: newStatus,
      fractionalShare: calculatedFraction,
    };

    onAddUnit(unitToAdd);
    setIsAdding(false);
    // Reset fields
    setNewId('');
    setNewNumber('');
    setNewOwner('');
    setNewEmail('');
    setNewPhone('');
  };

  // Filter lists
  const filteredUnits = units.filter(unit => {
    const matchesSearch = 
      unit.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      unit.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      unit.block.toLowerCase().includes(searchQuery.toLowerCase()) ||
      unit.number.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || unit.status === statusFilter;
    const matchesType = typeFilter === 'all' || unit.type === typeFilter;
    const matchesBlock = blockFilter === 'all' || 
      (blockFilter === 'Casas' ? unit.block.toLowerCase().includes('casa') : unit.block === blockFilter);

    return matchesSearch && matchesStatus && matchesType && matchesBlock;
  });

  // Extract unique blocks for filter dropdown
  const uniqueBlocks = ['Bloco A', 'Bloco B', 'Casas'];

  // Status mapping
  const statusLabels: Record<UnitStatus, string> = {
    occupied: 'Ocupada',
    vacant: 'Vaga/Disponível',
    maintenance: 'Manutenção',
  };

  const statusColors: Record<UnitStatus, string> = {
    occupied: 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30',
    vacant: 'bg-slate-900 text-slate-400 border-slate-800',
    maintenance: 'bg-amber-950/20 text-amber-500 border-amber-900/20',
  };

  const typeLabels: Record<UnitType, string> = {
    apartment: 'Apartamento',
    house: 'Casa Comercial/Residencial',
    penthouse: 'Cobertura',
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold text-white tracking-tight">Cadastro de Unidades Habitacionais</h2>
          <p className="text-slate-500 text-xs">Acompanhe contatos, fração ideal e status operacional das residências atualmente mapeadas.</p>
        </div>
        <button
          id="add-unit-toggle"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] hover:bg-[#b89327] text-white text-xs font-bold rounded-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          Cadastrar Unidade
        </button>
      </div>

      {/* Directory Filter Bar */}
      <div className="bg-[#14161A] rounded-xl p-4 shadow-xl border border-slate-800/40 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="unit-search-input"
            type="text"
            placeholder="Buscar por unidade, morador ou bloco..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#0F1115] border border-slate-800/60 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#D4AF37] text-white"
          />
        </div>

        {/* Filter Block */}
        <div className="relative">
          <select
            id="unit-block-filter"
            value={blockFilter}
            onChange={(e) => setBlockFilter(e.target.value)}
            className="w-full pl-3 pr-8 py-2 bg-[#0F1115] border border-slate-800/65 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#D4AF37] appearance-none text-white cursor-pointer"
          >
            <option value="all">Todos os Blocos / Setores</option>
            {uniqueBlocks.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Filter Status */}
        <div className="relative">
          <select
            id="unit-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-3 pr-8 py-2 bg-[#0F1115] border border-slate-800/65 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#D4AF37] appearance-none text-white cursor-pointer"
          >
            <option value="all">Todas as Situações</option>
            <option value="occupied">Ocupada</option>
            <option value="vacant">Vaga</option>
            <option value="maintenance">Em Manutenção</option>
          </select>
          <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Filter Type */}
        <div className="relative">
          <select
            id="unit-type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full pl-3 pr-8 py-2 bg-[#0F1115] border border-slate-800/65 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#D4AF37] appearance-none text-white cursor-pointer"
          >
            <option value="all">Todas as Tipologias</option>
            <option value="apartment">Apartamento Padrão</option>
            <option value="house">Casa Térrea/Sobrado</option>
            <option value="penthouse">Cobertura Duplex</option>
          </select>
          <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Grid displays */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredUnits.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-[#14161A] rounded-xl border border-dashed border-slate-800/60">
            <Building className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-white font-semibold text-sm">Nenhuma unidade encontrada</h3>
            <p className="text-slate-500 text-xs mt-1">Experimente ajustar os filtros ou estender a busca textual.</p>
          </div>
        ) : (
          filteredUnits.map(unit => {
            const hasOverdue = billings.some(b => b.unitId === unit.id && b.status === 'overdue');
            const hasActiveMaintenance = maintenanceRequests.some(r => r.unitId === unit.id && (r.status === 'reported' || r.status === 'in_progress'));

            return (
              <motion.div
                key={unit.id}
                layoutId={`unit-card-${unit.id}`}
                onClick={() => openUnitDetails(unit)}
                className="bg-[#14161A] rounded-2xl p-5 border border-slate-800 hover:border-[#D4AF37]/50 shadow-md hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between space-y-4 select-none"
              >
                <div className="space-y-2">
                  {/* Top line ID & Type */}
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-base text-[#D4AF37] bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
                      {unit.id}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-500 mt-1">
                      {unit.block}
                    </span>
                  </div>

                  {/* Title Owner text */}
                  <div className="min-h-[46px] pt-1">
                    <h3 className="font-semibold text-sm text-white line-clamp-1 group-hover:text-[#D4AF37] transition-colors">
                      {unit.ownerName}
                    </h3>
                    <p className="text-xs text-slate-500 capitalize mt-0.5">{typeLabels[unit.type]}</p>
                  </div>
                </div>

                {/* Tags alert triggers */}
                <div className="flex flex-wrap gap-1.5">
                  <span className={`text-[10px] font-bold border px-2 py-0.5 rounded ${statusColors[unit.status]}`}>
                    {statusLabels[unit.status]}
                  </span>
                  {hasOverdue && (
                    <span className="text-[10px] font-bold bg-red-950/20 text-red-400 border border-red-900/40 px-2 py-0.5 rounded flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-red-500" />
                      Inadimplente
                    </span>
                  )}
                  {hasActiveMaintenance && (
                    <span className="text-[10px] font-bold bg-sky-950/20 text-sky-450 border border-sky-900/30 px-2 py-0.5 rounded flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-sky-550" />
                      Obra Ativa
                    </span>
                  )}
                </div>

                {/* Footer and contact preview */}
                <div className="border-t border-slate-800/40 pt-3 flex items-center justify-between text-slate-500 text-[11px]">
                  <span>Fração ideal: {(unit.fractionalShare * 100).toFixed(3)}%</span>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-all" />
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Slide-out detail Drawer of unit / Modal popup */}
      <AnimatePresence>
        {selectedUnit && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex justify-end">
            {/* Backdrop click dismiss */}
            <div className="absolute inset-0" onClick={() => setSelectedUnit(null)} />

            {/* Content Drawer panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-[#14161A] h-full shadow-2xl flex flex-col justify-between overflow-hidden border-l border-slate-800/60 z-10"
            >
              {/* Header */}
              <div className="p-6 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800/50">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-lg bg-orange-950/20 text-[#D4AF37] border border-orange-900/30 rounded-lg px-3 py-1">
                      {selectedUnit.id}
                    </span>
                    <span className="text-xs uppercase font-bold text-slate-500 tracking-wider font-mono">{selectedUnit.block}</span>
                  </div>
                  <h3 className="font-display font-semibold text-lg mt-2 tracking-tight">
                    {isEditing ? 'Editar Informações' : selectedUnit.ownerName}
                  </h3>
                </div>
                <button
                  id="drawer-close"
                  onClick={() => setSelectedUnit(null)}
                  className="p-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all focus:outline-none"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {isEditing ? (
                  <form id="edit-unit-form" onSubmit={handleSaveEdit} className="space-y-4">
                    {/* Owner Name */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do Condôminio</label>
                      <input
                        id="edit-owner-name"
                        type="text"
                        required
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800/80 rounded-lg text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                      />
                    </div>

                    {/* Contact grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail</label>
                        <input
                          id="edit-owner-email"
                          type="email"
                          required
                          value={ownerEmail}
                          onChange={(e) => setOwnerEmail(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800/80 rounded-lg text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Telefone Celular</label>
                        <input
                          id="edit-owner-phone"
                          type="text"
                          required
                          value={ownerPhone}
                          onChange={(e) => setOwnerPhone(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800/80 rounded-lg text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                        />
                      </div>
                    </div>

                    {/* Typology and occupancy */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo de Unidade</label>
                        <select
                          id="edit-unit-type"
                          value={unitType}
                          onChange={(e) => setUnitType(e.target.value as UnitType)}
                          className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800/80 rounded-lg text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37] appearance-none cursor-pointer"
                        >
                          <option value="apartment">Apartamento</option>
                          <option value="house">Casa de Campo/Residênc.</option>
                          <option value="penthouse">Cobertura</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Situação Geral</label>
                        <select
                          id="edit-unit-status"
                          value={unitStatus}
                          onChange={(e) => setUnitStatus(e.target.value as UnitStatus)}
                          className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800/80 rounded-lg text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37] appearance-none cursor-pointer"
                        >
                          <option value="occupied">Ocupada</option>
                          <option value="vacant">Vaga</option>
                          <option value="maintenance">Em Manutenção</option>
                        </select>
                      </div>
                    </div>

                    {/* Fractional Share */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fração Ideal Condominial (Quota)</label>
                      <input
                        id="edit-fraction"
                        type="number"
                        step="0.0001"
                        required
                        value={fractionalShare}
                        onChange={(e) => setFractionalShare(parseFloat(e.target.value))}
                        className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800/80 rounded-lg text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                      />
                    </div>

                    <div className="flex gap-2 pt-4">
                      <button
                        id="save-edit-btn"
                        type="submit"
                        className="flex-1 py-2 bg-[#D4AF37] hover:bg-[#b89327] text-white font-bold text-xs rounded-lg transition-all"
                      >
                        Salvar Alterações
                      </button>
                      <button
                        id="cancel-edit-btn"
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 bg-slate-905 hover:bg-slate-800 border border-slate-850 text-slate-300 font-bold text-xs rounded-lg"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    {/* Unit Contact Detail Card */}
                    <div className="bg-[#0F1115] rounded-xl p-5 border border-slate-800/40 space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-800/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dados Cadastrais</span>
                        <button
                          id="edit-unit"
                          onClick={() => setIsEditing(true)}
                          className="text-[#D4AF37] hover:text-[#b89327] font-bold text-xs flex items-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Editar
                        </button>
                      </div>

                      <div className="space-y-2.5 text-xs text-slate-300">
                        <div className="flex items-center gap-2.5">
                          <Users className="w-4 h-4 text-slate-500" />
                          <span>Membro Proprietário: <span className="font-sans font-semibold text-white">{selectedUnit.ownerName}</span></span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <Mail className="w-4 h-4 text-slate-500" />
                          <span>E-mail: <span className="font-mono text-slate-100">{selectedUnit.ownerEmail}</span></span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <Phone className="w-4 h-4 text-slate-500" />
                          <span>Telefone: <span className="text-slate-100 font-mono">{selectedUnit.ownerPhone}</span></span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <Building className="w-4 h-4 text-slate-500" />
                          <span>Tipologia: <span className="text-slate-100 capitalize font-medium">{typeLabels[selectedUnit.type]}</span></span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <TrendingUp className="w-4 h-4 text-slate-500" />
                          <span>Fração Ideal: <span className="text-[#D4AF37] font-semibold font-mono">{(selectedUnit.fractionalShare * 100).toFixed(4)}%</span></span>
                        </div>
                      </div>
                    </div>

                    {/* Operational Summary Indicator */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-emerald-950/20 rounded-xl border border-emerald-900/40 text-center">
                        <UserCheck className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
                        <span className="text-[10px] text-emerald-500 uppercase tracking-wider font-bold">Situação Geral</span>
                        <p className="text-xs font-extrabold text-[#D4AF37] mt-0.5">{statusLabels[selectedUnit.status]}</p>
                      </div>
                      <div className="p-4 bg-[#0F1115] rounded-xl border border-slate-800/40 text-center">
                        <Receipt className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Mensalidades</span>
                        <p className="text-xs font-bold text-white mt-0.5">
                          {billings.filter(b => b.unitId === selectedUnit.id && b.status === 'paid').length} Pg / {billings.filter(b => b.unitId === selectedUnit.id && b.status !== 'paid').length} Pnd
                        </p>
                      </div>
                    </div>

                    {/* Maintenance Requests of this unit */}
                    <div className="space-y-3">
                      <h4 className="text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                        <Wrench className="w-4 h-4 text-slate-400" />
                        Histórico de Manutenções
                      </h4>

                      {maintenanceRequests.filter(r => r.unitId === selectedUnit.id).length === 0 ? (
                        <p className="text-xs text-slate-500 bg-[#0F1115] border border-slate-800/40 p-4 rounded-lg text-center font-sans">Esta unidade não possui chamados de manutenção associados.</p>
                      ) : (
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                          {maintenanceRequests.filter(r => r.unitId === selectedUnit.id).map(req => {
                            const isUrgent = req.priority === 'urgent' || req.priority === 'high';
                            return (
                              <div key={req.id} className="p-3 bg-[#0F1115] border border-slate-800/40 rounded-lg flex justify-between items-center text-xs">
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-slate-300">{req.title}</span>
                                  <div className="flex gap-2 text-[10px] text-slate-500">
                                    <span className="font-mono">{req.id}</span>
                                    <span>•</span>
                                    <span>{new Date(req.reportedAt).toLocaleDateString('pt-BR')}</span>
                                  </div>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                                  req.status === 'resolved' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30' :
                                  isUrgent ? 'bg-red-950/25 text-red-400 border-red-900/30 animate-pulse' : 'bg-slate-900 text-slate-400 border-slate-800'
                                }`}>
                                  {req.status === 'resolved' ? 'Res.' : req.status === 'in_progress' ? 'Ativo' : 'Aberto'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Billing accounts history of this unit */}
                    <div className="space-y-3">
                      <h4 className="text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-slate-400" />
                        Histórico de Boletos Condominiais
                      </h4>

                      {billings.filter(b => b.unitId === selectedUnit.id).length === 0 ? (
                        <p className="text-xs text-slate-500 bg-[#0F1115] border border-slate-800/40 p-4 rounded-lg text-center font-sans">Esta unidade não possui boletos cadastrados.</p>
                      ) : (
                        <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                          {billings.filter(b => b.unitId === selectedUnit.id).map(bil => (
                            <div key={bil.id} className="p-3 bg-[#0F1115] border border-slate-800/40 rounded-lg flex justify-between items-center text-xs">
                              <div className="space-y-0.5">
                                <span className="font-medium text-slate-400">Competência {bil.monthString}</span>
                                <p className="font-bold text-white font-mono">{formatCurrency(bil.amount)}</p>
                              </div>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                                bil.status === 'paid' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/20' : 
                                bil.status === 'overdue' ? 'bg-red-950/20 text-red-400 border-red-900/20 animate-pulse' : 'bg-amber-950/20 text-[#D4AF37] border-amber-900/20'
                              }`}>
                                {bil.status === 'paid' ? 'Pago' : bil.status === 'overdue' ? 'Atrasado' : 'A vencer'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              {!isEditing && (
                <div className="p-5 border-t border-slate-800/40 bg-slate-950/40 flex gap-2">
                  <button
                    id="mark-occupied-btn"
                    onClick={() => {
                      onUpdateUnit({ ...selectedUnit, status: 'occupied' });
                      setSelectedUnit({ ...selectedUnit, status: 'occupied' });
                    }}
                    disabled={selectedUnit.status === 'occupied'}
                    className="flex-1 py-1.5 px-3 bg-[#0F1115] border border-slate-800 hover:border-[#D4AF37]/50 hover:bg-slate-900 text-xs text-slate-300 font-bold rounded-lg transition-all disabled:opacity-40"
                  >
                    Marcar Ocupada
                  </button>
                  <button
                    id="mark-vacant-btn"
                    onClick={() => {
                      onUpdateUnit({ ...selectedUnit, status: 'vacant' });
                      setSelectedUnit({ ...selectedUnit, status: 'vacant' });
                    }}
                    disabled={selectedUnit.status === 'vacant'}
                    className="flex-1 py-1.5 px-3 bg-[#0F1115] border border-slate-800 hover:border-[#D4AF37]/50 hover:bg-slate-900 text-xs text-slate-300 font-bold rounded-lg transition-all disabled:opacity-40"
                  >
                    Marcar Vaga
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add unit Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#14161A] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-800"
            >
              {/* Add Unit Header */}
              <div className="p-5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800/60">
                <div>
                  <h3 className="font-display font-semibold text-lg text-[#D4AF37]">Cadastrar Nova Unidade</h3>
                  <p className="text-xs text-slate-550 mt-0.5">Adicione uma nova unidade imobiliária ao cadastro ativo.</p>
                </div>
                <button
                  id="add-unit-close"
                  onClick={() => setIsAdding(false)}
                  className="p-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Add Unit Form Body */}
              <form id="add-unit-form-sub" onSubmit={handleAddSubmit} className="p-6 space-y-4">
                {/* ID & block & number */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cód. Unidade</label>
                    <input
                      id="new-unit-id"
                      type="text"
                      required
                      placeholder="Ex: A-404"
                      value={newId}
                      onChange={(e) => setNewId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bloco / Setor</label>
                    <select
                      id="new-unit-block"
                      value={newBlock}
                      onChange={(e) => setNewBlock(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37] appearance-none cursor-pointer"
                    >
                      <option value="Bloco A">Bloco A</option>
                      <option value="Bloco B">Bloco B</option>
                      <option value="Casas">Setor Casas</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nº Unidade</label>
                    <input
                      id="new-unit-nr"
                      type="text"
                      required
                      placeholder="Ex: 404"
                      value={newNumber}
                      onChange={(e) => setNewNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Owner details */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do Proprietário / Responsável</label>
                  <input
                    id="new-unit-owner"
                    type="text"
                    placeholder="Ex: João da Silva Santos"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail</label>
                    <input
                      id="new-unit-email"
                      type="email"
                      placeholder="Ex: joao@email.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Telefone</label>
                    <input
                      id="new-unit-phone"
                      type="text"
                      placeholder="Ex: (11) 99999-9999"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Type and status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo de Imóvel</label>
                    <select
                      id="new-unit-type"
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as UnitType)}
                      className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37] appearance-none cursor-pointer"
                    >
                      <option value="apartment">Apartamento</option>
                      <option value="house">Casa Térrea / Sobrado</option>
                      <option value="penthouse">Cobertura Duplex</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Situação Inicial</label>
                    <select
                      id="new-unit-status"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as UnitStatus)}
                      className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37] appearance-none cursor-pointer"
                    >
                      <option value="occupied">Ocupada</option>
                      <option value="vacant">Vaga</option>
                      <option value="maintenance">Em Manutenção</option>
                    </select>
                  </div>
                </div>

                {/* Submit button bar */}
                <div className="flex gap-2.5 pt-4">
                  <button
                    id="submit-new-unit"
                    type="submit"
                    className="flex-1 py-2 bg-[#D4AF37] hover:bg-[#b89327] text-white font-extrabold text-xs rounded-lg transition-all"
                  >
                    Salvar Cadastro
                  </button>
                  <button
                    id="cancel-new-unit"
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 bg-slate-905 hover:bg-slate-800 border border-slate-850 text-slate-300 font-bold text-xs rounded-lg"
                  >
                    Voltar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
