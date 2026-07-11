import React, { useState } from 'react';
import { Calendar, CheckCircle2, AlertCircle, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { MaintenancePlan } from '../types';

interface MaintenancePlansProps {
  plans: MaintenancePlan[];
  onAddPlan: (newPlan: MaintenancePlan) => void;
  onToggleStatus: (planId: string) => void;
  onDeletePlan: (planId: string) => void;
}

export default function MaintenancePlans({
  plans,
  onAddPlan,
  onToggleStatus,
  onDeletePlan
}: MaintenancePlansProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<MaintenancePlan['frequency']>('monthly');
  const [nextOccurrence, setNextOccurrence] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().slice(0, 10);
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert('Preencha os dados do plano.');
      return;
    }
    const newPlan: MaintenancePlan = {
      id: `PLN-${String(plans.length + 1).padStart(2, '0')}`,
      title,
      description,
      frequency,
      nextOccurrence,
      status: 'active'
    };
    onAddPlan(newPlan);
    setShowAdd(false);
    setTitle('');
    setDescription('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
            <span className="text-emerald-500"><Calendar className="w-8 h-8" /></span>
            Planos de Manutenção Preventiva / Preditiva
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Gere regras, prazos e frentes contratuais para evitar panes emergenciais</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Plano
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.length === 0 && <div className="md:col-span-2 lg:col-span-3 p-8 text-center bg-[#14161b] border border-dashed border-zinc-700 rounded-xl text-sm text-zinc-500">Nenhum plano de manutenção cadastrado.</div>}
        {plans.map(p => (
          <div 
            key={p.id} 
            className={`p-5 rounded-xl border flex flex-col justify-between space-y-4 shadow-md transition-all ${
              p.status === 'active' 
                ? 'bg-[#14161b] border-zinc-800' 
                : 'bg-[#14161b]/50 border-zinc-900 opacity-60'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  {p.frequency}
                </span>
                <span className="text-[10px] font-mono text-zinc-500">{p.id}</span>
              </div>
              <h3 className="font-bold text-base text-white">{p.title}</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">{p.description}</p>
            </div>

            <div className="pt-3 border-t border-zinc-850/50 flex items-center justify-between text-xs">
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">Próxima Data</span>
                <span className="font-semibold text-zinc-350">{new Date(p.nextOccurrence).toLocaleDateString('pt-BR')}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleStatus(p.id)}
                  title={p.status === 'active' ? 'Suspender plano' : 'Ativar plano'}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  {p.status === 'active' ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[#10b981]">
                      Ativo <ToggleRight className="w-5 h-5" />
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
                      Inativo <ToggleLeft className="w-5 h-5" />
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePlan(p.id)}
                  className="text-zinc-600 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#14161b] rounded-xl border border-zinc-800 p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
              <h3 className="text-lg font-bold text-white">Criar Plano Preventivo</h3>
              <button onClick={() => setShowAdd(false)} className="text-zinc-400 text-sm font-mono">[Fechar]</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-zinc-400 block">Título do Plano</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Inspeção semestral para-raios SPDA"
                  className="w-full bg-[#0d0e12] border border-zinc-850 text-white rounded p-2 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block">Regulação / Descrição técnica</label>
                <textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva as tarefas exigidas pelo regulamento NBR..."
                  rows={3}
                  className="w-full bg-[#0d0e12] border border-zinc-850 text-white rounded p-2 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Frequência</label>
                  <select 
                    value={frequency} 
                    onChange={(e: any) => setFrequency(e.target.value)}
                    className="w-full p-2.5"
                  >
                    <option value="daily">Diária</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 block">Primeira Execução</label>
                  <input 
                    type="date" 
                    value={nextOccurrence} 
                    onChange={(e) => setNextOccurrence(e.target.value)}
                    className="w-full bg-[#0d0e12] border border-zinc-850 text-white rounded p-2"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-[#10b981] text-white font-bold uppercase rounded hover:bg-emerald-600 transition-colors"
              >
                Salvar e Ativar Plano
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
