'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Plus, FileText, Search, Eye } from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { Contract } from '@/lib/types';

import { fetcher } from "@/lib/api";

export default function ContractsPage() {
  const { user, authLoading, tenantId, tenantQuery, tenantPath, needsTenantSelection } = useActiveTenant();
  const [page, setPage] = useState(1);
  const limit = 10;
  
  const queryUrl = `/api/contracts?page=${page}&limit=${limit}${tenantQuery ? `&${tenantQuery}` : ''}`;
  const canFetch = !authLoading && Boolean(user) && !needsTenantSelection;
  const { data, error, isLoading: loading } = useSWR<{ contracts: Array<Contract & { clients?: { name?: string; document?: string } | null }>; totalPages?: number }>(canFetch ? [queryUrl, user?.id || 'anon', tenantId] : null, ([url]) => fetcher(url));
  
  const contracts = data?.contracts || [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Contratos</h1>
            <p className="text-gray-500 mt-1">Gerencie os contratos que originam as cobranças</p>
          </div>
          
          <Link
            href={`/contracts/new${tenantPath}`}
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Contrato (via IA)
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <label htmlFor="contracts-search" className="sr-only">Buscar contratos</label>
              <input
                id="contracts-search"
                type="text" 
                placeholder="Buscar por cliente, documento ou número..." 
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/50 text-gray-500 font-medium">
                <tr>
                  <th scope="col" className="px-6 py-4">Cliente</th>
                  <th scope="col" className="px-6 py-4">Documento</th>
                  <th scope="col" className="px-6 py-4">Número do Contrato</th>
                  <th scope="col" className="px-6 py-4">Tipo</th>
                  <th scope="col" className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {needsTenantSelection ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-amber-700">
                      Selecione um tenant ativo para consultar contratos.
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-red-600">
                      <p className="font-medium">Não foi possível carregar os contratos.</p>
                      <p className="text-xs mt-1">{error instanceof Error ? error.message : 'Tente novamente.'}</p>
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Carregando contratos...
                    </td>
                  </tr>
                ) : contracts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 flex flex-col items-center">
                      <FileText className="w-12 h-12 text-gray-300 mb-3" />
                      <p>Nenhum contrato encontrado.</p>
                       <Link href={`/contracts/new${tenantPath}`} className="text-blue-600 hover:underline mt-1">Importe um agora com IA</Link>
                    </td>
                  </tr>
                ) : (
                  contracts.map((contract) => (
                    <tr key={contract.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{contract.clients?.name}</td>
                      <td className="px-6 py-4">{contract.clients?.document}</td>
                      <td className="px-6 py-4">{contract.contract_number || '-'}</td>
                      <td className="px-6 py-4 capitalize">{contract.type || 'Geral'}</td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          href={`/contracts/${contract.id}${tenantPath}`}
                          className="inline-flex items-center justify-center p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver detalhes"
                          aria-label={`Ver detalhes do contrato ${contract.contract_number || contract.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <Pagination 
            currentPage={page}
            totalPages={data?.totalPages || 1}
            onPageChange={setPage}
            theme="light"
          />
        </div>

      </main>
    </div>
  );
}
