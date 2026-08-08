import { CheckCircle, Clock, Handshake, XCircle, CircleDollarSign } from 'lucide-react';
import { NegotiationStatus } from '@/lib/types';

const STATUS_META: Record<NegotiationStatus, { label: string; className: string }> = {
  open: {
    label: 'Em negociação',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  accepted: {
    label: 'Acordo aceito',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  expired: {
    label: 'Expirado',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  fulfilled: {
    label: 'Cumprido',
    className: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  defaulted: {
    label: 'Não cumprido',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
};

export function NegotiationStatusBadge({ status }: { status: NegotiationStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.open;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm ${meta.className}`}>
      {status === 'fulfilled' && <CheckCircle className="w-3.5 h-3.5" />}
      {status === 'defaulted' && <XCircle className="w-3.5 h-3.5" />}
      {status === 'expired' && <Clock className="w-3.5 h-3.5" />}
      {status === 'accepted' && <Handshake className="w-3.5 h-3.5" />}
      {status === 'open' && <CircleDollarSign className="w-3.5 h-3.5" />}
      {meta.label}
    </span>
  );
}