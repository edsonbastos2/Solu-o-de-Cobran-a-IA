'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Papa from 'papaparse';
import { ArrowLeft, Upload, Save, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { calculateUpdatedValue } from '@/lib/finance';
import { Header } from '@/components/header';
import { useAuth } from '@/hooks/useAuth';
import { formatPhoneInput, formatCurrencyInput, parseCurrency } from '@/lib/utils';

export default function NewCasePage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'manual' | 'csv'>('manual');

  // Manual form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [originalValue, setOriginalValue] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [margin, setMargin] = useState('');

  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);

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

      const { data, error } = await supabase.from('cases').insert([{
        user_id: user?.id,
        name,
        phone,
        original_value: valueNum,
        due_date: dateObj.toISOString().split('T')[0],
        max_discount_margin: marginNum,
        status: 'not_started',
        updated_value: updatedValue
      }]).select();

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
            <h1 className="text-xl sm:text-2xl font-bold text-white">Setup da Dívida</h1>
            <p className="text-slate-500 mt-0.5 sm:mt-1 text-xs sm:text-sm">Cadastre novos casos para a IA negociar.</p>
          </div>
          
          <div className="flex border-b border-white/5 text-xs sm:text-sm font-medium">
            <button 
              className={`flex-1 py-3 sm:py-4 transition-colors ${mode === 'manual' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-white/[0.02]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.01]'}`}
              onClick={() => setMode('manual')}
            >
              Cadastro Manual
            </button>
            <button 
              className={`flex-1 py-3 sm:py-4 transition-colors ${mode === 'csv' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-white/[0.02]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.01]'}`}
              onClick={() => setMode('csv')}
            >
              Upload de Planilha (CSV)
            </button>
          </div>

          <div className="p-4 sm:p-6">
            {error && (
              <div className="mb-6 p-3 sm:p-4 bg-red-500/10 text-red-500 rounded-md border border-red-500/20 flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm">{error}</p>
              </div>
            )}

            {mode === 'manual' ? (
              <form onSubmit={handleManualSubmit} className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Nome do Devedor</label>
                    <input 
                      required type="text" 
                      value={name} onChange={e => setName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0e1014] border border-white/10 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-600 text-xs sm:text-sm"
                      placeholder="Ex: João da Silva"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Telefone (WhatsApp)</label>
                    <input 
                      required type="text" 
                      value={phone} onChange={e => setPhone(formatPhoneInput(e.target.value))}
                      className="w-full px-3 py-2 bg-[#0e1014] border border-white/10 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-600 text-xs sm:text-sm"
                      placeholder="Ex: (11) 99999-9999"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Valor Original (R$)</label>
                    <input 
                      required type="text"
                      value={originalValue} onChange={e => setOriginalValue(formatCurrencyInput(e.target.value))}
                      className="w-full px-3 py-2 bg-[#0e1014] border border-white/10 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-600 text-xs sm:text-sm"
                      placeholder="Ex: R$ 1.500,00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Data de Vencimento</label>
                    <input 
                      required type="date" 
                      value={dueDate} onChange={e => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0e1014] border border-white/10 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-xs sm:text-sm color-scheme-dark"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Margem Máx. (%)</label>
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
                    className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 sm:py-2 bg-emerald-500 text-black font-semibold text-xs sm:text-sm rounded-md hover:bg-emerald-400 focus:outline-none disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Salvando...' : (
                      <>
                        <Save className="w-4 h-4 mr-2 shrink-0" />
                        Cadastrar Caso
                      </>
                    )}
                  </button>
                </div>
              </form>
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
