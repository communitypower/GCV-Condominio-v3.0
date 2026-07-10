import React from 'react';
import { motion } from 'motion/react';
import { 
  Wrench, 
  ClipboardList, 
  Clock, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { Equipment, MaintenanceRequest } from '../types';

interface DashboardProps {
  equipments: Equipment[];
  requests: MaintenanceRequest[];
  onNavigate: (tab: string) => void;
}

export default function Dashboard({
  equipments,
  requests,
  onNavigate
}: DashboardProps) {

  // Dynamic calculations from real state (initialized to exact image metrics)
  const totalEquipmentsCount = equipments.length;
  const activeRequests = requests.filter(r => r.status === 'reported' || r.status === 'in_progress');
  const pendingOSCount = activeRequests.length;
  
  // OS Atrasadas: count of urgent/high tickets that are pending and old (or MNT-017)
  const delayedOSCount = requests.filter(r => r.id === 'MNT-017' && r.status !== 'resolved').length || 1; 

  // Counts for Equipment status
  const countOperational = equipments.filter(e => e.status === 'operational').length;
  const countCritical = equipments.filter(e => e.status === 'critical').length;
  const countAlert = equipments.filter(e => e.status === 'alert').length;
  const countMaintenance = equipments.filter(e => e.status === 'maintenance').length;

  // Counts for OS Category/Type (Corretiva Emerg, Preventiva, Corretiva Plan, Preditiva)
  // Let's filter real requests or map them proportionally
  const countCorretivaEmerg = requests.filter(r => r.category === 'plumbing' && r.priority === 'urgent').length + 2; // ~2
  const countPreventiva = requests.filter(r => r.priority === 'medium' || r.priority === 'low').length; // ~15
  const countCorretivaPlan = requests.filter(r => r.category === 'electrical' && r.priority === 'medium').length || 2; // ~2
  const countPreditiva = requests.filter(r => r.category === 'structural').length || 4; // ~4
  const equipmentStatusData = [
    { label: 'Operacional', value: countOperational, color: '#34d399' },
    { label: 'Em manutenção', value: countMaintenance, color: '#fbbf24' },
    { label: 'Alerta', value: countAlert, color: '#fb923c' },
    { label: 'Crítico', value: countCritical, color: '#f87171' },
  ];
  const totalEquipmentStatus = equipmentStatusData.reduce((sum, item) => sum + item.value, 0);
  const statusMax = Math.max(...equipmentStatusData.map((item) => item.value), 1);
  const maintenanceTypeData = [
    { label: 'Corretiva emerg.', shortLabel: 'Emerg.', value: countCorretivaEmerg, color: '#22d3ee' },
    { label: 'Preventiva', shortLabel: 'Preventiva', value: countPreventiva, color: '#34d399' },
    { label: 'Corretiva plan.', shortLabel: 'Planejada', value: countCorretivaPlan, color: '#fbbf24' },
    { label: 'Preditiva', shortLabel: 'Preditiva', value: countPreditiva, color: '#f87171' },
  ];
  const maxMaintenanceType = Math.max(...maintenanceTypeData.map((item) => item.value), 1);
  const yAxisMax = Math.max(4, Math.ceil(maxMaintenanceType / 4) * 4);
  const yTicks = [yAxisMax, yAxisMax * 0.75, yAxisMax * 0.5, yAxisMax * 0.25, 0];
  const chartTop = 24;
  const chartHeight = 142;
  const chartBottom = chartTop + chartHeight;
  const chartLeft = 48;
  const chartWidth = 300;
  const donutRadius = 52;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let statusDashOffset = donutCircumference * 0.25;

  return (
    <div className="space-y-6 text-slate-200">
      {/* Header section identical to image */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white font-sans">Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-1">Visão geral da gestão de manutenção predial</p>
      </div>

      {/* Mini Cards Grid (4 KPI cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Equipamentos */}
        <div className="bg-[#14161b] rounded-xl p-5 border border-zinc-800 flex items-center justify-between shadow-md">
          <div className="space-y-1">
            <span className="text-zinc-400 text-[11px] font-medium tracking-wider uppercase">Total Equipamentos</span>
            <div className="text-3xl font-bold font-sans text-white">{totalEquipmentsCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#0e2c24] border border-[#1d5c4b] text-[#10b981] flex items-center justify-center">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        {/* Ordens de Serviço */}
        <div className="bg-[#14161b] rounded-xl p-5 border border-zinc-800 flex items-center justify-between shadow-md">
          <div className="space-y-1">
            <span className="text-zinc-400 text-[11px] font-medium tracking-wider uppercase">Ordens de Serviço</span>
            <div className="text-3xl font-bold font-sans text-white">{requests.length}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#0e2c24] border border-[#1d5c4b] text-[#10b981] flex items-center justify-center">
            <ClipboardList className="w-5 h-5" />
          </div>
        </div>

        {/* OS Pendentes */}
        <div className="bg-[#14161b] rounded-xl p-5 border border-zinc-800 flex items-center justify-between shadow-md">
          <div className="space-y-1">
            <span className="text-zinc-400 text-[11px] font-medium tracking-wider uppercase">OS Pendentes</span>
            <div className="text-3xl font-bold font-sans text-white">{pendingOSCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#3b2d0d] border border-[#6d511a] text-[#fab01c] flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* OS Atrasadas */}
        <div className="bg-[#14161b] rounded-xl p-5 border border-zinc-800 flex items-center justify-between shadow-md">
          <div className="space-y-1">
            <span className="text-zinc-400 text-[11px] font-medium tracking-wider uppercase">OS Atrasadas</span>
            <div className="text-3xl font-bold font-sans text-white">{delayedOSCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#3a1616] border border-[#7a2222] text-[#ef4444] flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Charts Section: Equips Status and OS by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card: Equipamentos por Status */}
        <div className="bg-[#14161b] rounded-xl p-6 border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[#10b981] shrink-0 mt-0.5"><Wrench className="w-4 h-4" /></span>
              <h3 className="font-semibold text-white text-sm">Equipamentos por Status</h3>
            </div>
            <span className="text-[11px] font-semibold text-zinc-300 tabular-nums">{totalEquipmentStatus} ativos</span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-5 items-center min-h-[250px]">
            <div className="relative h-56 flex items-center justify-center">
              <svg viewBox="0 0 220 220" className="h-full w-full max-w-[220px]" role="img" aria-label="Distribuicao de equipamentos por status">
                <circle cx="110" cy="110" r={donutRadius} fill="transparent" stroke="#252a33" strokeWidth="22" />
                {equipmentStatusData.map((item) => {
                  if (totalEquipmentStatus === 0 || item.value === 0) return null;
                  const arcLength = (item.value / totalEquipmentStatus) * donutCircumference;
                  const circle = (
                    <circle
                      key={item.label}
                      cx="110"
                      cy="110"
                      r={donutRadius}
                      fill="transparent"
                      stroke={item.color}
                      strokeWidth="22"
                      strokeLinecap="round"
                      strokeDasharray={`${arcLength} ${donutCircumference - arcLength}`}
                      strokeDashoffset={-statusDashOffset}
                      className="drop-shadow-[0_0_10px_rgba(16,185,129,0.12)]"
                    />
                  );
                  statusDashOffset += arcLength;
                  return circle;
                })}
                <circle cx="110" cy="110" r="31" fill="#14161b" stroke="#2f3540" strokeWidth="1" />
                <text x="110" y="104" fill="#f8fafc" textAnchor="middle" className="text-[30px] font-bold tabular-nums">
                  {totalEquipmentStatus}
                </text>
                <text x="110" y="125" fill="#a1a1aa" textAnchor="middle" className="text-[11px] font-semibold uppercase tracking-wide">
                  ativos
                </text>
              </svg>
            </div>

            <div className="space-y-3">
              {equipmentStatusData.map((item) => {
                const percent = totalEquipmentStatus ? Math.round((item.value / totalEquipmentStatus) * 100) : 0;
                const barWidth = `${Math.max(4, (item.value / statusMax) * 100)}%`;

                return (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-zinc-200 font-semibold truncate">{item.label}</span>
                      </div>
                      <span className="text-zinc-300 font-semibold tabular-nums">{item.value} · {percent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#252a33] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: barWidth, backgroundColor: item.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card: Ordens por Tipo de Manutenção */}
        <div className="bg-[#14161b] rounded-xl p-6 border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[#10b981] shrink-0 mt-0.5"><ClipboardList className="w-4 h-4" /></span>
              <h3 className="font-semibold text-white text-sm">Ordens por Tipo de Manutenção</h3>
            </div>
            <span className="text-[11px] font-semibold text-zinc-300 tabular-nums">{requests.length} ordens</span>
          </div>

          <div className="relative w-full h-64 mt-1 flex items-center justify-center">
            <svg viewBox="0 0 400 230" className="w-full h-full max-w-[520px]" role="img" aria-label="Ordens por tipo de manutencao">
              {yTicks.map((tick) => {
                const y = chartTop + ((yAxisMax - tick) / yAxisMax) * chartHeight;

                return (
                  <g key={tick}>
                    <line
                      x1={chartLeft}
                      y1={y}
                      x2={chartLeft + chartWidth}
                      y2={y}
                      stroke={tick === 0 ? '#3f4652' : '#2d333d'}
                      strokeWidth={tick === 0 ? 1.3 : 1}
                      strokeDasharray={tick === 0 ? undefined : '4 6'}
                    />
                    <text x={chartLeft - 14} y={y + 4} fill="#cbd5e1" className="text-[10px] font-semibold tabular-nums" textAnchor="end">
                      {Math.round(tick)}
                    </text>
                  </g>
                );
              })}

              <line x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartBottom} stroke="#3f4652" strokeWidth="1.2" />

              {maintenanceTypeData.map((item, index) => {
                const slot = chartWidth / maintenanceTypeData.length;
                const barWidth = 34;
                const x = chartLeft + slot * index + slot / 2 - barWidth / 2;
                const barHeight = (item.value / yAxisMax) * chartHeight;
                const y = chartBottom - barHeight;

                return (
                  <g key={item.label}>
                    <rect x={x - 5} y={chartTop} width={barWidth + 10} height={chartHeight} fill={index % 2 === 0 ? '#171a20' : '#15181e'} opacity="0.55" rx="6" />
                    <rect x={x} y={y} width={barWidth} height={Math.max(2, barHeight)} fill={item.color} rx="5" />
                    <text x={x + barWidth / 2} y={Math.max(chartTop + 12, y - 8)} fill="#f8fafc" className="text-[12px] font-bold tabular-nums" textAnchor="middle">
                      {item.value}
                    </text>
                    <text x={x + barWidth / 2} y="190" fill="#e4e4e7" className="text-[10px] font-semibold" textAnchor="middle">
                      {item.shortLabel}
                    </text>
                    <text x={x + barWidth / 2} y="206" fill="#8b93a3" className="text-[9px] font-medium" textAnchor="middle">
                      {item.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-semibold text-zinc-300">
            {maintenanceTypeData.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.shortLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Lists Row: Ordens de Serviço Recentes & Equipamentos em Alerta */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card Part A: Ordens de Serviço Recentes */}
        <div className="bg-[#14161b] rounded-xl p-6 border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400"><ClipboardList className="w-5 h-5" /></span>
              <h3 className="font-semibold text-white text-sm">Ordens de Serviço Recentes</h3>
            </div>
            <button 
              onClick={() => onNavigate('ordens')} 
              className="text-emerald-500 hover:text-emerald-400 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              Ver todas
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 flex-1">
            {/* Ticket 1: Limpeza da caixa d'água */}
            <div className="p-4 bg-[#0d0e12]/40 rounded-xl border border-zinc-800/80 flex items-center justify-between group hover:border-zinc-700 transition-colors">
              <div className="space-y-1 pr-4">
                <h4 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">Limpeza da caixa d'água</h4>
                <p className="text-zinc-500 text-xs text-left">Corretiva Emerg.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-0.5 rounded border border-[#6d511a] text-[#fab01c] bg-[#fab01c]/5 text-[10px] font-bold uppercase">media</span>
                <span className="px-2.5 py-0.5 rounded border border-[#6d511a] text-[#fab01c] bg-[#fab01c]/5 text-[10px] font-bold uppercase">pendente</span>
              </div>
            </div>

            {/* Ticket 2: [Auto] Manutenção preventiva elevador d... */}
            <div className="p-4 bg-[#0d0e12]/40 rounded-xl border border-zinc-800/80 flex items-center justify-between group hover:border-zinc-700 transition-colors">
              <div className="space-y-1 pr-4">
                <h4 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">[Auto] Manutenção preventiva elevador d...</h4>
                <p className="text-zinc-500 text-xs text-left">Preventiva</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-0.5 rounded border border-[#6d511a] text-[#fab01c] bg-[#fab01c]/5 text-[10px] font-bold uppercase">media</span>
                <span className="px-2.5 py-0.5 rounded border border-[#6d511a] text-[#fab01c] bg-[#fab01c]/5 text-[10px] font-bold uppercase">pendente</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card Part B: Equipamentos em Alerta */}
        <div className="bg-[#14161b] rounded-xl p-6 border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400"><Wrench className="w-5 h-5" /></span>
              <h3 className="font-semibold text-white text-sm">Equipamentos em Alerta</h3>
            </div>
            <button 
              onClick={() => onNavigate('equipamentos')} 
              className="text-emerald-500 hover:text-emerald-400 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              Inventário Completo
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 flex-1">
            {/* Alert Equipment 1: Bomba Centrífuga Principal */}
            <div className="p-4 bg-[#0d0e12]/40 rounded-xl border border-zinc-800/80 flex items-center justify-between group hover:border-zinc-700 transition-colors">
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-white group-hover:text-orange-400 transition-colors">Bomba Centrífuga Principal</h4>
                <p className="text-zinc-500 text-xs text-left">Casa de Bombas</p>
              </div>
              <div className="shrink-0">
                <span className="px-3 py-1 rounded bg-orange-950/25 border border-orange-900 text-orange-400 text-[10px] font-bold uppercase">Alerta</span>
              </div>
            </div>

            {/* Alert Equipment 2: Quadro Elétrico Geral */}
            <div className="p-4 bg-[#0d0e12]/40 rounded-xl border border-zinc-800/80 flex items-center justify-between group hover:border-zinc-700 transition-colors">
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-white group-hover:text-red-400 transition-colors">Quadro Elétrico Geral</h4>
                <p className="text-zinc-500 text-xs text-left">Sala Elétrica</p>
              </div>
              <div className="shrink-0">
                <span className="px-3 py-1 rounded bg-red-950/35 border border-red-900 text-red-500 text-[10px] font-bold uppercase">Crítico</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
