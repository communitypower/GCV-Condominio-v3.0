import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, KeyRound, Loader2, LogIn, LogOut, ShieldCheck } from 'lucide-react';

type InvitationDetails = {
  email: string;
  name: string;
  phone?: string | null;
  role: string;
  relationshipRole?: string | null;
  expiresAt: string;
  condominium: { name: string };
  unit?: { number: string; building: { name: string } } | null;
  requiresExistingAccountLogin: boolean;
};

async function readPayload(response: Response) {
  return response.json().catch(() => null);
}

export default function InvitationAcceptance({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [sessionUser, setSessionUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [invitationResponse, sessionResponse] = await Promise.all([
          fetch(`/api/v1/onboarding/invitations/${encodeURIComponent(token)}`),
          fetch('/api/v1/auth/me'),
        ]);
        const payload = await readPayload(invitationResponse);
        if (!invitationResponse.ok) throw new Error(payload?.error || 'Este convite não está disponível.');
        setInvitation(payload);
        setName(payload.name || '');
        setPhone(payload.phone || '');
        if (sessionResponse.ok) {
          const sessionPayload = await readPayload(sessionResponse);
          setSessionUser(sessionPayload?.user?.email ? { email: sessionPayload.user.email } : null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar o convite.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [token]);

  useEffect(() => {
    const receiveOAuth = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'GOOGLE_AUTH_SUCCESS') return;
      const authenticatedEmail = event.data.payload?.user?.email;
      setSessionUser(authenticatedEmail ? { email: authenticatedEmail } : null);
      setOauthLoading(false);
      setError(null);
    };
    window.addEventListener('message', receiveOAuth);
    return () => window.removeEventListener('message', receiveOAuth);
  }, []);

  const loginWithGoogle = () => {
    setOauthLoading(true);
    const width = 500;
    const height = 650;
    window.open(
      '/api/v1/auth/google/login',
      'invitation_google_oauth',
      `width=${width},height=${height},left=${window.screen.width / 2 - width / 2},top=${window.screen.height / 2 - height / 2},resizable=yes,scrollbars=yes`
    );
  };

  const accept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const sessionMatchesInvitation = sessionUser?.email.trim().toLowerCase() === invitation?.email.trim().toLowerCase();
      const endpoint = sessionMatchesInvitation
        ? `/api/v1/onboarding/invitations/${encodeURIComponent(token)}/accept-existing`
        : `/api/v1/onboarding/invitations/${encodeURIComponent(token)}/accept`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          ...(!sessionMatchesInvitation ? { password } : {}),
        }),
      });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível aceitar o convite.');
      setComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível aceitar o convite.');
    } finally {
      setSubmitting(false);
    }
  };

  const loginAndAccept = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: invitation?.email, password: loginPassword }),
      });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível entrar na conta.');
      setSessionUser(payload?.user?.email ? { email: payload.user.email } : { email: invitation!.email });
      setLoginPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar na conta.');
    } finally {
      setSubmitting(false);
    }
  };

  const logoutForInvitation = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      setSessionUser(null);
    } catch {
      setError('Não foi possível encerrar a sessão atual. Atualize a página e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const sessionMatchesInvitation = Boolean(
    invitation && sessionUser?.email.trim().toLowerCase() === invitation.email.trim().toLowerCase()
  );
  const sessionBelongsToAnotherAccount = Boolean(sessionUser && !sessionMatchesInvitation);

  if (loading) {
    return <div className="min-h-screen bg-[#0A0B0D] text-zinc-300 grid place-items-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-400" /></div>;
  }

  return (
    <main className="min-h-screen bg-[#0A0B0D] text-zinc-200 grid place-items-center p-5">
      <section className="w-full max-w-lg border border-zinc-800 bg-[#111318] rounded-lg overflow-hidden shadow-2xl">
        <header className="p-6 border-b border-zinc-800 bg-[#0F1115]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 grid place-items-center rounded-md bg-emerald-500/10 border border-emerald-500/25">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] uppercase font-bold text-emerald-400">Acesso GCV</p>
              <h1 className="text-xl font-bold text-white">{complete ? 'Acesso confirmado' : 'Confirme seu convite'}</h1>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-5">
          {error && <div role="alert" className="p-3 rounded-md border border-red-500/30 bg-red-500/10 text-sm text-red-300">{error}</div>}

          {complete ? (
            <div className="text-center py-6 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <p className="text-sm text-zinc-300">Seu vínculo foi ativado. O condomínio já está disponível na sua conta.</p>
              <button onClick={() => { window.location.href = '/'; }} className="px-5 py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm">
                Acessar o GCV
              </button>
            </div>
          ) : invitation ? (
            <>
              <div className="p-4 rounded-md bg-zinc-950/60 border border-zinc-800 space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-white"><Building2 className="w-4 h-4 text-emerald-400" />{invitation.condominium.name}</p>
                {invitation.unit && <p className="text-xs text-zinc-400">{invitation.unit.building.name}, unidade {invitation.unit.number}</p>}
                <p className="text-xs text-zinc-500">Convite para {invitation.email}</p>
              </div>

              {sessionBelongsToAnotherAccount ? (
                <div className="space-y-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
                  <div>
                    <h2 className="font-semibold text-white flex items-center gap-2"><LogOut className="w-4 h-4 text-amber-400" />Troque de conta para continuar</h2>
                    <p className="text-xs text-zinc-400 mt-2">Você está conectado como <strong className="text-zinc-200">{sessionUser?.email}</strong>, mas este convite foi emitido para <strong className="text-zinc-200">{invitation.email}</strong>.</p>
                  </div>
                  <button type="button" disabled={submitting} onClick={() => void logoutForInvitation()} className="w-full py-3 rounded-md border border-amber-500/40 hover:border-amber-400 text-amber-200 font-semibold text-sm disabled:opacity-50">
                    {submitting ? 'Encerrando sessão...' : 'Sair e continuar com o convite'}
                  </button>
                </div>
              ) : invitation.requiresExistingAccountLogin && !sessionMatchesInvitation ? (
                <form onSubmit={loginAndAccept} className="space-y-4">
                  <div>
                    <h2 className="font-semibold text-white flex items-center gap-2"><LogIn className="w-4 h-4 text-emerald-400" />Entre na conta existente</h2>
                    <p className="text-xs text-zinc-500 mt-1">Por segurança, confirme a senha da conta associada ao convite.</p>
                  </div>
                  <input aria-label="E-mail" value={invitation.email} disabled className="w-full p-3 rounded-md bg-zinc-950 border border-zinc-800 text-sm text-zinc-500" />
                  <input aria-label="Senha" type="password" minLength={10} required value={loginPassword} onChange={event => setLoginPassword(event.target.value)} className="w-full p-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-white focus:outline-none focus:border-emerald-500" />
                  <button disabled={submitting} className="w-full py-3 rounded-md bg-emerald-500 text-zinc-950 font-bold text-sm disabled:opacity-50">
                    {submitting ? 'Entrando...' : 'Entrar para continuar'}
                  </button>
                  <div className="flex items-center gap-3 text-[10px] uppercase text-zinc-600"><span className="h-px bg-zinc-800 flex-1" />ou<span className="h-px bg-zinc-800 flex-1" /></div>
                  <button type="button" disabled={oauthLoading || submitting} onClick={loginWithGoogle} className="w-full py-3 rounded-md border border-zinc-700 hover:border-emerald-500 text-white font-semibold text-sm disabled:opacity-50">
                    {oauthLoading ? 'Aguardando Google...' : 'Continuar com Google'}
                  </button>
                </form>
              ) : (
                <form onSubmit={(event) => { event.preventDefault(); void accept(); }} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="text-xs text-zinc-400">Nome completo<input required value={name} onChange={event => setName(event.target.value)} className="mt-1.5 w-full p-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-white" /></label>
                    <label className="text-xs text-zinc-400">Telefone<input value={phone} onChange={event => setPhone(event.target.value)} className="mt-1.5 w-full p-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-white" /></label>
                  </div>
                  {!sessionMatchesInvitation && (
                    <label className="text-xs text-zinc-400">Crie uma senha
                      <span className="relative block mt-1.5"><KeyRound className="absolute left-3 top-3.5 w-4 h-4 text-zinc-600" /><input type="password" minLength={10} required value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo de 10 caracteres" className="w-full pl-10 pr-3 py-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-white" /></span>
                    </label>
                  )}
                  <label className="flex items-start gap-2 text-xs text-zinc-400"><input type="checkbox" required className="mt-0.5 accent-emerald-500" />Confirmo meus dados e aceito o vínculo apresentado acima.</label>
                  <button disabled={submitting} className="w-full py-3 rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm disabled:opacity-50">
                    {submitting ? 'Confirmando...' : 'Confirmar e ativar acesso'}
                  </button>
                </form>
              )}
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
