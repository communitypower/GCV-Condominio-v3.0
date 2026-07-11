import React, { useMemo, useState } from 'react';
import { Landmark, FileSpreadsheet, Percent, Receipt, Scale } from 'lucide-react';
import { Billing, PaymentOrder } from '../types';

interface DemonstrativosProps { billings: Billing[]; payments: PaymentOrder[]; loading?: boolean; }
const monthOf = (value?: string) => value ? value.slice(0, 7) : '';
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function Demonstrativos({ billings, payments, loading = false }: DemonstrativosProps) {
  const months = useMemo(() => [...new Set([
    ...billings.map(item => item.monthString || monthOf(item.dueDate)),
    ...payments.map(item => monthOf(item.dueDate)),
  ].filter(Boolean))].sort().reverse(), [billings, payments]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const month = months.includes(selectedMonth) ? selectedMonth : (months[0] || '');

  const flow = useMemo(() => {
    const charges = billings.filter(item => (item.monthString || monthOf(item.dueDate)) === month);
    const expenses = payments.filter(item => monthOf(item.dueDate) === month && item.status !== 'cancelled');
    const billed = charges.reduce((sum, item) => sum + Number(item.amount), 0);
    const revenue = charges.filter(item => item.status === 'paid').reduce((sum, item) => sum + Number(item.amount), 0);
    const paidExpenses = expenses.filter(item => item.status === 'paid').reduce((sum, item) => sum + Number(item.amount), 0);
    const payable = expenses.filter(item => item.status !== 'paid').reduce((sum, item) => sum + Number(item.amount), 0);
    const outstanding = charges.filter(item => item.status !== 'paid').reduce((sum, item) => sum + Number(item.amount), 0);
    return { billed, revenue, paidExpenses, payable, outstanding, delinquency: billed ? (outstanding / billed) * 100 : 0 };
  }, [billings, payments, month]);

  if (loading) return <div className="p-8 text-center text-sm text-zinc-400">Carregando demonstrativo...</div>;

  return <div className="space-y-6">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2"><Landmark className="w-8 h-8 text-[#10b981]" />Demonstrativos Financeiros & Balancete</h1><p className="text-zinc-400 text-sm mt-1">Valores conciliados com cobranças e ordens de pagamento registradas</p></div><select value={month} disabled={!months.length} onChange={event => setSelectedMonth(event.target.value)} className="bg-[#14161b] border border-zinc-800 text-white rounded-lg px-4 py-2.5 text-xs">{months.length ? months.map(value => <option key={value} value={value}>{new Date(`${value}-02T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</option>) : <option>Sem competências</option>}</select></div>
    {!months.length ? <div className="rounded-lg border border-zinc-800 bg-[#14161b] p-8 text-center text-sm text-zinc-400">Não há dados financeiros para gerar o demonstrativo.</div> : <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric label="Receita arrecadada" value={money(flow.revenue)} icon={<Landmark className="w-4 h-4 text-emerald-500" />} detail={`${flow.billed ? ((flow.revenue / flow.billed) * 100).toFixed(1) : '0,0'}% do faturado`} />
        <Metric label="Despesas pagas" value={money(flow.paidExpenses)} icon={<Receipt className="w-4 h-4 text-red-400" />} detail={`${money(flow.payable)} a pagar`} />
        <Metric label="Saldo da competência" value={money(flow.revenue - flow.paidExpenses)} icon={<Scale className="w-4 h-4 text-sky-400" />} detail="Regime de caixa" />
        <Metric label="Inadimplência" value={`${flow.delinquency.toFixed(1)}%`} icon={<Percent className="w-4 h-4 text-amber-400" />} detail={`${money(flow.outstanding)} em aberto`} />
      </div>
      <div className="bg-[#14161b] rounded-xl p-6 border border-zinc-800 space-y-4"><h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-800 pb-2"><FileSpreadsheet className="w-4 h-4 text-[#10b981]" />DRE sintético da competência</h3><div className="space-y-3 text-xs text-zinc-400"><Row label="(+) Receitas efetivamente recebidas" value={flow.revenue} positive /><Row label="(-) Despesas efetivamente pagas" value={flow.paidExpenses} /><Row label="(=) Resultado líquido" value={flow.revenue - flow.paidExpenses} positive={flow.revenue >= flow.paidExpenses} strong /></div></div>
    </>}
  </div>;
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) { return <div className="bg-[#14161b] border border-zinc-800 rounded-xl p-5"><div className="flex justify-between text-zinc-500"><span className="text-[10px] uppercase font-bold">{label}</span>{icon}</div><div className="text-2xl font-bold text-white mt-2">{value}</div><span className="text-[10px] text-zinc-500 font-semibold">{detail}</span></div>; }
function Row({ label, value, positive = false, strong = false }: { label: string; value: number; positive?: boolean; strong?: boolean }) { return <div className={`flex justify-between p-2 rounded ${strong ? 'bg-[#0d0e12] border-t border-zinc-800 text-sm font-bold text-white' : ''}`}><span>{label}</span><span className={`${positive ? 'text-emerald-400' : 'text-red-400'} font-mono`}>{positive ? '' : '('}{money(value)}{positive ? '' : ')'}</span></div>; }
