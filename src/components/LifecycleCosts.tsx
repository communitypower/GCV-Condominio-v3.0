import React, { useState } from 'react';
import { AreaChart, TrendingUp, ShieldAlert, DollarSign, Sliders, CheckCircle } from 'lucide-react';
import { Equipment, MaintenancePlan } from '../types';

export default function LifecycleCosts({ equipments, plans }: { equipments: Equipment[]; plans: MaintenancePlan[] }) {
  const [strategy, setStrategy] = useState<'preventive' | 'reactive'>('preventive');
  const [inflationRate, setInflationRate] = useState<number>(4.5); // % inflation slider

  // Years 1 to 10 projections
  // Strategy: Preventive (higher immediate cost, stable low replacement)
  // Strategy: Reactive (low immediate cost, massive failures in year 5+)
  const years = Array.from({ length: 10 }, (_, i) => i + 1);

  const calculateYearlyCost = (year: number) => {
    const multiplier = 1 + (inflationRate / 100) * (year - 1);
    const assetBase = equipments.length * 1000;
    const planBase = plans.filter(plan => plan.status === 'active').length * 1500;
    
    if (strategy === 'preventive') {
      // Steady annual maintenance around 18k base
      const upkeep = (assetBase + planBase) * multiplier;
      // Small sporadic replacement
      const replacement = (year === 5 || year === 9) ? equipments.length * 2500 * multiplier : 0;
      return upkeep + replacement;
    } else {
      // Reactive strategy charges lower initially (8k) but backloaded disasters
      const upkeep = equipments.length * 700 * multiplier;
      let replacement = 0;
      if (year >= 4) {
        // High unexpected breakdown costs
        replacement = (year * equipments.length * 1800) * multiplier;
      }
      return upkeep + replacement;
    }
  };

  const cumulativeCostsList = years.reduce((acc, year) => {
    const yrCost = calculateYearlyCost(year);
    const prev = acc.length > 0 ? acc[acc.length - 1] : 0;
    acc.push(prev + yrCost);
    return acc;
  }, [] as number[]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  // Find max value for SVG auto-scaling
  const maxCumulative = cumulativeCostsList[9];

  if (equipments.length === 0 && plans.length === 0) {
    return <div className="space-y-6"><div><h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2"><AreaChart className="w-8 h-8 text-[#10b981]" />Gestão de Custo de Ciclo de Vida (LCC)</h1><p className="text-zinc-400 text-sm mt-1">Projeções do condomínio ativo</p></div><div className="min-h-64 bg-[#14161b] border border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center text-center p-8"><AreaChart className="w-10 h-10 text-zinc-600 mb-3" /><h2 className="text-white font-semibold">Sem base técnica para projeção</h2><p className="text-zinc-500 text-sm mt-1">Cadastre equipamentos e planos de manutenção para calcular o ciclo de vida.</p></div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
          <span className="text-[#10b981]"><AreaChart className="w-8 h-8" /></span>
          Gestão de Custo de Ciclo de Vida (LCC)
        </h1>
        <p className="text-zinc-400 text-sm mt-1">Planeje o plano decenal condominial e previna sinistros financeiros</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenario Strategy Controls */}
        <div className="bg-[#14161b] rounded-xl p-5 border border-zinc-800 space-y-5 h-fit">
          <div className="border-b border-zinc-850 pb-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-emerald-500" />
              Parâmetros do Cenário
            </h3>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-zinc-400 font-semibold block">Estratégia de Engenharia</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button 
                onClick={() => setStrategy('preventive')}
                className={`py-2 px-3 rounded text-left border transition-all ${strategy === 'preventive' ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/50 font-bold' : 'bg-[#0d0e12] border-zinc-850 text-zinc-500'}`}
              >
                🛡️ Preventiva Focada
              </button>
              <button 
                onClick={() => setStrategy('reactive')}
                className={`py-2 px-3 rounded text-left border transition-all ${strategy === 'reactive' ? 'bg-red-500/10 text-red-400 border-red-500/40 font-bold' : 'bg-[#0d0e12] border-zinc-850 text-zinc-500'}`}
              >
                🔥 Reativa Corretiva
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-zinc-400">Taxa de Inflação das Peças</span>
              <span className="text-white font-mono">{inflationRate.toFixed(1)}% / ao ano</span>
            </div>
            <input 
              type="range" 
              min="1.0" 
              max="12.0" 
              step="0.5"
              value={inflationRate} 
              onChange={(e) => setInflationRate(parseFloat(e.target.value))} 
              className="w-full accent-[#10b981]" 
            />
          </div>

          <div className="p-4 bg-[#0d0e12] border border-zinc-855 rounded-lg space-y-2 text-xs">
            <h4 className="font-bold text-white">Análise Preliminar</h4>
            {strategy === 'preventive' ? (
              <p className="text-zinc-400 leading-relaxed">
                Recomendado pela NBR 5674. Mantém revisões fixas, evitando multas e incidentes de perigo. O desembolso no ano 1 é maior, mas o valor de revenda do condomínio aumenta em até 15%.
              </p>
            ) : (
              <p className="text-red-400 leading-relaxed">
                Risco de Sinistro Alto. Os primeiros 3 anos economizam, mas a partir do ano 4 as falhas de motores de bombas, rachaduras de garagens e panes de geradores geram rateios extras agressivos!
              </p>
            )}
          </div>
        </div>

        {/* 10 Year Cumulative Budget Line Graph */}
        <div className="lg:col-span-2 bg-[#14161b] rounded-xl p-6 border border-zinc-800 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#10b981]" />
              Esquema Decenal Acumulado (Anos 1 a 10)
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">Valor Acumulado Final: <strong>{formatCurrency(maxCumulative)}</strong></span>
          </div>

          {/* Line Chart Draw Area */}
          <div className="relative h-60 w-full flex items-center justify-center bg-[#0d0e12] border border-zinc-850 rounded-xl p-4">
            <svg viewBox="0 0 360 180" className="w-full h-full">
              {/* Guidelines */}
              <line x1="30" y1="20" x2="350" y2="20" stroke="#1f2229" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="30" y1="65" x2="350" y2="65" stroke="#1f2229" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="30" y1="110" x2="350" y2="110" stroke="#1f2229" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="30" y1="155" x2="350" y2="155" stroke="#222631" strokeWidth="1" />

              {/* X coordinates range from 30 to 350. (step = 320 / 9 = 35.5) */}
              {/* Y coordinates range from 155 to 20 based on value vs maxCumulative */}
              {/* Plot dots & line */}
              {(() => {
                const points = cumulativeCostsList.map((val, idx) => {
                  const x = 30 + idx * 35.5;
                  const ratio = maxCumulative > 0 ? val / maxCumulative : 0;
                  const y = 155 - ratio * 135;
                  return { x, y, value: val };
                });

                const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                const fillD = `${pathD} L 350 155 L 30 155 Z`;

                return (
                  <g>
                    {/* Filled Area */}
                    <path d={fillD} fill={strategy === 'preventive' ? 'url(#greenGrad)' : 'url(#redGrad)'} opacity="0.1" />
                    {/* Core Line */}
                    <path d={pathD} fill="transparent" stroke={strategy === 'preventive' ? '#10b981' : '#ef4444'} strokeWidth="2" />
                    
                    {/* Render helper handles */}
                    {points.map((p, i) => (
                      <g key={i} className="group">
                        <circle cx={p.x} cy={p.y} r="3" fill="#14161b" stroke={strategy === 'preventive' ? '#10b981' : '#ef4444'} strokeWidth="2" />
                        <text x={p.x} y={p.y - 8} className="text-[7px] font-mono fill-zinc-400 font-bold opacity-0 group-hover:opacity-100" textAnchor="middle">
                          {Math.round(p.value / 1000)}k
                        </text>
                      </g>
                    ))}
                  </g>
                );
              })()}

              <defs>
                <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Axis markers */}
              <text x="30" y="167" className="text-[7px] fill-zinc-500 font-mono" textAnchor="middle">Ano 1</text>
              <text x="136.5" y="167" className="text-[7px] fill-zinc-500 font-mono" textAnchor="middle">Ano 4</text>
              <text x="243" y="167" className="text-[7px] fill-zinc-500 font-mono" textAnchor="middle">Ano 7</text>
              <text x="350" y="167" className="text-[7px] fill-zinc-500 font-mono" textAnchor="middle">Ano 10</text>
            </svg>
          </div>

          {/* Quick Metrics Indicators */}
          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3 bg-[#0d0e12] rounded-lg border border-zinc-850 flex items-center justify-between">
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Total Gasto decenal</span>
                <span className="text-lg font-bold text-white">{formatCurrency(maxCumulative)}</span>
              </div>
              <span className="text-[#10b981]"><CheckCircle className="w-5 h-5" /></span>
            </div>

            <div className="p-3 bg-[#0d0e12] rounded-lg border border-zinc-850 flex items-center justify-between">
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Rateio Extra Médio</span>
                <span className={`text-lg font-bold ${strategy === 'preventive' ? 'text-[#10b981]' : 'text-red-400'}`}>
                  {strategy === 'preventive' ? 'R$ 0,00' : `${formatCurrency(maxCumulative / 120)} /mês`}
                </span>
              </div>
              <span className={strategy === 'preventive' ? 'text-zinc-650' : 'text-red-400 animate-pulse'}>
                <ShieldAlert className="w-5 h-5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
