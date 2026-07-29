'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Plus, MessageCircleWarning, Phone, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

type Case = {
  id: string;
  name: string;
  phone: string;
  original_value: number;
  due_date: string;
  max_discount_margin: number;
  status: 'not_started' | 'in_negotiation' | 'needs_attention' | 'closed';
  updated_value: number;
};

const columns = [
  { id: 'not_started', title: 'Não Iniciado', icon: Clock, color: 'text-slate-400', bg: 'bg-white/5' },
  { id: 'in_negotiation', title: 'Em Negociação (IA)', icon: MessageCircleWarning, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { id: 'needs_attention', title: 'Requer Atenção', icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { id: 'closed', title: 'Acordo Fechado', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
];

export default function KanbanBoard() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCases();

    // Set up realtime subscription if supabase is configured
    if (supabase) {
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cases' },
          (payload: any) => {
            fetchCases();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  async function fetchCases() {
    if (!supabase) {
      setError("Supabase não configurado. Adicione as variáveis de ambiente.");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCases(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Casos de Cobrança</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Acompanhe as negociações da IA em tempo real</p>
        </div>
        <Link 
          href="/cases/new" 
          className="inline-flex items-center justify-center px-4 py-2 sm:py-1.5 bg-white text-black text-xs sm:text-sm font-semibold rounded-lg sm:rounded-md hover:bg-slate-200 transition-colors w-full sm:w-auto shrink-0 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2 shrink-0" />
          Novo Caso
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 text-red-500 rounded-md border border-red-500/20 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-4 sm:gap-6 min-w-max h-full pb-4 snap-x snap-mandatory">
            {columns.map(col => {
              const colCases = cases.filter(c => c.status === col.id);
              const Icon = col.icon;
              
              return (
                <div key={col.id} className="w-[85vw] max-w-[320px] sm:w-80 shrink-0 flex flex-col max-h-[75vh] lg:max-h-full bg-[#16181d] rounded-xl border border-white/5 overflow-hidden snap-center">
                  <div className="p-3.5 sm:p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`p-1.5 rounded-md ${col.bg}`}>
                        <Icon className={`w-4 h-4 ${col.color}`} />
                      </div>
                      <h3 className="font-semibold text-white text-xs sm:text-sm">{col.title}</h3>
                    </div>
                    <span className="bg-white/10 text-slate-300 text-xs font-medium px-2 py-0.5 rounded">
                      {colCases.length}
                    </span>
                  </div>
                  
                  <div className="flex-1 p-3 overflow-y-auto space-y-3">
                    {colCases.map(c => (
                      <Link key={c.id} href={`/cases/${c.id}`}>
                        <div className="bg-[#0e1014] p-3.5 sm:p-4 rounded-lg border border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer group">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-slate-200 group-hover:text-emerald-400 transition-colors text-sm sm:text-base leading-tight">{c.name}</h4>
                            <span className="text-[10px] text-slate-500 font-mono tracking-wider shrink-0 ml-2">#{c.id.substring(0,6)}</span>
                          </div>
                          
                          <div className="flex items-center text-xs text-slate-400 mb-3 font-mono">
                            <Phone className="w-3 h-3 mr-1.5 opacity-60 shrink-0" />
                            {c.phone}
                          </div>
                          
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Valor Atualizado</p>
                              <p className="font-bold text-slate-200 text-xs sm:text-sm">{formatCurrency(c.updated_value)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Margem</p>
                              <p className="text-xs font-mono text-emerald-400">{c.max_discount_margin}%</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {colCases.length === 0 && (
                      <div className="text-center py-8 text-slate-500 text-xs sm:text-sm border border-dashed border-white/10 rounded-lg">
                        Nenhum caso nesta etapa
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
