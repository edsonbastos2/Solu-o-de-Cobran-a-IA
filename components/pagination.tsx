import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  theme = 'dark'
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  theme?: 'light' | 'dark';
}) {
  const isDark = theme === 'dark';
  
  const containerClass = `flex items-center justify-between px-4 py-3 sm:px-6 border-t ${
    isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100'
  }`;
  
  const textClass = isDark ? 'text-slate-400' : 'text-gray-500';
  const textHighlightClass = isDark ? 'text-white' : 'text-gray-900';
  
  const btnClass = `relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 transition-colors ${
    isDark 
      ? 'text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10' 
      : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
  }`;

  const iconBtnClass = `relative inline-flex items-center px-2 py-2 text-sm font-medium disabled:opacity-50 transition-colors ${
    isDark 
      ? 'border-y border-white/10 bg-white/5 text-slate-300 hover:bg-white/10' 
      : 'border-y border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
  }`;

  const getPageNumbers = () => {
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const getPageBtnClass = (page: number) => {
    const isActive = page === currentPage;
    const baseClass = "relative inline-flex items-center px-4 py-2 text-sm font-medium border-y transition-colors";
    
    if (isDark) {
      return `${baseClass} ${isActive 
        ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 z-10' 
        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`;
    }
    
    return `${baseClass} ${isActive 
      ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 z-10' 
      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`;
  };

  return (
    <div className={containerClass}>
      <div className="flex justify-between flex-1 sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={btnClass}
        >
          Anterior
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`${btnClass} ml-3`}
        >
          Próxima
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className={`text-sm ${textClass}`}>
            Página <span className={`font-medium ${textHighlightClass}`}>{currentPage}</span> de <span className={`font-medium ${textHighlightClass}`}>{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`${iconBtnClass} border-l rounded-l-md`}
            >
              <span className="sr-only">Anterior</span>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            
            {getPageNumbers().map(page => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`${getPageBtnClass(page)} border-l`}
                aria-current={page === currentPage ? "page" : undefined}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`${iconBtnClass} border-l border-r rounded-r-md`}
            >
              <span className="sr-only">Próxima</span>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
