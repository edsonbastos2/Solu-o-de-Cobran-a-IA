'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Shield, ShieldAlert, ShieldCheck, Mail, Phone, Calendar, UserPlus, Trash2, Edit2, X, AlertCircle } from 'lucide-react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  is_super_admin: boolean;
  created_at: string;
  ai_provider: string;
  ai_model: string;
};

const fetchProfiles = async () => {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Profile | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<Profile | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '', is_super_admin: false });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const { data: profiles, error, mutate } = useSWR<Profile[]>('admin-profiles', fetchProfiles, {
    revalidateOnFocus: false,
  });

  const loading = !profiles && !error;

  useEffect(() => {
    if (!authLoading && user) {
      if (user.email !== 'bastose132@gmail.com') {
        router.push('/');
      }
    }
  }, [user, authLoading, router]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar usuário');
      
      setShowAddModal(false);
      setFormData({ name: '', email: '', password: '', phone: '', is_super_admin: false });
      mutate();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    setFormLoading(true);
    setFormError('');
    try {
      const res = await fetch(`/api/admin/users/${showEditModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          is_super_admin: formData.is_super_admin,
          ...(formData.password ? { password: formData.password } : {})
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar usuário');
      
      setShowEditModal(null);
      setFormData({ name: '', email: '', password: '', phone: '', is_super_admin: false });
      mutate();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!showDeleteModal) return;
    setFormLoading(true);
    setFormError('');
    try {
      const res = await fetch(`/api/admin/users/${showDeleteModal.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao deletar usuário');
      
      setShowDeleteModal(null);
      mutate();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const toggleSuperAdmin = async (id: string, currentStatus: boolean) => {
    setIsUpdating(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_super_admin: !currentStatus })
      });
      if (!res.ok) throw new Error('Erro ao atualizar usuário');
      mutate();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar usuário');
    } finally {
      setIsUpdating(null);
    }
  };

  const openEditModal = (profile: Profile) => {
    setShowEditModal(profile);
    setFormData({
      name: profile.name || '',
      email: profile.email || '',
      password: '',
      phone: profile.phone || '',
      is_super_admin: profile.is_super_admin
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0c0d10] flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0c0d10] flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="bg-red-500/10 text-red-500 p-6 rounded-xl max-w-lg text-center border border-red-500/20">
            <ShieldAlert className="w-12 h-12 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Acesso Negado ou Erro</h2>
            <p className="text-sm opacity-80">{error.message}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0d10] flex flex-col text-slate-200">
      <Header />
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Shield className="w-6 h-6 text-emerald-500" />
              Gerenciamento de Usuários
            </h1>
            <p className="text-slate-400 text-sm mt-1">Super Admin Panel - Gerencie acessos e permissões do sistema.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm bg-white/5 px-4 py-2 rounded-lg border border-white/10 flex items-center gap-2">
              <span className="text-slate-400">Total:</span>
              <span className="font-medium text-white">{profiles?.length || 0}</span>
            </div>
            <button 
              onClick={() => {
                setFormData({ name: '', email: '', password: '', phone: '', is_super_admin: false });
                setShowAddModal(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
              <UserPlus className="w-4 h-4" />
              Novo Usuário
            </button>
          </div>
        </div>

        <div className="bg-[#111318] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Usuário</th>
                  <th className="px-6 py-4 font-medium">Contato</th>
                  <th className="px-6 py-4 font-medium">Data de Cadastro</th>
                  <th className="px-6 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {profiles?.map((profile) => (
                  <tr key={profile.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-indigo-400 font-medium border border-indigo-500/20 shrink-0">
                          {profile.email?.substring(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-medium text-white flex items-center gap-2">
                            {profile.name || 'Sem nome'}
                            {profile.is_super_admin && (
                              <span title="Super Admin"><ShieldCheck className="w-4 h-4 text-emerald-500" /></span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{profile.id.split('-')[0]}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-slate-300">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          {profile.email || 'Não informado'}
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 text-xs">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          {profile.phone || 'Sem telefone'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        {profile.created_at ? format(new Date(profile.created_at), "dd 'de' MMM, yyyy", { locale: ptBR }) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {profile.email === 'bastose132@gmail.com' ? (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Master Admin
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleSuperAdmin(profile.id, profile.is_super_admin)}
                            disabled={isUpdating === profile.id}
                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                              profile.is_super_admin
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                            } ${isUpdating === profile.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isUpdating === profile.id ? (
                              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : profile.is_super_admin ? (
                              <ShieldCheck className="w-3.5 h-3.5" />
                            ) : (
                              <Shield className="w-3.5 h-3.5" />
                            )}
                            {profile.is_super_admin ? 'Admin' : 'Tornar Admin'}
                          </button>
                          
                          <button
                            onClick={() => openEditModal(profile)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                            title="Editar Usuário"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteModal(profile)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                            title="Deletar Usuário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                
                {(!profiles || profiles.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      Nenhum usuário encontrado no sistema.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111318] border border-white/10 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-500" />
                Adicionar Usuário
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{formError}</p>
                </div>
              )}
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Nome</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">E-mail</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Telefone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Senha (Mínimo 6 caracteres)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                    placeholder="******"
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="is_super_admin"
                    checked={formData.is_super_admin}
                    onChange={e => setFormData(prev => ({ ...prev, is_super_admin: e.target.checked }))}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-[#111318]"
                  />
                  <label htmlFor="is_super_admin" className="text-sm font-medium text-slate-300 cursor-pointer">
                    Conceder privilégios de Super Admin
                  </label>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {formLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : null}
                    Adicionar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111318] border border-white/10 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" />
                Editar Usuário
              </h3>
              <button onClick={() => setShowEditModal(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{formError}</p>
                </div>
              )}
              <form onSubmit={handleEditUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">E-mail (Não editável)</label>
                  <input
                    type="email"
                    disabled
                    value={formData.email}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Nome</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Telefone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Nova Senha (deixe em branco para manter)</label>
                  <input
                    type="password"
                    minLength={6}
                    value={formData.password}
                    onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                    placeholder="******"
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="edit_is_super_admin"
                    checked={formData.is_super_admin}
                    onChange={e => setFormData(prev => ({ ...prev, is_super_admin: e.target.checked }))}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-[#111318]"
                  />
                  <label htmlFor="edit_is_super_admin" className="text-sm font-medium text-slate-300 cursor-pointer">
                    Privilégios de Super Admin
                  </label>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(null)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {formLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : null}
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111318] border border-white/10 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Excluir Usuário</h3>
              <p className="text-sm text-slate-400 mb-6">
                Tem certeza que deseja excluir o usuário <span className="text-white font-medium">{showDeleteModal.email}</span>? Esta ação não pode ser desfeita.
              </p>
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm text-left">
                  {formError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(null)}
                  disabled={formLoading}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={formLoading}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {formLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : null}
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

