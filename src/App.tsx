import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  FolderOpen, 
  FileUp, 
  Download, 
  Trash2, 
  Settings2, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  History, 
  Sparkles, 
  ExternalLink, 
  FileCode,
  Files,
  Cpu,
  Info,
  ChevronRight,
  BookOpen,
  ArrowUpDown,
  RefreshCw,
  Clock,
  LayoutGrid,
  PenTool
} from 'lucide-react';
import { SelectedPdfFile, MergeHistoryItem } from './types';
import { getPdfPageCount, mergePdfFiles, formatBytes, formatRangeString } from './utils/pdfHelper';
import { FileCard } from './components/FileCard';
import { WorkspaceStats } from './components/WorkspaceStats';
import { PdfEditor } from './components/PdfEditor';

export default function App() {
  const [files, setFiles] = useState<SelectedPdfFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [outputName, setOutputName] = useState('PDF_Unito_Fuso');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedBlobUrl, setMergedBlobUrl] = useState<string | null>(null);
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null);
  const [mergedSize, setMergedSize] = useState(0);
  const [history, setHistory] = useState<MergeHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'workspace' | 'editor' | 'history'>('workspace');
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showConfirmHistory, setShowConfirmHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage & configure global Drag and Drop preventions
  useEffect(() => {
    const saved = localStorage.getItem('pdf_fusioner_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Errore nel caricamento della cronologia:', e);
      }
    }

    // Global dragover & drop preventions prevent files from being loaded directly by browser tab (page loss)
    const preventGlobalDefault = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventGlobalDefault);
    window.addEventListener('drop', preventGlobalDefault);

    return () => {
      window.removeEventListener('dragover', preventGlobalDefault);
      window.removeEventListener('drop', preventGlobalDefault);
    };
  }, []);

  // Save history to localStorage
  const saveHistory = (newHistory: MergeHistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem('pdf_fusioner_history', JSON.stringify(newHistory));
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = (Array.from(e.dataTransfer.files) as File[]).filter((f: File) => f.type === 'application/pdf');
    if (droppedFiles.length === 0) {
      triggerError('Si prega di trascinare esclusivamente file PDF!');
      return;
    }
    
    await processUploadedFiles(droppedFiles);
  };

  const fileInputChanged = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files) as File[];
      await processUploadedFiles(selected);
    }
  };

  const processUploadedFiles = async (fileList: File[]) => {
    setImportLoading(true);
    setErrorMsg(null);
    const newFiles: SelectedPdfFile[] = [];
    
    for (const file of fileList) {
      try {
        const pageCount = await getPdfPageCount(file);
        const allPages = Array.from({ length: pageCount }, (_, i) => i + 1);
        
        newFiles.push({
          id: Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
          name: file.name,
          size: file.size,
          pageCount,
          selectedPages: allPages,
          file,
          rangeMode: 'all',
          customRangeStr: `1-${pageCount}`
        });
      } catch (err: any) {
        triggerError(`Errore nel caricamento del file "${file.name}": ` + err.message);
      }
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
    }
    setImportLoading(false);
  };

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => {
      setErrorMsg(null);
    }, 6000);
  };

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg(null);
    }, 6000);
  };

  // Reorder operations
  const moveUp = (index: number) => {
    if (index === 0) return;
    setFiles(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index - 1];
      copy[index - 1] = temp;
      return copy;
    });
  };

  const moveDown = (index: number) => {
    if (index === files.length - 1) return;
    setFiles(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index + 1];
      copy[index + 1] = temp;
      return copy;
    });
  };

   const deleteFile = (index: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== index));
    // Clean up temporary blob if files change
    if (mergedBlobUrl) {
      URL.revokeObjectURL(mergedBlobUrl);
      setMergedBlobUrl(null);
      setMergedBlob(null);
    }
  };

  const duplicateFile = (index: number) => {
    const orig = files[index];
    const duplicated: SelectedPdfFile = {
      ...orig,
      id: Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
      name: `${orig.name.replace('.pdf', '')} (Copia).pdf`
    };
    
    setFiles(prev => {
      const copy = [...prev];
      copy.splice(index + 1, 0, duplicated);
      return copy;
    });
  };

  const updateFileItem = (index: number, updated: SelectedPdfFile) => {
    setFiles(prev => {
      const copy = [...prev];
      copy[index] = updated;
      return copy;
    });
    // Reset output url because parameters changed
    if (mergedBlobUrl) {
      URL.revokeObjectURL(mergedBlobUrl);
      setMergedBlobUrl(null);
      setMergedBlob(null);
    }
  };

  const sortInvertOrder = () => {
    setFiles(prev => [...prev].reverse());
  };

  const clearAllFiles = () => {
    setFiles([]);
    if (mergedBlobUrl) {
      URL.revokeObjectURL(mergedBlobUrl);
      setMergedBlobUrl(null);
      setMergedBlob(null);
    }
    setShowConfirmClear(false);
  };

  // Helper to save PDF with native OS Save File Picker, or graceful fallback
  const savePdfFile = async (blob: Blob, defaultName: string) => {
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultName,
          types: [{
            description: 'Documento PDF (*.pdf)',
            accept: {
              'application/pdf': ['.pdf'],
            },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('Salvataggio PDF annullato dall\'utente');
          return;
        }
        console.warn('Errore usando showSaveFilePicker, uso scaricamento classico:', err);
      }
    }

    // Classic fallback
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = defaultName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Perform Merge
  const executeMerge = async () => {
    if (files.length === 0) {
      triggerError("Carica almeno un file PDF per avviare l'unione!");
      return;
    }

    const totalPagesSelected = files.reduce((acc, f) => acc + f.selectedPages.length, 0);
    if (totalPagesSelected === 0) {
      triggerError("Nessuna pagina selezionata! Scegli almeno una pagina da includere.");
      return;
    }

    setIsMerging(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Short timeout to let the UI update its loading state
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const resultBytes = await mergePdfFiles(files);
      const blob = new Blob([resultBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      setMergedBlob(blob);
      setMergedBlobUrl(url);
      setMergedSize(resultBytes.length);
      
      // Save in history
      const now = new Date();
      const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const absoluteFileName = outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`;
      const newItem: MergeHistoryItem = {
        id: Math.random().toString(36).substring(2, 9) + Date.now(),
        timestamp: formattedDate,
        fileName: absoluteFileName,
        filesMerged: files.length,
        totalPages: totalPagesSelected,
        fileSize: resultBytes.length
      };

      saveHistory([newItem, ...history.slice(0, 19)]); // Keep last 20 items
      triggerSuccess(`Unione completata con successo! ${totalPagesSelected} pagine aggregate.`);
    } catch (err: any) {
      triggerError(err.message || "Impossibile unire i file PDF scelti.");
    } finally {
      setIsMerging(false);
    }
  };

  const triggerDownload = async () => {
    if (!mergedBlob) return;
    const absoluteFileName = outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`;
    await savePdfFile(mergedBlob, absoluteFileName);
  };

  const handleSaveEditedPdf = async (fileName: string, bytes: Uint8Array) => {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    await savePdfFile(blob, fileName);

    // Save history item
    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const newItem: MergeHistoryItem = {
      id: 'edited_' + Math.random().toString(36).substring(2, 9) + Date.now(),
      timestamp: formattedDate,
      fileName: fileName,
      filesMerged: 1,
      totalPages: 1, // simplified representation
      fileSize: bytes.length
    };

    saveHistory([newItem, ...history.slice(0, 19)]);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col lg:flex-row selection:bg-indigo-500 selection:text-white antialiased overflow-x-hidden font-semibold-xs">
      
      {/* LEFT SIDEBAR - macOS Desktop style */}
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col shrink-0">
        
        {/* Brand & macOS Window Controls */}
        <div className="p-6 flex flex-col gap-4 border-b border-slate-100">
          {/* Traffic Lights Simulator */}
          <div className="flex items-center gap-1.5 px-0.5">
            <span className="w-3 h-3 rounded-full bg-red-400 border border-red-500/10 cursor-pointer hover:bg-red-500 transition-colors" title="Chiudi" />
            <span className="w-3 h-3 rounded-full bg-amber-400 border border-amber-500/10 cursor-pointer hover:bg-amber-500 transition-colors" title="Minimizza" />
            <span className="w-3 h-3 rounded-full bg-emerald-400 border border-emerald-500/10 cursor-pointer hover:bg-emerald-500 transition-colors" title="Includi" />
          </div>

          {/* Logo brand details */}
          <div className="flex items-center gap-2.5 mt-1">
            <img 
              src="/pdf-editor-icon.png" 
              alt="PDF Editor Icon" 
              className="w-8 h-8 rounded-lg shadow-md object-cover border border-slate-200/50"
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-base font-bold text-slate-850 tracking-tight leading-none flex items-center gap-1.5">
                PDF Editor
              </h1>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wider font-mono">
                UTILITY PROFESSIONALI
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 p-4 space-y-1.5">
          <button
            onClick={() => { setActiveTab('workspace'); setShowMenu(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left text-sm cursor-pointer ${
              activeTab === 'workspace' 
                ? 'bg-indigo-50 text-indigo-600 font-semibold shadow-xs border-r-4 border-indigo-600' 
                : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-4 h-4" />
            Unisci PDF
          </button>

          <button
            onClick={() => { setActiveTab('editor'); setShowMenu(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left text-sm cursor-pointer ${
              activeTab === 'editor' 
                ? 'bg-indigo-50 text-indigo-600 font-semibold shadow-xs border-r-4 border-indigo-600' 
                : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <PenTool className="w-4 h-4" />
            Editor PDF
          </button>

          <button
            onClick={() => { setActiveTab('history'); setShowMenu(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left text-sm cursor-pointer ${
              activeTab === 'history' 
                ? 'bg-indigo-50 text-indigo-600 font-semibold shadow-xs border-r-4 border-indigo-600' 
                : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <History className="w-4 h-4" />
            Cronologia ({history.length})
          </button>
        </div>
      </aside>

      {/* PRIMARY CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Content Topbar panel */}
        <header className="bg-white border-b border-slate-200 px-6 sm:px-8 py-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-10 shadow-xs">
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight leading-snug">
              {activeTab === 'workspace' && "Unisci i files PDF in uno solo"}
              {activeTab === 'editor' && "Editor & Marcatore Tecnico PDF"}
              {activeTab === 'history' && "Storico Operazioni"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === 'workspace' && "Trascina, ordina, seleziona intervalli di pagine e unisci."}
              {activeTab === 'editor' && "Aggiungi note, frecce direzionali e pallinature a goccia per design tecnico."}
              {activeTab === 'history' && "Guarda o ripulisci le sessioni precedenti eseguite localmente."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'workspace' && files.length > 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-indigo-150"
              >
                <Plus className="w-3.5 h-3.5" />
                Aggrega PDF
              </button>
            )}

            <div className="flex items-center gap-1.5 text-xs text-indigo-650 font-mono bg-indigo-50/50 px-3 py-1.5 rounded-lg border border-indigo-150/60 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
              <span>Offline Local SDK</span>
            </div>
          </div>
        </header>

        {/* Inner Content Scroller */}
        <div className="flex-1 p-6 sm:p-8 space-y-6">

        {/* Global Notifications and Alerts */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3.5 shadow-sm animate-fade-in max-w-4xl">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-bold text-rose-850 block mb-0.5">Si è verificato un errore</span>
              <p className="text-rose-700">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-4 shadow-sm animate-fade-in max-w-4xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-550 shrink-0 mt-0.5 animate-pulse" />
            <div className="text-sm flex-1">
              <span className="font-bold text-emerald-855 block mb-0.5">Operazione Completata</span>
              <p className="text-emerald-700">{successMsg}</p>
              {mergedBlobUrl && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={triggerDownload}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                    Salva Ora ({formatBytes(mergedSize)})
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading Spinner for imports */}
        {importLoading && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-center gap-3 shadow-xs max-w-4xl">
            <RefreshCw className="w-4 h-4 text-indigo-650 animate-spin" />
            <span className="text-sm text-slate-500 font-medium font-semibold-xs">Analisi strutturale e caricamento dei file PDF in corso...</span>
          </div>
        )}

        {/* Main Tab Views Switcher */}
        <main className="flex-1">
          {activeTab === 'workspace' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* PRIMARY COLUMN: sequencer (Col Span 8) */}
              <div className="lg:col-span-8 space-y-6">
                                {/* Drag and Drop Zone Input Area */}
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`bg-white hover:bg-slate-50/50 border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center flex flex-col items-center justify-center group transition-all duration-305 cursor-pointer shadow-xs min-h-[190px] ${
                    isDragging ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-250 hover:border-indigo-300'
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={fileInputChanged}
                    multiple
                    accept=".pdf"
                    className="hidden" 
                  />
                  
                  <div className="pointer-events-none flex flex-col items-center justify-center">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full group-hover:scale-105 transition-all outline outline-1 outline-indigo-100 shadow-sm mb-4">
                      <FolderOpen className="w-7 h-7" />
                    </div>
                    
                    <h3 className="text-slate-800 font-bold text-base sm:text-lg mb-1 tracking-tight">
                      Trascina qui i tuoi PDF o <span className="text-indigo-650 hover:underline">Sfoglia</span>
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                      Carica file multipli PDF. Potrai estrarre solo intervalli di pagine specifici, riordinarli tramite drag, duplicarli e unirli istantaneamente.
                    </p>
                  </div>
                </div>

                {/* Main list of Sequencer PDFs */}
                <div className="space-y-4">
                  
                  {/* List Header Actions tools */}
                  {files.length > 0 ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Files className="w-4 h-4 text-indigo-600" />
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          Sequenza di Unione ({files.length} {files.length === 1 ? 'file' : 'file'})
                        </h2>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <button
                          onClick={sortInvertOrder}
                          className="px-3 py-1.5 bg-white hover:bg-slate-55 text-slate-650 rounded-lg shadow-xs transition-colors border border-slate-200 flex items-center gap-1.5 cursor-pointer"
                          title="Inverte l'ordine dei file"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
                          Inverti Ordine
                        </button>

                        {showConfirmClear ? (
                          <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-2 py-1 rounded-lg animate-fade-in">
                            <span className="text-red-700 font-bold text-[10px] uppercase">Sei sicuro?</span>
                            <button
                              onClick={clearAllFiles}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded-md transition-colors cursor-pointer"
                            >
                              Sì, svuota
                            </button>
                            <button
                              onClick={() => setShowConfirmClear(false)}
                              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 text-[10px] rounded-md transition-colors cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowConfirmClear(true)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-650 rounded-lg shadow-xs transition-colors border border-red-205 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Svuota Progetto
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Render sequencer cards */}
                  {files.length > 0 ? (
                    <div className="space-y-4">
                      {files.map((file, idx) => (
                        <FileCard
                          key={file.id}
                          item={file}
                          position={idx}
                          totalItems={files.length}
                          onMoveUp={() => moveUp(idx)}
                          onMoveDown={() => moveDown(idx)}
                          onDelete={() => deleteFile(idx)}
                          onDuplicate={() => duplicateFile(idx)}
                          onUpdate={(updated) => updateFileItem(idx, updated)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="border border-slate-200 bg-white rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs">
                      <div className="relative w-12 h-12 flex items-center justify-center text-slate-400 mb-4 bg-slate-50 rounded-xl border border-slate-100">
                        <Info className="w-6 h-6 text-slate-400" />
                      </div>
                      <h4 className="text-slate-700 font-bold mb-1">Nessun file importato</h4>
                      <p className="text-xs text-slate-404 max-w-sm leading-relaxed">
                        Inizia trascinando file all'interno del box superiore oppure facendo clic per sfogliare i documenti dal tuo browser.
                      </p>
                    </div>
                  )}
                </div>

              </div>

              {/* SECONDARY SIDEBAR: Settings & Stats (Col Span 4) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Statistics panel */}
                <WorkspaceStats files={files} />
                
                {/* Settings Block */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 tracking-wider uppercase flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-indigo-600" />
                    Impostazioni Output
                  </h3>

                    <div className="space-y-1.5 font-semibold-xs">
                      <label htmlFor="output-name" className="text-xs font-semibold text-slate-600">
                        Nome File Generato:
                      </label>
                      <div className="relative">
                        <input
                          id="output-name"
                          type="text"
                          value={outputName}
                          onChange={(e) => {
                            setOutputName(e.target.value);
                            if (mergedBlobUrl) {
                              URL.revokeObjectURL(mergedBlobUrl);
                              setMergedBlobUrl(null);
                            }
                          }}
                          className="w-full bg-slate-50 px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder-slate-450 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-semibold-xs"
                          placeholder="PDF_Unito"
                        />
                        <span className="absolute right-3.5 top-3.5 text-xs text-slate-400 font-mono">
                          .pdf
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-widest">
                        Suggerimenti Rapidi
                      </span>
                      <ul className="text-[11px] text-slate-505 space-y-1.5 list-disc pl-3.5 leading-relaxed font-semibold-xs">
                        <li>Trascina i file verticalmente per pianificare la sequenza.</li>
                        <li>Duplica un file per includerne pagine distinte a intervalli diversi.</li>
                        <li>Il file generato viene elaborato interamente nel browser.</li>
                      </ul>
                    </div>
                  </div>
                {/* Primary CTA Merge Trigger */}
                <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col gap-3 shadow-xs">
                  {mergedBlobUrl ? (
                    <button
                      onClick={triggerDownload}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 rounded-xl block transition-all text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow-md cursor-pointer transform hover:-translate-y-0.5"
                    >
                      <Download className="w-4 h-4 stroke-[2.5]" />
                      Salva PDF Fuso
                    </button>
                  ) : (
                    <button
                      onClick={executeMerge}
                      disabled={files.length === 0 || isMerging}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white disabled:opacity-50 font-semibold py-3.5 rounded-xl block transition-all text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow-md cursor-pointer transform hover:-translate-y-0.5 disabled:hover:translate-y-0"
                    >
                      {isMerging ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          Fusione in Corso...
                        </>
                      ) : (
                        <>
                          <Layers className="w-4 h-4 text-white stroke-[2.2]" />
                          Unisci PDF Ora
                        </>
                      )}
                    </button>
                  )}

                  {mergedBlobUrl && (
                    <button
                      onClick={() => {
                        URL.revokeObjectURL(mergedBlobUrl);
                        setMergedBlobUrl(null);
                      }}
                      className="text-center text-[11px] text-slate-455 hover:text-indigo-600 transition-colors underline cursor-pointer"
                    >
                      Resetta Output / Ricomincia
                    </button>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB: PDF EDITOR SCREEN with drop-marker technical circles */}
          <div className={activeTab === 'editor' ? 'block' : 'hidden'}>
            <PdfEditor
              availableFiles={files}
              onSaveEditedFile={handleSaveEditedPdf}
              onTriggerNotification={(type, msg) => {
                if (type === 'success') {
                  triggerSuccess(msg);
                } else {
                  triggerError(msg);
                }
              }}
            />
          </div>

          {/* TAB 3: Merge Execution History Log */}
          {activeTab === 'history' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-5 shadow-xs animate-fade-in">
              
              <div className="flex items-center justify-between border-b border-slate-105 pb-4">
                <div className="flex items-center gap-2.5">
                  <History className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-base font-bold text-slate-800">
                    Storico Operazioni Recenti ({history.length})
                  </h2>
                </div>
                {history.length > 0 && (
                  showConfirmHistory ? (
                    <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-2 py-1 rounded-lg animate-fade-in text-[11px]">
                      <span className="text-red-700 font-bold uppercase">Svuotare tutta la cronologia?</span>
                      <button
                        onClick={() => {
                          saveHistory([]);
                          setShowConfirmHistory(false);
                        }}
                        className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md transition-colors cursor-pointer"
                      >
                        Sì
                      </button>
                      <button
                        onClick={() => setShowConfirmHistory(false)}
                        className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded-md transition-colors cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowConfirmHistory(true)}
                      className="text-xs text-red-650 hover:text-red-700 font-semibold underline cursor-pointer"
                    >
                      Cancella tutta la cronologia
                    </button>
                  )
                )}
              </div>

              {history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-400 tracking-wider">
                        <th className="py-3 px-4 font-bold">Ora / Data</th>
                        <th className="py-3 px-4 font-bold">Nome File Generato</th>
                        <th className="py-3 px-4 text-center font-bold">N° File Uniti</th>
                        <th className="py-3 px-4 text-center font-bold">Pagine Totali</th>
                        <th className="py-3 px-4 text-right font-bold">Peso Finale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 group transition-colors">
                          <td className="py-3.5 px-4 font-mono text-slate-455 flex items-center gap-1.5 leading-none">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {item.timestamp}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800 group-hover:text-indigo-650 transition-colors">
                            {item.fileName}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-slate-500">
                            {item.filesMerged}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono">
                            <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-650 border border-indigo-100 rounded-full font-bold text-[10px]">
                              {item.totalPages} pag.
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                            {formatBytes(item.fileSize)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 border border-slate-150 rounded-xl space-y-2 shadow-xs">
                  <History className="w-8 h-8 text-slate-350 mx-auto" />
                  <p className="text-slate-600 text-sm font-bold">Ancora nessun file unito.</p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">I file che unisci in questa sessione verranno elencati qui per tua comodità.</p>
                </div>
              )}

            </div>
          )}

        </main>

        {/* Footer info bar mimicking desktop layout status indicators */}
        <footer className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500 shadow-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span>Sviluppato in conformità con gli standard <strong className="text-slate-700">HTML5 File System API</strong></span>
            <span className="text-slate-200">|</span>
            <span className="text-slate-400">Developed by <strong className="text-slate-600 font-semibold">Daniele Donzelli</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
            <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
            <span>Sistema Pronto all'Uso</span>
          </div>
        </footer>

      </div>
    </div>
  </div>
  );
}
