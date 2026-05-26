import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight, 
  Layers, 
  Flame, 
  Printer, 
  Copy,
  TrendingUp,
  RotateCcw
} from 'lucide-react';

interface AIAssistantProps {
  units: any[];
  billings: any[];
  maintenanceRequests: any[];
  equipments: any[];
  plans: any[];
  logs: any[];
  purchases: any[];
  payments: any[];
  activeEdificioName?: string;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

// Simple and high-fidelity Markdown-to-HTML parser component
function MarkdownRenderer({ content }: { content: string }) {
  const parseMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      let trimmed = line.trim();

      // Horizontal Rule
      if (trimmed === '---') {
        return <hr key={index} className="my-4 border-zinc-800" />;
      }

      // Headings
      if (trimmed.startsWith('### ')) {
        return (
          <h4 key={index} className="text-sm font-bold text-[#D4AF37] mt-4 mb-2 font-sans tracking-wide">
            {trimmed.slice(4)}
          </h4>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h3 key={index} className="text-base font-bold text-white mt-5 mb-3 font-sans border-b border-zinc-850 pb-1">
            {trimmed.slice(3)}
          </h3>
        );
      }
      if (trimmed.startsWith('# ')) {
        return (
          <h2 key={index} className="text-lg font-extrabold text-white mt-6 mb-4 font-sans tracking-tight">
            {trimmed.slice(2)}
          </h2>
        );
      }

      // Bullet Lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const itemText = trimmed.slice(2);
        // Parse bold elements inside list item
        return (
          <li key={index} className="ml-4 list-disc text-xs text-zinc-300 mb-1.5 leading-relaxed">
            {formatBoldText(itemText)}
          </li>
        );
      }

      // Numbered Lists
      if (/^\d+\.\s/.test(trimmed)) {
        const itemText = trimmed.replace(/^\d+\.\s/, '');
        return (
          <li key={index} className="ml-4 list-decimal text-xs text-zinc-300 mb-1.5 leading-relaxed">
            {formatBoldText(itemText)}
          </li>
        );
      }

      // Blockquotes
      if (trimmed.startsWith('> ')) {
        return (
          <blockquote key={index} className="border-l-2 border-emerald-500 pl-3 italic text-zinc-400 text-xs my-3 bg-zinc-950/20 py-1 rounded">
            {formatBoldText(trimmed.slice(2))}
          </blockquote>
        );
      }

      // Standard paragraph
      if (trimmed === '') {
        return <div key={index} className="h-2" />;
      }

      return (
        <p key={index} className="text-xs text-zinc-300 mb-2 leading-relaxed text-left">
          {formatBoldText(line)}
        </p>
      );
    });
  };

  const formatBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return <div className="space-y-1 text-left">{parseMarkdown(content)}</div>;
}

