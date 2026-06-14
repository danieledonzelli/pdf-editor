import React, { useState, useEffect } from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Copy, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  Settings2,
  AlertCircle
} from 'lucide-react';
import { SelectedPdfFile } from '../types';
import { formatBytes, parseRangeString, formatRangeString } from '../utils/pdfHelper';
import { PageGrid } from './PageGrid';

interface FileCardProps {
  item: SelectedPdfFile;
  position: number;
  totalItems: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (updated: SelectedPdfFile) => void;
}

export const FileCard: React.FC<FileCardProps> = ({
  item,
  position,
  totalItems,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDuplicate,
  onUpdate,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputRange, setInputRange] = useState(item.customRangeStr);
  const [isValidRange, setIsValidRange] = useState(true);

  // Sync state if customRangeStr changes externally
  useEffect(() => {
    setInputRange(item.customRangeStr);
  }, [item.customRangeStr]);

  const handleModeChange = (mode: 'all' | 'custom') => {
    if (mode === 'all') {
      const allPages = Array.from({ length: item.pageCount }, (_, i) => i + 1);
      onUpdate({
        ...item,
        rangeMode: 'all',
        selectedPages: allPages,
      });
    } else {
      // Parse current string
      const parsed = parseRangeString(inputRange, item.pageCount);
      onUpdate({
        ...item,
        rangeMode: 'custom',
        selectedPages: parsed,
      });
    }
  };

  const handleRangeTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputRange(value);
    
    // Simple regex or check for valid formats: numbers, commas, dashes, whitespace
    const cleanValue = value.replace(/\s+/g, '');
    const isValidFormat = /^[0-9,-]*$/.test(cleanValue);
    
    const parsed = parseRangeString(value, item.pageCount);
    
    // Is valid if format matches and (if it has input) has parsed at least one page
    const finalValid = isValidFormat && (value.trim() === '' || parsed.length > 0);
    setIsValidRange(finalValid);

    onUpdate({
      ...item,
      customRangeStr: value,
      selectedPages: parsed,
    });
  };

  const handlePageToggle = (pageNumber: number) => {
    let updatedPages = [...item.selectedPages];
    if (updatedPages.includes(pageNumber)) {
      updatedPages = updatedPages.filter(p => p !== pageNumber);
    } else {
      updatedPages.push(pageNumber);
    }
    
    const sortedPages = updatedPages.sort((a, b) => a - b);
    const newRangeStr = formatRangeString(sortedPages);
    
    onUpdate({
      ...item,
      selectedPages: sortedPages,
      rangeMode: 'custom', // Auto switch to custom range if manually toggled
      customRangeStr: newRangeStr,
    });
    setInputRange(newRangeStr);
  };

  const selectAllPages = () => {
    const allPages = Array.from({ length: item.pageCount }, (_, i) => i + 1);
    onUpdate({
      ...item,
      selectedPages: allPages,
      rangeMode: 'all',
      customRangeStr: formatRangeString(allPages),
    });
    setInputRange(formatRangeString(allPages));
  };

  const clearAllPages = () => {
    onUpdate({
      ...item,
      selectedPages: [],
      rangeMode: 'custom',
      customRangeStr: '',
    });
    setInputRange('');
  };

  const selectOddPages = () => {
    const oddPages: number[] = [];
    for (let i = 1; i <= item.pageCount; i += 2) {
      oddPages.push(i);
    }
    onUpdate({
      ...item,
      selectedPages: oddPages,
      rangeMode: 'custom',
      customRangeStr: formatRangeString(oddPages),
    });
    setInputRange(formatRangeString(oddPages));
  };

  const selectEvenPages = () => {
    const evenPages: number[] = [];
    for (let i = 2; i <= item.pageCount; i += 2) {
      evenPages.push(i);
    }
    onUpdate({
      ...item,
      selectedPages: evenPages,
      rangeMode: 'custom',
      customRangeStr: formatRangeString(evenPages),
    });
    setInputRange(formatRangeString(evenPages));
  };

  return (
    <div id={`file-card-${item.id}`} className="bg-white hover:border-indigo-300/80 border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300">
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Order and File details */}
        <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
          
          {/* Pos marker */}
          <div className="flex flex-col items-center justify-center h-10 w-10 shrink-0 bg-slate-50 rounded-lg text-xs font-mono font-bold text-indigo-650 border border-slate-200">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest leading-none mb-0.5">Pos</span>
            <span className="leading-none text-sm text-indigo-600">#{position + 1}</span>
          </div>

          <div className="p-2.5 bg-rose-50 text-rose-500 rounded-lg shrink-0">
            <FileText className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-slate-800 font-semibold truncate text-sm sm:text-base leading-snug" title={item.name}>
              {item.name}
            </h3>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 mt-1">
              <span>{formatBytes(item.size)}</span>
              <span className="text-slate-300">•</span>
              <span>{item.pageCount} {item.pageCount === 1 ? 'pagina' : 'pagine'}</span>
              
              {/* Highlight how many pages are included. */}
              {item.selectedPages.length < item.pageCount ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-mono text-[10px]">
                    Incluse: {item.selectedPages.length}/{item.pageCount} pag.
                  </span>
                </>
              ) : (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full font-mono text-[10px]">
                    Prese Tutte
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Configurations selector */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          
          {/* Quick Settings: All vs Custom */}
          <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex items-center gap-1">
            <button
              onClick={() => handleModeChange('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                item.rangeMode === 'all'
                  ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/55'
              }`}
            >
              Tutte
            </button>
            <button
              onClick={() => handleModeChange('custom')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                item.rangeMode === 'custom'
                  ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/55'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Intervallo
            </button>
          </div>

          {/* Quick Order controls & action panel */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              <button
                onClick={onMoveUp}
                disabled={position === 0}
                className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-30 disabled:hover:bg-white text-slate-600 rounded-md shadow-xs transition-colors cursor-pointer"
                title="Sposta Su"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                onClick={onMoveDown}
                disabled={position === totalItems - 1}
                className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-30 disabled:hover:bg-white text-slate-600 rounded-md shadow-xs transition-colors cursor-pointer"
                title="Sposta Giù"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>
            
            <div className="h-6 w-px bg-slate-200" />

            <button
              onClick={onDuplicate}
              className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-indigo-600 rounded-md shadow-xs transition-all cursor-pointer"
              title="Duplica file (per riutilizzarlo)"
            >
              <Copy className="w-4 h-4" />
            </button>
            
            <button
              onClick={onDelete}
              className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 rounded-md shadow-xs transition-all cursor-pointer"
              title="Rimuovi file"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded controls or custom range input */}
      <div className="px-4 sm:px-5 pb-4 border-t border-slate-100 bg-slate-50/50">
        <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex-1">
            {item.rangeMode === 'custom' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Intervallo pagine da unire:
                  </label>
                  {!isValidRange && (
                    <span className="text-[10px] text-amber-600 flex items-center gap-1 font-semibold">
                      <AlertCircle className="w-3 h-3" /> Formato non valido
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={inputRange}
                    onChange={handleRangeTextChange}
                    placeholder="Es: 1-3, 5, 8 (pagine totali: 1-)"
                    className={`w-full bg-white px-3.5 py-2 rounded-lg border text-sm text-slate-800 placeholder-slate-400 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/50 ${
                      isValidRange ? 'border-slate-250' : 'border-amber-400 bg-amber-50/40 text-slate-800'
                    }`}
                  />
                  <div className="absolute right-3 top-2.5 text-[10px] font-mono text-slate-400">
                    pagine: 1-{item.pageCount}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Supporta singoli numeri e intervalli separati da virgole. Ad esempio: <code className="text-slate-650 bg-slate-100 px-1 py-0.5 rounded">1-3, 5, 7</code> prenderà le pagine 1, 2, 3, 5 e 7.
                </p>
              </div>
            ) : (
              <div className="text-xs text-slate-600 flex items-center gap-2 py-1">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                Vengono incluse tutte le <strong className="text-slate-800">{item.pageCount}</strong> pagine di questo file nell'ordine originale.
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-end">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200 shadow-xs cursor-pointer w-full md:w-auto justify-center"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              {isExpanded ? (
                <>
                  Nascondi griglia pagine
                  <ChevronUp className="w-3.5 h-3.5 ms-1" />
                </>
              ) : (
                <>
                  Modifica pagine visivamente
                  <ChevronDown className="w-3.5 h-3.5 ms-1" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Visual workspace page selection expanded */}
        {isExpanded && (
          <PageGrid
            pageCount={item.pageCount}
            selectedPages={item.selectedPages}
            onPageToggle={handlePageToggle}
            onSelectAll={selectAllPages}
            onClearAll={clearAllPages}
            onSelectOdd={selectOddPages}
            onSelectEven={selectEvenPages}
          />
        )}
      </div>
    </div>
  );
};
