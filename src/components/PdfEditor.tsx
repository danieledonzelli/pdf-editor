import React, { useState, useEffect, useRef } from 'react';
import { 
  Type, 
  ArrowUpRight, 
  HelpCircle, 
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Download, 
  RefreshCw,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  MousePointer,
  RotateCw,
  Settings2,
  Upload,
  Plus
} from 'lucide-react';
import { PDFDocument, StandardFonts, rgb, radians, degrees } from 'pdf-lib';
import { SelectedPdfFile, EditorElement, TextEditorElement, ArrowEditorElement, BalloonEditorElement } from '../types';
import { formatBytes, getPdfPageCount } from '../utils/pdfHelper';
function hexToPdfColor(hex: string) {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

interface PdfEditorProps {
  availableFiles: SelectedPdfFile[];
  onSaveEditedFile: (fileName: string, arrayBuffer: Uint8Array) => void;
  onTriggerNotification: (type: 'success' | 'error', msg: string) => void;
}

interface DragState {
  elementId: string;
  dragType: 'move' | 'arrow-start' | 'arrow-end';
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  initialX2?: number;
  initialY2?: number;
}

export function PdfEditor({ availableFiles, onSaveEditedFile, onTriggerNotification }: PdfEditorProps) {
  const [editorFile, setEditorFile] = useState<SelectedPdfFile | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const editorFileInputRef = useRef<HTMLInputElement>(null);

  const [pdfjs, setPdfjs] = useState<any>(null);
  const [loadingPdf, setLoadingPdf] = useState<boolean>(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null); // pdfjs handleDoc
  const [pageCount, setPageCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.2);
  const [activeTool, setActiveTool] = useState<'select' | 'add-text' | 'add-arrow' | 'add-balloon'>('select');
  const [currentColor, setCurrentColor] = useState<string>('#ef4444'); // default red
  const [lastFontSize, setLastFontSize] = useState<number>(14);
  const [lastBalloonScale, setLastBalloonScale] = useState<number>(0.9);
  const [annotations, setAnnotations] = useState<EditorElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);

  // Dragging / drawing utilities
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [arrowPreview, setArrowPreview] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [isDrawingArrow, setIsDrawingArrow] = useState<boolean>(false);
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null);

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Original page sizes (needed for coordinate transformation)
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 595, height: 842 });

  // Drag & drop file handlers specifically for the editor
  const handleEditorDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleEditorDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleEditorDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const file = droppedFiles[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        await processEditorFile(file);
      } else {
        onTriggerNotification('error', "Formato non valido. Carica un file PDF.");
      }
    }
  };

  const handleEditorFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    if (filesList && filesList.length > 0) {
      await processEditorFile(filesList[0]);
    }
  };

  const processEditorFile = async (file: File) => {
    setLoadingPdf(true);
    try {
      const pCount = await getPdfPageCount(file);
      const allPages = Array.from({ length: pCount }, (_, i) => i + 1);
      
      const newEditorFile: SelectedPdfFile = {
        id: 'editor_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
        name: file.name,
        size: file.size,
        pageCount: pCount,
        selectedPages: allPages,
        file,
        rangeMode: 'all',
        customRangeStr: `1-${pCount}`
      };
      
      setEditorFile(newEditorFile);
      setAnnotations([]);
      setSelectedElementId(null);
      onTriggerNotification('success', `File "${file.name}" caricato correttamente nell'Editor separato!`);
    } catch (err: any) {
      console.error(err);
      onTriggerNotification('error', `Errore durante il caricamento del PDF: ${err.message}`);
    } finally {
      setLoadingPdf(false);
    }
  };

  // Load PDF.js CDN
  useEffect(() => {
    const loadLib = async () => {
      if ((window as any).pdfjsLib) {
        setPdfjs((window as any).pdfjsLib);
        return;
      }
      try {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
        script.async = true;
        document.body.appendChild(script);

        script.onload = () => {
          const l = (window as any).pdfjsLib;
          if (l) {
            l.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            setPdfjs(l);
          }
        };
      } catch (err) {
        console.error("Non è stato possibile caricare PDF.js:", err);
      }
    };
    loadLib();
  }, []);

  // Selected file loader (mapped to local editorFile)
  const selectedPdfFile = editorFile;

  useEffect(() => {
    if (!pdfjs || !selectedPdfFile) return;

    let isSubscribed = true;
    const loadPdfDocument = async () => {
      setLoadingPdf(true);
      try {
        const arrayBuffer = await selectedPdfFile.file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        if (isSubscribed) {
          setPdfDoc(doc);
          setPageCount(doc.numPages);
          setCurrentPage(1);
          setAnnotations([]);
          setSelectedElementId(null);
        }
      } catch (err: any) {
        console.error("Errore nel caricamento del file con PDF.js:", err);
        onTriggerNotification('error', "Impossibile analizzare visivamente il PDF. Verifica se è protetto.");
      } finally {
        if (isSubscribed) setLoadingPdf(false);
      }
    };

    loadPdfDocument();
    return () => {
      isSubscribed = false;
    };
  }, [pdfjs, selectedPdfFile]);

  // Render canvas page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let renderTask: any = null;
    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        setPageSize({
          width: viewport.width / zoom,
          height: viewport.height / zoom
        });

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        if (renderTask) {
          renderTask.cancel();
        }

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("Errore durante il rendering della pagina:", err);
        }
      }
    };

    renderPage();

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPage, zoom]);

  // Coords conversions
  const getRelativeCoords = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    return { x, y };
  };

  // SVG actions
  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'select') {
      // Clear selection if clicked background
      if (e.target === e.currentTarget) {
        setSelectedElementId(null);
      }
      return;
    }

    const { x, y } = getRelativeCoords(e);

    if (activeTool === 'add-text') {
      const newText: TextEditorElement = {
        id: 'text_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        pageNumber: currentPage,
        type: 'text',
        x,
        y: y + 4, // adjustment to center text baseline slightly
        color: currentColor,
        text: 'Testo Editabile',
        fontSize: lastFontSize
      };
      setAnnotations(prev => [...prev, newText]);
      setSelectedElementId(newText.id);
      setActiveTool('select');
    } else if (activeTool === 'add-balloon') {
      // Number counter for automatic technical balloons starting from 1
      const count = annotations.filter(a => a.type === 'balloon').length + 1;
      const newBalloon: BalloonEditorElement = {
        id: 'balloon_' + Math.random().toString(36).substring(2, 9) + Date.now(),
        pageNumber: currentPage,
        type: 'balloon',
        x,
        y,
        color: currentColor,
        number: count.toString(),
        angle: 225, // Point to the diagonal upper-left by default, keeping it extremely standard
        scale: lastBalloonScale
      };
      setAnnotations(prev => [...prev, newBalloon]);
      setSelectedElementId(newBalloon.id);
      setActiveTool('select');
    } else if (activeTool === 'add-arrow') {
      setIsDrawingArrow(true);
      setArrowStart({ x, y });
      setArrowPreview({ x1: x, y1: y, x2: x, y2: y });
    }
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const { x, y } = getRelativeCoords(e);

    // Draft Arrow Drawing
    if (isDrawingArrow && arrowStart) {
      setArrowPreview({
        x1: arrowStart.x,
        y1: arrowStart.y,
        x2: x,
        y2: y
      });
      return;
    }

    // Element Dragging
    if (dragState) {
      // Delta in original points
      const deltaX = (e.clientX - dragState.startX) / zoom;
      const deltaY = (e.clientY - dragState.startY) / zoom;

      setAnnotations(prev => prev.map(el => {
        if (el.id !== dragState.elementId) return el;

        if (dragState.dragType === 'move') {
          if (el.type === 'arrow') {
            const arrow = el as ArrowEditorElement;
            return {
              ...arrow,
              x: dragState.initialX + deltaX,
              y: dragState.initialY + deltaY,
              x2: (dragState.initialX2 || 0) + deltaX,
              y2: (dragState.initialY2 || 0) + deltaY
            };
          } else {
            return {
              ...el,
              x: dragState.initialX + deltaX,
              y: dragState.initialY + deltaY
            };
          }
        } else if (dragState.dragType === 'arrow-start') {
          const arrow = el as ArrowEditorElement;
          return {
            ...arrow,
            x: dragState.initialX + deltaX,
            y: dragState.initialY + deltaY
          };
        } else if (dragState.dragType === 'arrow-end') {
          const arrow = el as ArrowEditorElement;
          return {
            ...arrow,
            x2: (dragState.initialX2 || 0) + deltaX,
            y2: (dragState.initialY2 || 0) + deltaY
          };
        }
        return el;
      }));
    }
  };

  const handleSvgMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDrawingArrow && arrowStart && arrowPreview) {
      setIsDrawingArrow(false);
      const { x, y } = getRelativeCoords(e);
      const dist = Math.sqrt(Math.pow(x - arrowStart.x, 2) + Math.pow(y - arrowStart.y, 2));
      
      if (dist > 8) {
        const newArrow: ArrowEditorElement = {
          id: 'arrow_' + Math.random().toString(36).substring(2, 9) + Date.now(),
          pageNumber: currentPage,
          type: 'arrow',
          x: arrowStart.x,
          y: arrowStart.y,
          x2: x,
          y2: y,
          color: currentColor,
          width: 2.5
        };
        setAnnotations(prev => [...prev, newArrow]);
        setSelectedElementId(newArrow.id);
      }
      setArrowStart(null);
      setArrowPreview(null);
      setActiveTool('select');
    }

    if (dragState) {
      setDragState(null);
    }
  };

  const handleElementMouseDown = (e: React.MouseEvent, element: EditorElement, dragType: 'move' | 'arrow-start' | 'arrow-end') => {
    e.stopPropagation();
    setSelectedElementId(element.id);
    if (activeTool !== 'select') return;

    const arr = element as ArrowEditorElement;
    setDragState({
      elementId: element.id,
      dragType,
      startX: e.clientX,
      startY: e.clientY,
      initialX: element.x,
      initialY: element.y,
      initialX2: element.type === 'arrow' ? arr.x2 : undefined,
      initialY2: element.type === 'arrow' ? arr.y2 : undefined
    });
  };

  const updateSelectedElement = (updates: Partial<EditorElement>) => {
    if (!selectedElementId) return;
    setAnnotations(prev => prev.map(el => {
      if (el.id !== selectedElementId) return el;
      
      if ('fontSize' in updates && typeof updates.fontSize === 'number') {
        setLastFontSize(updates.fontSize);
      }
      if ('scale' in updates && typeof updates.scale === 'number') {
        setLastBalloonScale(updates.scale);
      }
      if ('color' in updates && typeof updates.color === 'string') {
        setCurrentColor(updates.color);
      }

      return { ...el, ...updates } as EditorElement;
    }));
  };

  const deleteSelectedElement = () => {
    if (!selectedElementId) return;
    setAnnotations(prev => prev.filter(el => el.id !== selectedElementId));
    setSelectedElementId(null);
  };

  const selectedElement = annotations.find(el => el.id === selectedElementId);

  // Flatten & produce PDF saving using pdf-lib
  const handleExportPdf = async () => {
    if (!selectedPdfFile) return;
    setExporting(true);
    try {
      const fileBytes = await selectedPdfFile.file.arrayBuffer();
      const pdfLibDoc = await PDFDocument.load(fileBytes);
      const fontBold = await pdfLibDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfLibDoc.embedFont(StandardFonts.Helvetica);

      const pages = pdfLibDoc.getPages();

      // Loop over annotations and draw them onto PDF
      for (const el of annotations) {
        const pIndex = el.pageNumber - 1;
        if (pIndex >= pages.length) continue;

        const page = pages[pIndex];
        const pageH = page.getHeight();
        const pdfColor = hexToPdfColor(el.color);

        if (el.type === 'text') {
          const txt = el as TextEditorElement;
          // Substract size because pdf points (0,0) starts at bottom-left
          page.drawText(txt.text, {
            x: txt.x,
            y: pageH - txt.y - txt.fontSize * 0.15, // micro offset adjustment
            size: txt.fontSize,
            font: fontRegular,
            color: pdfColor
          });
        } 
        else if (el.type === 'arrow') {
          const arrow = el as ArrowEditorElement;
          const y1_pdf = pageH - arrow.y;
          const y2_pdf = pageH - arrow.y2;
          
          const angle = Math.atan2(y2_pdf - y1_pdf, arrow.x2 - arrow.x);
          const dist = Math.hypot(arrow.x2 - arrow.x, y2_pdf - y1_pdf);
          const shaftEndShift = Math.min(10, dist * 0.5);

          const x2_line_pdf = arrow.x2 - shaftEndShift * Math.cos(angle);
          const y2_line_pdf = y2_pdf - shaftEndShift * Math.sin(angle);

          // Main line - ends inside the triangle arrowhead!
          page.drawLine({
            start: { x: arrow.x, y: y1_pdf },
            end: { x: x2_line_pdf, y: y2_line_pdf },
            thickness: arrow.width,
            color: pdfColor
          });

          // Draw filled triangle arrowhead pointing at endpoint x2, y2
          // Arrowhead SVG path pointing along the positive X-axis (0 rad) with tail at X = -14
          page.drawSvgPath('M 0 0 L -14 5.5 L -14 -5.5 Z', {
            x: arrow.x2,
            y: y2_pdf,
            rotate: radians(angle),
            color: pdfColor
          });
        } 
        else if (el.type === 'balloon') {
          const balloon = el as BalloonEditorElement;
          
          // Anchor position of the pointing tip
          const tx = balloon.x;
          const ty = pageH - balloon.y;
          
          // Teardrop path matching 1:1 the SVG structure shown in the editor:
          // Center of the balloon bubble is at (0, -40) relative to the tip (0,0) in SVG space.
          // In PDF space, drawSvgPath handles flipping and scaling, so we rotate by -balloon.angle.
          const teardropPath = "M 0 0 C -8 -15 -25 -22 -25 -41 A 25 25 0 1 1 25 -41 C 25 -22 8 -15 0 0 Z";

          if (balloon.outlineOnly) {
            page.drawSvgPath(teardropPath, {
              x: tx,
              y: ty,
              scale: balloon.scale,
              rotate: degrees(-balloon.angle),
              color: rgb(1, 1, 1), // White filling
              borderColor: pdfColor,
              borderWidth: 1.5
            });
          } else {
            page.drawSvgPath(teardropPath, {
              x: tx,
              y: ty,
              scale: balloon.scale,
              rotate: degrees(-balloon.angle),
              color: pdfColor
            });
          }

          // Compute precise center of the numeric label inside the rotated balloon
          const angle_rad = (-balloon.angle * Math.PI) / 180;
          const dy_offset = 41 * balloon.scale;
          const cx = tx - dy_offset * Math.sin(angle_rad);
          const cy = ty + dy_offset * Math.cos(angle_rad);

          // Centered number inside
          const fSize = Math.floor(13 * balloon.scale);
          const txtWidth = fontBold.widthOfTextAtSize(balloon.number, fSize);
          const txtHeight = fSize * 0.7; // Approx height aspect ratio for Helvetica

          page.drawText(balloon.number, {
            x: cx - txtWidth / 2,
            y: cy - txtHeight / 2,
            size: fSize,
            font: fontBold,
            color: balloon.outlineOnly ? pdfColor : rgb(1, 1, 1) // text matches outline color if outlined, white if filled
          });
        }
      }

      const finalBytes = await pdfLibDoc.save();
      const outputFilename = `Modified_${selectedPdfFile.name}`;
      
      onSaveEditedFile(outputFilename, finalBytes);
      onTriggerNotification('success', `PDF modificato salvato con successo!`);
    } catch (err: any) {
      console.error(err);
      onTriggerNotification('error', "Errore durante il salvataggio del file modificato.");
    } finally {
      setExporting(false);
    }
  };

  // Preset Colors
  const colors = [
    { value: '#ef4444', label: 'Rosso' },
    { value: '#4f46e5', label: 'Indaco' },
    { value: '#10b981', label: 'Smeraldo' },
    { value: '#f59e0b', label: 'Arancione' },
    { value: '#0f172a', label: 'Nero' },
    { value: '#ec4899', label: 'Rosa' }
  ];

  if (!editorFile) {
    return (
      <div className="space-y-6 animate-fade-in text-slate-750">
        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block">
          Editor Professionale PDF (Sezione Indipendente)
        </label>
        
        {/* Drag and Drop Zone for Editor */}
        <div
          onDragOver={handleEditorDragOver}
          onDragLeave={handleEditorDragLeave}
          onDrop={handleEditorDrop}
          onClick={() => editorFileInputRef.current?.click()}
          className={`border-3 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
            isDraggingFile 
              ? 'border-indigo-500 bg-indigo-50/50 scale-[0.995]' 
              : 'border-slate-200 hover:border-indigo-400 bg-white hover:shadow-md'
          }`}
        >
          <input
            ref={editorFileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleEditorFileChange}
            className="hidden"
          />
          
          <div className="pointer-events-none flex flex-col items-center justify-center gap-2">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-2">
              <Upload className="w-8 h-8" />
            </div>
            
            <div className="space-y-1">
              <p className="text-base font-bold text-slate-800">
                Trascina qui il PDF per l'Editor o <span className="text-indigo-600 underline">sfoglia i file</span>
              </p>
              <p className="text-xs text-slate-500 font-medium">
                Questo file verrà caricato esclusivamente in questa schermata per modifiche di testo, frecce e pallinature.
              </p>
            </div>
          </div>
        </div>
        
        {/* Help/Quick features box */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-150 space-y-4">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-slate-600" />
            Strumenti professionali inclusi nell'Editor:
          </h4>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600 font-semibold list-disc list-inside">
            <li>Aggiunta e posizionamento di testo libero editabile</li>
            <li>Frecce colorate orientabili per disegno tecnico</li>
            <li>Pallinature intelligenti fatte a goccia con punta direzionabile</li>
            <li>Modifica in tempo reale di numeri, rotazioni e scale</li>
            <li>Opzione outline o riempimento solido per pallinature</li>
            <li>Zoom dinamico del foglio per modifiche precise</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
      
      {/* 1. SELECTION & NOTIFICATION BOX */}
      <div className="lg:col-span-12 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
        <div className="space-y-1.5 flex-1">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            File PDF in modifica nell'Editor:
          </label>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-650 shrink-0">
              <FolderOpen className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 line-clamp-1">{editorFile.name}</p>
              <p className="text-xs text-slate-450 font-semibold">
                {editorFile.pageCount} pag. — {formatBytes(editorFile.size)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Change File button */}
          <button
            onClick={() => editorFileInputRef.current?.click()}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Carica un altro PDF
          </button>
          <input
            ref={editorFileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleEditorFileChange}
            className="hidden"
          />

          {/* Zoom Actions */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-1 py-1">
            <button
              onClick={() => setZoom(prev => Math.max(0.6, parseFloat((prev - 0.2).toFixed(1))))}
              className="p-1 px-2.5 hover:bg-white text-slate-600 rounded-lg transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold px-3 font-mono text-slate-700 min-w-14 text-center">
              {Math.floor(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(prev => Math.min(3.0, parseFloat((prev + 0.2).toFixed(1))))}
              className="p-1 px-2.5 hover:bg-white text-slate-600 rounded-lg transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleExportPdf}
            disabled={exporting || annotations.length === 0}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 disabled:hover:translate-y-0 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm transform hover:-translate-y-0.5"
          >
            {exporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                Elaborazione PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-white stroke-[2.2]" />
                Applica & Salva PDF Modificato
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. MAIN CANVAS AREA (Col Span 8) */}
      <div className="lg:col-span-8 space-y-4">
        
        {/* EDITING INTERACTIVE TOOLBAR */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTool('select')}
              className={`p-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === 'select' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
              title="Strumento Selezione (Sposta / Ridimensiona)"
            >
              <MousePointer className="w-4 h-4" />
              Seleziona
            </button>

            <button
              onClick={() => setActiveTool('add-text')}
              className={`p-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === 'add-text' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
              title="Aggiungi Testo"
            >
              <Type className="w-4 h-4" />
              Testo
            </button>

            <button
              onClick={() => setActiveTool('add-arrow')}
              className={`p-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === 'add-arrow' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
              title="Traccia Freccia"
            >
              <ArrowUpRight className="w-4 h-4 text-current" />
              Freccia
            </button>

            <button
              onClick={() => setActiveTool('add-balloon')}
              className={`p-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === 'add-balloon' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
              title="Aggiungi Pallinatura Disegno Tecnico"
            >
              <div className="relative w-4 h-4 shrink-0 flex items-center justify-center">
                {/* Teardrop custom droplet wire logo */}
                <span className="absolute inset-0 bg-current rounded-full" style={{ borderRadius: '50% 50% 0 50%', transform: 'rotate(45deg)' }} />
                <span className="text-[7px] text-white font-extrabold z-10 leading-none">#</span>
              </div>
              Pallinatura Goccia
            </button>
          </div>

          {/* Page Indicators left/right */}
          {pageCount > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-xs text-slate-600">
              <button
                disabled={currentPage <= 1}
                onClick={() => {
                  setCurrentPage(prev => Math.max(1, prev - 1));
                  setSelectedElementId(null);
                }}
                className="p-1 hover:bg-white rounded disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-bold min-w-16 text-center">
                Pag. {currentPage} / {pageCount}
              </span>
              <button
                disabled={currentPage >= pageCount}
                onClick={() => {
                  setCurrentPage(prev => Math.min(pageCount, prev + 1));
                  setSelectedElementId(null);
                }}
                className="p-1 hover:bg-white rounded disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* DRAWING BOARD CONTAINER */}
        <div 
          ref={scrollContainerRef}
          className="bg-slate-100 border border-slate-200 rounded-2xl overflow-auto flex justify-center p-6 sm:p-8 select-none max-h-[70vh] min-h-[460px] shadow-inner relative scrollbar"
        >
          {loadingPdf ? (
            <div className="absolute inset-x-0 top-1/3 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin" />
              <p className="text-sm text-slate-500 font-bold">Rendering grafico del documento in corso...</p>
            </div>
          ) : !editorFile ? (
            <div className="absolute inset-x-0 top-1/3 text-center p-6">
              <FolderOpen className="w-10 h-10 text-slate-350 mx-auto mb-3" />
              <h4 className="text-slate-700 font-bold mb-1">Nessun PDF selezionato per la modifica</h4>
              <p className="text-xs text-slate-400">Inserisci o seleziona un file PDF dall'alto per vederne l'anteprima.</p>
            </div>
          ) : (
            <div 
              className="relative shadow-xl border border-slate-300 mx-auto select-none"
              style={{
                width: pageSize.width * zoom,
                height: pageSize.height * zoom,
              }}
            >
              {/* Backing PDF-rendered Canvas */}
              <canvas 
                ref={canvasRef} 
                className="absolute inset-0 z-0 pointer-events-none" 
              />

              {/* Multi-layered SVG Interactive Overlay */}
              <svg
                className="absolute inset-0 z-10 w-full h-full cursor-crosshair overflow-visible touch-none"
                onMouseDown={handleSvgMouseDown}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={handleSvgMouseUp}
              >
                {/* 1. Rendering Existing Annotations */}
                {annotations
                  .filter(el => el.pageNumber === currentPage)
                  .map(el => {
                    if (el.type === 'text') {
                      const txt = el as TextEditorElement;
                      const isSelected = selectedElementId === el.id;
                      return (
                        <g 
                          key={el.id} 
                          className="cursor-move select-none"
                          transform={`translate(${el.x * zoom}, ${el.y * zoom})`}
                        >
                          {/* Sizing background border indicator for selections */}
                          <rect 
                            x={-4 * zoom} 
                            y={-(txt.fontSize * 1.0) * zoom} 
                            width={(txt.text.length * txt.fontSize * 0.6 + 8) * zoom} 
                            height={(txt.fontSize * 1.35) * zoom} 
                            fill="transparent" 
                            stroke={isSelected ? el.color : 'transparent'} 
                            strokeWidth={1.5} 
                            strokeDasharray="3 3"
                            onMouseDown={(e) => handleElementMouseDown(e, el, 'move')}
                          />
                          <text
                            fill={el.color}
                            fontSize={txt.fontSize * zoom}
                            onMouseDown={(e) => handleElementMouseDown(e, el, 'move')}
                            className="font-bold select-none leading-none font-sans"
                            dominantBaseline="alphabetic"
                          >
                            {txt.text}
                          </text>
                        </g>
                      );
                    } 
                    else if (el.type === 'arrow') {
                      const arrow = el as ArrowEditorElement;
                      const isSelected = selectedElementId === el.id;
                      const x1 = arrow.x * zoom;
                      const y1 = arrow.y * zoom;
                      const x2 = arrow.x2 * zoom;
                      const y2 = arrow.y2 * zoom;
                      
                      const angle = Math.atan2(y2 - y1, x2 - x1);
                      const dist = Math.hypot(x2 - x1, y2 - y1);
                      const arrowHeadLen = 14 * zoom;
                      const arrowAngle = Math.PI / 6;

                      // Shorten line shaft so it ends inside the triangle and doesn't blunt the tip
                      const shaftEndShift = Math.min(10 * zoom, dist * 0.5);
                      const x2_line = x2 - shaftEndShift * Math.cos(angle);
                      const y2_line = y2 - shaftEndShift * Math.sin(angle);

                      const point1x = x2 - arrowHeadLen * Math.cos(angle - arrowAngle);
                      const point1y = y2 - arrowHeadLen * Math.sin(angle - arrowAngle);
                      const point2x = x2 - arrowHeadLen * Math.cos(angle + arrowAngle);
                      const point2y = y2 - arrowHeadLen * Math.sin(angle + arrowAngle);

                      return (
                        <g key={el.id} className="cursor-move select-none">
                          {/* Outline invisible line for easier triggers */}
                          <line 
                            x1={x1} 
                            y1={y1} 
                            x2={x2} 
                            y2={y2} 
                            stroke="rgba(0,0,0,0.01)" 
                            strokeWidth={Math.max(12, arrow.width * 3) * zoom}
                            onMouseDown={(e) => handleElementMouseDown(e, el, 'move')}
                          />

                          {/* Render Arrow Shaft */}
                          <line
                            x1={x1}
                            y1={y1}
                            x2={x2_line}
                            y2={y2_line}
                            stroke={el.color}
                            strokeWidth={arrow.width * zoom}
                            strokeLinecap="round"
                            onMouseDown={(e) => handleElementMouseDown(e, el, 'move')}
                          />

                          {/* Render Triangle Point */}
                          <polygon
                            points={`${x2},${y2} ${point1x},${point1y} ${point2x},${point2y}`}
                            fill={el.color}
                            stroke={el.color}
                            strokeWidth={1}
                            strokeLinejoin="miter"
                            onMouseDown={(e) => handleElementMouseDown(e, el, 'move')}
                          />

                          {/* Handle resizing start/endpoints */}
                          {isSelected && (
                            <>
                              <circle
                                cx={x1}
                                cy={y1}
                                r={5 * zoom}
                                fill="#ffffff"
                                stroke={el.color}
                                strokeWidth={2}
                                className="cursor-pointer"
                                onMouseDown={(e) => handleElementMouseDown(e, el, 'arrow-start')}
                              />
                              <circle
                                cx={x2}
                                cy={y2}
                                r={5 * zoom}
                                fill="#ffffff"
                                stroke={el.color}
                                strokeWidth={2}
                                className="cursor-pointer"
                                onMouseDown={(e) => handleElementMouseDown(e, el, 'arrow-end')}
                              />
                            </>
                          )}
                        </g>
                      );
                    } 
                    else if (el.type === 'balloon') {
                      const balloon = el as BalloonEditorElement;
                      const isSelected = selectedElementId === el.id;
                      
                      // Render teardrop balloon scaled and rotated
                      return (
                        <g
                          key={el.id}
                          className="cursor-move select-none"
                          transform={`translate(${balloon.x * zoom}, ${balloon.y * zoom}) rotate(${balloon.angle}) scale(${balloon.scale * zoom})`}
                          onMouseDown={(e) => handleElementMouseDown(e, el, 'move')}
                        >
                          {/* Teardrop drop path pointing to (0,0) */}
                          <path 
                            d="M 0 0 C -8 -15 -25 -22 -25 -41 A 25 25 0 1 1 25 -41 C 25 -22 8 -15 0 0 Z" fill={balloon.outlineOnly ? '#FFFFFF' : el.color} stroke={balloon.outlineOnly ? el.color : (isSelected ? '#FFFFFF' : 'transparent')} strokeWidth={balloon.outlineOnly ? 2.5 : 1.8} strokeDasharray={(!balloon.outlineOnly && isSelected) ? '2.5 2.5' : 'none'} className="drop-shadow-md" /><path style={{ display: 'none' }} 
                            fill={el.color} 
                            stroke={isSelected ? '#FFFFFF' : 'transparent'} 
                            strokeWidth={1.8}
                            strokeDasharray={isSelected ? '2.5 2.5' : 'none'}
                            className="drop-shadow-md filter"
                          />

                          {/* Counter-rotated layout to keep the numeric label always vertical (upright) */}
                          <g transform={`translate(0, -41) rotate(${-balloon.angle})`}>
                            <text
                              x="0"
                              y="0"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill={balloon.outlineOnly ? el.color : '#FFFFFF'}
                              fontSize="13"
                              fontWeight="bold"
                              className="font-bold font-mono tracking-tight select-none pointer-events-none"
                            >
                              {balloon.number}
                            </text>
                          </g>

                          {/* Selected circle anchor guide ring */}
                          {isSelected && (
                            <circle 
                              cx="0" 
                              cy="-41" 
                              r={28} 
                              fill="none" 
                              stroke="#6366f1" 
                              strokeWidth={1.5} 
                              strokeDasharray="4 4"
                              className="pointer-events-none"
                            />
                          )}
                        </g>
                      );
                    }
                    return null;
                  })}

                {/* 2. Arrow Creation Preview Guide */}
                {isDrawingArrow && arrowPreview && (
                  <g className="pointer-events-none opacity-70">
                    <line
                      x1={arrowPreview.x1 * zoom}
                      y1={arrowPreview.y1 * zoom}
                      x2={arrowPreview.x2 * zoom}
                      y2={arrowPreview.y2 * zoom}
                      stroke={currentColor}
                      strokeWidth={2.5 * zoom}
                      strokeDasharray="4 4"
                    />
                    {(() => {
                      const x1 = arrowPreview.x1 * zoom;
                      const y1 = arrowPreview.y1 * zoom;
                      const x2 = arrowPreview.x2 * zoom;
                      const y2 = arrowPreview.y2 * zoom;
                      const angle = Math.atan2(y2 - y1, x2 - x1);
                      const headLength = 14 * zoom;
                      const arrowPoint1X = x2 - headLength * Math.cos(angle - Math.PI / 6);
                      const arrowPoint1Y = y2 - headLength * Math.sin(angle - Math.PI / 6);
                      const arrowPoint2X = x2 - headLength * Math.cos(angle + Math.PI / 6);
                      const arrowPoint2Y = y2 - headLength * Math.sin(angle + Math.PI / 6);
                      return (
                        <polygon 
                          points={`${x2},${y2} ${arrowPoint1X},${arrowPoint1Y} ${arrowPoint2X},${arrowPoint2Y}`} 
                          fill={currentColor}
                        />
                      );
                    })()}
                  </g>
                )}
              </svg>
            </div>
          )}
        </div>

      </div>

      {/* 3. SETTINGS & LOGICAL SIDEBAR PROPERTIES (Col Span 4) */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Active element properties box */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
          <h3 className="text-xs font-bold text-slate-550 tracking-wider uppercase flex items-center gap-2 border-b border-slate-100 pb-3">
            <Settings2 className="w-4 h-4 text-indigo-650" />
            Pannello di Controllo
          </h3>

          {selectedElement ? (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between text-xs text-slate-450">
                <span>Tipo: <strong>{selectedElement.type.toUpperCase()}</strong></span>
                <span className="font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-150 text-[10px]">
                  ID: {selectedElement.id.split('_')[1]?.substring(0, 5) || selectedElement.id.substring(0, 5)}
                </span>
              </div>

              {/* Text Edit Specific Form */}
              {selectedElement.type === 'text' && (
                <div className="space-y-2">
                  <label htmlFor="text-editor-input" className="text-xs font-bold text-slate-600 block">Testo:</label>
                  <input
                    id="text-editor-input"
                    type="text"
                    value={(selectedElement as TextEditorElement).text}
                    onChange={(e) => updateSelectedElement({ text: e.target.value })}
                    className="w-full bg-slate-50 px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500 font-semibold-xs"
                  />
                </div>
              )}

              {/* Balloon Edit Specific Form */}
              {selectedElement.type === 'balloon' && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="number-editor-input" className="text-xs font-bold text-slate-600 block">Numero Pallinatura:</label>
                    <input
                      id="number-editor-input"
                      type="text"
                      maxLength={3}
                      value={(selectedElement as BalloonEditorElement).number}
                      onChange={(e) => updateSelectedElement({ number: e.target.value })}
                      className="w-full bg-slate-50 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold text-center text-slate-800 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Rotation Selector */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-bold flex items-center gap-1">
                        <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
                        Direzione Punta:
                      </span>
                      <span className="font-mono font-bold text-indigo-650">{(selectedElement as BalloonEditorElement).angle}°</span>
                    </div>
                    
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={(selectedElement as BalloonEditorElement).angle}
                      onChange={(e) => updateSelectedElement({ angle: parseInt(e.target.value, 10) })}
                      className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono font-bold">
                      <span>0° (DX)</span>
                      <span>90° (GIÙ)</span>
                      <span>180° (SX)</span>
                      <span>270° (SU)</span>
                    </div>
                  </div>

                  {/* Outline Only Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-150 mt-1">
                    <span className="text-xs font-bold text-slate-600 cursor-pointer flex items-center gap-1.5">
                      Solo contorno (Outline):
                    </span>
                    <input
                      id="outline-only-toggle"
                      type="checkbox"
                      checked={!!(selectedElement as BalloonEditorElement).outlineOnly}
                      onChange={(e) => updateSelectedElement({ outlineOnly: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 accent-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                </>
              )}

              {/* Sizing adjuster depending on category */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
                  <span>
                    {selectedElement.type === 'text' && "Dimensione Font:"}
                    {selectedElement.type === 'arrow' && "Spessore Freccia:"}
                    {selectedElement.type === 'balloon' && "Scala Globale:"}
                  </span>
                  <span className="font-mono text-indigo-600">
                    {selectedElement.type === 'text' && `${(selectedElement as TextEditorElement).fontSize}px`}
                    {selectedElement.type === 'arrow' && `${(selectedElement as ArrowEditorElement).width}px`}
                    {selectedElement.type === 'balloon' && `x${(selectedElement as BalloonEditorElement).scale.toFixed(1)}`}
                  </span>
                </div>

                <input
                  type="range"
                  min={selectedElement.type === 'text' ? '8' : selectedElement.type === 'arrow' ? '1' : '0.5'}
                  max={selectedElement.type === 'text' ? '36' : selectedElement.type === 'arrow' ? '8' : '2.0'}
                  step={selectedElement.type === 'balloon' ? '0.1' : '1'}
                  value={
                    selectedElement.type === 'text' 
                      ? (selectedElement as TextEditorElement).fontSize 
                      : selectedElement.type === 'arrow'
                        ? (selectedElement as ArrowEditorElement).width
                        : (selectedElement as BalloonEditorElement).scale
                  }
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (selectedElement.type === 'text') {
                      updateSelectedElement({ fontSize: value });
                    } else if (selectedElement.type === 'arrow') {
                      updateSelectedElement({ width: value });
                    } else if (selectedElement.type === 'balloon') {
                      updateSelectedElement({ scale: value });
                    }
                  }}
                  className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                />
              </div>

              {/* Color Swatch Selector */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-600 block">Colore Linee / Fill:</span>
                <div className="grid grid-cols-7 gap-1.5 items-center">
                  {colors.map(c => (
                    <button
                      key={c.value}
                      onClick={() => {
                        updateSelectedElement({ color: c.value });
                        setCurrentColor(c.value); // set default for next elements
                      }}
                      className="w-full aspect-square rounded-lg relative cursor-pointer outline-none border border-black/10 transition-transform active:scale-90"
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    >
                      {selectedElement.color === c.value && (
                        <span className="absolute inset-1 border-2 border-white rounded-md mix-blend-difference" />
                      )}
                    </button>
                  ))}

                  {/* Custom color picker for selected item */}
                  <div 
                    className={`relative w-full aspect-square rounded-lg border flex items-center justify-center bg-slate-50 cursor-pointer overflow-hidden transition-all active:scale-90 ${
                      !colors.some(c => c.value === selectedElement.color)
                        ? 'border-indigo-505 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                    title="Scegli colore personalizzato"
                  >
                    <input
                      type="color"
                      value={selectedElement.color}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateSelectedElement({ color: val });
                        setCurrentColor(val);
                      }}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                    <div className="w-5 h-5 rounded-full flex items-center justify-center border border-black/10" style={{ backgroundColor: selectedElement.color }}>
                      <span className="text-[10px] font-bold text-white mix-blend-difference">+</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Deletion control */}
              <button
                onClick={deleteSelectedElement}
                className="w-full mt-2 bg-red-50 hover:bg-red-100 text-red-650 font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-red-150"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Elimina Annotazione
              </button>

            </div>
          ) : (
            <div className="space-y-5 animate-fade-in text-slate-750">
              <div className="text-center py-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl mb-1">
                <HelpCircle className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                <p className="text-slate-700 text-xs font-bold">Nessun elemento selezionato</p>
                <p className="text-[10px] text-slate-450 max-w-xs mx-auto px-4 leading-relaxed">
                  Fai clic su un'annotazione esistente per modificarla, oppure imposta i valori predefiniti qui sotto.
                </p>
              </div>

              {/* Default Settings configuration section */}
              <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-150">
                <h4 className="text-xs font-bold text-slate-705 tracking-wide uppercase border-b border-slate-200 pb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
                  Impostazioni Nuovi Elementi
                </h4>

                {/* Default Font Size */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
                    <span>Dimensione Font predefinita:</span>
                    <span className="font-mono text-indigo-600">{lastFontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="36"
                    step="1"
                    value={lastFontSize}
                    onChange={(e) => setLastFontSize(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Default Balloon Scale */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
                    <span>Scala Goccia predefinita:</span>
                    <span className="font-mono text-indigo-600">x{lastBalloonScale.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={lastBalloonScale}
                    onChange={(e) => setLastBalloonScale(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Color Swatch Selector for New Elements */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-600 block">Colore Predefinito:</span>
                  <div className="grid grid-cols-7 gap-1.5 items-center">
                    {colors.map(c => {
                      const isSelected = currentColor === c.value;
                      return (
                        <button
                          key={c.value}
                          onClick={() => setCurrentColor(c.value)}
                          className="w-full aspect-square rounded-lg relative cursor-pointer outline-none border border-black/10 transition-transform active:scale-90"
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                        >
                          {isSelected && (
                            <span className="absolute inset-1 border-2 border-white rounded-md mix-blend-difference" />
                          )}
                        </button>
                      );
                    })}

                    {/* Custom Color Selector */}
                    <div 
                      className={`relative w-full aspect-square rounded-lg border flex items-center justify-center bg-slate-50 cursor-pointer overflow-hidden transition-all active:scale-90 ${
                        !colors.some(c => c.value === currentColor) 
                          ? 'border-indigo-500 ring-2 ring-indigo-500/25' 
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                      title="Scegli colore personalizzato"
                    >
                      <input
                        type="color"
                        value={currentColor}
                        onChange={(e) => setCurrentColor(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                      <div className="w-5 h-5 rounded-full flex items-center justify-center border border-black/10" style={{ backgroundColor: currentColor }}>
                        <span className="text-[10px] font-bold text-white mix-blend-difference">+</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Floating Quick Help Guide */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-3 font-semibold-xs text-xs text-slate-505 leading-relaxed">
          <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">
            Guida all'Editor Tecnico
          </span>
          <div className="space-y-2 text-[11px]">
            <p>
              ● <strong>Trascina</strong> gli elementi sul foglio per riposizionarli con precisione chirurgica.
            </p>
            <p>
              ● Le <strong>frecce</strong> mostrano maniglie bianche riposizionabili per deviare l'orientamento della freccia stessa o alterarne la lunghezza.
            </p>
            <p>
              ● La <strong>pallinatura a goccia</strong> è rotazionale: usa il slider per orientare la punta direzionale verso elementi geometrici e inserisci numeri o lettere all'interno. LaCounter-Rotazione nativa assicura che il testo rimanga dritto!
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
