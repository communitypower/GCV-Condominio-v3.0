import React from 'react';
import { ShieldCheck, Mail, Phone, Users, Briefcase } from 'lucide-react';

export default function UsersList() {
  const users = [
    { name: 'Cassiano Marins', role: 'Administrador Geral / Síndico Professional', email: 'cassiano.marins@gcvcondo.com.br', phone: '(11) 98011-2233', status: 'Ativo' },
    { name: 'Geraldo Nascimento', role: 'Zelador Predial Residente', email: 'geraldo.zeladoria@gcvcondo.com.br', phone: '(11) 97322-4411', status: 'Ativo' },
    { name: 'Ronaldo Fontes', role: 'Eletricista Industrial (Credenciado)', email: 'ronaldo.temp@gmail.com', phone: '(11) 96101-0988', status: 'Terceirizado' },
    { name: 'Mário Encanamentos', role: 'Hidráulica e Válvulas (Credenciado)', email: 'hidromario@yahoo.com.br', phone: '(11) 97000-1122', status: 'Terceirizado' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
          <span className="text-[#10b981]"><Users className="w-8 h-8" /></span>
          Equipe Administrativa & Prestadores
        </h1>
        <p className="text-zinc-400 text-sm mt-1">Veja os contatos da comissão de conselhos, síndicos e técnicos com contratos vigentes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {users.map((u, i) => (
          <div key={i} className="bg-[#14161b] rounded-xl p-5 border border-zinc-800 space-y-4 shadow-sm flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-850 text-emerald-500 flex items-center justify-center font-bold text-lg shrink-0">
              {u.name.substring(0, 2).toUpperCase()}
            </div>

            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base leading-tight truncate">{u.name}</h3>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${u.status === 'Ativo' ? 'bg-[#10b981]/15 text-[#10b981]' : 'bg-zinc-800 text-zinc-400'}`}>
                  {u.status}
                </span>
              </div>

              <p className="text-zinc-400 text-xs font-semibold flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                {u.role}
              </p>

              <div className="pt-2 border-t border-zinc-850/50 space-y-1 text-xs text-zinc-500 font-mono">
                <p className="flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  {u.email}
                </p>
                <p className="flex items-center gap-1.5 font-mono">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  {u.phone}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
