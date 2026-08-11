'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import {
  MessageSquareText,
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { fetcher, fetchWithAuth } from '@/lib/api';
import type { MessageTemplate, MessageTemplatesResponse } from '@/lib/types';

const STAGE_OPTIONS = [
  { value: 'preventiva', label: 'Preventiva' },
  { value: 'amigavel', label: 'Amigável' },
  { value: 'negocial', label: 'Negocial' },
  { value: 'especializada', label: 'Especializada' },
  { value: 'generic', label: 'Genérico' },
];

const VARIABLE_HINTS = [
  '{nome}', '{valor}', '{vencimento}', '{dias_atraso}', '{empresa}', '{dias_para_negativacao}',
];

export default function TemplatesPage() {
  const { user, loading: authLoading } = useAuth();
  const { tenantQuery, isAdmin, needsTenantSelection } = useActiveTenant();
  const [page, setPage] = useState(1);
  const [stageFilter, setStageFilter] = useState('all');
  const limit = 10;

  const queryUrl = `/api/message-templates?page=${page}&limit=${limit}&stage=${stageFilter}${tenantQuery ? `&${tenantQuery}` : ''}`;
  const canFetch = !authLoading && Boolean(user) && !needsTenantSelection;
  const { data, error, isLoading, mutate } = useSWR<MessageTemplatesResponse>(
    canFetch ? [queryUrl, user?.id || 'anon'] : null,
    ([url]) => fetcher(url)
  );

  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [name, setName] = useState('');
  const [stage, setStage] = useState('generic');
  const [channel, setChannel] = useState('whatsapp');
  const [templateBody, setTemplateBody] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [previewCaseId, setPreviewCaseId] = useState('');
  const [previewTemplateId, setPreviewTemplateId] = useState('');
  const [previewBody, setPreviewBody] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    if (!alertMessage) return;
    const t = setTimeout(() => setAlertMessage(''), 4000);
    return () => clearTimeout(t);
  }, [alertMessage]);

  const templates = data?.templates || [];

  const openCreate = () => {
    setEditing(null);
    setName('');
    setStage('generic');
    setChannel('whatsapp');
    setTemplateBody('');
    setIsActive(true);
    setFormError('');
    setShowEditor(true);
  };

  const openEdit = (t: MessageTemplate) => {
    setEditing(t);
    setName(t.name);
    setStage(t.stage);
    setChannel(t.channel);
    setTemplateBody(t.body);
    setIsActive(t.is_active);
    setFormError('');
    setShowEditor(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!name.trim() || !templateBody.trim()) {
      setFormError('Nome e conteúdo são obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `/api/message-templates/${editing.id}?${tenantQuery}`
        : '/api/message-templates';
      const res = await fetchWithAuth(url, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({
          name,
          stage,
          channel,
          body: templateBody,
          is_active: isActive,
          tenant_id: tenantQuery ? tenantQuery.split('=')[1] : undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setFormError(json?.error || 'Não foi possível salvar.');
        return;
      }
      setShowEditor(false);
      mutate();
      setAlertMessage(editing ? 'Template atualizado.' : 'Template criado.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: MessageTemplate) => {
    if (!window.confirm(`Excluir o template "${t.name}"?`)) return;
    const res = await fetchWithAuth(`/api/message-templates/${t.id}?${tenantQuery}`, { method: 'DELETE' });
    if (res.ok) {
      mutate();
      setAlertMessage('Template excluído.');
    }
  };

  const handlePreview = async () => {
    if (!previewTemplateId || !previewCaseId) return;
    setPreviewLoading(true);
    setFormError('');
    try {
      const res = await fetchWithAuth(`/api/message-templates/${previewTemplateId}/preview?${tenantQuery}`, {
        method: 'POST',
        body: JSON.stringify({ case_id: previewCaseId, tenant_id: tenantQuery ? tenantQuery.split('=')[1] : undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(json?.error || 'Não foi possível gerar o preview.');
        return;
      }
      setPreviewBody(json?.body || '');
    } finally {
      setPreviewLoading(false);
    }
  };

  const insertVariable = (v: string) => {
    setTemplateBody((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${v}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Biblioteca de Templates</h1>
            <p className="mt-1 text-sm text-slate-500">
              Mensagens padronizadas por estágio com variáveis dinâmicas e revisão de compliance.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Novo Template
            </button>
          )}
        </div>

        {alertMessage && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {alertMessage}
          </div>
        )}

        {showEditor && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                {editing ? 'Editar template' : 'Criar template'}
              </h2>
              <button onClick={() => setShowEditor(false)} className="text-sm font-semibold text-slate-400 hover:text-slate-600">
                Fechar
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Nome *</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Estágio</span>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900"
                >
                  {STAGE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Canal</span>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </label>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Conteúdo *</span>
                <div className="flex flex-wrap gap-1">
                  {VARIABLE_HINTS.map((v) => (
                    <button
                      key={v}
                      onClick={() => insertVariable(v)}
                      className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 hover:bg-slate-200"
                      title="Inserir variável"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                placeholder="Olá {nome}! Seu pagamento de {valor} vence em {vencimento}..."
              />
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="font-semibold">Ativo</span>
            </label>

            {formError && <p className="mt-3 text-sm font-medium text-red-600">{formError}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => setShowEditor(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Preview */ }
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-900">Preview com caso real</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block flex-1 text-sm">
              <span className="mb-1 block font-semibold text-slate-700">Template</span>
              <select
                value={previewTemplateId}
                onChange={(e) => setPreviewTemplateId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900"
              >
                <option value="">Selecione...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="block flex-1 text-sm">
              <span className="mb-1 block font-semibold text-slate-700">Caso (ID)</span>
              <input
                value={previewCaseId}
                onChange={(e) => setPreviewCaseId(e.target.value)}
                placeholder="uuid do caso"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900"
              />
            </label>
            <button
              onClick={handlePreview}
              disabled={previewLoading || !previewTemplateId || !previewCaseId}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {previewLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Pré-visualizar
            </button>
          </div>
          {previewBody && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-800">
              {previewBody}
            </div>
          )}
          {formError && previewBody === '' && <p className="mt-3 text-sm font-medium text-red-600">{formError}</p>}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50/50 p-4">
            {['all', ...STAGE_OPTIONS.map((s) => s.value)].map((s) => (
              <button
                key={s}
                onClick={() => { setStageFilter(s); setPage(1); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  stageFilter === s ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                {s === 'all' ? 'Todos' : STAGE_OPTIONS.find((o) => o.value === s)?.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-100/70 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Nome</th>
                  <th className="px-6 py-3.5">Estágio</th>
                  <th className="px-6 py-3.5">Canal</th>
                  <th className="px-6 py-3.5">Conteúdo</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 bg-white">
                {error ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-red-600">
                      <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                      Não foi possível carregar os templates.
                    </td>
                  </tr>
                ) : isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-slate-400" />
                      Carregando...
                    </td>
                  </tr>
                ) : templates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <MessageSquareText className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                      Nenhum template encontrado.
                    </td>
                  </tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-semibold text-slate-800">{t.name}</td>
                      <td className="px-6 py-4">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {STAGE_OPTIONS.find((o) => o.value === t.stage)?.label || t.stage}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs capitalize text-slate-600">{t.channel}</td>
                      <td className="max-w-xs px-6 py-4">
                        <p className="truncate text-xs text-slate-500">{t.body}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                          t.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {t.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isAdmin && (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => openEdit(t)}
                              title="Editar"
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(t)}
                              title="Excluir"
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalPages={data?.totalPages || 1} onPageChange={setPage} theme="light" />
        </div>
      </main>
    </div>
  );
}