'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ContractExtractionResult } from '@/lib/types';
import { Header } from '@/components/header';
import { Loader2, Upload, File, X } from 'lucide-react';
import { formatPhoneInput } from '@/lib/utils';

export default function NewContractPage() {
  const router = useRouter();
  const [contractText, setContractText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ContractExtractionResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [policies, setPolicies] = useState<{id: string, name: string}[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');

  useEffect(() => {
    const fetchPolicies = async () => {
      const { data } = await supabase.from('collection_policies').select('id, name').eq('active', true).order('name');
      if (data) {
        setPolicies(data);
      }
    };
    fetchPolicies();
  }, []);

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
      if (!res.ok) throw new Error('Extraction failed');
      const data = await res.json();
      setExtractedData(data);
    } catch (err) {
      console.error(err);
      alert('Failed to extract data from contract.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!extractedData) return;
    setIsSaving(true);
    
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;

      // 1. Insert or get client
      let clientId = '';
      const { data: existingClients } = await supabase
        .from('clients')
        .select('id')
        .eq('document', extractedData.client_document)
        .limit(1);

      if (existingClients && existingClients.length > 0) {
        clientId = existingClients[0].id;
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            user_id: userId,
            name: extractedData.client_name || 'Desconhecido',
            document: extractedData.client_document || '00000000000',
            address: extractedData.client_address,
            phone: extractedData.client_phone ? formatPhoneInput(extractedData.client_phone) : null,
            email: extractedData.client_email,
          })
          .select()
          .single();
          
        if (clientError) throw clientError;
        clientId = newClient.id;
      }

      // 2. Insert Contract
      const { data: newContract, error: contractError } = await supabase
        .from('contracts')
        .insert({
          user_id: userId,
          client_id: clientId,
          contract_number: extractedData.contract_number,
          type: extractedData.type,
          start_date: extractedData.start_date || null,
          due_date: extractedData.due_date || null,
          interest_rate: extractedData.interest_rate,
          penalty_rate: extractedData.penalty_rate,
          monetary_correction_index: extractedData.monetary_correction_index,
          guarantees: extractedData.guarantees,
          guarantors: extractedData.guarantors,
          negative_allowed: extractedData.negative_allowed,
          protest_allowed: extractedData.protest_allowed,
          forum: extractedData.forum,
          collection_policy_id: selectedPolicyId || null,
        })
        .select()
        .single();
        
      if (contractError) throw contractError;

      // 3. Generate Installments
      if (extractedData.installments_count && extractedData.total_value) {
        const installmentValue = extractedData.total_value / extractedData.installments_count;
        const installments = [];
        
        let currentDate = extractedData.start_date ? new Date(extractedData.start_date) : new Date();
        
        for (let i = 1; i <= extractedData.installments_count; i++) {
          // Add a month for each installment roughly
          currentDate.setMonth(currentDate.getMonth() + 1);
          
          installments.push({
            contract_id: newContract.id,
            installment_number: i,
            original_value: installmentValue,
            due_date: currentDate.toISOString().split('T')[0],
            status: 'pending'
          });
        }
        
        if (installments.length > 0) {
          const { error: installmentsError } = await supabase
            .from('installments')
            .insert(installments);
            
          if (installmentsError) throw installmentsError;
        }
      }

      alert('Contrato salvo com sucesso!');
      router.push('/contracts');

    } catch (error: any) {
      console.error(error);
      let errorMsg = error.message;
      if (error.code === '23505') {
        if (error.message.includes('contracts_contract_number_key')) {
          errorMsg = 'Este número de contrato já está cadastrado no sistema.';
        } else if (error.message.includes('clients_email_key')) {
          errorMsg = 'O email do cliente extraído já está cadastrado para outro cliente.';
        } else if (error.message.includes('clients_document_key')) {
          errorMsg = 'O documento do cliente extraído já está cadastrado.';
        }
      }
      alert('Erro ao salvar contrato: ' + errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-8">Novo Contrato por IA</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <h2 className="text-xl font-medium text-gray-800 mb-4">Envie o contrato</h2>
            
            {/* File Upload Area */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Arquivo PDF (Opcional)</label>
              {!file ? (
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Clique para selecionar um arquivo PDF</p>
                  <p className="text-xs text-gray-500 mt-1">O arquivo será lido com IA.</p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 border border-blue-200 bg-blue-50 rounded-lg">
                  <div className="flex items-center">
                    <File className="w-6 h-6 text-blue-600 mr-3" />
                    <span className="text-sm font-medium text-blue-900 truncate max-w-[200px]">{file.name}</span>
                  </div>
                  <button onClick={removeFile} className="p-1 hover:bg-blue-100 rounded-full transition-colors text-blue-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              <input 
                type="file" 
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

            <label className="block text-sm font-medium text-gray-700 mb-2">Cole o texto do contrato</label>
            <textarea
              className="flex-1 min-h-[200px] w-full p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono text-gray-700"
              placeholder="Cole aqui o conteúdo do contrato..."
              value={contractText}
              onChange={(e) => setContractText(e.target.value)}
            />

            <button
              onClick={handleExtract}
              disabled={isExtracting || (!contractText.trim() && !file)}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
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
          </div>

          {/* Results Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <h2 className="text-xl font-medium text-gray-800 mb-4">Informações Extraídas</h2>
            
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
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Vincular Política de Cobrança (Opcional)</h3>
                  <select
                    value={selectedPolicyId}
                    onChange={(e) => setSelectedPolicyId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
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
                  className="mt-8 w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
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
                <p className="text-center">As informações extraídas aparecerão aqui após a análise da inteligência artificial.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
