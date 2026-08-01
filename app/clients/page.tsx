'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/header';
import { Users, Search, Pencil, Check, X } from 'lucide-react';
import { formatPhoneInput } from '@/lib/utils';
import { Pagination } from '@/components/pagination';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ClientsPage() {
  const [page, setPage] = useState(1);
  const limit = 10;
  
  const { data, isLoading: loading, mutate } = useSWR(`/api/clients?page=${page}&limit=${limit}`, fetcher);
  const clients = data?.clients || [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const handleEditClick = (client: any) => {
    setEditingId(client.id);
    setEditData({
      name: client.name || '',
      email: client.email || '',
      phone: formatPhoneInput(client.phone || '')
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: editData.name,
          email: editData.email,
          phone: editData.phone
        })
        .eq('id', id);

      if (error) throw error;

      mutate(); // Refresh current page data
      setEditingId(null);
    } catch (err: any) {
      console.error(err);
      let errorMsg = err.message;
      if (err.code === '23505') {
        if (err.message.includes('clients_email_key')) {
          errorMsg = 'Este email já está cadastrado no sistema.';
        } else if (err.message.includes('clients_document_key')) {
          errorMsg = 'Este documento já está cadastrado no sistema.';
        }
      }
      alert('Erro ao salvar cliente: ' + errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Clientes</h1>
            <p className="text-gray-500 mt-1">Gestão de clientes cadastrados no sistema</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar por nome ou documento..." 
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Documento</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Telefone</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Carregando clientes...
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 flex flex-col items-center">
                      <Users className="w-12 h-12 text-gray-300 mb-3" />
                      <p>Nenhum cliente encontrado.</p>
                      <p className="text-sm mt-1">Os clientes são criados automaticamente ao importar um contrato via IA.</p>
                    </td>
                  </tr>
                ) : (
                  clients.map((client: any) => (
                    <tr key={client.id} className="hover:bg-gray-50/50 transition-colors">
                      {editingId === client.id ? (
                        <>
                          <td className="px-6 py-4">
                            <input 
                              type="text" 
                              value={editData.name} 
                              onChange={(e) => setEditData({...editData, name: e.target.value})}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">{client.document}</td>
                          <td className="px-6 py-4">
                            <input 
                              type="email" 
                              value={editData.email} 
                              onChange={(e) => setEditData({...editData, email: e.target.value})}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input 
                              type="text" 
                              value={editData.phone} 
                              onChange={(e) => setEditData({...editData, phone: formatPhoneInput(e.target.value)})}
                              placeholder="(00) 00000-0000"
                              maxLength={15}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => handleSaveEdit(client.id)}
                                disabled={saving}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Salvar"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={handleCancelEdit}
                                disabled={saving}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Cancelar"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 font-medium text-gray-900">{client.name}</td>
                          <td className="px-6 py-4">{client.document}</td>
                          <td className="px-6 py-4">{client.email || '-'}</td>
                          <td className="px-6 py-4">{client.phone ? formatPhoneInput(client.phone) : '-'}</td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleEditClick(client)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar Cliente"
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
