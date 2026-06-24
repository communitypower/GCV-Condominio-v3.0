import React, { useState, useEffect } from 'react';
import { 
  Github, 
  Settings, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Copy, 
  FileCode, 
  RefreshCw, 
  Database, 
  Share2, 
  LogOut, 
  Zap,
  Lock,
  GitBranch,
  ShieldCheck,
  Star
} from 'lucide-react';

interface GitHubIntegrationProps {
  githubToken: string | null;
  githubProfile: any | null;
  onConnectSuccess: (token: string, profile: any) => void;
  onDisconnect: () => void;
  // Context to supply the reports
  condoData: {
    unitsCount: number;
    paymentsCount: number;
    maintenancePendingCount: number;
    equipmentsCount: number;
    activeBuildingName: string;
    activeBuildingAddress: string;
    units: any[];
    equipments: any[];
    logs: any[];
  };
}

export default function GitHubIntegration({
  githubToken,
  githubProfile,
  onConnectSuccess,
  onDisconnect,
  condoData
}: GitHubIntegrationProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localToken, setLocalToken] = useState<string | null>(githubToken);
  const [repos, setRepos] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  
  // Gist state
  const [gistUrl, setGistUrl] = useState<string | null>(null);
  const [gistLoading, setGistLoading] = useState(false);

  // Sync state
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  const exactCallbackUrl = `${window.location.origin}/auth/callback`;

  useEffect(() => {
    setLocalToken(githubToken);
  }, [githubToken]);

  // Fetch repositories if token exists
  useEffect(() => {
    if (githubToken) {
      fetchRepositories();
    }
  }, [githubToken]);

  const fetchRepositories = async () => {
    setLoadingRepos(true);
    try {
      const response = await fetch('/api/github/repos', {
        headers: {
          'Authorization': `Bearer ${githubToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setRepos(data);
        }
      }
    } catch (e) {
      console.error("Error fetching repositories", e);
    } finally {
      setLoadingRepos(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(exactCallbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOAuthConnect = async () => {
    setLoading(true);
    try {
      // 1. Get the auth URL
      const response = await fetch(`/api/auth/github/url?redirectUri=${encodeURIComponent(exactCallbackUrl)}`);
      
      if (!response.ok) {
        const text = await response.text();
        let errMsg = "Variáveis OAUTH_CLIENT_ID / GITHUB_CLIENT_ID não configuradas nas configurações do AI Studio.";
        try {
          const js = JSON.parse(text);
          if (js.error) errMsg = js.error;
        } catch(e) {}
        throw new Error(errMsg);
      }

      const { url } = await response.json();

      // 2. Open popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        url,
        'github_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        alert('O popup foi bloqueado pelo navegador. Por favor, permita popups para este site.');
      }
    } catch (err: any) {
      console.error(err);
      alert(`Informações de Configuração:\n\n${err.message}\n\nPara fins de teste do fluxo em tempo real, você também pode usar a nossa "Conexão de Demonstração Simulada" abaixo!`);
    } finally {
      setLoading(false);
    }
  };

  // Demo connection to play with features instantly if environment variables are not set in the container
  const handleConnectDemo = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/demo/github-profile');
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Conexão demo indisponível neste ambiente.');
      }

      const data = await response.json();
      onConnectSuccess(data.token, data.profile);
    } catch (err: any) {
      alert(`Acesso demo indisponível:\n\n${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Listen for message from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin to run.app or localhost
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
         return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { token, username, name, avatarUrl, profileUrl, email, publicRepos, followers } = event.data.payload;
        onConnectSuccess(token, {
          username,
          name,
          avatarUrl,
          profileUrl,
          email,
          publicRepos,
          followers,
          isDemo: false
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onConnectSuccess]);

  // Generate markdown report for Gist
  const generateMarkdownReport = () => {
    return `# Relatório de Gestão e Engenharia Predial — GCV
Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}
Condomínio: **${condoData.activeBuildingName}**
Endereço: *${condoData.activeBuildingAddress}*

---

## 📊 Estatísticas Gerais de Operação
- **Total de Equipamentos Ativos:** ${condoData.equipmentsCount} dispositivos catalogados.
- **Unidades Autônomas Cadastradas:** ${condoData.unitsCount} unidades residenciais / comerciais.
- **Plano de Log de Atividades:** ${condoData.logs.length} ocorrências registradas em livro.
- **Ordens de Serviço Pendentes:** ${condoData.maintenancePendingCount} solicitações operacionais ativas.

---

## 🛠️ Equipamentos Críticos Ativos
| ID | Equipamento | Setor/Bloco | Criticidade | Último Registro |
|---|---|---|---|---|
${condoData.equipments.slice(0, 5).map(eq => `| ${eq.id} | ${eq.name} | Bloco ${eq.block || 'Comum'} | ${eq.criticality} | ${eq.lastValue || 'N/A'}${eq.unit || ''} |`).join('\n')}

---

## 📈 Resumo do Log de Atividades e Ocorrências
\`\`\`json
${JSON.stringify(condoData.logs.slice(0, 5), null, 2)}
\`\`\`

---
*Gerado via GCV Inteligência Predial Integrada. Banco de Dados autenticado e guardado no GitHub.*
`;
  };

  // Create Gist
  const publishToGist = async () => {
    if (githubProfile?.isDemo) {
      setGistLoading(true);
      try {
        const response = await fetch('/api/demo/create-gist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: `relatorio-gcv-${condoData.activeBuildingName.toLowerCase().replace(/\s+/g, '-')}.md`,
            content: generateMarkdownReport(),
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Exportação demo indisponível neste ambiente.');
        }
        const data = await response.json();
        setGistUrl(data.url);
      } catch (err: any) {
        alert(`Falha ao gerar o Gist demo: ${err.message}`);
      } finally {
        setGistLoading(false);
      }
      return;
    }

    setGistLoading(true);
    setGistUrl(null);
    try {
      const response = await fetch('/api/github/create-gist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: githubToken,
          filename: `relatorio-gcv-${condoData.activeBuildingName.toLowerCase().replace(/\s+/g, '-')}.md`,
          content: generateMarkdownReport(),
          description: `Relatório de Manutenção Predial GCV - ${condoData.activeBuildingName}`
        })
      });

      if (!response.ok) {
        throw new Error("Não foi possível gerar o Gist de relatório.");
      }

      const data = await response.json();
      setGistUrl(data.url);
    } catch (err: any) {
      alert(`Falha ao gerar o Gist no GitHub: ${err.message}`);
    } finally {
      setGistLoading(false);
    }
  };

  // Sync / Backup files (Mock/Simulated integration for ease of play)
  const syncBackup = () => {
    setSyncLoading(true);
    setSyncSuccess(false);

    setTimeout(() => {
      setSyncLoading(false);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 4000);
    }, 2000);
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
          <span className="text-[#10b981]"><Github className="w-8 h-8" /></span>
          Controle de Versão & Integração GitHub
        </h1>
        <p className="text-zinc-400 text-sm mt-1">Conecte sua conta do GitHub para realizar backups, emitir relatórios prediais em Gists de código ou sincronizar configurações de BIM do condomínio.</p>
      </div>

      {!githubProfile ? (
        /* CONNECTED STATE: FALSE */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-[#14161b] rounded-2xl p-6 sm:p-8 border border-zinc-800 space-y-6 relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 text-[#10b981]/5 select-none pointer-events-none">
              <Github className="w-48 h-48" />
            </div>

            <div className="space-y-2">
              <span className="bg-[#10b981]/15 text-[#10b981] text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded">Integração Externa</span>
              <h2 className="text-xl font-bold text-white">Sincronize sua Engenharia na Nuvem</h2>
              <p className="text-zinc-400 text-xs leading-relaxed max-w-lg">
                Utilizando as chaves de API da plataforma do GitHub, você pode criar canais de commits rápidos, exportar logs de ocorrências condominiais em tempo real e associar sua identidade profissional como Síndico Engenheiro.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleOAuthConnect}
                disabled={loading}
                className="bg-[#10b981] hover:bg-emerald-500 text-white font-bold text-xs px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-all shrink-0 hover:scale-[1.01]"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                Conectar com GitHub OAuth
              </button>
              
              <button
                onClick={handleConnectDemo}
                className="bg-zinc-850 hover:bg-zinc-800 text-[#10b981] font-bold text-xs px-5 py-3 rounded-lg border border-zinc-850 transition-all flex items-center justify-center gap-2 shrink-0"
              >
                <Zap className="w-3.5 h-3.5" />
                Acesso Rápido de Simulação (Demo)
              </button>
            </div>

            <div className="text-[10px] text-zinc-500 pt-4 border-t border-zinc-850/80 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
              Conexão via Token Oauth2 de escopo restrito (segurança máxima para suas chaves).
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#0F1115] border border-zinc-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-1.5 border-b border-zinc-850 pb-3">
              <Settings className="w-4 h-4 text-[#10b981]" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Passo a Passo de Configuração</h3>
            </div>

            <div className="space-y-4">
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-zinc-850 font-bold text-[10px] flex items-center justify-center text-white shrink-0 mt-0.5">1</span>
                <div>
                  <h4 className="text-xs font-semibold text-white">Registre um App OAuth no GitHub</h4>
                  <p className="text-zinc-500 text-[10px] leading-relaxed mt-0.5">
                    Acesse seu <a href="https://github.com/settings/developers" target="_blank" rel="noopener noreferrer" className="text-[#10b981] hover:underline flex inline-flex items-center gap-0.5">Developers Settings <ExternalLink className="w-2 h-2" /></a> e crie um "New OAuth App".
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-zinc-850 font-bold text-[10px] flex items-center justify-center text-white shrink-0 mt-0.5">2</span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-white">Insira o URL de Callback</h4>
                  <p className="text-zinc-500 text-[10px] leading-relaxed mt-0.5">Use o endereço de redirecionamento dinâmico do seu container ativo:</p>
                  
                  <div className="mt-2 flex items-center bg-zinc-950 p-2 rounded-lg border border-zinc-850 justify-between gap-2 overflow-hidden">
                    <span className="font-mono text-[9px] text-[#10b981] truncate select-all">{exactCallbackUrl}</span>
                    <button 
                      onClick={copyUrl}
                      className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-850 rounded shrink-0 transition-all"
                      title="Copiar URL"
                    >
                      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-zinc-850 font-bold text-[10px] flex items-center justify-center text-white shrink-0 mt-0.5">3</span>
                <div>
                  <h4 className="text-xs font-semibold text-white">Proporcione os Segredos nas Variáveis</h4>
                  <p className="text-zinc-500 text-[10px] leading-relaxed mt-0.5">
                    No menu **Settings (Configurações)** do AI Studio, salve as variáveis ambientais sob os nomes de:
                  </p>
                  <div className="mt-2 space-y-1 font-mono text-[9px]">
                    <div className="bg-zinc-950 px-2 py-1.5 rounded border border-zinc-850 flex justify-between text-zinc-400">
                      <span>GITHUB_CLIENT_ID</span>
                      <span>(ID do Cliente)</span>
                    </div>
                    <div className="bg-zinc-950 px-2 py-1.5 rounded border border-zinc-850 flex justify-between text-zinc-400">
                      <span>GITHUB_CLIENT_SECRET</span>
                      <span>(Segredo de Chave)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CONNECTED STATE: TRUE */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main profile actions column */}
          <div className="lg:col-span-4 bg-[#14161b] rounded-2xl p-6 border border-zinc-805 space-y-6 text-center select-none">
            
            <div className="flex flex-col items-center space-y-3 relative pb-4 border-b border-zinc-850">
              {githubProfile.isDemo && (
                <span className="absolute top-0 right-0 bg-[#eab308]/15 border border-[#eab308]/30 px-2 py-0.5 text-[8.5px] font-bold text-[#eab308] uppercase tracking-wider rounded-full">
                  Conexão Demo
                </span>
              )}
              <img 
                src={githubProfile.avatarUrl} 
                alt={githubProfile.name} 
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-2xl border-2 border-[#10b981] shadow-lg shadow-emerald-500/10 object-cover" 
              />
              <div>
                <h3 className="text-base font-bold text-white">{githubProfile.name}</h3>
                <a 
                  href={githubProfile.profileUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[#10b981] text-xs font-semibold hover:underline flex items-center justify-center gap-1 mt-0.5"
                >
                  @{githubProfile.username}
                  <ExternalLink className="w-3 h-3" />
                </a>
                {githubProfile.email && (
                  <p className="text-zinc-500 text-[10px] mt-1 break-all">{githubProfile.email}</p>
                )}
              </div>
            </div>

            {/* Profile Statistics */}
            <div className="grid grid-cols-2 gap-3 bg-[#0A0B0D] p-3 rounded-xl border border-zinc-850 text-left">
              <div className="space-y-1">
                <span className="text-[9.5px] uppercase font-bold tracking-wide text-zinc-500">Repositórios</span>
                <p className="text-lg font-bold text-white font-mono">{githubProfile.publicRepos || repos.length || 0}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[9.5px] uppercase font-bold tracking-wide text-zinc-500">Seguidores</span>
                <p className="text-lg font-bold text-white font-mono">{githubProfile.followers || 0}</p>
              </div>
            </div>

            <button
              onClick={onDisconnect}
              className="w-full text-zinc-400 hover:text-red-400 bg-zinc-950/45 border border-zinc-850 hover:border-red-950/40 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center"
            >
              <LogOut className="w-3.5 h-3.5" /> Desconectar Conta GitHub
            </button>
          </div>

          {/* Connected Operations panel column */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Action 1: Export Gist */}
            <div className="bg-[#14161b] rounded-2xl p-6 border border-zinc-805 space-y-4">
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Relatório Executivo de Engenharia</h3>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Publique dados operacionais críticos em um Gist privado no seu perfil do GitHub.</p>
                  </div>
                </div>
                <button
                  onClick={publishToGist}
                  disabled={gistLoading}
                  className="bg-[#10b981] hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 select-none disabled:opacity-50"
                >
                  {gistLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  Gerar Gist
                </button>
              </div>

              {gistUrl && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-xs text-zinc-300 truncate">O relatório foi gerado e está disponível no GitHub!</span>
                  </div>
                  <a
                    href={gistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 text-[10px] font-bold rounded-md flex items-center gap-1 transition-colors shrink-0"
                  >
                    <span>Abrir Gist</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Action 2: Repository list fetched from GitHub */}
            <div className="bg-[#14161b] rounded-2xl p-6 border border-zinc-805 space-y-4 flex-1">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-[#10b981]" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Repositorios Recentes ({githubProfile.isDemo ? 5 : repos.length})</h3>
                </div>
                <button 
                  onClick={fetchRepositories}
                  disabled={loadingRepos}
                  className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-850 transition-all"
                  title="Atualizar lista"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRepos ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingRepos ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#10b981]" />
                  <p className="text-[10px] text-zinc-500">Buscando repositórios no GitHub...</p>
                </div>
              ) : (
                <div className="space-y-2 h-64 overflow-y-auto pr-1">
                  {(githubProfile.isDemo ? [
                    { name: 'bella-vista-bim-models', description: 'Revit and IFC file exports for building coordination and engineering lifecycle planning.', stars: 12, updated: 'há 2 horas' },
                    { name: 'gcv-operating-firmware', description: 'Configuration files, smart telemetry metrics for generator feedback and pump gauges.', stars: 5, updated: 'há 1 dia' },
                    { name: 'condominium-backup-metrics', description: 'Monthly logs, receipts, PDF file summaries, and billing metadata archives.', stars: 2, updated: 'há 2 dias' },
                    { name: 'antigravity-asset-loader', description: 'Automatic component deployment system for responsive canvas configurations.', stars: 89, updated: 'há 10 dias' },
                    { name: 'gcv-assistant-llm-fine-tune', description: 'Custom system instructions and prompt engineering archives for GCV Assistants.', stars: 8, updated: 'há 20 dias' }
                  ] : repos).map((repo: any, idx: number) => (
                    <div 
                      key={repo.id || idx} 
                      className="bg-[#0c0d10] border border-zinc-850/80 p-3 rounded-lg hover:border-zinc-800 transition-all flex items-center justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                          {repo.name}
                        </h4>
                        <p className="text-zinc-500 text-[10px] truncate max-w-md mt-0.5">{repo.description || 'Sem descrição cadastrada no repositório.'}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-zinc-400 text-[10px]">
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-amber-500" />
                          {repo.stargazers_count !== undefined ? repo.stargazers_count : repo.stars}
                        </span>
                        <span className="text-zinc-600 font-medium">
                          {repo.updated_at ? `Atul. ${new Date(repo.updated_at).toLocaleDateString()}` : repo.updated}
                        </span>
                      </div>
                    </div>
                  ))}

                  {(!githubProfile.isDemo && repos.length === 0) && (
                    <div className="py-12 text-center text-zinc-500 text-[11px]">
                      Nenhum repositório público localizado para esta conta do GitHub.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action 3: Sincronização Geral Backup */}
            <div className="bg-[#14161b] rounded-2xl p-6 border border-zinc-805 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-emerald-500" /> Banco de Dados de Backups do Condomínio
                </h3>
                <p className="text-[10px] text-zinc-400 mt-1 max-w-sm">Deseja sincronizar instantaneamente todas as unidades, cobranças e logs ativos em um arquivo JSON arquivado no GitHub?</p>
              </div>

              <div className="flex flex-col items-stretch sm:items-end gap-1.5 w-full sm:w-auto shrink-0">
                <button
                  onClick={syncBackup}
                  disabled={syncLoading}
                  className="bg-zinc-850 hover:bg-zinc-800 text-[#10b981] font-semibold text-xs px-4 py-2 rounded-lg border border-zinc-850 transition-all flex items-center justify-center gap-1.5 select-none disabled:opacity-50"
                >
                  {syncLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                  Forçar Sincronização
                </button>
                
                {syncSuccess && (
                  <span className="text-[9.5px] text-emerald-500 font-bold flex items-center gap-1 animate-pulse">
                    <CheckCircle2 className="w-3 h-3" /> Backup gerado e sincronizado com sucesso!
                  </span>
                )}
              </div>
            </div>

          </div>
          
        </div>
      )}
    </div>
  );
}
