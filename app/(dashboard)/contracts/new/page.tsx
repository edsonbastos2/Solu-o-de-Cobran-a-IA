'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ContractExtractionResult } from '@/lib/types';
import { Loader2, Upload, File, X } from 'lucide-react';
import { formatPhoneInput } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/api';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { ManualContractForm } from '@/components/contracts/manual-contract-form';

export default function NewContractPage() {
  const router = useRouter();
  const { authLoading, isConfigured, tenantId, tenantQuery, tenantPath, needsTenantSelection } = useActiveTenant();
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [contractText, setContractText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ContractExtractionResult | null>(null);
  const [manualClientId, setManualClientId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [policies, setPolicies] = useState<{id: string, name: string}[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');

  useEffect(() => {
    const fetchPolicies = async () => {
      if (authLoading || !isConfigured || needsTenantSelection) return;
      const response = await fetchWithAuth(`/api/policies?page=1&limit=100&active=true${tenantQuery ? `&${tenantQuery}` : ''}`);
      if (!response.ok) return;
      const data = await response.json() as { policies?: Array<{ id: string; name: string }> };
      setPolicies(data.policies || []);
    };
    fetchPolicies();
  }, [authLoading, isConfigured, needsTenantSelection, tenantQuery]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExtract = async () => {
    if (!contractText.trim() && !file) return;
    setIsExtracting(true);
    try {
      const formData = new FormData();
      if (contractText) formData.append('contractText', contractText);
      if (file) formData.append('file', file);

      const res = await fetch('/api/extract-contract', {
        method: 'POST',
        body: formData,
      });
      const responseText = await res.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Resposta inválida do servidor (${res.status}): ${responseText.slice(0, 200)}`);
      }
      if (!res.ok) throw new Error(data.error || data.message || 'Extraction failed');
      setManualClientId(null);
      setExtractedData(data);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to extract data from contract.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!extractedData) return;
    if (!isConfigured) {
      alert('O modo demo não permite salvar contratos. Configure o Supabase para continuar.');
      return;
    }
    if (needsTenantSelection) {
      alert('Selecione um tenant ativo antes de salvar o contrato.');
      return;
    }
    setIsSaving(true);
    
    try {
      const response = await fetchWithAuth('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId || undefined,
          collection_policy_id: selectedPolicyId || null,
          client_id: manualClientId || undefined,
          client_name: extractedData.client_name,
          client_document: extractedData.client_document,
          client_address: extractedData.client_address,
          client_phone: extractedData.client_phone ? formatPhoneInput(extractedData.client_phone) : null,
          client_email: extractedData.client_email,
          contract_number: extractedData.contract_number,
          type: extractedData.type,
          start_date: extractedData.start_date || null,
          due_date: extractedData.due_date || null,
          total_value: extractedData.total_value,
          installments_count: extractedData.installments_count,
          interest_rate: extractedData.interest_rate,
          penalty_rate: extractedData.penalty_rate,
          monetary_correction_index: extractedData.monetary_correction_index,
          guarantees: extractedData.guarantees,
          guarantors: extractedData.guarantors,
          negative_allowed: extractedData.negative_allowed,
          protest_allowed: extractedData.protest_allowed,
          forum: extractedData.forum,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar o contrato.');

      alert('Contrato salvo com sucesso!');
      router.push(`/contracts${tenantPath}`);

    } catch (error: unknown) {
      console.error(error);
      alert('Erro ao salvar contrato: ' + (error instanceof Error ? error.message : 'Tente novamente.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Novo Contrato</h1>

        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode('ai'); setManualClientId(null); setExtractedData(null); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'ai' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Via IA
          </button>
          <button
            type="button"
            onClick={() => { setMode('manual'); setExtractedData(null); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Manual
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            {mode === 'manual' ? (
              <>
                <h2 className="text-xl font-medium text-gray-800 mb-4">Dados do cliente e contrato</h2>
                <ManualContractForm
                  tenantQuery={tenantQuery}
                  onUseData={(data, clientId) => {
                    setManualClientId(clientId);
                    setExtractedData(data);
                  }}
                />
              </>
            ) : (
            <>
            <h2 className="text-xl font-medium text-gray-800 mb-4">Envie o contrato</h2>

            {/* File Upload Area */}
            <div className="mb-4">
              <label htmlFor="contract-file" className="block text-sm font-medium text-gray-700 mb-2">Arquivo PDF (Opcional)</label>
              {!file ? (
                <label
                  htmlFor="contract-file"
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Clique para selecionar um arquivo PDF</p>
                  <p className="text-xs text-gray-500 mt-1">O arquivo será lido com IA.</p>
                </label>
              ) : (
                <div className="flex items-center justify-between p-4 border border-emerald-200 bg-emerald-50 rounded-lg">
                  <div className="flex items-center">
                    <File className="w-6 h-6 text-emerald-600 mr-3" />
                    <span className="text-sm font-medium text-emerald-900 truncate max-w-[200px]">{file.name}</span>
                  </div>
                  <button type="button" onClick={removeFile} aria-label="Remover arquivo selecionado" className="p-1 hover:bg-emerald-100 rounded-full transition-colors text-emerald-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              <input 
                type="file" 
                id="contract-file"
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="application/pdf" 
                className="hidden" 
              />
            </div>

            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="px-4 text-gray-500 text-sm">OU</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <label htmlFor="contract-text" className="block text-sm font-medium text-gray-700 mb-2">Cole o texto do contrato</label>
            <textarea
              id="contract-text"
              className="flex-1 min-h-[200px] w-full p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-mono text-gray-700"
              placeholder="Cole aqui o conteúdo do contrato..."
              value={contractText}
              onChange={(e) => setContractText(e.target.value)}
            />

            <button
              onClick={handleExtract}
              disabled={isExtracting || (!contractText.trim() && !file)}
              className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Extraindo Informações...
                </>
              ) : (
                'Extrair com Inteligência Artificial'
              )}
            </button>
            </>
            )}
          </div>

          {/* Results Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <h2 className="text-xl font-medium text-gray-800 mb-4">{mode === 'manual' ? 'Revisão' : 'Informações Extraídas'}</h2>

            {extractedData ? (
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-6">
                  
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Dados do Cliente</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-500 block">Nome:</span> <span className="font-medium text-gray-900">{extractedData.client_name || '-'}</span></div>
                      <div><span className="text-gray-500 block">Documento:</span> <span className="font-medium text-gray-900">{extractedData.client_document || '-'}</span></div>
                      <div><span className="text-gray-500 block">Email:</span> <span className="font-medium text-gray-900">{extractedData.client_email || '-'}</span></div>
                      <div><span className="text-gray-500 block">Telefone:</span> <span className="font-medium text-gray-900">{extractedData.client_phone ? formatPhoneInput(extractedData.client_phone) : '-'}</span></div>
                      <div className="col-span-2"><span className="text-gray-500 block">Endereço:</span> <span className="font-medium text-gray-900">{extractedData.client_address || '-'}</span></div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Dados do Contrato</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-500 block">Valor Total:</span> <span className="font-medium text-gray-900">{extractedData.total_value ? `R$ ${extractedData.total_value}` : '-'}</span></div>
                      <div><span className="text-gray-500 block">Parcelas:</span> <span className="font-medium text-gray-900">{extractedData.installments_count || '-'}</span></div>
                      <div><span className="text-gray-500 block">Juros:</span> <span className="font-medium text-gray-900">{extractedData.interest_rate ? `${extractedData.interest_rate}%` : '-'}</span></div>
                      <div><span className="text-gray-500 block">Multa:</span> <span className="font-medium text-gray-900">{extractedData.penalty_rate ? `${extractedData.penalty_rate}%` : '-'}</span></div>
                      <div><span className="text-gray-500 block">Correção:</span> <span className="font-medium text-gray-900">{extractedData.monetary_correction_index || '-'}</span></div>
                      <div><span className="text-gray-500 block">Foro:</span> <span className="font-medium text-gray-900">{extractedData.forum || '-'}</span></div>
                      <div><span className="text-gray-500 block">Permite Negativação:</span> <span className="font-medium text-gray-900">{extractedData.negative_allowed ? 'Sim' : 'Não'}</span></div>
                      <div><span className="text-gray-500 block">Permite Protesto:</span> <span className="font-medium text-gray-900">{extractedData.protest_allowed ? 'Sim' : 'Não'}</span></div>
                    </div>
                  </div>

                </div>
                
                <div className="mt-8 border-t border-gray-100 pt-6">
                  <label htmlFor="contract-policy" className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Vincular Política de Cobrança (Opcional)</label>
                  <select
                    id="contract-policy"
                    value={selectedPolicyId}
                    onChange={(e) => setSelectedPolicyId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">-- Nenhuma Política --</option>
                    {policies.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="mt-8 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Salvando Sistema...
                    </>
                  ) : (
                    'Confirmar e Salvar Contrato'
                  )}
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <p className="text-center">
                  {mode === 'manual'
                    ? 'Preencha os dados ao lado e clique em "Usar estes dados" para revisar e salvar.'
                    : 'As informações extraídas aparecerão aqui após a análise da inteligência artificial.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
