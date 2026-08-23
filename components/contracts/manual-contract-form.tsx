'use client';

import { useEffect, useState } from 'react';
import { Search, X, UserCheck } from 'lucide-react';
import { Client, ContractExtractionResult } from '@/lib/types';
import { fetchWithAuth } from '@/lib/api';
import { formatPhoneInput, formatDocumentInput, formatCurrencyInput, parseCurrency } from '@/lib/utils';

interface ManualContractFormProps {
  tenantQuery?: string;
  onUseData: (data: ContractExtractionResult, clientId: string | null) => void;
}

const emptyContract = {
  contract_number: '',
  type: '',
  start_date: '',
  due_date: '',
  total_value: '',
  installments_count: '',
  interest_rate: '',
  penalty_rate: '',
  monetary_correction_index: '',
  guarantees: '',
  guarantors: '',
  negative_allowed: false,
  protest_allowed: false,
  forum: '',
};

export function ManualContractForm({ tenantQuery = '', onUseData }: ManualContractFormProps) {
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [newClient, setNewClient] = useState({ name: '', document: '', email: '', phone: '', address: '' });

  const [contract, setContract] = useState(emptyContract);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clientMode !== 'existing' || selectedClient || searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`/api/clients?limit=8&search=${encodeURIComponent(searchTerm.trim())}${tenantQuery ? `&${tenantQuery}` : ''}`);
        if (!res.ok) return;
        const data = await res.json() as { clients?: Client[] };
        if (!cancelled) setSearchResults(data.clients || []);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, clientMode, selectedClient, tenantQuery]);

  const handleSubmit = () => {
    setError(null);

    if (clientMode === 'existing') {
      if (!selectedClient) {
        setError('Selecione um cliente existente.');
        return;
      }
    } else if (!newClient.name.trim() || !newClient.document.trim()) {
      setError('Nome e documento do cliente são obrigatórios.');
      return;
    }

    const data: ContractExtractionResult = {
      client_name: clientMode === 'existing' ? (selectedClient!.name || '') : newClient.name.trim(),
      client_document: clientMode === 'existing' ? (selectedClient!.document || '') : newClient.document.replace(/\D/g, ''),
      client_address: clientMode === 'existing' ? (selectedClient!.address || '') : newClient.address.trim(),
      client_phone: clientMode === 'existing' ? (selectedClient!.phone || '') : newClient.phone.replace(/\D/g, ''),
      client_email: clientMode === 'existing' ? (selectedClient!.email || '') : newClient.email.trim(),
      contract_number: contract.contract_number.trim(),
      type: contract.type.trim(),
      start_date: contract.start_date,
      due_date: contract.due_date,
      total_value: parseCurrency(contract.total_value),
      installments_count: Number(contract.installments_count) || 0,
      interest_rate: Number(contract.interest_rate) || 0,
      penalty_rate: Number(contract.penalty_rate) || 0,
      monetary_correction_index: contract.monetary_correction_index.trim(),
      guarantees: contract.guarantees.trim(),
      guarantors: contract.guarantors.trim(),
      negative_allowed: contract.negative_allowed,
      protest_allowed: contract.protest_allowed,
      forum: contract.forum.trim(),
    };

    onUseData(data, clientMode === 'existing' ? selectedClient!.id : null);
  };

  return (
    <div className="flex-1 flex flex-col">
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Cliente</h3>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => { setClientMode('existing'); setError(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${clientMode === 'existing' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            Cliente existente
          </button>
          <button
            type="button"
            onClick={() => { setClientMode('new'); setError(null); setSelectedClient(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${clientMode === 'new' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            Novo cliente
          </button>
        </div>

        {clientMode === 'existing' ? (
          selectedClient ? (
            <div className="flex items-center justify-between p-3 border border-emerald-200 bg-emerald-50 rounded-lg">
              <div className="flex items-center gap-2 min-w-0">
                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-emerald-900 truncate">{selectedClient.name}</p>
                  <p className="text-xs text-emerald-700 font-mono truncate">{selectedClient.document}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedClient(null)} aria-label="Trocar cliente" className="p-1 hover:bg-emerald-100 rounded-full transition-colors text-emerald-700 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <label htmlFor="manual-client-search" className="sr-only">Buscar cliente por nome ou documento</label>
              <input
                id="manual-client-search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou documento..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              {searchTerm.trim().length >= 2 && (
                <div className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {searching ? (
                    <p className="px-3 py-2 text-sm text-gray-500">Buscando...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-500">Nenhum cliente encontrado.</p>
                  ) : (
                    searchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedClient(c); setSearchTerm(''); setSearchResults([]); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-500 font-mono truncate">{c.document}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="block col-span-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nome *</span>
              <input type="text" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="Nome completo do cliente" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">CPF/CNPJ *</span>
              <input type="text" inputMode="numeric" value={newClient.document} onChange={(e) => setNewClient({ ...newClient, document: formatDocumentInput(e.target.value) })} placeholder="000.000.000-00" maxLength={18} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Telefone</span>
              <input type="text" inputMode="numeric" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: formatPhoneInput(e.target.value) })} placeholder="(00) 00000-0000" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block col-span-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</span>
              <input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder="email@exemplo.com" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block col-span-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Endereço</span>
              <input type="text" value={newClient.address} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} placeholder="Rua, número, bairro, cidade - UF" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 mt-6 pt-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Dados do Contrato</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Número do Contrato</span>
            <input type="text" value={contract.contract_number} onChange={(e) => setContract({ ...contract, contract_number: e.target.value })} placeholder="Ex: CT-2026-0001" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo</span>
            <input type="text" value={contract.type} onChange={(e) => setContract({ ...contract, type: e.target.value })} placeholder="Ex: Empréstimo, Financiamento" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Data de Início</span>
            <input type="date" value={contract.start_date} onChange={(e) => setContract({ ...contract, start_date: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vencimento</span>
            <input type="date" value={contract.due_date} onChange={(e) => setContract({ ...contract, due_date: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Valor Total</span>
            <input type="text" inputMode="numeric" value={contract.total_value} onChange={(e) => setContract({ ...contract, total_value: formatCurrencyInput(e.target.value) })} placeholder="R$ 0,00" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Parcelas</span>
            <input type="number" min="0" step="1" value={contract.installments_count} onChange={(e) => setContract({ ...contract, installments_count: e.target.value })} placeholder="Ex: 12" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Juros (%)</span>
            <input type="number" min="0" step="0.01" value={contract.interest_rate} onChange={(e) => setContract({ ...contract, interest_rate: e.target.value })} placeholder="Ex: 2,5" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Multa (%)</span>
            <input type="number" min="0" step="0.01" value={contract.penalty_rate} onChange={(e) => setContract({ ...contract, penalty_rate: e.target.value })} placeholder="Ex: 2" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Índice de Correção</span>
            <input type="text" value={contract.monetary_correction_index} onChange={(e) => setContract({ ...contract, monetary_correction_index: e.target.value })} placeholder="Ex: IGPM, IPCA, INPC" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Foro</span>
            <input type="text" value={contract.forum} onChange={(e) => setContract({ ...contract, forum: e.target.value })} placeholder="Ex: Comarca de São Paulo - SP" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block col-span-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Garantias</span>
            <input type="text" value={contract.guarantees} onChange={(e) => setContract({ ...contract, guarantees: e.target.value })} placeholder="Ex: Alienação fiduciária do veículo" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block col-span-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fiadores</span>
            <input type="text" value={contract.guarantors} onChange={(e) => setContract({ ...contract, guarantors: e.target.value })} placeholder="Nome completo do(s) fiador(es)" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="flex items-center gap-2 mt-1">
            <input type="checkbox" checked={contract.negative_allowed} onChange={(e) => setContract({ ...contract, negative_allowed: e.target.checked })} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="text-sm text-gray-700">Permite Negativação</span>
          </label>
          <label className="flex items-center gap-2 mt-1">
            <input type="checkbox" checked={contract.protest_allowed} onChange={(e) => setContract({ ...contract, protest_allowed: e.target.checked })} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="text-sm text-gray-700">Permite Protesto</span>
          </label>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        className="mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
      >
        Usar estes dados
      </button>
    </div>
  );
}
