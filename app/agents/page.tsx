'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Header } from '@/components/header';
import { useAuth } from '@/hooks/useAuth';
import {
  Bot,
  Plus,
  RotateCcw,
  Play,
  CheckCircle2,
  AlertCircle,
  Shield,
  BellRing,
  Handshake,
  Calculator,
  Scale,
  TrendingUp,
  Cpu,
  Edit,
  Trash2,
  X,
  Sparkles,
  Zap,
  Sliders,
  ChevronDown,
  ChevronUp,
  ArrowDown
} from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { AgentConfig, DEFAULT_AGENTS } from '@/lib/multi-agent';

const ROLE_OPTIONS = [
  { value: 'supervisor', label: 'Supervisor IA (Orquestrador)', color: 'bg-blue-600', icon: Shield },
  { value: 'cobranca', label: 'Cobrança Preventiva / Lembretes', color: 'bg-emerald-600', icon: BellRing },
  { value: 'negociacao', label: 'Negociação & Acordos', color: 'bg-purple-600', icon: Handshake },
  { value: 'financeiro', label: 'Financeiro & Recálculo PIX', color: 'bg-amber-600', icon: Calculator },
  { value: 'juridico', label: 'Jurídico & Cobrança Formal', color: 'bg-red-600', icon: Scale },
  { value: 'qualidade', label: 'Qualidade & Compliance (CDC)', color: 'bg-teal-600', icon: CheckCircle2 },
  { value: 'analise_credito', label: 'Análise de Crédito & Risco', color: 'bg-cyan-600', icon: TrendingUp },
  { value: 'custom', label: 'Especialista Personalizado', color: 'bg-indigo-600', icon: Bot },
];

const MODEL_OPTIONS = [
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Ultrarrápido)' },
  { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro (Raciocínio Avançado)' },
  { value: 'gpt-4o-mini', label: 'OpenAI GPT-4o-mini' },
  { value: 'claude-3-haiku', label: 'Anthropic Claude 3 Haiku' },
  { value: 'llama3', label: 'Ollama Llama 3 (Local)' }
];

const TONE_OPTIONS = [
  { value: 'empatico', label: 'Empático e Acolhedor' },
  { value: 'firme', label: 'Firme e Objetivo' },
  { value: 'formal', label: 'Formal e Técnico' },
  { value: 'analitico', label: 'Analítico e Transparente' },
  { value: 'negociador', label: 'Negociador e Persuasivo' }
];

import { fetcher } from "@/lib/api";

