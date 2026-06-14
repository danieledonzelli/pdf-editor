import React from 'react';
import { SelectedPdfFile } from '../types';
import { formatBytes } from '../utils/pdfHelper';
import { Layers, Files, ShieldCheck, Cpu } from 'lucide-react';

interface WorkspaceStatsProps {
  files: SelectedPdfFile[];
}

export const WorkspaceStats: React.FC<WorkspaceStatsProps> = ({ files }) => {
  const totalFiles = files.length;
  
  const totalPagesSelected = React.useMemo(() => {
    return files.reduce((acc, file) => acc + file.selectedPages.length, 0);
  }, [files]);

  const totalOriginalPages = React.useMemo(() => {
    return files.reduce((acc, file) => acc + file.pageCount, 0);
  }, [files]);

  const totalInputSize = React.useMemo(() => {
    return files.reduce((acc, file) => acc + file.size, 0);
  }, [files]);

  // Estimate output size based on ratio of pages, plus a small constant overhead
  const estimatedOutputSize = React.useMemo(() => {
    if (totalOriginalPages === 0) return 0;
    const ratio = totalPagesSelected / totalOriginalPages;
    return Math.round(totalInputSize * ratio * 0.95); // general compression helper
  }, [files, totalPagesSelected, totalOriginalPages, totalInputSize]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
      <h3 className="text-sm font-bold text-slate-800 tracking-wider uppercase flex items-center gap-2">
        <Cpu className="w-4 h-4 text-indigo-600" />
        Stato Progetto
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Stat 1 */}
        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/60">
          <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider block mb-1">
            File Caricati
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800 font-mono">
              {totalFiles}
            </span>
            <Files className="w-3.5 h-3.5 text-indigo-600" />
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/60">
          <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider block mb-1">
            Pagine Totali
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800 font-mono">
              {totalPagesSelected}
            </span>
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* More Info */}
      <div className="space-y-3.5 pt-1">
        {totalFiles > 0 && (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-500">
              <span>Dimensione originale:</span>
              <span className="font-mono text-slate-700">{formatBytes(totalInputSize)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                Dimensione stimata:
                <span className="text-[9px] bg-slate-100 text-slate-505 px-1 py-0.2 rounded" title="La dimensione finale dipende dalla compressione">est.</span>
              </span>
              <span className="font-mono text-indigo-600 font-bold">{formatBytes(estimatedOutputSize)}</span>
            </div>
            
            <div className="h-px bg-slate-100 my-2" />
          </div>
        )}

        <div className="bg-slate-50 p-3 rounded-lg space-y-2 border border-slate-200/50">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-500 leading-relaxed">
              <span className="font-semibold text-slate-700 block mb-0.5">Esecuzione 100% Locale (Tauri Style)</span>
              I tuoi file non vengono caricati su alcun server. L'elaborazione del PDF avviene interamente all'interno dell'applicazione con algoritmi ad alta velocità.
            </div>
          </div>
        </div>
      </div>

      {/* Sequence list brief */}
      {totalFiles > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] text-slate-450 uppercase tracking-widest font-bold block">
            Schema di unione:
          </span>
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {files.map((file, idx) => (
              <div key={file.id} className="flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-1.5 rounded border border-slate-150">
                <span className="text-slate-600 truncate flex-1 pr-2">
                  #{idx + 1} {file.name}
                </span>
                <span className="text-indigo-700 shrink-0 font-mono text-[10px] bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                  {file.selectedPages.length} pag.
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
