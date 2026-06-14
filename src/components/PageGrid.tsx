import React from 'react';
import { Check, ClipboardList, RefreshCw, Layers } from 'lucide-react';

interface PageGridProps {
  pageCount: number;
  selectedPages: number[];
  onPageToggle: (pageNumber: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onSelectOdd: () => void;
  onSelectEven: () => void;
}

export const PageGrid: React.FC<PageGridProps> = ({
  pageCount,
  selectedPages,
  onPageToggle,
  onSelectAll,
  onClearAll,
  onSelectOdd,
  onSelectEven,
}) => {
  const selectedSet = React.useMemo(() => new Set(selectedPages), [selectedPages]);

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 mt-3 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-650" />
          <h4 className="text-sm font-medium text-slate-700">
            Pagine Selezionate: <span className="text-indigo-600 font-bold">{selectedPages.length}</span> di <span className="text-slate-500">{pageCount}</span>
          </h4>
        </div>
        
        {/* Quick action buttons */}
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={onSelectAll}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-md transition-colors border border-slate-200 shadow-xs cursor-pointer"
            title="Seleziona tutte le pagine"
          >
            Tutte
          </button>
          <button
            onClick={onSelectOdd}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-md transition-colors border border-slate-200 shadow-xs cursor-pointer"
            title="Seleziona solo le pagine dispari"
          >
            Dispari
          </button>
          <button
            onClick={onSelectEven}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-md transition-colors border border-slate-200 shadow-xs cursor-pointer"
            title="Seleziona solo le pagine pari"
          >
            Pari
          </button>
          <button
            onClick={onClearAll}
            className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-650 rounded-md transition-colors border border-red-200 cursor-pointer"
            title="Deseleziona tutte le pagine"
          >
            Svuota
          </button>
        </div>
      </div>

      {/* Grid containing abstract representation of each page */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 max-h-64 overflow-y-auto pr-1">
        {Array.from({ length: pageCount }).map((_, idx) => {
          const pageNumber = idx + 1;
          const isSelected = selectedSet.has(pageNumber);
          
          return (
            <button
              id={`page-btn-${pageNumber}`}
              key={pageNumber}
              onClick={() => onPageToggle(pageNumber)}
              className={`relative flex flex-col items-center justify-between p-2 rounded-lg border aspect-[3/4] group transition-all duration-200 focus:outline-none cursor-pointer ${
                isSelected
                  ? 'bg-indigo-50/70 border-indigo-500 shadow-sm shadow-indigo-100'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              {/* Check indicator circle */}
              <div 
                className={`absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-all ${
                  isSelected 
                    ? 'bg-indigo-600 border-indigo-500 scale-100' 
                    : 'bg-transparent border-slate-250 group-hover:border-slate-400 scale-90'
                }`}
              >
                {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
              </div>

              {/* Minimalist page graphical representation lines */}
              <div className="w-full flex flex-col gap-1 mt-3 px-1">
                <div className={`h-1 rounded-full w-4/5 ${isSelected ? 'bg-indigo-400/40' : 'bg-slate-200'}`} />
                <div className={`h-1 rounded-full w-full ${isSelected ? 'bg-indigo-400/30' : 'bg-slate-150'}`} />
                <div className={`h-1 rounded-full w-2/3 ${isSelected ? 'bg-indigo-400/30' : 'bg-slate-150'}`} />
              </div>

              {/* Page Number label */}
              <span className={`text-[11px] font-mono font-semibold transition-colors mt-2 ${
                isSelected ? 'text-indigo-600 font-bold' : 'text-slate-500 group-hover:text-slate-750'
              }`}>
                P. {pageNumber}
              </span>
            </button>
          );
        })}
      </div>
      
      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 px-1 bg-slate-100 py-2 rounded-md justify-center">
        <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
        <span>Fai clic su qualunque pagina per includerla o escluderla dall'unione finale.</span>
      </div>
    </div>
  );
};
