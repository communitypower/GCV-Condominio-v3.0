import React, { useState } from 'react';
import { Building2, CheckCircle2, Copy, Loader2, UserRoundPlus } from 'lucide-react';

type OnboardingResult = {
  account: { id: string; name: string };
  condominium: { id: string; name: string };
  syndic: { email: string };
  invitation: { id: string; status: string };
  delivery?: { acceptanceUrl?: string; method: string };
};

const initialForm = {
  accountName: '',
  condominiumName: '',
  condominiumAddress: '',
  syndicName: '',
  syndicEmail: '',
  syndicPhone: '',
};

export default function SystemOnboarding() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardingResult | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/onboarding/system/condominiums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível concluir o onboarding.');
      setResult(payload);
      setForm(initialForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir o onboarding.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <p className="text-xs uppercase font-bold text-emerald-400">Administração do sistema</p>
        <h1 className="text-3xl font-bold text-white mt-1">Onboarding de condomínio</h1>
        <p className="text-sm text-zinc-400 mt-1">Crie a conta, o condomínio e o primeiro acesso do síndico em uma única operação auditável.</p>
      </div>

      {error && <div role="alert" className="p-3 rounded-md border border-red-500/30 bg-red-500/10 text-sm text-red-300">{error}</div>}

      {result && (
        <section className="border border-emerald-500/25 bg-emerald-500/5 rounded-md p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold"><CheckCircle2 className="w-5 h-5" />Onboarding criado</div>
          <p className="text-sm text-zinc-300">{result.condominium.name} foi vinculado à conta {result.account.name}. O convite de {result.syndic.email} está {result.invitation.status}.</p>
          {result.delivery?.acceptanceUrl && (
            <div className="flex gap-2">
              <input readOnly value={result.delivery.acceptanceUrl} className="flex-1 min-w-0 p-2.5 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-300" />
              <button aria-label="Copiar link de ativação" title="Copiar link de ativação" onClick={() => navigator.clipboard.writeText(result.delivery!.acceptanceUrl!)} className="w-10 grid place-items-center rounded-md border border-zinc-700 text-zinc-300 hover:text-white"><Copy className="w-4 h-4" /></button>
            </div>
          )}
        </section>
      )}

      <form onSubmit={submit} className="border border-zinc-800 bg-[#14161b] rounded-md overflow-hidden">
        <section className="p-5 border-b border-zinc-800">
          <h2 className="font-semibold text-white flex items-center gap-2"><Building2 className="w-4 h-4 text-emerald-400" />Conta e condomínio</h2>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <label className="text-xs text-zinc-400">Nome da conta<input required value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value })} className="mt-1.5 w-full p-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-white" /></label>
            <label className="text-xs text-zinc-400">Nome do condomínio<input required value={form.condominiumName} onChange={e => setForm({ ...form, condominiumName: e.target.value })} className="mt-1.5 w-full p-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-white" /></label>
            <label className="text-xs text-zinc-400 md:col-span-2">Endereço<input required value={form.condominiumAddress} onChange={e => setForm({ ...form, condominiumAddress: e.target.value })} className="mt-1.5 w-full p-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-white" /></label>
          </div>
        </section>

        <section className="p-5">
          <h2 className="font-semibold text-white flex items-center gap-2"><UserRoundPlus className="w-4 h-4 text-emerald-400" />Síndico responsável</h2>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <label className="text-xs text-zinc-400">Nome completo<input required value={form.syndicName} onChange={e => setForm({ ...form, syndicName: e.target.value })} className="mt-1.5 w-full p-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-white" /></label>
            <label className="text-xs text-zinc-400">E-mail<input type="email" required value={form.syndicEmail} onChange={e => setForm({ ...form, syndicEmail: e.target.value })} className="mt-1.5 w-full p-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-white" /></label>
            <label className="text-xs text-zinc-400">Telefone<input value={form.syndicPhone} onChange={e => setForm({ ...form, syndicPhone: e.target.value })} className="mt-1.5 w-full p-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-white" /></label>
          </div>
          <div className="flex justify-end mt-5">
            <button disabled={submitting} className="px-5 py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm disabled:opacity-50 flex items-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}{submitting ? 'Criando...' : 'Criar e convidar síndico'}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
