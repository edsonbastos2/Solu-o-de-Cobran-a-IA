'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Bot, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 8;

export default function AceitarConvitePage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false);
      return;
    }

    // A troca do token de convite por sessão já acontece server-side em
    // /convite/confirmar (verifyOtp + cookies), antes deste redirect — aqui
    // só lemos a sessão já pronta via cookies. Se o token era inválido/já
    // usado, aquela rota redireciona para cá com ?error=invalid_link.
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('error')) {
      setSessionEmail(null);
      setCheckingSession(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionEmail(session?.user?.email ?? null);
      setCheckingSession(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Configuração do Supabase ausente.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setSubmitting(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push('/'), 1500);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0c0d10] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!sessionEmail) {
    return (
      <div className="min-h-screen bg-[#0c0d10] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#111318] border border-white/5 p-8 rounded-2xl shadow-2xl text-center">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4 mx-auto">
            <Bot className="w-7 h-7 text-black" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Link inválido ou expirado</h1>
          <p className="text-slate-400 text-sm">
            Este link de convite não é mais válido. Peça para quem te convidou reenviar o convite pela tela de gestão de equipe.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0c0d10] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#111318] border border-white/5 p-8 rounded-2xl shadow-2xl text-center">
          <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Senha criada com sucesso</h1>
          <p className="text-slate-400 text-sm">Redirecionando para o painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0d10] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111318] border border-white/5 p-8 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4">
            <KeyRound className="w-7 h-7 text-black" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Bem-vindo ao CobrançaIA</h1>
          <p className="text-slate-500 mt-2 text-sm text-center">
            Defina uma senha para <span className="text-white font-medium">{sessionEmail}</span> e comece a usar a plataforma.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-400 mb-1">
              Nova senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 pr-11 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                required
                minLength={MIN_PASSWORD_LENGTH}
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

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-400 mb-1">
              Confirmar senha
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Criando senha...' : 'Criar senha e entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
