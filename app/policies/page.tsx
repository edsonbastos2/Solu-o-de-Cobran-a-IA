'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/header';
import { CollectionPolicy } from '@/lib/types';
import { Plus, Pencil, Check, X, ShieldAlert } from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { useAuth } from '@/hooks/useAuth';

import { fetcher } from "@/lib/api";

export default function PoliciesPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const limit = 10;
  
  const { data, isLoading: loading, mutate } = useSWR(`/api/policies?page=${page}&limit=${limit}`, fetcher);
  const policies = data?.policies || [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editData, setEditData] = useState<Partial<CollectionPolicy>>({});
  const [saving, setSaving] = useState(false);

  const fetchPolicies = async () => {
    await mutate();
  };

  const handleEditClick = (policy: CollectionPolicy) => {
    setEditingId(policy.id);
    setEditData({ ...policy });
    setIsCreating(false);
  };

  const handleCreateClick = () => {
    setIsCreating(true);
    setEditingId(null);
    setEditData({
      name: '',
      interest_rate: 0,
      penalty_rate: 0,
      monetary_correction_index: '',
      negative_allowed: false,
      days_to_negative: 30,
      protest_allowed: false,
      days_to_protest: 30,
      active: true,
    });
  };

  const handleCancelClick = () => {
    setEditingId(null);
    setIsCreating(false);
  };

  const handleSaveClick = async () => {
    if (!editData.name) {
      alert('O nome da política é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      if (isCreating) {
        const { error } = await supabase
          .from('collection_policies')
          .insert([editData]);
        if (error) throw error;
      } else if (editingId) {
        const { error } = await supabase
          .from('collection_policies')
          .update(editData)
          .eq('id', editingId);
        if (error) throw error;
      }
      
      await fetchPolicies();
      setEditingId(null);
      setIsCreating(false);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar política: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <ShieldAlert className="w-6 h-6 mr-2 text-blue-600" />
              Políticas de Cobrança
            </h1>
            <p className="text-gray-500 mt-1">Gerencie as regras padrão de cobrança da sua empresa.</p>
          </div>
          <button 
            onClick={handleCreateClick}
            disabled={isCreating}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Política
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Nome da Política</th>
                  <th className="px-6 py-4">Juros / Multa</th>
                  <th className="px-6 py-4">Negativação</th>
                  <th className="px-6 py-4">Protesto</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isCreating && (
                  <tr className="bg-blue-50/50">
                    <td className="px-6 py-4">
                      <input 
                        type="text" 
                        value={editData.name || ''} 
                        onChange={(e) => setEditData({...editData, name: e.target.value})}
                        placeholder="Nome da política"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <span className="w-12 text-xs text-gray-500">Juros:</span>
                          <input type="number" step="0.01" value={editData.interest_rate || ''} onChange={(e) => setEditData({...editData, interest_rate: parseFloat(e.target.value)})} className="w-16 border rounded px-1 text-xs" /> %
                        </div>
                        <div className="flex items-center">
                          <span className="w-12 text-xs text-gray-500">Multa:</span>
                          <input type="number" step="0.01" value={editData.penalty_rate || ''} onChange={(e) => setEditData({...editData, penalty_rate: parseFloat(e.target.value)})} className="w-16 border rounded px-1 text-xs" /> %
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <label className="flex items-center space-x-2 text-xs mb-1">
                        <input type="checkbox" checked={editData.negative_allowed || false} onChange={(e) => setEditData({...editData, negative_allowed: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                        <span>Permitir</span>
                      </label>
                      {editData.negative_allowed && (
                        <div className="flex items-center text-xs text-gray-500">
                          Após <input type="number" value={editData.days_to_negative || ''} onChange={(e) => setEditData({...editData, days_to_negative: parseInt(e.target.value)})} className="w-12 mx-1 border rounded px-1" /> dias
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <label className="flex items-center space-x-2 text-xs mb-1">
                        <input type="checkbox" checked={editData.protest_allowed || false} onChange={(e) => setEditData({...editData, protest_allowed: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                        <span>Permitir</span>
                      </label>
                      {editData.protest_allowed && (
                        <div className="flex items-center text-xs text-gray-500">
                          Após <input type="number" value={editData.days_to_protest || ''} onChange={(e) => setEditData({...editData, days_to_protest: parseInt(e.target.value)})} className="w-12 mx-1 border rounded px-1" /> dias
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <label className="flex items-center justify-center space-x-2 text-xs">
                        <input type="checkbox" checked={editData.active !== false} onChange={(e) => setEditData({...editData, active: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                        <span>Ativo</span>
                      </label>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button onClick={handleSaveClick} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded mr-2" title="Salvar">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={handleCancelClick} disabled={saving} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Cancelar">
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )}
                
                {loading && !isCreating ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Carregando políticas...</td>
                  </tr>
                ) : policies.length === 0 && !isCreating ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Nenhuma política encontrada.</td>
                  </tr>
                ) : (
                  policies.map((policy: CollectionPolicy) => (
                    <tr key={policy.id} className="hover:bg-gray-50 transition-colors">
                      {editingId === policy.id ? (
                        <>
                          <td className="px-6 py-4">
                            <input 
                              type="text" 
                              value={editData.name || ''} 
                              onChange={(e) => setEditData({...editData, name: e.target.value})}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center">
                                <span className="w-12 text-xs text-gray-500">Juros:</span>
                                <input type="number" step="0.01" value={editData.interest_rate || ''} onChange={(e) => setEditData({...editData, interest_rate: parseFloat(e.target.value)})} className="w-16 border rounded px-1 text-xs" /> %
                              </div>
                              <div className="flex items-center">
                                <span className="w-12 text-xs text-gray-500">Multa:</span>
                                <input type="number" step="0.01" value={editData.penalty_rate || ''} onChange={(e) => setEditData({...editData, penalty_rate: parseFloat(e.target.value)})} className="w-16 border rounded px-1 text-xs" /> %
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <label className="flex items-center space-x-2 text-xs mb-1">
                              <input type="checkbox" checked={editData.negative_allowed || false} onChange={(e) => setEditData({...editData, negative_allowed: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                              <span>Permitir</span>
                            </label>
                            {editData.negative_allowed && (
                              <div className="flex items-center text-xs text-gray-500">
                                Após <input type="number" value={editData.days_to_negative || ''} onChange={(e) => setEditData({...editData, days_to_negative: parseInt(e.target.value)})} className="w-12 mx-1 border rounded px-1" /> dias
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <label className="flex items-center space-x-2 text-xs mb-1">
                              <input type="checkbox" checked={editData.protest_allowed || false} onChange={(e) => setEditData({...editData, protest_allowed: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                              <span>Permitir</span>
                            </label>
                            {editData.protest_allowed && (
                              <div className="flex items-center text-xs text-gray-500">
                                Após <input type="number" value={editData.days_to_protest || ''} onChange={(e) => setEditData({...editData, days_to_protest: parseInt(e.target.value)})} className="w-12 mx-1 border rounded px-1" /> dias
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <label className="flex items-center justify-center space-x-2 text-xs">
                              <input type="checkbox" checked={editData.active !== false} onChange={(e) => setEditData({...editData, active: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                              <span>Ativo</span>
                            </label>
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <button onClick={handleSaveClick} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded mr-2" title="Salvar">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={handleCancelClick} disabled={saving} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Cancelar">
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 font-medium text-gray-900">{policy.name}</td>
                          <td className="px-6 py-4 text-xs space-y-1">
                            <div><span className="text-gray-500">Juros:</span> {policy.interest_rate || 0}%</div>
                            <div><span className="text-gray-500">Multa:</span> {policy.penalty_rate || 0}%</div>
                          </td>
                          <td className="px-6 py-4">
                            {policy.negative_allowed ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">Sim ({policy.days_to_negative} dias)</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">Não</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {policy.protest_allowed ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">Sim ({policy.days_to_protest} dias)</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">Não</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {policy.active !== false ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700">Ativo</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700">Inativo</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleEditClick(policy)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </td>
                        </>
                      )}
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