export default function AIAssistent({
  units,
  billings,
  maintenanceRequests,
  equipments,
  plans,
  logs,
  purchases,
  payments,
  activeEdificioName = "Condomínio Bella Vista Premium"
}: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'reports'>('chat');

  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        text: `Olá! Eu sou o **G.C.V. Engenheiro Assistente IA**. Estou conectado à base de dados em tempo real do **${activeEdificioName}**.\n\nPosso auditar a saúde financeira, gerar roteiros de manutenção preventiva, mapear riscos operacionais ou simular relatórios estatísticos complexos para o corpo diretivo. O que deseja consultar ou gerar hoje?`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, [activeEdificioName]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new chat message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Dynamic system context payload with all current stats
  const getCondoContextData = () => {
    return {
      edificioNome: activeEdificioName,
      resumo: {
        totalUnidades: units.length,
        unidadesOcupadas: units.filter(u => u.status === 'occupied').length,
        unidadesVagas: units.filter(u => u.status === 'vacant').length,
        unidadesManutencao: units.filter(u => u.status === 'maintenance').length,
        taxaAdimplencia: calculateCollectionRate(),
        totalArrecadadoMesOriginal: billings.filter(b => b.status === 'paid').reduce((acc, b) => acc + b.amount, 0),
        totalPendenteMesOriginal: billings.filter(b => b.status === 'pending').reduce((acc, b) => acc + b.amount, 0),
        equipamentosAlertaCritico: equipments.filter(e => e.status === 'alert' || e.status === 'critical').length,
        ordensServicoAbertas: maintenanceRequests.filter(r => r.status === 'reported' || r.status === 'in_progress').length,
      },
      equipamentos: equipments.map(e => ({ id: e.id, nome: e.name, local: e.location, status: e.status, proximaInspecao: e.nextInspection })),
      ordensServico: maintenanceRequests.map(r => ({ id: r.id, unidade: r.unitId, titulo: r.title, categoria: r.category, prioridade: r.priority, status: r.status, data: r.reportedAt })),
      faturamento: billings.map(b => ({ id: b.id, unidade: b.unitId, vencimento: b.dueDate, valor: b.amount, status: b.status })),
      compras: purchases.map(p => ({ id: p.id, item: p.items, valor: p.amount, status: p.status, solicitante: p.requester })),
      contasPagar: payments.map(p => ({ id: p.id, descricao: p.description, valor: p.amount, status: p.status, vencimento: p.dueDate }))
    };
  };

  const calculateCollectionRate = () => {
    const totalPaid = billings.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.amount, 0);
    const totalPending = billings.filter(b => b.status === 'pending').reduce((sum, b) => sum + b.amount, 0);
    const totalOverdue = billings.filter(b => b.status === 'overdue').reduce((sum, b) => sum + b.amount, 0);
    const totalAll = totalPaid + totalPending + totalOverdue;
    return totalAll > 0 ? (totalPaid / totalAll) * 100 : 100;
  };

  // Reassuring animated loader messages
  const triggerLoadingSteps = (isReport = false) => {
    const steps = isReport ? [
      'Analisando registros de engenharia...',
      'Invocando modelo estrutural Gemini 3.5...',
      'Calculando índices financeiros de quitação...',
      'Consolidando relatório de alta performance...'
    ] : [
      'Processando questionamento...',
      'Invocando Gemini 3.5-Flash...',
      'Cruzando com o banco de competências...',
      'Sintetizando resposta analítica...'
    ];

    let current = 0;
    setLoadingStep(steps[0]);
    const interval = setInterval(() => {
      current++;
      if (current < steps.length) {
        setLoadingStep(steps[current]);
      } else {
        clearInterval(interval);
      }
    }, 1200);

    return interval;
  };

  // Chat message submission
  const handleSendMessage = async (customPrompt?: string) => {
    const messageToSend = customPrompt || inputMessage;
    if (!messageToSend.trim()) return;

    // Clear input
    if (!customPrompt) setInputMessage('');

    // Add user message to state
    const userMsg: Message = {
      role: 'user',
      text: messageToSend,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const intervalRef = triggerLoadingSteps(false);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: messageToSend,
          contextData: getCondoContextData()
        })
      });

      if (!response.ok) {
        throw new Error('Falha de comunicação com o servidor ');
      }

      const data = await response.json();
      
      const assistantMsg: Message = {
        role: 'assistant',
        text: data.text || 'Desculpe, não consegui processar sua consulta.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMsg]);

    } catch (error: any) {
      console.error(error);
      const errorMsg: Message = {
        role: 'assistant',
        text: `⚠️ **Erro de Conexão com a Inteligência Artificial:**\nNão foi possível obter resposta do servidor. Certifique-se de configurar a variável de ambiente **GEMINI_API_KEY** no painel de segredos do módulo.\n\n*Detalhe técnico: ${error.message}*`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      clearInterval(intervalRef);
      setIsLoading(false);
    }
  };

  // Instant Report Generation Dispatch
  const handleGenerateSpecialReport = async (reportType: string) => {
    setIsLoading(true);
    setActiveTab('chat'); // Redirect back to chat container to print the result

    let promptText = '';
    const intervalRef = triggerLoadingSteps(true);

    if (reportType === 'operational') {
      promptText = 'Gere um Relatório de Desempenho Operacional e Manutenção Predial detalhado. Analise as Ordens de Serviço por status e categoria, aponte gargalos de reatividades e dê sugestões técnicas de engenharia preventiva embasado nos dados atuais.';
    } else if (reportType === 'financial') {
      promptText = 'Gere um Relatório de Saúde Financeira e Adimplência com indicadores detalhados baseados nos boletos e ordens de pagamento. Me dê a análise da taxa de adimplência condominial corrente e mostre caminhos estatísticos ou previsões orçamentárias de arrecadação.';
    } else if (reportType === 'checklist') {
      promptText = 'Elabore um Roteiro Crítico de Engenharia Preventiva e Inspeção de Ativos Industriais. Foque nos equipamentos que estão em estado de "Alerta" ou "Crítico" no banco de dados e monte um plano de ação completo passo a passo.';
    }

    // Add user placeholder message
    const userMsg: Message = {
      role: 'user',
      text: `📋 Solicitação Especial: Gerar *${reportType === 'operational' ? 'Relatório de Desempenho Operacional' : reportType === 'financial' ? 'Relatório de Saúde Financeira' : 'Roteiro Preventivo de Ativos'}*`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          contextData: getCondoContextData()
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar relatório analítico.');
      }

      const data = await response.json();
      
      const assistantMsg: Message = {
        role: 'assistant',
        text: data.text || 'Erro operacional na geração do relatório.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMsg]);

    } catch (error: any) {
      console.error(error);
      const errorMsg: Message = {
        role: 'assistant',
        text: `⚠️ **Falha no Processador de Relatório:**\nOcorreu um erro ao chamar o LLM para geração estruturada de dados. Verifique a chave **GEMINI_API_KEY**.\n\n*Detalhe: ${error.message}*`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      clearInterval(intervalRef);
      setIsLoading(false);
    }
  };

  // Helper helper to copy text
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Conteúdo copiado para a área de transferência com sucesso!');
  };

  const handlePrint = () => {
    window.print();
  };

  const presetSuggestions = [
    { label: 'Auditoria de Receitas', prompt: 'Qual é o balanço atual de cobranças pagas vs. pendentes e qual unidade tem o maior débito pendente?' },
    { label: 'Ativos Críticos', prompt: 'Quais equipamentos estão em estado ALERTA ou CRÍTICO? Me dê um plano de ação prioritário para cada um deles.' },
    { label: 'Cálculo de Adimplência %', prompt: 'Pode calcular e auditar formalmente nossa taxa de adimplência do mês de Maio de 2026 e listar as unidades inadimplentes com o total acumulado?' },
    { label: 'Plano Inspeção Elevadores', prompt: 'Baseado no inventário de equipamentos do condomínio, monte um escopo de termos de referência para manutenção preventiva periódica de elevadores.' },
  ];

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-140px)] min-h-[500px]">
      {/* Header section with sparkles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
            <span className="text-[#10b981]"><Sparkles className="w-8 h-8 animate-pulse" /></span>
            GCV Co-Pilot Inteligência Artificial
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Módulo LLM em tempo real conectado ao banco de dados predial de alta fidelidade</p>
        </div>

        {/* Action controllers buttons */}
        <div className="flex bg-[#14161a] border border-zinc-800 p-1 rounded-lg shrink-0">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-1.5 rounded text-xs font-semibold transition-all ${activeTab === 'chat' ? 'bg-[#10b981]/20 text-[#10b981] font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            Consultas & Conversa
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-1.5 rounded text-xs font-semibold transition-all ${activeTab === 'reports' ? 'bg-[#10b981]/20 text-[#10b981] font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            Gerador de Relatórios
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        
        {/* Left Sidepanel: Key Status Insights / Instant presets (Lg Grid 1) */}
        <div className="lg:col-span-1 bg-[#14161a] border border-zinc-805 rounded-xl p-5 flex flex-col justify-between space-y-5 h-full overflow-y-auto">
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Estatísticas Mapeadas pela IA</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-zinc-950/40 p-2.5 rounded border border-zinc-850">
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase">Adimplência Geral</span>
                  <span className="text-xs font-bold font-mono text-emerald-400">{calculateCollectionRate().toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between bg-zinc-950/40 p-2.5 rounded border border-zinc-850">
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase">Ordens Pendentes</span>
                  <span className="text-xs font-bold font-mono text-amber-500">{getCondoContextData().resumo.ordensServicoAbertas}</span>
                </div>
                <div className="flex items-center justify-between bg-zinc-950/40 p-2.5 rounded border border-zinc-850">
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase">Ativos com Risco (Alertas)</span>
                  <span className="text-xs font-bold font-mono text-red-500">{getCondoContextData().resumo.equipamentosAlertaCritico}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-850 pt-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Recursos Disponíveis na IA</h3>
              <ul className="space-y-2 text-xs text-zinc-300">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Auditagem de Faturamento
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Relatórios de Engenharia
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Cruzamento de Contratos
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Análise de Manutenção
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-zinc-950/30 p-4 border border-zinc-850 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold font-sans">
              <Sparkles className="w-4 h-4" />
              <span>Gemini 3.5-Flash</span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-normal">
              O assistente lê e compreende de forma integrada toda a base JSON de unidades, boletos, equipamentos e ordens preventivas.
            </p>
          </div>
        </div>

        {/* Right Container View: Handles chat content OR reports dispatch */}
        <div className="lg:col-span-3 flex flex-col h-full bg-[#14161a] border border-zinc-800 rounded-xl overflow-hidden relative">
          
          {/* Active: Relatórios Structurer Form */}
          {activeTab === 'reports' ? (
            <div className="p-6 h-full flex flex-col justify-between overflow-y-auto space-y-6">
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white font-sans">Portal Estruturador de Relatórios Técnicos</h2>
                  <p className="text-xs text-zinc-400 mt-1">Selecione uma especialidade de análise abaixo para acionar a matriz de dados complexos do Gemini.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
                  {/* Option 1: Operational */}
                  <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/40 hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-4 group">
                    <div className="space-y-1.5">
                      <div className="w-8 h-8 rounded-lg bg-[#0e3c30]/40 text-emerald-400 flex items-center justify-center border border-emerald-990/40">
                        <Layers className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-white text-xs tracking-wide">Relatório de Desempenho Operacional</h3>
                      <p className="text-[10px] text-zinc-500 leading-normal">Análise estatística de chamados por categoria, SLA médio sugerido, reatividades críticas e riscos operacionais do Bella Vista.</p>
                    </div>
                    <button
                      onClick={() => handleGenerateSpecialReport('operational')}
                      className="text-xs font-bold text-emerald-500 group-hover:text-emerald-400 flex items-center gap-1.5 transition-all text-left"
                    >
                      Gerar Documento <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Option 2: Financial */}
                  <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/40 hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-4 group">
                    <div className="space-y-1.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-950/20 text-emerald-400 flex items-center justify-center border border-emerald-900/30">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-white text-xs tracking-wide">Relatório de Saúde Financeira</h3>
                      <p className="text-[10px] text-zinc-500 leading-normal">Levantamento sintético de taxas de inadimplência, quitação mensal, fluxo de insumos operacionais e previsibilidade orçamentária.</p>
                    </div>
                    <button
                      onClick={() => handleGenerateSpecialReport('financial')}
                      className="text-xs font-bold text-emerald-500 group-hover:text-emerald-400 flex items-center gap-1.5 transition-all text-left"
                    >
                      Gerar Documento <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Option 3: Checklist */}
                  <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/40 hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-4 group">
                    <div className="space-y-1.5">
                      <div className="w-8 h-8 rounded-lg bg-orange-950/15 text-orange-400 flex items-center justify-center border border-orange-900/30">
                        <Flame className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-white text-xs tracking-wide">Roteiro Crítico de Engenharia</h3>
                      <p className="text-[10px] text-zinc-500 leading-normal">Roteiro de Manutenção Preventiva prioritário projetando cronograma, regras de conformidade técnica e inspeção para elevadores e bombas.</p>
                    </div>
                    <button
                      onClick={() => handleGenerateSpecialReport('checklist')}
                      className="text-xs font-bold text-emerald-500 group-hover:text-emerald-400 flex items-center gap-1.5 transition-all text-left"
                    >
                      Gerar Documento <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-zinc-950/30 border border-zinc-850 rounded-xl flex items-start gap-3">
                <FileText className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <div className="space-y-1 text-left">
                  <p className="text-xs font-bold text-white">Como funciona este compilador?</p>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Nossa IA lê de forma concatenada todas as unidades cadastradas, boletos emitidos em atraso, equipamentos em alerta de inspeção e fluxos de pagamentos para construir uma auditoria formal. O processo leva em torno de 3 segundos.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            // Active: Chat Container (Default View)
            <div className="h-full flex flex-col min-h-0 justify-between">
              
              {/* Chat Viewport Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0 bg-[#0C0E11]/40">
                {messages.map((message, i) => (
                  <div key={i} className={`flex items-start gap-3 max-w-[85%] ${message.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                    
                    {/* Character avatar indicator */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${
                      message.role === 'user' 
                        ? 'bg-zinc-800 border-zinc-700 text-white' 
                        : 'bg-[#10b981]/15 border-[#10b981]/35 text-[#10b981]'
                    }`}>
                      {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    {/* Chat Bubble card */}
                    <div className={`rounded-xl p-4 shadow-sm border space-y-2 text-left relative group ${
                      message.role === 'user'
                        ? 'bg-zinc-900 border-zinc-800'
                        : 'bg-zinc-950/80 border-zinc-850'
                    }`}>
                      
                      {/* Markdown Response rendering */}
                      <div className="text-xs text-zinc-200">
                        <MarkdownRenderer content={message.text} />
                      </div>

                      {/* Utility Action Hover bar for bot logs */}
                      {message.role === 'assistant' && i !== 0 && (
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1.5 bg-zinc-950 border border-zinc-850 p-1 rounded">
                          <button 
                            onClick={() => copyToClipboard(message.text)}
                            title="Copiar texto bruto"
                            className="p-1 hover:bg-zinc-905 text-zinc-500 hover:text-white rounded"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={handlePrint}
                            title="Exportar para impressão"
                            className="p-1 hover:bg-zinc-905 text-zinc-500 hover:text-white rounded"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <span className="block text-[8px] text-zinc-500 font-mono font-medium text-right pt-1">{message.timestamp}</span>
                    </div>

                  </div>
                ))}

                {/* Intelligent loading state overlay */}
                {isLoading && (
                  <div className="flex items-start gap-3 max-w-[80%] mr-auto animate-pulse">
                    <div className="w-8 h-8 rounded-lg bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="bg-zinc-950/80 border border-zinc-850 rounded-xl p-4 space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        <span className="text-[11px] font-bold font-sans text-emerald-400 uppercase tracking-wider">{loadingStep}</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-2 bg-zinc-850 rounded w-full" />
                        <div className="h-2 bg-zinc-850 rounded w-5/6" />
                        <div className="h-2 bg-zinc-850 rounded w-4/5" />
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions Quick Chips block (Only hidden under load) */}
              {!isLoading && messages.length <= 2 && (
                <div className="px-5 py-3 border-t border-zinc-850 text-left bg-zinc-950/10">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#D4AF37]" /> Sugestões Rápidas de Análise
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {presetSuggestions.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => handleSendMessage(item.prompt)}
                        className="text-[10px] font-medium text-zinc-300 bg-zinc-950 border border-zinc-850 hover:border-emerald-500/50 hover:text-[#10b981] px-2.5 py-1.5 rounded-lg transition-colors text-left"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Text Input bar */}
              <div className="p-4 border-t border-zinc-850 bg-zinc-950/20">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    disabled={isLoading}
                    placeholder="Faça uma pergunta sobre finanças, manutenção preventiva ou insumos..."
                    className="flex-1 bg-zinc-950 pr-4 pl-4 py-2.5 text-xs text-white rounded-lg border border-zinc-800 focus:border-[#10b981]/50 focus:outline-none placeholder-zinc-500 tracking-wide font-medium disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !inputMessage.trim()}
                    className="bg-[#10b981] text-white px-4 py-2.5 rounded-lg text-xs font-bold hover:bg-emerald-400 transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Perguntar</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
