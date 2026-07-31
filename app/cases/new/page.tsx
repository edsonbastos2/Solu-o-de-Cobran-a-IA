'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Papa from 'papaparse';
import { 
  ArrowLeft, 
  Upload, 
  Save, 
  AlertCircle, 
  Search, 
  UserCheck, 
  X, 
  Plus, 
  Users,
  Check
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { calculateUpdatedValue } from '@/lib/finance';
import { Header } from '@/components/header';
import { useAuth } from '@/hooks/useAuth';
import { formatPhoneInput, formatCurrencyInput, parseCurrency } from '@/lib/utils';

type DebtorOption = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  document?: string;
  address?: string;
};

export default function NewCasePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0c0d10] text-slate-300 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <NewCaseForm />
    </Suspense>
  );
}

function NewCaseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'manual' | 'csv'>('manual');

  // Registered Debtors Search
  const [debtorSearch, setDebtorSearch] = useState('');
  const [debtorsList, setDebtorsList] = useState<DebtorOption[]>([]);
  const [searchingDebtors, setSearchingDebtors] = useState(false);
  const [showDebtorDropdown, setShowDebtorDropdown] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState<DebtorOption | null>(null);

  // Manual form state
  const [name, setName] = useState(() => searchParams.get('name') || '');
  const [phone, setPhone] = useState(() => searchParams.get('phone') || '');
  const [email, setEmail] = useState('');
  const [document, setDocument] = useState('');
  const [address, setAddress] = useState('');
  const [originalValue, setOriginalValue] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [margin, setMargin] = useState('');

  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);

  const selectDebtor = (debtor: DebtorOption) => {
    setSelectedDebtor(debtor);
    setName(debtor.name || '');
    setPhone(debtor.phone || '');
    setEmail(debtor.email || '');
    setDocument(debtor.document || '');
    setAddress(debtor.address || '');
    setShowDebtorDropdown(false);
    setDebtorSearch('');
  };

  // Check initial URL SearchParams (e.g., coming from Debtors page)
  useEffect(() => {
    const queryDebtorId = searchParams.get('debtor_id');

    if (queryDebtorId && supabase) {
      supabase
        .from('debtors')
        .select('*')
        .eq('id', queryDebtorId)
        .single()
        .then(({ data }: { data: any }) => {
          if (data) {
            selectDebtor(data);
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  // Search registered debtors in Supabase
  const handleSearchDebtors = async (term: string) => {
    setDebtorSearch(term);
    if (!term.trim()) {
      setDebtorsList([]);
      setShowDebtorDropdown(false);
      return;
    }

    setSearchingDebtors(true);
    setShowDebtorDropdown(true);

    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('debtors')
        .select('*')
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%,document.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(8);

      if (error) {
        console.error("Erro ao buscar devedores:", error);
      } else {
        setDebtorsList(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingDebtors(false);
    }
  };

  const clearSelectedDebtor = () => {
    setSelectedDebtor(null);
    setName('');
    setPhone('');
    setEmail('');
    setDocument('');
    setAddress('');
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!supabase) throw new Error("Supabase não configurado.");

      const valueNum = parseCurrency(originalValue);
      const marginNum = parseFloat(margin);
      const dateObj = new Date(dueDate);
      
      const updatedValue = calculateUpdatedValue(valueNum, dateObj);

      const payload: any = {
        user_id: user?.id,
        name,
        phone,
        original_value: valueNum,
        due_date: dateObj.toISOString().split('T')[0],
        max_discount_margin: marginNum,
        status: 'not_started',
        updated_value: updatedValue
      };

      if (selectedDebtor) {
        payload.debtor_id = selectedDebtor.id;
        payload.debtor_email = selectedDebtor.email || email;
        payload.debtor_document = selectedDebtor.document || document;
        payload.debtor_address = selectedDebtor.address || address;
      }

      const { error } = await supabase.from('cases').insert([payload]);

      if (error) throw error;
      
      router.push('/');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          setCsvPreview(results.data.slice(0, 5)); // Show first 5
        }
      });
    }
  };

  const handleCsvSubmit = async () => {
    if (!csvFile) return;
    setLoading(true);
    setError(null);

    try {
      if (!supabase) throw new Error("Supabase não configurado.");

      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
          try {
            const cases = results.data.map((row: any) => {
              const valueNum = parseFloat(row.valor_original || row.original_value);
              const marginNum = parseFloat(row.margem_desconto || row.max_discount_margin);
              const dateObj = new Date(row.data_vencimento || row.due_date);
              
              if (isNaN(valueNum) || isNaN(marginNum) || !dateObj.getTime()) {
                 throw new Error("Formato de CSV inválido. Certifique-se de que as colunas estão corretas.");
              }

              return {
                user_id: user?.id,
                name: row.nome || row.name,
                phone: row.telefone || row.phone,
                original_value: valueNum,
                due_date: dateObj.toISOString().split('T')[0],
                max_discount_margin: marginNum,
                status: 'not_started',
                updated_value: calculateUpdatedValue(valueNum, dateObj)
              };
            });

            const { error } = await supabase.from('cases').insert(cases);
            if (error) throw error;
            
            router.push('/');
          } catch (err: any) {
            setError(err.message);
            setLoading(false);
          }
        },
        error: (err) => {
          setError(err.message);
          setLoading(false);
        }
      });
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0d10] text-slate-300">
      <Header />
      <div className="py-4 sm:py-8 max-w-3xl mx-auto px-3 sm:px-4">
        <Link href="/" className="inline-flex items-center text-xs sm:text-sm text-slate-500 hover:text-white mb-4 sm:mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1 shrink-0" />
          Voltar para o Kanban
        </Link>
        
        <div className="bg-[#16181d] rounded-xl border border-white/5 shadow-sm overflow-hidden">
          <div className="border-b border-white/5 p-4 sm:p-6 bg-white/[0.02]">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Setup do Novo Caso de Cobrança</h1>
            <p className="text-slate-500 mt-0.5 sm:mt-1 text-xs sm:text-sm">Pesquise devedores já cadastrados ou informe dados de uma nova dívida.</p>
          </div>
          
          <div className="flex border-b border-white/5 text-xs sm:text-sm font-medium">
            <button 
              className={`flex-1 py-3 sm:py-4 transition-colors ${mode === 'manual' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-white/[0.02]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.01]'}`}
              onClick={() => setMode('manual')}
            >
              Cadastro Manual / Seleção de Devedor
            </button>
            <button 
              className={`flex-1 py-3 sm:py-4 transition-colors ${mode === 'csv' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-white/[0.02]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.01]'}`}
              onClick={() => setMode('csv')}
            >
              Upload de Planilha (CSV)
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {error && (
              <div className="p-3 sm:p-4 bg-red-500/10 text-red-500 rounded-md border border-red-500/20 flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm">{error}</p>
              </div>
            )}

            {mode === 'manual' ? (
              <div className="space-y-6">
                {/* Section 1: Debtor Search or Linked Debtor */}
                <div className="bg-[#0e1014] p-4 rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      1. Selecionar Devedor Cadastrado
                    </label>
                    <Link
                      href="/debtors"
                      className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Gerenciar Devedores
                    </Link>
                  </div>

                  {selectedDebtor ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3.5 flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-white">{selectedDebtor.name}</div>
                          <div className="text-slate-400 text-xs flex flex-wrap gap-2 mt-0.5">
                            <span>Tel: {selectedDebtor.phone}</span>
                            {selectedDebtor.document && <span>• CPF/CNPJ: {selectedDebtor.document}</span>}
                            {selectedDebtor.email && <span>• {selectedDebtor.email}</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearSelectedDebtor}
                        className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
                        title="Desvincular Devedor"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                        <input
                          type="text"
                          value={debtorSearch}
                          onChange={(e) => handleSearchDebtors(e.target.value)}
                          onFocus={() => {
                            if (debtorSearch.trim()) setShowDebtorDropdown(true);
                          }}
                          placeholder="Digite o nome, telefone, email ou CPF do devedor já cadastrado..."
                          className="w-full bg-[#16181d] border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>

                      {showDebtorDropdown && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-[#181B22] border border-white/10 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                          {searchingDebtors ? (
                            <div className="p-4 text-center text-xs text-slate-400">Pesquisando devedores...</div>
                          ) : debtorsList.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">
                              Nenhum devedor encontrado com esse termo. Você pode preencher os dados do novo devedor abaixo.
                            </div>
                          ) : (
                            <div className="divide-y divide-white/5">
                              {debtorsList.map((d) => (
                                <button
                                  type="button"
                                  key={d.id}
                                  onClick={() => selectDebtor(d)}
                                  className="w-full text-left p-3 hover:bg-white/5 transition-colors flex items-center justify-between group"
                                >
                                  <div>
                                    <div className="font-semibold text-white text-xs sm:text-sm group-hover:text-emerald-400 transition-colors">
                                      {d.name}
                                    </div>
                                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                      <span>Tel: {d.phone}</span>
                                      {d.document && <span>• CPF: {d.document}</span>}
                                    </div>
                                  </div>
                                  <span className="text-xs text-emerald-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" />
                                    Selecionar
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 2: Case & Debtor Details Form */}
                <form onSubmit={handleManualSubmit} className="space-y-4 sm:space-y-6">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    2. Informações da Dívida e do Devedor
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Nome do Devedor *</label>
                      <input 
                        required type="text" 
                        value={name} onChange={e => setName(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0e1014] border border-white/10 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-600 text-xs sm:text-sm"
                        placeholder="Ex: João da Silva"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Telefone (WhatsApp) *</label>
                      <input 
                        required type="text" 
                        value={phone} onChange={e => setPhone(formatPhoneInput(e.target.value))}
                        className="w-full px-3 py-2 bg-[#0e1014] border border-white/10 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-600 text-xs sm:text-sm"
                        placeholder="Ex: (11) 99999-9999"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Valor Original (R$) *</label>
                      <input 
                        required type="text"
                        value={originalValue} onChange={e => setOriginalValue(formatCurrencyInput(e.target.value))}
                        className="w-full px-3 py-2 bg-[#0e1014] border border-white/10 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-600 text-xs sm:text-sm"
                        placeholder="Ex: R$ 1.500,00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Data de Vencimento *</label>
                      <input 
                        required type="date" 
                        value={dueDate} onChange={e => setDueDate(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0e1014] border border-white/10 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-xs sm:text-sm color-scheme-dark"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Margem Máx. Desconto (%) *</label>
                      <input 
                        required type="number" step="0.1" min="0" max="100"
                        value={margin} onChange={e => setMargin(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0e1014] border border-white/10 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-600 text-xs sm:text-sm"
                        placeholder="Ex: 10"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-2 sm:pt-4 flex justify-end">
                    <button 
                      type="submit" 
                      disabled={loading}
                      className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 sm:py-2.5 bg-emerald-500 text-black font-semibold text-xs sm:text-sm rounded-lg hover:bg-emerald-400 focus:outline-none disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/10"
                    >
                      {loading ? 'Salvando...' : (
                        <>
                          <Save className="w-4 h-4 mr-2 shrink-0" />
                          Cadastrar Novo Caso
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="border border-dashed border-white/20 rounded-lg p-6 sm:p-10 text-center hover:bg-white/[0.02] transition-colors bg-[#0e1014]">
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleCsvUpload} 
                    className="hidden" 
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
                    <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-slate-500 mb-2 sm:mb-3 shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-white">Clique para selecionar um arquivo CSV</span>
                    <span className="text-[11px] sm:text-xs text-slate-500 mt-1">Colunas: nome, telefone, valor_original, data_vencimento, margem_desconto</span>
                  </label>
                </div>
                
                {csvPreview.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xs sm:text-sm font-semibold text-white">Pré-visualização (primeiros 5 itens)</h3>
                    <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#0e1014]">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-white/5 text-slate-400 border-b border-white/10">
                          <tr>
                            {Object.keys(csvPreview[0]).map(key => (
                              <th key={key} className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium uppercase tracking-wider">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {csvPreview.map((row, i) => (
                            <tr key={i} className="hover:bg-white/[0.02]">
                              {Object.values(row).map((val: any, j) => (
                                <td key={j} className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-slate-300">
                                  {val}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end pt-2 sm:pt-4">
                      <button 
                        onClick={handleCsvSubmit}
                        disabled={loading}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 sm:py-2 bg-emerald-500 text-black font-semibold text-xs sm:text-sm rounded-md hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                      >
                        {loading ? 'Importando...' : 'Importar Todos'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
