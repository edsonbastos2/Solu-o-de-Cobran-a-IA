import { Bot } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0c0d10] flex items-center justify-center p-4">
      <div className="flex flex-col items-center">
        <div className="animate-pulse w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
          <Bot className="w-6 h-6 text-emerald-500" />
        </div>
        <p className="text-slate-400 text-sm animate-pulse">Carregando caso...</p>
      </div>
    </div>
  );
}
