import { Header } from '@/components/header';
import Link from 'next/link';
import { FileText, Users, FolderKanban, Radio } from 'lucide-react';
import dynamic from 'next/dynamic';

const DashboardCharts = dynamic(() => import('@/components/dashboard-charts').then(mod => mod.DashboardCharts));

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Visão geral do seu sistema de cobranças</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <Link href="/cases" data-tour="dashboard-cases" className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100 hover:shadow-md transition-shadow group relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <FolderKanban className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-600" />
                    Tempo Real
                  </span>
                </div>
                <h2 className="text-xl font-medium text-gray-900">Casos de Cobrança</h2>
                <p className="text-gray-500 text-sm mt-1">Acompanhe negociações e chat em tempo real</p>
              </div>
            </div>
          </Link>

           <Link href="/contracts" data-tour="dashboard-contracts" className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-medium text-gray-900">Contratos</h2>
                <p className="text-gray-500 text-sm mt-1">Gerencie contratos e extraia dados via IA</p>
              </div>
            </div>
          </Link>

           <Link href="/clients" data-tour="dashboard-clients" className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-medium text-gray-900">Clientes</h2>
                <p className="text-gray-500 text-sm mt-1">Visualize todos os clientes cadastrados</p>
              </div>
            </div>
          </Link>
        </div>

        <DashboardCharts />
      </main>
    </div>
  );
}
