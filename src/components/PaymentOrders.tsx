import React, { useState } from 'react';
import { CreditCard, Plus, Check, Clock, Search } from 'lucide-react';
import { PaymentOrder } from '../types';

interface PaymentOrdersProps {
  payments: PaymentOrder[];
  onAddPayment: (newPay: PaymentOrder) => void;
  onPay: (id: string) => void;
}

export default function PaymentOrders({
  payments,
  onAddPayment,
  onPay
}: PaymentOrdersProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [payee, setPayee] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('2026-05-30');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payee.trim() || !description.trim() || !amount) {
      alert('Preencha os dados do boleto/fatura.');
      return;
    }
    const newPay: PaymentOrder = {
      id: `PAG-${String(payments.length + 1).padStart(2, '0')}`,
      recipient: payee,
      description,
      amount: parseFloat(amount),
      dueDate,
      status: 'pending'
    };
    onAddPayment(newPay);
    setShowAdd(false);
    setPayee('');
    setDescription('');
    setAmount('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
            <span className="text-[#10b981]"><CreditCard className="w-8 h-8" /></span>
            Controle de Ordens de Pagamento (A Pagar)
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Monitore boletos, concessionárias e termos de liquidação de terceiros autorizados</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Lançar Despesa
        </button>
      </div>

      <div className="bg-[#14161b] rounded-xl border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-850 bg-[#0d0e12]/40 text-xs font-bold text-zinc-400 grid grid-cols-12 gap-4">
          <div className="col-span-2">ID DO LANÇAM.</div>
          <div className="col-span-3">FAVORECIDO / CREDOR</div>
          <div className="col-span-3">DESCRIÇÃOtécnica</div>
          <div className="col-span-2">VENCIMENTO</div>
          <div className="col-span-1 text-right">VALOR</div>
          <div className="col-span-1 text-right">AÇÕES / STATUS</div>
        </div>

        <div className="divide-y divide-zinc-850">
          {payments.map(p => (
            <div key={p.id} className="p-4 grid grid-cols-12 gap-4 text-xs items-center hover:bg-zinc-850/20 transition-colors">
              <div className="col-span-2 font-mono text-zinc-500 font-bold">{p.id}</div>
              <div className="col-span-3 text-white font-bold">{p.recipient}</div>
              <div className="col-span-3 text-zinc-400 truncate">{p.description}</div>
              <div className="col-span-2 text-zinc-400 font-mono">{new Date(p.dueDate).toLocaleDateString('pt-BR')}</div>
              <div className="col-span-1 text-right font-bold text-white font-mono">{formatCurrency(p.amount)}</div>
              
              <div className="col-span-1 text-right">
                {p.status === 'paid' ? (
                  <span className="text-emerald-500 font-bold flex items-center justify-end gap-1 text-[11px]">
                    <Check className="w-4 h-4" /> Pago
                  </span>
                ) : (
                  <button
                    onClick={() => onPay(p.id)}
                    className="px-2 py-1 bg-[#10b981] text-white font-bold uppercase rounded hover:bg-emerald-600 transition-colors text-[10px]"
                  >
                    Liquidar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#14161b] rounded-xl border border-zinc-800 p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
              <h3 className="text-lg font-bold text-white">Lançar Nova Fatura / Despesa</h3>
              <button onClick={() => setShowAdd(false)} className="text-zinc-500 text-xs font-mono border border-zinc-800 px-2 py-0.5 rounded">fechar</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-zinc-400 block">Favorecido (Empresa / CPF / Razão Social)</label>
                <input 
                  type="text" 
                  value={payee} 
                  onChange={(e) => setPayee(e.target.value)}
                  placeholder="EX: Elevadores Otis do Brasil"
                  className="w-full bg-[#0d0e12] border border-zinc-850 text-white rounded p-2 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Finalidade / Descrição da Compra</label>
                <input 
                  type="text" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="EX: Mensalidade contrato conservação preventiva elevadores"
                  className="w-full bg-[#0d0e12] border border-zinc-850 text-white rounded p-2 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Valor do Documento (BRL)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0d0e12] border border-zinc-850 text-white rounded p-2 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 block">Data de Vencimento</label>
                  <input 
                    type="date" 
                    value={dueDate} 
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-[#0d0e12] border border-zinc-850 text-white rounded p-2"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-[#10b981] text-white font-bold uppercase rounded hover:bg-[#009267] transition-all"
              >
                Autorizar Ordem de Saída
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
