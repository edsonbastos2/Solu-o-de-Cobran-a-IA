'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Send, Bot, User, CheckCircle, AlertTriangle, UserCheck, Play, Pause } from 'lucide-react';

import { Header } from '@/components/header';

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = params?.id as string;
  const router = useRouter();

  const [caseData, setCaseData] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [agentInput, setAgentInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingAgent, setSendingAgent] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();

    if (supabase) {
      const channel = supabase
        .channel(`messages-${caseId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `case_id=eq.${caseId}` },
          (payload: any) => {
            fetchData();
          }
        )
        .subscribe();

      const caseChannel = supabase
        .channel(`case-${caseId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cases', filter: `id=eq.${caseId}` },
          (payload: any) => {
            fetchData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(caseChannel);
      };
    }
  }, [caseId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchData() {
    if (!supabase) return;
    try {
      const [caseRes, msgRes] = await Promise.all([
        supabase.from('cases').select('*').eq('id', caseId).single(),
        supabase.from('messages').select('*').eq('case_id', caseId).order('created_at', { ascending: true })
      ]);

      if (caseRes.error) throw caseRes.error;
      setCaseData(caseRes.data);
      setMessages(msgRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const startConversation = async () => {
    setSending(true);
    setChatError(null);
    try {
      const res = await fetch('/api/start-negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao iniciar negociação');
      }
      await fetchData();
    } catch(err: any) {
      console.error(err);
      setChatError(err.message);
    } finally {
      setSending(false);
    }
  };

  const sendAgentMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentInput.trim() || sendingAgent) return;

    const msg = agentInput.trim();
    setAgentInput('');
    setSendingAgent(true);
    setChatError(null);

    // Optimistic UI insert
    const tempMsg = { id: Date.now(), role: 'human', content: msg, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await fetch('/api/agent-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, message: msg })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao enviar mensagem humana.');
      }
      await fetchData();
    } catch (err: any) {
      console.error(err);
      setChatError(err.message);
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    } finally {
      setSendingAgent(false);
    }
  };

  const toggleAiStatus = async (newStatus: 'in_negotiation' | 'needs_attention') => {
    setChatError(null);
    try {
      const res = await fetch('/api/case-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, status: newStatus })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao alterar modo.');
      }
      await fetchData();
    } catch (err: any) {
      console.error(err);
      setChatError(err.message);
    }
  };

  if (loading) return <div className="p-8 text-slate-300 bg-[#0c0d10] h-screen">Carregando...</div>;
  if (!caseData) return <div className="p-8 text-slate-300 bg-[#0c0d10] h-screen">Caso não encontrado.</div>;

  return (
    <div className="min-h-screen lg:h-screen bg-[#0c0d10] text-slate-300 flex flex-col overflow-x-hidden">
      <Header />
      <header className="bg-[#111318] border-b border-white/5 px-4 sm:px-6 py-3 sm:py-4 shrink-0">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center">
            <Link href="/" className="text-slate-500 hover:text-white mr-3 transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white leading-tight">{caseData.name}</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-mono">{caseData.phone}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 sm:space-x-6 text-xs sm:text-sm pt-2 sm:pt-0 border-t sm:border-0 border-white/5">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Valor Atualizado</p>
              <p className="font-bold text-white text-xs sm:text-sm">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(caseData.updated_value)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Status</p>
              <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold
                ${caseData.status === 'not_started' ? 'bg-white/10 text-slate-300' :
                  caseData.status === 'in_negotiation' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                  caseData.status === 'needs_attention' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                {caseData.status === 'not_started' && 'Não Iniciado'}
                {caseData.status === 'in_negotiation' && 'Em Negociação (IA)'}
                {caseData.status === 'needs_attention' && 'Atendimento Humano'}
                {caseData.status === 'closed' && 'Acordo Fechado'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto lg:overflow-hidden max-w-5xl w-full mx-auto flex flex-col lg:flex-row p-3 sm:p-6 gap-4 sm:gap-6">
        
        {/* Chat History & Intervention Panel */}
        <div className="flex-1 bg-[#16181d] border border-white/5 rounded-xl shadow-sm flex flex-col overflow-hidden min-h-[500px] lg:min-h-0">
          <div className="bg-[#111318] border-b border-white/5 p-3 sm:p-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center font-semibold text-xs sm:text-sm">
              <div className="w-8 h-8 bg-emerald-500/10 rounded mr-2.5 sm:mr-3 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              </div>
              <div>
                <div>Histórico do WhatsApp</div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 font-normal">
                  {caseData.status === 'needs_attention' ? (
                    <span className="text-amber-400 flex items-center gap-1 mt-0.5">
                      <UserCheck className="w-3 h-3 shrink-0" /> Modo Atendimento Humano (IA Pausada)
                    </span>
                  ) : caseData.status === 'in_negotiation' ? (
                    <span className="text-blue-400 flex items-center gap-1 mt-0.5">
                      <Bot className="w-3 h-3 shrink-0" /> IA Ativa em Modo Automático
                    </span>
                  ) : (
                    <span>Aguardando início</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {caseData.status === 'not_started' && (
                <button 
                  onClick={startConversation}
                  disabled={sending}
                  className="px-3 py-1.5 bg-emerald-500 text-black font-semibold rounded text-xs hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span>{sending ? 'Iniciando...' : 'Iniciar Abordagem da IA'}</span>
                </button>
              )}

              {caseData.status === 'in_negotiation' && (
                <button 
                  onClick={() => toggleAiStatus('needs_attention')}
                  className="px-3 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs font-semibold hover:bg-amber-500/30 transition-colors flex items-center gap-1.5"
                  title="Pausar IA para um atendente humano intervir"
                >
                  <Pause className="w-3.5 h-3.5 shrink-0" />
                  <span>Intervir (Pausar IA)</span>
                </button>
              )}

              {caseData.status === 'needs_attention' && (
                <button 
                  onClick={() => toggleAiStatus('in_negotiation')}
                  className="px-3 py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-xs font-semibold hover:bg-blue-500/30 transition-colors flex items-center gap-1.5"
                  title="Reativar IA para responder automaticamente ao devedor"
                >
                  <Bot className="w-3.5 h-3.5 shrink-0" />
                  <span>Reativar IA</span>
                </button>
              )}
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-[#0e1014]">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
                <Bot className="w-10 h-10 sm:w-12 sm:h-12 mb-3 sm:mb-4 opacity-20" />
                <p className="mb-4 sm:mb-6 text-xs sm:text-sm">Nenhuma mensagem trocada ainda com o devedor.</p>
                {caseData.status === 'not_started' && (
                  <button 
                    onClick={startConversation}
                    disabled={sending}
                    className="px-4 py-2 bg-emerald-500 text-black font-semibold rounded-md text-xs sm:text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50"
                  >
                    Iniciar Abordagem da IA via WhatsApp
                  </button>
                )}
              </div>
            ) : (
              messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                const isHumanAgent = msg.role === 'human';
                const isAi = msg.role === 'ai';

                return (
                  <div key={msg.id || i} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 shadow-sm ${
                      isUser
                        ? 'bg-[#1c1e24] text-slate-200 border border-white/10 rounded-tl-none'
                        : isHumanAgent
                        ? 'bg-blue-950/60 text-blue-100 border border-blue-500/40 rounded-tr-none'
                        : 'bg-emerald-950/60 text-emerald-100 border border-emerald-500/40 rounded-tr-none'
                    }`}>
                      {isAi && (
                        <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-1 flex items-center gap-1">
                          <Bot className="w-3 h-3 shrink-0" /> IA Cobrança
                        </div>
                      )}
                      {isHumanAgent && (
                        <div className="text-[10px] uppercase tracking-wider text-blue-400 font-bold mb-1 flex items-center gap-1">
                          <User className="w-3 h-3 shrink-0" /> Atendente Humano (Você)
                        </div>
                      )}
                      {isUser && (
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400 shrink-0" /> Devedor ({caseData.name})
                        </div>
                      )}

                      <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                      <div className={`text-[10px] mt-1 text-right font-mono opacity-60`}>
                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {chatError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-start mt-2">
                <AlertTriangle className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
                <p>{chatError}</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Human Intervention Input Bar */}
          <form onSubmit={sendAgentMessage} className="p-2.5 sm:p-3 bg-[#111318] border-t border-white/5 flex gap-2 shrink-0">
            <input 
              type="text" 
              value={agentInput}
              onChange={e => setAgentInput(e.target.value)}
              placeholder="Enviar mensagem ao devedor via WhatsApp..."
              className="flex-1 rounded-lg border border-white/10 bg-[#0e1014] text-white px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-500"
              disabled={sendingAgent}
            />
            <button 
              type="submit" 
              disabled={sendingAgent || !agentInput.trim()}
              className="bg-blue-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-semibold shrink-0"
            >
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{sendingAgent ? 'Enviando...' : 'Enviar'}</span>
            </button>
          </form>
        </div>

        {/* Lawyer Details Panel */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          <div className="bg-[#16181d] border border-white/5 rounded-xl p-4 sm:p-5 shadow-sm">
            <h3 className="font-semibold text-white mb-3 sm:mb-4 flex items-center text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 mr-2 text-emerald-500 shrink-0" />
              Regras da IA
            </h3>
            <ul className="text-xs sm:text-sm text-slate-400 space-y-2.5 sm:space-y-3">
              <li className="flex justify-between border-b border-white/5 pb-2">
                <span>Valor Atualizado:</span>
                <span className="font-mono text-white">R$ {caseData.updated_value.toFixed(2)}</span>
              </li>
              <li className="flex justify-between border-b border-white/5 pb-2">
                <span>Margem Máxima:</span>
                <span className="font-mono text-emerald-400">{caseData.max_discount_margin}%</span>
              </li>
              <li className="flex justify-between text-slate-300">
                <span>Piso Absoluto:</span>
                <span className="font-mono">
                  R$ {(caseData.updated_value * (1 - caseData.max_discount_margin / 100)).toFixed(2)}
                </span>
              </li>
            </ul>
          </div>

          <div className="bg-[#16181d] border border-white/5 rounded-xl p-4 sm:p-5 shadow-sm">
            <h3 className="font-semibold text-white mb-2 flex items-center text-xs sm:text-sm">
              <UserCheck className="w-4 h-4 mr-2 text-blue-400 shrink-0" />
              Controle de Atendimento
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Você pode enviar mensagens diretamente a qualquer momento pela caixa de chat. Ao enviar uma mensagem humana, a IA é pausada para dar controle total ao atendente.
            </p>
            {caseData.status === 'needs_attention' ? (
              <button 
                onClick={() => toggleAiStatus('in_negotiation')}
                className="w-full bg-blue-500/20 text-blue-400 border border-blue-500/30 py-2 rounded-md text-xs font-semibold hover:bg-blue-500/30 transition-colors flex items-center justify-center gap-1.5"
              >
                <Bot className="w-3.5 h-3.5 shrink-0" /> Devolver para IA
              </button>
            ) : (
              <button 
                onClick={() => toggleAiStatus('needs_attention')}
                className="w-full bg-amber-500/20 text-amber-400 border border-amber-500/30 py-2 rounded-md text-xs font-semibold hover:bg-amber-500/30 transition-colors flex items-center justify-center gap-1.5"
              >
                <Pause className="w-3.5 h-3.5 shrink-0" /> Assumir Conversa Humana
              </button>
            )}
          </div>

          {caseData.status === 'closed' && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 sm:p-5 shadow-sm">
              <h3 className="font-semibold text-emerald-400 mb-2 flex items-center text-xs sm:text-sm uppercase tracking-wider">
                <CheckCircle className="w-4 h-4 mr-2 shrink-0" /> Acordo Fechado
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mb-4">
                A negociação foi concluída com sucesso.
              </p>
              <button className="w-full bg-emerald-500 text-black font-semibold py-2 rounded-md text-xs sm:text-sm hover:bg-emerald-400 transition-colors">
                Gerar Link Pix
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
