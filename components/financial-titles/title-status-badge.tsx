import { CheckCircle, Handshake, XCircle, CircleDollarSign, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const TITLE_STATUS_META: Record<string, { label: string; className: string }> = {
  paid: { label: 'Pago', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  settled: { label: 'Pago', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  recovered: { label: 'Pago', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partial: { label: 'Parcial', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  late: { label: 'Atrasado', className: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  canceled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  in_negotiation: { label: 'Em acordo', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  open: { label: 'Em negociação', className: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export function TitleStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const meta = TITLE_STATUS_META[key] ?? { label: 'Pendente', className: 'bg-slate-100 text-slate-600 border-slate-200' };
  const isPaid = key === 'paid' || key === 'settled' || key === 'recovered';
  const isCancelled = key === 'cancelled' || key === 'canceled';
  const isPartial = key === 'partial';
  const isLate = key === 'late';
  const isOpen = key === 'open' || key === 'in_negotiation';

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm', meta.className)}>
      {isPaid && <CheckCircle className="w-3.5 h-3.5" />}
      {isCancelled && <XCircle className="w-3.5 h-3.5" />}
      {isPartial && <CircleDollarSign className="w-3.5 h-3.5" />}
      {isLate && <AlertTriangle className="w-3.5 h-3.5" />}
      {isOpen && <Handshake className="w-3.5 h-3.5" />}
      {!isPaid && !isCancelled && !isPartial && !isLate && !isOpen && <Clock className="w-3.5 h-3.5" />}
      {meta.label}
    </span>
  );
}