export default function AgentsPage() {
  const { user } = useAuth();
  
  const [page, setPage] = useState(1);
  const limit = 10;
  
  const { data, mutate, isLoading } = useSWR(`/api/agents?page=${page}&limit=${limit}`, fetcher);

  const agents: AgentConfig[] = data?.agents || DEFAULT_AGENTS;

  // Editor Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Partial<AgentConfig> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Playground Simulator state
  const [simMessage, setSimMessage] = useState('Estou desempregado mas consigo R$ 1.500 à vista agora se derem um bom desconto. Quanto fica?');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [showTopology, setShowTopology] = useState(true);

  const handleOpenNewModal = () => {
    setEditingAgent({
      name: '',
      role_type: 'negociacao',
      icon: 'Handshake',
      color: 'bg-purple-600',
      description: '',
      system_prompt: 'Você é um especialista focado em fechar acordos de pagamento...',
      model: 'gemini-3.5-flash',
      temperature: 0.2,
      max_discount: 15,
      tone: 'negociador',
      is_active: true
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (agent: AgentConfig) => {
    setEditingAgent({ ...agent });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      if (editingAgent.id && !editingAgent.id.startsWith('agent-')) {
        // Update existing in DB
        const res = await fetch(`/api/agents/${editingAgent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingAgent)
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Erro ao atualizar agente.');
        }
      } else {
        // Create new
        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...editingAgent,
            user_id: user?.id
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Erro ao criar agente.');
        }
      }

      await mutate();
      setIsModalOpen(false);
      setEditingAgent(null);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este especialista?')) return;
    try {
      if (!id.startsWith('agent-')) {
        await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      }
      await mutate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Deseja restaurar a estrutura padrão de agentes especialistas?')) return;
    try {
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_defaults', userId: user?.id })
      });
      await mutate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunSimulation = async () => {
    if (!simMessage.trim() || simulating) return;
    setSimulating(true);
    setSimError(null);
    setSimResult(null);

    try {
      const res = await fetch('/api/agents/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: simMessage,
          caseInfo: {
            name: 'Carlos Eduardo',
            updated_value: 2800.00,
            diasAtraso: 42,
            effective_max_discount: 20
          },
          agentsList: agents
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao simular');
      }

      const result = await res.json();
      setSimResult(result);
    } catch (err: any) {
      setSimError(err.message);
    } finally {
      setSimulating(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const found = ROLE_OPTIONS.find((r) => r.value === role);
    return found || { label: role, color: 'bg-slate-600', icon: Bot };
  };

  return (
    <div className="min-h-screen bg-[#0c0d10] text-slate-300 pb-16">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Module Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-[#111318] p-6 rounded-2xl border border-white/5">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Cpu className="w-4 h-4" /> Multi-Agent Orchestration Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Especialistas IA
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Crie e configure vários agentes especializados coordenados pelo <strong>Supervisor IA</strong>. 
              Cada especialista atua em um domínio específico (Cobrança, Negociação, Financeiro, Jurídico, Qualidade e Crédito).
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleResetDefaults}
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
              title="Restaurar topo-arquitetura padrão"
            >
              <RotateCcw className="w-4 h-4" />
              Restaurar Padrão
            </button>
            <button
              onClick={handleOpenNewModal}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              Novo Agente
            </button>
          </div>
        </div>

        {/* Visual Multi-Agent Architecture Diagram */}
        <div className="mb-10 bg-[#111318] rounded-2xl border border-white/5 p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">Topologia do Sistema de Agentes</h2>
            </div>
            <button
              onClick={() => setShowTopology(!showTopology)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              {showTopology ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showTopology ? 'Ocultar Diagrama' : 'Exibir Diagrama'}
            </button>
          </div>

          {showTopology && (
            <div className="flex flex-col items-center">
              {/* Supervisor Node (Top) */}
              {(() => {
                const sup = agents.find(a => a.role_type === 'supervisor') || DEFAULT_AGENTS[0];
                return (
                  <div className="w-full max-w-sm bg-gradient-to-r from-blue-900/40 via-blue-950/60 to-indigo-900/40 border border-blue-500/40 rounded-xl p-4 text-center shadow-lg relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-black text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full shadow">
                      Orquestrador Central
                    </div>
                    <div className="flex items-center justify-center gap-2 text-white font-bold text-sm sm:text-base mt-1">
                      <Shield className="w-5 h-5 text-blue-400" />
                      {sup.name}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1">{sup.description}</p>
                    <div className="mt-2.5 inline-flex items-center gap-2 text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2.5 py-0.5 rounded-md font-mono">
                      <span>Modelo: {sup.model}</span> • <span>Temp: {sup.temperature}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Connecting Lines */}
              <div className="my-3 flex flex-col items-center">
                <div className="w-0.5 h-6 bg-gradient-to-b from-blue-500 to-slate-700"></div>
                <ArrowDown className="w-4 h-4 text-slate-500 -mt-1" />
              </div>

              {/* Specialists Hierarchy Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 w-full">
                {agents
                  .filter(a => a.role_type !== 'supervisor')
                  .map((agent) => {
                    const badge = getRoleBadge(agent.role_type);
                    const IconComp = badge.icon;
                    return (
                      <div
                        key={agent.id}
                        onClick={() => handleOpenEditModal(agent)}
                        className={`cursor-pointer p-3.5 rounded-xl border transition-all hover:scale-[1.02] flex flex-col justify-between ${
                          agent.is_active
                            ? 'bg-[#16181d] border-white/10 hover:border-emerald-500/50'
                            : 'bg-[#111318] border-white/5 opacity-50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className={`w-7 h-7 rounded-lg ${badge.color} flex items-center justify-center text-white shrink-0`}>
                              <IconComp className="w-4 h-4" />
                            </div>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${agent.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                              {agent.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          <h4 className="font-bold text-white text-xs sm:text-sm leading-snug line-clamp-1">{agent.name}</h4>
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{agent.description}</p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
                          <span>Max Desc: {agent.max_discount}%</span>
                          <span className="font-mono text-slate-400">{agent.tone}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Agents Grid List */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              Configuração dos Agentes ({agents.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => {
              const badge = getRoleBadge(agent.role_type);
              const IconComp = badge.icon;

              return (
                <div
                  key={agent.id}
                  className={`bg-[#16181d] border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                    agent.is_active ? 'border-white/10 hover:border-white/20' : 'border-white/5 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${badge.color} flex items-center justify-center text-white shadow-md shrink-0`}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base leading-snug">{agent.name}</h3>
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${agent.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                        {agent.is_active ? 'Ativo' : 'Pausado'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-2">
                      {agent.description || agent.system_prompt.substring(0, 100) + '...'}
                    </p>

                    <div className="bg-[#0e1014] p-3 rounded-xl border border-white/5 space-y-2 text-xs font-mono mb-4">
                      <div className="flex justify-between text-slate-400">
                        <span>Modelo:</span>
                        <span className="text-white font-sans font-medium">{agent.model}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Temperatura:</span>
                        <span className="text-white">{agent.temperature}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Margem Teto Desconto:</span>
                        <span className="text-emerald-400 font-bold">{agent.max_discount}%</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Tom da Conversa:</span>
                        <span className="text-indigo-300 font-sans capitalize">{agent.tone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
                    <button
                      onClick={() => handleOpenEditModal(agent)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5" /> Editar Prompt & Regras
                    </button>
                    {agent.role_type !== 'supervisor' && (
                      <button
                        onClick={() => handleDeleteAgent(agent.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                        title="Remover Agente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-6">
            <Pagination 
              currentPage={page}
              totalPages={data?.totalPages || 1}
              onPageChange={setPage}
              theme="dark"
            />
          </div>
        </div>

        {/* Multi-Agent Playground / Live Simulator */}
        <div className="bg-[#111318] border border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Simulador de Atendimento Multi-Agente</h2>
              <p className="text-xs text-slate-400">
                Teste em tempo real como o Supervisor IA roteia a mensagem para os especialistas e aplica a auditoria da Qualidade.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Mensagem Simulada do Devedor
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  placeholder="Digite uma mensagem simulada de um cliente devedor..."
                  className="flex-1 bg-[#0e1014] border border-white/10 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleRunSimulation}
                  disabled={simulating || !simMessage.trim()}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors flex items-center gap-2 shrink-0 shadow-lg shadow-purple-600/20"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {simulating ? 'Processando Agentes...' : 'Simular Roteamento'}
                </button>
              </div>
            </div>

            {simError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{simError}</span>
              </div>
            )}

            {simResult && (
              <div className="mt-6 space-y-4 pt-4 border-t border-white/10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Step 1: Supervisor */}
                  <div className="bg-[#16181d] border border-blue-500/30 rounded-xl p-4">
                    <div className="text-[10px] uppercase font-bold text-blue-400 flex items-center gap-1 mb-1">
                      <Shield className="w-3.5 h-3.5" /> Etapa 1: Supervisor IA (Análise)
                    </div>
                    <div className="text-xs text-white font-semibold mb-1">
                      Roteado para: <span className="text-purple-400 uppercase">{simResult.supervisor.selected_role}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{simResult.supervisor.reasoning}</p>
                  </div>

                  {/* Step 2: Specialist Draft */}
                  <div className="bg-[#16181d] border border-purple-500/30 rounded-xl p-4">
                    <div className="text-[10px] uppercase font-bold text-purple-400 flex items-center gap-1 mb-1">
                      <Handshake className="w-3.5 h-3.5" /> Etapa 2: {simResult.specialist.name}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed italic line-clamp-3">
                      &quot;{simResult.specialist.draft}&quot;
                    </p>
                  </div>

                  {/* Step 3: Quality Check */}
                  <div className="bg-[#16181d] border border-teal-500/30 rounded-xl p-4">
                    <div className="text-[10px] uppercase font-bold text-teal-400 flex items-center gap-1 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Etapa 3: Auditoria da Qualidade
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-white">Score CDC: {simResult.quality.complianceScore}/100</span>
                      <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded font-bold">Aprovado</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{simResult.quality.feedback}</p>
                  </div>
                </div>

                {/* Final WhatsApp Preview */}
                <div className="bg-[#0e1014] border border-emerald-500/30 rounded-2xl p-4">
                  <div className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                    <Bot className="w-4 h-4" /> Resposta Final Enviada ao WhatsApp do Devedor:
                  </div>
                  <div className="bg-[#1c1e24] p-4 rounded-xl text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap border border-white/5">
                    {simResult.finalText}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Agent Edit/Create Modal */}
      {isModalOpen && editingAgent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111318] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#16181d]">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {editingAgent.id ? 'Editar Agente Especialista' : 'Criar Novo Agente Especialista'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAgent} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome do Agente
                  </label>
                  <input
                    type="text"
                    required
                    value={editingAgent.name || ''}
                    onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                    placeholder="Ex: Especialista em Negociação"
                    className="w-full bg-[#0e1014] border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Especialidade / Domínio
                  </label>
                  <select
                    value={editingAgent.role_type || 'negociacao'}
                    onChange={(e) => {
                      const sel = ROLE_OPTIONS.find(r => r.value === e.target.value);
                      setEditingAgent({
                        ...editingAgent,
                        role_type: e.target.value as any,
                        color: sel?.color || 'bg-indigo-600'
                      });
                    }}
                    className="w-full bg-[#0e1014] border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descrição Curta
                </label>
                <input
                  type="text"
                  value={editingAgent.description || ''}
                  onChange={(e) => setEditingAgent({ ...editingAgent, description: e.target.value })}
                  placeholder="Resumo da atuação deste agente para o Supervisor..."
                  className="w-full bg-[#0e1014] border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Modelo de IA
                  </label>
                  <select
                    value={editingAgent.model || 'gemini-3.5-flash'}
                    onChange={(e) => setEditingAgent({ ...editingAgent, model: e.target.value })}
                    className="w-full bg-[#0e1014] border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tom da Comunicação
                  </label>
                  <select
                    value={editingAgent.tone || 'negociador'}
                    onChange={(e) => setEditingAgent({ ...editingAgent, tone: e.target.value })}
                    className="w-full bg-[#0e1014] border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {TONE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Teto Máx. Desconto (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingAgent.max_discount ?? 10}
                    onChange={(e) => setEditingAgent({ ...editingAgent, max_discount: Number(e.target.value) })}
                    className="w-full bg-[#0e1014] border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Temperatura ({editingAgent.temperature})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={editingAgent.temperature ?? 0.2}
                    onChange={(e) => setEditingAgent({ ...editingAgent, temperature: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-3 pt-4 sm:pt-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingAgent.is_active ?? true}
                      onChange={(e) => setEditingAgent({ ...editingAgent, is_active: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                  <span className="text-xs font-semibold text-white">
                    {editingAgent.is_active ? 'Agente Habilitado' : 'Agente Desabilitado'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Prompt do Sistema (System Instructions)
                </label>
                <textarea
                  rows={6}
                  required
                  value={editingAgent.system_prompt || ''}
                  onChange={(e) => setEditingAgent({ ...editingAgent, system_prompt: e.target.value })}
                  placeholder="Escreva as diretrizes e regras que orientam o comportamento deste especialista..."
                  className="w-full bg-[#0e1014] border border-white/10 rounded-xl p-3 text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-colors disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Agente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
