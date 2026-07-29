import KanbanBoard from '@/components/kanban-board';
import { Header } from '@/components/header';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0c0d10] text-slate-300">
      <Header />
      <main>
        <KanbanBoard />
      </main>
    </div>
  );
}
