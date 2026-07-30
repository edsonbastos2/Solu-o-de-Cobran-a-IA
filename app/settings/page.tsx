'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/header';
import { User, Camera, Mail, Save, Lock, Bell, MessageSquare, Briefcase, Zap, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [zapiKey, setZapiKey] = useState('');
  const [zapiInstance, setZapiInstance] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (user && supabase) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (data) {
          setName(data.name || '');
          setPhone(data.phone || '');
          setZapiInstance(data.zapi_instance || '');
          setZapiKey(data.zapi_key || '');
        } else if (error && error.code !== 'PGRST116') {
          console.error('Error loading profile:', error);
        }
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
      if (!supabase) throw new Error('Supabase não configurado');

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name,
          phone,
          zapi_instance: zapiInstance,
          zapi_key: zapiKey,
          updated_at: new Date().toISOString(),
        });
        
      if (error) throw error;
      
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
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium text-sm transition-colors text-left border border-emerald-500/20">
              <User className="w-4 h-4" />
              Perfil e Conta
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-300 font-medium text-sm transition-colors text-left">
              <Zap className="w-4 h-4" />
              Integração Z-API
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-300 font-medium text-sm transition-colors text-left">
              <Bell className="w-4 h-4" />
              Notificações
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-300 font-medium text-sm transition-colors text-left">
              <Lock className="w-4 h-4" />
              Segurança
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
                            onChange={(e) => setPhone(e.target.value)}
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
                  Integração WhatsApp (Z-API)
                </h2>
                <p className="text-sm text-slate-500 mb-6">Configure suas credenciais da Z-API para habilitar o envio e recebimento de mensagens automatizadas da IA.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Token de Segurança (Client-Token)</label>
                    <input 
                      type="password"
                      value={zapiKey}
                      onChange={(e) => setZapiKey(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full bg-[#0e1014] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

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
