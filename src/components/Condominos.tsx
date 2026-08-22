import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Ban, Building2, Copy, Mail, Plus, RefreshCw, Search, ShieldCheck, UserX, Users } from 'lucide-react';
import { Unit } from '../types';

type InvitationStatus = 'pending' | 'sent' | 'accepted' | 'expired' | 'cancelled' | 'revoked';
type Invitation = {
  id: string;
  emailNormalized: string;
  invitedName: string;
  invitedPhone?: string | null;
  status: InvitationStatus;
  relationshipRole?: string | null;
  expiresAt: string;
  unit?: { number: string; building: { name: string } } | null;
};
type Resident = {
  id: string;
  person: { name: string; phone: string; email: string };
  unit: { number: string; building: { name: string } };
  role: string;
};

const statusLabels: Record<InvitationStatus, string> = {
  pending: 'Pendente',
  sent: 'Convite enviado',
  accepted: 'Ativo',
  expired: 'Expirado',
  cancelled: 'Cancelado',
  revoked: 'Removido',
};

async function responseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  return payload?.error || fallback;
}

type CondominosProps = {
  condoId: string;
  units: Unit[];
  onNavigateToUnits: () => void;
};

export default function Condominos({ condoId, units, onNavigateToUnits }: CondominosProps) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [form, setForm] = useState({ unitId: '', name: '', phone: '', email: '', role: 'tenant' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [residentsResponse, invitationsResponse] = await Promise.all([
        fetch(`/api/v1/condominiums/${condoId}/residents`),
        fetch(`/api/v1/condominiums/${condoId}/invitations`),
      ]);
      if (!residentsResponse.ok) throw new Error(await responseError(residentsResponse, 'Erro ao carregar moradores.'));
      if (!invitationsResponse.ok) throw new Error(await responseError(invitationsResponse, 'Erro ao carregar convites.'));
      setResidents(await residentsResponse.json());
      setInvitations(await invitationsResponse.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar a central de acessos.');
    } finally {
      setLoading(false);
    }
  }, [condoId]);

  useEffect(() => { void load(); }, [load]);

  const createInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (units.length === 0 || !form.unitId) {
      setShowAdd(false);
      setError('Cadastre uma unidade em Edifícios / Imóveis antes de convidar um morador.');
      return;
    }
    try {
      const response = await fetch(`/api/v1/condominiums/${condoId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          phone: form.phone || undefined,
          unitId: form.unitId,
          role: 'resident',
          relationshipRole: form.role,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Erro ao criar convite.');
      setLastLink(payload?.delivery?.acceptanceUrl || null);
      setShowAdd(false);
      setForm({ unitId: '', name: '', phone: '', email: '', role: 'tenant' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar convite.');
    }
  };

  const act = async (invitation: Invitation, action: 'resend' | 'cancel' | 'revoke') => {
    setBusyId(invitation.id);
    setError(null);
    try {
      const response = await fetch(`/api/v1/condominiums/${condoId}/invitations/${invitation.id}/${action}`, { method: 'POST' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível atualizar o convite.');
      setLastLink(payload?.delivery?.acceptanceUrl || null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar o convite.');
    } finally {
      setBusyId(null);
    }
  };

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invitations.filter(item =>
      !query ||
      item.invitedName.toLowerCase().includes(query) ||
      item.emailNormalized.includes(query) ||
      item.unit?.number.toLowerCase().includes(query)
    );
  }, [invitations, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4 items-start">
        <div>
          <p className="text-xs uppercase font-bold text-emerald-400">Condomínio</p>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2"><Users className="w-7 h-7" />Moradores e acessos</h1>
          <p className="text-sm text-zinc-400 mt-1">Cadastre vínculos, acompanhe convites e revogue acessos do condomínio ativo.</p>
        </div>
        {units.length > 0 ? (
          <button data-testid="invite-resident" onClick={() => setShowAdd(true)} className="px-4 py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm flex items-center gap-2"><Plus className="w-4 h-4" />Convidar morador</button>
        ) : (
          <button data-testid="create-first-unit" onClick={onNavigateToUnits} className="px-4 py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm flex items-center gap-2"><Building2 className="w-4 h-4" />Cadastrar primeira unidade</button>
        )}
      </div>

      {units.length === 0 && (
        <div data-testid="resident-unit-prerequisite" role="status" className="p-4 rounded-md border border-amber-500/35 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-200">Cadastre uma unidade antes de convidar moradores</p>
            <p className="text-xs text-zinc-400 mt-1">Todo morador precisa ser vinculado a uma unidade previamente cadastrada em Edifícios / Imóveis.</p>
          </div>
          <button onClick={onNavigateToUnits} className="text-sm font-semibold text-amber-300 hover:text-amber-200 flex items-center gap-2 whitespace-nowrap"><Building2 className="w-4 h-4" />Ir para Edifícios / Imóveis</button>
        </div>
      )}

      {error && <div role="alert" className="p-3 rounded-md border border-red-500/30 bg-red-500/10 text-sm text-red-300">{error}</div>}
      {lastLink && <div className="p-3 rounded-md border border-sky-500/25 bg-sky-500/5 flex items-center gap-3"><Mail className="w-4 h-4 text-sky-400" /><p className="text-xs text-zinc-300 flex-1 min-w-0 truncate">{lastLink}</p><button title="Copiar link" aria-label="Copiar link" onClick={() => navigator.clipboard.writeText(lastLink)}><Copy className="w-4 h-4 text-sky-400" /></button></div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['sent', 'accepted', 'expired', 'revoked'] as InvitationStatus[]).map(status => <div key={status} className="p-4 rounded-md border border-zinc-800 bg-[#14161b]"><p className="text-2xl font-bold text-white">{invitations.filter(item => item.status === status).length}</p><p className="text-xs text-zinc-500 mt-1">{statusLabels[status]}</p></div>)}
      </div>

      <div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-zinc-600" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, e-mail ou unidade" className="w-full pl-10 pr-3 py-2.5 rounded-md bg-[#14161b] border border-zinc-800 text-sm text-white" /></div>

      <div className="border border-zinc-800 rounded-md overflow-x-auto bg-[#14161b]">
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-950/60 text-xs text-zinc-500"><tr><th className="p-3">Pessoa</th><th className="p-3">Unidade</th><th className="p-3">Status</th><th className="p-3 text-right">Ações</th></tr></thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map(item => (
              <tr key={item.id}>
                <td className="p-3"><p className="font-semibold text-white">{item.invitedName}</p><p className="text-xs text-zinc-500">{item.emailNormalized}</p></td>
                <td className="p-3 text-zinc-300">{item.unit ? `${item.unit.building.name} / ${item.unit.number}` : 'Acesso administrativo'}</td>
                <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-semibold ${item.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400' : item.status === 'expired' || item.status === 'cancelled' || item.status === 'revoked' ? 'bg-zinc-800 text-zinc-400' : 'bg-amber-500/10 text-amber-400'}`}>{statusLabels[item.status]}</span></td>
                <td className="p-3"><div className="flex justify-end gap-1">
                  {['pending', 'sent', 'expired'].includes(item.status) && <button disabled={busyId === item.id} title="Reenviar convite" aria-label="Reenviar convite" onClick={() => void act(item, 'resend')} className="p-2 text-zinc-400 hover:text-emerald-400"><RefreshCw className="w-4 h-4" /></button>}
                  {['pending', 'sent'].includes(item.status) && <button disabled={busyId === item.id} title="Cancelar convite" aria-label="Cancelar convite" onClick={() => void act(item, 'cancel')} className="p-2 text-zinc-400 hover:text-amber-400"><Ban className="w-4 h-4" /></button>}
                  {item.status === 'accepted' && <button disabled={busyId === item.id} title="Revogar acesso" aria-label="Revogar acesso" onClick={() => void act(item, 'revoke')} className="p-2 text-zinc-400 hover:text-red-400"><UserX className="w-4 h-4" /></button>}
                </div></td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-zinc-500">Nenhum acesso encontrado.</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-600 flex items-center gap-2"><ShieldCheck className="w-4 h-4" />{residents.length} vínculos residenciais ativos. Acesso somente após aceite do convite.</p>

      {showAdd && <div className="fixed inset-0 z-50 bg-black/75 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="invite-title"><form onSubmit={createInvitation} className="w-full max-w-lg bg-[#14161b] border border-zinc-800 rounded-md p-6 space-y-4"><div><h2 id="invite-title" className="text-lg font-bold text-white">Convidar morador</h2><p className="text-xs text-zinc-500 mt-1">O cadastro não libera acesso até que a pessoa confirme o convite.</p></div><div className="grid sm:grid-cols-2 gap-3"><label className="text-xs text-zinc-400">Nome<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 w-full p-2.5 rounded bg-zinc-950 border border-zinc-700 text-white" /></label><label className="text-xs text-zinc-400">E-mail<input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1 w-full p-2.5 rounded bg-zinc-950 border border-zinc-700 text-white" /></label><label className="text-xs text-zinc-400">Telefone<input required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full p-2.5 rounded bg-zinc-950 border border-zinc-700 text-white" /></label><label className="text-xs text-zinc-400">Unidade<select required value={form.unitId} onChange={e => setForm({ ...form, unitId: e.target.value })} className="mt-1 w-full p-2.5 rounded bg-zinc-950 border border-zinc-700 text-white"><option value="">Selecione</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.block} / {unit.number}</option>)}</select></label><label className="text-xs text-zinc-400 sm:col-span-2">Tipo de vínculo<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="mt-1 w-full p-2.5 rounded bg-zinc-950 border border-zinc-700 text-white"><option value="owner">Proprietário</option><option value="tenant">Inquilino</option><option value="dependent">Dependente</option><option value="authorized_contact">Contato autorizado</option></select></label></div><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded border border-zinc-700 text-zinc-300">Cancelar</button><button className="px-4 py-2 rounded bg-emerald-500 text-zinc-950 font-bold">Criar convite</button></div></form></div>}
    </div>
  );
}
