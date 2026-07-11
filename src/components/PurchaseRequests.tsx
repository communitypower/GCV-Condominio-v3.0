import React, { useState } from 'react';
import { ShoppingCart, Plus, CheckCircle, XCircle, Search, Clock, DollarSign } from 'lucide-react';
import { PurchaseRequest } from '../types';

interface PurchaseRequestsProps {
  purchases: PurchaseRequest[];
  loading: boolean;
  error: string | null;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onAddRequest: (newReq: Omit<PurchaseRequest, 'id' | 'status' | 'requester' | 'createdAt'>) => Promise<void>;
}

export default function PurchaseRequests({
  purchases,
  loading,
  error,
  onApprove,
  onReject,
  onAddRequest
}: PurchaseRequestsProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [supplier, setSupplier] = useState('');
  const [items, setItems] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !supplier.trim() || !items.trim() || !amount) {
      alert('Favor preencher o formulário para cotação.');
      return;
    }
    setSubmitting(true);
    try {
      await onAddRequest({ title, supplier, items, amount: parseFloat(amount) });
      setShowAdd(false);
      setTitle('');
      setSupplier('');
      setItems('');
      setAmount('');
    } catch {
      // The parent exposes the API error in the page state.
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, action: 'approve' | 'reject') => {
    setPendingAction(`${action}:${id}`);
    try {
      await (action === 'approve' ? onApprove(id) : onReject(id));
    } catch {
      // The parent exposes the API error in the page state.
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
            <span className="text-[#10b981]"><ShoppingCart className="w-8 h-8" /></span>
            Requisições de Compra & Almoxarifado
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Autorize verbas de material térmico, buchas, encanamento e suprimento predial</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Requisição
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {loading && <div className="rounded-lg border border-zinc-800 bg-[#14161b] p-6 text-center text-sm text-zinc-400">Carregando requisições...</div>}
      {!loading && !error && purchases.length === 0 && <div className="rounded-lg border border-zinc-800 bg-[#14161b] p-6 text-center text-sm text-zinc-400">Nenhuma requisição cadastrada.</div>}

      {!loading && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {purchases.map(p => (
          <div key={p.id} className="bg-[#14161b] rounded-xl border border-zinc-800 p-5 flex flex-col justify-between space-y-4 shadow-md">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono text-zinc-500 font-bold">{p.id}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  p.status === 'approved' ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/20' :
                  p.status === 'rejected' ? 'bg-red-500/15 text-red-400 border border-red-500/10' :
                  'bg-amber-500/15 text-amber-500 border border-amber-500/10'
                }`}>
                  {p.status === 'approved' ? 'Aprovado' : p.status === 'rejected' ? 'Recusado' : p.status === 'cancelled' ? 'Cancelado' : 'Aguardando'}
                </span>
              </div>
              <h3 className="font-bold text-base text-white">{p.title}</h3>
              <p className="text-zinc-500 text-xs">Fornecedor: <strong className="text-zinc-400">{p.supplier}</strong></p>
              
              <div className="p-3 bg-[#0d0e12]/50 border border-zinc-850 rounded text-xs text-zinc-400 font-mono">
                {p.items}
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-850/50 flex items-center justify-between">
              <div>
                <span className="text-zinc-500 block text-[9px] uppercase font-bold">Valor Orçado</span>
                <span className="text-base font-bold text-[#10b981]">{formatCurrency(p.amount)}</span>
              </div>

              {p.status === 'pending' ? (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => updateStatus(p.id, 'approve')}
                    disabled={pendingAction !== null}
                    className="p-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Aprovar
                  </button>
                  <button
                    onClick={() => updateStatus(p.id, 'reject')}
                    disabled={pendingAction !== null}
                    className="p-1 px-3 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Recusar
                  </button>
                </div>
              ) : (
                <div className="text-[10px] text-zinc-500 font-medium">
                  Solicitado por: <strong>{p.requester}</strong> em {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>}

      {showAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#14161b] rounded-xl border border-zinc-800 p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
              <h3 className="text-lg font-bold text-white">Criar Requisição de Cotação</h3>
              <button onClick={() => setShowAdd(false)} className="text-zinc-400 text-xs font-mono">[Fechar]</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-zinc-400 block">Identificação / Finalidade</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="EX: Chaves Seletoras Painel de Maquinas"
                  className="w-full bg-[#0d0e12] border border-zinc-850 text-white rounded p-2 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Fornecedor Cotado</label>
                <input 
                  type="text" 
                  value={supplier} 
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="EX: Hidrau-Materiais Comércio LTDA"
                  className="w-full bg-[#0d0e12] border border-zinc-850 text-white rounded p-2 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Lista de Itens (Quantidades e SKU)</label>
                <textarea 
                  value={items} 
                  onChange={(e) => setItems(e.target.value)}
                  placeholder="EX: 4x Válvula de retenção DN50, 2 Kg de fita veda super rosca..."
                  rows={3}
                  className="w-full bg-[#0d0e12] border border-zinc-850 text-white rounded p-2 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Valor Estimado Cotação (BRL)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-zinc-500 font-bold">R$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0d0e12] border border-zinc-850 text-white rounded py-2 pl-9 pr-2 focus:outline-none"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-[#10b981] text-white font-bold uppercase rounded hover:bg-emerald-600 transition-colors"
              >
                {submitting ? 'Salvando...' : 'Lançar Pré-aprovação'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
