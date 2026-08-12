'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { fetchWithAuth } from '@/lib/api';
import { AiBucketEditor, BucketValue } from '@/components/ai-bucket-editor';
import { AIBucket, AIProvider } from '@/lib/ai-config-client';

interface SystemDefaults {
  assistant: BucketValue;
  pdf_extraction: BucketValue;
}

export default function AdminAiDefaultsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<SystemDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (user || profile)) {
      const isSuper = profile?.is_super_admin === true;
      if (!isSuper) {
        router.push('/');
      }
    }
  }, [user, profile, authLoading, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/admin/ai-defaults');
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Falha ao carregar padrões de IA.');
      }
      setData((await res.json()) as SystemDefaults);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar padrões.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.is_super_admin) load();
    else if (!authLoading && !profile?.is_super_admin) setLoading(false);
  }, [profile?.is_super_admin, authLoading]);

  const handleSave = (bucket: AIBucket) => async (payload: {
    provider: AIProvider;
    model: string;
    ollama_base_url?: string;
    secretField: string;
    secret?: string;
  }) => {
    const body: Record<string, unknown> = {
      bucket,
      provider: payload.provider,
      model: payload.model,
    };
    if (payload.ollama_base_url) body.ollama_base_url = payload.ollama_base_url;
    if (payload.secret) body[payload.secretField] = payload.secret;

    const res = await fetchWithAuth('/api/admin/ai-defaults', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Erro ao salvar padrão.');
    await load();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0e1014] text-slate-300 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Carregando…</p>
      </div>
    );
  }

  if (!profile?.is_super_admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0e1014] text-slate-300 font-sans flex flex-col">
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-400" />
            Padrões de IA do Sistema
          </h1>
          <p className="text-slate-500 text-sm">
            Defina o provedor e modelo padrão usados como fallback quando um tenant não configura o bucket correspondente. Editável em runtime — sem redeploy.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start text-sm">
            <AlertTriangle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-slate-500 text-sm">Carregando padrões…</div>
        ) : data ? (
          <div className="space-y-6">
            <AiBucketEditor
              bucket="assistant"
              title="Assistente (padrão de sistema)"
              description="Fallback do bucket Assistente para tenants que não configuraram provedor próprio."
              value={data.assistant}
              disabled={false}
              onSave={handleSave('assistant')}
            />
            <AiBucketEditor
              bucket="pdf_extraction"
              title="Extração de PDF (padrão de sistema)"
              description="Fallback do bucket Extração de PDF. Restrito a provedores com visão de documento."
              value={data.pdf_extraction}
              disabled={false}
              visionOnly
              onSave={handleSave('pdf_extraction')}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}