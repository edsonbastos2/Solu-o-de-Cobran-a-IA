'use client';

import { useState } from 'react';
import { RefreshCw, X, UserPlus, Trash2 } from 'lucide-react';
import { Client } from '@/lib/types';
import { fetchWithAuth } from '@/lib/api';

interface ClientFormModalProps {
  tenantQuery?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ClientFormModal({ tenantQuery = '', onClose, onSaved }: ClientFormModalProps) {
  const [form, setForm] = useState({ name: '', document: '', email: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.document.trim()) {
      setError('Nome e documento são obrigatórios.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/clients${tenantQuery ? `?${tenantQuery}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          document: form.document.trim(),
          email: form.email.trim() || null,
          phone: form.phone.replace(/\D/g, '') || null,
          address: form.address.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Não foi possível criar o cliente.');
        return;
      }
      onSaved();
    } catch (err) {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Novo cliente">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Novo Cliente</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nome *</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">CPF/CNPJ *</span>
              <input
                type="text"
                value={form.document}
                onChange={(e) => setForm({ ...form, document: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Telefone</span>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(00) 00000-0000"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Endereço</span>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
            <UserPlus className="w-4 h-4" />
            Criar Cliente
          </button>
        </div>
      </div>
    </div>
  );
}

interface ClientDeleteButtonProps {
  client: Client;
  tenantQuery?: string;
  onDeleted?: () => void;
}

export function ClientDeleteButton({ client, tenantQuery = '', onDeleted }: ClientDeleteButtonProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!window.confirm(`Excluir o cliente "${client.name}"? A ação é irreversível.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/clients/${client.id}${tenantQuery ? `?${tenantQuery}` : ''}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Não foi possível excluir o cliente.');
        return;
      }
      onDeleted?.();
    } catch (err) {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <span className="relative inline-flex">
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
        title="Excluir Cliente"
        aria-label={`Excluir cliente ${client.name || client.id}`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
      {error && (
        <span role="alert" className="absolute right-0 top-full mt-1 z-10 whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 shadow">
          {error}
        </span>
      )}
    </span>
  );
}