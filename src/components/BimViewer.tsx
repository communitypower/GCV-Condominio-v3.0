import React, { useState } from 'react';
import { Layers, Box, Info, Shield, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { Equipment, MaintenanceRequest } from '../types';

interface BimViewerProps {
  equipments: Equipment[];
  requests: MaintenanceRequest[];
}

export default function BimViewer({
  equipments,
  requests
}: BimViewerProps) {
  const [selectedBlock, setSelectedBlock] = useState<'A' | 'B' | 'C' | 'all'>('all');
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);

  // Filter systems on selected Block
  const blockEquipments = selectedBlock === 'all' 
    ? equipments 
    : equipments.filter(e => e.location.includes(selectedBlock === 'A' ? 'Bloco A' : selectedBlock === 'B' ? 'Bloco B' : 'Casas'));

  const blockRequests = selectedBlock === 'all' 
    ? requests 
    : requests.filter(r => r.unitId.includes(selectedBlock === 'A' ? 'A-' : selectedBlock === 'B' ? 'B-' : 'C-'));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
          <span className="text-[#10b981]"><Box className="w-8 h-8" /></span>
          Visualizador BIM Integrado
        </h1>
        <p className="text-zinc-400 text-sm mt-1">Navegue na malha tridimensional e isométrica dos ativos e andares das estruturas prediais</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: 3D Isometric SVG and floor controller */}
        <div className="bg-[#14161b] rounded-xl p-6 border border-zinc-800 lg:col-span-2 flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-zinc-850">
            <span className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-500" />
              Projeção Isométrica das Torres
            </span>
            <div className="flex gap-1.5 text-xs text-white">
              <button 
                onClick={() => setSelectedBlock('all')}
                className={`px-3 py-1 rounded-md transition-all ${selectedBlock === 'all' ? 'bg-[#10b981] text-white font-bold' : 'bg-zinc-800 hover:bg-zinc-700'}`}
              >
                Geral
              </button>
              <button 
                onClick={() => setSelectedBlock('A')}
                className={`px-3 py-1 rounded-md transition-all ${selectedBlock === 'A' ? 'bg-[#10b981] text-white font-bold' : 'bg-zinc-800 hover:bg-zinc-700'}`}
              >
                Bloco A
              </button>
              <button 
                onClick={() => setSelectedBlock('B')}
                className={`px-3 py-1 rounded-md transition-all ${selectedBlock === 'B' ? 'bg-[#10b981] text-white font-bold' : 'bg-zinc-800 hover:bg-zinc-700'}`}
              >
                Bloco B
              </button>
            </div>
          </div>

          {/* Isometric SVG Drawing of the building */}
          <div className="h-80 flex items-center justify-center bg-[#0d0e12] rounded-xl relative overflow-hidden border border-zinc-850">
            {/* Interactive hovering indicators */}
            <div className="absolute top-4 left-4 bg-[#14161b]/95 border border-zinc-800 rounded p-3 text-[10px] space-y-1.5 text-zinc-400 max-w-xs z-10 shadow-2xl">
              <div className="flex items-center gap-1.5 text-white font-bold">
                <Info className="w-3.5 h-3.5 text-emerald-400" />
                Interação Ativa
              </div>
              <p className="leading-relaxed">Passe o mouse sobre os pavimentos hidráulicos ou elétricos isométricos para ler diagnósticos de ativos.</p>
            </div>

            <svg viewBox="0 0 400 280" className="w-full h-full max-w-[420px]">
              {/* ISOMETRIC COORDINATES:
                  Transform isometric grid points (X, Y, Z) to screen (u, v)
                  u = 200 + dx*cos(30) - dy*cos(30)
                  v = 140 - dz - dx*sin(30) - dy*sin(30)
              */}

              {/* Floor 3 (Cobertura - Laje técnica das caldeiras e reservatórios) */}
              <g 
                className="cursor-pointer transition-all hover:opacity-100 opacity-80"
                onMouseEnter={() => setHoveredFloor(3)}
                onMouseLeave={() => setHoveredFloor(null)}
              >
                {/* Isometric Prism for Roof Floor */}
                <path d="M 200 40 L 280 80 L 200 120 L 120 80 Z" 
                  fill={hoveredFloor === 3 ? "#0f4234" : "#1a1c22"} 
                  stroke="#10b981" 
                  strokeWidth={hoveredFloor === 3 ? "2" : "1"} 
                />
                <text x="200" y="85" className="text-[10px] fill-zinc-400 font-bold" textAnchor="middle">COBERTURA (Laje Técnica)</text>
              </g>

              {/* Connecting Pillar guidelines */}
              <line x1="120" y1="80" x2="120" y2="150" stroke="#22252e" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="280" y1="80" x2="280" y2="150" stroke="#22252e" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="200" y1="120" x2="200" y2="190" stroke="#22252e" strokeWidth="1" strokeDasharray="2 2" />

              {/* Floor 2 (Apartamentos Altos - Penthouse / 3º ao 2º andar) */}
              <g 
                className="cursor-pointer transition-all hover:opacity-100 opacity-70"
                onMouseEnter={() => setHoveredFloor(2)}
                onMouseLeave={() => setHoveredFloor(null)}
              >
                <path d="M 200 100 L 280 140 L 200 180 L 120 140 Z" 
                  fill={hoveredFloor === 2 ? "#0e3a35" : "#14161b"} 
                  stroke="#009267" 
                  strokeWidth={hoveredFloor === 2 ? "2" : "1"} 
                />
                <text x="200" y="145" className="text-[10px] fill-zinc-500 font-medium" textAnchor="middle">PAVIMENTO 2 (Residenciais)</text>
              </g>

              {/* Connecting Pillars */}
              <line x1="120" y1="140" x2="120" y2="210" stroke="#22252e" strokeWidth="1" />
              <line x1="280" y1="140" x2="280" y2="210" stroke="#22252e" strokeWidth="1" />
              <line x1="200" y1="180" x2="200" y2="250" stroke="#22252e" strokeWidth="1" />

              {/* Floor 1 (Térreo / Subsolo - Casa de Bombas, Gerador, Garagem) */}
              <g 
                className="cursor-pointer transition-all hover:opacity-100 opacity-90"
                onMouseEnter={() => setHoveredFloor(1)}
                onMouseLeave={() => setHoveredFloor(null)}
              >
                <path d="M 200 160 L 280 200 L 200 240 L 120 200 Z" 
                  fill={hoveredFloor === 1 ? "#3c1616" : "#1a161b"} 
                  stroke="#ef4444" 
                  strokeWidth={hoveredFloor === 1 ? "2" : "1.5"} 
                />
                <text x="200" y="205" className="text-[10px] fill-red-400 font-bold" textAnchor="middle">SUBSOLO & TÉRREO (Área Crítica)</text>
              </g>
            </svg>

            {/* Display hovered element details */}
            {hoveredFloor && (
              <div className="absolute bottom-4 right-4 bg-[#14161b]/95 border border-zinc-800 text-xs p-3 rounded shadow-xl animate-bounce">
                {hoveredFloor === 3 && (
                  <div className="space-y-1">
                    <p className="font-bold text-white">Laje Técnica - Cobertura</p>
                    <p className="text-zinc-400">Ativos: Caldeiras, Pressurizadores.</p>
                    <p className="text-emerald-400 font-semibold">Inspeção regular em dia.</p>
                  </div>
                )}
                {hoveredFloor === 2 && (
                  <div className="space-y-1">
                    <p className="font-bold text-white">Pavimento Central - Apartamentos</p>
                    <p className="text-zinc-400">Ativos: Elevadores, Distribuição.</p>
                    <p className="text-[#fab01c] font-semibold">1 chamado aberto (MNT-003).</p>
                  </div>
                )}
                {hoveredFloor === 1 && (
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-red-400">Subsolo - Casa de Máquinas</p>
                    <p className="text-zinc-300">Ativos cruciais: Gerador, Quadro Geral, Bombas d'Água.</p>
                    <p className="text-red-500 font-extrabold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                      ALERTA: Quadro Geral Crítico!
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right column: BIM Context details and metrics */}
        <div className="bg-[#14161b] rounded-xl p-6 border border-zinc-800 space-y-4">
          <div className="border-b border-zinc-850 pb-2">
            <h3 className="font-bold text-white text-base">Controle de Engenharia</h3>
            <p className="text-zinc-500 text-xs">Informações cadastrais e vistorias</p>
          </div>

          <div className="p-4 bg-[#0d0e12] rounded-lg border border-zinc-850 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Área Construída</span>
              <span className="font-bold text-white">4.850,22 m²</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Ano do Projeto Executivo</span>
              <span className="font-bold text-white">2020 (LOD 400)</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Torres Ativas no Projeto</span>
              <span className="font-bold text-white">02 (Bloco A e B)</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Eficiência Energética</span>
              <span className="font-bold text-[#10b981]">Classe A (Procel)</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase text-zinc-400">Equipamentos no Escopo ({blockEquipments.length})</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs">
              {blockEquipments.slice(0, 6).map(eq => (
                <div key={eq.id} className="p-2.5 bg-[#0d0e12]/50 border border-zinc-850 rounded flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-white block truncate max-w-[150px]">{eq.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">{eq.id} • {eq.location}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    eq.status === 'operational' ? 'bg-[#10b981]/10 text-[#10b981]' :
                    eq.status === 'critical' ? 'bg-red-550/10 text-red-400' : 'bg-orange-550/10 text-orange-400'
                  }`}>
                    {eq.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
