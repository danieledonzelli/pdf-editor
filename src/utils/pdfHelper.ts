import { PDFDocument } from 'pdf-lib';
import { SelectedPdfFile } from '../types';

/**
 * Legge un file PDF e restituisce il numero totale di pagine.
 */
export async function getPdfPageCount(file: File): Promise<number> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { 
      updateMetadata: false 
    });
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error('Errore durante la lettura del PDF:', error);
    throw new Error('Impossibile caricare il file PDF. Assicurati che non sia corrotto o crittografato.');
  }
}

/**
 * Parsifica una stringa di intervallo pagine (es. "1-3, 5, 8-10") e restituisce un array di pagine (1-based).
 */
export function parseRangeString(rangeStr: string, maxPages: number): number[] {
  if (!rangeStr.trim()) return [];
  
  const pages = new Set<number>();
  const tokens = rangeStr.split(',');
  
  for (let token of tokens) {
    token = token.trim();
    if (!token) continue;
    
    if (token.includes('-')) {
      const parts = token.split('-');
      if (parts.length === 2) {
        const start = parseInt(parts[0].trim(), 10);
        const end = parseInt(parts[1].trim(), 10);
        
        if (!isNaN(start) && !isNaN(end)) {
          const from = Math.min(start, end);
          const to = Math.max(start, end);
          for (let i = from; i <= to; i++) {
            if (i >= 1 && i <= maxPages) {
              pages.add(i);
            }
          }
        }
      }
    } else {
      const pageNum = parseInt(token, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= maxPages) {
        pages.add(pageNum);
      }
    }
  }
  
  return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Genera una stringa leggibile a partire da un set di pagine (es. [1,2,3,5] -> "1-3, 5")
 */
export function formatRangeString(pages: number[]): string {
  if (pages.length === 0) return '';
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  
  let start = sorted[0];
  let end = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      if (start === end) {
        ranges.push(`${start}`);
      } else {
        ranges.push(`${start}-${end}`);
      }
      start = sorted[i];
      end = sorted[i];
    }
  }
  
  if (start === end) {
    ranges.push(`${start}`);
  } else {
    ranges.push(`${start}-${end}`);
  }
  
  return ranges.join(', ');
}

/**
 * Unisce i file PDF selezionati estraendo solo le pagine indicate in ciascuno.
 */
export async function mergePdfFiles(selectedFiles: SelectedPdfFile[]): Promise<Uint8Array> {
  if (selectedFiles.length === 0) {
    throw new Error('Nessun file selezionato per l\'unione.');
  }

  try {
    const mergedDoc = await PDFDocument.create();
    
    for (const item of selectedFiles) {
      const fileBytes = await item.file.arrayBuffer();
      const srcDoc = await PDFDocument.load(fileBytes, { 
        ignoreEncryption: true,
        updateMetadata: false
      });
      
      // Converte indici 1-based in 0-based per pdf-lib
      const pageIndicesToCopy = item.selectedPages.map(page => page - 1);
      
      if (pageIndicesToCopy.length === 0) {
        continue; // Salta il file se non si scelgono pagine
      }

      // Copia le pagine selezionate nel nuovo documento
      const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndicesToCopy);
      
      // Aggiunge le pagine copiate
      for (const page of copiedPages) {
        mergedDoc.addPage(page);
      }
    }
    
    return await mergedDoc.save();
  } catch (error) {
    console.error('Errore durante l\'unione dei PDF:', error);
    throw new Error('Si è verificato un errore durante l\'unione dei file PDF. Verifica che i file siano validi.');
  }
}

/**
 * Utility per formattare la dimensione del file in KB/MB
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
