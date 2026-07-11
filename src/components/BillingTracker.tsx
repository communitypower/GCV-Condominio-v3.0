/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  FileText, 
  QrCode, 
  Copy, 
  X, 
  Printer, 
  Plus, 
  Coins, 
  Check,
  CreditCard,
  Receipt
} from 'lucide-react';
import { Unit, Billing, BillingStatus } from '../types';

interface BillingTrackerProps {
  units: Unit[];
  billings: Billing[];
  currentMonth: string;
  onPayBilling: (billingId: string, paidDate: string) => void;
  onAddBilling: (newBilling: Billing) => void;
  onMassGenerate: (month: string) => void;
}

export default function BillingTracker({
  units,
  billings,
  currentMonth,
  onPayBilling,
  onAddBilling,
  onMassGenerate,
}: BillingTrackerProps) {
  // Month selection
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  // Search and status filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selected billing for invoice modal
  const [viewingBilling, setViewingBilling] = useState<Billing | null>(null);
  const [copiedType, setCopiedType] = useState<'pix' | 'barcode' | null>(null);

  // Pay registration modal
  const [payingBilling, setPayingBilling] = useState<Billing | null>(null);
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);

  // Create individual bill modal
  const [isAddingBill, setIsAddingBill] = useState(false);
  const [addUnitId, setAddUnitId] = useState('');
  const [addAmount, setAddAmount] = useState(650.00);
  const [addDueDate, setAddDueDate] = useState('');
  const [addDesc, setAddDesc] = useState('Taxa Condominial Ordinária');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const notifyCopied = (type: 'pix' | 'barcode') => {
    setCopiedType(type);
    navigator.clipboard.writeText(
      type === 'pix' ? viewingBilling?.pixQrCode || '' : viewingBilling?.barcode || ''
    );
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Calculations for chosen month
  const monthBillings = billings.filter(b => b.monthString === selectedMonth);
  
  const totalBilled = monthBillings.reduce((acc, b) => acc + b.amount, 0);
  const totalPaid = monthBillings
    .filter(b => b.status === 'paid')
    .reduce((acc, b) => acc + (b.amount + (b.penaltyFee || 0) + (b.interestFee || 0)), 0);
  const totalOverdue = monthBillings
    .filter(b => b.status === 'overdue')
    .reduce((acc, b) => acc + (b.amount + (b.penaltyFee || 0) + (b.interestFee || 0)), 0);
  const totalPending = monthBillings
    .filter(b => b.status === 'pending')
    .reduce((acc, b) => acc + b.amount, 0);

  const billingStatusCount = (status: BillingStatus) => monthBillings.filter(b => b.status === status).length;
  const collectionRate = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;

  // Filtered listing
  const filteredBillings = monthBillings.filter(bil => {
    const unit = units.find(u => u.id === bil.unitId);
    const ownerName = unit ? unit.ownerName.toLowerCase() : '';
    const unitId = bil.unitId.toLowerCase();

    const matchesSearch = 
      unitId.includes(searchQuery.toLowerCase()) || 
      ownerName.includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || bil.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const monthsAvailable = [...new Set([currentMonth, ...billings.map(billing => billing.monthString)])].sort().reverse();

  const formatMonthName = (yrMo: string) => {
    const [year, month] = yrMo.split('-');
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${months[parseInt(month) - 1]} de ${year}`;
  };

  const handleRegisterPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBilling) return;
    onPayBilling(payingBilling.id, paidDate);
    setPayingBilling(null);
  };

  const handleIndividualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUnitId) {
      alert('Favor selecionar a unidade da cobrança.');
      return;
    }

    const newBill: Billing = {
      id: `BIL-${selectedMonth.replace('-', '')}-${addUnitId}`,
      unitId: addUnitId,
      monthString: selectedMonth,
      amount: addAmount,
      dueDate: addDueDate || `${selectedMonth}-10`,
      status: 'pending',
      issueDate: new Date().toISOString().split('T')[0],
      barcode: '34191.79001 01043.513184 91020.150008 7 97130000' + Math.floor(addAmount * 100).toString().padStart(6, '0'),
      pixQrCode: `00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL${selectedMonth.replace('-', '')}${addUnitId}520400005303986540${addAmount.toFixed(2)}5802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL${selectedMonth.replace('-', '')}${addUnitId}`,
      description: addDesc,
    };

    onAddBilling(newBill);
    setIsAddingBill(false);
  };

  // Helper unit values mapping
  const handleUnitSelectChange = (uid: string) => {
    setAddUnitId(uid);
    const unit = units.find(u => u.id === uid);
    if (unit) {
      if (unit.type === 'penthouse') setAddAmount(1200.00);
      else if (unit.type === 'house') setAddAmount(850.00);
      else setAddAmount(650.00);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Header with Mass Generator button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold text-white tracking-tight">Painel de Faturamento & Cobrança</h2>
          <p className="text-slate-500 text-xs">Arrecadação mensal, geração de taxas ordinárias e quitações de mensalidades.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filteredBillings.length === 0 && (
            <button
              id="mass-billing-btn"
              onClick={() => onMassGenerate(selectedMonth)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 hover:bg-emerald-900/20 text-xs font-bold rounded-lg transition-all cursor-pointer"
            >
              <Coins className="w-4 h-4" />
              Cargas em Massa ({formatMonthName(selectedMonth).split(' ')[0]})
            </button>
          )}
          <button
            id="single-billing-btn"
            onClick={() => setIsAddingBill(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] hover:bg-[#b89327] text-white text-xs font-extrabold rounded-lg transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Lançar Boleto
          </button>
        </div>
      </div>

      {/* Top Selector and metrics grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 1: Month selector panel */}
        <div className="bg-[#14161A] rounded-xl p-5 border border-slate-800/60 flex flex-col justify-between space-y-4 shadow-xl">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Competência Ativa</span>
            <div className="relative">
              <select
                id="billing-month-selector"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-xs font-bold font-sans text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37] appearance-none cursor-pointer"
              >
                {monthsAvailable.map(m => (
                  <option key={m} value={m}>{formatMonthName(m)}</option>
                ))}
              </select>
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/50 text-xs text-slate-400 space-y-2">
            <div className="flex justify-between font-medium">
              <span>Total Boletos:</span>
              <span className="font-bold text-white">{monthBillings.length}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-emerald-400">Pagas:</span>
              <span className="font-bold text-emerald-400">{billingStatusCount('paid')}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-[#D4AF37]">A vencer:</span>
              <span className="font-bold text-[#D4AF37]">{billingStatusCount('pending')}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-red-400">Atrasos (Mês):</span>
              <span className="font-bold text-red-400">{billingStatusCount('overdue')}</span>
            </div>
          </div>
        </div>

        {/* Right 3 columns: Metrics values cards */}
        <div className="bg-[#14161A] rounded-xl p-5 border border-slate-800/60 lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6 relative shadow-xl">
          {/* Card 1: Revenue Collected */}
          <div className="flex flex-col justify-between space-y-2">
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30 w-max">Arrecadado</span>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Valor Líquido Recebido</p>
              <h3 className="text-2xl font-mono font-bold text-emerald-400 mt-1">{formatCurrency(totalPaid)}</h3>
            </div>
            <span className="text-[10px] text-slate-500">Total liquidado via Pix e compensação.</span>
          </div>

          {/* Card 2: Revenue Outstanding */}
          <div className="flex flex-col justify-between space-y-2">
            <span className="text-[10px] font-bold text-[#D4AF37] bg-amber-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/25 w-max">A Receber</span>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">A vencer no mês</p>
              <h3 className="text-2xl font-mono font-bold text-amber-500 mt-1">{formatCurrency(totalPending)}</h3>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Previsão pendente de compensação.</span>
          </div>

          {/* Card 3: Collection Status indicator */}
          <div className="flex flex-col justify-between space-y-2">
            <span className="text-[10px] font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 w-max">Adimplemento</span>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Porcentual de Baixas</p>
              <h3 className="text-2xl font-mono font-bold text-white mt-1">{collectionRate.toFixed(1)}%</h3>
            </div>
            <div className="w-full bg-[#0F1115] h-2 rounded-full overflow-hidden mt-1 border border-slate-800/60">
              <div className="bg-emerald-505 h-full rounded-full transition-all" style={{ width: `${collectionRate}%`, backgroundColor: '#10B981' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Internal Filter list bar */}
      <div className="bg-[#14161A] rounded-xl p-4 shadow-xl border border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="billing-search"
            type="text"
            placeholder="Buscar por unidade ou proprietário..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          />
        </div>

        {/* Status Dropdown */}
        <div className="relative w-full sm:w-56">
          <select
            id="billing-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-3 pr-8 py-2 bg-[#0F1115] border border-slate-800 rounded-lg text-xs font-medium text-white appearance-none focus:outline-none focus:ring-1 focus:ring-[#D4AF37] cursor-pointer"
          >
            <option value="all">Todas as Cobranças</option>
            <option value="paid">Confirmados (Pagas)</option>
            <option value="pending">Em aberto (Pendentes)</option>
            <option value="overdue">Em atraso (Inadimplidos)</option>
          </select>
          <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Main Billing Invoices List Table */}
      <div className="bg-[#14161A] rounded-xl border border-slate-800/60 shadow-xl overflow-hidden">
        {filteredBillings.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-white font-bold text-sm">Nenhuma cobrança encontrada</h3>
            <p className="text-slate-550 text-xs mt-1">Gere novas cargas em massa ou individuais para a competência de {formatMonthName(selectedMonth)}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800/60 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="p-4">Cód. Unidade</th>
                  <th className="p-4">Responsável</th>
                  <th className="p-4 text-right">Valor Nominal</th>
                  <th className="p-4">Vencimento</th>
                  <th className="p-4">Situação</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-medium text-slate-300">
                {filteredBillings.map(bil => {
                  const unit = units.find(u => u.id === bil.unitId);
                  return (
                    <tr key={bil.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-4">
                        <span className="font-mono font-bold text-[#D4AF37] bg-[#0F1115] border border-slate-800 px-2 py-0.5 rounded">
                          {unit?.number || bil.unitId}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="truncate max-w-[200px] font-sans font-semibold text-white text-sm">
                          {unit ? unit.ownerName : 'Não Cadastrado'}
                        </div>
                        <span className="text-[10px] text-slate-500 capitalize">{unit ? unit.type : ''}</span>
                      </td>
                      <td className="p-4 text-right font-bold text-white font-mono text-xs">
                        {formatCurrency(bil.amount)}
                      </td>
                      <td className="p-4 font-mono text-slate-400">
                        {new Date(bil.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${
                          bil.status === 'paid' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30' : 
                          bil.status === 'overdue' ? 'bg-red-950/20 text-red-400 border-red-900/40 animate-pulse' : 'bg-amber-950/20 text-amber-500 border-amber-900/15'
                        }`}>
                          {bil.status === 'paid' ? (
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                          ) : bil.status === 'overdue' ? (
                            <AlertCircle className="w-3 h-3 text-red-500" />
                          ) : (
                            <Clock className="w-3 h-3 text-[#D4AF37]" />
                          )}
                          {bil.status === 'paid' ? 'Liquidado' : bil.status === 'overdue' ? 'Vencido/Atrasado' : 'A Vencer'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            id={`view-invoice-${bil.id}`}
                            onClick={() => setViewingBilling(bil)}
                            className="bg-[#0F1115] border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 font-bold transition-all text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
                            Ver Boleto
                          </button>
                          {bil.status !== 'paid' && (
                            <button
                              id={`register-pay-${bil.id}`}
                              onClick={() => {
                                setPayingBilling(bil);
                                setPaidDate(new Date().toISOString().split('T')[0]);
                              }}
                              className="bg-emerald-950/20 border border-emerald-900/35 hover:bg-emerald-900/25 text-emerald-400 px-3 py-1.5 rounded-lg font-bold transition-all text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Baixar Pago
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pay registration Dialog */}
      <AnimatePresence>
        {payingBilling && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#14161A] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-800"
            >
              <div className="p-5 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800">
                <div>
                  <h3 className="font-display font-semibold text-sm text-[#D4AF37]">Registrar Recebimento</h3>
                  <p className="text-[11px] text-slate-500">Baixa manual no sistema de competências.</p>
                </div>
                <button
                  id="pay-modal-close"
                  onClick={() => setPayingBilling(null)}
                  className="p-1.5 rounded bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form id="pay-registration-form" onSubmit={handleRegisterPayment} className="p-5 space-y-4 text-xs">
                <div className="p-3 bg-[#0F1115] border border-slate-800/60 rounded-lg space-y-1.5 text-slate-300">
                  <p className="text-slate-400">Unidade Devedora: <span className="font-mono font-bold text-[#D4AF37]">{payingBilling.unitId}</span></p>
                  <p className="text-slate-400">Descrição do Boleto: <span className="font-semibold text-slate-200">{payingBilling.description}</span></p>
                  <p className="text-slate-400">Valor para Liquidar: <span className="font-extrabold text-white text-sm">{formatCurrency(payingBilling.amount)}</span></p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Data do Pagamento</label>
                  <input
                    id="paid-date-input"
                    type="date"
                    required
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>

                <p className="text-[10px] text-slate-500 leading-relaxed">Ao clicar em confirmar, a cobrança receberá a flag "Pago", refletindo imediatamente no indicador geral do faturamento e no balancete.</p>

                <div className="flex gap-2 pt-2">
                  <button
                    id="confirm-pay-btn"
                    type="submit"
                    className="flex-1 py-1.5 bg-[#D4AF37] hover:bg-[#b89327] text-white font-extrabold rounded-lg cursor-pointer"
                  >
                    Confirmar Quitação
                  </button>
                  <button
                    id="cancel-pay-btn"
                    type="button"
                    onClick={() => setPayingBilling(null)}
                    className="px-4 py-1.5 bg-slate-105 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold rounded-lg cursor-pointer"
                  >
                    Voltar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* high fidelity Visual Boleto + PIX overlay Modal */}
      <AnimatePresence>
        {viewingBilling && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-neutral-100 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-800 flex flex-col my-8"
            >
              {/* Overlay Modal Ribbon and Actions */}
              <div className="p-4 bg-slate-950 text-white flex items-center justify-between print:hidden">
                <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] font-sans">
                  Visualizador de Bloqueto / Boleto Bancário Oficial
                </span>
                <div className="flex items-center gap-2">
                  <button
                    id="print-invoice"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-bold rounded-md border border-slate-800 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#D4AF37]" />
                    Imprimir
                  </button>
                  <button
                    id="viewing-close"
                    onClick={() => setViewingBilling(null)}
                    className="p-1.5 rounded-full bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* The Bank Slip Content (Paper layout background keeps white for scanning reliability) */}
              <div className="p-8 space-y-6 bg-white text-slate-900" id="printable-boleto-slip">
                {/* Bank Header Section */}
                <div className="flex items-end justify-between border-b-4 border-slate-950 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold tracking-tighter text-slate-955 font-sans">GCV COND BANK</span>
                    <span className="text-lg font-bold border-x-2 border-slate-900 px-3">001-9</span>
                  </div>
                  <span className="font-mono text-xs sm:text-sm font-bold text-slate-955">
                    {viewingBilling.barcode}
                  </span>
                </div>

                {/* Grid details (Local de pagamento, vencimento etc) */}
                <div className="border border-slate-950 text-[10px] grid grid-cols-6 divide-x divide-slate-950 border-b-0">
                  <div className="col-span-4 p-1.5 space-y-0.5">
                    <p className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wide">Local de Pagamento</p>
                    <p className="font-bold text-slate-900">Qualquer agência bancária, internet banking ou rede Pix ligada ao Banco Central.</p>
                  </div>
                  <div className="col-span-2 p-1.5 space-y-0.5 bg-neutral-100">
                    <p className="text-[7.5px] font-bold text-slate-600 uppercase tracking-wide">Vencimento</p>
                    <p className="font-bold text-[11.5px] font-sans text-slate-950">
                      {new Date(viewingBilling.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  <div className="col-span-4 p-1.5 space-y-0.5 border-t border-slate-950">
                    <p className="text-[7.5px] font-bold text-slate-500 (*)">Beneficiário</p>
                    <p className="font-bold text-slate-900">CONDOMINIO RESIDENCIAL BELLA VISTA - CNPJ 12.345.678/0001-99</p>
                  </div>
                  <div className="col-span-2 p-1.5 space-y-0.5 border-t border-slate-950 bg-neutral-100">
                    <p className="text-[7.5px] font-bold text-slate-600 uppercase tracking-wide">Agência / Código Beneficiário</p>
                    <p className="font-mono font-bold text-slate-950">1204-1 / 234567-8</p>
                  </div>

                  <div className="col-span-1 p-1.5 space-y-0.5 border-t border-slate-950">
                    <p className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wide">Data Documento</p>
                    <p className="font-semibold text-slate-950">
                      {new Date(viewingBilling.issueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="col-span-2 p-1.5 space-y-0.5 border-t border-slate-950">
                    <p className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wide">Número do Documento</p>
                    <p className="font-mono font-semibold text-slate-950">{viewingBilling.id.replace('BIL-', '')}</p>
                  </div>
                  <div className="col-span-1 p-1.5 space-y-0.5 border-t border-slate-950">
                    <p className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wide">Espécie Doc.</p>
                    <p className="font-semibold text-slate-955">DM</p>
                  </div>
                  <div className="col-span-1 p-1.5 space-y-0.5 border-t border-slate-950">
                    <p className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wide">Aceite</p>
                    <p className="font-semibold text-slate-955">N</p>
                  </div>
                  <div className="col-span-1 p-1.5 space-y-0.5 border-t border-slate-950">
                    <p className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wide">Data Proces.</p>
                    <p className="font-semibold text-slate-955">
                      {new Date(viewingBilling.issueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  <div className="col-span-2 p-1.5 space-y-0.5 border-t border-slate-950">
                    <p className="text-[7.5px] font-bold text-slate-505 uppercase tracking-wide">Carteira</p>
                    <p className="font-semibold text-slate-950">17 (Cobrança direta sem registro)</p>
                  </div>
                  <div className="col-span-1 p-1.5 space-y-0.5 border-t border-slate-950">
                    <p className="text-[7.5px] font-bold text-slate-505 uppercase tracking-wide">Espécie M.</p>
                    <p className="font-semibold text-slate-905">R$</p>
                  </div>
                  <div className="col-span-1 p-1.5 space-y-0.5 border-t border-slate-950">
                    <p className="text-[7.5px] font-bold text-slate-505 uppercase tracking-wide">Quantidade</p>
                    <p className="font-semibold text-slate-905">---</p>
                  </div>
                  <div className="col-span-1 p-1.5 space-y-0.5 border-t border-slate-950">
                    <p className="text-[7.5px] font-bold text-slate-505 uppercase tracking-wide">Valor Moeda</p>
                    <p className="font-semibold text-slate-905">---</p>
                  </div>
                  <div className="col-span-1 p-1.5 space-y-0.5 border-t border-slate-950 bg-neutral-100">
                    <p className="text-[7.5px] font-bold text-slate-600 uppercase tracking-wide">(=) Valor Doc.</p>
                    <p className="font-extrabold text-[12px] text-slate-955">{formatCurrency(viewingBilling.amount)}</p>
                  </div>
                </div>

                {/* Instructions section */}
                <div className="border border-slate-955 text-[10px] grid grid-cols-6 divide-x divide-slate-950">
                  <div className="col-span-4 p-3 space-y-1.5 text-[9px] text-slate-700">
                    <p className="text-[7.5px] font-bold text-slate-950 uppercase tracking-wide">Instruções de Responsabilidade do Beneficiário</p>
                    <p className="font-bold text-slate-950">Competência {viewingBilling.monthString} — {viewingBilling.description}.</p>
                    <p>Referente à quota-parte condominial ordinária e fundos de reserva da fração ideal correspondente.</p>
                    <p className="text-red-750 font-bold">Multa de 2.0% (R$ {((viewingBilling.amount) * 0.02).toFixed(2)}) e juros de 1.0% ao mês em caso de atraso na liquidação.</p>
                  </div>
                  <div className="col-span-2 divide-y divide-slate-955 text-[9px]">
                    <div className="p-1.5 space-y-0.5">
                      <p className="text-[7px] font-bold text-slate-500 uppercase tracking-wide">(-) Desconto / Abatimento</p>
                      <p className="font-mono text-slate-500">---</p>
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      <p className="text-[7px] font-bold text-slate-500 uppercase tracking-wide">(+) Multas / Juros</p>
                      <p className="font-semibold text-slate-950">
                        {viewingBilling.penaltyFee ? formatCurrency((viewingBilling.penaltyFee || 0) + (viewingBilling.interestFee || 0)) : '---'}
                      </p>
                    </div>
                    <div className="p-1.5 space-y-0.5 bg-neutral-100">
                      <p className="text-[7px] font-bold text-slate-600 uppercase tracking-wide">(=) Valor Cobrado</p>
                      <p className="font-extrabold text-slate-955 text-[11px]">
                        {formatCurrency(viewingBilling.amount + (viewingBilling.penaltyFee || 0) + (viewingBilling.interestFee || 0))}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sacado (Payer details) */}
                <div className="border border-slate-955 p-3 text-[10px] space-y-1.5">
                  <p className="text-[7.5px] font-bold text-slate-550 uppercase tracking-wide">Pagador / Sacado</p>
                  <div className="flex justify-between font-bold text-slate-950">
                    <span>
                      {units.find(u => u.id === viewingBilling.unitId)?.ownerName || 'Condômino Desconhecido'} — Unidade {viewingBilling.unitId}
                    </span>
                    <span className="font-mono">CPF: ***.453.***-00</span>
                  </div>
                  <p className="text-slate-505">Condomínio Bella Vista, Bloco {viewingBilling.unitId.split('-')[0]} nº {viewingBilling.unitId.split('-')[1]} — CEP 13084-250</p>
                </div>

                {/* High tech visual addition: PIX payment code next to Barcode */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 items-center">
                  <div className="flex flex-col items-center md:items-start space-y-2 col-span-2">
                    <span className="text-xs font-bold text-slate-950 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      Pagamento via Pix para baixa instantânea
                    </span>
                    <p className="text-[11px] text-slate-650 text-center md:text-left leading-relaxed">
                      Pague de forma instantânea escaneando o QR Code ao lado ou copiando a chave Pix dinamicizada do balancete abaixo.
                    </p>
                    <div className="flex gap-2 w-full pt-1.5">
                      <button
                        id="copy-pix-btn"
                        onClick={() => notifyCopied('pix')}
                        className="flex-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-bold rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        {copiedType === 'pix' ? 'Copiado!' : 'Copiar Chave Copia e Cola Pix'}
                      </button>
                      <button
                        id="copy-barcode-btn"
                        onClick={() => notifyCopied('barcode')}
                        className="flex-1 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-slate-800 border border-neutral-300 text-[10px] font-bold rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedType === 'barcode' ? 'Copiado!' : 'Copiar Cód. Barras'}
                      </button>
                    </div>
                  </div>

                  {/* Mock Visual QR code block */}
                  <div className="flex flex-col items-center space-y-1">
                    <div className="bg-slate-50 p-2 border border-dashed border-gray-400 rounded-lg">
                      <svg viewBox="0 0 100 100" className="w-20 h-20 text-slate-900" fill="currentColor">
                        <path d="M 5,5 h 25 v 25 h -25 z M 10,10 v 15 h 15 v -15 z M 17,17 h 1 v 1 h -1 z" />
                        <path d="M 70,5 h 25 v 25 h -25 z M 75,10 v 15 h 15 v -15 z" />
                        <path d="M 5,70 h 25 v 25 h -25 z M 10,75 v 15 h 15 v -15 z" />
                        <path d="M 40,5 h 8 v 8 h -8 z M 40,17 h 12 v 6 h -12 z M 58,10 h 6 v 15 h -6 z M 45,30 h 10 v 6 h -10 z" />
                        <path d="M 5,40 h 10 v 12 h -10 z M 20,40 h 8 v 6 h -8 z M 20,52 h 15 v 6 h -15 z" />
                        <path d="M 75,40 h 15 v 8 h -15 z M 70,55 h 6 v 12 h -6 z M 85,55 h 10 v 6 h -10 z" />
                        <path d="M 40,70 h 6 v 15 h -6 z M 52,70 h 12 v 6 h -12 z M 58,82 h 15 v 10 h -15 z" />
                        <path d="M 47,47 h 6 v 6 h -6 z M 47,58 h 10 v 8 h -10 z" />
                      </svg>
                    </div>
                    <span className="text-[8.5px] font-bold text-slate-500 uppercase">QR Pix de Baixa Rápida</span>
                  </div>
                </div>

                {/* Simulated Bank Slip Line of bars in gray */}
                <div className="flex flex-col items-center space-y-1 pt-4 border-t border-dashed border-slate-300">
                  <div className="h-9 w-full bg-[repeating-linear-gradient(90deg,#000,#000_1px,#fff_1px,#fff_3px,#000_3px,#000_5px,#fff_5px,#fff_7px)] opacity-95" />
                  <span className="text-[8px] font-mono text-slate-500 tracking-widest uppercase">Ficha de compensação mecanicamente pelo sistema GCV Condominial</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add singular Bill Modal */}
      <AnimatePresence>
        {isAddingBill && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#14161A] rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-800"
            >
              <div className="p-5 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800/80">
                <div>
                  <h3 className="font-display font-semibold text-sm text-[#D4AF37]">Lançar Novo Boleto</h3>
                  <p className="text-[11px] text-slate-500">Emita uma cobrança individual para unidade imobiliária.</p>
                </div>
                <button
                  id="add-bill-close"
                  onClick={() => setIsAddingBill(false)}
                  className="p-1.5 rounded bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form id="individual-billing-form" onSubmit={handleIndividualSubmit} className="p-5 space-y-4 text-xs">
                {/* Unit selector */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidade Alvo</label>
                  <select
                    id="add-bill-uid"
                    required
                    value={addUnitId}
                    onChange={(e) => handleUnitSelectChange(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="">Selecione...</option>
                    {units.map(u => (
                      <option key={u.id} value={u.id}>{u.id} - {u.ownerName} ({u.block})</option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor do Boleto (R$)</label>
                  <input
                    id="add-bill-amount"
                    type="number"
                    step="0.01"
                    required
                    value={addAmount}
                    onChange={(e) => setAddAmount(parseFloat(e.target.value))}
                    className="w-full px-3 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data de Vencimento</label>
                  <input
                    id="add-bill-due"
                    type="date"
                    required
                    value={addDueDate}
                    onChange={(e) => setAddDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição das Despesas</label>
                  <input
                    id="add-bill-desc"
                    type="text"
                    required
                    value={addDesc}
                    onChange={(e) => setAddDesc(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0F1115] border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    id="submit-individual-bill"
                    type="submit"
                    className="flex-1 py-1.5 bg-[#D4AF37] hover:bg-[#b89327] text-white font-extrabold rounded-lg cursor-pointer"
                  >
                    Emitir Boleto
                  </button>
                  <button
                    id="cancel-individual-bill"
                    type="button"
                    onClick={() => setIsAddingBill(false)}
                    className="px-4 py-1.5 bg-slate-905 border border-slate-800 text-slate-300 font-bold rounded-lg cursor-pointer"
                  >
                    Cancelar
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
