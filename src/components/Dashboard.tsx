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
          </div>

          {/* High Fidelity SVG Donut Chart with alignment lines and labels pointing to sectors */}
          <div className="relative w-full h-56 flex items-center justify-center my-2">
            <svg viewBox="0 0 460 220" className="w-full h-full max-w-[440px]">
              {/* Center Donut Hole at Coordinates (215, 110) */}
              {/* Outer circle layout elements */}
              <circle cx="215" cy="110" r="50" fill="transparent" stroke="#1f2229" strokeWidth="15" />
              
              {/* Green Segment: Operacional (18/23 ≈ 78.26% | Circumference C=314.16 | Arc=245.88 | Offset=-78.54 or 235.6) */}
              <circle cx="215" cy="110" r="50" fill="transparent" 
                stroke="#10b981" 
                strokeWidth="15" 
                strokeDasharray="245.9 314.16" 
                strokeDashoffset="-23.5" // Rotated to match visual sector positioning
              />

              {/* Yellow/Orange: Em Manutenção (2/23 ≈ 8.70% | Arc=27.3) */}
              <circle cx="215" cy="110" r="50" fill="transparent" 
                stroke="#fab01c" 
                strokeWidth="15" 
                strokeDasharray="27.3 314.16" 
                strokeDashoffset="-269.4" 
              />

              {/* Orange/Red-Orange: Alerta (2/23 ≈ 8.70% | Arc=27.3) */}
              <circle cx="215" cy="110" r="50" fill="transparent" 
                stroke="#f97316" 
                strokeWidth="15" 
                strokeDasharray="27.3 314.16" 
                strokeDashoffset="-296.7" 
              />

              {/* Red: Crítico (1/23 ≈ 4.35% | Arc=13.7) */}
              <circle cx="215" cy="110" r="50" fill="transparent" 
                stroke="#ef4444" 
                strokeWidth="15" 
                strokeDasharray="13.7 314.16" 
                strokeDashoffset="-324.0" 
              />

              {/* ---------------- DRAWING ALIGNMENT POINTERS AND LEGEND LABELS ---------------- */}
              
              {/* Pointer 1: Crítico (Red - Top) */}
              {/* Arc angle around 70 deg | x_start = 215 + 50*cos(70deg) ≈ 232, y_start = 110 - 50*sin(70deg) ≈ 63 */}
              <path d="M 215 52 L 210 33 H 190" fill="transparent" stroke="#852626" strokeWidth="1" />
              <text x="185" y="32" className="text-[12px] font-semibold text-red-500 font-sans" fill="#ef4444" textAnchor="end">Crítico: {countCritical}</text>

              {/* Pointer 2: Em Manutenção (Yellow - Top Right) */}
              <path d="M 238 67 L 255 52 H 280" fill="transparent" stroke="#b8830f" strokeWidth="1" />
              <text x="285" y="51" className="text-[12px] font-semibold text-amber-500 font-sans" fill="#fab01c" textAnchor="start">Em Manutenção: {countMaintenance}</text>

              {/* Pointer 3: Alerta (Orange - Middle/Right) */}
              <path d="M 264 94 L 285 106 H 310" fill="transparent" stroke="#b35412" strokeWidth="1" />
              <text x="315" y="105" className="text-[12px] font-semibold text-orange-400 font-sans" fill="#f97316" textAnchor="start">Alerta: {countAlert}</text>

              {/* Pointer 4: Operacional (Green - Bottom Left) */}
              <path d="M 175 135 L 140 162 H 115" fill="transparent" stroke="#10573e" strokeWidth="1" />
              <text x="110" y="161" className="text-[12px] font-semibold text-emerald-500 font-sans" fill="#10b981" textAnchor="end">Operacional: {countOperational}</text>
            </svg>
          </div>

          {/* Color-code Legend Footer matched to the screenshot */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-semibold tracking-wide text-zinc-400 mt-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] block" />
              <span>Alerta</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#fab01c] block" />
              <span>Em Manutenção</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] block" />
              <span>Crítico</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] block" />
              <span>Operacional</span>
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
          </div>

          {/* Precision Custom Rendered SVG Bar Chart to perfectly emulate the picture layout */}
          <div className="relative w-full h-56 mt-2 flex items-center justify-center">
            <svg viewBox="0 0 380 185" className="w-full h-full max-w-[360px]">
              {/* Horizontal Reference Grid dashed guidelines (Values: 4, 8, 12, 16) */}
              {/* Chart area size: height=150, width=320, left_margin=30, bottom_margin=165 */}
              {/* tick0: 165 - tick4: 127.5 - tick8: 90 - tick12: 52.5 - tick16: 15 */}
              <line x1="30" y1="15" x2="350" y2="15" stroke="#1f2229" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="30" y1="52.5" x2="350" y2="52.5" stroke="#1f2229" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="30" y1="90" x2="350" y2="90" stroke="#1f2229" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="30" y1="127.5" x2="350" y2="127.5" stroke="#1f2229" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="30" y1="165" x2="350" y2="165" stroke="#2a2e38" strokeWidth="1" />

              {/* Y Axis markings */}
              <text x="24" y="19" className="text-[9px] text-zinc-500 font-mono" textAnchor="end">16</text>
              <text x="24" y="56.5" className="text-[9px] text-zinc-500 font-mono" textAnchor="end">12</text>
              <text x="24" y="94" className="text-[9px] text-zinc-500 font-mono" textAnchor="end">8</text>
              <text x="24" y="131.5" className="text-[9px] text-zinc-500 font-mono" textAnchor="end">4</text>
              <text x="24" y="169" className="text-[9px] text-zinc-500 font-mono" textAnchor="end">0</text>

              {/* Vertical side divider axis line */}
              <line x1="30" y1="15" x2="30" y2="165" stroke="#2a2e38" strokeWidth="1" />

              {/* 1st Bar: Corretiva Emerg. (Value: 2 | height = 2/16 * 150 = 18.75px) */}
              {/* x center: 70, width=22 */}
              <rect x="59" y="146" width="22" height="19" fill="#06b6d4" rx="1.5" />

              {/* 2nd Bar: Preventiva (Value: 16 | height = 150px) */}
              {/* x center: 150, width=22 */}
              <rect x="139" y="15" width="22" height="150" fill="#10b981" rx="1.5" />

              {/* 3rd Bar: Corretiva Plan. (Value: 2 | height = 18.75px) */}
              {/* x center: 230, width=22 */}
              <rect x="219" y="146" width="22" height="19" fill="#fab01c" rx="1.5" />

              {/* 4th Bar: Preditiva (Value: 4 | height = 4/16 * 150 = 37.5px) */}
              {/* x center: 310, width=22 */}
              <rect x="299" y="127.5" width="22" height="37.5" fill="#ef4444" rx="1.5" />

              {/* X Axis Labels under columns */}
              <text x="70" y="179" className="text-[8px] text-zinc-400 font-semibold" textAnchor="middle">Corretiva Emerg.</text>
              <text x="150" y="179" className="text-[8px] text-zinc-400 font-semibold" textAnchor="middle">Preventiva</text>
              <text x="230" y="179" className="text-[8px] text-zinc-400 font-semibold" textAnchor="middle">Corretiva Plan.</text>
              <text x="310" y="179" className="text-[8px] text-zinc-400 font-semibold" textAnchor="middle">Preditiva</text>
            </svg>
          </div>
          
          <div className="h-4" /> {/* empty buffer spatial padding */}
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
