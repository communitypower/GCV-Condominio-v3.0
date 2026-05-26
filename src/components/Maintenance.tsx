/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wrench, 
  Search, 
  Filter, 
  Plus, 
  Clock, 
  Play, 
  CheckCircle, 
  X, 
  MessageSquare, 
  Send,
  Calendar,
  Tag,
  KanbanSquare,
  List
} from 'lucide-react';
import { Unit, MaintenanceRequest, MaintenanceStatus, MaintenancePriority, MaintenanceCategory, MaintenanceLog } from '../types';

interface MaintenanceProps {
  units: Unit[];
  requests: MaintenanceRequest[];
  onAddRequest: (newReq: MaintenanceRequest) => void;
  onUpdateRequest: (updatedReq: MaintenanceRequest) => void;
}

export default function Maintenance({
  units,
  requests,
  onAddRequest,
  onUpdateRequest,
}: MaintenanceProps) {
  // Views toggle: board vs list
  const [viewType, setViewType] = useState<'board' | 'list'>('board');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Modal detail states
  const [selectedReq, setSelectedReq] = useState<MaintenanceRequest | null>(null);

  // New ticket state
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUnitId, setNewUnitId] = useState('COMMON');
  const [newPriority, setNewPriority] = useState<MaintenancePriority>('medium');
  const [newCategory, setNewCategory] = useState<MaintenanceCategory>('common_area');
  const [newDesc, setNewDesc] = useState('');
  const [newStaff, setNewStaff] = useState('');
  const [newEstimatedCost, setNewEstimatedCost] = useState('');

  // Ticket logs comment input
  const [newComment, setNewComment] = useState('');

  // Ticket status update fields (visible in modal)
  const [editingStaff, setEditingStaff] = useState('');
  const [editingEstCost, setEditingEstCost] = useState('');
  const [editingActCost, setEditingActCost] = useState('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleOpenTicket = (req: MaintenanceRequest) => {
    setSelectedReq(req);
    setNewComment('');
    setEditingStaff(req.assignedStaff || '');
    setEditingEstCost(req.estimatedCost?.toString() || '');
    setEditingActCost(req.actualCost?.toString() || '');
  };

  // Submit new administrative comment log
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedReq) return;

    const log: MaintenanceLog = {
      id: `log-${Date.now()}`,
      author: 'Cláudio (Síndico)',
      comment: newComment.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated: MaintenanceRequest = {
      ...selectedReq,
      logs: [...selectedReq.logs, log],
    };

    onUpdateRequest(updated);
    setSelectedReq(updated);
    setNewComment('');
  };

  // Save quick ticket status
  const handleUpdateTicketDetails = (statusChange: MaintenanceStatus | null = null) => {
    if (!selectedReq) return;

    const currentStatus = statusChange || selectedReq.status;
    let resolvedDate = selectedReq.resolvedAt;

    if (statusChange === 'resolved') {
      resolvedDate = new Date().toISOString();
    } else if (statusChange) {
      resolvedDate = undefined;
    }

    const updated: MaintenanceRequest = {
      ...selectedReq,
      status: currentStatus,
      resolvedAt: resolvedDate,
      assignedStaff: editingStaff.trim() || undefined,
      estimatedCost: editingEstCost ? parseFloat(editingEstCost) : undefined,
      actualCost: editingActCost ? parseFloat(editingActCost) : undefined,
    };

    onUpdateRequest(updated);
    setSelectedReq(updated);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Favor preencher o título do chamado.');
      return;
    }

    const newTicket: MaintenanceRequest = {
      id: `MNT-${Math.floor(100 + Math.random() * 900)}`,
      unitId: newUnitId,
      title: newTitle.trim(),
      description: newDesc.trim(),
      category: newCategory,
      priority: newPriority,
      status: 'reported',
      reportedAt: new Date().toISOString(),
      assignedStaff: newStaff.trim() || undefined,
      estimatedCost: newEstimatedCost ? parseFloat(newEstimatedCost) : undefined,
      logs: [
        {
          id: `log-init`,
          author: 'Sistemas GCV',
          comment: `Chamado registrado por Cláudio (Síndico). Alvo: ${newUnitId === 'COMMON' ? 'Área Comum' : `Unidade ${newUnitId}`}`,
          createdAt: new Date().toISOString(),
        }
      ]
    };

    onAddRequest(newTicket);
    setIsAdding(false);

    // Reset values
    setNewTitle('');
    setNewUnitId('COMMON');
    setNewCategory('common_area');
    setNewPriority('medium');
    setNewDesc('');
    setNewStaff('');
    setNewEstimatedCost('');
  };

  // Setup lists filtering
  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      req.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
      req.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.unitId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;
    const matchesPriority = priorityFilter === 'all' || req.priority === priorityFilter;

    return matchesSearch && matchesCategory && matchesPriority;
  });

  // Local maps
  const priorityLabels: Record<MaintenancePriority, string> = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
    urgent: 'Urgente/Crítica'
  };

  const priorityColors: Record<MaintenancePriority, string> = {
    low: 'bg-slate-900 text-slate-400 border-slate-800',
    medium: 'bg-sky-955/20 text-sky-400 border-sky-900/30',
    high: 'bg-amber-955/15 text-[#D4AF37] border-amber-950/25',
    urgent: 'bg-red-950/20 text-red-400 border-red-900/40 animate-pulse'
  };

  const categoryLabels: Record<MaintenanceCategory, string> = {
    plumbing: 'Encanador / Hidráulica',
    electrical: 'Elétrica / Iluminação',
    elevators: 'Elevadores prediais',
    common_area: 'Área comum / Alvenaria',
    security: 'Segurança / CFTV',
    gardens: 'Zeladoria / Jardinagem',
    structural: 'Engenharia Estrutural',
    other: 'Outros serviços'
  };

  const statusLabels: Record<MaintenanceStatus, string> = {
    reported: 'Aberto/Triagem',
    in_progress: 'Em Andamento',
    resolved: 'Resolvido/Concluído',
    cancelled: 'Cancelado'
  };

  // Split into Kanban columns
  const getColTickets = (status: MaintenanceStatus) => {
    return filteredRequests.filter(req => req.status === status);
  };

  return (
    <div className="space-y-6">
      {/* Title Header with Board Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold text-white tracking-tight">Posto de Manutenção Predial</h2>
          <p className="text-slate-500 text-xs">Abertura e controle de ordens de serviço, manutenções em áreas comuns e reparos técnicos.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Toggler Tabs */}
          <div className="inline-flex rounded-lg border border-slate-800 p-1 bg-[#14161A] text-xs font-semibold">
            <button
              id="view-toggle-board"
              onClick={() => setViewType('board')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${viewType === 'board' ? 'bg-slate-950 text-white border border-slate-800 shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <KanbanSquare className="w-3.5 h-3.5" />
              Ver Kanban
            </button>
            <button
              id="view-toggle-list"
              onClick={() => setViewType('list')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${viewType === 'list' ? 'bg-slate-950 text-white border border-slate-800 shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <List className="w-3.5 h-3.5" />
              Ver Lista
            </button>
          </div>

          <button
            id="register-ticket-toggle"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] hover:bg-[#b89327] text-white text-xs font-extrabold rounded-lg transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Abrir Chamado
          </button>
        </div>
      </div>

      {/* Directory Filter Panel */}
      <div className="bg-[#14161A] rounded-xl p-4 shadow-xl border border-slate-800/60 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="ticket-search-input"
            type="text"
            placeholder="Buscar chamados por ID, título ou unidade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          />
        </div>

        {/* Category */}
        <div className="relative">
          <select
            id="ticket-cat-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full pl-3 pr-8 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-xs font-medium text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[#D4AF37] cursor-pointer"
          >
            <option value="all">Todas as Áreas / Especialidades</option>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Priority */}
        <div className="relative">
          <select
            id="ticket-priority-filter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full pl-3 pr-8 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-xs font-medium text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[#D4AF37] cursor-pointer"
          >
            <option value="all">Todas as Prioridades</option>
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
            <option value="urgent">Crítica/Urgente</option>
          </select>
          <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Main Boards / Lists containers */}
      {viewType === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Aberto */}
          <div className="bg-[#14161A] rounded-xl p-4 border border-slate-800/60 flex flex-col space-y-4 shadow-xl">
            <div className="flex justify-between items-center text-xs border-b border-slate-800/60 pb-2 text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5 font-display text-sm">
                <Clock className="w-4 h-4 text-slate-500" />
                Aberto / Triagem ({getColTickets('reported').length})
              </span>
            </div>
            <div className="space-y-3 min-h-[350px] overflow-y-auto max-h-[500px] pr-1">
              {getColTickets('reported').map(req => (
                <div key={req.id}>
                  <KanbanCard req={req} onClick={() => handleOpenTicket(req)} labels={categoryLabels} labelsPri={priorityLabels} colorsPri={priorityColors} />
                </div>
              ))}
              {getColTickets('reported').length === 0 && (
                <p className="text-slate-500 text-[11px] text-center pt-8">Sem chamados novos em espera.</p>
              )}
            </div>
          </div>

          {/* Column 2: Em Andamento */}
          <div className="bg-[#14161A] rounded-xl p-4 border border-slate-800/60 flex flex-col space-y-4 shadow-xl">
            <div className="flex justify-between items-center text-xs border-b border-slate-800/60 pb-2">
              <span className="font-semibold text-sky-400 flex items-center gap-1.5 font-display text-sm">
                <Play className="w-4 h-4 text-sky-400 animate-pulse" />
                Em Execução ({getColTickets('in_progress').length})
              </span>
            </div>
            <div className="space-y-3 min-h-[350px] overflow-y-auto max-h-[500px] pr-1">
              {getColTickets('in_progress').map(req => (
                <div key={req.id}>
                  <KanbanCard req={req} onClick={() => handleOpenTicket(req)} labels={categoryLabels} labelsPri={priorityLabels} colorsPri={priorityColors} />
                </div>
              ))}
              {getColTickets('in_progress').length === 0 && (
                <p className="text-slate-500 text-[11px] text-center pt-8">Nenhum reparo ativo estrutural.</p>
              )}
            </div>
          </div>

          {/* Column 3: Resolvido */}
          <div className="bg-[#14161A] rounded-xl p-4 border border-slate-800/60 flex flex-col space-y-4 shadow-xl">
            <div className="flex justify-between items-center text-xs border-b border-slate-800/60 pb-2">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5 font-display text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Concluídos ({getColTickets('resolved').length})
              </span>
            </div>
            <div className="space-y-3 min-h-[350px] overflow-y-auto max-h-[500px] pr-1">
              {getColTickets('resolved').map(req => (
                <div key={req.id}>
                  <KanbanCard req={req} onClick={() => handleOpenTicket(req)} labels={categoryLabels} labelsPri={priorityLabels} colorsPri={priorityColors} />
                </div>
              ))}
              {getColTickets('resolved').length === 0 && (
                <p className="text-slate-500 text-[11px] text-center pt-8">Nenhuma manutenção encerrada recentemente.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Tabular list layout */
        <div className="bg-[#14161A] rounded-xl border border-slate-800/60 overflow-hidden shadow-xl">
          {filteredRequests.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500 font-medium">Nenhum chamado listado nesses filtros.</p>
          ) : (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left font-medium">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                    <th className="p-4">Identificação</th>
                    <th className="p-4">Alvo</th>
                    <th className="p-4">Área / Categoria</th>
                    <th className="p-4">Título do Chamado</th>
                    <th className="p-4">Prioridade</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Custo Efetivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300">
                  {filteredRequests.map(req => (
                    <tr 
                      key={req.id} 
                      onClick={() => handleOpenTicket(req)}
                      className="hover:bg-slate-900/30 cursor-pointer transition-colors"
                    >
                      <td className="p-4 font-mono font-bold text-[#D4AF37]">{req.id}</td>
                      <td className="p-4">
                        <span className="bg-[#0F1115] border border-slate-800 px-2 py-0.5 rounded font-mono font-bold text-slate-300">
                          {req.unitId === 'COMMON' ? 'Geral' : req.unitId}
                        </span>
                      </td>
                      <td className="p-4 truncate max-w-[150px] text-slate-400">{categoryLabels[req.category]}</td>
                      <td className="p-4 font-sans font-semibold text-white truncate max-w-[200px]">{req.title}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${priorityColors[req.priority]}`}>
                          {priorityLabels[req.priority]}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold uppercase ${
                          req.status === 'resolved' ? 'text-emerald-400' :
                          req.status === 'in_progress' ? 'text-sky-400' : 'text-slate-500'
                        }`}>
                          {statusLabels[req.status]}
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-white font-mono">
                        {req.actualCost ? formatCurrency(req.actualCost) : req.estimatedCost ? `Est. ${formatCurrency(req.estimatedCost)}` : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Detail with Log Commentary overlay Modal */}
      <AnimatePresence>
        {selectedReq && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-[#14161A] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-800 flex flex-col max-h-[90vh]"
            >
              {/* Overlay Modal Header */}
              <div className="p-5 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono bg-slate-900 text-[#D4AF37] border border-slate-800 px-2 py-0.5 rounded text-xs font-bold">
                      {selectedReq.id}
                    </span>
                    <span className="text-xs text-slate-500 uppercase font-semibold">
                      {selectedReq.unitId === 'COMMON' ? 'Área Comum Predial' : `Imóvel: Unidade ${selectedReq.unitId}`}
                    </span>
                  </div>
                  <h3 className="font-display font-semibold text-[#D4AF37] text-base mt-2 tracking-tight">{selectedReq.title}</h3>
                </div>
                <button
                  id="ticket-modal-close"
                  onClick={() => setSelectedReq(null)}
                  className="p-1.5 rounded bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form and Timeline comments body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300">
                {/* Description Text */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Histórico da Ocorrência</span>
                  <p className="text-xs text-slate-300 bg-[#0F1115] p-3 rounded-lg border border-slate-800/80 leading-relaxed">
                    {selectedReq.description}
                  </p>
                </div>

                {/* Info and state grid */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-4">
                    {/* Category Label */}
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-slate-500 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 block font-semibold">Especialidade</span>
                        <span className="font-bold text-white">{categoryLabels[selectedReq.category]}</span>
                      </div>
                    </div>

                    {/* Reported At */}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 block font-semibold">Reportado em</span>
                        <span className="font-bold text-white font-mono">{new Date(selectedReq.reportedAt).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>

                    {/* Staff Input */}
                    <div>
                      <label className="text-[10px] font-semibold text-slate-450 block mb-1">Empresa / Executor</label>
                      <input
                        id="modal-staff-input"
                        type="text"
                        value={editingStaff}
                        onChange={(e) => setEditingStaff(e.target.value)}
                        placeholder="Ex: Pedro Eletricista"
                        className="w-full px-3 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                        onBlur={() => handleUpdateTicketDetails()}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Status Select Indicator */}
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-slate-500 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 block font-semibold">Situação do Chamado</span>
                        <select
                          id="modal-status-select"
                          value={selectedReq.status}
                          onChange={(e) => handleUpdateTicketDetails(e.target.value as MaintenanceStatus)}
                          className="font-bold text-white bg-[#0F1115] border border-slate-800 rounded px-2 py-0.5 focus:outline-none cursor-pointer text-xs"
                        >
                          <option value="reported">Aberto / Triagem</option>
                          <option value="in_progress">Em Andamento</option>
                          <option value="resolved">Resolvido</option>
                          <option value="cancelled">Cancelado</option>
                        </select>
                      </div>
                    </div>

                    {/* Cost estimates */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-450 block mb-1">Estimado (R$)</label>
                        <input
                          id="modal-est-cost"
                          type="number"
                          value={editingEstCost}
                          onChange={(e) => setEditingEstCost(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2.5 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-xs text-white"
                          onBlur={() => handleUpdateTicketDetails()}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-450 block mb-1">Efetivo (R$)</label>
                        <input
                          id="modal-act-cost"
                          type="number"
                          value={editingActCost}
                          onChange={(e) => setEditingActCost(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2.5 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-xs text-white"
                          onBlur={() => handleUpdateTicketDetails()}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comments Administrative stream log */}
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-[#D4AF37]" />
                    Histórico de Notas Administrativas ({selectedReq.logs.length})
                  </span>

                  {/* Logs list loop */}
                  <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                    {selectedReq.logs.map(log => (
                      <div key={log.id} className="p-3 bg-[#0F1115] rounded-xl space-y-1 text-[11px] border border-slate-800/80 leading-normal">
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span className="font-semibold text-slate-300">{log.author}</span>
                          <span className="font-mono text-[9px]">{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="text-slate-200">{log.comment}</p>
                      </div>
                    ))}
                  </div>

                  {/* Feed new log comment form */}
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      id="comment-input"
                      type="text"
                      required
                      placeholder="Adicione nota técnica ou parecer da ordem..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-800 rounded-xl text-xs bg-[#0F1115] text-white focus:outline-none focus:border-slate-700 placeholder-slate-500"
                    />
                    <button
                      id="send-comment-btn"
                      type="submit"
                      className="p-2 bg-[#D4AF37] text-white rounded-xl hover:bg-[#b89327] transition-all cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>

              {/* Detail drawer footer actions */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-2 text-xs font-bold">
                {selectedReq.status !== 'resolved' && (
                  <button
                    id="modal-resolve-btn"
                    onClick={() => {
                      handleUpdateTicketDetails('resolved');
                    }}
                    className="px-4 py-2 bg-emerald-950/25 border border-emerald-900/35 hover:bg-emerald-900/25 text-emerald-405 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Resolver Chamado
                  </button>
                )}
                <button
                  id="modal-close-final"
                  onClick={() => setSelectedReq(null)}
                  className="px-4 py-2 bg-slate-905 border border-slate-800 hover:bg-slate-805 text-slate-300 rounded-lg cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Adding Order Dialog */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#14161A] rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-800"
            >
              <div className="p-5 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800/80">
                <div>
                  <h3 className="font-display font-semibold text-sm text-[#D4AF37]">Abrir Ordem de Manutenção</h3>
                  <p className="text-[11px] text-slate-500">Registre ocorrência predial ou interna.</p>
                </div>
                <button
                  id="add-ticket-close"
                  onClick={() => setIsAdding(false)}
                  className="p-1.5 rounded bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form id="add-ticket-form-sub" onSubmit={handleAddSubmit} className="p-5 space-y-4 text-xs">
                {/* Target Unit dropdown */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-405 uppercase tracking-widest">Unidade Alvo / Localização</label>
                  <select
                    id="new-ticket-uid"
                    required
                    value={newUnitId}
                    onChange={(e) => setNewUnitId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="COMMON">Área Comum Geral</option>
                    {units.map(u => (
                      <option key={u.id} value={u.id}>Residência - Unidade {u.id} ({u.ownerName})</option>
                    ))}
                  </select>
                </div>

                {/* Ticket Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-405 uppercase tracking-widest">Título do Chamado</label>
                  <input
                    id="new-ticket-title"
                    type="text"
                    required
                    maxLength={60}
                    placeholder="Ex: Bomba do reservatório de água"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>

                {/* Grid category and priority */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Especialidade / Área</label>
                    <select
                      id="new-ticket-cat"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as MaintenanceCategory)}
                      className="w-full px-3 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-white appearance-none cursor-pointer focus:outline-none"
                    >
                      {Object.entries(categoryLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Prioridade / Gravidade</label>
                    <select
                      id="new-ticket-priority"
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as MaintenancePriority)}
                      className="w-full px-3 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-white appearance-none cursor-pointer focus:outline-none"
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média (Ajustar)</option>
                      <option value="high">Alta (Urgência)</option>
                      <option value="urgent">Crítica (Intervenção urgente)</option>
                    </select>
                  </div>
                </div>

                {/* Description details */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-455 uppercase tracking-widest">Detalhamento Técnico / Descrição</label>
                  <textarea
                    id="new-ticket-desc"
                    rows={3}
                    required
                    maxLength={300}
                    placeholder="Escreva detalhes adicionais sobre o vazamento, fiação gasta, elevador intermitente ou reparos..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-white resize-none text-xs leading-normal focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>

                {/* Optional staff and cost */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Executor Inicial (opcional)</label>
                    <input
                      id="new-ticket-provider"
                      type="text"
                      placeholder="Ex: Atlas Schindler"
                      value={newStaff}
                      onChange={(e) => setNewStaff(e.target.value)}
                      className="w-[#0F1115] w-full px-3 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Custo Previsto (R$)</label>
                    <input
                      id="new-ticket-est"
                      type="number"
                      step="1"
                      placeholder="0.00"
                      value={newEstimatedCost}
                      onChange={(e) => setNewEstimatedCost(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    id="submit-new-ticket"
                    type="submit"
                    className="flex-1 py-2 bg-[#D4AF37] hover:bg-[#b89327] text-white font-extrabold rounded-lg cursor-pointer"
                  >
                    Criar Chamado
                  </button>
                  <button
                    id="cancel-new-ticket"
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 bg-slate-905 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold rounded-lg cursor-pointer"
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

// Kanban individual Draggable Card Representational Item
interface KanbanCardProps {
  req: MaintenanceRequest;
  onClick: () => void;
  labels: Record<MaintenanceCategory, string>;
  labelsPri: Record<MaintenancePriority, string>;
  colorsPri: Record<MaintenancePriority, string>;
}

function KanbanCard({ req, onClick, labels, labelsPri, colorsPri }: KanbanCardProps) {
  return (
    <motion.div
      layoutId={`card-task-${req.id}`}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="bg-[#0F1115] rounded-xl p-4 border border-slate-800/80 hover:border-slate-700 hover:shadow-2xl transition-all cursor-pointer space-y-3 relative overflow-hidden"
    >
      {/* Decorative colored badge on top edge for priorities */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${
        req.priority === 'urgent' ? 'bg-red-500 animate-pulse' :
        req.priority === 'high' ? 'bg-[#D4AF37]' :
        req.priority === 'medium' ? 'bg-sky-500' : 'bg-slate-700'
      }`} />

      <div className="flex justify-between items-start pt-1">
        <span className="font-mono text-[10px] font-bold text-[#D4AF37]">{req.id}</span>
        <span className="font-mono font-bold text-[10px] tracking-tight bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-slate-400 max-w-[80px] truncate">
          {req.unitId === 'COMMON' ? 'Área Comum' : req.unitId}
        </span>
      </div>

      <div className="space-y-1">
        <h4 className="font-bold text-xs text-slate-200 line-clamp-2 leading-snug hover:text-[#D4AF37]">
          {req.title}
        </h4>
        <span className="text-[10px] text-slate-500 block truncate">{labels[req.category]}</span>
      </div>

      <div className="flex justify-between items-center text-[10px] pt-2 border-t border-slate-900 text-slate-400">
        <span className={`px-2 py-0.5 rounded font-bold border capitalize ${colorsPri[req.priority]}`}>
          {labelsPri[req.priority]}
        </span>
        <span className="font-medium text-[9px] text-slate-500">
          {new Date(req.reportedAt).toLocaleDateString('pt-BR')}
        </span>
      </div>
    </motion.div>
  );
}
