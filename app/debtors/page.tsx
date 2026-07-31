'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { 
  Users, 
  Plus, 
  Upload, 
  FileText, 
  Search, 
  Edit3, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin, 
  FileCheck, 
  Sparkles, 
  AlertCircle, 
  X, 
  CheckCircle2, 
  ArrowRight,
  Database,
  Copy,
  Briefcase
} from 'lucide-react';
import { Header } from '@/components/header';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatPhoneInput } from '@/lib/utils';

type Debtor = {
  id: string;
  created_at: string;
  user_id?: string;
  name: string;
  phone: string;
  email?: string;
  document?: string;
  address?: string;
  notes?: string;
};

const fetchDebtors = async (userId?: string, isSuperAdmin?: boolean) => {
  if (!supabase) throw new Error("Supabase não configurado.");

  let query = supabase.from('debtors').select('*');
  if (!isSuperAdmin && userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export default function DebtorsPage() {
  return <DebtorsContent />;
}

function DebtorsContent() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const { data: debtors, error, mutate } = useSWR<Debtor[]>(
    user ? ['debtors', user.id, profile?.is_super_admin] : null,
    () => fetchDebtors(user?.id, profile?.is_super_admin),
    { revalidateOnFocus: false }
  );

  const loading = authLoading || (!!user && debtors === undefined && !error);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [editingDebtor, setEditingDebtor] = useState<Debtor | null>(null);
  const [deletingDebtor, setDeletingDebtor] = useState<Debtor | null>(null);

  // Form State (Manual / Edit)
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formDocument, setFormDocument] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);

  // PDF Import State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [extractedDebtors, setExtractedDebtors] = useState<any[]>([]);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // SQL Copy Notice
  const [sqlCopied, setSqlCopied] = useState(false);

  const sqlScript = `-- Copie e execute este SQL no editor de SQL do seu Supabase para criar a tabela de devedores
CREATE TABLE IF NOT EXISTS public.debtors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  document TEXT,
  address TEXT,
  notes TEXT
);

ALTER TABLE public.debtors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver os próprios devedores" ON public.debtors
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true);

CREATE POLICY "Usuários podem inserir os próprios devedores" ON public.debtors
  FOR INSERT WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar os próprios devedores" ON public.debtors
  FOR UPDATE USING (user_id IS NULL OR auth.uid() = user_id OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true);

CREATE POLICY "Usuários podem deletar os próprios devedores" ON public.debtors
  FOR DELETE USING (user_id IS NULL OR auth.uid() = user_id OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true);

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS debtor_id UUID REFERENCES public.debtors(id) ON DELETE SET NULL;
`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlScript);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 3000);
  };

  const openCreateModal = () => {
    setEditingDebtor(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormDocument('');
    setFormAddress('');
    setFormNotes('');
    setFormError(null);
    setIsManualModalOpen(true);
  };

  const openEditModal = (debtor: Debtor) => {
    setEditingDebtor(debtor);
    setFormName(debtor.name || '');
    setFormPhone(debtor.phone || '');
    setFormEmail(debtor.email || '');
    setFormDocument(debtor.document || '');
    setFormAddress(debtor.address || '');
    setFormNotes(debtor.notes || '');
    setFormError(null);
    setIsManualModalOpen(true);
  };

  const handleSaveDebtor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      setFormError('Nome e telefone são obrigatórios.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (!supabase) throw new Error("Supabase não configurado.");

      const payload = {
        user_id: user?.id,
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || null,
        document: formDocument.trim() || null,
        address: formAddress.trim() || null,
        notes: formNotes.trim() || null,
      };

      if (editingDebtor) {
        const { error } = await supabase
          .from('debtors')
          .update(payload)
          .eq('id', editingDebtor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('debtors')
          .insert([payload]);
        if (error) throw error;
      }

      await mutate();
      setIsManualModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar devedor.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDebtor = async () => {
    if (!deletingDebtor) return;
    setSaving(true);
    try {
      if (!supabase) throw new Error("Supabase não configurado.");
      const { error } = await supabase
        .from('debtors')
        .delete()
        .eq('id', deletingDebtor.id);
      if (error) throw error;

      await mutate();
      setDeletingDebtor(null);
    } catch (err: any) {
      alert("Erro ao excluir devedor: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // CSV Parsing
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      setCsvError(null);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setCsvPreview(results.data);
          } else {
            setCsvError("Arquivo CSV vazio ou sem colunas válidas.");
          }
        },
        error: (err) => {
          setCsvError("Erro ao ler CSV: " + err.message);
        }
      });
    }
  };

  const handleBatchImportCsv = async () => {
    if (!csvPreview || csvPreview.length === 0) return;
    setSaving(true);
    setCsvError(null);

    try {
      if (!supabase) throw new Error("Supabase não configurado.");

      const debtorsToInsert = csvPreview.map((row: any) => ({
        user_id: user?.id,
        name: row.nome || row.name || row.Devedor || row.Cliente || 'Sem Nome',
        phone: row.telefone || row.phone || row.WhatsApp || row.Celular || '',
        email: row.email || row.Email || null,
        document: row.cpf || row.cnpj || row.document || row.CPF || row.CNPJ || null,
        address: row.endereco || row.address || row.Endereço || null,
        notes: row.observacoes || row.notes || row.Observações || null,
      })).filter(d => d.name && d.phone);

      if (debtorsToInsert.length === 0) {
        throw new Error("Nenhum devedor válido encontrado no CSV (Nome e Telefone são obrigatórios).");
      }

      const { error } = await supabase.from('debtors').insert(debtorsToInsert);
      if (error) throw error;

      await mutate();
      setIsCsvModalOpen(false);
      setCsvFile(null);
      setCsvPreview([]);
    } catch (err: any) {
      setCsvError(err.message || "Erro ao importar devedores do CSV.");
    } finally {
      setSaving(false);
    }
  };

  // PDF Extracting
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfFile(file);
    setPdfExtracting(true);
    setPdfError(null);
    setExtractedDebtors([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/debtors/extract-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao processar PDF via Inteligência Artificial.");
      }

      if (data.debtors && Array.isArray(data.debtors)) {
        setExtractedDebtors(data.debtors);
      } else {
        throw new Error("Nenhum devedor foi detectado no documento enviado.");
      }
    } catch (err: any) {
      setPdfError(err.message || "Erro ao processar o arquivo.");
    } finally {
      setPdfExtracting(false);
    }
  };

  const handleSaveExtractedDebtors = async () => {
    if (extractedDebtors.length === 0) return;
    setSaving(true);
    setPdfError(null);

    try {
      if (!supabase) throw new Error("Supabase não configurado.");

      const debtorsToInsert = extractedDebtors.map((item) => ({
        user_id: user?.id,
        name: item.name || 'Devedor sem nome',
        phone: item.phone || '',
        email: item.email || null,
        document: item.document || null,
        address: item.address || null,
        notes: item.notes || null,
      })).filter(d => d.name && d.phone);

      if (debtorsToInsert.length === 0) {
        throw new Error("Certifique-se de que pelo menos um devedor possui Nome e Telefone antes de salvar.");
      }

      const { error } = await supabase.from('debtors').insert(debtorsToInsert);
      if (error) throw error;

      await mutate();
      setIsPdfModalOpen(false);
      setPdfFile(null);
      setExtractedDebtors([]);
    } catch (err: any) {
      setPdfError(err.message || "Erro ao salvar devedores extraídos.");
    } finally {
      setSaving(false);
    }
  };

  const updateExtractedField = (index: number, field: string, val: string) => {
    const updated = [...extractedDebtors];
    updated[index] = { ...updated[index], [field]: val };
    setExtractedDebtors(updated);
  };

  const removeExtractedItem = (index: number) => {
    setExtractedDebtors(extractedDebtors.filter((_, i) => i !== index));
  };

  // Filtered List
  const filteredDebtors = (debtors || []).filter((d) => {
    const term = searchTerm.toLowerCase();
    return (
      d.name?.toLowerCase().includes(term) ||
      d.phone?.toLowerCase().includes(term) ||
      d.email?.toLowerCase().includes(term) ||
      d.document?.toLowerCase().includes(term) ||
      d.address?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-[#0B0C0E] text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Header Title & Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Users className="w-4 h-4" />
              Gestão de Clientes & Devedores
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Cadastro de Devedores
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Gerencie contatos, CPF/CNPJ, endereços e importe em lote por CSV ou Leitura Inteligente de PDF.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-lg shadow-lg shadow-emerald-500/10 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              Novo Devedor
            </button>

            <button
              onClick={() => {
                setCsvFile(null);
                setCsvPreview([]);
                setCsvError(null);
                setIsCsvModalOpen(true);
              }}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs sm:text-sm px-3.5 py-2.5 rounded-lg border border-white/10 transition-colors shrink-0"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              Importar CSV
            </button>

            <button
              onClick={() => {
                setPdfFile(null);
                setExtractedDebtors([]);
                setPdfError(null);
                setIsPdfModalOpen(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs sm:text-sm px-3.5 py-2.5 rounded-lg shadow-md transition-all shrink-0"
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
              Importar PDF (IA)
            </button>
          </div>
        </div>

        {/* Database Table Warning Banner if error occurs */}
        {error && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 sm:p-5 text-amber-200 text-sm space-y-3">
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-300 text-base">
                  Aviso: Tabela de Devedores Não Detectada no Supabase
                </h4>
                <p className="text-amber-200/80 text-xs sm:text-sm mt-1">
                  Se você ainda não criou a tabela <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-400">debtors</code> no seu banco de dados Supabase, rode o script abaixo no Editor de SQL do seu projeto Supabase.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={copySqlToClipboard}
                className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3.5 py-2 rounded-lg text-xs font-semibold border border-amber-500/30 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                {sqlCopied ? 'SQL Copiado para a Área de Transferência!' : 'Copiar Script SQL do Banco'}
              </button>
            </div>
          </div>
        )}

        {/* Search Bar & Counter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#111318] p-4 rounded-xl border border-white/5">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, telefone, email, CPF..."
              className="w-full bg-[#0B0C0E] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="text-slate-400 text-xs sm:text-sm flex items-center gap-2 self-start sm:self-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Total de devedores cadastrados: <strong className="text-white">{debtors?.length || 0}</strong>
          </div>
        </div>

        {/* Debtors List / Table */}
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredDebtors.length === 0 ? (
          <div className="bg-[#111318] rounded-xl border border-white/5 p-12 text-center max-w-lg mx-auto space-y-4">
            <div className="w-12 h-12 bg-slate-800/80 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-medium text-white">Nenhum devedor encontrado</h3>
              <p className="text-slate-400 text-xs mt-1">
                {searchTerm
                  ? 'Tente ajustar os termos de pesquisa.'
                  : 'Cadastre seu primeiro devedor manualmente ou importe via CSV / PDF.'}
              </p>
            </div>
            {!searchTerm && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 bg-emerald-500 text-black font-semibold text-xs px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Devedor
              </button>
            )}
          </div>
        ) : (
          <div className="bg-[#111318] rounded-xl border border-white/5 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#181B22] border-b border-white/5 text-slate-400 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Nome / Razão Social</th>
                    <th className="py-3.5 px-4 font-semibold">Contato (WhatsApp / Email)</th>
                    <th className="py-3.5 px-4 font-semibold">CPF / CNPJ</th>
                    <th className="py-3.5 px-4 font-semibold">Endereço</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {filteredDebtors.map((debtor) => (
                    <tr key={debtor.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4 font-medium text-white">
                        <div>
                          <div className="text-sm font-semibold">{debtor.name}</div>
                          {debtor.notes && (
                            <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {debtor.notes}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-200">
                          <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{formatPhoneInput(debtor.phone)}</span>
                        </div>
                        {debtor.email && (
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>{debtor.email}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 text-slate-300">
                        {debtor.document ? (
                          <span className="font-mono text-xs bg-white/5 px-2 py-1 rounded text-slate-300">
                            {debtor.document}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-slate-400 text-xs max-w-xs truncate">
                        {debtor.address ? (
                          <div className="flex items-center gap-1.5" title={debtor.address}>
                            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">{debtor.address}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/cases/new?debtor_id=${debtor.id}&name=${encodeURIComponent(debtor.name)}&phone=${encodeURIComponent(debtor.phone)}`}
                            className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/20 transition-colors"
                            title="Criar Novo Caso de Cobrança para este devedor"
                          >
                            <Briefcase className="w-3.5 h-3.5" />
                            Criar Caso
                          </Link>

                          <button
                            onClick={() => openEditModal(debtor)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Editar Devedor"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setDeletingDebtor(debtor)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Excluir Devedor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Manual Modal (Create / Edit) */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111318] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {editingDebtor ? 'Editar Devedor' : 'Cadastrar Novo Devedor'}
              </h3>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDebtor} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nome Completo ou Razão Social *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo Silva"
                  className="w-full bg-[#0B0C0E] border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(formatPhoneInput(e.target.value))}
                    placeholder="Ex: (11) 99999-9999"
                    className="w-full bg-[#0B0C0E] border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    CPF ou CNPJ
                  </label>
                  <input
                    type="text"
                    value={formDocument}
                    onChange={(e) => setFormDocument(e.target.value)}
                    placeholder="Ex: 123.456.789-00"
                    className="w-full bg-[#0B0C0E] border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="Ex: devedor@email.com"
                  className="w-full bg-[#0B0C0E] border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Endereço Completo
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Rua, Número, Bairro, Cidade, Estado, CEP"
                  className="w-full bg-[#0B0C0E] border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Observações
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Notas internas ou histórico prévio"
                  className="w-full bg-[#0B0C0E] border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs px-5 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>}
                  {editingDebtor ? 'Atualizar Devedor' : 'Salvar Devedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111318] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Importar Devedores via CSV</h3>
              </div>
              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {csvError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {csvError}
                </div>
              )}

              <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-emerald-500/50 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileChange}
                  className="hidden"
                  id="csv-file-input"
                />
                <label htmlFor="csv-file-input" className="cursor-pointer space-y-2 block">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-white">
                    {csvFile ? csvFile.name : 'Clique para selecionar o arquivo .CSV'}
                  </div>
                  <p className="text-slate-500 text-xs">
                    Formatos aceitos de colunas: <code className="text-slate-300">nome, telefone, email, cpf, endereco, observacoes</code>
                  </p>
                </label>
              </div>

              {csvPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Pré-visualização dos Registros Encontrados ({csvPreview.length}):
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-white/5 rounded-lg bg-[#0B0C0E]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 text-slate-400 border-b border-white/5 sticky top-0">
                        <tr>
                          <th className="p-2">Nome</th>
                          <th className="p-2">Telefone</th>
                          <th className="p-2">Email</th>
                          <th className="p-2">CPF/CNPJ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-300">
                        {csvPreview.slice(0, 10).map((row, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-medium">{row.nome || row.name || row.Devedor || '—'}</td>
                            <td className="p-2">{row.telefone || row.phone || row.WhatsApp || '—'}</td>
                            <td className="p-2 text-slate-400">{row.email || row.Email || '—'}</td>
                            <td className="p-2 text-slate-400">{row.cpf || row.cnpj || row.CPF || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleBatchImportCsv}
                  disabled={saving || !csvPreview.length}
                  className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs px-5 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>}
                  Importar {csvPreview.length} Devedores
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Intelligent Import Modal */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111318] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                <h3 className="text-lg font-bold text-white">Importar Devedores via Leitura IA de PDF</h3>
              </div>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {pdfError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {pdfError}
                </div>
              )}

              {!pdfFile && (
                <div className="border-2 border-dashed border-indigo-500/30 bg-indigo-500/5 rounded-xl p-8 text-center hover:border-indigo-500/60 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handlePdfUpload}
                    className="hidden"
                    id="pdf-file-input"
                  />
                  <label htmlFor="pdf-file-input" className="cursor-pointer space-y-3 block">
                    <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-base font-semibold text-white">
                        Selecione um arquivo PDF ou Imagem
                      </div>
                      <p className="text-slate-400 text-xs mt-1">
                        Envie relatórios, contratos ou planilhas digitalizadas. A IA do Gemini analisará o documento e extrairá automaticamente todos os devedores.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {pdfExtracting && (
                <div className="py-12 text-center space-y-3">
                  <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-sm font-medium text-indigo-300">
                    A Inteligência Artificial do Gemini está lendo e extraindo os dados do PDF...
                  </p>
                </div>
              )}

              {extractedDebtors.length > 0 && !pdfExtracting && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Devedores Extraídos com Sucesso ({extractedDebtors.length})
                    </span>
                    <span className="text-xs text-slate-400">Você pode revisar e editar os campos antes de salvar</span>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 border border-white/5 rounded-xl p-3 bg-[#0B0C0E]">
                    {extractedDebtors.map((item, idx) => (
                      <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/5 relative group space-y-2">
                        <button
                          type="button"
                          onClick={() => removeExtractedItem(idx)}
                          className="absolute top-2 right-2 text-slate-500 hover:text-red-400 p-1"
                          title="Remover este item"
                        >
                          <X className="w-4 h-4" />
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateExtractedField(idx, 'name', e.target.value)}
                            placeholder="Nome"
                            className="bg-black/30 border border-white/10 rounded px-2.5 py-1 text-xs text-white"
                          />
                          <input
                            type="text"
                            value={item.phone}
                            onChange={(e) => updateExtractedField(idx, 'phone', e.target.value)}
                            placeholder="Telefone"
                            className="bg-black/30 border border-white/10 rounded px-2.5 py-1 text-xs text-white"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={item.email || ''}
                            onChange={(e) => updateExtractedField(idx, 'email', e.target.value)}
                            placeholder="Email"
                            className="bg-black/30 border border-white/10 rounded px-2.5 py-1 text-xs text-slate-300"
                          />
                          <input
                            type="text"
                            value={item.document || ''}
                            onChange={(e) => updateExtractedField(idx, 'document', e.target.value)}
                            placeholder="CPF/CNPJ"
                            className="bg-black/30 border border-white/10 rounded px-2.5 py-1 text-xs text-slate-300"
                          />
                          <input
                            type="text"
                            value={item.address || ''}
                            onChange={(e) => updateExtractedField(idx, 'address', e.target.value)}
                            placeholder="Endereço"
                            className="bg-black/30 border border-white/10 rounded px-2.5 py-1 text-xs text-slate-300"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>

                {pdfFile && !pdfExtracting && extractedDebtors.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPdfFile(null);
                      setExtractedDebtors([]);
                    }}
                    className="px-4 py-2 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                  >
                    Tentar Outro Arquivo
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveExtractedDebtors}
                  disabled={saving || pdfExtracting || extractedDebtors.length === 0}
                  className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs px-5 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>}
                  Salvar {extractedDebtors.length} Devedores
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingDebtor && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111318] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Confirmar Exclusão</h3>
            <p className="text-slate-300 text-xs">
              Tem certeza que deseja remover o devedor <strong className="text-white">{deletingDebtor.name}</strong>? Esta ação não pode ser desfeita.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingDebtor(null)}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteDebtor}
                disabled={saving}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {saving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
