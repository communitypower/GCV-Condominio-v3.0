import React, { useState } from 'react';
import { Landmark, FileSpreadsheet, Percent, Receipt, PieChart, ShieldCheck } from 'lucide-react';

export default function Demonstrativos() {
  const [selectedMonth, setSelectedMonth] = useState('04/2026');

  // Simulated indicators depending on selectedMonth
  const flow = {
    '04/2026': { revenue: 54300, expenses: 43200, reserve: 154000, delinquency: 4.8 },
    '03/2026': { revenue: 53200, expenses: 41800, reserve: 148000, delinquency: 5.2 },
    '02/2026': { revenue: 52400, expenses: 44100, reserve: 142000, delinquency: 6.1 },
  }[selectedMonth] || { revenue: 54300, expenses: 43200, reserve: 154000, delinquency: 4.8 };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
            <span className="text-[#10b981]"><Landmark className="w-8 h-8" /></span>
            Demonstrativos Financeiros & Balancete
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Inspeção de caixa, inadimplência técnica e alocações de fundos extras</p>
        </div>

        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-[#14161b] border border-zinc-800 text-white rounded-lg px-4 py-2.5 text-xs text-left"
        >
          <option value="04/2026">Demonstrativo Abril / 2026</option>
          <option value="03/2026">Demonstrativo Março / 2026</option>
          <option value="02/2026">Demonstrativo Fevereiro / 2026</option>
        </select>
      </div>

      {/* Boxes display */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Receita Box */}
        <div className="bg-[#14161b] border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] uppercase font-bold tracking-wider">Receita Arrecadada</span>
            <span className="text-emerald-500"><Landmark className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl font-bold text-white mt-2">{formatCurrency(flow.revenue)}</div>
          <span className="text-[10px] text-[#10b981] font-semibold mt-1">✔ 98.2% do cotado</span>
        </div>

        {/* Despesa Box */}
        <div className="bg-[#14161b] border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] uppercase font-bold tracking-wider">Despesas Totais</span>
            <span className="text-red-400"><Receipt className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl font-bold text-white mt-2">{formatCurrency(flow.expenses)}</div>
          <span className="text-[10px] text-zinc-500 font-semibold mt-1">Déficit: 0.00%</span>
        </div>

        {/* Fundo de Reserva Box */}
        <div className="bg-[#14161b] border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] uppercase font-bold tracking-wider">Fundo de Reserva (Poupado)</span>
            <span className="text-sky-400"><ShieldCheck className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl font-bold text-white mt-2">{formatCurrency(flow.reserve)}</div>
          <span className="text-[10px] text-sky-400 font-semibold mt-1">Rentabilidade Poupança</span>
        </div>

        {/* Inadimplência Box */}
        <div className="bg-[#14161b] border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] uppercase font-bold tracking-wider">Taxa de Inadimplência</span>
            <span className="text-[#fab01c]"><Percent className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl font-bold text-[#fab01c] mt-2">{flow.delinquency}%</div>
          <span className="text-[10px] text-zinc-500 font-semibold mt-1">Meta Máxima: 5.0%</span>
        </div>
      </div>

      {/* Graphic Pie Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#14161b] rounded-xl p-6 border border-zinc-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-850 pb-2">
            <FileSpreadsheet className="w-4 h-4 text-[#10b981]" />
            DRE Sintético {selectedMonth}
          </h3>

          <div className="space-y-3 font-semibold text-xs text-zinc-400">
            <div className="flex justify-between p-2 hover:bg-zinc-800/20 rounded">
              <span>(+) Taxas Ordinárias Coletadas</span>
              <span className="text-emerald-500 font-mono">{formatCurrency(flow.revenue * 0.9)}</span>
            </div>
            <div className="flex justify-between p-2 hover:bg-zinc-800/20 rounded">
              <span>(+) Multas e Juros por Atraso</span>
              <span className="text-emerald-500 font-mono">{formatCurrency(flow.revenue * 0.1)}</span>
            </div>
            <div className="flex justify-between p-2 hover:bg-zinc-800/20 rounded">
              <span>(-) Salários e Encargos de Funcionários</span>
              <span className="text-red-400 font-mono">({formatCurrency(flow.expenses * 0.45)})</span>
            </div>
            <div className="flex justify-between p-2 hover:bg-zinc-800/20 rounded">
              <span>(-) Consumo de Concessionárias (Água / Luz)</span>
              <span className="text-red-400 font-mono">({formatCurrency(flow.expenses * 0.35)})</span>
            </div>
            <div className="flex justify-between p-2 hover:bg-zinc-800/20 rounded">
              <span>(-) Contratos de Manutenção de Elevador/Gerador</span>
              <span className="text-red-400 font-mono">({formatCurrency(flow.expenses * 0.20)})</span>
            </div>
            <div className="flex justify-between p-2 bg-[#0d0e12] border-t border-zinc-800 text-sm font-bold text-white rounded">
              <span>Saldo Líquido Mensal</span>
              <span className="text-[#10b981] font-mono">{formatCurrency(flow.revenue - flow.expenses)}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#14161b] rounded-xl p-6 border border-zinc-800 flex flex-col justify-between">
          <div className="border-b border-zinc-850 pb-2">
            <h3 className="font-bold text-white text-sm">Distribuição de Recursos</h3>
            <p className="text-zinc-500 text-xs">Aplicações do fundo do condomínio</p>
          </div>

          <div className="h-44 flex items-center justify-center my-2">
            <svg viewBox="0 0 100 100" className="w-28 h-28 transform -rotate-90">
              {/* Pie SVG sectors */}
              {/* Personnel (45% -> #10b981) */}
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#10b981" strokeWidth="20" strokeDasharray="113.1 251.3" strokeDashoffset="0" />
              {/* Utility (35% -> #06b6d4) */}
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#06b6d4" strokeWidth="20" strokeDasharray="88.0 251.3" strokeDashoffset="-113.1" />
              {/* Maintenance (20% -> #fab01c) */}
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#fab01c" strokeWidth="20" strokeDasharray="50.2 251.3" strokeDashoffset="-201.1" />
            </svg>
          </div>

          <div className="text-[10px] space-y-1.5 font-semibold tracking-wide">
            <div className="flex items-center gap-1.5 text-[#10b981]">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span>Pessoal / Funcionários (45%)</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#06b6d4]">
              <span className="w-2 h-2 rounded-full bg-[#06b6d4]" />
              <span>Energia e Concessionárias (35%)</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#fab01c]">
              <span className="w-2 h-2 rounded-full bg-[#fab01c]" />
              <span>Manutenções em Geral (20%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
