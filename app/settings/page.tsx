'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/header';
import { User, Camera, Mail, Save, Lock, Bell, MessageSquare, Briefcase, Zap, AlertTriangle, Bot, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatPhoneInput } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'ai'>('profile');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [messagingProvider, setMessagingProvider] = useState('whatsapp');
  const [zapiInstance, setZapiInstance] = useState('');
  const [zapiKey, setZapiKey] = useState('');
  const [zapiClientToken, setZapiClientToken] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');

  const [aiProvider, setAiProvider] = useState('opencode');
  const [aiModel, setAiModel] = useState('deepseek-v4-flash');
  const [opencodeKey, setOpencodeKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('');

  // Flags indicando se cada segredo já está salvo no servidor (não expõe o valor)
  const [secrets, setSecrets] = useState<Record<string, boolean>>({});

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error('Falha ao carregar perfil');
        const json = await res.json();
        const p = json.profile;
        if (p) {
          setName(p.name || '');
          setPhone(p.phone ? formatPhoneInput(p.phone) : '');
          setZapiInstance(p.zapi_instance || '');
          setMessagingProvider(p.messaging_provider || 'whatsapp');
          setAiProvider(p.ai_provider || 'opencode');
          setAiModel(p.ai_model || 'deepseek-v4-flash');
          setOllamaUrl(p.ollama_base_url || 'http://localhost:11434');
        }
        if (json.secrets) setSecrets(json.secrets);
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Erro ao carregar configurações.');
      }
    }
    loadProfile();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      // Envia apenas os segredos que o usuário preencheu neste formulário;
      // campos vazios NÃO são enviados (undefined) para não sobrescrever os salvos.
      const payload: Record<string, unknown> = {
        name, phone,
        zapi_instance: zapiInstance,
        messaging_provider: messagingProvider,
        ai_provider: aiProvider,
        ai_model: aiModel,
        ollama_base_url: ollamaUrl,
      };
      if (zapiKey !== '') payload.zapi_key = zapiKey;
      if (zapiClientToken !== '') payload.zapi_client_token = zapiClientToken;
      if (telegramBotToken !== '') payload.telegram_bot_token = telegramBotToken;
      if (opencodeKey !== '') payload.opencode_api_key = opencodeKey;
      if (geminiKey !== '') payload.gemini_api_key = geminiKey;
      if (openaiKey !== '') payload.openai_api_key = openaiKey;
      if (anthropicKey !== '') payload.anthropic_api_key = anthropicKey;
      if (openrouterKey !== '') payload.openrouter_api_key = openrouterKey;

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');

      // Limpa os campos de segredo após salvar com sucesso
      setZapiKey(''); setZapiClientToken(''); setTelegramBotToken('');
      setOpencodeKey(''); setGeminiKey(''); setOpenaiKey(''); setAnthropicKey(''); setOpenrouterKey('');

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError('Erro ao salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e1014] text-slate-300 font-sans flex flex-col">
      <Header />
      
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Configurações da Conta</h1>
          <p className="text-slate-500 text-sm">Gerencie suas informações pessoais e integrações de sistema.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Sidebar / Tabs */}
          <div className="md:col-span-3 space-y-1">
            <button 
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors text-left ${activeTab === 'profile' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-slate-300 border border-transparent'}`}
            >
              <User className="w-4 h-4 shrink-0" />
              Perfil e Integração
            </button>
            <button 
              onClick={() => setActiveTab('ai')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors text-left ${activeTab === 'ai' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-slate-300 border border-transparent'}`}
            >
              <Bot className="w-4 h-4 shrink-0" />
              Modelos de IA
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-300 font-medium text-sm transition-colors text-left border border-transparent">
              <Bell className="w-4 h-4 shrink-0" />
              Notificações
            </button>
          </div>

          {/* Main Content */}
          <div className="md:col-span-9 space-y-8">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start text-sm">
                <AlertTriangle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
            <form onSubmit={handleSave}>
              {activeTab === 'profile' && (
                <>
                  {/* Profile Section */}
                  <div className="bg-[#111318] border border-white/5 rounded-xl p-6 shadow-sm mb-8">
                    <h2 className="text-lg font-semibold text-white mb-6 flex items-center">
                      <User className="w-5 h-5 mr-2 text-emerald-500" />
                      Informações Pessoais
                    </h2>
                    
                    <div className="flex flex-col sm:flex-row gap-8 items-start mb-8">
                      <div className="relative group cursor-pointer shrink-0">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium text-3xl shadow-lg border-4 border-[#0e1014] overflow-hidden">
                          {user?.email ? user.email.substring(0, 2).toUpperCase() : 'AD'}
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 space-y-4 w-full">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Nome Completo</label>
                            <div className="relative">
                              <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                              <input 
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: João Silva"
                                className="w-full bg-[#0e1014] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">E-mail (Login)</label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                              <input 
                                type="email"
                                disabled
                                value={user?.email || ''}
                                className="w-full bg-[#0e1014]/50 border border-white/5 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-500 cursor-not-allowed"
                              />
                            </div>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Telefone (WhatsApp)</label>
                            <div className="relative">
                              <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                              <input 
                                type="text"
                                value={phone}
                                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                                placeholder="(11) 99999-9999"
                                className="w-full bg-[#0e1014] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* API Integration Section */}
                  <div className="bg-[#111318] border border-white/5 rounded-xl p-6 shadow-sm mb-8">
                    <h2 className="text-lg font-semibold text-white mb-2 flex items-center">
                      <Zap className="w-5 h-5 mr-2 text-blue-500" />
                      Integração de Mensageria
                    </h2>
                    <p className="text-sm text-slate-500 mb-6">Escolha o provedor de mensagens e configure as credenciais para envio automatizado pela IA.</p>
                    
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Provedor de Mensagens</label>
                      <select
                        value={messagingProvider}
                        onChange={(e) => setMessagingProvider(e.target.value)}
                        className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      >
                        <option value="whatsapp">WhatsApp (Z-API)</option>
                        <option value="telegram">Telegram (Bot API)</option>
                      </select>
                    </div>

                    {messagingProvider === 'whatsapp' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                        <p className="text-xs text-slate-500 sm:col-span-2">Configure suas credenciais da Z-API para habilitar o envio e recebimento de mensagens via WhatsApp.</p>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">ID da Instância (Instance ID)</label>
                          <input 
                            type="text"
                            value={zapiInstance}
                            onChange={(e) => setZapiInstance(e.target.value)}
                            placeholder="Ex: 3AXXXXXX..."
                            className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Token da Instância
                            {secrets.zapi_key_set && <span className="ml-2 inline-flex items-center text-emerald-400 normal-case tracking-normal"><CheckCircle2 className="w-3 h-3 mr-1" />salvo</span>}
                          </label>
                          <input
                            type="password"
                            value={zapiKey}
                            onChange={(e) => setZapiKey(e.target.value)}
                            placeholder={secrets.zapi_key_set ? '•••••• (preencha para substituir)' : 'Ex: A5B2C...'}
                            className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Token de Segurança (Client-Token)
                            {secrets.zapi_client_token_set && <span className="ml-2 inline-flex items-center text-emerald-400 normal-case tracking-normal"><CheckCircle2 className="w-3 h-3 mr-1" />salvo</span>}
                          </label>
                          <input
                            type="password"
                            value={zapiClientToken}
                            onChange={(e) => setZapiClientToken(e.target.value)}
                            placeholder={secrets.zapi_client_token_set ? '•••••• (preencha para substituir)' : '••••••••••••••••'}
                            className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                          />
                        </div>
                      </div>
                    )}

                    {messagingProvider === 'telegram' && (
                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <p className="text-xs text-slate-500">Configure seu Bot do Telegram para envio e recebimento de mensagens automatizadas.</p>
                        <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
                          <li>Crie um bot no Telegram via <a href="https://t.me/BotFather" target="_blank" className="text-blue-400 hover:underline">@BotFather</a></li>
                          <li>Copie o Token de acesso gerado e cole abaixo</li>
                          <li>Configure o webhook apontando para <code className="text-xs bg-slate-800 px-1 py-0.5 rounded">{process.env.NEXT_PUBLIC_APP_URL || 'https://seu-app.com'}/api/webhook/telegram</code></li>
                        </ol>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Token do Bot
                            {secrets.telegram_bot_token_set && <span className="ml-2 inline-flex items-center text-emerald-400 normal-case tracking-normal"><CheckCircle2 className="w-3 h-3 mr-1" />salvo</span>}
                          </label>
                          <input
                            type="password"
                            value={telegramBotToken}
                            onChange={(e) => setTelegramBotToken(e.target.value)}
                            placeholder={secrets.telegram_bot_token_set ? '•••••• (preencha para substituir)' : '123456:ABC-DEF1234gh...'}
                            className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'ai' && (
                <div className="bg-[#111318] border border-white/5 rounded-xl p-6 shadow-sm mb-8">
                  <h2 className="text-lg font-semibold text-white mb-2 flex items-center">
                    <Bot className="w-5 h-5 mr-2 text-blue-400" />
                    Modelos de Inteligência Artificial
                  </h2>
                  <p className="text-sm text-slate-500 mb-6">Escolha o provedor e modelo de IA que deseja utilizar nas negociações. Adicione suas chaves de API caso não queira usar a chave global do sistema.</p>
                  
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Provedor de IA</label>
                        <select 
                          value={aiProvider}
                          onChange={(e) => setAiProvider(e.target.value)}
                          className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        >
                          <option value="opencode">OpenCode Zen (DeepSeek/Recomendado)</option>
                          <option value="gemini">Google Gemini</option>
                          <option value="openai">OpenAI (ChatGPT)</option>
                          <option value="anthropic">Anthropic (Claude)</option>
                          <option value="openrouter">OpenRouter (OpenCode / Outros)</option>
                          <option value="ollama">Ollama (Modelos Locais)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Modelo</label>
                        {aiProvider === 'ollama' || aiProvider === 'openrouter' ? (
                          <input 
                            type="text"
                            value={aiModel}
                            onChange={(e) => setAiModel(e.target.value)}
                            placeholder={aiProvider === 'openrouter' ? "Ex: meta-llama/llama-3-8b-instruct:free" : "Ex: llama3"}
                            className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                          />
                        ) : (
                          <select 
                            value={aiModel}
                            onChange={(e) => setAiModel(e.target.value)}
                            className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                          >
                            {aiProvider === 'opencode' && (
                              <>
                                <option value="deepseek-v4-pro">DeepSeek V4 Pro (Extração precisa)</option>
                                <option value="deepseek-v4-flash">DeepSeek V4 Flash (Rápido/Econômico)</option>
                              </>
                            )}
                            {aiProvider === 'gemini' && (
                              <>
                                <option value="gemini-3.5-flash">Gemini 3.5 Flash (Rápido/Recomendado)</option>
                                <option value="gemini-3.1-pro">Gemini 3.1 Pro (Mais inteligente)</option>
                              </>
                            )}
                            {aiProvider === 'openai' && (
                              <>
                                <option value="gpt-4o">GPT-4o</option>
                                <option value="gpt-4o-mini">GPT-4o Mini</option>
                              </>
                            )}
                            {aiProvider === 'anthropic' && (
                              <>
                                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                                <option value="claude-3-haiku">Claude 3 Haiku</option>
                              </>
                            )}
                          </select>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 space-y-4">
                      <h3 className="text-sm font-semibold text-slate-300">Chaves de API Personalizadas</h3>
                      <p className="text-xs text-slate-500 mb-4">Se não preenchidas, será utilizada a chave global configurada na plataforma.</p>
                       
                      {aiProvider === 'opencode' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">OpenCode Zen API Key
                            {secrets.opencode_api_key_set && <span className="ml-2 inline-flex items-center text-emerald-400 normal-case tracking-normal"><CheckCircle2 className="w-3 h-3 mr-1" />salvo</span>}
                          </label>
                          <input
                            type="password"
                            value={opencodeKey}
                            onChange={(e) => setOpencodeKey(e.target.value)}
                            placeholder={secrets.opencode_api_key_set ? '•••••• (preencha para substituir)' : 'sk-...'}
                            className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                          />
                        </div>
                      )}

                      {aiProvider === 'gemini' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Google Gemini API Key
                            {secrets.gemini_api_key_set && <span className="ml-2 inline-flex items-center text-emerald-400 normal-case tracking-normal"><CheckCircle2 className="w-3 h-3 mr-1" />salvo</span>}
                          </label>
                          <input
                            type="password"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder={secrets.gemini_api_key_set ? '•••••• (preencha para substituir)' : 'AIzaSy...'}
                            className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                          />
                        </div>
                      )}
                      
                      {aiProvider === 'openai' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">OpenAI API Key
                            {secrets.openai_api_key_set && <span className="ml-2 inline-flex items-center text-emerald-400 normal-case tracking-normal"><CheckCircle2 className="w-3 h-3 mr-1" />salvo</span>}
                          </label>
                          <input
                            type="password"
                            value={openaiKey}
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            placeholder={secrets.openai_api_key_set ? '•••••• (preencha para substituir)' : 'sk-...'}
                            className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                          />
                        </div>
                      )}
                      
                      {aiProvider === 'anthropic' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Anthropic API Key
                            {secrets.anthropic_api_key_set && <span className="ml-2 inline-flex items-center text-emerald-400 normal-case tracking-normal"><CheckCircle2 className="w-3 h-3 mr-1" />salvo</span>}
                          </label>
                          <input
                            type="password"
                            value={anthropicKey}
                            onChange={(e) => setAnthropicKey(e.target.value)}
                            placeholder={secrets.anthropic_api_key_set ? '•••••• (preencha para substituir)' : 'sk-ant-...'}
                            className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                          />
                        </div>
                      )}

                      {aiProvider === 'openrouter' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">OpenRouter API Key
                            {secrets.openrouter_api_key_set && <span className="ml-2 inline-flex items-center text-emerald-400 normal-case tracking-normal"><CheckCircle2 className="w-3 h-3 mr-1" />salvo</span>}
                          </label>
                          <input
                            type="password"
                            value={openrouterKey}
                            onChange={(e) => setOpenrouterKey(e.target.value)}
                            placeholder={secrets.openrouter_api_key_set ? '•••••• (preencha para substituir)' : 'sk-or-v1-...'}
                            className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                          />
                        </div>
                      )}

                      {aiProvider === 'ollama' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">URL Base do Ollama</label>
                          <input 
                            type="text"
                            value={ollamaUrl}
                            onChange={(e) => setOllamaUrl(e.target.value)}
                            placeholder="http://localhost:11434"
                            className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                          />
                          <p className="text-xs text-slate-500 mt-2">Certifique-se de que o servidor do Ollama está rodando e acessível a partir desta aplicação.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-4">
                {saved && (
                  <span className="text-emerald-400 text-sm font-medium flex items-center">
                    <Save className="w-4 h-4 mr-1.5" />
                    Salvo com sucesso!
                  </span>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-500 text-black px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center"
                >
                  {saving ? (
                    <>Salvando...</>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
