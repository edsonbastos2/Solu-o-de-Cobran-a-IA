'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { fetchWithAuth } from '@/lib/api';
import { AiBucketEditor, BucketValue } from '@/components/ai-bucket-editor';
import { AIBucket, AIProvider } from '@/lib/ai-config-client';

interface TenantAIConfig {
  assistant: BucketValue;
  pdf_extraction: BucketValue;
  agents: BucketValue;
  migrated_at: string | null;
}

function sourceBadgeFor(bucket: BucketValue): string {
  if (bucket.provider) return 'usando configuração do tenant';
  return 'usando padrão de sistema / fallback';
}

export function TenantAiConfigPanel() {
  const { tenantId, tenantQuery, isAdmin } = useActiveTenant();
  const [config, setConfig] = useState<TenantAIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const prevMigratedAt = useRef<string | null | undefined>(undefined);

  const loadConfig = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/tenants/${tenantId}/ai-config?${tenantQuery}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao carregar configuração do tenant');
      }
      const json = (await res.json()) as TenantAIConfig;
      setConfig(json);
      // Banner de migração: migrated_at passou a existir (transição null → valor)
      // desde a carga anterior. `prevMigratedAt` inicia undefined para não
      // disparar na primeira carga; dispara só na transição.
      if (json.migrated_at && prevMigratedAt.current === null) {
        setShowBanner(true);
      }
      prevMigratedAt.current = json.migrated_at;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar configuração.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, tenantQuery]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

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

    const res = await fetchWithAuth(`/api/tenants/${tenantId}/ai-config?${tenantQuery}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar bucket.');
    // Recarrega para atualizar os badges `*_set` e o badge de origem.
    await loadConfig();
  };

  if (!tenantId) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-4 rounded-xl text-sm">
        Selecione um tenant ativo para gerenciar a configuração de IA.
      </div>
    );
  }

  if (loading) {
    return <div className="text-slate-500 text-sm">Carregando configuração do tenant…</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start text-sm">
          <AlertTriangle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {showBanner && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-4 rounded-xl flex items-start text-sm">
          <AlertTriangle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
          <p className="flex-1">Sua configuração de IA foi migrada automaticamente para este tenant. Edite-a aqui em &ldquo;Configurações do Tenant&rdquo;.</p>
          <button
            type="button"
            onClick={() => setShowBanner(false)}
            aria-label="Dispensar aviso"
            className="ml-2 text-emerald-300/70 hover:text-emerald-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!isAdmin && (
        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 p-4 rounded-xl text-sm">
          Você é membro deste tenant. A configuração abaixo é somente leitura — apenas administradores podem alterá-la.
        </div>
      )}

      {config && (
        <>
          <AiBucketEditor
            bucket="assistant"
            title="Assistente"
            description="Provedor, modelo e chave usados pelo chat de cobrança (processChat) e pelo help-chat de suporte."
            value={config.assistant}
            sourceBadge={sourceBadgeFor(config.assistant)}
            disabled={!isAdmin}
            onSave={handleSave('assistant')}
          />
          <AiBucketEditor
            bucket="pdf_extraction"
            title="Extração de PDF"
            description="Provedor, modelo e chave usados para extrair dados de contratos e devedores (modelo com visão de documento)."
            value={config.pdf_extraction}
            sourceBadge={sourceBadgeFor(config.pdf_extraction)}
            disabled={!isAdmin}
            visionOnly
            onSave={handleSave('pdf_extraction')}
          />
          <AiBucketEditor
            bucket="agents"
            title="Agentes"
            description="Provedor, modelo e chave usados como base pela pipeline multi-agente de cobrança. Cada agente pode sobrescrever apenas o modelo."
            value={config.agents}
            sourceBadge={sourceBadgeFor(config.agents)}
            disabled={!isAdmin}
            onSave={handleSave('agents')}
          />
        </>
      )}
    </div>
  );
}