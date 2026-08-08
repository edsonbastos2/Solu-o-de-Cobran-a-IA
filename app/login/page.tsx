'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Bot,
  LogIn,
  Eye,
  EyeOff,
  Handshake,
  FolderKanban,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

const BENEFITS = [
  {
    icon: Handshake,
    title: 'Negociação assistida por IA',
    description: 'Respostas inteligentes em cada contato, respeitando prazos e limites de desconto.',
  },
  {
    icon: FolderKanban,
    title: 'Gestão de casos e contratos',
    description: 'Todo o fluxo de cobrança organizado em um só painel, do contrato à negociação.',
  },
  {
    icon: MessageSquare,
    title: 'Envio via WhatsApp',
    description: 'Comunique-se com clientes direto pela plataforma, com automação e histórico.',
  },
];

const AVATARS = ['RN', 'LP', 'MO', 'TS'];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Check if already logged in
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (session) {
        router.push('/');
      }
    });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Configuração do Supabase ausente.');
      return;
    }
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0d10] lg:grid lg:grid-cols-2">
      {/* Coluna de branding */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10 border-r border-white/5">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-indigo-500/25 via-purple-500/15 to-transparent"
        />
        <div
          aria-hidden="true"
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -left-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl shadow-[0_0_120px_40px_rgba(16,185,129,0.08)]"
        />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Bot className="w-6 h-6 text-black" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">CobrançaIA</span>
          </div>
          <ShieldCheck className="w-5 h-5 text-slate-500" />
        </div>

        <div className="relative space-y-10">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-white tracking-tight leading-tight">
              Cobrança inteligente.
              <br />
              Negociação sem atrito.
            </h2>
            <p className="text-slate-400 text-sm max-w-md">
              O painel do advogado para gerenciar negociações, contratos e comunicações com o apoio da IA.
            </p>
          </div>

          <div className="space-y-4">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <benefit.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{benefit.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 max-w-xs">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {AVATARS.map((initials) => (
                <div
                  key={initials}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 border-2 border-[#0c0d10] flex items-center justify-center text-[10px] font-semibold text-white"
                >
                  {initials}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Advogados e escritórios já confiam no <span className="text-white font-medium">CobrançaIA</span>
            </p>
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-slate-500">
          <span>Termos de uso</span>
          <span aria-hidden="true">·</span>
          <span>Privacidade</span>
          <span className="ml-auto">© 2026 CobrançaIA</span>
        </div>
      </div>

      {/* Coluna do formulário */}
      <div className="flex items-center justify-center p-4 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#111318] border border-white/5 p-8 rounded-2xl shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4">
              <Bot className="w-7 h-7 text-black" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">CobrançaIA</h1>
          </div>

          <div className="hidden lg:block mb-8">
            <h1 className="text-2xl font-bold text-white tracking-tight">Bem-vindo de volta</h1>
            <p className="text-slate-500 mt-2 text-sm">Entre para acessar o painel do advogado e gerenciar suas negociações.</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-400 mb-1">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 pr-11 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-white/5 accent-emerald-500"
                />
                Lembrar de mim
              </label>
              <span
                role="link"
                aria-disabled="true"
                className="text-sm text-emerald-400/80 cursor-not-allowed"
              >
                Esqueci minha senha
              </span>
            </div>

            <div className="pt-4 space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 flex items-center gap-2 text-xs text-slate-500 justify-center lg:hidden">
            <span>Termos de uso</span>
            <span aria-hidden="true">·</span>
            <span>Privacidade</span>
            <span className="ml-auto">© 2026 CobrançaIA</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}