'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Send, Bot, User, CheckCircle, AlertTriangle } from 'lucide-react';

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = params.id as string;
  const router = useRouter();

  const [caseData, setCaseData] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
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

      return () => {
        supabase.removeChannel(channel);
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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput('');
    setSending(true);
    setChatError(null);

    // Optimistic UI for user message
    const tempMsg = { id: Date.now(), role: 'user', content: userMessage, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, message: userMessage })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao enviar mensagem');
      }
      
      // The real-time subscription will fetch the updated case status and AI response,
      // but we can manually trigger a fetch just in case it's slow
      await fetchData();
    } catch (err: any) {
      console.error(err);
      setChatError(err.message);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    } finally {
      setSending(false);
    }
  };

  const startConversation = async () => {
    setSending(true);
    setChatError(null);
    try {
      // Simulate system trigger
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, message: "Olá! Gostaria de iniciar a negociação. Quem sou eu e qual o valor da dívida?" }) // Prompting the AI to start
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
  }

  if (loading) return <div className="p-8 text-slate-300 bg-[#0c0d10] h-screen">Carregando...</div>;
  if (!caseData) return <div className="p-8 text-slate-300 bg-[#0c0d10] h-screen">Caso não encontrado.</div>;

  return (
    <div className="h-screen bg-[#0c0d10] text-slate-300 flex flex-col">
      <header className="bg-[#111318] border-b border-white/5 px-6 py-4 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="text-slate-500 hover:text-white mr-4 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">{caseData.name}</h1>
              <p className="text-sm text-slate-500 font-mono">{caseData.phone}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-6 text-sm">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Valor Atualizado</p>
              <p className="font-bold text-white">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(caseData.updated_value)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Status</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                ${caseData.status === 'not_started' ? 'bg-white/10 text-slate-300' :
                  caseData.status === 'in_negotiation' ? 'bg-blue-500/10 text-blue-400' :
                  caseData.status === 'needs_attention' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-emerald-500/10 text-emerald-400'
                }`}>
                {caseData.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden max-w-5xl w-full mx-auto flex p-6 gap-6">
        
        {/* Chat Simulator */}
        <div className="flex-1 bg-[#16181d] border border-white/5 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="bg-[#111318] border-b border-white/5 p-4 text-white flex justify-between items-center">
            <div className="flex items-center font-semibold text-sm">
              <div className="w-8 h-8 bg-emerald-500/10 rounded mr-3 flex items-center justify-center">
                <Bot className="w-5 h-5 text-emerald-400" />
              </div>
              Simulador de WhatsApp
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold bg-white/5 px-2 py-1 rounded">Visão do Devedor</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0e1014]">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
                <Bot className="w-12 h-12 mb-4 opacity-20" />
                <p className="mb-6 text-sm">Nenhuma mensagem ainda.</p>
                <button 
                  onClick={startConversation}
                  className="px-4 py-2 bg-white/10 text-white rounded-md text-sm hover:bg-white/20 transition-colors"
                >
                  Iniciar Abordagem da IA
                </button>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={msg.id || i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    msg.role === 'user' 
                      ? 'bg-emerald-500 text-black rounded-tr-none' 
                      : 'bg-[#16181d] text-slate-300 border border-white/5 rounded-tl-none shadow-sm'
                  }`}>
                    {msg.role === 'ai' && <div className="text-[10px] uppercase tracking-wider text-emerald-500 font-bold mb-1">IA Cobrança</div>}
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    <div className={`text-[10px] mt-1 text-right font-mono ${msg.role === 'user' ? 'text-black/60' : 'text-slate-600'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                </div>
              ))
            )}
            {chatError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-start mt-2">
                <AlertTriangle className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
                <p>{chatError}</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-3 bg-[#111318] border-t border-white/5 flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Digite como se fosse o devedor..."
              className="flex-1 rounded-full border border-white/10 bg-[#0e1014] text-white px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-slate-600"
              disabled={sending || caseData.status === 'closed'}
            />
            <button 
              type="submit" 
              disabled={sending || !input.trim() || caseData.status === 'closed'}
              className="bg-emerald-500 text-black p-2.5 rounded-full hover:bg-emerald-400 disabled:opacity-50 transition-colors flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Lawyer Details Panel */}
        <div className="w-80 shrink-0 space-y-4">
          <div className="bg-[#16181d] border border-white/5 rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-white mb-4 flex items-center text-sm">
              <AlertTriangle className="w-4 h-4 mr-2 text-emerald-500" />
              Regras da IA
            </h3>
            <ul className="text-sm text-slate-400 space-y-3">
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

          {caseData.status === 'needs_attention' && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-amber-400 mb-2 text-sm uppercase tracking-wider">Handoff Detectado</h3>
              <p className="text-sm text-slate-300 mb-4">
                A IA identificou que o devedor precisa de atendimento humano.
              </p>
              <button className="w-full bg-amber-500/20 text-amber-400 border border-amber-500/30 py-2 rounded-md text-sm font-semibold hover:bg-amber-500/30 transition-colors">
                Assumir Conversa
              </button>
            </div>
          )}

          {caseData.status === 'closed' && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-emerald-400 mb-2 flex items-center text-sm uppercase tracking-wider">
                <CheckCircle className="w-4 h-4 mr-2" /> Acordo Fechado
              </h3>
              <p className="text-sm text-slate-300 mb-4">
                A IA fechou a negociação com sucesso.
              </p>
              <button className="w-full bg-emerald-500 text-black font-semibold py-2 rounded-md text-sm hover:bg-emerald-400 transition-colors">
                Gerar Link Pix
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
