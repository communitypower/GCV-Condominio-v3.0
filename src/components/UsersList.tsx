import React, { useEffect, useState } from 'react';
import { Mail, Phone, Users, Briefcase } from 'lucide-react';

interface UsersListProps { condoId: string; }
interface TeamMember { id: string; name: string; role: string; email: string; phone: string; }

export default function UsersList({ condoId }: UsersListProps) {
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const response = await fetch(`/api/v1/condominiums/${condoId}/team`);
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || 'Erro ao carregar pessoas vinculadas.');
        }
        const memberships = await response.json();
        const unique = new Map<string, TeamMember>();
        memberships.forEach((membership: any) => {
          unique.set(membership.email, {
            id: membership.id,
            name: membership.name,
            role: membership.role,
            email: membership.email,
            phone: membership.phone || 'Não informado',
          });
        });
        if (active) setUsers([...unique.values()]);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Erro ao carregar pessoas vinculadas.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [condoId]);

  return <div className="space-y-6"><div><h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2"><Users className="w-8 h-8 text-[#10b981]" />Corpo Diretivo e Equipe</h1><p className="text-zinc-400 text-sm mt-1">Perfis administrativos e operacionais vinculados ao condomínio ativo</p></div>{error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}{loading && <div className="p-6 text-center text-sm text-zinc-400">Carregando contatos...</div>}{!loading && !error && users.length === 0 && <div className="rounded-lg border border-zinc-800 bg-[#14161b] p-6 text-center text-sm text-zinc-400">Nenhum integrante vinculado.</div>}<div className="grid grid-cols-1 md:grid-cols-2 gap-6">{users.map(user => <div key={user.id} className="bg-[#14161b] rounded-xl p-5 border border-zinc-800 flex items-start gap-4"><div className="w-12 h-12 rounded-xl bg-zinc-900 text-emerald-500 flex items-center justify-center font-bold shrink-0">{user.name.substring(0, 2).toUpperCase()}</div><div className="space-y-2 min-w-0"><h3 className="font-bold text-white truncate">{user.name}</h3><p className="text-zinc-400 text-xs flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{user.role}</p><div className="pt-2 border-t border-zinc-800 space-y-1 text-xs text-zinc-500 font-mono"><p className="flex gap-1.5 truncate"><Mail className="w-3.5 h-3.5 shrink-0" />{user.email}</p><p className="flex gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" />{user.phone}</p></div></div></div>)}</div></div>;
}
