'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/header';
import { ArrowLeft, FileText, CheckCircle, Clock, AlertCircle, Play, RefreshCw } from 'lucide-react';
import { Contract, Client, Installment } from '@/lib/types';
import { formatPhoneInput } from '@/lib/utils';

export default function ContractDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const contractId = unwrappedParams.id;
  
  const [contract, setContract] = useState<any>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingCollectionId, setStartingCollectionId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: contractData, error: contractError } = await supabase
          .from('contracts')
          .select('*, clients(*), collection_policies(*)')
          .eq('id', contractId)
          .single();

        if (contractError) throw contractError;
        
        setContract(contractData);
        setClient(contractData.clients);

        const { data: installmentsData, error: installmentsError } = await supabase
          .from('installments')
          .select('*')
          .eq('contract_id', contractId)
          .order('installment_number', { ascending: true });

        if (installmentsError) throw installmentsError;
        setInstallments(installmentsData || []);
        
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [contractId]);

  const handleStartCollection = async (inst: Installment) => {
    if (!client || !contract) return;
    
    setStartingCollectionId(inst.id);
    try {
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: client.name,
          phone: client.phone,
          debtor_document: client.document,
          debtor_email: client.email,
          debtor_address: client.address,
          original_value: inst.original_value,
          due_date: inst.due_date,
          max_discount_margin: 10,
          user_id: contract.user_id
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao criar caso');

      // Update installment status to 'in_negotiation'
      if (supabase) {
        await supabase
          .from('installments')
          .update({ status: 'in_negotiation' })
          .eq('id', inst.id);
      }

      // Redirect to the new case
      router.push(`/cases/${data.case.id}`);
    } catch (err: any) {
      alert(err.message);
      setStartingCollectionId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'paid': return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20"><CheckCircle className="w-3 h-3 mr-1"/> Pago</span>;
      case 'late': return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10"><AlertCircle className="w-3 h-3 mr-1"/> Atrasado</span>;
      case 'in_negotiation': return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10"><Clock className="w-3 h-3 mr-1"/> Em Acordo</span>;
      default: return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/10">Pendente</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 flex items-center justify-center">
          <p className="text-gray-500">Carregando detalhes do contrato...</p>
        </main>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
          <p className="text-red-500">Contrato não encontrado.</p>
        </main>
      </div>
    );
  }

  // Calculate policy alerts
  let maxDaysLate = 0;
  installments.forEach(inst => {
    if (inst.status !== 'paid') {
      const due = new Date(inst.due_date);
      const now = new Date();
      due.setUTCHours(0, 0, 0, 0);
      now.setUTCHours(0, 0, 0, 0);
      
      if (now > due) {
        const diffTime = now.getTime() - due.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > maxDaysLate) {
          maxDaysLate = diffDays;
        }
      }
    }
  });

  const isNegativeAllowed = contract?.negative_allowed ?? contract?.collection_policies?.negative_allowed;
  const daysToNegative = contract?.override_days_to_negative ?? contract?.collection_policies?.days_to_negative;

  const isProtestAllowed = contract?.protest_allowed ?? contract?.collection_policies?.protest_allowed;
  const daysToProtest = contract?.override_days_to_protest ?? contract?.collection_policies?.days_to_protest;

  let alertMessage = null;
  if (isProtestAllowed && daysToProtest && maxDaysLate >= daysToProtest) {
    alertMessage = `Ação Requerida: Cliente possui parcelas com ${maxDaysLate} dias de atraso. O contrato ultrapassou o prazo de ${daysToProtest} dias e está passível de Protesto.`;
  } else if (isNegativeAllowed && daysToNegative && maxDaysLate >= daysToNegative) {
    alertMessage = `Ação Requerida: Cliente possui parcelas com ${maxDaysLate} dias de atraso. O contrato ultrapassou o prazo de ${daysToNegative} dias e está passível de Negativação.`;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        
        <Link href="/contracts" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para Contratos
        </Link>

        {alertMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{alertMessage}</p>
          </div>
        )}

        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">
              Contrato {contract.contract_number ? `#${contract.contract_number}` : ''}
            </h1>
            <p className="text-gray-500 mt-1">{client?.name} • {client?.document}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-medium text-gray-900">Títulos Financeiros (Parcelas)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50/50 text-gray-500 font-medium">
                    <tr>
                      <th className="px-6 py-4">Parcela</th>
                      <th className="px-6 py-4">Vencimento</th>
                      <th className="px-6 py-4">Valor Original</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {installments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          Nenhum título gerado para este contrato.
                        </td>
                      </tr>
                    ) : (
                      installments.map((inst) => (
                        <tr key={inst.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4 font-medium text-gray-900">{inst.installment_number}</td>
                          <td className="px-6 py-4">
                            {new Date(inst.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                          </td>
                          <td className="px-6 py-4">
                            R$ {inst.original_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(inst.status)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {(inst.status === 'late' || inst.status === 'pending') && (
                              <button
                                onClick={() => handleStartCollection(inst)}
                                disabled={startingCollectionId === inst.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm shadow-emerald-600/20"
                                title="Iniciar Cobrança Automática via IA"
                              >
                                {startingCollectionId === inst.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                )}
                                Iniciar Cobrança
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Regras de Cobrança</h3>
              
              {contract.collection_policies && (
                <div className="mb-4 pb-4 border-b border-gray-100">
                  <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-md">
                    Política: {contract.collection_policies.name}
                  </span>
                </div>
              )}

              <ul className="space-y-4 text-sm text-gray-700">
                <li className="flex justify-between">
                  <span className="text-gray-500">Juros de Mora</span>
                  <span className="font-medium">
                    {contract.interest_rate ?? contract.collection_policies?.interest_rate ?? '-'}% a.m.
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-500">Multa por Atraso</span>
                  <span className="font-medium">
                    {contract.penalty_rate ?? contract.collection_policies?.penalty_rate ?? '-'}%
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-500">Índice Correção</span>
                  <span className="font-medium">
                    {contract.monetary_correction_index || contract.collection_policies?.monetary_correction_index || '-'}
                  </span>
                </li>
                
                <li className="flex flex-col gap-1 mt-4 pt-4 border-t border-gray-50">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Negativação Permitida</span>
                    <span className="font-medium">
                      {(contract.negative_allowed ?? contract.collection_policies?.negative_allowed) ? 'Sim' : 'Não'}
                    </span>
                  </div>
                  {(contract.negative_allowed ?? contract.collection_policies?.negative_allowed) && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Prazo para negativar</span>
                      <span className="font-medium text-gray-600">
                        Após {contract.override_days_to_negative ?? contract.collection_policies?.days_to_negative ?? '-'} dias
                      </span>
                    </div>
                  )}
                </li>

                <li className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Protesto Permitido</span>
                    <span className="font-medium">
                      {(contract.protest_allowed ?? contract.collection_policies?.protest_allowed) ? 'Sim' : 'Não'}
                    </span>
                  </div>
                  {(contract.protest_allowed ?? contract.collection_policies?.protest_allowed) && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Prazo para protestar</span>
                      <span className="font-medium text-gray-600">
                        Após {contract.override_days_to_protest ?? contract.collection_policies?.days_to_protest ?? '-'} dias
                      </span>
                    </div>
                  )}
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Dados do Cliente</h3>
              <ul className="space-y-4 text-sm text-gray-700">
                <li>
                  <span className="text-gray-500 block mb-1">Nome</span>
                  <span className="font-medium">{client?.name}</span>
                </li>
                <li>
                  <span className="text-gray-500 block mb-1">Documento</span>
                  <span className="font-medium">{client?.document}</span>
                </li>
                {client?.email && (
                  <li>
                    <span className="text-gray-500 block mb-1">Email</span>
                    <span className="font-medium">{client?.email}</span>
                  </li>
                )}
                {client?.phone && (
                  <li>
                    <span className="text-gray-500 block mb-1">Telefone</span>
                    <span className="font-medium">{formatPhoneInput(client.phone)}</span>
                  </li>
                )}
              </ul>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}
