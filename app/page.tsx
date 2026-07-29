import KanbanBoard from '@/components/kanban-board';
import { Bot } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0c0d10] text-slate-300">
      <header className="h-16 border-b border-white/5 bg-[#111318] px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Bot className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold text-white tracking-tight text-base sm:text-lg">CobrançaIA</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
          <span className="text-slate-500 hidden xs:inline">Painel do Advogado</span>
          <div className="w-px h-5 sm:h-6 bg-white/10 hidden xs:block"></div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium text-xs shadow-lg shrink-0">
            AD
          </div>
        </div>
      </header>
      <main>
        <KanbanBoard />
      </main>
    </div>
  );
}
