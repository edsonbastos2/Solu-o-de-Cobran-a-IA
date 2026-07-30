'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Plus, MessageCircleWarning, Phone, AlertCircle, CheckCircle2, Clock, CalendarClock, ArrowDownWideNarrow, ArrowUpNarrowWide, Filter } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { differenceInDays, parseISO } from 'date-fns';

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
  { id: 'not_started', title: 'Não Iniciado', icon: Clock, color: 'text-slate-400', bg: 'bg-white/5', hex: '#94a3b8' },
  { id: 'in_negotiation', title: 'Em Negociação (IA)', icon: MessageCircleWarning, color: 'text-blue-400', bg: 'bg-blue-500/10', hex: '#60a5fa' },
  { id: 'needs_attention', title: 'Requer Atenção', icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10', hex: '#fbbf24' },
  { id: 'closed', title: 'Acordo Fechado', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', hex: '#34d399' },
];

export default function KanbanBoard() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [sortDue, setSortDue] = useState<'asc' | 'desc' | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const chartData = columns.map(col => {
    const count = cases.filter(c => c.status === col.id).length;
    return {
      name: col.title,
      value: count,
      color: col.hex
    };
  }).filter(d => d.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111318] border border-white/10 p-3 rounded-lg shadow-xl">
          <p className="text-white text-sm font-medium mb-1">{payload[0].name}</p>
          <p className="text-slate-400 text-xs">
            {payload[0].value} {payload[0].value === 1 ? 'caso' : 'casos'}
          </p>
        </div>
      );
    }
    return null;
  };

  const toggleSortDue = () => {
    if (sortDue === null) setSortDue('asc');
    else if (sortDue === 'asc') setSortDue('desc');
    else setSortDue(null);
  };

  const filteredCases = [...cases].sort((a, b) => {
    if (!sortDue) return 0;
    if (!a.due_date) return sortDue === 'asc' ? 1 : -1;
    if (!b.due_date) return sortDue === 'asc' ? -1 : 1;
    const dateA = new Date(a.due_date).getTime();
    const dateB = new Date(b.due_date).getTime();
    return sortDue === 'asc' ? dateA - dateB : dateB - dateA;
  });

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Casos de Cobrança</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Acompanhe as negociações da IA em tempo real</p>
        </div>

        {chartData.length > 0 && !loading && (
          <div className="flex-1 max-w-sm hidden md:flex items-center gap-6 bg-[#16181d] border border-white/5 p-4 rounded-xl">
            <div className="h-24 w-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={45}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 flex-1">
              {chartData.map((data, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: data.color }} />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 truncate max-w-[90px]" title={data.name}>{data.name}</span>
                    <span className="text-xs font-bold text-white">{data.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link 
          href="/cases/new" 
          className="inline-flex items-center justify-center px-4 py-2 sm:py-1.5 bg-white text-black text-xs sm:text-sm font-semibold rounded-lg sm:rounded-md hover:bg-slate-200 transition-colors w-full md:w-auto shrink-0 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2 shrink-0" />
          Novo Caso
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={toggleSortDue}
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${sortDue ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
        >
          {sortDue === 'asc' ? <ArrowUpNarrowWide className="w-3.5 h-3.5 mr-1.5" /> : <ArrowDownWideNarrow className="w-3.5 h-3.5 mr-1.5" />}
          Vencimento {sortDue === 'asc' ? '(Mais próximos)' : sortDue === 'desc' ? '(Mais distantes)' : ''}
        </button>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex items-center px-2 text-slate-500">
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            <span className="text-xs font-medium">Status:</span>
          </div>
          <button
            onClick={() => setFilterStatus(null)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!filterStatus ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5'}`}
          >
            Todos
          </button>
          {columns.map(col => (
            <button
              key={col.id}
              onClick={() => setFilterStatus(col.id)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filterStatus === col.id ? `${col.bg} ${col.color.replace('text-', 'border-').replace('400', '500/20')} ${col.color}` : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5'}`}
            >
              {col.title}
            </button>
          ))}
        </div>
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
            {columns.filter(col => filterStatus ? col.id === filterStatus : true).map(col => {
              const colCases = filteredCases.filter(c => c.status === col.id);
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
                    {colCases.map(c => {
                      let badge = null;
                      if (c.due_date && c.status !== 'closed') {
                        try {
                          const daysUntilDue = differenceInDays(parseISO(c.due_date), new Date());
                          if (daysUntilDue < 0) {
                            badge = <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20"><CalendarClock className="w-3 h-3 mr-1" /> Vencido há {Math.abs(daysUntilDue)} {Math.abs(daysUntilDue) === 1 ? 'dia' : 'dias'}</span>;
                          } else if (daysUntilDue === 0) {
                            badge = <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"><CalendarClock className="w-3 h-3 mr-1" /> Vence hoje</span>;
                          } else if (daysUntilDue <= 3) {
                            badge = <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"><CalendarClock className="w-3 h-3 mr-1" /> Vence em {daysUntilDue} {daysUntilDue === 1 ? 'dia' : 'dias'}</span>;
                          }
                        } catch(e) {}
                      }

                      return (
                        <Link key={c.id} href={`/cases/${c.id}`}>
                          <div className="bg-[#0e1014] p-3.5 sm:p-4 rounded-lg border border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer group">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium text-slate-200 group-hover:text-emerald-400 transition-colors text-sm sm:text-base leading-tight">{c.name}</h4>
                              <span className="text-[10px] text-slate-500 font-mono tracking-wider shrink-0 ml-2">#{c.id.substring(0,6)}</span>
                            </div>
                            
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center text-xs text-slate-400 font-mono">
                                <Phone className="w-3 h-3 mr-1.5 opacity-60 shrink-0" />
                                {c.phone}
                              </div>
                              {badge}
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
                    );
                  })}
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
